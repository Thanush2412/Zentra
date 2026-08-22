"use client";

import { useParams, useRouter } from "next/navigation";
import { DashboardLayout } from "@/components/DashboardLayout";
import { StudentDashboard } from "@/components/StudentDashboard";

export const VALID_STUDENT_TABS = [
  "dashboard",
  "schedule",
  "interviews",
  "leave",
  "tracker",
  "exams",
  "materials",
  "library",
  "fees",
  "profile",
  "more_menu"
] as const;

export type StudentTab = (typeof VALID_STUDENT_TABS)[number];

export default function StudentTabPage() {
  const params = useParams();
  const router = useRouter();
  const rawTab = params?.tab as string;
  const tab: StudentTab = rawTab === "marks"
    ? "exams"
    : VALID_STUDENT_TABS.includes(rawTab as StudentTab)
    ? (rawTab as StudentTab)
    : "dashboard";

  return (
    <DashboardLayout requiredRole="student">
      <StudentDashboard
        activeTab={tab}
        onTabChange={(newTab) => {
          if (newTab.includes("?")) {
            window.location.href = `/student/${newTab}`;
          } else {
            router.push(`/student/${newTab}`);
          }
        }}
      />
    </DashboardLayout>
  );
}
