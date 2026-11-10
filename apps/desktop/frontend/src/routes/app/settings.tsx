import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { useTheme } from "@/lib/theme-provider";
import { Moon, Sun } from "lucide-react";
import { OfflineModeToggle } from "@/components/offline-mode-toggle";
import { QuickAccessSettings } from "@/components/quick-access";

export const Route = createFileRoute("/app/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const { theme, setTheme } = useTheme();

  return (
    <div>
      <PageHeader title="Settings" description="Configure your desktop app" />

      <div className="mt-6 max-w-2xl space-y-4">
        <Card>
          <CardContent className="p-6">
            <div>
              <h3 className="text-[15px] font-semibold text-foreground">Sync &amp; Offline</h3>
              <p className="mt-1 mb-4 text-[13px] text-foreground-secondary">
                By default the app works online and mirrors your data locally.
                Switch to offline to keep working against the local copy — your
                changes queue up and sync automatically when you switch back.
              </p>
              <OfflineModeToggle />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-[15px] font-semibold text-foreground">Appearance</h3>
                <p className="mt-1 text-[13px] text-foreground-secondary">
                  Choose your preferred theme
                </p>
              </div>
              <button
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                className="flex items-center gap-2 rounded-lg border border-border bg-surface-2 px-3 h-9 text-[13px] font-medium text-foreground hover:bg-surface-hover transition-colors"
              >
                {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                {theme === "dark" ? "Light" : "Dark"}
              </button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <QuickAccessSettings />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <h3 className="text-[15px] font-semibold text-foreground">Keyboard Shortcuts</h3>
            <p className="mt-1 text-[13px] text-foreground-secondary">
              Global shortcuts available everywhere in the app.
            </p>
            <div className="mt-4 space-y-2 text-[13px]">
              <div className="flex items-center justify-between">
                <span className="text-foreground-secondary">Command palette</span>
                <kbd className="rounded border border-border bg-surface-2 px-1.5 py-0.5 text-[11px] font-mono">⌘K</kbd>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-foreground-secondary">Settings</span>
                <kbd className="rounded border border-border bg-surface-2 px-1.5 py-0.5 text-[11px] font-mono">⌘,</kbd>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-foreground-secondary">Logout</span>
                <kbd className="rounded border border-border bg-surface-2 px-1.5 py-0.5 text-[11px] font-mono">⌘L</kbd>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
