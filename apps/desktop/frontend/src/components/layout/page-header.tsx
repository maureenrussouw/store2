import { useState } from "react";
import type { LucideIcon } from "lucide-react";
import { TrendingUp, TrendingDown, RefreshCw, Bell, Sun, Moon, User, Settings, LogOut } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useTheme } from "@/lib/theme-provider";
import { useMe, useLogout } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

export interface StatCard {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  color?: "default" | "success" | "warning" | "danger";
  trend?: { value: number; direction: "up" | "down" };
}

interface PageHeaderProps {
  title: string;
  description?: string;
  /** Page-specific primary action(s) — e.g. a "New X" button — shown inline
      in the action cluster (the "New" slot of refresh · theme · New · bell · user). */
  actions?: React.ReactNode;
  stats?: StatCard[];
}

// PageHeader owns the standard top-right action cluster on every page (matches
// the admin panel): refresh, theme switcher, [page action], notifications,
// user menu. Pages pass their primary CTA via the actions prop.
export function PageHeader({ title, description, actions, stats }: PageHeaderProps) {
  return (
    <div className="mb-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{title}</h1>
          {description && (
            <p className="mt-1 text-[14px] text-foreground-secondary">{description}</p>
          )}
        </div>
        <HeaderActions>{actions}</HeaderActions>
      </div>

      {stats && stats.length > 0 && (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat, i) => (
            <StatCardItem key={i} stat={stat} />
          ))}
        </div>
      )}
    </div>
  );
}

const iconBtn =
  "flex h-9 w-9 items-center justify-center rounded-lg text-foreground-secondary transition-colors hover:bg-surface-hover hover:text-foreground";

function HeaderActions({ children }: { children?: React.ReactNode }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const { data: user } = useMe();
  const { mutate: logout } = useLogout();
  const [spinning, setSpinning] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const refresh = () => {
    setSpinning(true);
    qc.invalidateQueries();
    setTimeout(() => setSpinning(false), 600);
  };

  return (
    <div className="flex shrink-0 items-center gap-1.5">
      <button onClick={refresh} className={iconBtn} title="Refresh" aria-label="Refresh">
        <RefreshCw className={cn("h-4 w-4", spinning && "animate-spin")} />
      </button>
      <button
        onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        className={iconBtn}
        title="Toggle theme"
        aria-label="Toggle theme"
      >
        {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </button>

      {children && <div className="mx-0.5 flex items-center gap-2">{children}</div>}

      <button
        onClick={() => navigate({ to: "/app/system/notifications" })}
        className={iconBtn}
        title="Notifications"
        aria-label="Notifications"
      >
        <Bell className="h-4 w-4" />
      </button>

      <div className="relative">
        <button
          onClick={() => setMenuOpen((o) => !o)}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/20 transition-colors hover:bg-accent/30"
          title="Account"
        >
          <span className="text-[13px] font-semibold text-accent">
            {user?.first_name?.charAt(0)?.toUpperCase() || "?"}
          </span>
        </button>
        {menuOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
            <div className="absolute right-0 top-full z-50 mt-2 w-60 overflow-hidden rounded-xl border border-border bg-surface-3 shadow-xl">
              <div className="border-b border-border-subtle px-4 py-3">
                <p className="text-[13px] font-semibold text-foreground">{user?.first_name} {user?.last_name}</p>
                <p className="truncate text-[12px] text-foreground-muted">{user?.email}</p>
              </div>
              <div className="p-1">
                <button onClick={() => { setMenuOpen(false); navigate({ to: "/app/profile" }); }} className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-[13px] text-foreground-secondary hover:bg-surface-hover hover:text-foreground">
                  <User className="h-4 w-4" /> Profile
                </button>
                <button onClick={() => { setMenuOpen(false); navigate({ to: "/app/settings" }); }} className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-[13px] text-foreground-secondary hover:bg-surface-hover hover:text-foreground">
                  <Settings className="h-4 w-4" /> Settings
                </button>
                <button onClick={() => { setMenuOpen(false); logout(undefined, { onSuccess: () => navigate({ to: "/auth/login" }) }); }} className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-[13px] text-danger hover:bg-danger/10">
                  <LogOut className="h-4 w-4" /> Log out
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const colorClasses: Record<string, { bg: string; text: string }> = {
  default: { bg: "bg-accent/10", text: "text-accent" },
  success: { bg: "bg-success/10", text: "text-success" },
  warning: { bg: "bg-warning/10", text: "text-warning" },
  danger: { bg: "bg-danger/10", text: "text-danger" },
};

function StatCardItem({ stat }: { stat: StatCard }) {
  const color = colorClasses[stat.color || "default"];
  const Icon = stat.icon;

  return (
    <div className="rounded-xl border border-border bg-surface p-5 transition-colors hover:border-foreground-muted/30">
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-foreground-muted">
            {stat.label}
          </p>
          <div className="mt-2 flex items-baseline gap-2">
            <p className="text-2xl font-bold text-foreground tabular-nums">
              {typeof stat.value === "number" ? stat.value.toLocaleString() : stat.value}
            </p>
            {stat.trend && (
              <span
                className={`flex items-center gap-0.5 text-xs font-medium ${
                  stat.trend.direction === "up" ? "text-success" : "text-danger"
                }`}
              >
                {stat.trend.direction === "up" ? (
                  <TrendingUp className="h-3 w-3" />
                ) : (
                  <TrendingDown className="h-3 w-3" />
                )}
                {stat.trend.value}%
              </span>
            )}
          </div>
        </div>
        {Icon && (
          <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${color.bg}`}>
            <Icon className={`h-4 w-4 ${color.text}`} />
          </div>
        )}
      </div>
    </div>
  );
}
