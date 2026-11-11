import { z } from "zod";

export const RepaymentSchema = z.object({
  id: z.string(),
  due_date: z.string().nullable(),
  amount: z.number(),
  paid: z.boolean(),
  loan_id: z.string().uuid("Invalid ID"),
  loan: z.unknown().optional(),
  version: z.number().int(),
  created_at: z.string(),
  updated_at: z.string(),
  archived_at: z.string().nullable().optional(),
});

export const CreateRepaymentSchema = z.object({
  due_date: z.string().nullable().optional(),
  amount: z.number().optional(),
  paid: z.boolean().optional(),
  loan_id: z.string().uuid("Invalid ID"),
});

export const UpdateRepaymentSchema = z.object({
  due_date: z.string().nullable().optional(),
  amount: z.number().optional(),
  paid: z.boolean().optional(),
  loan_id: z.string().uuid("Invalid ID").optional(),
});

export type Repayment = z.infer<typeof RepaymentSchema>;
export type CreateRepaymentInput = z.infer<typeof CreateRepaymentSchema>;
export type UpdateRepaymentInput = z.infer<typeof UpdateRepaymentSchema>;
