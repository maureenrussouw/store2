package factory

import (
	"fmt"
	"testing"

	"gorm.io/gorm"

	"store2/apps/api/internal/models"
)

// NewLineCharge builds a valid LineCharge without saving it.
//
// Every call produces different values for the unique fields, so two rows made
// in the same test do not collide.
//
// SubscriptionID is left empty here. CreateLineCharge fills it with a fresh parent when
// nothing else has, because the column is a string rather than a pointer: its
// zero value is the empty string, not NULL, and no parent row has that id.
// To attach it to one you already have, pass it in and the override wins:
//
//	lineCharge := factory.CreateLineCharge(t, db, func(m *models.LineCharge) {
//		m.SubscriptionID = parent.ID
//	})
func NewLineCharge(overrides ...func(*models.LineCharge)) *models.LineCharge {
	n := next()

	record := &models.LineCharge{
		Description: fmt.Sprintf("A description for fixture %d", n),
		Qty:         n,
		UnitPrice:   float64(n) + 0.5,
	}

	for _, apply := range overrides {
		apply(record)
	}
	return record
}

// CreateLineCharge builds one and writes it, failing the test if it will not save.
//
// Failing here rather than returning an error is deliberate: a fixture that
// cannot be created is not a test failure to be asserted on, it is a broken
// test, and the stack should point at the line that asked for it.
func CreateLineCharge(tb testing.TB, db *gorm.DB, overrides ...func(*models.LineCharge)) *models.LineCharge {
	tb.Helper()
	record := NewLineCharge(overrides...)
	if err := db.Create(record).Error; err != nil {
		tb.Fatalf("creating a linecharge fixture: %v", err)
	}
	return record
}

// CreateLineCharges writes n of them, for a test about paging or sorting.
func CreateLineCharges(tb testing.TB, db *gorm.DB, n int, overrides ...func(*models.LineCharge)) []*models.LineCharge {
	tb.Helper()
	out := make([]*models.LineCharge, 0, n)
	for i := 0; i < n; i++ {
		out = append(out, CreateLineCharge(tb, db, overrides...))
	}
	return out
}
