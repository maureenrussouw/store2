package models

import (
	"time"

	"gorm.io/gorm"

	"store2/apps/api/internal/ids"
	"store2/apps/api/internal/jsontime"
)

// Repayment represents a repayment in the system.
type Repayment struct {
	ID        string         `gorm:"primarykey;size:36" json:"id"`
	DueDate   *jsontime.Date `gorm:"type:date" json:"due_date"`
	Amount    float64        `gorm:"type:decimal(12,2)" json:"amount"`
	Paid      bool           `json:"paid"`
	LoanID    string         `gorm:"size:36;index" json:"loan_id" binding:"required"`
	Loan      *Loan          `gorm:"foreignKey:LoanID" json:"loan,omitempty"`
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
func (m *Repayment) BeforeCreate(tx *gorm.DB) error {
	if m.ID == "" {
		m.ID = ids.New()
	}
	return nil
}

// BeforeUpdate increments Version so offline clients can detect server-side updates.
func (m *Repayment) BeforeUpdate(tx *gorm.DB) error {
	tx.Statement.SetColumn("version", gorm.Expr("version + 1"))
	return nil
}
