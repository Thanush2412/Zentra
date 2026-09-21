"use client";

import dynamic from "next/dynamic";
import { DashboardLayout } from "@/components/DashboardLayout";

const SMEDashboard = dynamic(() => import("@/components/SMEDashboard").then(m => m.SMEDashboard), {
  ssr: false,
  loading: () => (
    <div className="flex-1 flex items-center justify-center p-12 text-slate-400 font-bold text-sm">
      <div className="flex items-center gap-2">
        <span className="h-4 w-4 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin" />
        <span>Loading SME Evaluation Hub…</span>
      </div>
    </div>
  )
});

export default function SMEPortalPage() {
  return (
    <DashboardLayout requiredRole="sme">
      <SMEDashboard />
    </DashboardLayout>
  );
}
