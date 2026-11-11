import type { Customer } from "./customer";
import type { LineCharge } from "./line-charge";

export interface Subscription {
  id: string;
  plan: "starter" | "pro" | "enterprise";
  status: "trialing" | "active" | "past_due" | "canceled";
  auto_renew: boolean;
  customer_id: string;
  customer?: Customer;
  items?: LineCharge[];
  version: number;
  created_at: string;
  updated_at: string;
  archived_at?: string | null;
}
