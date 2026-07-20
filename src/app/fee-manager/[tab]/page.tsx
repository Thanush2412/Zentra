"use client";

import { useParams, useRouter } from "next/navigation";
import { DashboardLayout } from "@/components/DashboardLayout";
import { FeeManagerDashboard } from "@/components/FeeManagerDashboard";

export default function FeeManagerTabPage() {
  const params = useParams();
  const router = useRouter();
  const tab = params.tab as string;

  return (
    <DashboardLayout requiredRole="fee_manager">
      <FeeManagerDashboard
        activeTab={tab as any}
        onTabChange={(newTab) => router.push(`/fee-manager/${newTab}`)}
      />
    </DashboardLayout>
  );
}
