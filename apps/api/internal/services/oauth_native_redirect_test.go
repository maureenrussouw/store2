package services

import (
	"os"
	"strings"
	"testing"
)

// An allowlist, and the reason it is not a pattern: a callback that redirects
// wherever the query string says, carrying a sign-in code, is an account
// takeover. The attacker starts the flow with their own redirect, the victim
// signs in, and the code arrives at the attacker's app.
func TestOnlyAllowlistedRedirectsAreAccepted(t *testing.T) {
	t.Setenv("OAUTH_NATIVE_REDIRECTS", "myapp://callback, myapp://oauth")

	for _, allowed := range []string{"myapp://callback", "myapp://oauth"} {
		if !NativeRedirectAllowed(allowed) {
			t.Errorf("%q is in the allowlist and was refused", allowed)
		}
	}

	for _, refused := range []string{
		"",
		"evil://callback",
		"https://evil.example/callback",
		"myapp://callback/../evil",
		"myapp://callback?next=https://evil.example",
		// A prefix of an allowed value, which a strings.HasPrefix check would
		// let through along with everything after it.
		"myapp://callbackevil",
		// And the allowed value as a prefix of something longer.
		"myapp://callback.evil.example",
	} {
		if NativeRedirectAllowed(refused) {
			t.Errorf("%q is not in the allowlist and was accepted", refused)
		}
	}
}

// With nothing configured, nothing is allowed. A project that has not opted in
// does not have an open redirect by default.
func TestNoAllowlistMeansNoNativeRedirects(t *testing.T) {
	t.Setenv("OAUTH_NATIVE_REDIRECTS", "")
	if NativeRedirectAllowed("myapp://callback") {
		t.Error("a redirect was allowed with no allowlist configured")
	}
	if got := NativeRedirects(); len(got) != 0 {
		t.Errorf("NativeRedirects() = %v, want nothing", got)
	}
	os.Unsetenv("OAUTH_NATIVE_REDIRECTS")
	if NativeRedirectAllowed("myapp://callback") {
		t.Error("a redirect was allowed with OAUTH_NATIVE_REDIRECTS unset")
	}
}

// The code goes on as a query parameter, so a deep link that already has one
// keeps it.
func TestTheCodeIsAddedAsAQueryParameter(t *testing.T) {
	got, err := NativeRedirectWithCode("myapp://callback?from=login", "abc123")
	if err != nil {
		t.Fatalf("NativeRedirectWithCode: %v", err)
	}
	if !strings.Contains(got, "code=abc123") {
		t.Errorf("%q does not carry the code", got)
	}
	if !strings.Contains(got, "from=login") {
		t.Errorf("%q lost the query it already had", got)
	}

	failed, err := NativeRedirectWithError("myapp://callback", "Authentication failed")
	if err != nil {
		t.Fatalf("NativeRedirectWithError: %v", err)
	}
	if !strings.Contains(failed, "error=Authentication+failed") &&
		!strings.Contains(failed, "error=Authentication%20failed") {
		t.Errorf("%q does not carry the message", failed)
	}
}
