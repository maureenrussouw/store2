import { usersResource } from "./users/users";
import { blogsResource } from "./blogs/blogs";
import { categoryResource } from "./categories/categories";
import { productResource } from "./products/products";
import { customerResource } from "./customers/customers";
import { invoiceItemResource } from "./invoice-items/invoice-items";
import { invoiceResource } from "./invoices/invoices";
import { orderLineResource } from "./order-lines/order-lines";
import { orderResource } from "./orders/orders";
import { repaymentResource } from "./repayments/repayments";
import { loanResource } from "./loans/loans";
import { lineChargeResource } from "./line-charges/line-charges";
import { subscriptionResource } from "./subscriptions/subscriptions";
import { medicationResource } from "./medications/medications";
import { prescriptionResource } from "./prescriptions/prescriptions";
// grit:resources

import type { ResourceDefinition } from "@/lib/resource";

export const resources: ResourceDefinition[] = [
  usersResource,
  blogsResource,
  categoryResource,
  productResource,
  customerResource,
  invoiceItemResource,
  invoiceResource,
  orderLineResource,
  orderResource,
  repaymentResource,
  loanResource,
  lineChargeResource,
  subscriptionResource,
  medicationResource,
  prescriptionResource,
  // grit:resource-list
];

export function getResource(slug: string): ResourceDefinition | undefined {
  return resources.find((r) => r.slug === slug);
}

export function getResourceByEndpoint(endpoint: string): ResourceDefinition | undefined {
  return resources.find((r) => r.endpoint === endpoint);
}
