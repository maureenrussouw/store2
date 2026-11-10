package factory

import (
	"fmt"
	"testing"
	"time"

	"gorm.io/gorm"

	"store2/apps/api/internal/models"
)

// NewUser builds a valid User without saving it.
//
// Email is unique in the schema, so every call gets its own.
//
// Password is left empty, which means User.BeforeCreate does not hash it. That
// is deliberate: almost every fixture exists to satisfy a foreign key, and
// bcrypt at the default cost is tens of milliseconds a row, which a suite that
// creates users in a loop pays for nothing. A test that signs in asks for one:
//
//	user := factory.CreateUser(t, db, func(u *models.User) {
//		u.Password = "correct-horse-battery-staple"
//	})
//
// EmailVerifiedAt is set, because a fixture cannot receive a link and anything
// gated on a confirmed address would otherwise refuse it.
func NewUser(overrides ...func(*models.User)) *models.User {
	n := next()
	verifiedAt := time.Now()

	record := &models.User{
		FirstName:       fmt.Sprintf("Test%d", n),
		LastName:        "User",
		Email:           fmt.Sprintf("user%d@example.test", n),
		Role:            models.RoleUser,
		Active:          true,
		EmailVerifiedAt: &verifiedAt,
	}

	for _, apply := range overrides {
		apply(record)
	}
	return record
}

// CreateUser builds one and writes it, failing the test if it will not save.
//
// Failing here rather than returning an error is deliberate: a fixture that
// cannot be created is not a test failure to be asserted on, it is a broken
// test, and the stack should point at the line that asked for it.
func CreateUser(tb testing.TB, db *gorm.DB, overrides ...func(*models.User)) *models.User {
	tb.Helper()
	record := NewUser(overrides...)
	if err := db.Create(record).Error; err != nil {
		tb.Fatalf("creating a user fixture: %v", err)
	}
	return record
}

// CreateUsers writes n of them, for a test about paging or sorting.
func CreateUsers(tb testing.TB, db *gorm.DB, n int, overrides ...func(*models.User)) []*models.User {
	tb.Helper()
	out := make([]*models.User, 0, n)
	for i := 0; i < n; i++ {
		out = append(out, CreateUser(tb, db, overrides...))
	}
	return out
}

// CreateAdmin is the one override asked for often enough to name.
func CreateAdmin(tb testing.TB, db *gorm.DB, overrides ...func(*models.User)) *models.User {
	tb.Helper()
	all := append([]func(*models.User){func(u *models.User) {
		u.Role = models.RoleAdmin
	}}, overrides...)
	return CreateUser(tb, db, all...)
}
