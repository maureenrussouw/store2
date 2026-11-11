import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { PageHeader } from "@/components/layout/page-header";
import { CategoryForm } from "@/components/resource-forms/categories-form";
import { useCreateCategory } from "@/hooks/use-categories";

export const Route = createFileRoute("/app/categories/new")({
  component: NewCategoryPage,
});

function NewCategoryPage() {
  const navigate = useNavigate();
  const create = useCreateCategory();

  return (
    <div>
      <PageHeader title="New Category" description="Create a new category" />
      <div className="mt-6">
        <CategoryForm
          submitting={create.isPending}
          submitLabel="Create Category"
          onSubmit={async (values) => {
            await create.mutateAsync(values);
            navigate({ to: "/app/categories" });
          }}
        />
      </div>
    </div>
  );
}
