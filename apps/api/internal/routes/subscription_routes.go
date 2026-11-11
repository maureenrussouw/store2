package routes

import (
	"store2/apps/api/internal/handlers"
	"store2/apps/api/internal/middleware"
)

// Subscriptions routes.
//
// This is the whole surface for subscriptions: the handler, and every path that
// reaches it. Add a route by adding a line here. Remove the resource by
// deleting this file; nothing else refers to it.
//
// m.Public is outside the auth middleware and behind an API key, m.Protected
// takes a JWT or an API key, and m.Staff also requires the permission its
// route names (an ADMIN holds every one).
func init() {
	RegisterRoutes(func(m *Mount) {
		h := &handlers.SubscriptionHandler{
			DB:      m.DB,
			AppName: m.Cfg.AppName,
		}

		m.Staff.GET("/subscriptions", middleware.RequireRole("ADMIN", "perm:subscriptions.view"), h.List)
		m.Staff.GET("/subscriptions/export", middleware.RequireRole("ADMIN", "perm:subscriptions.view"), h.Export)
		m.Staff.POST("/subscriptions/import", middleware.RequireRole("ADMIN", "perm:subscriptions.create"), h.Import)
		m.Staff.GET("/subscriptions/import/template", middleware.RequireRole("ADMIN", "perm:subscriptions.view"), h.Template)
		m.Staff.GET("/subscriptions/:id", middleware.RequireRole("ADMIN", "perm:subscriptions.view"), h.GetByID)
		m.Staff.GET("/subscriptions/:id/pdf", middleware.RequireRole("ADMIN", "perm:subscriptions.view"), h.PDF)
		m.Staff.POST("/subscriptions", middleware.RequireRole("ADMIN", "perm:subscriptions.create"), h.Create)
		m.Staff.POST("/subscriptions/bulk-create", middleware.RequireRole("ADMIN", "perm:subscriptions.create"), h.BulkCreate)
		m.Staff.PUT("/subscriptions/:id", middleware.RequireRole("ADMIN", "perm:subscriptions.edit"), h.Update)
		m.Staff.PATCH("/subscriptions/:id", middleware.RequireRole("ADMIN", "perm:subscriptions.edit"), h.Patch)
		m.Staff.POST("/subscriptions/bulk-edit", middleware.RequireRole("ADMIN", "perm:subscriptions.edit"), h.BulkEdit)

		m.Staff.DELETE("/subscriptions/:id", middleware.RequireRole("ADMIN", "perm:subscriptions.delete"), h.Delete)
		m.Staff.POST("/subscriptions/bulk", middleware.RequireRole("ADMIN", "perm:subscriptions.delete"), h.Bulk)
	})
}
