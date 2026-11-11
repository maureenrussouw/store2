import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { PageHeader } from "@/components/layout/page-header";
import { InvoiceItemForm } from "@/components/resource-forms/invoice-items-form";
import { useCreateInvoiceItem } from "@/hooks/use-invoice-items";

export const Route = createFileRoute("/app/invoice_items/new")({
  component: NewInvoiceItemPage,
});

function NewInvoiceItemPage() {
  const navigate = useNavigate();
  const create = useCreateInvoiceItem();

  return (
    <div>
      <PageHeader title="New InvoiceItem" description="Create a new invoiceitem" />
      <div className="mt-6">
        <InvoiceItemForm
          submitting={create.isPending}
          submitLabel="Create InvoiceItem"
          onSubmit={async (values) => {
            await create.mutateAsync(values);
            navigate({ to: "/app/invoice_items" });
          }}
        />
      </div>
    </div>
  );
}
