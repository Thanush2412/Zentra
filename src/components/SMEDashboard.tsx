"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import { useApp } from "@/context/AppContext";
import { useToast } from "@/context/ToastContext";
import { Card } from "@/components/Card";
import { Panel } from "@/components/Panel";
import { Pagination } from "@/components/ui/Pagination";
import {
  Sparkles,
  ClipboardList,
  CheckCircle,
  AlertCircle,
  FileText,
  User,
  Award,
  Calendar,
  RefreshCw,
  Check,
  Search,
  Clock,
  Eye,
  ChevronDown,
  ChevronUp,
  Lock,
  X,
  AlertTriangle,
  Download,
  Target,
  ChevronsLeft,
  ChevronsRight,
  ChevronRight,
  Activity,
  UserCheck
} from "lucide-react";

type TabKey = "overview" | "demo_list" | "availability" | "reallocation" | "history" | "calendar" | "reallocation_hub";

interface SMEDashboardProps {
  activeTab?: TabKey;
  onTabChange?: (tab: TabKey) => void;
}

const EVAL_CRITERIA = [
  { key: "attendance", label: "Attendance", max: 5 },
  { key: "subjectKnowledge", label: "Subject Knowledge", max: 15 },
  { key: "teachingMethodology", label: "Teaching Methodology", max: 15 },
  { key: "communicationSkills", label: "Communication Skills", max: 10 },
  { key: "technicalSkills", label: "Technical Skills", max: 15 },
  { key: "studentInteraction", label: "Student Interaction", max: 10 },
  { key: "classroomManagement", label: "Classroom Management", max: 10 },
  { key: "questionHandling", label: "Question Handling", max: 10 },
  { key: "timeManagement", label: "Time Management", max: 5 },
  { key: "overallRemarks", label: "Overall Remarks", max: 5 },
] as const;

const DEFAULT_SCORES: Record<string, number> = {
  attendance: 4,
  subjectKnowledge: 12,
  teachingMethodology: 12,
  communicationSkills: 8,
  technicalSkills: 12,
  studentInteraction: 8,
  classroomManagement: 8,
  questionHandling: 8,
  timeManagement: 4,
  overallRemarks: 4,
};

