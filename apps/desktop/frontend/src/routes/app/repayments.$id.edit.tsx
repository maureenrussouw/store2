import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { PageHeader } from "@/components/layout/page-header";
import { RepaymentForm } from "@/components/resource-forms/repayments-form";
import { useRepayment, useUpdateRepayment } from "@/hooks/use-repayments";

export const Route = createFileRoute("/app/repayments/$id/edit")({
  component: EditRepaymentPage,
});

function EditRepaymentPage() {
  const navigate = useNavigate();
  const { id } = useParams({ from: "/app/repayments/$id/edit" });
  const { data: record, isLoading } = useRepayment(id);
  const update = useUpdateRepayment();

  if (isLoading) return <div className="text-[13px] text-foreground-muted">Loading…</div>;

  return (
    <div>
      <PageHeader title="Edit Repayment" description="Update this repayment" />
      <div className="mt-6">
        <RepaymentForm
          record={record}
          submitting={update.isPending}
          submitLabel="Save Changes"
          onSubmit={async (values) => {
            await update.mutateAsync({ id, data: values });
            navigate({ to: "/app/repayments" });
          }}
        />
      </div>
    </div>
  );
}
