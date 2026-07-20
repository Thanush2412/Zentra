"use client";

import { useParams, useRouter } from "next/navigation";
import { DashboardLayout } from "@/components/DashboardLayout";
import { StudentDashboard } from "@/components/StudentDashboard";

export default function StudentTabPage() {
  const params = useParams();
  const router = useRouter();
  const tab = params.tab as string;

  return (
    <DashboardLayout requiredRole="student">
      <StudentDashboard
        activeTab={tab as any}
        onTabChange={(newTab) => router.push(`/student/${newTab}`)}
      />
    </DashboardLayout>
  );
}
