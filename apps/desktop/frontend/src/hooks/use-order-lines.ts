import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { OrderLine } from "@repo/shared/types";
import { localList, localGet, localCreate, localUpdate, localDelete } from "@/lib/sync-client";

// The offline store is generic over whatever it mirrors, so it hands back
// Record<string, unknown>. Asserting through unknown is what TypeScript wants
// for a widening cast between two types that do not overlap structurally, and
// it is honest: the rows really are unshaped until they get here.
//
// Casting once, here, is what lets the rest of the app see the same
// OrderLine the API and every other client sees, and what makes grit sync
// reach this file: a locally declared type could not be updated.
export type { OrderLine };

// What a create or an update may carry: the resource without the fields the
// server owns.
export type OrderLineInput = Partial<Omit<OrderLine, "id" | "created_at" | "updated_at">>;

export function useOrderLines() {
  return useQuery<OrderLine[]>({
    queryKey: ["order_lines"],
    queryFn: async () => (await localList("order_lines")) as unknown as OrderLine[],
    // The background sync loop keeps the local mirror fresh; re-read it so the
    // list reflects server changes without a manual refresh.
    refetchInterval: 3000,
  });
}

export function useOrderLine(id: string) {
  return useQuery<OrderLine | null>({
    queryKey: ["order_lines", id],
    queryFn: async () => (await localGet("order_lines", id)) as unknown as OrderLine | null,
    enabled: !!id,
  });
}

export function useCreateOrderLine() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: OrderLineInput) => localCreate("order_lines", "", data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["order_lines"] }),
  });
}

export function useUpdateOrderLine() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: OrderLineInput }) =>
      localUpdate("order_lines", id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["order_lines"] }),
  });
}

export function useDeleteOrderLine() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => localDelete("order_lines", id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["order_lines"] }),
  });
}
