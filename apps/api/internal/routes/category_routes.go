package routes

import (
	"store2/apps/api/internal/handlers"
	"store2/apps/api/internal/middleware"
)

// Categories routes.
//
// This is the whole surface for categories: the handler, and every path that
// reaches it. Add a route by adding a line here. Remove the resource by
// deleting this file; nothing else refers to it.
//
// m.Public is outside the auth middleware and behind an API key, m.Protected
// takes a JWT or an API key, and m.Staff also requires the permission its
// route names (an ADMIN holds every one).
func init() {
	RegisterRoutes(func(m *Mount) {
		h := &handlers.CategoryHandler{
			DB:      m.DB,
			AppName: m.Cfg.AppName,
			Storage: m.Svc.Storage,
		}

		// Read-only, outside auth, API key required.
		m.Public.GET("/categories/tree", h.TreePublic)
		m.Public.GET("/categories", h.ListPublic)
		m.Public.GET("/categories/:key", h.GetPublic)
		m.Public.GET("/categories/:key/related", h.RelatedPublic)

		m.Staff.GET("/categories", middleware.RequireRole("ADMIN", "perm:categories.view"), h.List)
		m.Staff.GET("/categories/export", middleware.RequireRole("ADMIN", "perm:categories.view"), h.Export)
		m.Staff.POST("/categories/import", middleware.RequireRole("ADMIN", "perm:categories.create"), h.Import)
		m.Staff.GET("/categories/import/template", middleware.RequireRole("ADMIN", "perm:categories.view"), h.Template)
		m.Staff.GET("/categories/:id", middleware.RequireRole("ADMIN", "perm:categories.view"), h.GetByID)
		m.Staff.GET("/categories/:id/pdf", middleware.RequireRole("ADMIN", "perm:categories.view"), h.PDF)
		m.Staff.POST("/categories", middleware.RequireRole("ADMIN", "perm:categories.create"), h.Create)
		m.Staff.POST("/categories/bulk-create", middleware.RequireRole("ADMIN", "perm:categories.create"), h.BulkCreate)
		m.Staff.PUT("/categories/:id", middleware.RequireRole("ADMIN", "perm:categories.edit"), h.Update)
		m.Staff.PATCH("/categories/:id", middleware.RequireRole("ADMIN", "perm:categories.edit"), h.Patch)
		m.Staff.POST("/categories/bulk-edit", middleware.RequireRole("ADMIN", "perm:categories.edit"), h.BulkEdit)

		m.Staff.DELETE("/categories/:id", middleware.RequireRole("ADMIN", "perm:categories.delete"), h.Delete)
		m.Staff.POST("/categories/bulk", middleware.RequireRole("ADMIN", "perm:categories.delete"), h.Bulk)
	})
}
