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

// OrderHandler serves the order endpoints. It reads the request, asks
// services.OrderService, and writes the answer; it runs no query of its
// own, so everything a route does is also available to a job or a test.
type OrderHandler struct {
	DB *gorm.DB
	// AppName brands the PDF export. The route file sets it from config.
	AppName string
}

// service is the order service over this handler's database.
func (h *OrderHandler) service() *services.OrderService {
	return &services.OrderService{DB: h.DB}
}

// ctx is the request's context with the caller on it, which the service
// scopes owned rows by. The organization the multitenant plugin resolved and
// the cancellation when the client goes away travel with it.
func (h *OrderHandler) ctx(c *gin.Context) context.Context {
	return authz.WithActor(c.Request.Context(), authz.ActorOf(c))
}

// fail answers an error from the service: a version conflict with the version
// the record is at, a missing row with 404, a broken rule with 422 and its
// message, and anything else as an opaque 500 that is logged.
func (h *OrderHandler) fail(c *gin.Context, err error, fallback string) {
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
		respond.Fail(c, respond.CodeNotFound, "Order not found")
	default:
		respond.WriteError(c, err, fallback)
	}
}

// List returns a paginated list of orders.
//
//	?archived=true   only archived rows
//	?archived=all    both
//	(default)        only live rows
func (h *OrderHandler) List(c *gin.Context) {
	res, err := h.service().List(h.ctx(c), paginate.Bind(c).With("customer_id", c.Query("customer_id")), c.Query("archived"))
	if err != nil {
		h.fail(c, err, "Failed to fetch orders")
		return
	}

	c.JSON(http.StatusOK, res)
}

// Export streams the full filtered list as CSV (default) or XLSX: the same
// search as List, without pages.
//
//	GET /api/orders/export?format=csv
//	GET /api/orders/export?format=xlsx&search=foo
func (h *OrderHandler) Export(c *gin.Context) {
	format := c.DefaultQuery("format", "csv")
	search := c.Query("search")

	opts := export.Options{
		Sheet: "Orders",
		Columns: []export.Column{
			{Header: "ID", Field: "ID"},
			{Header: "Number", Field: "Number"},
			{Header: "Status", Field: "Status"},
			{Header: "Fulfillment", Field: "Fulfillment"},
			{Header: "Created At", Field: "CreatedAt", Format: "date:2006-01-02"},
		},
	}

	if format == "xlsx" {
		// Rows go into the workbook batch by batch, through a writer that moves
		// them to a temporary file, so memory stays flat however many match.
		sheet, err := export.NewXLSXStream(opts)
		if err != nil {
			h.fail(c, err, "Failed to export orders")
			return
		}
		defer func() {
			if err := sheet.Close(); err != nil {
				log.Printf("export orders as xlsx: removing temporary files: %v", err)
			}
		}()
		if err := h.service().Export(h.ctx(c), search, func(rows []models.Order) error {
			return sheet.Rows(rows)
		}); err != nil {
			h.fail(c, err, "Failed to export orders")
			return
		}
		c.Header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
		c.Header("Content-Disposition", `attachment; filename="orders.xlsx"`)
		if err := sheet.Finish(c.Writer); err != nil {
			log.Printf("export orders as xlsx: %v", err)
		}
		return
	}

	// CSV streams: the header with the first batch, then each batch as it is
	// read.
	c.Header("Content-Type", "text/csv")
	c.Header("Content-Disposition", `attachment; filename="orders.csv"`)

	headerWritten := false
	err := h.service().Export(h.ctx(c), search, func(rows []models.Order) error {
		if !headerWritten {
			headerWritten = true
			return export.CSV(c.Writer, rows, opts)
		}
		return export.CSVRows(c.Writer, rows, opts)
	})
	if err == nil && !headerWritten {
		// Nothing matched: still a CSV, with its header row.
		err = export.CSV(c.Writer, []models.Order{}, opts)
	}
	if err != nil {
		if !c.Writer.Written() {
			c.Writer.Header().Del("Content-Type")
			c.Writer.Header().Del("Content-Disposition")
			h.fail(c, err, "Failed to export orders")
			return
		}
		// Rows are already on the wire, so the status cannot change. Logged,
		// so a truncated file has an explanation somewhere.
		log.Printf("export orders: %v", err)
	}
}

