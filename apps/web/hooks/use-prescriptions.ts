import type { Prescription } from "@repo/shared/types";
import type { CreatePrescriptionInput, UpdatePrescriptionInput } from "@repo/shared/schemas";
import { resourceHooks } from "./use-resource";

// React Query hooks for prescriptions.
//
// The bodies live in ./use-resource.ts, so a fix to the hook shape, a new
// query parameter or a change to how the cache is invalidated reaches every
// resource in this project at once. Edit this file to change what THIS
// resource does; edit use-resource.ts to change what they all do.
const prescriptions = resourceHooks<Prescription, CreatePrescriptionInput, UpdatePrescriptionInput>(
  "prescriptions",
  "/api/prescriptions",
);

export const usePrescriptions = prescriptions.useList;
export const useGetPrescription = prescriptions.useOne;
export const useCreatePrescription = prescriptions.useCreate;
export const useUpdatePrescription = prescriptions.useUpdate;
export const useDeletePrescription = prescriptions.useRemove;

/** The cache keys, for an invalidation this file does not already do. */
export const prescriptionKeys = prescriptions.keys;
