import { defineResource } from "@/lib/resource";
import { CreateProductSchema } from "@repo/shared/schemas";
import custom from "./products.custom";

export const productResource = defineResource({
  name: "Product",
  slug: "products",
  tree: true,
  endpoint: "/api/products",
  icon: "Package",
  label: { singular: "Product", plural: "Products" },
  table: {
    columns: [
      // grit:cols:auto-start
      { key: "name", label: "Name", sortable: true, searchable: true, onClick: "link" },
      { key: "slug", label: "Slug", sortable: true, searchable: true },
      { key: "price", label: "Price", sortable: true },
      { key: "description", label: "Description", searchable: true },
      { key: "thumbnail", label: "Thumbnail", format: "file" },
      { key: "images", label: "Images", format: "files" },
      { key: "category.name", label: "Category" },
      { key: "parent.name", label: "Parent" },
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
    schema: CreateProductSchema,
    fields: [
      // grit:fields:auto-start
    { key: "name", label: "Name", type: "text", required: true },
    { key: "price", label: "Price", type: "number", numberKind: "int" },
    { key: "description", label: "Description", type: "textarea" },
    { key: "thumbnail", label: "Thumbnail", type: "file", accepts: ["image"], maxSizeMB: 5 },
    { key: "images", label: "Images", type: "files", accepts: ["image"], maxSizeMB: 5, max: 5 },
    { key: "category_id", label: "Category", type: "relationship-select", required: true, relatedEndpoint: "/api/categories", displayField: "name" },
    { key: "parent_id", label: "Parent", type: "relationship-select", relatedEndpoint: "/api/products", displayField: "name" },
      // grit:fields:auto-end
    ],
  },
  dashboard: {
    widgets: [
      {
        type: "stat",
        label: "Total Products",
        endpoint: "/api/products",
        icon: "Package",
        color: "accent",
      },
    ],
  },
}, custom);