// GetByID returns a single order by ID.
func (h *OrderHandler) GetByID(c *gin.Context) {
	item, err := h.service().GetByID(h.ctx(c), c.Param("id"))
	if err != nil {
		h.fail(c, err, "Failed to load order")
		return
	}

	// The version to send back as If-Match when saving.
	c.Header("ETag", concurrency.Tag(item.Version))
	c.JSON(http.StatusOK, gin.H{
		"data": item,
	})
}

// PDF streams this order as a print-ready PDF: a repeating header and
// footer with page numbers, the record's fields as a detail grid, and any
// line items as a table. Edit the pdf.Record below to restyle it; the
// renderer itself lives in internal/pdf/record.go.
func (h *OrderHandler) PDF(c *gin.Context) {
	id := c.Param("id")

	item, err := h.service().GetByID(h.ctx(c), id)
	if err != nil {
		h.fail(c, err, "Failed to load order")
		return
	}

	appName := h.AppName
	if appName == "" {
		appName = "Order"
	}

	rec := pdf.Record{
		Title:      "ORDER",
		Subtitle:   pdf.Value(item.Number),
		Brand:      appName,
		FooterNote: appName + " · generated " + time.Now().Format("2 Jan 2006 15:04"),
		Fields: []pdf.Field{
			{Label: "Number", Value: pdf.Value(item.Number)},
			{Label: "Status", Value: pdf.Value(item.Status)},
			{Label: "Fulfillment", Value: pdf.Value(item.Fulfillment)},
			{Label: "Customer", Value: pdf.Display(item.Customer)},
			{Label: "Created", Value: pdf.Value(item.CreatedAt)},
		},
	}

	itemRows := make([][]string, 0, len(item.Items))
	for _, row := range item.Items {
		itemRows = append(itemRows, []string{pdf.Value(row.Product), pdf.Value(row.Qty), pdf.Value(row.UnitPrice)})
	}
	if len(itemRows) > 0 {
		rec.Sections = append(rec.Sections, pdf.Section{
			Title:   "Order Lines",
			Headers: []string{"Product", "Qty", "Unit Price"},
			Aligns:  []string{"L", "R", "R"},
			Rows:    itemRows,
		})
	}

	out, err := pdf.RenderRecord(rec)
	if err != nil {
		respond.Fail(c, respond.CodePDFError, "could not render the PDF")
		return
	}

	filename := "order-" + id + ".pdf"
	c.Header("Content-Disposition", "inline; filename=\""+filename+"\"")
	c.Data(http.StatusOK, "application/pdf", out)
}

// CreateOrderRequest is the JSON body accepted by POST /orders.
//
// Named rather than anonymous so the API reference can document it: gindocs
// builds a request schema by reflecting over a real type. routes.go passes
// this type to docs.Route(...).RequestBody().
type CreateOrderRequest struct {
	Number      string `json:"number" binding:"required"`
	Status      string `json:"status" binding:"required"`
	Fulfillment string `json:"fulfillment" binding:"required"`
	CustomerID  string `json:"customer_id" binding:"required"`
	Items       []struct {
		Product   string  `json:"product"`
		Qty       int     `json:"qty"`
		UnitPrice float64 `json:"unit_price"`
	} `json:"items"`
}

// UpdateOrderRequest is the JSON body accepted by PUT /orders/:id.
// Every field is optional: only what the client sends is applied.
type UpdateOrderRequest struct {
	Number      string  `json:"number"`
	Status      string  `json:"status"`
	Fulfillment string  `json:"fulfillment"`
	CustomerID  *string `json:"customer_id"`
	Items       []struct {
		Product   string  `json:"product"`
		Qty       int     `json:"qty"`
		UnitPrice float64 `json:"unit_price"`
	} `json:"items"`
}

