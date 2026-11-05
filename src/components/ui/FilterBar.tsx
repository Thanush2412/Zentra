"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface FilterBarProps {
  children: ReactNode;
  /** Secondary cluster (bulk actions, exports) pinned to the end of the row. */
  aside?: ReactNode;
  className?: string;
}

/**
 * Admin filter/search row. The px-3 inset matches TableCell's px-3 so the first
 * control lines up with the first table column underneath it.
 */
export function FilterBar({ children, aside, className }: FilterBarProps) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2.5 rounded-2xl border border-slate-100 bg-white shadow-card px-4 py-2.5",
        className
      )}
    >
      {children}
      {aside && <div className="ml-auto flex flex-wrap items-center gap-2">{aside}</div>}
    </div>
  );
}
