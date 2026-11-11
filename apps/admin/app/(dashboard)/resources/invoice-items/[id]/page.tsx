"use client";

import { use } from "react";
import { ResourceDetailPage } from "@/components/resource/resource-detail-page";
import { invoiceItemResource } from "@/resources/invoice-items/invoice-items";

export default function InvoiceItemsDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <ResourceDetailPage resource={invoiceItemResource} id={id} />;
}
