package handlers

import (
	"errors"
	"log"

	"github.com/gin-gonic/gin"

	"store2/apps/api/internal/respond"
	"store2/apps/api/internal/services"
)

// OAuthExchange swaps a one-time code for a token pair.
//
// This is how a native client finishes a social login. The web callback sets
// HttpOnly cookies and redirects; a mobile app cannot use those, and putting
// the tokens in the redirect would put a refresh token in browser history. So
// the callback redirects to the app with a code and the app posts it here.
//
// Public by design, like every other step of a login flow: the code IS the
// credential, and it is single-use and lives for a minute.
func (h *AuthHandler) OAuthExchange(c *gin.Context) {
	var body struct {
		Code string `json:"code" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		respond.Fail(c, respond.CodeValidationError, "A code is required.")
		return
	}

	userID, err := services.ConsumeOAuthCode(c.Request.Context(), h.DB, body.Code)
	if err != nil {
		// One answer for every failure. A client cannot do anything different
		// with "used" than with "never existed", and saying which tells
		// somebody guessing codes that they got one right.
		switch {
		case errors.Is(err, services.ErrOAuthCodeUsed),
			errors.Is(err, services.ErrOAuthCodeExpired),
			errors.Is(err, services.ErrOAuthCodeInvalid):
			log.Printf("oauth exchange refused: %v", err)
		default:
			log.Printf("oauth exchange: %v", err)
		}
		respond.Fail(c, respond.CodeUnauthorized,
			"This sign-in code is not valid. Start the sign-in again.")
		return
	}

	user, err := h.AuthService.UserByID(c.Request.Context(), userID)
	if err != nil || user == nil {
		log.Printf("oauth exchange: user %s is gone", userID)
		respond.Fail(c, respond.CodeUnauthorized, "This sign-in code is not valid.")
		return
	}
	if !user.Active {
		respond.Fail(c, respond.CodeForbidden, "Your account has been disabled.")
		return
	}

	tokens, err := h.AuthService.GenerateTokenPair(user.ID, user.Email, user.Role)
	if err != nil {
		log.Printf("oauth exchange: generating tokens for %s: %v", user.ID, err)
		respond.WriteError(c, err, "Failed to sign in.")
		return
	}

	// Recorded as a session, so a mobile sign-in is listed and revocable
	// exactly like one from a browser.
	if _, err := services.CreateSession(h.DB, c, user.ID, tokens.RefreshToken); err != nil {
		log.Printf("oauth exchange: recording session for %s: %v", user.ID, err)
	}

	respond.OK(c, gin.H{"user": user, "tokens": tokens})
}
