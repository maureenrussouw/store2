import type { Customer } from "./customer";
import type { InvoiceItem } from "./invoice-item";

export interface Invoice {
  due_date: string | null;
  id: string;
  number: string;
  status: "draft" | "sent" | "paid";
  sent: boolean;
  customer_id: string;
  customer?: Customer;
  items?: InvoiceItem[];
  version: number;
  created_at: string;
  updated_at: string;
  archived_at?: string | null;
}
