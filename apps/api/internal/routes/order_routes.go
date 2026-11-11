package routes

import (
	"store2/apps/api/internal/handlers"
	"store2/apps/api/internal/middleware"
)

// Orders routes.
//
// This is the whole surface for orders: the handler, and every path that
// reaches it. Add a route by adding a line here. Remove the resource by
// deleting this file; nothing else refers to it.
//
// m.Public is outside the auth middleware and behind an API key, m.Protected
// takes a JWT or an API key, and m.Staff also requires the permission its
// route names (an ADMIN holds every one).
func init() {
	RegisterRoutes(func(m *Mount) {
		h := &handlers.OrderHandler{
			DB:      m.DB,
			AppName: m.Cfg.AppName,
		}

		m.Staff.GET("/orders", middleware.RequireRole("ADMIN", "perm:orders.view"), h.List)
		m.Staff.GET("/orders/export", middleware.RequireRole("ADMIN", "perm:orders.view"), h.Export)
		m.Staff.POST("/orders/import", middleware.RequireRole("ADMIN", "perm:orders.create"), h.Import)
		m.Staff.GET("/orders/import/template", middleware.RequireRole("ADMIN", "perm:orders.view"), h.Template)
		m.Staff.GET("/orders/:id", middleware.RequireRole("ADMIN", "perm:orders.view"), h.GetByID)
		m.Staff.GET("/orders/:id/pdf", middleware.RequireRole("ADMIN", "perm:orders.view"), h.PDF)
		m.Staff.POST("/orders", middleware.RequireRole("ADMIN", "perm:orders.create"), h.Create)
		m.Staff.POST("/orders/bulk-create", middleware.RequireRole("ADMIN", "perm:orders.create"), h.BulkCreate)
		m.Staff.PUT("/orders/:id", middleware.RequireRole("ADMIN", "perm:orders.edit"), h.Update)
		m.Staff.PATCH("/orders/:id", middleware.RequireRole("ADMIN", "perm:orders.edit"), h.Patch)
		m.Staff.POST("/orders/bulk-edit", middleware.RequireRole("ADMIN", "perm:orders.edit"), h.BulkEdit)

		m.Staff.DELETE("/orders/:id", middleware.RequireRole("ADMIN", "perm:orders.delete"), h.Delete)
		m.Staff.POST("/orders/bulk", middleware.RequireRole("ADMIN", "perm:orders.delete"), h.Bulk)
	})
}
