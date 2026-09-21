"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { DashboardLayout } from "@/components/DashboardLayout";

const KAMDashboard = dynamic(() => import("@/components/KAMDashboard").then(m => m.KAMDashboard), {
  ssr: false,
  loading: () => (
    <div className="flex-1 flex items-center justify-center p-12 text-slate-400 font-bold text-sm">
      <div className="flex items-center gap-2">
        <span className="h-4 w-4 rounded-full border-2 border-[#D528A2] border-t-transparent animate-spin" />
        <span>Loading KAM Portfolio…</span>
      </div>
    </div>
  )
});

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
