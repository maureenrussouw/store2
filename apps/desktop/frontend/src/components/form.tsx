import { forwardRef } from "react";
import { cn } from "@/lib/utils";

// FieldWrap is the shared chrome around every form field: label,
// required marker, child input, hint OR error message.
function FieldWrap({
  label,
  hint,
  error,
  required,
  className,
  children,
}: {
  label?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={cn("block space-y-1", className)}>
      {label && (
        <span className="block text-[12.5px] font-medium text-foreground-secondary">
          {label}
          {required && <span className="text-danger ml-0.5">*</span>}
        </span>
      )}
      {children}
      {error ? (
        <span className="block text-[11.5px] text-danger">{error}</span>
      ) : hint ? (
        <span className="block text-[11.5px] text-foreground-muted">{hint}</span>
      ) : null}
    </label>
  );
}

const baseInput =
  "w-full h-10 px-3 rounded-lg border border-border bg-surface text-[13.5px] text-foreground placeholder:text-foreground-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/15 disabled:bg-surface-2 disabled:text-foreground-muted";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
}

export const TextField = forwardRef<HTMLInputElement, InputProps>(
  ({ label, hint, error, required, className, ...props }, ref) => (
    <FieldWrap label={label} hint={hint} error={error} required={required}>
      <input
        ref={ref}
        required={required}
        className={cn(baseInput, className)}
        {...props}
      />
    </FieldWrap>
  )
);
TextField.displayName = "TextField";

interface TextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  hint?: string;
  error?: string;
}

export const TextAreaField = forwardRef<HTMLTextAreaElement, TextAreaProps>(
  ({ label, hint, error, required, className, ...props }, ref) => (
    <FieldWrap label={label} hint={hint} error={error} required={required}>
      <textarea
        ref={ref}
        required={required}
        className={cn(
          baseInput,
          "h-auto min-h-[90px] py-2 resize-y",
          className
        )}
        {...props}
      />
    </FieldWrap>
  )
);
TextAreaField.displayName = "TextAreaField";

interface SelectOpt {
  value: string;
  label: string;
}
interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  hint?: string;
  error?: string;
  options: SelectOpt[];
  placeholder?: string;
}

export const SelectField = forwardRef<HTMLSelectElement, SelectProps>(
  (
    { label, hint, error, required, className, options, placeholder, ...props },
    ref
  ) => (
    <FieldWrap label={label} hint={hint} error={error} required={required}>
      <select
        ref={ref}
        required={required}
        className={cn(baseInput, "appearance-none pr-9 bg-no-repeat", className)}
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%238F95A3' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E\")",
          backgroundPosition: "right 12px center",
        }}
        {...props}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </FieldWrap>
  )
);
SelectField.displayName = "SelectField";

// FormGrid lays fields out in 1, 2, or 3 columns on >= sm breakpoints,
// stacking to one column on small screens.
export function FormGrid({
  columns = 2,
  children,
}: {
  columns?: 1 | 2 | 3;
  children: React.ReactNode;
}) {
  const cls =
    columns === 1
      ? "grid grid-cols-1 gap-4"
      : columns === 3
      ? "grid grid-cols-1 sm:grid-cols-3 gap-4"
      : "grid grid-cols-1 sm:grid-cols-2 gap-4";
  return <div className={cls}>{children}</div>;
}

// FormSection groups related fields under a small caps title.
export function FormSection({
  title,
  description,
  children,
}: {
  title?: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      {(title || description) && (
        <div>
          {title && (
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-foreground-muted">
              {title}
            </h3>
          )}
          {description && (
            <p className="text-[12.5px] text-foreground-secondary mt-0.5">
              {description}
            </p>
          )}
        </div>
      )}
      {children}
    </section>
  );
}

// FormActions is the sticky-footer cancel/submit pair every form needs.
// Pass isPending from your TanStack mutation to disable + show "Saving..."
export function FormActions({
  onCancel,
  submitLabel = "Save",
  isPending,
  extra,
}: {
  onCancel?: () => void;
  submitLabel?: string;
  isPending?: boolean;
  extra?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between pt-4 border-t border-border-subtle">
      <div>{extra}</div>
      <div className="flex gap-2">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="h-9 px-3.5 rounded-lg border border-border bg-surface text-[13px] font-medium text-foreground-secondary hover:bg-surface-hover"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={isPending}
          className="h-9 px-3.5 rounded-lg bg-accent text-accent-fg text-[13px] font-medium hover:bg-accent-hover disabled:opacity-60"
        >
          {isPending ? "Saving..." : submitLabel}
        </button>
      </div>
    </div>
  );
}
