import { defineResource } from "@/lib/resource";
import { CreateLoanSchema } from "@repo/shared/schemas";
import custom from "./loans.custom";

export const loanResource = defineResource({
  name: "Loan",
  slug: "loans",
  endpoint: "/api/loans",
  icon: "Database",
  label: { singular: "Loan", plural: "Loans" },
  table: {
    columns: [
      // grit:cols:auto-start
      { key: "reference", label: "Reference", sortable: true, searchable: true, onClick: "link" },
      { key: "status", label: "Status" },
      { key: "risk", label: "Risk" },
      { key: "borrower.name", label: "Borrower" },
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
    schema: CreateLoanSchema,
    fields: [
      // grit:fields:auto-start
    { key: "reference", label: "Reference", type: "text", required: true },
    { key: "status", label: "Status", type: "select", required: true, options: [{ value: "pending", label: "Pending" }, { value: "active", label: "Active" }, { value: "closed", label: "Closed" }, { value: "defaulted", label: "Defaulted" }] },
    { key: "risk", label: "Risk", type: "radio", required: true, options: [{ value: "low", label: "Low" }, { value: "medium", label: "Medium" }, { value: "high", label: "High" }] },
    { key: "borrower_id", label: "Borrower", type: "relationship-select", required: true, relatedEndpoint: "/api/customers", displayField: "name" },
    { key: "items", label: "Repayments", type: "line-items", colSpan: 2, itemEndpoint: "/api/repayments", foreignKey: "loan_id", itemFields: [
        { key: "due_date", label: "Due Date", type: "date" },
        { key: "amount", label: "Amount", type: "number", numberKind: "float" },
        { key: "paid", label: "Paid", type: "toggle" },
    ] },
      // grit:fields:auto-end
    ],
  },
  dashboard: {
    widgets: [
      {
        type: "stat",
        label: "Total Loans",
        endpoint: "/api/loans",
        icon: "Database",
        color: "accent",
      },
    ],
  },
  // One card per value, counted over the rows the table is showing. Generated
  // from the model: status, risk. Delete a line to drop its cards, or set
  // stats: { countBy: [] } to keep only the four defaults.
  stats: {
    countBy: [
      {
        field: "status",
        label: "Status",
        labels: { "pending": "Pending", "active": "Active", "closed": "Closed", "defaulted": "Defaulted" },
        only: ["pending", "active", "closed", "defaulted"],
      },
      {
        field: "risk",
        label: "Risk",
        labels: { "low": "Low", "medium": "Medium", "high": "High" },
        only: ["low", "medium", "high"],
      },
    ],
  },
  // The collapsible charts above the table: created over time, and these
  // columns by value. Nothing is requested until somebody opens the panel.
  insights: {
    breakdown: ["status", "risk"],
    labels: {
      status: { "pending": "Pending", "active": "Active", "closed": "Closed", "defaulted": "Defaulted" },
      risk: { "low": "Low", "medium": "Medium", "high": "High" },
    },
  },
}, custom);
