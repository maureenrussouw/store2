import type { Subscription } from "./subscription";

export interface LineCharge {
  id: string;
  description: string;
  qty: number;
  unit_price: number;
  subscription_id: string;
  subscription?: Subscription;
  version: number;
  created_at: string;
  updated_at: string;
  archived_at?: string | null;
}
