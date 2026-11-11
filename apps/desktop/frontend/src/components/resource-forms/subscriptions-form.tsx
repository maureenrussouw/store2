import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import type { Subscription, SubscriptionInput } from "@/hooks/use-subscriptions";
import { useCustomers } from "@/hooks/use-customers";
import { SearchableSelect } from "@/components/searchable-select";

const inputCls =
  "w-full rounded-lg border border-border bg-surface-2 px-4 py-2.5 text-[13px] text-foreground placeholder:text-foreground-muted outline-none transition-colors focus:border-accent focus:ring-1 focus:ring-accent";

interface SubscriptionFormProps {
  // The typed resource, so passing the wrong record is a compile error rather
  // than a form that silently prefills nothing.
  record?: Subscription | null;
  submitting?: boolean;
  submitLabel: string;
  onSubmit: (values: SubscriptionInput) => void | Promise<void>;
  onCancel?: () => void;
}

export function SubscriptionForm({ record, submitting, submitLabel, onSubmit, onCancel }: SubscriptionFormProps) {
  const [plan, setPlan] = useState<string>("");
  const [status, setStatus] = useState<string>("");
  const [autoRenew, setAutoRenew] = useState<boolean>(false);
  const [customerID, setCustomerID] = useState<string>("");
  const customersOpts = useCustomers().data ?? [];

  useEffect(() => {
    if (!record) return;
      setPlan(String(record.plan ?? ""));
      setStatus(String(record.status ?? ""));
      setAutoRenew(Boolean(record.auto_renew));
      setCustomerID(String(record.customer_id ?? ""));
  }, [record]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit({
      plan: (plan || undefined) as SubscriptionInput["plan"],
      status: (status || undefined) as SubscriptionInput["status"],
      auto_renew: autoRenew,
      customer_id: customerID,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="flex h-full flex-col">
      <div className="flex-1 space-y-4">
        <div>
          <label className="block text-[13px] font-medium text-foreground mb-1.5">Plan</label>
          <input type="text" value={plan} onChange={(e) => setPlan(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className="block text-[13px] font-medium text-foreground mb-1.5">Status</label>
          <input type="text" value={status} onChange={(e) => setStatus(e.target.value)} className={inputCls} />
        </div>
        <label className="flex items-center gap-2 text-[13px] text-foreground">
          <input type="checkbox" checked={autoRenew} onChange={(e) => setAutoRenew(e.target.checked)} className="h-4 w-4" />
          Auto Renew
        </label>
        <div>
          <label className="block text-[13px] font-medium text-foreground mb-1.5">Customer</label>
          <SearchableSelect value={customerID} onChange={(v) => setCustomerID(v ?? "")} placeholder="Select customer…"
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
