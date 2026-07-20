"use client";

import { useParams, useRouter } from "next/navigation";
import { DashboardLayout } from "@/components/DashboardLayout";
import { AdminDashboard } from "@/components/AdminDashboard";

export default function AdminTabPage() {
  const params = useParams();
  const router = useRouter();
  const tab = params.tab as string;

  return (
    <DashboardLayout requiredRole="admin">
      <AdminDashboard
        activeTab={tab as any}
        onTabChange={(newTab) => router.push(`/admin/${newTab}`)}
      />
    </DashboardLayout>
  );
}
