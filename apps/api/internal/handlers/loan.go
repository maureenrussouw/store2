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
	"store2/apps/api/internal/jsontime"
	"store2/apps/api/internal/models"
	"store2/apps/api/internal/paginate"
	"store2/apps/api/internal/pdf"
	"store2/apps/api/internal/respond"
	"store2/apps/api/internal/services"
)

// LoanHandler serves the loan endpoints. It reads the request, asks
// services.LoanService, and writes the answer; it runs no query of its
// own, so everything a route does is also available to a job or a test.
type LoanHandler struct {
	DB *gorm.DB
	// AppName brands the PDF export. The route file sets it from config.
	AppName string
}

// service is the loan service over this handler's database.
func (h *LoanHandler) service() *services.LoanService {
	return &services.LoanService{DB: h.DB}
}

// ctx is the request's context with the caller on it, which the service
// scopes owned rows by. The organization the multitenant plugin resolved and
// the cancellation when the client goes away travel with it.
func (h *LoanHandler) ctx(c *gin.Context) context.Context {
	return authz.WithActor(c.Request.Context(), authz.ActorOf(c))
}

// fail answers an error from the service: a version conflict with the version
// the record is at, a missing row with 404, a broken rule with 422 and its
// message, and anything else as an opaque 500 that is logged.
func (h *LoanHandler) fail(c *gin.Context, err error, fallback string) {
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
		respond.Fail(c, respond.CodeNotFound, "Loan not found")
	default:
		respond.WriteError(c, err, fallback)
	}
}

// List returns a paginated list of loans.
//
//	?archived=true   only archived rows
//	?archived=all    both
//	(default)        only live rows
func (h *LoanHandler) List(c *gin.Context) {
	res, err := h.service().List(h.ctx(c), paginate.Bind(c).With("borrower_id", c.Query("borrower_id")), c.Query("archived"))
	if err != nil {
		h.fail(c, err, "Failed to fetch loans")
		return
	}

	c.JSON(http.StatusOK, res)
}

// Export streams the full filtered list as CSV (default) or XLSX: the same
// search as List, without pages.
//
//	GET /api/loans/export?format=csv
//	GET /api/loans/export?format=xlsx&search=foo
func (h *LoanHandler) Export(c *gin.Context) {
	format := c.DefaultQuery("format", "csv")
	search := c.Query("search")

	opts := export.Options{
		Sheet: "Loans",
		Columns: []export.Column{
			{Header: "ID", Field: "ID"},
			{Header: "Reference", Field: "Reference"},
			{Header: "Status", Field: "Status"},
			{Header: "Risk", Field: "Risk"},
			{Header: "Created At", Field: "CreatedAt", Format: "date:2006-01-02"},
		},
	}

	if format == "xlsx" {
		// Rows go into the workbook batch by batch, through a writer that moves
		// them to a temporary file, so memory stays flat however many match.
		sheet, err := export.NewXLSXStream(opts)
		if err != nil {
			h.fail(c, err, "Failed to export loans")
			return
		}
		defer func() {
			if err := sheet.Close(); err != nil {
				log.Printf("export loans as xlsx: removing temporary files: %v", err)
			}
		}()
		if err := h.service().Export(h.ctx(c), search, func(rows []models.Loan) error {
			return sheet.Rows(rows)
		}); err != nil {
			h.fail(c, err, "Failed to export loans")
			return
		}
		c.Header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
		c.Header("Content-Disposition", `attachment; filename="loans.xlsx"`)
		if err := sheet.Finish(c.Writer); err != nil {
			log.Printf("export loans as xlsx: %v", err)
		}
		return
	}

	// CSV streams: the header with the first batch, then each batch as it is
	// read.
	c.Header("Content-Type", "text/csv")
	c.Header("Content-Disposition", `attachment; filename="loans.csv"`)

	headerWritten := false
	err := h.service().Export(h.ctx(c), search, func(rows []models.Loan) error {
		if !headerWritten {
			headerWritten = true
			return export.CSV(c.Writer, rows, opts)
		}
		return export.CSVRows(c.Writer, rows, opts)
	})
	if err == nil && !headerWritten {
		// Nothing matched: still a CSV, with its header row.
		err = export.CSV(c.Writer, []models.Loan{}, opts)
	}
	if err != nil {
		if !c.Writer.Written() {
			c.Writer.Header().Del("Content-Type")
			c.Writer.Header().Del("Content-Disposition")
			h.fail(c, err, "Failed to export loans")
			return
		}
		// Rows are already on the wire, so the status cannot change. Logged,
		// so a truncated file has an explanation somewhere.
		log.Printf("export loans: %v", err)
	}
}

