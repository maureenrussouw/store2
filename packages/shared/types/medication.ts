import type { Prescription } from "./prescription";

export interface Medication {
  id: string;
  name: string;
  dose: string;
  quantity: number;
  prescription_id: string;
  prescription?: Prescription;
  version: number;
  created_at: string;
  updated_at: string;
  archived_at?: string | null;
}
