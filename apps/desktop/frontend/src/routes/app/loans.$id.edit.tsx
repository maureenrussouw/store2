import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { PageHeader } from "@/components/layout/page-header";
import { LoanForm } from "@/components/resource-forms/loans-form";
import { useLoan, useUpdateLoan } from "@/hooks/use-loans";

export const Route = createFileRoute("/app/loans/$id/edit")({
  component: EditLoanPage,
});

function EditLoanPage() {
  const navigate = useNavigate();
  const { id } = useParams({ from: "/app/loans/$id/edit" });
  const { data: record, isLoading } = useLoan(id);
  const update = useUpdateLoan();

  if (isLoading) return <div className="text-[13px] text-foreground-muted">Loading…</div>;

  return (
    <div>
      <PageHeader title="Edit Loan" description="Update this loan" />
      <div className="mt-6">
        <LoanForm
          record={record}
          submitting={update.isPending}
          submitLabel="Save Changes"
          onSubmit={async (values) => {
            await update.mutateAsync({ id, data: values });
            navigate({ to: "/app/loans" });
          }}
        />
      </div>
    </div>
  );
}
