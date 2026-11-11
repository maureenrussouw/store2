import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { DataTable, type DataColumn } from "@/components/tables/data-table";
import { ResourceDrawer } from "@/components/resource-drawer";
import { useConfirm } from "@/components/confirm-dialog";
import { OrderForm } from "@/components/resource-forms/orders-form";
import {
  useOrders,
  useCreateOrder,
  useUpdateOrder,
  useDeleteOrder,
  type Order,
} from "@/hooks/use-orders";
import { useCustomers } from "@/hooks/use-customers";

export const Route = createFileRoute("/app/orders/")({
  component: OrdersPage,
});

const COLUMNS: DataColumn[] = [
  { key: "number", label: "Number", format: "text" },
  { key: "status", label: "Status", format: "text" },
  { key: "fulfillment", label: "Fulfillment", format: "text" },
  { key: "customer_label", label: "Customer", format: "text" },
  { key: "created_at", label: "Created", format: "relative" },
];

const SEARCH_KEYS = ["number"];

function OrdersPage() {
  const { data: items = [], isLoading } = useOrders();
  const create = useCreateOrder();
  const update = useUpdateOrder();
  const del = useDeleteOrder();
  const confirm = useConfirm();
  const [drawer, setDrawer] = useState<{ open: boolean; record: Order | null }>({
    open: false,
    record: null,
  });

  const closeDrawer = () => setDrawer({ open: false, record: null });

  // Resolve belongs_to ids to the related record's name for the table.
  const customerMap = new Map((useCustomers().data ?? []).map((o: any) => [String(o.id), String(o.name ?? o.title ?? ([o.first_name, o.last_name].filter(Boolean).join(" ") || o.email || o.id))]));
  const rows = items.map((r) => ({ ...r, customer_label: customerMap.get(String((r as any).customer_id)) ?? "" }));

  return (
    <div>
      <PageHeader title="Orders" description="Manage your orders" />

      <div className="mt-6">
        <DataTable<Order>
          title="Orders"
          singular="Order"
          columns={COLUMNS}
          rows={rows}
          loading={isLoading}
          searchKeys={SEARCH_KEYS}
          onNew={() => setDrawer({ open: true, record: null })}
          onEdit={(row) => setDrawer({ open: true, record: row })}
          onDelete={async (row) => {
            if (await confirm({ title: "Delete order", message: "This will delete this order. This action cannot be undone.", danger: true, confirmLabel: "Delete" })) del.mutate(String(row.id));
          }}
          onBulkDelete={async (rows) => {
            if (await confirm({ title: "Delete orders", message: "Delete " + rows.length + " order(s)? This cannot be undone.", danger: true, confirmLabel: "Delete" })) rows.forEach((r) => { del.mutate(String(r.id)); });
          }}
          onImport={(records) => records.forEach((rec) => { create.mutate(rec); })}
        />
      </div>

      <ResourceDrawer
        open={drawer.open}
        title={drawer.record ? "Edit Order" : "New Order"}
        description={drawer.record ? "Update this order" : "Create a new order"}
        onClose={closeDrawer}
      >
        <OrderForm
          record={drawer.record}
          submitting={create.isPending || update.isPending}
          submitLabel={drawer.record ? "Save changes" : "Create Order"}
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
