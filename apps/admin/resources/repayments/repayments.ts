import { defineResource } from "@/lib/resource";
import { CreateRepaymentSchema } from "@repo/shared/schemas";
import custom from "./repayments.custom";

export const repaymentResource = defineResource({
  name: "Repayment",
  slug: "repayments",
  hidden: true,
  endpoint: "/api/repayments",
  icon: "CreditCard",
  label: { singular: "Repayment", plural: "Repayments" },
  table: {
    columns: [
      // grit:cols:auto-start
      { key: "due_date", label: "Due Date", sortable: true, format: "date", onClick: "link" },
      { key: "amount", label: "Amount", sortable: true },
      { key: "paid", label: "Paid" },
      { key: "loan.name", label: "Loan" },
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
    schema: CreateRepaymentSchema,
    fields: [
      // grit:fields:auto-start
    { key: "due_date", label: "Due Date", type: "date" },
    { key: "amount", label: "Amount", type: "number", numberKind: "float" },
    { key: "paid", label: "Paid", type: "toggle" },
    { key: "loan_id", label: "Loan", type: "relationship-select", required: true, relatedEndpoint: "/api/loans", displayField: "name" },
      // grit:fields:auto-end
    ],
  },
  dashboard: {
    widgets: [
      {
        type: "stat",
        label: "Total Repayments",
        endpoint: "/api/repayments",
        icon: "CreditCard",
        color: "accent",
      },
    ],
  },
  // One card per value, counted over the rows the table is showing. Generated
  // from the model: paid. Delete a line to drop its cards, or set
  // stats: { countBy: [] } to keep only the four defaults.
  stats: {
    countBy: [
      {
        field: "paid",
        labels: { "true": "Paid", "1": "Paid", "false": "Unpaid", "0": "Unpaid" },
        only: ["true", "false"],
        icon: "ToggleLeft",
      },
    ],
  },
  // The collapsible charts above the table: created over time, and these
  // columns by value. Nothing is requested until somebody opens the panel.
  insights: {
    breakdown: ["paid"],
    labels: {
      paid: { "true": "Paid", "1": "Paid", "false": "Unpaid", "0": "Unpaid" },
    },
  },
}, custom);
