package routes

import (
	"store2/apps/api/internal/handlers"
	"store2/apps/api/internal/middleware"
)

// Prescriptions routes.
//
// This is the whole surface for prescriptions: the handler, and every path that
// reaches it. Add a route by adding a line here. Remove the resource by
// deleting this file; nothing else refers to it.
//
// m.Public is outside the auth middleware and behind an API key, m.Protected
// takes a JWT or an API key, and m.Staff also requires the permission its
// route names (an ADMIN holds every one).
func init() {
	RegisterRoutes(func(m *Mount) {
		h := &handlers.PrescriptionHandler{
			DB:      m.DB,
			AppName: m.Cfg.AppName,
		}

		m.Staff.GET("/prescriptions", middleware.RequireRole("ADMIN", "perm:prescriptions.view"), h.List)
		m.Staff.GET("/prescriptions/export", middleware.RequireRole("ADMIN", "perm:prescriptions.view"), h.Export)
		m.Staff.POST("/prescriptions/import", middleware.RequireRole("ADMIN", "perm:prescriptions.create"), h.Import)
		m.Staff.GET("/prescriptions/import/template", middleware.RequireRole("ADMIN", "perm:prescriptions.view"), h.Template)
		m.Staff.GET("/prescriptions/:id", middleware.RequireRole("ADMIN", "perm:prescriptions.view"), h.GetByID)
		m.Staff.GET("/prescriptions/:id/pdf", middleware.RequireRole("ADMIN", "perm:prescriptions.view"), h.PDF)
		m.Staff.POST("/prescriptions", middleware.RequireRole("ADMIN", "perm:prescriptions.create"), h.Create)
		m.Staff.POST("/prescriptions/bulk-create", middleware.RequireRole("ADMIN", "perm:prescriptions.create"), h.BulkCreate)
		m.Staff.PUT("/prescriptions/:id", middleware.RequireRole("ADMIN", "perm:prescriptions.edit"), h.Update)
		m.Staff.PATCH("/prescriptions/:id", middleware.RequireRole("ADMIN", "perm:prescriptions.edit"), h.Patch)
		m.Staff.POST("/prescriptions/bulk-edit", middleware.RequireRole("ADMIN", "perm:prescriptions.edit"), h.BulkEdit)

		m.Staff.DELETE("/prescriptions/:id", middleware.RequireRole("ADMIN", "perm:prescriptions.delete"), h.Delete)
		m.Staff.POST("/prescriptions/bulk", middleware.RequireRole("ADMIN", "perm:prescriptions.delete"), h.Bulk)
	})
}
