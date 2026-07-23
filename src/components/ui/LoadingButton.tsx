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
    gradient: "btn-gradient py-3 px-5 rounded-2xl text-sm shadow-md text-white",
    primary: "bg-slate-900 hover:bg-slate-800 text-white py-2.5 px-4 rounded-xl text-xs shadow-sm",
    secondary: "bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 px-4 rounded-xl text-xs shadow-sm",
    danger: "bg-rose-600 hover:bg-rose-700 text-white py-2.5 px-4 rounded-xl text-xs shadow-sm",
    outline: "bg-white border border-slate-200 hover:bg-slate-50 text-slate-800 py-2.5 px-4 rounded-xl text-xs shadow-xs",
    ghost: "hover:bg-slate-100 text-slate-700 py-2 px-3 rounded-lg text-xs"
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
