"use client";

import { LndPortalShell } from "@/components/LndPortalShell";

/**
 * Original Demo Allocator URL, still served natively. Production and every link written
 * before the L&D rebrand points here, so it must render the workspace rather than hop to
 * a route that a given deployed build may not contain.
 */
export default function LegacyAllocatorPortalPage() {
  return <LndPortalShell />;
}
