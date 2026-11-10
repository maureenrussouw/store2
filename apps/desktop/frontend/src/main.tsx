import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider, createRouter, createHashHistory } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { queryClient } from "./lib/query-client";
import { AuthProvider } from "./lib/auth-provider";
import { ThemeProvider } from "./lib/theme-provider";
import { ConfirmProvider } from "./components/confirm-dialog";
import "./lib/fonts";
import "./globals.css";
// Yours, and never written over. Imported last so what it sets wins.
import "./brand.css";

// Hash history works inside Wails' single-page webview context.
const router = createRouter({
  routeTree,
  history: createHashHistory(),
  context: { auth: undefined! }, // populated by AuthProvider
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

ReactDOM.createRoot(document.getElementById("app")!).render(
  <React.StrictMode>
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <ConfirmProvider>
            <RouterProvider router={router} />
          </ConfirmProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  </React.StrictMode>
);
