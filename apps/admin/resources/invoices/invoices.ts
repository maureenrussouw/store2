import { defineResource } from "@/lib/resource";
import { CreateInvoiceSchema } from "@repo/shared/schemas";
import custom from "./invoices.custom";

export const invoiceResource = defineResource({
  name: "Invoice",
  slug: "invoices",
  endpoint: "/api/invoices",
  icon: "Receipt",
  label: { singular: "Invoice", plural: "Invoices" },
  table: {
    columns: [
      // grit:cols:auto-start
      { key: "number", label: "Number", sortable: true, searchable: true, onClick: "link" },
      { key: "status", label: "Status" },
      { key: "sent", label: "Sent" },
      { key: "customer.name", label: "Customer" },
      { key: "created_at", label: "Created", sortable: true, format: "relative" },
      { key: "due_date", label: "Due Date" },
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
    schema: CreateInvoiceSchema,
    fields: [
      // grit:fields:auto-start
    { key: "status", label: "Status", type: "select", required: true, options: [{ value: "draft", label: "Draft" }, { value: "sent", label: "Sent" }, { value: "paid", label: "Paid" }] },
    { key: "sent", label: "Sent", type: "toggle" },
    { key: "customer_id", label: "Customer", type: "relationship-select", required: true, relatedEndpoint: "/api/customers", displayField: "name" },
    { key: "items", label: "Invoice Items", type: "line-items", colSpan: 2, itemEndpoint: "/api/invoice_items", foreignKey: "invoice_id", itemFields: [
        { key: "description", label: "Description", type: "text" },
        { key: "qty", label: "Qty", type: "number", numberKind: "int" },
        { key: "unit_rate", label: "Unit Rate", type: "number", numberKind: "float" },
    ] },
      { key: "due_date", label: "Due Date", type: "date" },
      // grit:fields:auto-end
    ],
  },
  dashboard: {
    widgets: [
      {
        type: "stat",
        label: "Total Invoices",
        endpoint: "/api/invoices",
        icon: "Receipt",
        color: "accent",
      },
    ],
  },
  // One card per value, counted over the rows the table is showing. Generated
  // from the model: status, sent. Delete a line to drop its cards, or set
  // stats: { countBy: [] } to keep only the four defaults.
  stats: {
    countBy: [
      {
        field: "status",
        label: "Status",
        labels: { "draft": "Draft", "sent": "Sent", "paid": "Paid" },
        only: ["draft", "sent", "paid"],
      },
      {
        field: "sent",
        labels: { "true": "Sent", "1": "Sent", "false": "Not Sent", "0": "Not Sent" },
        only: ["true", "false"],
        icon: "ToggleLeft",
      },
    ],
  },
  // The collapsible charts above the table: created over time, and these
  // columns by value. Nothing is requested until somebody opens the panel.
  insights: {
    breakdown: ["status", "sent"],
    labels: {
      status: { "draft": "Draft", "sent": "Sent", "paid": "Paid" },
      sent: { "true": "Sent", "1": "Sent", "false": "Not Sent", "0": "Not Sent" },
    },
  },
}, custom);
