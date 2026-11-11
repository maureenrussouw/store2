package handlers

import (
	"context"
	"errors"
	"log"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"store2/apps/api/internal/authz"
	"store2/apps/api/internal/concurrency"
	"store2/apps/api/internal/events"
	"store2/apps/api/internal/export"
	"store2/apps/api/internal/files"
	"store2/apps/api/internal/models"
	"store2/apps/api/internal/paginate"
	"store2/apps/api/internal/pdf"
	"store2/apps/api/internal/respond"
	"store2/apps/api/internal/services"
	"store2/apps/api/internal/storage"
)

// CategoryHandler serves the category endpoints. It reads the request, asks
// services.CategoryService, and writes the answer; it runs no query of its
// own, so everything a route does is also available to a job or a test.
type CategoryHandler struct {
	DB      *gorm.DB
	Storage *storage.Storage
	// AppName brands the PDF export. The route file sets it from config.
	AppName string
}

// service is the category service over this handler's database.
func (h *CategoryHandler) service() *services.CategoryService {
	return &services.CategoryService{DB: h.DB, Storage: h.Storage}
}

// ctx is the request's context with the caller on it, which the service
// scopes owned rows by. The organization the multitenant plugin resolved and
// the cancellation when the client goes away travel with it.
func (h *CategoryHandler) ctx(c *gin.Context) context.Context {
	return authz.WithActor(c.Request.Context(), authz.ActorOf(c))
}

// fail answers an error from the service: a version conflict with the version
// the record is at, a missing row with 404, a broken rule with 422 and its
// message, and anything else as an opaque 500 that is logged.
func (h *CategoryHandler) fail(c *gin.Context, err error, fallback string) {
	var conflict *concurrency.ErrConflict
	var denied *authz.DeniedError
	switch {
	case errors.As(err, &conflict):
		concurrency.WriteConflict(c, conflict.Current)
	case errors.As(err, &denied):
		// A policy refused, and said why. 403 rather than the 404 that
		// ownership uses: the caller is already allowed to see this row,
		// so hiding it says nothing and withholds the reason, which is the
		// thing the rule exists to give.
		respond.Fail(c, respond.CodeForbidden, denied.Reason)
	case errors.Is(err, gorm.ErrRecordNotFound):
		respond.Fail(c, respond.CodeNotFound, "Category not found")
	default:
		respond.WriteError(c, err, fallback)
	}
}

// optionalCategoryID turns an empty id from a form or a JSON body into NULL.
//
// A nullable foreign key column holds a real key or NULL, and "" is neither.
// Postgres refuses it with SQLSTATE 23503; SQLite accepts it and stores a
// dangling reference. Both are answered here, once, at the edge.
func optionalCategoryID(id string) *string {
	if id == "" {
		return nil
	}
	return &id
}

// List returns a paginated list of categories.
//
//	?archived=true   only archived rows
//	?archived=all    both
//	(default)        only live rows
func (h *CategoryHandler) List(c *gin.Context) {
	res, err := h.service().List(h.ctx(c), paginate.Bind(c).With("parent_id", c.Query("parent_id")), c.Query("archived"))
	if err != nil {
		h.fail(c, err, "Failed to fetch categories")
		return
	}

	c.JSON(http.StatusOK, res)
}

// Export streams the full filtered list as CSV (default) or XLSX: the same
// search as List, without pages.
//
//	GET /api/categories/export?format=csv
//	GET /api/categories/export?format=xlsx&search=foo
func (h *CategoryHandler) Export(c *gin.Context) {
	format := c.DefaultQuery("format", "csv")
	search := c.Query("search")

	opts := export.Options{
		Sheet: "Categories",
		Columns: []export.Column{
			{Header: "ID", Field: "ID"},
			{Header: "Name", Field: "Name"},
			{Header: "Slug", Field: "Slug"},
			{Header: "Image", Field: "Image"},
			{Header: "Featured", Field: "Featured", Format: "bool"},
			{Header: "Created At", Field: "CreatedAt", Format: "date:2006-01-02"},
		},
	}

	if format == "xlsx" {
		// Rows go into the workbook batch by batch, through a writer that moves
		// them to a temporary file, so memory stays flat however many match.
		sheet, err := export.NewXLSXStream(opts)
		if err != nil {
			h.fail(c, err, "Failed to export categories")
			return
		}
		defer func() {
			if err := sheet.Close(); err != nil {
				log.Printf("export categories as xlsx: removing temporary files: %v", err)
			}
		}()
		if err := h.service().Export(h.ctx(c), search, func(rows []models.Category) error {
			return sheet.Rows(rows)
		}); err != nil {
			h.fail(c, err, "Failed to export categories")
			return
		}
		c.Header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
		c.Header("Content-Disposition", `attachment; filename="categories.xlsx"`)
		if err := sheet.Finish(c.Writer); err != nil {
			log.Printf("export categories as xlsx: %v", err)
		}
		return
	}

	// CSV streams: the header with the first batch, then each batch as it is
	// read.
	c.Header("Content-Type", "text/csv")
	c.Header("Content-Disposition", `attachment; filename="categories.csv"`)

	headerWritten := false
	err := h.service().Export(h.ctx(c), search, func(rows []models.Category) error {
		if !headerWritten {
			headerWritten = true
			return export.CSV(c.Writer, rows, opts)
		}
		return export.CSVRows(c.Writer, rows, opts)
	})
	if err == nil && !headerWritten {
		// Nothing matched: still a CSV, with its header row.
		err = export.CSV(c.Writer, []models.Category{}, opts)
	}
	if err != nil {
		if !c.Writer.Written() {
			c.Writer.Header().Del("Content-Type")
			c.Writer.Header().Del("Content-Disposition")
			h.fail(c, err, "Failed to export categories")
			return
		}
		// Rows are already on the wire, so the status cannot change. Logged,
		// so a truncated file has an explanation somewhere.
		log.Printf("export categories: %v", err)
	}
}

