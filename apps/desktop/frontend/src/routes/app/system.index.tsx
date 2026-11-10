import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Activity, TrendingUp, Shield, Bell, MessageSquare, Settings,
  Users, HardDrive, Boxes, CalendarClock, type LucideIcon,
} from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";

export const Route = createFileRoute("/app/system/")({
  component: SystemHubPage,
});

const TILES: { to: string; title: string; description: string; icon: LucideIcon }[] = [
  { to: "/app/system/health", title: "System Health", description: "Database, cache, jobs & email status", icon: Activity },
  { to: "/app/system/performance", title: "Performance", description: "Latency, traffic, errors & saturation", icon: TrendingUp },
  { to: "/app/system/security", title: "Security", description: "Bans, rate limits & recent threats", icon: Shield },
  { to: "/app/system/files", title: "File Storage", description: "Everything uploaded across your app", icon: HardDrive },
  { to: "/app/system/jobs", title: "Background Jobs", description: "Async queue — email, images, cleanup", icon: Boxes },
  { to: "/app/system/cron", title: "Cron Schedules", description: "Recurring scheduled tasks", icon: CalendarClock },
  { to: "/app/system/activity", title: "User Activity", description: "Audit log across the platform", icon: Activity },
  { to: "/app/system/support", title: "Support", description: "Tickets & conversations", icon: MessageSquare },
  { to: "/app/system/notifications", title: "Notifications", description: "System & security alerts", icon: Bell },
  { to: "/app/system/users", title: "Users", description: "Manage accounts & roles", icon: Users },
  { to: "/app/system/dashboard-settings", title: "Dashboard settings", description: "Customize your dashboard widgets", icon: Settings },
];

function SystemHubPage() {
  return (
    <div>
      <PageHeader title="System" description="Operate, observe and administer your app." />
      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {TILES.map((t) => (
          <Link
            key={t.to}
            to={t.to}
            className="group rounded-xl border border-border bg-surface p-5 transition-colors hover:bg-surface-hover"
          >
            <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10 text-accent">
              <t.icon className="h-5 w-5" />
            </div>
            <p className="text-sm font-semibold text-foreground group-hover:text-accent">{t.title}</p>
            <p className="mt-0.5 text-[12px] text-foreground-muted">{t.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
