"use client";

import { useRouter } from "next/navigation";
import { DashboardLayout } from "@/components/DashboardLayout";
import { KAMDashboard } from "@/components/KAMDashboard";

export default function KAMIndexPage() {
  const router = useRouter();
  return (
    <DashboardLayout requiredRole="kam">
      <KAMDashboard
        activeTab="overview"
        onTabChange={(newTab: string) => router.push(`/kam/${newTab}`)}
      />
    </DashboardLayout>
  );
}

