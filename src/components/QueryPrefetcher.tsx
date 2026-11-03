"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useApp } from "@/context/AppContext";
import { normalizeRoleValue } from "@/lib/utils";
import { prefetchRoleData } from "@/lib/prefetch";

/**
 * Warms the role's usual tab datasets once the browser goes idle, so the first
 * visit to heavy tabs renders from cache instead of waiting on a round-trip.
 */
export function QueryPrefetcher() {
  const queryClient = useQueryClient();
  const { currentRole, currentMentor, colleges } = useApp();

  const role = normalizeRoleValue(currentRole);
  const collegeId = currentMentor?.college_id || "";
  const mentorId = currentMentor?.id || "";
  const collegeIds = colleges.map((c: any) => c.id).filter(Boolean).join(",");

  useEffect(() => {
    let cancelled = false;
    let idleId: number | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const run = () => {
      if (cancelled) return;
      prefetchRoleData(queryClient, role, { collegeId, mentorId, collegeIds });
    };

    if (typeof window !== "undefined" && "requestIdleCallback" in window) {
      idleId = (window as any).requestIdleCallback(run, { timeout: 2500 });
    } else {
      timer = setTimeout(run, 1200);
    }

    return () => {
      cancelled = true;
      if (idleId !== undefined && typeof window !== "undefined" && "cancelIdleCallback" in window) {
        (window as any).cancelIdleCallback(idleId);
      }
      if (timer) clearTimeout(timer);
    };
  }, [queryClient, role, collegeId, mentorId, collegeIds]);

  return null;
}
