package routes

import (
	"store2/apps/api/internal/handlers"
	"store2/apps/api/internal/middleware"
)

// InvoiceItems routes.
//
// This is the whole surface for invoice_items: the handler, and every path that
// reaches it. Add a route by adding a line here. Remove the resource by
// deleting this file; nothing else refers to it.
//
// m.Public is outside the auth middleware and behind an API key, m.Protected
// takes a JWT or an API key, and m.Staff also requires the permission its
// route names (an ADMIN holds every one).
func init() {
	RegisterRoutes(func(m *Mount) {
		h := &handlers.InvoiceItemHandler{
			DB:      m.DB,
			AppName: m.Cfg.AppName,
		}

		m.Staff.GET("/invoice_items", middleware.RequireRole("ADMIN", "perm:invoice_items.view"), h.List)
		m.Staff.GET("/invoice_items/export", middleware.RequireRole("ADMIN", "perm:invoice_items.view"), h.Export)
		m.Staff.POST("/invoice_items/import", middleware.RequireRole("ADMIN", "perm:invoice_items.create"), h.Import)
		m.Staff.GET("/invoice_items/import/template", middleware.RequireRole("ADMIN", "perm:invoice_items.view"), h.Template)
		m.Staff.GET("/invoice_items/:id", middleware.RequireRole("ADMIN", "perm:invoice_items.view"), h.GetByID)
		m.Staff.GET("/invoice_items/:id/pdf", middleware.RequireRole("ADMIN", "perm:invoice_items.view"), h.PDF)
		m.Staff.POST("/invoice_items", middleware.RequireRole("ADMIN", "perm:invoice_items.create"), h.Create)
		m.Staff.POST("/invoice_items/bulk-create", middleware.RequireRole("ADMIN", "perm:invoice_items.create"), h.BulkCreate)
		m.Staff.PUT("/invoice_items/:id", middleware.RequireRole("ADMIN", "perm:invoice_items.edit"), h.Update)
		m.Staff.PATCH("/invoice_items/:id", middleware.RequireRole("ADMIN", "perm:invoice_items.edit"), h.Patch)
		m.Staff.POST("/invoice_items/bulk-edit", middleware.RequireRole("ADMIN", "perm:invoice_items.edit"), h.BulkEdit)

		m.Staff.DELETE("/invoice_items/:id", middleware.RequireRole("ADMIN", "perm:invoice_items.delete"), h.Delete)
		m.Staff.POST("/invoice_items/bulk", middleware.RequireRole("ADMIN", "perm:invoice_items.delete"), h.Bulk)
	})
}
