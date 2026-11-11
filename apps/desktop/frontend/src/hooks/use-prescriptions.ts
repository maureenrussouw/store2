import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Prescription } from "@repo/shared/types";
import { localList, localGet, localCreate, localUpdate, localDelete } from "@/lib/sync-client";

// The offline store is generic over whatever it mirrors, so it hands back
// Record<string, unknown>. Asserting through unknown is what TypeScript wants
// for a widening cast between two types that do not overlap structurally, and
// it is honest: the rows really are unshaped until they get here.
//
// Casting once, here, is what lets the rest of the app see the same
// Prescription the API and every other client sees, and what makes grit sync
// reach this file: a locally declared type could not be updated.
export type { Prescription };

// What a create or an update may carry: the resource without the fields the
// server owns.
export type PrescriptionInput = Partial<Omit<Prescription, "id" | "created_at" | "updated_at">>;

export function usePrescriptions() {
  return useQuery<Prescription[]>({
    queryKey: ["prescriptions"],
    queryFn: async () => (await localList("prescriptions")) as unknown as Prescription[],
    // The background sync loop keeps the local mirror fresh; re-read it so the
    // list reflects server changes without a manual refresh.
    refetchInterval: 3000,
  });
}

export function usePrescription(id: string) {
  return useQuery<Prescription | null>({
    queryKey: ["prescriptions", id],
    queryFn: async () => (await localGet("prescriptions", id)) as unknown as Prescription | null,
    enabled: !!id,
  });
}

export function useCreatePrescription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: PrescriptionInput) => localCreate("prescriptions", "", data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["prescriptions"] }),
  });
}

export function useUpdatePrescription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: PrescriptionInput }) =>
      localUpdate("prescriptions", id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["prescriptions"] }),
  });
}

export function useDeletePrescription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => localDelete("prescriptions", id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["prescriptions"] }),
  });
}
