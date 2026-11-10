import { Database } from "@/lib/icons";
import { useT } from "@/lib/i18n";

// Two empty states, because they are two different situations.
//
// A table narrowed to nothing by a search is telling you to widen it. A table
// with nothing in it is telling you to add the first record, and advising
// that person to adjust filters they never set sends them looking for a
// control that is already in its default position.
export function TableEmptyState({ filtered = false }: { filtered?: boolean }) {
  const t = useT();
  const title = filtered
    ? t("table.empty", "No records found")
    : t("table.emptyAll", "Nothing here yet");
  const hint = filtered
    ? t("table.emptyHint", "Try adjusting your search or filters")
    : t("table.emptyAllHint", "The first record you add shows up here.");
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div className="rounded-full bg-bg-tertiary p-4 mb-4">
        <Database className="h-8 w-8 text-text-muted" />
      </div>
      <h3 className="text-sm font-medium text-foreground mb-1">{title}</h3>
      <p className="text-sm text-text-muted">{hint}</p>
    </div>
  );
}
