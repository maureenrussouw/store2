import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { PageHeader } from "@/components/layout/page-header";
import { LineChargeForm } from "@/components/resource-forms/line-charges-form";
import { useCreateLineCharge } from "@/hooks/use-line-charges";

export const Route = createFileRoute("/app/line_charges/new")({
  component: NewLineChargePage,
});

function NewLineChargePage() {
  const navigate = useNavigate();
  const create = useCreateLineCharge();

  return (
    <div>
      <PageHeader title="New LineCharge" description="Create a new linecharge" />
      <div className="mt-6">
        <LineChargeForm
          submitting={create.isPending}
          submitLabel="Create LineCharge"
          onSubmit={async (values) => {
            await create.mutateAsync(values);
            navigate({ to: "/app/line_charges" });
          }}
        />
      </div>
    </div>
  );
}
