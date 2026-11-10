import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import type { FieldDefinition } from "@/lib/resource";
import { currencyExponent, fromMajor, toMajor, type Money } from "@repo/shared/types";

interface MoneyFieldProps {
  field: FieldDefinition;
  value: Money | null;
  onChange: (value: Money) => void;
  error?: string;
}

// The currencies offered when a field does not name its own. Deliberately
// short: a shop that trades in one currency should set field.currencies to
// that one currency, and a list of 180 codes is a worse experience than a
// list of eight.
const DEFAULT_CURRENCIES = ["USD", "EUR", "GBP", "UGX", "KES", "NGN", "ZAR", "JPY"];

/** Amount in major units, currency alongside it.
 *
 * The input is a text input rather than type="number" on purpose. A number
 * input silently discards what it considers invalid while the user is still
 * typing, so "19." disappears mid-keystroke and the caret jumps; and its
 * spinner steps by 1, which is wrong for every currency at once.
 */
// The amount with its thousands separators, in the viewer's locale.
// Grouping is what the table has always done: formatMoney is Intl, and Intl
// groups by default.
function groupMajor(major: number, digits: number): string {
  return major.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

// Read a draft back as a number. Number.parseFloat("1,234.56") is 1, so every
// place that compares the draft to the stored value has to come through here.
function parseDraft(draft: string): number {
  return Number.parseFloat(draft.replace(/,/g, ""));
}

// One leading minus, one decimal point, digits. Anything else never reaches
// the box, so there is no invalid state to report.
function cleanAmount(raw: string): string {
  return raw
    .replace(/[^0-9.-]/g, "")
    .replace(/(?!^)-/g, "")
    .replace(/^([^.]*\.)|\./g, "$1");
}

// Group the integer part of what is being typed, and leave the fraction
// exactly as typed.
//
// Grouping the whole thing would mean deciding how many decimals it has, and
// mid-typing there is no answer: "19." is on its way to "19.99", and
// rewriting it to "19.00" takes the decimal point out from under the caret.
function groupDraft(raw: string): string {
  const negative = raw.startsWith("-");
  const body = negative ? raw.slice(1) : raw;
  const dot = body.indexOf(".");
  const fraction = dot === -1 ? "" : body.slice(dot);
  // Leading zeros collapse, so 007 reads 7; a lone 0 survives.
  const whole = (dot === -1 ? body : body.slice(0, dot)).replace(/^0+(?=\d)/, "");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return (negative ? "-" : "") + grouped + fraction;
}

// Where the caret belongs after regrouping: after the same number of
// characters that are not separators. Counting characters instead would move
// the caret by one every time a comma appeared or disappeared.
function caretAfter(formatted: string, significant: number): number {
  if (significant <= 0) return 0;
  let seen = 0;
  for (let i = 0; i < formatted.length; i++) {
    if (formatted[i] !== ",") seen++;
    if (seen >= significant) return i + 1;
  }
  return formatted.length;
}

export function MoneyField({ field, value, onChange, error }: MoneyFieldProps) {
  const fieldId = useId();
  const currencies = field.currencies ?? DEFAULT_CURRENCIES;
  const currency = value?.currency || field.defaultCurrency || currencies[0] || "USD";
  const digits = currencyExponent(currency);

  // The box, and where the caret should be once React has re-rendered it.
  //
  // The draft has to be its own state. Deriving the text from the stored minor
  // units rewrites it on every keystroke: type the "." of 19.99 and the box
  // becomes "19.00" with the caret behind it. Round-tripping the draft only
  // when it disagrees with the value keeps "19." on screen while it is still
  // being typed, and still picks up an edit-mode load or a form reset.
  const [draft, setDraft] = useState(() =>
    value ? groupMajor(toMajor(value), digits) : ""
  );
  const inputRef = useRef<HTMLInputElement>(null);
  const caret = useRef<number | null>(null);

  // Put the caret back after a regrouping render. Layout effect rather than
  // effect: this runs before the browser paints, so the caret never appears
  // at the end and then jump back.
  useLayoutEffect(() => {
    if (caret.current === null || !inputRef.current) return;
    inputRef.current.setSelectionRange(caret.current, caret.current);
    caret.current = null;
  });

  // biome-ignore lint/correctness/useExhaustiveDependencies: runs on an outside change of value only, never on typing.
  useEffect(() => {
    const shown = parseDraft(draft);
    const held = value ? toMajor(value) : NaN;
    if (!Number.isNaN(shown) && shown === held) return;
    setDraft(value ? groupMajor(toMajor(value), digits) : "");
  }, [value]);

  const handleAmount = (raw: string, at: number | null) => {
    // Commas are stripped rather than refused, so a pasted 1,234.56 and the
    // separators already in the box both read correctly.
    const cleaned = cleanAmount(raw);
    const shown = groupDraft(cleaned);
    // The caret keeps its place among the characters that are not separators,
    // counted on the text the user actually had in front of them.
    if (at !== null) {
      caret.current = caretAfter(shown, cleanAmount(raw.slice(0, at)).length);
    }
    setDraft(shown);
    if (cleaned === "" || cleaned === "-" || cleaned === ".") {
      onChange({ amount: 0, currency });
      return;
    }
    const major = Number.parseFloat(cleaned);
    if (Number.isNaN(major)) return;
    onChange(fromMajor(major, currency));
  };

  // Settle the decimals to the currency's own once the user leaves the box.
  // The separators are already there; this is only about 19.5 becoming 19.50,
  // which would be wrong to do mid-keystroke.
  const handleBlur = () => {
    if (draft === "") return;
    setDraft(groupMajor(toMajor(value ?? { amount: 0, currency }), digits));
  };

  // Switching currency keeps the figure the user is looking at, not the minor
  // units behind it. Someone typing 19.99 and then picking UGX means 19.99
  // shillings, not the 0.1999 that reinterpreting 1999 minor units would give.
  const handleCurrency = (next: string) => {
    const major = toMajor(value ?? { amount: 0, currency });
    onChange(fromMajor(major, next));
    setDraft(groupMajor(major, currencyExponent(next)));
  };

  return (
    <div className="space-y-1.5">
      <label htmlFor={fieldId} className="block text-sm font-medium text-foreground">
        {field.label}
        {field.required && <span className="text-danger ml-1">*</span>}
      </label>

      <div className="flex">
        <Input
          id={fieldId}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          className="rounded-r-none font-mono tabular-nums"
          value={draft}
          onBlur={handleBlur}
          ref={inputRef}
          onChange={(e) => handleAmount(e.target.value, e.target.selectionStart)}
          placeholder={field.placeholder ?? (0).toFixed(digits)}
          invalid={!!error}
        />
        <select
          aria-label={field.label + " currency"}
          className="rounded-r-lg border border-l-0 border-border bg-bg-tertiary px-3 text-sm text-text-secondary focus:outline-none focus:ring-2 focus:ring-accent"
          value={currency}
          onChange={(e) => handleCurrency(e.target.value)}
        >
          {currencies.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      {field.description && !error && (
        <p className="text-xs text-text-muted">{field.description}</p>
      )}
      {!field.description && !error && digits === 0 && (
        <p className="text-xs text-text-muted">
          {currency} has no minor unit, so this is a whole number.
        </p>
      )}
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
