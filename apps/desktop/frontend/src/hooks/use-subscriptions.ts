import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Subscription } from "@repo/shared/types";
import { localList, localGet, localCreate, localUpdate, localDelete } from "@/lib/sync-client";

// The offline store is generic over whatever it mirrors, so it hands back
// Record<string, unknown>. Asserting through unknown is what TypeScript wants
// for a widening cast between two types that do not overlap structurally, and
// it is honest: the rows really are unshaped until they get here.
//
// Casting once, here, is what lets the rest of the app see the same
// Subscription the API and every other client sees, and what makes grit sync
// reach this file: a locally declared type could not be updated.
export type { Subscription };

// What a create or an update may carry: the resource without the fields the
// server owns.
export type SubscriptionInput = Partial<Omit<Subscription, "id" | "created_at" | "updated_at">>;

export function useSubscriptions() {
  return useQuery<Subscription[]>({
    queryKey: ["subscriptions"],
    queryFn: async () => (await localList("subscriptions")) as unknown as Subscription[],
    // The background sync loop keeps the local mirror fresh; re-read it so the
    // list reflects server changes without a manual refresh.
    refetchInterval: 3000,
  });
}

export function useSubscription(id: string) {
  return useQuery<Subscription | null>({
    queryKey: ["subscriptions", id],
    queryFn: async () => (await localGet("subscriptions", id)) as unknown as Subscription | null,
    enabled: !!id,
  });
}

export function useCreateSubscription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: SubscriptionInput) => localCreate("subscriptions", "", data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["subscriptions"] }),
  });
}

export function useUpdateSubscription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: SubscriptionInput }) =>
      localUpdate("subscriptions", id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["subscriptions"] }),
  });
}

export function useDeleteSubscription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => localDelete("subscriptions", id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["subscriptions"] }),
  });
}
