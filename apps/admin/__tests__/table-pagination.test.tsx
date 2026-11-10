import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import { TablePagination } from "@/components/tables/table-pagination";

function setup(page: number, total = 95, pageSize = 10) {
  const onPageChange = vi.fn();
  const onPageSizeChange = vi.fn();
  render(
    <TablePagination
      page={page}
      pageSize={pageSize}
      total={total}
      totalPages={Math.ceil(total / pageSize)}
      onPageChange={onPageChange}
      onPageSizeChange={onPageSizeChange}
    />
  );
  return { onPageChange, onPageSizeChange };
}

describe("list pagination", () => {
  it("says which rows are on screen", () => {
    setup(3);
    // 1-indexed and inclusive, which is what a person reads. An off-by-one
    // here is the kind of thing nobody reports and everybody notices.
    expect(screen.getByText(/21.*30.*95/)).toBeInTheDocument();
  });

  it("clamps the last page to the real count", () => {
    setup(10);
    expect(screen.getByText(/91.*95.*95/)).toBeInTheDocument();
  });

  it("moves a page at a time and to the ends", () => {
    const { onPageChange } = setup(5);
    fireEvent.click(screen.getByText("Next"));
    expect(onPageChange).toHaveBeenLastCalledWith(6);
    fireEvent.click(screen.getByText("Prev"));
    expect(onPageChange).toHaveBeenLastCalledWith(4);
    fireEvent.click(screen.getByText("First"));
    expect(onPageChange).toHaveBeenLastCalledWith(1);
  });

  it("cannot go back from the first page or on from the last", () => {
    const { onPageChange } = setup(1);
    fireEvent.click(screen.getByText("Prev"));
    expect(onPageChange).not.toHaveBeenCalled();
  });

  it("changes the page size", () => {
    const { onPageSizeChange } = setup(1);
    fireEvent.change(screen.getByLabelText("Rows per page"), { target: { value: "50" } });
    expect(onPageSizeChange).toHaveBeenCalledWith(50);
  });

  it("renders nothing at all when there are no rows", () => {
    // The table shows its own empty state. A pagination bar reading
    // "Showing 1-0 of 0" underneath it is noise.
    const { container } = render(
      <TablePagination
        page={1}
        pageSize={10}
        total={0}
        totalPages={0}
        onPageChange={vi.fn()}
        onPageSizeChange={vi.fn()}
      />
    );
    expect(container).toBeEmptyDOMElement();
  });
});
