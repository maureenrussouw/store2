import type { Order } from "./order";

export interface OrderLine {
  id: string;
  product: string;
  qty: number;
  unit_price: number;
  order_id: string;
  order?: Order;
  version: number;
  created_at: string;
  updated_at: string;
  archived_at?: string | null;
}
