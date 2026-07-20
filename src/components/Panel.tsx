import React from "react";

interface PanelProps {
  children: React.ReactNode;
  className?: string;
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
  headerActions?: React.ReactNode;
}

// Matches the project panel style: bg-white border border-gray-200 rounded-2xl shadow-sm
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
    <div className={`bg-white border border-gray-200 rounded-2xl shadow-sm hover:shadow-md hover:border-slate-300/65 transition-all duration-300 ${className}`}>
      {(title || subtitle || rightSlot) && (
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-x-3 gap-y-2 px-5 py-3.5 border-b border-gray-150">
          <div className="min-w-0">
            {title && (
              <h3 className="text-[10px] font-black text-gray-550 uppercase tracking-wider">
                {title}
              </h3>
            )}
            {subtitle && (
              <p className="text-[10px] text-gray-455 mt-0.5">{subtitle}</p>
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
