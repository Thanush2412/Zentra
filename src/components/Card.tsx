import React from "react";

interface CardProps {
  children?: React.ReactNode;
  className?: string;
  title?: string;
  // Stat-card props used by CAMDashboard overview cards
  label?: string;
  value?: string | number;
  icon?: React.ReactNode;
  success?: boolean;
}

// Matches the premium design language from StudentDashboard.tsx:
// - rounded-dribbble-card (1.75rem rounded corners)
// - flex flex-col justify-between
// - min-h-[150px]
// - large font sizes and distinct tag labels
export const Card: React.FC<CardProps> = ({
  children,
  className = "",
  title,
  label,
  value,
  icon,
  success,
}) => {
  // Stat card mode (premium overview tile)
  if (label !== undefined || value !== undefined) {
    return (
      <div
        className={`p-4 md:p-6 rounded-dribbble-card border-transparent relative flex flex-col justify-between shadow-xs min-h-[120px] md:min-h-[150px] group 
          transition-all duration-300 [transition-timing-function:cubic-bezier(0.34,1.56,0.64,1)] 
          hover:shadow-lg hover:shadow-[#D528A2]/5 hover:scale-[1.03] cursor-pointer ${className}`}
      >
        <div className="flex items-start justify-between w-full">
          <div className="min-w-0 flex-1 pr-2">
            <span className="text-[9px] md:text-[10px] text-slate-500 font-extrabold uppercase tracking-widest block mb-1 leading-tight">
              {label}
            </span>
            <span className="text-xl md:text-3xl font-black text-slate-900 leading-none break-words">
              {value}
            </span>
          </div>
          <div className="flex flex-col items-end gap-1.5 shrink-0">
            {icon && (
              <div className="p-2 md:p-2.5 bg-white/90 dark:bg-slate-800/90 border border-slate-100 dark:border-slate-850 text-slate-800 dark:text-slate-200 rounded-full shrink-0 shadow-xs group-hover:scale-110 transition-transform duration-300">
                {icon}
              </div>
            )}
            <span
              className={`px-1.5 md:px-2 py-0.5 rounded-full text-[8px] md:text-[9px] font-extrabold uppercase tracking-wider ${
                success
                  ? "bg-emerald-100 text-emerald-800 border border-emerald-200/50"
                  : "bg-indigo-100 text-indigo-800 border border-indigo-200/50"
              }`}
            >
              {success ? "High" : "Active"}
            </span>
          </div>
        </div>
        <p className="text-[9px] md:text-[10px] text-slate-455 font-bold leading-relaxed mt-3 uppercase tracking-wider">
          System Overview &amp; Live Stats
        </p>
      </div>
    );
  }

  return (
    <div className={`bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-850 p-5 rounded-2xl shadow-sm dark:shadow-lg 
      transition-all duration-300 hover:shadow-md hover:border-slate-200/80 ${className}`}>
      {title && (
        <h3 className="text-[10px] font-black text-gray-555 dark:text-slate-400 uppercase tracking-wider mb-3">
          {title}
        </h3>
      )}
      {children}
    </div>
  );
};
