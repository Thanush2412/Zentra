"use client";

import { useParams, useRouter } from "next/navigation";
import { DashboardLayout } from "@/components/DashboardLayout";
import { KAMDashboard } from "@/components/KAMDashboard";

export default function KAMTabPage() {
  const params = useParams();
  const router = useRouter();
  const tab = (params?.tab as string) || "overview";

  return (
    <DashboardLayout requiredRole="kam">
      <KAMDashboard
        activeTab={tab}
        onTabChange={(newTab: string) => router.push(`/kam/${newTab}`)}
      />
    </DashboardLayout>
  );
}

