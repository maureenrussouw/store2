import { z } from "zod";
import { FileRefSchema } from "./file-ref";

export const ProductSchema = z.object({
  id: z.string(),
  name: z.string().min(1, "Required"),
  slug: z.string(),
  price: z.number().int(),
  description: z.string(),
  thumbnail: FileRefSchema.nullable(),
  images: z.array(FileRefSchema).default([]),
  category_id: z.string().uuid("Invalid ID"),
  category: z.unknown().optional(),
  parent_id: z.string().uuid("Invalid ID").or(z.literal("")).nullable(),
  parent: z.unknown().optional(),
  children: z.unknown().optional(),
  path: z.string(),
  depth: z.number().int(),
  position: z.number().int(),
  version: z.number().int(),
  created_at: z.string(),
  updated_at: z.string(),
  archived_at: z.string().nullable().optional(),
});

export const CreateProductSchema = z.object({
  name: z.string().min(1, "Required"),
  price: z.number().int().optional(),
  description: z.string().optional(),
  thumbnail: FileRefSchema.nullable().optional(),
  images: z.array(FileRefSchema).default([]),
  category_id: z.string().uuid("Invalid ID"),
  parent_id: z.string().uuid("Invalid ID").or(z.literal("")).nullable().optional(),
});

export const UpdateProductSchema = z.object({
  name: z.string().min(1, "Required").optional(),
  price: z.number().int().optional(),
  description: z.string().optional(),
  thumbnail: FileRefSchema.nullable().optional(),
  images: z.array(FileRefSchema).default([]).optional(),
  category_id: z.string().uuid("Invalid ID").optional(),
  parent_id: z.string().uuid("Invalid ID").or(z.literal("")).nullable().optional(),
});

export type Product = z.infer<typeof ProductSchema>;
export type CreateProductInput = z.infer<typeof CreateProductSchema>;
export type UpdateProductInput = z.infer<typeof UpdateProductSchema>;
