"use client";

import React from "react";
import { Loader2 } from "lucide-react";

interface LoadingButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  isLoading?: boolean;
  loadingText?: string;
  variant?: "gradient" | "primary" | "secondary" | "danger" | "outline" | "ghost";
  icon?: React.ReactNode;
  children: React.ReactNode;
}

export function LoadingButton({
  isLoading = false,
  loadingText,
  variant = "gradient",
  icon,
  className = "",
  disabled,
  children,
  ...props
}: LoadingButtonProps) {
  const baseStyles = "relative inline-flex items-center justify-center font-bold transition-all duration-200 cursor-pointer disabled:cursor-not-allowed disabled:opacity-75 active:scale-[0.98]";
  
  const variantStyles = {
    gradient: "btn-gradient py-2.5 px-4 rounded-xl text-xs font-extrabold shadow-md text-white hover:opacity-95 hover:shadow-lg hover:shadow-[#D528A2]/20",
    primary: "bg-slate-900 dark:bg-slate-100 hover:bg-slate-800 dark:hover:bg-white text-white dark:text-slate-900 py-2.5 px-4 rounded-xl text-xs font-bold shadow-xs",
    secondary: "bg-[#D528A2] hover:bg-[#c02090] text-white py-2.5 px-4 rounded-xl text-xs font-bold shadow-xs hover:shadow-[#D528A2]/20",
    danger: "bg-rose-600 hover:bg-rose-700 text-white py-2.5 px-4 rounded-xl text-xs font-bold shadow-xs",
    outline: "bg-white/80 dark:bg-[#131317]/80 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 py-2.5 px-4 rounded-xl text-xs font-bold shadow-xs",
    ghost: "hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 py-2 px-3 rounded-lg text-xs font-bold"
  };

  return (
    <button
      disabled={disabled || isLoading}
      className={`${baseStyles} ${variantStyles[variant]} ${className}`}
      {...props}
    >
      {isLoading ? (
        <div className="flex items-center justify-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin shrink-0 text-current" />
          {loadingText && <span className="truncate">{loadingText}</span>}
        </div>
      ) : (
        <div className="flex items-center justify-center gap-2">
          {children}
          {icon}
        </div>
      )}
    </button>
  );
}
