import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { PageHeader } from "@/components/layout/page-header";
import { LoanForm } from "@/components/resource-forms/loans-form";
import { useCreateLoan } from "@/hooks/use-loans";

export const Route = createFileRoute("/app/loans/new")({
  component: NewLoanPage,
});

function NewLoanPage() {
  const navigate = useNavigate();
  const create = useCreateLoan();

  return (
    <div>
      <PageHeader title="New Loan" description="Create a new loan" />
      <div className="mt-6">
        <LoanForm
          submitting={create.isPending}
          submitLabel="Create Loan"
          onSubmit={async (values) => {
            await create.mutateAsync(values);
            navigate({ to: "/app/loans" });
          }}
        />
      </div>
    </div>
  );
}
