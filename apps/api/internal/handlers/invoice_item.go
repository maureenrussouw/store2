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
	"store2/apps/api/internal/models"
	"store2/apps/api/internal/paginate"
	"store2/apps/api/internal/pdf"
	"store2/apps/api/internal/respond"
	"store2/apps/api/internal/services"
)

// InvoiceItemHandler serves the invoiceitem endpoints. It reads the request, asks
// services.InvoiceItemService, and writes the answer; it runs no query of its
// own, so everything a route does is also available to a job or a test.
type InvoiceItemHandler struct {
	DB *gorm.DB
	// AppName brands the PDF export. The route file sets it from config.
	AppName string
}

// service is the invoiceitem service over this handler's database.
func (h *InvoiceItemHandler) service() *services.InvoiceItemService {
	return &services.InvoiceItemService{DB: h.DB}
}

// ctx is the request's context with the caller on it, which the service
// scopes owned rows by. The organization the multitenant plugin resolved and
// the cancellation when the client goes away travel with it.
func (h *InvoiceItemHandler) ctx(c *gin.Context) context.Context {
	return authz.WithActor(c.Request.Context(), authz.ActorOf(c))
}

// fail answers an error from the service: a version conflict with the version
// the record is at, a missing row with 404, a broken rule with 422 and its
// message, and anything else as an opaque 500 that is logged.
func (h *InvoiceItemHandler) fail(c *gin.Context, err error, fallback string) {
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
		respond.Fail(c, respond.CodeNotFound, "InvoiceItem not found")
	default:
		respond.WriteError(c, err, fallback)
	}
}

// List returns a paginated list of invoice_items.
//
//	?archived=true   only archived rows
//	?archived=all    both
//	(default)        only live rows
func (h *InvoiceItemHandler) List(c *gin.Context) {
	res, err := h.service().List(h.ctx(c), paginate.Bind(c).With("invoice_id", c.Query("invoice_id")), c.Query("archived"))
	if err != nil {
		h.fail(c, err, "Failed to fetch invoice_items")
		return
	}

	c.JSON(http.StatusOK, res)
}

// Export streams the full filtered list as CSV (default) or XLSX: the same
// search as List, without pages.
//
//	GET /api/invoice_items/export?format=csv
//	GET /api/invoice_items/export?format=xlsx&search=foo
func (h *InvoiceItemHandler) Export(c *gin.Context) {
	format := c.DefaultQuery("format", "csv")
	search := c.Query("search")

	opts := export.Options{
		Sheet: "InvoiceItems",
		Columns: []export.Column{
			{Header: "ID", Field: "ID"},
			{Header: "Description", Field: "Description"},
			{Header: "Qty", Field: "Qty"},
			{Header: "UnitRate", Field: "UnitRate"},
			{Header: "Created At", Field: "CreatedAt", Format: "date:2006-01-02"},
		},
	}

	if format == "xlsx" {
		// Rows go into the workbook batch by batch, through a writer that moves
		// them to a temporary file, so memory stays flat however many match.
		sheet, err := export.NewXLSXStream(opts)
		if err != nil {
			h.fail(c, err, "Failed to export invoice_items")
			return
		}
		defer func() {
			if err := sheet.Close(); err != nil {
				log.Printf("export invoice_items as xlsx: removing temporary files: %v", err)
			}
		}()
		if err := h.service().Export(h.ctx(c), search, func(rows []models.InvoiceItem) error {
			return sheet.Rows(rows)
		}); err != nil {
			h.fail(c, err, "Failed to export invoice_items")
			return
		}
		c.Header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
		c.Header("Content-Disposition", `attachment; filename="invoice_items.xlsx"`)
		if err := sheet.Finish(c.Writer); err != nil {
			log.Printf("export invoice_items as xlsx: %v", err)
		}
		return
	}

	// CSV streams: the header with the first batch, then each batch as it is
	// read.
	c.Header("Content-Type", "text/csv")
	c.Header("Content-Disposition", `attachment; filename="invoice_items.csv"`)

	headerWritten := false
	err := h.service().Export(h.ctx(c), search, func(rows []models.InvoiceItem) error {
		if !headerWritten {
			headerWritten = true
			return export.CSV(c.Writer, rows, opts)
		}
		return export.CSVRows(c.Writer, rows, opts)
	})
	if err == nil && !headerWritten {
		// Nothing matched: still a CSV, with its header row.
		err = export.CSV(c.Writer, []models.InvoiceItem{}, opts)
	}
	if err != nil {
		if !c.Writer.Written() {
			c.Writer.Header().Del("Content-Type")
			c.Writer.Header().Del("Content-Disposition")
			h.fail(c, err, "Failed to export invoice_items")
			return
		}
		// Rows are already on the wire, so the status cannot change. Logged,
		// so a truncated file has an explanation somewhere.
		log.Printf("export invoice_items: %v", err)
	}
}

