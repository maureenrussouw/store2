import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { PageHeader } from "@/components/layout/page-header";
import { InvoiceForm } from "@/components/resource-forms/invoices-form";
import { useCreateInvoice } from "@/hooks/use-invoices";

export const Route = createFileRoute("/app/invoices/new")({
  component: NewInvoicePage,
});

function NewInvoicePage() {
  const navigate = useNavigate();
  const create = useCreateInvoice();

  return (
    <div>
      <PageHeader title="New Invoice" description="Create a new invoice" />
      <div className="mt-6">
        <InvoiceForm
          submitting={create.isPending}
          submitLabel="Create Invoice"
          onSubmit={async (values) => {
            await create.mutateAsync(values);
            navigate({ to: "/app/invoices" });
          }}
        />
      </div>
    </div>
  );
}
