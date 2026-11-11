import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Repayment } from "@repo/shared/types";
import { localList, localGet, localCreate, localUpdate, localDelete } from "@/lib/sync-client";

// The offline store is generic over whatever it mirrors, so it hands back
// Record<string, unknown>. Asserting through unknown is what TypeScript wants
// for a widening cast between two types that do not overlap structurally, and
// it is honest: the rows really are unshaped until they get here.
//
// Casting once, here, is what lets the rest of the app see the same
// Repayment the API and every other client sees, and what makes grit sync
// reach this file: a locally declared type could not be updated.
export type { Repayment };

// What a create or an update may carry: the resource without the fields the
// server owns.
export type RepaymentInput = Partial<Omit<Repayment, "id" | "created_at" | "updated_at">>;

export function useRepayments() {
  return useQuery<Repayment[]>({
    queryKey: ["repayments"],
    queryFn: async () => (await localList("repayments")) as unknown as Repayment[],
    // The background sync loop keeps the local mirror fresh; re-read it so the
    // list reflects server changes without a manual refresh.
    refetchInterval: 3000,
  });
}

export function useRepayment(id: string) {
  return useQuery<Repayment | null>({
    queryKey: ["repayments", id],
    queryFn: async () => (await localGet("repayments", id)) as unknown as Repayment | null,
    enabled: !!id,
  });
}

export function useCreateRepayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: RepaymentInput) => localCreate("repayments", "", data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["repayments"] }),
  });
}

export function useUpdateRepayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: RepaymentInput }) =>
      localUpdate("repayments", id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["repayments"] }),
  });
}

export function useDeleteRepayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => localDelete("repayments", id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["repayments"] }),
  });
}
