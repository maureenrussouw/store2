package models

import (
	"fmt"
	"log"
	"time"

	"gorm.io/datatypes"
	"gorm.io/gorm"
	"store2/apps/api/internal/ids"
)

// WebhookEvent persists every webhook the API receives. ExternalID is
// the provider's own event ID — we use it as the idempotency key, so
// duplicate deliveries (Stripe retries, partner pings) become no-ops.
//
// Status lifecycle:
//
//	pending   — received + verified, handler not yet run
//	processed — handler returned nil
//	failed    — handler returned an error; HandlerError holds the message
//	skipped   — duplicate ExternalID — handler was bypassed
type WebhookEvent struct {
	ID       string `gorm:"primarykey;size:36" json:"id"`
	Provider string `gorm:"size:50;not null;uniqueIndex:idx_webhook_provider_tenant_external,priority:1" json:"provider"`

	// Tenant is the route's tenant segment, empty for a provider that has
	// none. It is stored so a handler and a replay know which organization a
	// delivery belongs to, and it is in the idempotency key because two
	// organizations on the same gateway can each receive a reference
	// "INV-001": without it the second is dropped as a duplicate it is not.
	// See grit#138.
	Tenant    string `gorm:"size:64;not null;default:'';uniqueIndex:idx_webhook_provider_tenant_external,priority:2" json:"tenant,omitempty"`
	EventType string `gorm:"size:100;index" json:"event_type"`

	// ExternalID is the provider's own event id, and the second half of the
	// idempotency key. A pointer because it has to be NULL when a provider
	// does not supply one: every database allows repeated NULLs in a unique
	// index and none allow a repeated empty string, so storing "" would make
	// two unrelated anonymous events collide and silently drop the second.
	ExternalID *string `gorm:"size:255;uniqueIndex:idx_webhook_provider_tenant_external,priority:3" json:"external_id,omitempty"`
	// No explicit type: datatypes.JSON maps to jsonb on Postgres and json on
	// MySQL by itself. Naming jsonb here fails AutoMigrate on MySQL, which has
	// no such type.
	Payload      datatypes.JSON `json:"payload"`
	Status       string         `gorm:"size:20;index;not null;default:pending" json:"status"`
	HandlerError string         `gorm:"type:text" json:"handler_error,omitempty"`
	RetryCount   int            `gorm:"not null;default:0" json:"retry_count"`
	ProcessedAt  *time.Time     `json:"processed_at,omitempty"`
	CreatedAt    time.Time      `gorm:"index" json:"created_at"`
}

// MigrateWebhookEventIndexes drops the unique index that keyed deliveries on
// (provider, external_id) alone.
//
// The key is (provider, tenant, external_id) now, under a different NAME on
// purpose: AutoMigrate decides by name, so reusing idx_webhook_provider_external
// with different columns would leave the old two-column index in place and
// never create the new one. The feature would be present and not work.
//
// Dropped after the replacement exists, never before: between dropping one and
// creating the other there is no idempotency at all, and a redelivery arriving
// in that window is processed twice.
//
// A failure is reported rather than swallowed. While the old index is there a
// second organization's delivery with a reference the first already used is
// refused as a duplicate, and finding that out months later from a missing
// payment is worse than a loud migrate. See grit#138.
func MigrateWebhookEventIndexes(db *gorm.DB) error {
	mig := db.Migrator()
	if !mig.HasIndex(&WebhookEvent{}, "idx_webhook_provider_external") {
		return nil
	}
	if !mig.HasIndex(&WebhookEvent{}, "idx_webhook_provider_tenant_external") {
		log.Println("webhooks: idx_webhook_provider_tenant_external is missing, so the " +
			"old unique index on (provider, external_id) was left alone. Two " +
			"organizations cannot receive the same provider reference until the " +
			"schema is migrated (grit#138).")
		return nil
	}
	if err := mig.DropIndex(&WebhookEvent{}, "idx_webhook_provider_external"); err != nil {
		return fmt.Errorf("dropping the old unique index on webhook_events: %w", err)
	}
	log.Println("webhooks: a delivery is unique per (provider, tenant, event id) now")
	return nil
}

func (w *WebhookEvent) BeforeCreate(tx *gorm.DB) error {
	if w.ID == "" {
		w.ID = ids.New()
	}
	return nil
}

// The unique index is declared on the fields above rather than built here.
//
// It used to live in a method returning DDL as a string, which nothing
// called. The column had a plain index, the INSERT never failed, and the
// handler's "duplicate means already processed" branch was unreachable: every
// retried delivery ran the handler again. Declaring it as a tag means the
// migration creates it, and the constraint is where it can be seen.