// GetByID returns a single invoiceitem by ID.
func (h *InvoiceItemHandler) GetByID(c *gin.Context) {
	item, err := h.service().GetByID(h.ctx(c), c.Param("id"))
	if err != nil {
		h.fail(c, err, "Failed to load invoiceitem")
		return
	}

	// The version to send back as If-Match when saving.
	c.Header("ETag", concurrency.Tag(item.Version))
	c.JSON(http.StatusOK, gin.H{
		"data": item,
	})
}

// PDF streams this invoiceitem as a print-ready PDF: a repeating header and
// footer with page numbers, the record's fields as a detail grid, and any
// line items as a table. Edit the pdf.Record below to restyle it; the
// renderer itself lives in internal/pdf/record.go.
func (h *InvoiceItemHandler) PDF(c *gin.Context) {
	id := c.Param("id")

	item, err := h.service().GetByID(h.ctx(c), id)
	if err != nil {
		h.fail(c, err, "Failed to load invoiceitem")
		return
	}

	appName := h.AppName
	if appName == "" {
		appName = "InvoiceItem"
	}

	rec := pdf.Record{
		Title:      "INVOICE ITEM",
		Subtitle:   pdf.Value(item.ID),
		Brand:      appName,
		FooterNote: appName + " · generated " + time.Now().Format("2 Jan 2006 15:04"),
		Fields: []pdf.Field{
			{Label: "Description", Value: pdf.Value(item.Description)},
			{Label: "Qty", Value: pdf.Value(item.Qty)},
			{Label: "Unit Rate", Value: pdf.Value(item.UnitRate)},
			{Label: "Invoice", Value: pdf.Display(item.Invoice)},
			{Label: "Created", Value: pdf.Value(item.CreatedAt)},
		},
	}

	out, err := pdf.RenderRecord(rec)
	if err != nil {
		respond.Fail(c, respond.CodePDFError, "could not render the PDF")
		return
	}

	filename := "invoice-item-" + id + ".pdf"
	c.Header("Content-Disposition", "inline; filename=\""+filename+"\"")
	c.Data(http.StatusOK, "application/pdf", out)
}

// CreateInvoiceItemRequest is the JSON body accepted by POST /invoice_items.
//
// Named rather than anonymous so the API reference can document it: gindocs
// builds a request schema by reflecting over a real type. routes.go passes
// this type to docs.Route(...).RequestBody().
type CreateInvoiceItemRequest struct {
	Description string  `json:"description" binding:"required"`
	Qty         int     `json:"qty"`
	UnitRate    float64 `json:"unit_rate"`
	InvoiceID   string  `json:"invoice_id" binding:"required"`
}

// UpdateInvoiceItemRequest is the JSON body accepted by PUT /invoice_items/:id.
// Every field is optional: only what the client sends is applied.
type UpdateInvoiceItemRequest struct {
	Description string   `json:"description"`
	Qty         *int     `json:"qty"`
	UnitRate    *float64 `json:"unit_rate"`
	InvoiceID   *string  `json:"invoice_id"`
}

