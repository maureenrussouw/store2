import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { DataTable, type DataColumn } from "@/components/tables/data-table";
import { ResourceDrawer } from "@/components/resource-drawer";
import { useConfirm } from "@/components/confirm-dialog";
import { OrderLineForm } from "@/components/resource-forms/order-lines-form";
import {
  useOrderLines,
  useCreateOrderLine,
  useUpdateOrderLine,
  useDeleteOrderLine,
  type OrderLine,
} from "@/hooks/use-order-lines";
import { useOrders } from "@/hooks/use-orders";

export const Route = createFileRoute("/app/order_lines/")({
  component: OrderLinesPage,
});

const COLUMNS: DataColumn[] = [
  { key: "product", label: "Product", format: "text" },
  { key: "qty", label: "Qty", format: "text" },
  { key: "unit_price", label: "Unit Price", format: "text" },
  { key: "order_label", label: "Order", format: "text" },
  { key: "created_at", label: "Created", format: "relative" },
];

const SEARCH_KEYS = ["product"];

function OrderLinesPage() {
  const { data: items = [], isLoading } = useOrderLines();
  const create = useCreateOrderLine();
  const update = useUpdateOrderLine();
  const del = useDeleteOrderLine();
  const confirm = useConfirm();
  const [drawer, setDrawer] = useState<{ open: boolean; record: OrderLine | null }>({
    open: false,
    record: null,
  });

  const closeDrawer = () => setDrawer({ open: false, record: null });

  // Resolve belongs_to ids to the related record's name for the table.
  const orderMap = new Map((useOrders().data ?? []).map((o: any) => [String(o.id), String(o.name ?? o.title ?? ([o.first_name, o.last_name].filter(Boolean).join(" ") || o.email || o.id))]));
  const rows = items.map((r) => ({ ...r, order_label: orderMap.get(String((r as any).order_id)) ?? "" }));

  return (
    <div>
      <PageHeader title="Order Lines" description="Manage your order lines" />

      <div className="mt-6">
        <DataTable<OrderLine>
          title="Order Lines"
          singular="OrderLine"
          columns={COLUMNS}
          rows={rows}
          loading={isLoading}
          searchKeys={SEARCH_KEYS}
          onNew={() => setDrawer({ open: true, record: null })}
          onEdit={(row) => setDrawer({ open: true, record: row })}
          onDelete={async (row) => {
            if (await confirm({ title: "Delete orderline", message: "This will delete this orderline. This action cannot be undone.", danger: true, confirmLabel: "Delete" })) del.mutate(String(row.id));
          }}
          onBulkDelete={async (rows) => {
            if (await confirm({ title: "Delete orderlines", message: "Delete " + rows.length + " orderline(s)? This cannot be undone.", danger: true, confirmLabel: "Delete" })) rows.forEach((r) => { del.mutate(String(r.id)); });
          }}
          onImport={(records) => records.forEach((rec) => { create.mutate(rec); })}
        />
      </div>

      <ResourceDrawer
        open={drawer.open}
        title={drawer.record ? "Edit OrderLine" : "New OrderLine"}
        description={drawer.record ? "Update this orderline" : "Create a new orderline"}
        onClose={closeDrawer}
      >
        <OrderLineForm
          record={drawer.record}
          submitting={create.isPending || update.isPending}
          submitLabel={drawer.record ? "Save changes" : "Create OrderLine"}
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
