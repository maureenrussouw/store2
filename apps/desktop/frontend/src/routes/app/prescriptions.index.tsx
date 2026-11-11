import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { DataTable, type DataColumn } from "@/components/tables/data-table";
import { ResourceDrawer } from "@/components/resource-drawer";
import { useConfirm } from "@/components/confirm-dialog";
import { PrescriptionForm } from "@/components/resource-forms/prescriptions-form";
import {
  usePrescriptions,
  useCreatePrescription,
  useUpdatePrescription,
  useDeletePrescription,
  type Prescription,
} from "@/hooks/use-prescriptions";
import { useCustomers } from "@/hooks/use-customers";

export const Route = createFileRoute("/app/prescriptions/")({
  component: PrescriptionsPage,
});

const COLUMNS: DataColumn[] = [
  { key: "code", label: "Code", format: "text" },
  { key: "status", label: "Status", format: "text" },
  { key: "priority", label: "Priority", format: "text" },
  { key: "patient_label", label: "Patient", format: "text" },
  { key: "created_at", label: "Created", format: "relative" },
];

const SEARCH_KEYS = ["code"];

function PrescriptionsPage() {
  const { data: items = [], isLoading } = usePrescriptions();
  const create = useCreatePrescription();
  const update = useUpdatePrescription();
  const del = useDeletePrescription();
  const confirm = useConfirm();
  const [drawer, setDrawer] = useState<{ open: boolean; record: Prescription | null }>({
    open: false,
    record: null,
  });

  const closeDrawer = () => setDrawer({ open: false, record: null });

  // Resolve belongs_to ids to the related record's name for the table.
  const patientMap = new Map((useCustomers().data ?? []).map((o: any) => [String(o.id), String(o.name ?? o.title ?? ([o.first_name, o.last_name].filter(Boolean).join(" ") || o.email || o.id))]));
  const rows = items.map((r) => ({ ...r, patient_label: patientMap.get(String((r as any).patient_id)) ?? "" }));

  return (
    <div>
      <PageHeader title="Prescriptions" description="Manage your prescriptions" />

      <div className="mt-6">
        <DataTable<Prescription>
          title="Prescriptions"
          singular="Prescription"
          columns={COLUMNS}
          rows={rows}
          loading={isLoading}
          searchKeys={SEARCH_KEYS}
          onNew={() => setDrawer({ open: true, record: null })}
          onEdit={(row) => setDrawer({ open: true, record: row })}
          onDelete={async (row) => {
            if (await confirm({ title: "Delete prescription", message: "This will delete this prescription. This action cannot be undone.", danger: true, confirmLabel: "Delete" })) del.mutate(String(row.id));
          }}
          onBulkDelete={async (rows) => {
            if (await confirm({ title: "Delete prescriptions", message: "Delete " + rows.length + " prescription(s)? This cannot be undone.", danger: true, confirmLabel: "Delete" })) rows.forEach((r) => { del.mutate(String(r.id)); });
          }}
          onImport={(records) => records.forEach((rec) => { create.mutate(rec); })}
        />
      </div>

      <ResourceDrawer
        open={drawer.open}
        title={drawer.record ? "Edit Prescription" : "New Prescription"}
        description={drawer.record ? "Update this prescription" : "Create a new prescription"}
        onClose={closeDrawer}
      >
        <PrescriptionForm
          record={drawer.record}
          submitting={create.isPending || update.isPending}
          submitLabel={drawer.record ? "Save changes" : "Create Prescription"}
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
