import { z } from "zod";

export const OrderLineSchema = z.object({
  id: z.string(),
  product: z.string().min(1, "Required"),
  qty: z.number().int(),
  unit_price: z.number(),
  order_id: z.string().uuid("Invalid ID"),
  order: z.unknown().optional(),
  version: z.number().int(),
  created_at: z.string(),
  updated_at: z.string(),
  archived_at: z.string().nullable().optional(),
});

export const CreateOrderLineSchema = z.object({
  product: z.string().min(1, "Required"),
  qty: z.number().int().optional(),
  unit_price: z.number().optional(),
  order_id: z.string().uuid("Invalid ID"),
});

export const UpdateOrderLineSchema = z.object({
  product: z.string().min(1, "Required").optional(),
  qty: z.number().int().optional(),
  unit_price: z.number().optional(),
  order_id: z.string().uuid("Invalid ID").optional(),
});

export type OrderLine = z.infer<typeof OrderLineSchema>;
export type CreateOrderLineInput = z.infer<typeof CreateOrderLineSchema>;
export type UpdateOrderLineInput = z.infer<typeof UpdateOrderLineSchema>;
