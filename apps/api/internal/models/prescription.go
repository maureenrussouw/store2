package models

import (
	"time"

	"gorm.io/gorm"

	"store2/apps/api/internal/ids"
)

// Prescription represents a prescription in the system.
type Prescription struct {
	ID        string         `gorm:"primarykey;size:36" json:"id"`
	Code      string         `gorm:"size:255" json:"code" binding:"required" search:"trigram"`
	Status    string         `gorm:"size:255" json:"status" binding:"required" enum:"draft|issued|dispensed"`
	Priority  string         `gorm:"size:255" json:"priority" binding:"required" enum:"routine|urgent"`
	PatientID string         `gorm:"size:36;index" json:"patient_id" binding:"required"`
	Patient   *Customer      `gorm:"foreignKey:PatientID" json:"patient,omitempty"`
	Items     []Medication   `gorm:"foreignKey:PrescriptionID" json:"items"`
	Version   int            `gorm:"not null;default:1" json:"version"`
	CreatedAt time.Time      `gorm:"index" json:"created_at"`
	UpdatedAt time.Time      `gorm:"index" json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
	// ArchivedAt is the "put this away without destroying it" state, and it is
	// deliberately not DeletedAt. A soft delete is invisible to every query and
	// means the row is gone as far as the app is concerned; an archived row is
	// still listable, still exportable and still restorable in one click. The
	// list endpoint hides archived rows unless ?archived=true asks for them.
	ArchivedAt *time.Time `gorm:"index" json:"archived_at,omitempty"`
}

// BeforeCreate generates a UUID before inserting.
func (m *Prescription) BeforeCreate(tx *gorm.DB) error {
	if m.ID == "" {
		m.ID = ids.New()
	}
	return nil
}

// BeforeUpdate increments Version so offline clients can detect server-side updates.
func (m *Prescription) BeforeUpdate(tx *gorm.DB) error {
	tx.Statement.SetColumn("version", gorm.Expr("version + 1"))
	return nil
}
