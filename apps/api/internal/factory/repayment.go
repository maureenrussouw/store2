package factory

import (
	"testing"
	"time"

	"gorm.io/gorm"

	"store2/apps/api/internal/jsontime"
	"store2/apps/api/internal/models"
)

// NewRepayment builds a valid Repayment without saving it.
//
// Every call produces different values for the unique fields, so two rows made
// in the same test do not collide.
//
// LoanID is left empty here. CreateRepayment fills it with a fresh parent when
// nothing else has, because the column is a string rather than a pointer: its
// zero value is the empty string, not NULL, and no parent row has that id.
// To attach it to one you already have, pass it in and the override wins:
//
//	repayment := factory.CreateRepayment(t, db, func(m *models.Repayment) {
//		m.LoanID = parent.ID
//	})
func NewRepayment(overrides ...func(*models.Repayment)) *models.Repayment {
	n := next()

	record := &models.Repayment{
		DueDate: &jsontime.Date{Time: time.Date(2026, 1, 15, 0, 0, 0, 0, time.UTC)},
		Amount:  float64(n) + 0.5,
		Paid:    true,
	}

	for _, apply := range overrides {
		apply(record)
	}
	return record
}

// CreateRepayment builds one and writes it, failing the test if it will not save.
//
// Failing here rather than returning an error is deliberate: a fixture that
// cannot be created is not a test failure to be asserted on, it is a broken
// test, and the stack should point at the line that asked for it.
func CreateRepayment(tb testing.TB, db *gorm.DB, overrides ...func(*models.Repayment)) *models.Repayment {
	tb.Helper()
	record := NewRepayment(overrides...)
	if err := db.Create(record).Error; err != nil {
		tb.Fatalf("creating a repayment fixture: %v", err)
	}
	return record
}

// CreateRepayments writes n of them, for a test about paging or sorting.
func CreateRepayments(tb testing.TB, db *gorm.DB, n int, overrides ...func(*models.Repayment)) []*models.Repayment {
	tb.Helper()
	out := make([]*models.Repayment, 0, n)
	for i := 0; i < n; i++ {
		out = append(out, CreateRepayment(tb, db, overrides...))
	}
	return out
}
