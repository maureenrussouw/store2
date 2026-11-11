import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { PageHeader } from "@/components/layout/page-header";
import { ProductForm } from "@/components/resource-forms/products-form";
import { useCreateProduct } from "@/hooks/use-products";

export const Route = createFileRoute("/app/products/new")({
  component: NewProductPage,
});

function NewProductPage() {
  const navigate = useNavigate();
  const create = useCreateProduct();

  return (
    <div>
      <PageHeader title="New Product" description="Create a new product" />
      <div className="mt-6">
        <ProductForm
          submitting={create.isPending}
          submitLabel="Create Product"
          onSubmit={async (values) => {
            await create.mutateAsync(values);
            navigate({ to: "/app/products" });
          }}
        />
      </div>
    </div>
  );
}
