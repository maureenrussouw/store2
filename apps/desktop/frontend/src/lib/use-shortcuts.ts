import { useEffect } from "react";

// Register global keyboard shortcuts. "mod+k" = Cmd+K on Mac, Ctrl+K on Win/Linux.
export function useShortcuts(bindings: Record<string, () => void>) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      const key = e.key.toLowerCase();

      for (const [combo, callback] of Object.entries(bindings)) {
        const parts = combo.toLowerCase().split("+");
        const needsMod = parts.includes("mod");
        const needsShift = parts.includes("shift");
        const needsAlt = parts.includes("alt");
        const targetKey = parts[parts.length - 1];

        if (needsMod && !mod) continue;
        if (needsShift !== e.shiftKey) continue;
        if (needsAlt !== e.altKey) continue;
        if (targetKey !== key) continue;

        e.preventDefault();
        callback();
        return;
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [bindings]);
}
