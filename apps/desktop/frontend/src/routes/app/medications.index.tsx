import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { DataTable, type DataColumn } from "@/components/tables/data-table";
import { ResourceDrawer } from "@/components/resource-drawer";
import { useConfirm } from "@/components/confirm-dialog";
import { MedicationForm } from "@/components/resource-forms/medications-form";
import {
  useMedications,
  useCreateMedication,
  useUpdateMedication,
  useDeleteMedication,
  type Medication,
} from "@/hooks/use-medications";
import { usePrescriptions } from "@/hooks/use-prescriptions";

export const Route = createFileRoute("/app/medications/")({
  component: MedicationsPage,
});

const COLUMNS: DataColumn[] = [
  { key: "name", label: "Name", format: "text" },
  { key: "dose", label: "Dose", format: "text" },
  { key: "quantity", label: "Quantity", format: "text" },
  { key: "prescription_label", label: "Prescription", format: "text" },
  { key: "created_at", label: "Created", format: "relative" },
];

const SEARCH_KEYS = ["name", "dose"];

function MedicationsPage() {
  const { data: items = [], isLoading } = useMedications();
  const create = useCreateMedication();
  const update = useUpdateMedication();
  const del = useDeleteMedication();
  const confirm = useConfirm();
  const [drawer, setDrawer] = useState<{ open: boolean; record: Medication | null }>({
    open: false,
    record: null,
  });

  const closeDrawer = () => setDrawer({ open: false, record: null });

  // Resolve belongs_to ids to the related record's name for the table.
  const prescriptionMap = new Map((usePrescriptions().data ?? []).map((o: any) => [String(o.id), String(o.name ?? o.title ?? ([o.first_name, o.last_name].filter(Boolean).join(" ") || o.email || o.id))]));
  const rows = items.map((r) => ({ ...r, prescription_label: prescriptionMap.get(String((r as any).prescription_id)) ?? "" }));

  return (
    <div>
      <PageHeader title="Medications" description="Manage your medications" />

      <div className="mt-6">
        <DataTable<Medication>
          title="Medications"
          singular="Medication"
          columns={COLUMNS}
          rows={rows}
          loading={isLoading}
          searchKeys={SEARCH_KEYS}
          onNew={() => setDrawer({ open: true, record: null })}
          onEdit={(row) => setDrawer({ open: true, record: row })}
          onDelete={async (row) => {
            if (await confirm({ title: "Delete medication", message: "This will delete this medication. This action cannot be undone.", danger: true, confirmLabel: "Delete" })) del.mutate(String(row.id));
          }}
          onBulkDelete={async (rows) => {
            if (await confirm({ title: "Delete medications", message: "Delete " + rows.length + " medication(s)? This cannot be undone.", danger: true, confirmLabel: "Delete" })) rows.forEach((r) => { del.mutate(String(r.id)); });
          }}
          onImport={(records) => records.forEach((rec) => { create.mutate(rec); })}
        />
      </div>

      <ResourceDrawer
        open={drawer.open}
        title={drawer.record ? "Edit Medication" : "New Medication"}
        description={drawer.record ? "Update this medication" : "Create a new medication"}
        onClose={closeDrawer}
      >
        <MedicationForm
          record={drawer.record}
          submitting={create.isPending || update.isPending}
          submitLabel={drawer.record ? "Save changes" : "Create Medication"}
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
