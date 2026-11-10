import { z } from "zod";

export const BlogSchema = z.object({
  id: z.string(),
  title: z.string().min(1, "Required"),
  slug: z.string(),
  content: z.string(),
  image: z.string(),
  excerpt: z.string(),
  published: z.boolean(),
  published_at: z.string().nullable(),
  version: z.number().int(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const CreateBlogSchema = z.object({
  title: z.string().min(1, "Required"),
  slug: z.string().optional(),
  content: z.string().optional(),
  image: z.string().optional(),
  excerpt: z.string().optional(),
  published: z.boolean().optional(),
  published_at: z.string().nullable().optional(),
});

export const UpdateBlogSchema = z.object({
  title: z.string().min(1, "Required").optional(),
  slug: z.string().optional(),
  content: z.string().optional(),
  image: z.string().optional(),
  excerpt: z.string().optional(),
  published: z.boolean().optional(),
  published_at: z.string().nullable().optional(),
});

export type Blog = z.infer<typeof BlogSchema>;
export type CreateBlogInput = z.infer<typeof CreateBlogSchema>;
export type UpdateBlogInput = z.infer<typeof UpdateBlogSchema>;
