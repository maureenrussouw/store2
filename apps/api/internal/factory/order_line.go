package factory

import (
	"fmt"
	"testing"

	"gorm.io/gorm"

	"store2/apps/api/internal/models"
)

// NewOrderLine builds a valid OrderLine without saving it.
//
// Every call produces different values for the unique fields, so two rows made
// in the same test do not collide.
//
// OrderID is left empty here. CreateOrderLine fills it with a fresh parent when
// nothing else has, because the column is a string rather than a pointer: its
// zero value is the empty string, not NULL, and no parent row has that id.
// To attach it to one you already have, pass it in and the override wins:
//
//	orderLine := factory.CreateOrderLine(t, db, func(m *models.OrderLine) {
//		m.OrderID = parent.ID
//	})
func NewOrderLine(overrides ...func(*models.OrderLine)) *models.OrderLine {
	n := next()

	record := &models.OrderLine{
		Product:   fmt.Sprintf("Product %d", n),
		Qty:       n,
		UnitPrice: float64(n) + 0.5,
	}

	for _, apply := range overrides {
		apply(record)
	}
	return record
}

// CreateOrderLine builds one and writes it, failing the test if it will not save.
//
// Failing here rather than returning an error is deliberate: a fixture that
// cannot be created is not a test failure to be asserted on, it is a broken
// test, and the stack should point at the line that asked for it.
func CreateOrderLine(tb testing.TB, db *gorm.DB, overrides ...func(*models.OrderLine)) *models.OrderLine {
	tb.Helper()
	record := NewOrderLine(overrides...)
	if err := db.Create(record).Error; err != nil {
		tb.Fatalf("creating a orderline fixture: %v", err)
	}
	return record
}

// CreateOrderLines writes n of them, for a test about paging or sorting.
func CreateOrderLines(tb testing.TB, db *gorm.DB, n int, overrides ...func(*models.OrderLine)) []*models.OrderLine {
	tb.Helper()
	out := make([]*models.OrderLine, 0, n)
	for i := 0; i < n; i++ {
		out = append(out, CreateOrderLine(tb, db, overrides...))
	}
	return out
}
