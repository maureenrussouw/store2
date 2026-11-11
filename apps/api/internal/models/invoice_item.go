package models

import (
	"time"

	"gorm.io/gorm"

	"store2/apps/api/internal/ids"
)

// InvoiceItem represents a invoiceitem in the system.
type InvoiceItem struct {
	ID          string         `gorm:"primarykey;size:36" json:"id"`
	Description string         `gorm:"type:text" json:"description" binding:"required" search:"trigram"`
	Qty         int            `json:"qty"`
	UnitRate    float64        `json:"unit_rate"`
	InvoiceID   string         `gorm:"size:36;index" json:"invoice_id" binding:"required"`
	Invoice     *Invoice       `gorm:"foreignKey:InvoiceID" json:"invoice,omitempty"`
	Version     int            `gorm:"not null;default:1" json:"version"`
	CreatedAt   time.Time      `gorm:"index" json:"created_at"`
	UpdatedAt   time.Time      `gorm:"index" json:"updated_at"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`
	// ArchivedAt is the "put this away without destroying it" state, and it is
	// deliberately not DeletedAt. A soft delete is invisible to every query and
	// means the row is gone as far as the app is concerned; an archived row is
	// still listable, still exportable and still restorable in one click. The
	// list endpoint hides archived rows unless ?archived=true asks for them.
	ArchivedAt *time.Time `gorm:"index" json:"archived_at,omitempty"`
}

// BeforeCreate generates a UUID before inserting.
func (m *InvoiceItem) BeforeCreate(tx *gorm.DB) error {
	if m.ID == "" {
		m.ID = ids.New()
	}
	return nil
}

// BeforeUpdate increments Version so offline clients can detect server-side updates.
func (m *InvoiceItem) BeforeUpdate(tx *gorm.DB) error {
	tx.Statement.SetColumn("version", gorm.Expr("version + 1"))
	return nil
}
