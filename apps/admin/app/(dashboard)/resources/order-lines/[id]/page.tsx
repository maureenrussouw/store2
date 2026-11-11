"use client";

import { use } from "react";
import { ResourceDetailPage } from "@/components/resource/resource-detail-page";
import { orderLineResource } from "@/resources/order-lines/order-lines";

export default function OrderLinesDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <ResourceDetailPage resource={orderLineResource} id={id} />;
}
