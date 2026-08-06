"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useApp } from "../context/AppContext";
import { useToast } from "../context/ToastContext";
import {
  UserCheck, Award, BookOpen, Users, GraduationCap, CheckCircle2,
  AlertCircle, Clock, XCircle, Search, Plus, Video, Send, Check,
  Building, Calendar, MessageSquare, BarChart3, Layers, Info,
  ShieldCheck, RefreshCw, ChevronDown, ChevronUp, Star, FileText,
  ExternalLink, AlertTriangle, Loader2, Filter, Trash2, HelpCircle,
  CheckCircle, ArrowRight, User, Sparkles, ChevronLeft, ChevronRight
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────────────────

interface InterviewModuleProps {
  currentUserRole?: "mentor" | "cm" | "cam" | "kam" | "admin" | string;
  currentUserName?: string;
  defaultCollegeId?: string;
}

export interface StructuredQuestion {
  id: string;
  question: string;
  maxScore: number;
  score: number;
  notes?: string;
}

// ─── Subject Question Preset Generator ─────────────────────────────────────

const getSubjectQuestionsPreset = (subjectName: string): StructuredQuestion[] => {
  const s = (subjectName || "").toLowerCase();

  if (s.includes("react") || s.includes("web") || s.includes("frontend") || s.includes("html") || s.includes("javascript")) {
    return [
      { id: "q1", question: "Component Architecture, Props & State Management", maxScore: 10, score: 7, notes: "" },
      { id: "q2", question: "Async JavaScript, Promises & API Integration", maxScore: 10, score: 7, notes: "" },
      { id: "q3", question: "DOM Manipulation, Hooks & Lifecycle", maxScore: 10, score: 8, notes: "" },
      { id: "q4", question: "CSS Layouts, Flexbox/Grid & Responsive Design", maxScore: 10, score: 7, notes: "" }
    ];
  }
  if (s.includes("java") || s.includes("python") || s.includes("backend") || s.includes("cpp") || s.includes("c++") || s.includes("dsa") || s.includes("data structure")) {
    return [
      { id: "q1", question: "Object-Oriented Programming (OOP) Principles & Abstraction", maxScore: 10, score: 8, notes: "" },
      { id: "q2", question: "Data Structures Complexity & Algorithm Design", maxScore: 10, score: 7, notes: "" },
      { id: "q3", question: "Database Querying, Indexing & Joins", maxScore: 10, score: 7, notes: "" },
      { id: "q4", question: "Exception Handling, Memory Management & Edge Cases", maxScore: 10, score: 7, notes: "" }
    ];
  }
  if (s.includes("aptitude") || s.includes("reasoning") || s.includes("math") || s.includes("quant")) {
    return [
      { id: "q1", question: "Quantitative Problem Solving & Numerical Accuracy", maxScore: 10, score: 7, notes: "" },
      { id: "q2", question: "Logical Deductions, Puzzles & Pattern Recognition", maxScore: 10, score: 8, notes: "" },
      { id: "q3", question: "Structured Step-by-Step Problem Solving Approach", maxScore: 10, score: 7, notes: "" },
      { id: "q4", question: "Speed, Time Management & Analytical Clarity", maxScore: 10, score: 7, notes: "" }
    ];
  }
  return [
    { id: "q1", question: "Core Fundamental Concepts & Theory", maxScore: 10, score: 7, notes: "" },
    { id: "q2", question: "Practical Understanding & Real-World Application", maxScore: 10, score: 7, notes: "" },
    { id: "q3", question: "Problem Solving, Logic & Technical Depth", maxScore: 10, score: 8, notes: "" },
    { id: "q4", question: "Code / Solution Presentation & Clarity", maxScore: 10, score: 7, notes: "" }
  ];
};

// ─── Status Badge (Shadcn Pill Style) ──────────────────────────────────────

const StatusBadge = ({ status }: { status: string }) => {
  const map: Record<string, string> = {
    pending_cm: "bg-amber-50 text-amber-700 border-amber-200/80",
    pending_external_cm: "bg-purple-50 text-purple-700 border-purple-200/80",
    assigned: "bg-blue-50 text-blue-700 border-blue-200/80",
    pending_verification: "bg-indigo-50 text-indigo-700 border-indigo-200/80",
    completed: "bg-emerald-50 text-emerald-700 border-emerald-200/80",
    cancelled: "bg-rose-50 text-rose-700 border-rose-200/80",
  };
  const label: Record<string, string> = {
    pending_cm: "Pending CM",
    pending_external_cm: "Awaiting External CM",
    assigned: "Assigned",
    pending_verification: "Pending Verification",
    completed: "Completed",
    cancelled: "Cancelled",
  };
  const cls = map[status] || "bg-slate-100 text-slate-600 border-slate-200";
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${cls}`}>
      {label[status] || status}
    </span>
  );
};

// ─── Score Slider ─────────────────────────────────────────────────────────────

const ScoreSlider = ({
  label, emoji, value, onChange, color = "#D528A2"
}: { label: string; emoji: string; value: number; onChange: (v: number) => void; color?: string }) => (
  <div className="bg-slate-50/70 border border-slate-200/80 rounded-xl p-3.5 space-y-2 shadow-xs">
    <div className="flex justify-between items-center">
      <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">{emoji} {label}</span>
      <span className="text-xs font-black px-2 py-0.5 rounded-md bg-white border border-slate-200 shadow-2xs" style={{ color }}>
        {value} / 10
      </span>
    </div>
    <input
      type="range" min={1} max={10} value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-full cursor-pointer h-1.5 rounded-full appearance-none bg-slate-200"
      style={{ accentColor: color }}
    />
    <div className="flex justify-between text-[9px] text-slate-400 font-semibold uppercase tracking-wider">
      <span>Needs Work</span><span>Mastery</span>
    </div>
  </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────

export const InterviewModule: React.FC<InterviewModuleProps> = ({
  currentUserRole = "mentor",
  currentUserName = "User",
  defaultCollegeId
}) => {
  const { currentMentor, students, mentors } = useApp();
  const { toast } = useToast();

  const isMentor = currentUserRole === "mentor";
  const isCM = currentUserRole === "cm" || currentUserRole === "cam";
  const isKAM = currentUserRole === "kam" || currentUserRole === "admin";

  const [activeTab, setActiveTab] = useState(() =>
    isCM ? "pending" : isKAM ? "overview" : "raise"
  );
  const [activeMode, setActiveMode] = useState<"internal" | "external">("internal");

  // Data
  const [interviewsList, setInterviewsList] = useState<any[]>([]);
  const [evaluationsList, setEvaluationsList] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Calendar State
  const [calendarMonth, setCalendarMonth] = useState(() => new Date());
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );

  // Raise Request Form
  const [selectedSubject, setSelectedSubject] = useState("");
  const [selectedClassGroup, setSelectedClassGroup] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [topics, setTopics] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Evaluation Form (Shadcn Split Screen)
  const [expandedRequest, setExpandedRequest] = useState<string | null>(null);
  const [studentSearchQuery, setStudentSearchQuery] = useState("");
  const [studentStatusFilter, setStudentStatusFilter] = useState<"all" | "pending" | "evaluated" | "cleared">("all");
  const [selectedStudent, setSelectedStudent] = useState<any | null>(null);

  // Per-Student Evaluation Form State
  const [evalAttendance, setEvalAttendance] = useState<"present" | "absent" | "od">("present");
  const [commScore, setCommScore] = useState(7);
  const [contentScore, setContentScore] = useState(7);
  const [techScore, setTechScore] = useState(7);
  const [confidenceScore, setConfidenceScore] = useState(7);

  // Structured Questions State ("question should be")
  const [evalQuestions, setEvalQuestions] = useState<StructuredQuestion[]>([]);
  const [newQuestionText, setNewQuestionText] = useState("");
  const [remarks, setRemarks] = useState("");
  const [isSavingEval, setIsSavingEval] = useState(false);

  // CM Allocation
  const [expandedAllocation, setExpandedAllocation] = useState<string | null>(null);
  const [mappedMentorIds, setMappedMentorIds] = useState<string[]>([]);
  const [camStudentCount, setCamStudentCount] = useState(10);
  const [cmGmeetLink, setCmGmeetLink] = useState("");
  const [isAssigning, setIsAssigning] = useState(false);
  const [isMarkingComplete, setIsMarkingComplete] = useState<string | null>(null);

  // Min date = today + 2 days
  const minTargetDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 2);
    return d.toISOString().split("T")[0];
  }, []);

  // Mentor's assigned subjects (Tamil excluded)
  const mentorSubjects = useMemo(() => {
    if (!currentMentor) return [];
    const raw = (currentMentor.subjects || "").split(/,|\n/).map(s => s.trim()).filter(Boolean);
    return Array.from(new Set(raw.filter(s => s.toLowerCase() !== "tamil")));
  }, [currentMentor]);

  // Mentor's assigned classes
  const mentorClasses = useMemo(() => {
    if (!currentMentor?.classes) {
      return Array.from(new Set(students.map(s => s.classGroup).filter(Boolean))).sort().slice(0, 10);
    }
    const raw = (currentMentor.classes || "").split(/,|\n/).map(c => c.trim()).filter(Boolean);
    return Array.from(new Set(raw));
  }, [currentMentor, students]);

  const isOnlyTamil = useMemo(() => {
    if (!currentMentor) return false;
    const raw = (currentMentor.subjects || "").split(/,|\n/).map(s => s.trim()).filter(Boolean);
    return raw.length > 0 && raw.every(s => s.toLowerCase() === "tamil");
  }, [currentMentor]);

  // Campus-scoped mentors for CM
  const campusMentors = useMemo(() => {
    if (!isCM || !defaultCollegeId) return mentors;
    return mentors.filter(m => m.college_id === defaultCollegeId);
  }, [isCM, defaultCollegeId, mentors]);

  // Fetch interviews
  const fetchInterviews = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("role", currentUserRole);
      if (currentMentor?.id) params.set("mentorId", currentMentor.id);
      if (defaultCollegeId) params.set("collegeId", defaultCollegeId);

      const res = await fetch(`/api/interviews?${params}`);
      const data = await res.json();
      if (data.success) {
        setInterviewsList(data.interviews || []);
        setEvaluationsList(data.evaluations || []);
      }
    } catch (err) {
      console.error("fetchInterviews error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchInterviews(); }, [currentMentor?.id, defaultCollegeId, currentUserRole]);

  // Auto-select first subject/class
  useEffect(() => {
    if (mentorSubjects.length > 0 && !selectedSubject) setSelectedSubject(mentorSubjects[0]);
    if (mentorClasses.length > 0 && !selectedClassGroup) setSelectedClassGroup(mentorClasses[0]);
  }, [mentorSubjects, mentorClasses]);

  // When selected student changes or session changes, initialize structured questions
  useEffect(() => {
    if (selectedStudent && expandedRequest) {
      const req = interviewsList.find(i => i.id === expandedRequest);
      const existingEval = evaluationsList.find(
        ev => ev.interview_id === expandedRequest && ev.student_id === selectedStudent.id
      );

      if (existingEval) {
        setEvalAttendance(existingEval.attendance || "present");
        setCommScore(existingEval.communication_score || 7);
        setContentScore(existingEval.content_score || 7);
        setTechScore(existingEval.technical_score || 7);
        setConfidenceScore(existingEval.confidence_score || 7);
        setRemarks(existingEval.remarks || "");

        // Parse structured questions if JSON, else wrap string
        if (existingEval.questions_asked) {
          try {
            const parsed = JSON.parse(existingEval.questions_asked);
            if (Array.isArray(parsed)) {
              setEvalQuestions(parsed);
              return;
            }
          } catch (_) {}
          // Single text fallback
          setEvalQuestions([
            { id: "q1", question: existingEval.questions_asked, maxScore: 10, score: 7, notes: "" }
          ]);
          return;
        }
      }

      // Default preset questions based on subject
      setEvalQuestions(getSubjectQuestionsPreset(req?.subject || ""));
      setEvalAttendance("present");
      setCommScore(7); setContentScore(7); setTechScore(7); setConfidenceScore(7); setRemarks("");
    }
  }, [selectedStudent, expandedRequest]);

  // ── Calendar Grid Calculations ──────────────────────────────────────────────

  const calendarDays = useMemo(() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay(); // 0 = Sun
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const days: Array<{ dateStr: string; dayNum: number; isCurrentMonth: boolean }> = [];

    // Offset for previous month days
    const prevMonthDays = new Date(year, month, 0).getDate();
    for (let i = firstDay - 1; i >= 0; i--) {
      const d = new Date(year, month - 1, prevMonthDays - i);
      days.push({
        dateStr: d.toISOString().split("T")[0],
        dayNum: prevMonthDays - i,
        isCurrentMonth: false,
      });
    }

    // Current month days
    for (let i = 1; i <= daysInMonth; i++) {
      const d = new Date(year, month, i);
      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(i).padStart(2, "0")}`;
      days.push({
        dateStr,
        dayNum: i,
        isCurrentMonth: true,
      });
    }

    return days;
  }, [calendarMonth]);

  // Map of interviews by target_date for calendar badges
  const scheduledInterviewsByDate = useMemo(() => {
    const map: Record<string, any[]> = {};
    interviewsList.forEach(item => {
      if (item.target_date) {
        if (!map[item.target_date]) map[item.target_date] = [];
        map[item.target_date].push(item);
      }
    });
    return map;
  }, [interviewsList]);

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleRaiseRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSubject) { toast("Please select a subject.", "warning"); return; }
    if (selectedSubject.toLowerCase() === "tamil") { toast("Interviews are not applicable for Tamil.", "error"); return; }
    if (!selectedClassGroup) { toast("Please select a class group.", "warning"); return; }
    if (!targetDate) { toast("Please select a target date.", "warning"); return; }
    if (targetDate < minTargetDate) { toast(`Date must be on or after ${minTargetDate}.`, "error"); return; }
    if (!topics.trim()) { toast("Please enter interview topics.", "warning"); return; }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/interviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: selectedSubject,
          class_group: selectedClassGroup,
          type: activeMode,
          target_date: targetDate,
          topics: topics.trim(),
          mentor_id: currentMentor?.id || "mentor_1",
          mentor_name: currentMentor?.name || currentUserName,
          mentor_email: currentMentor?.email || "",
          origin_college_id: currentMentor?.college_id || defaultCollegeId || "",
          college_id: currentMentor?.college_id || defaultCollegeId || "",
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast("Interview request raised & marked on calendar! CM notified.", "success");
        setTopics(""); setTargetDate("");
        fetchInterviews();
        setActiveTab("myinterviews");
      } else {
        toast(data.message || "Failed to raise request.", "error");
      }
    } catch {
      toast("Error raising interview request.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddQuestion = () => {
    if (!newQuestionText.trim()) return;
    const newQ: StructuredQuestion = {
      id: `q_${Date.now()}`,
      question: newQuestionText.trim(),
      maxScore: 10,
      score: 7,
      notes: ""
    };
    setEvalQuestions(prev => [...prev, newQ]);
    setNewQuestionText("");
  };

  const handleRemoveQuestion = (id: string) => {
    setEvalQuestions(prev => prev.filter(q => q.id !== id));
  };

  const handleUpdateQuestion = (id: string, field: "score" | "notes" | "question", val: any) => {
    setEvalQuestions(prev => prev.map(q => q.id === id ? { ...q, [field]: val } : q));
  };

  const handleSaveEval = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expandedRequest || !selectedStudent) { toast("Select a student to evaluate.", "warning"); return; }

    setIsSavingEval(true);
    try {
      // Average score combines questions score + overall skill ratings
      const qScoreSum = evalQuestions.reduce((acc, q) => acc + (Number(q.score) || 0), 0);
      const qAvg = evalQuestions.length > 0 ? qScoreSum / evalQuestions.length : 7;
      const metricsAvg = (commScore + contentScore + techScore + confidenceScore) / 4;
      const combinedScore = Math.round((qAvg + metricsAvg) / 2);

      const res = await fetch("/api/interviews/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          interview_id: expandedRequest,
          student_id: selectedStudent.id,
          student_name: selectedStudent.name,
          class_group: selectedStudent.classGroup,
          mentor_id: currentMentor?.id || "mentor_1",
          mentor_name: currentMentor?.name || currentUserName,
          attendance: evalAttendance,
          communication_score: commScore,
          content_score: contentScore,
          technical_score: techScore,
          confidence_score: confidenceScore,
          questions_asked: JSON.stringify(evalQuestions), // Structured JSON questions
          remarks,
          status: combinedScore >= 6 ? "Cleared" : "Needs Improvement",
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast(`Evaluation marks saved for ${selectedStudent.name}!`, "success");
        setSelectedStudent(null);
        fetchInterviews();
      } else {
        toast(data.message || "Failed to save evaluation.", "error");
      }
    } catch {
      toast("Error saving evaluation.", "error");
    } finally {
      setIsSavingEval(false);
    }
  };

  const handleAssign = async (interviewId: string) => {
    if (mappedMentorIds.length === 0) { toast("Select at least one mentor.", "warning"); return; }
    if (!camStudentCount || camStudentCount < 1) { toast("Set a valid student count.", "warning"); return; }

    setIsAssigning(true);
    try {
      const res = await fetch("/api/interviews/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          interview_id: interviewId,
          mapped_mentor_ids: mappedMentorIds,
          student_count: camStudentCount,
          cm_name: currentUserName,
          gmeet_link: cmGmeetLink.trim(),
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast("Mentors assigned & marked on calendar! Notification emails dispatched.", "success");
        setExpandedAllocation(null); setMappedMentorIds([]); setCmGmeetLink("");
        fetchInterviews();
      } else {
        toast(data.message || "Failed to assign.", "error");
      }
    } catch {
      toast("Error assigning interview.", "error");
    } finally {
      setIsAssigning(false);
    }
  };

  const handleExternalAccept = async (interviewId: string, action: "accept" | "decline") => {
    try {
      const res = await fetch("/api/interviews/external-accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          interview_id: interviewId,
          target_college_id: defaultCollegeId || "",
          action,
          cm_name: currentUserName,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast(data.message, "success");
        fetchInterviews();
      } else {
        toast(data.message || "Failed to process.", "error");
      }
    } catch {
      toast("Error processing external request.", "error");
    }
  };

  const handleMarkComplete = async (interviewId: string) => {
    setIsMarkingComplete(interviewId);
    try {
      const res = await fetch("/api/interviews", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          interview_id: interviewId,
          status: "completed",
          cm_name: currentUserName,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast("Interview verified & completed. Students notified!", "success");
        fetchInterviews();
      } else {
        toast(data.message || "Failed to mark complete.", "error");
      }
    } catch {
      toast("Error marking interview complete.", "error");
    } finally {
      setIsMarkingComplete(null);
    }
  };

  // ── Derived Data ─────────────────────────────────────────────────────────────

  const pendingRequests = interviewsList.filter(i =>
    (i.status || "").includes("pending")
  );

  const sessionStudents = (req: any) => {
    if (!req?.class_group) return students.slice(0, req?.student_count || 10);
    const filtered = students.filter(s =>
      (s.classGroup || "").toLowerCase().trim() === (req.class_group || "").toLowerCase().trim()
    );
    return filtered.length > 0 ? filtered : students.slice(0, req.student_count || 10);
  };

  const subjectMentorsForReq = (req: any) =>
    campusMentors.filter(m =>
      (m.subjects || "").toLowerCase().includes((req?.subject || "").toLowerCase().trim())
    );

  const getEvalForStudent = (interviewId: string, studentId: string) =>
    evaluationsList.find(ev => ev.interview_id === interviewId && ev.student_id === studentId);

  // Filtered student list for Evaluation drawer
  const activeReq = interviewsList.find(i => i.id === expandedRequest);
  const activeStudentsList = useMemo(() => {
    if (!activeReq) return [];
    let list = sessionStudents(activeReq);

    // Search query filter
    if (studentSearchQuery.trim()) {
      const q = studentSearchQuery.toLowerCase().trim();
      list = list.filter(s => s.name.toLowerCase().includes(q) || (s.register_number || "").toLowerCase().includes(q));
    }

    // Status filter
    if (studentStatusFilter === "pending") {
      list = list.filter(s => !getEvalForStudent(activeReq.id, s.id));
    } else if (studentStatusFilter === "evaluated") {
      list = list.filter(s => Boolean(getEvalForStudent(activeReq.id, s.id)));
    } else if (studentStatusFilter === "cleared") {
      list = list.filter(s => {
        const ev = getEvalForStudent(activeReq.id, s.id);
        return ev && ev.status === "Cleared";
      });
    }

    return list;
  }, [activeReq, students, studentSearchQuery, studentStatusFilter, evaluationsList]);

  // ── UI RENDER ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5 font-sans">

      {/* Header Container (Shadcn Card Style) */}
      <div className="bg-white border border-slate-200/80 rounded-xl p-5 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-[#D528A2] mb-1">
              <Award className="w-3.5 h-3.5" />
              FACE PREP E-CAMPUS • INTERVIEW MODULE
            </div>
            <h1 className="text-lg font-black text-slate-800 tracking-tight">
              {isMentor ? "Subject Interviews & Student Evaluation"
                : isCM ? "Campus Interview Management & Allocation"
                : "Interview Region Overview"}
            </h1>
            <p className="text-xs text-slate-500 mt-0.5 font-medium">
              {isMentor
                ? "Schedule interview dates, track session calendars, and evaluate students with structured question ratings."
                : isCM
                ? "Review pending requests, allocate student counts, map faculty, and verify completed interview sessions."
                : "Monitor all campus interview schedules and regional performance metrics."}
            </p>
          </div>

          {/* Navigation Pill Bar (Shadcn Tabs) */}
          <div className="flex items-center gap-1 p-1 bg-slate-100/90 rounded-xl border border-slate-200/80 shrink-0 backdrop-blur-xs">
            {isMentor && (
              <>
                {[
                  { key: "raise", label: "Raise Request", icon: <Plus className="w-3 h-3" /> },
                  { key: "myinterviews", label: "My Sessions", icon: <FileText className="w-3 h-3" /> },
                  { key: "calendar", label: "Calendar View", icon: <Calendar className="w-3 h-3" /> },
                ].map(tab => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      activeTab === tab.key
                        ? "bg-white shadow-2xs border border-slate-200/80 text-[#D528A2]"
                        : "text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    {tab.icon}{tab.label}
                  </button>
                ))}
              </>
            )}

            {isCM && (
              <>
                {[
                  { key: "pending", label: "Pending Allocations", icon: <Layers className="w-3 h-3" />, count: pendingRequests.length },
                  { key: "calendar", label: "Calendar Schedule", icon: <Calendar className="w-3 h-3" /> },
                  { key: "all", label: "All Campus", icon: <BarChart3 className="w-3 h-3" /> },
                ].map(tab => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      activeTab === tab.key
                        ? "bg-white shadow-2xs border border-slate-200/80 text-[#D528A2]"
                        : "text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    {tab.icon}{tab.label}
                    {tab.count != null && tab.count > 0 && (
                      <span className="bg-[#D528A2] text-white text-[9px] font-black px-1.5 py-0.5 rounded-full">
                        {tab.count}
                      </span>
                    )}
                  </button>
                ))}
              </>
            )}

            {isKAM && (
              <>
                <button
                  onClick={() => setActiveTab("overview")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    activeTab === "overview" ? "bg-white shadow-2xs border border-slate-200/80 text-[#D528A2]" : "text-slate-500"
                  }`}
                >
                  <ShieldCheck className="w-3 h-3" />Overview
                </button>
                <button
                  onClick={() => setActiveTab("calendar")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    activeTab === "calendar" ? "bg-white shadow-2xs border border-slate-200/80 text-[#D528A2]" : "text-slate-500"
                  }`}
                >
                  <Calendar className="w-3 h-3" />Calendar
                </button>
              </>
            )}

            <button onClick={fetchInterviews} className="p-1.5 rounded-lg text-slate-400 hover:text-[#D528A2] hover:bg-white transition-all border border-transparent hover:border-slate-200" title="Refresh">
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* ── MENTOR: Raise Request ── */}
      {isMentor && activeTab === "raise" && (
        <div className="bg-white border border-slate-200/80 rounded-xl p-5 shadow-xs">
          <div className="flex items-center gap-2 mb-5">
            <BookOpen className="w-4 h-4 text-[#D528A2]" />
            <h2 className="text-sm font-black text-slate-800">Raise New Interview Request</h2>
          </div>

          {/* Tamil-only notice */}
          {isOnlyTamil && (
            <div className="bg-amber-50 border border-amber-200/80 rounded-xl p-4 flex gap-3 text-xs text-amber-800 mb-5">
              <Info className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <strong>Notice:</strong> Interview Module features are omitted for Tamil language subjects. You do not need to raise interview requests for Tamil.
              </div>
            </div>
          )}

          {!isOnlyTamil && (
            <form onSubmit={handleRaiseRequest} className="space-y-5">
              {/* Internal/External toggle */}
              <div className="grid grid-cols-2 gap-3 max-w-sm bg-slate-100 p-1.5 rounded-xl border border-slate-200/80">
                {(["internal", "external"] as const).map(mode => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setActiveMode(mode)}
                    className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-extrabold transition-all ${
                      activeMode === mode
                        ? "bg-white shadow-2xs border border-slate-200/80 text-[#D528A2]"
                        : "text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    {mode === "internal" ? <Building className="w-3.5 h-3.5" /> : <Video className="w-3.5 h-3.5" />}
                    {mode === "internal" ? "Internal Session" : "External (GMeet)"}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Subject */}
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">
                    Subject <span className="text-[#D528A2]">(Assigned Only)</span>
                  </label>
                  <select
                    value={selectedSubject}
                    onChange={e => setSelectedSubject(e.target.value)}
                    className="w-full p-2.5 border border-slate-200 rounded-xl bg-white text-xs font-semibold focus:ring-1 focus:ring-indigo-500 outline-none cursor-pointer"
                  >
                    {mentorSubjects.length === 0
                      ? <option value="">No non-Tamil subjects assigned</option>
                      : mentorSubjects.map(s => <option key={s} value={s}>{s}</option>)
                    }
                  </select>
                  <p className="text-[10px] text-slate-400">Tamil subjects excluded automatically.</p>
                </div>

                {/* Class Group */}
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Class / Cohort</label>
                  <select
                    value={selectedClassGroup}
                    onChange={e => setSelectedClassGroup(e.target.value)}
                    className="w-full p-2.5 border border-slate-200 rounded-xl bg-white text-xs font-semibold focus:ring-1 focus:ring-indigo-500 outline-none cursor-pointer"
                  >
                    {mentorClasses.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                {/* Target Date */}
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">
                    Target Date <span className="text-[#D528A2]">(Min +2 Days)</span>
                  </label>
                  <input
                    type="date" min={minTargetDate} value={targetDate}
                    onChange={e => setTargetDate(e.target.value)}
                    className="w-full p-2.5 border border-slate-200 rounded-xl bg-white text-xs font-semibold focus:ring-1 focus:ring-indigo-500 outline-none cursor-pointer"
                    required
                  />
                  {targetDate && scheduledInterviewsByDate[targetDate] && (
                    <p className="text-[10px] font-bold text-amber-600 flex items-center gap-1 mt-1">
                      <AlertCircle className="w-3 h-3" /> {scheduledInterviewsByDate[targetDate].length} session(s) already marked on calendar for this date.
                    </p>
                  )}
                </div>
              </div>

              {/* Topics */}
              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">
                  Topics / Coverage Areas
                </label>
                <textarea
                  rows={3} value={topics}
                  onChange={e => setTopics(e.target.value)}
                  placeholder="e.g. Data Structures, React State Management, System Architecture, Algorithm Complexity"
                  className="w-full p-2.5 border border-slate-200 rounded-xl bg-white text-xs font-medium focus:ring-1 focus:ring-indigo-500 outline-none placeholder-slate-300 resize-none"
                  required
                />
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={isSubmitting || mentorSubjects.length === 0}
                  className="btn-gradient flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-extrabold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  {isSubmitting ? "Submitting..." : `Submit ${activeMode === "external" ? "External" : "Internal"} Request`}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* ── INTERACTIVE CALENDAR VIEW ── */}
      {activeTab === "calendar" && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200/80 rounded-xl p-5 shadow-xs">
            {/* Calendar Controls */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <h2 className="text-sm font-black text-slate-800 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-[#D528A2]" />
                  Interview Schedule Calendar & Marking —{" "}
                  {calendarMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                </h2>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => {
                    const prev = new Date(calendarMonth);
                    prev.setMonth(prev.getMonth() - 1);
                    setCalendarMonth(prev);
                  }}
                  className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 transition-all cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setCalendarMonth(new Date())}
                  className="px-3 py-1 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-bold text-slate-700 transition-all cursor-pointer"
                >
                  Today
                </button>
                <button
                  onClick={() => {
                    const next = new Date(calendarMonth);
                    next.setMonth(next.getMonth() + 1);
                    setCalendarMonth(next);
                  }}
                  className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 transition-all cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Calendar Grid Header */}
            <div className="grid grid-cols-7 gap-1 text-center font-bold text-[10px] text-slate-400 uppercase tracking-wider mb-2">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(day => (
                <div key={day} className="py-1">{day}</div>
              ))}
            </div>

            {/* Calendar Grid Body */}
            <div className="grid grid-cols-7 gap-1.5">
              {calendarDays.map((day, idx) => {
                const dayInterviews = scheduledInterviewsByDate[day.dateStr] || [];
                const isSelected = selectedCalendarDate === day.dateStr;
                const isToday = day.dateStr === new Date().toISOString().split("T")[0];

                return (
                  <div
                    key={idx}
                    onClick={() => setSelectedCalendarDate(day.dateStr)}
                    className={`min-h-[80px] p-2 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? "border-[#D528A2] bg-pink-50/40 ring-1 ring-[#D528A2]/30 shadow-xs"
                        : day.isCurrentMonth
                        ? "bg-white border-slate-200/90 hover:border-indigo-300"
                        : "bg-slate-50/50 border-slate-100 text-slate-300"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-extrabold ${
                        isToday
                          ? "bg-[#D528A2] text-white px-1.5 py-0.2 rounded-full text-[10px]"
                          : day.isCurrentMonth ? "text-slate-700" : "text-slate-300"
                      }`}>
                        {day.dayNum}
                      </span>
                      {dayInterviews.length > 0 && (
                        <span className="text-[9px] font-black bg-[#D528A2]/10 text-[#D528A2] px-1.5 py-0.2 rounded-full border border-[#D528A2]/20">
                          {dayInterviews.length}
                        </span>
                      )}
                    </div>

                    {/* Interview Badges inside Calendar Day Cell */}
                    <div className="space-y-1 mt-1">
                      {dayInterviews.slice(0, 2).map((inv: any) => (
                        <div
                          key={inv.id}
                          className={`text-[9px] font-bold p-1 rounded-md truncate flex items-center gap-1 ${
                            inv.type === "external"
                              ? "bg-purple-100/80 text-purple-800 border border-purple-200/60"
                              : "bg-blue-100/80 text-blue-800 border border-blue-200/60"
                          }`}
                        >
                          <span className="truncate">{inv.subject}</span>
                        </div>
                      ))}
                      {dayInterviews.length > 2 && (
                        <div className="text-[8px] font-bold text-slate-400">+{dayInterviews.length - 2} more</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Selected Date Details Panel */}
          {selectedCalendarDate && (
            <div className="bg-white border border-slate-200/80 rounded-xl p-5 shadow-xs space-y-3">
              <h3 className="text-xs font-black text-slate-800 flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#D528A2]" />
                Scheduled Interviews for Date: <span className="text-[#D528A2]">{selectedCalendarDate}</span>
              </h3>

              {(!scheduledInterviewsByDate[selectedCalendarDate] || scheduledInterviewsByDate[selectedCalendarDate].length === 0) ? (
                <p className="text-xs text-slate-400 italic">No interview sessions scheduled for this date.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {scheduledInterviewsByDate[selectedCalendarDate].map((inv: any) => (
                    <div key={inv.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-2">
                      <div className="flex items-center justify-between">
                        <StatusBadge status={inv.status} />
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${
                          inv.type === "external" ? "bg-purple-50 text-purple-700 border-purple-200" : "bg-blue-50 text-blue-700 border-blue-200"
                        }`}>
                          {(inv.type || "internal").toUpperCase()}
                        </span>
                      </div>
                      <div className="font-bold text-slate-800 text-sm">{inv.subject}</div>
                      <div className="text-xs text-slate-500 space-y-0.5">
                        <div>Cohort: <strong className="text-slate-700">{inv.class_group || "All Classes"}</strong></div>
                        <div>Requested By: <strong className="text-slate-700">{inv.mentor_name}</strong></div>
                        <div>Target Count: <strong className="text-slate-700">{inv.student_count || 10} Students</strong></div>
                      </div>
                      {inv.gmeet_link && (
                        <a href={inv.gmeet_link} target="_blank" rel="noreferrer" className="text-xs text-emerald-600 font-bold hover:underline flex items-center gap-1">
                          <Video className="w-3.5 h-3.5" /> Join GMeet Link
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── MENTOR: My Interviews & Evaluate (Shadcn Split Screen) ── */}
      {isMentor && activeTab === "myinterviews" && (
        <div className="space-y-4">
          {/* Top Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "Total Sessions", value: interviewsList.length, color: "text-slate-800" },
              { label: "Pending CM", value: interviewsList.filter(i => (i.status || "").includes("pending")).length, color: "text-amber-700" },
              { label: "Assigned", value: interviewsList.filter(i => i.status === "assigned" || i.status === "pending_verification").length, color: "text-blue-700" },
              { label: "Completed", value: interviewsList.filter(i => i.status === "completed").length, color: "text-emerald-700" },
            ].map(stat => (
              <div key={stat.label} className="bg-white border border-slate-200/80 rounded-xl p-4 shadow-2xs text-center">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{stat.label}</div>
                <div className={`text-2xl font-black mt-1 ${stat.color}`}>{stat.value}</div>
              </div>
            ))}
          </div>

          {isLoading ? (
            <div className="bg-white border border-slate-200 rounded-xl p-10 text-center text-sm text-slate-400 flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-[#D528A2]" /> Loading session records...
            </div>
          ) : interviewsList.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-10 text-center">
              <BookOpen className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-500">No interview sessions found.</p>
              <p className="text-xs text-slate-400 mt-1">Use the "Raise Request" tab to create your first interview request.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {interviewsList.map(req => {
                const isExpanded = expandedRequest === req.id;
                const reqStudents = sessionStudents(req);
                const isAssigned = req.status === "assigned" || req.status === "pending_verification" || req.status === "completed";
                const evaluatedCount = reqStudents.filter(st => Boolean(getEvalForStudent(req.id, st.id))).length;
                const progressPct = reqStudents.length > 0 ? Math.round((evaluatedCount / reqStudents.length) * 100) : 0;

                return (
                  <div key={req.id} className="bg-white border border-slate-200/80 rounded-xl shadow-xs overflow-hidden">
                    <div className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <StatusBadge status={req.status || "pending_cm"} />
                          <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${
                            req.type === "external"
                              ? "bg-purple-50 text-purple-700 border-purple-200"
                              : "bg-blue-50 text-blue-700 border-blue-200"
                          }`}>
                            {(req.type || "internal").toUpperCase()}
                          </span>
                        </div>
                        <div className="font-black text-slate-800 text-sm">{req.subject}</div>
                        <div className="text-xs text-slate-500 flex flex-wrap gap-x-4 gap-y-0.5 font-medium">
                          <span className="flex items-center gap-1"><GraduationCap className="w-3 h-3 text-[#D528A2]" />{req.class_group || "All Classes"}</span>
                          <span className="flex items-center gap-1"><Calendar className="w-3 h-3 text-[#D528A2]" />{req.target_date || "Date TBD"}</span>
                          <span className="flex items-center gap-1"><Users className="w-3 h-3 text-[#D528A2]" />
                            {req.student_count > 0 ? `${evaluatedCount}/${req.student_count} Evaluated` : "Count Pending CM"}
                          </span>
                        </div>
                      </div>

                      {isAssigned && (
                        <button
                          onClick={() => {
                            if (isExpanded) {
                              setExpandedRequest(null); setSelectedStudent(null);
                            } else {
                              setExpandedRequest(req.id); setSelectedStudent(null);
                            }
                          }}
                          className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold px-4 py-2 rounded-xl transition-all cursor-pointer shrink-0 shadow-2xs"
                        >
                          <Award className="w-3.5 h-3.5" />
                          {isExpanded ? "Close Evaluation" : "Evaluate Students"}
                          {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        </button>
                      )}
                    </div>

                    {/* ── SHADCN-STYLE EVALUATION DRAWER (SIDE-BY-SIDE PANELS) ── */}
                    {isExpanded && isAssigned && (
                      <div className="border-t border-slate-200 bg-slate-50/50 p-5 space-y-4">

                        {/* Session Progress Header */}
                        <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-2xs">
                          <div>
                            <div className="text-xs font-black text-slate-800">
                              Evaluation Progress: {evaluatedCount} of {reqStudents.length} Students ({progressPct}%)
                            </div>
                            <div className="w-full bg-slate-100 h-2 rounded-full mt-2 overflow-hidden max-w-md">
                              <div className="bg-[#D528A2] h-full rounded-full transition-all duration-500" style={{ width: `${progressPct}%` }} />
                            </div>
                          </div>
                        </div>

                        {/* Split Screen Layout: Left Student List | Right Evaluation Form */}
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">

                          {/* LEFT PANEL: Student Roster List with Search & Filter */}
                          <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-4 space-y-3 shadow-2xs">
                            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                              <span className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                                <Users className="w-3.5 h-3.5 text-[#D528A2]" /> Student Roster ({activeStudentsList.length})
                              </span>
                            </div>

                            {/* Search Input */}
                            <div className="relative">
                              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                              <input
                                type="text"
                                placeholder="Search student name..."
                                value={studentSearchQuery}
                                onChange={e => setStudentSearchQuery(e.target.value)}
                                className="w-full pl-8 pr-3 py-2 border border-slate-200 rounded-xl text-xs font-medium focus:ring-1 focus:ring-indigo-500 outline-none"
                              />
                            </div>

                            {/* Filter Tabs */}
                            <div className="flex gap-1 p-1 bg-slate-100 rounded-lg text-[10px] font-bold">
                              {(["all", "pending", "evaluated", "cleared"] as const).map(f => (
                                <button
                                  key={f}
                                  onClick={() => setStudentStatusFilter(f)}
                                  className={`flex-1 py-1 rounded-md uppercase transition-all ${
                                    studentStatusFilter === f
                                      ? "bg-white shadow-2xs text-[#D528A2] font-black"
                                      : "text-slate-500 hover:text-slate-700"
                                  }`}
                                >
                                  {f}
                                </button>
                              ))}
                            </div>

                            {/* Scrollable Student List */}
                            <div className="space-y-1.5 max-h-[480px] overflow-y-auto pr-1">
                              {activeStudentsList.length === 0 ? (
                                <p className="text-xs text-slate-400 italic py-4 text-center">No students match filter.</p>
                              ) : (
                                activeStudentsList.map(st => {
                                  const evl = getEvalForStudent(req.id, st.id);
                                  const isSelected = selectedStudent?.id === st.id;
                                  return (
                                    <div
                                      key={st.id}
                                      onClick={() => setSelectedStudent(st)}
                                      className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                                        isSelected
                                          ? "bg-indigo-50/80 border-indigo-400 shadow-2xs ring-1 ring-indigo-400/20"
                                          : evl
                                          ? "bg-emerald-50/40 border-emerald-200/80 hover:bg-emerald-50"
                                          : "bg-white border-slate-200 hover:border-slate-300"
                                      }`}
                                    >
                                      <div className="flex items-center gap-2.5 min-w-0">
                                        <div className="w-7 h-7 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 font-extrabold text-[10px] shrink-0">
                                          {st.name.charAt(0).toUpperCase()}
                                        </div>
                                        <div className="truncate">
                                          <div className="font-bold text-slate-800 text-xs truncate">{st.name}</div>
                                          <div className="text-[10px] text-slate-400 font-medium">{st.classGroup || "Cohort"}</div>
                                        </div>
                                      </div>

                                      <div className="text-right shrink-0">
                                        {evl ? (
                                          <span className="inline-block text-[9px] font-black text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-200">
                                            {evl.total_score}/10
                                          </span>
                                        ) : (
                                          <span className="inline-block text-[9px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                                            Pending
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })
                              )}
                            </div>
                          </div>

                          {/* RIGHT PANEL: Question-by-Question Evaluation Form ("question should be") */}
                          <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-5 shadow-2xs space-y-4">
                            {!selectedStudent ? (
                              <div className="py-20 text-center text-slate-400">
                                <GraduationCap className="w-10 h-10 text-slate-200 mx-auto mb-2" />
                                <p className="text-xs font-bold text-slate-600">Select a student from the list on the left to evaluate</p>
                                <p className="text-[11px] text-slate-400 mt-1">Grade per-question technical ratings & core skills</p>
                              </div>
                            ) : (
                              <form onSubmit={handleSaveEval} className="space-y-4">

                                {/* Selected Student Header */}
                                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                                  <div>
                                    <h4 className="font-black text-slate-800 text-sm flex items-center gap-2">
                                      Evaluating: {selectedStudent.name}
                                    </h4>
                                    <p className="text-[11px] text-slate-500 font-medium">{req.subject} • {selectedStudent.classGroup}</p>
                                  </div>

                                  {/* Attendance Selector */}
                                  <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl border border-slate-200">
                                    {(["present", "absent", "od"] as const).map(att => (
                                      <button
                                        key={att} type="button"
                                        onClick={() => setEvalAttendance(att)}
                                        className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase transition-all cursor-pointer ${
                                          evalAttendance === att
                                            ? att === "present" ? "bg-emerald-600 text-white"
                                              : att === "absent" ? "bg-rose-600 text-white"
                                              : "bg-amber-500 text-white"
                                            : "text-slate-500 hover:text-slate-800"
                                        }`}
                                      >{att}</button>
                                    ))}
                                  </div>
                                </div>

                                {/* ── QUESTION BY QUESTION EVALUATION SECTION ("question should be") ── */}
                                <div className="space-y-3">
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                                      <HelpCircle className="w-3.5 h-3.5 text-[#D528A2]" /> Structured Question Ratings
                                    </span>
                                    <span className="text-[10px] text-slate-400 font-bold">{evalQuestions.length} Questions</span>
                                  </div>

                                  {/* List of Dynamic Questions */}
                                  <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                                    {evalQuestions.map((qItem, idx) => (
                                      <div key={qItem.id} className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2">
                                        <div className="flex items-start justify-between gap-2">
                                          <input
                                            type="text"
                                            value={qItem.question}
                                            onChange={e => handleUpdateQuestion(qItem.id, "question", e.target.value)}
                                            className="font-bold text-xs text-slate-800 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-indigo-500 outline-none w-full"
                                          />
                                          <button
                                            type="button"
                                            onClick={() => handleRemoveQuestion(qItem.id)}
                                            className="text-slate-400 hover:text-rose-500 transition-colors p-1"
                                            title="Remove Question"
                                          >
                                            <Trash2 className="w-3.5 h-3.5" />
                                          </button>
                                        </div>

                                        {/* Question Score Slider */}
                                        <div className="flex items-center gap-3">
                                          <input
                                            type="range" min={1} max={10} value={qItem.score}
                                            onChange={e => handleUpdateQuestion(qItem.id, "score", Number(e.target.value))}
                                            className="flex-1 cursor-pointer h-1.5 rounded-full appearance-none bg-slate-200 accent-[#D528A2]"
                                          />
                                          <span className="text-xs font-black text-[#D528A2] shrink-0">{qItem.score} / 10</span>
                                        </div>
                                      </div>
                                    ))}
                                  </div>

                                  {/* Add Custom Question Button */}
                                  <div className="flex gap-2 pt-1">
                                    <input
                                      type="text"
                                      placeholder="Add custom question (e.g. Asked about REST APIs)..."
                                      value={newQuestionText}
                                      onChange={e => setNewQuestionText(e.target.value)}
                                      className="flex-1 px-3 py-1.5 border border-slate-200 rounded-xl text-xs font-medium outline-none focus:ring-1 focus:ring-indigo-500"
                                    />
                                    <button
                                      type="button"
                                      onClick={handleAddQuestion}
                                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl flex items-center gap-1 cursor-pointer transition-all shrink-0"
                                    >
                                      <Plus className="w-3.5 h-3.5" /> Add
                                    </button>
                                  </div>
                                </div>

                                {/* ── OVERALL CORE SKILLS SCORING SLIDERS ── */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                                  <ScoreSlider label="Communication Skill" emoji="🗣️" value={commScore} onChange={setCommScore} color="#D528A2" />
                                  <ScoreSlider label="Content Knowledge" emoji="📚" value={contentScore} onChange={setContentScore} color="#F4A863" />
                                  <ScoreSlider label="Technical Problem Solving" emoji="💻" value={techScore} onChange={setTechScore} color="#6366f1" />
                                  <ScoreSlider label="Confidence & Presentation" emoji="🌟" value={confidenceScore} onChange={setConfidenceScore} color="#f59e0b" />
                                </div>

                                {/* Overall Remarks */}
                                <div className="space-y-1">
                                  <label className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Mentor Overall Remarks</label>
                                  <textarea
                                    rows={2} value={remarks}
                                    onChange={e => setRemarks(e.target.value)}
                                    placeholder="e.g. Strong conceptual understanding, clear explanation..."
                                    className="w-full p-2.5 border border-slate-200 rounded-xl bg-white text-xs font-medium outline-none focus:ring-1 focus:ring-indigo-500 placeholder-slate-300 resize-none"
                                  />
                                </div>

                                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                                  <button
                                    type="button"
                                    onClick={() => setSelectedStudent(null)}
                                    className="text-xs font-bold text-slate-500 hover:text-slate-700 px-3 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 transition-all cursor-pointer"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    type="submit" disabled={isSavingEval}
                                    className="btn-gradient flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-extrabold disabled:opacity-50 cursor-pointer shadow-xs"
                                  >
                                    {isSavingEval ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                                    {isSavingEval ? "Saving..." : "Save Evaluation Marks"}
                                  </button>
                                </div>
                              </form>
                            )}
                          </div>

                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── CM: Pending Allocations ── */}
      {isCM && activeTab === "pending" && (
        <div className="space-y-4">
          {isLoading ? (
            <div className="bg-white border border-slate-200 rounded-xl p-10 text-center text-sm text-slate-400 flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-[#D528A2]" /> Loading requests...
            </div>
          ) : pendingRequests.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-10 text-center">
              <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-600">All caught up!</p>
              <p className="text-xs text-slate-400 mt-1">No pending interview allocation requests for your campus.</p>
            </div>
          ) : (
            pendingRequests.map(req => {
              const isOpen = expandedAllocation === req.id;
              const subjectMentors = subjectMentorsForReq(req);

              return (
                <div key={req.id} className="bg-white border border-slate-200/80 rounded-xl shadow-xs overflow-hidden">
                  <div className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <StatusBadge status={req.status} />
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${
                          req.type === "external"
                            ? "bg-purple-50 text-purple-700 border-purple-200"
                            : "bg-blue-50 text-blue-700 border-blue-200"
                        }`}>
                          {(req.type || "internal").toUpperCase()}
                        </span>
                      </div>
                      <div className="font-black text-slate-800">{req.subject}</div>
                      <div className="text-xs text-slate-500 flex flex-wrap gap-x-4 gap-y-0.5">
                        <span className="flex items-center gap-1"><GraduationCap className="w-3 h-3 text-[#D528A2]" />{req.class_group || "All Classes"}</span>
                        <span className="flex items-center gap-1"><Calendar className="w-3 h-3 text-[#D528A2]" />{req.target_date}</span>
                        <span className="flex items-center gap-1"><UserCheck className="w-3 h-3 text-[#D528A2]" />Requested by {req.mentor_name}</span>
                      </div>
                      {req.topics && (
                        <p className="text-[11px] text-slate-400"><strong className="text-slate-600">Topics:</strong> {req.topics}</p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {req.type === "external" && req.status === "pending_external_cm" && (
                        <>
                          <button
                            onClick={() => handleExternalAccept(req.id, "accept")}
                            className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold px-3 py-2 rounded-xl transition-all cursor-pointer"
                          >
                            <Check className="w-3.5 h-3.5" /> Accept & GMeet
                          </button>
                          <button
                            onClick={() => handleExternalAccept(req.id, "decline")}
                            className="flex items-center gap-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-extrabold px-3 py-2 rounded-xl transition-all cursor-pointer"
                          >
                            <XCircle className="w-3.5 h-3.5" /> Decline
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => {
                          if (isOpen) {
                            setExpandedAllocation(null);
                          } else {
                            setExpandedAllocation(req.id);
                            setCamStudentCount(req.student_count || 10);
                            setMappedMentorIds(req.assigned_mentor_ids ? JSON.parse(req.assigned_mentor_ids) : []);
                            setCmGmeetLink(req.gmeet_link || "");
                          }
                        }}
                        className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold px-4 py-2 rounded-xl transition-all cursor-pointer shadow-2xs"
                      >
                        <Users className="w-3.5 h-3.5" />
                        {isOpen ? "Close" : "Allocate"}
                        {isOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      </button>
                    </div>
                  </div>

                  {/* Allocation Panel */}
                  {isOpen && (
                    <div className="border-t border-slate-200 bg-slate-50/50 p-5 space-y-4">
                      <h3 className="text-xs font-black text-slate-700 flex items-center gap-2">
                        <Users className="w-4 h-4 text-[#D528A2]" />
                        Assign Student Count & Map Mentors for {req.subject}
                      </h3>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Student Count for This Session</label>
                          <input
                            type="number" min={1} max={500} value={camStudentCount}
                            onChange={e => setCamStudentCount(Number(e.target.value))}
                            className="w-full p-2.5 border border-slate-200 rounded-xl bg-white text-xs font-semibold focus:ring-1 focus:ring-indigo-500 outline-none"
                            required
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">
                            Google Meet Link <span className="text-slate-300 font-medium">(Optional)</span>
                          </label>
                          <input
                            type="url" value={cmGmeetLink}
                            onChange={e => setCmGmeetLink(e.target.value)}
                            placeholder="https://meet.google.com/xxx-xxxx-xxx"
                            className="w-full p-2.5 border border-slate-200 rounded-xl bg-white text-xs font-semibold focus:ring-1 focus:ring-indigo-500 outline-none placeholder-slate-300"
                          />
                        </div>
                      </div>

                      {/* Mentor Selector */}
                      <div className="space-y-1">
                        <label className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">
                          Available Mentors — {req.subject} at This Campus
                        </label>
                        <div className="space-y-1.5 max-h-48 overflow-y-auto">
                          {subjectMentors.length === 0 ? (
                            <p className="text-xs text-slate-400 italic py-2">
                              No mentors found for {req.subject} at this campus. You can select from all mentors below.
                            </p>
                          ) : (
                            subjectMentors.map(m => {
                              const checked = mappedMentorIds.includes(m.id);
                              return (
                                <label
                                  key={m.id}
                                  className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                                    checked
                                      ? "bg-indigo-50 border-indigo-300"
                                      : "bg-white border-slate-200 hover:border-indigo-200"
                                  }`}
                                >
                                  <input
                                    type="checkbox" checked={checked}
                                    onChange={e => {
                                      if (e.target.checked) setMappedMentorIds(prev => [...prev, m.id]);
                                      else setMappedMentorIds(prev => prev.filter(id => id !== m.id));
                                    }}
                                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                                  />
                                  <div className="flex-1 min-w-0">
                                    <div className="font-bold text-slate-800 text-xs truncate">{m.name}</div>
                                    <div className="text-[10px] text-slate-500">{m.department || "Faculty"} • {m.subjects || req.subject}</div>
                                  </div>
                                  {checked && <Check className="w-3.5 h-3.5 text-indigo-600 shrink-0" />}
                                </label>
                              );
                            })
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                        <span className="text-xs text-slate-500 font-bold">
                          {mappedMentorIds.length} mentor(s) selected
                        </span>
                        <button
                          onClick={() => handleAssign(req.id)}
                          disabled={isAssigning || mappedMentorIds.length === 0}
                          className="btn-gradient flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-extrabold disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                        >
                          {isAssigning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                          {isAssigning ? "Dispatching..." : "Assign & Mark Calendar"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ── CM: All Campus Interviews ── */}
      {isCM && activeTab === "all" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "Total Sessions", value: interviewsList.length, color: "text-slate-800" },
              { label: "Pending", value: interviewsList.filter(i => (i.status || "").includes("pending")).length, color: "text-amber-700" },
              { label: "Assigned", value: interviewsList.filter(i => i.status === "assigned" || i.status === "pending_verification").length, color: "text-blue-700" },
              { label: "Completed", value: interviewsList.filter(i => i.status === "completed").length, color: "text-emerald-700" },
            ].map(stat => (
              <div key={stat.label} className="bg-white border border-slate-200/80 rounded-xl p-4 shadow-2xs text-center">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{stat.label}</div>
                <div className={`text-2xl font-black mt-1 ${stat.color}`}>{stat.value}</div>
              </div>
            ))}
          </div>

          {isLoading ? (
            <div className="bg-white border border-slate-200 rounded-xl p-10 text-center text-sm text-slate-400 flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-[#D528A2]" /> Loading...
            </div>
          ) : interviewsList.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-10 text-center">
              <BarChart3 className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-500">No interview sessions recorded.</p>
            </div>
          ) : (
            <div className="bg-white border border-slate-200/80 rounded-xl shadow-2xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      {["Subject", "Class", "Type", "Requested By", "Target Date", "Students", "Status", "Actions"].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-[10px] font-black text-slate-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {interviewsList.map(i => (
                      <tr key={i.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3 font-bold text-slate-800 whitespace-nowrap">{i.subject}</td>
                        <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{i.class_group || "All"}</td>
                        <td className="px-4 py-3">
                          <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${
                            i.type === "external"
                              ? "bg-purple-50 text-purple-700 border-purple-200"
                              : "bg-blue-50 text-blue-700 border-blue-200"
                          }`}>{(i.type || "internal").toUpperCase()}</span>
                        </td>
                        <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{i.mentor_name || "—"}</td>
                        <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{i.target_date || "—"}</td>
                        <td className="px-4 py-3 text-slate-600 text-center">{i.student_count || "—"}</td>
                        <td className="px-4 py-3"><StatusBadge status={i.status || "pending_cm"} /></td>
                        <td className="px-4 py-3">
                          {(i.status === "assigned" || i.status === "pending_verification") && (
                            <button
                              onClick={() => handleMarkComplete(i.id)}
                              disabled={isMarkingComplete === i.id}
                              className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-extrabold px-2.5 py-1.5 rounded-lg transition-all disabled:opacity-50 cursor-pointer whitespace-nowrap shadow-2xs"
                            >
                              {isMarkingComplete === i.id
                                ? <Loader2 className="w-3 h-3 animate-spin" />
                                : <CheckCircle2 className="w-3 h-3" />
                              }
                              Mark Complete
                            </button>
                          )}
                          {i.gmeet_link && (
                            <a href={i.gmeet_link} target="_blank" rel="noreferrer"
                              className="flex items-center gap-1 text-emerald-600 text-[10px] font-bold hover:underline mt-1">
                              <Video className="w-3 h-3" /> GMeet
                            </a>
                          )}
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

      {/* ── KAM/Admin: Region Overview ── */}
      {isKAM && activeTab === "overview" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "Total Sessions", value: interviewsList.length, color: "text-slate-800" },
              { label: "Pending", value: interviewsList.filter(i => (i.status || "").includes("pending")).length, color: "text-amber-700" },
              { label: "Assigned", value: interviewsList.filter(i => i.status === "assigned" || i.status === "pending_verification").length, color: "text-blue-700" },
              { label: "Completed", value: interviewsList.filter(i => i.status === "completed").length, color: "text-emerald-700" },
            ].map(stat => (
              <div key={stat.label} className="bg-white border border-slate-200/80 rounded-xl p-4 shadow-2xs text-center">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{stat.label}</div>
                <div className={`text-2xl font-black mt-1 ${stat.color}`}>{stat.value}</div>
              </div>
            ))}
          </div>

          {isLoading ? (
            <div className="bg-white border border-slate-200 rounded-xl p-10 text-center text-sm text-slate-400 flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-[#D528A2]" /> Loading region data...
            </div>
          ) : interviewsList.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-10 text-center">
              <BarChart3 className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-500">No interview sessions recorded.</p>
            </div>
          ) : (
            <div className="bg-white border border-slate-200/80 rounded-xl shadow-2xs overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-200">
                <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-[#D528A2]" />
                  Region Interview Summary
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      {["Subject", "Class", "Type", "Requested By", "Target Date", "Students", "Status"].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-[10px] font-black text-slate-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {interviewsList.map(i => (
                      <tr key={i.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3 font-bold text-slate-800">{i.subject}</td>
                        <td className="px-4 py-3 text-slate-600">{i.class_group || "All"}</td>
                        <td className="px-4 py-3">
                          <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${
                            i.type === "external"
                              ? "bg-purple-50 text-purple-700 border-purple-200"
                              : "bg-blue-50 text-blue-700 border-blue-200"
                          }`}>{(i.type || "internal").toUpperCase()}</span>
                        </td>
                        <td className="px-4 py-3 text-slate-600">{i.mentor_name || "—"}</td>
                        <td className="px-4 py-3 text-slate-600">{i.target_date || "—"}</td>
                        <td className="px-4 py-3 text-slate-600 text-center">{i.student_count || "—"}</td>
                        <td className="px-4 py-3"><StatusBadge status={i.status || "pending_cm"} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

    </div>
  );
};
