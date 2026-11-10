package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"store2/apps/api/internal/services"
)

// JWKSHandler serves the public keys that verify this API's tokens.
type JWKSHandler struct {
	Keys *services.SigningKeys
}

// Serve answers GET /.well-known/jwks.json.
//
// Cacheable, because the whole point is that a verifier holds these in memory
// rather than fetching one per request. Five minutes is short enough that a
// rotation propagates on its own and long enough that this endpoint is not
// traffic. A verifier that meets an unknown key id should refetch immediately
// rather than waiting for the cache to lapse, which is what makes rotation
// seamless.
func (h *JWKSHandler) Serve(c *gin.Context) {
	set := services.JWKS{Keys: []services.JWK{}}
	if h.Keys != nil {
		set = h.Keys.PublicJWKS()
	}
	c.Header("Cache-Control", "public, max-age=300")
	c.JSON(http.StatusOK, set)
}