// Create adds a new order.
func (h *OrderHandler) Create(c *gin.Context) {
	var req CreateOrderRequest

	if err := c.ShouldBindJSON(&req); err != nil {
		respond.Fail(c, respond.CodeValidationError, err.Error())
		return
	}

	item := models.Order{
		Number:      req.Number,
		Status:      req.Status,
		Fulfillment: req.Fulfillment,
		CustomerID:  req.CustomerID,
	}

	if len(req.Items) > 0 {
		items := make([]models.OrderLine, 0, len(req.Items))
		for _, it := range req.Items {
			items = append(items, models.OrderLine{
				Product:   it.Product,
				Qty:       it.Qty,
				UnitPrice: it.UnitPrice,
			})
		}
		item.Items = items
	}

	if err := h.service().Create(h.ctx(c), &item); err != nil {
		h.fail(c, err, "Failed to create order")
		return
	}

	events.Emitted(c, "orders", "Order", "created", item.ID, item.Number, "", nil, item)

	c.JSON(http.StatusCreated, gin.H{
		"data":    item,
		"message": "Order created successfully",
	})
}

// Update modifies an existing order. A client that sends the version it
// read as If-Match gets 409 instead of overwriting a newer save.
func (h *OrderHandler) Update(c *gin.Context) {
	id := c.Param("id")

	var req UpdateOrderRequest

	if err := c.ShouldBindJSON(&req); err != nil {
		respond.Fail(c, respond.CodeValidationError, err.Error())
		return
	}

	updates := map[string]interface{}{}
	if req.Number != "" {
		updates["number"] = req.Number
	}
	if req.Status != "" {
		updates["status"] = req.Status
	}
	if req.Fulfillment != "" {
		updates["fulfillment"] = req.Fulfillment
	}
	if req.CustomerID != nil {
		updates["customer_id"] = *req.CustomerID
	}
	// Nil leaves the lines as they are; a list, empty or not, replaces them.
	var items *[]models.OrderLine
	if req.Items != nil {
		rows := make([]models.OrderLine, 0, len(req.Items))
		for _, it := range req.Items {
			rows = append(rows, models.OrderLine{
				Product:   it.Product,
				Qty:       it.Qty,
				UnitPrice: it.UnitPrice,
			})
		}
		items = &rows
	}

	item, err := h.service().Update(h.ctx(c), id, updates, items, concurrency.FromRequest(c))
	if err != nil {
		h.fail(c, err, "Failed to update order")
		return
	}

	events.Emitted(c, "orders", "Order", "updated", item.ID, item.Number, services.DiffSummary(updates), nil, item)

	c.Header("ETag", concurrency.Tag(item.Version))
	c.JSON(http.StatusOK, gin.H{
		"data":    item,
		"message": "Order updated successfully",
	})
}

// Patch applies a partial update to a order. Used by the admin's grouped
// update view: each form group's Save button sends only the fields it owns, so
// editing "Address" does not rewrite "Pricing".
func (h *OrderHandler) Patch(c *gin.Context) {
	var body map[string]interface{}
	if err := c.ShouldBindJSON(&body); err != nil {
		respond.Fail(c, respond.CodeValidationError, err.Error())
		return
	}

	item, updates, err := h.service().Patch(h.ctx(c), c.Param("id"), body, concurrency.FromRequest(c))
	if err != nil {
		h.fail(c, err, "Failed to patch order")
		return
	}

	events.Emitted(c, "orders", "Order", "updated", item.ID, item.Number, services.DiffSummary(updates), nil, item)

	c.Header("ETag", concurrency.Tag(item.Version))
	c.JSON(http.StatusOK, gin.H{
		"data":    item,
		"message": "Order updated successfully",
	})
}

// Delete soft-deletes a order.
func (h *OrderHandler) Delete(c *gin.Context) {
	item, err := h.service().Delete(h.ctx(c), c.Param("id"))
	if err != nil {
		h.fail(c, err, "Failed to delete order")
		return
	}

	events.Emitted(c, "orders", "Order", "deleted", item.ID, item.Number, "", item, nil)

	c.JSON(http.StatusOK, gin.H{
		"message": "Order deleted successfully",
	})
}

