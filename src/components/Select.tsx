import React from "react";
import { cn } from "@/lib/utils";

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: (SelectOption | string)[];
  error?: string;
}

export const Select: React.FC<SelectProps> = ({
  label,
  options = [],
  error,
  className = "",
  id,
  ...rest
}) => {
  const selectId = id || label?.toLowerCase().replace(/\s+/g, "-");
  const normalizedOptions: SelectOption[] = options.map((o) =>
    typeof o === "string" ? { value: o, label: o } : o
  );

  return (
    <div className="space-y-1.5 w-full">
      {label && (
        <label
          htmlFor={selectId}
          className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider block"
        >
          {label}
        </label>
      )}
      <select
        id={selectId}
        {...rest}
        className={cn(
          "w-full bg-white dark:bg-[#181820] border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs",
          "font-bold text-slate-800 dark:text-slate-100 cursor-pointer shadow-xs",
          "focus:outline-none focus:ring-2 focus:ring-[#D528A2]/30 focus:border-[#D528A2]",
          "transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed",
          error && "border-rose-400 focus:ring-rose-200",
          className
        )}
      >
        {normalizedOptions.map((opt) => (
          <option
            key={opt.value}
            value={opt.value}
            className="bg-white dark:bg-[#181820] text-slate-800 dark:text-slate-100"
          >
            {opt.label}
          </option>
        ))}
      </select>
      {error && (
        <p className="text-[10px] text-rose-500 font-semibold mt-0.5">{error}</p>
      )}
    </div>
  );
};

export default Select;
