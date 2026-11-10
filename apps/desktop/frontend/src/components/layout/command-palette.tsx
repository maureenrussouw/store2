import { useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import { Search, Home, User, Settings, LogOut, ArrowRight } from "lucide-react";
import { useLogout } from "@/hooks/use-auth";

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const navigate = useNavigate();
  const { mutate: logout } = useLogout();
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const go = (to: string) => {
    navigate({ to });
    onOpenChange(false);
    setQuery("");
  };

  const commands = [
    { id: "dashboard", label: "Dashboard", shortcut: "G D", icon: Home, action: () => go("/app") },
    { id: "profile", label: "Profile", shortcut: "G P", icon: User, action: () => go("/app/profile") },
    { id: "settings", label: "Settings", shortcut: "⌘,", icon: Settings, action: () => go("/app/settings") },
    { id: "logout", label: "Log out", shortcut: "⌘L", icon: LogOut, action: () => { logout(undefined, { onSuccess: () => go("/auth/login") }); } },
  ];

  const filtered = commands.filter((c) =>
    c.label.toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 0);
      setQuery("");
      setSelectedIndex(0);
    }
  }, [open]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!open) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        filtered[selectedIndex]?.action();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, filtered, selectedIndex]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] bg-black/40 backdrop-blur-sm">
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[560px] mx-4 rounded-xl border border-border bg-surface-3 shadow-2xl overflow-hidden"
      >
        {/* Input */}
        <div className="flex items-center gap-3 border-b border-border-subtle px-4 h-12">
          <Search className="h-4 w-4 text-foreground-muted shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSelectedIndex(0); }}
            placeholder="Type a command or search..."
            className="flex-1 bg-transparent text-[14px] text-foreground placeholder:text-foreground-muted focus:outline-none"
          />
          <kbd className="rounded border border-border bg-surface-2 px-1.5 py-0.5 text-[10px] font-mono text-foreground-muted">ESC</kbd>
        </div>

        {/* Results */}
        <div className="max-h-[400px] overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <div className="px-4 py-8 text-center text-[13px] text-foreground-muted">
              No results for "{query}"
            </div>
          ) : (
            filtered.map((cmd, i) => {
              const Icon = cmd.icon;
              const isSelected = i === selectedIndex;
              return (
                <button
                  key={cmd.id}
                  onClick={cmd.action}
                  onMouseEnter={() => setSelectedIndex(i)}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${
                    isSelected ? "bg-accent/10" : "hover:bg-surface-hover"
                  }`}
                >
                  <Icon className={`h-4 w-4 shrink-0 ${isSelected ? "text-accent" : "text-foreground-secondary"}`} />
                  <span className={`flex-1 text-[14px] ${isSelected ? "text-foreground" : "text-foreground-secondary"}`}>
                    {cmd.label}
                  </span>
                  <div className="flex items-center gap-1">
                    {cmd.shortcut && (
                      <kbd className="rounded border border-border bg-surface-2 px-1.5 py-0.5 text-[11px] font-mono text-foreground-muted">
                        {cmd.shortcut}
                      </kbd>
                    )}
                    {isSelected && <ArrowRight className="h-3.5 w-3.5 text-accent" />}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
      <div
        className="fixed inset-0 -z-10"
        onClick={() => onOpenChange(false)}
      />
    </div>
  );
}
