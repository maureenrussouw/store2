import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import type { LineCharge, LineChargeInput } from "@/hooks/use-line-charges";
import { NumberInput } from "@/components/number-input";
import { useSubscriptions } from "@/hooks/use-subscriptions";
import { SearchableSelect } from "@/components/searchable-select";

const inputCls =
  "w-full rounded-lg border border-border bg-surface-2 px-4 py-2.5 text-[13px] text-foreground placeholder:text-foreground-muted outline-none transition-colors focus:border-accent focus:ring-1 focus:ring-accent";

interface LineChargeFormProps {
  // The typed resource, so passing the wrong record is a compile error rather
  // than a form that silently prefills nothing.
  record?: LineCharge | null;
  submitting?: boolean;
  submitLabel: string;
  onSubmit: (values: LineChargeInput) => void | Promise<void>;
  onCancel?: () => void;
}

export function LineChargeForm({ record, submitting, submitLabel, onSubmit, onCancel }: LineChargeFormProps) {
  const [description, setDescription] = useState<string>("");
  const [qty, setQty] = useState<number>(0);
  const [unitPrice, setUnitPrice] = useState<number>(0);
  const [subscriptionID, setSubscriptionID] = useState<string>("");
  const subscriptionsOpts = useSubscriptions().data ?? [];

  useEffect(() => {
    if (!record) return;
      setDescription(String(record.description ?? ""));
      setQty(Number(record.qty ?? 0));
      setUnitPrice(Number(record.unit_price ?? 0));
      setSubscriptionID(String(record.subscription_id ?? ""));
  }, [record]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit({
      description: description,
      qty: qty,
      unit_price: unitPrice,
      subscription_id: subscriptionID,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="flex h-full flex-col">
      <div className="flex-1 space-y-4">
        <div>
          <label className="block text-[13px] font-medium text-foreground mb-1.5">Description</label>
          <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className="block text-[13px] font-medium text-foreground mb-1.5">Qty</label>
          <NumberInput value={qty} onChange={setQty} kind="int" className={inputCls} />
        </div>
        <div>
          <label className="block text-[13px] font-medium text-foreground mb-1.5">Unit Price</label>
          <NumberInput value={unitPrice} onChange={setUnitPrice} kind="float" className={inputCls} />
        </div>
        <div>
          <label className="block text-[13px] font-medium text-foreground mb-1.5">Subscription</label>
          <SearchableSelect value={subscriptionID} onChange={(v) => setSubscriptionID(v ?? "")} placeholder="Select subscription…"
            options={subscriptionsOpts.map((o: any) => ({ value: String(o.id), label: String(o.name ?? o.title ?? ([o.first_name, o.last_name].filter(Boolean).join(" ") || o.email || o.id)) }))} />
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
