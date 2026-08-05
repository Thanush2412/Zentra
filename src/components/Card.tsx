import React from "react";

interface CardProps {
  children?: React.ReactNode;
  className?: string;
  title?: string;
  label?: string;
  value?: string | number;
  icon?: React.ReactNode;
  success?: boolean;
}

// Compact Tile with Icon Intersecting Top-Right Border & Left-Aligned Count
export const Card: React.FC<CardProps> = ({
  children,
  className = "",
  title,
  label,
  value,
  icon,
}) => {
  // Stat card mode (Compact tile with border-intersecting badge icon)
  if (label !== undefined || value !== undefined) {
    return (
      <div
        className={`p-3.5 sm:p-4 rounded-xl border border-white/80 dark:border-slate-800/80 
          backdrop-blur-md relative flex flex-col justify-between shadow-xs min-h-[95px] sm:min-h-[110px] group 
          transition-all duration-300 [transition-timing-function:cubic-bezier(0.34,1.56,0.64,1)] 
          hover:shadow-lg hover:shadow-indigo-500/10 hover:-translate-y-0.5 cursor-pointer ${className}`}
      >
        {/* Floating Icon Badge Intersecting Top-Right Corner */}
        {icon && (
          <div className="absolute -top-3.5 -right-3 sm:-right-3.5 p-2 sm:p-2.5 bg-white dark:bg-slate-800 border border-slate-200/90 dark:border-slate-700/90 rounded-lg shadow-md group-hover:scale-110 group-hover:rotate-6 transition-all duration-300 backdrop-blur-md z-20">
            {icon}
          </div>
        )}

        {/* Content Stack: Label & Left-aligned Numeric Count */}
        <div className="flex flex-col justify-between h-full pr-3 relative z-10">
          <span className="text-[8.5px] sm:text-[9.5px] text-slate-500 dark:text-slate-400 font-extrabold uppercase tracking-wider block mb-1.5 leading-snug line-clamp-2 text-left">
            {label || title}
          </span>
          <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight leading-none text-left">
            {value !== undefined ? value : "—"}
          </div>
        </div>
      </div>
    );
  }

  // Standard Container Card Mode
  return (
    <div
      className={`p-4 sm:p-6 rounded-xl border border-white/80 dark:border-slate-800/80 
        backdrop-blur-md shadow-xs ${className}`}
    >
      {title && (
        <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider mb-4 border-b border-slate-200/60 dark:border-slate-800 pb-2">
          {title}
        </h3>
      )}
      {children}
    </div>
  );
};
