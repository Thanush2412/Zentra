"use client";

import { useParams, useRouter } from "next/navigation";
import { DashboardLayout } from "@/components/DashboardLayout";
import { KAMDashboard } from "@/components/KAMDashboard";

export default function KAMTabPage() {
  const params = useParams();
  const router = useRouter();
  const tab = params.tab as string;

  return (
    <DashboardLayout requiredRole="kam">
      <KAMDashboard
        activeTab={tab as any}
        onTabChange={(newTab) => router.push(`/kam/${newTab}`)}
      />
    </DashboardLayout>
  );
}
