"use client";

import { useApp } from "@/context/AppContext";
import { DashboardLayout } from "@/components/DashboardLayout";
import { NotificationsView } from "@/components/NotificationsView";
import { RedirectingLoader } from "@/components/RedirectingLoader";

export default function CamNotificationsPage() {
  const { user } = useApp();
  
  if (!user) return <RedirectingLoader label="Authenticating..." />;

  return (
    <DashboardLayout activeTab="notifications" role="cam">
      <div className="p-4 md:p-8 min-h-screen bg-gray-50/50">
        <NotificationsView userId={user.id} portalType="cam" />
      </div>
    </DashboardLayout>
  );
}