// Create adds a new invoiceitem.
func (h *InvoiceItemHandler) Create(c *gin.Context) {
	var req CreateInvoiceItemRequest

	if err := c.ShouldBindJSON(&req); err != nil {
		respond.Fail(c, respond.CodeValidationError, err.Error())
		return
	}

	item := models.InvoiceItem{
		Description: req.Description,
		Qty:         req.Qty,
		UnitRate:    req.UnitRate,
		InvoiceID:   req.InvoiceID,
	}

	if err := h.service().Create(h.ctx(c), &item); err != nil {
		h.fail(c, err, "Failed to create invoiceitem")
		return
	}

	events.Emitted(c, "invoice_items", "InvoiceItem", "created", item.ID, item.ID, "", nil, item)

	c.JSON(http.StatusCreated, gin.H{
		"data":    item,
		"message": "InvoiceItem created successfully",
	})
}

// Update modifies an existing invoiceitem. A client that sends the version it
// read as If-Match gets 409 instead of overwriting a newer save.
func (h *InvoiceItemHandler) Update(c *gin.Context) {
	id := c.Param("id")

	var req UpdateInvoiceItemRequest

	if err := c.ShouldBindJSON(&req); err != nil {
		respond.Fail(c, respond.CodeValidationError, err.Error())
		return
	}

	updates := map[string]interface{}{}
	if req.Description != "" {
		updates["description"] = req.Description
	}
	if req.Qty != nil {
		updates["qty"] = *req.Qty
	}
	if req.UnitRate != nil {
		updates["unit_rate"] = *req.UnitRate
	}
	if req.InvoiceID != nil {
		updates["invoice_id"] = *req.InvoiceID
	}

	item, err := h.service().Update(h.ctx(c), id, updates, concurrency.FromRequest(c))
	if err != nil {
		h.fail(c, err, "Failed to update invoiceitem")
		return
	}

	events.Emitted(c, "invoice_items", "InvoiceItem", "updated", item.ID, item.ID, services.DiffSummary(updates), nil, item)

	c.Header("ETag", concurrency.Tag(item.Version))
	c.JSON(http.StatusOK, gin.H{
		"data":    item,
		"message": "InvoiceItem updated successfully",
	})
}

// Patch applies a partial update to a invoiceitem. Used by the admin's grouped
// update view: each form group's Save button sends only the fields it owns, so
// editing "Address" does not rewrite "Pricing".
func (h *InvoiceItemHandler) Patch(c *gin.Context) {
	var body map[string]interface{}
	if err := c.ShouldBindJSON(&body); err != nil {
		respond.Fail(c, respond.CodeValidationError, err.Error())
		return
	}

	item, updates, err := h.service().Patch(h.ctx(c), c.Param("id"), body, concurrency.FromRequest(c))
	if err != nil {
		h.fail(c, err, "Failed to patch invoiceitem")
		return
	}

	events.Emitted(c, "invoice_items", "InvoiceItem", "updated", item.ID, item.ID, services.DiffSummary(updates), nil, item)

	c.Header("ETag", concurrency.Tag(item.Version))
	c.JSON(http.StatusOK, gin.H{
		"data":    item,
		"message": "InvoiceItem updated successfully",
	})
}

// Delete soft-deletes a invoiceitem.
func (h *InvoiceItemHandler) Delete(c *gin.Context) {
	item, err := h.service().Delete(h.ctx(c), c.Param("id"))
	if err != nil {
		h.fail(c, err, "Failed to delete invoiceitem")
		return
	}

	events.Emitted(c, "invoice_items", "InvoiceItem", "deleted", item.ID, item.ID, "", item, nil)

	c.JSON(http.StatusOK, gin.H{
		"message": "InvoiceItem deleted successfully",
	})
}

