"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { useApp } from "../context/AppContext";
import { useToast } from "../context/ToastContext";
import { gsap } from "gsap";
import {
  Building2, Users, ClipboardList, ShieldAlert, CheckCircle2,
  PlusCircle, Trash2, RefreshCw, Compass, ChevronsLeft, ChevronsRight, User,
  ArrowRightLeft, TrendingUp, Clock, XCircle, ChevronRight,
  GraduationCap, BookOpen, Eye, CheckCircle, Calendar,
  ChevronDown, ChevronUp, Search, Activity, Layers,
  IndianRupee, BarChart2, BookMarked, AlertCircle, UserCheck, Loader2, Award
} from "lucide-react";
import { InterviewModule } from "./InterviewModule";
import { LoadingButton } from "./ui/LoadingButton";
import { Button } from "./Button";
import { Card } from "./Card";
import { Panel } from "./Panel";
import { Input } from "./Input";
import { Select } from "./Select";

// Persistent global flag to prevent sidebar animating on every re-mount
let isFirstSidebarAnimationDone = false;

// Static color map for Tailwind classes (prevents purging in production)
const colorMap: Record<string, string> = {
  indigo: "bg-indigo-50 border-indigo-100 text-indigo-700 dark:bg-indigo-500/10 dark:border-indigo-500/20 dark:text-indigo-300",
  emerald: "bg-emerald-50 border-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:border-emerald-500/20 dark:text-emerald-300",
  rose: "bg-rose-50 border-rose-100 text-rose-700 dark:bg-rose-500/10 dark:border-rose-500/20 dark:text-rose-300",
  amber: "bg-amber-50 border-amber-100 text-amber-700 dark:bg-amber-500/10 dark:border-amber-500/20 dark:text-amber-300",
  purple: "bg-purple-50 border-purple-100 text-purple-700 dark:bg-purple-500/10 dark:border-purple-500/20 dark:text-purple-300",
  teal: "bg-teal-50 border-teal-100 text-teal-700 dark:bg-teal-500/10 dark:border-teal-500/20 dark:text-teal-300",
  slate: "bg-slate-100 border-slate-200 text-slate-600 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400",
  blue: "bg-blue-50 border-blue-100 text-blue-700 dark:bg-blue-500/10 dark:border-blue-500/20 dark:text-blue-300",
  cyan: "bg-cyan-50 border-cyan-100 text-cyan-700 dark:bg-cyan-500/10 dark:border-cyan-500/20 dark:text-cyan-300",
  fuchsia: "bg-fuchsia-50 border-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-500/10 dark:border-fuchsia-500/20 dark:text-fuchsia-300",
};

export interface KAMDashboardProps {
  activeTab?: "overview" | "cam_reports" | "colleges" | "tasks" | "escalations" | "swap_tracker" | "interviews" | "profile";
  onTabChange?: (tab: "overview" | "cam_reports" | "colleges" | "tasks" | "escalations" | "swap_tracker" | "interviews" | "profile") => void;
}

// ── CAM Detail Card: shows one CAM's full college data ──────────────────────
interface CAMCollegeCardProps {
  cam: any;
  college: any;
  mentors: any[];
  students: any[];
  slots: any[];
  requests: any[];
  approvedHandovers: any[];
  escalations: any[];
  tasks: any[];
  subjects: any[];
  departments: any[];
  attendance: any[];
  leaveRequests: any[];
  feeStats: { totalFees: number; totalPaid: number; collectionRate: number; paidCount: number; partialCount: number; unpaidCount: number } | null;
}

