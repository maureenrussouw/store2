import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { PageHeader } from "@/components/layout/page-header";
import { MedicationForm } from "@/components/resource-forms/medications-form";
import { useMedication, useUpdateMedication } from "@/hooks/use-medications";

export const Route = createFileRoute("/app/medications/$id/edit")({
  component: EditMedicationPage,
});

function EditMedicationPage() {
  const navigate = useNavigate();
  const { id } = useParams({ from: "/app/medications/$id/edit" });
  const { data: record, isLoading } = useMedication(id);
  const update = useUpdateMedication();

  if (isLoading) return <div className="text-[13px] text-foreground-muted">Loading…</div>;

  return (
    <div>
      <PageHeader title="Edit Medication" description="Update this medication" />
      <div className="mt-6">
        <MedicationForm
          record={record}
          submitting={update.isPending}
          submitLabel="Save Changes"
          onSubmit={async (values) => {
            await update.mutateAsync({ id, data: values });
            navigate({ to: "/app/medications" });
          }}
        />
      </div>
    </div>
  );
}
