"use client";

import { useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import { useParams } from "next/navigation";
import { DashboardLayout } from "@/components/DashboardLayout";
import { TabPageLoader } from "@/components/TabPageLoader";

const KAMDashboard = dynamic(() => import("@/components/KAMDashboard").then(m => m.KAMDashboard), {
  ssr: false,
  loading: () => <TabPageLoader message="Loading KAM Portfolio…" />
});

export default function KAMTabPage() {
  const params = useParams();
  const routeTab = (params?.tab as string) || "overview";
  const [activeTab, setActiveTab] = useState<string>(routeTab);

  useEffect(() => {
    if (routeTab) setActiveTab(routeTab);
  }, [routeTab]);

  useEffect(() => {
    const onPopState = () => {
      const parts = window.location.pathname.split("/").filter(Boolean);
      const tabFromUrl = parts[1] || "overview";
      setActiveTab(tabFromUrl);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const handleTabChange = useCallback((newTab: string) => {
    setActiveTab(newTab);
    if (typeof window !== "undefined") {
      const cleanTab = newTab.split("?")[0];
      const targetUrl = `/kam/${cleanTab}`;
      if (window.location.pathname !== targetUrl) {
        window.history.pushState(null, "", targetUrl);
      }
    }
  }, []);

  return (
    <DashboardLayout requiredRole="kam">
      <KAMDashboard
        activeTab={activeTab}
        onTabChange={handleTabChange}
      />
    </DashboardLayout>
  );
}

