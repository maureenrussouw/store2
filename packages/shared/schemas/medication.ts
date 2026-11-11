import { z } from "zod";

export const MedicationSchema = z.object({
  id: z.string(),
  name: z.string().min(1, "Required"),
  dose: z.string().min(1, "Required"),
  quantity: z.number().int(),
  prescription_id: z.string().uuid("Invalid ID"),
  prescription: z.unknown().optional(),
  version: z.number().int(),
  created_at: z.string(),
  updated_at: z.string(),
  archived_at: z.string().nullable().optional(),
});

export const CreateMedicationSchema = z.object({
  name: z.string().min(1, "Required"),
  dose: z.string().min(1, "Required"),
  quantity: z.number().int().optional(),
  prescription_id: z.string().uuid("Invalid ID"),
});

export const UpdateMedicationSchema = z.object({
  name: z.string().min(1, "Required").optional(),
  dose: z.string().min(1, "Required").optional(),
  quantity: z.number().int().optional(),
  prescription_id: z.string().uuid("Invalid ID").optional(),
});

export type Medication = z.infer<typeof MedicationSchema>;
export type CreateMedicationInput = z.infer<typeof CreateMedicationSchema>;
export type UpdateMedicationInput = z.infer<typeof UpdateMedicationSchema>;
