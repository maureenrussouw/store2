// Package webhooks is the receive-side framework for inbound
// webhooks (Stripe, GitHub, WhatsApp, Twilio, Slack, anything that
// pings you). The shape:
//
//	webhooks.Register("stripe", webhooks.Provider{
//	    SecretEnv: "STRIPE_WEBHOOK_SECRET",
//	    Verify:    webhooks.StripeVerifier,
//	    Extract:   webhooks.StripeExtractor,
//	})
//
//	webhooks.On("stripe", "invoice.paid", func(ctx context.Context, e *models.WebhookEvent) error {
//	    // process the event…
//	    return nil
//	})
//
// At app boot, call webhooks.Setup(db) once. The HTTP handler is
// already wired in routes.go at POST /webhooks/:provider — it does:
//  1. Look up the provider config (404 if unknown)
//  2. Read raw body + headers
//  3. Verify signature via Provider.Verify
//  4. Extract event type + external id via Provider.Extract
//  5. INSERT into webhook_events (unique on provider+external_id —
//     duplicate delivery becomes a no-op, status=skipped)
//  6. Run the registered handler for (provider, event_type)
//  7. Update event row with processed/failed status
//
// Failed handlers stay in the table with status=failed; the admin
// endpoint POST /api/admin/webhooks/:id/replay re-runs the handler.
package webhooks

import (
	"context"
	"fmt"
	"os"
	"sync"

	"gorm.io/gorm"

	"store2/apps/api/internal/models"
)

// VerifyFunc validates a request's signature. Returns an error if the
// payload was tampered with or the signature is missing/invalid.
type VerifyFunc func(secret string, body []byte, headers map[string]string) error

// ExtractFunc pulls (eventType, externalID) from a verified payload.
// EventType drives handler dispatch; ExternalID drives idempotency.
type ExtractFunc func(body []byte, headers map[string]string) (eventType string, externalID string, err error)

// Handler is the user-defined function that processes a verified +
// deduplicated webhook. Errors are persisted to webhook_events.handler_error.
type Handler func(ctx context.Context, e *models.WebhookEvent) error

// SecretFunc resolves the signing secret for ONE delivery.
//
// params are the route's path parameters, so a provider whose secret differs
// per tenant can read the tenant segment out of them; headers are the
// request's, for a provider that identifies the account in a header instead.
// An error refuses the delivery rather than verifying it against the wrong
// secret.
type SecretFunc func(ctx context.Context, params map[string]string, headers map[string]string) (string, error)

// Provider is the per-source configuration.
type Provider struct {
	SecretEnv string // env var holding the signing secret

	// Secret, when set, is used instead of SecretEnv, and is how a provider
	// whose secret differs per tenant is verified at all.
	//
	// SecretEnv is one secret for the whole deployment, which is right for
	// Stripe or GitHub and impossible for a gateway where every organization
	// connects its own account and has its own signing secret. That had no way
	// in before v3.446.0: the only recourse was a hand-written route, which
	// loses the stored deliveries, the dedupe and the admin replay. See
	// grit#138.
	//
	// Keep it cheap and keep it honest: it runs before the signature is
	// checked, so it is reachable by anybody who can post to the route. Look
	// the secret up by the tenant in the path and return an error for a tenant
	// you do not know, rather than falling back to a default.
	Secret SecretFunc

	Verify  VerifyFunc  // signature verifier (StripeVerifier, GitHubVerifier, HMACVerifier, etc.)
	Extract ExtractFunc // event type + external id extractor
}

// SecretFor resolves the secret a delivery is verified against: the provider's
// own resolver when it has one, and the environment otherwise.
//
// One function rather than the choice at the call site, because the receiver
// is not the only caller: a test, a replay and a second route all have to make
// the same decision, and a provider verified against the wrong secret either
// refuses everything or accepts anything.
func SecretFor(ctx context.Context, p Provider, params, headers map[string]string) (string, error) {
	if p.Secret != nil {
		return p.Secret(ctx, params, headers)
	}
	return os.Getenv(p.SecretEnv), nil
}

var (
	mu        sync.RWMutex
	providers = map[string]Provider{}
	handlers  = map[string]map[string]Handler{} // provider → eventType → handler
	db        *gorm.DB
)

// Setup wires the package to the project's *gorm.DB. Call once at app
// boot from routes.Setup or main.
func Setup(database *gorm.DB) {
	mu.Lock()
	defer mu.Unlock()
	db = database
}

// Register adds a provider configuration. Call from package init() or
// from a setup function in your handlers package.
func Register(name string, p Provider) {
	mu.Lock()
	defer mu.Unlock()
	providers[name] = p
	if _, ok := handlers[name]; !ok {
		handlers[name] = map[string]Handler{}
	}
}

// On binds a handler to (provider, eventType). Use the empty string
// "" as eventType to register a catch-all handler — it runs for any
// event from this provider that doesn't have a specific handler.
func On(provider, eventType string, h Handler) {
	mu.Lock()
	defer mu.Unlock()
	if _, ok := handlers[provider]; !ok {
		handlers[provider] = map[string]Handler{}
	}
	handlers[provider][eventType] = h
}

// LookupProvider returns the Provider config for name.
func LookupProvider(name string) (Provider, bool) {
	mu.RLock()
	defer mu.RUnlock()
	p, ok := providers[name]
	return p, ok
}

// Dispatch finds a handler for (provider, eventType). Falls back to
// the catch-all "" handler if no specific match. Returns nil if no
// handler is registered (the event is still persisted, just unprocessed).
func Dispatch(ctx context.Context, e *models.WebhookEvent) error {
	mu.RLock()
	pmap, ok := handlers[e.Provider]
	mu.RUnlock()
	if !ok {
		return nil
	}
	mu.RLock()
	h, exact := pmap[e.EventType]
	if !exact {
		h = pmap[""] // catch-all
	}
	mu.RUnlock()
	if h == nil {
		return nil
	}
	return h(ctx, e)
}

// DB returns the registered *gorm.DB or nil if Setup hasn't been called.
// Used by the HTTP handler — exposed so admin endpoints can re-use it.
func DB() *gorm.DB {
	mu.RLock()
	defer mu.RUnlock()
	return db
}

// IsDuplicateError reports whether err looks like a unique-constraint
// violation on (provider, external_id). Postgres + SQLite both surface
// these distinctly, but the message format varies — check substrings.
func IsDuplicateError(err error) bool {
	if err == nil {
		return false
	}
	s := err.Error()
	return contains(s, "duplicate key") ||
		contains(s, "UNIQUE constraint") ||
		contains(s, "duplicate entry")
}

func contains(s, sub string) bool {
	return len(s) >= len(sub) && (indexOf(s, sub) >= 0)
}

func indexOf(s, sub string) int {
	for i := 0; i+len(sub) <= len(s); i++ {
		if s[i:i+len(sub)] == sub {
			return i
		}
	}
	return -1
}

// MissingProviderError is returned when an unregistered provider is hit.
type MissingProviderError struct{ Name string }

func (e MissingProviderError) Error() string {
	return fmt.Sprintf("webhooks: provider %q not registered", e.Name)
}
