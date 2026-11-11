import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { PageHeader } from "@/components/layout/page-header";
import { CategoryForm } from "@/components/resource-forms/categories-form";
import { useCategory, useUpdateCategory } from "@/hooks/use-categories";

export const Route = createFileRoute("/app/categories/$id/edit")({
  component: EditCategoryPage,
});

function EditCategoryPage() {
  const navigate = useNavigate();
  const { id } = useParams({ from: "/app/categories/$id/edit" });
  const { data: record, isLoading } = useCategory(id);
  const update = useUpdateCategory();

  if (isLoading) return <div className="text-[13px] text-foreground-muted">Loading…</div>;

  return (
    <div>
      <PageHeader title="Edit Category" description="Update this category" />
      <div className="mt-6">
        <CategoryForm
          record={record}
          submitting={update.isPending}
          submitLabel="Save Changes"
          onSubmit={async (values) => {
            await update.mutateAsync({ id, data: values });
            navigate({ to: "/app/categories" });
          }}
        />
      </div>
    </div>
  );
}
