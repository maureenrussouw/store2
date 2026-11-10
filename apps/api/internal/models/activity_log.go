package models

import (
	"time"

	"gorm.io/gorm"
	"store2/apps/api/internal/ids"
)

// ActivityLog records every successful authenticated mutation, with a
// tamper-evident hash chain: each row's Hash is HMAC-SHA256 under a
// server-held key over (PrevHash || canonical(this_row)). Mutating any
// row breaks the chain on the next VerifyChain pass, and without the
// key the break cannot be papered over by recomputing what follows.
//
// Keyed since v3.456.0. Before that it was a plain SHA-256 over values
// anybody can read off this source, so the one attacker it was written
// for could recompute the whole chain (review 2.7). HashAlgo records
// which of the two hashed each row.
//
// The payload digest is a SHA-256 of the request body so we have
// evidence of what was sent without storing PII verbatim. Read-only —
// no updates, no deletes (use a separate retention job to prune old
// rows; deletion still breaks the chain so it must rebuild from a
// safe checkpoint).
type ActivityLog struct {
	ID            string `gorm:"primarykey;size:36" json:"id"`
	UserID        string `gorm:"size:36;index" json:"user_id"`
	Method        string `gorm:"size:10" json:"method"`
	Path          string `gorm:"size:500;index" json:"path"`
	Status        int    `json:"status"`
	PayloadDigest string `gorm:"size:64" json:"payload_digest"` // sha256 hex
	IPAddress     string `gorm:"size:45" json:"ip_address"`
	UserAgent     string `gorm:"size:500" json:"user_agent"`
	DurationMS    int64  `json:"duration_ms"`
	// What an audited read served, or what a reseal covered. Empty on every
	// other entry, and left out of the hash when empty, so entries written
	// before these fields existed hash exactly as they did.
	Resource    string `gorm:"size:100;index" json:"resource,omitempty"`
	ResourceIDs string `gorm:"type:text" json:"resource_ids,omitempty"`
	RecordCount int    `json:"record_count,omitempty"`
	PrevHash    string `gorm:"size:64" json:"prev_hash"`        // hex, "" for the genesis row
	Hash        string `gorm:"size:64;uniqueIndex" json:"hash"` // hex of (prev_hash || canonical) under HashAlgo
	// HashAlgo is which algorithm hashed this row: "hmac-sha256" since
	// v3.456.0, and empty or "sha256" for a row written before the chain
	// was keyed. Stored per row rather than assumed, because a project
	// that upgraded has both and both have to verify (review 2.7).
	//
	// It is not a security boundary on its own: anybody who can edit a row
	// can edit this. What stops a downgrade is VerifyChain refusing an
	// unkeyed row that comes after a keyed one.
	HashAlgo  string    `gorm:"size:16" json:"hash_algo,omitempty"`
	CreatedAt time.Time `gorm:"index" json:"created_at"`
}

func (a *ActivityLog) BeforeCreate(tx *gorm.DB) error {
	if a.ID == "" {
		a.ID = ids.New()
	}
	return nil
}
