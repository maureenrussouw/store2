import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { LineCharge } from "@repo/shared/types";
import { localList, localGet, localCreate, localUpdate, localDelete } from "@/lib/sync-client";

// The offline store is generic over whatever it mirrors, so it hands back
// Record<string, unknown>. Asserting through unknown is what TypeScript wants
// for a widening cast between two types that do not overlap structurally, and
// it is honest: the rows really are unshaped until they get here.
//
// Casting once, here, is what lets the rest of the app see the same
// LineCharge the API and every other client sees, and what makes grit sync
// reach this file: a locally declared type could not be updated.
export type { LineCharge };

// What a create or an update may carry: the resource without the fields the
// server owns.
export type LineChargeInput = Partial<Omit<LineCharge, "id" | "created_at" | "updated_at">>;

export function useLineCharges() {
  return useQuery<LineCharge[]>({
    queryKey: ["line_charges"],
    queryFn: async () => (await localList("line_charges")) as unknown as LineCharge[],
    // The background sync loop keeps the local mirror fresh; re-read it so the
    // list reflects server changes without a manual refresh.
    refetchInterval: 3000,
  });
}

export function useLineCharge(id: string) {
  return useQuery<LineCharge | null>({
    queryKey: ["line_charges", id],
    queryFn: async () => (await localGet("line_charges", id)) as unknown as LineCharge | null,
    enabled: !!id,
  });
}

export function useCreateLineCharge() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: LineChargeInput) => localCreate("line_charges", "", data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["line_charges"] }),
  });
}

export function useUpdateLineCharge() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: LineChargeInput }) =>
      localUpdate("line_charges", id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["line_charges"] }),
  });
}

export function useDeleteLineCharge() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => localDelete("line_charges", id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["line_charges"] }),
  });
}
