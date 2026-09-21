"use client";

import { ProfessionalLoader } from "@/components/DashboardLayout";

/**
 * Full-bleed wrapper around ProfessionalLoader for next/dynamic loading
 * states in [tab] route pages. Role-specific messages.
 */
export function TabPageLoader({ message }: { message: string }) {
  return <ProfessionalLoader message={message} />;
}
