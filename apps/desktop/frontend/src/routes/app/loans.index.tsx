import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { DataTable, type DataColumn } from "@/components/tables/data-table";
import { ResourceDrawer } from "@/components/resource-drawer";
import { useConfirm } from "@/components/confirm-dialog";
import { LoanForm } from "@/components/resource-forms/loans-form";
import {
  useLoans,
  useCreateLoan,
  useUpdateLoan,
  useDeleteLoan,
  type Loan,
} from "@/hooks/use-loans";
import { useCustomers } from "@/hooks/use-customers";

export const Route = createFileRoute("/app/loans/")({
  component: LoansPage,
});

const COLUMNS: DataColumn[] = [
  { key: "reference", label: "Reference", format: "text" },
  { key: "status", label: "Status", format: "text" },
  { key: "risk", label: "Risk", format: "text" },
  { key: "borrower_label", label: "Borrower", format: "text" },
  { key: "created_at", label: "Created", format: "relative" },
];

const SEARCH_KEYS = ["reference"];

function LoansPage() {
  const { data: items = [], isLoading } = useLoans();
  const create = useCreateLoan();
  const update = useUpdateLoan();
  const del = useDeleteLoan();
  const confirm = useConfirm();
  const [drawer, setDrawer] = useState<{ open: boolean; record: Loan | null }>({
    open: false,
    record: null,
  });

  const closeDrawer = () => setDrawer({ open: false, record: null });

  // Resolve belongs_to ids to the related record's name for the table.
  const borrowerMap = new Map((useCustomers().data ?? []).map((o: any) => [String(o.id), String(o.name ?? o.title ?? ([o.first_name, o.last_name].filter(Boolean).join(" ") || o.email || o.id))]));
  const rows = items.map((r) => ({ ...r, borrower_label: borrowerMap.get(String((r as any).borrower_id)) ?? "" }));

  return (
    <div>
      <PageHeader title="Loans" description="Manage your loans" />

      <div className="mt-6">
        <DataTable<Loan>
          title="Loans"
          singular="Loan"
          columns={COLUMNS}
          rows={rows}
          loading={isLoading}
          searchKeys={SEARCH_KEYS}
          onNew={() => setDrawer({ open: true, record: null })}
          onEdit={(row) => setDrawer({ open: true, record: row })}
          onDelete={async (row) => {
            if (await confirm({ title: "Delete loan", message: "This will delete this loan. This action cannot be undone.", danger: true, confirmLabel: "Delete" })) del.mutate(String(row.id));
          }}
          onBulkDelete={async (rows) => {
            if (await confirm({ title: "Delete loans", message: "Delete " + rows.length + " loan(s)? This cannot be undone.", danger: true, confirmLabel: "Delete" })) rows.forEach((r) => { del.mutate(String(r.id)); });
          }}
          onImport={(records) => records.forEach((rec) => { create.mutate(rec); })}
        />
      </div>

      <ResourceDrawer
        open={drawer.open}
        title={drawer.record ? "Edit Loan" : "New Loan"}
        description={drawer.record ? "Update this loan" : "Create a new loan"}
        onClose={closeDrawer}
      >
        <LoanForm
          record={drawer.record}
          submitting={create.isPending || update.isPending}
          submitLabel={drawer.record ? "Save changes" : "Create Loan"}
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