// GetByID returns a single category by ID.
func (h *CategoryHandler) GetByID(c *gin.Context) {
	item, err := h.service().GetByID(h.ctx(c), c.Param("id"))
	if err != nil {
		h.fail(c, err, "Failed to load category")
		return
	}

	// The version to send back as If-Match when saving.
	c.Header("ETag", concurrency.Tag(item.Version))
	c.JSON(http.StatusOK, gin.H{
		"data": item,
	})
}

// PDF streams this category as a print-ready PDF: a repeating header and
// footer with page numbers, the record's fields as a detail grid, and any
// line items as a table. Edit the pdf.Record below to restyle it; the
// renderer itself lives in internal/pdf/record.go.
func (h *CategoryHandler) PDF(c *gin.Context) {
	id := c.Param("id")

	item, err := h.service().GetByID(h.ctx(c), id)
	if err != nil {
		h.fail(c, err, "Failed to load category")
		return
	}

	appName := h.AppName
	if appName == "" {
		appName = "Category"
	}

	rec := pdf.Record{
		Title:      "CATEGORY",
		Subtitle:   pdf.Value(item.Name),
		Brand:      appName,
		FooterNote: appName + " · generated " + time.Now().Format("2 Jan 2006 15:04"),
		Fields: []pdf.Field{
			{Label: "Name", Value: pdf.Value(item.Name)},
			{Label: "Featured", Value: pdf.Value(item.Featured)},
			{Label: "Parent", Value: pdf.Display(item.Parent)},
			{Label: "Created", Value: pdf.Value(item.CreatedAt)},
		},
	}

	out, err := pdf.RenderRecord(rec)
	if err != nil {
		respond.Fail(c, respond.CodePDFError, "could not render the PDF")
		return
	}

	filename := "category-" + id + ".pdf"
	c.Header("Content-Disposition", "inline; filename=\""+filename+"\"")
	c.Data(http.StatusOK, "application/pdf", out)
}

// CreateCategoryRequest is the JSON body accepted by POST /categories.
//
// Named rather than anonymous so the API reference can document it: gindocs
// builds a request schema by reflecting over a real type. routes.go passes
// this type to docs.Route(...).RequestBody().
type CreateCategoryRequest struct {
	Name     string         `json:"name" binding:"required"`
	Image    *files.FileRef `json:"image"`
	Featured bool           `json:"featured"`
	ParentID string         `json:"parent_id"`
}

// UpdateCategoryRequest is the JSON body accepted by PUT /categories/:id.
// Every field is optional: only what the client sends is applied.
type UpdateCategoryRequest struct {
	Name     string          `json:"name"`
	Image    **files.FileRef `json:"image"`
	Featured *bool           `json:"featured"`
	ParentID *string         `json:"parent_id"`
}

// Create adds a new category.
func (h *CategoryHandler) Create(c *gin.Context) {
	var req CreateCategoryRequest

	if err := c.ShouldBindJSON(&req); err != nil {
		respond.Fail(c, respond.CodeValidationError, err.Error())
		return
	}

	item := models.Category{
		Name:     req.Name,
		Image:    req.Image,
		Featured: req.Featured,
		ParentID: optionalCategoryID(req.ParentID),
	}

	if err := h.service().Create(h.ctx(c), &item); err != nil {
		h.fail(c, err, "Failed to create category")
		return
	}

	events.Emitted(c, "categories", "Category", "created", item.ID, item.Name, "", nil, item)

	c.JSON(http.StatusCreated, gin.H{
		"data":    item,
		"message": "Category created successfully",
	})
}

