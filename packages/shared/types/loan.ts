import type { Customer } from "./customer";
import type { Repayment } from "./repayment";

export interface Loan {
  id: string;
  reference: string;
  status: "pending" | "active" | "closed" | "defaulted";
  risk: "low" | "medium" | "high";
  borrower_id: string;
  borrower?: Customer;
  items?: Repayment[];
  version: number;
  created_at: string;
  updated_at: string;
  archived_at?: string | null;
}
