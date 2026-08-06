"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useApp } from "../context/AppContext";
import { useToast } from "../context/ToastContext";
import {
  UserCheck, Award, BookOpen, Users, GraduationCap, CheckCircle2,
  AlertCircle, Clock, XCircle, Search, Plus, Video, Send, Check,
  Building, Calendar, MessageSquare, BarChart3, Layers, Info,
  ShieldCheck, RefreshCw, ChevronDown, ChevronUp, Star, FileText,
  ExternalLink, AlertTriangle, Loader2
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────────────────

interface InterviewModuleProps {
  currentUserRole?: "mentor" | "cm" | "cam" | "kam" | "admin" | string;
  currentUserName?: string;
  defaultCollegeId?: string;
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

const StatusBadge = ({ status }: { status: string }) => {
  const map: Record<string, string> = {
    pending_cm: "bg-amber-50 text-amber-700 border-amber-200",
    pending_external_cm: "bg-purple-50 text-purple-700 border-purple-200",
    assigned: "bg-blue-50 text-blue-700 border-blue-200",
    pending_verification: "bg-indigo-50 text-indigo-700 border-indigo-200",
    completed: "bg-emerald-50 text-emerald-700 border-emerald-200",
    cancelled: "bg-rose-50 text-rose-700 border-rose-200",
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
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black uppercase border ${cls}`}>
      {label[status] || status}
    </span>
  );
};

// ─── Score Slider ─────────────────────────────────────────────────────────────

const ScoreSlider = ({
  label, emoji, value, onChange, color = "#D528A2"
}: { label: string; emoji: string; value: number; onChange: (v: number) => void; color?: string }) => (
  <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-2 shadow-sm">
    <div className="flex justify-between items-center">
      <span className="text-xs font-bold text-slate-700">{emoji} {label}</span>
      <span className="text-sm font-black" style={{ color }}>{value} / 10</span>
    </div>
    <input
      type="range" min={1} max={10} value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-full cursor-pointer h-1.5 rounded-full appearance-none"
      style={{ accentColor: color }}
    />
    <div className="flex justify-between text-[10px] text-slate-400 font-semibold">
      <span>Needs Work</span><span>Excellent</span>
    </div>
  </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────

export const InterviewModule: React.FC<InterviewModuleProps> = ({
  currentUserRole = "mentor",
  currentUserName = "User",
  defaultCollegeId
}) => {
  const { currentMentor, students, mentors, currentCAM, currentKAM } = useApp();
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

  // Raise Request form
  const [selectedSubject, setSelectedSubject] = useState("");
  const [selectedClassGroup, setSelectedClassGroup] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [topics, setTopics] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Evaluate form
  const [expandedRequest, setExpandedRequest] = useState<string | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<any | null>(null);
  const [evalAttendance, setEvalAttendance] = useState<"present" | "absent" | "od">("present");
  const [commScore, setCommScore] = useState(7);
  const [contentScore, setContentScore] = useState(7);
  const [techScore, setTechScore] = useState(7);
  const [confidenceScore, setConfidenceScore] = useState(7);
  const [questionsAsked, setQuestionsAsked] = useState("");
  const [remarks, setRemarks] = useState("");
  const [isSavingEval, setIsSavingEval] = useState(false);

  // CM allocation
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
        toast("Interview request raised! Campus Manager has been notified.", "success");
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

  const handleSaveEval = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expandedRequest || !selectedStudent) { toast("Select a student to evaluate.", "warning"); return; }

    setIsSavingEval(true);
    try {
      const avgScore = (commScore + contentScore + techScore + confidenceScore) / 4;
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
          questions_asked: questionsAsked,
          remarks,
          status: avgScore >= 6 ? "Cleared" : "Needs Improvement",
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast(`Evaluation saved for ${selectedStudent.name}!`, "success");
        setSelectedStudent(null); setQuestionsAsked(""); setRemarks("");
        setCommScore(7); setContentScore(7); setTechScore(7); setConfidenceScore(7);
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
        toast("Mentors assigned! Notification emails dispatched.", "success");
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

  // ── Derived data ─────────────────────────────────────────────────────────────

  const pendingRequests = interviewsList.filter(i =>
    (i.status || "").includes("pending")
  );

  const sessionStudents = (req: any) => {
    if (!req?.class_group) return students.slice(0, req?.student_count || 10);
    const filtered = students.filter(s =>
      (s.classGroup || "").toLowerCase().trim() === (req.class_group || "").toLowerCase().trim()
    );
    return filtered.length > 0 ? filtered.slice(0, req.student_count || 30) : students.slice(0, req.student_count || 10);
  };

  const subjectMentorsForReq = (req: any) =>
    campusMentors.filter(m =>
      (m.subjects || "").toLowerCase().includes((req?.subject || "").toLowerCase().trim())
    );

  const getEvalForStudent = (interviewId: string, studentId: string) =>
    evaluationsList.find(ev => ev.interview_id === interviewId && ev.student_id === studentId);

  // ── UI ────────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="bg-white border border-slate-200/80 rounded-xl p-5 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-[#D528A2] mb-1">
              <Award className="w-3.5 h-3.5" />
              FACE PREP E-CAMPUS • INTERVIEW MODULE
            </div>
            <h1 className="text-lg font-black text-slate-800">
              {isMentor ? "Subject Interviews & Student Evaluation"
                : isCM ? "Campus Interview Management"
                : "Interview Region Overview"}
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              {isMentor
                ? "Raise interview requests for assigned subjects (min 2 days advance) and evaluate your students."
                : isCM
                ? "Review requests, allocate student counts, map mentors, and verify completed sessions."
                : "Monitor all campus interview sessions and evaluation metrics."}
            </p>
          </div>

          {/* Tab bar */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl border border-slate-200 shrink-0">
            {isMentor && (
              <>
                {[
                  { key: "raise", label: "Raise Request", icon: <Plus className="w-3 h-3" /> },
                  { key: "myinterviews", label: "My Interviews", icon: <FileText className="w-3 h-3" /> },
                ].map(tab => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      activeTab === tab.key
                        ? "bg-white shadow-sm border border-slate-200 text-[#D528A2]"
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
                  { key: "all", label: "All Campus", icon: <BarChart3 className="w-3 h-3" /> },
                ].map(tab => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      activeTab === tab.key
                        ? "bg-white shadow-sm border border-slate-200 text-[#D528A2]"
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
              <button
                onClick={() => setActiveTab("overview")}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-white shadow-sm border border-slate-200 text-[#D528A2]"
              >
                <ShieldCheck className="w-3 h-3" />Region Overview
              </button>
            )}

            <button onClick={fetchInterviews} className="p-1.5 rounded-lg text-slate-400 hover:text-[#D528A2] hover:bg-white transition-all border border-transparent hover:border-slate-200" title="Refresh">
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* ── MENTOR: Raise Request ── */}
      {isMentor && activeTab === "raise" && (
        <div className="bg-white border border-slate-200/80 rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-5">
            <BookOpen className="w-4 h-4 text-[#D528A2]" />
            <h2 className="text-sm font-black text-slate-800">Raise New Interview Request</h2>
          </div>

          {/* Tamil-only notice */}
          {isOnlyTamil && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3 text-xs text-amber-800 mb-5">
              <Info className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <strong>Notice:</strong> Interview Module is not applicable for Tamil language subjects. You do not need to raise interview evaluations for Tamil.
              </div>
            </div>
          )}

          {!isOnlyTamil && (
            <form onSubmit={handleRaiseRequest} className="space-y-5">
              {/* Internal/External toggle */}
              <div className="grid grid-cols-2 gap-3 max-w-sm bg-slate-100 p-1.5 rounded-xl border border-slate-200">
                {(["internal", "external"] as const).map(mode => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setActiveMode(mode)}
                    className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-extrabold transition-all ${
                      activeMode === mode
                        ? "bg-white shadow-sm border border-slate-200 text-[#D528A2]"
                        : "text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    {mode === "internal" ? <Building className="w-3.5 h-3.5" /> : <Video className="w-3.5 h-3.5" />}
                    {mode === "internal" ? "Internal" : "External (GMeet)"}
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
                    className="w-full p-2.5 border border-slate-200 rounded-xl bg-white text-xs font-semibold focus:ring-1 focus:ring-indigo-500 outline-none"
                  >
                    {mentorSubjects.length === 0
                      ? <option value="">No non-Tamil subjects assigned</option>
                      : mentorSubjects.map(s => <option key={s} value={s}>{s}</option>)
                    }
                  </select>
                  <p className="text-[10px] text-slate-400">Tamil subjects are excluded.</p>
                </div>

                {/* Class Group */}
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Class / Cohort</label>
                  <select
                    value={selectedClassGroup}
                    onChange={e => setSelectedClassGroup(e.target.value)}
                    className="w-full p-2.5 border border-slate-200 rounded-xl bg-white text-xs font-semibold focus:ring-1 focus:ring-indigo-500 outline-none"
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
                  placeholder="e.g. Data Structures, React Hooks, System Design, Algorithm Complexity"
                  className="w-full p-2.5 border border-slate-200 rounded-xl bg-white text-xs font-semibold focus:ring-1 focus:ring-indigo-500 outline-none placeholder-slate-300 resize-none"
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

      {/* ── MENTOR: My Interviews & Evaluate ── */}
      {isMentor && activeTab === "myinterviews" && (
        <div className="space-y-4">
          {/* Stats row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "Total Raised", value: interviewsList.length, color: "text-slate-800" },
              { label: "Pending CM", value: interviewsList.filter(i => (i.status || "").includes("pending")).length, color: "text-amber-700" },
              { label: "Assigned", value: interviewsList.filter(i => i.status === "assigned" || i.status === "pending_verification").length, color: "text-blue-700" },
              { label: "Completed", value: interviewsList.filter(i => i.status === "completed").length, color: "text-emerald-700" },
            ].map(stat => (
              <div key={stat.label} className="bg-white border border-slate-200/80 rounded-xl p-4 shadow-sm text-center">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{stat.label}</div>
                <div className={`text-2xl font-black mt-1 ${stat.color}`}>{stat.value}</div>
              </div>
            ))}
          </div>

          {isLoading ? (
            <div className="bg-white border border-slate-200 rounded-xl p-10 text-center text-sm text-slate-400 flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-[#D528A2]" /> Loading your interviews...
            </div>
          ) : interviewsList.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-10 text-center">
              <BookOpen className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-500">No interview requests yet.</p>
              <p className="text-xs text-slate-400 mt-1">Use the "Raise Request" tab to create your first interview request.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {interviewsList.map(req => {
                const isExpanded = expandedRequest === req.id;
                const reqStudents = sessionStudents(req);
                const isAssigned = req.status === "assigned" || req.status === "pending_verification";
                const isVerified = req.status === "completed";

                return (
                  <div key={req.id} className="bg-white border border-slate-200/80 rounded-xl shadow-sm overflow-hidden">
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
                        <div className="text-xs text-slate-500 flex flex-wrap gap-x-4 gap-y-0.5">
                          <span className="flex items-center gap-1"><GraduationCap className="w-3 h-3" />{req.class_group || "All Classes"}</span>
                          <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{req.target_date || "Date TBD"}</span>
                          <span className="flex items-center gap-1"><Users className="w-3 h-3" />
                            {req.student_count > 0 ? `${req.student_count} Students` : "Count Pending CM"}
                          </span>
                        </div>
                        {req.topics && (
                          <p className="text-[11px] text-slate-400">
                            <strong className="text-slate-600">Topics:</strong> {req.topics}
                          </p>
                        )}
                        {req.gmeet_link && (
                          <a href={req.gmeet_link} target="_blank" rel="noreferrer"
                            className="text-[11px] text-emerald-600 hover:underline flex items-center gap-1 font-bold">
                            <Video className="w-3 h-3" /> Join Google Meet
                          </a>
                        )}
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
                          className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold px-4 py-2 rounded-xl transition-all shrink-0"
                        >
                          <Award className="w-3.5 h-3.5" />
                          {isExpanded ? "Close" : "Conduct & Evaluate"}
                          {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        </button>
                      )}
                    </div>

                    {/* Evaluation panel */}
                    {isExpanded && isAssigned && (
                      <div className="border-t border-slate-200 bg-slate-50 p-5 space-y-5">
                        {/* Student grid */}
                        <div>
                          <h3 className="text-xs font-black text-slate-700 mb-3 flex items-center gap-2">
                            <GraduationCap className="w-4 h-4 text-[#D528A2]" />
                            Select Student to Evaluate — {req.class_group || "All Cohorts"}
                            {!isVerified && (
                              <span className="text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full ml-1">
                                Scores Pending CM Verification
                              </span>
                            )}
                          </h3>
                          {reqStudents.length === 0 ? (
                            <p className="text-xs text-slate-400 italic">No students found for {req.class_group}.</p>
                          ) : (
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                              {reqStudents.map(st => {
                                const evl = getEvalForStudent(req.id, st.id);
                                const isSelected = selectedStudent?.id === st.id;
                                return (
                                  <button
                                    key={st.id}
                                    onClick={() => setSelectedStudent(isSelected ? null : st)}
                                    className={`text-left p-3 rounded-xl border transition-all text-xs ${
                                      isSelected
                                        ? "bg-indigo-50 border-indigo-400 shadow-sm"
                                        : evl
                                        ? "bg-emerald-50 border-emerald-200"
                                        : "bg-white border-slate-200 hover:border-indigo-300"
                                    }`}
                                  >
                                    <div className="font-bold text-slate-800 truncate">{st.name}</div>
                                    <div className="text-[10px] text-slate-500 mt-0.5">{st.classGroup}</div>
                                    {evl ? (
                                      <div className="mt-1.5 space-y-0.5">
                                        <span className="text-[10px] font-black text-emerald-700 bg-emerald-100 border border-emerald-200 px-1.5 py-0.5 rounded-full">
                                          Evaluated {evl.total_score}/10
                                        </span>
                                        {!isVerified && (
                                          <div className="text-[9px] text-amber-600 font-semibold">Pending CM Review</div>
                                        )}
                                      </div>
                                    ) : (
                                      <span className="mt-1.5 text-[10px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full">
                                        Pending
                                      </span>
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        {/* Eval form */}
                        {selectedStudent && (
                          <form onSubmit={handleSaveEval} className="border border-slate-200 rounded-xl bg-white p-5 space-y-5">
                            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                              <div>
                                <h4 className="font-black text-slate-800 text-sm">Evaluating: {selectedStudent.name}</h4>
                                <p className="text-[11px] text-slate-500">{req.subject} • {selectedStudent.classGroup}</p>
                              </div>
                              {/* Attendance */}
                              <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl border border-slate-200">
                                {(["present", "absent", "od"] as const).map(att => (
                                  <button
                                    key={att} type="button"
                                    onClick={() => setEvalAttendance(att)}
                                    className={`px-3 py-1.5 rounded-lg text-[10px] font-extrabold uppercase transition-all ${
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

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <ScoreSlider label="Communication Skill" emoji="🗣️" value={commScore} onChange={setCommScore} color="#D528A2" />
                              <ScoreSlider label="Content Knowledge" emoji="📚" value={contentScore} onChange={setContentScore} color="#F4A863" />
                              <ScoreSlider label="Technical / Problem Solving" emoji="💻" value={techScore} onChange={setTechScore} color="#6366f1" />
                              <ScoreSlider label="Confidence & Presentation" emoji="🌟" value={confidenceScore} onChange={setConfidenceScore} color="#f59e0b" />
                            </div>

                            {/* Overall score preview */}
                            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center justify-between">
                              <span className="text-xs font-bold text-slate-600">Average Score</span>
                              <span className={`text-sm font-black ${
                                (commScore + contentScore + techScore + confidenceScore) / 4 >= 6
                                  ? "text-emerald-600" : "text-rose-600"
                              }`}>
                                {((commScore + contentScore + techScore + confidenceScore) / 4).toFixed(1)} / 10 —{" "}
                                {(commScore + contentScore + techScore + confidenceScore) / 4 >= 6 ? "Cleared" : "Needs Improvement"}
                              </span>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="space-y-1">
                                <label className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Questions Asked</label>
                                <textarea
                                  rows={2} value={questionsAsked}
                                  onChange={e => setQuestionsAsked(e.target.value)}
                                  placeholder="e.g. Asked about React useEffect, Database joins..."
                                  className="w-full p-2.5 border border-slate-200 rounded-xl bg-white text-xs font-medium focus:ring-1 focus:ring-indigo-500 outline-none placeholder-slate-300 resize-none"
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Mentor Remarks</label>
                                <textarea
                                  rows={2} value={remarks}
                                  onChange={e => setRemarks(e.target.value)}
                                  placeholder="e.g. Good concept clarity, needs confidence improvement..."
                                  className="w-full p-2.5 border border-slate-200 rounded-xl bg-white text-xs font-medium focus:ring-1 focus:ring-indigo-500 outline-none placeholder-slate-300 resize-none"
                                />
                              </div>
                            </div>

                            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                              <button
                                type="button"
                                onClick={() => setSelectedStudent(null)}
                                className="text-xs font-bold text-slate-500 hover:text-slate-700 px-3 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 transition-all"
                              >
                                Cancel
                              </button>
                              <button
                                type="submit" disabled={isSavingEval}
                                className="btn-gradient flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-extrabold disabled:opacity-50"
                              >
                                {isSavingEval ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                                {isSavingEval ? "Saving..." : "Save Evaluation Marks"}
                              </button>
                            </div>
                          </form>
                        )}
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
                <div key={req.id} className="bg-white border border-slate-200/80 rounded-xl shadow-sm overflow-hidden">
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
                        <span className="flex items-center gap-1"><GraduationCap className="w-3 h-3" />{req.class_group || "All Classes"}</span>
                        <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{req.target_date}</span>
                        <span className="flex items-center gap-1"><UserCheck className="w-3 h-3" />Requested by {req.mentor_name}</span>
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
                            className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold px-3 py-2 rounded-xl transition-all"
                          >
                            <Check className="w-3.5 h-3.5" /> Accept & GMeet
                          </button>
                          <button
                            onClick={() => handleExternalAccept(req.id, "decline")}
                            className="flex items-center gap-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-extrabold px-3 py-2 rounded-xl transition-all"
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
                        className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold px-4 py-2 rounded-xl transition-all"
                      >
                        <Users className="w-3.5 h-3.5" />
                        {isOpen ? "Close" : "Allocate"}
                        {isOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      </button>
                    </div>
                  </div>

                  {/* Allocation panel */}
                  {isOpen && (
                    <div className="border-t border-slate-200 bg-slate-50 p-5 space-y-4">
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

                      {/* Mentor selector */}
                      <div className="space-y-1">
                        <label className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">
                          Available Mentors — {req.subject} at This Campus
                          {subjectMentors.length === 0 && <span className="text-rose-500 ml-1">(None found for this subject)</span>}
                        </label>
                        <div className="space-y-1.5 max-h-48 overflow-y-auto">
                          {subjectMentors.length === 0 ? (
                            <p className="text-xs text-slate-400 italic py-2">
                              No mentors found for {req.subject} at this campus. You can still assign a general mentor below.
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
                          className="btn-gradient flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-extrabold disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isAssigning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                          {isAssigning ? "Dispatching..." : "Assign & Notify Mentors"}
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
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "Total Sessions", value: interviewsList.length, color: "text-slate-800" },
              { label: "Pending", value: interviewsList.filter(i => (i.status || "").includes("pending")).length, color: "text-amber-700" },
              { label: "Assigned", value: interviewsList.filter(i => i.status === "assigned" || i.status === "pending_verification").length, color: "text-blue-700" },
              { label: "Completed", value: interviewsList.filter(i => i.status === "completed").length, color: "text-emerald-700" },
            ].map(stat => (
              <div key={stat.label} className="bg-white border border-slate-200/80 rounded-xl p-4 shadow-sm text-center">
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
              <p className="text-sm font-semibold text-slate-500">No interview sessions yet.</p>
            </div>
          ) : (
            <div className="bg-white border border-slate-200/80 rounded-xl shadow-sm overflow-hidden">
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
                              className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-extrabold px-2.5 py-1.5 rounded-lg transition-all disabled:opacity-50 whitespace-nowrap"
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
              <div key={stat.label} className="bg-white border border-slate-200/80 rounded-xl p-4 shadow-sm text-center">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{stat.label}</div>
                <div className={`text-2xl font-black mt-1 ${stat.color}`}>{stat.value}</div>
              </div>
            ))}
          </div>

          {isLoading ? (
            <div className="bg-white border border-slate-200 rounded-xl p-10 text-center text-sm text-slate-400 flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-[#D528A2]" /> Loading all campus data...
            </div>
          ) : interviewsList.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-10 text-center">
              <BarChart3 className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-500">No interview sessions across region yet.</p>
            </div>
          ) : (
            <div className="bg-white border border-slate-200/80 rounded-xl shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-200">
                <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-[#D528A2]" />
                  All Interview Sessions — Region View
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
