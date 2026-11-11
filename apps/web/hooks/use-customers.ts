import type { Customer } from "@repo/shared/types";
import type { CreateCustomerInput, UpdateCustomerInput } from "@repo/shared/schemas";
import { resourceHooks } from "./use-resource";

// React Query hooks for customers.
//
// The bodies live in ./use-resource.ts, so a fix to the hook shape, a new
// query parameter or a change to how the cache is invalidated reaches every
// resource in this project at once. Edit this file to change what THIS
// resource does; edit use-resource.ts to change what they all do.
const customers = resourceHooks<Customer, CreateCustomerInput, UpdateCustomerInput>(
  "customers",
  "/api/customers",
);

export const useCustomers = customers.useList;
export const useGetCustomer = customers.useOne;
export const useCreateCustomer = customers.useCreate;
export const useUpdateCustomer = customers.useUpdate;
export const useDeleteCustomer = customers.useRemove;

/** The cache keys, for an invalidation this file does not already do. */
export const customerKeys = customers.keys;
