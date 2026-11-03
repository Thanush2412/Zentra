"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { Search, Building2, Calendar, Filter } from "lucide-react";
import { Combobox, ComboboxOption } from "@/components/ui/combobox";

export interface FilterBarProps {
  // Campus Scope
  campusScope?: string;
  onCampusChange?: (campusId: string) => void;
  campusOptions?: ComboboxOption[];
  showCampusFilter?: boolean;

  // Search
  searchValue?: string;
  onSearchChange?: (val: string) => void;
  searchPlaceholder?: string;

  // Date
  dateValue?: string;
  onDateChange?: (date: string) => void;
  showDateFilter?: boolean;

  // Right-aligned Actions Slot
  actions?: React.ReactNode;
  className?: string;
}

export function FilterBar({
  campusScope,
  onCampusChange,
  campusOptions = [],
  showCampusFilter = false,
  searchValue,
  onSearchChange,
  searchPlaceholder = "Search...",
  dateValue,
  onDateChange,
  showDateFilter = false,
  actions,
  className
}: FilterBarProps) {
  return (
    <div
      className={cn(
        "p-3 rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-[#131317] shadow-xs flex flex-wrap items-center justify-between gap-3",
        className
      )}
    >
      <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[280px]">
        {/* Search */}
        {onSearchChange && (
          <div className="relative min-w-[200px] flex-1 max-w-xs">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchValue || ""}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-[#181820] border border-slate-200 dark:border-slate-800 rounded-xl font-medium text-slate-800 dark:text-slate-200 placeholder-slate-400 outline-none focus:border-[#D528A2] transition-colors"
            />
          </div>
        )}

        {/* Campus Scope Selector */}
        {showCampusFilter && onCampusChange && campusOptions.length > 0 && (
          <div className="min-w-[180px] max-w-xs">
            <Combobox
              ariaLabel="Filter by campus"
              value={campusScope || "all"}
              onChange={onCampusChange}
              options={campusOptions}
              placeholder="Select Campus..."
              searchable
            />
          </div>
        )}

        {/* Date Filter */}
        {showDateFilter && onDateChange && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 dark:bg-[#181820] border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300">
            <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <input
              type="date"
              value={dateValue || ""}
              onChange={(e) => onDateChange(e.target.value)}
              className="bg-transparent outline-none cursor-pointer text-xs font-bold text-slate-800 dark:text-slate-200"
            />
          </div>
        )}
      </div>

      {/* Action Buttons Slot */}
      {actions && (
        <div className="flex items-center gap-2 shrink-0 ml-auto">
          {actions}
        </div>
      )}
    </div>
  );
}

export default FilterBar;
