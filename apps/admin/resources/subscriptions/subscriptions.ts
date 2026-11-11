import { defineResource } from "@/lib/resource";
import { CreateSubscriptionSchema } from "@repo/shared/schemas";
import custom from "./subscriptions.custom";

export const subscriptionResource = defineResource({
  name: "Subscription",
  slug: "subscriptions",
  endpoint: "/api/subscriptions",
  icon: "CreditCard",
  label: { singular: "Subscription", plural: "Subscriptions" },
  table: {
    columns: [
      // grit:cols:auto-start
      { key: "plan", label: "Plan", onClick: "link" },
      { key: "status", label: "Status" },
      { key: "auto_renew", label: "Auto Renew" },
      { key: "customer.name", label: "Customer" },
      { key: "created_at", label: "Created", sortable: true, format: "relative" },
      // grit:cols:auto-end
    ],
    filters: [
    ],
    defaultSort: { key: "created_at", direction: "desc" },
    searchable: true,
    pageSize: 20,
    // Shown once rows are ticked. Drop "archive" here and the Archived tab
    // goes with it; the model keeps its archived_at either way.
    bulkActions: ["edit", "archive", "restore", "export", "delete"],
  },
  form: {
    // The same schema the API validates the request against, so the form and
    // the server agree about what is required rather than agreeing by
    // coincidence because one generator wrote both sets of rules (grit#145).
    //
    // It is ANDed with the per-field rules below, not instead of them: those
    // know a rating's max and whether a conditional field is even visible,
    // and this knows a refinement that reads a sibling field.
    //
    // Remove it and the form falls back to the field rules alone, which is
    // what every form did before v3.475.0.
    schema: CreateSubscriptionSchema,
    fields: [
      // grit:fields:auto-start
    { key: "plan", label: "Plan", type: "select", required: true, options: [{ value: "starter", label: "Starter" }, { value: "pro", label: "Pro" }, { value: "enterprise", label: "Enterprise" }] },
    { key: "status", label: "Status", type: "select", required: true, options: [{ value: "trialing", label: "Trialing" }, { value: "active", label: "Active" }, { value: "past_due", label: "Past Due" }, { value: "canceled", label: "Canceled" }] },
    { key: "auto_renew", label: "Auto Renew", type: "toggle" },
    { key: "customer_id", label: "Customer", type: "relationship-select", required: true, relatedEndpoint: "/api/customers", displayField: "name" },
    { key: "items", label: "Line Charges", type: "line-items", colSpan: 2, itemEndpoint: "/api/line_charges", foreignKey: "subscription_id", itemFields: [
        { key: "description", label: "Description", type: "text" },
        { key: "qty", label: "Qty", type: "number", numberKind: "int" },
        { key: "unit_price", label: "Unit Price", type: "number", numberKind: "float" },
    ] },
      // grit:fields:auto-end
    ],
  },
  dashboard: {
    widgets: [
      {
        type: "stat",
        label: "Total Subscriptions",
        endpoint: "/api/subscriptions",
        icon: "CreditCard",
        color: "accent",
      },
    ],
  },
  // One card per value, counted over the rows the table is showing. Generated
  // from the model: plan, status, auto_renew. Delete a line to drop its cards, or set
  // stats: { countBy: [] } to keep only the four defaults.
  stats: {
    countBy: [
      {
        field: "plan",
        label: "Plan",
        labels: { "starter": "Starter", "pro": "Pro", "enterprise": "Enterprise" },
        only: ["starter", "pro", "enterprise"],
      },
      {
        field: "status",
        label: "Status",
        labels: { "trialing": "Trialing", "active": "Active", "past_due": "Past Due", "canceled": "Canceled" },
        only: ["trialing", "active", "past_due", "canceled"],
      },
      {
        field: "auto_renew",
        labels: { "true": "Auto renew", "1": "Auto renew", "false": "Not Auto renew", "0": "Not Auto renew" },
        only: ["true", "false"],
        icon: "ToggleLeft",
      },
    ],
  },
  // The collapsible charts above the table: created over time, and these
  // columns by value. Nothing is requested until somebody opens the panel.
  insights: {
    breakdown: ["plan", "status", "auto_renew"],
    labels: {
      plan: { "starter": "Starter", "pro": "Pro", "enterprise": "Enterprise" },
      status: { "trialing": "Trialing", "active": "Active", "past_due": "Past Due", "canceled": "Canceled" },
      auto_renew: { "true": "Auto renew", "1": "Auto renew", "false": "Not Auto renew", "0": "Not Auto renew" },
    },
  },
}, custom);
