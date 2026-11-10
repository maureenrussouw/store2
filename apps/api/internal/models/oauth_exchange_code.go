package models

import "time"

// OAuthExchangeCode is a one-time code a native client swaps for tokens.
//
// A mobile app cannot use the HttpOnly cookies the web callback sets, and
// putting the tokens in the redirect would put a refresh token in browser
// history. So the callback redirects to the app's deep link with a code, and
// the app POSTs that code to /auth/oauth/exchange.
//
// Stored as a hash, like every other credential in this project: a row in this
// table is not enough to sign in as anybody.
type OAuthExchangeCode struct {
	ID       uint   `gorm:"primarykey" json:"id"`
	UserID   string `gorm:"size:36;index;not null" json:"user_id"`
	CodeHash string `gorm:"size:64;uniqueIndex;not null" json:"-"`

	// UsedAt is set the moment the code is spent, and the row is kept rather
	// than deleted, so a second attempt can be told apart from a code that
	// never existed. That difference matters here: the first is a retry, the
	// second is somebody guessing.
	UsedAt *time.Time `json:"used_at,omitempty"`

	// Where the code was sent, recorded for the audit trail. Not used to
	// validate the exchange: the code is the credential.
	RedirectURI string `gorm:"size:255" json:"redirect_uri,omitempty"`
	IPAddress   string `gorm:"size:45" json:"ip_address,omitempty"`

	ExpiresAt time.Time `gorm:"index;not null" json:"expires_at"`
	CreatedAt time.Time `json:"created_at"`
}
