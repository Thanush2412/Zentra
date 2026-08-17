"use client";

import { useParams, useRouter } from "next/navigation";
import { DashboardLayout } from "@/components/DashboardLayout";
import { SMEDashboard } from "@/components/SMEDashboard";

export default function SMETabPage() {
  const params = useParams();
  const router = useRouter();
  const tab = params.tab as string;

  return (
    <DashboardLayout requiredRole="sme">
      <SMEDashboard
        activeTab={tab as any}
        onTabChange={(newTab) => router.push(`/sme/${newTab}`)}
      />
    </DashboardLayout>
  );
}
