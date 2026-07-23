"use client";

import React, { useState, useEffect, useRef } from "react";
import { useApp } from "../context/AppContext";
import { useToast } from "../context/ToastContext";
import { gsap } from "gsap";
import {
  Building2, Users, ClipboardList, ShieldAlert, CheckCircle2,
  PlusCircle, Trash2, RefreshCw, Plus, Compass, ChevronsLeft, ChevronsRight, User,
  ArrowRightLeft, TrendingUp, Scale, Clock, XCircle, ChevronRight, Settings,
  GraduationCap, BookOpen, Eye, AlertTriangle, CheckCircle, X, Calendar,
  ChevronDown, ChevronUp, Search, UserCheck, UserX, Activity, Layers
} from "lucide-react";
import { Button } from "./Button";
import { Card } from "./Card";
import { Panel } from "./Panel";
import { Input } from "./Input";
import { Select } from "./Select";

// Persistent global flag to prevent sidebar animating on every re-mount
let isFirstSidebarAnimationDone = false;

export interface KAMDashboardProps {
  activeTab?: "overview" | "cam_reports" | "colleges" | "tasks" | "escalations" | "swap_tracker" | "profile";
  onTabChange?: (tab: "overview" | "cam_reports" | "colleges" | "tasks" | "escalations" | "swap_tracker" | "profile") => void;
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
}

