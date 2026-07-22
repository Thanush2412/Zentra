"use client";

import { useParams, useRouter } from "next/navigation";
import { DashboardLayout } from "@/components/DashboardLayout";
import { KAMDashboard } from "@/components/KAMDashboard";

const VALID_TABS = ["overview", "cam_reports", "colleges", "tasks", "escalations", "swap_tracker", "profile"] as const;
type KAMTab = typeof VALID_TABS[number];

export default function KAMTabPage() {
  const params = useParams();
  const router = useRouter();
  const rawTab = params.tab as string;
  const tab: KAMTab = (VALID_TABS as readonly string[]).includes(rawTab)
    ? (rawTab as KAMTab)
    : "overview";

  return (
    <DashboardLayout requiredRole="kam">
      <KAMDashboard
        activeTab={tab}
        onTabChange={(newTab) => router.push(`/kam/${newTab}`)}
      />
    </DashboardLayout>
  );
}
