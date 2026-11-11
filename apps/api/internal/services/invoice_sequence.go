package services

import (
	"time"

	"gorm.io/gorm"

	"store2/apps/api/internal/sequence"
)

// NextInvoiceNumber returns the next invoice identifier (e.g. INV-202605-0001).
// The counter resets monthly and is generated atomically.
func NextInvoiceNumber(db *gorm.DB, t time.Time) (string, error) {
	return sequence.Next(db, sequence.Config{
		Name:   "invoice",
		Prefix: "INV",
		Reset:  sequence.ResetMonthly,
		Width:  4,
	}, t)
}
