import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import type { Loan, LoanInput } from "@/hooks/use-loans";
import { useCustomers } from "@/hooks/use-customers";
import { SearchableSelect } from "@/components/searchable-select";

const inputCls =
  "w-full rounded-lg border border-border bg-surface-2 px-4 py-2.5 text-[13px] text-foreground placeholder:text-foreground-muted outline-none transition-colors focus:border-accent focus:ring-1 focus:ring-accent";

interface LoanFormProps {
  // The typed resource, so passing the wrong record is a compile error rather
  // than a form that silently prefills nothing.
  record?: Loan | null;
  submitting?: boolean;
  submitLabel: string;
  onSubmit: (values: LoanInput) => void | Promise<void>;
  onCancel?: () => void;
}

export function LoanForm({ record, submitting, submitLabel, onSubmit, onCancel }: LoanFormProps) {
  const [reference, setReference] = useState<string>("");
  const [status, setStatus] = useState<string>("");
  const [risk, setRisk] = useState<string>("");
  const [borrowerID, setBorrowerID] = useState<string>("");
  const customersOpts = useCustomers().data ?? [];

  useEffect(() => {
    if (!record) return;
      setReference(String(record.reference ?? ""));
      setStatus(String(record.status ?? ""));
      setRisk(String(record.risk ?? ""));
      setBorrowerID(String(record.borrower_id ?? ""));
  }, [record]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit({
      reference: reference,
      status: (status || undefined) as LoanInput["status"],
      risk: (risk || undefined) as LoanInput["risk"],
      borrower_id: borrowerID,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="flex h-full flex-col">
      <div className="flex-1 space-y-4">
        <div>
          <label className="block text-[13px] font-medium text-foreground mb-1.5">Reference</label>
          <input type="text" value={reference} onChange={(e) => setReference(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className="block text-[13px] font-medium text-foreground mb-1.5">Status</label>
          <input type="text" value={status} onChange={(e) => setStatus(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className="block text-[13px] font-medium text-foreground mb-1.5">Risk</label>
          <input type="text" value={risk} onChange={(e) => setRisk(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className="block text-[13px] font-medium text-foreground mb-1.5">Borrower</label>
          <SearchableSelect value={borrowerID} onChange={(v) => setBorrowerID(v ?? "")} placeholder="Select borrower…"
            options={customersOpts.map((o: any) => ({ value: String(o.id), label: String(o.name ?? o.title ?? ([o.first_name, o.last_name].filter(Boolean).join(" ") || o.email || o.id)) }))} />
        </div>
      </div>

      <div className="mt-6 flex justify-end gap-3 border-t border-border pt-4">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-border px-4 py-2 text-[13px] font-medium text-foreground-secondary transition-colors hover:bg-surface-hover"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
        >
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
          {submitting ? "Saving…" : submitLabel}
        </button>
      </div>
    </form>
  );
}
