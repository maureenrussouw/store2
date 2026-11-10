package services

import (
	"net/url"
	"os"
	"strings"
)

// Which deep links the OAuth callback may send a code to.
//
// An allowlist, not a pattern. A callback that redirects to whatever
// redirect_uri says is an open redirect, and one that carries a sign-in code is
// an account takeover: an attacker starts the flow with their own redirect, the
// victim signs in, and the code arrives at the attacker's app.
//
// Read from OAUTH_NATIVE_REDIRECTS, comma separated. A generated project ships
// with its own Expo app's scheme in .env.example and nothing else.
func NativeRedirectAllowed(redirectURI string) bool {
	if redirectURI == "" {
		return false
	}
	for _, allowed := range NativeRedirects() {
		if redirectURI == allowed {
			return true
		}
	}
	return false
}

// NativeRedirects is the configured allowlist.
func NativeRedirects() []string {
	raw := os.Getenv("OAUTH_NATIVE_REDIRECTS")
	if strings.TrimSpace(raw) == "" {
		return nil
	}
	var out []string
	for _, part := range strings.Split(raw, ",") {
		if trimmed := strings.TrimSpace(part); trimmed != "" {
			out = append(out, trimmed)
		}
	}
	return out
}

// NativeRedirectWithCode is where to send the browser once the handshake is
// done: the app's deep link, carrying the one-time code.
//
// Built with url.Values rather than string concatenation, so a scheme that
// already has a query string keeps it and a code is never spliced into one.
func NativeRedirectWithCode(redirectURI, code string) (string, error) {
	u, err := url.Parse(redirectURI)
	if err != nil {
		return "", err
	}
	q := u.Query()
	q.Set("code", code)
	u.RawQuery = q.Encode()
	return u.String(), nil
}

// NativeRedirectWithError is the same for a handshake that failed. The app
// needs to know, and it cannot read an HTML error page.
func NativeRedirectWithError(redirectURI, message string) (string, error) {
	u, err := url.Parse(redirectURI)
	if err != nil {
		return "", err
	}
	q := u.Query()
	q.Set("error", message)
	u.RawQuery = q.Encode()
	return u.String(), nil
}
