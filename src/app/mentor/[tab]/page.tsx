"use client";

import { useParams, useRouter } from "next/navigation";
import { DashboardLayout } from "@/components/DashboardLayout";
import { MentorDashboard } from "@/components/MentorDashboard";

export default function MentorTabPage() {
  const params = useParams();
  const router = useRouter();
  const tab = params.tab as string;

  return (
    <DashboardLayout requiredRole="mentor">
      <MentorDashboard
        activeTab={tab as any}
        onTabChange={(newTab) => router.push(`/mentor/${newTab}`)}
      />
    </DashboardLayout>
  );
}
