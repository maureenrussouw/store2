import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";

export interface Backup {
  id: string;
  kind: "SCHEDULED" | "WEEKLY" | "MANUAL" | "CLI";
  status: "RUNNING" | "READY" | "FAILED" | "PURGED";
  size_bytes: number;
  table_count: number;
  row_count: number;
  error?: string;
  created_at: string;
  completed_at?: string;
}

export type BackupFrequency = "daily" | "weekly" | "monthly" | "yearly";

export interface BackupSchedule {
  frequency: BackupFrequency;
  time: string; // "HH:MM"
  enabled: boolean;
}

// Poll every 3s while a backup is RUNNING, then go idle.
export function useBackups() {
  return useQuery<Backup[]>({
    queryKey: ["backups"],
    queryFn: async () => (await apiClient.get("/backups")).data.data ?? [],
    refetchInterval: (query) =>
      (query.state.data ?? []).some((b) => b.status === "RUNNING") ? 3000 : false,
  });
}

export function useGenerateBackup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => (await apiClient.post("/backups/generate")).data.data as Backup,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["backups"] }),
  });
}

// Mints a 15-minute pre-signed URL, then opens it so the OS downloads the file.
export function useDownloadBackup() {
  return useMutation({
    mutationFn: async (id: string) => (await apiClient.get(`/backups/${id}/download`)).data.data.url as string,
    onSuccess: (url) => { window.open(url, "_blank"); },
  });
}

export function useBackupSchedule() {
  return useQuery<BackupSchedule>({
    queryKey: ["backup-schedule"],
    queryFn: async () => (await apiClient.get("/backup-settings")).data.data,
  });
}

export function useUpdateBackupSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (s: BackupSchedule) => (await apiClient.put("/backup-settings", s)).data.data as BackupSchedule,
    onSuccess: (data) => qc.setQueryData(["backup-schedule"], data),
  });
}
