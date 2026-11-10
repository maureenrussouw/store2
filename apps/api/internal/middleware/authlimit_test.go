package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
)

// The limit holds, and it holds per route and per client.
func TestAuthRateLimit(t *testing.T) {
	gin.SetMode(gin.TestMode)

	limits := map[string]AuthLimit{
		"/api/v1/auth/login": {Requests: 3, Window: time.Minute},
	}
	r := gin.New()
	r.Use(AuthRateLimit(limits))
	r.POST("/api/v1/auth/login", func(c *gin.Context) { c.Status(http.StatusOK) })
	r.POST("/api/v1/auth/other", func(c *gin.Context) { c.Status(http.StatusOK) })

	call := func(path, ip string) int {
		req := httptest.NewRequest(http.MethodPost, path, nil)
		req.RemoteAddr = ip + ":1234"
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)
		return w.Code
	}

	for i := 1; i <= 3; i++ {
		if code := call("/api/v1/auth/login", "1.2.3.4"); code != http.StatusOK {
			t.Fatalf("attempt %d answered %d, want 200", i, code)
		}
	}
	if code := call("/api/v1/auth/login", "1.2.3.4"); code != http.StatusTooManyRequests {
		t.Errorf("the fourth attempt answered %d, want 429", code)
	}

	// Another client is not limited by the first one's attempts.
	if code := call("/api/v1/auth/login", "5.6.7.8"); code != http.StatusOK {
		t.Errorf("a different address answered %d, want 200", code)
	}

	// A route not in the table is not limited.
	for i := 0; i < 10; i++ {
		if code := call("/api/v1/auth/other", "1.2.3.4"); code != http.StatusOK {
			t.Fatalf("an unlisted route answered %d, want 200", code)
		}
	}
}

// A refusal says when to come back, so a client does not retry in a loop.
func TestAuthRateLimitSaysWhenToRetry(t *testing.T) {
	gin.SetMode(gin.TestMode)

	r := gin.New()
	r.Use(AuthRateLimit(map[string]AuthLimit{"/x": {Requests: 1, Window: 30 * time.Second}}))
	r.POST("/x", func(c *gin.Context) { c.Status(http.StatusOK) })

	for i := 0; i < 2; i++ {
		req := httptest.NewRequest(http.MethodPost, "/x", nil)
		req.RemoteAddr = "9.9.9.9:1"
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)
		if i == 1 {
			if w.Code != http.StatusTooManyRequests {
				t.Fatalf("answered %d, want 429", w.Code)
			}
			if w.Header().Get("Retry-After") == "" {
				t.Error("a 429 with no Retry-After")
			}
		}
	}
}

// The window passes and the client is allowed again.
func TestAuthRateLimitWindowExpires(t *testing.T) {
	l := &authLimiter{counts: map[string]*authCounter{}, limits: map[string]AuthLimit{}, swept: time.Now()}
	limit := AuthLimit{Requests: 1, Window: 10 * time.Millisecond}

	if _, ok := l.take("k", limit); !ok {
		t.Fatal("the first request was refused")
	}
	if _, ok := l.take("k", limit); ok {
		t.Fatal("the second request inside the window was allowed")
	}
	time.Sleep(15 * time.Millisecond)
	if _, ok := l.take("k", limit); !ok {
		t.Error("the window did not reset")
	}
}

// Expired windows are dropped, so the map does not grow by one entry per
// address for the life of the process.
func TestAuthRateLimitSweepsExpiredWindows(t *testing.T) {
	l := &authLimiter{counts: map[string]*authCounter{}, limits: map[string]AuthLimit{}}
	limit := AuthLimit{Requests: 5, Window: time.Millisecond}

	for i := 0; i < 100; i++ {
		l.take(string(rune('a'+i%26))+itoa(i), limit)
	}
	if len(l.counts) != 100 {
		t.Fatalf("holding %d windows, want 100", len(l.counts))
	}

	// A sweep only runs a minute after the last one, so put that in the past.
	l.swept = time.Now().Add(-2 * time.Minute)
	time.Sleep(5 * time.Millisecond)
	l.take("fresh", limit)
	if len(l.counts) != 1 {
		t.Errorf("holding %d windows after the sweep, want 1", len(l.counts))
	}
}
