import { useEffect } from "react";
import { X } from "lucide-react";

interface ResourceDrawerProps {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: React.ReactNode;
}

export function ResourceDrawer({ open, title, description, onClose, children }: ResourceDrawerProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-stretch md:justify-end">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 flex w-full max-h-[92vh] flex-col overflow-hidden rounded-t-2xl border border-border bg-surface shadow-2xl md:h-full md:max-h-full md:max-w-lg md:rounded-none md:rounded-l-2xl">
        <header className="flex items-start justify-between border-b border-border px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground">{title}</h2>
            {description && <p className="mt-0.5 text-[13px] text-foreground-secondary">{description}</p>}
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-foreground-muted transition-colors hover:bg-surface-hover hover:text-foreground"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto p-6">{children}</div>
      </div>
    </div>
  );
}
