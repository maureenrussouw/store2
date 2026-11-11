"use client";

import { use } from "react";
import { ResourceDetailPage } from "@/components/resource/resource-detail-page";
import { repaymentResource } from "@/resources/repayments/repayments";

export default function RepaymentsDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <ResourceDetailPage resource={repaymentResource} id={id} />;
}
