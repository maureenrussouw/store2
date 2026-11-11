import type { Loan } from "./loan";

export interface Repayment {
  id: string;
  due_date: string | null;
  amount: number;
  paid: boolean;
  loan_id: string;
  loan?: Loan;
  version: number;
  created_at: string;
  updated_at: string;
  archived_at?: string | null;
}
