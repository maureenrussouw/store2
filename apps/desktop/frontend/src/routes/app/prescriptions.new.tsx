import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { PageHeader } from "@/components/layout/page-header";
import { PrescriptionForm } from "@/components/resource-forms/prescriptions-form";
import { useCreatePrescription } from "@/hooks/use-prescriptions";

export const Route = createFileRoute("/app/prescriptions/new")({
  component: NewPrescriptionPage,
});

function NewPrescriptionPage() {
  const navigate = useNavigate();
  const create = useCreatePrescription();

  return (
    <div>
      <PageHeader title="New Prescription" description="Create a new prescription" />
      <div className="mt-6">
        <PrescriptionForm
          submitting={create.isPending}
          submitLabel="Create Prescription"
          onSubmit={async (values) => {
            await create.mutateAsync(values);
            navigate({ to: "/app/prescriptions" });
          }}
        />
      </div>
    </div>
  );
}
