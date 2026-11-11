import type { Product } from "@repo/shared/types";
import type { CreateProductInput, UpdateProductInput } from "@repo/shared/schemas";
import { resourceHooks } from "./use-resource";

// React Query hooks for products.
//
// The bodies live in ./use-resource.ts, so a fix to the hook shape, a new
// query parameter or a change to how the cache is invalidated reaches every
// resource in this project at once. Edit this file to change what THIS
// resource does; edit use-resource.ts to change what they all do.
const products = resourceHooks<Product, CreateProductInput, UpdateProductInput>(
  "products",
  "/api/products",
);

export const useProducts = products.useList;
export const useGetProduct = products.useOne;
export const useCreateProduct = products.useCreate;
export const useUpdateProduct = products.useUpdate;
export const useDeleteProduct = products.useRemove;

/** The cache keys, for an invalidation this file does not already do. */
export const productKeys = products.keys;
