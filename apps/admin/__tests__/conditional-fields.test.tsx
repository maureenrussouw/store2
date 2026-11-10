import { describe, it, expect, vi, beforeAll } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { FormDefinition } from "@/lib/resource";
import { FormBuilder } from "@/components/forms/form-builder";

beforeAll(() => {
  // jsdom lacks what a positioned popup measures with.
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
  Element.prototype.scrollIntoView ??= vi.fn();
});

function wrap(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{ui}</QueryClientProvider>;
}

// A billing cycle belongs to a recurring project and means nothing on a
// one-off one.
const form: FormDefinition = {
  fields: [
    {
      key: "kind",
      label: "Project type",
      type: "select",
      required: true,
      options: [
        { value: "one_off", label: "One-off" },
        { value: "recurring", label: "Recurring" },
      ],
    },
    {
      key: "cycle",
      label: "Billing cycle",
      type: "select",
      options: [
        { value: "monthly", label: "Monthly" },
        { value: "annually", label: "Annually" },
      ],
      visibleWhen: (v) => v.kind === "recurring",
      requiredWhen: (v) => v.kind === "recurring",
    },
  ],
};

describe("a field that only sometimes applies", () => {
  it("is absent on a one-off project and present on a recurring one", () => {
    const onSubmit = vi.fn();
    const { unmount } = render(
      wrap(<FormBuilder form={form} defaultValues={{ kind: "one_off" }}
        onSubmit={onSubmit} onCancel={() => {}} isSubmitting={false} />),
    );
    expect(screen.queryByText("Billing cycle")).toBeNull();
    unmount();

    render(
      wrap(<FormBuilder form={form} defaultValues={{ kind: "recurring" }}
        onSubmit={onSubmit} onCancel={() => {}} isSubmitting={false} />),
    );
    expect(screen.getByText("Billing cycle")).toBeTruthy();
  });

  // The stale value is the whole reason hidden fields are cleared rather than
  // left out: a project moved off recurring would go on billing monthly.
  it("submits a hidden field cleared, not as it was", async () => {
    const onSubmit = vi.fn();
    render(
      wrap(<FormBuilder form={form} defaultValues={{ kind: "one_off", cycle: "monthly" }}
        onSubmit={onSubmit} onCancel={() => {}} isSubmitting={false} />),
    );

    const save = screen.getByRole("button", { name: /save|create|update/i });
    save.click();
    await new Promise((r) => setTimeout(r, 0));

    expect(onSubmit).toHaveBeenCalled();
    expect(onSubmit.mock.calls[0][0].cycle).toBe("");
  });
});
