import * as React from "react";
import { cn } from "@/lib/utils";

export interface SelectProps
  extends React.SelectHTMLAttributes<HTMLSelectElement> {}

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, children, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        "flex h-9 w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-[#181820]/80 px-3 py-1 text-xs font-semibold text-slate-800 dark:text-slate-200 transition-all focus:outline-none focus:ring-2 focus:ring-[#D528A2]/30 focus:border-[#D528A2] disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    >
      {children}
    </select>
  )
);
Select.displayName = "Select";

export { Select };
