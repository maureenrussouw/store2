import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { PageHeader } from "@/components/layout/page-header";
import { PrescriptionForm } from "@/components/resource-forms/prescriptions-form";
import { usePrescription, useUpdatePrescription } from "@/hooks/use-prescriptions";

export const Route = createFileRoute("/app/prescriptions/$id/edit")({
  component: EditPrescriptionPage,
});

function EditPrescriptionPage() {
  const navigate = useNavigate();
  const { id } = useParams({ from: "/app/prescriptions/$id/edit" });
  const { data: record, isLoading } = usePrescription(id);
  const update = useUpdatePrescription();

  if (isLoading) return <div className="text-[13px] text-foreground-muted">Loading…</div>;

  return (
    <div>
      <PageHeader title="Edit Prescription" description="Update this prescription" />
      <div className="mt-6">
        <PrescriptionForm
          record={record}
          submitting={update.isPending}
          submitLabel="Save Changes"
          onSubmit={async (values) => {
            await update.mutateAsync({ id, data: values });
            navigate({ to: "/app/prescriptions" });
          }}
        />
      </div>
    </div>
  );
}
