import type { Config } from "tailwindcss";

// GRIT_STYLE_GUIDE-aligned config, plus desktop-specific overrides
// (larger base padding, tighter focus rings, command palette tokens).
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        // Driven by the active theme (atlas: Inter, aurora: Geist,
        // pulse: Onest + DM Serif Display). See lib/theme-tokens.ts.
        sans: ["var(--font-ui)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "var(--font-ui)", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "monospace"],
      },
      colors: {
        // Grit purple
        primary: {
          50: "#F3F0FE",
          100: "#E6DFFD",
          200: "#CCC0FB",
          400: "#9B8BF5",
          500: "#7C6CE9",
          600: "#6C5CE7",
          700: "#5B4BD6",
          800: "#4A3DB5",
          900: "#3B2F8F",
        },
        // CSS variable bindings for runtime theming
        background: "var(--bg-primary)",
        surface: "var(--bg-secondary)",
        "surface-2": "var(--bg-tertiary)",
        "surface-3": "var(--bg-elevated)",
        // Every colour here is a CSS variable, and Tailwind 3 cannot apply an
        // opacity to a bare var(): it emits NO rule for bg-accent/10, so the
        // tint is simply absent and the class on the element does nothing.
        // color-mix with <alpha-value> makes the opacity variants real, and
        // works on a hex variable in WebView2 and WKWebView. See grit#126.
        "surface-hover": "color-mix(in srgb, var(--bg-hover) calc(<alpha-value> * 100%), transparent)",
        border: "color-mix(in srgb, var(--border) calc(<alpha-value> * 100%), transparent)",
        "border-subtle": "color-mix(in srgb, var(--border-subtle) calc(<alpha-value> * 100%), transparent)",
        foreground: "color-mix(in srgb, var(--text-foreground) calc(<alpha-value> * 100%), transparent)",
        "foreground-secondary": "color-mix(in srgb, var(--text-secondary) calc(<alpha-value> * 100%), transparent)",
        "foreground-muted": "color-mix(in srgb, var(--text-muted) calc(<alpha-value> * 100%), transparent)",
        accent: "color-mix(in srgb, var(--accent) calc(<alpha-value> * 100%), transparent)",
        "accent-hover": "color-mix(in srgb, var(--accent-hover) calc(<alpha-value> * 100%), transparent)",
        // The label on an accent fill. Used by button.tsx and form.tsx, and
        // never defined, so every primary button kept the inherited dark
        // text on a dark purple fill.
        "accent-fg": "var(--accent-fg)",
        success: "#059669",
        warning: "#D97706",
        danger: "#DC2626",
        info: "#2563EB",
      },
      boxShadow: {
        xs: "0 1px 2px 0 rgba(0, 0, 0, 0.3)",
        "focus": "0 0 0 2px rgba(108, 92, 231, 0.25)",
      },
      borderRadius: {
        // Each theme ships its own radius token (atlas .625rem, aurora .75rem,
        // pulse .5rem).
        DEFAULT: "var(--radius)",
      },
      spacing: {
        // Desktop uses larger padding than web — more breathing room
        "content": "2rem",     // 32px main content padding
        "sidebar": "15rem",    // 240px fixed sidebar
        "titlebar": "3rem",    // 48px custom title bar
        "listpane": "22rem",   // 352px list pane in TwoPane layout
      },
    },
  },
  plugins: [],
} satisfies Config;
