import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { PageHeader } from "@/components/layout/page-header";
import { InvoiceForm } from "@/components/resource-forms/invoices-form";
import { useInvoice, useUpdateInvoice } from "@/hooks/use-invoices";

export const Route = createFileRoute("/app/invoices/$id/edit")({
  component: EditInvoicePage,
});

function EditInvoicePage() {
  const navigate = useNavigate();
  const { id } = useParams({ from: "/app/invoices/$id/edit" });
  const { data: record, isLoading } = useInvoice(id);
  const update = useUpdateInvoice();

  if (isLoading) return <div className="text-[13px] text-foreground-muted">Loading…</div>;

  return (
    <div>
      <PageHeader title="Edit Invoice" description="Update this invoice" />
      <div className="mt-6">
        <InvoiceForm
          record={record}
          submitting={update.isPending}
          submitLabel="Save Changes"
          onSubmit={async (values) => {
            await update.mutateAsync({ id, data: values });
            navigate({ to: "/app/invoices" });
          }}
        />
      </div>
    </div>
  );
}
