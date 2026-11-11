import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { PageHeader } from "@/components/layout/page-header";
import { SubscriptionForm } from "@/components/resource-forms/subscriptions-form";
import { useSubscription, useUpdateSubscription } from "@/hooks/use-subscriptions";

export const Route = createFileRoute("/app/subscriptions/$id/edit")({
  component: EditSubscriptionPage,
});

function EditSubscriptionPage() {
  const navigate = useNavigate();
  const { id } = useParams({ from: "/app/subscriptions/$id/edit" });
  const { data: record, isLoading } = useSubscription(id);
  const update = useUpdateSubscription();

  if (isLoading) return <div className="text-[13px] text-foreground-muted">Loading…</div>;

  return (
    <div>
      <PageHeader title="Edit Subscription" description="Update this subscription" />
      <div className="mt-6">
        <SubscriptionForm
          record={record}
          submitting={update.isPending}
          submitLabel="Save Changes"
          onSubmit={async (values) => {
            await update.mutateAsync({ id, data: values });
            navigate({ to: "/app/subscriptions" });
          }}
        />
      </div>
    </div>
  );
}
