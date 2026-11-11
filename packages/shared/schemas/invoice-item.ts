import { z } from "zod";

export const InvoiceItemSchema = z.object({
  id: z.string(),
  description: z.string(),
  qty: z.number().int(),
  unit_rate: z.number(),
  invoice_id: z.string().uuid("Invalid ID"),
  invoice: z.unknown().optional(),
  version: z.number().int(),
  created_at: z.string(),
  updated_at: z.string(),
  archived_at: z.string().nullable().optional(),
});

export const CreateInvoiceItemSchema = z.object({
  description: z.string(),
  qty: z.number().int().optional(),
  unit_rate: z.number().optional(),
  invoice_id: z.string().uuid("Invalid ID"),
});

export const UpdateInvoiceItemSchema = z.object({
  description: z.string().optional(),
  qty: z.number().int().optional(),
  unit_rate: z.number().optional(),
  invoice_id: z.string().uuid("Invalid ID").optional(),
});

export type InvoiceItem = z.infer<typeof InvoiceItemSchema>;
export type CreateInvoiceItemInput = z.infer<typeof CreateInvoiceItemSchema>;
export type UpdateInvoiceItemInput = z.infer<typeof UpdateInvoiceItemSchema>;
