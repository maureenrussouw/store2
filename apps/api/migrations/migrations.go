// Package migrations holds the SQL that AutoMigrate cannot write.
//
// Create a pair with `grit generate migration <name>`. Both halves are named
// <version>_<name>.up.sql and <version>_<name>.down.sql, and `grit migrate`
// applies the pending ones in version order after AutoMigrate.
//
// See README.md in this directory for the file format.
package migrations

import "embed"

// FS is every file in this directory, compiled into the binary.
//
// The pattern is * rather than *.sql because an embed pattern that matches
// nothing is a build error, and a project with no migrations yet has no .sql
// files at all. internal/migrate filters for the extension.
//
// Embedded rather than read from disk because the migrate binary runs in three
// places with three working directories: `grit migrate` runs it with go run
// from apps/api, the production compose file runs ./migrate inside a container
// where only the binary was copied, and somebody may run the built binary from
// anywhere at all. A relative path that works in one of those is a migration
// silently skipped in another, which is the worst way for a schema change to
// fail. Embedding also pins the checksum to the build: the SQL that ran is the
// SQL that was compiled in.
//
//go:embed *
var FS embed.FS