// GetByID returns a single loan by ID.
func (h *LoanHandler) GetByID(c *gin.Context) {
	item, err := h.service().GetByID(h.ctx(c), c.Param("id"))
	if err != nil {
		h.fail(c, err, "Failed to load loan")
		return
	}

	// The version to send back as If-Match when saving.
	c.Header("ETag", concurrency.Tag(item.Version))
	c.JSON(http.StatusOK, gin.H{
		"data": item,
	})
}

// PDF streams this loan as a print-ready PDF: a repeating header and
// footer with page numbers, the record's fields as a detail grid, and any
// line items as a table. Edit the pdf.Record below to restyle it; the
// renderer itself lives in internal/pdf/record.go.
func (h *LoanHandler) PDF(c *gin.Context) {
	id := c.Param("id")

	item, err := h.service().GetByID(h.ctx(c), id)
	if err != nil {
		h.fail(c, err, "Failed to load loan")
		return
	}

	appName := h.AppName
	if appName == "" {
		appName = "Loan"
	}

	rec := pdf.Record{
		Title:      "LOAN",
		Subtitle:   pdf.Value(item.Reference),
		Brand:      appName,
		FooterNote: appName + " · generated " + time.Now().Format("2 Jan 2006 15:04"),
		Fields: []pdf.Field{
			{Label: "Reference", Value: pdf.Value(item.Reference)},
			{Label: "Status", Value: pdf.Value(item.Status)},
			{Label: "Risk", Value: pdf.Value(item.Risk)},
			{Label: "Borrower", Value: pdf.Display(item.Borrower)},
			{Label: "Created", Value: pdf.Value(item.CreatedAt)},
		},
	}

	itemRows := make([][]string, 0, len(item.Items))
	for _, row := range item.Items {
		itemRows = append(itemRows, []string{pdf.Value(row.DueDate), pdf.Value(row.Amount), pdf.Value(row.Paid)})
	}
	if len(itemRows) > 0 {
		rec.Sections = append(rec.Sections, pdf.Section{
			Title:   "Repayments",
			Headers: []string{"Due Date", "Amount", "Paid"},
			Aligns:  []string{"L", "R", "L"},
			Rows:    itemRows,
		})
	}

	out, err := pdf.RenderRecord(rec)
	if err != nil {
		respond.Fail(c, respond.CodePDFError, "could not render the PDF")
		return
	}

	filename := "loan-" + id + ".pdf"
	c.Header("Content-Disposition", "inline; filename=\""+filename+"\"")
	c.Data(http.StatusOK, "application/pdf", out)
}

// CreateLoanRequest is the JSON body accepted by POST /loans.
//
// Named rather than anonymous so the API reference can document it: gindocs
// builds a request schema by reflecting over a real type. routes.go passes
// this type to docs.Route(...).RequestBody().
type CreateLoanRequest struct {
	Reference  string `json:"reference" binding:"required"`
	Status     string `json:"status" binding:"required"`
	Risk       string `json:"risk" binding:"required"`
	BorrowerID string `json:"borrower_id" binding:"required"`
	Items      []struct {
		DueDate *jsontime.Date `json:"due_date"`
		Amount  float64        `json:"amount"`
		Paid    bool           `json:"paid"`
	} `json:"items"`
}

// UpdateLoanRequest is the JSON body accepted by PUT /loans/:id.
// Every field is optional: only what the client sends is applied.
type UpdateLoanRequest struct {
	Reference  string  `json:"reference"`
	Status     string  `json:"status"`
	Risk       string  `json:"risk"`
	BorrowerID *string `json:"borrower_id"`
	Items      []struct {
		DueDate *jsontime.Date `json:"due_date"`
		Amount  float64        `json:"amount"`
		Paid    bool           `json:"paid"`
	} `json:"items"`
}

