package factory

import (
	"fmt"
	"testing"

	"gorm.io/gorm"

	"store2/apps/api/internal/models"
)

// NewMedication builds a valid Medication without saving it.
//
// Every call produces different values for the unique fields, so two rows made
// in the same test do not collide.
//
// PrescriptionID is left empty here. CreateMedication fills it with a fresh parent when
// nothing else has, because the column is a string rather than a pointer: its
// zero value is the empty string, not NULL, and no parent row has that id.
// To attach it to one you already have, pass it in and the override wins:
//
//	medication := factory.CreateMedication(t, db, func(m *models.Medication) {
//		m.PrescriptionID = parent.ID
//	})
func NewMedication(overrides ...func(*models.Medication)) *models.Medication {
	n := next()

	record := &models.Medication{
		Name:     fmt.Sprintf("Medication %d", n),
		Dose:     fmt.Sprintf("Dose %d", n),
		Quantity: n,
	}

	for _, apply := range overrides {
		apply(record)
	}
	return record
}

// CreateMedication builds one and writes it, failing the test if it will not save.
//
// Failing here rather than returning an error is deliberate: a fixture that
// cannot be created is not a test failure to be asserted on, it is a broken
// test, and the stack should point at the line that asked for it.
func CreateMedication(tb testing.TB, db *gorm.DB, overrides ...func(*models.Medication)) *models.Medication {
	tb.Helper()
	record := NewMedication(overrides...)
	if err := db.Create(record).Error; err != nil {
		tb.Fatalf("creating a medication fixture: %v", err)
	}
	return record
}

// CreateMedications writes n of them, for a test about paging or sorting.
func CreateMedications(tb testing.TB, db *gorm.DB, n int, overrides ...func(*models.Medication)) []*models.Medication {
	tb.Helper()
	out := make([]*models.Medication, 0, n)
	for i := 0; i < n; i++ {
		out = append(out, CreateMedication(tb, db, overrides...))
	}
	return out
}
