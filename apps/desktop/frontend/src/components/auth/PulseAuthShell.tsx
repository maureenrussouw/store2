import { Link } from "@tanstack/react-router";
import { brand } from "@repo/shared/brand.config";
import { BrandMark } from "./BrandMark";
import { authVars, switchLinks, type ShellProps } from "./AuthShell";

export function PulseAuthShell({ theme, mode, title, subtitle, children, errorMessage }: ShellProps) {
  const t = theme.colors;
  const f = theme.fonts;
  const sw = switchLinks[mode];

  return (
    <div
      className="flex min-h-full w-full"
      style={{
        fontFamily: f.ui,
        background: t.bg,
        color: t.fg,
        ...authVars(theme),
      } as React.CSSProperties}
    >
      {/* Left form panel */}
      <div className="flex flex-1 items-center justify-center px-6 py-12 lg:px-12">
        <div className="w-full max-w-md space-y-8">
          <div className="flex items-center gap-2 text-xl font-bold" style={{ color: t.fg }}>
            <BrandMark tint={t.primary} fg={t.primaryFg} />
            <span style={{ fontFamily: f.display }}>{brand.name}</span>
          </div>

          <div>
            <h2 className="text-3xl font-bold" style={{ fontFamily: f.display }}>{title}</h2>
            {subtitle && <p className="mt-2" style={{ color: t.muted }}>{subtitle}</p>}
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

          <p className="text-sm" style={{ color: t.muted }}>
            {sw.hint}{" "}
            <Link to={sw.to} className="font-medium underline" style={{ color: t.fg }}>
              {sw.label}
            </Link>
          </p>
        </div>
      </div>

      {/* Right editorial hero */}
      <div
        className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12"
        style={{ background: t.heroBg, color: t.heroFg }}
      >
        <span
          className="self-end rounded-full px-3 py-1 text-xs font-semibold"
          style={{ background: t.accent, color: t.fg }}
        >
          {brand.name}
        </span>

        <div className="space-y-6 max-w-md">
          <h1
            className="text-5xl leading-[1.05] whitespace-pre-line"
            style={{ fontFamily: f.display }}
          >
            {brand.tagline}
          </h1>
          <p className="text-lg opacity-70">{brand.description}</p>
          <div className="h-1 w-24 rounded-full" style={{ background: t.accent }} />
        </div>

        <p className="text-sm opacity-50">Built with Grit: Go + React framework</p>
      </div>
    </div>
  );
}
