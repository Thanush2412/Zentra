"use client";

import React, { useMemo } from "react";
import { useApp } from "@/context/AppContext";
import { CAMDashboard } from "./CAMDashboard";
import { isSuperAdminSession } from "@/lib/superadmin";

export interface KAMDashboardProps {
  activeTab?: string;
  onTabChange?: (tab: string) => void;
}

export function KAMDashboard({ activeTab = "overview", onTabChange }: KAMDashboardProps = {}) {
  const { colleges: rawColleges, currentKAM } = useApp();

  // Server-issued super-admin session flag (users.role === "admin") — no hardcoded identity
  const isSuperAdmin = isSuperAdminSession();

  // Filter colleges strictly to those assigned to this KAM
  const assignedCollegeIds = useMemo(() => {
    if (isSuperAdmin || !currentKAM?.id) {
      return rawColleges.map(c => c.id);
    }
    return rawColleges
      .filter(c => c.kam_id === currentKAM.id || (c as any).kamId === currentKAM.id)
      .map(c => c.id);
  }, [rawColleges, currentKAM?.id, isSuperAdmin]);

  return (
    <CAMDashboard
      activeTab={activeTab as any}
      onTabChange={onTabChange as any}
      isKAMView={true}
      allowedCollegeIds={assignedCollegeIds}
    />
  );
}
