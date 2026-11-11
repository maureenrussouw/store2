package models

import (
	"time"

	"gorm.io/gorm"

	"store2/apps/api/internal/ids"
	"store2/apps/api/internal/jsontime"
	"store2/apps/api/internal/sequence"
)

// Invoice represents a invoice in the system.
type Invoice struct {
	ID         string         `gorm:"primarykey;size:36" json:"id"`
	Number     string         `gorm:"size:255" json:"number" search:"trigram"`
	Status     string         `gorm:"size:255" json:"status" binding:"required" enum:"draft|sent|paid"`
	Sent       bool           `json:"sent"`
	CustomerID string         `gorm:"size:36;index" json:"customer_id" binding:"required"`
	Customer   *Customer      `gorm:"foreignKey:CustomerID" json:"customer,omitempty"`
	Items      []InvoiceItem  `gorm:"foreignKey:InvoiceID" json:"items"`
	DueDate    *jsontime.Date `gorm:"type:date" json:"due_date"`
	Version    int            `gorm:"not null;default:1" json:"version"`
	CreatedAt  time.Time      `gorm:"index" json:"created_at"`
	UpdatedAt  time.Time      `gorm:"index" json:"updated_at"`
	DeletedAt  gorm.DeletedAt `gorm:"index" json:"-"`
	// ArchivedAt is the "put this away without destroying it" state, and it is
	// deliberately not DeletedAt. A soft delete is invisible to every query and
	// means the row is gone as far as the app is concerned; an archived row is
	// still listable, still exportable and still restorable in one click. The
	// list endpoint hides archived rows unless ?archived=true asks for them.
	ArchivedAt *time.Time `gorm:"index" json:"archived_at,omitempty"`
}

// BeforeCreate generates a UUID before inserting.
func (m *Invoice) BeforeCreate(tx *gorm.DB) error {
	if m.ID == "" {
		m.ID = ids.New()
	}
	if m.Number == "" {
		n, err := sequence.Next(tx, sequence.Config{
			Name:   "invoice_number",
			Prefix: "INV",
			Reset:  sequence.ResetMonthly,
			Width:  4,
		}, time.Now())
		if err != nil {
			return err
		}
		m.Number = n
	}
	return nil
}

// BeforeUpdate increments Version so offline clients can detect server-side updates.
func (m *Invoice) BeforeUpdate(tx *gorm.DB) error {
	tx.Statement.SetColumn("version", gorm.Expr("version + 1"))
	return nil
}
