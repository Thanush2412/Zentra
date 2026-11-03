import React from "react";
import {
  Card as ShadcnCard,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter
} from "@/components/ui/card";
import { StatCard } from "@/components/dashboard/StatCard";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
  className?: string;
  title?: string;
  label?: string;
  value?: string | number;
  icon?: React.ReactNode;
  subtitle?: string;
  success?: boolean;
}

/**
 * Backward-compatible Card Component
 * If `label` or `value` is passed, renders a modern StatCard metric tile.
 * Otherwise, renders a clean Shadcn Container Card.
 */
export const Card: React.FC<CardProps> = ({
  children,
  className = "",
  title,
  label,
  value,
  icon,
  subtitle,
  ...props
}) => {
  if (label !== undefined || value !== undefined) {
    return (
      <StatCard
        title={label || title || ""}
        value={value !== undefined ? value : "—"}
        subtitle={subtitle}
        icon={icon}
        className={className}
      />
    );
  }

  return (
    <ShadcnCard className={className} {...props}>
      {title && (
        <CardHeader className="pb-3">
          <CardTitle>{title}</CardTitle>
          {subtitle && <CardDescription>{subtitle}</CardDescription>}
        </CardHeader>
      )}
      <CardContent>{children}</CardContent>
    </ShadcnCard>
  );
};

export { CardHeader, CardTitle, CardDescription, CardContent, CardFooter };
export default Card;
