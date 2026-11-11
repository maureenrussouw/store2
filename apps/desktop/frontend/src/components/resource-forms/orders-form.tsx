import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import type { Order, OrderInput } from "@/hooks/use-orders";
import { useCustomers } from "@/hooks/use-customers";
import { SearchableSelect } from "@/components/searchable-select";

const inputCls =
  "w-full rounded-lg border border-border bg-surface-2 px-4 py-2.5 text-[13px] text-foreground placeholder:text-foreground-muted outline-none transition-colors focus:border-accent focus:ring-1 focus:ring-accent";

interface OrderFormProps {
  // The typed resource, so passing the wrong record is a compile error rather
  // than a form that silently prefills nothing.
  record?: Order | null;
  submitting?: boolean;
  submitLabel: string;
  onSubmit: (values: OrderInput) => void | Promise<void>;
  onCancel?: () => void;
}

export function OrderForm({ record, submitting, submitLabel, onSubmit, onCancel }: OrderFormProps) {
  const [number, setNumber] = useState<string>("");
  const [status, setStatus] = useState<string>("");
  const [fulfillment, setFulfillment] = useState<string>("");
  const [customerID, setCustomerID] = useState<string>("");
  const customersOpts = useCustomers().data ?? [];

  useEffect(() => {
    if (!record) return;
      setNumber(String(record.number ?? ""));
      setStatus(String(record.status ?? ""));
      setFulfillment(String(record.fulfillment ?? ""));
      setCustomerID(String(record.customer_id ?? ""));
  }, [record]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit({
      number: number,
      status: (status || undefined) as OrderInput["status"],
      fulfillment: (fulfillment || undefined) as OrderInput["fulfillment"],
      customer_id: customerID,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="flex h-full flex-col">
      <div className="flex-1 space-y-4">
        <div>
          <label className="block text-[13px] font-medium text-foreground mb-1.5">Number</label>
          <input type="text" value={number} onChange={(e) => setNumber(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className="block text-[13px] font-medium text-foreground mb-1.5">Status</label>
          <input type="text" value={status} onChange={(e) => setStatus(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className="block text-[13px] font-medium text-foreground mb-1.5">Fulfillment</label>
          <input type="text" value={fulfillment} onChange={(e) => setFulfillment(e.target.value)} className={inputCls} />
        </div>
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
