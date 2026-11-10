import type { ColumnFormat, FieldDefinition } from "./resource";

/** Shown in the form, never written by it: readOnly and computed fields. */
export function isDisplayOnly(field: Pick<FieldDefinition, "readOnly" | "compute">): boolean {
  return Boolean(field.readOnly || field.compute);
}

/**
 * What a form submits: every value except the display-only ones.
 *
 * Stripped here, once, rather than left to the API. A read-only field over a
 * column the server computes is a column the PATCH allow-list may well name,
 * and sending the displayed value back would overwrite the server's figure with
 * whatever the form happened to be holding.
 */
export function writableValues(
  fields: Pick<FieldDefinition, "key" | "type" | "readOnly" | "compute" | "visibleWhen" | "defaultValue">[],
  data: Record<string, unknown>,
): Record<string, unknown> {
  const skip = new Set(fields.filter(isDisplayOnly).map((f) => f.key));
  // A field the condition hides is cleared rather than left alone. Omitting it
  // would be a PATCH that keeps whatever was there, so a project moved from
  // recurring to one-off would keep billing monthly on a column nobody can see.
  const clear = new Map(
    fields
      .filter((f) => f.visibleWhen && !isVisible(f, data))
      .map((f) => [f.key, emptyValueFor(f)] as const),
  );
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (skip.has(key)) continue;
    out[key] = clear.has(key) ? clear.get(key) : value;
  }
  return out;
}

/**
 * Whether a field applies, given the rest of the form.
 *
 * A predicate that throws counts as visible. It runs on every keystroke over a
 * form that is half filled in by definition, and an undefined read on the way
 * to a valid record is not a reason to make a field vanish.
 */
export function isVisible(
  field: Pick<FieldDefinition, "visibleWhen">,
  values: Record<string, unknown>,
): boolean {
  if (!field.visibleWhen) return true;
  try {
    return Boolean(field.visibleWhen(values));
  } catch {
    return true;
  }
}

/**
 * Whether a field is required right now: requiredWhen if it has one, else
 * required, and never either while the field is hidden.
 */
export function isRequired(
  field: Pick<FieldDefinition, "required" | "requiredWhen" | "visibleWhen">,
  values: Record<string, unknown>,
): boolean {
  if (!isVisible(field, values)) return false;
  if (field.requiredWhen) {
    try {
      return Boolean(field.requiredWhen(values));
    } catch {
      return Boolean(field.required);
    }
  }
  return Boolean(field.required);
}

/**
 * The value an empty field of this type holds.
 *
 * The same answer buildDefaults gives a fresh form, deliberately: a cleared
 * field must send a shape the API already accepts from an ordinary create,
 * never null on a column whose schema says string.
 */
export function emptyValueFor(
  field: Pick<FieldDefinition, "type" | "defaultValue">,
): unknown {
  if (field.defaultValue !== undefined) return field.defaultValue;
  if (field.type === "toggle" || field.type === "checkbox") return false;
  if (EMPTY_ARRAY_TYPES.has(field.type as string)) return [];
  if (EMPTY_NULL_TYPES.has(field.type as string)) return null;
  return "";
}

const EMPTY_ARRAY_TYPES = new Set([
  "images", "videos", "files", "checkbox-group",
  "multi-relationship-select", "line-items",
]);

const EMPTY_NULL_TYPES = new Set([
  "number", "money", "image", "video", "file", "percent", "rating", "json",
]);

/**
 * The value a display-only field shows: compute() over the current form
 * values, or the stored value for a plain read-only field.
 *
 * A compute that throws shows nothing rather than taking the form down. It runs
 * on every change, over a form that is half filled in by definition, and an
 * undefined line on row three is not a reason to lose what has been typed.
 */
export function displayValue(
  field: Pick<FieldDefinition, "key" | "compute">,
  values: Record<string, unknown>,
): unknown {
  if (field.compute) {
    try {
      return field.compute(values);
    } catch {
      return undefined;
    }
  }
  return values[field.key];
}

/** The table format that shows a field's type the way its column would. */
export function displayFormat(field: Pick<FieldDefinition, "type">): ColumnFormat | undefined {
  switch (field.type) {
    case "money":
      return "money";
    case "date":
    case "datetime":
      return "date";
    case "toggle":
    case "checkbox":
      return "boolean";
    case "richtext":
      return "richtext";
    case "email":
      return "email";
    case "url":
      return "link";
    case "domain":
    case "tel":
    case "country":
    case "color":
    case "percent":
    case "rating":
    case "time":
    case "json":
      return field.type;
    default:
      return undefined;
  }
}
