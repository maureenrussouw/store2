package middleware

import (
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

// AuthLimit is how many requests one client may make to one route in a window.
type AuthLimit struct {
	Requests int
	Window   time.Duration
}

// authCounter is one client's count for one route in the current window.
type authCounter struct {
	count int
	reset time.Time
}

// authLimiter holds the counts. One per middleware, so two groups with
// different tables do not share state.
type authLimiter struct {
	mu     sync.Mutex
	counts map[string]*authCounter
	limits map[string]AuthLimit
	// swept is when the map was last cleared of expired windows. Without it
	// the map grows by one entry per distinct address, forever, which is a
	// slow memory leak with an attacker's hand on the tap.
	swept time.Time
}

// AuthRateLimit limits the routes in the table by client address.
//
// Fixed window rather than a token bucket, deliberately: the thing being
// stopped is an automated client making hundreds of attempts, and a fixed
// window stops that with a counter and a timestamp. A burst of two at the
// window boundary is not the attack.
//
// The key is the client address plus the route path, so a limit on
// /auth/login is not spent by requests to /auth/register. The address comes
// from gin's ClientIP, which honours the trusted-proxy configuration this
// project already sets: behind a proxy that does not set it, every client
// looks like the proxy and the limit is shared, which fails closed.
//
// A path not in the table is not limited here. Add it to authRouteLimits in
// routes.go, which is the one table both this and Sentinel read.
func AuthRateLimit(limits map[string]AuthLimit) gin.HandlerFunc {
	l := &authLimiter{
		counts: make(map[string]*authCounter),
		limits: limits,
		swept:  time.Now(),
	}
	return func(c *gin.Context) {
		limit, ok := l.limits[c.Request.URL.Path]
		if !ok || limit.Requests <= 0 {
			c.Next()
			return
		}
		retry, allowed := l.take(c.ClientIP()+" "+c.Request.URL.Path, limit)
		if !allowed {
			// Retry-After in seconds, because a client that is told when to
			// come back is a client that does not retry in a loop.
			c.Header("Retry-After", itoa(int(retry.Seconds())+1))
			c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{
				"error": gin.H{
					"code":    "RATE_LIMITED",
					"message": "Too many attempts. Try again shortly.",
				},
			})
			return
		}
		c.Next()
	}
}

// take counts one request and says whether it is allowed, and if not, how long
// until the window resets.
func (l *authLimiter) take(key string, limit AuthLimit) (time.Duration, bool) {
	now := time.Now()

	l.mu.Lock()
	defer l.mu.Unlock()

	// Every minute, drop the windows that have passed. Cheap, because it only
	// walks the map when a request arrives anyway.
	if now.Sub(l.swept) > time.Minute {
		for k, c := range l.counts {
			if now.After(c.reset) {
				delete(l.counts, k)
			}
		}
		l.swept = now
	}

	c, seen := l.counts[key]
	if !seen || now.After(c.reset) {
		l.counts[key] = &authCounter{count: 1, reset: now.Add(limit.Window)}
		return 0, true
	}
	if c.count >= limit.Requests {
		return c.reset.Sub(now), false
	}
	c.count++
	return 0, true
}

// itoa without importing strconv for one call.
func itoa(n int) string {
	if n <= 0 {
		return "1"
	}
	var digits []byte
	for n > 0 {
		digits = append([]byte{byte('0' + n%10)}, digits...)
		n /= 10
	}
	return string(digits)
}
