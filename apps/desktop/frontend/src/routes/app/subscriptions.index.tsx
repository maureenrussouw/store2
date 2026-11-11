import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { DataTable, type DataColumn } from "@/components/tables/data-table";
import { ResourceDrawer } from "@/components/resource-drawer";
import { useConfirm } from "@/components/confirm-dialog";
import { SubscriptionForm } from "@/components/resource-forms/subscriptions-form";
import {
  useSubscriptions,
  useCreateSubscription,
  useUpdateSubscription,
  useDeleteSubscription,
  type Subscription,
} from "@/hooks/use-subscriptions";
import { useCustomers } from "@/hooks/use-customers";

export const Route = createFileRoute("/app/subscriptions/")({
  component: SubscriptionsPage,
});

const COLUMNS: DataColumn[] = [
  { key: "plan", label: "Plan", format: "text" },
  { key: "status", label: "Status", format: "text" },
  { key: "auto_renew", label: "Auto Renew", format: "text" },
  { key: "customer_label", label: "Customer", format: "text" },
  { key: "created_at", label: "Created", format: "relative" },
];

const SEARCH_KEYS = ["id"];

function SubscriptionsPage() {
  const { data: items = [], isLoading } = useSubscriptions();
  const create = useCreateSubscription();
  const update = useUpdateSubscription();
  const del = useDeleteSubscription();
  const confirm = useConfirm();
  const [drawer, setDrawer] = useState<{ open: boolean; record: Subscription | null }>({
    open: false,
    record: null,
  });

  const closeDrawer = () => setDrawer({ open: false, record: null });

  // Resolve belongs_to ids to the related record's name for the table.
  const customerMap = new Map((useCustomers().data ?? []).map((o: any) => [String(o.id), String(o.name ?? o.title ?? ([o.first_name, o.last_name].filter(Boolean).join(" ") || o.email || o.id))]));
  const rows = items.map((r) => ({ ...r, customer_label: customerMap.get(String((r as any).customer_id)) ?? "" }));

  return (
    <div>
      <PageHeader title="Subscriptions" description="Manage your subscriptions" />

      <div className="mt-6">
        <DataTable<Subscription>
          title="Subscriptions"
          singular="Subscription"
          columns={COLUMNS}
          rows={rows}
          loading={isLoading}
          searchKeys={SEARCH_KEYS}
          onNew={() => setDrawer({ open: true, record: null })}
          onEdit={(row) => setDrawer({ open: true, record: row })}
          onDelete={async (row) => {
            if (await confirm({ title: "Delete subscription", message: "This will delete this subscription. This action cannot be undone.", danger: true, confirmLabel: "Delete" })) del.mutate(String(row.id));
          }}
          onBulkDelete={async (rows) => {
            if (await confirm({ title: "Delete subscriptions", message: "Delete " + rows.length + " subscription(s)? This cannot be undone.", danger: true, confirmLabel: "Delete" })) rows.forEach((r) => { del.mutate(String(r.id)); });
          }}
          onImport={(records) => records.forEach((rec) => { create.mutate(rec); })}
        />
      </div>

      <ResourceDrawer
        open={drawer.open}
        title={drawer.record ? "Edit Subscription" : "New Subscription"}
        description={drawer.record ? "Update this subscription" : "Create a new subscription"}
        onClose={closeDrawer}
      >
        <SubscriptionForm
          record={drawer.record}
          submitting={create.isPending || update.isPending}
          submitLabel={drawer.record ? "Save changes" : "Create Subscription"}
          onCancel={closeDrawer}
          onSubmit={async (values) => {
            if (drawer.record) {
              await update.mutateAsync({ id: String(drawer.record.id), data: values });
            } else {
              await create.mutateAsync(values);
            }
            closeDrawer();
          }}
        />
      </ResourceDrawer>
    </div>
  );
}
