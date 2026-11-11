import { z } from "zod";

export const CustomerSchema = z.object({
  id: z.string(),
  name: z.string().min(1, "Required"),
  email: z.string().min(1, "Required"),
  company: z.string().min(1, "Required"),
  version: z.number().int(),
  created_at: z.string(),
  updated_at: z.string(),
  archived_at: z.string().nullable().optional(),
});

export const CreateCustomerSchema = z.object({
  name: z.string().min(1, "Required"),
  email: z.string().min(1, "Required"),
  company: z.string().min(1, "Required"),
});

export const UpdateCustomerSchema = z.object({
  name: z.string().min(1, "Required").optional(),
  email: z.string().min(1, "Required").optional(),
  company: z.string().min(1, "Required").optional(),
});

export type Customer = z.infer<typeof CustomerSchema>;
export type CreateCustomerInput = z.infer<typeof CreateCustomerSchema>;
export type UpdateCustomerInput = z.infer<typeof UpdateCustomerSchema>;
