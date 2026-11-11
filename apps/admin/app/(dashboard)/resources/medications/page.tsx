"use client";

import { ResourcePage } from "@/components/resource/resource-page";
import { medicationResource } from "@/resources/medications/medications";

export default function MedicationsPage() {
  return <ResourcePage resource={medicationResource} />;
}
