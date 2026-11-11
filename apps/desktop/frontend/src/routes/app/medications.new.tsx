import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { PageHeader } from "@/components/layout/page-header";
import { MedicationForm } from "@/components/resource-forms/medications-form";
import { useCreateMedication } from "@/hooks/use-medications";

export const Route = createFileRoute("/app/medications/new")({
  component: NewMedicationPage,
});

function NewMedicationPage() {
  const navigate = useNavigate();
  const create = useCreateMedication();

  return (
    <div>
      <PageHeader title="New Medication" description="Create a new medication" />
      <div className="mt-6">
        <MedicationForm
          submitting={create.isPending}
          submitLabel="Create Medication"
          onSubmit={async (values) => {
            await create.mutateAsync(values);
            navigate({ to: "/app/medications" });
          }}
        />
      </div>
    </div>
  );
}
