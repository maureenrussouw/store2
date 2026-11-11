import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Customer } from "@repo/shared/types";
import { localList, localGet, localCreate, localUpdate, localDelete } from "@/lib/sync-client";

// The offline store is generic over whatever it mirrors, so it hands back
// Record<string, unknown>. Asserting through unknown is what TypeScript wants
// for a widening cast between two types that do not overlap structurally, and
// it is honest: the rows really are unshaped until they get here.
//
// Casting once, here, is what lets the rest of the app see the same
// Customer the API and every other client sees, and what makes grit sync
// reach this file: a locally declared type could not be updated.
export type { Customer };

// What a create or an update may carry: the resource without the fields the
// server owns.
export type CustomerInput = Partial<Omit<Customer, "id" | "created_at" | "updated_at">>;

export function useCustomers() {
  return useQuery<Customer[]>({
    queryKey: ["customers"],
    queryFn: async () => (await localList("customers")) as unknown as Customer[],
    // The background sync loop keeps the local mirror fresh; re-read it so the
    // list reflects server changes without a manual refresh.
    refetchInterval: 3000,
  });
}

export function useCustomer(id: string) {
  return useQuery<Customer | null>({
    queryKey: ["customers", id],
    queryFn: async () => (await localGet("customers", id)) as unknown as Customer | null,
    enabled: !!id,
  });
}

export function useCreateCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CustomerInput) => localCreate("customers", "", data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["customers"] }),
  });
}

export function useUpdateCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: CustomerInput }) =>
      localUpdate("customers", id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["customers"] }),
  });
}

export function useDeleteCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => localDelete("customers", id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["customers"] }),
  });
}
