import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Check, X, Search } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SelectOption {
  value: string;
  label: string;
  hint?: string; // optional secondary text shown next to the label
}

interface SearchableSelectProps {
  value: string | null | undefined;
  onChange: (value: string | null) => void;
  options: SelectOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  required?: boolean;
  clearable?: boolean;
  className?: string;
}

// SearchableSelect is a typeahead combobox that replaces native <select>
// for FK and large-enum fields. The dropdown is portal'd to document.body
// so it isn't clipped by overflow:hidden ancestors (drawers, modals).
//
// Keyboard:
//   Down/Up   - move highlight
//   Enter     - select highlighted
//   Esc       - close
//   Tab       - close + commit nothing
export function SearchableSelect({
  value,
  onChange,
  options,
  placeholder = "Select...",
  searchPlaceholder = "Search...",
  disabled,
  required,
  clearable,
  className,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [highlight, setHighlight] = useState(0);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 });

  const updatePosition = useCallback(() => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 4, left: rect.left, width: rect.width });
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    updatePosition();
    setSearch("");
    setHighlight(0);
    // Focus the search input after the portal mounts.
    requestAnimationFrame(() => inputRef.current?.focus());

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        triggerRef.current && !triggerRef.current.contains(target) &&
        dropdownRef.current && !dropdownRef.current.contains(target)
      ) {
        setOpen(false);
      }
    };
    const handleScroll = () => updatePosition();
    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("scroll", handleScroll, true);
    window.addEventListener("resize", updatePosition);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("scroll", handleScroll, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [open, updatePosition]);

  const filtered = useMemo(() => {
    if (!search) return options;
    const q = search.toLowerCase();
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        (o.hint || "").toLowerCase().includes(q),
    );
  }, [options, search]);

  // Keep highlight in range as the filter shrinks.
  useEffect(() => {
    if (highlight >= filtered.length) setHighlight(Math.max(0, filtered.length - 1));
  }, [filtered, highlight]);

  const selected = useMemo(() => options.find((o) => o.value === value), [options, value]);

  const commit = (opt: SelectOption | undefined) => {
    if (!opt) return;
    onChange(opt.value);
    setOpen(false);
  };

  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(filtered.length - 1, h + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(0, h - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      commit(filtered[highlight]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    }
  };

  const dropdown = open && createPortal(
    <div
      ref={dropdownRef}
      className="fixed z-[9999] rounded-lg border border-border bg-surface shadow-xl"
      style={{ top: pos.top, left: pos.left, width: pos.width }}
    >
      <div className="p-2 border-b border-border-subtle relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-foreground-muted" />
        <input
          ref={inputRef}
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={handleKey}
          placeholder={searchPlaceholder}
          className="w-full h-8 pl-8 pr-2.5 rounded-md border border-border bg-surface-2 text-[12.5px] placeholder:text-foreground-muted focus:border-accent focus:outline-none"
        />
      </div>
      <div className="max-h-60 overflow-y-auto py-1">
        {filtered.length === 0 ? (
          <div className="px-3 py-4 text-center text-[12.5px] text-foreground-muted">
            No matches
          </div>
        ) : (
          filtered.map((opt, idx) => (
            <button
              key={opt.value}
              type="button"
              onMouseEnter={() => setHighlight(idx)}
              onClick={() => commit(opt)}
              className={cn(
                "w-full flex items-center justify-between px-3 py-1.5 text-left text-[13px] transition-colors",
                idx === highlight ? "bg-accent/10 text-foreground" : "text-foreground-secondary",
              )}
            >
              <span className="flex-1 truncate">
                {opt.label}
                {opt.hint && (
                  <span className="ml-2 text-[11.5px] text-foreground-muted">{opt.hint}</span>
                )}
              </span>
              {opt.value === value && <Check className="h-3.5 w-3.5 text-accent" />}
            </button>
          ))
        )}
      </div>
    </div>,
    document.body,
  );

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "w-full h-10 flex items-center justify-between px-3 rounded-lg border border-border bg-surface text-[13.5px] text-left transition-colors",
          "hover:border-foreground-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/15",
          "disabled:bg-surface-2 disabled:text-foreground-muted disabled:cursor-not-allowed",
          className,
        )}
      >
        <span className={cn("truncate", !selected && "text-foreground-muted")}>
          {selected ? selected.label : placeholder}
        </span>
        <span className="flex items-center gap-1 shrink-0">
          {clearable && selected && !disabled && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                onChange(null);
              }}
              className="h-5 w-5 rounded-full hover:bg-surface-hover inline-flex items-center justify-center text-foreground-muted hover:text-foreground"
              aria-label="Clear"
            >
              <X className="h-3 w-3" />
            </span>
          )}
          <ChevronDown className="h-4 w-4 text-foreground-muted" />
        </span>
      </button>
      {dropdown}
      {required && !value && (
        // Hidden anchor so the form's HTML5 validation can require this.
        <input
          tabIndex={-1}
          aria-hidden
          className="sr-only"
          required
          value=""
          onChange={() => {}}
        />
      )}
    </>
  );
}

// SearchableSelectField: labelled wrapper for forms.
interface SearchableSelectFieldProps extends SearchableSelectProps {
  label?: string;
  hint?: string;
  error?: string;
}

export function SearchableSelectField({
  label,
  hint,
  error,
  required,
  ...rest
}: SearchableSelectFieldProps) {
  return (
    <div className="block space-y-1">
      {label && (
        <span className="block text-[12.5px] font-medium text-foreground-secondary">
          {label}
          {required && <span className="text-danger ml-0.5">*</span>}
        </span>
      )}
      <SearchableSelect required={required} {...rest} />
      {error ? (
        <span className="block text-[11.5px] text-danger">{error}</span>
      ) : hint ? (
        <span className="block text-[11.5px] text-foreground-muted">{hint}</span>
      ) : null}
    </div>
  );
}