// Update modifies an existing category. A client that sends the version it
// read as If-Match gets 409 instead of overwriting a newer save.
func (h *CategoryHandler) Update(c *gin.Context) {
	id := c.Param("id")

	var req UpdateCategoryRequest

	if err := c.ShouldBindJSON(&req); err != nil {
		respond.Fail(c, respond.CodeValidationError, err.Error())
		return
	}

	updates := map[string]interface{}{}
	if req.Name != "" {
		updates["name"] = req.Name
	}
	if req.Image != nil {
		updates["image"] = *req.Image
	}
	if req.Featured != nil {
		updates["featured"] = *req.Featured
	}
	if req.ParentID != nil {
		updates["parent_id"] = optionalCategoryID(*req.ParentID)
	}

	item, err := h.service().Update(h.ctx(c), id, updates, concurrency.FromRequest(c))
	if err != nil {
		h.fail(c, err, "Failed to update category")
		return
	}

	events.Emitted(c, "categories", "Category", "updated", item.ID, item.Name, services.DiffSummary(updates), nil, item)

	c.Header("ETag", concurrency.Tag(item.Version))
	c.JSON(http.StatusOK, gin.H{
		"data":    item,
		"message": "Category updated successfully",
	})
}

// Patch applies a partial update to a category. Used by the admin's grouped
// update view: each form group's Save button sends only the fields it owns, so
// editing "Address" does not rewrite "Pricing".
func (h *CategoryHandler) Patch(c *gin.Context) {
	var body map[string]interface{}
	if err := c.ShouldBindJSON(&body); err != nil {
		respond.Fail(c, respond.CodeValidationError, err.Error())
		return
	}

	item, updates, err := h.service().Patch(h.ctx(c), c.Param("id"), body, concurrency.FromRequest(c))
	if err != nil {
		h.fail(c, err, "Failed to patch category")
		return
	}

	events.Emitted(c, "categories", "Category", "updated", item.ID, item.Name, services.DiffSummary(updates), nil, item)

	c.Header("ETag", concurrency.Tag(item.Version))
	c.JSON(http.StatusOK, gin.H{
		"data":    item,
		"message": "Category updated successfully",
	})
}

// Delete soft-deletes a category.
func (h *CategoryHandler) Delete(c *gin.Context) {
	item, err := h.service().Delete(h.ctx(c), c.Param("id"))
	if err != nil {
		h.fail(c, err, "Failed to delete category")
		return
	}

	events.Emitted(c, "categories", "Category", "deleted", item.ID, item.Name, "", item, nil)

	c.JSON(http.StatusOK, gin.H{
		"message": "Category deleted successfully",
	})
}

// BulkCategoryRequest is one operation applied to a set of rows.
//
// One request rather than one per row. The admin used to fire N parallel
// DELETEs, which means N transactions, N audit entries, and a half-applied
// result when the eleventh fails.
type BulkCategoryRequest struct {
	// delete removes, archive puts away, restore brings back, patch writes the
	// same field values to every selected row.
	Action string `json:"action" binding:"required,oneof=delete archive restore patch"`
	// Capped: an unbounded IN clause is a way to lock a table by accident.
	IDs []string `json:"ids" binding:"required,min=1,max=500"`
	// Only read when action is "patch". Whitelisted the same way Patch is.
	Patch map[string]interface{} `json:"patch"`
}

// Bulk applies one action to many categories in a single transaction.
func (h *CategoryHandler) Bulk(c *gin.Context) {
	var req BulkCategoryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respond.Fail(c, respond.CodeValidationError, err.Error())
		return
	}

	result, err := h.service().Bulk(h.ctx(c), req.Action, req.IDs, req.Patch)
	if err != nil {
		h.fail(c, err, "Failed to "+req.Action+" categories")
		return
	}
	if len(result.IDs) == 0 {
		c.JSON(http.StatusOK, gin.H{
			"data":    gin.H{"affected": 0, "requested": len(req.IDs)},
			"message": "Nothing to do",
		})
		return
	}
	ids := result.IDs

	// One audit entry naming the action and the count, not N entries that bury
	// everything else somebody did today. A local map, not a package-level
	// helper: every resource has its own handler file in package handlers.
	past := map[string]string{
		"delete":  "deleted",
		"archive": "archived",
		"restore": "restored",
		"patch":   "updated",
	}[req.Action]

	noun := "categories"
	if len(ids) == 1 {
		noun = "category"
	}

	summary := req.Action + " " + strconv.Itoa(len(ids)) + " " + noun
	if req.Action == "patch" {
		summary += ": " + services.DiffSummary(result.Updates)
	}
	// resourceID holds ONE id, not all of them: it is a lookup key, and the
	// count lives in the summary, where it can be read.
	events.Emitted(c, "categories", "Category", "bulk", ids[0], summary, summary, nil, nil)

	c.JSON(http.StatusOK, gin.H{
		"data":    gin.H{"affected": len(ids), "requested": len(req.IDs)},
		"message": strconv.Itoa(len(ids)) + " " + noun + " " + past,
	})
}

