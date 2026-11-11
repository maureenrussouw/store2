import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { DataTable, type DataColumn } from "@/components/tables/data-table";
import { ResourceDrawer } from "@/components/resource-drawer";
import { useConfirm } from "@/components/confirm-dialog";
import { ProductForm } from "@/components/resource-forms/products-form";
import {
  useProducts,
  useCreateProduct,
  useUpdateProduct,
  useDeleteProduct,
  type Product,
} from "@/hooks/use-products";
import { useCategories } from "@/hooks/use-categories";
import { useProducts } from "@/hooks/use-products";

export const Route = createFileRoute("/app/products/")({
  component: ProductsPage,
});

const COLUMNS: DataColumn[] = [
  { key: "name", label: "Name", format: "text" },
  { key: "slug", label: "Slug", format: "text" },
  { key: "price", label: "Price", format: "text" },
  { key: "description", label: "Description", format: "text" },
  { key: "thumbnail", label: "Thumbnail", format: "image" },
  { key: "images", label: "Images", format: "image" },
  { key: "category_label", label: "Category", format: "text" },
  { key: "parent_label", label: "Parent", format: "text" },
  { key: "created_at", label: "Created", format: "relative" },
];

const SEARCH_KEYS = ["name", "description"];

function ProductsPage() {
  const { data: items = [], isLoading } = useProducts();
  const create = useCreateProduct();
  const update = useUpdateProduct();
  const del = useDeleteProduct();
  const confirm = useConfirm();
  const [drawer, setDrawer] = useState<{ open: boolean; record: Product | null }>({
    open: false,
    record: null,
  });

  const closeDrawer = () => setDrawer({ open: false, record: null });

  // Resolve belongs_to ids to the related record's name for the table.
  const categoryMap = new Map((useCategories().data ?? []).map((o: any) => [String(o.id), String(o.name ?? o.title ?? ([o.first_name, o.last_name].filter(Boolean).join(" ") || o.email || o.id))]));
  const parentMap = new Map((useProducts().data ?? []).map((o: any) => [String(o.id), String(o.name ?? o.title ?? ([o.first_name, o.last_name].filter(Boolean).join(" ") || o.email || o.id))]));
  const rows = items.map((r) => ({ ...r, category_label: categoryMap.get(String((r as any).category_id)) ?? "", parent_label: parentMap.get(String((r as any).parent_id)) ?? "" }));

  return (
    <div>
      <PageHeader title="Products" description="Manage your products" />

      <div className="mt-6">
        <DataTable<Product>
          title="Products"
          singular="Product"
          columns={COLUMNS}
          rows={rows}
          loading={isLoading}
          searchKeys={SEARCH_KEYS}
          onNew={() => setDrawer({ open: true, record: null })}
          onEdit={(row) => setDrawer({ open: true, record: row })}
          onDelete={async (row) => {
            if (await confirm({ title: "Delete product", message: "This will delete this product. This action cannot be undone.", danger: true, confirmLabel: "Delete" })) del.mutate(String(row.id));
          }}
          onBulkDelete={async (rows) => {
            if (await confirm({ title: "Delete products", message: "Delete " + rows.length + " product(s)? This cannot be undone.", danger: true, confirmLabel: "Delete" })) rows.forEach((r) => { del.mutate(String(r.id)); });
          }}
          onImport={(records) => records.forEach((rec) => { create.mutate(rec); })}
        />
      </div>

      <ResourceDrawer
        open={drawer.open}
        title={drawer.record ? "Edit Product" : "New Product"}
        description={drawer.record ? "Update this product" : "Create a new product"}
        onClose={closeDrawer}
      >
        <ProductForm
          record={drawer.record}
          submitting={create.isPending || update.isPending}
          submitLabel={drawer.record ? "Save changes" : "Create Product"}
          onCancel={closeDrawer}
          onSubmit={async (values) => {
            if (drawer.record) {
              await update.mutateAsync({ id: String(drawer.record.id), data: values });
            } else {
              await create.mutateAsync(values);
            }
            closeDrawer();
          }}
        />
      </ResourceDrawer>
    </div>
  );
}
