package factory

import (
	"fmt"
	"testing"

	"gorm.io/gorm"

	"store2/apps/api/internal/models"
)

// NewPrescription builds a valid Prescription without saving it.
//
// Every call produces different values for the unique fields, so two rows made
// in the same test do not collide.
//
// PatientID is left empty here. CreatePrescription fills it with a fresh parent when
// nothing else has, because the column is a string rather than a pointer: its
// zero value is the empty string, not NULL, and no parent row has that id.
// To attach it to one you already have, pass it in and the override wins:
//
//	prescription := factory.CreatePrescription(t, db, func(m *models.Prescription) {
//		m.PatientID = parent.ID
//	})
func NewPrescription(overrides ...func(*models.Prescription)) *models.Prescription {
	n := next()

	record := &models.Prescription{
		Code:     fmt.Sprintf("Code %d", n),
		Status:   "draft",
		Priority: "routine",
	}

	for _, apply := range overrides {
		apply(record)
	}
	return record
}

// CreatePrescription builds one and writes it, failing the test if it will not save.
//
// Failing here rather than returning an error is deliberate: a fixture that
// cannot be created is not a test failure to be asserted on, it is a broken
// test, and the stack should point at the line that asked for it.
func CreatePrescription(tb testing.TB, db *gorm.DB, overrides ...func(*models.Prescription)) *models.Prescription {
	tb.Helper()
	record := NewPrescription(overrides...)
	if record.PatientID == "" {
		record.PatientID = CreateCustomer(tb, db).ID
	}
	if err := db.Create(record).Error; err != nil {
		tb.Fatalf("creating a prescription fixture: %v", err)
	}
	return record
}

// CreatePrescriptions writes n of them, for a test about paging or sorting.
func CreatePrescriptions(tb testing.TB, db *gorm.DB, n int, overrides ...func(*models.Prescription)) []*models.Prescription {
	tb.Helper()
	out := make([]*models.Prescription, 0, n)
	for i := 0; i < n; i++ {
		out = append(out, CreatePrescription(tb, db, overrides...))
	}
	return out
}
