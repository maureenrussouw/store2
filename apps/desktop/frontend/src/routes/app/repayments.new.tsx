import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { PageHeader } from "@/components/layout/page-header";
import { RepaymentForm } from "@/components/resource-forms/repayments-form";
import { useCreateRepayment } from "@/hooks/use-repayments";

export const Route = createFileRoute("/app/repayments/new")({
  component: NewRepaymentPage,
});

function NewRepaymentPage() {
  const navigate = useNavigate();
  const create = useCreateRepayment();

  return (
    <div>
      <PageHeader title="New Repayment" description="Create a new repayment" />
      <div className="mt-6">
        <RepaymentForm
          submitting={create.isPending}
          submitLabel="Create Repayment"
          onSubmit={async (values) => {
            await create.mutateAsync(values);
            navigate({ to: "/app/repayments" });
          }}
        />
      </div>
    </div>
  );
}
