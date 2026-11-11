import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { DataTable, type DataColumn } from "@/components/tables/data-table";
import { ResourceDrawer } from "@/components/resource-drawer";
import { useConfirm } from "@/components/confirm-dialog";
import { RepaymentForm } from "@/components/resource-forms/repayments-form";
import {
  useRepayments,
  useCreateRepayment,
  useUpdateRepayment,
  useDeleteRepayment,
  type Repayment,
} from "@/hooks/use-repayments";
import { useLoans } from "@/hooks/use-loans";

export const Route = createFileRoute("/app/repayments/")({
  component: RepaymentsPage,
});

const COLUMNS: DataColumn[] = [
  { key: "due_date", label: "Due Date", format: "date" },
  { key: "amount", label: "Amount", format: "text" },
  { key: "paid", label: "Paid", format: "text" },
  { key: "loan_label", label: "Loan", format: "text" },
  { key: "created_at", label: "Created", format: "relative" },
];

const SEARCH_KEYS = ["id"];

function RepaymentsPage() {
  const { data: items = [], isLoading } = useRepayments();
  const create = useCreateRepayment();
  const update = useUpdateRepayment();
  const del = useDeleteRepayment();
  const confirm = useConfirm();
  const [drawer, setDrawer] = useState<{ open: boolean; record: Repayment | null }>({
    open: false,
    record: null,
  });

  const closeDrawer = () => setDrawer({ open: false, record: null });

  // Resolve belongs_to ids to the related record's name for the table.
  const loanMap = new Map((useLoans().data ?? []).map((o: any) => [String(o.id), String(o.name ?? o.title ?? ([o.first_name, o.last_name].filter(Boolean).join(" ") || o.email || o.id))]));
  const rows = items.map((r) => ({ ...r, loan_label: loanMap.get(String((r as any).loan_id)) ?? "" }));

  return (
    <div>
      <PageHeader title="Repayments" description="Manage your repayments" />

      <div className="mt-6">
        <DataTable<Repayment>
          title="Repayments"
          singular="Repayment"
          columns={COLUMNS}
          rows={rows}
          loading={isLoading}
          searchKeys={SEARCH_KEYS}
          onNew={() => setDrawer({ open: true, record: null })}
          onEdit={(row) => setDrawer({ open: true, record: row })}
          onDelete={async (row) => {
            if (await confirm({ title: "Delete repayment", message: "This will delete this repayment. This action cannot be undone.", danger: true, confirmLabel: "Delete" })) del.mutate(String(row.id));
          }}
          onBulkDelete={async (rows) => {
            if (await confirm({ title: "Delete repayments", message: "Delete " + rows.length + " repayment(s)? This cannot be undone.", danger: true, confirmLabel: "Delete" })) rows.forEach((r) => { del.mutate(String(r.id)); });
          }}
          onImport={(records) => records.forEach((rec) => { create.mutate(rec); })}
        />
      </div>

      <ResourceDrawer
        open={drawer.open}
        title={drawer.record ? "Edit Repayment" : "New Repayment"}
        description={drawer.record ? "Update this repayment" : "Create a new repayment"}
        onClose={closeDrawer}
      >
        <RepaymentForm
          record={drawer.record}
          submitting={create.isPending || update.isPending}
          submitLabel={drawer.record ? "Save changes" : "Create Repayment"}
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
