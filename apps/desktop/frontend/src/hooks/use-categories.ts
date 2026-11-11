import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Category } from "@repo/shared/types";
import { localList, localGet, localCreate, localUpdate, localDelete } from "@/lib/sync-client";

// The offline store is generic over whatever it mirrors, so it hands back
// Record<string, unknown>. Asserting through unknown is what TypeScript wants
// for a widening cast between two types that do not overlap structurally, and
// it is honest: the rows really are unshaped until they get here.
//
// Casting once, here, is what lets the rest of the app see the same
// Category the API and every other client sees, and what makes grit sync
// reach this file: a locally declared type could not be updated.
export type { Category };

// What a create or an update may carry: the resource without the fields the
// server owns.
export type CategoryInput = Partial<Omit<Category, "id" | "created_at" | "updated_at">>;

export function useCategories() {
  return useQuery<Category[]>({
    queryKey: ["categories"],
    queryFn: async () => (await localList("categories")) as unknown as Category[],
    // The background sync loop keeps the local mirror fresh; re-read it so the
    // list reflects server changes without a manual refresh.
    refetchInterval: 3000,
  });
}

export function useCategory(id: string) {
  return useQuery<Category | null>({
    queryKey: ["categories", id],
    queryFn: async () => (await localGet("categories", id)) as unknown as Category | null,
    enabled: !!id,
  });
}

export function useCreateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CategoryInput) => localCreate("categories", "", data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["categories"] }),
  });
}

export function useUpdateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: CategoryInput }) =>
      localUpdate("categories", id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["categories"] }),
  });
}

export function useDeleteCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => localDelete("categories", id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["categories"] }),
  });
}
