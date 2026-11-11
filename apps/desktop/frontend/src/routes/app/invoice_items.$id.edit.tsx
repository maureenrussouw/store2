import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { PageHeader } from "@/components/layout/page-header";
import { InvoiceItemForm } from "@/components/resource-forms/invoice-items-form";
import { useInvoiceItem, useUpdateInvoiceItem } from "@/hooks/use-invoice-items";

export const Route = createFileRoute("/app/invoice_items/$id/edit")({
  component: EditInvoiceItemPage,
});

function EditInvoiceItemPage() {
  const navigate = useNavigate();
  const { id } = useParams({ from: "/app/invoice_items/$id/edit" });
  const { data: record, isLoading } = useInvoiceItem(id);
  const update = useUpdateInvoiceItem();

  if (isLoading) return <div className="text-[13px] text-foreground-muted">Loading…</div>;

  return (
    <div>
      <PageHeader title="Edit InvoiceItem" description="Update this invoiceitem" />
      <div className="mt-6">
        <InvoiceItemForm
          record={record}
          submitting={update.isPending}
          submitLabel="Save Changes"
          onSubmit={async (values) => {
            await update.mutateAsync({ id, data: values });
            navigate({ to: "/app/invoice_items" });
          }}
        />
      </div>
    </div>
  );
}
