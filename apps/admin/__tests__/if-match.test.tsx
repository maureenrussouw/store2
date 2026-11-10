import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import React from "react";

const request = vi.fn();

vi.mock("@/lib/api-client", () => ({
  apiClient: {
    request: (...args: unknown[]) => request(...args),
  },
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import {
  useUpdateResource,
  usePatchResource,
  versionOf,
  isVersionConflict,
  currentVersion,
} from "@/hooks/use-resource";

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return React.createElement(QueryClientProvider, { client }, children);
}

beforeEach(() => {
  request.mockReset();
  request.mockResolvedValue({ data: { data: { id: "1" } } });
});

describe("saving an edit", () => {
  it("sends the version it loaded as If-Match", async () => {
    const { result } = renderHook(() => useUpdateResource("/api/widgets", "Widget"), { wrapper });

    result.current.mutate({ id: "1", body: { name: "Second" }, version: 7 });
    await waitFor(() => expect(request).toHaveBeenCalled());

    const config = request.mock.calls[0][0];
    expect(config.method).toBe("put");
    expect(config.url).toBe("/api/widgets/1");
    // The weak form, which is what the API's own ETag uses, so what goes back
    // is what came out.
    expect(config.headers).toEqual({ "If-Match": 'W/"7"' });
  });

  it("sends no precondition when there is no version to send", async () => {
    // A record with no version column, or a caller that means "overwrite
    // whatever is there". The header has to be absent rather than empty: an
    // If-Match the server cannot read matches no row, so an empty one would
    // turn every such save into a 409.
    const { result } = renderHook(() => useUpdateResource("/api/widgets", "Widget"), { wrapper });

    result.current.mutate({ id: "1", body: { name: "Second" }, version: undefined });
    await waitFor(() => expect(request).toHaveBeenCalled());

    expect(request.mock.calls[0][0].headers).toBeUndefined();
  });

  it("sends it on a partial save too", async () => {
    // The grouped update view saves one section at a time through patch, and a
    // section saved without the precondition is the same lost write by another
    // route.
    const { result } = renderHook(() => usePatchResource("/api/widgets", "Widget"), { wrapper });

    result.current.mutate({ id: "1", body: { name: "Second" }, version: 3 });
    await waitFor(() => expect(request).toHaveBeenCalled());

    const config = request.mock.calls[0][0];
    expect(config.method).toBe("patch");
    expect(config.headers).toEqual({ "If-Match": 'W/"3"' });
  });
});

describe("versionOf", () => {
  it("reads the column off a loaded record, and nothing else", () => {
    expect(versionOf({ id: "1", version: 4 })).toBe(4);
    expect(versionOf({ id: "1" })).toBeUndefined();
    expect(versionOf(null)).toBeUndefined();
    expect(versionOf(undefined)).toBeUndefined();
    // A string version is what a wire format that stringifies numbers would
    // give, and sending "4" as a precondition matches no row.
    expect(versionOf({ version: "4" })).toBeUndefined();
  });
});

describe("the 409 the API answers a stale write with", () => {
  const conflict = {
    response: {
      status: 409,
      data: {
        error: {
          code: "VERSION_CONFLICT",
          message: "This record changed after you loaded it. Reload it and try again.",
          details: { current_version: 9 },
        },
      },
    },
  };

  it("is recognised, and carries the version the record is at now", () => {
    expect(isVersionConflict(conflict)).toBe(true);
    expect(currentVersion(conflict)).toBe(9);
  });

  it("is not confused with the other 409", () => {
    // A unique-constraint violation is also a 409, and that one is the
    // caller's to fix rather than a reason to reload. Hence the check on the
    // code and not on the status.
    const duplicate = {
      response: { status: 409, data: { error: { code: "DUPLICATE", message: "Already exists" } } },
    };
    expect(isVersionConflict(duplicate)).toBe(false);
    expect(currentVersion(duplicate)).toBeUndefined();
    expect(isVersionConflict(new Error("network"))).toBe(false);
  });
});
