import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { PageHeader } from "@/components/layout/page-header";
import { CustomerForm } from "@/components/resource-forms/customers-form";
import { useCustomer, useUpdateCustomer } from "@/hooks/use-customers";

export const Route = createFileRoute("/app/customers/$id/edit")({
  component: EditCustomerPage,
});

function EditCustomerPage() {
  const navigate = useNavigate();
  const { id } = useParams({ from: "/app/customers/$id/edit" });
  const { data: record, isLoading } = useCustomer(id);
  const update = useUpdateCustomer();

  if (isLoading) return <div className="text-[13px] text-foreground-muted">Loading…</div>;

  return (
    <div>
      <PageHeader title="Edit Customer" description="Update this customer" />
      <div className="mt-6">
        <CustomerForm
          record={record}
          submitting={update.isPending}
          submitLabel="Save Changes"
          onSubmit={async (values) => {
            await update.mutateAsync({ id, data: values });
            navigate({ to: "/app/customers" });
          }}
        />
      </div>
    </div>
  );
}
