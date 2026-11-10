import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
import path from "node:path";

// Where the Go API listens, resolved once.
//
// envDir is the monorepo root, not this directory: the app runs from
// apps/desktop/frontend and there is no .env there, so reading it from cwd
// returned undefined and every value below fell back to its default.
//
// APP_PORT is the same variable the Go binary reads, so moving the API moves
// the proxy and the client with it. The client used to carry its own literal
// localhost:8080, which meant that on a project that had moved APP_PORT it
// called a port nothing was listening on, or worse, one that answered and
// belonged to something else.
const viteMode = process.env.NODE_ENV || "development";
const viteEnv = loadEnv(viteMode, path.resolve(__dirname, "../../.."), "");
const apiTarget =
  viteEnv.VITE_API_URL?.replace(/\/api\/?$/, "") ||
  "http://localhost:" + (viteEnv.APP_PORT || "8080");

// Handed to the browser bundle so the client and the proxy cannot disagree.
// api-client.ts reads import.meta.env.VITE_API_URL, and Vite exposes a
// variable to client code only when it carries the VITE_ prefix, which
// APP_PORT does not.
const clientEnv = {
  "import.meta.env.VITE_API_URL": JSON.stringify(apiTarget + "/api"),
};

export default defineConfig({
  plugins: [
    TanStackRouterVite({ routesDirectory: "./src/routes", generatedRouteTree: "./src/routeTree.gen.ts" }),
    react(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@repo/shared": path.resolve(__dirname, "../../../packages/shared"),
    },
  },
  define: clientEnv,
  server: {
    port: 5174,
    strictPort: true,
    // In dev, proxy /api to the Go API server. Wails dev mode runs this Vite
    // server and wraps it in a native window.
    proxy: {
      "/api": {
        target: apiTarget,
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
