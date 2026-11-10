import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Shield, AlertCircle, AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { SystemStat, SectionCard, EmptyState, relTime } from "@/components/system-ui";
import { apiClient } from "@/lib/api-client";

export const Route = createFileRoute("/app/system/security")({
  component: SystemSecurityPage,
});

interface Summary {
  banned_ips_now: number; auto_bans_24h: number; rate_limited_last_hour: number;
  active_bans?: { ip: string; reason: string; level?: number; expires_at?: string }[];
  rate_limit_hits_5min?: { ip: string; hits: number; last_hit: string }[];
  recent_threats?: { id: string; type: string; ip: string; description: string; created_at: string }[];
}

const TIERS = ["1st offence · 5 hours", "2nd offence · 8 hours", "3rd offence · 24 hours", "4th+ offence · 7 days"];

function SystemSecurityPage() {
  const { data } = useQuery<Summary>({
    queryKey: ["system", "security"],
    queryFn: async () => {
      try {
        const { data } = await apiClient.get<{ data?: Summary } & Summary>("/admin/security/summary");
        return (data.data ?? data) as Summary;
      } catch { return { banned_ips_now: 0, auto_bans_24h: 0, rate_limited_last_hour: 0 }; }
    },
    refetchInterval: 60_000,
  });

  const bans = data?.active_bans ?? [];
  const limits = data?.rate_limit_hits_5min ?? [];
  const threats = data?.recent_threats ?? [];

  return (
    <div>
      <PageHeader title="Security" description="Bans, rate limits & recent threats" />

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SystemStat label="Banned IPs now" value={data?.banned_ips_now ?? 0} icon={Shield} tone={(data?.banned_ips_now ?? 0) > 0 ? "danger" : "default"} />
        <SystemStat label="Auto-bans (24h)" value={data?.auto_bans_24h ?? 0} icon={AlertCircle} tone={(data?.auto_bans_24h ?? 0) > 0 ? "warning" : "default"} />
        <SystemStat label="Rate-limited (1h)" value={data?.rate_limited_last_hour ?? 0} icon={AlertTriangle} tone={(data?.rate_limited_last_hour ?? 0) > 0 ? "warning" : "default"} />
      </div>

      <div className="mt-6 rounded-xl border border-border bg-surface p-5">
        <p className="text-sm font-semibold text-foreground">Escalating auto-ban policy</p>
        <p className="text-xs text-foreground-muted">Repeat offenders are banned for progressively longer.</p>
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {TIERS.map((t, i) => (
            <div key={i} className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-[12px] text-foreground-secondary">{t}</div>
          ))}
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SectionCard title="Active IP bans">
          {bans.length === 0 ? (
            <EmptyState icon={Shield} title="No active bans." />
          ) : (
            <ul className="divide-y divide-border">
              {bans.map((b, i) => (
                <li key={i} className="flex items-center justify-between px-5 py-3 text-[13px]">
                  <div className="min-w-0">
                    <p className="font-mono text-foreground">{b.ip}</p>
                    <p className="truncate text-[12px] text-foreground-muted">{b.reason}</p>
                  </div>
                  <div className="text-right">
                    {b.level != null && <span className="rounded-full bg-danger/10 px-2 py-0.5 text-[11px] text-danger">L{b.level}</span>}
                    {b.expires_at && <p className="mt-0.5 text-[11px] text-foreground-muted">{relTime(b.expires_at)}</p>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard title="Rate-limit hits" description="Last 5 minutes">
          {limits.length === 0 ? (
            <EmptyState icon={AlertTriangle} title="No rate-limit hits." />
          ) : (
            <ul className="divide-y divide-border">
              {limits.map((l, i) => (
                <li key={i} className="flex items-center justify-between px-5 py-3 text-[13px]">
                  <span className="font-mono text-foreground">{l.ip}</span>
                  <div className="text-right">
                    <span className="rounded-full bg-warning/10 px-2 py-0.5 text-[11px] text-warning">{l.hits} hits</span>
                    <p className="mt-0.5 text-[11px] text-foreground-muted">{relTime(l.last_hit)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>

      <div className="mt-4">
        <SectionCard title="Recent threats">
          {threats.length === 0 ? (
            <EmptyState icon={AlertTriangle} title="No threats detected." />
          ) : (
            <ul className="divide-y divide-border">
              {threats.map((t) => (
                <li key={t.id} className="px-5 py-3 text-[13px]">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-foreground">{t.type}</span>
                    <span className="text-[11px] text-foreground-muted">{relTime(t.created_at)}</span>
                  </div>
                  <p className="text-[12px] text-foreground-muted"><span className="font-mono">{t.ip}</span> · {t.description}</p>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
