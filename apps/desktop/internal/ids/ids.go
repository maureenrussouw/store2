// Package ids generates primary keys.
//
// ids.New() returns a UUIDv7: a standard 128-bit UUID any client can generate
// offline with no coordination, with a millisecond timestamp in the high bits
// so IDs sort chronologically and insert with good index locality.
//
// Trade-off: a v7 identifier encodes when it was created. If you expose raw IDs
// publicly you are also publishing creation times.
package ids

import "github.com/google/uuid"

// New returns a time-ordered UUIDv7 string.
//
// uuid.NewV7 only fails if the OS entropy source does, which is a situation
// where nothing else works either. It falls back to v4 rather than returning an
// error into every BeforeCreate hook: an unordered id is a performance
// regression, an empty primary key is data corruption.
func New() string {
	if u, err := uuid.NewV7(); err == nil {
		return u.String()
	}
	return uuid.New().String()
}
