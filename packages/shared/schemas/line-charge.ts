import { z } from "zod";

export const LineChargeSchema = z.object({
  id: z.string(),
  description: z.string(),
  qty: z.number().int(),
  unit_price: z.number(),
  subscription_id: z.string().uuid("Invalid ID"),
  subscription: z.unknown().optional(),
  version: z.number().int(),
  created_at: z.string(),
  updated_at: z.string(),
  archived_at: z.string().nullable().optional(),
});

export const CreateLineChargeSchema = z.object({
  description: z.string(),
  qty: z.number().int().optional(),
  unit_price: z.number().optional(),
  subscription_id: z.string().uuid("Invalid ID"),
});

export const UpdateLineChargeSchema = z.object({
  description: z.string().optional(),
  qty: z.number().int().optional(),
  unit_price: z.number().optional(),
  subscription_id: z.string().uuid("Invalid ID").optional(),
});

export type LineCharge = z.infer<typeof LineChargeSchema>;
export type CreateLineChargeInput = z.infer<typeof CreateLineChargeSchema>;
export type UpdateLineChargeInput = z.infer<typeof UpdateLineChargeSchema>;
