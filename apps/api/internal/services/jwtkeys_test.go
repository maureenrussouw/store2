package services

import (
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"encoding/pem"
	"errors"
	"strings"
	"testing"
)

func rsaPEM(t *testing.T, bits int) (string, *rsa.PrivateKey) {
	t.Helper()
	key, err := rsa.GenerateKey(rand.Reader, bits)
	if err != nil {
		t.Fatalf("generating a key: %v", err)
	}
	block := &pem.Block{Type: "RSA PRIVATE KEY", Bytes: x509.MarshalPKCS1PrivateKey(key)}
	return string(pem.EncodeToMemory(block)), key
}

func publicPEM(t *testing.T, key *rsa.PrivateKey) string {
	t.Helper()
	der, err := x509.MarshalPKIXPublicKey(&key.PublicKey)
	if err != nil {
		t.Fatalf("marshalling the public key: %v", err)
	}
	return string(pem.EncodeToMemory(&pem.Block{Type: "PUBLIC KEY", Bytes: der}))
}

func TestDefaultsToSharedSecret(t *testing.T) {
	keys, err := LoadSigningKeys("a-secret-at-least-32-characters-long", "", "", "", "")
	if err != nil {
		t.Fatalf("loading: %v", err)
	}
	if keys.Algorithm != "HS256" {
		t.Fatalf("Algorithm = %q, want HS256 when no private key is set", keys.Algorithm)
	}
	// The whole point of the default: nothing is published, because the
	// verification key is the signing key.
	if got := len(keys.PublicJWKS().Keys); got != 0 {
		t.Fatalf("published %d keys on HS256; a shared secret must never be published", got)
	}
}

func TestSecretIsRequiredWithoutAPrivateKey(t *testing.T) {
	if _, err := LoadSigningKeys("", "", "", "", ""); err == nil {
		t.Fatal("loading with neither a secret nor a private key should fail rather than sign with nothing")
	}
}

func TestPrivateKeySwitchesToRS256AndPublishesOnlyThePublicHalf(t *testing.T) {
	private, key := rsaPEM(t, 2048)
	keys, err := LoadSigningKeys("", private, "", "https://auth.example.com", "example-api")
	if err != nil {
		t.Fatalf("loading: %v", err)
	}
	if keys.Algorithm != "RS256" {
		t.Fatalf("Algorithm = %q, want RS256", keys.Algorithm)
	}
	if keys.ValidMethods()[0] != "RS256" || len(keys.ValidMethods()) != 1 {
		t.Fatalf("ValidMethods = %v, want exactly [RS256]", keys.ValidMethods())
	}

	set := keys.PublicJWKS()
	if len(set.Keys) != 1 {
		t.Fatalf("published %d keys, want 1", len(set.Keys))
	}
	if set.Keys[0].Kid != keys.CurrentKID() {
		t.Fatal("the published kid must be the one tokens are signed with, or no verifier can match them")
	}
	if set.Keys[0].Kty != "RSA" || set.Keys[0].Use != "sig" || set.Keys[0].Alg != "RS256" {
		t.Fatalf("published key is not a signing RSA key: %+v", set.Keys[0])
	}
	// Nothing in the document may be derivable into a signing key.
	if set.Keys[0].N == "" || set.Keys[0].E == "" {
		t.Fatal("a published key needs its modulus and exponent to be usable")
	}
	_ = key
}

func TestShortKeysAreRefused(t *testing.T) {
	private, _ := rsaPEM(t, 1024)
	if _, err := LoadSigningKeys("", private, "", "", ""); err == nil {
		t.Fatal("a 1024 bit key should be refused rather than quietly accepted")
	}
}

// The property rotation exists for: tokens signed by the key being retired keep
// working until they expire, instead of everybody being signed out at once.
func TestRotationKeepsThePreviousKeyVerifiable(t *testing.T) {
	oldPrivate, oldKey := rsaPEM(t, 2048)
	newPrivate, _ := rsaPEM(t, 2048)

	before, err := LoadSigningKeys("", oldPrivate, "", "", "")
	if err != nil {
		t.Fatalf("loading the old key: %v", err)
	}
	oldKID := before.CurrentKID()

	after, err := LoadSigningKeys("", newPrivate, publicPEM(t, oldKey), "", "")
	if err != nil {
		t.Fatalf("loading after rotation: %v", err)
	}
	if after.CurrentKID() == oldKID {
		t.Fatal("a new key must get a new id, or verifiers cannot tell them apart")
	}
	if _, err := after.VerifyKey(oldKID); err != nil {
		t.Fatalf("the previous key must still verify during a rotation: %v", err)
	}
	if _, err := after.VerifyKey(after.CurrentKID()); err != nil {
		t.Fatalf("the current key must verify: %v", err)
	}
	if len(after.PublicJWKS().Keys) != 2 {
		t.Fatal("both keys must be published while a rotation is in flight")
	}
}

func TestUnknownKeyIsRefused(t *testing.T) {
	private, _ := rsaPEM(t, 2048)
	keys, err := LoadSigningKeys("", private, "", "", "")
	if err != nil {
		t.Fatalf("loading: %v", err)
	}
	if _, err := keys.VerifyKey("a-kid-from-somewhere-else"); !errors.Is(err, ErrNoVerificationKey) {
		t.Fatalf("err = %v, want ErrNoVerificationKey", err)
	}
}

// A path that does not resolve is the commonest mistake here, because the
// server runs from the API directory and a path that works from the project
// root does not. The error has to name the value and where it looked, or it
// surfaces as "invalid key: must be PEM encoded" and says nothing useful.
func TestUnreadableKeyPathSaysSo(t *testing.T) {
	_, err := LoadSigningKeys("", "config/keys/jwt-private.pem", "", "", "")
	if err == nil {
		t.Fatal("a path that cannot be read should fail")
	}
	for _, want := range []string{"JWT_PRIVATE_KEY", "config/keys/jwt-private.pem", "readable file"} {
		if !strings.Contains(err.Error(), want) {
			t.Errorf("error %q does not mention %q", err, want)
		}
	}
	if strings.Contains(err.Error(), "PEM encoded") {
		t.Errorf("a path mistake should not be reported as a PEM parse failure: %v", err)
	}
}

func TestInlineKeyWithEscapedNewlines(t *testing.T) {
	private, _ := rsaPEM(t, 2048)
	// How a PEM block survives most process managers.
	inline := ""
	for _, r := range private {
		if r == '\n' {
			inline += "\\n"
			continue
		}
		inline += string(r)
	}
	if _, err := LoadSigningKeys("", inline, "", "", ""); err != nil {
		t.Fatalf("a key with escaped newlines should load: %v", err)
	}
}
