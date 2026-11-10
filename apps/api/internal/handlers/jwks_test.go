package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"

	"store2/apps/api/internal/services"
)

func serveJWKS(t *testing.T, keys *services.SigningKeys) (int, string) {
	t.Helper()
	gin.SetMode(gin.TestMode)
	router := gin.New()
	h := &JWKSHandler{Keys: keys}
	router.GET("/.well-known/jwks.json", h.Serve)

	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/.well-known/jwks.json", nil))
	return rec.Code, rec.Body.String()
}

// A shared secret must never be published, and the endpoint must still exist,
// so a verifier learns "nothing to fetch" rather than "wrong URL".
func TestJWKSPublishesNothingOnASharedSecret(t *testing.T) {
	keys, err := services.LoadSigningKeys("a-secret-at-least-32-characters-long", "", "", "", "")
	if err != nil {
		t.Fatalf("loading keys: %v", err)
	}

	code, body := serveJWKS(t, keys)
	if code != http.StatusOK {
		t.Fatalf("status = %d, want 200 even with nothing to publish", code)
	}

	var set services.JWKS
	if err := json.Unmarshal([]byte(body), &set); err != nil {
		t.Fatalf("response is not a key set: %v", err)
	}
	if len(set.Keys) != 0 {
		t.Fatal("an HS256 deployment must publish no keys: the verification key is the signing key")
	}
	// A null rather than an empty array breaks clients that iterate it.
	if !strings.Contains(body, `"keys":[]`) {
		t.Fatalf("empty set should serialise as [], got %s", body)
	}
}

func TestJWKSIsServedWithoutKeysConfigured(t *testing.T) {
	code, _ := serveJWKS(t, nil)
	if code != http.StatusOK {
		t.Fatalf("status = %d, want 200", code)
	}
}
