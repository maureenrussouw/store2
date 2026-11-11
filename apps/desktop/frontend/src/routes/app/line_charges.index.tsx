import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { DataTable, type DataColumn } from "@/components/tables/data-table";
import { ResourceDrawer } from "@/components/resource-drawer";
import { useConfirm } from "@/components/confirm-dialog";
import { LineChargeForm } from "@/components/resource-forms/line-charges-form";
import {
  useLineCharges,
  useCreateLineCharge,
  useUpdateLineCharge,
  useDeleteLineCharge,
  type LineCharge,
} from "@/hooks/use-line-charges";
import { useSubscriptions } from "@/hooks/use-subscriptions";

export const Route = createFileRoute("/app/line_charges/")({
  component: LineChargesPage,
});

const COLUMNS: DataColumn[] = [
  { key: "description", label: "Description", format: "text" },
  { key: "qty", label: "Qty", format: "text" },
  { key: "unit_price", label: "Unit Price", format: "text" },
  { key: "subscription_label", label: "Subscription", format: "text" },
  { key: "created_at", label: "Created", format: "relative" },
];

const SEARCH_KEYS = ["description"];

function LineChargesPage() {
  const { data: items = [], isLoading } = useLineCharges();
  const create = useCreateLineCharge();
  const update = useUpdateLineCharge();
  const del = useDeleteLineCharge();
  const confirm = useConfirm();
  const [drawer, setDrawer] = useState<{ open: boolean; record: LineCharge | null }>({
    open: false,
    record: null,
  });

  const closeDrawer = () => setDrawer({ open: false, record: null });

  // Resolve belongs_to ids to the related record's name for the table.
  const subscriptionMap = new Map((useSubscriptions().data ?? []).map((o: any) => [String(o.id), String(o.name ?? o.title ?? ([o.first_name, o.last_name].filter(Boolean).join(" ") || o.email || o.id))]));
  const rows = items.map((r) => ({ ...r, subscription_label: subscriptionMap.get(String((r as any).subscription_id)) ?? "" }));

  return (
    <div>
      <PageHeader title="Line Charges" description="Manage your line charges" />

      <div className="mt-6">
        <DataTable<LineCharge>
          title="Line Charges"
          singular="LineCharge"
          columns={COLUMNS}
          rows={rows}
          loading={isLoading}
          searchKeys={SEARCH_KEYS}
          onNew={() => setDrawer({ open: true, record: null })}
          onEdit={(row) => setDrawer({ open: true, record: row })}
          onDelete={async (row) => {
            if (await confirm({ title: "Delete linecharge", message: "This will delete this linecharge. This action cannot be undone.", danger: true, confirmLabel: "Delete" })) del.mutate(String(row.id));
          }}
          onBulkDelete={async (rows) => {
            if (await confirm({ title: "Delete linecharges", message: "Delete " + rows.length + " linecharge(s)? This cannot be undone.", danger: true, confirmLabel: "Delete" })) rows.forEach((r) => { del.mutate(String(r.id)); });
          }}
          onImport={(records) => records.forEach((rec) => { create.mutate(rec); })}
        />
      </div>

      <ResourceDrawer
        open={drawer.open}
        title={drawer.record ? "Edit LineCharge" : "New LineCharge"}
        description={drawer.record ? "Update this linecharge" : "Create a new linecharge"}
        onClose={closeDrawer}
      >
        <LineChargeForm
          record={drawer.record}
          submitting={create.isPending || update.isPending}
          submitLabel={drawer.record ? "Save changes" : "Create LineCharge"}
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
