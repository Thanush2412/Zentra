"use client";

import React from "react";
import { Button, ButtonVariant, ButtonSize } from "@/components/ui/button";

export interface LoadingButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  isLoading?: boolean;
  loadingText?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * LoadingButton: Wraps unified Button with backward-compatible loading semantics.
 */
export function LoadingButton({
  isLoading = false,
  loadingText,
  variant = "gradient",
  size = "default",
  icon,
  className = "",
  disabled,
  children,
  ...props
}: LoadingButtonProps) {
  return (
    <Button
      variant={variant}
      size={size}
      isLoading={isLoading}
      loadingText={loadingText}
      icon={icon}
      disabled={disabled}
      className={className}
      {...props}
    >
      {children}
    </Button>
  );
}

export default LoadingButton;
