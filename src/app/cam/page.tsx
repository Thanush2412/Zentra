"use client";

import { useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { DashboardLayout } from "@/components/DashboardLayout";
import { TabPageLoader } from "@/components/TabPageLoader";

const CAMDashboard = dynamic(() => import("@/components/CAMDashboard").then(m => m.CAMDashboard), {
  ssr: false,
  loading: () => <TabPageLoader message="Loading CM Dashboard…" />
});

/**
 * Direct first-class /cam workspace view for backward compatibility.
 * Rendering directly instead of hopping to /cam/overview ensures immediate access.
 */
export default function CAMIndexPage() {
  const [activeTab, setActiveTab] = useState<string>("overview");

  const handleTabChange = useCallback((newTab: string) => {
    setActiveTab(newTab);
    if (typeof window !== "undefined") {
      const cleanTab = newTab.split("?")[0];
      const targetUrl = `/cam/${cleanTab}`;
      if (window.location.pathname !== targetUrl) {
        window.history.pushState(null, "", targetUrl);
      }
    }
  }, []);

  return (
    <DashboardLayout requiredRole="cm">
      <CAMDashboard
        activeTab={activeTab as any}
        onTabChange={handleTabChange}
      />
    </DashboardLayout>
  );
}
