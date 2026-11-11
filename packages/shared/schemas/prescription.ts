import { z } from "zod";

export const PrescriptionSchema = z.object({
  id: z.string(),
  code: z.string().min(1, "Required"),
  status: z.enum(["draft", "issued", "dispensed"]),
  priority: z.enum(["routine", "urgent"]),
  patient_id: z.string().uuid("Invalid ID"),
  patient: z.unknown().optional(),
  items: z.unknown().optional(),
  version: z.number().int(),
  created_at: z.string(),
  updated_at: z.string(),
  archived_at: z.string().nullable().optional(),
});

export const CreatePrescriptionSchema = z.object({
  code: z.string().min(1, "Required"),
  status: z.enum(["draft", "issued", "dispensed"]),
  priority: z.enum(["routine", "urgent"]),
  patient_id: z.string().uuid("Invalid ID"),
});

export const UpdatePrescriptionSchema = z.object({
  code: z.string().min(1, "Required").optional(),
  status: z.enum(["draft", "issued", "dispensed"]).optional(),
  priority: z.enum(["routine", "urgent"]).optional(),
  patient_id: z.string().uuid("Invalid ID").optional(),
});

export type Prescription = z.infer<typeof PrescriptionSchema>;
export type CreatePrescriptionInput = z.infer<typeof CreatePrescriptionSchema>;
export type UpdatePrescriptionInput = z.infer<typeof UpdatePrescriptionSchema>;