export function SMEDashboard({ activeTab: propTab, onTabChange }: SMEDashboardProps = {}) {
  const {
    currentSME,
    smes,
    demoSessions,
    demoRules,
    evaluateDemoSession,
    requestDemoSwap,
    mentors,
    slots,
    holidays,
    leaveRequests,
    weekDates,
    colleges,
    demoSwapRequests,
    resolveDemoSwap,
    refreshData,
    subjectGroups
  } = useApp();

  const { toast } = useToast();

  // Sidebar collapse state
  const sidebarRef = useRef<HTMLElement>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("fp_sidebar_collapsed") === "true";
      setIsCollapsed(stored || false);
    }
  }, []);

  // Tab state
  const [internalTab, setInternalTab] = useState<TabKey>("overview");
  const rawActiveTab: TabKey = propTab || internalTab;

  // Map legacy route keys to the 5 primary SME tabs
  const activeTab: TabKey = useMemo(() => {
    if (rawActiveTab === "calendar") return "availability";
    if (rawActiveTab === "reallocation_hub") return "reallocation";
    return rawActiveTab;
  }, [rawActiveTab]);

  const handleTabChange = (key: TabKey) => {
    if (onTabChange) {
      onTabChange(key);
    } else {
      setInternalTab(key);
    }
    setPage(1);
  };

  // Pagination state for Demo List
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);

  // Pagination state for History List
  const [historyPage, setHistoryPage] = useState<number>(1);
  const [historyPageSize, setHistoryPageSize] = useState<number>(10);

  // Evaluation modal state
  const [evaluationModalSession, setEvaluationModalSession] = useState<any | null>(null);
  const [evalScores, setEvalScores] = useState<Record<string, number>>({ ...DEFAULT_SCORES });
  const [comments, setComments] = useState<string>("");
  const [successMsg, setSuccessMsg] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Read-only View Evaluation modal
  const [viewEvalSession, setViewEvalSession] = useState<any | null>(null);

  // Reallocation Modal state
  const [swapModalSession, setSwapModalSession] = useState<any | null>(null);
  const [swapReason, setSwapReason] = useState<string>("CAM Approved Mentor Leave");
  const [swapRemarks, setSwapRemarks] = useState<string>("");
  const [swapStep, setSwapStep] = useState<number>(1);
  const [selectedProposedMentor, setSelectedProposedMentor] = useState<any | null>(null);
  const [selectedProposedTime, setSelectedProposedTime] = useState<any | null>(null);

  // Demo List Filters
  const [filterCollege, setFilterCollege] = useState<string>("All");
  const [filterSubject, setFilterSubject] = useState<string>("All");
  const [filterStatus, setFilterStatus] = useState<string>("All");
  const [filterGroup, setFilterGroup] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // History search
  const [historySearch, setHistorySearch] = useState<string>("");
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);

  // Calculated total marks
  const marks = useMemo(() => {
    return Object.values(evalScores).reduce((sum, v) => sum + v, 0);
  }, [evalScores]);

  if (!currentSME) {
    return (
      <div className="h-64 flex items-center justify-center text-xs font-bold text-slate-500">
        Loading SME Workspace...
      </div>
    );
  }

  // ── Data Derivations ──────────────────────────────────────────────
  // Filter demos for this SME according to assignment & subject group
  const myDemos = demoSessions.filter(ds => {
    if (ds.smeId === currentSME.id) return true;
    if (currentSME.subject && ds.subject?.toLowerCase().trim() === currentSME.subject.toLowerCase().trim()) return true;
    return false;
  });

  const todayStr = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  const todayDemos = myDemos.filter(ds => ds.dateStr === todayStr);

  const confirmedDemos = myDemos.filter(ds => ds.status === "confirmed" || ds.status === "scheduled");
  const completedDemos = myDemos.filter(ds => ds.status === "completed");
  const affectedLeaveDemos = myDemos.filter(ds => ds.status === "reallocation_required");
  const notConductedDemos = myDemos.filter(ds => ds.status === "not_conducted");
  const pendingSmeDemos = myDemos.filter(ds => ds.status === "pending_sme");

  const totalAssigned = myDemos.length;
  const completedCount = completedDemos.length;
  const confirmedCount = confirmedDemos.length;
  const affectedCount = affectedLeaveDemos.length;
  const notConductedCount = notConductedDemos.length;

  const avgScore = completedCount > 0
    ? Math.round(completedDemos.reduce((sum, d) => sum + (d.marks || 0), 0) / completedCount)
    : 0;

  // Inbound Reallocation Requests targeting this SME
  const pendingInboundRequests = demoSwapRequests?.filter(
    (r: any) => (r.proposedSmeId === currentSME.id || r.smeId === currentSME.id) && (r.status === "pending" || r.status === "pending_sme")
  ) || [];

  // Outbound Reallocation Requests sent by this SME
  const outboundRequests = demoSwapRequests?.filter((r: any) => r.smeId === currentSME.id) || [];

  // Target Rule Derivation for SME's Subject
  const smeSubjectRule = demoRules.find(r => r.subject?.toLowerCase().trim() === (currentSME.subject || "").toLowerCase().trim());
  const weeklyTargetCount = smeSubjectRule?.target || 10;
  const targetProgressPct = Math.min(100, Math.round((completedCount / weeklyTargetCount) * 100));

  // Unique colleges, subjects, and groups for filters
  const uniqueColleges = Array.from(new Set(
    myDemos.map(d => {
      const mentor = mentors.find(m => m.id === d.mentorId);
      return mentor ? colleges.find(c => c.id === mentor.college_id)?.name || "" : "";
    }).filter(Boolean)
  ));
  const uniqueSubjects = Array.from(new Set(myDemos.map(d => d.subject).filter(Boolean)));
  const uniqueGroups = Array.from(new Set(
    myDemos.map(d => {
      const mentor = mentors.find(m => m.id === d.mentorId);
      return mentor?.department || mentor?.mentor_group || d.stream || "";
    }).filter(Boolean)
  ));

  // Notification Counts for 5 Primary SME Sidebar Items
  const sidebarNavItems = [
    { id: "overview", label: "Dashboard", icon: Sparkles, count: 0 },
    { id: "demo_list", label: "My Demos", icon: ClipboardList, count: totalAssigned },
    { id: "availability", label: "Availability", icon: Calendar, count: 0 },
    { id: "reallocation", label: "Reallocation", icon: RefreshCw, count: pendingInboundRequests.length + affectedCount },
    { id: "history", label: "History", icon: FileText, count: completedCount }
  ];

  // ── Filtered demo queue for SME Demo List ───────────────────────────
  const filteredDemos = useMemo(() => {
    return myDemos.filter(d => {
      if (filterStatus !== "All") {
        if (filterStatus === "Confirmed" && d.status !== "confirmed" && d.status !== "scheduled") return false;
        if (filterStatus === "Completed" && d.status !== "completed") return false;
        if (filterStatus === "Reallocation Required" && d.status !== "reallocation_required") return false;
        if (filterStatus === "Pending Approval" && d.status !== "pending_sme" && d.status !== "pending") return false;
        if (filterStatus === "Not Conducted" && d.status !== "not_conducted") return false;
      }
      if (filterSubject !== "All" && d.subject !== filterSubject) return false;
      if (filterGroup !== "All") {
        const mentor = mentors.find(m => m.id === d.mentorId);
        const grp = mentor?.department || mentor?.mentor_group || d.stream || "";
        if (grp !== filterGroup) return false;
      }
      if (filterCollege !== "All") {
        const mentor = mentors.find(m => m.id === d.mentorId);
        const collegeName = mentor ? colleges.find(c => c.id === mentor.college_id)?.name : "";
        if (collegeName !== filterCollege) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchMentor = d.mentorName?.toLowerCase().includes(q);
        const matchSubject = d.subject?.toLowerCase().includes(q);
        const matchStream = d.stream?.toLowerCase().includes(q);
        const matchDate = d.dateStr?.toLowerCase().includes(q);
        if (!matchMentor && !matchSubject && !matchStream && !matchDate) return false;
      }
      return true;
    });
  }, [myDemos, filterStatus, filterSubject, filterGroup, filterCollege, searchQuery, mentors, colleges]);

  const paginatedDemos = useMemo(() => {
    const startIndex = (page - 1) * pageSize;
    return filteredDemos.slice(startIndex, startIndex + pageSize);
  }, [filteredDemos, page, pageSize]);

  // ── History Filtered & Paginated ──────────────────────────────────
  const filteredHistory = useMemo(() => {
    if (!historySearch.trim()) return completedDemos;
    const q = historySearch.toLowerCase();
    return completedDemos.filter(d =>
      d.mentorName?.toLowerCase().includes(q) ||
      d.subject?.toLowerCase().includes(q) ||
      d.dateStr?.toLowerCase().includes(q)
    );
  }, [completedDemos, historySearch]);

  const paginatedHistory = useMemo(() => {
    const startIndex = (historyPage - 1) * historyPageSize;
    return filteredHistory.slice(startIndex, startIndex + historyPageSize);
  }, [filteredHistory, historyPage, historyPageSize]);

  // CSV Export Utility
  const handleExportCSV = () => {
    if (filteredDemos.length === 0) {
      toast("No demos to export.", "error");
      return;
    }
    const headers = ["Mentor Name", "College", "Department", "Subject", "Date", "Time Slot", "Status", "Score", "Comments"];
    const rows = filteredDemos.map(d => [
      `"${d.mentorName || ''}"`,
      `"${getMentorCollege(d.mentorId) || ''}"`,
      `"${getMentorDept(d.mentorId) || ''}"`,
      `"${d.subject || ''}"`,
      `"${d.dateStr || ''}"`,
      `"${d.timeSlot || ''}"`,
      `"${d.status || ''}"`,
      `"${d.marks || ''}"`,
      `"${(d.comments || '').replace(/"/g, '""')}"`
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `SME_Demos_${currentSME.name.replace(/\s+/g, "_")}_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast("SME demo schedule exported to CSV successfully!", "success");
  };

  // ── Handlers ──────────────────────────────────────────────────────
  const handleOpenEvaluate = (session: any) => {
    if (session.status === "completed") {
      setViewEvalSession(session);
      return;
    }
    if (session.status !== "confirmed" && session.status !== "scheduled") {
      toast("Evaluation is only allowed for confirmed demo sessions.", "warning");
      return;
    }
    setEvaluationModalSession(session);
    setEvalScores({ ...DEFAULT_SCORES });
    setComments("");
    setSuccessMsg("");
    setErrorMsg("");
  };

  const handleOpenSwapModal = (session: any) => {
    setSwapModalSession(session);
    setSwapReason(session.status === "reallocation_required" ? "CAM Approved Mentor Leave" : "SME Unavailable");
    setSwapRemarks("");
    setSwapStep(1);
    setSelectedProposedMentor(null);
    setSelectedProposedTime(null);
    setErrorMsg("");
    setSuccessMsg("");
  };

  const updateScore = (key: string, value: number, max: number) => {
    setEvalScores(prev => ({
      ...prev,
      [key]: Math.min(max, Math.max(0, value))
    }));
  };

  // Free-Time Checker for Reallocation Modal (Availability-Driven)
  const getSwapRecommendations = (session: any) => {
    if (!session) return { mentorSwaps: [], timeSwaps: [] };

    const subjectGroup = session.subject;
    const currentWeekDates = weekDates.map(w => w.dateStr);

    const uniqueSlots = new Set<string>();
    slots.forEach(s => { if (s.time) uniqueSlots.add(s.time.trim()); });

    const parseTimeToMinutes = (t: string) => {
      const match = t.match(/^(\d+)(?:\.(\d+))?\s*(AM|PM)/i);
      if (!match) return 9999;
      let hr = parseInt(match[1]);
      const min = match[2] ? parseInt(match[2]) : 0;
      const isPm = match[3].toUpperCase() === "PM";
      if (isPm && hr < 12) hr += 12;
      if (!isPm && hr === 12) hr = 0;
      return hr * 60 + min;
    };
    const derivedTimeSlots = Array.from(uniqueSlots).sort((a, b) => parseTimeToMinutes(a) - parseTimeToMinutes(b));

    const timeSwaps: any[] = [];
    currentWeekDates.forEach(dateStr => {
      const isHoliday = holidays.some(h => h.date === dateStr);
      if (isHoliday) return;
      derivedTimeSlots.forEach(timeSlot => {
        if (timeSlot.toLowerCase().includes("lunch") || timeSlot.toLowerCase().includes("break")) return;
        if (dateStr === session.dateStr && timeSlot === session.timeSlot) return;
        const isMentorOnLeave = leaveRequests?.some((l: any) => l.mentorId === session.mentorId && l.dateStr === dateStr && l.status === "approved");
        if (isMentorOnLeave) return;
        const dayName = weekDates.find(w => w.dateStr === dateStr)?.day || "";
        const hasMentorClass = slots.some(s => s.mentorId === session.mentorId && s.day === dayName && s.time === timeSlot);
        if (hasMentorClass) return;
        const isSmeBusy = demoSessions.some(ds => ds.smeId === currentSME.id && ds.dateStr === dateStr && ds.timeSlot === timeSlot && ds.status === "confirmed");
        if (isSmeBusy) return;

        let score = 50;
        if (dateStr === session.dateStr) score += 30; // Same date priority
        score += 20;

        timeSwaps.push({ dateStr, timeSlot, score: Math.min(100, score), reason: "Timetable Slot Free & Verified" });
      });
    });

    timeSwaps.sort((a, b) => b.score - a.score);
    return { mentorSwaps: [], timeSwaps: timeSwaps.slice(0, 5) };
  };

  const currentSwapRecommendations = useMemo(() => {
    return getSwapRecommendations(swapModalSession);
  }, [swapModalSession, mentors, slots, weekDates, colleges, leaveRequests, demoSessions]);

  const handleSubmitSwapRequest = async () => {
    if (!swapModalSession) return;
    if (!selectedProposedTime) { setErrorMsg("Please select a suggested replacement timeslot."); return; }
    setSubmitting(true); setErrorMsg(""); setSuccessMsg("");
    const payload = {
      sessionId: swapModalSession.id, mentorId: swapModalSession.mentorId, mentorName: swapModalSession.mentorName,
      smeId: swapModalSession.smeId, smeName: swapModalSession.smeName, dateStr: swapModalSession.dateStr,
      timeSlot: swapModalSession.timeSlot, subject: swapModalSession.subject, stream: swapModalSession.stream,
      reason: swapReason, remarks: swapRemarks, swapType: "reallocation",
      proposedSmeId: swapModalSession.smeId, proposedSmeName: swapModalSession.smeName,
      proposedDateStr: selectedProposedTime.dateStr,
      proposedTimeSlot: selectedProposedTime.timeSlot
    };
    try {
      const res = await requestDemoSwap(payload);
      if (res.success) { setSuccessMsg("Demo reallocation proposal submitted successfully!"); setSwapModalSession(null); }
      else { setErrorMsg(res.message); }
    } catch (e: any) { setErrorMsg(e.message || "Failed to submit reallocation request."); }
    finally { setSubmitting(false); }
  };

  const handleConfirmEvaluation = async () => {
    if (!evaluationModalSession) return;
    if (marks < 0 || marks > 100) { setErrorMsg("Marks must be between 0 and 100."); return; }
    if (!comments.trim()) { setErrorMsg("Please provide comments/feedback for the evaluation."); return; }
    setSubmitting(true); setErrorMsg(""); setSuccessMsg("");
    try {
      const res = await evaluateDemoSession(evaluationModalSession.id, marks, comments);
      if (res.success) { setSuccessMsg(`Evaluation submitted successfully for ${evaluationModalSession.mentorName}!`); setEvaluationModalSession(null); }
      else { setErrorMsg(res.message); }
    } catch (e: any) { setErrorMsg(e.message || "Failed to submit evaluation."); }
    finally { setSubmitting(false); }
  };

  const getMentorCollege = (mentorId: string) => {
    const mentor = mentors.find(m => m.id === mentorId);
    if (!mentor) return "";
    return colleges.find(c => c.id === mentor.college_id)?.name || "";
  };
  const getMentorDept = (mentorId: string) => {
    const mentor = mentors.find(m => m.id === mentorId);
    return mentor?.department || mentor?.mentor_group || "";
  };

  const renderStatusBadge = (status: string) => {
    switch (status) {
      case "confirmed":
      case "scheduled":
        return <span className="px-2.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-800 text-[10px] font-black uppercase tracking-wider flex items-center gap-1"><CheckCircle className="h-3 w-3 shrink-0" /> Confirmed</span>;
      case "completed":
        return <span className="px-2.5 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-950/20 dark:text-indigo-400 dark:border-indigo-800 text-[10px] font-black uppercase tracking-wider flex items-center gap-1"><Award className="h-3 w-3 shrink-0" /> Completed</span>;
      case "reallocation_required":
        return <span className="px-2.5 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-800 text-[10px] font-black uppercase tracking-wider flex items-center gap-1"><AlertTriangle className="h-3 w-3 shrink-0" /> Reallocation Required</span>;
      case "pending":
      case "pending_sme":
        return <span className="px-2.5 py-0.5 rounded-md bg-violet-50 text-violet-700 border border-violet-200 dark:bg-violet-950/20 dark:text-violet-400 dark:border-violet-800 text-[10px] font-black uppercase tracking-wider flex items-center gap-1"><Clock className="h-3 w-3 shrink-0" /> Pending Approval</span>;
      case "not_conducted":
        return <span className="px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700 text-[10px] font-black uppercase tracking-wider flex items-center gap-1"><AlertCircle className="h-3 w-3 shrink-0" /> Not Conducted</span>;
      default:
        return <span className="px-2.5 py-0.5 rounded-md bg-slate-50 text-slate-600 border border-slate-200 text-[10px] font-black uppercase">{status}</span>;
    }
  };

  return (
    <div className="flex-1 flex flex-col md:flex-row bg-warm-canvas text-slate-800 font-sans h-full overflow-hidden dark:bg-gradient-to-br dark:from-slate-900 dark:via-slate-950 dark:to-pink-950 dark:text-slate-100">

      {/* ── 5 SME Sidebar Items Navigation ── */}
      <aside ref={sidebarRef} className={`hidden md:flex shrink-0 flex-col justify-between sticky top-6 z-30 floating-sidebar transition-all duration-300 ${isCollapsed ? "w-20 p-3" : "w-64 p-5"}`}>
        <div className="flex flex-col flex-1 overflow-y-auto">
          {/* Sidebar Header */}
          {!isCollapsed ? (
            <div className="mb-5 pb-4 border-b border-slate-200/60 dark:border-slate-800">
              <p className="text-[9px] font-black uppercase tracking-widest text-pink-600 dark:text-pink-400 mb-1">SME Portal</p>
              <h2 className="text-base font-black text-slate-800 dark:text-white leading-tight">SME Workspace</h2>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
                {currentSME.subject || "General"} Subject Expert
              </p>
            </div>
          ) : (
            <div className="mb-4 pb-3 border-b border-slate-200/60 dark:border-slate-800 text-center">
              <Sparkles className="h-5 w-5 text-pink-600 dark:text-pink-400 mx-auto" />
            </div>
          )}

          {/* 5 Primary Sidebar Navigation Tabs */}
          <nav className="space-y-1.5 py-1">
            {sidebarNavItems.map(item => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleTabChange(item.id as any)}
                  title={isCollapsed ? item.label : undefined}
                  className={`w-full flex items-center transition-all duration-150 cursor-pointer rounded-xl font-bold ${
                    isCollapsed ? "justify-center px-0 py-3" : "justify-between px-3.5 py-2.5 text-xs"
                  } ${
                    isActive
                      ? "bg-gradient-to-r from-pink-600 to-violet-600 text-white shadow-sm"
                      : "text-slate-600 hover:text-pink-600 hover:bg-pink-50/80 dark:text-slate-400 dark:hover:text-pink-300 dark:hover:bg-white/5"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Icon className={`h-4 w-4 shrink-0 ${isActive ? "text-white" : "text-slate-400 dark:text-slate-500"}`} />
                    {!isCollapsed && <span className="truncate">{item.label}</span>}
                  </div>
                  {item.count > 0 && (
                    <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full shrink-0 ${
                      isActive ? "bg-white/25 text-white" : "bg-pink-600 text-white"
                    }`}>
                      {item.count}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Footer Collapse Toggle */}
        <div className="border-t border-slate-100/85 dark:border-slate-800 pt-3.5 space-y-3 shrink-0">
          <div className="flex justify-center pt-1">
            <button
              type="button"
              onClick={() => setIsCollapsed(prev => {
                const next = !prev;
                localStorage.setItem("fp_sidebar_collapsed", String(next));
                return next;
              })}
              className="h-8.5 w-8.5 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center text-slate-500 hover:text-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 shadow-xs transition-all cursor-pointer"
              title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
            >
              {isCollapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main Content Body Area ── */}
      <main className="flex-1 w-full overflow-y-auto h-full pb-20 md:pb-12 scroll-touch">
        <div className="p-3 md:p-6 space-y-6 max-w-[1400px] mx-auto animate-in fade-in slide-in-from-bottom-3 duration-250">

          {/* Top Header Banner & Profile Card */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-5 shadow-xs">
            <div className="flex items-center gap-3.5">
              <div className="h-10 w-10 rounded-lg bg-pink-50 dark:bg-pink-950/30 flex items-center justify-center text-pink-600 dark:text-pink-400 shrink-0 border border-pink-100 dark:border-pink-900">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-base font-extrabold text-slate-900 dark:text-white leading-tight">
                  SME Dashboard
                </h1>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                  Demo management, timetable availability tracking, and leave-reallocation request handling.
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={handleExportCSV}
                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-extrabold border border-slate-200 dark:border-slate-700 transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
              >
                <Download className="h-3.5 w-3.5" /> Export CSV
              </button>
              <button
                onClick={async () => { await refreshData(); toast("Data refreshed successfully!", "success"); }}
                className="p-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-lg border border-slate-200 dark:border-slate-700 transition-all cursor-pointer shadow-2xs"
                title="Refresh Data"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
              <div className="flex items-center gap-2.5 px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shrink-0">
                <div className="h-7 w-7 rounded-full bg-pink-600 text-white flex items-center justify-center text-xs font-black">
                  {currentSME.name?.charAt(0) || "S"}
                </div>
                <div className="text-left hidden sm:block">
                  <span className="text-[10px] font-black text-slate-900 dark:text-white block leading-tight">{currentSME.name}</span>
                  <span className="text-[8.5px] text-pink-600 dark:text-pink-400 font-bold block">Profile</span>
                </div>
              </div>
            </div>
          </div>

          {/* System Alerts */}
          {successMsg && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl flex items-center gap-3 text-xs font-bold shadow-xs animate-in zoom-in-95">
              <CheckCircle className="h-5 w-5 text-emerald-600 shrink-0" />
              <span>{successMsg}</span>
              <button onClick={() => setSuccessMsg("")} className="ml-auto text-emerald-500 hover:text-emerald-700 cursor-pointer"><X className="h-4 w-4" /></button>
            </div>
          )}
          {errorMsg && (
            <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl flex items-center gap-3 text-xs font-bold shadow-xs animate-in zoom-in-95">
              <AlertCircle className="h-5 w-5 text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
              <button onClick={() => setErrorMsg("")} className="ml-auto text-rose-500 hover:text-rose-700 cursor-pointer"><X className="h-4 w-4" /></button>
            </div>
          )}

          {/* Mobile Navigation Pill Tabs Bar */}
          <div className="md:hidden flex items-center p-1.5 bg-slate-50/80 dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-2xs overflow-x-auto">
            {sidebarNavItems.map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleTabChange(tab.id as any)}
                className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                  activeTab === tab.id
                    ? "bg-slate-900 text-white dark:bg-pink-600 dark:text-white shadow-xs"
                    : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
                }`}
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
                {tab.count > 0 && (
                  <span className={`ml-1 px-1.5 py-0.5 rounded-md text-[9px] font-black ${
                    activeTab === tab.id ? "bg-white/20 text-white" : "bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                  }`}>
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* ═══════════════ TAB 0: DASHBOARD (DAILY OVERVIEW) ═══════════════ */}
          {activeTab === "overview" && (
            <div className="space-y-6">
              {/* Daily Overview KPI Cards */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                <Card
                  label="Today's Demos"
                  value={todayDemos.length}
                  icon={<Calendar className="h-4 w-4 text-blue-600" />}
                />
                <Card
                  label="Upcoming Confirmed"
                  value={confirmedCount}
                  icon={<CheckCircle className="h-4 w-4 text-emerald-600" />}
                />
                <Card
                  label="Pending Requests"
                  value={pendingInboundRequests.length}
                  icon={<Clock className="h-4 w-4 text-violet-600" />}
                />
                <Card
                  label="Reallocation Required"
                  value={affectedCount}
                  icon={<AlertTriangle className="h-4 w-4 text-amber-600" />}
                />
                <Card
                  label="Completed (Avg)"
                  value={completedCount > 0 ? `${completedCount} (${avgScore}%)` : "0"}
                  icon={<Award className="h-4 w-4 text-pink-600" />}
                />
              </div>

              {/* Action Required Banner if pending requests or affected demos exist */}
              {(pendingInboundRequests.length > 0 || affectedCount > 0) && (
                <div className="p-4 bg-amber-50 border border-amber-200 dark:bg-amber-950/20 dark:border-amber-900/40 rounded-xl space-y-2">
                  <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 font-extrabold text-xs">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    Action Required ({pendingInboundRequests.length + affectedCount} items)
                  </div>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {pendingInboundRequests.length > 0 && (
                      <button
                        onClick={() => handleTabChange("reallocation")}
                        className="px-3 py-1.5 bg-amber-500 text-white rounded-lg text-xs font-extrabold flex items-center gap-1 hover:bg-amber-600 cursor-pointer shadow-2xs"
                      >
                        Review {pendingInboundRequests.length} Pending Requests <ChevronRight className="h-3 w-3" />
                      </button>
                    )}
                    {affectedCount > 0 && (
                      <button
                        onClick={() => handleTabChange("reallocation")}
                        className="px-3 py-1.5 bg-amber-600 text-white rounded-lg text-xs font-extrabold flex items-center gap-1 hover:bg-amber-700 cursor-pointer shadow-2xs"
                      >
                        Resolve {affectedCount} Demos Requiring Reallocation <ChevronRight className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Compact Today's Schedule & Action Indicators */}
              <Panel
                title="TODAY'S SCHEDULE"
                subtitle="Faculty demos set for today requiring evaluation or attendance"
              >
                {todayDemos.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {todayDemos.map(demo => (
                      <div key={demo.id} className="p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between gap-3 shadow-2xs">
                        <div className="space-y-0.5">
                          <div className="font-black text-xs text-slate-900 dark:text-white flex items-center gap-1.5">
                            <User className="h-3.5 w-3.5 text-pink-500 shrink-0" />
                            {demo.mentorName}
                          </div>
                          <div className="text-[10px] text-slate-500 font-semibold">{demo.dateStr} • {demo.timeSlot}</div>
                          <div className="text-[9px] text-indigo-600 dark:text-indigo-400 font-bold uppercase">{demo.subject} • {getMentorDept(demo.mentorId) || demo.stream}</div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {renderStatusBadge(demo.status)}
                          {demo.status === "confirmed" && (
                            <button onClick={() => handleOpenEvaluate(demo)} className="px-3 py-1.5 bg-pink-600 text-white rounded-lg text-[10px] font-extrabold hover:bg-pink-700 cursor-pointer shadow-2xs">
                              Evaluate
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-8 text-center text-slate-400 text-xs font-bold italic bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl">
                    No confirmed demos scheduled for today ({todayStr}).
                  </div>
                )}
              </Panel>
            </div>
          )}

          {/* ═══════════════ TAB 1: MY DEMOS ═══════════════ */}
          {activeTab === "demo_list" && (
            <Panel
              title="MY DEMOS"
              subtitle="View and manage faculty demo sessions assigned to your subject stream"
            >
              <div className="space-y-5">
                {/* Sub-tab Status Filters */}
                <div className="flex items-center gap-2 border-b border-slate-200/80 dark:border-slate-800 pb-3 overflow-x-auto">
                  {[
                    { label: "All Demos", value: "All" },
                    { label: "Confirmed", value: "Confirmed" },
                    { label: "Reallocation Required", value: "Reallocation Required" },
                    { label: "Pending Approval", value: "Pending Approval" },
                    { label: "Completed", value: "Completed" }
                  ].map(tab => (
                    <button
                      key={tab.value}
                      type="button"
                      onClick={() => { setFilterStatus(tab.value); setPage(1); }}
                      className={`px-3.5 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer whitespace-nowrap ${
                        filterStatus === tab.value
                          ? "bg-pink-600 text-white shadow-2xs"
                          : "bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Filter Toolbar */}
                <div className="bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 p-3.5 rounded-xl">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <select value={filterCollege} onChange={e => { setFilterCollege(e.target.value); setPage(1); }}
                      className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-pink-500 cursor-pointer">
                      <option value="All">All Colleges</option>
                      {uniqueColleges.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <select value={filterSubject} onChange={e => { setFilterSubject(e.target.value); setPage(1); }}
                      className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-pink-500 cursor-pointer">
                      <option value="All">All Subjects</option>
                      {uniqueSubjects.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <select value={filterGroup} onChange={e => { setFilterGroup(e.target.value); setPage(1); }}
                      className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-pink-500 cursor-pointer">
                      <option value="All">All Groups</option>
                      {uniqueGroups.map(g => <option key={g} value={g}>{g}</option>)}
                    </select>
                    <div className="relative">
                      <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input type="text" placeholder="Search mentor, date, subject..." value={searchQuery} onChange={e => { setSearchQuery(e.target.value); setPage(1); }}
                        className="w-full pl-8 pr-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-pink-500" />
                    </div>
                  </div>
                </div>

                {/* Sub-cards List (Mentor, Group, College, Subject, Demo Time, Head SME, Status) */}
                <div className="grid grid-cols-1 gap-4">
                  {paginatedDemos.length > 0 ? (
                    paginatedDemos.map(demo => (
                      <div key={demo.id} className="p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-3.5 hover:border-pink-300/80 dark:hover:border-pink-800 transition-all">
                        {/* Sub-boxes Grid */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                          <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-slate-800">
                            <span className="text-[8.5px] font-black uppercase tracking-wider text-slate-400 block mb-0.5">Mentor</span>
                            <span className="text-xs font-black text-slate-900 dark:text-white truncate block flex items-center gap-1">
                              <User className="h-3.5 w-3.5 text-pink-500 shrink-0" />
                              {demo.mentorName}
                            </span>
                          </div>
                          <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-slate-800">
                            <span className="text-[8.5px] font-black uppercase tracking-wider text-slate-400 block mb-0.5">Group & College</span>
                            <span className="text-xs font-black text-indigo-600 dark:text-indigo-400 truncate block">
                              {getMentorDept(demo.mentorId) || demo.stream || "General"}
                            </span>
                            <span className="text-[9px] text-slate-400 font-semibold truncate block">{getMentorCollege(demo.mentorId)}</span>
                          </div>
                          <div className="p-3 bg-pink-50/40 dark:bg-pink-950/20 rounded-lg border border-pink-100 dark:border-pink-900/40">
                            <span className="text-[8.5px] font-black uppercase tracking-wider text-pink-600 dark:text-pink-400 block mb-0.5">Subject & Head SME</span>
                            <span className="text-xs font-black text-pink-700 dark:text-pink-300 truncate block">{demo.subject}</span>
                            <span className="text-[9px] text-slate-400 font-semibold truncate block">Head: {currentSME.name}</span>
                          </div>
                          <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-slate-800">
                            <span className="text-[8.5px] font-black uppercase tracking-wider text-slate-400 block mb-0.5">Demo Time</span>
                            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate block font-mono">{demo.dateStr}</span>
                            <span className="text-[9px] text-slate-500 font-medium block">{demo.timeSlot}</span>
                          </div>
                        </div>

                        {/* Card Action Row */}
                        <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800/80">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-extrabold uppercase text-slate-400">Status:</span>
                            {renderStatusBadge(demo.status)}
                          </div>
                          <div className="flex items-center gap-2">
                            {demo.status === "completed" ? (
                              <button onClick={() => setViewEvalSession(demo)} className="px-3.5 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-extrabold flex items-center gap-1 hover:bg-emerald-100 transition-all cursor-pointer">
                                <Eye className="h-3.5 w-3.5" /> View Score ({demo.marks}/100)
                              </button>
                            ) : demo.status === "confirmed" ? (
                              <>
                                <button onClick={() => handleOpenEvaluate(demo)} className="px-3.5 py-1.5 bg-pink-600 hover:bg-pink-700 text-white rounded-lg text-xs font-extrabold transition-all cursor-pointer shadow-2xs">
                                  View Demo / Evaluate
                                </button>
                                <button onClick={() => handleOpenSwapModal(demo)} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-bold border border-slate-200 dark:border-slate-700 transition-all cursor-pointer flex items-center gap-1">
                                  <RefreshCw className="h-3.5 w-3.5" /> Reallocate
                                </button>
                              </>
                            ) : (
                              <button onClick={() => handleOpenSwapModal(demo)} className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-extrabold transition-all cursor-pointer shadow-2xs flex items-center gap-1">
                                <RefreshCw className="h-3.5 w-3.5" /> Reallocate Demo
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="p-10 text-center text-slate-400 text-xs font-bold italic bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl">
                      No demo sessions found matching your filters.
                    </div>
                  )}
                </div>

                {/* Table Pagination */}
                {filteredDemos.length > 0 && (
                  <div className="pt-2">
                    <Pagination
                      currentPage={page}
                      totalItems={filteredDemos.length}
                      pageSize={pageSize}
                      onPageChange={setPage}
                      onPageSizeChange={(sz) => { setPageSize(sz); setPage(1); }}
                    />
                  </div>
                )}
              </div>
            </Panel>
          )}

          {/* ═══════════════ TAB 2: AVAILABILITY ═══════════════ */}
          {activeTab === "availability" && (
            <Panel
              title="SME AVAILABILITY TIMETABLE"
              subtitle="Central timetable grid displaying Free, Confirmed Demo, Class/Busy, and Leave schedules"
            >
              <div className="space-y-6">
                {/* Legend Bar */}
                <div className="flex flex-wrap items-center gap-3 p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800 text-xs font-bold">
                  <span className="text-[10px] font-black uppercase text-slate-400">Legend:</span>
                  <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-md text-[10px]">Free Slot</span>
                  <span className="px-2.5 py-1 bg-pink-100 text-pink-800 border border-pink-200 rounded-md text-[10px]">Confirmed Demo (Blocked)</span>
                  <span className="px-2.5 py-1 bg-slate-100 text-slate-700 border border-slate-200 rounded-md text-[10px]">Class / Busy</span>
                  <span className="px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-md text-[10px]">Leave</span>
                </div>

                {/* Time-Slot Availability Matrix Grid */}
                <div className="overflow-x-auto border border-slate-200/80 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 shadow-xs">
                  <table className="w-full text-center text-xs min-w-[650px]">
                    <thead>
                      <tr className="bg-slate-100/80 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-[10px] font-black uppercase text-slate-500 tracking-wider">
                        <th className="p-3 text-left">Time Slot</th>
                        {weekDates.map(w => (
                          <th key={w.dateStr} className="p-3">{w.day} ({w.dateStr?.split(" ").slice(0, 2).join(" ")})</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-bold">
                      {["9:00 AM", "10:00 AM", "11:00 AM", "12:00 PM", "2:00 PM", "3:00 PM"].map(time => (
                        <tr key={time} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                          <td className="p-3 text-left font-mono text-[11px] font-extrabold text-slate-700 dark:text-slate-300 bg-slate-50/30 dark:bg-slate-900/50">{time}</td>
                          {weekDates.map(w => {
                            const demoOnSlot = myDemos.find(d => d.dateStr === w.dateStr && d.timeSlot?.toLowerCase().includes(time.toLowerCase().split(":")[0]) && d.status === "confirmed");
                            const slotOnSlot = slots.find(s => (s as any).smeId === currentSME.id && s.day === w.day && s.time?.toLowerCase().includes(time.toLowerCase().split(":")[0]));
                            const isLeave = leaveRequests?.some((l: any) => l.smeId === currentSME.id && l.dateStr === w.dateStr && l.status === "approved");

                            if (isLeave) {
                              return (
                                <td key={w.dateStr} className="p-2">
                                  <span className="px-2.5 py-1.5 bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400 border border-amber-200 dark:border-amber-800 rounded-lg text-[10px] font-black block">
                                    Leave
                                  </span>
                                </td>
                              );
                            } else if (demoOnSlot) {
                              return (
                                <td key={w.dateStr} className="p-2">
                                  <span
                                    onClick={() => handleOpenEvaluate(demoOnSlot)}
                                    className="px-2.5 py-1.5 bg-pink-100 text-pink-800 dark:bg-pink-950/40 dark:text-pink-300 border border-pink-200 dark:border-pink-800 rounded-lg text-[10px] font-black block cursor-pointer hover:scale-[1.02] transition-transform"
                                  >
                                    Demo ({demoOnSlot.mentorName?.split(" ")[0]})
                                  </span>
                                </td>
                              );
                            } else if (slotOnSlot) {
                              return (
                                <td key={w.dateStr} className="p-2">
                                  <span className="px-2.5 py-1.5 bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-lg text-[10px] font-extrabold block">
                                    Class ({slotOnSlot.course})
                                  </span>
                                </td>
                              );
                            } else {
                              return (
                                <td key={w.dateStr} className="p-2">
                                  <span className="px-2.5 py-1.5 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 rounded-lg text-[10px] font-black block">
                                    Free
                                  </span>
                                </td>
                              );
                            }
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </Panel>
          )}

          {/* ═══════════════ TAB 3: REALLOCATION ═══════════════ */}
          {activeTab === "reallocation" && (
            <Panel
              title="REALLOCATION REQUESTS"
              subtitle="Review leave-affected demo proposals and process SME reallocations"
            >
              <div className="space-y-6">
                {/* Section 1: Inbound Pending Reallocation Requests */}
                <div className="space-y-3">
                  <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                    <Clock className="h-4 w-4 text-violet-600" />
                    Inbound Proposed Requests ({pendingInboundRequests.length})
                  </h3>

                  {pendingInboundRequests.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {pendingInboundRequests.map((req: any) => (
                        <div key={req.id} className="p-4 rounded-xl border border-violet-200/80 bg-violet-50/20 dark:bg-violet-950/10 space-y-3 shadow-2xs">
                          <div className="flex justify-between items-center text-xs">
                            <span className="font-extrabold text-slate-900 dark:text-white">{req.subject} • {req.stream || "General"}</span>
                            <span className="px-2 py-0.5 bg-violet-100 text-violet-800 font-extrabold rounded-md text-[9px] uppercase">Reallocation Proposal</span>
                          </div>

                          <div className="grid grid-cols-2 gap-3 text-xs p-3 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-lg">
                            <div>
                              <span className="text-[8.5px] font-black uppercase text-slate-400 block mb-0.5">Faculty & Group</span>
                              <span className="font-bold text-slate-800 dark:text-slate-200 block">{req.mentorName}</span>
                              <span className="text-[9px] text-slate-500">{getMentorCollege(req.mentorId)}</span>
                              <span className="text-[9.5px] font-mono text-slate-600 block mt-1">Orig: {req.dateStr} • {req.timeSlot}</span>
                            </div>
                            <div>
                              <span className="text-[8.5px] font-black uppercase text-violet-600 block mb-0.5">Proposed Slot & SME</span>
                              <span className="font-bold text-violet-700 dark:text-violet-400 block">{req.proposedSmeName || req.smeName || currentSME.name}</span>
                              <span className="text-[9.5px] font-mono text-violet-600 font-bold block mt-1">{req.proposedDateStr || req.dateStr} • {req.proposedTimeSlot || req.timeSlot}</span>
                            </div>
                          </div>

                          <p className="text-[10px] text-slate-500 italic">Reason: &quot;{req.reason || "CAM Approved Mentor Leave"}&quot;</p>

                          <div className="flex gap-3 pt-1">
                            <button
                              onClick={async () => {
                                const res = await resolveDemoSwap(req.id, "rejected");
                                if (res.success) toast("Reallocation request rejected. Session remains in reallocation_required.", "success");
                              }}
                              className="flex-1 py-2 text-xs font-extrabold border border-rose-200 text-rose-700 hover:bg-rose-50 rounded-lg transition-all cursor-pointer"
                            >
                              Reject
                            </button>
                            <button
                              onClick={async () => {
                                const res = await resolveDemoSwap(req.id, "approved");
                                if (res.success) toast("Reallocation request accepted and demo booked!", "success");
                              }}
                              className="flex-1 py-2 text-xs font-extrabold bg-violet-600 hover:bg-violet-700 text-white rounded-lg transition-all shadow-2xs cursor-pointer"
                            >
                              Accept & Confirm
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-8 text-center text-slate-400 text-xs font-bold italic bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl">
                      No inbound reallocation proposals requiring approval.
                    </div>
                  )}
                </div>

                {/* Section 2: Demos Requiring Reallocation */}
                <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                  <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    Demos Requiring Reallocation ({affectedLeaveDemos.length})
                  </h3>

                  {affectedLeaveDemos.length > 0 ? (
                    <div className="space-y-3">
                      {affectedLeaveDemos.map(demo => (
                        <div key={demo.id} className="p-4 rounded-xl border border-amber-200 bg-amber-50/20 dark:bg-amber-950/10 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-2xs">
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="text-xs font-extrabold text-slate-900 dark:text-white">{demo.mentorName}</h4>
                              <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded text-[9px] font-black uppercase">Reallocation Required</span>
                            </div>
                            <p className="text-[10px] text-slate-500 font-semibold mt-0.5">{demo.dateStr} • {demo.timeSlot} • {demo.subject}</p>
                            <p className="text-[9.5px] text-amber-700 italic mt-0.5">Reason: CAM Approved Mentor Leave</p>
                          </div>

                          <button onClick={() => handleOpenSwapModal(demo)} className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-extrabold transition-all flex items-center gap-1.5 shrink-0 shadow-2xs cursor-pointer">
                            <RefreshCw className="h-3.5 w-3.5" /> Reallocate Slot
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-8 text-center text-slate-400 text-xs font-bold italic bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl">
                      No demos currently affected by approved faculty leave.
                    </div>
                  )}
                </div>
              </div>
            </Panel>
          )}

          {/* ═══════════════ TAB 4: HISTORY ═══════════════ */}
          {activeTab === "history" && (
            <Panel
              title="EVALUATION HISTORY LOG"
              subtitle="Completed demo evaluations, 100-mark scorecards, and recorded feedback"
            >
              <div className="space-y-4">
                <div className="relative">
                  <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input type="text" placeholder="Search evaluations by mentor, subject, or date..." value={historySearch} onChange={e => { setHistorySearch(e.target.value); setHistoryPage(1); }}
                    className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-pink-500" />
                </div>

                <div className="overflow-x-auto border border-slate-200/80 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-900">
                  {paginatedHistory.length > 0 ? (
                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                      {paginatedHistory.map(demo => (
                        <div key={demo.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/30 transition-colors">
                          <div
                            onClick={() => setExpandedHistoryId(expandedHistoryId === demo.id ? null : demo.id)}
                            className="p-4 flex items-center justify-between cursor-pointer"
                          >
                            <div className="flex items-center gap-4">
                              <div className="h-10 w-10 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0 border border-emerald-100">
                                <CheckCircle className="h-5 w-5" />
                              </div>
                              <div>
                                <h3 className="text-xs font-extrabold text-slate-900 dark:text-white">{demo.mentorName}</h3>
                                <p className="text-[9.5px] text-slate-400 font-semibold">{demo.dateStr} • {demo.subject}</p>
                                <p className="text-[9px] text-indigo-600 font-bold uppercase">{getMentorCollege(demo.mentorId)}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="text-right">
                                <span className="text-[8px] font-black uppercase text-slate-400 block">Score</span>
                                <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">{demo.marks} / 100</span>
                              </div>
                              {expandedHistoryId === demo.id ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
                            </div>
                          </div>
                          {expandedHistoryId === demo.id && (
                            <div className="px-4 pb-4 animate-in slide-in-from-top-1 duration-200">
                              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-200/80 dark:border-slate-800">
                                <span className="text-[9px] font-black uppercase text-slate-400 block mb-1">Feedback Comments</span>
                                <p className="text-xs text-slate-600 dark:text-slate-300 italic">&quot;{demo.comments || "No comments provided."}&quot;</p>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-10 text-center text-slate-400 text-xs font-bold italic">
                      {historySearch ? "No evaluations match your search." : "No completed evaluations recorded yet."}
                    </div>
                  )}

                  {/* History Pagination */}
                  {filteredHistory.length > 0 && (
                    <div className="p-3 border-t border-slate-100 dark:border-slate-800">
                      <Pagination
                        currentPage={historyPage}
                        totalItems={filteredHistory.length}
                        pageSize={historyPageSize}
                        onPageChange={setHistoryPage}
                        onPageSizeChange={(sz) => { setHistoryPageSize(sz); setHistoryPage(1); }}
                      />
                    </div>
                  )}
                </div>
              </div>
            </Panel>
          )}

          {/* ═══════════════ REALLOCATION MODAL (AVAILABILITY WIZARD) ═══════════════ */}
          {swapModalSession && (
            <div className="fixed inset-0 bg-slate-950/45 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl max-w-lg w-full p-6 space-y-5 animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
                <div className="border-b border-slate-100 dark:border-slate-800 pb-3 flex items-center justify-between">
                  <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                    <RefreshCw className="h-4.5 w-4.5 text-indigo-500" />
                    Reallocate Demo Session
                  </h3>
                  <button onClick={() => setSwapModalSession(null)} className="text-slate-400 hover:text-slate-700 text-xs font-bold cursor-pointer">Close</button>
                </div>

                {swapStep === 1 ? (
                  <div className="space-y-4">
                    <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200/80 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-350 space-y-1">
                      <p><strong>Faculty Candidate:</strong> {swapModalSession.mentorName} ({swapModalSession.subject})</p>
                      <p><strong>Scheduled:</strong> {swapModalSession.dateStr} • {swapModalSession.timeSlot}</p>
                      <p><strong>College:</strong> {getMentorCollege(swapModalSession.mentorId)}</p>
                    </div>
                    <div>
                      <label className="text-[9px] font-black uppercase text-slate-400 block mb-1.5">Reason for Reallocation</label>
                      <select value={swapReason} onChange={e => setSwapReason(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-750 bg-slate-50 dark:bg-slate-800 text-xs text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold cursor-pointer">
                        <option value="CAM Approved Mentor Leave">CAM Approved Mentor Leave</option>
                        <option value="SME Unavailable">SME Unavailable</option>
                        <option value="Timetable Conflict">Timetable Conflict</option>
                        <option value="Emergency">Emergency</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[9px] font-black uppercase text-slate-400 block mb-1.5">Remarks (Optional)</label>
                      <textarea rows={3} value={swapRemarks} onChange={e => setSwapRemarks(e.target.value)} placeholder="Provide context..."
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-750 bg-slate-50 dark:bg-slate-800 text-xs text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                    </div>
                    <div className="flex gap-3 pt-2">
                      <button type="button" onClick={() => setSwapModalSession(null)} className="flex-1 px-4 py-2.5 text-xs font-extrabold text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-all cursor-pointer">Cancel</button>
                      <button type="button" onClick={() => setSwapStep(2)} className="flex-1 px-4 py-2.5 text-xs font-extrabold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-all cursor-pointer shadow-2xs">Find Free Slot Options</button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Available Timetable Slot Recommendations</span>
                    <div className="space-y-3 max-h-[250px] overflow-y-auto pr-1">
                      {currentSwapRecommendations.timeSwaps.length > 0 ? (
                        currentSwapRecommendations.timeSwaps.map((cand, idx) => (
                          <div key={idx} onClick={() => setSelectedProposedTime(cand)}
                            className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${selectedProposedTime?.dateStr === cand.dateStr && selectedProposedTime?.timeSlot === cand.timeSlot ? "border-indigo-500 bg-indigo-50/20 dark:bg-indigo-950/20" : "border-slate-200/80 dark:border-slate-800 hover:border-indigo-300"}`}>
                            <div className="flex-1">
                              <span className="text-xs font-bold text-slate-900 dark:text-white">{cand.dateStr}</span>
                              <span className="text-xs text-slate-500 block font-semibold">{cand.timeSlot}</span>
                              <span className="text-[10px] text-slate-400 block mt-0.5">{cand.reason}</span>
                            </div>
                            <div className="text-right flex items-center gap-2">
                              <div>
                                <span className="text-[8px] font-black uppercase text-indigo-500 block">Match</span>
                                <span className="text-xs font-black text-indigo-600 dark:text-indigo-400">{cand.score}%</span>
                              </div>
                              {selectedProposedTime?.dateStr === cand.dateStr && selectedProposedTime?.timeSlot === cand.timeSlot && <Check className="h-4.5 w-4.5 text-indigo-500 animate-in fade-in" />}
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="text-xs text-slate-400 text-center py-6 font-bold">No alternate free timeslots found this week.</p>
                      )}
                    </div>
                    <div className="flex gap-3 pt-2">
                      <button type="button" onClick={() => setSwapStep(1)} className="flex-1 px-4 py-2.5 text-xs font-extrabold text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-all cursor-pointer">Back</button>
                      <button type="button" disabled={submitting} onClick={handleSubmitSwapRequest}
                        className="flex-1 px-4 py-2.5 text-xs font-extrabold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg disabled:opacity-50 transition-all cursor-pointer shadow-2xs">
                        {submitting ? "Submitting..." : "Submit Reallocation"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ═══════════════ EVALUATION MODAL (100-MARK RUBRIC) ═══════════════ */}
          {evaluationModalSession && (
            <div className="fixed inset-0 bg-slate-950/45 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl max-w-lg w-full p-6 space-y-5 animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
                <div className="border-b border-slate-100 dark:border-slate-800 pb-3 flex items-center justify-between">
                  <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
                    SME Demo Evaluation Form
                  </h3>
                  <button onClick={() => setEvaluationModalSession(null)} className="text-slate-400 hover:text-slate-600 text-xs font-bold cursor-pointer">Close</button>
                </div>

                <div className="space-y-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-[9px] font-black uppercase text-slate-400 block mb-0.5">Faculty Candidate</span>
                      <p className="text-xs font-bold text-slate-900 dark:text-white">{evaluationModalSession.mentorName}</p>
                      <p className="text-[9px] text-indigo-600 font-bold uppercase mt-0.5">{getMentorCollege(evaluationModalSession.mentorId)}</p>
                    </div>
                    <div className="text-right">
                      <span className="text-[9px] font-black uppercase text-slate-400 block mb-0.5">Subject</span>
                      <span className="px-2 py-0.5 bg-pink-50 dark:bg-pink-950/20 text-pink-700 dark:text-pink-400 rounded-md text-[9px] font-bold">
                        {evaluationModalSession.subject}
                      </span>
                      <div className="mt-1">
                        <span className="text-[9px] text-slate-400">{evaluationModalSession.dateStr} • {evaluationModalSession.timeSlot}</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2 p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200/80 dark:border-slate-800">
                    <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider block mb-2">Evaluation Criteria</span>
                    {EVAL_CRITERIA.map(crit => (
                      <div key={crit.key} className="flex items-center justify-between gap-3">
                        <label className="text-[10px] font-bold text-slate-600 dark:text-slate-300 flex-1">
                          {crit.label} <span className="text-slate-400">(0-{crit.max})</span>
                        </label>
                        <input
                          type="number"
                          min={0}
                          max={crit.max}
                          value={evalScores[crit.key] || 0}
                          onChange={e => updateScore(crit.key, Number(e.target.value), crit.max)}
                          className="w-16 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold text-slate-800 dark:text-white text-center focus:outline-none focus:ring-2 focus:ring-pink-500"
                        />
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-between items-center p-3 bg-indigo-50/40 dark:bg-indigo-950/20 border border-indigo-150 rounded-xl text-xs font-bold">
                    <span className="text-slate-800 dark:text-slate-200">Calculated Total Marks:</span>
                    <span className={`text-sm font-black ${marks >= 80 ? "text-emerald-600" : marks >= 60 ? "text-amber-600" : "text-rose-600"}`}>{marks} / 100</span>
                  </div>

                  <div>
                    <label className="text-[9px] font-black uppercase text-slate-400 block mb-1">
                      Pedagogical Comments & Feedback
                    </label>
                    <textarea
                      rows={4}
                      value={comments}
                      onChange={e => setComments(e.target.value)}
                      placeholder="Provide feedback on course knowledge, presentation delivery, confidence, student interaction..."
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-750 bg-slate-50 dark:bg-slate-800 text-xs text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-pink-500"
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setEvaluationModalSession(null)}
                    className="flex-1 px-4 py-2.5 text-xs font-extrabold text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-all cursor-pointer">
                    Cancel
                  </button>
                  <button type="button" disabled={submitting} onClick={handleConfirmEvaluation}
                    className="flex-1 px-4 py-2.5 text-xs font-extrabold text-white bg-pink-600 hover:bg-pink-700 rounded-lg disabled:opacity-50 transition-all shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer">
                    {submitting ? "Submitting..." : "Submit Evaluation"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ═══════════════ VIEW EVALUATION (READ-ONLY) MODAL ═══════════════ */}
          {viewEvalSession && (
            <div className="fixed inset-0 bg-slate-950/45 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl max-w-md w-full p-6 space-y-5 animate-in zoom-in-95 duration-200">
                <div className="border-b border-slate-100 dark:border-slate-800 pb-3 flex items-center justify-between">
                  <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                    <Lock className="h-4 w-4 text-emerald-500" />
                    Evaluation Record
                  </h3>
                  <button onClick={() => setViewEvalSession(null)} className="text-slate-400 hover:text-slate-600 text-xs font-bold cursor-pointer">Close</button>
                </div>

                <div className="space-y-4">
                  <div className="flex justify-between">
                    <div>
                      <span className="text-[9px] font-black uppercase text-slate-400 block mb-0.5">Faculty</span>
                      <p className="text-xs font-bold text-slate-900 dark:text-white">{viewEvalSession.mentorName}</p>
                      <p className="text-[9px] text-indigo-600 font-bold uppercase">{getMentorCollege(viewEvalSession.mentorId)}</p>
                    </div>
                    <div className="text-right">
                      <span className="text-[9px] font-black uppercase text-slate-400 block mb-0.5">Score</span>
                      <span className={`text-lg font-black ${(viewEvalSession.marks || 0) >= 80 ? "text-emerald-600" : (viewEvalSession.marks || 0) >= 60 ? "text-amber-600" : "text-rose-600"}`}>
                        {viewEvalSession.marks} / 100
                      </span>
                    </div>
                  </div>

                  <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200/80 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-350 space-y-1">
                    <p><strong>Subject:</strong> {viewEvalSession.subject}</p>
                    <p><strong>Date/Time:</strong> {viewEvalSession.dateStr} • {viewEvalSession.timeSlot}</p>
                    <p><strong>Stream:</strong> {viewEvalSession.stream}</p>
                  </div>

                  <div className="p-3 bg-emerald-50/30 dark:bg-emerald-950/10 border border-emerald-150 rounded-xl">
                    <span className="text-[9px] font-black uppercase text-slate-400 block mb-1">Feedback Comments</span>
                    <p className="text-xs text-slate-600 dark:text-slate-300 italic">&quot;{viewEvalSession.comments || "No comments recorded."}&quot;</p>
                  </div>
                </div>

                <button type="button" onClick={() => setViewEvalSession(null)}
                  className="w-full px-4 py-2.5 text-xs font-extrabold text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-all cursor-pointer">
                  Close
                </button>
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}