// Create adds a new loan.
func (h *LoanHandler) Create(c *gin.Context) {
	var req CreateLoanRequest

	if err := c.ShouldBindJSON(&req); err != nil {
		respond.Fail(c, respond.CodeValidationError, err.Error())
		return
	}

	item := models.Loan{
		Reference:  req.Reference,
		Status:     req.Status,
		Risk:       req.Risk,
		BorrowerID: req.BorrowerID,
	}

	if len(req.Items) > 0 {
		items := make([]models.Repayment, 0, len(req.Items))
		for _, it := range req.Items {
			items = append(items, models.Repayment{
				DueDate: it.DueDate,
				Amount:  it.Amount,
				Paid:    it.Paid,
			})
		}
		item.Items = items
	}

	if err := h.service().Create(h.ctx(c), &item); err != nil {
		h.fail(c, err, "Failed to create loan")
		return
	}

	events.Emitted(c, "loans", "Loan", "created", item.ID, item.Reference, "", nil, item)

	c.JSON(http.StatusCreated, gin.H{
		"data":    item,
		"message": "Loan created successfully",
	})
}

// Update modifies an existing loan. A client that sends the version it
// read as If-Match gets 409 instead of overwriting a newer save.
func (h *LoanHandler) Update(c *gin.Context) {
	id := c.Param("id")

	var req UpdateLoanRequest

	if err := c.ShouldBindJSON(&req); err != nil {
		respond.Fail(c, respond.CodeValidationError, err.Error())
		return
	}

	updates := map[string]interface{}{}
	if req.Reference != "" {
		updates["reference"] = req.Reference
	}
	if req.Status != "" {
		updates["status"] = req.Status
	}
	if req.Risk != "" {
		updates["risk"] = req.Risk
	}
	if req.BorrowerID != nil {
		updates["borrower_id"] = *req.BorrowerID
	}
	// Nil leaves the lines as they are; a list, empty or not, replaces them.
	var items *[]models.Repayment
	if req.Items != nil {
		rows := make([]models.Repayment, 0, len(req.Items))
		for _, it := range req.Items {
			rows = append(rows, models.Repayment{
				DueDate: it.DueDate,
				Amount:  it.Amount,
				Paid:    it.Paid,
			})
		}
		items = &rows
	}

	item, err := h.service().Update(h.ctx(c), id, updates, items, concurrency.FromRequest(c))
	if err != nil {
		h.fail(c, err, "Failed to update loan")
		return
	}

	events.Emitted(c, "loans", "Loan", "updated", item.ID, item.Reference, services.DiffSummary(updates), nil, item)

	c.Header("ETag", concurrency.Tag(item.Version))
	c.JSON(http.StatusOK, gin.H{
		"data":    item,
		"message": "Loan updated successfully",
	})
}

// Patch applies a partial update to a loan. Used by the admin's grouped
// update view: each form group's Save button sends only the fields it owns, so
// editing "Address" does not rewrite "Pricing".
func (h *LoanHandler) Patch(c *gin.Context) {
	var body map[string]interface{}
	if err := c.ShouldBindJSON(&body); err != nil {
		respond.Fail(c, respond.CodeValidationError, err.Error())
		return
	}

	item, updates, err := h.service().Patch(h.ctx(c), c.Param("id"), body, concurrency.FromRequest(c))
	if err != nil {
		h.fail(c, err, "Failed to patch loan")
		return
	}

	events.Emitted(c, "loans", "Loan", "updated", item.ID, item.Reference, services.DiffSummary(updates), nil, item)

	c.Header("ETag", concurrency.Tag(item.Version))
	c.JSON(http.StatusOK, gin.H{
		"data":    item,
		"message": "Loan updated successfully",
	})
}

// Delete soft-deletes a loan.
func (h *LoanHandler) Delete(c *gin.Context) {
	item, err := h.service().Delete(h.ctx(c), c.Param("id"))
	if err != nil {
		h.fail(c, err, "Failed to delete loan")
		return
	}

	events.Emitted(c, "loans", "Loan", "deleted", item.ID, item.Reference, "", item, nil)

	c.JSON(http.StatusOK, gin.H{
		"message": "Loan deleted successfully",
	})
}

