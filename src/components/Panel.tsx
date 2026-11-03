import React from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface PanelProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
  headerActions?: React.ReactNode;
}

/**
 * Standard Panel Component
 * Wraps shadcn Card with a structured header and action slot.
 */
export const Panel: React.FC<PanelProps> = ({
  children,
  className = "",
  title,
  subtitle,
  actions,
  headerActions,
  ...props
}) => {
  const rightSlot = headerActions ?? actions;

  return (
    <Card className={cn("overflow-hidden", className)} {...props}>
      {(title || subtitle || rightSlot) && (
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-3.5 border-b border-slate-100 dark:border-slate-800">
          <div className="min-w-0">
            {title && <CardTitle>{title}</CardTitle>}
            {subtitle && <CardDescription className="mt-0.5">{subtitle}</CardDescription>}
          </div>
          {rightSlot && (
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto shrink-0">
              {rightSlot}
            </div>
          )}
        </CardHeader>
      )}
      <CardContent className="p-5">{children}</CardContent>
    </Card>
  );
};

export default Panel;
