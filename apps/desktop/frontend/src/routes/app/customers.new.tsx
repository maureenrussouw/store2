import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { PageHeader } from "@/components/layout/page-header";
import { CustomerForm } from "@/components/resource-forms/customers-form";
import { useCreateCustomer } from "@/hooks/use-customers";

export const Route = createFileRoute("/app/customers/new")({
  component: NewCustomerPage,
});

function NewCustomerPage() {
  const navigate = useNavigate();
  const create = useCreateCustomer();

  return (
    <div>
      <PageHeader title="New Customer" description="Create a new customer" />
      <div className="mt-6">
        <CustomerForm
          submitting={create.isPending}
          submitLabel="Create Customer"
          onSubmit={async (values) => {
            await create.mutateAsync(values);
            navigate({ to: "/app/customers" });
          }}
        />
      </div>
    </div>
  );
}
