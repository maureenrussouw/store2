import { createFileRoute, redirect } from "@tanstack/react-router";

// Root redirect: if authenticated go to /app, else /auth/login
export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    // Check for token via Wails bridge (falls back to localStorage in dev)
    const { getToken } = await import("@/lib/wails-bridge");
    const token = await getToken("access_token");
    if (token) {
      throw redirect({ to: "/app" });
    }
    throw redirect({ to: "/auth/login" });
  },
});
