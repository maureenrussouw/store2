import { defineResource } from "@/lib/resource";
import { CreateOrderLineSchema } from "@repo/shared/schemas";
import custom from "./order-lines.custom";

export const orderLineResource = defineResource({
  name: "OrderLine",
  slug: "order-lines",
  hidden: true,
  endpoint: "/api/order_lines",
  icon: "ShoppingCart",
  label: { singular: "Order Line", plural: "Order Lines" },
  table: {
    columns: [
      // grit:cols:auto-start
      { key: "product", label: "Product", sortable: true, searchable: true, onClick: "link" },
      { key: "qty", label: "Qty", sortable: true },
      { key: "unit_price", label: "Unit Price", sortable: true },
      { key: "order.name", label: "Order" },
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
    schema: CreateOrderLineSchema,
    fields: [
      // grit:fields:auto-start
    { key: "product", label: "Product", type: "text", required: true },
    { key: "qty", label: "Qty", type: "number", numberKind: "int" },
    { key: "unit_price", label: "Unit Price", type: "number", numberKind: "float" },
    { key: "order_id", label: "Order", type: "relationship-select", required: true, relatedEndpoint: "/api/orders", displayField: "name" },
      // grit:fields:auto-end
    ],
  },
  dashboard: {
    widgets: [
      {
        type: "stat",
        label: "Total OrderLines",
        endpoint: "/api/order_lines",
        icon: "ShoppingCart",
        color: "accent",
      },
    ],
  },
}, custom);
