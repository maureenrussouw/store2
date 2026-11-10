import type { ReactNode } from "react";
import { activeTheme } from "@/lib/theme-tokens";
import { AtlasAuthShell } from "./AtlasAuthShell";
import { AuroraAuthShell } from "./AuroraAuthShell";
import { PulseAuthShell } from "./PulseAuthShell";

export type AuthMode = "login" | "sign-up";

export interface AuthShellProps {
  mode: AuthMode;
  title: string;
  subtitle?: string;
  children: ReactNode;
  errorMessage?: string;
}

// AuthShell renders the layout the active theme was designed around:
//   atlas  -> split-static    (hero panel left, form right)
//   aurora -> centered        (single card on a pastel wallpaper)
//   pulse  -> split-carousel  (form left, editorial hero right)
//
// The five layouts added for the web admin in v3.322.0 map onto the closest of
// these three rather than being ported. A desktop window is not a browser tab:
// a modal over a blurred page, a footer of legal links and a full-bleed banner
// all assume a page you scrolled to. What carries over is the shape, so a
// theme still looks like itself here.
//
// This mapping is deliberate and written down. Falling through to the default
// would render Atlas for somebody who asked for Emerald, with nothing anywhere
// to say why.
export function AuthShell(props: AuthShellProps) {
  const theme = activeTheme;
  switch (theme.authLayout) {
    // One card, standing on its own.
    case "centered":
    case "modal":
    case "boxed":
    case "banner":
      return <AuroraAuthShell theme={theme} {...props} />;
    case "split-carousel":
      return <PulseAuthShell theme={theme} {...props} />;
    // A panel of something beside the form.
    case "showcase":
    case "quote":
    case "split-static":
    default:
      return <AtlasAuthShell theme={theme} {...props} />;
  }
}

// Shared prop contract for the three shells.
export interface ShellProps extends AuthShellProps {
  theme: typeof activeTheme;
}

// switchLinks maps the auth mode to its "other" page. Desktop routes are
// /auth/login and /auth/register (the admin uses /login and /sign-up).
export const switchLinks: Record<AuthMode, { hint: string; to: string; label: string }> = {
  login: { hint: "Don't have an account?", to: "/auth/register", label: "Create one" },
  "sign-up": { hint: "Already have an account?", to: "/auth/login", label: "Sign in" },
};

// authVars are the CSS variables the form inputs read, so one set of inputs
// fits every theme without per-shell styling.
export function authVars(theme: typeof activeTheme): Record<string, string> {
  const t = theme.colors;
  return {
    "--auth-bg": t.bg,
    "--auth-fg": t.fg,
    "--auth-card": t.card,
    "--auth-border": t.border,
    "--auth-muted": t.muted,
    "--auth-primary": t.primary,
    "--auth-primary-fg": t.primaryFg,
    "--auth-accent": t.accent,
    "--auth-radius": theme.radius,
  };
}
