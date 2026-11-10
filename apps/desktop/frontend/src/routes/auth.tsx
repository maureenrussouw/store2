import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";
import { TitleBar } from "@/components/layout/title-bar";

export const Route = createFileRoute("/auth")({
  beforeLoad: async () => {
    const { getToken } = await import("@/lib/wails-bridge");
    const token = await getToken("access_token");
    if (token) {
      throw redirect({ to: "/app" });
    }
  },
  component: AuthLayout,
});

function AuthLayout() {
  return (
    <div className="flex flex-col h-screen bg-background">
      <TitleBar showSidebarControls={false} />
      {/* flex + min-h-0 so the AuthShell (a flex child) STRETCHES to the full
          remaining height. A plain flex-1 wrapper computes height:auto, leaving
          the shell's min-h-full resolving to content height — that's why the
          split hero didn't reach the bottom. overflow-auto scrolls a tall form. */}
      <div className="flex-1 flex min-h-0 overflow-auto">
        <Outlet />
      </div>
    </div>
  );
}
