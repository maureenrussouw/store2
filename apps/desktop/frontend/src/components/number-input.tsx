import { useEffect, useRef, useState } from "react";

interface NumberInputProps {
  value: number;
  onChange: (value: number) => void;
  kind?: "int" | "uint" | "float";
  className?: string;
  placeholder?: string;
}

function format(n: number, kind: string): string {
  if (n === 0) return "0";
  if (!Number.isFinite(n)) return "";
  const opts = kind === "float" ? { maximumFractionDigits: 6 } : { maximumFractionDigits: 0 };
  return n.toLocaleString("en-US", opts);
}

// Keep only characters valid for the domain, then group the integer part with
// commas. Preserves a trailing "." and trailing zeros while typing a decimal.
function reformat(raw: string, kind: string): { display: string; value: number } {
  let s = raw.replace(/,/g, "");
  if (kind !== "float") s = s.replace(/\./g, "");
  if (kind === "uint") s = s.replace(/-/g, "");
  s = s.replace(/[^0-9.\-]/g, "");
  if (s === "" || s === "-" || s === ".") return { display: s, value: 0 };
  const neg = s.startsWith("-");
  if (neg) s = s.slice(1);
  const [intPart, ...rest] = s.split(".");
  const decPart = rest.join("");
  const groupedInt = intPart.replace(/^0+(?=\d)/, "").replace(/\B(?=(\d{3})+(?!\d))/g, ",") || "0";
  let display = (neg ? "-" : "") + groupedInt;
  const hadDot = kind === "float" && raw.replace(/,/g, "").includes(".");
  if (hadDot) display += "." + decPart;
  const value = parseFloat((neg ? "-" : "") + intPart + (decPart ? "." + decPart : "")) || 0;
  return { display, value };
}

export function NumberInput({ value, onChange, kind = "float", className, placeholder }: NumberInputProps) {
  const [display, setDisplay] = useState(() => format(value, kind));
  const focused = useRef(false);

  // Sync external value changes (e.g. edit prefill) unless the user is typing.
  useEffect(() => {
    if (!focused.current) setDisplay(format(value, kind));
  }, [value, kind]);

  return (
    <input
      type="text"
      inputMode={kind === "float" ? "decimal" : "numeric"}
      value={display}
      placeholder={placeholder}
      className={className}
      onFocus={() => { focused.current = true; }}
      onBlur={() => { focused.current = false; setDisplay(format(value, kind)); }}
      onChange={(e) => {
        const { display: d, value: v } = reformat(e.target.value, kind);
        setDisplay(d);
        onChange(v);
      }}
    />
  );
}
