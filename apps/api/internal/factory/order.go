package factory

import (
	"fmt"
	"testing"

	"gorm.io/gorm"

	"store2/apps/api/internal/models"
)

// NewOrder builds a valid Order without saving it.
//
// Every call produces different values for the unique fields, so two rows made
// in the same test do not collide.
//
// CustomerID is left empty here. CreateOrder fills it with a fresh parent when
// nothing else has, because the column is a string rather than a pointer: its
// zero value is the empty string, not NULL, and no parent row has that id.
// To attach it to one you already have, pass it in and the override wins:
//
//	order := factory.CreateOrder(t, db, func(m *models.Order) {
//		m.CustomerID = parent.ID
//	})
func NewOrder(overrides ...func(*models.Order)) *models.Order {
	n := next()

	record := &models.Order{
		Number:      fmt.Sprintf("Number %d", n),
		Status:      "pending",
		Fulfillment: "standard",
	}

	for _, apply := range overrides {
		apply(record)
	}
	return record
}

// CreateOrder builds one and writes it, failing the test if it will not save.
//
// Failing here rather than returning an error is deliberate: a fixture that
// cannot be created is not a test failure to be asserted on, it is a broken
// test, and the stack should point at the line that asked for it.
func CreateOrder(tb testing.TB, db *gorm.DB, overrides ...func(*models.Order)) *models.Order {
	tb.Helper()
	record := NewOrder(overrides...)
	if record.CustomerID == "" {
		record.CustomerID = CreateCustomer(tb, db).ID
	}
	if err := db.Create(record).Error; err != nil {
		tb.Fatalf("creating a order fixture: %v", err)
	}
	return record
}

// CreateOrders writes n of them, for a test about paging or sorting.
func CreateOrders(tb testing.TB, db *gorm.DB, n int, overrides ...func(*models.Order)) []*models.Order {
	tb.Helper()
	out := make([]*models.Order, 0, n)
	for i := 0; i < n; i++ {
		out = append(out, CreateOrder(tb, db, overrides...))
	}
	return out
}
