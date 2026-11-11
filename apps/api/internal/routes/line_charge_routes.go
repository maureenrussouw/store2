package routes

import (
	"store2/apps/api/internal/handlers"
	"store2/apps/api/internal/middleware"
)

// LineCharges routes.
//
// This is the whole surface for line_charges: the handler, and every path that
// reaches it. Add a route by adding a line here. Remove the resource by
// deleting this file; nothing else refers to it.
//
// m.Public is outside the auth middleware and behind an API key, m.Protected
// takes a JWT or an API key, and m.Staff also requires the permission its
// route names (an ADMIN holds every one).
func init() {
	RegisterRoutes(func(m *Mount) {
		h := &handlers.LineChargeHandler{
			DB:      m.DB,
			AppName: m.Cfg.AppName,
		}

		m.Staff.GET("/line_charges", middleware.RequireRole("ADMIN", "perm:line_charges.view"), h.List)
		m.Staff.GET("/line_charges/export", middleware.RequireRole("ADMIN", "perm:line_charges.view"), h.Export)
		m.Staff.POST("/line_charges/import", middleware.RequireRole("ADMIN", "perm:line_charges.create"), h.Import)
		m.Staff.GET("/line_charges/import/template", middleware.RequireRole("ADMIN", "perm:line_charges.view"), h.Template)
		m.Staff.GET("/line_charges/:id", middleware.RequireRole("ADMIN", "perm:line_charges.view"), h.GetByID)
		m.Staff.GET("/line_charges/:id/pdf", middleware.RequireRole("ADMIN", "perm:line_charges.view"), h.PDF)
		m.Staff.POST("/line_charges", middleware.RequireRole("ADMIN", "perm:line_charges.create"), h.Create)
		m.Staff.POST("/line_charges/bulk-create", middleware.RequireRole("ADMIN", "perm:line_charges.create"), h.BulkCreate)
		m.Staff.PUT("/line_charges/:id", middleware.RequireRole("ADMIN", "perm:line_charges.edit"), h.Update)
		m.Staff.PATCH("/line_charges/:id", middleware.RequireRole("ADMIN", "perm:line_charges.edit"), h.Patch)
		m.Staff.POST("/line_charges/bulk-edit", middleware.RequireRole("ADMIN", "perm:line_charges.edit"), h.BulkEdit)

		m.Staff.DELETE("/line_charges/:id", middleware.RequireRole("ADMIN", "perm:line_charges.delete"), h.Delete)
		m.Staff.POST("/line_charges/bulk", middleware.RequireRole("ADMIN", "perm:line_charges.delete"), h.Bulk)
	})
}
