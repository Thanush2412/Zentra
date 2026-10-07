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
      default: "btn-gradient text-white shadow-md hover:opacity-95 hover:shadow-lg hover:shadow-[#D528A2]/20 focus-visible:ring-2 focus-visible:ring-[#D528A2]/50",
      brand: "bg-[#D528A2] text-white hover:bg-[#c02090] shadow-sm hover:shadow-[#D528A2]/20 focus-visible:ring-2 focus-visible:ring-[#D528A2]/50",
      destructive: "bg-rose-500 text-white hover:bg-rose-600 shadow-sm hover:shadow-rose-500/20 focus-visible:ring-2 focus-visible:ring-rose-500/50",
      outline: "border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-[#131317]/80 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-700 focus-visible:ring-2 focus-visible:ring-[#D528A2]/30",
      secondary: "bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 focus-visible:ring-2 focus-visible:ring-slate-400",
      ghost: "hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 focus-visible:ring-2 focus-visible:ring-[#D528A2]/30",
      link: "text-[#D528A2] hover:text-[#c02090] underline-offset-4 hover:underline"
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
