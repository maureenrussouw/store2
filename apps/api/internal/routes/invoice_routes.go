package routes

import (
	"store2/apps/api/internal/handlers"
	"store2/apps/api/internal/middleware"
)

// Invoices routes.
//
// This is the whole surface for invoices: the handler, and every path that
// reaches it. Add a route by adding a line here. Remove the resource by
// deleting this file; nothing else refers to it.
//
// m.Public is outside the auth middleware and behind an API key, m.Protected
// takes a JWT or an API key, and m.Staff also requires the permission its
// route names (an ADMIN holds every one).
func init() {
	RegisterRoutes(func(m *Mount) {
		h := &handlers.InvoiceHandler{
			DB:      m.DB,
			AppName: m.Cfg.AppName,
		}

		m.Staff.GET("/invoices", middleware.RequireRole("ADMIN", "perm:invoices.view"), h.List)
		m.Staff.GET("/invoices/export", middleware.RequireRole("ADMIN", "perm:invoices.view"), h.Export)
		m.Staff.POST("/invoices/import", middleware.RequireRole("ADMIN", "perm:invoices.create"), h.Import)
		m.Staff.GET("/invoices/import/template", middleware.RequireRole("ADMIN", "perm:invoices.view"), h.Template)
		m.Staff.GET("/invoices/:id", middleware.RequireRole("ADMIN", "perm:invoices.view"), h.GetByID)
		m.Staff.GET("/invoices/:id/pdf", middleware.RequireRole("ADMIN", "perm:invoices.view"), h.PDF)
		m.Staff.POST("/invoices", middleware.RequireRole("ADMIN", "perm:invoices.create"), h.Create)
		m.Staff.POST("/invoices/bulk-create", middleware.RequireRole("ADMIN", "perm:invoices.create"), h.BulkCreate)
		m.Staff.PUT("/invoices/:id", middleware.RequireRole("ADMIN", "perm:invoices.edit"), h.Update)
		m.Staff.PATCH("/invoices/:id", middleware.RequireRole("ADMIN", "perm:invoices.edit"), h.Patch)
		m.Staff.POST("/invoices/bulk-edit", middleware.RequireRole("ADMIN", "perm:invoices.edit"), h.BulkEdit)

		m.Staff.DELETE("/invoices/:id", middleware.RequireRole("ADMIN", "perm:invoices.delete"), h.Delete)
		m.Staff.POST("/invoices/bulk", middleware.RequireRole("ADMIN", "perm:invoices.delete"), h.Bulk)
	})
}
