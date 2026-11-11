package factory

import (
	"fmt"
	"testing"

	"gorm.io/gorm"

	"store2/apps/api/internal/models"
)

// NewInvoiceItem builds a valid InvoiceItem without saving it.
//
// Every call produces different values for the unique fields, so two rows made
// in the same test do not collide.
//
// InvoiceID is left empty here. CreateInvoiceItem fills it with a fresh parent when
// nothing else has, because the column is a string rather than a pointer: its
// zero value is the empty string, not NULL, and no parent row has that id.
// To attach it to one you already have, pass it in and the override wins:
//
//	invoiceItem := factory.CreateInvoiceItem(t, db, func(m *models.InvoiceItem) {
//		m.InvoiceID = parent.ID
//	})
func NewInvoiceItem(overrides ...func(*models.InvoiceItem)) *models.InvoiceItem {
	n := next()

	record := &models.InvoiceItem{
		Description: fmt.Sprintf("A description for fixture %d", n),
		Qty:         n,
		UnitRate:    float64(n) + 0.5,
	}

	for _, apply := range overrides {
		apply(record)
	}
	return record
}

// CreateInvoiceItem builds one and writes it, failing the test if it will not save.
//
// Failing here rather than returning an error is deliberate: a fixture that
// cannot be created is not a test failure to be asserted on, it is a broken
// test, and the stack should point at the line that asked for it.
func CreateInvoiceItem(tb testing.TB, db *gorm.DB, overrides ...func(*models.InvoiceItem)) *models.InvoiceItem {
	tb.Helper()
	record := NewInvoiceItem(overrides...)
	if err := db.Create(record).Error; err != nil {
		tb.Fatalf("creating a invoiceitem fixture: %v", err)
	}
	return record
}

// CreateInvoiceItems writes n of them, for a test about paging or sorting.
func CreateInvoiceItems(tb testing.TB, db *gorm.DB, n int, overrides ...func(*models.InvoiceItem)) []*models.InvoiceItem {
	tb.Helper()
	out := make([]*models.InvoiceItem, 0, n)
	for i := 0; i < n; i++ {
		out = append(out, CreateInvoiceItem(tb, db, overrides...))
	}
	return out
}
