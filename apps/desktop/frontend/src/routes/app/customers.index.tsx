import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { DataTable, type DataColumn } from "@/components/tables/data-table";
import { ResourceDrawer } from "@/components/resource-drawer";
import { useConfirm } from "@/components/confirm-dialog";
import { CustomerForm } from "@/components/resource-forms/customers-form";
import {
  useCustomers,
  useCreateCustomer,
  useUpdateCustomer,
  useDeleteCustomer,
  type Customer,
} from "@/hooks/use-customers";

export const Route = createFileRoute("/app/customers/")({
  component: CustomersPage,
});

const COLUMNS: DataColumn[] = [
  { key: "name", label: "Name", format: "text" },
  { key: "email", label: "Email", format: "text" },
  { key: "company", label: "Company", format: "text" },
  { key: "created_at", label: "Created", format: "relative" },
];

const SEARCH_KEYS = ["name", "email", "company"];

function CustomersPage() {
  const { data: items = [], isLoading } = useCustomers();
  const create = useCreateCustomer();
  const update = useUpdateCustomer();
  const del = useDeleteCustomer();
  const confirm = useConfirm();
  const [drawer, setDrawer] = useState<{ open: boolean; record: Customer | null }>({
    open: false,
    record: null,
  });

  const closeDrawer = () => setDrawer({ open: false, record: null });

  // Resolve belongs_to ids to the related record's name for the table.
  const rows = items;

  return (
    <div>
      <PageHeader title="Customers" description="Manage your customers" />

      <div className="mt-6">
        <DataTable<Customer>
          title="Customers"
          singular="Customer"
          columns={COLUMNS}
          rows={rows}
          loading={isLoading}
          searchKeys={SEARCH_KEYS}
          onNew={() => setDrawer({ open: true, record: null })}
          onEdit={(row) => setDrawer({ open: true, record: row })}
          onDelete={async (row) => {
            if (await confirm({ title: "Delete customer", message: "This will delete this customer. This action cannot be undone.", danger: true, confirmLabel: "Delete" })) del.mutate(String(row.id));
          }}
          onBulkDelete={async (rows) => {
            if (await confirm({ title: "Delete customers", message: "Delete " + rows.length + " customer(s)? This cannot be undone.", danger: true, confirmLabel: "Delete" })) rows.forEach((r) => { del.mutate(String(r.id)); });
          }}
          onImport={(records) => records.forEach((rec) => { create.mutate(rec); })}
        />
      </div>

      <ResourceDrawer
        open={drawer.open}
        title={drawer.record ? "Edit Customer" : "New Customer"}
        description={drawer.record ? "Update this customer" : "Create a new customer"}
        onClose={closeDrawer}
      >
        <CustomerForm
          record={drawer.record}
          submitting={create.isPending || update.isPending}
          submitLabel={drawer.record ? "Save changes" : "Create Customer"}
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
