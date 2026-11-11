package models

import (
	"time"

	"gorm.io/gorm"

	"store2/apps/api/internal/ids"
)

// LineCharge represents a linecharge in the system.
type LineCharge struct {
	ID             string         `gorm:"primarykey;size:36" json:"id"`
	Description    string         `gorm:"type:text" json:"description" binding:"required" search:"trigram"`
	Qty            int            `json:"qty"`
	UnitPrice      float64        `gorm:"type:decimal(12,2)" json:"unit_price"`
	SubscriptionID string         `gorm:"size:36;index" json:"subscription_id" binding:"required"`
	Subscription   *Subscription  `gorm:"foreignKey:SubscriptionID" json:"subscription,omitempty"`
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
func (m *LineCharge) BeforeCreate(tx *gorm.DB) error {
	if m.ID == "" {
		m.ID = ids.New()
	}
	return nil
}

// BeforeUpdate increments Version so offline clients can detect server-side updates.
func (m *LineCharge) BeforeUpdate(tx *gorm.DB) error {
	tx.Statement.SetColumn("version", gorm.Expr("version + 1"))
	return nil
}