// BulkInvoiceItemRequest is one operation applied to a set of rows.
//
// One request rather than one per row. The admin used to fire N parallel
// DELETEs, which means N transactions, N audit entries, and a half-applied
// result when the eleventh fails.
type BulkInvoiceItemRequest struct {
	// delete removes, archive puts away, restore brings back, patch writes the
	// same field values to every selected row.
	Action string `json:"action" binding:"required,oneof=delete archive restore patch"`
	// Capped: an unbounded IN clause is a way to lock a table by accident.
	IDs []string `json:"ids" binding:"required,min=1,max=500"`
	// Only read when action is "patch". Whitelisted the same way Patch is.
	Patch map[string]interface{} `json:"patch"`
}

// Bulk applies one action to many invoice_items in a single transaction.
func (h *InvoiceItemHandler) Bulk(c *gin.Context) {
	var req BulkInvoiceItemRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respond.Fail(c, respond.CodeValidationError, err.Error())
		return
	}

	result, err := h.service().Bulk(h.ctx(c), req.Action, req.IDs, req.Patch)
	if err != nil {
		h.fail(c, err, "Failed to "+req.Action+" invoice_items")
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

	noun := "invoice_items"
	if len(ids) == 1 {
		noun = "invoiceitem"
	}

	summary := req.Action + " " + strconv.Itoa(len(ids)) + " " + noun
	if req.Action == "patch" {
		summary += ": " + services.DiffSummary(result.Updates)
	}
	// resourceID holds ONE id, not all of them: it is a lookup key, and the
	// count lives in the summary, where it can be read.
	events.Emitted(c, "invoice_items", "InvoiceItem", "bulk", ids[0], summary, summary, nil, nil)

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

// BulkEditInvoiceItemRequest is the grid's save: one patch per row.
type BulkEditInvoiceItemRequest struct {
	// Capped for the same reason Bulk's ids are: a transaction holding five
	// hundred row locks is a transaction other writers wait behind.
	Items []services.InvoiceItemGridEdit `json:"items" binding:"required,min=1,max=500"`
}

// BulkEdit saves a grid of edits, one patch per row, in one transaction.
func (h *InvoiceItemHandler) BulkEdit(c *gin.Context) {
	var req BulkEditInvoiceItemRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respond.Fail(c, respond.CodeValidationError, err.Error())
		return
	}

	saved, rowErrors, err := h.service().BulkEdit(h.ctx(c), req.Items)
	if err != nil {
		h.fail(c, err, "Failed to save the invoice_items")
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

	noun := "invoice_items"
	if len(saved) == 1 {
		noun = "invoiceitem"
	}
	summary := "edited " + strconv.Itoa(len(saved)) + " " + noun + " in the grid"
	events.Emitted(c, "invoice_items", "InvoiceItem", "bulk", saved[0], summary, summary, nil, nil)

	c.JSON(http.StatusOK, gin.H{
		"data":    gin.H{"affected": len(saved), "requested": len(req.Items)},
		"message": strconv.Itoa(len(saved)) + " " + noun + " updated",
	})
}

// BulkCreateInvoiceItemRequest is the grid's insert: whole rows, no ids.
type BulkCreateInvoiceItemRequest struct {
	Items []map[string]interface{} `json:"items" binding:"required,min=1,max=500"`
}

// BulkCreate inserts a grid of new invoice_items in one transaction.
func (h *InvoiceItemHandler) BulkCreate(c *gin.Context) {
	var req BulkCreateInvoiceItemRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respond.Fail(c, respond.CodeValidationError, err.Error())
		return
	}

	created, rowErrors, err := h.service().BulkCreate(h.ctx(c), req.Items)
	if err != nil {
		h.fail(c, err, "Failed to create the invoice_items")
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

	noun := "invoice_items"
	if len(created) == 1 {
		noun = "invoiceitem"
	}
	summary := "created " + strconv.Itoa(len(created)) + " " + noun + " in the grid"
	events.Emitted(c, "invoice_items", "InvoiceItem", "bulk", created[0].ID, summary, summary, nil, nil)

	// The rows as stored, so the grid can show the ids, the generated slugs and
	// anything else a hook filled in rather than guessing at them.
	c.JSON(http.StatusCreated, gin.H{
		"data":    created,
		"message": strconv.Itoa(len(created)) + " " + noun + " created",
	})
}
