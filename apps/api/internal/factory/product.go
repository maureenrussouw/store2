package factory

import (
	"fmt"
	"testing"

	"gorm.io/gorm"

	"store2/apps/api/internal/models"
)

// NewProduct builds a valid Product without saving it.
//
// Every call produces different values for the unique fields, so two rows made
// in the same test do not collide.
//
// CategoryID is left empty here. CreateProduct fills it with a fresh parent when
// nothing else has, because the column is a string rather than a pointer: its
// zero value is the empty string, not NULL, and no parent row has that id.
// To attach it to one you already have, pass it in and the override wins:
//
//	product := factory.CreateProduct(t, db, func(m *models.Product) {
//		m.CategoryID = parent.ID
//	})
//
// ParentID stays nil: the relation is optional, so no parent is created for
// it. Pass one to attach it, remembering the column is a pointer:
//
//	product := factory.CreateProduct(t, db, func(m *models.Product) {
//		m.ParentID = &parent.ID
//	})
func NewProduct(overrides ...func(*models.Product)) *models.Product {
	n := next()

	record := &models.Product{
		Name:        fmt.Sprintf("Product %d", n),
		Price:       n,
		Description: fmt.Sprintf("A description for fixture %d", n),
	}

	for _, apply := range overrides {
		apply(record)
	}
	return record
}

// CreateProduct builds one and writes it, failing the test if it will not save.
//
// Failing here rather than returning an error is deliberate: a fixture that
// cannot be created is not a test failure to be asserted on, it is a broken
// test, and the stack should point at the line that asked for it.
func CreateProduct(tb testing.TB, db *gorm.DB, overrides ...func(*models.Product)) *models.Product {
	tb.Helper()
	record := NewProduct(overrides...)
	if record.CategoryID == "" {
		record.CategoryID = CreateCategory(tb, db).ID
	}
	if err := db.Create(record).Error; err != nil {
		tb.Fatalf("creating a product fixture: %v", err)
	}
	return record
}

// CreateProducts writes n of them, for a test about paging or sorting.
func CreateProducts(tb testing.TB, db *gorm.DB, n int, overrides ...func(*models.Product)) []*models.Product {
	tb.Helper()
	out := make([]*models.Product, 0, n)
	for i := 0; i < n; i++ {
		out = append(out, CreateProduct(tb, db, overrides...))
	}
	return out
}
