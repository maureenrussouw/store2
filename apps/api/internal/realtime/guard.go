package realtime

import (
	"errors"
	"log"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
)

// AllowedOrigins is the process-wide origin list, kept for code written before
// the handler carried its own. handlers.RealtimeHandler.AllowedOrigins is the
// one routes.Setup fills in, and it wins; this is the fallback when a handler
// was built without one. While both are nil, only a page served from the API's
// own host qualifies.
//
// Prefer the field. Two API instances in one process cannot share this
// variable: whichever called Setup last owns it, and the first instance then
// enforces the second's origins.
var AllowedOrigins func() []string

// OriginAllowed reports whether a WebSocket handshake may go ahead, against the
// origin list it is given.
//
// A browser sends the grit_access cookie with a handshake whichever page starts
// it, and the same-origin policy does not cover WebSockets. Accepting every
// origin let a page on another origin open a socket as the signed-in user and
// read their events. So a handshake that authenticates with the cookie has to
// come from an allowed origin, or from the API's own host.
//
// A handshake that carries its own token (?token= or an Authorization header)
// is not at risk: a page that already holds the token has nothing to hijack,
// and Connect never falls back to the cookie when one is sent. Native clients
// send no Origin at all, and the desktop webview sends its own scheme with a
// token, so both connect as before.
//
// The list arrives as an argument rather than being read from a package
// variable so that the rule has no process-wide state: two instances in one
// process each enforce their own, and a test can pass a list without disturbing
// the test beside it.
func OriginAllowed(r *http.Request, allowed func() []string) bool {
	origin := r.Header.Get("Origin")
	if origin == "" || r.URL.Query().Get("token") != "" || r.Header.Get("Authorization") != "" {
		return true
	}
	if u, err := url.Parse(origin); err == nil && u.Host != "" && strings.EqualFold(u.Host, r.Host) {
		return true
	}
	if allowed == nil {
		return false
	}
	for _, listed := range allowed() {
		// A wildcard in CORS_ORIGINS is not a reason to hand the cookie to every
		// site. The origin has to be named.
		if listed != "*" && strings.EqualFold(strings.TrimRight(listed, "/"), origin) {
			return true
		}
	}
	return false
}

// CheckOrigin is OriginAllowed against the package-level AllowedOrigins.
//
// Kept because a project may call it directly. New code should go through a
// hub, which holds its own list.
func CheckOrigin(r *http.Request) bool {
	return OriginAllowed(r, AllowedOrigins)
}

// hubOrigins holds one origin list per hub.
//
// A registry rather than a field on Hub because of which files move together.
// handlers/realtime_sse.go is framework code and is rewritten on every upgrade;
// handlers/realtime.go and internal/realtime/hub.go are yours, and an upgrade
// holds back a file you have edited. A rewritten file that reaches for a field
// or a method declared in a held-back one does not compile, which is what
// happens to anything declared outside this file. Everything the origin check
// needs is in guard.go, and guard.go arrives whole.
var hubOrigins sync.Map // *Hub -> func() []string

// SetAllowedOrigins records the browser origins that may open a connection to
// this hub with the grit_access cookie. routes.Setup points it at the list CORS
// uses, so an origin added in the admin reaches both. A nil list removes the
// registration.
//
// Per hub rather than per process: two API instances in one process each
// enforce their own origins, where one package-level list meant the instance
// that started second decided for both. A test can set one without putting a
// global back for the test beside it.
func (h *Hub) SetAllowedOrigins(allowed func() []string) {
	if h == nil {
		return
	}
	if allowed == nil {
		hubOrigins.Delete(h)
		return
	}
	hubOrigins.Store(h, allowed)
}

// CheckOrigin reports whether a connection to this hub may go ahead, against
// the origins registered for it. With none, it falls back to the package-level
// AllowedOrigins, which is where a project written before v3.479.0 set them.
func (h *Hub) CheckOrigin(r *http.Request) bool {
	if h != nil {
		if registered, ok := hubOrigins.Load(h); ok {
			if allowed, _ := registered.(func() []string); allowed != nil {
				return OriginAllowed(r, allowed)
			}
		}
	}
	return OriginAllowed(r, AllowedOrigins)
}

// ErrTooManyConnections is what Admit returns when a connection cap is reached.
var ErrTooManyConnections = errors.New("realtime: too many connections")

// Connection caps, read once from REALTIME_MAX_CONNECTIONS_PER_USER (default 10)
// and REALTIME_MAX_CONNECTIONS (default 10000, per process). Zero or less turns
// a cap off. Without them one account, or one script holding a stolen token,
// can open sockets until the process runs out of file descriptors, and realtime
// goes down for everyone.
var (
	limitsOnce sync.Once
	maxPerUser atomic.Int64
	maxTotal   atomic.Int64
)

// loadLimits reads the caps on first use rather than at package init, which
// runs before main has loaded .env.
func loadLimits() {
	limitsOnce.Do(func() {
		maxPerUser.Store(envLimit("REALTIME_MAX_CONNECTIONS_PER_USER", 10))
		maxTotal.Store(envLimit("REALTIME_MAX_CONNECTIONS", 10000))
	})
}

// SetConnectionLimits overrides the caps, for tests and for code that reads them
// from somewhere other than the environment.
func SetConnectionLimits(perUser, total int) {
	loadLimits()
	maxPerUser.Store(int64(perUser))
	maxTotal.Store(int64(total))
}

func envLimit(key string, fallback int64) int64 {
	raw := strings.TrimSpace(os.Getenv(key))
	if raw == "" {
		return fallback
	}
	n, err := strconv.ParseInt(raw, 10, 64)
	if err != nil {
		log.Printf("[realtime] %s=%q is not a number, using %d", key, raw, fallback)
		return fallback
	}
	return n
}

// Admit registers a client unless a connection cap is reached, in which case it
// registers nothing and returns ErrTooManyConnections. The check and the insert
// happen under one lock, so a burst of handshakes cannot all pass the check
// before any of them is counted.
func (h *Hub) Admit(c *Client) error {
	loadLimits()
	perUser, total := int(maxPerUser.Load()), int(maxTotal.Load())

	h.mu.Lock()
	defer h.mu.Unlock()
	set := h.clients[c.UserID]
	if perUser > 0 && len(set) >= perUser {
		log.Printf("[realtime] refused a connection for user=%s: the cap of %d per user is reached", c.UserID, perUser)
		return ErrTooManyConnections
	}
	if total > 0 {
		open := 0
		for _, s := range h.clients {
			open += len(s)
		}
		if open >= total {
			log.Printf("[realtime] refused a connection for user=%s: the cap of %d connections is reached", c.UserID, total)
			return ErrTooManyConnections
		}
	}
	if set == nil {
		set = make(map[*Client]struct{})
		h.clients[c.UserID] = set
	}
	set[c] = struct{}{}
	log.Printf("[realtime] client registered user=%s total=%d", c.UserID, len(set))
	return nil
}
