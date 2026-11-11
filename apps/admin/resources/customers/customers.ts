import { defineResource } from "@/lib/resource";
import { StackedCell } from "@/components/tables/stacked-cell";
import { CreateCustomerSchema } from "@repo/shared/schemas";
import custom from "./customers.custom";

export const customerResource = defineResource({
  name: "Customer",
  slug: "customers",
  endpoint: "/api/customers",
  icon: "UserCircle",
  label: { singular: "Customer", plural: "Customers" },
  table: {
    columns: [
      // grit:cols:auto-start
      { key: "name", label: "Contact", sortable: true, searchable: true, cell: (row) => StackedCell({ top: String(row.name ?? ""), bottom: String(row.email ?? "") }) },
      { key: "company", label: "Company", sortable: true, searchable: true, onClick: "link" },
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
    schema: CreateCustomerSchema,
    fields: [
      // grit:fields:auto-start
    { key: "name", label: "Name", type: "text", required: true },
    { key: "email", label: "Email", type: "text", required: true },
    { key: "company", label: "Company", type: "text", required: true },
      // grit:fields:auto-end
    ],
  },
  dashboard: {
    widgets: [
      {
        type: "stat",
        label: "Total Customers",
        endpoint: "/api/customers",
        icon: "UserCircle",
        color: "accent",
      },
    ],
  },
}, custom);
