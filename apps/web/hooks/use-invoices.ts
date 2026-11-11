import type { Invoice } from "@repo/shared/types";
import type { CreateInvoiceInput, UpdateInvoiceInput } from "@repo/shared/schemas";
import { resourceHooks } from "./use-resource";

// React Query hooks for invoices.
//
// The bodies live in ./use-resource.ts, so a fix to the hook shape, a new
// query parameter or a change to how the cache is invalidated reaches every
// resource in this project at once. Edit this file to change what THIS
// resource does; edit use-resource.ts to change what they all do.
const invoices = resourceHooks<Invoice, CreateInvoiceInput, UpdateInvoiceInput>(
  "invoices",
  "/api/invoices",
);

export const useInvoices = invoices.useList;
export const useGetInvoice = invoices.useOne;
export const useCreateInvoice = invoices.useCreate;
export const useUpdateInvoice = invoices.useUpdate;
export const useDeleteInvoice = invoices.useRemove;

/** The cache keys, for an invalidation this file does not already do. */
export const invoiceKeys = invoices.keys;
