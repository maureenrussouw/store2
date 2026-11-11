import type { InvoiceItem } from "@repo/shared/types";
import type { CreateInvoiceItemInput, UpdateInvoiceItemInput } from "@repo/shared/schemas";
import { resourceHooks } from "./use-resource";

// React Query hooks for invoice_items.
//
// The bodies live in ./use-resource.ts, so a fix to the hook shape, a new
// query parameter or a change to how the cache is invalidated reaches every
// resource in this project at once. Edit this file to change what THIS
// resource does; edit use-resource.ts to change what they all do.
const invoice_items = resourceHooks<InvoiceItem, CreateInvoiceItemInput, UpdateInvoiceItemInput>(
  "invoice_items",
  "/api/invoice_items",
);

export const useInvoiceItems = invoice_items.useList;
export const useGetInvoiceItem = invoice_items.useOne;
export const useCreateInvoiceItem = invoice_items.useCreate;
export const useUpdateInvoiceItem = invoice_items.useUpdate;
export const useDeleteInvoiceItem = invoice_items.useRemove;

/** The cache keys, for an invalidation this file does not already do. */
export const invoiceItemKeys = invoice_items.keys;
