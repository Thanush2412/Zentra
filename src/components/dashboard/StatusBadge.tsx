"use client";

import React from "react";
import { Badge, BadgeProps } from "@/components/ui/badge";
import { CheckCircle2, Clock, XCircle, AlertCircle, Calendar } from "lucide-react";

export interface StatusBadgeProps {
  status?: string | null;
  label?: string;
  className?: string;
  showIcon?: boolean;
}

export function StatusBadge({ status, label, className, showIcon = false }: StatusBadgeProps) {
  const raw = String(status || "").toLowerCase().trim();

  let variant: BadgeProps["variant"] = "secondary";
  let icon: React.ReactNode = null;

  if (raw === "approved" || raw === "present" || raw === "active" || raw === "paid" || raw === "completed") {
    variant = "success";
    icon = <CheckCircle2 className="h-3 w-3" />;
  } else if (raw === "pending" || raw === "partial" || raw === "scheduled" || raw.includes("pending")) {
    variant = "warning";
    icon = <Clock className="h-3 w-3" />;
  } else if (raw === "rejected" || raw === "absent" || raw === "inactive" || raw === "unpaid" || raw === "failed") {
    variant = "destructive";
    icon = <XCircle className="h-3 w-3" />;
  } else if (raw === "od" || raw === "on-duty" || raw === "late") {
    variant = "default";
    icon = <AlertCircle className="h-3 w-3" />;
  } else if (raw === "holiday") {
    variant = "default";
    icon = <Calendar className="h-3 w-3" />;
  }

  return (
    <Badge variant={variant} className={className}>
      {showIcon && icon}
      {label || status || "—"}
    </Badge>
  );
}

export default StatusBadge;
