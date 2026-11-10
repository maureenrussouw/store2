import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { z } from "zod";

import { FormBuilder } from "@/components/forms/form-builder";

// The shape a generated resource's create form has: the schema the API uses,
// and the fields the admin draws.
const schema = z.object({
  name: z.string().min(3, "Name must be at least 3 characters"),
  email: z.string().email("That is not an email address"),
});

const form = {
  schema,
  fields: [
    { key: "name", label: "Name", type: "text" as const },
    { key: "email", label: "Email", type: "text" as const },
  ],
};

function setup(defaults: Record<string, unknown> = {}) {
  const onSubmit = vi.fn();
  render(
    <FormBuilder
      form={form}
      defaultValues={defaults}
      onSubmit={onSubmit}
      onCancel={vi.fn()}
      submitLabel="Save"
    />
  );
  return { onSubmit };
}

function type(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label, { exact: false }), { target: { value } });
}

describe("a generated form and the schema the API uses", () => {
  it("refuses to submit what the schema refuses", async () => {
    const { onSubmit } = setup();
    type("Name", "ab");
    type("Email", "not-an-email");
    fireEvent.click(screen.getByText("Save"));

    // Both messages come from the schema, not from the field definitions:
    // neither field has a rule of its own here.
    await waitFor(() => {
      expect(screen.getByText("Name must be at least 3 characters")).toBeInTheDocument();
    });
    expect(screen.getByText("That is not an email address")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("submits what the schema accepts", async () => {
    const { onSubmit } = setup();
    type("Name", "Ada Byron");
    type("Email", "ada@example.com");
    fireEvent.click(screen.getByText("Save"));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });
    expect(onSubmit.mock.calls[0][0]).toMatchObject({
      name: "Ada Byron",
      email: "ada@example.com",
    });
  });

  it("holds an edit form to the same schema", async () => {
    // An update form is the same builder with values in it, and this is where
    // a resolver wired only on the create path would show up.
    const { onSubmit } = setup({ name: "Ada Byron", email: "ada@example.com" });
    type("Email", "broken");
    fireEvent.click(screen.getByText("Save"));

    await waitFor(() => {
      expect(screen.getByText("That is not an email address")).toBeInTheDocument();
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
