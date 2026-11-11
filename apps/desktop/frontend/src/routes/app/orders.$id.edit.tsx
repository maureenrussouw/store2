import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { PageHeader } from "@/components/layout/page-header";
import { OrderForm } from "@/components/resource-forms/orders-form";
import { useOrder, useUpdateOrder } from "@/hooks/use-orders";

export const Route = createFileRoute("/app/orders/$id/edit")({
  component: EditOrderPage,
});

function EditOrderPage() {
  const navigate = useNavigate();
  const { id } = useParams({ from: "/app/orders/$id/edit" });
  const { data: record, isLoading } = useOrder(id);
  const update = useUpdateOrder();

  if (isLoading) return <div className="text-[13px] text-foreground-muted">Loading…</div>;

  return (
    <div>
      <PageHeader title="Edit Order" description="Update this order" />
      <div className="mt-6">
        <OrderForm
          record={record}
          submitting={update.isPending}
          submitLabel="Save Changes"
          onSubmit={async (values) => {
            await update.mutateAsync({ id, data: values });
            navigate({ to: "/app/orders" });
          }}
        />
      </div>
    </div>
  );
}
