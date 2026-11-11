"use client";

import { ResourcePage } from "@/components/resource/resource-page";
import { repaymentResource } from "@/resources/repayments/repayments";

export default function RepaymentsPage() {
  return <ResourcePage resource={repaymentResource} />;
}
