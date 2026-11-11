"use client";

import { use } from "react";
import { ResourceDetailPage } from "@/components/resource/resource-detail-page";
import { prescriptionResource } from "@/resources/prescriptions/prescriptions";

export default function PrescriptionsDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <ResourceDetailPage resource={prescriptionResource} id={id} />;
}
