import type { Customer } from "./customer";
import type { Medication } from "./medication";

export interface Prescription {
  id: string;
  code: string;
  status: "draft" | "issued" | "dispensed";
  priority: "routine" | "urgent";
  patient_id: string;
  patient?: Customer;
  items?: Medication[];
  version: number;
  created_at: string;
  updated_at: string;
  archived_at?: string | null;
}
