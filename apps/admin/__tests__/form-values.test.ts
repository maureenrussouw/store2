import { describe, it, expect } from "vitest";
import {
  writableValues,
  displayValue,
  displayFormat,
  isDisplayOnly,
  isVisible,
  isRequired,
  emptyValueFor,
} from "@/lib/form-values";

describe("conditional fields", () => {
  const cycle = {
    key: "cycle",
    type: "select" as const,
    required: false,
    visibleWhen: (v: Record<string, unknown>) => v.kind === "recurring",
    requiredWhen: (v: Record<string, unknown>) => v.kind === "recurring",
  };

  it("hides a field whose condition is false", () => {
    expect(isVisible(cycle, { kind: "one_off" })).toBe(false);
    expect(isVisible(cycle, { kind: "recurring" })).toBe(true);
  });

  it("requires it only while it is shown", () => {
    expect(isRequired(cycle, { kind: "one_off" })).toBe(false);
    expect(isRequired(cycle, { kind: "recurring" })).toBe(true);
  });

  it("never requires a hidden field, whatever required says", () => {
    const always = { ...cycle, required: true, requiredWhen: undefined };
    expect(isRequired(always, { kind: "one_off" })).toBe(false);
  });

  it("treats a predicate that throws as visible", () => {
    const broken = {
      key: "x",
      type: "text" as const,
      visibleWhen: () => {
        throw new Error("half-filled form");
      },
    };
    expect(isVisible(broken, {})).toBe(true);
  });

  it("clears a hidden field instead of keeping the stale value", () => {
    const sent = writableValues([{ key: "kind" }, cycle], {
      kind: "one_off",
      cycle: "monthly",
    });
    expect(sent).toEqual({ kind: "one_off", cycle: "" });
  });

  it("sends a shown field as it is", () => {
    const sent = writableValues([{ key: "kind" }, cycle], {
      kind: "recurring",
      cycle: "monthly",
    });
    expect(sent).toEqual({ kind: "recurring", cycle: "monthly" });
  });

  it("clears to the empty value the type uses on a fresh form", () => {
    expect(emptyValueFor({ type: "text" })).toBe("");
    expect(emptyValueFor({ type: "toggle" })).toBe(false);
    expect(emptyValueFor({ type: "files" })).toEqual([]);
    expect(emptyValueFor({ type: "money" })).toBe(null);
    expect(emptyValueFor({ type: "text", defaultValue: "draft" })).toBe("draft");
  });
});

describe("writableValues", () => {
  it("leaves read-only and computed fields out of what is sent", () => {
    const fields = [
      { key: "memo" },
      { key: "balance", readOnly: true },
      { key: "difference", compute: () => 0 },
    ];
    const sent = writableValues(fields, { memo: "rent", balance: 500, difference: 0 });
    expect(sent).toEqual({ memo: "rent" });
  });

  it("keeps values that are not form fields, such as line items", () => {
    expect(writableValues([{ key: "memo" }], { memo: "x", items: [] })).toEqual({ memo: "x", items: [] });
  });
});

describe("displayValue", () => {
  it("computes from the other values", () => {
    const field = {
      key: "difference",
      compute: (v: Record<string, unknown>) => Number(v.debits) - Number(v.credits),
    };
    expect(displayValue(field, { debits: 100, credits: 60 })).toBe(40);
  });

  it("shows nothing, rather than crashing, when compute throws on a half-filled form", () => {
    const field = {
      key: "total",
      compute: (v: Record<string, unknown>) => (v.items as { qty: number }[]).length,
    };
    expect(displayValue(field, {})).toBeUndefined();
  });

  it("shows the stored value for a plain read-only field", () => {
    expect(displayValue({ key: "status" }, { status: "posted" })).toBe("posted");
  });
});

describe("displayFormat and isDisplayOnly", () => {
  it("formats money as money and dates as dates", () => {
    expect(displayFormat({ type: "money" })).toBe("money");
    expect(displayFormat({ type: "datetime" })).toBe("date");
    expect(displayFormat({ type: "text" })).toBeUndefined();
  });

  it("treats a computed field as read-only", () => {
    expect(isDisplayOnly({ compute: () => 1 })).toBe(true);
    expect(isDisplayOnly({})).toBe(false);
  });
});
