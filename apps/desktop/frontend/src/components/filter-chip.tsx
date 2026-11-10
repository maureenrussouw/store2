import { X } from "lucide-react";
import { cn } from "@/lib/utils";

// FilterChip is a toggleable pill used to compose filter bars on
// desktop list views. Active chips show a subtle accent background
// and an X to clear; inactive chips look like neutral tags.
//
// Pair with FilterBar for the standard horizontal scrollable layout:
//
//   <FilterBar>
//     <FilterChip active={status === "all"} onClick={() => setStatus("all")}>All</FilterChip>
//     <FilterChip active={status === "open"} onClick={() => setStatus("open")} onClear={() => setStatus("all")}>Open</FilterChip>
//   </FilterBar>
export function FilterChip({
  children,
  active,
  onClick,
  onClear,
  count,
}: {
  children: React.ReactNode;
  active?: boolean;
  onClick?: () => void;
  // When provided AND active, an X button appears that calls onClear instead
  // of toggling the chip. Lets users clear a single filter without opening a menu.
  onClear?: () => void;
  // Optional count rendered after the label (e.g. "Open (3)").
  count?: number;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 h-7 pl-2.5 rounded-full text-[12px] font-medium border transition-colors select-none",
        onClear ? "pr-1" : "pr-2.5",
        active
          ? "bg-accent/15 border-accent/30 text-accent"
          : "bg-surface border-border text-foreground-secondary hover:bg-surface-hover hover:text-foreground cursor-pointer"
      )}
      onClick={!active ? onClick : undefined}
      role={!active ? "button" : undefined}
      tabIndex={!active ? 0 : undefined}
      onKeyDown={(e) => {
        if (!active && onClick && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onClick();
        }
      }}
    >
      <span>{children}</span>
      {count !== undefined && (
        <span className={cn("text-[11px]", active ? "text-accent/70" : "text-foreground-muted")}>
          {count}
        </span>
      )}
      {active && onClear && (
        <button
          type="button"
          onClick={onClear}
          className="ml-0.5 h-5 w-5 rounded-full hover:bg-accent/20 inline-flex items-center justify-center"
          aria-label="Clear filter"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </span>
  );
}

// FilterBar wraps a row of FilterChips with horizontal scroll for
// when there are too many to fit. Use directly inside a ListPane
// via the filters prop.
export function FilterBar({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5 overflow-x-auto -mx-1 px-1 pb-1 scrollbar-thin">
      {children}
    </div>
  );
}