const CAMCollegeCard: React.FC<CAMCollegeCardProps> = ({
  cam, college, mentors, students, slots, requests, approvedHandovers, escalations, tasks,
  subjects, departments, attendance, leaveRequests, feeStats
}) => {
  const [expanded, setExpanded] = useState(false);
  const [activeSection, setActiveSection] = useState<"mentors" | "students" | "handovers" | "requests" | "issues" | "curriculum" | "attendance" | "fees">("mentors");
  const [search, setSearch] = useState("");

  const pendingRequests = requests.filter(r => r.status === "pending" || r.status === "pending_cam");
  const openIssues = escalations.filter(e => e.status === "pending" || e.status === "open");
  const pendingTasks = tasks.filter(t => t.collegeId === college?.id && t.status === "pending");

  // Attendance health: % present across all recorded sessions for this college
  const collegeStudentIds = new Set(students.map((s: any) => s.id));
  const collegeAttendance = attendance.filter((a: any) => collegeStudentIds.has(a.studentId));
  const presentCount = collegeAttendance.filter((a: any) => a.status === "present" || a.status === "od").length;
  const attendanceRate = collegeAttendance.length > 0 ? Math.round((presentCount / collegeAttendance.length) * 100) : null;

  // Curriculum health: subjects mapped vs departments
  const collegeDepts = departments.length;
  const mappedDepts = new Set(subjects.map((s: any) => s.department)).size;
  const subjectCount = subjects.length;

  // Leave requests for this college's mentors
  const mentorIds = new Set(mentors.map((m: any) => m.id));
  const pendingLeaves = leaveRequests.filter((l: any) => mentorIds.has(l.mentorId) && l.status === "pending").length;

  const filteredMentors = mentors.filter(m =>
    !search || (m.name || "").toLowerCase().includes(search.toLowerCase()) || (m.department || "").toLowerCase().includes(search.toLowerCase())
  );
  const filteredStudents = students.filter(s =>
    !search || (s.name || "").toLowerCase().includes(search.toLowerCase()) || (s.classGroup || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm overflow-hidden transition-all" data-kam-card>
      {/* Card Header */}
      <div className="p-5 flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-4">
            <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-[#D528A2] flex items-center justify-center text-white font-black text-lg shadow-md shrink-0">
              {(cam?.name || "C").substring(0, 1)}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-black text-slate-800 dark:text-white">{cam?.name || "Campus Manager"}</h3>
                <span className="px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-500/20 border border-indigo-100 dark:border-indigo-500/30 text-indigo-700 dark:text-indigo-300 text-[9px] font-black uppercase tracking-wider">CM</span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-0.5">{cam?.email || "—"}</p>
              <p className="text-[11px] font-bold text-slate-700 dark:text-slate-300 mt-0.5">
                <Building2 className="inline h-3 w-3 mr-1 text-indigo-500" />
                {college?.name || "Unassigned College"}
                {college?.address ? ` · ${college.address}` : ""}
              </p>
            </div>
          </div>
          <button
            onClick={() => setExpanded(p => !p)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-500/20 border border-indigo-200 dark:border-indigo-500/30 text-indigo-700 dark:text-indigo-300 text-[10px] font-black hover:bg-indigo-100 dark:hover:bg-indigo-500/30 transition-all cursor-pointer self-start sm:self-center"
          >
            <Eye className="h-3 w-3" />
            {expanded ? "Collapse" : "View Details"}
            {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>
        </div>

        {/* Health & KPI grid */}
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 pt-1">
          <div className="flex flex-col items-center justify-center p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700">
            <span className="text-sm font-black text-indigo-600 dark:text-indigo-400">{mentors.length}</span>
            <span className="text-[8px] font-black uppercase tracking-wider text-slate-400 mt-0.5">Faculty</span>
          </div>
          <div className="flex flex-col items-center justify-center p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700">
            <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">{students.length}</span>
            <span className="text-[8px] font-black uppercase tracking-wider text-slate-400 mt-0.5">Students</span>
          </div>
          <div className="flex flex-col items-center justify-center p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700">
            <span className="text-sm font-black text-amber-600 dark:text-amber-400">{slots.length}</span>
            <span className="text-[8px] font-black uppercase tracking-wider text-slate-400 mt-0.5">Slots</span>
          </div>
          <div className={`flex flex-col items-center justify-center p-2 rounded-xl border ${
            attendanceRate === null ? "bg-slate-50 dark:bg-slate-800/60 border-slate-100 dark:border-slate-700"
            : attendanceRate >= 75 ? "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-100 dark:border-emerald-500/20"
            : "bg-rose-50 dark:bg-rose-500/10 border-rose-100 dark:border-rose-500/20"
          }`}>
            <span className={`text-sm font-black ${
              attendanceRate === null ? "text-slate-400"
              : attendanceRate >= 75 ? "text-emerald-600 dark:text-emerald-400"
              : "text-rose-600 dark:text-rose-400"
            }`}>{attendanceRate !== null ? `${attendanceRate}%` : "—"}</span>
            <span className="text-[8px] font-black uppercase tracking-wider text-slate-400 mt-0.5">Attend.</span>
          </div>
          <div className={`flex flex-col items-center justify-center p-2 rounded-xl border ${
            feeStats === null ? "bg-slate-50 dark:bg-slate-800/60 border-slate-100 dark:border-slate-700"
            : feeStats.collectionRate >= 80 ? "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-100 dark:border-emerald-500/20"
            : "bg-amber-50 dark:bg-amber-500/10 border-amber-100 dark:border-amber-500/20"
          }`}>
            <span className={`text-sm font-black ${
              feeStats === null ? "text-slate-400"
              : feeStats.collectionRate >= 80 ? "text-emerald-600 dark:text-emerald-400"
              : "text-amber-600 dark:text-amber-400"
            }`}>{feeStats !== null ? `${feeStats.collectionRate}%` : "—"}</span>
            <span className="text-[8px] font-black uppercase tracking-wider text-slate-400 mt-0.5">Fees</span>
          </div>
          <div className={`flex flex-col items-center justify-center p-2 rounded-xl border ${
            openIssues.length > 0 ? "bg-rose-50 dark:bg-rose-500/10 border-rose-100 dark:border-rose-500/20"
            : pendingRequests.length > 0 ? "bg-amber-50 dark:bg-amber-500/10 border-amber-100 dark:border-amber-500/20"
            : "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-100 dark:border-emerald-500/20"
          }`}>
            <span className={`text-sm font-black ${
              openIssues.length > 0 ? "text-rose-600 dark:text-rose-400"
              : pendingRequests.length > 0 ? "text-amber-600 dark:text-amber-400"
              : "text-emerald-600 dark:text-emerald-400"
            }`}>{openIssues.length > 0 ? openIssues.length : pendingRequests.length > 0 ? pendingRequests.length : "✓"}</span>
            <span className="text-[8px] font-black uppercase tracking-wider text-slate-400 mt-0.5">{openIssues.length > 0 ? "Issues" : "Requests"}</span>
          </div>
        </div>
      </div>

      {/* Expandable Detail Section */}
      {expanded && (
        <div className="border-t border-slate-100 dark:border-slate-800">
          {/* Section Tabs */}
          <div className="flex items-center gap-1 px-5 pt-4 pb-0 overflow-x-auto">
            {[
              { id: "mentors", label: "Faculty", icon: Users, count: mentors.length },
              { id: "students", label: "Students", icon: GraduationCap, count: students.length },
              { id: "attendance", label: "Attendance", icon: UserCheck, count: attendanceRate !== null ? `${attendanceRate}%` as any : null },
              { id: "curriculum", label: "Curriculum", icon: BookMarked, count: subjectCount },
              { id: "fees", label: "Fees", icon: IndianRupee, count: feeStats?.collectionRate !== undefined ? `${feeStats.collectionRate}%` as any : null },
              { id: "handovers", label: "Handovers", icon: ArrowRightLeft, count: approvedHandovers.length },
              { id: "requests", label: "Requests", icon: Clock, count: pendingRequests.length, alert: pendingRequests.length > 0 },
              { id: "issues", label: "Issues", icon: ShieldAlert, count: openIssues.length, alert: openIssues.length > 0 },
            ].map(sec => {
              const Icon = sec.icon;
              const isActive = activeSection === sec.id;
              return (
                <button
                  key={sec.id}
                  onClick={() => { setActiveSection(sec.id as any); setSearch(""); }}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-t-xl text-[10px] font-black whitespace-nowrap transition-all cursor-pointer border-b-2 ${
                    isActive
                      ? "border-indigo-500 text-indigo-700 dark:text-indigo-300 bg-indigo-50/50 dark:bg-indigo-500/10"
                      : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                  }`}
                >
                  <Icon className="h-3 w-3" />
                  {sec.label}
                  <span className={`px-1.5 py-0.5 rounded-full text-[8px] font-black ${
                    sec.alert ? "bg-rose-500 text-white" :
                    isActive ? "bg-indigo-500 text-white" : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                  }`}>{sec.count}</span>
                </button>
              );
            })}
          </div>

          <div className="p-5 space-y-3">
            {/* Search bar for mentors/students */}
            {(activeSection === "mentors" || activeSection === "students") && (
              <div className="relative max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder={`Search ${activeSection}…`}
                  className="pl-8 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 w-full"
                />
              </div>
            )}

            {/* MENTORS section */}
            {activeSection === "mentors" && (
              <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
                {filteredMentors.length === 0 ? (
                  <div className="text-center py-8 text-xs text-slate-400 italic">No faculty found.</div>
                ) : (
                  <table className="w-full text-xs font-semibold min-w-[560px]">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700 text-[9px] uppercase tracking-widest text-slate-500 dark:text-slate-400 font-black">
                        <th className="p-3 text-left">Faculty Name</th>
                        <th className="p-3 text-left">Department</th>
                        <th className="p-3 text-left">Email</th>
                        <th className="p-3 text-center">Slots</th>
                        <th className="p-3 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                      {filteredMentors.map((m: any) => {
                        const mentorSlots = slots.filter(s => s.mentorId === m.id);
                        return (
                          <tr key={m.id} className="hover:bg-indigo-50/20 dark:hover:bg-indigo-500/5 transition-colors">
                            <td className="p-3">
                              <div className="flex items-center gap-2">
                                <div className="h-7 w-7 rounded-full bg-gradient-to-br from-indigo-400 to-[#D528A2] flex items-center justify-center text-white text-[9px] font-black shrink-0">
                                  {(m.name || "Faculty").substring(0, 2).toUpperCase()}
                                </div>
                                <span className="font-bold text-slate-800 dark:text-white">{m.name}</span>
                              </div>
                            </td>
                            <td className="p-3 text-slate-600 dark:text-slate-400">{m.department || "—"}</td>
                            <td className="p-3 text-slate-500 dark:text-slate-400 font-mono text-[10px]">{m.email}</td>
                            <td className="p-3 text-center font-black text-slate-800 dark:text-white">{mentorSlots.length}</td>
                            <td className="p-3 text-center">
                              <span className={`px-2 py-0.5 rounded-full text-[9px] font-black border ${
                                m.status === "Active" || !m.status
                                  ? "bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-500/10 dark:border-emerald-500/30 dark:text-emerald-300"
                                  : "bg-slate-100 border-slate-200 text-slate-500 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400"
                              }`}>{m.status || "Active"}</span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {/* STUDENTS section */}
            {activeSection === "students" && (
              <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
                {filteredStudents.length === 0 ? (
                  <div className="text-center py-8 text-xs text-slate-400 italic">No students found.</div>
                ) : (
                  <table className="w-full text-xs font-semibold min-w-[500px]">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700 text-[9px] uppercase tracking-widest text-slate-500 dark:text-slate-400 font-black">
                        <th className="p-3 text-left">Student Name</th>
                        <th className="p-3 text-left">Class Group</th>
                        <th className="p-3 text-left">Email</th>
                        <th className="p-3 text-center">Semester</th>
                        <th className="p-3 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                      {filteredStudents.map((s: any) => (
                        <tr key={s.id} className="hover:bg-emerald-50/20 dark:hover:bg-emerald-500/5 transition-colors">
                          <td className="p-3">
                            <div className="flex items-center gap-2">
                              <div className="h-7 w-7 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white text-[9px] font-black shrink-0">
                                {(s.name || "Student").substring(0, 2).toUpperCase()}
                              </div>
                              <span className="font-bold text-slate-800 dark:text-white">{s.name}</span>
                            </div>
                          </td>
                          <td className="p-3">
                            <span className="px-2 py-0.5 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-[9px] font-black">
                              {s.classGroup || "—"}
                            </span>
                          </td>
                          <td className="p-3 text-slate-500 dark:text-slate-400 font-mono text-[10px]">{s.email}</td>
                          <td className="p-3 text-center text-slate-600 dark:text-slate-400 text-[10px] font-bold">{s.semester || "—"}</td>
                          <td className="p-3 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-black border ${
                              s.status === "Active" || !s.status
                                ? "bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-500/10 dark:border-emerald-500/30 dark:text-emerald-300"
                                : "bg-slate-100 border-slate-200 text-slate-500 dark:bg-slate-800 dark:border-slate-700"
                            }`}>{s.status || "Active"}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {/* HANDOVERS section */}
            {activeSection === "handovers" && (
              <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
                {approvedHandovers.length === 0 ? (
                  <div className="text-center py-8 text-xs text-slate-400 italic">No approved handovers yet.</div>
                ) : (
                  <table className="w-full text-xs font-semibold min-w-[580px]">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700 text-[9px] uppercase tracking-widest text-slate-500 dark:text-slate-400 font-black">
                        <th className="p-3 text-left">Original Faculty</th>
                        <th className="p-3 text-left">Cover Faculty</th>
                        <th className="p-3 text-left">Course</th>
                        <th className="p-3 text-center">Date</th>
                        <th className="p-3 text-center">Month</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                      {approvedHandovers.map((h: any) => {
                        const orig = mentors.find((m: any) => m.id === h.originalMentorId);
                        const cover = mentors.find((m: any) => m.id === h.coverStaffId);
                        return (
                          <tr key={h.id || h.requestId} className="hover:bg-teal-50/20 dark:hover:bg-teal-500/5 transition-colors">
                            <td className="p-3 font-bold text-rose-700 dark:text-rose-400">{orig?.name || h.originalMentorId}</td>
                            <td className="p-3 font-bold text-emerald-700 dark:text-emerald-400">{cover?.name || h.coverStaffName}</td>
                            <td className="p-3 text-slate-700 dark:text-slate-300 max-w-[160px] truncate" title={h.course}>{h.course || "—"}</td>
                            <td className="p-3 text-center text-slate-500 dark:text-slate-400 whitespace-nowrap">{h.dateStr}</td>
                            <td className="p-3 text-center">
                              <span className="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-[9px] font-black text-slate-600 dark:text-slate-300">
                                {h.ledger_month || h.dateStr?.slice(0, 7) || "—"}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {/* REQUESTS section */}
            {activeSection === "requests" && (
              <div className="space-y-2">
                {requests.length === 0 ? (
                  <div className="text-center py-8 text-xs text-slate-400 italic">No handover requests found.</div>
                ) : (
                  requests.slice().sort((a, b) => b.timestamp?.localeCompare(a.timestamp || "") || 0).map((r: any) => {
                    const isPending = r.status === "pending" || r.status === "pending_cam";
                    const isApproved = r.status === "approved";
                    const isRejected = r.status === "rejected";
                    return (
                      <div key={r.id} className={`p-4 rounded-2xl border transition-all ${
                        isPending ? "border-amber-200 dark:border-amber-500/30 bg-amber-50/40 dark:bg-amber-500/5" :
                        isApproved ? "border-emerald-200 dark:border-emerald-500/30 bg-emerald-50/30 dark:bg-emerald-500/5" :
                        "border-slate-200 dark:border-slate-700 bg-slate-50/30 dark:bg-slate-800/20"
                      }`}>
                        <div className="flex items-start justify-between gap-3 flex-wrap">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-black text-slate-800 dark:text-white">{r.requestorName}</span>
                              <ArrowRightLeft className="h-3 w-3 text-slate-400" />
                              <span className="text-xs font-black text-indigo-700 dark:text-indigo-300">{r.targetStaffName}</span>
                              {r.request_type === "swap_compensate" && (
                                <span className="px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300 text-[8px] font-black uppercase">Swap</span>
                              )}
                            </div>
                            <p className="text-[10px] text-slate-600 dark:text-slate-400">
                              <span className="font-bold">{r.course}</span> · {r.dateFormatted || r.dateStr} · {r.time}
                            </p>
                            <p className="text-[10px] text-slate-500 dark:text-slate-400 italic">"{r.reason}"</p>
                          </div>
                          <span className={`shrink-0 px-2.5 py-1 rounded-full text-[9px] font-black border uppercase ${
                            isPending ? "bg-amber-100 border-amber-300 text-amber-800 dark:bg-amber-500/20 dark:border-amber-500/40 dark:text-amber-300" :
                            isApproved ? "bg-emerald-100 border-emerald-300 text-emerald-800 dark:bg-emerald-500/20 dark:border-emerald-500/40 dark:text-emerald-300" :
                            "bg-slate-100 border-slate-200 text-slate-500 dark:bg-slate-800 dark:border-slate-700"
                          }`}>
                            {r.status === "pending_cam" ? "⚡ Emergency" : r.status}
                          </span>
                        </div>

                        {/* Approve / Reject Actions for KAM */}
                        {isPending && (
                          <div className="flex items-center gap-2 mt-3 pt-2.5 border-t border-amber-200/60 dark:border-amber-500/20 flex-wrap">
                            <button
                              type="button"
                              onClick={async () => {
                                try {
                                  await fetch("/api/requests/review", {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ requestId: r.id, status: "approved", reviewerRole: "Key Account Manager", reviewNotes: "Approved by KAM" })
                                  });
                                  window.location.reload();
                                } catch (_) {}
                              }}
                              className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[10px] rounded-lg cursor-pointer transition-all flex items-center gap-1 shadow-xs"
                            >
                              <CheckCircle className="h-3 w-3" /> Approve Request
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                try {
                                  await fetch("/api/requests/review", {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ requestId: r.id, status: "rejected", reviewerRole: "Key Account Manager", reviewNotes: "Rejected by KAM" })
                                  });
                                  window.location.reload();
                                } catch (_) {}
                              }}
                              className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white font-black text-[10px] rounded-lg cursor-pointer transition-all flex items-center gap-1 shadow-xs"
                            >
                              <XCircle className="h-3 w-3" /> Reject Request
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* ISSUES section */}
            {activeSection === "issues" && (
              <div className="space-y-2">
                {escalations.length === 0 ? (
                  <div className="text-center py-8 text-xs text-slate-400 italic">No campus issues reported.</div>
                ) : (
                  escalations.map((esc: any) => (
                    <div key={esc.id} className={`p-4 rounded-2xl border transition-all ${
                      esc.status === "pending" || esc.status === "open"
                        ? "border-rose-200 dark:border-rose-500/30 bg-rose-50/30 dark:bg-rose-500/5"
                        : "border-emerald-200 dark:border-emerald-500/30 bg-emerald-50/20 dark:bg-emerald-500/5"
                    }`}>
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-black text-slate-800 dark:text-white">{esc.title}</span>
                            {esc.priority && (
                              <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase ${
                                esc.priority === "high" ? "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300" :
                                esc.priority === "medium" ? "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300" :
                                "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                              }`}>{esc.priority}</span>
                            )}
                          </div>
                          {esc.desc && <p className="text-[10px] text-slate-500 dark:text-slate-400 italic">"{esc.desc}"</p>}
                          <p className="text-[10px] text-slate-400">{esc.type || "General"} · {esc.created_at?.slice(0, 10) || "—"}</p>
                        </div>
                        <span className={`shrink-0 px-2.5 py-1 rounded-full text-[9px] font-black border uppercase ${
                          esc.status === "resolved"
                            ? "bg-emerald-100 border-emerald-300 text-emerald-800 dark:bg-emerald-500/20 dark:border-emerald-500/40 dark:text-emerald-300"
                            : "bg-rose-100 border-rose-300 text-rose-800 dark:bg-rose-500/20 dark:border-rose-500/40 dark:text-rose-300"
                        }`}>{esc.status || "pending"}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* ATTENDANCE section */}
            {activeSection === "attendance" && (
              <div className="space-y-4">
                {/* Summary row */}
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: "Present", value: presentCount, color: "emerald" },
                    { label: "Absent", value: collegeAttendance.filter((a: any) => a.status === "absent").length, color: "rose" },
                    { label: "OD", value: collegeAttendance.filter((a: any) => a.status === "od").length, color: "amber" },
                  ].map(s => (
                    <div key={s.label} className={`p-3 rounded-2xl border text-center ${colorMap[s.color] || colorMap.slate}`}>
                      <div className={`text-xl font-black ${s.color === "emerald" ? "text-emerald-600 dark:text-emerald-400" : s.color === "rose" ? "text-rose-600 dark:text-rose-400" : "text-amber-600 dark:text-amber-400"}`}>{s.value}</div>
                      <div className="text-[9px] font-black uppercase tracking-wider text-slate-500 mt-0.5">{s.label}</div>
                    </div>
                  ))}
                </div>
                {/* Progress bar */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-[10px] font-bold text-slate-600 dark:text-slate-400">
                    <span>Overall Attendance Rate</span>
                    <span className={attendanceRate !== null && attendanceRate < 75 ? "text-rose-600" : "text-emerald-600"}>
                      {attendanceRate !== null ? `${attendanceRate}%` : "No data"}
                    </span>
                  </div>
                  {attendanceRate !== null && (
                    <div className="h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${attendanceRate >= 75 ? "bg-emerald-500" : "bg-rose-500"}`}
                        style={{ width: `${attendanceRate}%` }}
                      />
                    </div>
                  )}
                  {attendanceRate !== null && attendanceRate < 75 && (
                    <p className="text-[10px] text-rose-600 dark:text-rose-400 font-bold flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" /> Below 75% threshold — CAM action required
                    </p>
                  )}
                </div>
                {/* Per-mentor slot attendance breakdown */}
                <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
                  <table className="w-full text-xs font-semibold min-w-[420px]">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700 text-[9px] uppercase tracking-widest text-slate-500 font-black">
                        <th className="p-3 text-left">Faculty</th>
                        <th className="p-3 text-left">Dept</th>
                        <th className="p-3 text-center">Slots</th>
                        <th className="p-3 text-center">Att. Sessions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                      {mentors.slice(0, 10).map((m: any) => {
                        const mSlots = slots.filter((s: any) => s.mentorId === m.id);
                        const mAttCount = collegeAttendance.filter((a: any) => mSlots.some((s: any) => s.id === a.slotId)).length;
                        return (
                          <tr key={m.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                            <td className="p-3 font-bold text-slate-800 dark:text-white">{m.name}</td>
                            <td className="p-3 text-slate-500 dark:text-slate-400 text-[10px]">{m.department || "—"}</td>
                            <td className="p-3 text-center text-slate-700 dark:text-slate-300 font-black">{mSlots.length}</td>
                            <td className="p-3 text-center text-slate-700 dark:text-slate-300 font-black">{mAttCount}</td>
                          </tr>
                        );
                      })}
                      {mentors.length === 0 && (
                        <tr><td colSpan={4} className="p-4 text-center text-xs text-slate-400 italic">No faculty data.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
                {pendingLeaves > 0 && (
                  <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 text-[11px] font-bold text-amber-700 dark:text-amber-300 flex items-center gap-2">
                    <Clock className="h-3.5 w-3.5 shrink-0" />
                    {pendingLeaves} faculty leave request{pendingLeaves !== 1 ? "s" : ""} pending CAM approval
                  </div>
                )}
              </div>
            )}

            {/* CURRICULUM section */}
            {activeSection === "curriculum" && (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: "Departments", value: collegeDepts, color: "indigo" },
                    { label: "Mapped Depts", value: mappedDepts, color: mappedDepts === collegeDepts && collegeDepts > 0 ? "emerald" : "amber" },
                    { label: "Subjects", value: subjectCount, color: "purple" },
                  ].map(s => (
                    <div key={s.label} className={`p-3 rounded-2xl border text-center ${colorMap[s.color] || colorMap.slate}`}>
                      <div className={`text-xl font-black ${
                        s.color === "indigo" ? "text-indigo-600 dark:text-indigo-400" :
                        s.color === "emerald" ? "text-emerald-600 dark:text-emerald-400" :
                        s.color === "amber" ? "text-amber-600 dark:text-amber-400" :
                        "text-purple-600 dark:text-purple-400"
                      }`}>{s.value}</div>
                      <div className="text-[9px] font-black uppercase tracking-wider text-slate-500 mt-0.5">{s.label}</div>
                    </div>
                  ))}
                </div>
                {collegeDepts > 0 && mappedDepts < collegeDepts && (
                  <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 text-[11px] font-bold text-amber-700 dark:text-amber-300 flex items-center gap-2">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                    {collegeDepts - mappedDepts} department{collegeDepts - mappedDepts !== 1 ? "s" : ""} have no subjects mapped
                  </div>
                )}
                <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
                  <table className="w-full text-xs font-semibold min-w-[480px]">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700 text-[9px] uppercase tracking-widest text-slate-500 font-black">
                        <th className="p-3 text-left">Department</th>
                        <th className="p-3 text-center">Subjects</th>
                        <th className="p-3 text-center">Shift</th>
                        <th className="p-3 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                      {departments.length === 0 ? (
                        <tr><td colSpan={4} className="p-4 text-center text-xs text-slate-400 italic">No departments found.</td></tr>
                      ) : departments.map((dept: any) => {
                        const deptSubs = subjects.filter((s: any) => s.department === dept.name);
                        const mapped = deptSubs.length > 0;
                        return (
                          <tr key={dept.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                            <td className="p-3 font-bold text-slate-800 dark:text-white">{dept.name}</td>
                            <td className="p-3 text-center font-black text-slate-700 dark:text-slate-300">{deptSubs.length}</td>
                            <td className="p-3 text-center">
                              <span className="px-1.5 py-0.5 rounded text-[8px] font-black bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 uppercase">
                                {dept.default_shift || "General"}
                              </span>
                            </td>
                            <td className="p-3 text-center">
                              <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase ${
                                mapped ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300" : "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300"
                              }`}>{mapped ? "Mapped" : "Unmapped"}</span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* FEES section */}
            {activeSection === "fees" && (
              <div className="space-y-4">
                {feeStats === null ? (
                  <div className="text-center py-8 text-xs text-slate-400 italic">Fee data unavailable — no CM assigned or no fees recorded.</div>
                ) : (
                  <>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {[
                        { label: "Total Fees", value: `₹${(feeStats.totalFees).toLocaleString()}`, color: "indigo" },
                        { label: "Collected", value: `₹${(feeStats.totalPaid).toLocaleString()}`, color: "emerald" },
                        { label: "Outstanding", value: `₹${(Math.max(0, feeStats.totalFees - feeStats.totalPaid)).toLocaleString()}`, color: feeStats.totalFees - feeStats.totalPaid > 0 ? "rose" : "emerald" },
                        { label: "Collection Rate", value: `${feeStats.collectionRate}%`, color: feeStats.collectionRate >= 80 ? "emerald" : "amber" },
                      ].map(s => (
                        <div key={s.label} className={`p-3 rounded-2xl border text-center ${colorMap[s.color] || colorMap.slate}`}>
                          <div className={`text-sm font-black ${
                            s.color === "indigo" ? "text-indigo-600 dark:text-indigo-400" :
                            s.color === "emerald" ? "text-emerald-600 dark:text-emerald-400" :
                            s.color === "rose" ? "text-rose-600 dark:text-rose-400" :
                            "text-amber-600 dark:text-amber-400"
                          }`}>{s.value}</div>
                          <div className="text-[9px] font-black uppercase tracking-wider text-slate-500 mt-0.5">{s.label}</div>
                        </div>
                      ))}
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-[10px] font-bold text-slate-600 dark:text-slate-400">
                        <span>Collection Progress</span>
                        <span className={feeStats.collectionRate >= 80 ? "text-emerald-600" : "text-amber-600"}>{feeStats.collectionRate}%</span>
                      </div>
                      <div className="h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${feeStats.collectionRate >= 80 ? "bg-emerald-500" : "bg-amber-500"}`}
                          style={{ width: `${feeStats.collectionRate}%` }}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { label: "Paid", value: feeStats.paidCount, color: "emerald" },
                        { label: "Partial", value: feeStats.partialCount, color: "amber" },
                        { label: "Unpaid", value: feeStats.unpaidCount, color: "rose" },
                      ].map(s => (
                        <div key={s.label} className={`p-3 rounded-2xl border text-center ${colorMap[s.color] || colorMap.slate}`}>
                          <div className={`text-xl font-black ${
                            s.color === "emerald" ? "text-emerald-600 dark:text-emerald-400" :
                            s.color === "amber" ? "text-amber-600 dark:text-amber-400" :
                            "text-rose-600 dark:text-rose-400"
                          }`}>{s.value}</div>
                          <div className="text-[9px] font-black uppercase tracking-wider text-slate-500 mt-0.5">{s.label}</div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ── Main KAMDashboard Component ─────────────────────────────────────────────
export const KAMDashboard: React.FC<KAMDashboardProps> = ({
  activeTab: propActiveTab,
  onTabChange
}) => {
  const {
    currentKAM,
    colleges,
    mentors,
    students,
    slots,
    requests,
    approvedHandovers,
    refreshData,
    kamTasks: tasks,
    campusIssues: escalations,
    saveKamTask,
    deleteKamTask,
    updateCampusIssueStatus,
    subjectsList,
    departmentsList,
    studentAttendance,
    leaveRequests,
  } = useApp();
  const { toast } = useToast();

  // Bug 8 fix: memoize activeColleges so it's stable across renders
  const activeColleges = useMemo(
    () => colleges.filter(c => !currentKAM || c.kam_id === currentKAM.id),
    [colleges, currentKAM]
  );

  const [localActiveTab, setLocalActiveTab] = useState<"overview" | "cam_reports" | "colleges" | "tasks" | "escalations" | "swap_tracker" | "profile">("overview");
  const activeTab = propActiveTab || localActiveTab;
  const setActiveTab = onTabChange || setLocalActiveTab;

  const containerRef = useRef<HTMLDivElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Task form state
  const [taskTitle, setTaskTitle] = useState("");
  const [taskCollegeId, setTaskCollegeId] = useState("");
  const [taskPriority, setTaskPriority] = useState("medium");
  const [taskDueDate, setTaskDueDate] = useState("");
  const [loadingActions, setLoadingActions] = useState<Record<string, boolean>>({});
  const setActionLoading = (key: string, loading: boolean) => {
    setLoadingActions(prev => ({ ...prev, [key]: loading }));
  };

  useEffect(() => {
    if (typeof window !== "undefined") {
      // Default to expanded (false = expanded, true = collapsed)
      const stored = localStorage.getItem("fp_sidebar_collapsed") === "true";
      setIsCollapsed(stored || false); // Always default to expanded
    }
  }, []);

  useEffect(() => {
    if (activeColleges.length > 0 && !taskCollegeId) {
      setTaskCollegeId(activeColleges[0].id);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeColleges.length, activeColleges[0]?.id]);

  // GSAP tab transition — Bug 9 fix: use data attribute selector instead of .bg-white
  useEffect(() => {
    if (typeof window !== "undefined" && containerRef.current) {
      const cards = Array.from(containerRef.current.querySelectorAll("[data-kam-card], [data-kam-panel]"));
      if (cards.length > 0) {
        gsap.killTweensOf(cards);
        gsap.fromTo(cards, { opacity: 0, y: 15, scale: 0.97 }, { opacity: 1, y: 0, scale: 1, duration: 0.45, stagger: 0.04, ease: "back.out(0.8)" });
      }
    }
  }, [activeTab]);

  // Sidebar hover state for flyout popover (matches CAM pattern)
  const [hoveredGroupId, setHoveredGroupId] = useState<string | null>(null);

  // Day Order & Daily Config state
  const [dailyConfigsMap, setDailyConfigsMap] = useState<Record<string, any>>({});
  const [selectedDayConfigCollege, setSelectedDayConfigCollege] = useState<any>(null);
  const [dayStartDate, setDayStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [dayEndDate, setDayEndDate] = useState(new Date().toISOString().slice(0, 10));
  const [dayOrderType, setDayOrderType] = useState("regular");
  const [dayOrderVal, setDayOrderVal] = useState("Day 1");
  const [daySessionMode, setDaySessionMode] = useState("Offline");
  const [dayNotes, setDayNotes] = useState("");
  const [savingDayConfig, setSavingDayConfig] = useState(false);

  // Announcement state
  const [showAnnouncementModal, setShowAnnouncementModal] = useState(false);
  const [annTitle, setAnnTitle] = useState("");
  const [annDesc, setAnnDesc] = useState("");
  const [annCollegeId, setAnnCollegeId] = useState("");
  const [annTargetRole, setAnnTargetRole] = useState("all");
  const [postingAnn, setPostingAnn] = useState(false);

  // Fetch daily configs for all colleges in portfolio
  useEffect(() => {
    if (activeColleges.length === 0) return;
    const todayStr = new Date().toISOString().slice(0, 10);
    Promise.all(
      activeColleges.map(c =>
        fetch(`/api/daily-configs?college_id=${encodeURIComponent(c.id)}&dateStr=${todayStr}`)
          .then(r => r.json())
          .catch(() => null)
      )
    ).then(results => {
      const map: Record<string, any> = {};
      results.forEach((res, idx) => {
        if (res?.success && res.config) {
          map[activeColleges[idx].id] = res.config;
        }
      });
      setDailyConfigsMap(map);
    });
  }, [activeColleges]);

  const handleSaveDayConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDayConfigCollege) return;
    setSavingDayConfig(true);
    try {
      const res = await fetch("/api/daily-configs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          college_id: selectedDayConfigCollege.id,
          startDate: dayStartDate,
          endDate: dayEndDate,
          day_type: dayOrderType,
          day_order: dayOrderVal,
          session_mode: daySessionMode,
          notes: dayNotes,
        })
      });
      const data = await res.json();
      if (data.success) {
        toast("Day Order & Status configured successfully.", "success");
        setSelectedDayConfigCollege(null);
        refreshData();
      } else {
        toast(data.message || "Failed to set Day Order", "error");
      }
    } catch (_) {
      toast("An error occurred", "error");
    } finally {
      setSavingDayConfig(false);
    }
  };

  const handlePostAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!annTitle.trim()) return;
    setPostingAnn(true);
    try {
      const res = await fetch("/api/announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: annTitle,
          description: annDesc,
          created_by: currentKAM?.name || "Key Account Manager",
          target_role: annTargetRole,
          college_id: annCollegeId || null,
        })
      });
      const data = await res.json();
      if (data.success) {
        toast("Announcement broadcasted successfully.", "success");
        setShowAnnouncementModal(false);
        setAnnTitle("");
        setAnnDesc("");
      } else {
        toast(data.message || "Failed to post announcement", "error");
      }
    } catch (_) {
      toast("An error occurred", "error");
    } finally {
      setPostingAnn(false);
    }
  };

  // Bug 1 fix: fetch real CAM data per college using /api/cam, not /api/kam
  // Also fetch fee stats per college via /api/fees?role=cam&camId=
  const [camDataMap, setCamDataMap] = useState<Record<string, any>>({});
  const [feeStatsMap, setFeeStatsMap] = useState<Record<string, any>>({});
  const [loadingCams, setLoadingCams] = useState(false);

  useEffect(() => {
    if (!currentKAM?.id || activeColleges.length === 0) return;

    setLoadingCams(true);
    // First get all CMs for this KAM (their IDs) from the KAM endpoint
    fetch(`/api/kam?id=${encodeURIComponent(currentKAM.id)}`)
      .then(r => r.json())
      .then(async (kamData) => {
        if (!kamData.success) return;
        const cmList: any[] = kamData.campusManagers || [];

        // Fetch full CAM data + fee data in parallel for each CM
        const results = await Promise.allSettled(
          cmList.map(async (cm: any) => {
            const [camRes, feeRes] = await Promise.all([
              fetch(`/api/cam?id=${encodeURIComponent(cm.id)}`).then(r => r.json()).catch(() => null),
              fetch(`/api/fees?role=cam&camId=${encodeURIComponent(cm.id)}`).then(r => r.json()).catch(() => null),
            ]);
            return { collegeId: cm.college_id, camData: camRes, feeData: feeRes };
          })
        );

        const newCamMap: Record<string, any> = {};
        const newFeeMap: Record<string, any> = {};
        results.forEach(r => {
          if (r.status === "fulfilled" && r.value) {
            const { collegeId, camData, feeData } = r.value;
            if (camData?.success && camData.cam) newCamMap[collegeId] = camData.cam;
            if (feeData?.success && feeData.stats) newFeeMap[collegeId] = feeData.stats;
          }
        });
        setCamDataMap(newCamMap);
        setFeeStatsMap(newFeeMap);
      })
      .catch(() => {})
      .finally(() => setLoadingCams(false));
  }, [currentKAM?.id, activeColleges.length]);

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim() || !taskDueDate) return;
    setActionLoading('submit_task', true);
    try {
      const res = await saveKamTask({ title: taskTitle, collegeId: taskCollegeId, priority: taskPriority, status: "pending", dueDate: taskDueDate });
      if (res.success) { setTaskTitle(""); setTaskDueDate(""); toast("Task assigned successfully.", "success"); }
      else toast(res.message || "Failed to create task", "error");
    } finally {
      setActionLoading('submit_task', false);
    }
  };

  const handleDeleteTask = async (id: string) => {
    setActionLoading(`delete_task_${id}`, true);
    try {
      const res = await deleteKamTask(id);
      if (res.success) {
        await refreshData();
        toast("Task deleted.", "success");
      } else toast(res.message || "Failed to delete task", "error");
    } finally {
      setActionLoading(`delete_task_${id}`, false);
    }
  };

  const handleResolveEscalation = async (id: string) => {
    setActionLoading(`resolve_issue_${id}`, true);
    try {
      const res = await updateCampusIssueStatus(id, "resolved", new Date().toLocaleDateString());
      if (res.success) {
        await refreshData();
        toast("Issue resolved.", "success");
      } else toast(res.message || "Failed to resolve", "error");
    } finally {
      setActionLoading(`resolve_issue_${id}`, false);
    }
  };

  // ── Portfolio-wide computed stats (must be declared BEFORE getNotificationCount) ─────
  const portfolioMentorIds = new Set(mentors.filter(m => activeColleges.some(c => c.id === m.college_id)).map(m => m.id));
  const portfolioStudentIds = new Set(students.filter(s => activeColleges.some(c => c.id === s.college_id)).map(s => s.id));
  const totalMentors = portfolioMentorIds.size;
  const totalStudents = portfolioStudentIds.size;
  const totalSlots = slots.filter(s => portfolioMentorIds.has(s.mentorId)).length;
  const totalPendingRequests = requests.filter(r => (r.status === "pending" || r.status === "pending_cam") && portfolioMentorIds.has(r.requestorId)).length;
  // Scoped to this KAM's portfolio colleges (Bug 3 / 5 fix)
  const totalOpenIssues = escalations.filter(e => (e.status === "pending" || e.status === "open") && activeColleges.some(c => c.id === e.collegeId)).length;
  const totalPendingTasks = tasks.filter(t => t.status === "pending" && activeColleges.some(c => c.id === t.collegeId)).length;

  // ── Sidebar nav groups ──────────────────────────────────────────────────
  const getNotificationCount = (tabId: string) => {
    if (tabId === "tasks") return tasks.filter(t => t.status === "pending" && activeColleges.some(c => c.id === t.collegeId)).length;
    if (tabId === "escalations") return escalations.filter(e => (e.status === "pending" || e.status === "open") && activeColleges.some(c => c.id === e.collegeId)).length;
    if (tabId === "cam_reports") return requests.filter(r => r.status === "pending_cam" && portfolioMentorIds.has(r.requestorId)).length;
    return 0;
  };

  const sidebarGroups = [
    {
      id: "portfolio",
      title: "Campuses",
      icon: Building2,
      items: [
        { id: "overview", label: "Overview", icon: Activity },
        { id: "cam_reports", label: "CM Reports", icon: Layers },
        { id: "colleges", label: "Campus Directory", icon: Building2 },
        { id: "swap_tracker", label: "Swap Ledger", icon: ArrowRightLeft },
      ]
    },
    {
      id: "actions",
      title: "Directives",
      icon: ClipboardList,
      items: [
        { id: "tasks", label: "Assign Task", icon: ClipboardList },
        { id: "interviews", label: "Interview Module", icon: Award },
        { id: "escalations", label: "Escalated Issues", icon: ShieldAlert },
      ]
    },
    {
      id: "settings",
      title: "Settings",
      icon: User,
      items: [
        { id: "profile", label: "My Profile", icon: User }
      ]
    }
  ];

  // Build CAMs list for this KAM
  const kamCamList = activeColleges.map(college => {
    const cam = camDataMap[college.id] || null;
    return { college, cam };
  });

  return (
    <div className="flex-1 flex flex-col md:flex-row bg-warm-canvas text-slate-805 font-sans h-full overflow-hidden dark:bg-gradient-to-br dark:from-slate-900 dark:via-slate-950 dark:to-indigo-950 dark:text-slate-100">

      {/* ── Sidebar ── */}
      <aside ref={sidebarRef} className={`hidden md:flex shrink-0 flex-col justify-between sticky top-6 z-30 floating-sidebar transition-all duration-300 ${isCollapsed ? "w-20 p-3" : "w-64 p-5"}`}>
        <div className="flex flex-col flex-1 overflow-visible">
          {/* Sidebar Header */}
          {!isCollapsed && (
            <div className="mb-5 pb-4 border-b border-slate-200/60 dark:border-slate-800">
              <p className="text-[9px] font-black uppercase tracking-widest text-indigo-500 dark:text-indigo-400 mb-1">KAM Portal</p>
              <h2 className="text-base font-black text-slate-800 dark:text-white leading-tight">Portfolio Hub</h2>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                {activeColleges.length} campus{activeColleges.length !== 1 ? "es" : ""} managed
              </p>
            </div>
          )}

          <nav className={`py-2 space-y-2 ${isCollapsed ? "px-1" : "px-4"}`}>
            {sidebarGroups.map(group => {
              const Icon = group.icon;
              const isAnyChildActive = group.items.some(item => activeTab === item.id);
              const totalPendingInGroup = group.items.reduce((sum, item) => sum + getNotificationCount(item.id), 0);

              return (
                <div
                  key={group.id}
                  className="relative py-0.5"
                  onMouseEnter={() => setHoveredGroupId(group.id)}
                  onMouseLeave={() => setHoveredGroupId(null)}
                >
                  {/* Group button — acts as the hover trigger */}
                  <button
                    type="button"
                    className={`sidebar-group-btn w-full flex items-center rounded-2xl transition-all duration-200 cursor-pointer ${
                      isCollapsed ? "justify-center px-0 py-3.5" : "justify-between px-4 py-3.5 text-left"
                    } ${
                      isAnyChildActive
                        ? "bg-indigo-500/8 text-indigo-600 border border-indigo-200/60 dark:bg-indigo-500/10 dark:text-indigo-300 dark:border-indigo-500/25"
                        : "text-slate-500 hover:text-slate-800 hover:bg-slate-50 dark:text-slate-400 dark:hover:text-white dark:hover:bg-white/5"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Icon className={`h-4 w-4 shrink-0 ${isAnyChildActive ? "text-indigo-500 dark:text-indigo-400" : "text-slate-400 dark:text-slate-500"}`} />
                      {!isCollapsed && <span className="text-xs font-bold truncate">{group.title}</span>}
                    </div>
                    {!isCollapsed && (
                      <div className="flex items-center gap-1.5 shrink-0">
                        {totalPendingInGroup > 0 && (
                          <span className="bg-rose-500 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full">
                            {totalPendingInGroup}
                          </span>
                        )}
                        <ChevronRight className={`h-3 w-3 transition-transform ${isAnyChildActive ? "text-indigo-500" : "text-slate-400"}`} />
                      </div>
                    )}
                  </button>

                  {/* Flyout sub-menu popover — appears on hover to the right */}
                  <div className={`absolute left-full top-0 pl-2 w-56 z-50 ${hoveredGroupId === group.id ? "block" : "hidden"}`}>
                    <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-indigo-100 dark:border-slate-700 shadow-xl rounded-2xl p-2.5 animate-fadeIn">
                      <div className="px-3 py-1.5 text-[9px] font-black uppercase tracking-widest border-b border-slate-100 dark:border-slate-800 mb-1.5 text-indigo-600 dark:text-indigo-400">
                        {group.title}
                      </div>
                      <div className="space-y-0.5">
                        {group.items.map(child => {
                          const ChildIcon = child.icon;
                          const isChildActive = activeTab === child.id;
                          const count = getNotificationCount(child.id);
                          return (
                            <button
                              key={child.id}
                              type="button"
                              onClick={() => {
                                setActiveTab(child.id as any);
                                setHoveredGroupId(null);
                              }}
                              className={`w-full flex items-center justify-start gap-3 px-2.5 py-2 text-left rounded-xl text-[11px] font-bold tracking-tight transition-all duration-150 cursor-pointer ${
                                isChildActive
                                  ? "bg-gradient-to-r from-indigo-500 to-[#D528A2] text-white shadow-sm"
                                  : "text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 dark:text-slate-400 dark:hover:text-indigo-300 dark:hover:bg-white/5"
                              }`}
                            >
                              <ChildIcon className={`h-3.5 w-3.5 shrink-0 ${isChildActive ? "text-white" : "text-slate-400"}`} />
                              <span className="flex-1 truncate">{child.label}</span>
                              {count > 0 && (
                                <span className={`ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                                  isChildActive ? "bg-white/25 text-white" : "bg-rose-500 text-white"
                                }`}>
                                  {count}
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Footer — user card + collapse toggle */}
        <div className="border-t border-slate-100/85 dark:border-slate-800 pt-4 space-y-3 shrink-0">
          {!isCollapsed && (
            <div className="px-3 py-2.5 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-500/10 dark:to-purple-500/10 rounded-xl border border-indigo-100 dark:border-indigo-500/20">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-full bg-gradient-to-r from-indigo-500 to-[#D528A2] flex items-center justify-center text-white text-xs font-bold shrink-0">
                  {currentKAM?.name?.substring(0, 2).toUpperCase() || "KM"}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-slate-800 dark:text-white truncate">
                    {currentKAM?.name || "KAM User"}
                  </p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                    Key Account Manager
                  </p>
                </div>
              </div>
            </div>
          )}
          <div className="flex justify-center pt-1">
            <button
              type="button"
              onClick={() => setIsCollapsed(prev => {
                const next = !prev;
                localStorage.setItem("fp_sidebar_collapsed", String(next));
                return next;
              })}
              className="h-8 w-8 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center text-slate-500 hover:text-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 shadow-sm transition-all cursor-pointer"
              title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
            >
              {isCollapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </aside>

      {/* ── Mobile Bottom Nav — all 7 tabs, scroll-friendly ── */}
      <nav className="flex md:hidden fixed bottom-0 inset-x-0 z-50 mobile-bottom-nav">
        <div className="flex w-full justify-around items-center py-2 px-1 overflow-x-auto gap-0.5">
          {[
            { id: "overview", label: "Overview", icon: Activity },
            { id: "cam_reports", label: "CMs", icon: Layers },
            { id: "colleges", label: "Campuses", icon: Building2 },
            { id: "swap_tracker", label: "Swaps", icon: ArrowRightLeft },
            { id: "tasks", label: "Tasks", icon: ClipboardList },
            { id: "interviews", label: "Interviews", icon: Award },
            { id: "escalations", label: "Issues", icon: ShieldAlert },
            { id: "profile", label: "Profile", icon: User },
          ].map(t => {
            const Icon = t.icon;
            const isActive = activeTab === t.id;
            const count = getNotificationCount(t.id);
            return (
              <button key={t.id} onClick={() => setActiveTab(t.id as any)}
                className={`relative flex flex-col items-center justify-center gap-0.5 flex-1 min-w-[44px] py-1.5 rounded-xl transition-all cursor-pointer ${isActive ? "text-indigo-600" : "text-slate-400"}`}>
                <div className="relative">
                  <Icon className={`h-4 w-4 transition-transform ${isActive ? "scale-110" : ""}`} />
                  {count > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 h-3.5 w-3.5 bg-rose-500 text-white text-[7px] font-bold rounded-full flex items-center justify-center">
                      {count}
                    </span>
                  )}
                </div>
                <span className={`text-[8px] font-semibold tracking-wide leading-none ${isActive ? "text-indigo-600" : "text-slate-400"}`}>{t.label}</span>
                {isActive && <span className="absolute top-0 inset-x-2 h-0.5 bg-indigo-500 rounded-full" />}
              </button>
            );
          })}
        </div>
      </nav>

      {/* ── Main Content ── */}
      <main ref={containerRef} className="flex-grow overflow-x-hidden overflow-y-auto h-full p-4 md:p-6 space-y-6 pb-20 md:pb-16 relative scroll-touch">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-7xl mx-auto w-full space-y-6 relative z-10 animate-fadeIn">

          {/* ── Global Header ── */}
          <div data-kam-panel className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-850 rounded-3xl p-5 md:p-8 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-300 text-[10px] font-black uppercase tracking-widest border border-indigo-100 dark:border-indigo-500/30">
                  Key Account Manager Dashboard
                </span>
              </div>
              <h1 className="text-lg md:text-2xl font-black tracking-tight text-slate-800 dark:text-white">
                Welcome back, {currentKAM?.name || "Portfolio Manager"}
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-bold">
                Managing {activeColleges.length} campus{activeColleges.length !== 1 ? "es" : ""} · {totalMentors} faculty · {totalStudents} students
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap shrink-0 self-start sm:self-center">
              <Button variant="secondary" size="md" icon={<BookMarked className="h-4 w-4" />}
                onClick={() => setShowAnnouncementModal(true)}>
                Announce
              </Button>
              <Button variant="primary" size="md" icon={<RefreshCw className="h-4 w-4 hover-spin-icon" />}
                onClick={() => { refreshData(); toast("Data synced.", "info"); }}>
                Refresh Data
              </Button>
            </div>
          </div>

          {/* ══ TAB: OVERVIEW ══ */}
          {activeTab === "overview" && (
            <div className="space-y-6">
              {/* ⚡ Urgent Emergency Approvals Banner */}
              {(() => {
                const emergencyReqs = requests.filter(r => r.status === "pending_cam" && portfolioMentorIds.has(r.requestorId));
                if (emergencyReqs.length === 0) return null;
                return (
                  <div className="bg-gradient-to-r from-rose-500 to-amber-500 p-0.5 rounded-3xl shadow-md">
                    <div className="bg-white dark:bg-slate-900 rounded-[23px] p-4 sm:p-5 space-y-3">
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div className="flex items-center gap-2">
                          <span className="h-3 w-3 rounded-full bg-rose-500 animate-ping inline-block" />
                          <h3 className="text-xs font-black text-rose-600 dark:text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
                            <ShieldAlert className="h-4 w-4" /> ⚡ Urgent Emergency Approvals Required ({emergencyReqs.length})
                          </h3>
                        </div>
                        <span className="text-[10px] text-slate-400 font-bold">Action required by Key Account Manager</span>
                      </div>
                      <div className="space-y-2">
                        {emergencyReqs.map(r => (
                          <div key={r.id} className="p-3 rounded-xl bg-rose-50/50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 flex items-center justify-between gap-3 flex-wrap">
                            <div className="space-y-0.5">
                              <p className="text-xs font-black text-slate-800 dark:text-white">
                                {r.requestorName} → <span className="text-indigo-600 dark:text-indigo-400">{r.targetStaffName}</span>
                              </p>
                              <p className="text-[10px] text-slate-500 dark:text-slate-400">
                                <span className="font-bold">{r.course}</span> · {r.dateFormatted || r.dateStr} · "{r.reason}"
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={async () => {
                                  await fetch("/api/requests/review", {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ requestId: r.id, status: "approved", reviewerRole: "Key Account Manager", reviewNotes: "Approved by KAM" })
                                  });
                                  refreshData();
                                  toast("Emergency handover approved.", "success");
                                }}
                                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[10px] rounded-lg cursor-pointer transition-all flex items-center gap-1 shadow-xs"
                              >
                                <CheckCircle className="h-3.5 w-3.5" /> Approve
                              </button>
                              <button
                                type="button"
                                onClick={async () => {
                                  await fetch("/api/requests/review", {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ requestId: r.id, status: "rejected", reviewerRole: "Key Account Manager", reviewNotes: "Rejected by KAM" })
                                  });
                                  refreshData();
                                  toast("Emergency handover rejected.", "info");
                                }}
                                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-black text-[10px] rounded-lg cursor-pointer transition-all flex items-center gap-1 shadow-xs"
                              >
                                <XCircle className="h-3.5 w-3.5" /> Reject
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* 📅 Today's Operations Panel */}
              <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-5 md:p-6 shadow-sm space-y-4">
                <div className="flex items-center justify-between gap-3 flex-wrap border-b border-slate-100 dark:border-slate-800 pb-3">
                  <div>
                    <h3 className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-wider flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-indigo-500" /> Today's Operations & Day Order Status
                    </h3>
                    <p className="text-[10px] text-slate-400 mt-0.5 font-semibold">
                      {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                    </p>
                  </div>
                  <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 text-indigo-700 dark:text-indigo-300">
                    Portfolio Active Status
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {activeColleges.map(college => {
                    const config = dailyConfigsMap[college.id];
                    const collegeMentors = mentors.filter(m => m.college_id === college.id);
                    const collegeMentorIds = new Set(collegeMentors.map(m => m.id));
                    const todayDayName = new Date().toLocaleDateString('en-US', { weekday: 'long' });
                    const scheduledToday = slots.filter(s => collegeMentorIds.has(s.mentorId) && s.day === todayDayName).length;

                    const dayOrder = config?.day_order || "Day 1";
                    const dayType = config?.day_type || "regular";
                    const sessionMode = config?.session_mode || "Offline";

                    return (
                      <div key={college.id} className="p-4 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/60 flex flex-col justify-between gap-3">
                        <div>
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <span className="text-xs font-black text-slate-800 dark:text-white truncate">{college.name}</span>
                            <span className={`px-2 py-0.5 rounded-full text-[8.5px] font-black uppercase border ${
                              dayType === "holiday" ? "bg-slate-100 border-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-300" :
                              dayType === "exam_day" ? "bg-amber-100 border-amber-300 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300" :
                              "bg-emerald-100 border-emerald-300 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300"
                            }`}>
                              {dayType === "holiday" ? "Holiday" : `${dayOrder} (${dayType})`}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-[10px] text-slate-500 dark:text-slate-400 font-semibold">
                            <span>Mode: <strong className="text-slate-700 dark:text-slate-200">{sessionMode}</strong></span>
                            <span>·</span>
                            <span>Classes: <strong className="text-slate-700 dark:text-slate-200">{scheduledToday}</strong> scheduled</span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedDayConfigCollege(college);
                            if (config) {
                              setDayOrderType(config.day_type || "regular");
                              setDayOrderVal(config.day_order || "Day 1");
                              setDaySessionMode(config.session_mode || "Offline");
                              setDayNotes(config.notes || "");
                            }
                          }}
                          className="w-full py-1.5 px-3 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-500/10 dark:hover:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 font-bold text-[10px] rounded-xl transition-all flex items-center justify-center gap-1 cursor-pointer border border-indigo-100 dark:border-indigo-500/20"
                        >
                          <Compass className="h-3 w-3" /> Set Day Order & Status
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
              {/* KPI Row */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                {[
                  { label: "Campuses", value: activeColleges.length, icon: Building2, bg: "bg-indigo-50 dark:bg-indigo-500/10", border: "border-indigo-100 dark:border-indigo-500/20", text: "text-indigo-600 dark:text-indigo-400" },
                  { label: "Faculty", value: totalMentors, icon: Users, bg: "bg-purple-50 dark:bg-purple-500/10", border: "border-purple-100 dark:border-purple-500/20", text: "text-purple-600 dark:text-purple-400" },
                  { label: "Students", value: totalStudents, icon: GraduationCap, bg: "bg-emerald-50 dark:bg-emerald-500/10", border: "border-emerald-100 dark:border-emerald-500/20", text: "text-emerald-600 dark:text-emerald-400" },
                  { label: "Total Slots", value: totalSlots, icon: BookOpen, bg: "bg-amber-50 dark:bg-amber-500/10", border: "border-amber-100 dark:border-amber-500/20", text: "text-amber-600 dark:text-amber-400" },
                  { label: "Pending Requests", value: totalPendingRequests, icon: Clock, bg: totalPendingRequests > 0 ? "bg-rose-50 dark:bg-rose-500/10" : "bg-emerald-50 dark:bg-emerald-500/10", border: totalPendingRequests > 0 ? "border-rose-100 dark:border-rose-500/20" : "border-emerald-100 dark:border-emerald-500/20", text: totalPendingRequests > 0 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400" },
                  { label: "Open Issues", value: totalOpenIssues, icon: ShieldAlert, bg: totalOpenIssues > 0 ? "bg-rose-50 dark:bg-rose-500/10" : "bg-emerald-50 dark:bg-emerald-500/10", border: totalOpenIssues > 0 ? "border-rose-100 dark:border-rose-500/20" : "border-emerald-100 dark:border-emerald-500/20", text: totalOpenIssues > 0 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400" },
                ].map(kpi => {
                  const Icon = kpi.icon;
                  return (
                    <div key={kpi.label} className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-4 flex flex-col gap-2 shadow-sm">
                      <div className={`h-8 w-8 rounded-xl flex items-center justify-center ${kpi.bg} border ${kpi.border}`}>
                        <Icon className={`h-4 w-4 ${kpi.text}`} />
                      </div>
                      <div>
                        <div className="text-2xl font-black text-slate-800 dark:text-white">{kpi.value}</div>
                        <div className="text-[9px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mt-0.5">{kpi.label}</div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* ── Infographics Row ── */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

                {/* Campus Comparison Bar Chart */}
                <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-5 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-wider">Campus Comparison</h3>
                      <p className="text-[10px] text-slate-400 mt-0.5">Faculty & students per campus</p>
                    </div>
                    <div className="flex items-center gap-3 text-[9px] font-black uppercase tracking-wider">
                      <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-indigo-500 inline-block" />Faculty</span>
                      <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-emerald-500 inline-block" />Students</span>
                    </div>
                  </div>
                  {activeColleges.length === 0 ? (
                    <div className="h-36 flex items-center justify-center text-xs text-slate-400 italic">No campuses assigned.</div>
                  ) : (() => {
                    const barData = activeColleges.map(c => ({
                      name: c.name.length > 18 ? c.name.substring(0, 16) + "…" : c.name,
                      faculty: mentors.filter(m => m.college_id === c.id).length,
                      students: students.filter(s => s.college_id === c.id).length,
                    }));
                    const maxVal = Math.max(...barData.flatMap(d => [d.faculty, d.students]), 1);
                    const chartH = 140;
                    const barGroupW = Math.max(40, Math.floor(560 / Math.max(barData.length, 1)));
                    const barW = Math.max(10, Math.floor(barGroupW * 0.35));
                    const gap = 4;
                    const totalW = barData.length * barGroupW;

                    return (
                      <div className="overflow-x-auto">
                        <svg width={Math.max(totalW, 300)} height={chartH + 32} className="block mx-auto" style={{ minWidth: "100%" }}>
                          {/* Gridlines */}
                          {[0.25, 0.5, 0.75, 1].map(f => {
                            const y = chartH - Math.round(f * chartH);
                            return (
                              <g key={f}>
                                <line x1={0} y1={y} x2={Math.max(totalW, 300)} y2={y}
                                  stroke="currentColor" strokeOpacity={0.06} strokeWidth={1} strokeDasharray="4 3" className="text-slate-400 dark:text-slate-600" />
                                <text x={2} y={y - 2} fontSize={7} fill="currentColor" fillOpacity={0.35} className="text-slate-500">
                                  {Math.round(f * maxVal)}
                                </text>
                              </g>
                            );
                          })}
                          {barData.map((d, i) => {
                            const x = i * barGroupW + barGroupW / 2;
                            const fH = Math.max(3, Math.round((d.faculty / maxVal) * chartH));
                            const sH = Math.max(3, Math.round((d.students / maxVal) * chartH));
                            return (
                              <g key={d.name}>
                                {/* Faculty bar */}
                                <rect
                                  x={x - barW - gap / 2}
                                  y={chartH - fH}
                                  width={barW}
                                  height={fH}
                                  rx={3}
                                  className="fill-indigo-500 dark:fill-indigo-400"
                                  opacity={0.85}
                                />
                                {/* Students bar */}
                                <rect
                                  x={x + gap / 2}
                                  y={chartH - sH}
                                  width={barW}
                                  height={sH}
                                  rx={3}
                                  className="fill-emerald-500 dark:fill-emerald-400"
                                  opacity={0.85}
                                />
                                {/* Values */}
                                {fH > 12 && (
                                  <text x={x - barW / 2 - gap / 2} y={chartH - fH + 9} textAnchor="middle" fontSize={7} fill="white" fontWeight="700">{d.faculty}</text>
                                )}
                                {sH > 12 && (
                                  <text x={x + barW / 2 + gap / 2} y={chartH - sH + 9} textAnchor="middle" fontSize={7} fill="white" fontWeight="700">{d.students}</text>
                                )}
                                {/* Campus label */}
                                <text x={x} y={chartH + 14} textAnchor="middle" fontSize={8} fill="currentColor" fillOpacity={0.55} className="text-slate-500" fontWeight="600">
                                  {d.name}
                                </text>
                              </g>
                            );
                          })}
                        </svg>
                      </div>
                    );
                  })()}
                </div>

                {/* Request Pipeline Donut */}
                <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-5 shadow-sm flex flex-col">
                  <div className="mb-4">
                    <h3 className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-wider">Request Pipeline</h3>
                    <p className="text-[10px] text-slate-400 mt-0.5">All handover requests status</p>
                  </div>
                  {(() => {
                    const portfolioReqs = requests.filter(r => portfolioMentorIds.has(r.requestorId));
                    const approved = portfolioReqs.filter(r => r.status === "approved").length;
                    const pending = portfolioReqs.filter(r => r.status === "pending" || r.status === "pending_cam").length;
                    const rejected = portfolioReqs.filter(r => r.status === "rejected").length;
                    const total = portfolioReqs.length;
                    if (total === 0) return (
                      <div className="flex-1 flex items-center justify-center text-xs text-slate-400 italic">No requests yet.</div>
                    );
                    const segments = [
                      { label: "Approved", value: approved, color: "#10b981" },
                      { label: "Pending", value: pending, color: "#f59e0b" },
                      { label: "Rejected", value: rejected, color: "#ef4444" },
                    ].filter(s => s.value > 0);
                    const r = 44, cx = 70, cy = 70, strokeW = 18;
                    const circumference = 2 * Math.PI * r;
                    let offset = 0;
                    const arcs = segments.map(s => {
                      const dash = (s.value / total) * circumference;
                      const arc = { ...s, dash, offset };
                      offset += dash;
                      return arc;
                    });
                    return (
                      <div className="flex flex-col items-center gap-4 flex-1 justify-center">
                        <div className="relative">
                          <svg width={140} height={140} viewBox="0 0 140 140">
                            <circle cx={cx} cy={cy} r={r} fill="none" stroke="currentColor" strokeWidth={strokeW} className="text-slate-100 dark:text-slate-800" />
                            {arcs.map(arc => (
                              <circle key={arc.label} cx={cx} cy={cy} r={r} fill="none"
                                stroke={arc.color} strokeWidth={strokeW}
                                strokeDasharray={`${arc.dash} ${circumference - arc.dash}`}
                                strokeDashoffset={circumference / 4 - arc.offset}
                                strokeLinecap="butt"
                                style={{ transition: "stroke-dasharray 0.5s ease" }}
                              />
                            ))}
                            <text x={cx} y={cy - 6} textAnchor="middle" fontSize={20} fontWeight="900" fill="currentColor" className="text-slate-800 dark:text-white">{total}</text>
                            <text x={cx} y={cy + 10} textAnchor="middle" fontSize={8} fill="currentColor" fillOpacity={0.5} className="text-slate-500" fontWeight="700" letterSpacing="1">TOTAL</text>
                          </svg>
                        </div>
                        <div className="w-full space-y-2">
                          {[
                            { label: "Approved", value: approved, color: "bg-emerald-500" },
                            { label: "Pending", value: pending, color: "bg-amber-400" },
                            { label: "Rejected", value: rejected, color: "bg-rose-500" },
                          ].map(s => (
                            <div key={s.label} className="flex items-center gap-2">
                              <span className={`h-2 w-2 rounded-full ${s.color} shrink-0`} />
                              <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400 flex-1">{s.label}</span>
                              <span className="text-[10px] font-black text-slate-800 dark:text-white">{s.value}</span>
                              <span className="text-[9px] text-slate-400 font-semibold w-8 text-right">{total > 0 ? Math.round((s.value / total) * 100) : 0}%</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* ── Portfolio Health Row: Attendance + Fee gauges ── */}
              {activeColleges.length > 0 && (() => {
                const healthData = activeColleges.map(college => {
                  const camData = camDataMap[college.id];
                  const feeStats = feeStatsMap[college.id];
                  const collegeStudentIds = new Set(students.filter(s => s.college_id === college.id).map(s => s.id));
                  const collegeAtt = studentAttendance.filter((a: any) => collegeStudentIds.has(a.studentId));
                  const presentCount = collegeAtt.filter((a: any) => a.status === "present" || a.status === "od").length;
                  const attRate = collegeAtt.length > 0 ? Math.round((presentCount / collegeAtt.length) * 100) : null;
                  const feeRate = feeStats?.collectionRate ?? null;
                  return { name: college.name, attRate, feeRate };
                });
                return (
                  <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-5 shadow-sm">
                    <div className="mb-4">
                      <h3 className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-wider">Portfolio Health</h3>
                      <p className="text-[10px] text-slate-400 mt-0.5">Attendance & fee collection rates per campus</p>
                    </div>
                    <div className="space-y-3">
                      {healthData.map(d => (
                        <div key={d.name} className="grid grid-cols-1 sm:grid-cols-[1fr_2fr_2fr] gap-x-4 gap-y-1.5 items-center">
                          <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300 truncate">{d.name}</span>
                          {/* Attendance bar */}
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all duration-700"
                                style={{
                                  width: d.attRate !== null ? `${d.attRate}%` : "0%",
                                  background: d.attRate === null ? "#e2e8f0"
                                    : d.attRate >= 75 ? "linear-gradient(90deg,#10b981,#34d399)"
                                    : "linear-gradient(90deg,#ef4444,#f87171)"
                                }}
                              />
                            </div>
                            <span className={`text-[10px] font-black w-10 text-right shrink-0 ${
                              d.attRate === null ? "text-slate-400"
                              : d.attRate >= 75 ? "text-emerald-600 dark:text-emerald-400"
                              : "text-rose-600 dark:text-rose-400"
                            }`}>{d.attRate !== null ? `${d.attRate}%` : "—"}</span>
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide w-14 shrink-0">Attend.</span>
                          </div>
                          {/* Fee bar */}
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all duration-700"
                                style={{
                                  width: d.feeRate !== null ? `${d.feeRate}%` : "0%",
                                  background: d.feeRate === null ? "#e2e8f0"
                                    : d.feeRate >= 80 ? "linear-gradient(90deg,#6366f1,#a855f7)"
                                    : "linear-gradient(90deg,#f59e0b,#fbbf24)"
                                }}
                              />
                            </div>
                            <span className={`text-[10px] font-black w-10 text-right shrink-0 ${
                              d.feeRate === null ? "text-slate-400"
                              : d.feeRate >= 80 ? "text-indigo-600 dark:text-indigo-400"
                              : "text-amber-600 dark:text-amber-400"
                            }`}>{d.feeRate !== null ? `${d.feeRate}%` : "—"}</span>
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide w-14 shrink-0">Fees</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* Per-Campus Summary Cards */}
              <Panel title="Campus Network Overview" subtitle="Snapshot of all colleges under your KAM portfolio">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {activeColleges.map(college => {
                    const collegeMentors = mentors.filter(m => m.college_id === college.id);
                    const collegeStudents = students.filter(s => s.college_id === college.id);
                    const collegeMentorIds = new Set(collegeMentors.map(m => m.id));
                    const collegeSlots = slots.filter(s => collegeMentorIds.has(s.mentorId));
                    const collegePending = requests.filter(r => (r.status === "pending" || r.status === "pending_cam") && collegeMentorIds.has(r.requestorId));
                    const collegeIssues = escalations.filter(e => e.collegeId === college.id && (e.status === "pending" || e.status === "open"));
                    const collegeTasks = tasks.filter(t => t.collegeId === college.id && t.status === "pending");
                    return (
                      <div key={college.id} className="p-5 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/60 hover:border-indigo-200 dark:hover:border-indigo-500/30 transition-all">
                        <div className="flex items-start justify-between gap-3 mb-4">
                          <div>
                            <h4 className="text-sm font-black text-slate-800 dark:text-white">{college.name}</h4>
                            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">{college.address || "—"}</p>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            {collegePending.length > 0 && (
                              <span className="px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 text-[9px] font-black border border-amber-200 dark:border-amber-500/30">
                                {collegePending.length} pending
                              </span>
                            )}
                            {collegeIssues.length > 0 && (
                              <span className="px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300 text-[9px] font-black border border-rose-200 dark:border-rose-500/30">
                                {collegeIssues.length} issues
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="grid grid-cols-4 gap-2 text-center">
                          {[
                            { label: "Faculty", value: collegeMentors.length, text: "text-indigo-600 dark:text-indigo-400" },
                            { label: "Students", value: collegeStudents.length, text: "text-emerald-600 dark:text-emerald-400" },
                            { label: "Slots", value: collegeSlots.length, text: "text-amber-600 dark:text-amber-400" },
                            { label: "Tasks", value: collegeTasks.length, text: collegeTasks.length > 0 ? "text-rose-600 dark:text-rose-400" : "text-slate-600 dark:text-slate-400" },
                          ].map(stat => (
                            <div key={stat.label} className="bg-white dark:bg-slate-950 p-2.5 rounded-xl border border-slate-100 dark:border-slate-850">
                              <div className={`text-sm font-black ${stat.text}`}>{stat.value}</div>
                              <div className="text-[8px] font-black uppercase tracking-wider text-slate-400 mt-0.5">{stat.label}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Panel>

              {/* Recent requests across all campuses */}
              {requests.filter(r => portfolioMentorIds.has(r.requestorId)).length > 0 && (
                <Panel title="Recent Handover Activity" subtitle="Latest class handover requests across all your campuses">
                  <div className="space-y-2">
                    {requests.filter(r => portfolioMentorIds.has(r.requestorId))
                      .sort((a, b) => b.timestamp?.localeCompare(a.timestamp || "") || 0)
                      .slice(0, 8)
                      .map(r => {
                        const college = activeColleges.find(c => mentors.find(m => m.id === r.requestorId)?.college_id === c.id);
                        const isPending = r.status === "pending" || r.status === "pending_cam";
                        return (
                          <div key={r.id} className="flex items-center justify-between gap-3 p-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-indigo-200 dark:hover:border-indigo-500/30 transition-all">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="h-8 w-8 rounded-full bg-gradient-to-br from-indigo-400 to-[#D528A2] flex items-center justify-center text-white text-[9px] font-black shrink-0">
                                {r.requestorName?.substring(0, 2).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-bold text-slate-800 dark:text-white truncate">
                                  {r.requestorName} → {r.targetStaffName}
                                </p>
                                <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">{r.course} · {r.dateFormatted || r.dateStr}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {college && <span className="hidden sm:block text-[9px] font-bold text-slate-400 truncate max-w-[80px]">{college.name}</span>}
                              <span className={`px-2 py-0.5 rounded-full text-[9px] font-black border ${
                                r.status === "pending_cam" ? "bg-rose-100 border-rose-300 text-rose-700 dark:bg-rose-500/20 dark:border-rose-500/40 dark:text-rose-300" :
                                isPending ? "bg-amber-100 border-amber-300 text-amber-800 dark:bg-amber-500/20 dark:border-amber-500/40 dark:text-amber-300" :
                                r.status === "approved" ? "bg-emerald-100 border-emerald-300 text-emerald-800 dark:bg-emerald-500/20 dark:border-emerald-500/40 dark:text-emerald-300" :
                                "bg-slate-100 border-slate-200 text-slate-500 dark:bg-slate-800 dark:border-slate-700"
                              }`}>{r.status === "pending_cam" ? "⚡ Emergency" : r.status}</span>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </Panel>
              )}
            </div>
          )}

          {/* ══ TAB: CAM REPORTS ══ */}
          {activeTab === "cam_reports" && (
              <div className="space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div>
                    <h2 className="text-lg font-black text-slate-800 dark:text-white">CM Reporting View</h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      All Campus Managers reporting to you — {activeColleges.length} college{activeColleges.length !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 text-indigo-700 dark:text-indigo-300 text-[10px] font-black">
                      {activeColleges.length} CM{activeColleges.length !== 1 ? "s" : ""} under you
                    </span>
                  </div>
                </div>

                {/* Portfolio summary strip */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {[
                    { label: "Total Faculty", value: totalMentors, icon: Users, bg: "bg-indigo-50 dark:bg-indigo-500/10", text: "text-indigo-700 dark:text-indigo-300" },
                    { label: "Total Students", value: totalStudents, icon: GraduationCap, bg: "bg-emerald-50 dark:bg-emerald-500/10", text: "text-emerald-700 dark:text-emerald-300" },
                    { label: "Pending Handovers", value: totalPendingRequests, icon: Clock, bg: "bg-amber-50 dark:bg-amber-500/10", text: "text-amber-700 dark:text-amber-300" },
                    { label: "Open Issues", value: totalOpenIssues, icon: ShieldAlert, bg: "bg-rose-50 dark:bg-rose-500/10", text: "text-rose-700 dark:text-rose-300" },
                  ].map(s => {
                    const Icon = s.icon;
                    return (
                      <div key={s.label} className={`${s.bg} border border-slate-100 dark:border-slate-800 rounded-2xl p-4 flex items-center gap-3`}>
                        <Icon className={`h-5 w-5 ${s.text} shrink-0`} />
                        <div>
                          <div className={`text-xl font-black ${s.text}`}>{s.value}</div>
                          <div className="text-[9px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">{s.label}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* CAM Cards — Bug 10 fix: skeleton while loading, real CM data once ready */}
                <div className="space-y-4">
                  {loadingCams ? (
                    // Loading skeleton
                    Array.from({ length: activeColleges.length || 2 }).map((_, i) => (
                      <div key={i} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 animate-pulse">
                        <div className="flex items-center gap-4">
                          <div className="h-12 w-12 rounded-2xl bg-slate-200 dark:bg-slate-700 shrink-0" />
                          <div className="flex-1 space-y-2">
                            <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/3" />
                            <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded w-1/2" />
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    activeColleges.map(college => {
                      const cam = camDataMap[college.id];
                      const collegeMentors = mentors.filter(m => m.college_id === college.id);
                      const collegeStudents = students.filter(s => s.college_id === college.id);
                      const collegeMentorIds = new Set(collegeMentors.map(m => m.id));
                      const collegeSlots = slots.filter(s => collegeMentorIds.has(s.mentorId));
                      const collegeRequests = requests.filter(r => collegeMentorIds.has(r.requestorId) || collegeMentorIds.has(r.targetStaffId));
                      const collegeHandovers = approvedHandovers.filter(h => collegeMentorIds.has(h.originalMentorId) || collegeMentorIds.has(h.coverStaffId));
                      const collegeIssues = escalations.filter(e => e.collegeId === college.id);
                      const collegeTasks = tasks.filter(t => t.collegeId === college.id);
                      const collegeDepts = departmentsList.filter(d => d.college_id === college.id);
                      const collegeSubjects = subjectsList.filter(s => s.college_id === college.id);
                      const collegeMentorIdSet = new Set(collegeMentors.map(m => m.id));
                      const collegeStudentIds = new Set(collegeStudents.map(s => s.id));
                      const collegeAtt = studentAttendance.filter(a => collegeStudentIds.has(a.studentId));
                      const collegeLeaves = leaveRequests.filter((l: any) => collegeMentorIdSet.has(l.mentorId));
                      const feeStat = feeStatsMap[college.id] || null;

                      return (
                        <CAMCollegeCard
                          key={college.id}
                          cam={cam || { name: `CM — ${college.name}`, email: "—", id: null }}
                          college={college}
                          mentors={collegeMentors}
                          students={collegeStudents}
                          slots={collegeSlots}
                          requests={collegeRequests}
                          approvedHandovers={collegeHandovers}
                          escalations={collegeIssues}
                          tasks={collegeTasks}
                          subjects={collegeSubjects}
                          departments={collegeDepts}
                          attendance={collegeAtt}
                          leaveRequests={collegeLeaves}
                          feeStats={feeStat}
                        />
                      );
                    })
                  )}
                  {activeColleges.length === 0 && !loadingCams && (
                    <div className="text-center py-16 text-sm text-slate-400 italic border border-dashed border-slate-200 dark:border-slate-700 rounded-3xl">
                      No colleges assigned to your KAM portfolio yet.
                    </div>
                  )}
                </div>
              </div>
            )}

          {/* ══ TAB: CAMPUS DIRECTORY ══ */}
          {activeTab === "colleges" && (
            <div className="space-y-6" data-kam-panel>
              {/* KPI strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  { label: "Colleges", value: activeColleges.length, icon: Building2, bg: "bg-indigo-50 dark:bg-indigo-500/10", border: "border-indigo-100 dark:border-indigo-500/20", text: "text-indigo-600 dark:text-indigo-400" },
                  { label: "Open Issues", value: totalOpenIssues, icon: ShieldAlert, bg: totalOpenIssues > 0 ? "bg-rose-50 dark:bg-rose-500/10" : "bg-emerald-50 dark:bg-emerald-500/10", border: totalOpenIssues > 0 ? "border-rose-100 dark:border-rose-500/20" : "border-emerald-100 dark:border-emerald-500/20", text: totalOpenIssues > 0 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400" },
                  { label: "Tasks Pending", value: totalPendingTasks, icon: ClipboardList, bg: totalPendingTasks > 0 ? "bg-amber-50 dark:bg-amber-500/10" : "bg-emerald-50 dark:bg-emerald-500/10", border: totalPendingTasks > 0 ? "border-amber-100 dark:border-amber-500/20" : "border-emerald-100 dark:border-emerald-500/20", text: totalPendingTasks > 0 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400" },
                  { label: "Portfolio Faculty", value: totalMentors, icon: Users, bg: "bg-purple-50 dark:bg-purple-500/10", border: "border-purple-100 dark:border-purple-500/20", text: "text-purple-600 dark:text-purple-400" },
                ].map(kpi => {
                  const Icon = kpi.icon;
                  return (
                    <div key={kpi.label} className={`${kpi.bg} border ${kpi.border} rounded-2xl p-4 flex items-center gap-3`}>
                      <Icon className={`h-5 w-5 ${kpi.text} shrink-0`} />
                      <div>
                        <div className={`text-xl font-black ${kpi.text}`}>{kpi.value}</div>
                        <div className="text-[9px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">{kpi.label}</div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* College cards with CAM contact */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {activeColleges.map(c => {
                  const cam = camDataMap[c.id];
                  const cMentors = mentors.filter(m => m.college_id === c.id);
                  const cStudents = students.filter(s => s.college_id === c.id);
                  const cMentorIds = new Set(cMentors.map(m => m.id));
                  const cSlots = slots.filter(s => cMentorIds.has(s.mentorId));
                  const cIssues = escalations.filter(e => e.collegeId === c.id && (e.status === "pending" || e.status === "open"));
                  const cTasks = tasks.filter(t => t.collegeId === c.id);
                  const cTasksDone = cTasks.filter(t => t.status === "completed").length;
                  const cDepts = departmentsList.filter(d => d.college_id === c.id);
                  const cSubjects = subjectsList.filter(s => s.college_id === c.id);
                  const feeStat = feeStatsMap[c.id];

                  return (
                    <div key={c.id} data-kam-panel className="p-5 rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col gap-4 hover:border-indigo-200 dark:hover:border-indigo-500/30 transition-all shadow-sm">
                      {/* Header row */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-indigo-500 to-[#D528A2] flex items-center justify-center text-white font-black text-base shrink-0">
                            {c.name.substring(0, 1)}
                          </div>
                          <div>
                            <h4 className="text-sm font-black text-slate-800 dark:text-white leading-tight">{c.name}</h4>
                            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">{c.address || "No address"}</p>
                          </div>
                        </div>
                        {cIssues.length > 0 && (
                          <span className="shrink-0 px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-500/20 border border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-300 text-[9px] font-black">
                            {cIssues.length} issue{cIssues.length !== 1 ? "s" : ""}
                          </span>
                        )}
                      </div>

                      {/* CAM contact strip */}
                      <div className={`flex items-center gap-2 px-3 py-2 rounded-xl text-[10px] font-semibold ${cam ? "bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20" : "bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"}`}>
                        <User className={`h-3.5 w-3.5 shrink-0 ${cam ? "text-indigo-500" : "text-slate-400"}`} />
                        {cam ? (
                          <span className="text-slate-700 dark:text-slate-300">
                            <span className="font-black text-indigo-700 dark:text-indigo-300">{cam.name}</span>
                            <span className="mx-1.5 text-slate-400">·</span>
                            <span className="text-slate-500 dark:text-slate-400 font-mono">{cam.email}</span>
                          </span>
                        ) : (
                          <span className="text-slate-400 italic">No campus manager assigned</span>
                        )}
                      </div>

                      {/* Stats grid */}
                      <div className="grid grid-cols-3 gap-2 text-center text-[10px] font-bold">
                        {[
                          { label: "Faculty", value: cMentors.length, color: "indigo" },
                          { label: "Students", value: cStudents.length, color: "emerald" },
                          { label: "Slots", value: cSlots.length, color: "amber" },
                        ].map(s => (
                          <div key={s.label} className="bg-slate-50 dark:bg-slate-950 p-2 rounded-xl border border-slate-100 dark:border-slate-800">
                            <span className={`text-sm font-black block ${
                              s.color === "indigo" ? "text-indigo-600 dark:text-indigo-400" :
                              s.color === "emerald" ? "text-emerald-600 dark:text-emerald-400" :
                              "text-amber-600 dark:text-amber-400"
                            }`}>{s.value}</span>
                            <span className="text-[8px] font-black uppercase tracking-wider text-slate-400 mt-0.5 block">{s.label}</span>
                          </div>
                        ))}
                      </div>

                      {/* Health badges row */}
                      <div className="flex flex-wrap gap-2">
                        <span className="flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[9px] font-bold text-slate-600 dark:text-slate-300">
                          <BookMarked className="h-3 w-3 text-purple-500" />
                          {cDepts.length} depts · {cSubjects.length} subjects
                        </span>
                        {feeStat && (
                          <span className={`flex items-center gap-1 px-2 py-1 rounded-lg border text-[9px] font-bold ${feeStat.collectionRate >= 80 ? "bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-500/10 dark:border-emerald-500/30 dark:text-emerald-300" : "bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-500/10 dark:border-amber-500/30 dark:text-amber-300"}`}>
                            <IndianRupee className="h-3 w-3" />
                            {feeStat.collectionRate}% collected
                          </span>
                        )}
                        {cTasks.length > 0 && (
                          <span className={`flex items-center gap-1 px-2 py-1 rounded-lg border text-[9px] font-bold ${cTasksDone === cTasks.length ? "bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-500/10 dark:border-emerald-500/30 dark:text-emerald-300" : "bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-500/10 dark:border-amber-500/30 dark:text-amber-300"}`}>
                            <CheckCircle className="h-3 w-3" />
                            {cTasksDone}/{cTasks.length} tasks done
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
                {activeColleges.length === 0 && (
                  <div className="col-span-2 text-center py-16 text-sm text-slate-400 italic border border-dashed border-slate-200 dark:border-slate-700 rounded-2xl">
                    No colleges assigned to your KAM portfolio yet.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ══ TAB: ASSIGN TASK ══ */}
          {activeTab === "tasks" && (() => {
            const today = new Date().toISOString().slice(0, 10);
            const portfolioTasks = tasks.filter(t => activeColleges.some(c => c.id === t.collegeId));
            const doneTasks = portfolioTasks.filter(t => t.status === "completed");
            const pendingT = portfolioTasks.filter(t => t.status === "pending");
            const overdueTasks = pendingT.filter(t => t.dueDate && t.dueDate < today);
            return (
              <div className="space-y-6" data-kam-panel>
                {/* Task summary strip */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {[
                    { label: "Total Assigned", value: portfolioTasks.length, color: "indigo" },
                    { label: "Pending", value: pendingT.length, color: pendingT.length > 0 ? "amber" : "emerald" },
                    { label: "Completed", value: doneTasks.length, color: "emerald" },
                    { label: "Overdue", value: overdueTasks.length, color: overdueTasks.length > 0 ? "rose" : "slate" },
                  ].map(s => (
                    <div key={s.label} className={`bg-${s.color}-50 dark:bg-${s.color}-500/10 border border-${s.color}-100 dark:border-${s.color}-500/20 rounded-2xl p-4 text-center`}>
                      <div className={`text-2xl font-black text-${s.color}-600 dark:text-${s.color}-400`}>{s.value}</div>
                      <div className="text-[9px] font-black uppercase tracking-wider text-slate-500 mt-0.5">{s.label}</div>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Panel title="Assign Task to CM" subtitle="Direct task items to campus managers">
                    <form onSubmit={handleCreateTask} className="space-y-4 text-xs font-semibold">
                      <Select label="Target College" value={taskCollegeId} onChange={e => setTaskCollegeId(e.target.value)}
                        options={activeColleges.map(c => ({ value: c.id, label: c.name }))} required />
                      <Input label="Task Directive" type="text" placeholder="e.g. Verify missing mark entries" value={taskTitle} onChange={e => setTaskTitle(e.target.value)} required />
                      <div className="grid grid-cols-2 gap-3">
                        <Select label="Priority" value={taskPriority} onChange={e => setTaskPriority(e.target.value)}
                          options={[{ value: "high", label: "High" }, { value: "medium", label: "Medium" }, { value: "low", label: "Low" }]} />
                        <Input label="Due Date" type="date" value={taskDueDate} onChange={e => setTaskDueDate(e.target.value)} required />
                      </div>
                      <LoadingButton
                        type="submit"
                        isLoading={loadingActions['submit_task']}
                        loadingText="Assigning..."
                        variant="gradient"
                        icon={<PlusCircle className="h-4 w-4" />}
                        className="w-full mt-2"
                      >
                        Assign Task
                      </LoadingButton>
                    </form>
                  </Panel>

                  <Panel title="Task Logs" subtitle="All assigned tasks with completion status">
                    <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                      {portfolioTasks.length === 0 && (
                        <p className="text-xs text-slate-500 italic text-center py-6">No tasks assigned yet.</p>
                      )}
                      {portfolioTasks
                        .slice()
                        .sort((a, b) => {
                          // sort: overdue first, then pending, then completed
                          const aOverdue = a.status === "pending" && a.dueDate && a.dueDate < today;
                          const bOverdue = b.status === "pending" && b.dueDate && b.dueDate < today;
                          if (aOverdue && !bOverdue) return -1;
                          if (!aOverdue && bOverdue) return 1;
                          if (a.status === "pending" && b.status !== "pending") return -1;
                          if (a.status !== "pending" && b.status === "pending") return 1;
                          return (a.dueDate || "").localeCompare(b.dueDate || "");
                        })
                        .map(t => {
                          const college = activeColleges.find(c => c.id === t.collegeId);
                          const isOverdue = t.status === "pending" && t.dueDate && t.dueDate < today;
                          const isDone = t.status === "completed";
                          return (
                            <div key={t.id} className={`p-3.5 rounded-xl border flex items-start justify-between gap-3 transition-all ${
                              isOverdue ? "border-rose-200 dark:border-rose-500/30 bg-rose-50/40 dark:bg-rose-500/5"
                              : isDone ? "border-emerald-200 dark:border-emerald-500/30 bg-emerald-50/20 dark:bg-emerald-500/5"
                              : "border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/60"
                            }`}>
                              <div className="space-y-1 text-[11px] font-semibold min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap text-[9px] uppercase font-black">
                                  <span className={`px-1.5 py-0.5 rounded ${
                                    t.priority === "high" ? "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300"
                                    : t.priority === "medium" ? "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300"
                                    : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                                  }`}>{t.priority}</span>
                                  <span className="text-slate-500 dark:text-slate-400 truncate">{college?.name || "—"}</span>
                                  {isOverdue && (
                                    <span className="px-1.5 py-0.5 rounded bg-rose-500 text-white">⚠ Overdue</span>
                                  )}
                                </div>
                                <p className="text-xs font-bold text-slate-800 dark:text-white truncate">{t.title}</p>
                                <p className="text-[10px] text-slate-500 dark:text-slate-400">
                                  Due: <strong className={isOverdue ? "text-rose-600 dark:text-rose-400" : ""}>{t.dueDate || "—"}</strong>
                                  {" · "}
                                  <strong className={isDone ? "text-emerald-600 dark:text-emerald-400" : isOverdue ? "text-rose-600 dark:text-rose-400" : "text-amber-600 dark:text-amber-400"}>
                                    {isDone ? "✓ Completed" : isOverdue ? "Overdue" : "Pending"}
                                  </strong>
                                </p>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                {!isDone && (
                                  <button
                                    onClick={async () => {
                                      setActionLoading(`complete_task_${t.id}`, true);
                                      try {
                                        await fetch("/api/tasks", {
                                          method: "PUT",
                                          headers: { "Content-Type": "application/json" },
                                          body: JSON.stringify({ id: t.id, status: "completed" })
                                        });
                                        await refreshData();
                                        toast("Task marked as completed.", "success");
                                      } finally {
                                        setActionLoading(`complete_task_${t.id}`, false);
                                      }
                                    }}
                                    disabled={loadingActions[`complete_task_${t.id}`]}
                                    className="p-1.5 text-emerald-600 hover:bg-emerald-500/10 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                                    title="Mark Complete"
                                  >
                                    {loadingActions[`complete_task_${t.id}`] ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <CheckCircle2 className="h-4 w-4" />
                                    )}
                                  </button>
                                )}
                                <button
                                  onClick={() => handleDeleteTask(t.id)}
                                  disabled={loadingActions[`delete_task_${t.id}`]}
                                  className="p-1.5 text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                  title="Delete task"
                                >
                                  {loadingActions[`delete_task_${t.id}`] ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Trash2 className="h-4 w-4" />
                                  )}
                                </button>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </Panel>
                </div>
              </div>
            );
          })()}

          {/* ══ TAB: ESCALATED ISSUES ══ */}
          {activeTab === "escalations" && (() => {
            // Bug 3 fix: filter to this KAM's portfolio
            const portfolioEscalations = escalations.filter(e => activeColleges.some(c => c.id === e.collegeId));
            return (
              <div className="max-w-3xl mx-auto w-full">
                <Panel title="Escalated Campus Issues" subtitle="Review and resolve items forwarded by CMs">
                  <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
                    {portfolioEscalations.map(esc => (
                      <div key={esc.id} className="p-3.5 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/60 flex flex-col gap-3 hover:border-indigo-500/20 transition-all">
                        <div className="space-y-1">
                          <div className="flex justify-between items-center text-[9px] uppercase font-black">
                            <span className="text-indigo-600 dark:text-indigo-400 font-bold">{esc.collegeName}</span>
                            <span className="text-slate-500 dark:text-slate-400 font-semibold">{esc.escalatedAt || esc.created_at?.slice(0, 10) || "Today"}</span>
                          </div>
                          <h4 className="text-xs font-black text-slate-800 dark:text-white">{esc.title}</h4>
                          {esc.desc && <p className="text-[10px] text-slate-600 dark:text-slate-400 leading-relaxed italic">"{esc.desc}"</p>}
                          <div className="flex items-center gap-2 flex-wrap">
                            {esc.priority && (
                              <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase ${
                                esc.priority === "high" ? "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300" :
                                "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300"
                              }`}>{esc.priority} priority</span>
                            )}
                            {esc.type && <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[8px] font-black text-slate-500 dark:text-slate-400">{esc.type}</span>}
                          </div>
                        </div>
                        {esc.status === "pending" || esc.status === "open" ? (
                          <LoadingButton
                            variant="secondary"
                            isLoading={loadingActions[`resolve_issue_${esc.id}`]}
                            loadingText="Resolving..."
                            onClick={() => handleResolveEscalation(esc.id)}
                            className="w-full"
                          >
                            Mark Resolved
                          </LoadingButton>
                        ) : (
                          <span className="w-full py-1.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-black border border-emerald-500/20 text-[10px] rounded text-center block">✓ Resolved</span>
                        )}
                      </div>
                    ))}
                    {portfolioEscalations.length === 0 && <p className="text-xs text-slate-500 italic text-center py-6">All campuses fully SLA compliant.</p>}
                  </div>
                </Panel>
              </div>
            );
          })()}

          {/* ══ TAB: SWAP LEDGER ══ */}
          {activeTab === "swap_tracker" && (() => {
            const allSwapRequests = requests.filter(r => r.request_type === "swap_compensate" && portfolioMentorIds.has(r.requestorId));
            const pendingSwaps = allSwapRequests.filter(r => r.status === "pending" || r.status === "pending_cam");
            const settledSwaps = allSwapRequests.filter(r => r.status === "approved");
            const declinedSwaps = allSwapRequests.filter(r => r.status === "rejected");

            const campusBreakdown = activeColleges.map(college => {
              const cgIds = new Set(mentors.filter(m => m.college_id === college.id).map(m => m.id));
              const campusSwaps = allSwapRequests.filter(r => cgIds.has(r.requestorId));
              return { college, swaps: campusSwaps, pending: campusSwaps.filter(r => r.status === "pending" || r.status === "pending_cam").length, settled: campusSwaps.filter(r => r.status === "approved").length };
            });

            interface WorkloadRow { mentorId: string; mentorName: string; department: string; collegeName: string; given: number; received: number; swapsPending: number; swapsSettled: number; balance: number; }
            const ledgerMap = new Map<string, WorkloadRow>();
            approvedHandovers.forEach(h => {
              [{ id: h.originalMentorId, field: "given" as const }, { id: h.coverStaffId, field: "received" as const }].forEach(({ id, field }) => {
                const m = mentors.find(m => m.id === id);
                if (!m || !portfolioMentorIds.has(m.id)) return;
                const college = activeColleges.find(c => c.id === m.college_id);
                if (!ledgerMap.has(m.id)) ledgerMap.set(m.id, { mentorId: m.id, mentorName: m.name, department: m.department || "—", collegeName: college?.name || "—", given: 0, received: 0, swapsPending: 0, swapsSettled: 0, balance: 0 });
                ledgerMap.get(m.id)![field]++;
              });
            });
            allSwapRequests.forEach(r => {
              const row = ledgerMap.get(r.requestorId);
              if (row) { if (r.status === "pending" || r.status === "pending_cam") row.swapsPending++; else if (r.status === "approved") row.swapsSettled++; }
            });
            const ledgerList = Array.from(ledgerMap.values()).map(row => ({ ...row, balance: row.given - row.received })).filter(row => row.balance !== 0 || row.swapsPending > 0 || row.swapsSettled > 0).sort((a, b) => b.balance - a.balance);

            return (
              <div className="space-y-6">
                <Panel title="Cross-Campus Swap & Compensation Ledger" subtitle="Portfolio-wide view of faculty hour debts and swap resolution progress">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-2">
                    <Card label="Total Swap Requests" value={allSwapRequests.length} icon={<ArrowRightLeft className="h-4 w-4 text-indigo-600" />} className="bg-pastel-blue" />
                    <Card label="Pending Resolution" value={pendingSwaps.length} icon={<Clock className="h-4 w-4 text-amber-600" />} success={pendingSwaps.length === 0} className="bg-pastel-cream" />
                    <Card label="Debts Settled" value={settledSwaps.length} icon={<CheckCircle2 className="h-4 w-4 text-emerald-600" />} success={true} className="bg-pastel-green" />
                    <Card label="Declined Offers" value={declinedSwaps.length} icon={<XCircle className="h-4 w-4 text-rose-600" />} success={true} className="bg-pastel-purple" />
                  </div>
                </Panel>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {campusBreakdown.map(cb => (
                    <div key={cb.college.id} className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-4 rounded-2xl shadow-sm flex flex-col gap-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-slate-800 dark:text-white">{cb.college.name}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[8.5px] font-black uppercase border ${cb.pending > 0 ? "bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300" : "bg-teal-50 border-teal-200 text-teal-700 dark:bg-teal-500/10 dark:text-teal-300"}`}>
                          {cb.pending > 0 ? `${cb.pending} pending` : "All settled"}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-center text-[10px] font-bold">
                        <div className="bg-amber-50 dark:bg-amber-500/10 rounded-xl py-2 border border-amber-100 dark:border-amber-500/20">
                          <div className="text-lg font-black text-amber-700 dark:text-amber-300">{cb.pending}</div>
                          <div className="text-amber-600 dark:text-amber-400 text-[8px] uppercase font-black">Pending</div>
                        </div>
                        <div className="bg-teal-50 dark:bg-teal-500/10 rounded-xl py-2 border border-teal-100 dark:border-teal-500/20">
                          <div className="text-lg font-black text-teal-700 dark:text-teal-300">{cb.settled}</div>
                          <div className="text-teal-600 dark:text-teal-400 text-[8px] uppercase font-black">Settled</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <Panel title="All Swap Requests Across Portfolio" subtitle="Chronological log of all swap-to-compensate offers">
                  {allSwapRequests.length === 0 ? (
                    <div className="text-center py-10 border border-dashed border-slate-205 dark:border-slate-800 rounded-2xl">
                      <p className="text-3xl mb-2">↔</p>
                      <p className="text-xs text-slate-400 italic font-semibold">No swap compensation requests across portfolio yet.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs mt-2">
                      <table className="w-full border-collapse text-left text-xs font-semibold min-w-[580px]">
                        <thead>
                          <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 font-bold uppercase text-[9px] tracking-widest">
                            <th className="p-3">Campus</th><th className="p-3">Debtor (Owes)</th><th className="p-3">Creditor (Owed)</th><th className="p-3">Class Offered</th><th className="p-3">Date</th><th className="p-3 text-center">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                          {allSwapRequests.slice().sort((a, b) => (b.timestamp || "").localeCompare(a.timestamp || "")).map(req => {
                            const debtorMentor = mentors.find(m => m.id === req.requestorId);
                            const creditorMentor = mentors.find(m => m.id === req.targetStaffId);
                            const campus = debtorMentor ? activeColleges.find(c => c.id === debtorMentor.college_id) : null;
                            const isPending = req.status === "pending" || req.status === "pending_cam";
                            const isApproved = req.status === "approved";
                            return (
                              <tr key={req.id} className="hover:bg-indigo-50/20 dark:hover:bg-indigo-500/5 transition-colors">
                                <td className="p-3"><span className="px-2 py-0.5 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/30 text-indigo-700 dark:text-indigo-300 text-[8.5px] font-black uppercase">{campus?.name || "—"}</span></td>
                                <td className="p-3"><div className="font-black text-rose-700 dark:text-rose-400">{debtorMentor?.name || req.requestorName}</div><div className="text-[9px] text-slate-400">{debtorMentor?.department || ""}</div></td>
                                <td className="p-3"><div className="font-black text-emerald-700 dark:text-emerald-400">{creditorMentor?.name || req.targetStaffName}</div><div className="text-[9px] text-slate-400">{creditorMentor?.department || ""}</div></td>
                                <td className="p-3"><div className="font-bold text-slate-800 dark:text-white max-w-[150px] truncate">{req.course}</div><div className="text-[9px] text-slate-400">{req.dateFormatted}</div></td>
                                <td className="p-3 text-slate-505 font-medium whitespace-nowrap">{req.dateStr}</td>
                                <td className="p-3 text-center">
                                  {isApproved ? <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-teal-100 dark:bg-teal-500/20 border border-teal-200 dark:border-teal-500/30 text-teal-800 dark:text-teal-300 text-[8.5px] font-black uppercase">Settled</span>
                                    : isPending ? <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-100 dark:bg-amber-500/20 border border-amber-200 dark:border-amber-500/30 text-amber-800 dark:text-amber-300 text-[8.5px] font-black uppercase">⏳ Awaiting</span>
                                    : <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-100 dark:bg-red-500/20 border border-red-200 dark:border-red-500/30 text-red-800 dark:text-red-300 text-[8.5px] font-black uppercase">Declined</span>}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </Panel>

                {ledgerList.length > 0 && (
                  <Panel title="Faculty Workload Balance Overview" subtitle="Mentors with outstanding hour debts across your portfolio">
                    <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs mt-2">
                      <table className="w-full border-collapse text-left text-xs font-semibold min-w-[620px]">
                        <thead>
                          <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 font-bold uppercase text-[9px] tracking-widest">
                            <th className="p-3">Faculty</th><th className="p-3">Campus</th><th className="p-3 text-center">Given (−)</th><th className="p-3 text-center">Received (+)</th><th className="p-3 text-center">Balance</th><th className="p-3 text-center">Pending</th><th className="p-3 text-center">Settled</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                          {ledgerList.map(row => {
                            // Bug 6 fix: balance > 0 means GIVEN more than received = OWED (creditor) = amber
                            // balance < 0 means RECEIVED more than given = DEBTOR = rose
                            const isOwed = row.balance > 0;
                            const isDebtor = row.balance < 0;
                            return (
                              <tr key={row.mentorId} className={`hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors ${isDebtor && row.swapsPending === 0 ? "bg-rose-50/30 dark:bg-rose-500/5" : isOwed && row.swapsPending === 0 ? "bg-amber-50/30 dark:bg-amber-500/5" : ""}`}>
                                <td className="p-3"><div className="font-black text-slate-800 dark:text-white">{row.mentorName}</div><div className="text-[9px] text-slate-400">{row.department}</div></td>
                                <td className="p-3"><span className="px-2 py-0.5 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/30 text-indigo-700 dark:text-indigo-300 text-[8.5px] font-black uppercase">{row.collegeName}</span></td>
                                <td className="p-3 text-center">{row.given > 0 ? <span className="px-2 py-0.5 rounded bg-amber-50 border border-amber-200 text-amber-700 dark:bg-amber-500/10 dark:border-amber-500/30 dark:text-amber-300 font-black">−{row.given}</span> : <span className="text-slate-300">—</span>}</td>
                                <td className="p-3 text-center">{row.received > 0 ? <span className="px-2 py-0.5 rounded bg-teal-50 border border-teal-200 text-teal-700 dark:bg-teal-500/10 dark:border-teal-500/30 dark:text-teal-300 font-black">+{row.received}</span> : <span className="text-slate-300">—</span>}</td>
                                <td className="p-3 text-center font-black text-sm">
                                  <span className={isOwed ? "text-amber-600 dark:text-amber-400" : isDebtor ? "text-rose-600 dark:text-rose-400" : "text-slate-400"}>
                                    {row.balance > 0 ? `+${row.balance}` : row.balance}
                                  </span>
                                  {isOwed && row.swapsPending === 0 && <span className="ml-1 text-[8px] text-amber-500">(owed)</span>}
                                  {isDebtor && row.swapsPending === 0 && <span className="ml-1 text-[8px] text-rose-500">(owes)</span>}
                                </td>
                                <td className="p-3 text-center">{row.swapsPending > 0 ? <span className="px-2 py-0.5 rounded-full bg-amber-100 border border-amber-200 text-amber-800 dark:bg-amber-500/20 dark:border-amber-500/30 dark:text-amber-300 text-[8.5px] font-black">{row.swapsPending} pending</span> : <span className="text-slate-300 text-[9px]">—</span>}</td>
                                <td className="p-3 text-center">{row.swapsSettled > 0 ? <span className="px-2 py-0.5 rounded-full bg-teal-100 border border-teal-200 text-teal-800 dark:bg-teal-500/20 dark:border-teal-500/30 dark:text-teal-300 text-[8.5px] font-black">{row.swapsSettled} settled</span> : <span className="text-slate-300 text-[9px]">—</span>}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </Panel>
                )}
              </div>
            );
          })()}

          {/* ══ TAB: PROFILE ══ */}
          {activeTab === "profile" && (
            /* Bug 11 fix: show empty state when currentKAM is null */
            !currentKAM ? (
              <div className="flex flex-col items-center justify-center py-24 gap-4 text-center" data-kam-panel>
                <div className="h-16 w-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                  <User className="h-8 w-8 text-slate-400" />
                </div>
                <p className="text-sm font-bold text-slate-600 dark:text-slate-400">No KAM profile loaded.</p>
                <p className="text-xs text-slate-400">Please log in as a Key Account Manager to view this page.</p>
              </div>
            ) : (
            <div className="space-y-6 max-w-4xl mx-auto w-full" data-kam-panel>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Identity card */}
                <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-7 rounded-3xl shadow-sm flex flex-col items-center justify-between text-center min-h-[300px]">
                  <div className="flex flex-col items-center space-y-4 w-full">
                    <div className="h-20 w-20 rounded-full bg-gradient-to-br from-indigo-500 to-[#D528A2] border-4 border-white dark:border-slate-800 text-white flex items-center justify-center text-3xl font-black shadow-lg uppercase">
                      {currentKAM.name.substring(0, 2)}
                    </div>
                    <div>
                      <h2 className="text-lg font-extrabold text-slate-800 dark:text-white leading-tight">{currentKAM.name}</h2>
                      <p className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold uppercase tracking-wider mt-1">Key Account Manager</p>
                      {currentKAM.title && currentKAM.title !== "Key Account Manager" && (
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">{currentKAM.title}</p>
                      )}
                    </div>
                  </div>
                  <div className="w-full border-t border-slate-100 dark:border-white/10 pt-4 mt-4 text-left space-y-2 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                    <div className="flex justify-between gap-2"><span>Manager ID</span><span className="text-slate-800 dark:text-white font-mono text-right truncate max-w-[150px]">{currentKAM.id}</span></div>
                    <div className="flex justify-between gap-2"><span>Email</span><span className="text-slate-800 dark:text-white truncate max-w-[150px] text-right">{currentKAM.email}</span></div>
                    <div className="flex justify-between gap-2"><span>Portfolio</span><span className="text-indigo-600 dark:text-indigo-400 font-bold">{activeColleges.length} campus{activeColleges.length !== 1 ? "es" : ""}</span></div>
                  </div>
                </div>

                {/* Jurisdiction card */}
                <div className="md:col-span-2 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-7 rounded-3xl shadow-sm space-y-6 flex flex-col justify-between">
                  <div>
                    <h3 className="text-xs font-black text-indigo-600 dark:text-indigo-300 uppercase tracking-widest mb-4">Operations & Jurisdiction</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                      {[
                        { label: "Role Type", main: "Key Account Manager", sub: "Regional Operations Coordinator" },
                        { label: "Scope of Authority", main: "Multi-Campus Portfolios", sub: "Aided & Self-Financed Campuses" },
                        { label: "Campus Allocations", main: `${activeColleges.length} Campuses`, sub: "FPC Regional Portfolio" },
                        { label: "Security Level", main: "Level 3 Regional Head", sub: "Policy Oversight & Audits" },
                      ].map(item => (
                        <div key={item.label} className="space-y-0.5">
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider block">{item.label}</span>
                          <span className="text-sm font-extrabold text-slate-800 dark:text-white block">{item.main}</span>
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 block">{item.sub}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="bg-indigo-50/50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 p-4 rounded-2xl flex items-center gap-3">
                    <Compass className="h-5 w-5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                    <div className="text-[11px] text-indigo-700 dark:text-indigo-200 font-semibold leading-normal">
                      Your KAM authority covers regional resource planning, campus-level SLA verification, escalations audit, and overall academic policy enforcement.
                    </div>
                  </div>
                </div>
              </div>

              {/* Portfolio metrics — all scoped to this KAM's portfolio */}
              <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-7 rounded-3xl shadow-sm space-y-5">
                <h3 className="text-xs font-black text-indigo-600 dark:text-indigo-300 uppercase tracking-widest">Regional Network Metrics</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                  {[
                    { label: "Colleges", value: activeColleges.length, sub: "in portfolio", bg: "bg-indigo-50 dark:bg-indigo-500/10", border: "border-indigo-100 dark:border-indigo-500/20", text: "text-indigo-600 dark:text-indigo-400" },
                    { label: "Faculty", value: totalMentors, sub: "managed mentors", bg: "bg-purple-50 dark:bg-purple-500/10", border: "border-purple-100 dark:border-purple-500/20", text: "text-purple-600 dark:text-purple-400" },
                    { label: "Students", value: totalStudents, sub: "across campuses", bg: "bg-emerald-50 dark:bg-emerald-500/10", border: "border-emerald-100 dark:border-emerald-500/20", text: "text-emerald-600 dark:text-emerald-400" },
                    { label: "Total Slots", value: totalSlots, sub: "timetable entries", bg: "bg-amber-50 dark:bg-amber-500/10", border: "border-amber-100 dark:border-amber-500/20", text: "text-amber-600 dark:text-amber-400" },
                    { label: "Escalations", value: totalOpenIssues, sub: "open issues", bg: totalOpenIssues > 0 ? "bg-rose-50 dark:bg-rose-500/10" : "bg-emerald-50 dark:bg-emerald-500/10", border: totalOpenIssues > 0 ? "border-rose-100 dark:border-rose-500/20" : "border-emerald-100 dark:border-emerald-500/20", text: totalOpenIssues > 0 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400" },
                    { label: "Pending Tasks", value: totalPendingTasks, sub: "awaiting CMs", bg: totalPendingTasks > 0 ? "bg-amber-50 dark:bg-amber-500/10" : "bg-emerald-50 dark:bg-emerald-500/10", border: totalPendingTasks > 0 ? "border-amber-100 dark:border-amber-500/20" : "border-emerald-100 dark:border-emerald-500/20", text: totalPendingTasks > 0 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400" },
                    { label: "Pending Requests", value: totalPendingRequests, sub: "handover queue", bg: totalPendingRequests > 0 ? "bg-amber-50 dark:bg-amber-500/10" : "bg-emerald-50 dark:bg-emerald-500/10", border: totalPendingRequests > 0 ? "border-amber-100 dark:border-amber-500/20" : "border-emerald-100 dark:border-emerald-500/20", text: totalPendingRequests > 0 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400" },
                    { label: "Subjects Mapped", value: subjectsList.filter(s => activeColleges.some(c => c.id === s.college_id)).length, sub: "curriculum entries", bg: "bg-teal-50 dark:bg-teal-500/10", border: "border-teal-100 dark:border-teal-500/20", text: "text-teal-600 dark:text-teal-400" },
                  ].map(m => (
                    <div key={m.label} className={`p-4 ${m.bg} rounded-2xl border ${m.border}`}>
                      <span className={`text-2xl font-extrabold ${m.text} block`}>{m.value}</span>
                      <span className="text-[9px] text-slate-500 dark:text-slate-400 font-extrabold uppercase tracking-wider block mt-0.5">{m.label}</span>
                      <span className="text-[8px] text-slate-400 block">{m.sub}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}

          {/* ══ TAB: INTERVIEW MODULE ══ */}
          {activeTab === "interviews" && (
            <div className="space-y-6 animate-fadeIn">
              <InterviewModule currentUserRole="kam" currentUserName={currentKAM?.name || "Key Account Manager"} />
            </div>
          )}
        </div>
      </main>

      {/* ── Set Day Order Modal ── */}
      {selectedDayConfigCollege && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-4 animate-scaleUp">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-black text-slate-800 dark:text-white">Set Day Order & Status</h3>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold">{selectedDayConfigCollege.name}</p>
              </div>
              <button onClick={() => setSelectedDayConfigCollege(null)} className="text-slate-400 hover:text-slate-600 text-lg font-bold cursor-pointer">✕</button>
            </div>

            <form onSubmit={handleSaveDayConfig} className="space-y-4 text-xs font-semibold">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">From Date</label>
                  <input type="date" value={dayStartDate} onChange={e => {
                    setDayStartDate(e.target.value);
                    if (e.target.value > dayEndDate) setDayEndDate(e.target.value);
                  }} className="w-full p-2.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-xs font-bold" required />
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">To Date</label>
                  <input type="date" value={dayEndDate} min={dayStartDate} onChange={e => setDayEndDate(e.target.value)} className="w-full p-2.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-xs font-bold" required />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Day Type</label>
                  <select value={dayOrderType} onChange={e => {
                    setDayOrderType(e.target.value);
                    if (e.target.value === "holiday") setDayOrderVal("None");
                    else if (dayOrderVal === "None") setDayOrderVal("Day 1");
                  }} className="w-full p-2.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-xs font-bold">
                    <option value="regular">Working Day</option>
                    <option value="holiday">Holiday</option>
                    <option value="event">Event</option>
                    <option value="exam_day">Exam Day</option>
                    <option value="special">Special Day</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Day Order</label>
                  <select value={dayOrderVal} onChange={e => setDayOrderVal(e.target.value)} disabled={dayOrderType === "holiday"} className="w-full p-2.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-xs font-bold disabled:opacity-50">
                    <option value="Day 1">Day 1</option>
                    <option value="Day 2">Day 2</option>
                    <option value="Day 3">Day 3</option>
                    <option value="Day 4">Day 4</option>
                    <option value="Day 5">Day 5</option>
                    <option value="None">None</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Session Mode</label>
                <select value={daySessionMode} onChange={e => setDaySessionMode(e.target.value)} disabled={dayOrderType === "holiday"} className="w-full p-2.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-xs font-bold disabled:opacity-50">
                  <option value="Offline">Offline</option>
                  <option value="Online">Online</option>
                  <option value="Hybrid">Hybrid</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Reason / Operational Notes</label>
                <textarea value={dayNotes} onChange={e => setDayNotes(e.target.value)} placeholder="Optional context for faculty and students..." className="w-full p-2.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-xs font-semibold h-20" />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button type="button" onClick={() => setSelectedDayConfigCollege(null)} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs cursor-pointer">Cancel</button>
                <button type="submit" disabled={savingDayConfig} className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs flex items-center gap-1 shadow-md cursor-pointer">
                  {savingDayConfig ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Configuration"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Broadcast Announcement Modal ── */}
      {showAnnouncementModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-4 animate-scaleUp">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-black text-slate-800 dark:text-white">Broadcast Announcement</h3>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold">Publish to faculty or students across your portfolio</p>
              </div>
              <button onClick={() => setShowAnnouncementModal(false)} className="text-slate-400 hover:text-slate-600 text-lg font-bold cursor-pointer">✕</button>
            </div>

            <form onSubmit={handlePostAnnouncement} className="space-y-4 text-xs font-semibold">
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Announcement Title</label>
                <input type="text" value={annTitle} onChange={e => setAnnTitle(e.target.value)} placeholder="e.g. Schedule Revision for Upcoming Midterms" className="w-full p-2.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-xs font-bold" required />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Target Role</label>
                  <select value={annTargetRole} onChange={e => setAnnTargetRole(e.target.value)} className="w-full p-2.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-xs font-bold">
                    <option value="all">All Roles (Faculty & Students)</option>
                    <option value="mentor">Faculty / Mentors Only</option>
                    <option value="student">Students Only</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Target Campus</label>
                  <select value={annCollegeId} onChange={e => setAnnCollegeId(e.target.value)} className="w-full p-2.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-xs font-bold">
                    <option value="">All Campuses in Portfolio</option>
                    {activeColleges.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Announcement Details</label>
                <textarea value={annDesc} onChange={e => setAnnDesc(e.target.value)} placeholder="Provide complete details..." className="w-full p-2.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-xs font-semibold h-24" />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowAnnouncementModal(false)} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs cursor-pointer">Cancel</button>
                <button type="submit" disabled={postingAnn} className="px-5 py-2 bg-gradient-to-r from-indigo-500 to-[#D528A2] text-white font-bold rounded-xl text-xs flex items-center gap-1 shadow-md cursor-pointer">
                  {postingAnn ? <Loader2 className="h-4 w-4 animate-spin" /> : "Publish Announcement"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
