import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { PageHeader } from "@/components/layout/page-header";
import { OrderLineForm } from "@/components/resource-forms/order-lines-form";
import { useCreateOrderLine } from "@/hooks/use-order-lines";

export const Route = createFileRoute("/app/order_lines/new")({
  component: NewOrderLinePage,
});

function NewOrderLinePage() {
  const navigate = useNavigate();
  const create = useCreateOrderLine();

  return (
    <div>
      <PageHeader title="New OrderLine" description="Create a new orderline" />
      <div className="mt-6">
        <OrderLineForm
          submitting={create.isPending}
          submitLabel="Create OrderLine"
          onSubmit={async (values) => {
            await create.mutateAsync(values);
            navigate({ to: "/app/order_lines" });
          }}
        />
      </div>
    </div>
  );
}
