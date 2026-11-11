"use client";

import { ResourcePage } from "@/components/resource/resource-page";
import { lineChargeResource } from "@/resources/line-charges/line-charges";

export default function LineChargesPage() {
  return <ResourcePage resource={lineChargeResource} />;
}
