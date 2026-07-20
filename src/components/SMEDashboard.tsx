"use client";

import React, { useState, useMemo } from "react";
import { useApp } from "@/context/AppContext";
import { useToast } from "@/context/ToastContext";
import {
  Sparkles,
  ClipboardList,
  CheckCircle,
  AlertCircle,
  FileText,
  User,
  Star,
  Award,
  Calendar,
  RefreshCw,
  Check,
  Search,
  Filter,
  Clock,
  BarChart3,
  Eye,
  ChevronDown,
  ChevronUp,
  Lock,
  TrendingUp,
  X
} from "lucide-react";

type TabKey = "dashboard" | "queue" | "calendar" | "history" | "performance";

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

export function SMEDashboard() {
  const {
    currentSME,
    demoSessions,
    evaluateDemoSession,
    refreshData,
    requestDemoSwap,
    mentors,
    slots,
    holidays,
    leaveRequests,
    weekDates,
    colleges,
    demoSwapRequests,
    resolveDemoSwap
  } = useApp();

  const { toast } = useToast();

  // Tab state
  const [activeTab, setActiveTab] = useState<TabKey>("dashboard");

  // Evaluation modal state
  const [evaluationModalSession, setEvaluationModalSession] = useState<any | null>(null);
  const [evalScores, setEvalScores] = useState<Record<string, number>>({ ...DEFAULT_SCORES });
  const [comments, setComments] = useState<string>("");
  const [successMsg, setSuccessMsg] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [submitting, setSubmitting] = useState<boolean>(false);

  // View evaluation (read-only) modal
  const [viewEvalSession, setViewEvalSession] = useState<any | null>(null);

  // Swap Requests state hooks
  const [swapModalSession, setSwapModalSession] = useState<any | null>(null);
  const [swapReason, setSwapReason] = useState<string>("I am unavailable");
  const [swapRemarks, setSwapRemarks] = useState<string>("");
  const [swapStep, setSwapStep] = useState<number>(1);
  const [swapTab, setSwapTab] = useState<"mentor" | "time">("mentor");
  const [selectedProposedMentor, setSelectedProposedMentor] = useState<any | null>(null);
  const [selectedProposedTime, setSelectedProposedTime] = useState<any | null>(null);

  // Demo Queue filters
  const [filterCollege, setFilterCollege] = useState<string>("All");
  const [filterSubject, setFilterSubject] = useState<string>("All");
  const [filterStatus, setFilterStatus] = useState<string>("All");
  const [filterDate, setFilterDate] = useState<string>("");
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
  const myDemos = demoSessions.filter(ds => ds.smeId === currentSME.id);
  const pendingDemos = myDemos.filter(ds => ds.status === "scheduled");
  const completedDemos = myDemos.filter(ds => ds.status === "completed");
  const totalAssigned = myDemos.length;
  const completedCount = completedDemos.length;
  const pendingCount = pendingDemos.length;
  const avgScore = completedCount > 0
    ? Math.round(completedDemos.reduce((sum, d) => sum + (d.marks || 0), 0) / completedCount)
    : 0;

  // Today's demos
  const todayStr = new Date().toISOString().split("T")[0];
  const todayFormatted = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  const todayDemos = myDemos.filter(ds => {
    const demoDate = ds.dateStr?.replace(/\s/g, "");
    const today = todayFormatted.replace(/\s/g, "");
    return demoDate === today || ds.dateStr === todayStr;
  });

  // Swap request counts
  const pendingSwapRequests = demoSwapRequests?.filter(
    (r: any) => (r.smeId === currentSME.id && (r.status === "pending" || r.status === "pending_sme"))
  ) || [];

  // Weekly count (current week demos)
  const weekDateStrs = weekDates.map(w => w.dateStr);
  const weeklyCompleted = completedDemos.filter(d => weekDateStrs.includes(d.dateStr)).length;

  // Monthly count (current month demos)
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  const monthlyCompleted = completedDemos.filter(d => {
    try {
      const parts = d.dateStr?.match(/(\d+)\s+(\w+)/);
      if (!parts) return false;
      const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
      const mi = monthNames.indexOf(parts[2]);
      return mi === currentMonth;
    } catch { return false; }
  }).length;

  // Unique colleges and subjects for filters
  const uniqueColleges = Array.from(new Set(
    myDemos.map(d => {
      const mentor = mentors.find(m => m.id === d.mentorId);
      return mentor ? colleges.find(c => c.id === mentor.college_id)?.name || "" : "";
    }).filter(Boolean)
  ));
  const uniqueSubjects = Array.from(new Set(myDemos.map(d => d.subject).filter(Boolean)));

  // ── Filtered demo queue ───────────────────────────────────────────
  const filteredDemos = useMemo(() => {
    return myDemos.filter(d => {
      if (filterStatus !== "All") {
        if (filterStatus === "Scheduled" && d.status !== "scheduled") return false;
        if (filterStatus === "Completed" && d.status !== "completed") return false;
      }
      if (filterSubject !== "All" && d.subject !== filterSubject) return false;
      if (filterCollege !== "All") {
        const mentor = mentors.find(m => m.id === d.mentorId);
        const collegeName = mentor ? colleges.find(c => c.id === mentor.college_id)?.name : "";
        if (collegeName !== filterCollege) return false;
      }
      if (filterDate && d.dateStr !== filterDate) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchMentor = d.mentorName?.toLowerCase().includes(q);
        const matchSubject = d.subject?.toLowerCase().includes(q);
        const matchStream = d.stream?.toLowerCase().includes(q);
        if (!matchMentor && !matchSubject && !matchStream) return false;
      }
      return true;
    });
  }, [myDemos, filterStatus, filterSubject, filterCollege, filterDate, searchQuery, mentors, colleges]);

  // ── History filtered ──────────────────────────────────────────────
  const filteredHistory = useMemo(() => {
    if (!historySearch.trim()) return completedDemos;
    const q = historySearch.toLowerCase();
    return completedDemos.filter(d =>
      d.mentorName?.toLowerCase().includes(q) ||
      d.subject?.toLowerCase().includes(q) ||
      d.dateStr?.toLowerCase().includes(q)
    );
  }, [completedDemos, historySearch]);

  // ── Subject-wise stats ────────────────────────────────────────────
  const subjectStats = useMemo(() => {
    const map: Record<string, { count: number; totalScore: number }> = {};
    completedDemos.forEach(d => {
      const subj = d.subject || "Unknown";
      if (!map[subj]) map[subj] = { count: 0, totalScore: 0 };
      map[subj].count++;
      map[subj].totalScore += d.marks || 0;
    });
    return Object.entries(map).map(([subject, { count, totalScore }]) => ({
      subject,
      count,
      avgScore: Math.round(totalScore / count)
    }));
  }, [completedDemos]);

  // ── Handlers ──────────────────────────────────────────────────────

  const handleOpenEvaluate = (session: any) => {
    // Business rule: prevent duplicate evaluation
    if (session.status === "completed") {
      setViewEvalSession(session);
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
    setSwapReason("I am unavailable");
    setSwapRemarks("");
    setSwapStep(1);
    setSwapTab("mentor");
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

  // AI swap recommendation logic
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

    const activeCollege = colleges.find(c => c.id === session.college_id || slots.find(s => s.mentorId === session.mentorId)?.college_id);
    let standardSlots: string[] = [];
    if (activeCollege && activeCollege.shift_configs) {
      try {
        const parsed = JSON.parse(activeCollege.shift_configs);
        const s1 = parsed.shift_1 || [];
        const s2 = parsed.shift_2 || [];
        const gen = parsed.general || [];
        standardSlots = [...s1, ...s2, ...gen].map((t: string) => t.trim().toLowerCase());
      } catch (_) {}
    }

    const mentorSwaps: any[] = [];
    mentors.forEach(m => {
      if (m.id === session.mentorId) return;
      const isOnLeave = leaveRequests?.some((l: any) => l.mentorId === m.id && l.dateStr === session.dateStr && l.status === "approved");
      if (isOnLeave) return;
      const dayName = weekDates.find(w => w.dateStr === session.dateStr)?.day || "";
      const hasClass = slots.some(s => s.mentorId === m.id && s.day === dayName && s.time === session.timeSlot);
      if (hasClass) return;
      const hasDemo = demoSessions.some(ds => ds.mentorId === m.id && ds.dateStr === session.dateStr && ds.timeSlot === session.timeSlot);
      if (hasDemo) return;
      const dailyLoad = demoSessions.filter(ds => ds.mentorId === m.id && ds.dateStr === session.dateStr).length;
      if (dailyLoad >= 2) return;
      let score = 40;
      const isExactSubjectMatch = m.subject_group?.toLowerCase().trim() === subjectGroup?.toLowerCase().trim();
      if (isExactSubjectMatch) score += 25;
      const weeklyLoad = demoSessions.filter(ds => ds.mentorId === m.id).length;
      score += Math.max(0, 15 - (weeklyLoad * 5));
      const idx = derivedTimeSlots.indexOf(session.timeSlot);
      let consecutiveClash = false;
      if (idx !== -1) {
        const prevSlot = idx > 0 ? derivedTimeSlots[idx - 1] : "";
        const nextSlot = idx < derivedTimeSlots.length - 1 ? derivedTimeSlots[idx + 1] : "";
        const hasPrev = prevSlot && demoSessions.some(ds => ds.mentorId === m.id && ds.dateStr === session.dateStr && ds.timeSlot === prevSlot);
        const hasNext = nextSlot && demoSessions.some(ds => ds.mentorId === m.id && ds.dateStr === session.dateStr && ds.timeSlot === nextSlot);
        if (hasPrev || hasNext) consecutiveClash = true;
      }
      if (!consecutiveClash) score += 10;
      score += 5;
      const isRegular = standardSlots.includes(session.timeSlot?.trim().toLowerCase());
      if (isRegular) score += 5;
      mentorSwaps.push({
        mentorId: m.id, mentorName: m.name, subjectGroup: m.subject_group || "General",
        score, weeklyCount: weeklyLoad,
        reason: isExactSubjectMatch ? "Subject Match, Free Slot, Low Workload" : "Free Slot, General Helper"
      });
    });

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
        const hasMentorDemo = demoSessions.some(ds => ds.mentorId === session.mentorId && ds.dateStr === dateStr && ds.timeSlot === timeSlot);
        if (hasMentorDemo) return;
        const isSmeBusy = demoSessions.some(ds => ds.smeId === session.smeId && ds.dateStr === dateStr && ds.timeSlot === timeSlot);
        if (isSmeBusy) return;
        const mentorDailyLoad = demoSessions.filter(ds => ds.mentorId === session.mentorId && ds.dateStr === dateStr).length;
        if (mentorDailyLoad >= 2) return;
        let score = 40;
        score += 25;
        score += 15;
        const idx = derivedTimeSlots.indexOf(timeSlot);
        let consecutiveClash = false;
        if (idx !== -1) {
          const prevSlot = idx > 0 ? derivedTimeSlots[idx - 1] : "";
          const nextSlot = idx < derivedTimeSlots.length - 1 ? derivedTimeSlots[idx + 1] : "";
          const hasPrev = prevSlot && demoSessions.some(ds => ds.mentorId === session.mentorId && ds.dateStr === dateStr && ds.timeSlot === prevSlot);
          const hasNext = nextSlot && demoSessions.some(ds => ds.mentorId === session.mentorId && ds.dateStr === dateStr && ds.timeSlot === nextSlot);
          if (hasPrev || hasNext) consecutiveClash = true;
        }
        if (!consecutiveClash) score += 10;
        if (dateStr === session.dateStr) score += 5;
        const isRegular = standardSlots.includes(timeSlot.trim().toLowerCase());
        if (isRegular) score += 5;
        timeSwaps.push({ dateStr, timeSlot, score, reason: isRegular ? "Regular Timetable Slot Free" : "Beyond Hours Fallback" });
      });
    });

    mentorSwaps.sort((a, b) => b.score - a.score);
    timeSwaps.sort((a, b) => b.score - a.score);
    return { mentorSwaps: mentorSwaps.slice(0, 5), timeSwaps: timeSwaps.slice(0, 5) };
  };

  const handleSubmitSwapRequest = async () => {
    if (!swapModalSession) return;
    if (swapTab === "mentor" && !selectedProposedMentor) { setErrorMsg("Please select a suggested replacement mentor."); return; }
    if (swapTab === "time" && !selectedProposedTime) { setErrorMsg("Please select a suggested replacement timeslot."); return; }
    setSubmitting(true); setErrorMsg(""); setSuccessMsg("");
    const payload = {
      sessionId: swapModalSession.id, mentorId: swapModalSession.mentorId, mentorName: swapModalSession.mentorName,
      smeId: swapModalSession.smeId, smeName: swapModalSession.smeName, dateStr: swapModalSession.dateStr,
      timeSlot: swapModalSession.timeSlot, subject: swapModalSession.subject, stream: swapModalSession.stream,
      reason: swapReason, remarks: swapRemarks, swapType: swapTab,
      proposedMentorId: swapTab === "mentor" ? selectedProposedMentor.mentorId : null,
      proposedMentorName: swapTab === "mentor" ? selectedProposedMentor.mentorName : null,
      proposedSmeId: swapModalSession.smeId, proposedSmeName: swapModalSession.smeName,
      proposedDateStr: swapTab === "time" ? selectedProposedTime.dateStr : null,
      proposedTimeSlot: swapTab === "time" ? selectedProposedTime.timeSlot : null
    };
    try {
      const res = await requestDemoSwap(payload);
      if (res.success) { setSuccessMsg("Demo swap request submitted successfully!"); setSwapModalSession(null); }
      else { setErrorMsg(res.message); }
    } catch (e: any) { setErrorMsg(e.message || "Failed to submit swap request."); }
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

  // ── Helper: get mentor college name ───────────────────────────────
  const getMentorCollege = (mentorId: string) => {
    const mentor = mentors.find(m => m.id === mentorId);
    if (!mentor) return "";
    return colleges.find(c => c.id === mentor.college_id)?.name || "";
  };
  const getMentorDept = (mentorId: string) => {
    const mentor = mentors.find(m => m.id === mentorId);
    return mentor?.department || "";
  };

  // ── Tab definitions ───────────────────────────────────────────────
  const tabs: { key: TabKey; label: string; icon: React.ReactNode; count?: number }[] = [
    { key: "dashboard", label: "Dashboard", icon: <Sparkles className="h-4 w-4" /> },
    { key: "queue", label: "Demo Queue", icon: <ClipboardList className="h-4 w-4" />, count: totalAssigned },
    { key: "calendar", label: "Calendar", icon: <Calendar className="h-4 w-4" /> },
    { key: "history", label: "History", icon: <FileText className="h-4 w-4" />, count: completedCount },
    { key: "performance", label: "Performance", icon: <BarChart3 className="h-4 w-4" /> },
  ];

  // ── RENDER ────────────────────────────────────────────────────────
  return (
    <div className="flex-1 w-full overflow-y-auto h-full pb-20 md:pb-12 scroll-touch">
      <div className="p-3 md:p-6 space-y-6 max-w-[1400px] mx-auto animate-in fade-in slide-in-from-bottom-3 duration-250">

      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-black text-slate-850 dark:text-white tracking-tight flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-pink-500" />
            SME Evaluation Hub
          </h1>
          <p className="text-xs text-slate-400 font-semibold mt-1">
            Conduct demo evaluations, score faculty presentations, and provide pedagogical feedback.
          </p>
        </div>
        <div className="px-4 py-2.5 bg-pink-50/50 dark:bg-pink-950/10 border border-pink-100 dark:border-pink-900 rounded-2xl">
          <span className="text-[9px] font-black uppercase text-pink-650 dark:text-pink-400 tracking-wider block">Specialization</span>
          <span className="text-xs font-black text-slate-800 dark:text-white">{currentSME.subject || "General"} Expert</span>
        </div>
      </div>

      {/* Alerts */}
      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-250 text-emerald-800 rounded-2xl flex items-center gap-3 text-xs font-bold shadow-sm animate-in zoom-in-95">
          <CheckCircle className="h-5 w-5 text-emerald-605 shrink-0" />
          <span>{successMsg}</span>
          <button onClick={() => setSuccessMsg("")} className="ml-auto text-emerald-500 hover:text-emerald-700"><X className="h-4 w-4" /></button>
        </div>
      )}
      {errorMsg && (
        <div className="p-4 bg-rose-50 border border-rose-250 text-rose-800 rounded-2xl flex items-center gap-3 text-xs font-bold shadow-sm animate-in zoom-in-95">
          <AlertCircle className="h-5 w-5 text-rose-605 shrink-0" />
          <span>{errorMsg}</span>
          <button onClick={() => setErrorMsg("")} className="ml-auto text-rose-500 hover:text-rose-700"><X className="h-4 w-4" /></button>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex gap-1 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-1.5 rounded-2xl overflow-x-auto">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap ${
              activeTab === tab.key
                ? "bg-white dark:bg-slate-800 text-pink-600 dark:text-pink-400 shadow-sm border border-slate-100 dark:border-slate-700"
                : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
            }`}
          >
            {tab.icon}
            {tab.label}
            {tab.count !== undefined && (
              <span className={`ml-1 px-1.5 py-0.5 rounded-md text-[9px] font-black ${
                activeTab === tab.key ? "bg-pink-100 text-pink-600" : "bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400"
              }`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ═══════════════ DASHBOARD TAB ═══════════════ */}
      {activeTab === "dashboard" && (
        <div className="space-y-6">
          {/* 6 KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {[
              { label: "Today's Demos", value: todayDemos.length, icon: <Clock className="h-5 w-5" />, color: "bg-violet-50 text-violet-600 dark:bg-violet-950/30 dark:text-violet-400" },
              { label: "Pending", value: pendingCount, icon: <Calendar className="h-5 w-5" />, color: "bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-400" },
              { label: "Completed", value: completedCount, icon: <CheckCircle className="h-5 w-5" />, color: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400" },
              { label: "Swap Requests", value: pendingSwapRequests.length, icon: <RefreshCw className="h-5 w-5" />, color: "bg-blue-50 text-blue-600 dark:bg-blue-950/30 dark:text-blue-400" },
              { label: "Avg Score", value: avgScore > 0 ? `${avgScore}` : "—", icon: <Award className="h-5 w-5" />, color: "bg-pink-50 text-pink-600 dark:bg-pink-950/30 dark:text-pink-400" },
              { label: "This Week", value: weeklyCompleted, icon: <TrendingUp className="h-5 w-5" />, color: "bg-indigo-50 text-indigo-600 dark:bg-indigo-950/30 dark:text-indigo-400" },
            ].map((kpi, i) => (
              <div key={i} className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-850 p-4 rounded-2xl shadow-sm">
                <div className={`h-10 w-10 rounded-xl flex items-center justify-center mb-2 ${kpi.color}`}>
                  {kpi.icon}
                </div>
                <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider block">{kpi.label}</span>
                <span className="text-lg font-black text-slate-850 dark:text-white">{kpi.value}</span>
              </div>
            ))}
          </div>

          {/* Two-column: Today's Demos + Upcoming This Week */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* Today's Demos */}
            <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-850 p-5 rounded-3xl shadow-sm space-y-4">
              <h2 className="text-sm font-black text-slate-855 dark:text-white uppercase tracking-wider flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                <Clock className="h-4 w-4 text-violet-500" />
                Today&apos;s Demos
              </h2>
              {todayDemos.length > 0 ? (
                <div className="space-y-3">
                  {todayDemos.map(demo => (
                    <div key={demo.id} className="p-3 rounded-2xl border border-slate-150 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-900/30 flex items-center justify-between gap-3">
                      <div>
                        <h3 className="text-xs font-black text-slate-800 dark:text-white">{demo.mentorName}</h3>
                        <p className="text-[9.5px] text-slate-450 font-semibold">{demo.timeSlot} • {demo.subject}</p>
                        <p className="text-[9px] text-indigo-500 font-bold uppercase">{getMentorCollege(demo.mentorId)}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {demo.status === "completed" ? (
                          <button onClick={() => setViewEvalSession(demo)} className="px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl text-[10px] font-black flex items-center gap-1">
                            <Eye className="h-3 w-3" /> View
                          </button>
                        ) : (
                          <>
                            <button onClick={() => handleOpenEvaluate(demo)} className="px-3 py-1.5 bg-pink-500 hover:bg-pink-650 text-white rounded-xl text-[10px] font-black transition-colors">
                              Evaluate
                            </button>
                            <button onClick={() => handleOpenSwapModal(demo)} className="px-3 py-1.5 bg-slate-105 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl text-[10px] font-black border border-slate-200 dark:border-slate-700 transition-colors">
                              Swap
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="h-32 flex flex-col items-center justify-center text-slate-400">
                  <CheckCircle className="h-6 w-6 text-emerald-500 mb-1" />
                  <p className="text-xs font-bold">No demos scheduled for today.</p>
                </div>
              )}
            </div>

            {/* Upcoming This Week + Swap Approvals */}
            <div className="space-y-6">
              <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-850 p-5 rounded-3xl shadow-sm space-y-4">
                <h2 className="text-sm font-black text-slate-855 dark:text-white uppercase tracking-wider flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                  <Calendar className="h-4 w-4 text-amber-500" />
                  Upcoming This Week ({pendingDemos.length})
                </h2>
                {pendingDemos.length > 0 ? (
                  <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                    {pendingDemos.map(demo => (
                      <div key={demo.id} className="p-3 rounded-xl border border-slate-150 dark:border-slate-800 flex items-center justify-between gap-3 hover:border-indigo-250 transition-all">
                        <div>
                          <h3 className="text-xs font-bold text-slate-800 dark:text-white">{demo.mentorName}</h3>
                          <p className="text-[9.5px] text-slate-400 font-semibold">{demo.dateStr} • {demo.timeSlot}</p>
                          <p className="text-[9px] text-slate-450">{demo.subject} • {getMentorCollege(demo.mentorId)}</p>
                        </div>
                        <div className="flex gap-1.5">
                          <button onClick={() => handleOpenEvaluate(demo)} className="px-2.5 py-1.5 bg-pink-500 hover:bg-pink-650 text-white rounded-lg text-[9px] font-black transition-colors">
                            Evaluate
                          </button>
                          <button onClick={() => handleOpenSwapModal(demo)} className="px-2.5 py-1.5 bg-slate-105 hover:bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg text-[9px] font-black border border-slate-200 dark:border-slate-700 transition-colors flex items-center gap-0.5">
                            <RefreshCw className="h-3 w-3" /> Swap
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-455 italic text-center py-8">No upcoming demos this week.</p>
                )}
              </div>

              {/* Internal Swap Approvals */}
              {(() => {
                const approvals = demoSwapRequests?.filter(
                  (r: any) => r.smeId === currentSME.id && r.status === "pending_sme"
                ) || [];
                if (approvals.length === 0) return null;
                return (
                  <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-850 p-5 rounded-3xl shadow-sm space-y-4">
                    <h2 className="text-sm font-black text-slate-855 dark:text-white uppercase tracking-wider flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                      <RefreshCw className="h-4 w-4 text-indigo-500 animate-spin-slow" />
                      Internal Swap Approvals ({approvals.length})
                    </h2>
                    <div className="space-y-3">
                      {approvals.map((req: any) => (
                        <div key={req.id} className="p-4 rounded-2xl bg-indigo-50/10 border border-indigo-150 space-y-3">
                          <div className="flex justify-between items-center text-xs">
                            <span className="font-bold text-slate-800 dark:text-white">{req.subject} • Week {req.week}</span>
                            <span className="px-2 py-0.5 bg-indigo-50 text-indigo-705 font-bold rounded-lg text-[9px] uppercase">Mentor Swap</span>
                          </div>
                          <div className="grid grid-cols-2 gap-3 text-xs p-3 bg-white dark:bg-slate-900 border border-slate-100 rounded-xl">
                            <div>
                              <span className="text-[8.5px] font-black uppercase text-slate-400 block mb-0.5">Original</span>
                              <span className="font-bold text-slate-700 dark:text-slate-300">{req.mentorName}</span>
                            </div>
                            <div>
                              <span className="text-[8.5px] font-black uppercase text-indigo-500 block mb-0.5">Proposed</span>
                              <span className="font-bold text-indigo-650 dark:text-indigo-400">{req.proposedMentorName}</span>
                            </div>
                          </div>
                          {req.reason && <p className="text-[10px] text-slate-500 italic">Reason: &quot;{req.reason}&quot;</p>}
                          <div className="flex gap-3 pt-1">
                            <button
                              onClick={async () => { const res = await resolveDemoSwap(req.id, "rejected"); if (res.success) toast("Proposal rejected.", "success"); }}
                              className="flex-grow py-2 text-xs font-black border border-slate-205 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-655 transition-colors cursor-pointer"
                            >
                              Reject
                            </button>
                            <button
                              onClick={async () => { const res = await resolveDemoSwap(req.id, "approved"); if (res.success) toast("Proposal approved! Timetable updated.", "success"); }}
                              className="flex-grow py-2 text-xs font-black bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-colors cursor-pointer"
                            >
                              Approve Swap
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════ DEMO QUEUE TAB ═══════════════ */}
      {activeTab === "queue" && (
        <div className="space-y-5">
          {/* Filter Bar */}
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-850 p-4 rounded-2xl shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <Filter className="h-4 w-4 text-slate-400" />
              <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Filters</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <select value={filterCollege} onChange={e => setFilterCollege(e.target.value)}
                className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-750 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-pink-500">
                <option value="All">All Colleges</option>
                {uniqueColleges.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <select value={filterSubject} onChange={e => setFilterSubject(e.target.value)}
                className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-750 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-pink-500">
                <option value="All">All Subjects</option>
                {uniqueSubjects.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
                className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-750 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-pink-500">
                <option value="All">All Status</option>
                <option value="Scheduled">Scheduled</option>
                <option value="Completed">Completed</option>
              </select>
              <input type="text" placeholder="Filter by date (e.g. 14 Jul)" value={filterDate} onChange={e => setFilterDate(e.target.value)}
                className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-750 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-pink-500" />
              <div className="relative">
                <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input type="text" placeholder="Search mentor or group..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-750 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-pink-500" />
              </div>
            </div>
          </div>

          {/* Results Table */}
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-850 rounded-3xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs min-w-[620px]">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 text-[9px] font-black uppercase text-slate-400 tracking-wider">
                    <th className="p-3">Mentor</th>
                    <th className="p-3">College</th>
                    <th className="p-3">Subject</th>
                    <th className="p-3">Date / Time</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredDemos.length > 0 ? filteredDemos.map(demo => (
                    <tr key={demo.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="p-3">
                        <div className="font-bold text-slate-800 dark:text-white">{demo.mentorName}</div>
                        <div className="text-[9px] text-slate-400">{getMentorDept(demo.mentorId)}</div>
                      </td>
                      <td className="p-3">
                        <span className="text-[9px] text-indigo-500 font-bold uppercase">{getMentorCollege(demo.mentorId)}</span>
                      </td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 bg-pink-50 dark:bg-pink-950/20 text-pink-700 dark:text-pink-400 rounded-lg text-[9px] font-bold">{demo.subject}</span>
                      </td>
                      <td className="p-3">
                        <div className="font-bold text-slate-700 dark:text-slate-200">{demo.dateStr}</div>
                        <div className="text-[9px] text-slate-400">{demo.timeSlot}</div>
                      </td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase ${
                          demo.status === "completed"
                            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400"
                            : "bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400"
                        }`}>
                          {demo.status}
                        </span>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-1.5">
                          {demo.status === "completed" ? (
                            <button onClick={() => setViewEvalSession(demo)} className="px-2.5 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-[9px] font-black flex items-center gap-1 hover:bg-emerald-100 transition-colors">
                              <Eye className="h-3 w-3" /> View
                            </button>
                          ) : (
                            <>
                              <button onClick={() => handleOpenEvaluate(demo)} className="px-2.5 py-1.5 bg-pink-500 hover:bg-pink-650 text-white rounded-lg text-[9px] font-black transition-colors">
                                Evaluate
                              </button>
                              <button onClick={() => handleOpenSwapModal(demo)} className="px-2.5 py-1.5 bg-slate-105 hover:bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg text-[9px] font-black border border-slate-200 dark:border-slate-700 transition-colors">
                                Swap
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={6} className="p-12 text-center text-slate-400 text-xs font-bold">No demos match your filters.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════ CALENDAR TAB ═══════════════ */}
      {activeTab === "calendar" && (
        <div className="space-y-5">
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-850 p-5 rounded-3xl shadow-sm">
            <h2 className="text-sm font-black text-slate-855 dark:text-white uppercase tracking-wider flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3 mb-4">
              <Calendar className="h-4 w-4 text-indigo-500" />
              Weekly Calendar View
            </h2>
            <div className="grid grid-cols-5 gap-3">
              {weekDates.map(wd => {
                const dayDemos = myDemos.filter(d => d.dateStr === wd.dateStr);
                const isToday = wd.dateStr === todayFormatted;
                return (
                  <div key={wd.dateStr} className={`border rounded-2xl p-3 min-h-[200px] ${isToday ? "border-pink-300 bg-pink-50/20 dark:bg-pink-950/10" : "border-slate-150 dark:border-slate-800"}`}>
                    <div className="flex items-center justify-between mb-3">
                      <span className={`text-[10px] font-black uppercase tracking-wider ${isToday ? "text-pink-600" : "text-slate-400"}`}>
                        {wd.day}
                      </span>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md ${isToday ? "bg-pink-500 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-500"}`}>
                        {wd.dateStr?.split(" ").slice(0, 2).join(" ")}
                      </span>
                    </div>
                    {dayDemos.length > 0 ? (
                      <div className="space-y-2">
                        {dayDemos.map(demo => (
                          <div
                            key={demo.id}
                            onClick={() => demo.status === "completed" ? setViewEvalSession(demo) : handleOpenEvaluate(demo)}
                            className={`p-2 rounded-xl text-[9px] font-bold cursor-pointer transition-all hover:scale-[1.02] ${
                              demo.status === "completed"
                                ? "bg-emerald-50 border border-emerald-200 text-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-800"
                                : "bg-amber-50 border border-amber-200 text-amber-800 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-800"
                            }`}
                          >
                            <div className="font-black">{demo.mentorName}</div>
                            <div className="text-[8px] opacity-75">{demo.timeSlot}</div>
                            <div className="text-[8px] opacity-60">{demo.subject}</div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[9px] text-slate-350 text-center pt-8 font-semibold">No demos</p>
                    )}
                  </div>
                );
              })}
            </div>
            {/* Legend */}
            <div className="flex items-center gap-4 mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-1.5 text-[9px] font-bold text-slate-500">
                <div className="h-3 w-3 rounded bg-amber-200" /> Scheduled
              </div>
              <div className="flex items-center gap-1.5 text-[9px] font-bold text-slate-500">
                <div className="h-3 w-3 rounded bg-emerald-200" /> Completed
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════ HISTORY TAB ═══════════════ */}
      {activeTab === "history" && (
        <div className="space-y-5">
          {/* Search Bar */}
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-850 p-4 rounded-2xl shadow-sm">
            <div className="relative">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input type="text" placeholder="Search evaluations by mentor, subject, or date..." value={historySearch} onChange={e => setHistorySearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-750 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-pink-500" />
            </div>
          </div>

          {/* History List */}
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-850 rounded-3xl shadow-sm overflow-hidden">
            {filteredHistory.length > 0 ? (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredHistory.map(demo => (
                  <div key={demo.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors">
                    <div
                      onClick={() => setExpandedHistoryId(expandedHistoryId === demo.id ? null : demo.id)}
                      className="p-4 flex items-center justify-between cursor-pointer"
                    >
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
                          <CheckCircle className="h-5 w-5" />
                        </div>
                        <div>
                          <h3 className="text-xs font-black text-slate-800 dark:text-white">{demo.mentorName}</h3>
                          <p className="text-[9.5px] text-slate-400 font-semibold">{demo.dateStr} • {demo.subject}</p>
                          <p className="text-[9px] text-indigo-500 font-bold uppercase">{getMentorCollege(demo.mentorId)}</p>
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
                        <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800">
                          <span className="text-[9px] font-black uppercase text-slate-400 block mb-1">Feedback Comments</span>
                          <p className="text-xs text-slate-650 dark:text-slate-300 italic">&quot;{demo.comments || "No comments provided."}&quot;</p>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-12 text-center text-slate-400 text-xs font-bold">
                {historySearch ? "No evaluations match your search." : "No completed evaluations recorded yet."}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════ PERFORMANCE TAB ═══════════════ */}
      {activeTab === "performance" && (
        <div className="space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {[
              { label: "Total Evaluated", value: completedCount, color: "text-emerald-600" },
              { label: "Pending", value: pendingCount, color: "text-amber-600" },
              { label: "Average Score", value: avgScore > 0 ? `${avgScore}/100` : "—", color: "text-pink-600" },
              { label: "This Week", value: weeklyCompleted, color: "text-indigo-600" },
              { label: "This Month", value: monthlyCompleted, color: "text-violet-600" },
              { label: "Total Assigned", value: totalAssigned, color: "text-blue-600" },
            ].map((stat, i) => (
              <div key={i} className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-850 p-4 rounded-2xl shadow-sm text-center">
                <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider block mb-1">{stat.label}</span>
                <span className={`text-xl font-black ${stat.color}`}>{stat.value}</span>
              </div>
            ))}
          </div>

          {/* Score Distribution Visual */}
          {completedDemos.length > 0 && (
            <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-850 p-5 rounded-3xl shadow-sm">
              <h2 className="text-sm font-black text-slate-855 dark:text-white uppercase tracking-wider flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3 mb-4">
                <Award className="h-4 w-4 text-pink-500" />
                Score Distribution
              </h2>
              <div className="space-y-2">
                {completedDemos.map(demo => {
                  const pct = demo.marks || 0;
                  return (
                    <div key={demo.id} className="flex items-center gap-3">
                      <span className="w-32 text-[10px] font-bold text-slate-600 dark:text-slate-300 truncate">{demo.mentorName}</span>
                      <div className="flex-1 h-5 bg-slate-100 dark:bg-slate-800 rounded-lg overflow-hidden">
                        <div
                          className={`h-full rounded-lg transition-all duration-500 ${
                            pct >= 80 ? "bg-emerald-500" : pct >= 60 ? "bg-amber-500" : "bg-rose-500"
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="w-12 text-[10px] font-black text-slate-700 dark:text-slate-300 text-right">{pct}/100</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Subject-wise Table */}
          {subjectStats.length > 0 && (
            <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-850 p-5 rounded-3xl shadow-sm">
              <h2 className="text-sm font-black text-slate-855 dark:text-white uppercase tracking-wider flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3 mb-4">
                <BarChart3 className="h-4 w-4 text-indigo-500" />
                Subject-wise Evaluation Statistics
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs min-w-[480px]">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 text-[9px] font-black uppercase text-slate-400 tracking-wider">
                      <th className="p-3">Subject</th>
                      <th className="p-3">Evaluations</th>
                      <th className="p-3">Avg Score</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {subjectStats.map(s => (
                      <tr key={s.subject} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                        <td className="p-3 font-bold text-slate-800 dark:text-white">{s.subject}</td>
                        <td className="p-3 text-slate-600 dark:text-slate-300">{s.count}</td>
                        <td className="p-3">
                          <span className={`font-black ${s.avgScore >= 80 ? "text-emerald-600" : s.avgScore >= 60 ? "text-amber-600" : "text-rose-600"}`}>
                            {s.avgScore}/100
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════ SWAP REQUEST MODAL ═══════════════ */}
      {swapModalSession && (
        <div className="fixed inset-0 bg-slate-955/45 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl max-w-lg w-full p-6 space-y-5 animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            <div className="border-b border-slate-105 dark:border-slate-800 pb-3 flex items-center justify-between">
              <h3 className="text-sm font-black text-slate-850 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                <RefreshCw className="h-4.5 w-4.5 text-indigo-500 animate-spin-slow" />
                Request Demo Swap
              </h3>
              <button onClick={() => setSwapModalSession(null)} className="text-slate-400 hover:text-slate-655 text-xs font-bold">Close</button>
            </div>

            {swapStep === 1 ? (
              <div className="space-y-4">
                <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-350 space-y-1">
                  <p><strong>Demo Details:</strong> {swapModalSession.mentorName} ({swapModalSession.subject})</p>
                  <p><strong>Scheduled:</strong> {swapModalSession.dateStr} • {swapModalSession.timeSlot}</p>
                  <p><strong>College:</strong> {getMentorCollege(swapModalSession.mentorId)}</p>
                </div>
                <div>
                  <label className="text-[9px] font-black uppercase text-slate-400 block mb-1.5">Reason for Swap</label>
                  <select value={swapReason} onChange={e => setSwapReason(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-750 bg-slate-50 dark:bg-slate-800 text-xs text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold">
                    <option value="I am unavailable">I am unavailable</option>
                    <option value="Leave Approved">Leave Approved</option>
                    <option value="Meeting">Meeting</option>
                    <option value="Emergency">Emergency</option>
                    <option value="Another Evaluation">Another Evaluation</option>
                    <option value="Other (Remarks)">Other (Remarks)</option>
                  </select>
                </div>
                <div>
                  <label className="text-[9px] font-black uppercase text-slate-400 block mb-1.5">SME Remarks (Optional)</label>
                  <textarea rows={3} value={swapRemarks} onChange={e => setSwapRemarks(e.target.value)} placeholder="Provide details about your unavailability..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-750 bg-slate-50 dark:bg-slate-800 text-xs text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setSwapModalSession(null)} className="flex-1 px-4 py-2.5 text-xs font-black text-slate-655 border border-slate-200 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">Cancel</button>
                  <button type="button" onClick={() => setSwapStep(2)} className="flex-1 px-4 py-2.5 text-xs font-black text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors">Find Alternatives</button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex border-b border-slate-100 dark:border-slate-800">
                  <button type="button" onClick={() => { setSwapTab("mentor"); setSelectedProposedMentor(null); }}
                    className={`flex-1 pb-2.5 text-xs font-black uppercase tracking-wider text-center border-b-2 transition-all ${swapTab === "mentor" ? "border-indigo-500 text-indigo-600" : "border-transparent text-slate-400"}`}>
                    Change Mentor
                  </button>
                  <button type="button" onClick={() => { setSwapTab("time"); setSelectedProposedTime(null); }}
                    className={`flex-1 pb-2.5 text-xs font-black uppercase tracking-wider text-center border-b-2 transition-all ${swapTab === "time" ? "border-indigo-500 text-indigo-600" : "border-transparent text-slate-400"}`}>
                    Change Time
                  </button>
                </div>
                <div className="space-y-3 max-h-[250px] overflow-y-auto pr-1">
                  {swapTab === "mentor" ? (
                    getSwapRecommendations(swapModalSession).mentorSwaps.length > 0 ? (
                      getSwapRecommendations(swapModalSession).mentorSwaps.map(cand => (
                        <div key={cand.mentorId} onClick={() => setSelectedProposedMentor(cand)}
                          className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${selectedProposedMentor?.mentorId === cand.mentorId ? "border-indigo-500 bg-indigo-50/20 dark:bg-indigo-950/20" : "border-slate-150 dark:border-slate-800 hover:border-indigo-300"}`}>
                          <div className="flex-1">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-bold text-slate-800 dark:text-white">{cand.mentorName}</span>
                              <span className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded text-[8px] font-bold">{cand.subjectGroup}</span>
                            </div>
                            <span className="text-[10px] text-slate-400 block mt-0.5">{cand.reason}</span>
                          </div>
                          <div className="text-right flex items-center gap-2">
                            <div>
                              <span className="text-[8px] font-black uppercase text-indigo-500 block">Match</span>
                              <span className="text-xs font-black text-indigo-650 dark:text-indigo-400">{cand.score}%</span>
                            </div>
                            {selectedProposedMentor?.mentorId === cand.mentorId && <Check className="h-4.5 w-4.5 text-indigo-500 animate-in fade-in" />}
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-slate-400 text-center py-6 font-bold">No replacement mentors free at this time.</p>
                    )
                  ) : (
                    getSwapRecommendations(swapModalSession).timeSwaps.length > 0 ? (
                      getSwapRecommendations(swapModalSession).timeSwaps.map((cand, idx) => (
                        <div key={idx} onClick={() => setSelectedProposedTime(cand)}
                          className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${selectedProposedTime?.dateStr === cand.dateStr && selectedProposedTime?.timeSlot === cand.timeSlot ? "border-indigo-500 bg-indigo-50/20 dark:bg-indigo-950/20" : "border-slate-150 dark:border-slate-800 hover:border-indigo-300"}`}>
                          <div className="flex-1">
                            <span className="text-xs font-bold text-slate-800 dark:text-white">{cand.dateStr}</span>
                            <span className="text-xs text-slate-500 block font-semibold">{cand.timeSlot}</span>
                            <span className="text-[10px] text-slate-400 block mt-0.5">{cand.reason}</span>
                          </div>
                          <div className="text-right flex items-center gap-2">
                            <div>
                              <span className="text-[8px] font-black uppercase text-indigo-500 block">Match</span>
                              <span className="text-xs font-black text-indigo-650 dark:text-indigo-400">{cand.score}%</span>
                            </div>
                            {selectedProposedTime?.dateStr === cand.dateStr && selectedProposedTime?.timeSlot === cand.timeSlot && <Check className="h-4.5 w-4.5 text-indigo-500 animate-in fade-in" />}
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-slate-400 text-center py-6 font-bold">No alternate free timeslots found this week.</p>
                    )
                  )}
                </div>
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setSwapStep(1)} className="flex-1 px-4 py-2.5 text-xs font-black text-slate-655 border border-slate-200 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">Back</button>
                  <button type="button" disabled={submitting} onClick={handleSubmitSwapRequest}
                    className="flex-1 px-4 py-2.5 text-xs font-black text-white bg-indigo-650 hover:bg-indigo-700 rounded-xl disabled:opacity-50 transition-colors">
                    {submitting ? "Submitting..." : "Submit Swap Request"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════ EVALUATION MODAL (11 CRITERIA) ═══════════════ */}
      {evaluationModalSession && (
        <div className="fixed inset-0 bg-slate-955/45 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl max-w-lg w-full p-6 space-y-5 animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            <div className="border-b border-slate-105 dark:border-slate-800 pb-3 flex items-center justify-between">
              <h3 className="text-sm font-black text-slate-850 dark:text-white uppercase tracking-wider">
                SME Demo Evaluation Form
              </h3>
              <button onClick={() => setEvaluationModalSession(null)} className="text-slate-400 hover:text-slate-655 text-xs font-bold">Close</button>
            </div>

            <div className="space-y-4">
              {/* Mentor details */}
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-[9px] font-black uppercase text-slate-450 block mb-0.5">Faculty Candidate</span>
                  <p className="text-xs font-bold text-slate-800 dark:text-white">{evaluationModalSession.mentorName}</p>
                  <p className="text-[9px] text-indigo-500 font-bold uppercase mt-0.5">{getMentorCollege(evaluationModalSession.mentorId)}</p>
                </div>
                <div className="text-right">
                  <span className="text-[9px] font-black uppercase text-slate-455 block mb-0.5">Subject</span>
                  <span className="px-2 py-0.5 bg-pink-50 dark:bg-pink-950/20 text-pink-700 dark:text-pink-400 rounded-lg text-[9px] font-bold">
                    {evaluationModalSession.subject}
                  </span>
                  <div className="mt-1">
                    <span className="text-[9px] text-slate-400">{evaluationModalSession.dateStr} • {evaluationModalSession.timeSlot}</span>
                  </div>
                </div>
              </div>

              {/* 11 Scoring Criteria */}
              <div className="space-y-2 p-3 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800">
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
                      className="w-16 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-805 text-xs font-bold text-slate-800 dark:text-white text-center focus:outline-none focus:ring-2 focus:ring-pink-500"
                    />
                  </div>
                ))}
              </div>

              {/* Total score */}
              <div className="flex justify-between items-center p-3 bg-indigo-50/40 dark:bg-indigo-950/20 border border-indigo-150 rounded-2xl text-xs font-bold">
                <span className="text-slate-800 dark:text-slate-200">Calculated Total Marks:</span>
                <span className={`text-sm font-black ${marks >= 80 ? "text-emerald-600" : marks >= 60 ? "text-amber-600" : "text-rose-600"}`}>{marks} / 100</span>
              </div>

              {/* Comments */}
              <div>
                <label className="text-[9px] font-black uppercase text-slate-400 block mb-1">
                  Pedagogical Comments & Feedback
                </label>
                <textarea
                  rows={4}
                  value={comments}
                  onChange={e => setComments(e.target.value)}
                  placeholder="Provide feedback on course knowledge, presentation delivery, confidence, student interaction..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-750 bg-slate-50 dark:bg-slate-800 text-xs text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-pink-500"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setEvaluationModalSession(null)}
                className="flex-1 px-4 py-2.5 text-xs font-black text-slate-655 border border-slate-200 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                Cancel
              </button>
              <button type="button" disabled={submitting} onClick={handleConfirmEvaluation}
                className="flex-1 px-4 py-2.5 text-xs font-black text-white bg-pink-500 hover:bg-pink-650 rounded-xl disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5">
                {submitting ? "Submitting..." : "Submit Evaluation"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════ VIEW EVALUATION (READ-ONLY) MODAL ═══════════════ */}
      {viewEvalSession && (
        <div className="fixed inset-0 bg-slate-955/45 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl max-w-md w-full p-6 space-y-5 animate-in zoom-in-95 duration-200">
            <div className="border-b border-slate-105 dark:border-slate-800 pb-3 flex items-center justify-between">
              <h3 className="text-sm font-black text-slate-850 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                <Lock className="h-4 w-4 text-emerald-500" />
                Evaluation Record
              </h3>
              <button onClick={() => setViewEvalSession(null)} className="text-slate-400 hover:text-slate-655 text-xs font-bold">Close</button>
            </div>

            <div className="space-y-4">
              <div className="flex justify-between">
                <div>
                  <span className="text-[9px] font-black uppercase text-slate-450 block mb-0.5">Faculty</span>
                  <p className="text-xs font-bold text-slate-800 dark:text-white">{viewEvalSession.mentorName}</p>
                  <p className="text-[9px] text-indigo-500 font-bold uppercase">{getMentorCollege(viewEvalSession.mentorId)}</p>
                </div>
                <div className="text-right">
                  <span className="text-[9px] font-black uppercase text-slate-455 block mb-0.5">Score</span>
                  <span className={`text-lg font-black ${(viewEvalSession.marks || 0) >= 80 ? "text-emerald-600" : (viewEvalSession.marks || 0) >= 60 ? "text-amber-600" : "text-rose-600"}`}>
                    {viewEvalSession.marks} / 100
                  </span>
                </div>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-350 space-y-1">
                <p><strong>Subject:</strong> {viewEvalSession.subject}</p>
                <p><strong>Date/Time:</strong> {viewEvalSession.dateStr} • {viewEvalSession.timeSlot}</p>
                <p><strong>Stream:</strong> {viewEvalSession.stream}</p>
              </div>

              <div className="p-3 bg-emerald-50/30 dark:bg-emerald-950/10 border border-emerald-150 rounded-xl">
                <span className="text-[9px] font-black uppercase text-slate-400 block mb-1">Feedback Comments</span>
                <p className="text-xs text-slate-650 dark:text-slate-300 italic">&quot;{viewEvalSession.comments || "No comments recorded."}&quot;</p>
              </div>

              <div className="flex items-center gap-2 p-3 bg-amber-50/30 dark:bg-amber-950/10 border border-amber-150 rounded-xl text-[10px] font-bold text-amber-700 dark:text-amber-400">
                <Lock className="h-3.5 w-3.5" />
                This evaluation is locked and cannot be modified.
              </div>
            </div>

            <button type="button" onClick={() => setViewEvalSession(null)}
              className="w-full px-4 py-2.5 text-xs font-black text-slate-655 border border-slate-200 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
              Close
            </button>
          </div>
        </div>
      )}

    </div>
  </div>
  );
}
