import { z } from "zod";

export const InvoiceSchema = z.object({
  id: z.string(),
  number: z.string(),
  status: z.enum(["draft", "sent", "paid"]),
  sent: z.boolean(),
  customer_id: z.string().uuid("Invalid ID"),
  customer: z.unknown().optional(),
  items: z.unknown().optional(),
  version: z.number().int(),
  created_at: z.string(),
  updated_at: z.string(),
  archived_at: z.string().nullable().optional(),
});

export const CreateInvoiceSchema = z.object({
  due_date: z.string().nullable().optional(),
  number: z.string().optional(),
  status: z.enum(["draft", "sent", "paid"]),
  sent: z.boolean().optional(),
  customer_id: z.string().uuid("Invalid ID"),
});

export const UpdateInvoiceSchema = z.object({
  due_date: z.string().nullable().optional(),
  number: z.string().optional(),
  status: z.enum(["draft", "sent", "paid"]).optional(),
  sent: z.boolean().optional(),
  customer_id: z.string().uuid("Invalid ID").optional(),
});

export type Invoice = z.infer<typeof InvoiceSchema>;
export type CreateInvoiceInput = z.infer<typeof CreateInvoiceSchema>;
export type UpdateInvoiceInput = z.infer<typeof UpdateInvoiceSchema>;
