package services_test

import (
	"context"
	"errors"
	"testing"

	"store2/apps/api/internal/models"
	"store2/apps/api/internal/services"
)

// A failing hook must not stop the ones after it, and the connection and the
// asserted groups have to reach every hook: they are what tells an app which
// customer this is and what their directory says.
func TestSSOLoginHooksRunInOrderAndCarryTheConnection(t *testing.T) {
	services.ResetSSOLoginHooks()
	defer services.ResetSSOLoginHooks()

	var order []string
	var gotConn *models.SSOConnection
	var gotGroups []string

	services.OnSSOLogin(func(ctx context.Context, conn *models.SSOConnection, u *models.User, groups []string) error {
		order = append(order, "first")
		gotConn, gotGroups = conn, groups
		return errors.New("deliberate: the next hook must still run")
	})
	services.OnSSOLogin(func(ctx context.Context, conn *models.SSOConnection, u *models.User, groups []string) error {
		order = append(order, "second")
		return nil
	})
	services.OnSSOLogin(nil) // ignored, not a panic

	conn := &models.SSOConnection{ID: "conn-1", Slug: "acme"}
	user := &models.User{ID: "user-1"}
	services.RunSSOLoginHooks(context.Background(), conn, user, []string{"engineering", "admins"})

	if len(order) != 2 || order[0] != "first" || order[1] != "second" {
		t.Errorf("hooks ran %v; a failing hook must not stop the rest", order)
	}
	if gotConn == nil || gotConn.Slug != "acme" {
		t.Error("the hook did not get the connection, so it cannot tell which customer this is")
	}
	if len(gotGroups) != 2 || gotGroups[0] != "engineering" {
		t.Errorf("the hook got groups %v, want the asserted ones", gotGroups)
	}
}

// Registering none is the common case and must not panic.
func TestSSOLoginHooksWithNoneRegistered(t *testing.T) {
	services.ResetSSOLoginHooks()
	services.RunSSOLoginHooks(context.Background(), nil, &models.User{ID: "u"}, nil)
}
