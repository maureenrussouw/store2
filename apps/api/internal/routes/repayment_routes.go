package routes

import (
	"store2/apps/api/internal/handlers"
	"store2/apps/api/internal/middleware"
)

// Repayments routes.
//
// This is the whole surface for repayments: the handler, and every path that
// reaches it. Add a route by adding a line here. Remove the resource by
// deleting this file; nothing else refers to it.
//
// m.Public is outside the auth middleware and behind an API key, m.Protected
// takes a JWT or an API key, and m.Staff also requires the permission its
// route names (an ADMIN holds every one).
func init() {
	RegisterRoutes(func(m *Mount) {
		h := &handlers.RepaymentHandler{
			DB:      m.DB,
			AppName: m.Cfg.AppName,
		}

		m.Staff.GET("/repayments", middleware.RequireRole("ADMIN", "perm:repayments.view"), h.List)
		m.Staff.GET("/repayments/export", middleware.RequireRole("ADMIN", "perm:repayments.view"), h.Export)
		m.Staff.POST("/repayments/import", middleware.RequireRole("ADMIN", "perm:repayments.create"), h.Import)
		m.Staff.GET("/repayments/import/template", middleware.RequireRole("ADMIN", "perm:repayments.view"), h.Template)
		m.Staff.GET("/repayments/:id", middleware.RequireRole("ADMIN", "perm:repayments.view"), h.GetByID)
		m.Staff.GET("/repayments/:id/pdf", middleware.RequireRole("ADMIN", "perm:repayments.view"), h.PDF)
		m.Staff.POST("/repayments", middleware.RequireRole("ADMIN", "perm:repayments.create"), h.Create)
		m.Staff.POST("/repayments/bulk-create", middleware.RequireRole("ADMIN", "perm:repayments.create"), h.BulkCreate)
		m.Staff.PUT("/repayments/:id", middleware.RequireRole("ADMIN", "perm:repayments.edit"), h.Update)
		m.Staff.PATCH("/repayments/:id", middleware.RequireRole("ADMIN", "perm:repayments.edit"), h.Patch)
		m.Staff.POST("/repayments/bulk-edit", middleware.RequireRole("ADMIN", "perm:repayments.edit"), h.BulkEdit)

		m.Staff.DELETE("/repayments/:id", middleware.RequireRole("ADMIN", "perm:repayments.delete"), h.Delete)
		m.Staff.POST("/repayments/bulk", middleware.RequireRole("ADMIN", "perm:repayments.delete"), h.Bulk)
	})
}
