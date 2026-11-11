import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import type { Prescription, PrescriptionInput } from "@/hooks/use-prescriptions";
import { useCustomers } from "@/hooks/use-customers";
import { SearchableSelect } from "@/components/searchable-select";

const inputCls =
  "w-full rounded-lg border border-border bg-surface-2 px-4 py-2.5 text-[13px] text-foreground placeholder:text-foreground-muted outline-none transition-colors focus:border-accent focus:ring-1 focus:ring-accent";

interface PrescriptionFormProps {
  // The typed resource, so passing the wrong record is a compile error rather
  // than a form that silently prefills nothing.
  record?: Prescription | null;
  submitting?: boolean;
  submitLabel: string;
  onSubmit: (values: PrescriptionInput) => void | Promise<void>;
  onCancel?: () => void;
}

export function PrescriptionForm({ record, submitting, submitLabel, onSubmit, onCancel }: PrescriptionFormProps) {
  const [code, setCode] = useState<string>("");
  const [status, setStatus] = useState<string>("");
  const [priority, setPriority] = useState<string>("");
  const [patientID, setPatientID] = useState<string>("");
  const customersOpts = useCustomers().data ?? [];

  useEffect(() => {
    if (!record) return;
      setCode(String(record.code ?? ""));
      setStatus(String(record.status ?? ""));
      setPriority(String(record.priority ?? ""));
      setPatientID(String(record.patient_id ?? ""));
  }, [record]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit({
      code: code,
      status: (status || undefined) as PrescriptionInput["status"],
      priority: (priority || undefined) as PrescriptionInput["priority"],
      patient_id: patientID,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="flex h-full flex-col">
      <div className="flex-1 space-y-4">
        <div>
          <label className="block text-[13px] font-medium text-foreground mb-1.5">Code</label>
          <input type="text" value={code} onChange={(e) => setCode(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className="block text-[13px] font-medium text-foreground mb-1.5">Status</label>
          <input type="text" value={status} onChange={(e) => setStatus(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className="block text-[13px] font-medium text-foreground mb-1.5">Priority</label>
          <input type="text" value={priority} onChange={(e) => setPriority(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className="block text-[13px] font-medium text-foreground mb-1.5">Patient</label>
          <SearchableSelect value={patientID} onChange={(v) => setPatientID(v ?? "")} placeholder="Select patient…"
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
