// Package sequence generates atomic, gap-free sequential numbers like
// INV-202605-0001 backed by a counter table. Each (name, bucket) pair
// gets its own row; "bucket" is the period key for resets — "202605"
// for monthly, "2026" for yearly, "" for no reset.
//
// Use it through a generated wrapper in services/, e.g.:
//
//	number, err := services.NextInvoiceNumber(db, time.Now())
//
// Concurrency note: Next() runs inside a transaction with a row-level
// SELECT FOR UPDATE on Postgres so concurrent callers serialize on the
// counter row. SQLite serializes writes globally. For high-throughput
// numbering (>100 writes/sec on a single counter), consider a dedicated
// sequence service.
package sequence

import (
	"errors"
	"fmt"
	"strings"
	"time"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// Reset controls the bucket key used to scope a counter.
type Reset string

const (
	ResetMonthly Reset = "monthly"
	ResetYearly  Reset = "yearly"
	ResetNever   Reset = "never"
)

// Counter is the row backing a single (name, bucket) sequence. Add it
// to AutoMigrate once: db.AutoMigrate(&sequence.Counter{}).
type Counter struct {
	Name      string `gorm:"primaryKey;size:50"`
	Bucket    string `gorm:"primaryKey;size:20"`
	NextValue uint64 `gorm:"not null;default:0"`
	UpdatedAt time.Time
}

// TableName pins the counter table to a stable name across resources
// that might have a model with the same default plural ("counters").
func (Counter) TableName() string {
	return "sequence_counters"
}

// Config describes how to format a sequence number.
type Config struct {
	Name   string // logical sequence name (e.g. "invoice")
	Prefix string // alphabetic prefix in the output (e.g. "INV")
	Reset  Reset  // monthly | yearly | never
	Width  int    // zero-padded width of the numeric portion (default 4)
}

// Next returns the next number for cfg, atomically incrementing the
// counter row inside a transaction. The bucket is derived from t and
// cfg.Reset.
func Next(db *gorm.DB, cfg Config, t time.Time) (string, error) {
	width := cfg.Width
	if width <= 0 {
		width = 4
	}
	bucket := bucketKey(t, cfg.Reset)

	var next uint64
	err := db.Transaction(func(tx *gorm.DB) error {
		// Lock or create the counter row, then increment in one go.
		// The row-level lock ensures concurrent callers serialize.
		var c Counter
		err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			Where("name = ? AND bucket = ?", cfg.Name, bucket).
			First(&c).Error
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c = Counter{Name: cfg.Name, Bucket: bucket, NextValue: 1}
			next = 1
			return tx.Create(&c).Error
		}
		if err != nil {
			return err
		}
		c.NextValue++
		next = c.NextValue
		// An explicit UPDATE, not Save. With Reset "never" the bucket is "",
		// which is the zero value of the string half of the primary key, and
		// Save treats a zero primary key as a new row: it INSERTed a second
		// ("name", "") and the second number of every such sequence failed on
		// the unique constraint. See grit#132.
		return tx.Model(&Counter{}).
			Where("name = ? AND bucket = ?", cfg.Name, bucket).
			Updates(map[string]any{
				"next_value": c.NextValue,
				"updated_at": time.Now(),
			}).Error
	})
	if err != nil {
		return "", err
	}
	return formatNumber(cfg.Prefix, bucket, width, next), nil
}

func bucketKey(t time.Time, reset Reset) string {
	switch reset {
	case ResetMonthly:
		return fmt.Sprintf("%04d%02d", t.Year(), int(t.Month()))
	case ResetYearly:
		return fmt.Sprintf("%04d", t.Year())
	default:
		return ""
	}
}

func formatNumber(prefix, bucket string, width int, n uint64) string {
	parts := []string{prefix}
	if bucket != "" {
		parts = append(parts, bucket)
	}
	parts = append(parts, fmt.Sprintf("%0*d", width, n))
	return strings.Join(parts, "-")
}
