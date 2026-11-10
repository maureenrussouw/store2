package password

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
)

// The suffix of SHA-1("password"), whose full hash is
// 5BAA61E4C9B93F3F0682250B6CF8331B7EE68FD8.
const passwordSuffix = "1E4C9B93F3F0682250B6CF8331B7EE68FD8"

func TestBreachedIsOffByDefault(t *testing.T) {
	if BreachCheckEnabled() {
		t.Fatal("breach checking should be off until it is switched on")
	}
	if Breached(context.Background(), "password") {
		t.Fatal("a disabled check must not call out, and must answer false")
	}
}

func TestBreachedFindsAKnownPassword(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if got := r.Header.Get("Add-Padding"); got != "true" {
			t.Errorf("Add-Padding header = %q, want \"true\"", got)
		}
		// Only the prefix may be sent, never the whole hash.
		if len(r.URL.Path) != len("/")+5 {
			t.Errorf("path %q sent more than a five character prefix", r.URL.Path)
		}
		_, _ = w.Write([]byte("0000000000000000000000000000000000A:12\n" + passwordSuffix + ":37359195\n"))
	}))
	defer server.Close()
	defer setBreachEndpoint(server.URL + "/")()

	SetBreachCheck(true)
	defer SetBreachCheck(false)

	if !Breached(context.Background(), "password") {
		t.Fatal("a password present in the corpus should be reported as breached")
	}
	if Breached(context.Background(), "a-passphrase-that-is-not-in-the-list") {
		t.Fatal("a password absent from the response should not be reported as breached")
	}
}

func TestBreachedIgnoresPaddingEntries(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		// A padded response carries filler entries with a count of zero.
		_, _ = w.Write([]byte(passwordSuffix + ":0\n"))
	}))
	defer server.Close()
	defer setBreachEndpoint(server.URL + "/")()

	SetBreachCheck(true)
	defer SetBreachCheck(false)

	if Breached(context.Background(), "password") {
		t.Fatal("a zero count is padding, not a match")
	}
}

// The property the production path depends on: when the service is unavailable,
// a password change still works rather than every one of them failing.
func TestBreachedFailsOpen(t *testing.T) {
	cases := map[string]http.HandlerFunc{
		"server error": func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusInternalServerError) },
		"rate limited": func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusTooManyRequests) },
		"nonsense":     func(w http.ResponseWriter, _ *http.Request) { _, _ = w.Write([]byte("not a range response")) },
	}
	for name, handler := range cases {
		t.Run(name, func(t *testing.T) {
			server := httptest.NewServer(handler)
			defer server.Close()
			defer setBreachEndpoint(server.URL + "/")()

			SetBreachCheck(true)
			defer SetBreachCheck(false)

			if Breached(context.Background(), "password") {
				t.Fatal("an unusable answer must not block the password")
			}
		})
	}
}

func TestBreachedFailsOpenWhenNothingIsListening(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(http.ResponseWriter, *http.Request) {}))
	url := server.URL + "/"
	server.Close() // nothing is listening now
	defer setBreachEndpoint(url)()

	SetBreachCheck(true)
	defer SetBreachCheck(false)

	if Breached(context.Background(), "password") {
		t.Fatal("an unreachable endpoint must not block the password")
	}
}
