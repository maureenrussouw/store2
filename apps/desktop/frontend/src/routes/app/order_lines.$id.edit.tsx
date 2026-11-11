import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { PageHeader } from "@/components/layout/page-header";
import { OrderLineForm } from "@/components/resource-forms/order-lines-form";
import { useOrderLine, useUpdateOrderLine } from "@/hooks/use-order-lines";

export const Route = createFileRoute("/app/order_lines/$id/edit")({
  component: EditOrderLinePage,
});

function EditOrderLinePage() {
  const navigate = useNavigate();
  const { id } = useParams({ from: "/app/order_lines/$id/edit" });
  const { data: record, isLoading } = useOrderLine(id);
  const update = useUpdateOrderLine();

  if (isLoading) return <div className="text-[13px] text-foreground-muted">Loading…</div>;

  return (
    <div>
      <PageHeader title="Edit OrderLine" description="Update this orderline" />
      <div className="mt-6">
        <OrderLineForm
          record={record}
          submitting={update.isPending}
          submitLabel="Save Changes"
          onSubmit={async (values) => {
            await update.mutateAsync({ id, data: values });
            navigate({ to: "/app/order_lines" });
          }}
        />
      </div>
    </div>
  );
}
