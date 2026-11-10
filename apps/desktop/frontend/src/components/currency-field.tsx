import { forwardRef, useState, useEffect } from "react";
import { cn } from "@/lib/utils";

// CurrencyInput is the controlled primitive: shows comma-separated
// digits in the box, emits the raw number to onChange. Pasting
// "1,234.56" or "$3,000" both work.
interface CurrencyInputProps {
  value: number | null | undefined;
  onChange: (value: number | null) => void;
  prefix?: string;        // "USD", "UGX", etc.
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  allowDecimals?: boolean; // default true
}

function formatDisplay(n: number | null | undefined, allowDecimals: boolean): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "";
  if (!allowDecimals) {
    return Math.round(n).toLocaleString();
  }
  return (n as number).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function parseRaw(raw: string): number | null {
  if (!raw) return null;
  // Strip everything that isn't a digit, decimal point, or minus sign.
  const cleaned = raw.replace(/[^0-9.\\-]/g, "");
  if (!cleaned || cleaned === "-" || cleaned === ".") return null;
  const n = parseFloat(cleaned);
  return Number.isNaN(n) ? null : n;
}

export function CurrencyInput({
  value,
  onChange,
  prefix,
  placeholder,
  disabled,
  required,
  className,
  allowDecimals = true,
}: CurrencyInputProps) {
  const [display, setDisplay] = useState(() => formatDisplay(value, allowDecimals));
  const [focused, setFocused] = useState(false);

  // Keep display in sync when the parent updates value externally
  // (e.g. RHF reset, server fetch). Skip while focused so we don't
  // fight the user's typing.
  useEffect(() => {
    if (!focused) setDisplay(formatDisplay(value, allowDecimals));
  }, [value, focused, allowDecimals]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setDisplay(raw);
    onChange(parseRaw(raw));
  };

  const handleBlur = () => {
    setFocused(false);
    setDisplay(formatDisplay(value, allowDecimals));
  };

  const handleFocus = () => {
    setFocused(true);
    // Show raw digits while editing — easier to delete characters.
    if (value !== null && value !== undefined) {
      setDisplay(allowDecimals ? String(value) : String(Math.round(value)));
    }
  };

  return (
    <div className="relative">
      {prefix && (
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[12px] font-mono text-foreground-muted">
          {prefix}
        </span>
      )}
      <input
        type="text"
        inputMode={allowDecimals ? "decimal" : "numeric"}
        value={display}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholder={placeholder}
        disabled={disabled}
        required={required}
        className={cn(
          "w-full h-10 px-3 rounded-lg border border-border bg-surface text-[13.5px] text-foreground placeholder:text-foreground-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/15 disabled:bg-surface-2 disabled:text-foreground-muted",
          prefix && "pl-12",
          className,
        )}
      />
    </div>
  );
}

// CurrencyField is the labelled wrapper. Pair with react-hook-form's
// Controller, or use directly as a controlled value+onChange pair.
interface CurrencyFieldProps extends CurrencyInputProps {
  label?: string;
  hint?: string;
  error?: string;
}

export const CurrencyField = forwardRef<HTMLDivElement, CurrencyFieldProps>(
  ({ label, hint, error, required, ...rest }, ref) => (
    <div ref={ref} className="block space-y-1">
      {label && (
        <span className="block text-[12.5px] font-medium text-foreground-secondary">
          {label}
          {required && <span className="text-danger ml-0.5">*</span>}
        </span>
      )}
      <CurrencyInput required={required} {...rest} />
      {error ? (
        <span className="block text-[11.5px] text-danger">{error}</span>
      ) : hint ? (
        <span className="block text-[11.5px] text-foreground-muted">{hint}</span>
      ) : null}
    </div>
  ),
);
CurrencyField.displayName = "CurrencyField";
