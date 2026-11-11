import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Loan } from "@repo/shared/types";
import { localList, localGet, localCreate, localUpdate, localDelete } from "@/lib/sync-client";

// The offline store is generic over whatever it mirrors, so it hands back
// Record<string, unknown>. Asserting through unknown is what TypeScript wants
// for a widening cast between two types that do not overlap structurally, and
// it is honest: the rows really are unshaped until they get here.
//
// Casting once, here, is what lets the rest of the app see the same
// Loan the API and every other client sees, and what makes grit sync
// reach this file: a locally declared type could not be updated.
export type { Loan };

// What a create or an update may carry: the resource without the fields the
// server owns.
export type LoanInput = Partial<Omit<Loan, "id" | "created_at" | "updated_at">>;

export function useLoans() {
  return useQuery<Loan[]>({
    queryKey: ["loans"],
    queryFn: async () => (await localList("loans")) as unknown as Loan[],
    // The background sync loop keeps the local mirror fresh; re-read it so the
    // list reflects server changes without a manual refresh.
    refetchInterval: 3000,
  });
}

export function useLoan(id: string) {
  return useQuery<Loan | null>({
    queryKey: ["loans", id],
    queryFn: async () => (await localGet("loans", id)) as unknown as Loan | null,
    enabled: !!id,
  });
}

export function useCreateLoan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: LoanInput) => localCreate("loans", "", data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["loans"] }),
  });
}

export function useUpdateLoan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: LoanInput }) =>
      localUpdate("loans", id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["loans"] }),
  });
}

export function useDeleteLoan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => localDelete("loans", id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["loans"] }),
  });
}
