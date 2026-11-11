import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { PageHeader } from "@/components/layout/page-header";
import { LineChargeForm } from "@/components/resource-forms/line-charges-form";
import { useLineCharge, useUpdateLineCharge } from "@/hooks/use-line-charges";

export const Route = createFileRoute("/app/line_charges/$id/edit")({
  component: EditLineChargePage,
});

function EditLineChargePage() {
  const navigate = useNavigate();
  const { id } = useParams({ from: "/app/line_charges/$id/edit" });
  const { data: record, isLoading } = useLineCharge(id);
  const update = useUpdateLineCharge();

  if (isLoading) return <div className="text-[13px] text-foreground-muted">Loading…</div>;

  return (
    <div>
      <PageHeader title="Edit LineCharge" description="Update this linecharge" />
      <div className="mt-6">
        <LineChargeForm
          record={record}
          submitting={update.isPending}
          submitLabel="Save Changes"
          onSubmit={async (values) => {
            await update.mutateAsync({ id, data: values });
            navigate({ to: "/app/line_charges" });
          }}
        />
      </div>
    </div>
  );
}
