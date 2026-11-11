import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { PageHeader } from "@/components/layout/page-header";
import { OrderForm } from "@/components/resource-forms/orders-form";
import { useCreateOrder } from "@/hooks/use-orders";

export const Route = createFileRoute("/app/orders/new")({
  component: NewOrderPage,
});

function NewOrderPage() {
  const navigate = useNavigate();
  const create = useCreateOrder();

  return (
    <div>
      <PageHeader title="New Order" description="Create a new order" />
      <div className="mt-6">
        <OrderForm
          submitting={create.isPending}
          submitLabel="Create Order"
          onSubmit={async (values) => {
            await create.mutateAsync(values);
            navigate({ to: "/app/orders" });
          }}
        />
      </div>
    </div>
  );
}
