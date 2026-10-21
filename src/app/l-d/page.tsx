"use client";

import { LndPortalShell } from "@/components/LndPortalShell";

/**
 * First-class /l-d route matching user expectations and alternate spelling.
 * Renders LndPortalShell directly rather than redirecting.
 */
export default function LdHyphenPortalPage() {
  return <LndPortalShell />;
}
