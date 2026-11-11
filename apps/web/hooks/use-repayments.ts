import type { Repayment } from "@repo/shared/types";
import type { CreateRepaymentInput, UpdateRepaymentInput } from "@repo/shared/schemas";
import { resourceHooks } from "./use-resource";

// React Query hooks for repayments.
//
// The bodies live in ./use-resource.ts, so a fix to the hook shape, a new
// query parameter or a change to how the cache is invalidated reaches every
// resource in this project at once. Edit this file to change what THIS
// resource does; edit use-resource.ts to change what they all do.
const repayments = resourceHooks<Repayment, CreateRepaymentInput, UpdateRepaymentInput>(
  "repayments",
  "/api/repayments",
);

export const useRepayments = repayments.useList;
export const useGetRepayment = repayments.useOne;
export const useCreateRepayment = repayments.useCreate;
export const useUpdateRepayment = repayments.useUpdate;
export const useDeleteRepayment = repayments.useRemove;

/** The cache keys, for an invalidation this file does not already do. */
export const repaymentKeys = repayments.keys;
