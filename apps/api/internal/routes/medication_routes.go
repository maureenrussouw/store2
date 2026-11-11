package routes

import (
	"store2/apps/api/internal/handlers"
	"store2/apps/api/internal/middleware"
)

// Medications routes.
//
// This is the whole surface for medications: the handler, and every path that
// reaches it. Add a route by adding a line here. Remove the resource by
// deleting this file; nothing else refers to it.
//
// m.Public is outside the auth middleware and behind an API key, m.Protected
// takes a JWT or an API key, and m.Staff also requires the permission its
// route names (an ADMIN holds every one).
func init() {
	RegisterRoutes(func(m *Mount) {
		h := &handlers.MedicationHandler{
			DB:      m.DB,
			AppName: m.Cfg.AppName,
		}

		m.Staff.GET("/medications", middleware.RequireRole("ADMIN", "perm:medications.view"), h.List)
		m.Staff.GET("/medications/export", middleware.RequireRole("ADMIN", "perm:medications.view"), h.Export)
		m.Staff.POST("/medications/import", middleware.RequireRole("ADMIN", "perm:medications.create"), h.Import)
		m.Staff.GET("/medications/import/template", middleware.RequireRole("ADMIN", "perm:medications.view"), h.Template)
		m.Staff.GET("/medications/:id", middleware.RequireRole("ADMIN", "perm:medications.view"), h.GetByID)
		m.Staff.GET("/medications/:id/pdf", middleware.RequireRole("ADMIN", "perm:medications.view"), h.PDF)
		m.Staff.POST("/medications", middleware.RequireRole("ADMIN", "perm:medications.create"), h.Create)
		m.Staff.POST("/medications/bulk-create", middleware.RequireRole("ADMIN", "perm:medications.create"), h.BulkCreate)
		m.Staff.PUT("/medications/:id", middleware.RequireRole("ADMIN", "perm:medications.edit"), h.Update)
		m.Staff.PATCH("/medications/:id", middleware.RequireRole("ADMIN", "perm:medications.edit"), h.Patch)
		m.Staff.POST("/medications/bulk-edit", middleware.RequireRole("ADMIN", "perm:medications.edit"), h.BulkEdit)

		m.Staff.DELETE("/medications/:id", middleware.RequireRole("ADMIN", "perm:medications.delete"), h.Delete)
		m.Staff.POST("/medications/bulk", middleware.RequireRole("ADMIN", "perm:medications.delete"), h.Bulk)
	})
}
