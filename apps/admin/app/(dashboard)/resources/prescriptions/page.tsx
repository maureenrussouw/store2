"use client";

import { ResourcePage } from "@/components/resource/resource-page";
import { prescriptionResource } from "@/resources/prescriptions/prescriptions";

export default function PrescriptionsPage() {
  return <ResourcePage resource={prescriptionResource} />;
}
