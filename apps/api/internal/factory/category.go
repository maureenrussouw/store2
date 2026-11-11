package factory

import (
	"fmt"
	"testing"

	"gorm.io/gorm"

	"store2/apps/api/internal/models"
)

// NewCategory builds a valid Category without saving it.
//
// Every call produces different values for the unique fields, so two rows made
// in the same test do not collide.
//
// ParentID stays nil: the relation is optional, so no parent is created for
// it. Pass one to attach it, remembering the column is a pointer:
//
//	category := factory.CreateCategory(t, db, func(m *models.Category) {
//		m.ParentID = &parent.ID
//	})
func NewCategory(overrides ...func(*models.Category)) *models.Category {
	n := next()

	record := &models.Category{
		Name:     fmt.Sprintf("Category %d", n),
		Featured: true,
	}

	for _, apply := range overrides {
		apply(record)
	}
	return record
}

// CreateCategory builds one and writes it, failing the test if it will not save.
//
// Failing here rather than returning an error is deliberate: a fixture that
// cannot be created is not a test failure to be asserted on, it is a broken
// test, and the stack should point at the line that asked for it.
func CreateCategory(tb testing.TB, db *gorm.DB, overrides ...func(*models.Category)) *models.Category {
	tb.Helper()
	record := NewCategory(overrides...)
	if err := db.Create(record).Error; err != nil {
		tb.Fatalf("creating a category fixture: %v", err)
	}
	return record
}

// CreateCategories writes n of them, for a test about paging or sorting.
func CreateCategories(tb testing.TB, db *gorm.DB, n int, overrides ...func(*models.Category)) []*models.Category {
	tb.Helper()
	out := make([]*models.Category, 0, n)
	for i := 0; i < n; i++ {
		out = append(out, CreateCategory(tb, db, overrides...))
	}
	return out
}
