"use client";

import { useApp } from "@/context/AppContext";
import { DashboardLayout } from "@/components/DashboardLayout";
import { NotificationsView } from "@/components/NotificationsView";
import { RedirectingLoader } from "@/components/RedirectingLoader";

export default function StudentNotificationsPage() {
  const { user } = useApp();
  
  if (!user) return <RedirectingLoader label="Authenticating..." />;

  return (
    <DashboardLayout activeTab="notifications" role="student">
      <div className="p-4 md:p-8 min-h-screen bg-gray-50/50">
        <NotificationsView userId={user.id} portalType="student" />
      </div>
    </DashboardLayout>
  );
}
