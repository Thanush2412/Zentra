"use client";

import React from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { DemoAllocationDashboard } from "@/components/DemoAllocationDashboard";

export default function DemoAllocatorPortalPage() {
  return (
    <DashboardLayout requiredRole="allocator">
      <DemoAllocationDashboard />
    </DashboardLayout>
  );
}
