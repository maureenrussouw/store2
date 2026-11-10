import { useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

// Drawer is the right-edge slide-in panel. Used for create/edit forms,
// review panels, anything that's heavier than a popover but lighter
// than a full page route. Closes on Esc + backdrop click + the X button.
interface DrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  width?: "sm" | "md" | "lg" | "xl";
  children: React.ReactNode;
  // Footer sticks to the bottom (typical "Cancel + Save" row). When
  // omitted, the children are responsible for their own actions.
  footer?: React.ReactNode;
}

const WIDTHS = {
  sm: "w-[360px]",
  md: "w-[480px]",
  lg: "w-[640px]",
  xl: "w-[860px]",
};

export function Drawer({
  open,
  onOpenChange,
  title,
  description,
  width = "md",
  children,
  footer,
}: DrawerProps) {
  // Close on Esc.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/40"
        onClick={() => onOpenChange(false)}
      />
      <aside
        className={cn(
          "fixed right-0 top-0 z-50 h-full bg-surface border-l border-border flex flex-col",
          WIDTHS[width],
        )}
      >
        {(title || description) && (
          <header className="flex items-start justify-between px-5 py-4 border-b border-border">
            <div>
              {title && <h2 className="text-[15px] font-semibold text-foreground">{title}</h2>}
              {description && (
                <p className="text-[12.5px] text-foreground-muted mt-0.5">{description}</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="text-foreground-muted hover:text-foreground"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </header>
        )}
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <footer className="border-t border-border px-5 py-3">{footer}</footer>
        )}
      </aside>
    </>
  );
}
