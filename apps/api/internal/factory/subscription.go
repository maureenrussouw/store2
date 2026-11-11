package factory

import (
	"testing"

	"gorm.io/gorm"

	"store2/apps/api/internal/models"
)

// NewSubscription builds a valid Subscription without saving it.
//
// Every call produces different values for the unique fields, so two rows made
// in the same test do not collide.
//
// CustomerID is left empty here. CreateSubscription fills it with a fresh parent when
// nothing else has, because the column is a string rather than a pointer: its
// zero value is the empty string, not NULL, and no parent row has that id.
// To attach it to one you already have, pass it in and the override wins:
//
//	subscription := factory.CreateSubscription(t, db, func(m *models.Subscription) {
//		m.CustomerID = parent.ID
//	})
func NewSubscription(overrides ...func(*models.Subscription)) *models.Subscription {
	record := &models.Subscription{
		Plan:      "starter",
		Status:    "trialing",
		AutoRenew: true,
	}

	for _, apply := range overrides {
		apply(record)
	}
	return record
}

// CreateSubscription builds one and writes it, failing the test if it will not save.
//
// Failing here rather than returning an error is deliberate: a fixture that
// cannot be created is not a test failure to be asserted on, it is a broken
// test, and the stack should point at the line that asked for it.
func CreateSubscription(tb testing.TB, db *gorm.DB, overrides ...func(*models.Subscription)) *models.Subscription {
	tb.Helper()
	record := NewSubscription(overrides...)
	if record.CustomerID == "" {
		record.CustomerID = CreateCustomer(tb, db).ID
	}
	if err := db.Create(record).Error; err != nil {
		tb.Fatalf("creating a subscription fixture: %v", err)
	}
	return record
}

// CreateSubscriptions writes n of them, for a test about paging or sorting.
func CreateSubscriptions(tb testing.TB, db *gorm.DB, n int, overrides ...func(*models.Subscription)) []*models.Subscription {
	tb.Helper()
	out := make([]*models.Subscription, 0, n)
	for i := 0; i < n; i++ {
		out = append(out, CreateSubscription(tb, db, overrides...))
	}
	return out
}
