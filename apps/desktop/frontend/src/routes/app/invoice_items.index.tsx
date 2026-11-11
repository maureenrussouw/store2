import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { DataTable, type DataColumn } from "@/components/tables/data-table";
import { ResourceDrawer } from "@/components/resource-drawer";
import { useConfirm } from "@/components/confirm-dialog";
import { InvoiceItemForm } from "@/components/resource-forms/invoice-items-form";
import {
  useInvoiceItems,
  useCreateInvoiceItem,
  useUpdateInvoiceItem,
  useDeleteInvoiceItem,
  type InvoiceItem,
} from "@/hooks/use-invoice-items";
import { useInvoices } from "@/hooks/use-invoices";

export const Route = createFileRoute("/app/invoice_items/")({
  component: InvoiceItemsPage,
});

const COLUMNS: DataColumn[] = [
  { key: "description", label: "Description", format: "text" },
  { key: "qty", label: "Qty", format: "text" },
  { key: "unit_rate", label: "Unit Rate", format: "text" },
  { key: "invoice_label", label: "Invoice", format: "text" },
  { key: "created_at", label: "Created", format: "relative" },
];

const SEARCH_KEYS = ["description"];

function InvoiceItemsPage() {
  const { data: items = [], isLoading } = useInvoiceItems();
  const create = useCreateInvoiceItem();
  const update = useUpdateInvoiceItem();
  const del = useDeleteInvoiceItem();
  const confirm = useConfirm();
  const [drawer, setDrawer] = useState<{ open: boolean; record: InvoiceItem | null }>({
    open: false,
    record: null,
  });

  const closeDrawer = () => setDrawer({ open: false, record: null });

  // Resolve belongs_to ids to the related record's name for the table.
  const invoiceMap = new Map((useInvoices().data ?? []).map((o: any) => [String(o.id), String(o.name ?? o.title ?? ([o.first_name, o.last_name].filter(Boolean).join(" ") || o.email || o.id))]));
  const rows = items.map((r) => ({ ...r, invoice_label: invoiceMap.get(String((r as any).invoice_id)) ?? "" }));

  return (
    <div>
      <PageHeader title="Invoice Items" description="Manage your invoice items" />

      <div className="mt-6">
        <DataTable<InvoiceItem>
          title="Invoice Items"
          singular="InvoiceItem"
          columns={COLUMNS}
          rows={rows}
          loading={isLoading}
          searchKeys={SEARCH_KEYS}
          onNew={() => setDrawer({ open: true, record: null })}
          onEdit={(row) => setDrawer({ open: true, record: row })}
          onDelete={async (row) => {
            if (await confirm({ title: "Delete invoiceitem", message: "This will delete this invoiceitem. This action cannot be undone.", danger: true, confirmLabel: "Delete" })) del.mutate(String(row.id));
          }}
          onBulkDelete={async (rows) => {
            if (await confirm({ title: "Delete invoiceitems", message: "Delete " + rows.length + " invoiceitem(s)? This cannot be undone.", danger: true, confirmLabel: "Delete" })) rows.forEach((r) => { del.mutate(String(r.id)); });
          }}
          onImport={(records) => records.forEach((rec) => { create.mutate(rec); })}
        />
      </div>

      <ResourceDrawer
        open={drawer.open}
        title={drawer.record ? "Edit InvoiceItem" : "New InvoiceItem"}
        description={drawer.record ? "Update this invoiceitem" : "Create a new invoiceitem"}
        onClose={closeDrawer}
      >
        <InvoiceItemForm
          record={drawer.record}
          submitting={create.isPending || update.isPending}
          submitLabel={drawer.record ? "Save changes" : "Create InvoiceItem"}
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
