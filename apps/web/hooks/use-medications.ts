import type { Medication } from "@repo/shared/types";
import type { CreateMedicationInput, UpdateMedicationInput } from "@repo/shared/schemas";
import { resourceHooks } from "./use-resource";

// React Query hooks for medications.
//
// The bodies live in ./use-resource.ts, so a fix to the hook shape, a new
// query parameter or a change to how the cache is invalidated reaches every
// resource in this project at once. Edit this file to change what THIS
// resource does; edit use-resource.ts to change what they all do.
const medications = resourceHooks<Medication, CreateMedicationInput, UpdateMedicationInput>(
  "medications",
  "/api/medications",
);

export const useMedications = medications.useList;
export const useGetMedication = medications.useOne;
export const useCreateMedication = medications.useCreate;
export const useUpdateMedication = medications.useUpdate;
export const useDeleteMedication = medications.useRemove;

/** The cache keys, for an invalidation this file does not already do. */
export const medicationKeys = medications.keys;
