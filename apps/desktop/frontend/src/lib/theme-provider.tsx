import { createContext, useContext, useEffect, useState } from "react";
import { activeTheme, applyThemeVars } from "@/lib/theme-tokens";

type Theme = "light" | "dark";

interface ThemeContextValue {
  /** Light/dark colour mode. */
  theme: Theme;
  setTheme: (theme: Theme) => void;
  /** The active brand theme (atlas | aurora | pulse) from @repo/shared. */
  tokens: typeof activeTheme;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "dark",
  setTheme: () => {},
  tokens: activeTheme,
});

export function useTheme() {
  return useContext(ThemeContext);
}

// ThemeProvider owns two orthogonal things:
//   1. the brand theme (atlas/aurora/pulse) — fixed at scaffold time, shared
//      with the admin panel via packages/shared/themes.ts
//   2. the light/dark colour mode — a desktop affordance the user toggles
//
// It writes both onto <html> as CSS variables, which every Tailwind colour
// utility in this app already reads. That's why changing the theme restyles
// the dashboard, settings, sidebar and generated resource screens without
// touching a single page.
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("grit-theme") as Theme | null;
      if (saved === "light" || saved === "dark") return saved;
    }
    // Light-first mirrors the admin panel, whose themes are light palettes.
    return "light";
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") root.classList.add("dark");
    else root.classList.remove("dark");
    applyThemeVars(theme);
    localStorage.setItem("grit-theme", theme);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme: setThemeState, tokens: activeTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
