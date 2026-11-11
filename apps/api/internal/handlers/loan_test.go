package handlers

import (
	"testing"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"store2/apps/api/internal/factory"
	"store2/apps/api/internal/middleware"
	"store2/apps/api/internal/models"
	"store2/apps/api/internal/services"
	"store2/apps/api/internal/testkit"
)

// mountLoan builds an engine carrying this resource's routes exactly as routes.go
// mounts them: the auth middleware, then the permission the route names. Wiring
// it any other way would test a router this project does not run.
func mountLoan(t *testing.T) (*testkit.Client, *gorm.DB, *services.AuthService) {
	t.Helper()

	db := testkit.DB(t)
	auth := testkit.Auth(testkit.Config(), db)
	handler := &LoanHandler{DB: db}

	gin.SetMode(gin.TestMode)
	r := gin.New()
	guarded := r.Group("/api/v1", middleware.Auth(db, auth))
	guarded.GET("/loans", middleware.RequireRole("ADMIN", "perm:loans.view"), handler.List)
	guarded.GET("/loans/:id", middleware.RequireRole("ADMIN", "perm:loans.view"), handler.GetByID)
	guarded.PUT("/loans/:id", middleware.RequireRole("ADMIN", "perm:loans.edit"), handler.Update)
	guarded.POST("/loans/bulk-edit", middleware.RequireRole("ADMIN", "perm:loans.edit"), handler.BulkEdit)

	return testkit.New(t, r), db, auth
}

// A resource whose routes were injected into the wrong group is reachable by
// anyone, and nothing else in the project would notice.
func TestLoan_ListRefusesAnonymous(t *testing.T) {
	client, _, _ := mountLoan(t)

	client.Get("/api/v1/loans").AssertUnauthorized()
}

// The difference between a permission that is declared and one that is checked.
func TestLoan_ListRefusesAUserWithoutThePermission(t *testing.T) {
	client, db, auth := mountLoan(t)

	user := testkit.User(t, db, "no-permission@example.com", models.RoleUser)

	client.As(testkit.SignIn(t, db, auth, user)).
		Get("/api/v1/loans").
		AssertForbidden()
}

// The round trip through the model, the service, the handler and the
// serialiser, which is where a wrong column name or a missing json tag shows up.
func TestLoan_AdminSeesWhatWasCreated(t *testing.T) {
	client, db, auth := mountLoan(t)

	admin := testkit.User(t, db, "admin@example.com", models.RoleAdmin)
	borrower := factory.CreateCustomer(t, db)

	record := factory.CreateLoan(t, db, func(m *models.Loan) {
		m.BorrowerID = borrower.ID
	})

	client.As(testkit.SignIn(t, db, auth, admin)).
		Get("/api/v1/loans").
		AssertOK().
		JSON().
		Count("data", 1).
		Where("data.0.id", record.ID)
}

// The most common shape of generated-handler bug, because it depends on how the
// service reports "no rows": a 500 here means the error was passed through
// rather than recognised.
func TestLoan_UnknownIDIsNotFound(t *testing.T) {
	client, db, auth := mountLoan(t)

	admin := testkit.User(t, db, "admin-404@example.com", models.RoleAdmin)

	client.As(testkit.SignIn(t, db, auth, admin)).
		Get("/api/v1/loans/01920000-0000-7000-8000-000000000000").
		AssertNotFound()
}

// Two people editing the same record.
//
// The API has carried a version column, an ETag and a 409 for this since long
// before any client sent the precondition, so the whole mechanism was inert and
// looked exactly like a working one (grit#182). It is only visible from the
// request: hence a test on the header rather than on the handler.
func TestLoan_StaleSaveIsRefused(t *testing.T) {
	client, db, auth := mountLoan(t)

	admin := testkit.User(t, db, "admin-version@example.com", models.RoleAdmin)
	borrower := factory.CreateCustomer(t, db)

	record := factory.CreateLoan(t, db, func(m *models.Loan) {
		m.BorrowerID = borrower.ID
	})
	client = client.As(testkit.SignIn(t, db, auth, admin))

	// The version the record is at, and the ETag the client is meant to send
	// back. Both, because a detail response missing the ETag is a client with
	// nothing to send.
	client.Get("/api/v1/loans/"+record.ID).
		AssertOK().
		AssertHeader("ETag", `W/"1"`).
		JSON().
		Where("data.version", float64(1))

	// The first save, with the version that was read.
	client.With("If-Match", `W/"1"`).
		Put("/api/v1/loans/"+record.ID, map[string]any{}).
		AssertOK()

	// The second, with the same version, which the record has moved past. This
	// is somebody saving a form they opened before the first save landed.
	client.With("If-Match", `W/"1"`).
		Put("/api/v1/loans/"+record.ID, map[string]any{}).
		AssertConflict().
		AssertCode("VERSION_CONFLICT")

	// And a client that sends no precondition is unaffected. Making the header
	// compulsory would break every script and every integration that writes to
	// this API.
	client.Put("/api/v1/loans/"+record.ID, map[string]any{}).AssertOK()
}

// The same, for the grid, which is where two people editing at once is likeliest.
//
// One If-Match header cannot carry a version per row, so each item in a
// bulk-edit carries its own, and a stale row is reported by its index so the
// grid can put the message on that line.
func TestLoan_BulkEditRefusesAStaleRow(t *testing.T) {
	client, db, auth := mountLoan(t)

	admin := testkit.User(t, db, "admin-grid@example.com", models.RoleAdmin)
	borrower := factory.CreateCustomer(t, db)

	first := factory.CreateLoan(t, db, func(m *models.Loan) {
		m.BorrowerID = borrower.ID
	})
	second := factory.CreateLoan(t, db, func(m *models.Loan) {
		m.BorrowerID = borrower.ID
	})
	client = client.As(testkit.SignIn(t, db, auth, admin))

	// Somebody else saves the second row, so the grid's copy of it is stale.
	client.With("If-Match", `W/"1"`).
		Put("/api/v1/loans/"+second.ID, map[string]any{}).
		AssertOK()

	client.Post("/api/v1/loans/bulk-edit", map[string]any{
		"items": []map[string]any{
			{"id": first.ID, "patch": map[string]any{"reference": "edited by the grid test"}, "version": 1},
			{"id": second.ID, "patch": map[string]any{"reference": "edited by the grid test"}, "version": 1},
		},
	}).
		AssertUnprocessable().
		JSON().
		Where("error.details.rows.0.index", float64(1))

	// The first row is untouched: the whole grid is refused rather than the
	// half of it that was still current. A spreadsheet half saved is worse than
	// one not saved.
	client.Get("/api/v1/loans/"+first.ID).
		AssertOK().
		JSON().
		Where("data.version", float64(1))

	// With no versions at all, as a client written before this did, the save
	// goes through.
	client.Post("/api/v1/loans/bulk-edit", map[string]any{
		"items": []map[string]any{
			{"id": first.ID, "patch": map[string]any{"reference": "edited by the grid test"}},
		},
	}).AssertOK()
}
