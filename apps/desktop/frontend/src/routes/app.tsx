import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { TitleBar } from "@/components/layout/title-bar";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { CommandPalette } from "@/components/layout/command-palette";
import { QuickAccess } from "@/components/quick-access";
import { usePendingUploads } from "@/hooks/use-pending-uploads";
import { useShortcuts } from "@/lib/use-shortcuts";

export const Route = createFileRoute("/app")({
  beforeLoad: async () => {
    const { getToken } = await import("@/lib/wails-bridge");
    const token = await getToken("access_token");
    if (!token) {
      throw redirect({ to: "/auth/login" });
    }
  },
  component: AppLayout,
});

function AppLayout() {
  const [paletteOpen, setPaletteOpen] = useState(false);

  // Uploads files that were picked offline once the connection returns.
  usePendingUploads();

  // Global keyboard shortcuts
  useShortcuts({
    "mod+k": () => setPaletteOpen(true),
  });

  // Close palette on escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPaletteOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Frameless title bar */}
      <TitleBar />

      <div className="flex flex-1 overflow-hidden">
        {/* Fixed desktop sidebar (NOT collapsible — desktop has room) */}
        <Sidebar />

        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Topbar: search, notifications, theme, user */}
          <Topbar onOpenPalette={() => setPaletteOpen(true)} />

          {/* Main content — 32px padding (more negative space than web) */}
          <main className="flex-1 overflow-auto p-content">
            <Outlet />
          </main>
        </div>
      </div>

      {/* Command palette (Cmd+K) */}
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />

      {/* Floating quick-access button (configurable) */}
      <QuickAccess />
    </div>
  );
}
