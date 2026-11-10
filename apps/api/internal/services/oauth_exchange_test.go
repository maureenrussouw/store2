package services

import (
	"context"
	"sync"
	"testing"
	"time"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"

	"store2/apps/api/internal/models"
)

func oauthCodeDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("opening the test database: %v", err)
	}
	if err := db.AutoMigrate(&models.OAuthExchangeCode{}); err != nil {
		t.Fatalf("migrating: %v", err)
	}
	return db
}

func TestACodeSignsInOnce(t *testing.T) {
	db := oauthCodeDB(t)
	ctx := context.Background()

	code, err := IssueOAuthCode(ctx, db, "user-1", "myapp://callback", "127.0.0.1")
	if err != nil {
		t.Fatalf("IssueOAuthCode: %v", err)
	}
	if code == "" {
		t.Fatal("no code was returned")
	}

	// The plaintext is never stored. A row in this table must not be enough to
	// sign in as anybody.
	var row models.OAuthExchangeCode
	if err := db.First(&row).Error; err != nil {
		t.Fatalf("reading the row: %v", err)
	}
	if row.CodeHash == code {
		t.Error("the code is stored in plaintext")
	}
	if row.CodeHash != HashOAuthCode(code) {
		t.Error("the stored hash is not the hash of the code")
	}

	userID, err := ConsumeOAuthCode(ctx, db, code)
	if err != nil {
		t.Fatalf("ConsumeOAuthCode: %v", err)
	}
	if userID != "user-1" {
		t.Errorf("ConsumeOAuthCode = %q, want user-1", userID)
	}

	// And only once.
	if _, err := ConsumeOAuthCode(ctx, db, code); err != ErrOAuthCodeUsed {
		t.Errorf("a second exchange returned %v, want ErrOAuthCodeUsed", err)
	}
}

func TestAnExpiredCodeIsRefused(t *testing.T) {
	db := oauthCodeDB(t)
	ctx := context.Background()

	code, err := IssueOAuthCode(ctx, db, "user-1", "myapp://callback", "")
	if err != nil {
		t.Fatalf("IssueOAuthCode: %v", err)
	}
	// Age it past its minute.
	if err := db.Model(&models.OAuthExchangeCode{}).
		Where("1 = 1").
		Update("expires_at", time.Now().Add(-time.Second)).Error; err != nil {
		t.Fatalf("ageing the code: %v", err)
	}

	if _, err := ConsumeOAuthCode(ctx, db, code); err != ErrOAuthCodeExpired {
		t.Errorf("an expired code returned %v, want ErrOAuthCodeExpired", err)
	}
}

func TestAnUnknownCodeIsRefused(t *testing.T) {
	db := oauthCodeDB(t)
	for _, code := range []string{"", "not-a-code", HashOAuthCode("guess")} {
		if _, err := ConsumeOAuthCode(context.Background(), db, code); err != ErrOAuthCodeInvalid {
			t.Errorf("ConsumeOAuthCode(%q) = %v, want ErrOAuthCodeInvalid", code, err)
		}
	}
}

// Two exchanges arriving together must not both succeed. The app retries on a
// lost response, so this is an ordinary race rather than an attack, and it has
// to resolve to one session rather than two.
func TestTwoExchangesRaceAndOnlyOneWins(t *testing.T) {
	db := oauthCodeDB(t)
	ctx := context.Background()

	code, err := IssueOAuthCode(ctx, db, "user-1", "myapp://callback", "")
	if err != nil {
		t.Fatalf("IssueOAuthCode: %v", err)
	}

	var wg sync.WaitGroup
	results := make([]error, 2)
	for i := range results {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			_, results[i] = ConsumeOAuthCode(ctx, db, code)
		}(i)
	}
	wg.Wait()

	won := 0
	for _, err := range results {
		if err == nil {
			won++
		}
	}
	if won != 1 {
		t.Errorf("%d of 2 exchanges succeeded, want exactly 1 (errors: %v)", won, results)
	}
}
