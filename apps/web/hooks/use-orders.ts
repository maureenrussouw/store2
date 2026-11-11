import type { Order } from "@repo/shared/types";
import type { CreateOrderInput, UpdateOrderInput } from "@repo/shared/schemas";
import { resourceHooks } from "./use-resource";

// React Query hooks for orders.
//
// The bodies live in ./use-resource.ts, so a fix to the hook shape, a new
// query parameter or a change to how the cache is invalidated reaches every
// resource in this project at once. Edit this file to change what THIS
// resource does; edit use-resource.ts to change what they all do.
const orders = resourceHooks<Order, CreateOrderInput, UpdateOrderInput>(
  "orders",
  "/api/orders",
);

export const useOrders = orders.useList;
export const useGetOrder = orders.useOne;
export const useCreateOrder = orders.useCreate;
export const useUpdateOrder = orders.useUpdate;
export const useDeleteOrder = orders.useRemove;

/** The cache keys, for an invalidation this file does not already do. */
export const orderKeys = orders.keys;
