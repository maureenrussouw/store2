import { z } from "zod";

export const OrderSchema = z.object({
  id: z.string(),
  number: z.string().min(1, "Required"),
  status: z.enum(["pending", "paid", "shipped", "delivered"]),
  fulfillment: z.enum(["standard", "express"]),
  customer_id: z.string().uuid("Invalid ID"),
  customer: z.unknown().optional(),
  items: z.unknown().optional(),
  version: z.number().int(),
  created_at: z.string(),
  updated_at: z.string(),
  archived_at: z.string().nullable().optional(),
});

export const CreateOrderSchema = z.object({
  number: z.string().min(1, "Required"),
  status: z.enum(["pending", "paid", "shipped", "delivered"]),
  fulfillment: z.enum(["standard", "express"]),
  customer_id: z.string().uuid("Invalid ID"),
});

export const UpdateOrderSchema = z.object({
  number: z.string().min(1, "Required").optional(),
  status: z.enum(["pending", "paid", "shipped", "delivered"]).optional(),
  fulfillment: z.enum(["standard", "express"]).optional(),
  customer_id: z.string().uuid("Invalid ID").optional(),
});

export type Order = z.infer<typeof OrderSchema>;
export type CreateOrderInput = z.infer<typeof CreateOrderSchema>;
export type UpdateOrderInput = z.infer<typeof UpdateOrderSchema>;
