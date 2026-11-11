import { defineResource } from "@/lib/resource";
import { CreateLineChargeSchema } from "@repo/shared/schemas";
import custom from "./line-charges.custom";

export const lineChargeResource = defineResource({
  name: "LineCharge",
  slug: "line-charges",
  hidden: true,
  endpoint: "/api/line_charges",
  icon: "Database",
  label: { singular: "Line Charge", plural: "Line Charges" },
  table: {
    columns: [
      // grit:cols:auto-start
      { key: "description", label: "Description", sortable: true, searchable: true, onClick: "link" },
      { key: "qty", label: "Qty", sortable: true },
      { key: "unit_price", label: "Unit Price", sortable: true },
      { key: "subscription.name", label: "Subscription" },
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
    schema: CreateLineChargeSchema,
    fields: [
      // grit:fields:auto-start
    { key: "description", label: "Description", type: "text", required: true },
    { key: "qty", label: "Qty", type: "number", numberKind: "int" },
    { key: "unit_price", label: "Unit Price", type: "number", numberKind: "float" },
    { key: "subscription_id", label: "Subscription", type: "relationship-select", required: true, relatedEndpoint: "/api/subscriptions", displayField: "name" },
      // grit:fields:auto-end
    ],
  },
  dashboard: {
    widgets: [
      {
        type: "stat",
        label: "Total LineCharges",
        endpoint: "/api/line_charges",
        icon: "Database",
        color: "accent",
      },
    ],
  },
}, custom);
