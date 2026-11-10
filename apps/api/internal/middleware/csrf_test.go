package middleware

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
)

// csrfSetCookie makes one safe request and returns the grit_csrf Set-Cookie.
func csrfSetCookie(t *testing.T) string {
	t.Helper()
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(AutoCSRF())
	r.GET("/api/ping", func(c *gin.Context) { c.Status(http.StatusOK) })

	w := httptest.NewRecorder()
	r.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/api/ping", nil))
	for _, h := range w.Header().Values("Set-Cookie") {
		if strings.HasPrefix(h, "grit_csrf=") {
			return h
		}
	}
	t.Fatalf("no grit_csrf cookie was set; headers: %v", w.Header())
	return ""
}

// Unset means host-only, which is what local development needs: the API and
// the frontend are both on localhost, and a Domain attribute there is a cookie
// the browser will not set.
func TestCSRFCookieIsHostOnlyByDefault(t *testing.T) {
	t.Setenv("CSRF_COOKIE_DOMAIN", "")
	got := csrfSetCookie(t)
	if strings.Contains(strings.ToLower(got), "domain=") {
		t.Errorf("unset CSRF_COOKIE_DOMAIN still produced a Domain: %q", got)
	}
}

// And with it set, the cookie is readable from a sibling subdomain.
//
// The double-submit pattern needs the FRONTEND's JavaScript to read this
// cookie and echo it in X-CSRF-Token. Host-only, it cannot, so a frontend on
// app.example.com talking to an API on api.example.com got 403 on every
// cookie-authenticated write.
func TestCSRFCookieCarriesTheConfiguredDomain(t *testing.T) {
	t.Setenv("CSRF_COOKIE_DOMAIN", ".example.com")
	got := csrfSetCookie(t)
	if !strings.Contains(strings.ToLower(got), "domain=example.com") {
		t.Errorf("Set-Cookie = %q, want a Domain of example.com. Without it a "+
			"frontend on a sibling subdomain cannot read grit_csrf, and every "+
			"write answers 403.", got)
	}
}

// What AutoCSRF lets through and what it refuses.
//
// grit#163: the two tests above check the cookie's attributes, which is how it
// is delivered, and nothing checked the decision it exists to make. A CSRF
// guard that accepts everything looks exactly like one that works.
//
// AutoCSRF enforces only on a request that authenticates with the grit_access
// cookie, because that is the only credential a page on another site can make
// the browser send. A bearer request is immune and a login has no cookie yet.
// All four of those rules are here, because each of them is a hole if it is
// wrong in the other direction.
func csrfRouter() *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(AutoCSRF())
	ok := func(c *gin.Context) { c.Status(http.StatusOK) }
	r.POST("/api/v1/widgets", ok)
	r.POST("/api/v1/auth/login", ok)
	r.POST("/api/v1/auth/logout", ok)
	r.GET("/api/v1/widgets", ok)
	return r
}

// csrfToken is the token value out of a Set-Cookie header.
func csrfToken(t *testing.T) string {
	t.Helper()
	header := csrfSetCookie(t)
	value := strings.TrimPrefix(strings.SplitN(header, ";", 2)[0], "grit_csrf=")
	if value == "" {
		t.Fatalf("no token in %q", header)
	}
	return value
}

func TestAutoCSRFDecisions(t *testing.T) {
	t.Setenv("CSRF_COOKIE_DOMAIN", "")
	token := csrfToken(t)
	r := csrfRouter()

	call := func(method, path string, apply func(*http.Request)) int {
		req := httptest.NewRequest(method, path, strings.NewReader("{}"))
		req.Header.Set("Content-Type", "application/json")
		if apply != nil {
			apply(req)
		}
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)
		return w.Code
	}
	withAccess := func(req *http.Request) {
		req.AddCookie(&http.Cookie{Name: "grit_access", Value: "an-access-token"})
	}

	cases := []struct {
		name   string
		method string
		path   string
		apply  func(*http.Request)
		want   int
		why    string
	}{
		{
			name: "a cookie-authenticated write with a matching token", method: http.MethodPost,
			path: "/api/v1/widgets",
			apply: func(req *http.Request) {
				withAccess(req)
				req.AddCookie(&http.Cookie{Name: "grit_csrf", Value: token})
				req.Header.Set("X-CSRF-Token", token)
			},
			want: http.StatusOK,
			why:  "the double-submit pattern was satisfied and the write was still refused",
		},
		{
			name: "a cookie-authenticated write with no token at all", method: http.MethodPost,
			path: "/api/v1/widgets", apply: withAccess,
			want: http.StatusForbidden,
			why:  "a cross-site form post with the victim's session cookie was accepted",
		},
		{
			name: "a cookie-authenticated write whose header does not match", method: http.MethodPost,
			path: "/api/v1/widgets",
			apply: func(req *http.Request) {
				withAccess(req)
				req.AddCookie(&http.Cookie{Name: "grit_csrf", Value: token})
				req.Header.Set("X-CSRF-Token", "a-different-token")
			},
			want: http.StatusForbidden,
			why:  "a header that does not match the cookie was accepted, which is the whole check",
		},
		{
			name: "a cookie-authenticated write with a header and no cookie", method: http.MethodPost,
			path: "/api/v1/widgets",
			apply: func(req *http.Request) {
				withAccess(req)
				req.Header.Set("X-CSRF-Token", token)
			},
			want: http.StatusForbidden,
			why:  "a header alone was accepted, so anybody who can guess a header can post",
		},
		{
			// Native clients send Authorization and cannot be forged
			// cross-site. Several of them also store and resend the cookie set
			// at login, so the bearer check has to come first.
			name: "a bearer write, with a stray access cookie", method: http.MethodPost,
			path: "/api/v1/widgets",
			apply: func(req *http.Request) {
				withAccess(req)
				req.Header.Set("Authorization", "Bearer a-token")
			},
			want: http.StatusOK,
			why:  "a native client was refused for a cookie it did not mean to send",
		},
		{
			name: "an anonymous write", method: http.MethodPost, path: "/api/v1/widgets",
			apply: nil, want: http.StatusOK,
			why: "a request with no session was refused by CSRF, which has nothing to protect",
		},
		{
			// Login mints the cookie, so it cannot present one.
			name: "login, which has no token yet", method: http.MethodPost,
			path: "/api/v1/auth/login", apply: nil, want: http.StatusOK,
			why: "nobody can sign in, because signing in requires a token signing in provides",
		},
		{
			// And logout is not exempt: it is a write by a cookie-authenticated
			// browser like any other.
			name: "logout with a cookie and no token", method: http.MethodPost,
			path: "/api/v1/auth/logout", apply: withAccess,
			want: http.StatusForbidden,
			why:  "another site could sign the user out",
		},
		{
			name: "a read", method: http.MethodGet, path: "/api/v1/widgets",
			apply: withAccess, want: http.StatusOK,
			why: "a GET was refused, so no page can load",
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := call(tc.method, tc.path, tc.apply); got != tc.want {
				t.Errorf("%s %s answered %d, want %d: %s", tc.method, tc.path, got, tc.want, tc.why)
			}
		})
	}
}
