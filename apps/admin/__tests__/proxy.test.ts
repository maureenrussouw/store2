import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";

import { proxy } from "@/proxy";
import { ADMIN_SESSION_COOKIE, API_SIGNED_IN_COOKIE } from "@/lib/admin-session";

// request builds what Next hands the gate: a URL, and whichever cookies the
// browser would be carrying.
function request(pathname: string, cookies: string[] = []): NextRequest {
  const req = new NextRequest(new URL("http://localhost:3001" + pathname));
  for (const name of cookies) req.cookies.set(name, "1");
  return req;
}

// redirectTo is the Location a response sends the browser to, or null when it
// is letting the request through.
function redirectTo(response: Response): string | null {
  if (response.status < 300 || response.status >= 400) return null;
  const location = response.headers.get("location");
  return location ? new URL(location).pathname : null;
}

describe("the admin edge gate", () => {
  it("sends a signed-out visitor to the login page", () => {
    expect(redirectTo(proxy(request("/users")))).toBe("/login");
    expect(redirectTo(proxy(request("/")))).toBe("/login");
    expect(redirectTo(proxy(request("/settings/general")))).toBe("/login");
  });

  it("lets the pages a signed-out visitor needs through", () => {
    // A gate that redirects these is a redirect loop, and a loop reads as a
    // broken app rather than as a wrong list.
    for (const path of [
      "/login",
      "/sign-up",
      "/forgot-password",
      "/reset-password",
      "/verify-email",
      "/magic-link",
      "/callback",
    ]) {
      expect(redirectTo(proxy(request(path))), path).toBeNull();
    }
  });

  it("lets a sub-path of a public page through", () => {
    // /reset-password/<token> is one page with a segment, and matching the
    // exact path only would have redirected every reset link ever sent.
    expect(redirectTo(proxy(request("/reset-password/abc123")))).toBeNull();
  });

  it("lets a browser with either session marker through", () => {
    for (const cookie of [ADMIN_SESSION_COOKIE, API_SIGNED_IN_COOKIE]) {
      expect(redirectTo(proxy(request("/users", [cookie]))), cookie).toBeNull();
    }
  });

  it("drops the query string on the way to login", () => {
    // Whatever was on the URL belongs to the page the visitor could not open,
    // and carrying it onto /login puts it in their history and their logs.
    const response = proxy(request("/users?token=secret&page=2"));
    expect(response.headers.get("location")).toBe("http://localhost:3001/login");
  });
});
