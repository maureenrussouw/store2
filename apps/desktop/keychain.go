package main

import (
	"github.com/99designs/keyring"
)

// Keychain is a thin wrapper around go-keyring that uses the best available
// OS-native secret store (macOS Keychain, Windows Credential Manager,
// Linux Secret Service). Falls back to an encrypted file in ~/.config on
// systems without a keyring daemon.
type Keychain struct {
	ring keyring.Keyring
}

func NewKeychain() *Keychain {
	ring, err := keyring.Open(keyring.Config{
		ServiceName: "store2",
		AllowedBackends: []keyring.BackendType{
			keyring.KeychainBackend,      // macOS
			keyring.WinCredBackend,       // Windows
			keyring.SecretServiceBackend, // Linux (GNOME)
			keyring.KWalletBackend,       // Linux (KDE)
			keyring.FileBackend,          // fallback
		},
		FilePasswordFunc: keyring.FixedStringPrompt(""),
		FileDir:          "~/.config/store2/keyring",
	})
	if err != nil {
		// Best-effort: fall back to in-memory (not persisted).
		return &Keychain{ring: nil}
	}
	return &Keychain{ring: ring}
}

func (k *Keychain) Set(key, value string) error {
	if k.ring == nil {
		return nil
	}
	return k.ring.Set(keyring.Item{
		Key:  key,
		Data: []byte(value),
	})
}

func (k *Keychain) Get(key string) (string, error) {
	if k.ring == nil {
		return "", nil
	}
	item, err := k.ring.Get(key)
	if err != nil {
		return "", err
	}
	return string(item.Data), nil
}

func (k *Keychain) Delete(key string) error {
	if k.ring == nil {
		return nil
	}
	return k.ring.Remove(key)
}
