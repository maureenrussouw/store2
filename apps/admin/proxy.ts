import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_SESSION_COOKIE, API_SIGNED_IN_COOKIE } from "@/lib/admin-session";

// The pages a signed-out visitor is supposed to reach: the (auth) route
// group. Everything else in the panel needs a session.
//
// Keep this in step with app/(auth)/. A page missing from here is a page
// nobody can open, which is the one failure of this file that is not
// self-correcting, so there is a test on it: TestEveryAuthPageIsPublic in
// the framework's own suite derives this list from the panel's file map.
const PUBLIC_PATHS = [
  "/login",
  "/sign-up",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
  "/magic-link",
  "/callback",
];

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (isPublic(pathname)) return NextResponse.next();

  // Neither cookie is a credential, and neither is checked against anything.
  // They answer "has this browser signed in here?", which is enough to decide
  // whether to send the panel. Whether the session is still valid is the API's
  // answer, on every request, and the page asks it as soon as it mounts.
  if (
    request.cookies.has(ADMIN_SESSION_COOKIE) ||
    request.cookies.has(API_SIGNED_IN_COOKIE)
  ) {
    return NextResponse.next();
  }

  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  // Everything but Next's own output and anything with a file extension. The
  // login page's logo is served from public/, so it has to stay reachable
  // without a session or the page a stranger is sent to renders without it.
  // [.] rather than a backslash: this string is read by JavaScript before it
  // is read as a regex, so a single backslash here would be eaten and the
  // pattern would match any character where it means a dot. A character class
  // says the same thing and survives every layer it passes through.
  matcher: ["/((?!_next/|[^?]*[.][A-Za-z0-9]+$).*)"],
};