// The two grid endpoints, for the admin's spreadsheet editors.
//
// Separate from Bulk rather than actions on it, because the request shapes are
// genuinely different: Bulk takes ids and ONE patch for all of them, and these
// take a row each. Folding them in would mean a required ids field that two of
// the five actions ignore.

// BulkEditCategoryRequest is the grid's save: one patch per row.
type BulkEditCategoryRequest struct {
	// Capped for the same reason Bulk's ids are: a transaction holding five
	// hundred row locks is a transaction other writers wait behind.
	Items []services.CategoryGridEdit `json:"items" binding:"required,min=1,max=500"`
}

// BulkEdit saves a grid of edits, one patch per row, in one transaction.
func (h *CategoryHandler) BulkEdit(c *gin.Context) {
	var req BulkEditCategoryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respond.Fail(c, respond.CodeValidationError, err.Error())
		return
	}

	saved, rowErrors, err := h.service().BulkEdit(h.ctx(c), req.Items)
	if err != nil {
		h.fail(c, err, "Failed to save the categories")
		return
	}
	// Row errors are a 422 with the rows in it, so the grid can put each
	// message back on the line it belongs to rather than showing one banner.
	if len(rowErrors) > 0 {
		c.JSON(http.StatusUnprocessableEntity, gin.H{"error": gin.H{
			"code":    "VALIDATION_ERROR",
			"message": "Some rows could not be saved",
			"details": gin.H{"rows": rowErrors},
		}})
		return
	}
	if len(saved) == 0 {
		c.JSON(http.StatusOK, gin.H{
			"data":    gin.H{"affected": 0, "requested": len(req.Items)},
			"message": "Nothing to do",
		})
		return
	}

	noun := "categories"
	if len(saved) == 1 {
		noun = "category"
	}
	summary := "edited " + strconv.Itoa(len(saved)) + " " + noun + " in the grid"
	events.Emitted(c, "categories", "Category", "bulk", saved[0], summary, summary, nil, nil)

	c.JSON(http.StatusOK, gin.H{
		"data":    gin.H{"affected": len(saved), "requested": len(req.Items)},
		"message": strconv.Itoa(len(saved)) + " " + noun + " updated",
	})
}

// BulkCreateCategoryRequest is the grid's insert: whole rows, no ids.
type BulkCreateCategoryRequest struct {
	Items []map[string]interface{} `json:"items" binding:"required,min=1,max=500"`
}

// BulkCreate inserts a grid of new categories in one transaction.
func (h *CategoryHandler) BulkCreate(c *gin.Context) {
	var req BulkCreateCategoryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respond.Fail(c, respond.CodeValidationError, err.Error())
		return
	}

	created, rowErrors, err := h.service().BulkCreate(h.ctx(c), req.Items)
	if err != nil {
		h.fail(c, err, "Failed to create the categories")
		return
	}
	if len(rowErrors) > 0 {
		c.JSON(http.StatusUnprocessableEntity, gin.H{"error": gin.H{
			"code":    "VALIDATION_ERROR",
			"message": "Some rows could not be created",
			"details": gin.H{"rows": rowErrors},
		}})
		return
	}
	if len(created) == 0 {
		c.JSON(http.StatusOK, gin.H{
			"data":    gin.H{"affected": 0, "requested": len(req.Items)},
			"message": "Nothing to do",
		})
		return
	}

	noun := "categories"
	if len(created) == 1 {
		noun = "category"
	}
	summary := "created " + strconv.Itoa(len(created)) + " " + noun + " in the grid"
	events.Emitted(c, "categories", "Category", "bulk", created[0].ID, summary, summary, nil, nil)

	// The rows as stored, so the grid can show the ids, the generated slugs and
	// anything else a hook filled in rather than guessing at them.
	c.JSON(http.StatusCreated, gin.H{
		"data":    created,
		"message": strconv.Itoa(len(created)) + " " + noun + " created",
	})
}
