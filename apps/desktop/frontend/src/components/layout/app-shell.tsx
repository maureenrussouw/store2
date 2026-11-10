import { useState } from "react";
import { TitleBar } from "@/components/layout/title-bar";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { CommandPalette } from "@/components/layout/command-palette";
import { useShortcuts } from "@/lib/use-shortcuts";

// AppShell is the standard authenticated dashboard layout. Composes
// TitleBar + Sidebar + Topbar + scrollable content + Command Palette
// — including Cmd/Ctrl-K binding.
//
// Wrap your dashboard route Outlet with this. Sections in the sidebar
// come from lib/nav-config.ts so adding a section is one config edit.
//
// Usage in routes/_app.tsx:
//   <AppShell><Outlet /></AppShell>
export function AppShell({ children }: { children: React.ReactNode }) {
  const [paletteOpen, setPaletteOpen] = useState(false);

  useShortcuts({
    "mod+k": () => setPaletteOpen(true),
  });

  return (
    <div className="h-screen flex flex-col bg-background">
      <TitleBar />
      <div className="flex-1 flex overflow-hidden">
        <Sidebar />
        <main className="flex-1 flex flex-col overflow-hidden">
          <Topbar onOpenPalette={() => setPaletteOpen(true)} />
          <div className="flex-1 overflow-auto p-content">
            {children}
          </div>
        </main>
      </div>
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </div>
  );
}
