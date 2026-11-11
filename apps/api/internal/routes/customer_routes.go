package routes

import (
	"store2/apps/api/internal/handlers"
	"store2/apps/api/internal/middleware"
)

// Customers routes.
//
// This is the whole surface for customers: the handler, and every path that
// reaches it. Add a route by adding a line here. Remove the resource by
// deleting this file; nothing else refers to it.
//
// m.Public is outside the auth middleware and behind an API key, m.Protected
// takes a JWT or an API key, and m.Staff also requires the permission its
// route names (an ADMIN holds every one).
func init() {
	RegisterRoutes(func(m *Mount) {
		h := &handlers.CustomerHandler{
			DB:      m.DB,
			AppName: m.Cfg.AppName,
		}

		m.Staff.GET("/customers", middleware.RequireRole("ADMIN", "perm:customers.view"), h.List)
		m.Staff.GET("/customers/export", middleware.RequireRole("ADMIN", "perm:customers.view"), h.Export)
		m.Staff.POST("/customers/import", middleware.RequireRole("ADMIN", "perm:customers.create"), h.Import)
		m.Staff.GET("/customers/import/template", middleware.RequireRole("ADMIN", "perm:customers.view"), h.Template)
		m.Staff.GET("/customers/:id", middleware.RequireRole("ADMIN", "perm:customers.view"), h.GetByID)
		m.Staff.GET("/customers/:id/pdf", middleware.RequireRole("ADMIN", "perm:customers.view"), h.PDF)
		m.Staff.POST("/customers", middleware.RequireRole("ADMIN", "perm:customers.create"), h.Create)
		m.Staff.POST("/customers/bulk-create", middleware.RequireRole("ADMIN", "perm:customers.create"), h.BulkCreate)
		m.Staff.PUT("/customers/:id", middleware.RequireRole("ADMIN", "perm:customers.edit"), h.Update)
		m.Staff.PATCH("/customers/:id", middleware.RequireRole("ADMIN", "perm:customers.edit"), h.Patch)
		m.Staff.POST("/customers/bulk-edit", middleware.RequireRole("ADMIN", "perm:customers.edit"), h.BulkEdit)

		m.Staff.DELETE("/customers/:id", middleware.RequireRole("ADMIN", "perm:customers.delete"), h.Delete)
		m.Staff.POST("/customers/bulk", middleware.RequireRole("ADMIN", "perm:customers.delete"), h.Bulk)
	})
}
