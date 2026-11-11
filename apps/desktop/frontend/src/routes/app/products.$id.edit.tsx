import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { PageHeader } from "@/components/layout/page-header";
import { ProductForm } from "@/components/resource-forms/products-form";
import { useProduct, useUpdateProduct } from "@/hooks/use-products";

export const Route = createFileRoute("/app/products/$id/edit")({
  component: EditProductPage,
});

function EditProductPage() {
  const navigate = useNavigate();
  const { id } = useParams({ from: "/app/products/$id/edit" });
  const { data: record, isLoading } = useProduct(id);
  const update = useUpdateProduct();

  if (isLoading) return <div className="text-[13px] text-foreground-muted">Loading…</div>;

  return (
    <div>
      <PageHeader title="Edit Product" description="Update this product" />
      <div className="mt-6">
        <ProductForm
          record={record}
          submitting={update.isPending}
          submitLabel="Save Changes"
          onSubmit={async (values) => {
            await update.mutateAsync({ id, data: values });
            navigate({ to: "/app/products" });
          }}
        />
      </div>
    </div>
  );
}
