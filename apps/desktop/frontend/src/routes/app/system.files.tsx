import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { HardDrive, Image as ImageIcon, FileIcon, Film } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { SystemStat, EmptyState, relTime } from "@/components/system-ui";
import { apiClient } from "@/lib/api-client";

export const Route = createFileRoute("/app/system/files")({
  component: SystemFilesPage,
});

interface Upload {
  id: string; url: string; thumbnail_url?: string; original_name: string;
  mime_type: string; size: number; created_at: string;
}
interface Stats { total_count: number; total_size: number; by_kind?: { kind: string; count: number; size: number }[] }

function fmtBytes(n: number): string {
  if (!n) return "0 B";
  const u = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(n) / Math.log(1024));
  return (n / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1) + " " + u[i];
}

function SystemFilesPage() {
  const stats = useQuery<Stats>({
    queryKey: ["system", "file-stats"],
    queryFn: async () => {
      try { const { data } = await apiClient.get<{ data: Stats }>("/uploads/stats"); return data.data; }
      catch { return { total_count: 0, total_size: 0, by_kind: [] }; }
    },
    refetchInterval: 60_000,
  });
  const files = useQuery<Upload[]>({
    queryKey: ["system", "files"],
    queryFn: async () => {
      try { const { data } = await apiClient.get<{ data: Upload[] }>("/uploads?page_size=60"); return data.data ?? []; }
      catch { return []; }
    },
    refetchInterval: 60_000,
  });

  const images = stats.data?.by_kind?.find((k) => k.kind === "image")?.count ?? 0;
  const items = files.data ?? [];

  return (
    <div>
      <PageHeader title="File Storage" description="Everything uploaded across your app" />

      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-3">
        <SystemStat label="Total files" value={stats.data?.total_count ?? 0} icon={FileIcon} />
        <SystemStat label="Total size" value={fmtBytes(stats.data?.total_size ?? 0)} icon={HardDrive} tone="info" />
        <SystemStat label="Images" value={images} icon={ImageIcon} tone="success" />
      </div>

      <div className="mt-6 rounded-xl border border-border bg-surface">
        <header className="border-b border-border px-5 py-3.5">
          <p className="text-sm font-semibold text-foreground">Recent uploads</p>
          <p className="text-xs text-foreground-muted">{items.length} file{items.length === 1 ? "" : "s"}</p>
        </header>
        {files.isLoading ? (
          <div className="px-5 py-12 text-center text-[13px] text-foreground-muted">Loading…</div>
        ) : items.length === 0 ? (
          <EmptyState icon={HardDrive} title="No files yet." hint="Uploads from forms and profiles appear here." />
        ) : (
          <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {items.map((f) => {
              const isImg = f.mime_type?.startsWith("image/");
              const isVid = f.mime_type?.startsWith("video/");
              return (
                <a key={f.id} href={f.url} target="_blank" rel="noreferrer" className="group rounded-lg border border-border bg-surface-2 p-2 transition-colors hover:border-accent/40">
                  <div className="mb-2 flex aspect-square items-center justify-center overflow-hidden rounded-md bg-surface-3">
                    {isImg ? <img src={f.thumbnail_url || f.url} alt="" className="h-full w-full object-cover" />
                      : isVid ? <Film className="h-6 w-6 text-foreground-muted" />
                      : <FileIcon className="h-6 w-6 text-foreground-muted" />}
                  </div>
                  <p className="truncate text-[12px] text-foreground">{f.original_name}</p>
                  <p className="text-[11px] text-foreground-muted">{fmtBytes(f.size)} · {relTime(f.created_at)}</p>
                </a>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
