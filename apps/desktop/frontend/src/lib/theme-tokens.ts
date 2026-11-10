import { getTheme, type ThemeTokens } from "@repo/shared/themes";

// The theme chosen at scaffold time (grit new --theme=aurora). Overridable at
// runtime with VITE_THEME in the frontend env.
//
// NOTE: the shared defaultTheme export reads process.env.NEXT_PUBLIC_THEME,
// which doesn't exist under Vite — so resolve explicitly here.
const SCAFFOLD_THEME = "aurora";

export const activeTheme: ThemeTokens = getTheme(
  (import.meta.env.VITE_THEME as string | undefined) || SCAFFOLD_THEME,
);

export type ColorMode = "light" | "dark";

// themeCssVars maps the shared token bag onto the CSS variables declared in
// globals.css and consumed by tailwind.config.ts. Because every desktop
// surface (dashboard, settings, sidebar, topbar, generated resource
// screens) is already written against these variables, setting them here is
// all it takes for the whole app to adopt the theme.
//
// Light mode uses the theme's own palette verbatim, so it matches the admin
// panel. Dark mode keeps neutral dark surfaces — a desktop app gets used at
// night and a "dark" atlas would just be white — but adopts the theme's
// brand colours so the two modes read as one product.
export function themeCssVars(mode: ColorMode): Record<string, string> {
  const c = activeTheme.colors;

  const base: Record<string, string> = {
    "--accent": c.primary,
    "--accent-hover": c.accent,
    "--primary-fg": c.primaryFg,
    "--hero-bg": c.heroBg,
    "--hero-fg": c.heroFg,
    "--font-ui": activeTheme.fonts.ui,
    "--font-display": activeTheme.fonts.display,
    "--radius": activeTheme.radius,
  };

  if (mode === "light") {
    return {
      ...base,
      "--bg-primary": c.bg,
      "--bg-secondary": c.card,
      "--bg-tertiary": c.card,
      "--bg-elevated": c.bg,
      "--bg-hover": c.border,
      "--border": c.border,
      "--border-subtle": c.border,
      "--text-foreground": c.fg,
      "--text-secondary": c.muted,
      "--text-muted": c.muted,
    };
  }

  return {
    ...base,
    "--bg-primary": "#0a0a0f",
    "--bg-secondary": "#111118",
    "--bg-tertiary": "#1a1a24",
    "--bg-elevated": "#22222e",
    "--bg-hover": "#2a2a38",
    "--border": "#2a2a3a",
    "--border-subtle": "#1f1f2b",
    "--text-foreground": "#e8e8f0",
    "--text-secondary": "#9090a8",
    "--text-muted": "#606078",
  };
}

// applyThemeVars writes the variables onto <html>. Called by ThemeProvider
// whenever the light/dark mode changes.
export function applyThemeVars(mode: ColorMode): void {
  const root = document.documentElement;
  const vars = themeCssVars(mode);
  for (const key of Object.keys(vars)) {
    root.style.setProperty(key, vars[key]);
  }
}
