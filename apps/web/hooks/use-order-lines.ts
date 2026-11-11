import type { OrderLine } from "@repo/shared/types";
import type { CreateOrderLineInput, UpdateOrderLineInput } from "@repo/shared/schemas";
import { resourceHooks } from "./use-resource";

// React Query hooks for order_lines.
//
// The bodies live in ./use-resource.ts, so a fix to the hook shape, a new
// query parameter or a change to how the cache is invalidated reaches every
// resource in this project at once. Edit this file to change what THIS
// resource does; edit use-resource.ts to change what they all do.
const order_lines = resourceHooks<OrderLine, CreateOrderLineInput, UpdateOrderLineInput>(
  "order_lines",
  "/api/order_lines",
);

export const useOrderLines = order_lines.useList;
export const useGetOrderLine = order_lines.useOne;
export const useCreateOrderLine = order_lines.useCreate;
export const useUpdateOrderLine = order_lines.useUpdate;
export const useDeleteOrderLine = order_lines.useRemove;

/** The cache keys, for an invalidation this file does not already do. */
export const orderLineKeys = order_lines.keys;
