package models

import (
	"time"

	"gorm.io/gorm"

	"store2/apps/api/internal/ids"
)

// Medication represents a medication in the system.
type Medication struct {
	ID             string         `gorm:"primarykey;size:36" json:"id"`
	Name           string         `gorm:"size:255" json:"name" binding:"required" search:"trigram"`
	Dose           string         `gorm:"size:255" json:"dose" binding:"required" search:"trigram"`
	Quantity       int            `json:"quantity"`
	PrescriptionID string         `gorm:"size:36;index" json:"prescription_id" binding:"required"`
	Prescription   *Prescription  `gorm:"foreignKey:PrescriptionID" json:"prescription,omitempty"`
	Version        int            `gorm:"not null;default:1" json:"version"`
	CreatedAt      time.Time      `gorm:"index" json:"created_at"`
	UpdatedAt      time.Time      `gorm:"index" json:"updated_at"`
	DeletedAt      gorm.DeletedAt `gorm:"index" json:"-"`
	// ArchivedAt is the "put this away without destroying it" state, and it is
	// deliberately not DeletedAt. A soft delete is invisible to every query and
	// means the row is gone as far as the app is concerned; an archived row is
	// still listable, still exportable and still restorable in one click. The
	// list endpoint hides archived rows unless ?archived=true asks for them.
	ArchivedAt *time.Time `gorm:"index" json:"archived_at,omitempty"`
}

// BeforeCreate generates a UUID before inserting.
func (m *Medication) BeforeCreate(tx *gorm.DB) error {
	if m.ID == "" {
		m.ID = ids.New()
	}
	return nil
}

// BeforeUpdate increments Version so offline clients can detect server-side updates.
func (m *Medication) BeforeUpdate(tx *gorm.DB) error {
	tx.Statement.SetColumn("version", gorm.Expr("version + 1"))
	return nil
}
