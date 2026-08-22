"use client";

import dynamic from "next/dynamic";
import { useParams, useRouter } from "next/navigation";
import { DashboardLayout } from "@/components/DashboardLayout";

const MentorDashboard = dynamic(() => import("@/components/MentorDashboard").then(m => m.MentorDashboard), {
  ssr: false,
  loading: () => (
    <div className="flex-1 flex items-center justify-center p-12 text-slate-400 font-bold text-sm">
      <div className="flex items-center gap-2">
        <span className="h-4 w-4 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin" />
        <span>Loading Faculty Workspace...</span>
      </div>
    </div>
  )
});

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
