// grit_admin_session is a marker cookie, with no secret in it, written on
// the ADMIN origin whenever the API hands back a session. proxy.ts reads
// it to tell a signed-in browser from a stranger before any JavaScript runs.
//
// Why a cookie of our own when the API already sets grit_access? Because the
// API sets it on the API's origin. In development that is localhost:8080 and
// the browser does send it to localhost:3001, but an admin on its own domain
// with the API on another never sees it. A marker on this origin works in both
// shapes.
//
// It is not a credential. Anyone can write it from the console, and all that
// buys them is the HTML of a panel whose every request the API refuses. The
// session itself is the HttpOnly pair the API sets, which JavaScript cannot
// read and this file never touches.

export const ADMIN_SESSION_COOKIE = "grit_admin_session";

// Set by the API beside its session cookies. Only arrives when the API shares
// this app's host; proxy.ts accepts it as well so an already-signed-in
// browser is not sent to the login page the first time it loads a panel that
// has just gained this gate.
export const API_SIGNED_IN_COOKIE = "grit_signed_in";

// Seven days, which is the refresh window. The cookie outliving the session is
// harmless: the page loads, /api/auth/me answers 401, and the clear below runs.
const MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

export function setAdminSession(): void {
  if (typeof document === "undefined") return;
  const secure =
    typeof location !== "undefined" && location.protocol === "https:" ? "; Secure" : "";
  document.cookie =
    ADMIN_SESSION_COOKIE +
    "=1; Path=/; Max-Age=" +
    MAX_AGE_SECONDS +
    "; SameSite=Lax" +
    secure;
}

export function clearAdminSession(): void {
  if (typeof document === "undefined") return;
  document.cookie = ADMIN_SESSION_COOKIE + "=; Path=/; Max-Age=0; SameSite=Lax";
}

export function hasAdminSession(): boolean {
  if (typeof document === "undefined") return false;
  return document.cookie
    .split("; ")
    .some((c) => c.startsWith(ADMIN_SESSION_COOKIE + "="));
}
