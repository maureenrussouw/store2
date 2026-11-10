import type { CSSProperties, ReactNode } from "react";

export const authInputCls =
  "w-full h-11 rounded-[var(--auth-radius)] border px-3.5 text-[14px] outline-none transition-colors focus:ring-2";

export const authInputStyle: CSSProperties = {
  borderColor: "var(--auth-border)",
  background: "var(--auth-card)",
  color: "var(--auth-fg)",
};

export function AuthSubmit({ disabled, children }: { disabled?: boolean; children: ReactNode }) {
  return (
    <button
      type="submit"
      disabled={disabled}
      className="flex h-11 w-full items-center justify-center gap-2 rounded-[var(--auth-radius)] text-[15px] font-semibold transition-opacity hover:opacity-90 disabled:opacity-50"
      style={{ background: "var(--auth-primary)", color: "var(--auth-primary-fg)" }}
    >
      {children}
    </button>
  );
}
