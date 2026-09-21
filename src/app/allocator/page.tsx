"use client";

import dynamic from "next/dynamic";
import { DashboardLayout } from "@/components/DashboardLayout";

const DemoAllocationDashboard = dynamic(() => import("@/components/DemoAllocationDashboard").then(m => m.DemoAllocationDashboard), {
  ssr: false,
  loading: () => (
    <div className="flex-1 flex items-center justify-center p-12 text-slate-400 font-bold text-sm">
      <div className="flex items-center gap-2">
        <span className="h-4 w-4 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin" />
        <span>Loading Demo Scheduler Portal…</span>
      </div>
    </div>
  )
});

export default function DemoAllocatorPortalPage() {
  return (
    <DashboardLayout requiredRole="allocator">
      <DemoAllocationDashboard />
    </DashboardLayout>
  );
}
