package models

import (
	"time"

	"gorm.io/gorm"

	"store2/apps/api/internal/ids"
)

// Loan represents a loan in the system.
type Loan struct {
	ID         string         `gorm:"primarykey;size:36" json:"id"`
	Reference  string         `gorm:"size:255" json:"reference" binding:"required" search:"trigram"`
	Status     string         `gorm:"size:255" json:"status" binding:"required" enum:"pending|active|closed|defaulted"`
	Risk       string         `gorm:"size:255" json:"risk" binding:"required" enum:"low|medium|high"`
	BorrowerID string         `gorm:"size:36;index" json:"borrower_id" binding:"required"`
	Borrower   *Customer      `gorm:"foreignKey:BorrowerID" json:"borrower,omitempty"`
	Items      []Repayment    `gorm:"foreignKey:LoanID" json:"items"`
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
func (m *Loan) BeforeCreate(tx *gorm.DB) error {
	if m.ID == "" {
		m.ID = ids.New()
	}
	return nil
}

// BeforeUpdate increments Version so offline clients can detect server-side updates.
func (m *Loan) BeforeUpdate(tx *gorm.DB) error {
	tx.Statement.SetColumn("version", gorm.Expr("version + 1"))
	return nil
}
