"use client";

import { ResourcePage } from "@/components/resource/resource-page";
import { invoiceItemResource } from "@/resources/invoice-items/invoice-items";

export default function InvoiceItemsPage() {
  return <ResourcePage resource={invoiceItemResource} />;
}
