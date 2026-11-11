import { defineResource } from "@/lib/resource";
import { CreatePrescriptionSchema } from "@repo/shared/schemas";
import custom from "./prescriptions.custom";

export const prescriptionResource = defineResource({
  name: "Prescription",
  slug: "prescriptions",
  endpoint: "/api/prescriptions",
  icon: "Database",
  label: { singular: "Prescription", plural: "Prescriptions" },
  table: {
    columns: [
      // grit:cols:auto-start
      { key: "code", label: "Code", sortable: true, searchable: true, onClick: "link" },
      { key: "status", label: "Status" },
      { key: "priority", label: "Priority" },
      { key: "patient.name", label: "Patient" },
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
    schema: CreatePrescriptionSchema,
    fields: [
      // grit:fields:auto-start
    { key: "code", label: "Code", type: "text", required: true },
    { key: "status", label: "Status", type: "select", required: true, options: [{ value: "draft", label: "Draft" }, { value: "issued", label: "Issued" }, { value: "dispensed", label: "Dispensed" }] },
    { key: "priority", label: "Priority", type: "radio", required: true, options: [{ value: "routine", label: "Routine" }, { value: "urgent", label: "Urgent" }] },
    { key: "patient_id", label: "Patient", type: "relationship-select", required: true, relatedEndpoint: "/api/customers", displayField: "name" },
    { key: "items", label: "Medications", type: "line-items", colSpan: 2, itemEndpoint: "/api/medications", foreignKey: "prescription_id", itemFields: [
        { key: "name", label: "Name", type: "text" },
        { key: "dose", label: "Dose", type: "text" },
        { key: "quantity", label: "Quantity", type: "number", numberKind: "int" },
    ] },
      // grit:fields:auto-end
    ],
  },
  dashboard: {
    widgets: [
      {
        type: "stat",
        label: "Total Prescriptions",
        endpoint: "/api/prescriptions",
        icon: "Database",
        color: "accent",
      },
    ],
  },
  // One card per value, counted over the rows the table is showing. Generated
  // from the model: status, priority. Delete a line to drop its cards, or set
  // stats: { countBy: [] } to keep only the four defaults.
  stats: {
    countBy: [
      {
        field: "status",
        label: "Status",
        labels: { "draft": "Draft", "issued": "Issued", "dispensed": "Dispensed" },
        only: ["draft", "issued", "dispensed"],
      },
      {
        field: "priority",
        label: "Priority",
        labels: { "routine": "Routine", "urgent": "Urgent" },
        only: ["routine", "urgent"],
      },
    ],
  },
  // The collapsible charts above the table: created over time, and these
  // columns by value. Nothing is requested until somebody opens the panel.
  insights: {
    breakdown: ["status", "priority"],
    labels: {
      status: { "draft": "Draft", "issued": "Issued", "dispensed": "Dispensed" },
      priority: { "routine": "Routine", "urgent": "Urgent" },
    },
  },
}, custom);
