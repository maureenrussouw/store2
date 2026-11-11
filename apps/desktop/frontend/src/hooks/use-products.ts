import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Product } from "@repo/shared/types";
import { localList, localGet, localCreate, localUpdate, localDelete } from "@/lib/sync-client";

// The offline store is generic over whatever it mirrors, so it hands back
// Record<string, unknown>. Asserting through unknown is what TypeScript wants
// for a widening cast between two types that do not overlap structurally, and
// it is honest: the rows really are unshaped until they get here.
//
// Casting once, here, is what lets the rest of the app see the same
// Product the API and every other client sees, and what makes grit sync
// reach this file: a locally declared type could not be updated.
export type { Product };

// What a create or an update may carry: the resource without the fields the
// server owns.
export type ProductInput = Partial<Omit<Product, "id" | "created_at" | "updated_at">>;

export function useProducts() {
  return useQuery<Product[]>({
    queryKey: ["products"],
    queryFn: async () => (await localList("products")) as unknown as Product[],
    // The background sync loop keeps the local mirror fresh; re-read it so the
    // list reflects server changes without a manual refresh.
    refetchInterval: 3000,
  });
}

export function useProduct(id: string) {
  return useQuery<Product | null>({
    queryKey: ["products", id],
    queryFn: async () => (await localGet("products", id)) as unknown as Product | null,
    enabled: !!id,
  });
}

export function useCreateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: ProductInput) => localCreate("products", "", data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["products"] }),
  });
}

export function useUpdateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: ProductInput }) =>
      localUpdate("products", id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["products"] }),
  });
}

export function useDeleteProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => localDelete("products", id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["products"] }),
  });
}
