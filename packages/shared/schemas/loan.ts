import { z } from "zod";

export const LoanSchema = z.object({
  id: z.string(),
  reference: z.string().min(1, "Required"),
  status: z.enum(["pending", "active", "closed", "defaulted"]),
  risk: z.enum(["low", "medium", "high"]),
  borrower_id: z.string().uuid("Invalid ID"),
  borrower: z.unknown().optional(),
  items: z.unknown().optional(),
  version: z.number().int(),
  created_at: z.string(),
  updated_at: z.string(),
  archived_at: z.string().nullable().optional(),
});

export const CreateLoanSchema = z.object({
  reference: z.string().min(1, "Required"),
  status: z.enum(["pending", "active", "closed", "defaulted"]),
  risk: z.enum(["low", "medium", "high"]),
  borrower_id: z.string().uuid("Invalid ID"),
});

export const UpdateLoanSchema = z.object({
  reference: z.string().min(1, "Required").optional(),
  status: z.enum(["pending", "active", "closed", "defaulted"]).optional(),
  risk: z.enum(["low", "medium", "high"]).optional(),
  borrower_id: z.string().uuid("Invalid ID").optional(),
});

export type Loan = z.infer<typeof LoanSchema>;
export type CreateLoanInput = z.infer<typeof CreateLoanSchema>;
export type UpdateLoanInput = z.infer<typeof UpdateLoanSchema>;
