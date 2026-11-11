import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { DataTable, type DataColumn } from "@/components/tables/data-table";
import { ResourceDrawer } from "@/components/resource-drawer";
import { useConfirm } from "@/components/confirm-dialog";
import { CategoryForm } from "@/components/resource-forms/categories-form";
import {
  useCategories,
  useCreateCategory,
  useUpdateCategory,
  useDeleteCategory,
  type Category,
} from "@/hooks/use-categories";
import { useCategories } from "@/hooks/use-categories";

export const Route = createFileRoute("/app/categories/")({
  component: CategoriesPage,
});

const COLUMNS: DataColumn[] = [
  { key: "name", label: "Name", format: "text" },
  { key: "slug", label: "Slug", format: "text" },
  { key: "image", label: "Image", format: "image" },
  { key: "featured", label: "Featured", format: "boolean" },
  { key: "parent_label", label: "Parent", format: "text" },
  { key: "created_at", label: "Created", format: "relative" },
];

const SEARCH_KEYS = ["name"];

function CategoriesPage() {
  const { data: items = [], isLoading } = useCategories();
  const create = useCreateCategory();
  const update = useUpdateCategory();
  const del = useDeleteCategory();
  const confirm = useConfirm();
  const [drawer, setDrawer] = useState<{ open: boolean; record: Category | null }>({
    open: false,
    record: null,
  });

  const closeDrawer = () => setDrawer({ open: false, record: null });

  // Resolve belongs_to ids to the related record's name for the table.
  const parentMap = new Map((useCategories().data ?? []).map((o: any) => [String(o.id), String(o.name ?? o.title ?? ([o.first_name, o.last_name].filter(Boolean).join(" ") || o.email || o.id))]));
  const rows = items.map((r) => ({ ...r, parent_label: parentMap.get(String((r as any).parent_id)) ?? "" }));

  return (
    <div>
      <PageHeader title="Categories" description="Manage your categories" />

      <div className="mt-6">
        <DataTable<Category>
          title="Categories"
          singular="Category"
          columns={COLUMNS}
          rows={rows}
          loading={isLoading}
          searchKeys={SEARCH_KEYS}
          onNew={() => setDrawer({ open: true, record: null })}
          onEdit={(row) => setDrawer({ open: true, record: row })}
          onDelete={async (row) => {
            if (await confirm({ title: "Delete category", message: "This will delete this category. This action cannot be undone.", danger: true, confirmLabel: "Delete" })) del.mutate(String(row.id));
          }}
          onBulkDelete={async (rows) => {
            if (await confirm({ title: "Delete categorys", message: "Delete " + rows.length + " category(s)? This cannot be undone.", danger: true, confirmLabel: "Delete" })) rows.forEach((r) => { del.mutate(String(r.id)); });
          }}
          onImport={(records) => records.forEach((rec) => { create.mutate(rec); })}
        />
      </div>

      <ResourceDrawer
        open={drawer.open}
        title={drawer.record ? "Edit Category" : "New Category"}
        description={drawer.record ? "Update this category" : "Create a new category"}
        onClose={closeDrawer}
      >
        <CategoryForm
          record={drawer.record}
          submitting={create.isPending || update.isPending}
          submitLabel={drawer.record ? "Save changes" : "Create Category"}
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
