import { z } from "zod";

export const SubscriptionSchema = z.object({
  id: z.string(),
  plan: z.enum(["starter", "pro", "enterprise"]),
  status: z.enum(["trialing", "active", "past_due", "canceled"]),
  auto_renew: z.boolean(),
  customer_id: z.string().uuid("Invalid ID"),
  customer: z.unknown().optional(),
  items: z.unknown().optional(),
  version: z.number().int(),
  created_at: z.string(),
  updated_at: z.string(),
  archived_at: z.string().nullable().optional(),
});

export const CreateSubscriptionSchema = z.object({
  plan: z.enum(["starter", "pro", "enterprise"]),
  status: z.enum(["trialing", "active", "past_due", "canceled"]),
  auto_renew: z.boolean().optional(),
  customer_id: z.string().uuid("Invalid ID"),
});

export const UpdateSubscriptionSchema = z.object({
  plan: z.enum(["starter", "pro", "enterprise"]).optional(),
  status: z.enum(["trialing", "active", "past_due", "canceled"]).optional(),
  auto_renew: z.boolean().optional(),
  customer_id: z.string().uuid("Invalid ID").optional(),
});

export type Subscription = z.infer<typeof SubscriptionSchema>;
export type CreateSubscriptionInput = z.infer<typeof CreateSubscriptionSchema>;
export type UpdateSubscriptionInput = z.infer<typeof UpdateSubscriptionSchema>;
