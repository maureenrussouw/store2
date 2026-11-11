"use client";

import { ResourcePage } from "@/components/resource/resource-page";
import { orderLineResource } from "@/resources/order-lines/order-lines";

export default function OrderLinesPage() {
  return <ResourcePage resource={orderLineResource} />;
}
