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

// mountSubscription builds an engine carrying this resource's routes exactly as routes.go
// mounts them: the auth middleware, then the permission the route names. Wiring
// it any other way would test a router this project does not run.
func mountSubscription(t *testing.T) (*testkit.Client, *gorm.DB, *services.AuthService) {
	t.Helper()

	db := testkit.DB(t)
	auth := testkit.Auth(testkit.Config(), db)
	handler := &SubscriptionHandler{DB: db}

	gin.SetMode(gin.TestMode)
	r := gin.New()
	guarded := r.Group("/api/v1", middleware.Auth(db, auth))
	guarded.GET("/subscriptions", middleware.RequireRole("ADMIN", "perm:subscriptions.view"), handler.List)
	guarded.GET("/subscriptions/:id", middleware.RequireRole("ADMIN", "perm:subscriptions.view"), handler.GetByID)
	guarded.PUT("/subscriptions/:id", middleware.RequireRole("ADMIN", "perm:subscriptions.edit"), handler.Update)
	guarded.POST("/subscriptions/bulk-edit", middleware.RequireRole("ADMIN", "perm:subscriptions.edit"), handler.BulkEdit)

	return testkit.New(t, r), db, auth
}

// A resource whose routes were injected into the wrong group is reachable by
// anyone, and nothing else in the project would notice.
func TestSubscription_ListRefusesAnonymous(t *testing.T) {
	client, _, _ := mountSubscription(t)

	client.Get("/api/v1/subscriptions").AssertUnauthorized()
}

// The difference between a permission that is declared and one that is checked.
func TestSubscription_ListRefusesAUserWithoutThePermission(t *testing.T) {
	client, db, auth := mountSubscription(t)

	user := testkit.User(t, db, "no-permission@example.com", models.RoleUser)

	client.As(testkit.SignIn(t, db, auth, user)).
		Get("/api/v1/subscriptions").
		AssertForbidden()
}

// The round trip through the model, the service, the handler and the
// serialiser, which is where a wrong column name or a missing json tag shows up.
func TestSubscription_AdminSeesWhatWasCreated(t *testing.T) {
	client, db, auth := mountSubscription(t)

	admin := testkit.User(t, db, "admin@example.com", models.RoleAdmin)
	customer := factory.CreateCustomer(t, db)

	record := factory.CreateSubscription(t, db, func(m *models.Subscription) {
		m.CustomerID = customer.ID
	})

	client.As(testkit.SignIn(t, db, auth, admin)).
		Get("/api/v1/subscriptions").
		AssertOK().
		JSON().
		Count("data", 1).
		Where("data.0.id", record.ID)
}

// The most common shape of generated-handler bug, because it depends on how the
// service reports "no rows": a 500 here means the error was passed through
// rather than recognised.
func TestSubscription_UnknownIDIsNotFound(t *testing.T) {
	client, db, auth := mountSubscription(t)

	admin := testkit.User(t, db, "admin-404@example.com", models.RoleAdmin)

	client.As(testkit.SignIn(t, db, auth, admin)).
		Get("/api/v1/subscriptions/01920000-0000-7000-8000-000000000000").
		AssertNotFound()
}

// Two people editing the same record.
//
// The API has carried a version column, an ETag and a 409 for this since long
// before any client sent the precondition, so the whole mechanism was inert and
// looked exactly like a working one (grit#182). It is only visible from the
// request: hence a test on the header rather than on the handler.
func TestSubscription_StaleSaveIsRefused(t *testing.T) {
	client, db, auth := mountSubscription(t)

	admin := testkit.User(t, db, "admin-version@example.com", models.RoleAdmin)
	customer := factory.CreateCustomer(t, db)

	record := factory.CreateSubscription(t, db, func(m *models.Subscription) {
		m.CustomerID = customer.ID
	})
	client = client.As(testkit.SignIn(t, db, auth, admin))

	// The version the record is at, and the ETag the client is meant to send
	// back. Both, because a detail response missing the ETag is a client with
	// nothing to send.
	client.Get("/api/v1/subscriptions/"+record.ID).
		AssertOK().
		AssertHeader("ETag", `W/"1"`).
		JSON().
		Where("data.version", float64(1))

	// The first save, with the version that was read.
	client.With("If-Match", `W/"1"`).
		Put("/api/v1/subscriptions/"+record.ID, map[string]any{}).
		AssertOK()

	// The second, with the same version, which the record has moved past. This
	// is somebody saving a form they opened before the first save landed.
	client.With("If-Match", `W/"1"`).
		Put("/api/v1/subscriptions/"+record.ID, map[string]any{}).
		AssertConflict().
		AssertCode("VERSION_CONFLICT")

	// And a client that sends no precondition is unaffected. Making the header
	// compulsory would break every script and every integration that writes to
	// this API.
	client.Put("/api/v1/subscriptions/"+record.ID, map[string]any{}).AssertOK()
}
