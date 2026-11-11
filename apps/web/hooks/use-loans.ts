import type { Loan } from "@repo/shared/types";
import type { CreateLoanInput, UpdateLoanInput } from "@repo/shared/schemas";
import { resourceHooks } from "./use-resource";

// React Query hooks for loans.
//
// The bodies live in ./use-resource.ts, so a fix to the hook shape, a new
// query parameter or a change to how the cache is invalidated reaches every
// resource in this project at once. Edit this file to change what THIS
// resource does; edit use-resource.ts to change what they all do.
const loans = resourceHooks<Loan, CreateLoanInput, UpdateLoanInput>(
  "loans",
  "/api/loans",
);

export const useLoans = loans.useList;
export const useGetLoan = loans.useOne;
export const useCreateLoan = loans.useCreate;
export const useUpdateLoan = loans.useUpdate;
export const useDeleteLoan = loans.useRemove;

/** The cache keys, for an invalidation this file does not already do. */
export const loanKeys = loans.keys;
