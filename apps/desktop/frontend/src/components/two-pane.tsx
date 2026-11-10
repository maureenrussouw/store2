import { Search, Plus, Inbox } from "lucide-react";
import { cn } from "@/lib/utils";

// TwoPane is the master-detail layout that almost every desktop CRUD
// page wants: a fixed-width list on the left (TwoPane.List) and a
// detail view on the right (TwoPane.Detail) that fills the rest.
//
// Usage:
//   <TwoPane>
//     <ListPane title="Buildings" search={s} onSearch={setS} onNew={...}>
//       {items.map((b) => <ListRow ... />)}
//     </ListPane>
//     <DetailPane empty={!selected}>{selected ? ... : null}</DetailPane>
//   </TwoPane>
export function TwoPane({ children }: { children: React.ReactNode }) {
  return <div className="flex h-full overflow-hidden">{children}</div>;
}

interface ListPaneProps {
  title: string;
  count?: number;
  onNew?: () => void;
  newLabel?: string;
  search: string;
  onSearch: (v: string) => void;
  searchPlaceholder?: string;
  filters?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  // Optional slot rendered before the New button (e.g. a refresh button).
  toolbar?: React.ReactNode;
}

// ListPane: sticky header (title + search + new) + scrollable body.
export function ListPane({
  title,
  count,
  onNew,
  newLabel = "New",
  search,
  onSearch,
  searchPlaceholder = "Search...",
  filters,
  children,
  footer,
  toolbar,
}: ListPaneProps) {
  return (
    <aside className="w-listpane shrink-0 border-r border-border bg-surface flex flex-col">
      <div className="px-4 pt-4 pb-2 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-baseline gap-2">
            <h2 className="text-[15px] font-semibold text-foreground">{title}</h2>
            {count !== undefined && (
              <span className="text-[12px] text-foreground-muted">{count}</span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            {toolbar}
            {onNew && (
              <button
                type="button"
                onClick={onNew}
                className="h-8 px-2.5 rounded-lg bg-accent text-accent-fg text-[12px] font-medium hover:bg-accent-hover transition-colors inline-flex items-center gap-1"
              >
                <Plus className="h-3.5 w-3.5" />
                {newLabel}
              </button>
            )}
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-foreground-muted" />
          <input
            type="search"
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full h-8 pl-8 pr-2.5 rounded-lg border border-border bg-surface-2 text-[12.5px] placeholder:text-foreground-muted focus:border-accent focus:outline-none"
          />
        </div>

        {filters}
      </div>
      <div className="flex-1 overflow-y-auto">{children}</div>
      {footer && <div className="px-4 py-2 border-t border-border-subtle">{footer}</div>}
    </aside>
  );
}

interface ListRowProps {
  onClick?: () => void;
  selected?: boolean;
  icon?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  rightTop?: React.ReactNode;
  rightBottom?: React.ReactNode;
}

// ListRow: avatar/icon + title/subtitle + right meta. Selected state
// shows a 2px accent bar on the left edge.
export function ListRow({
  onClick,
  selected,
  icon,
  title,
  subtitle,
  rightTop,
  rightBottom,
}: ListRowProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative w-full flex items-start gap-3 py-3 px-4 text-left transition-colors border-b border-border-subtle",
        "hover:bg-surface-hover",
        selected && "bg-surface-hover"
      )}
    >
      {selected && (
        <span aria-hidden className="absolute inset-y-0 left-0 w-[2px] bg-accent" />
      )}
      {icon && (
        <div className="h-9 w-9 rounded-full bg-surface-2 shrink-0 flex items-center justify-center text-[12px] font-semibold text-foreground-secondary overflow-hidden">
          {icon}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="text-[13.5px] font-medium text-foreground truncate">{title}</div>
        {subtitle && (
          <div className="text-[12px] text-foreground-muted truncate mt-0.5">
            {subtitle}
          </div>
        )}
      </div>
      {(rightTop || rightBottom) && (
        <div className="flex flex-col items-end gap-1 shrink-0">
          {rightTop && <div className="text-[11.5px] text-foreground-muted">{rightTop}</div>}
          {rightBottom}
        </div>
      )}
    </button>
  );
}

// DetailPane: sticky header + scrollable content. When empty=true,
// shows a centered EmptyState instead.
export function DetailPane({
  header,
  children,
  empty,
  emptyTitle = "Nothing selected",
  emptyHint = "Pick an item from the list, or create a new one.",
}: {
  header?: React.ReactNode;
  children?: React.ReactNode;
  empty?: boolean;
  emptyTitle?: string;
  emptyHint?: string;
}) {
  if (empty) {
    return (
      <section className="flex-1 flex items-center justify-center bg-background">
        <EmptyState title={emptyTitle} hint={emptyHint} />
      </section>
    );
  }
  return (
    <section className="flex-1 flex flex-col min-w-0 bg-background overflow-hidden">
      {header && (
        <div className="border-b border-border bg-surface px-6 py-4">{header}</div>
      )}
      <div className="flex-1 overflow-y-auto p-6">{children}</div>
    </section>
  );
}

// EmptyState: inbox icon + title + hint + optional action.
export function EmptyState({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center text-center max-w-sm px-6">
      <div className="h-14 w-14 rounded-full bg-surface-2 flex items-center justify-center mb-4">
        <Inbox className="h-6 w-6 text-foreground-muted" />
      </div>
      <div className="text-[14px] font-semibold text-foreground">{title}</div>
      {hint && <div className="text-[13px] text-foreground-secondary mt-1">{hint}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

// DetailSection: small caps section header inside a detail pane.
export function DetailSection({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-foreground-muted">
          {title}
        </h3>
        {action}
      </div>
      {children}
    </section>
  );
}

// DetailField: labelled value row, used heavily in detail panes.
export function DetailField({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-[11px] font-medium uppercase tracking-wider text-foreground-muted mb-0.5">
        {label}
      </div>
      <div className="text-[13.5px] text-foreground">
        {value || <span className="text-foreground-muted">--</span>}
      </div>
    </div>
  );
}
