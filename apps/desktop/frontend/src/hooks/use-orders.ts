import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Order } from "@repo/shared/types";
import { localList, localGet, localCreate, localUpdate, localDelete } from "@/lib/sync-client";

// The offline store is generic over whatever it mirrors, so it hands back
// Record<string, unknown>. Asserting through unknown is what TypeScript wants
// for a widening cast between two types that do not overlap structurally, and
// it is honest: the rows really are unshaped until they get here.
//
// Casting once, here, is what lets the rest of the app see the same
// Order the API and every other client sees, and what makes grit sync
// reach this file: a locally declared type could not be updated.
export type { Order };

// What a create or an update may carry: the resource without the fields the
// server owns.
export type OrderInput = Partial<Omit<Order, "id" | "created_at" | "updated_at">>;

export function useOrders() {
  return useQuery<Order[]>({
    queryKey: ["orders"],
    queryFn: async () => (await localList("orders")) as unknown as Order[],
    // The background sync loop keeps the local mirror fresh; re-read it so the
    // list reflects server changes without a manual refresh.
    refetchInterval: 3000,
  });
}

export function useOrder(id: string) {
  return useQuery<Order | null>({
    queryKey: ["orders", id],
    queryFn: async () => (await localGet("orders", id)) as unknown as Order | null,
    enabled: !!id,
  });
}

export function useCreateOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: OrderInput) => localCreate("orders", "", data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["orders"] }),
  });
}

export function useUpdateOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: OrderInput }) =>
      localUpdate("orders", id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["orders"] }),
  });
}

export function useDeleteOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => localDelete("orders", id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["orders"] }),
  });
}
