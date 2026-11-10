import { useEffect, useState } from "react";
import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, ChevronsUpDown, User, Settings, LogOut } from "lucide-react";
import { brand } from "@repo/shared/brand.config";
import { cn } from "@/lib/utils";
import { NAV_SECTIONS } from "@/lib/nav-config";
import { useMe, useLogout } from "@/hooks/use-auth";

export function Sidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("grit-sidebar-collapsed") === "1";
    }
    return false;
  });

  useEffect(() => {
    localStorage.setItem("grit-sidebar-collapsed", collapsed ? "1" : "0");
  }, [collapsed]);

  return (
    <aside
      // min-w-0 + overflow-hidden so the collapsed width (w-16) actually
      // takes effect — otherwise flexbox floors the item at its content's
      // min-content width and the collapse doesn't visibly shrink.
      className={cn(
        "shrink-0 min-w-0 overflow-hidden border-r border-border-subtle bg-surface flex flex-col transition-[width] duration-200",
        collapsed ? "w-16" : "w-sidebar",
      )}
    >
      {/* Brand + collapse toggle */}
      <div className="flex h-14 shrink-0 items-center gap-2 border-b border-border-subtle px-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-accent text-[13px] font-bold text-white">
          {brand.logo.text}
        </div>
        {!collapsed && (
          <span className="flex-1 truncate text-[14px] font-semibold text-foreground">{brand.name}</span>
        )}
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className={cn(
            "flex h-6 w-6 items-center justify-center rounded-md text-foreground-secondary hover:bg-surface-hover hover:text-foreground",
            collapsed && "mx-auto",
          )}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto p-3">
        {NAV_SECTIONS.filter((s) => s.items.length > 0).map((section, idx) => (
          <div key={idx} className={cn(idx > 0 && "mt-4")}>
            {section.title && !collapsed && (
              <h3 className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-wider text-foreground-muted">
                {section.title}
              </h3>
            )}
            {section.title && collapsed && idx > 0 && (
              <div className="my-2 mx-auto h-px w-6 bg-border-subtle" />
            )}
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const Icon = item.icon;
                const active =
                  pathname === item.to ||
                  (item.to !== "/app" && pathname.startsWith(item.to));
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    title={collapsed ? item.label : undefined}
                    className={cn(
                      "flex items-center gap-3 rounded-lg text-[13px] font-medium transition-colors",
                      collapsed ? "justify-center px-0 py-2" : "justify-between px-3 py-2",
                      active
                        ? "bg-accent/10 text-accent"
                        : "text-foreground-secondary hover:bg-surface-hover hover:text-foreground",
                    )}
                  >
                    <span className={cn("flex items-center gap-3 min-w-0", collapsed && "gap-0")}>
                      <Icon className="h-4 w-4 shrink-0" />
                      {!collapsed && <span className="truncate">{item.label}</span>}
                    </span>
                    {!collapsed && item.badge && (
                      <span className="shrink-0 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-accent/15 px-1.5 text-[10px] font-semibold text-accent">
                        {item.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <SidebarUserMenu collapsed={collapsed} />
    </aside>
  );
}

// SidebarUserMenu is the bottom-left account menu (mirrors the admin sidebar):
// avatar + name/email with a popover for Profile, Settings and Log out.
function SidebarUserMenu({ collapsed }: { collapsed: boolean }) {
  const { data: user } = useMe();
  const { mutate: logout } = useLogout();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const initial = user?.first_name?.charAt(0)?.toUpperCase() || "?";

  return (
    <div className="relative border-t border-border-subtle p-2">
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute bottom-full left-2 right-2 z-40 mb-1 overflow-hidden rounded-xl border border-border bg-surface-3 shadow-xl">
            <div className="border-b border-border-subtle px-3 py-2.5">
              <p className="truncate text-[13px] font-semibold text-foreground">{user?.first_name} {user?.last_name}</p>
              <p className="truncate text-[12px] text-foreground-muted">{user?.email}</p>
            </div>
            <div className="p-1">
              <button onClick={() => { setOpen(false); navigate({ to: "/app/profile" }); }} className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-[13px] text-foreground-secondary hover:bg-surface-hover hover:text-foreground">
                <User className="h-4 w-4" /> Profile
              </button>
              <button onClick={() => { setOpen(false); navigate({ to: "/app/settings" }); }} className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-[13px] text-foreground-secondary hover:bg-surface-hover hover:text-foreground">
                <Settings className="h-4 w-4" /> Settings
              </button>
              <button onClick={() => { setOpen(false); logout(undefined, { onSuccess: () => navigate({ to: "/auth/login" }) }); }} className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-[13px] text-danger hover:bg-danger/10">
                <LogOut className="h-4 w-4" /> Log out
              </button>
            </div>
          </div>
        </>
      )}
      <button
        onClick={() => setOpen((o) => !o)}
        title={collapsed ? (user?.email ?? "Account") : undefined}
        className={cn(
          "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-surface-hover",
          collapsed && "justify-center px-0",
        )}
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/20 text-[13px] font-semibold text-accent">{initial}</span>
        {!collapsed && (
          <>
            <span className="min-w-0 flex-1 text-left">
              <span className="block truncate text-[13px] font-medium text-foreground">{user?.first_name} {user?.last_name}</span>
              <span className="block truncate text-[11px] text-foreground-muted">{user?.email}</span>
            </span>
            <ChevronsUpDown className="h-4 w-4 shrink-0 text-foreground-muted" />
          </>
        )}
      </button>
    </div>
  );
}
