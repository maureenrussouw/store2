import { Link } from "@tanstack/react-router";
import { BrandMark } from "./BrandMark";
import { authVars, switchLinks, type ShellProps } from "./AuthShell";

export function AuroraAuthShell({ theme, mode, title, subtitle, children, errorMessage }: ShellProps) {
  const t = theme.colors;
  const f = theme.fonts;
  const sw = switchLinks[mode];

  // Soft pastel wallpaper: two radial pulses over the heroBg token so the
  // card lifts off the background. Built with concatenation rather than a
  // template literal to stay inside the scaffold's raw strings.
  const wallpaper =
    "radial-gradient(60% 60% at 30% 20%, " + t.accent + "22, transparent 60%), " +
    "radial-gradient(50% 50% at 80% 80%, " + t.primary + "1a, transparent 60%), " +
    t.heroBg;

  return (
    <div
      className="flex min-h-full w-full items-center justify-center px-4 py-12"
      style={{
        fontFamily: f.ui,
        background: wallpaper,
        color: t.fg,
        ...authVars(theme),
      } as React.CSSProperties}
    >
      <div
        className="w-full max-w-md rounded-2xl border shadow-xl p-8 space-y-6"
        style={{ background: t.card, borderColor: t.border }}
      >
        <div className="flex flex-col items-center text-center space-y-3">
          <BrandMark tint={t.primary} fg={t.primaryFg} />
          <div>
            <h2 className="text-2xl font-bold" style={{ fontFamily: f.display }}>{title}</h2>
            {subtitle && <p className="mt-1 text-sm" style={{ color: t.muted }}>{subtitle}</p>}
          </div>
        </div>

        {errorMessage && (
          <div
            className="rounded-[var(--auth-radius)] border px-4 py-3 text-sm"
            style={{ borderColor: "#fecaca", background: "#fef2f2", color: "#b91c1c" }}
          >
            {errorMessage}
          </div>
        )}

        {children}

        <p className="text-center text-sm" style={{ color: t.muted }}>
          {sw.hint}{" "}
          <Link to={sw.to} className="font-medium" style={{ color: t.primary }}>
            {sw.label}
          </Link>
        </p>
      </div>
    </div>
  );
}
