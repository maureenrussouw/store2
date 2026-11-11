package routes

import (
	"store2/apps/api/internal/handlers"
	"store2/apps/api/internal/middleware"
)

// Loans routes.
//
// This is the whole surface for loans: the handler, and every path that
// reaches it. Add a route by adding a line here. Remove the resource by
// deleting this file; nothing else refers to it.
//
// m.Public is outside the auth middleware and behind an API key, m.Protected
// takes a JWT or an API key, and m.Staff also requires the permission its
// route names (an ADMIN holds every one).
func init() {
	RegisterRoutes(func(m *Mount) {
		h := &handlers.LoanHandler{
			DB:      m.DB,
			AppName: m.Cfg.AppName,
		}

		m.Staff.GET("/loans", middleware.RequireRole("ADMIN", "perm:loans.view"), h.List)
		m.Staff.GET("/loans/export", middleware.RequireRole("ADMIN", "perm:loans.view"), h.Export)
		m.Staff.POST("/loans/import", middleware.RequireRole("ADMIN", "perm:loans.create"), h.Import)
		m.Staff.GET("/loans/import/template", middleware.RequireRole("ADMIN", "perm:loans.view"), h.Template)
		m.Staff.GET("/loans/:id", middleware.RequireRole("ADMIN", "perm:loans.view"), h.GetByID)
		m.Staff.GET("/loans/:id/pdf", middleware.RequireRole("ADMIN", "perm:loans.view"), h.PDF)
		m.Staff.POST("/loans", middleware.RequireRole("ADMIN", "perm:loans.create"), h.Create)
		m.Staff.POST("/loans/bulk-create", middleware.RequireRole("ADMIN", "perm:loans.create"), h.BulkCreate)
		m.Staff.PUT("/loans/:id", middleware.RequireRole("ADMIN", "perm:loans.edit"), h.Update)
		m.Staff.PATCH("/loans/:id", middleware.RequireRole("ADMIN", "perm:loans.edit"), h.Patch)
		m.Staff.POST("/loans/bulk-edit", middleware.RequireRole("ADMIN", "perm:loans.edit"), h.BulkEdit)

		m.Staff.DELETE("/loans/:id", middleware.RequireRole("ADMIN", "perm:loans.delete"), h.Delete)
		m.Staff.POST("/loans/bulk", middleware.RequireRole("ADMIN", "perm:loans.delete"), h.Bulk)
	})
}