const CAMCollegeCard: React.FC<CAMCollegeCardProps> = ({
  cam, college, mentors, students, slots, requests, approvedHandovers, escalations, tasks
}) => {
  const [expanded, setExpanded] = useState(false);
  const [activeSection, setActiveSection] = useState<"mentors" | "students" | "handovers" | "requests" | "issues">("mentors");
  const [search, setSearch] = useState("");

  const pendingRequests = requests.filter(r => r.status === "pending" || r.status === "pending_cam");
  const openIssues = escalations.filter(e => e.status === "pending" || e.status === "open");
  const pendingTasks = tasks.filter(t => t.collegeId === college?.id && t.status === "pending");

  const filteredMentors = mentors.filter(m =>
    !search || m.name.toLowerCase().includes(search.toLowerCase()) || (m.department || "").toLowerCase().includes(search.toLowerCase())
  );
  const filteredStudents = students.filter(s =>
    !search || s.name.toLowerCase().includes(search.toLowerCase()) || (s.classGroup || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm overflow-hidden transition-all">
      {/* Card Header */}
      <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-4">
          <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-[#D528A2] flex items-center justify-center text-white font-black text-lg shadow-md shrink-0">
            {(cam?.name || "C").substring(0, 1)}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-black text-slate-800 dark:text-white">{cam?.name || "Campus Manager"}</h3>
              <span className="px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-500/20 border border-indigo-100 dark:border-indigo-500/30 text-indigo-700 dark:text-indigo-300 text-[9px] font-black uppercase tracking-wider">CM</span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-0.5">{cam?.email}</p>
            <p className="text-[11px] font-bold text-slate-700 dark:text-slate-300 mt-0.5">
              <Building2 className="inline h-3 w-3 mr-1 text-indigo-500" />
              {college?.name || "Unassigned College"}
              {college?.address ? ` · ${college.address}` : ""}
            </p>
          </div>
        </div>

        {/* KPI Badges */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <span className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[10px] font-bold text-slate-700 dark:text-slate-300">
            <Users className="h-3 w-3 text-indigo-500" />{mentors.length} Faculty
          </span>
          <span className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[10px] font-bold text-slate-700 dark:text-slate-300">
            <GraduationCap className="h-3 w-3 text-emerald-500" />{students.length} Students
          </span>
          <span className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[10px] font-bold text-slate-700 dark:text-slate-300">
            <BookOpen className="h-3 w-3 text-amber-500" />{slots.length} Slots
          </span>
          {pendingRequests.length > 0 && (
            <span className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 text-[10px] font-bold text-amber-700 dark:text-amber-300">
              <Clock className="h-3 w-3" />{pendingRequests.length} Pending
            </span>
          )}
          {openIssues.length > 0 && (
            <span className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-[10px] font-bold text-rose-700 dark:text-rose-300">
              <ShieldAlert className="h-3 w-3" />{openIssues.length} Issues
            </span>
          )}
          <button
            onClick={() => setExpanded(p => !p)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-500/20 border border-indigo-200 dark:border-indigo-500/30 text-indigo-700 dark:text-indigo-300 text-[10px] font-black hover:bg-indigo-100 dark:hover:bg-indigo-500/30 transition-all cursor-pointer"
          >
            <Eye className="h-3 w-3" />
            {expanded ? "Collapse" : "View Details"}
            {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>
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
                        <th className="p-3 text-center">Shift</th>
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
                                  {m.name.substring(0, 2).toUpperCase()}
                                </div>
                                <span className="font-bold text-slate-800 dark:text-white">{m.name}</span>
                              </div>
                            </td>
                            <td className="p-3 text-slate-600 dark:text-slate-400">{m.department || "—"}</td>
                            <td className="p-3 text-slate-500 dark:text-slate-400 font-mono text-[10px]">{m.email}</td>
                            <td className="p-3 text-center">
                              <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-[9px] font-black text-slate-600 dark:text-slate-300 uppercase">
                                {m.shift || "general"}
                              </span>
                            </td>
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
                                {s.name.substring(0, 2).toUpperCase()}
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
    updateCampusIssueStatus
  } = useApp();
  const { toast } = useToast();

  const activeColleges = colleges.filter(c => !currentKAM || c.kam_id === currentKAM.id);

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
  }, [activeColleges]);

  // GSAP tab transition
  useEffect(() => {
    if (typeof window !== "undefined" && containerRef.current) {
      const cards = Array.from(containerRef.current.querySelectorAll(".rounded-3xl, .rounded-2xl, .bg-white")).filter(el => {
        if (el.closest(".floating-sidebar") || el.closest("header") || el.tagName === "ASIDE") return false;
        return !el.parentElement?.closest(".rounded-3xl, .rounded-2xl, .bg-white");
      });
      if (cards.length > 0) {
        gsap.killTweensOf(cards);
        gsap.fromTo(cards, { opacity: 0, y: 15, scale: 0.97 }, { opacity: 1, y: 0, scale: 1, duration: 0.45, stagger: 0.04, ease: "back.out(0.8)" });
      }
    }
  }, [activeTab]);

  // GSAP sidebar mount
  useEffect(() => {
    if (typeof window !== "undefined" && sidebarRef.current && !isFirstSidebarAnimationDone) {
      const btns = sidebarRef.current.querySelectorAll("button");
      if (btns.length > 0) {
        isFirstSidebarAnimationDone = true;
        gsap.fromTo(btns, { opacity: 0, x: -20, scale: 0.9 }, { opacity: 1, x: 0, scale: 1, duration: 0.55, stagger: 0.05, ease: "back.out(1.3)", delay: 0.05 });
      }
    }
  }, []);

  // CAM reports state — must be at component level (Rules of Hooks)
  const [camDataMap, setCamDataMap] = useState<Record<string, any>>({});
  const [loadingCams, setLoadingCams] = useState(false);

  useEffect(() => {
    if (!currentKAM?.id || activeColleges.length === 0) return;
    setLoadingCams(true);
    fetch(`/api/kam?id=${encodeURIComponent(currentKAM.id)}`)
      .then(r => r.json())
      .then(data => {
        if (data.success && data.campusManagers) {
          const map: Record<string, any> = {};
          data.campusManagers.forEach((cam: any) => { map[cam.college_id] = cam; });
          setCamDataMap(map);
        }
      })
      .catch(() => {})
      .finally(() => setLoadingCams(false));
  }, [currentKAM?.id, activeColleges.length]);

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim() || !taskDueDate) return;
    const res = await saveKamTask({ title: taskTitle, collegeId: taskCollegeId, priority: taskPriority, status: "pending", dueDate: taskDueDate });
    if (res.success) { setTaskTitle(""); setTaskDueDate(""); toast("Task assigned successfully.", "success"); }
    else toast(res.message || "Failed to create task", "error");
  };

  const handleDeleteTask = async (id: string) => {
    const res = await deleteKamTask(id);
    if (res.success) toast("Task deleted.", "success");
    else toast(res.message || "Failed to delete task", "error");
  };

  const handleResolveEscalation = async (id: string) => {
    const res = await updateCampusIssueStatus(id, "resolved", new Date().toLocaleDateString());
    if (res.success) toast("Issue resolved.", "success");
    else toast(res.message || "Failed to resolve", "error");
  };

  // ── Sidebar nav groups ──────────────────────────────────────────────────
  const getNotificationCount = (tabId: string) => {
    if (tabId === "tasks") return tasks.filter(t => t.status === "pending").length;
    if (tabId === "escalations") return escalations.filter(e => e.status === "pending").length;
    if (tabId === "cam_reports") return escalations.filter(e => e.status === "pending").length + requests.filter(r => r.status === "pending_cam").length;
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

  // ── Portfolio-wide computed stats ────────────────────────────────────────
  const portfolioMentorIds = new Set(mentors.filter(m => activeColleges.some(c => c.id === m.college_id)).map(m => m.id));
  const portfolioStudentIds = new Set(students.filter(s => activeColleges.some(c => c.id === s.college_id)).map(s => s.id));
  const totalMentors = portfolioMentorIds.size;
  const totalStudents = portfolioStudentIds.size;
  const totalSlots = slots.filter(s => portfolioMentorIds.has(s.mentorId)).length;
  const totalPendingRequests = requests.filter(r => (r.status === "pending" || r.status === "pending_cam") && portfolioMentorIds.has(r.requestorId)).length;
  const totalOpenIssues = escalations.filter(e => e.status === "pending" || e.status === "open").length;
  const totalPendingTasks = tasks.filter(t => t.status === "pending").length;

  // Build CAMs list for this KAM
  const kamCamList = activeColleges.map(college => {
    const cam = ([] as any[]).concat(
      // We look for campus managers from context — they're in the /api/data response shape via admin
      // We derive from colleges and mentors' headerId if available, else just show college-level
    );
    return { college };
  });

  return (
    <div className="flex-1 flex flex-col md:flex-row bg-warm-canvas text-slate-805 font-sans h-full overflow-hidden dark:bg-gradient-to-br dark:from-slate-900 dark:via-slate-950 dark:to-indigo-950 dark:text-slate-100">

      {/* ── Sidebar ── */}
      <aside ref={sidebarRef} className={`hidden md:flex shrink-0 flex-col justify-between sticky top-6 z-30 floating-sidebar transition-all duration-300 ${isCollapsed ? "w-20 p-3" : "w-72 p-6"}`}>
        <div className="flex flex-col flex-1 overflow-visible">
          {/* Sidebar Header */}
          {!isCollapsed && (
            <div className="mb-6 pb-4 border-b border-slate-200/60 dark:border-slate-800">
              <h2 className="text-lg font-black text-slate-800 dark:text-white">KAM Portal</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Portfolio Management</p>
            </div>
          )}

          <nav className={`flex-1 space-y-4 ${isCollapsed ? "px-1" : "px-2"}`}>
            {sidebarGroups.map(group => {
              const Icon = group.icon;
              const isAnyChildActive = group.items.some(item => activeTab === item.id);
              const totalPending = group.items.reduce((sum, item) => sum + getNotificationCount(item.id), 0);
              
              return (
                <div key={group.id} className="space-y-1">
                  {/* Group Header - Only show in expanded mode */}
                  {!isCollapsed && (
                    <div className="flex items-center justify-between px-3 py-2">
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                        <span className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          {group.title}
                        </span>
                      </div>
                      {totalPending > 0 && (
                        <span className="bg-rose-500 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full">
                          {totalPending}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Group Items */}
                  <div className="space-y-1">
                    {group.items.map(item => {
                      const ItemIcon = item.icon;
                      const isActive = activeTab === item.id;
                      const count = getNotificationCount(item.id);
                      
                      return (
                        <button
                          key={item.id}
                          onClick={() => setActiveTab(item.id as any)}
                          className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 cursor-pointer group ${
                            isActive 
                              ? "bg-gradient-to-r from-indigo-500 to-[#D528A2] text-white shadow-lg shadow-indigo-500/25" 
                              : "text-slate-600 hover:text-slate-800 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800/60"
                          } ${isCollapsed ? "justify-center" : "justify-start"}`}
                          title={isCollapsed ? item.label : undefined}
                        >
                          <ItemIcon className={`h-5 w-5 shrink-0 transition-transform group-hover:scale-110 ${
                            isActive ? "text-white" : "text-slate-500 dark:text-slate-400"
                          }`} />
                          
                          {!isCollapsed && (
                            <>
                              <span className="flex-1 text-left text-sm font-bold truncate">
                                {item.label}
                              </span>
                              {count > 0 && (
                                <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full transition-all ${
                                  isActive 
                                    ? "bg-white/20 text-white" 
                                    : "bg-rose-500 text-white"
                                }`}>
                                  {count}
                                </span>
                              )}
                            </>
                          )}
                          
                          {isCollapsed && count > 0 && (
                            <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[8px] font-bold h-4 w-4 rounded-full flex items-center justify-center">
                              {count}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Footer */}
        <div className="border-t border-slate-200/60 dark:border-slate-800 pt-4 shrink-0">
          {!isCollapsed && (
            <div className="px-3 py-2 mb-3 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-500/10 dark:to-purple-500/10 rounded-xl border border-indigo-100 dark:border-indigo-500/20">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-full bg-gradient-to-r from-indigo-500 to-[#D528A2] flex items-center justify-center text-white text-xs font-bold">
                  {currentKAM?.name?.substring(0, 2).toUpperCase() || "KM"}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-slate-800 dark:text-white truncate">
                    {currentKAM?.name || "KAM User"}
                  </p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                    {activeColleges.length} campus{activeColleges.length !== 1 ? "es" : ""}
                  </p>
                </div>
              </div>
            </div>
          )}
          
          <div className="flex justify-center">
            <button
              type="button"
              onClick={() => setIsCollapsed(prev => { 
                const next = !prev; 
                localStorage.setItem("fp_sidebar_collapsed", String(next)); 
                return next; 
              })}
              className="h-10 w-10 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center text-slate-500 hover:text-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 shadow-sm transition-all cursor-pointer group"
              title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
            >
              {isCollapsed ? (
                <ChevronsRight className="h-4 w-4 group-hover:scale-110 transition-transform" />
              ) : (
                <ChevronsLeft className="h-4 w-4 group-hover:scale-110 transition-transform" />
              )}
            </button>
          </div>
        </div>
      </aside>

      {/* ── Mobile Bottom Nav ── */}
      <nav className="flex md:hidden fixed bottom-0 inset-x-0 z-50 mobile-bottom-nav">
        <div className="flex w-full justify-around items-center py-2 px-1">
          {[
            { id: "overview", label: "Overview", icon: Activity },
            { id: "cam_reports", label: "CMs", icon: Layers },
            { id: "tasks", label: "Tasks", icon: ClipboardList },
            { id: "escalations", label: "Issues", icon: ShieldAlert },
            { id: "profile", label: "Profile", icon: User },
          ].map(t => {
            const Icon = t.icon;
            const isActive = activeTab === t.id;
            const count = getNotificationCount(t.id);
            return (
              <button key={t.id} onClick={() => setActiveTab(t.id as any)}
                className={`relative flex flex-col items-center justify-center gap-0.5 flex-1 py-1.5 rounded-xl transition-all cursor-pointer ${isActive ? "text-indigo-600" : "text-slate-400"}`}>
                <div className="relative">
                  <Icon className={`h-5 w-5 transition-transform ${isActive ? "scale-110" : ""}`} />
                  {count > 0 && <span className="absolute -top-1.5 -right-1.5 h-3.5 w-3.5 bg-rose-500 text-white text-[8px] font-bold rounded-full flex items-center justify-center">{count}</span>}
                </div>
                <span className={`text-[9px] font-semibold tracking-wide leading-none ${isActive ? "text-indigo-600" : "text-slate-400"}`}>{t.label}</span>
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
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-850 rounded-3xl p-5 md:p-8 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-500/20 text-indigo-650 dark:text-indigo-300 text-[10px] font-black uppercase tracking-widest border border-indigo-100 dark:border-indigo-500/30">
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
            <Button variant="primary" size="md" icon={<RefreshCw className="h-4 w-4 hover-spin-icon" />}
              onClick={() => { refreshData(); toast("Data synced.", "info"); }} className="shrink-0 self-start sm:self-center">
              Refresh Data
            </Button>
          </div>

          {/* ══ TAB: OVERVIEW ══ */}
          {activeTab === "overview" && (
            <div className="space-y-6">
              {/* KPI Row */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                {[
                  { label: "Campuses", value: activeColleges.length, icon: Building2, color: "indigo" },
                  { label: "Faculty", value: totalMentors, icon: Users, color: "purple" },
                  { label: "Students", value: totalStudents, icon: GraduationCap, color: "emerald" },
                  { label: "Total Slots", value: totalSlots, icon: BookOpen, color: "amber" },
                  { label: "Pending Requests", value: totalPendingRequests, icon: Clock, color: totalPendingRequests > 0 ? "rose" : "emerald" },
                  { label: "Open Issues", value: totalOpenIssues, icon: ShieldAlert, color: totalOpenIssues > 0 ? "rose" : "emerald" },
                ].map(kpi => {
                  const Icon = kpi.icon;
                  return (
                    <div key={kpi.label} className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-4 flex flex-col gap-2 shadow-sm">
                      <div className={`h-8 w-8 rounded-xl flex items-center justify-center bg-${kpi.color}-50 dark:bg-${kpi.color}-500/10 border border-${kpi.color}-100 dark:border-${kpi.color}-500/20`}>
                        <Icon className={`h-4 w-4 text-${kpi.color}-600 dark:text-${kpi.color}-400`} />
                      </div>
                      <div>
                        <div className="text-2xl font-black text-slate-800 dark:text-white">{kpi.value}</div>
                        <div className="text-[9px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mt-0.5">{kpi.label}</div>
                      </div>
                    </div>
                  );
                })}
              </div>

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
                            { label: "Faculty", value: collegeMentors.length, color: "indigo" },
                            { label: "Students", value: collegeStudents.length, color: "emerald" },
                            { label: "Slots", value: collegeSlots.length, color: "amber" },
                            { label: "Tasks", value: collegeTasks.length, color: collegeTasks.length > 0 ? "rose" : "slate" },
                          ].map(stat => (
                            <div key={stat.label} className="bg-white dark:bg-slate-950 p-2.5 rounded-xl border border-slate-100 dark:border-slate-850">
                              <div className={`text-sm font-black text-${stat.color}-600 dark:text-${stat.color}-400`}>{stat.value}</div>
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

                {loadingCams && (
                  <div className="text-center py-8 text-xs text-slate-400">Loading CAM data…</div>
                )}

                {/* CAM Cards */}
                <div className="space-y-4">
                  {activeColleges.map(college => {
                    const cam = camDataMap[college.id];
                    const collegeMentors = mentors.filter(m => m.college_id === college.id);
                    const collegeStudents = students.filter(s => s.college_id === college.id);
                    const collegeMentorIds = new Set(collegeMentors.map(m => m.id));
                    const collegeSlots = slots.filter(s => collegeMentorIds.has(s.mentorId));
                    const collegeRequests = requests.filter(r => collegeMentorIds.has(r.requestorId) || collegeMentorIds.has(r.targetStaffId));
                    const collegeHandovers = approvedHandovers.filter(h => collegeMentorIds.has(h.originalMentorId) || collegeMentorIds.has(h.coverStaffId));
                    const collegeIssues = escalations.filter(e => e.collegeId === college.id);
                    const collegeTasks = tasks.filter(t => t.collegeId === college.id);

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
                      />
                    );
                  })}
                  {activeColleges.length === 0 && (
                    <div className="text-center py-16 text-sm text-slate-400 italic border border-dashed border-slate-200 dark:border-slate-700 rounded-3xl">
                      No colleges assigned to your KAM portfolio yet.
                    </div>
                  )}
                </div>
              </div>
            )}

          {/* ══ TAB: CAMPUS DIRECTORY ══ */}
          {activeTab === "colleges" && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                <Card label="Colleges Managed" value={`${activeColleges.length} Campuses`} icon={<Building2 className="h-5 w-5" />} success={true} className="bg-pastel-blue" />
                <Card label="Open Escalations" value={`${escalations.filter(e => e.status === "pending").length} Alerts`} icon={<ShieldAlert className="h-5 w-5 animate-pulse" />} success={escalations.filter(e => e.status === "pending").length === 0} className="bg-pastel-cream" />
                <Card label="Tasks Dispatched" value={`${tasks.length} Assigned`} icon={<ClipboardList className="h-5 w-5" />} success={true} className="bg-pastel-purple" />
              </div>
              <Panel title="Assigned Portfolio Colleges" subtitle="All colleges currently linked to your KAM assignment">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-semibold">
                  {activeColleges.map(c => {
                    const mentorsCount = mentors.filter(m => m.college_id === c.id).length;
                    const studentsCount = students.filter(s => s.college_id === c.id).length;
                    const slotsCount = slots.filter(s => mentors.find(m => m.id === s.mentorId)?.college_id === c.id).length;
                    return (
                      <div key={c.id} className="p-4 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/60 flex flex-col gap-4 hover:border-indigo-200 dark:hover:border-indigo-500/30 transition-all">
                        <div>
                          <h4 className="text-xs font-black text-slate-800 dark:text-white">{c.name}</h4>
                          <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">{c.address || "—"}</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-center text-[10px] font-bold">
                          <div className="bg-white dark:bg-slate-950 p-2 rounded-xl border border-slate-100 dark:border-slate-850">
                            <span className="text-slate-500 dark:text-slate-455 block">Students</span>
                            <span className="text-xs font-black text-slate-855 dark:text-white block mt-0.5">{studentsCount}</span>
                          </div>
                          <div className="bg-white dark:bg-slate-950 p-2 rounded-xl border border-slate-100 dark:border-slate-850">
                            <span className="text-slate-500 dark:text-slate-455 block">Faculty</span>
                            <span className="text-xs font-black text-slate-855 dark:text-white block mt-0.5">{mentorsCount}</span>
                          </div>
                          <div className="bg-white dark:bg-slate-950 p-2 rounded-xl border border-slate-100 dark:border-slate-850">
                            <span className="text-slate-500 dark:text-slate-455 block">Schedules</span>
                            <span className="text-xs font-black text-indigo-650 dark:text-indigo-300 block mt-0.5">{slotsCount} slots</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Panel>
            </div>
          )}

          {/* ══ TAB: ASSIGN TASK ══ */}
          {activeTab === "tasks" && (
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
                  <Button type="submit" variant="gradient" size="md" icon={<PlusCircle className="h-4.5 w-4.5" />} className="w-full mt-2">Assign Task</Button>
                </form>
              </Panel>
              <Panel title="Task Logs" subtitle="Review status of active assignments">
                <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                  {tasks.map(t => {
                    const college = colleges.find(c => c.id === t.collegeId);
                    return (
                      <div key={t.id} className="p-3.5 rounded-xl border border-slate-105 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/60 flex items-center justify-between gap-4 hover:border-indigo-500/25 transition-all">
                        <div className="space-y-1 text-[11px] font-semibold">
                          <div className="flex items-center gap-1.5 text-[9px] uppercase font-black">
                            <span className={`px-1.5 py-0.5 rounded ${t.priority === "high" ? "bg-red-500/10 text-red-650 dark:text-red-400 border border-red-550/20" : "bg-amber-500/10 text-amber-600 dark:text-amber-300 border border-amber-550/20"}`}>{t.priority}</span>
                            <span className="text-slate-505 dark:text-slate-450">{college ? college.name : "Campus"}</span>
                          </div>
                          <h4 className="text-xs font-bold text-slate-800 dark:text-white">{t.title}</h4>
                          <p className="text-[10px] text-slate-505 dark:text-slate-400">Due: <strong>{t.dueDate || "—"}</strong> · Status: <strong className={t.status === "completed" ? "text-emerald-650 dark:text-emerald-450" : "text-amber-600 dark:text-amber-400"}>{t.status}</strong></p>
                        </div>
                        <button onClick={() => handleDeleteTask(t.id)} className="p-1.5 text-red-550 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    );
                  })}
                  {tasks.length === 0 && <p className="text-xs text-slate-500 italic text-center py-6">No tasks assigned.</p>}
                </div>
              </Panel>
            </div>
          )}

          {/* ══ TAB: ESCALATED ISSUES ══ */}
          {activeTab === "escalations" && (
            <div className="max-w-3xl mx-auto w-full">
              <Panel title="Escalated Campus Issues" subtitle="Review and resolve items forwarded by CMs">
                <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
                  {escalations.map(esc => (
                    <div key={esc.id} className="p-3.5 rounded-xl border border-slate-105 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/60 flex flex-col gap-3 hover:border-indigo-500/20 transition-all">
                      <div className="space-y-1">
                        <div className="flex justify-between items-center text-[9px] uppercase font-black">
                          <span className="text-indigo-650 dark:text-indigo-455 font-bold">{esc.collegeName}</span>
                          <span className="text-slate-500 dark:text-slate-450 font-semibold">{esc.escalatedAt || esc.created_at?.slice(0, 10) || "Today"}</span>
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
                        <Button variant="secondary" size="xs" onClick={() => handleResolveEscalation(esc.id)} className="w-full">Mark Resolved</Button>
                      ) : (
                        <span className="w-full py-1.5 bg-emerald-500/10 text-emerald-650 dark:text-emerald-450 font-black border border-emerald-500/20 text-[10px] rounded text-center block">✓ Resolved</span>
                      )}
                    </div>
                  ))}
                  {escalations.length === 0 && <p className="text-xs text-slate-500 italic text-center py-6">All campuses fully SLA compliant.</p>}
                </div>
              </Panel>
            </div>
          )}

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
                    <Card label="Total Swap Requests" value={allSwapRequests.length} icon={<ArrowRightLeft className="h-4.5 w-4.5 text-indigo-650" />} className="bg-pastel-blue" />
                    <Card label="Pending Resolution" value={pendingSwaps.length} icon={<Clock className="h-4.5 w-4.5 text-amber-600" />} success={pendingSwaps.length === 0} className="bg-pastel-cream" />
                    <Card label="Debts Settled" value={settledSwaps.length} icon={<CheckCircle2 className="h-4.5 w-4.5 text-emerald-600" />} success={true} className="bg-pastel-green" />
                    <Card label="Declined Offers" value={declinedSwaps.length} icon={<XCircle className="h-4.5 w-4.5 text-rose-600" />} success={true} className="bg-pastel-purple" />
                  </div>
                </Panel>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {campusBreakdown.map(cb => (
                    <div key={cb.college.id} className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-855 p-4 rounded-2xl shadow-sm flex flex-col gap-3">
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
                          {allSwapRequests.slice().sort((a, b) => b.timestamp.localeCompare(a.timestamp)).map(req => {
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
                          {ledgerList.map(row => (
                            <tr key={row.mentorId} className={`hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors ${row.balance > 0 && row.swapsPending === 0 ? "bg-rose-50/30 dark:bg-rose-500/5" : ""}`}>
                              <td className="p-3"><div className="font-black text-slate-800 dark:text-white">{row.mentorName}</div><div className="text-[9px] text-slate-400">{row.department}</div></td>
                              <td className="p-3"><span className="px-2 py-0.5 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/30 text-indigo-700 dark:text-indigo-300 text-[8.5px] font-black uppercase">{row.collegeName}</span></td>
                              <td className="p-3 text-center">{row.given > 0 ? <span className="px-2 py-0.5 rounded bg-rose-50 border border-rose-200 text-rose-700 dark:bg-rose-500/10 dark:border-rose-500/30 dark:text-rose-300 font-black">−{row.given}</span> : <span className="text-slate-300">—</span>}</td>
                              <td className="p-3 text-center">{row.received > 0 ? <span className="px-2 py-0.5 rounded bg-teal-50 border border-teal-200 text-teal-700 dark:bg-teal-500/10 dark:border-teal-500/30 dark:text-teal-300 font-black">+{row.received}</span> : <span className="text-slate-300">—</span>}</td>
                              <td className={`p-3 text-center font-black text-sm ${row.balance > 0 ? "text-rose-600 dark:text-rose-400" : row.balance < 0 ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400"}`}>{row.balance > 0 ? `+${row.balance}` : row.balance}</td>
                              <td className="p-3 text-center">{row.swapsPending > 0 ? <span className="px-2 py-0.5 rounded-full bg-amber-100 border border-amber-200 text-amber-800 dark:bg-amber-500/20 dark:border-amber-500/30 dark:text-amber-300 text-[8.5px] font-black">{row.swapsPending} pending</span> : <span className="text-slate-300 text-[9px]">—</span>}</td>
                              <td className="p-3 text-center">{row.swapsSettled > 0 ? <span className="px-2 py-0.5 rounded-full bg-teal-100 border border-teal-200 text-teal-800 dark:bg-teal-500/20 dark:border-teal-500/30 dark:text-teal-300 text-[8.5px] font-black">{row.swapsSettled} settled</span> : <span className="text-slate-300 text-[9px]">—</span>}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </Panel>
                )}
              </div>
            );
          })()}

          {/* ══ TAB: PROFILE ══ */}
          {activeTab === "profile" && currentKAM && (
            <div className="space-y-6 max-w-4xl mx-auto w-full">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-850 p-7 rounded-3xl shadow-sm flex flex-col items-center justify-between text-center min-h-[300px]">
                  <div className="flex flex-col items-center space-y-4 w-full">
                    <div className="h-20 w-20 rounded-full bg-indigo-600 border-4 border-white text-white flex items-center justify-center text-3xl font-black shadow-lg uppercase">
                      {currentKAM.name.substring(0, 2)}
                    </div>
                    <div>
                      <h2 className="text-lg font-extrabold text-slate-800 dark:text-white leading-tight">{currentKAM.name}</h2>
                      <p className="text-[10px] text-indigo-605 dark:text-indigo-400 font-bold uppercase tracking-wider mt-1">Key Account Manager</p>
                    </div>
                  </div>
                  <div className="w-full border-t border-slate-100 dark:border-white/10 pt-4 mt-4 text-left space-y-2 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                    <div className="flex justify-between"><span>Manager ID</span><span className="text-slate-800 dark:text-white font-mono">{currentKAM.id}</span></div>
                    <div className="flex justify-between"><span>Email</span><span className="text-slate-805 dark:text-white truncate max-w-[170px]">{currentKAM.email}</span></div>
                  </div>
                </div>

                <div className="md:col-span-2 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-850 p-7 rounded-3xl shadow-sm space-y-6 flex flex-col justify-between">
                  <div>
                    <h3 className="text-xs font-black text-indigo-600 dark:text-indigo-300 uppercase tracking-widest mb-4">Operations & Jurisdiction</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      <div className="space-y-1"><span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider block">Role Type</span><span className="text-sm font-extrabold text-slate-800 dark:text-white block">Key Account Manager</span><span className="text-[10px] text-slate-500 dark:text-slate-400 block">Regional Operations Coordinator</span></div>
                      <div className="space-y-1"><span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider block">Scope of Authority</span><span className="text-sm font-extrabold text-slate-800 dark:text-white block">Multi-Campus Portfolios</span><span className="text-[10px] text-slate-500 dark:text-slate-400 block">Aided & Self-Financed Campuses</span></div>
                      <div className="space-y-1"><span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider block">Campus Allocations</span><span className="text-sm font-extrabold text-slate-800 dark:text-white block">{activeColleges.length} Campuses</span><span className="text-[10px] text-slate-505 dark:text-slate-400 block">FPC Regional Portfolio</span></div>
                      <div className="space-y-1"><span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider block">Security Level</span><span className="text-sm font-extrabold text-slate-800 dark:text-white block">Level 3 Regional Head</span><span className="text-[10px] text-slate-500 dark:text-slate-400 block">Policy Oversight & Audits</span></div>
                    </div>
                  </div>
                  <div className="bg-indigo-50/30 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 p-4 rounded-2xl flex items-center gap-3">
                    <Compass className="h-5 w-5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                    <div className="text-[11px] text-indigo-700 dark:text-indigo-200 font-semibold leading-normal">
                      Your KAM authority covers regional resource planning, campus-level SLA verification, escalations audit, and overall academic policy enforcement.
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-850 p-7 rounded-3xl shadow-sm space-y-6">
                <h3 className="text-xs font-black text-indigo-600 dark:text-indigo-300 uppercase tracking-widest">Regional Network Metrics</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 text-center text-xs">
                  <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-100 dark:border-slate-850">
                    <span className="text-3xl font-extrabold text-slate-800 dark:text-white">{activeColleges.length}</span>
                    <span className="text-[9px] text-slate-500 dark:text-slate-455 font-extrabold uppercase tracking-wider block mt-1">Colleges</span>
                  </div>
                  <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-100 dark:border-slate-850">
                    <span className="text-3xl font-extrabold text-slate-800 dark:text-white">{totalMentors}</span>
                    <span className="text-[9px] text-slate-500 dark:text-slate-455 font-extrabold uppercase tracking-wider block mt-1">Managed Mentors</span>
                  </div>
                  <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-100 dark:border-slate-850">
                    <span className="text-3xl font-extrabold text-slate-800 dark:text-white">{escalations.length}</span>
                    <span className="text-[9px] text-slate-500 dark:text-slate-455 font-extrabold uppercase tracking-wider block mt-1">Total Escalations</span>
                  </div>
                  <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-100 dark:border-slate-850">
                    <span className="text-3xl font-extrabold text-slate-800 dark:text-white">{tasks.length}</span>
                    <span className="text-[9px] text-slate-500 dark:text-slate-455 font-extrabold uppercase tracking-wider block mt-1">Assigned Tasks</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};
