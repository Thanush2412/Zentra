"use client";

import React, { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { AdminSidebar, type AdminNavGroup } from "@/components/admin/AdminSidebar";
import { AdminTabSkeleton } from "@/components/admin/AdminTabSkeleton";
import { PageHeader } from "@/components/ui/PageHeader";
import type { AdminTab, AdminDashboardProps } from "@/components/admin/types";
import {
  LayoutDashboard,
  Building2,
  UserCheck,
  CalendarDays,
  Menu,
  ChevronDown,
  Briefcase,
  Users,
  Grid,
  Network,
  GraduationCap,
  BookOpen,
  Calendar,
  Clock,
  ShieldCheck,
  Megaphone,
  History,
  MessageSquare,
  Eye,
  Sliders
} from "lucide-react";

// Re-export utility functions and types for backward compatibility
export { generateCampusCode, generateCodeFromName, formatYearWiseRooms } from "@/lib/utils";
export type { AdminTab, AdminDashboardProps } from "@/components/admin/types";

// Dynamic imports with lazy loading and non-expanding inline skeleton fallbacks
const AdminOverviewTab = dynamic(
  () => import("@/components/admin/overview/AdminOverviewTab").then(m => m.AdminOverviewTab),
  { ssr: false, loading: () => <AdminTabSkeleton /> }
);
const CampusesTab = dynamic(
  () => import("@/components/admin/organization/CampusesTab").then(m => m.CampusesTab),
  { ssr: false, loading: () => <AdminTabSkeleton /> }
);
const CoursesTab = dynamic(
  () => import("@/components/admin/organization/CoursesTab").then(m => m.CoursesTab),
  { ssr: false, loading: () => <AdminTabSkeleton /> }
);
const SubjectsTab = dynamic(
  () => import("@/components/admin/organization/SubjectsTab").then(m => m.SubjectsTab),
  { ssr: false, loading: () => <AdminTabSkeleton /> }
);
const HierarchyTab = dynamic(
  () => import("@/components/admin/organization/HierarchyTab").then(m => m.HierarchyTab),
  { ssr: false, loading: () => <AdminTabSkeleton /> }
);
const KamsTab = dynamic(
  () => import("@/components/admin/people/KamsTab").then(m => m.KamsTab),
  { ssr: false, loading: () => <AdminTabSkeleton /> }
);
const CamsTab = dynamic(
  () => import("@/components/admin/people/CamsTab").then(m => m.CamsTab),
  { ssr: false, loading: () => <AdminTabSkeleton /> }
);
const MentorsTab = dynamic(
  () => import("@/components/admin/people/MentorsTab").then(m => m.MentorsTab),
  { ssr: false, loading: () => <AdminTabSkeleton /> }
);
const SmesTab = dynamic(
  () => import("@/components/admin/people/SmesTab").then(m => m.SmesTab),
  { ssr: false, loading: () => <AdminTabSkeleton /> }
);
const UsersTab = dynamic(
  () => import("@/components/admin/people/UsersTab").then(m => m.UsersTab),
  { ssr: false, loading: () => <AdminTabSkeleton /> }
);
const SchedulesTab = dynamic(
  () => import("@/components/admin/operations/SchedulesTab").then(m => m.SchedulesTab),
  { ssr: false, loading: () => <AdminTabSkeleton /> }
);
const OversightHub = dynamic(
  () => import("@/components/admin/OversightHub").then(m => m.OversightHub),
  { ssr: false, loading: () => <AdminTabSkeleton /> }
);
const MonitoringTab = dynamic(
  () => import("@/components/admin/operations/MonitoringTab").then(m => m.MonitoringTab),
  { ssr: false, loading: () => <AdminTabSkeleton /> }
);
const HolidaysTab = dynamic(
  () => import("@/components/admin/operations/HolidaysTab").then(m => m.HolidaysTab),
  { ssr: false, loading: () => <AdminTabSkeleton /> }
);
const AnnouncementsTab = dynamic(
  () => import("@/components/admin/operations/AnnouncementsTab").then(m => m.AnnouncementsTab),
  { ssr: false, loading: () => <AdminTabSkeleton /> }
);
const SettingsTab = dynamic(
  () => import("@/components/admin/system/SettingsTab").then(m => m.SettingsTab),
  { ssr: false, loading: () => <AdminTabSkeleton /> }
);
const SessionsTab = dynamic(
  () => import("@/components/admin/system/SessionsTab").then(m => m.SessionsTab),
  { ssr: false, loading: () => <AdminTabSkeleton /> }
);
const FeedbackTab = dynamic(
  () => import("@/components/admin/system/FeedbackTab").then(m => m.FeedbackTab),
  { ssr: false, loading: () => <AdminTabSkeleton /> }
);
const LogsTab = dynamic(
  () => import("@/components/admin/system/LogsTab").then(m => m.LogsTab),
  { ssr: false, loading: () => <AdminTabSkeleton /> }
);

export const ADMIN_NAV_GROUPS: AdminNavGroup[] = [
  {
    title: "Dashboard",
    icon: LayoutDashboard,
    items: [
      { id: "overview", label: "Overview", icon: LayoutDashboard }
    ]
  },
  {
    title: "Organization",
    icon: Building2,
    items: [
      { id: "campuses", label: "Campuses", icon: Building2 },
      { id: "courses", label: "Courses", icon: Network },
      { id: "subjects", label: "Subjects", icon: GraduationCap },
      { id: "hierarchy", label: "Hierarchy", icon: Network }
    ]
  },
  {
    title: "People",
    icon: Users,
    items: [
      { id: "kams", label: "Key Account Managers", icon: Briefcase },
      { id: "cams", label: "Campus Managers", icon: Users },
      { id: "mentors", label: "Faculty Mentors", icon: UserCheck },
      { id: "smes", label: "Subject Matter Experts", icon: BookOpen },
      { id: "users", label: "User Credentials", icon: ShieldCheck }
    ]
  },
  {
    title: "Operations",
    icon: Grid,
    items: [
      { id: "schedules", label: "Schedules", icon: Grid },
      { id: "oversight", label: "Oversight Hub", icon: Eye },
      { id: "monitoring", label: "Attendance Monitoring", icon: Clock },
      { id: "holidays", label: "Holidays", icon: Calendar },
      { id: "announcements", label: "Announcements", icon: Megaphone }
    ]
  },
  {
    title: "System",
    icon: History,
    items: [
      { id: "settings", label: "Email Controls & Settings", icon: Sliders },
      { id: "sessions", label: "Login Sessions", icon: History },
      { id: "feedback", label: "User Feedback", icon: MessageSquare },
      { id: "logs", label: "Audit Logs", icon: History }
    ]
  }
];

const ADMIN_TAB_IDS: string[] = [...ADMIN_NAV_GROUPS.flatMap(g => g.items.map(i => i.id)), "more_menu"];
const MOBILE_PRIMARY_TAB_IDS = ["overview", "campuses", "mentors", "schedules"];
const MOBILE_MORE_TAB_IDS = ADMIN_TAB_IDS.filter(
  id => id !== "more_menu" && !MOBILE_PRIMARY_TAB_IDS.includes(id)
);

const adminTabAliases: Record<string, string> = {
  schedule: "schedules",
  attendance: "monitoring",
  audit: "logs",
  audit_logs: "logs",
  credentials: "users",
  settings: "settings",
  holidays: "holidays",
  announcements: "announcements",
  approvals: "oversight",
  interviews: "oversight",
  exams: "campuses"
};

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  activeTab: propActiveTab,
  onTabChange
}) => {
  const [localActiveTab, setLocalActiveTab] = useState<AdminTab>("overview");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("fp_sidebar_collapsed") === "true";
      setIsCollapsed(stored);
    }
  }, []);

  const resolvedPropTab = (() => {
    if (!propActiveTab) return undefined;
    const mapped: string = adminTabAliases[propActiveTab] || propActiveTab;
    return ADMIN_TAB_IDS.includes(mapped) ? (mapped as AdminTab) : undefined;
  })();

  const activeTab = resolvedPropTab || localActiveTab;
  const setActiveTab = onTabChange || setLocalActiveTab;

  const activeNavLabel =
    activeTab === "more_menu"
      ? "More Portals"
      : ADMIN_NAV_GROUPS.flatMap((g) => g.items).find((i) => i.id === activeTab)?.label || "Admin Menu";

  return (
    <div className="flex-1 flex flex-col md:flex-row min-h-0 w-full max-w-[1680px] mx-auto px-4 md:px-10 md:gap-6 bg-warm-canvas text-slate-800 font-sans overflow-hidden">
      {/* Desktop Collapsible Sidebar & Mobile Drawer */}
      <AdminSidebar
        groups={ADMIN_NAV_GROUPS}
        activeTab={activeTab}
        onNavigate={(tab) => {
          setActiveTab(tab as AdminTab);
          setMobileNavOpen(false);
        }}
        collapsed={isCollapsed}
        onToggleCollapsed={() =>
          setIsCollapsed((prev) => {
            const next = !prev;
            if (typeof window !== "undefined") {
              localStorage.setItem("fp_sidebar_collapsed", String(next));
            }
            return next;
          })
        }
        mobileOpen={mobileNavOpen}
        onMobileClose={() => setMobileNavOpen(false)}
      />

      {/* Mobile drawer trigger — the rail is hidden below md, so this is the only nav entry point */}
      <div className="flex md:hidden items-center pt-3">
        <button
          type="button"
          onClick={() => setMobileNavOpen(true)}
          aria-label="Open admin navigation"
          aria-haspopup="true"
          aria-expanded={mobileNavOpen}
          className="flex h-11 min-w-0 max-w-full cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white/90 px-3 text-xs font-bold text-slate-700 shadow-xs transition-colors hover:bg-slate-50"
        >
          <Menu className="h-4 w-4 shrink-0 text-indigo-600" />
          <span className="truncate">{activeNavLabel}</span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400" />
        </button>
      </div>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="flex md:hidden fixed bottom-0 inset-x-0 z-50 mobile-bottom-nav">
        <div className="flex w-full justify-around items-center py-2 px-0.5 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-lg">
          {[
            { id: "overview", label: "Home", icon: LayoutDashboard },
            { id: "campuses", label: "Campuses", icon: Building2 },
            { id: "mentors", label: "Faculty", icon: UserCheck },
            { id: "schedules", label: "Schedules", icon: CalendarDays },
            { id: "more_menu", label: "More", icon: Menu }
          ].map((t) => {
            const Icon = t.icon;
            const isActive =
              activeTab === t.id ||
              (t.id === "more_menu" && MOBILE_MORE_TAB_IDS.includes(activeTab));

            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id as AdminTab)}
                className={`relative flex flex-col items-center justify-center gap-0.5 flex-1 py-1.5 rounded-xl transition-all cursor-pointer ${
                  isActive ? "text-indigo-600" : "text-slate-400"
                }`}
              >
                <Icon
                  className={`h-4.5 w-4.5 transition-transform ${
                    isActive ? "scale-110" : ""
                  }`}
                />
                <span
                  className={`text-[8px] font-semibold tracking-wide leading-none ${
                    isActive ? "text-indigo-600" : "text-slate-400"
                  }`}
                >
                  {t.label}
                </span>
                {isActive && (
                  <span className="absolute top-0 inset-x-1 h-0.5 bg-indigo-500 rounded-full" />
                )}
              </button>
            );
          })}
        </div>
      </nav>

      {/* Main Scrollable Content Area */}
      <section className="flex-1 min-w-0 min-h-0 overflow-x-hidden overflow-y-auto pt-3 md:pt-5 pb-24 md:pb-16 space-y-4 scroll-touch">
        {/* Mobile "More" Menu Hub */}
        {activeTab === "more_menu" && (
          <div className="space-y-4 animate-fadeIn font-sans text-xs">
            <PageHeader
              icon={Menu}
              title="More Admin Portals"
              subtitle="Additional administration workspaces."
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { id: "courses", label: "Academic Courses", subtitle: "Degree programs & batches", icon: Network, bg: "bg-indigo-50 text-indigo-600" },
                { id: "subjects", label: "Subject Database", subtitle: "Course subjects & hours", icon: GraduationCap, bg: "bg-teal-50 text-teal-600" },
                { id: "kams", label: "Key Account Managers", subtitle: "KAM portfolio & metrics", icon: Briefcase, bg: "bg-amber-50 text-amber-600" },
                { id: "cams", label: "Campus Managers", subtitle: "Campus operations team", icon: Users, bg: "bg-emerald-50 text-emerald-600" },
                { id: "smes", label: "Subject Matter Experts", subtitle: "Curriculum review leads", icon: BookOpen, bg: "bg-sky-50 text-sky-600" },
                { id: "users", label: "User Access Control", subtitle: "Passwords & role management", icon: ShieldCheck, bg: "bg-violet-50 text-violet-600" },
                { id: "oversight", label: "Approvals & Oversight", subtitle: "Consolidated requests", icon: Eye, bg: "bg-purple-50 text-purple-600" },
                { id: "monitoring", label: "Student Attendance", subtitle: "Live attendance records", icon: Clock, bg: "bg-blue-50 text-blue-600" },
                { id: "holidays", label: "Campus Holidays", subtitle: "Academic calendar dates", icon: Calendar, bg: "bg-rose-50 text-rose-600" },
                { id: "announcements", label: "Campus Broadcasts", subtitle: "Announcements & notifications", icon: Megaphone, bg: "bg-pink-50 text-pink-600" },
                { id: "hierarchy", label: "Reporting Hierarchy", subtitle: "Organizational structure", icon: Network, bg: "bg-indigo-50 text-indigo-600" },
                { id: "sessions", label: "Login Sessions", subtitle: "Active device logs", icon: History, bg: "bg-slate-100 text-slate-700" },
                { id: "feedback", label: "User Feedback", subtitle: "Bug reports & support", icon: MessageSquare, bg: "bg-yellow-50 text-yellow-700" },
                { id: "logs", label: "Audit Logs", subtitle: "Security events & history", icon: History, bg: "bg-slate-100 text-slate-700" },
                { id: "settings", label: "Global Settings", subtitle: "System & mailing controls", icon: Sliders, bg: "bg-fuchsia-50 text-fuchsia-600" }
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveTab(item.id as AdminTab)}
                    className="p-5 bg-white border border-slate-200 rounded-xl text-left hover:border-indigo-400 hover:ring-2 hover:ring-indigo-100 transition-all flex items-center gap-4 shadow-xs cursor-pointer group"
                  >
                    <div className={`h-10 w-10 rounded-xl ${item.bg} flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <span className="block text-xs font-bold text-slate-800">{item.label}</span>
                      <span className="text-[10px] text-slate-400 font-medium">{item.subtitle}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Tab Renderers */}
        {activeTab === "overview" && (
          <AdminOverviewTab onNavigateTab={setActiveTab} />
        )}

        {activeTab === "campuses" && <CampusesTab />}

        {activeTab === "courses" && <CoursesTab />}

        {activeTab === "subjects" && <SubjectsTab />}

        {activeTab === "hierarchy" && <HierarchyTab />}

        {activeTab === "kams" && <KamsTab />}

        {activeTab === "cams" && <CamsTab />}

        {activeTab === "mentors" && <MentorsTab />}

        {activeTab === "smes" && <SmesTab />}

        {activeTab === "users" && <UsersTab />}

        {activeTab === "schedules" && <SchedulesTab />}

        {activeTab === "oversight" && <OversightHub />}

        {activeTab === "monitoring" && <MonitoringTab />}

        {activeTab === "holidays" && <HolidaysTab />}

        {activeTab === "announcements" && <AnnouncementsTab />}

        {activeTab === "settings" && <SettingsTab />}

        {activeTab === "sessions" && <SessionsTab />}

        {activeTab === "feedback" && <FeedbackTab />}

        {activeTab === "logs" && <LogsTab />}
      </section>
    </div>
  );
};

export default AdminDashboard;
