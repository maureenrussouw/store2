import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import type { Repayment, RepaymentInput } from "@/hooks/use-repayments";
import { NumberInput } from "@/components/number-input";
import { useLoans } from "@/hooks/use-loans";
import { SearchableSelect } from "@/components/searchable-select";

const inputCls =
  "w-full rounded-lg border border-border bg-surface-2 px-4 py-2.5 text-[13px] text-foreground placeholder:text-foreground-muted outline-none transition-colors focus:border-accent focus:ring-1 focus:ring-accent";

interface RepaymentFormProps {
  // The typed resource, so passing the wrong record is a compile error rather
  // than a form that silently prefills nothing.
  record?: Repayment | null;
  submitting?: boolean;
  submitLabel: string;
  onSubmit: (values: RepaymentInput) => void | Promise<void>;
  onCancel?: () => void;
}

export function RepaymentForm({ record, submitting, submitLabel, onSubmit, onCancel }: RepaymentFormProps) {
  const [dueDate, setDueDate] = useState<string>("");
  const [amount, setAmount] = useState<number>(0);
  const [paid, setPaid] = useState<boolean>(false);
  const [loanID, setLoanID] = useState<string>("");
  const loansOpts = useLoans().data ?? [];

  useEffect(() => {
    if (!record) return;
      setDueDate(record.due_date ? String(record.due_date).slice(0, 10) : "");
      setAmount(Number(record.amount ?? 0));
      setPaid(Boolean(record.paid));
      setLoanID(String(record.loan_id ?? ""));
  }, [record]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit({
      due_date: dueDate,
      amount: amount,
      paid: paid,
      loan_id: loanID,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="flex h-full flex-col">
      <div className="flex-1 space-y-4">
        <div>
          <label className="block text-[13px] font-medium text-foreground mb-1.5">Due Date</label>
          <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className="block text-[13px] font-medium text-foreground mb-1.5">Amount</label>
          <NumberInput value={amount} onChange={setAmount} kind="float" className={inputCls} />
        </div>
        <label className="flex items-center gap-2 text-[13px] text-foreground">
          <input type="checkbox" checked={paid} onChange={(e) => setPaid(e.target.checked)} className="h-4 w-4" />
          Paid
        </label>
        <div>
          <label className="block text-[13px] font-medium text-foreground mb-1.5">Loan</label>
          <SearchableSelect value={loanID} onChange={(v) => setLoanID(v ?? "")} placeholder="Select loan…"
            options={loansOpts.map((o: any) => ({ value: String(o.id), label: String(o.name ?? o.title ?? ([o.first_name, o.last_name].filter(Boolean).join(" ") || o.email || o.id)) }))} />
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
