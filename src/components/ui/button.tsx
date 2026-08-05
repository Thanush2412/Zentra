import * as React from "react";
import { cn } from "@/lib/utils";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "brand" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  size?: "default" | "sm" | "lg" | "icon";
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => {
    const variants = {
      default: "btn-gradient text-white shadow-md hover:opacity-95",
      brand: "bg-[#D528A2] text-white hover:bg-[#c02090] shadow-sm",
      destructive: "bg-rose-500 text-white hover:bg-rose-600 shadow-sm",
      outline: "border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-[#131317]/80 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800",
      secondary: "bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700",
      ghost: "hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200",
      link: "text-[#D528A2] underline-offset-4 hover:underline"
    };

    const sizes = {
      default: "h-9 px-4 py-2 text-xs",
      sm: "h-7 px-3 text-[10px]",
      lg: "h-11 px-6 text-sm",
      icon: "h-9 w-9 p-0 flex items-center justify-center shrink-0"
    };

    return (
      <button
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-xl font-extrabold transition-all outline-none disabled:pointer-events-none disabled:opacity-50 cursor-pointer active:scale-[0.98]",
          variants[variant],
          sizes[size],
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button };
