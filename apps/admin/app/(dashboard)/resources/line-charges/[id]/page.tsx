"use client";

import { use } from "react";
import { ResourceDetailPage } from "@/components/resource/resource-detail-page";
import { lineChargeResource } from "@/resources/line-charges/line-charges";

export default function LineChargesDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <ResourceDetailPage resource={lineChargeResource} id={id} />;
}
