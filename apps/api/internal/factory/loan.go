package factory

import (
	"fmt"
	"testing"

	"gorm.io/gorm"

	"store2/apps/api/internal/models"
)

// NewLoan builds a valid Loan without saving it.
//
// Every call produces different values for the unique fields, so two rows made
// in the same test do not collide.
//
// BorrowerID is left empty here. CreateLoan fills it with a fresh parent when
// nothing else has, because the column is a string rather than a pointer: its
// zero value is the empty string, not NULL, and no parent row has that id.
// To attach it to one you already have, pass it in and the override wins:
//
//	loan := factory.CreateLoan(t, db, func(m *models.Loan) {
//		m.BorrowerID = parent.ID
//	})
func NewLoan(overrides ...func(*models.Loan)) *models.Loan {
	n := next()

	record := &models.Loan{
		Reference: fmt.Sprintf("Reference %d", n),
		Status:    "pending",
		Risk:      "low",
	}

	for _, apply := range overrides {
		apply(record)
	}
	return record
}

// CreateLoan builds one and writes it, failing the test if it will not save.
//
// Failing here rather than returning an error is deliberate: a fixture that
// cannot be created is not a test failure to be asserted on, it is a broken
// test, and the stack should point at the line that asked for it.
func CreateLoan(tb testing.TB, db *gorm.DB, overrides ...func(*models.Loan)) *models.Loan {
	tb.Helper()
	record := NewLoan(overrides...)
	if record.BorrowerID == "" {
		record.BorrowerID = CreateCustomer(tb, db).ID
	}
	if err := db.Create(record).Error; err != nil {
		tb.Fatalf("creating a loan fixture: %v", err)
	}
	return record
}

// CreateLoans writes n of them, for a test about paging or sorting.
func CreateLoans(tb testing.TB, db *gorm.DB, n int, overrides ...func(*models.Loan)) []*models.Loan {
	tb.Helper()
	out := make([]*models.Loan, 0, n)
	for i := 0; i < n; i++ {
		out = append(out, CreateLoan(tb, db, overrides...))
	}
	return out
}
