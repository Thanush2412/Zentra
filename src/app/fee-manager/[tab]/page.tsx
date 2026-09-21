"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { DashboardLayout } from "@/components/DashboardLayout";
import { FeeManagerDashboard } from "@/components/FeeManagerDashboard";

export default function FeeManagerTabPage() {
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
      const targetUrl = `/fee-manager/${cleanTab}`;
      if (window.location.pathname !== targetUrl) {
        window.history.pushState(null, "", targetUrl);
      }
    }
  }, []);

  return (
    <DashboardLayout requiredRole="fee_manager">
      <FeeManagerDashboard
        activeTab={activeTab as any}
        onTabChange={handleTabChange}
      />
    </DashboardLayout>
  );
}
