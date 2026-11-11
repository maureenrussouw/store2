package routes

import (
	"store2/apps/api/internal/handlers"
	"store2/apps/api/internal/middleware"
)

// OrderLines routes.
//
// This is the whole surface for order_lines: the handler, and every path that
// reaches it. Add a route by adding a line here. Remove the resource by
// deleting this file; nothing else refers to it.
//
// m.Public is outside the auth middleware and behind an API key, m.Protected
// takes a JWT or an API key, and m.Staff also requires the permission its
// route names (an ADMIN holds every one).
func init() {
	RegisterRoutes(func(m *Mount) {
		h := &handlers.OrderLineHandler{
			DB:      m.DB,
			AppName: m.Cfg.AppName,
		}

		m.Staff.GET("/order_lines", middleware.RequireRole("ADMIN", "perm:order_lines.view"), h.List)
		m.Staff.GET("/order_lines/export", middleware.RequireRole("ADMIN", "perm:order_lines.view"), h.Export)
		m.Staff.POST("/order_lines/import", middleware.RequireRole("ADMIN", "perm:order_lines.create"), h.Import)
		m.Staff.GET("/order_lines/import/template", middleware.RequireRole("ADMIN", "perm:order_lines.view"), h.Template)
		m.Staff.GET("/order_lines/:id", middleware.RequireRole("ADMIN", "perm:order_lines.view"), h.GetByID)
		m.Staff.GET("/order_lines/:id/pdf", middleware.RequireRole("ADMIN", "perm:order_lines.view"), h.PDF)
		m.Staff.POST("/order_lines", middleware.RequireRole("ADMIN", "perm:order_lines.create"), h.Create)
		m.Staff.POST("/order_lines/bulk-create", middleware.RequireRole("ADMIN", "perm:order_lines.create"), h.BulkCreate)
		m.Staff.PUT("/order_lines/:id", middleware.RequireRole("ADMIN", "perm:order_lines.edit"), h.Update)
		m.Staff.PATCH("/order_lines/:id", middleware.RequireRole("ADMIN", "perm:order_lines.edit"), h.Patch)
		m.Staff.POST("/order_lines/bulk-edit", middleware.RequireRole("ADMIN", "perm:order_lines.edit"), h.BulkEdit)

		m.Staff.DELETE("/order_lines/:id", middleware.RequireRole("ADMIN", "perm:order_lines.delete"), h.Delete)
		m.Staff.POST("/order_lines/bulk", middleware.RequireRole("ADMIN", "perm:order_lines.delete"), h.Bulk)
	})
}
