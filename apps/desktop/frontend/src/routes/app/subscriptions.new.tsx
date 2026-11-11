import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { PageHeader } from "@/components/layout/page-header";
import { SubscriptionForm } from "@/components/resource-forms/subscriptions-form";
import { useCreateSubscription } from "@/hooks/use-subscriptions";

export const Route = createFileRoute("/app/subscriptions/new")({
  component: NewSubscriptionPage,
});

function NewSubscriptionPage() {
  const navigate = useNavigate();
  const create = useCreateSubscription();

  return (
    <div>
      <PageHeader title="New Subscription" description="Create a new subscription" />
      <div className="mt-6">
        <SubscriptionForm
          submitting={create.isPending}
          submitLabel="Create Subscription"
          onSubmit={async (values) => {
            await create.mutateAsync(values);
            navigate({ to: "/app/subscriptions" });
          }}
        />
      </div>
    </div>
  );
}
