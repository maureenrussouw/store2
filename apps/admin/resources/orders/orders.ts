import { defineResource } from "@/lib/resource";
import { CreateOrderSchema } from "@repo/shared/schemas";
import custom from "./orders.custom";

export const orderResource = defineResource({
  name: "Order",
  slug: "orders",
  endpoint: "/api/orders",
  icon: "ShoppingCart",
  label: { singular: "Order", plural: "Orders" },
  table: {
    columns: [
      // grit:cols:auto-start
      { key: "number", label: "Number", sortable: true, searchable: true, onClick: "link" },
      { key: "status", label: "Status" },
      { key: "fulfillment", label: "Fulfillment" },
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
    schema: CreateOrderSchema,
    fields: [
      // grit:fields:auto-start
    { key: "number", label: "Number", type: "text", required: true },
    { key: "status", label: "Status", type: "select", required: true, options: [{ value: "pending", label: "Pending" }, { value: "paid", label: "Paid" }, { value: "shipped", label: "Shipped" }, { value: "delivered", label: "Delivered" }] },
    { key: "fulfillment", label: "Fulfillment", type: "radio", required: true, options: [{ value: "standard", label: "Standard" }, { value: "express", label: "Express" }] },
    { key: "customer_id", label: "Customer", type: "relationship-select", required: true, relatedEndpoint: "/api/customers", displayField: "name" },
    { key: "items", label: "Order Lines", type: "line-items", colSpan: 2, itemEndpoint: "/api/order_lines", foreignKey: "order_id", itemFields: [
        { key: "product", label: "Product", type: "text" },
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
        label: "Total Orders",
        endpoint: "/api/orders",
        icon: "ShoppingCart",
        color: "accent",
      },
    ],
  },
  // One card per value, counted over the rows the table is showing. Generated
  // from the model: status, fulfillment. Delete a line to drop its cards, or set
  // stats: { countBy: [] } to keep only the four defaults.
  stats: {
    countBy: [
      {
        field: "status",
        label: "Status",
        labels: { "pending": "Pending", "paid": "Paid", "shipped": "Shipped", "delivered": "Delivered" },
        only: ["pending", "paid", "shipped", "delivered"],
      },
      {
        field: "fulfillment",
        label: "Fulfillment",
        labels: { "standard": "Standard", "express": "Express" },
        only: ["standard", "express"],
      },
    ],
  },
  // The collapsible charts above the table: created over time, and these
  // columns by value. Nothing is requested until somebody opens the panel.
  insights: {
    breakdown: ["status", "fulfillment"],
    labels: {
      status: { "pending": "Pending", "paid": "Paid", "shipped": "Shipped", "delivered": "Delivered" },
      fulfillment: { "standard": "Standard", "express": "Express" },
    },
  },
}, custom);
