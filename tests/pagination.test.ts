import { describe, it, expect } from "vitest";
import {
  DEFAULT_PAGE_SIZE_OPTIONS,
  getPageNumbers,
  getPaginationRange,
  resolvePageSize,
  withActivePageSize,
} from "@/lib/pagination";

describe("getPaginationRange", () => {
  it("reports a 1-based window for a middle page", () => {
    expect(getPaginationRange(312, 2, 25)).toEqual({
      safePage: 2,
      totalPages: 13,
      startIndex: 25,
      endIndex: 50,
      startItem: 26,
      endItem: 50,
    });
  });

  it("clamps the page to the first and last page", () => {
    expect(getPaginationRange(312, 0, 25).safePage).toBe(1);
    expect(getPaginationRange(312, -4, 25).safePage).toBe(1);
    expect(getPaginationRange(312, 999, 25).safePage).toBe(13);
  });

  it("clamps after a filter shrinks the list", () => {
    const range = getPaginationRange(4, 7, 25);
    expect(range.safePage).toBe(1);
    expect(range.totalPages).toBe(1);
    expect(range.startItem).toBe(1);
    expect(range.endItem).toBe(4);
  });

  it("handles an empty list without a phantom first record", () => {
    expect(getPaginationRange(0, 3, 25)).toEqual({
      safePage: 1,
      totalPages: 1,
      startIndex: 0,
      endIndex: 0,
      startItem: 0,
      endItem: 0,
    });
  });

  it("falls back to 25 for an invalid page size", () => {
    expect(resolvePageSize(0)).toBe(25);
    expect(resolvePageSize(-10)).toBe(25);
    expect(resolvePageSize(Number.NaN)).toBe(25);
    expect(getPaginationRange(40, 1, 0).totalPages).toBe(2);
  });
});

describe("getPageNumbers", () => {
  it("lists every page when the range is short", () => {
    expect(getPageNumbers(1, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("collapses both sides for a middle page", () => {
    expect(getPageNumbers(6, 13)).toEqual([1, "...", 5, 6, 7, "...", 13]);
  });

  it("keeps the first pages anchored", () => {
    expect(getPageNumbers(1, 10)).toEqual([1, 2, 3, 4, "...", 10]);
    expect(getPageNumbers(3, 10)).toEqual([1, 2, 3, 4, "...", 10]);
  });

  it("keeps the last pages anchored", () => {
    expect(getPageNumbers(9, 10)).toEqual([1, "...", 7, 8, 9, 10]);
  });

  it("clamps out-of-range input", () => {
    expect(getPageNumbers(99, 13)).toEqual([1, "...", 10, 11, 12, 13]);
  });
});

describe("withActivePageSize", () => {
  it("adds a non-preset active size so the select never renders blank", () => {
    expect(withActivePageSize(DEFAULT_PAGE_SIZE_OPTIONS, 15)).toEqual([10, 15, 25, 50, 100]);
  });

  it("does not duplicate an existing active size", () => {
    expect(withActivePageSize([10, 25, 50, 100], 25)).toEqual([10, 25, 50, 100]);
  });

  it("does not mutate the caller's options", () => {
    const options = [10, 25];
    withActivePageSize(options, 15);
    expect(options).toEqual([10, 25]);
  });

  it("falls back to the default presets when options are omitted", () => {
    expect(withActivePageSize(undefined, 25)).toEqual(DEFAULT_PAGE_SIZE_OPTIONS);
  });
});
