"use client";

import dynamic from "next/dynamic";
import { useParams, useRouter } from "next/navigation";
import { DashboardLayout } from "@/components/DashboardLayout";

const StudentDashboard = dynamic(() => import("@/components/StudentDashboard").then(m => m.StudentDashboard), {
  ssr: false,
  loading: () => (
    <div className="flex-1 flex items-center justify-center p-12 text-slate-400 font-bold text-sm">
      <div className="flex items-center gap-2">
        <span className="h-4 w-4 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin" />
        <span>Loading Student Portal...</span>
      </div>
    </div>
  )
});

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
