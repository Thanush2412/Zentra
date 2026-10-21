"use client";

import { LndPortalShell } from "@/components/LndPortalShell";

/**
 * Legacy short spelling kept as a first-class route so any bookmark, stored link or
 * hand-typed URL still opens the L&D workspace. Intentionally not a redirect.
 */
export default function LdPortalPage() {
  return <LndPortalShell />;
}
