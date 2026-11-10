import {
  Home,
  Box,
  RefreshCw,
  Users,
  Activity,
  MessageSquare,
  Bell,
  Shield,
  ShieldCheck,
  LayoutGrid,
  DatabaseBackup,
  type LucideIcon,
} from "lucide-react";

// Single source of truth for the desktop sidebar nav. Add new sections
// or items here; <Sidebar> reads this and renders grouped nav.
//
// A "section" is a logical cluster of related items (Properties,
// Operations, Admin, etc). The first section is rendered without a
// header so the dashboard / home item sits clean at the top.

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  badge?: string;
}

export interface NavSection {
  title?: string; // omit on the first section for the unbranded "main" group
  items: NavItem[];
}

export const NAV_SECTIONS: NavSection[] = [
  {
    items: [
      { to: "/app", label: "Dashboard", icon: Home },
    ],
  },
  {
    title: "Manage",
    items: [
      { to: "/app/system/users", label: "Users", icon: Users },
      // grit generate resource injects generated resources here. Box is a
      // shared icon so no per-resource import is needed.
      // grit:nav
    ],
  },
  {
    title: "Internal",
    items: [
      { to: "/app/system/activity", label: "Activity", icon: Activity },
      { to: "/app/system/support", label: "Support", icon: MessageSquare },
      { to: "/app/system/notifications", label: "Notifications", icon: Bell },
    ],
  },
  {
    // Only a few high-signal links live in the sidebar; the rest
    // (Performance, File Storage, Background Jobs, Cron, Dashboard settings)
    // are one click away from the System Hub.
    title: "System",
    items: [
      { to: "/app/system/health", label: "System Health", icon: Activity },
      { to: "/app/system/roles", label: "Roles & Permissions", icon: ShieldCheck },
      { to: "/app/system/security", label: "Security", icon: Shield },
      { to: "/app/system", label: "System Hub", icon: LayoutGrid },
    ],
  },
  {
    title: "Account",
    items: [
      { to: "/app/sync", label: "Sync", icon: RefreshCw },
      { to: "/app/data-backup", label: "Data & Backup", icon: DatabaseBackup },
    ],
  },
];

void Box;
