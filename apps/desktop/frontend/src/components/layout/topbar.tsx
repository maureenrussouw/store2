import { Search } from "lucide-react";

interface TopbarProps {
  onOpenPalette: () => void;
}

// Slim top bar: just the ⌘K search/command-palette trigger. The standard
// action cluster (refresh · theme · New · notifications · user menu) lives in
// each page's <PageHeader>, matching the admin panel.
export function Topbar({ onOpenPalette }: TopbarProps) {
  return (
    <header className="flex h-14 shrink-0 items-center border-b border-border-subtle bg-background px-6">
      <button
        onClick={onOpenPalette}
        className="flex h-9 w-80 items-center gap-2 rounded-lg border border-border bg-surface-2 px-3 text-[13px] text-foreground-muted transition-colors hover:bg-surface-hover"
      >
        <Search className="h-3.5 w-3.5" />
        <span>Search or jump to...</span>
        <div className="ml-auto flex items-center gap-1 font-mono text-[11px]">
          <kbd className="rounded bg-surface px-1 py-0.5">⌘K</kbd>
        </div>
      </button>
    </header>
  );
}
