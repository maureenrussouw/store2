import { defineResource } from "@/lib/resource";
import { CreateCategorySchema } from "@repo/shared/schemas";
import custom from "./categories.custom";

export const categoryResource = defineResource({
  name: "Category",
  slug: "categories",
  tree: true,
  endpoint: "/api/categories",
  icon: "FolderTree",
  label: { singular: "Category", plural: "Categories" },
  table: {
    columns: [
      // grit:cols:auto-start
      { key: "name", label: "Name", sortable: true, searchable: true, onClick: "link" },
      { key: "slug", label: "Slug", sortable: true, searchable: true },
      { key: "image", label: "Image", format: "file" },
      { key: "featured", label: "Featured", format: "boolean" },
      { key: "parent.name", label: "Parent" },
      { key: "created_at", label: "Created", sortable: true, format: "relative" },
      // grit:cols:auto-end
    ],
    filters: [
    { key: "featured", label: "Featured", type: "boolean" },
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
    schema: CreateCategorySchema,
    fields: [
      // grit:fields:auto-start
    { key: "name", label: "Name", type: "text", required: true },
    { key: "image", label: "Image", type: "file", accepts: ["image"], maxSizeMB: 5 },
    { key: "featured", label: "Featured", type: "toggle" },
    { key: "parent_id", label: "Parent", type: "relationship-select", relatedEndpoint: "/api/categories", displayField: "name" },
      // grit:fields:auto-end
    ],
  },
  dashboard: {
    widgets: [
      {
        type: "stat",
        label: "Total Categories",
        endpoint: "/api/categories",
        icon: "FolderTree",
        color: "accent",
      },
    ],
  },
  // One card per value, counted over the rows the table is showing. Generated
  // from the model: featured. Delete a line to drop its cards, or set
  // stats: { countBy: [] } to keep only the four defaults.
  stats: {
    countBy: [
      {
        field: "featured",
        labels: { "true": "Featured", "1": "Featured", "false": "Not Featured", "0": "Not Featured" },
        only: ["true", "false"],
        icon: "ToggleLeft",
      },
    ],
  },
  // The collapsible charts above the table: created over time, and these
  // columns by value. Nothing is requested until somebody opens the panel.
  insights: {
    breakdown: ["featured"],
    labels: {
      featured: { "true": "Featured", "1": "Featured", "false": "Not Featured", "0": "Not Featured" },
    },
  },
}, custom);
