import React from "react";

interface PanelProps {
  children: React.ReactNode;
  className?: string;
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
  headerActions?: React.ReactNode;
}

export const Panel: React.FC<PanelProps> = ({
  children,
  className = "",
  title,
  subtitle,
  actions,
  headerActions,
}) => {
  const rightSlot = headerActions ?? actions;
  return (
    <div className={`bg-white dark:bg-[#131317] border border-gray-200 dark:border-slate-800 rounded-xl shadow-xs hover:shadow-md hover:border-slate-300 dark:hover:border-slate-700 transition-all duration-300 ${className}`}>
      {(title || subtitle || rightSlot) && (
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-x-3 gap-y-2 px-5 py-3.5 border-b border-gray-100 dark:border-slate-800">
          <div className="min-w-0">
            {title && (
              <h3 className="text-[10px] font-black text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                {title}
              </h3>
            )}
            {subtitle && (
              <p className="text-[10px] text-gray-400 dark:text-slate-500 mt-0.5">{subtitle}</p>
            )}
          </div>
          {rightSlot && (
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">{rightSlot}</div>
          )}
        </div>
      )}
      <div className="p-5">{children}</div>
    </div>
  );
};
