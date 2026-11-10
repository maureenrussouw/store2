package authz_test

import (
	"testing"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	"store2/apps/api/internal/authz"
	"store2/apps/api/internal/models"
)

func newDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	if err != nil {
		t.Fatal(err)
	}
	if err := db.AutoMigrate(&models.User{}, &models.Role{}, &models.UserRole{}); err != nil {
		t.Fatal(err)
	}
	if err := models.SeedRoles(db); err != nil {
		t.Fatal(err)
	}
	return db
}

// A user's role had two stores, and the answer depended on who asked.
//
// users.role is a string column; user_roles is the join table behind the
// grants. Grant resolution reads the join table and falls back to the column.
// A route guarded by a ROLE NAME used to read the column outright, so where the
// two disagreed, RequireRole("ADMIN") and RequireRole("perm:users.delete")
// answered from different data (grit#154).
//
// RoleNamesFor is the one resolver both halves read now. These tests pin its
// precedence, because that precedence IS the fix.
func TestRoleNamesComeFromTheAssignmentsNotTheColumn(t *testing.T) {
	db := newDB(t)

	// The disagreement, written deliberately: the column says ADMIN, the
	// assignment says USER. This is what a row touched outside the app looks
	// like, or a project that had its column edited by hand.
	user := models.User{Email: "someone@example.com", Role: "ADMIN", Active: true}
	if err := db.Create(&user).Error; err != nil {
		t.Fatal(err)
	}
	var userRole models.Role
	if err := models.PlatformRoles(db).Where("name = ?", "USER").First(&userRole).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&models.UserRole{UserID: user.ID, RoleID: userRole.ID}).Error; err != nil {
		t.Fatal(err)
	}

	names, err := authz.RoleNamesFor(db, user.ID)
	if err != nil {
		t.Fatalf("RoleNamesFor: %v", err)
	}
	if len(names) != 1 || names[0] != "USER" {
		t.Errorf("RoleNamesFor = %v, want [USER]: the assignment is the store, and a "+
			"stale users.role column must not hand somebody ADMIN", names)
	}
}

// And the column is still the fallback, which is what keeps a project that
// predates user_roles working. Removing that would lock every admin out on
// the upgrade that shipped permissions.
func TestTheColumnIsTheFallbackWhenThereAreNoAssignments(t *testing.T) {
	db := newDB(t)

	user := models.User{Email: "legacy@example.com", Role: "ADMIN", Active: true}
	if err := db.Create(&user).Error; err != nil {
		t.Fatal(err)
	}

	names, err := authz.RoleNamesFor(db, user.ID)
	if err != nil {
		t.Fatalf("RoleNamesFor: %v", err)
	}
	if len(names) != 1 || names[0] != "ADMIN" {
		t.Errorf("RoleNamesFor = %v, want [ADMIN] from the column: a project with no "+
			"user_roles rows yet must keep working", names)
	}

	// Lower case in the column answers an upper-case guard. The routes name
	// "ADMIN" and a column holding "admin" is the same role.
	if err := db.Model(&user).Update("role", "admin").Error; err != nil {
		t.Fatal(err)
	}
	names, err = authz.RoleNamesFor(db, user.ID)
	if err != nil {
		t.Fatalf("RoleNamesFor: %v", err)
	}
	if len(names) != 1 || names[0] != "ADMIN" {
		t.Errorf("RoleNamesFor = %v, want [ADMIN]: a lower-case column should not fail "+
			"a guard that names ADMIN", names)
	}
}

// Both halves of the decision read one store, so they cannot disagree. This is
// the property the whole change exists for, so it is asserted directly rather
// than left to follow from the two above.
func TestTheRoleNamesAndTheGrantsAgree(t *testing.T) {
	db := newDB(t)

	user := models.User{Email: "both@example.com", Role: "ADMIN", Active: true}
	if err := db.Create(&user).Error; err != nil {
		t.Fatal(err)
	}
	var editor models.Role
	if err := models.PlatformRoles(db).Where("name = ?", "EDITOR").First(&editor).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&models.UserRole{UserID: user.ID, RoleID: editor.ID}).Error; err != nil {
		t.Fatal(err)
	}
	authz.Invalidate()

	names, err := authz.RoleNamesFor(db, user.ID)
	if err != nil {
		t.Fatal(err)
	}
	grants, err := authz.GrantsFor(db, user.ID)
	if err != nil {
		t.Fatal(err)
	}

	// The column says ADMIN. Neither half may believe it.
	for _, name := range names {
		if name == "ADMIN" {
			t.Error("the role names say ADMIN while the assignment is EDITOR")
		}
	}
	if authz.Granted(grants, "*") {
		t.Error("the grants include the superuser wildcard while the assignment is EDITOR")
	}
	if len(names) == 0 {
		t.Error("no role names at all, which would refuse every role-guarded route")
	}
}

