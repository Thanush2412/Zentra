"use client";

import { useParams, useRouter } from "next/navigation";
import { DashboardLayout } from "@/components/DashboardLayout";
import { CAMDashboard } from "@/components/CAMDashboard";

export default function CAMTabPage() {
  const params = useParams();
  const router = useRouter();
  const tab = params.tab as string;

  return (
    <DashboardLayout requiredRole="cam">
      <CAMDashboard
        activeTab={tab as any}
        onTabChange={(newTab) => router.push(`/cam/${newTab}`)}
      />
    </DashboardLayout>
  );
}
