import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/page-header";
import { DataTable, type DataColumn } from "@/components/tables/data-table";
import { ResourceDrawer } from "@/components/resource-drawer";
import { useConfirm } from "@/components/confirm-dialog";
import { apiClient } from "@/lib/api-client";
import { PasswordStrength } from "@/components/password-strength";

export const Route = createFileRoute("/app/system/users")({
  component: SystemUsersPage,
});

type UserRow = Record<string, unknown> & { id: string };

const COLUMNS: DataColumn[] = [
  { key: "name", label: "Name", format: "text" },
  { key: "email", label: "Email", format: "email" },
  { key: "role", label: "Role", format: "badge" },
  { key: "active", label: "Active", format: "boolean" },
  { key: "created_at", label: "Created", format: "relative" },
];

const inputCls =
  "w-full rounded-lg border border-border bg-surface-2 px-4 py-2.5 text-[13px] text-foreground outline-none focus:border-accent focus:ring-1 focus:ring-accent";

function SystemUsersPage() {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [drawer, setDrawer] = useState<{ open: boolean; record: UserRow | null }>({ open: false, record: null });

  const { data = [], isLoading } = useQuery<UserRow[]>({
    queryKey: ["system", "users"],
    queryFn: async () => {
      try {
        const { data } = await apiClient.get<{ data: Record<string, unknown>[] }>("/users?page_size=200");
        return (data.data ?? []).map((u) => ({
          ...u,
          id: String(u.id),
          name: [u.first_name, u.last_name].filter(Boolean).join(" ") || String(u.email ?? ""),
        })) as UserRow[];
      } catch {
        return [];
      }
    },
    refetchInterval: 60_000,
  });

  const save = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      // role_id is ours, not a column on the user — pull it out before writing.
      const { role_id: roleID, ...body } = payload as { role_id?: string } & Record<string, unknown>;

      const res = drawer.record
        ? await apiClient.put("/users/" + drawer.record.id, body)
        : await apiClient.post("/users", body);

      // Bind the user to the role record itself. Without this a custom role is
      // only a string on the user and grants nothing.
      const userID = drawer.record?.id ?? (res.data as { data?: { id?: string } })?.data?.id;
      if (userID && roleID) {
        await apiClient.put("/users/" + userID + "/roles", { role_ids: [roleID] });
      }
      return res;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["system", "users"] }); setDrawer({ open: false, record: null }); },
  });
  const del = useMutation({
    mutationFn: (id: string) => apiClient.delete("/users/" + id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["system", "users"] }),
  });

  return (
    <div>
      <PageHeader title="Users" description="Accounts, roles and status" />
      <div className="mt-6">
        <DataTable<UserRow>
          title="Users"
          singular="User"
          columns={COLUMNS}
          rows={data}
          loading={isLoading}
          searchKeys={["name", "email", "role"]}
          onNew={() => setDrawer({ open: true, record: null })}
          onEdit={(row) => setDrawer({ open: true, record: row })}
          onDelete={async (row) => { if (await confirm({ title: "Delete user", message: "This will permanently delete this account.", danger: true, confirmLabel: "Delete" })) del.mutate(String(row.id)); }}
          onBulkDelete={async (rows) => { if (await confirm({ title: "Delete users", message: "Delete " + rows.length + " user(s)? This cannot be undone.", danger: true, confirmLabel: "Delete" })) for (const r of rows) del.mutate(String(r.id)); }}
        />
      </div>

      <ResourceDrawer
        open={drawer.open}
        title={drawer.record ? "Edit user" : "New user"}
        description={drawer.record ? "Update this account" : "Create a new account"}
        onClose={() => setDrawer({ open: false, record: null })}
      >
        <UserForm
          key={drawer.record?.id ?? "new"}
          record={drawer.record}
          submitting={save.isPending}
          onCancel={() => setDrawer({ open: false, record: null })}
          onSubmit={(payload) => save.mutate(payload)}
        />
      </ResourceDrawer>
    </div>
  );
}

function UserForm({
  record, submitting, onSubmit, onCancel,
}: { record: UserRow | null; submitting: boolean; onSubmit: (p: Record<string, unknown>) => void; onCancel: () => void }) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("USER");
  const [active, setActive] = useState(true);

  // Roles come from the API. This dropdown used to hardcode User/Editor/Admin,
  // so a role created on the Roles screen could never be assigned here.
  const { data: roles } = useQuery<{ id: string; name: string }[]>({
    queryKey: ["system", "roles", "options"],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: { id: string; name: string }[] }>("/roles");
      return data.data ?? [];
    },
  });

  useEffect(() => {
    setFirstName(String(record?.first_name ?? ""));
    setLastName(String(record?.last_name ?? ""));
    setEmail(String(record?.email ?? ""));
    setRole(String(record?.role ?? "USER"));
    setActive(record ? Boolean(record.active) : true);
    setPassword("");
  }, [record]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload: Record<string, unknown> = { first_name: firstName, last_name: lastName, email, role, active };
    if (password) payload.password = password;
    // role is the legacy string column; role_id binds the user to the role
    // record so custom roles actually grant their permissions.
    const picked = (roles ?? []).find((r) => r.name === role);
    if (picked) payload.role_id = picked.id;
    onSubmit(payload);
  };

  return (
    <form onSubmit={submit} className="flex h-full flex-col">
      <div className="flex-1 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-foreground">First name</label>
            <input value={firstName} onChange={(e) => setFirstName(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-foreground">Last name</label>
            <input value={lastName} onChange={(e) => setLastName(e.target.value)} className={inputCls} />
          </div>
        </div>
        <div>
          <label className="mb-1.5 block text-[13px] font-medium text-foreground">Email</label>
          <input type="email" autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className="mb-1.5 block text-[13px] font-medium text-foreground">
            Password {record && <span className="text-foreground-muted">(leave blank to keep)</span>}
          </label>
          <input type="password" autoComplete="new-password" aria-describedby="password-strength" value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls} />
          <PasswordStrength value={password} about={[email]} className="mt-2" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-foreground">Role</label>
            <select value={role} onChange={(e) => setRole(e.target.value)} className={inputCls}>
              {(roles ?? []).map((r) => (
                <option key={r.id} value={r.name}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>
          <label className="mt-6 flex items-center gap-2 text-[13px] text-foreground">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="h-4 w-4 accent-accent" />
            Active
          </label>
        </div>
      </div>
      <div className="mt-6 flex justify-end gap-3 border-t border-border pt-4">
        <button type="button" onClick={onCancel} className="rounded-lg border border-border px-4 py-2 text-[13px] font-medium text-foreground-secondary hover:bg-surface-hover">Cancel</button>
        <button type="submit" disabled={submitting || !email} className="rounded-lg bg-accent px-4 py-2 text-[13px] font-semibold text-white hover:bg-accent-hover disabled:opacity-50">
          {submitting ? "Saving…" : record ? "Save changes" : "Create user"}
        </button>
      </div>
    </form>
  );
}
