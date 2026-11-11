import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Medication } from "@repo/shared/types";
import { localList, localGet, localCreate, localUpdate, localDelete } from "@/lib/sync-client";

// The offline store is generic over whatever it mirrors, so it hands back
// Record<string, unknown>. Asserting through unknown is what TypeScript wants
// for a widening cast between two types that do not overlap structurally, and
// it is honest: the rows really are unshaped until they get here.
//
// Casting once, here, is what lets the rest of the app see the same
// Medication the API and every other client sees, and what makes grit sync
// reach this file: a locally declared type could not be updated.
export type { Medication };

// What a create or an update may carry: the resource without the fields the
// server owns.
export type MedicationInput = Partial<Omit<Medication, "id" | "created_at" | "updated_at">>;

export function useMedications() {
  return useQuery<Medication[]>({
    queryKey: ["medications"],
    queryFn: async () => (await localList("medications")) as unknown as Medication[],
    // The background sync loop keeps the local mirror fresh; re-read it so the
    // list reflects server changes without a manual refresh.
    refetchInterval: 3000,
  });
}

export function useMedication(id: string) {
  return useQuery<Medication | null>({
    queryKey: ["medications", id],
    queryFn: async () => (await localGet("medications", id)) as unknown as Medication | null,
    enabled: !!id,
  });
}

export function useCreateMedication() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: MedicationInput) => localCreate("medications", "", data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["medications"] }),
  });
}

export function useUpdateMedication() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: MedicationInput }) =>
      localUpdate("medications", id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["medications"] }),
  });
}

export function useDeleteMedication() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => localDelete("medications", id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["medications"] }),
  });
}
