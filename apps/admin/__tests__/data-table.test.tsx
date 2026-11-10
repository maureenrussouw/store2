import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import { DataTable } from "@/components/tables/data-table";

type Row = { id: string; name: string; email: string };

const rows: Row[] = [
  { id: "1", name: "Ada Byron", email: "ada@example.com" },
  { id: "2", name: "Alan Turing", email: "alan@example.com" },
];

const columns = [
  { key: "name", label: "Name", sortable: true },
  { key: "email", label: "Email" },
];

describe("the resource list table", () => {
  it("renders a row per record, with its cells", () => {
    render(<DataTable columns={columns} data={rows} />);
    expect(screen.getByText("Ada Byron")).toBeInTheDocument();
    expect(screen.getByText("alan@example.com")).toBeInTheDocument();
    // Two data rows, plus the header row.
    expect(screen.getAllByRole("row")).toHaveLength(3);
  });

  it("says so when there is nothing, and says something different when a filter is on", () => {
    // The two empty states are not interchangeable: advice about clearing
    // filters is noise to somebody who has not set one, and "create your
    // first" is wrong when there are rows behind a filter.
    const { unmount } = render(<DataTable columns={columns} data={[]} />);
    const empty = document.body.textContent ?? "";
    unmount();

    render(<DataTable columns={columns} data={[]} isFiltered />);
    expect(document.body.textContent).not.toBe(empty);
  });

  it("asks to sort by the column that was clicked", () => {
    const onSort = vi.fn();
    render(<DataTable columns={columns} data={rows} onSort={onSort} />);

    fireEvent.click(screen.getByText("Name"));
    expect(onSort).toHaveBeenCalledWith("name");

    // A column that is not sortable must not ask: the API would sort by a
    // field it does not accept.
    onSort.mockClear();
    fireEvent.click(screen.getByText("Email"));
    expect(onSort).not.toHaveBeenCalled();
  });

  it("reports a selection by id", () => {
    const onSelectRows = vi.fn();
    render(
      <DataTable columns={columns} data={rows} selectedRows={[]} onSelectRows={onSelectRows} />
    );
    const boxes = screen.getAllByRole("checkbox");
    // The first is the header's select-all.
    fireEvent.click(boxes[boxes.length - 1]);
    expect(onSelectRows).toHaveBeenCalledWith(["2"]);
  });

  it("keeps the rows on screen while refetching", () => {
    // isFetching with rows is a background refresh. Blanking the table there
    // makes every filter change flash, which reads as the app losing the data.
    render(<DataTable columns={columns} data={rows} isFetching />);
    expect(screen.getByText("Ada Byron")).toBeInTheDocument();
  });
});