// A role's name is unique per OWNER, which is what lets two customers each
// have an "Accountant". It used to be unique across the platform, so the
// second one was refused and an organization could not define a role of its
// own at all (grit#130).
func TestTwoOrganizationsCanEachHaveTheSameRoleName(t *testing.T) {
	db := newDB(t)

	a := models.Role{OwnerOrgID: "org-a", Name: "Accountant"}
	b := models.Role{OwnerOrgID: "org-b", Name: "Accountant"}
	if err := db.Create(&a).Error; err != nil {
		t.Fatalf("org A's Accountant: %v", err)
	}
	if err := db.Create(&b).Error; err != nil {
		t.Fatalf("org B's Accountant: %v, so an organization still cannot define "+
			"a role of its own", err)
	}
	if a.ID == b.ID {
		t.Error("the two organizations share one role row, so an edit by A changes B")
	}

	// And one organization still cannot have two of the same name.
	if err := db.Create(&models.Role{OwnerOrgID: "org-a", Name: "Accountant"}).Error; err == nil {
		t.Error("one organization has two roles called Accountant")
	}
}

// A lookup by name means the PLATFORM's role. An organization that names a
// role ADMIN must not be found by anything resolving platform permissions,
// or its members hold whatever the platform's ADMIN holds.
func TestAnOrganizationRoleIsNotFoundAsAPlatformRole(t *testing.T) {
	db := newDB(t)

	impostor := models.Role{OwnerOrgID: "org-a", Name: models.RoleAdmin}
	if err := db.Create(&impostor).Error; err != nil {
		t.Fatalf("an organization naming a role %s: %v", models.RoleAdmin, err)
	}

	var found models.Role
	if err := models.PlatformRoles(db).Where("name = ?", models.RoleAdmin).
		First(&found).Error; err != nil {
		t.Fatal(err)
	}
	if found.ID == impostor.ID {
		t.Error("a platform lookup found the organization's role")
	}
	if found.OwnerOrgID != "" {
		t.Errorf("a platform lookup returned a role owned by %q", found.OwnerOrgID)
	}
}

// Roles must exist automatically, with sane grants.
func TestSeedRoles(t *testing.T) {
	db := newDB(t)

	var roles []models.Role
	db.Find(&roles)
	if len(roles) != 3 {
		t.Fatalf("seeded %d roles, want 3", len(roles))
	}

	var admin models.Role
	models.PlatformRoles(db).Where("name = ?", models.RoleAdmin).First(&admin)
	if got := admin.GrantsList(); len(got) != 1 || got[0] != "*" {
		t.Errorf("ADMIN grants = %v, want [*]", got)
	}
	if !admin.IsSystem {
		t.Error("ADMIN must be a system role")
	}

	// Re-seeding must not duplicate or clobber.
	admin.SetGrants([]string{"users.view"})
	db.Save(&admin)
	if err := models.SeedRoles(db); err != nil {
		t.Fatal(err)
	}
	models.PlatformRoles(db).Where("name = ?", models.RoleAdmin).First(&admin)
	if got := admin.GrantsList(); len(got) != 1 || got[0] != "users.view" {
		t.Errorf("re-seeding clobbered an operator edit: %v", got)
	}
}

// The legacy users.role string must still authorise, so apps upgrading from
// role-only auth don't lose access before anyone is assigned a Role row.
func TestGrantsFor_LegacyRoleFallback(t *testing.T) {
	db := newDB(t)
	admin := models.User{ID: "u-admin", Email: "a@x.com", FirstName: "A", LastName: "B", Role: models.RoleAdmin}
	plain := models.User{ID: "u-plain", Email: "p@x.com", FirstName: "P", LastName: "B", Role: models.RoleUser}
	db.Create(&admin)
	db.Create(&plain)

	g, err := authz.GrantsFor(db, admin.ID)
	if err != nil {
		t.Fatal(err)
	}
	if !authz.Granted(g, "users.delete") {
		t.Errorf("legacy ADMIN lost access; grants=%v", g)
	}

	g, err = authz.GrantsFor(db, plain.ID)
	if err != nil {
		t.Fatal(err)
	}
	if authz.Granted(g, "users.delete") {
		t.Errorf("plain USER must not hold users.delete; grants=%v", g)
	}
}

// An explicit user_roles assignment takes precedence over the legacy string.
func TestGrantsFor_ExplicitAssignmentWins(t *testing.T) {
	db := newDB(t)
	u := models.User{ID: "u1", Email: "u1@x.com", FirstName: "U", LastName: "1", Role: models.RoleUser}
	db.Create(&u)

	custom := models.Role{Name: "Support"}
	custom.SetGrants([]string{"uploads.*"})
	db.Create(&custom)
	db.Create(&models.UserRole{UserID: u.ID, RoleID: custom.ID})
	authz.Invalidate()

	g, _ := authz.GrantsFor(db, u.ID)
	if !authz.Granted(g, "uploads.delete") {
		t.Errorf("uploads.* should cover uploads.delete; grants=%v", g)
	}
	if authz.Granted(g, "users.delete") {
		t.Errorf("assignment must not leak other permissions; grants=%v", g)
	}
}

// Revoking must take effect immediately, not after a cache TTL.
func TestInvalidate(t *testing.T) {
	db := newDB(t)
	u := models.User{ID: "u2", Email: "u2@x.com", FirstName: "U", LastName: "2", Role: models.RoleAdmin}
	db.Create(&u)

	if g, _ := authz.GrantsFor(db, u.ID); !authz.Granted(g, "users.delete") {
		t.Fatal("expected initial admin access")
	}

	db.Model(&models.User{}).Where("id = ?", u.ID).Update("role", models.RoleUser)
	authz.Invalidate()

	if g, _ := authz.GrantsFor(db, u.ID); authz.Granted(g, "users.delete") {
		t.Error("demotion did not take effect after Invalidate")
	}
}
