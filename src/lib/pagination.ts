export const DEFAULT_PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

export type PageToken = number | "...";

export interface PaginationRange {
  safePage: number;
  totalPages: number;
  /** 0-based, inclusive. */
  startIndex: number;
  /** 0-based, exclusive. */
  endIndex: number;
  /** 1-based display value, 0 when there are no items. */
  startItem: number;
  endItem: number;
}

export function resolvePageSize(pageSize: number, fallback = 25): number {
  return Number.isFinite(pageSize) && pageSize > 0 ? Math.floor(pageSize) : fallback;
}

export function getPaginationRange(
  totalItems: number,
  page: number,
  pageSize: number
): PaginationRange {
  const total = Number.isFinite(totalItems) ? Math.max(0, Math.floor(totalItems)) : 0;
  const size = resolvePageSize(pageSize);
  const totalPages = Math.max(1, Math.ceil(total / size));
  const safePage = Math.min(
    Math.max(1, Number.isFinite(page) ? Math.floor(page) : 1),
    totalPages
  );
  const startIndex = total === 0 ? 0 : (safePage - 1) * size;
  const endIndex = Math.min(startIndex + size, total);

  return {
    safePage,
    totalPages,
    startIndex,
    endIndex,
    startItem: total === 0 ? 0 : startIndex + 1,
    endItem: endIndex,
  };
}

export function getPageNumbers(
  currentPage: number,
  totalPages: number,
  maxVisible = 5
): PageToken[] {
  const total = Math.max(1, Math.floor(totalPages));
  const safePage = Math.min(Math.max(1, Math.floor(currentPage)), total);
  const pages: PageToken[] = [];

  if (total <= maxVisible + 2) {
    for (let i = 1; i <= total; i++) pages.push(i);
    return pages;
  }

  pages.push(1);
  let leftBound = Math.max(2, safePage - 1);
  let rightBound = Math.min(total - 1, safePage + 1);

  if (safePage <= 3) {
    leftBound = 2;
    rightBound = 4;
  } else if (safePage >= total - 2) {
    leftBound = total - 3;
    rightBound = total - 1;
  }

  if (leftBound > 2) pages.push("...");
  for (let i = leftBound; i <= rightBound; i++) pages.push(i);
  if (rightBound < total - 1) pages.push("...");
  pages.push(total);

  return pages;
}

/** Guarantees the active page size is selectable even when it is not in the preset list. */
export function withActivePageSize(
  options: readonly number[] | undefined,
  activePageSize: number
): number[] {
  const sizes = new Set<number>();
  for (const option of options ?? DEFAULT_PAGE_SIZE_OPTIONS) {
    if (Number.isFinite(option) && option > 0) sizes.add(Math.floor(option));
  }
  sizes.add(resolvePageSize(activePageSize));
  return Array.from(sizes).sort((a, b) => a - b);
}
