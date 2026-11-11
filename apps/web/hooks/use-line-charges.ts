import type { LineCharge } from "@repo/shared/types";
import type { CreateLineChargeInput, UpdateLineChargeInput } from "@repo/shared/schemas";
import { resourceHooks } from "./use-resource";

// React Query hooks for line_charges.
//
// The bodies live in ./use-resource.ts, so a fix to the hook shape, a new
// query parameter or a change to how the cache is invalidated reaches every
// resource in this project at once. Edit this file to change what THIS
// resource does; edit use-resource.ts to change what they all do.
const line_charges = resourceHooks<LineCharge, CreateLineChargeInput, UpdateLineChargeInput>(
  "line_charges",
  "/api/line_charges",
);

export const useLineCharges = line_charges.useList;
export const useGetLineCharge = line_charges.useOne;
export const useCreateLineCharge = line_charges.useCreate;
export const useUpdateLineCharge = line_charges.useUpdate;
export const useDeleteLineCharge = line_charges.useRemove;

/** The cache keys, for an invalidation this file does not already do. */
export const lineChargeKeys = line_charges.keys;
