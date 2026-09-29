"use client";

import { useApp } from "@/context/AppContext";
import { DashboardLayout } from "@/components/DashboardLayout";
import { NotificationsView } from "@/components/NotificationsView";
import { RedirectingLoader } from "@/components/RedirectingLoader";

export default function CamNotificationsPage() {
  const { currentCAM } = useApp();
  
  if (!currentCAM) return <RedirectingLoader label="Authenticating..." />;

  return (
    <DashboardLayout requiredRole="cam">
      <div className="p-4 md:p-8 min-h-screen bg-gray-50/50">
        <NotificationsView userId={currentCAM.id} portalType="cam" />
      </div>
    </DashboardLayout>
  );
}
