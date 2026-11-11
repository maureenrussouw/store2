import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { InvoiceItem } from "@repo/shared/types";
import { localList, localGet, localCreate, localUpdate, localDelete } from "@/lib/sync-client";

// The offline store is generic over whatever it mirrors, so it hands back
// Record<string, unknown>. Asserting through unknown is what TypeScript wants
// for a widening cast between two types that do not overlap structurally, and
// it is honest: the rows really are unshaped until they get here.
//
// Casting once, here, is what lets the rest of the app see the same
// InvoiceItem the API and every other client sees, and what makes grit sync
// reach this file: a locally declared type could not be updated.
export type { InvoiceItem };

// What a create or an update may carry: the resource without the fields the
// server owns.
export type InvoiceItemInput = Partial<Omit<InvoiceItem, "id" | "created_at" | "updated_at">>;

export function useInvoiceItems() {
  return useQuery<InvoiceItem[]>({
    queryKey: ["invoice_items"],
    queryFn: async () => (await localList("invoice_items")) as unknown as InvoiceItem[],
    // The background sync loop keeps the local mirror fresh; re-read it so the
    // list reflects server changes without a manual refresh.
    refetchInterval: 3000,
  });
}

export function useInvoiceItem(id: string) {
  return useQuery<InvoiceItem | null>({
    queryKey: ["invoice_items", id],
    queryFn: async () => (await localGet("invoice_items", id)) as unknown as InvoiceItem | null,
    enabled: !!id,
  });
}

export function useCreateInvoiceItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: InvoiceItemInput) => localCreate("invoice_items", "", data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["invoice_items"] }),
  });
}

export function useUpdateInvoiceItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: InvoiceItemInput }) =>
      localUpdate("invoice_items", id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["invoice_items"] }),
  });
}

export function useDeleteInvoiceItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => localDelete("invoice_items", id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["invoice_items"] }),
  });
}
