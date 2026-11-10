package services

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"time"

	"gorm.io/gorm"

	"store2/apps/api/internal/models"
)

// OAuthCodeExpiry is how long a native client has to exchange its code.
//
// Sixty seconds. The code travels from the callback to the app through an
// operating-system deep link and is exchanged immediately; anything longer is
// a window in which a code left in a log is still worth something.
const OAuthCodeExpiry = 60 * time.Second

var (
	// ErrOAuthCodeUsed is a code that has already been exchanged. Told apart
	// from an invalid one deliberately: a retry of a request whose response was
	// lost looks like this, and so does somebody replaying a captured code.
	// Both get refused; only the log can tell them apart.
	ErrOAuthCodeUsed = errors.New("this sign-in code has already been used")
	// ErrOAuthCodeExpired is a code past its minute.
	ErrOAuthCodeExpired = errors.New("this sign-in code has expired")
	// ErrOAuthCodeInvalid is anything else: a code that never existed.
	ErrOAuthCodeInvalid = errors.New("this sign-in code is not valid")
)

// HashOAuthCode is how a code is stored and looked up.
func HashOAuthCode(code string) string {
	sum := sha256.Sum256([]byte(code))
	return hex.EncodeToString(sum[:])
}

// IssueOAuthCode records a one-time code for a user and returns it.
//
// The plaintext is returned once, here, and never stored.
func IssueOAuthCode(ctx context.Context, db *gorm.DB, userID, redirectURI, ip string) (string, error) {
	raw := make([]byte, 32)
	if _, err := rand.Read(raw); err != nil {
		return "", fmt.Errorf("generating a sign-in code: %w", err)
	}
	code := hex.EncodeToString(raw)

	row := models.OAuthExchangeCode{
		UserID:      userID,
		CodeHash:    HashOAuthCode(code),
		RedirectURI: redirectURI,
		IPAddress:   ip,
		ExpiresAt:   time.Now().Add(OAuthCodeExpiry),
	}
	if err := db.WithContext(ctx).Create(&row).Error; err != nil {
		return "", fmt.Errorf("recording a sign-in code: %w", err)
	}
	return code, nil
}

// ConsumeOAuthCode spends a code and returns whose it was.
//
// The update is conditional on the code still being unused, so two exchanges
// arriving together cannot both succeed: exactly one updates a row, and the
// other is told the code has been used.
func ConsumeOAuthCode(ctx context.Context, db *gorm.DB, code string) (string, error) {
	if code == "" {
		return "", ErrOAuthCodeInvalid
	}

	var row models.OAuthExchangeCode
	err := db.WithContext(ctx).Where("code_hash = ?", HashOAuthCode(code)).First(&row).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return "", ErrOAuthCodeInvalid
	}
	if err != nil {
		return "", fmt.Errorf("looking up a sign-in code: %w", err)
	}
	if row.UsedAt != nil {
		return "", ErrOAuthCodeUsed
	}
	if time.Now().After(row.ExpiresAt) {
		return "", ErrOAuthCodeExpired
	}

	now := time.Now()
	res := db.WithContext(ctx).Model(&models.OAuthExchangeCode{}).
		Where("id = ? AND used_at IS NULL", row.ID).
		Update("used_at", now)
	if res.Error != nil {
		return "", fmt.Errorf("spending a sign-in code: %w", res.Error)
	}
	// Nothing updated means another request took it between the read above and
	// this write. Exactly one caller may win.
	if res.RowsAffected == 0 {
		return "", ErrOAuthCodeUsed
	}
	return row.UserID, nil
}

// CleanupExpiredOAuthCodes removes codes nobody can use any more.
func CleanupExpiredOAuthCodes(db *gorm.DB) error {
	return db.Where("expires_at < ?", time.Now().Add(-24*time.Hour)).
		Delete(&models.OAuthExchangeCode{}).Error
}
