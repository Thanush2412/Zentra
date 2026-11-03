"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  DEFAULT_PAGE_SIZE_OPTIONS,
  getPaginationRange,
  withActivePageSize,
} from "@/lib/pagination";

export interface UsePaginationOptions {
  pageSize?: number;
  pageSizeOptions?: readonly number[];
  /** When any value changes the list resets to page 1 (search, filters, scope). */
  resetKeys?: readonly unknown[];
}

export function usePagination<T>(
  items: readonly T[],
  { pageSize: initialPageSize = 25, pageSizeOptions, resetKeys = [] }: UsePaginationOptions = {}
) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSizeState] = useState(initialPageSize);

  const resetSignature = JSON.stringify(resetKeys);
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    setPage(1);
  }, [resetSignature]);

  const range = getPaginationRange(items.length, page, pageSize);

  useEffect(() => {
    if (range.safePage !== page) setPage(range.safePage);
  }, [range.safePage, page]);

  const pageItems = useMemo(
    () => items.slice(range.startIndex, range.endIndex),
    [items, range.startIndex, range.endIndex]
  );

  const setPageSize = (size: number) => {
    setPageSizeState(size);
    setPage(1);
  };

  return {
    page: range.safePage,
    setPage,
    pageSize,
    setPageSize,
    pageItems,
    pageSizeOptions: withActivePageSize(
      pageSizeOptions ?? DEFAULT_PAGE_SIZE_OPTIONS,
      pageSize
    ),
    ...range,
  };
}
