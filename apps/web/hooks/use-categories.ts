import type { Category } from "@repo/shared/types";
import type { CreateCategoryInput, UpdateCategoryInput } from "@repo/shared/schemas";
import { resourceHooks } from "./use-resource";

// React Query hooks for categories.
//
// The bodies live in ./use-resource.ts, so a fix to the hook shape, a new
// query parameter or a change to how the cache is invalidated reaches every
// resource in this project at once. Edit this file to change what THIS
// resource does; edit use-resource.ts to change what they all do.
const categories = resourceHooks<Category, CreateCategoryInput, UpdateCategoryInput>(
  "categories",
  "/api/categories",
);

export const useCategories = categories.useList;
export const useGetCategory = categories.useOne;
export const useCreateCategory = categories.useCreate;
export const useUpdateCategory = categories.useUpdate;
export const useDeleteCategory = categories.useRemove;

/** The cache keys, for an invalidation this file does not already do. */
export const categoryKeys = categories.keys;
