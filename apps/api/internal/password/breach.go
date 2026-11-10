package password

import (
	"bufio"
	"context"
	"crypto/sha1" // #nosec G505 -- the range API this calls is defined over SHA-1; it is a lookup key here, never a password hash
	"encoding/hex"
	"io"
	"log"
	"net/http"
	"strings"
	"sync"
	"time"
)

// BreachAPI is the range endpoint. Only the first five characters of the hash
// are ever sent to it.
const BreachAPI = "https://api.pwnedpasswords.com/range/"

// breachTimeout bounds the call. A password form that hangs for ten seconds
// because somebody else's service is slow is worse than not checking at all,
// and this runs while a person waits on a submit button.
const breachTimeout = 2 * time.Second

var (
	breachMu      sync.RWMutex
	breachOn      bool
	breachBaseURL = BreachAPI
	breachClient  = &http.Client{Timeout: breachTimeout}
)

// SetBreachCheck turns the check on or off for the process. Off is the default.
func SetBreachCheck(enabled bool) {
	breachMu.Lock()
	defer breachMu.Unlock()
	breachOn = enabled
	if enabled {
		log.Println("password: breach checking is on; chosen passwords are checked against the public corpus")
	}
}

// BreachCheckEnabled reports whether the check is on, so a caller can tell the
// difference between "checked and clean" and "not checked".
func BreachCheckEnabled() bool {
	breachMu.RLock()
	defer breachMu.RUnlock()
	return breachOn
}

// Breached reports whether candidate appears in the public breach corpus.
//
// It answers false whenever it cannot get a definite yes: disabled, no network,
// a slow or broken endpoint, an unreadable response. That is a deliberate
// choice about which failure is worse. Failing closed would mean an outage at
// somebody else's service stops every registration and every password change
// here, which is a self-inflicted incident caused by an advisory check. Failing
// open means that during such an outage passwords are judged by the local rules
// alone, which is exactly where this feature started.
func Breached(ctx context.Context, candidate string) bool {
	breachMu.RLock()
	on, base, client := breachOn, breachBaseURL, breachClient
	breachMu.RUnlock()
	if !on || candidate == "" {
		return false
	}

	// k-anonymity: the password is hashed here, and only the first five
	// characters of that hash leave the process. The endpoint answers with
	// every suffix sharing that prefix, several hundred of them, and the
	// comparison happens locally. The service never learns which one was
	// asked about, and never sees the password.
	sum := sha1.Sum([]byte(candidate)) // #nosec G401 -- lookup key for the range API, not a password hash
	full := strings.ToUpper(hex.EncodeToString(sum[:]))
	prefix, suffix := full[:5], full[5:]

	ctx, cancel := context.WithTimeout(ctx, breachTimeout)
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, base+prefix, nil)
	if err != nil {
		log.Printf("password: breach check request for prefix %s: %v", prefix, err)
		return false
	}
	// Pads the response to a fixed size, so the number of results cannot be
	// inferred from the length of an observed response.
	req.Header.Set("Add-Padding", "true")

	resp, err := client.Do(req)
	if err != nil {
		log.Printf("password: breach check unavailable, allowing the password: %v", err)
		return false
	}
	defer func() {
		_, _ = io.Copy(io.Discard, resp.Body)
		_ = resp.Body.Close()
	}()

	if resp.StatusCode != http.StatusOK {
		log.Printf("password: breach check answered %d, allowing the password", resp.StatusCode)
		return false
	}

	scanner := bufio.NewScanner(resp.Body)
	for scanner.Scan() {
		line := scanner.Text()
		tail, count, ok := strings.Cut(line, ":")
		if !ok {
			continue
		}
		if !strings.EqualFold(strings.TrimSpace(tail), suffix) {
			continue
		}
		// A padded response includes entries with a count of zero, which are
		// filler rather than real matches.
		if strings.TrimSpace(count) == "0" {
			return false
		}
		return true
	}
	if err := scanner.Err(); err != nil {
		log.Printf("password: reading the breach response, allowing the password: %v", err)
	}
	return false
}

// BreachMessage is what to tell somebody whose password is on the list. It says
// what happened and what to do, and does not say how many times it appeared:
// that number is interesting to an engineer and alarming to everybody else.
const BreachMessage = "This password has appeared in a public data breach, so it is already on the lists attackers use. Please choose a different one."

// setBreachEndpoint points the check at another URL. Tests only.
func setBreachEndpoint(url string) func() {
	breachMu.Lock()
	previous := breachBaseURL
	breachBaseURL = url
	breachMu.Unlock()
	return func() {
		breachMu.Lock()
		breachBaseURL = previous
		breachMu.Unlock()
	}
}
