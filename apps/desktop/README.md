# store2 — Desktop

Native desktop app built with [Wails v2](https://wails.io). Shares the same
Go API (over HTTP) as the web app, admin panel, and mobile app in this monorepo.

## Prerequisites

- Go 1.26+ (the go.mod pins the exact patch release)
- pnpm 8+
- [Wails CLI](https://wails.io/docs/gettingstarted/installation): `go install github.com/wailsapp/wails/v2/cmd/wails@v2.16.0`

## Development

From the project root, make sure the API is running:

```bash
cd apps/api && go run cmd/server/main.go
```

Then start the desktop app:

```bash
cd apps/desktop
wails dev
```

This opens the app window with hot reload for both Go and React.

## Build

```bash
wails build
```

Outputs a native binary in `build/bin/`.

## Architecture

This desktop app is a **thin client** of the shared API. Unlike `grit new-desktop`
(standalone offline-first app), this app:

- Has NO embedded Go business logic
- Has NO local SQLite
- Calls the same API that the web/mobile apps call
- Uses OS keychain (via `99designs/keyring`) for secure JWT storage
- Uses Wails bindings only for native OS stuff (window controls, file dialogs, keychain)

See [GRIT_STYLE_GUIDE.md](../../GRIT_STYLE_GUIDE.md) §14.5 for desktop design patterns.
