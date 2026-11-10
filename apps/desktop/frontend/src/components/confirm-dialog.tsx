import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";

interface ConfirmOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}
type Resolver = (v: boolean) => void;

const ConfirmContext = createContext<(o: ConfirmOptions) => Promise<boolean>>(
  async () => false,
);

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<{ opts: ConfirmOptions; resolve: Resolver } | null>(null);

  const confirm = useCallback(
    (opts: ConfirmOptions) => new Promise<boolean>((resolve) => setState({ opts, resolve })),
    [],
  );

  const close = (v: boolean) => {
    state?.resolve(v);
    setState(null);
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: close is recreated every render and reads state, which is listed.
  useEffect(() => {
    if (!state) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close(false);
      if (e.key === "Enter") close(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state]);

  const o = state?.opts;

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {state && o && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" onClick={() => close(false)}>
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
          <div onClick={(e) => e.stopPropagation()} className="relative z-10 w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-2xl">
            <div className="flex items-start gap-3">
              <span className={"inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full " + (o.danger ? "bg-danger/10 text-danger" : "bg-accent/10 text-accent")}>
                <AlertTriangle className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="text-[16px] font-semibold text-foreground">{o.title ?? "Are you sure?"}</h2>
                <p className="mt-1 text-[13px] text-foreground-secondary">{o.message}</p>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => close(false)} className="rounded-lg border border-border px-4 py-2 text-[13px] font-medium text-foreground-secondary hover:bg-surface-hover">
                {o.cancelLabel ?? "Cancel"}
              </button>
              <button
                onClick={() => close(true)}
                className={"rounded-lg px-4 py-2 text-[13px] font-semibold text-white " + (o.danger ? "bg-danger hover:bg-danger/90" : "bg-accent hover:bg-accent-hover")}
              >
                {o.confirmLabel ?? "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  return useContext(ConfirmContext);
}
