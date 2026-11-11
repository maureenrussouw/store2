import type { Customer } from "./customer";
import type { OrderLine } from "./order-line";

export interface Order {
  id: string;
  number: string;
  status: "pending" | "paid" | "shipped" | "delivered";
  fulfillment: "standard" | "express";
  customer_id: string;
  customer?: Customer;
  items?: OrderLine[];
  version: number;
  created_at: string;
  updated_at: string;
  archived_at?: string | null;
}
