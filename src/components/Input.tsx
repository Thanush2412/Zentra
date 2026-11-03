import React from "react";
import { Input as ShadcnInput, InputProps as ShadcnInputProps } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface InputProps extends ShadcnInputProps {
  label?: string;
  error?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className = "", id, ...rest }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, "-");
    return (
      <div className="space-y-1.5 w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider block"
          >
            {label}
          </label>
        )}
        <ShadcnInput
          id={inputId}
          ref={ref}
          className={cn(error && "border-rose-400 focus:ring-rose-200", className)}
          {...rest}
        />
        {error && (
          <p className="text-[10px] text-rose-500 font-semibold mt-0.5">{error}</p>
        )}
      </div>
    );
  }
);
Input.displayName = "Input";

export default Input;