// BulkLoanRequest is one operation applied to a set of rows.
//
// One request rather than one per row. The admin used to fire N parallel
// DELETEs, which means N transactions, N audit entries, and a half-applied
// result when the eleventh fails.
type BulkLoanRequest struct {
	// delete removes, archive puts away, restore brings back, patch writes the
	// same field values to every selected row.
	Action string `json:"action" binding:"required,oneof=delete archive restore patch"`
	// Capped: an unbounded IN clause is a way to lock a table by accident.
	IDs []string `json:"ids" binding:"required,min=1,max=500"`
	// Only read when action is "patch". Whitelisted the same way Patch is.
	Patch map[string]interface{} `json:"patch"`
}

// Bulk applies one action to many loans in a single transaction.
func (h *LoanHandler) Bulk(c *gin.Context) {
	var req BulkLoanRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respond.Fail(c, respond.CodeValidationError, err.Error())
		return
	}

	result, err := h.service().Bulk(h.ctx(c), req.Action, req.IDs, req.Patch)
	if err != nil {
		h.fail(c, err, "Failed to "+req.Action+" loans")
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

	noun := "loans"
	if len(ids) == 1 {
		noun = "loan"
	}

	summary := req.Action + " " + strconv.Itoa(len(ids)) + " " + noun
	if req.Action == "patch" {
		summary += ": " + services.DiffSummary(result.Updates)
	}
	// resourceID holds ONE id, not all of them: it is a lookup key, and the
	// count lives in the summary, where it can be read.
	events.Emitted(c, "loans", "Loan", "bulk", ids[0], summary, summary, nil, nil)

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

// BulkEditLoanRequest is the grid's save: one patch per row.
type BulkEditLoanRequest struct {
	// Capped for the same reason Bulk's ids are: a transaction holding five
	// hundred row locks is a transaction other writers wait behind.
	Items []services.LoanGridEdit `json:"items" binding:"required,min=1,max=500"`
}

// BulkEdit saves a grid of edits, one patch per row, in one transaction.
func (h *LoanHandler) BulkEdit(c *gin.Context) {
	var req BulkEditLoanRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respond.Fail(c, respond.CodeValidationError, err.Error())
		return
	}

	saved, rowErrors, err := h.service().BulkEdit(h.ctx(c), req.Items)
	if err != nil {
		h.fail(c, err, "Failed to save the loans")
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

	noun := "loans"
	if len(saved) == 1 {
		noun = "loan"
	}
	summary := "edited " + strconv.Itoa(len(saved)) + " " + noun + " in the grid"
	events.Emitted(c, "loans", "Loan", "bulk", saved[0], summary, summary, nil, nil)

	c.JSON(http.StatusOK, gin.H{
		"data":    gin.H{"affected": len(saved), "requested": len(req.Items)},
		"message": strconv.Itoa(len(saved)) + " " + noun + " updated",
	})
}

// BulkCreateLoanRequest is the grid's insert: whole rows, no ids.
type BulkCreateLoanRequest struct {
	Items []map[string]interface{} `json:"items" binding:"required,min=1,max=500"`
}

// BulkCreate inserts a grid of new loans in one transaction.
func (h *LoanHandler) BulkCreate(c *gin.Context) {
	var req BulkCreateLoanRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respond.Fail(c, respond.CodeValidationError, err.Error())
		return
	}

	created, rowErrors, err := h.service().BulkCreate(h.ctx(c), req.Items)
	if err != nil {
		h.fail(c, err, "Failed to create the loans")
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

	noun := "loans"
	if len(created) == 1 {
		noun = "loan"
	}
	summary := "created " + strconv.Itoa(len(created)) + " " + noun + " in the grid"
	events.Emitted(c, "loans", "Loan", "bulk", created[0].ID, summary, summary, nil, nil)

	// The rows as stored, so the grid can show the ids, the generated slugs and
	// anything else a hook filled in rather than guessing at them.
	c.JSON(http.StatusCreated, gin.H{
		"data":    created,
		"message": strconv.Itoa(len(created)) + " " + noun + " created",
	})
}
