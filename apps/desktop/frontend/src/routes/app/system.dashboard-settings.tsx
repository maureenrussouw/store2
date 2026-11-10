import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Save } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { SectionCard } from "@/components/system-ui";
import { NAV_SECTIONS } from "@/lib/nav-config";
import { apiClient } from "@/lib/api-client";

export const Route = createFileRoute("/app/system/dashboard-settings")({
  component: SystemDashboardSettingsPage,
});

const STORAGE_KEY = "grit-dashboard-widgets";

const SECTIONS = [
  { key: "cards", label: "Stat cards", items: ["Users", "Events (24h)", "Notifications", "Sync status"] },
  { key: "charts", label: "Charts", items: ["Activity (7 days)", "Severity mix"] },
  { key: "feeds", label: "Feeds", items: ["Recent activity", "Quick access"] },
];

function resourceWidgets(): string[] {
  const manage = NAV_SECTIONS.find((s) => s.title === "Manage");
  return (manage?.items ?? []).map((i) => i.label);
}

function SystemDashboardSettingsPage() {
  const [enabled, setEnabled] = useState<Record<string, boolean>>({});
  const [saved, setSaved] = useState(false);

  const allWidgets = [...SECTIONS.flatMap((s) => s.items), ...resourceWidgets()];

  // biome-ignore lint/correctness/useExhaustiveDependencies: reads the saved layout once, on mount.
  useEffect(() => {
    let stored: Record<string, boolean> = {};
    try { stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"); } catch { /* ignore */ }
    const init: Record<string, boolean> = {};
    for (const w of allWidgets) init[w] = stored[w] !== false;
    setEnabled(init);
    // Best-effort server load (ignored offline).
    apiClient.get("/dashboard-layout").catch(() => undefined);
  }, []);

  const toggle = (w: string) => setEnabled((e) => ({ ...e, [w]: !e[w] }));

  const save = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(enabled));
    apiClient.put("/dashboard-layout", { widgets: enabled }).catch(() => undefined);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const renderGroup = (label: string, items: string[]) => (
    <SectionCard key={label} title={label}>
      <div className="divide-y divide-border">
        {items.map((w) => (
          <label key={w} className="flex cursor-pointer items-center justify-between px-5 py-3 text-[13px] text-foreground hover:bg-surface-hover">
            {w}
            <input type="checkbox" checked={enabled[w] ?? true} onChange={() => toggle(w)} className="h-4 w-4 accent-accent" />
          </label>
        ))}
      </div>
    </SectionCard>
  );

  return (
    <div>
      <PageHeader
        title="Dashboard settings"
        description="Choose which widgets appear on your dashboard"
        actions={
          <button onClick={save} className="flex items-center gap-2 rounded-lg bg-accent px-3 py-2 text-[13px] font-semibold text-white hover:bg-accent-hover">
            <Save className="h-4 w-4" /> {saved ? "Saved" : "Save"}
          </button>
        }
      />
      <div className="mt-6 space-y-4">
        {SECTIONS.map((s) => renderGroup(s.label, s.items))}
        {resourceWidgets().length > 0 && renderGroup("By resource", resourceWidgets())}
      </div>
    </div>
  );
}
