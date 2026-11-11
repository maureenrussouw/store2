module store2/apps/desktop

go 1.26.10

require (
	github.com/99designs/keyring v1.2.2
	github.com/glebarez/sqlite v1.11.0
	github.com/google/uuid v1.6.0
	// Keep this in step with the CLI version the release workflow installs.
	// Wails warns on every build when the two differ, and for a long time
	// this said 2.9.2 while the current CLI was several minor versions ahead.
	github.com/wailsapp/wails/v2 v2.17.1
	gorm.io/gorm v1.31.1
)

// Wails asks for an older x/net than the API module pins. This is a separate
// module, so it needs the floor too: v0.58.0 and below carry GO-2026-6617,
// the HPACK encoder race, and three others, and v0.60.0 carries
// CVE-2026-78661 in x/net/html. One constant for both modules, because three
// literals that have to agree is how one of them gets left behind.
require golang.org/x/net v0.62.0 // indirect

// The keychain's own floor. Wails pulls 99designs/keyring, which pulls jose2go,
// and at v1.5.0 govulncheck traces GO-2025-4123 and GO-2023-2409 to
// desktop.Keychain.Get: both are reachable from the path that reads the
// signed-in user's token off their machine (grit#188). Denial of service rather
// than key disclosure, and it needs control of the keyring file, so it is not
// an emergency; it is also one line.
require github.com/dvsekhvalnov/jose2go v1.11.0 // indirect

require (
	git.sr.ht/~jackmordaunt/go-toast/v2 v2.0.3 // indirect
	github.com/99designs/go-keychain v0.0.0-20191008050251-8e49817e8af4 // indirect
	github.com/bep/debounce v1.2.1 // indirect
	github.com/danieljoos/wincred v1.1.2 // indirect
	github.com/dustin/go-humanize v1.0.1 // indirect
	github.com/gabriel-vasile/mimetype v1.4.16 // indirect
	github.com/glebarez/go-sqlite v1.21.2 // indirect
	github.com/go-ole/go-ole v1.3.0 // indirect
	github.com/godbus/dbus v0.0.0-20190726142602-4481cbc300e2 // indirect
	github.com/godbus/dbus/v5 v5.1.0 // indirect
	github.com/gorilla/websocket v1.5.3 // indirect
	github.com/gsterjov/go-libsecret v0.0.0-20161001094733-a6f4afe4910c // indirect
	github.com/jchv/go-winloader v0.0.0-20210711035445-715c2860da7e // indirect
	github.com/jinzhu/inflection v1.0.0 // indirect
	github.com/jinzhu/now v1.1.5 // indirect
	github.com/labstack/echo/v4 v4.16.1 // indirect
	github.com/labstack/gommon v0.5.0 // indirect
	github.com/leaanthony/go-ansi-parser v1.6.1 // indirect
	github.com/leaanthony/gosod v1.0.4 // indirect
	github.com/leaanthony/slicer v1.6.0 // indirect
	github.com/leaanthony/u v1.1.1 // indirect
	github.com/mattn/go-colorable v0.1.15 // indirect
	github.com/mattn/go-isatty v0.0.22 // indirect
	github.com/mtibben/percent v0.2.1 // indirect
	github.com/pkg/browser v0.0.0-20240102092130-5ac0b6a4141c // indirect
	github.com/pkg/errors v0.9.1 // indirect
	github.com/remyoudompheng/bigfft v0.0.0-20230129092748-24d4a6f8daec // indirect
	github.com/rivo/uniseg v0.4.7 // indirect
	github.com/samber/lo v1.49.1 // indirect
	github.com/tkrajina/go-reflector v0.5.8 // indirect
	github.com/valyala/bytebufferpool v1.0.0 // indirect
	github.com/valyala/fasttemplate v1.2.2 // indirect
	github.com/wailsapp/go-webview2 v1.0.22 // indirect
	golang.org/x/crypto v0.58.0 // indirect
	golang.org/x/sys v0.49.0 // indirect
	golang.org/x/term v0.47.0 // indirect
	golang.org/x/text v0.43.0 // indirect
	modernc.org/libc v1.22.5 // indirect
	modernc.org/mathutil v1.5.0 // indirect
	modernc.org/memory v1.5.0 // indirect
	modernc.org/sqlite v1.23.1 // indirect
)
