"use client";

import { ResourcePage } from "@/components/resource/resource-page";
import { customerResource } from "@/resources/customers/customers";

export default function CustomersPage() {
  return <ResourcePage resource={customerResource} />;
}
