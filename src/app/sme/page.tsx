"use client";

import React from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { SMEDashboard } from "@/components/SMEDashboard";

export default function SMEPortalPage() {
  return (
    <DashboardLayout requiredRole="sme">
      <SMEDashboard />
    </DashboardLayout>
  );
}
