package factory

import (
	"fmt"
	"testing"

	"gorm.io/gorm"

	"store2/apps/api/internal/models"
)

// NewCustomer builds a valid Customer without saving it.
//
// Every call produces different values for the unique fields, so two rows made
// in the same test do not collide.
func NewCustomer(overrides ...func(*models.Customer)) *models.Customer {
	n := next()

	record := &models.Customer{
		Name:    fmt.Sprintf("Customer %d", n),
		Email:   fmt.Sprintf("Email %d", n),
		Company: fmt.Sprintf("Company %d", n),
	}

	for _, apply := range overrides {
		apply(record)
	}
	return record
}

// CreateCustomer builds one and writes it, failing the test if it will not save.
//
// Failing here rather than returning an error is deliberate: a fixture that
// cannot be created is not a test failure to be asserted on, it is a broken
// test, and the stack should point at the line that asked for it.
func CreateCustomer(tb testing.TB, db *gorm.DB, overrides ...func(*models.Customer)) *models.Customer {
	tb.Helper()
	record := NewCustomer(overrides...)
	if err := db.Create(record).Error; err != nil {
		tb.Fatalf("creating a customer fixture: %v", err)
	}
	return record
}

// CreateCustomers writes n of them, for a test about paging or sorting.
func CreateCustomers(tb testing.TB, db *gorm.DB, n int, overrides ...func(*models.Customer)) []*models.Customer {
	tb.Helper()
	out := make([]*models.Customer, 0, n)
	for i := 0; i < n; i++ {
		out = append(out, CreateCustomer(tb, db, overrides...))
	}
	return out
}
