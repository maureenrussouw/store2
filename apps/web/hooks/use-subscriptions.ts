import type { Subscription } from "@repo/shared/types";
import type { CreateSubscriptionInput, UpdateSubscriptionInput } from "@repo/shared/schemas";
import { resourceHooks } from "./use-resource";

// React Query hooks for subscriptions.
//
// The bodies live in ./use-resource.ts, so a fix to the hook shape, a new
// query parameter or a change to how the cache is invalidated reaches every
// resource in this project at once. Edit this file to change what THIS
// resource does; edit use-resource.ts to change what they all do.
const subscriptions = resourceHooks<Subscription, CreateSubscriptionInput, UpdateSubscriptionInput>(
  "subscriptions",
  "/api/subscriptions",
);

export const useSubscriptions = subscriptions.useList;
export const useGetSubscription = subscriptions.useOne;
export const useCreateSubscription = subscriptions.useCreate;
export const useUpdateSubscription = subscriptions.useUpdate;
export const useDeleteSubscription = subscriptions.useRemove;

/** The cache keys, for an invalidation this file does not already do. */
export const subscriptionKeys = subscriptions.keys;
