"use client";

import React from "react";

export function AdminTabSkeleton({ message = "Loading…" }: { message?: string }) {
  return (
    <div className="space-y-6 animate-pulse font-sans">
      {/* Header Skeleton matching PageHeader */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 mb-2 border-b border-slate-200/80">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-slate-200/80 shrink-0" />
          <div className="space-y-1.5 min-w-0">
            <div className="h-5 w-44 sm:w-56 rounded-md bg-slate-200/80" />
            <div className="h-3.5 w-60 sm:w-80 rounded-md bg-slate-100" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-9 w-28 rounded-xl bg-slate-200/60" />
        </div>
      </div>

      {/* Surface Card Skeleton */}
      <div className="rounded-xl border border-slate-200/80 bg-white p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="h-4 w-36 rounded bg-slate-200/70" />
          <div className="h-8 w-48 rounded-xl bg-slate-100" />
        </div>
        <div className="space-y-3 pt-2">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="flex items-center gap-4 py-2.5 border-b border-slate-100/60 last:border-0">
              <div className="h-4 w-1/4 rounded bg-slate-100" />
              <div className="h-4 w-1/3 rounded bg-slate-100/80 hidden sm:block" />
              <div className="h-4 w-1/6 rounded bg-slate-100/70 hidden md:block" />
              <div className="h-6 w-14 rounded-lg bg-slate-200/60 ml-auto shrink-0" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
