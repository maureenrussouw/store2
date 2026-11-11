package factory

import (
	"testing"

	"gorm.io/gorm"

	"store2/apps/api/internal/models"
)

// NewInvoice builds a valid Invoice without saving it.
//
// Every call produces different values for the unique fields, so two rows made
// in the same test do not collide.
//
// CustomerID is left empty here. CreateInvoice fills it with a fresh parent when
// nothing else has, because the column is a string rather than a pointer: its
// zero value is the empty string, not NULL, and no parent row has that id.
// To attach it to one you already have, pass it in and the override wins:
//
//	invoice := factory.CreateInvoice(t, db, func(m *models.Invoice) {
//		m.CustomerID = parent.ID
//	})
func NewInvoice(overrides ...func(*models.Invoice)) *models.Invoice {
	record := &models.Invoice{
		Status: "draft",
		Sent:   true,
	}

	for _, apply := range overrides {
		apply(record)
	}
	return record
}

// CreateInvoice builds one and writes it, failing the test if it will not save.
//
// Failing here rather than returning an error is deliberate: a fixture that
// cannot be created is not a test failure to be asserted on, it is a broken
// test, and the stack should point at the line that asked for it.
func CreateInvoice(tb testing.TB, db *gorm.DB, overrides ...func(*models.Invoice)) *models.Invoice {
	tb.Helper()
	record := NewInvoice(overrides...)
	if record.CustomerID == "" {
		record.CustomerID = CreateCustomer(tb, db).ID
	}
	if err := db.Create(record).Error; err != nil {
		tb.Fatalf("creating a invoice fixture: %v", err)
	}
	return record
}

// CreateInvoices writes n of them, for a test about paging or sorting.
func CreateInvoices(tb testing.TB, db *gorm.DB, n int, overrides ...func(*models.Invoice)) []*models.Invoice {
	tb.Helper()
	out := make([]*models.Invoice, 0, n)
	for i := 0; i < n; i++ {
		out = append(out, CreateInvoice(tb, db, overrides...))
	}
	return out
}
