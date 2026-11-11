import type { Invoice } from "./invoice";

export interface InvoiceItem {
  id: string;
  description: string;
  qty: number;
  unit_rate: number;
  invoice_id: string;
  invoice?: Invoice;
  version: number;
  created_at: string;
  updated_at: string;
  archived_at?: string | null;
}
