import React from "react";

type Variant = "primary" | "secondary" | "danger" | "success" | "warning" | "ghost" | "gradient";
type Size = "xs" | "sm" | "md" | "lg";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: React.ReactNode;
  children?: React.ReactNode;
}

// Matches the project's own button patterns from AdminDashboard / MentorDashboard
const variantClasses: Record<Variant, string> = {
  primary:   "btn-gradient border-none",                                                  // brand pink→orange
  secondary: "bg-gray-100 hover:bg-gray-200 text-gray-700 border-transparent",
  danger:    "bg-rose-500 hover:bg-rose-600 text-white border-transparent shadow",
  success:   "bg-emerald-500 hover:bg-emerald-600 text-white border-transparent shadow",
  warning:   "bg-amber-400 hover:bg-amber-500 text-white border-transparent shadow",
  ghost:     "bg-transparent hover:bg-gray-55 text-gray-600 border-transparent",
  gradient:  "btn-gradient border-none",
};

const sizeClasses: Record<Size, string> = {
  xs: "px-2 py-1 text-[10px] rounded-lg gap-1",
  sm: "px-3 py-1.5 text-xs rounded-xl gap-1.5",
  md: "px-4 py-2 text-xs rounded-xl gap-2",
  lg: "px-5 py-2.5 text-sm rounded-2xl gap-2",
};

export const Button: React.FC<ButtonProps> = ({
  variant = "primary",
  size = "md",
  icon,
  children,
  className = "",
  disabled,
  ...rest
}) => {
  return (
    <button
      {...rest}
      disabled={disabled}
      className={`inline-flex items-center justify-center font-bold border cursor-pointer 
        transition-all duration-300 [transition-timing-function:cubic-bezier(0.34,1.56,0.64,1)] 
        hover:scale-[1.04] active:scale-[0.96] hover:shadow-md hover:shadow-[#D528A2]/10 
        disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:active:scale-100 disabled:hover:shadow-none
        ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      {children}
    </button>
  );
};
