import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Invoice } from "@repo/shared/types";
import { localList, localGet, localCreate, localUpdate, localDelete } from "@/lib/sync-client";

// The offline store is generic over whatever it mirrors, so it hands back
// Record<string, unknown>. Asserting through unknown is what TypeScript wants
// for a widening cast between two types that do not overlap structurally, and
// it is honest: the rows really are unshaped until they get here.
//
// Casting once, here, is what lets the rest of the app see the same
// Invoice the API and every other client sees, and what makes grit sync
// reach this file: a locally declared type could not be updated.
export type { Invoice };

// What a create or an update may carry: the resource without the fields the
// server owns.
export type InvoiceInput = Partial<Omit<Invoice, "id" | "created_at" | "updated_at">>;

export function useInvoices() {
  return useQuery<Invoice[]>({
    queryKey: ["invoices"],
    queryFn: async () => (await localList("invoices")) as unknown as Invoice[],
    // The background sync loop keeps the local mirror fresh; re-read it so the
    // list reflects server changes without a manual refresh.
    refetchInterval: 3000,
  });
}

export function useInvoice(id: string) {
  return useQuery<Invoice | null>({
    queryKey: ["invoices", id],
    queryFn: async () => (await localGet("invoices", id)) as unknown as Invoice | null,
    enabled: !!id,
  });
}

export function useCreateInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: InvoiceInput) => localCreate("invoices", "", data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["invoices"] }),
  });
}

export function useUpdateInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: InvoiceInput }) =>
      localUpdate("invoices", id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["invoices"] }),
  });
}

export function useDeleteInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => localDelete("invoices", id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["invoices"] }),
  });
}
