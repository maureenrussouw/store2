"use client";

import { ResourcePage } from "@/components/resource/resource-page";
import { orderResource } from "@/resources/orders/orders";

export default function OrdersPage() {
  return <ResourcePage resource={orderResource} />;
}