// BulkOrderRequest is one operation applied to a set of rows.
//
// One request rather than one per row. The admin used to fire N parallel
// DELETEs, which means N transactions, N audit entries, and a half-applied
// result when the eleventh fails.
type BulkOrderRequest struct {
	// delete removes, archive puts away, restore brings back, patch writes the
	// same field values to every selected row.
	Action string `json:"action" binding:"required,oneof=delete archive restore patch"`
	// Capped: an unbounded IN clause is a way to lock a table by accident.
	IDs []string `json:"ids" binding:"required,min=1,max=500"`
	// Only read when action is "patch". Whitelisted the same way Patch is.
	Patch map[string]interface{} `json:"patch"`
}

// Bulk applies one action to many orders in a single transaction.
func (h *OrderHandler) Bulk(c *gin.Context) {
	var req BulkOrderRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respond.Fail(c, respond.CodeValidationError, err.Error())
		return
	}

	result, err := h.service().Bulk(h.ctx(c), req.Action, req.IDs, req.Patch)
	if err != nil {
		h.fail(c, err, "Failed to "+req.Action+" orders")
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

	noun := "orders"
	if len(ids) == 1 {
		noun = "order"
	}

	summary := req.Action + " " + strconv.Itoa(len(ids)) + " " + noun
	if req.Action == "patch" {
		summary += ": " + services.DiffSummary(result.Updates)
	}
	// resourceID holds ONE id, not all of them: it is a lookup key, and the
	// count lives in the summary, where it can be read.
	events.Emitted(c, "orders", "Order", "bulk", ids[0], summary, summary, nil, nil)

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

// BulkEditOrderRequest is the grid's save: one patch per row.
type BulkEditOrderRequest struct {
	// Capped for the same reason Bulk's ids are: a transaction holding five
	// hundred row locks is a transaction other writers wait behind.
	Items []services.OrderGridEdit `json:"items" binding:"required,min=1,max=500"`
}

// BulkEdit saves a grid of edits, one patch per row, in one transaction.
func (h *OrderHandler) BulkEdit(c *gin.Context) {
	var req BulkEditOrderRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respond.Fail(c, respond.CodeValidationError, err.Error())
		return
	}

	saved, rowErrors, err := h.service().BulkEdit(h.ctx(c), req.Items)
	if err != nil {
		h.fail(c, err, "Failed to save the orders")
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

	noun := "orders"
	if len(saved) == 1 {
		noun = "order"
	}
	summary := "edited " + strconv.Itoa(len(saved)) + " " + noun + " in the grid"
	events.Emitted(c, "orders", "Order", "bulk", saved[0], summary, summary, nil, nil)

	c.JSON(http.StatusOK, gin.H{
		"data":    gin.H{"affected": len(saved), "requested": len(req.Items)},
		"message": strconv.Itoa(len(saved)) + " " + noun + " updated",
	})
}

// BulkCreateOrderRequest is the grid's insert: whole rows, no ids.
type BulkCreateOrderRequest struct {
	Items []map[string]interface{} `json:"items" binding:"required,min=1,max=500"`
}

// BulkCreate inserts a grid of new orders in one transaction.
func (h *OrderHandler) BulkCreate(c *gin.Context) {
	var req BulkCreateOrderRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respond.Fail(c, respond.CodeValidationError, err.Error())
		return
	}

	created, rowErrors, err := h.service().BulkCreate(h.ctx(c), req.Items)
	if err != nil {
		h.fail(c, err, "Failed to create the orders")
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

	noun := "orders"
	if len(created) == 1 {
		noun = "order"
	}
	summary := "created " + strconv.Itoa(len(created)) + " " + noun + " in the grid"
	events.Emitted(c, "orders", "Order", "bulk", created[0].ID, summary, summary, nil, nil)

	// The rows as stored, so the grid can show the ids, the generated slugs and
	// anything else a hook filled in rather than guessing at them.
	c.JSON(http.StatusCreated, gin.H{
		"data":    created,
		"message": strconv.Itoa(len(created)) + " " + noun + " created",
	})
}
