"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useApp } from "../context/AppContext";
import { useToast } from "../context/ToastContext";
import {
  UserCheck,
  Award,
  BookOpen,
  Users,
  GraduationCap,
  CheckCircle2,
  AlertCircle,
  Clock,
  XCircle,
  Search,
  Filter,
  Trash2,
  Sparkles,
  ChevronRight,
  FileText,
  Star,
  Plus,
  Video,
  Send,
  Check,
  Building,
  Calendar,
  MessageSquare,
  BarChart3,
  Layers,
  Info,
  ShieldCheck
} from "lucide-react";
import { Button } from "./Button";
import { Card } from "./Card";

interface InterviewModuleProps {
  currentUserRole?: "mentor" | "cm" | "cam" | "kam" | "admin" | string;
  currentUserName?: string;
  defaultCollegeId?: string;
}

export const InterviewModule: React.FC<InterviewModuleProps> = ({
  currentUserRole = "mentor",
  currentUserName = "Evaluator",
  defaultCollegeId
}) => {
  const { currentMentor, students, subjectsList, mentors, slots, colleges } = useApp();
  const { toast } = useToast();

  const isMentor = currentUserRole === "mentor";
  const isCM = currentUserRole === "cm" || currentUserRole === "cam";
  const isAdminOrKAM = currentUserRole === "admin" || currentUserRole === "kam";

  // Tab State scoped by Role:
  const [activeTab, setActiveTab] = useState<string>(() => {
    if (isCM) return "allocation";
    if (isAdminOrKAM) return "overview";
    return "raise";
  });

  const [activeMode, setActiveMode] = useState<"internal" | "external">("internal");
  
  // Data states from backend API
  const [interviewsList, setInterviewsList] = useState<any[]>([]);
  const [evaluationsList, setEvaluationsList] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Form states for Raise Request (Subject, Class Group, Target Date, Topics)
  const [selectedSubject, setSelectedSubject] = useState<string>("");
  const [selectedClassGroup, setSelectedClassGroup] = useState<string>("");
  const [targetDate, setTargetDate] = useState<string>("");
  const [topics, setTopics] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Selected Request for Conducting Evaluation or CM Assignment
  const [selectedRequest, setSelectedRequest] = useState<any | null>(null);
  const [selectedStudentForEval, setSelectedStudentForEval] = useState<any | null>(null);

  // Multi-Criteria Marking States
  const [evalAttendance, setEvalAttendance] = useState<"present" | "absent" | "od">("present");
  const [commScore, setCommScore] = useState<number>(8);
  const [contentScore, setContentScore] = useState<number>(8);
  const [techScore, setTechScore] = useState<number>(8);
  const [confidenceScore, setConfidenceScore] = useState<number>(8);
  const [questionsAsked, setQuestionsAsked] = useState<string>("");
  const [remarks, setRemarks] = useState<string>("");
  const [isSavingEval, setIsSavingEval] = useState<boolean>(false);

  // CM Mapping & Student Split state
  const [mappedMentorIds, setMappedMentorIds] = useState<string[]>([]);
  const [camStudentCount, setCamStudentCount] = useState<number>(10);
  const [isAssigning, setIsAssigning] = useState<boolean>(false);

  // Calculate minimum allowed target date (Today + 2 days)
  const minTargetDateStr = useMemo(() => {
    const minD = new Date();
    minD.setDate(minD.getDate() + 2);
    return minD.toISOString().split("T")[0];
  }, []);

  // Mentor's Assigned Subjects (Excluding Tamil)
  const mentorAssignedSubjects = useMemo(() => {
    if (!currentMentor) {
      return subjectsList
        .map(s => s.name)
        .filter(name => Boolean(name) && name.trim().toLowerCase() !== "tamil");
    }
    const rawList = (currentMentor.subjects || "").split(/,|\n/).map(s => s.trim()).filter(Boolean);
    const filtered = rawList.filter(subj => subj.toLowerCase() !== "tamil");
    return Array.from(new Set(filtered));
  }, [currentMentor, subjectsList]);

  // Mentor's Assigned Classes / Class Groups
  const mentorAssignedClasses = useMemo(() => {
    if (!currentMentor || !currentMentor.classes) {
      const allGroups = Array.from(new Set(students.map(s => s.classGroup).filter(Boolean))).sort();
      return allGroups.length > 0 ? allGroups : ["CSE-2024 (2024-2028)"];
    }
    const rawList = (currentMentor.classes || "").split(/,|\n/).map(c => c.trim()).filter(Boolean);
    return Array.from(new Set(rawList));
  }, [currentMentor, students]);

  // Check if Tamil is mentor's ONLY subject
  const isOnlyTamilMentor = useMemo(() => {
    if (!currentMentor) return false;
    const rawList = (currentMentor.subjects || "").split(/,|\n/).map(s => s.trim()).filter(Boolean);
    return rawList.length > 0 && rawList.every(s => s.toLowerCase() === "tamil");
  }, [currentMentor]);

  // Fetch interviews & evaluations from API
  const fetchInterviews = async () => {
    setIsLoading(true);
    try {
      const queryParams = new URLSearchParams();
      if (currentMentor?.id) queryParams.set("mentorId", currentMentor.id);
      if (defaultCollegeId) queryParams.set("collegeId", defaultCollegeId);
      queryParams.set("role", currentUserRole);

      const res = await fetch(`/api/interviews?${queryParams.toString()}`);
      const data = await res.json();
      if (data.success) {
        setInterviewsList(data.interviews || []);
        setEvaluationsList(data.evaluations || []);
      }
    } catch (err) {
      console.error("Error fetching interviews:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchInterviews();
  }, [currentMentor?.id, defaultCollegeId, currentUserRole]);

  // Auto-select first available non-Tamil subject & class group
  useEffect(() => {
    if (mentorAssignedSubjects.length > 0 && !selectedSubject) {
      setSelectedSubject(mentorAssignedSubjects[0]);
    }
    if (mentorAssignedClasses.length > 0 && !selectedClassGroup) {
      setSelectedClassGroup(mentorAssignedClasses[0]);
    }
  }, [mentorAssignedSubjects, mentorAssignedClasses, selectedSubject, selectedClassGroup]);

  // Filter students for evaluation by selected request's class_group
  const sessionStudents = useMemo(() => {
    if (!selectedRequest) return students;
    if (selectedRequest.class_group) {
      const targetClass = selectedRequest.class_group.toLowerCase().trim();
      const filtered = students.filter(s => (s.classGroup || "").toLowerCase().trim() === targetClass);
      if (filtered.length > 0) return filtered;
    }
    return students;
  }, [selectedRequest, students]);

  // Handler: Mentor Raises Request (Includes Class Selection)
  const handleRaiseRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSubject) {
      toast("Please select a valid subject.", "warning");
      return;
    }
    if (selectedSubject.toLowerCase() === "tamil") {
      toast("Interview Module features are not applicable for Tamil.", "error");
      return;
    }
    if (!selectedClassGroup) {
      toast("Please select a valid class / class group.", "warning");
      return;
    }
    if (!targetDate) {
      toast("Please select a target date.", "warning");
      return;
    }
    if (targetDate < minTargetDateStr) {
      toast(`Interview date must be at least 2 days in advance (on or after ${minTargetDateStr}).`, "error");
      return;
    }

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
          topics,
          student_count: 0, // Assigned later by CAM
          mentor_id: currentMentor?.id || "mentor_1",
          mentor_name: currentMentor?.name || currentUserName,
          origin_college_id: currentMentor?.college_id || defaultCollegeId || "col_1"
        })
      });

      const data = await res.json();
      if (data.success) {
        toast(`Interview request raised for ${selectedClassGroup}! Sent to Campus Manager for student allocation.`, "success");
        setTopics("");
        setTargetDate("");
        fetchInterviews();
        setActiveTab("evaluate");
      } else {
        toast(data.message || "Failed to raise request.", "error");
      }
    } catch (err) {
      toast("An error occurred while raising interview request.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handler: CAM Assigns Student Count & Maps Mentors
  const handleAssignMentors = async (interviewId: string) => {
    if (mappedMentorIds.length === 0) {
      toast("Please select at least one mentor to map.", "warning");
      return;
    }
    if (!camStudentCount || camStudentCount < 1) {
      toast("Please set a valid student count for this session.", "warning");
      return;
    }

    setIsAssigning(true);
    try {
      const res = await fetch("/api/interviews/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          interview_id: interviewId,
          mapped_mentor_ids: mappedMentorIds,
          student_count: camStudentCount,
          cm_name: currentUserName
        })
      });

      const data = await res.json();
      if (data.success) {
        toast("Student count assigned & mentors mapped with notification emails dispatched!", "success");
        setSelectedRequest(null);
        setMappedMentorIds([]);
        fetchInterviews();
      } else {
        toast(data.message || "Failed to map mentors.", "error");
      }
    } catch (err) {
      toast("Failed to assign mentors.", "error");
    } finally {
      setIsAssigning(false);
    }
  };

  // Handler: External CM Accepts Request
  const handleExternalAccept = async (interviewId: string, action: "accept" | "decline") => {
    try {
      const res = await fetch("/api/interviews/external-accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          interview_id: interviewId,
          target_college_id: defaultCollegeId || "col_2",
          action,
          cm_name: currentUserName
        })
      });

      const data = await res.json();
      if (data.success) {
        toast(data.message, "success");
        fetchInterviews();
      } else {
        toast(data.message || "Failed to process external request.", "error");
      }
    } catch (err) {
      toast("Error processing external request.", "error");
    }
  };

  // Handler: Conducting Mentor Submits Evaluation & Marks
  const handleSubmitEvaluation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRequest || !selectedStudentForEval) {
      toast("Please select a student to evaluate.", "warning");
      return;
    }

    setIsSavingEval(true);
    try {
      const res = await fetch("/api/interviews/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          interview_id: selectedRequest.id,
          student_id: selectedStudentForEval.id,
          student_name: selectedStudentForEval.name,
          class_group: selectedStudentForEval.classGroup,
          mentor_id: currentMentor?.id || "mentor_1",
          mentor_name: currentMentor?.name || currentUserName,
          attendance: evalAttendance,
          communication_score: commScore,
          content_score: contentScore,
          technical_score: techScore,
          confidence_score: confidenceScore,
          questions_asked: questionsAsked,
          remarks,
          status: (commScore + contentScore + techScore + confidenceScore) / 4 >= 6 ? "Cleared" : "Needs Improvement"
        })
      });

      const data = await res.json();
      if (data.success) {
        toast("Student evaluation and multi-criteria marks saved!", "success");
        setQuestionsAsked("");
        setRemarks("");
        setSelectedStudentForEval(null);
        fetchInterviews();
      } else {
        toast(data.message || "Failed to save evaluation.", "error");
      }
    } catch (err) {
      toast("Error saving evaluation.", "error");
    } finally {
      setIsSavingEval(false);
    }
  };

  // Find available subject mentors for CM free-slot mapping
  const availableSubjectMentors = useMemo(() => {
    if (!selectedRequest) return mentors;
    const targetSubj = selectedRequest.subject.toLowerCase().trim();
    return mentors.filter(m => {
      const mSubjs = (m.subjects || "").toLowerCase();
      return mSubjs.includes(targetSubj);
    });
  }, [selectedRequest, mentors]);

  return (
    <div className="space-y-6">
      {/* Top Banner Card */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-2xl p-6 text-white shadow-xl border border-slate-800 relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 w-72 h-72 bg-gradient-to-br from-[#D528A2]/20 to-[#F4A863]/20 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider mb-1 text-transparent bg-clip-text bg-gradient-to-r from-[#D528A2] to-[#F4A863]">
              <Sparkles className="w-4 h-4 text-[#D528A2]" />
              FACE PREP E-CAMPUS • {isMentor ? "MENTOR PORTAL" : isCM ? "CAMPUS MANAGER WORKFLOW" : "INTERVIEW DASHBOARD"}
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white">
              {isMentor ? "My Subject Interviews & Student Marking" : isCM ? "Campus Interview Routing & Allocation" : "Interview & Evaluation Management"}
            </h1>
            <p className="text-slate-300/80 text-xs md:text-sm mt-1 max-w-2xl">
              {isMentor
                ? "Raise interview requests for your assigned subjects & class groups (minimum 2 days in advance) and evaluate assigned students."
                : isCM
                ? "Review interview requests, assign student counts, check free-period mentor slots, split students, and manage external GMeet links."
                : "Monitor all campus interview sessions, mentor mappings, and evaluation performance metrics."}
            </p>
          </div>

          {/* Sub-Navigation Tabs STRICTLY SCOPED BY ROLE */}
          <div className="flex items-center gap-2 bg-slate-800/80 p-1.5 rounded-xl border border-slate-700/60 backdrop-blur-md">
            {/* Mentor Options Only */}
            {isMentor && (
              <>
                <button
                  onClick={() => setActiveTab("raise")}
                  className={`px-4 py-2 rounded-lg text-xs font-extrabold transition-all flex items-center gap-1.5 ${
                    activeTab === "raise"
                      ? "bg-gradient-to-r from-[#D528A2] to-[#F4A863] text-white shadow-md shadow-pink-500/20"
                      : "text-slate-300 hover:text-white hover:bg-slate-700/50"
                  }`}
                >
                  <Plus className="w-3.5 h-3.5" />
                  Raise Request
                </button>
                <button
                  onClick={() => setActiveTab("evaluate")}
                  className={`px-4 py-2 rounded-lg text-xs font-extrabold transition-all flex items-center gap-1.5 ${
                    activeTab === "evaluate"
                      ? "bg-gradient-to-r from-[#D528A2] to-[#F4A863] text-white shadow-md shadow-pink-500/20"
                      : "text-slate-300 hover:text-white hover:bg-slate-700/50"
                  }`}
                >
                  <Award className="w-3.5 h-3.5" />
                  Conduct & Mark Students
                </button>
              </>
            )}

            {/* Campus Manager Options Only */}
            {isCM && (
              <>
                <button
                  onClick={() => setActiveTab("allocation")}
                  className={`px-4 py-2 rounded-lg text-xs font-extrabold transition-all flex items-center gap-1.5 ${
                    activeTab === "allocation"
                      ? "bg-gradient-to-r from-[#D528A2] to-[#F4A863] text-white shadow-md shadow-pink-500/20"
                      : "text-slate-300 hover:text-white hover:bg-slate-700/50"
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  Pending Allocations & GMeet
                  {interviewsList.filter(i => i.status.includes("pending")).length > 0 && (
                    <span className="bg-[#F4A863] text-slate-950 px-1.5 py-0.5 rounded-full text-[10px] font-black">
                      {interviewsList.filter(i => i.status.includes("pending")).length}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setActiveTab("overview")}
                  className={`px-4 py-2 rounded-lg text-xs font-extrabold transition-all flex items-center gap-1.5 ${
                    activeTab === "overview"
                      ? "bg-gradient-to-r from-[#D528A2] to-[#F4A863] text-white shadow-md shadow-pink-500/20"
                      : "text-slate-300 hover:text-white hover:bg-slate-700/50"
                  }`}
                >
                  <BarChart3 className="w-3.5 h-3.5" />
                  Campus Overview
                </button>
              </>
            )}

            {/* Admin / KAM Options Only */}
            {isAdminOrKAM && (
              <button
                onClick={() => setActiveTab("overview")}
                className="bg-gradient-to-r from-[#D528A2] to-[#F4A863] text-white px-4 py-2 rounded-lg text-xs font-extrabold flex items-center gap-1.5 shadow-md"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                All College Interviews
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Tamil Exclusion Warning Notice */}
      {isMentor && isOnlyTamilMentor && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex items-start gap-3 text-amber-900 dark:text-amber-200 text-sm">
          <Info className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold text-amber-800 dark:text-amber-300">Notice for Tamil Subject Mentors:</span> Interview Module features are not applicable for Tamil. You do not need to raise or conduct interview evaluations for Tamil language courses.
          </div>
        </div>
      )}

      {/* MENTOR VIEW: TAB 1 - Raise Request */}
      {isMentor && activeTab === "raise" && !isOnlyTamilMentor && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-xl backdrop-blur-xl">
          <div className="mb-6">
            <h2 className="text-lg font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-[#D528A2]" />
              Raise New Interview Request
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Select interview type, assigned subject, class group, target date (minimum 2 days out), and typable topics. Student count is assigned by the Campus Manager.
            </p>
          </div>

          <form onSubmit={handleRaiseRequest} className="space-y-6">
            {/* Mode Switcher: Internal vs External */}
            <div className="grid grid-cols-2 gap-3 max-w-md bg-slate-100 dark:bg-slate-800 p-1.5 rounded-xl border border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setActiveMode("internal")}
                className={`py-2.5 px-4 rounded-lg text-xs font-extrabold transition-all flex items-center justify-center gap-2 ${
                  activeMode === "internal"
                    ? "bg-gradient-to-r from-[#D528A2] to-[#F4A863] text-white shadow-md"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                <Building className="w-4 h-4" />
                Internal Interview
              </button>
              <button
                type="button"
                onClick={() => setActiveMode("external")}
                className={`py-2.5 px-4 rounded-lg text-xs font-extrabold transition-all flex items-center justify-center gap-2 ${
                  activeMode === "external"
                    ? "bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                <Video className="w-4 h-4" />
                External Interview
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {/* Subject Dropdown (Mentors Assigned Subjects Only, Tamil Excluded) */}
              <div>
                <label className="block text-xs font-extrabold text-slate-700 dark:text-slate-300 mb-1.5">
                  Select Subject <span className="text-[#D528A2]">(Your Assigned Subjects)</span>
                </label>
                <select
                  value={selectedSubject}
                  onChange={(e) => setSelectedSubject(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-[#D528A2] focus:ring-2 focus:ring-[#D528A2]/20 font-semibold"
                >
                  {mentorAssignedSubjects.length === 0 ? (
                    <option value="">No non-Tamil subjects available</option>
                  ) : (
                    mentorAssignedSubjects.map(sub => (
                      <option key={sub} value={sub}>{sub}</option>
                    ))
                  )}
                </select>
                <p className="text-[11px] text-slate-500 mt-1">
                  * Tamil subject is excluded.
                </p>
              </div>

              {/* Class Group Selection */}
              <div>
                <label className="block text-xs font-extrabold text-slate-700 dark:text-slate-300 mb-1.5">
                  Select Class / Class Group
                </label>
                <select
                  value={selectedClassGroup}
                  onChange={(e) => setSelectedClassGroup(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-[#D528A2] focus:ring-2 focus:ring-[#D528A2]/20 font-semibold"
                >
                  {mentorAssignedClasses.map(cls => (
                    <option key={cls} value={cls}>{cls}</option>
                  ))}
                </select>
              </div>

              {/* Target Date Picker (Must be >= 2 days in advance) */}
              <div>
                <label className="block text-xs font-extrabold text-slate-700 dark:text-slate-300 mb-1.5">
                  Target Date <span className="text-[#D528A2]">(Must be ≥ 2 days out)</span>
                </label>
                <input
                  type="date"
                  min={minTargetDateStr}
                  value={targetDate}
                  onChange={(e) => setTargetDate(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-[#D528A2] focus:ring-2 focus:ring-[#D528A2]/20 font-semibold"
                  required
                />
              </div>

              {/* Typable Topics */}
              <div className="md:col-span-3">
                <label className="block text-xs font-extrabold text-slate-700 dark:text-slate-300 mb-1.5">
                  Topics / Coverage Areas (Typable)
                </label>
                <textarea
                  rows={3}
                  value={topics}
                  onChange={(e) => setTopics(e.target.value)}
                  placeholder="e.g. Data Structures, React State Management, System Architecture, Algorithm Complexity"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-3 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-[#D528A2] focus:ring-2 focus:ring-[#D528A2]/20 placeholder-slate-400"
                  required
                />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button
                type="submit"
                disabled={isSubmitting || mentorAssignedSubjects.length === 0}
                className="bg-gradient-to-r from-[#D528A2] to-[#F4A863] text-white font-extrabold px-7 py-3 rounded-xl shadow-lg shadow-pink-500/25 hover:opacity-95 transition-all flex items-center gap-2 text-sm"
              >
                <Send className="w-4 h-4" />
                {isSubmitting ? "Submitting Request..." : `Submit ${activeMode.toUpperCase()} Interview Request`}
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* MENTOR VIEW: TAB 2 - Conduct & Multi-Criteria Marking */}
      {isMentor && activeTab === "evaluate" && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-xl backdrop-blur-xl">
            <div className="mb-6">
              <h2 className="text-lg font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <Award className="w-5 h-5 text-[#D528A2]" />
                Conduct Student Interview & Multi-Criteria Marking
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Mark attendance (Present/Absent/OD) and rate student performance across Communication, Content Knowledge, Technical Skills, and Confidence.
              </p>
            </div>

            {/* Select Request to Conduct */}
            <div className="mb-6">
              <label className="block text-xs font-extrabold text-slate-700 dark:text-slate-300 mb-1.5">
                Select Interview Session to Conduct
              </label>
              <select
                value={selectedRequest?.id || ""}
                onChange={(e) => {
                  const req = interviewsList.find(i => i.id === e.target.value);
                  setSelectedRequest(req || null);
                  setSelectedStudentForEval(null);
                }}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-[#D528A2] font-semibold"
              >
                <option value="">-- Choose Assigned Interview Session --</option>
                {interviewsList.map(i => (
                  <option key={i.id} value={i.id}>
                    {i.subject} [{i.class_group || "All Classes"}] ({i.target_date}) - {i.type.toUpperCase()} ({i.student_count || 10} Students)
                  </option>
                ))}
              </select>
            </div>

            {selectedRequest && (
              <div className="space-y-6 border-t border-slate-200 dark:border-slate-800 pt-6">
                {/* Student Selection for Session */}
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
                    <GraduationCap className="w-4 h-4 text-[#D528A2]" />
                    Select Student to Evaluate ({selectedRequest.class_group || "All Cohorts"})
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {sessionStudents.slice(0, selectedRequest.student_count || 10).map((st) => {
                      const isEvaluated = evaluationsList.some(ev => ev.interview_id === selectedRequest.id && ev.student_id === st.id);
                      const isSelected = selectedStudentForEval?.id === st.id;
                      return (
                        <div
                          key={st.id}
                          onClick={() => setSelectedStudentForEval(st)}
                          className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between shadow-sm ${
                            isSelected
                              ? "bg-gradient-to-r from-pink-50 to-orange-50 dark:from-[#D528A2]/20 dark:to-[#F4A863]/20 border-[#D528A2]"
                              : isEvaluated
                              ? "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-300 dark:border-emerald-500/30"
                              : "bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700/50 hover:bg-slate-100"
                          }`}
                        >
                          <div>
                            <div className="font-extrabold text-slate-900 dark:text-white text-xs">{st.name}</div>
                            <div className="text-[11px] text-slate-500 font-medium">{st.classGroup || "CS-A"}</div>
                          </div>
                          {isEvaluated ? (
                            <span className="text-[10px] font-black bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-300 dark:border-emerald-500/30">
                              Evaluated
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded-full">
                              Pending
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Multi-Criteria Evaluation Form */}
                {selectedStudentForEval && (
                  <form onSubmit={handleSubmitEvaluation} className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60 rounded-2xl p-5 space-y-5 shadow-inner">
                    <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700/50 pb-3">
                      <div>
                        <h4 className="font-extrabold text-slate-900 dark:text-white text-base">Evaluating: {selectedStudentForEval.name}</h4>
                        <p className="text-xs text-slate-500 font-medium">{selectedRequest.subject} • {selectedStudentForEval.classGroup}</p>
                      </div>

                      {/* Attendance Selector */}
                      <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 p-1 rounded-xl border border-slate-300 dark:border-slate-700">
                        {(["present", "absent", "od"] as const).map((att) => (
                          <button
                            key={att}
                            type="button"
                            onClick={() => setEvalAttendance(att)}
                            className={`px-3 py-1 rounded-lg text-xs font-extrabold uppercase transition-all ${
                              evalAttendance === att
                                ? att === "present"
                                  ? "bg-emerald-600 text-white"
                                  : att === "absent"
                                  ? "bg-rose-600 text-white"
                                  : "bg-amber-600 text-white"
                                : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                            }`}
                          >
                            {att}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* 4 Multi-Criteria Marking Sliders */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      {/* 1. Communication Skill */}
                      <div className="bg-white dark:bg-slate-900/60 p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2 shadow-sm">
                        <div className="flex justify-between items-center text-xs font-extrabold text-slate-900 dark:text-white">
                          <span>🗣️ Communication Skill</span>
                          <span className="text-[#D528A2] font-black text-sm">{commScore} / 10</span>
                        </div>
                        <input
                          type="range"
                          min={1}
                          max={10}
                          value={commScore}
                          onChange={(e) => setCommScore(Number(e.target.value))}
                          className="w-full accent-[#D528A2] cursor-pointer"
                        />
                      </div>

                      {/* 2. Content / Subject Knowledge */}
                      <div className="bg-white dark:bg-slate-900/60 p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2 shadow-sm">
                        <div className="flex justify-between items-center text-xs font-extrabold text-slate-900 dark:text-white">
                          <span>📚 Content / Subject Knowledge</span>
                          <span className="text-[#F4A863] font-black text-sm">{contentScore} / 10</span>
                        </div>
                        <input
                          type="range"
                          min={1}
                          max={10}
                          value={contentScore}
                          onChange={(e) => setContentScore(Number(e.target.value))}
                          className="w-full accent-[#F4A863] cursor-pointer"
                        />
                      </div>

                      {/* 3. Technical / Problem Solving */}
                      <div className="bg-white dark:bg-slate-900/60 p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2 shadow-sm">
                        <div className="flex justify-between items-center text-xs font-extrabold text-slate-900 dark:text-white">
                          <span>💻 Technical / Problem Solving</span>
                          <span className="text-emerald-600 dark:text-emerald-400 font-black text-sm">{techScore} / 10</span>
                        </div>
                        <input
                          type="range"
                          min={1}
                          max={10}
                          value={techScore}
                          onChange={(e) => setTechScore(Number(e.target.value))}
                          className="w-full accent-emerald-500 cursor-pointer"
                        />
                      </div>

                      {/* 4. Confidence & Presentation */}
                      <div className="bg-white dark:bg-slate-900/60 p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2 shadow-sm">
                        <div className="flex justify-between items-center text-xs font-extrabold text-slate-900 dark:text-white">
                          <span>🌟 Confidence & Presentation</span>
                          <span className="text-amber-600 dark:text-amber-400 font-black text-sm">{confidenceScore} / 10</span>
                        </div>
                        <input
                          type="range"
                          min={1}
                          max={10}
                          value={confidenceScore}
                          onChange={(e) => setConfidenceScore(Number(e.target.value))}
                          className="w-full accent-amber-500 cursor-pointer"
                        />
                      </div>
                    </div>

                    {/* Questions Asked & Remarks */}
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-extrabold text-slate-700 dark:text-slate-300 mb-1.5">
                          Questions Asked During Interview
                        </label>
                        <textarea
                          rows={2}
                          value={questionsAsked}
                          onChange={(e) => setQuestionsAsked(e.target.value)}
                          placeholder="e.g. Asked about React useEffect dependencies, Database joins, and array sorting algorithms."
                          className="w-full bg-white dark:bg-slate-900/80 border border-slate-300 dark:border-slate-700 rounded-xl p-3 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-[#D528A2] placeholder-slate-400 font-medium"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-extrabold text-slate-700 dark:text-slate-300 mb-1.5">
                          Mentor Remarks & Feedback
                        </label>
                        <textarea
                          rows={2}
                          value={remarks}
                          onChange={(e) => setRemarks(e.target.value)}
                          placeholder="e.g. Good grasp of concepts, needs improvement in confidence during code explanation."
                          className="w-full bg-white dark:bg-slate-900/80 border border-slate-300 dark:border-slate-700 rounded-xl p-3 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-[#D528A2] placeholder-slate-400 font-medium"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-2">
                      <Button
                        type="button"
                        onClick={() => setSelectedStudentForEval(null)}
                        className="bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 text-slate-800 dark:text-slate-300 text-xs font-bold px-4 py-2 rounded-xl"
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        disabled={isSavingEval}
                        className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-extrabold px-6 py-2 rounded-xl shadow-lg shadow-emerald-500/25 hover:from-emerald-600 hover:to-teal-700 text-xs flex items-center gap-1.5"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        {isSavingEval ? "Saving Marks..." : "Save Evaluation Marks"}
                      </Button>
                    </div>
                  </form>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* CAMPUS MANAGER VIEW: Allocation, Student Count Assignment & GMeet Generation */}
      {isCM && activeTab === "allocation" && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-xl backdrop-blur-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <Layers className="w-5 h-5 text-[#D528A2]" />
                Pending Interview Requests & Free-Period Mentor Allocation
              </h2>
              <button
                onClick={fetchInterviews}
                className="text-xs text-[#D528A2] hover:underline flex items-center gap-1 font-bold"
              >
                Refresh List
              </button>
            </div>

            {isLoading ? (
              <div className="py-12 text-center text-slate-500 text-sm font-semibold">Loading interview requests...</div>
            ) : interviewsList.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-sm">No active interview requests found for your campus.</div>
            ) : (
              <div className="space-y-4">
                {interviewsList.map((req) => {
                  const assignedMentors = mentors.filter(m => (req.assigned_mentor_ids || "").includes(m.id));
                  return (
                    <div
                      key={req.id}
                      className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-xl p-4 hover:border-[#D528A2]/50 transition-all shadow-sm"
                    >
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                              req.type === "external" ? "bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300 border border-purple-300 dark:border-purple-500/30" : "bg-pink-100 dark:bg-pink-500/20 text-pink-700 dark:text-pink-300 border border-pink-300 dark:border-pink-500/30"
                            }`}>
                              {req.type}
                            </span>
                            <h3 className="font-extrabold text-slate-900 dark:text-white text-base">{req.subject}</h3>
                            <span className="text-xs font-semibold text-slate-500">
                              [{req.class_group || "All Classes"}] • ({req.student_count && req.student_count > 0 ? `${req.student_count} Students Assigned` : "Student Count Pending CAM Assignment"})
                            </span>
                          </div>

                          <div className="text-xs text-slate-600 dark:text-slate-300 flex flex-wrap items-center gap-x-4 gap-y-1 pt-1 font-medium">
                            <span className="flex items-center gap-1 text-slate-500">
                              <Calendar className="w-3.5 h-3.5 text-[#D528A2]" /> Target Date: <strong className="text-slate-900 dark:text-white">{req.target_date}</strong>
                            </span>
                            <span className="flex items-center gap-1 text-slate-500">
                              <UserCheck className="w-3.5 h-3.5 text-[#D528A2]" /> Requested By: <strong className="text-slate-900 dark:text-white">{req.mentor_name}</strong>
                            </span>
                            {req.gmeet_link && (
                              <a
                                href={req.gmeet_link}
                                target="_blank"
                                rel="noreferrer"
                                className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 hover:underline font-bold"
                              >
                                <Video className="w-3.5 h-3.5" /> GMeet Link
                              </a>
                            )}
                          </div>

                          <p className="text-xs text-slate-500 dark:text-slate-400 pt-1">
                            <strong className="text-slate-700 dark:text-slate-300">Topics:</strong> {req.topics || "General Review"}
                          </p>
                        </div>

                        {/* CM Actions */}
                        <div className="flex items-center gap-2">
                          {req.type === "external" && req.status === "pending_external_cm" && (
                            <Button
                              onClick={() => handleExternalAccept(req.id, "accept")}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold px-3 py-1.5 rounded-lg flex items-center gap-1 shadow-sm"
                            >
                              <Check className="w-3.5 h-3.5" />
                              Accept & Generate GMeet
                            </Button>
                          )}

                          <Button
                            onClick={() => {
                              setSelectedRequest(req);
                              setCamStudentCount(req.student_count || 10);
                              setMappedMentorIds(req.assigned_mentor_ids ? JSON.parse(req.assigned_mentor_ids) : []);
                            }}
                            className="bg-gradient-to-r from-[#D528A2] to-[#F4A863] text-white text-xs font-extrabold px-3.5 py-1.5 rounded-lg flex items-center gap-1 shadow-md shadow-pink-500/20"
                          >
                            <Users className="w-3.5 h-3.5" />
                            Assign Students & Map Mentors
                          </Button>
                        </div>
                      </div>

                      {/* Display Mapped Mentors */}
                      {assignedMentors.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700/50 flex items-center gap-2 text-xs">
                          <span className="text-slate-500 font-bold">Mapped Mentors ({assignedMentors.length}):</span>
                          <div className="flex flex-wrap gap-1.5">
                            {assignedMentors.map(m => (
                              <span key={m.id} className="bg-pink-50 dark:bg-pink-500/20 text-[#D528A2] dark:text-pink-200 px-2 py-0.5 rounded-md text-[11px] font-bold border border-pink-200 dark:border-pink-500/30">
                                {m.name}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* CM Student Count Assignment & Mentor Free-Slot Mapping Modal */}
          {selectedRequest && (
            <div className="bg-white dark:bg-slate-900 border border-[#D528A2]/40 rounded-2xl p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
                <div>
                  <h3 className="font-extrabold text-slate-900 dark:text-white text-base flex items-center gap-2">
                    <Users className="w-5 h-5 text-[#D528A2]" />
                    CAM Allocation: Set Student Count & Map Mentors
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Assign the student count for <strong className="text-slate-900 dark:text-white">{selectedRequest.subject}</strong> [{selectedRequest.class_group || "All Classes"}] on {selectedRequest.target_date} and split across available mentors.
                  </p>
                </div>
                <button
                  onClick={() => setSelectedRequest(null)}
                  className="text-slate-400 hover:text-slate-900 dark:hover:text-white text-xs font-bold"
                >
                  ✕ Close
                </button>
              </div>

              {/* CAM Student Count Allocation Field */}
              <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                <label className="block text-xs font-extrabold text-slate-700 dark:text-slate-300 mb-1.5">
                  Assign Student Count for this Session (Assigned by CAM)
                </label>
                <input
                  type="number"
                  min={1}
                  max={200}
                  value={camStudentCount}
                  onChange={(e) => setCamStudentCount(Number(e.target.value))}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-white font-bold focus:outline-none focus:border-[#D528A2]"
                  required
                />
              </div>

              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {availableSubjectMentors.map(m => {
                  const isChecked = mappedMentorIds.includes(m.id);
                  return (
                    <label
                      key={m.id}
                      className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${
                        isChecked ? "bg-pink-50 dark:bg-pink-500/20 border-[#D528A2]" : "bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700/50 hover:bg-slate-100"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setMappedMentorIds(prev => [...prev, m.id]);
                            } else {
                              setMappedMentorIds(prev => prev.filter(id => id !== m.id));
                            }
                          }}
                          className="w-4 h-4 rounded text-[#D528A2] focus:ring-[#D528A2]"
                        />
                        <div>
                          <div className="font-extrabold text-slate-900 dark:text-white text-sm">{m.name}</div>
                          <div className="text-xs text-slate-500 font-medium">{m.department || "Subject Mentor"} • Free Slot Available</div>
                        </div>
                      </div>
                      <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-500/10 px-2.5 py-1 rounded-md border border-emerald-300 dark:border-emerald-500/20">
                        {m.subjects || selectedRequest.subject}
                      </span>
                    </label>
                  );
                })}
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-800">
                <span className="text-xs text-slate-500 font-bold">
                  Selected Mentors: <strong className="text-slate-900 dark:text-white">{mappedMentorIds.length}</strong>
                </span>
                <Button
                  onClick={() => handleAssignMentors(selectedRequest.id)}
                  disabled={isAssigning || mappedMentorIds.length === 0}
                  className="bg-gradient-to-r from-[#D528A2] to-[#F4A863] text-white font-extrabold px-5 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow-md shadow-pink-500/20"
                >
                  <Send className="w-3.5 h-3.5" />
                  {isAssigning ? "Dispatching..." : "Assign Student Count & Map Mentors"}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* OVERVIEW VIEW (For Admin / KAM / CM Overview) */}
      {(isAdminOrKAM || activeTab === "overview") && !isMentor && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-xl backdrop-blur-xl">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-[#D528A2]" />
              Campus Interview Sessions & Evaluation Metrics
            </h2>
            <button
              onClick={fetchInterviews}
              className="text-xs text-[#D528A2] hover:underline flex items-center gap-1 font-bold"
            >
              Refresh Data
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-200 dark:border-slate-700/80">
              <div className="text-xs font-bold text-slate-500 uppercase">Total Sessions</div>
              <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">{interviewsList.length}</div>
            </div>
            <div className="bg-emerald-50 dark:bg-emerald-500/10 p-4 rounded-xl border border-emerald-200 dark:border-emerald-500/20">
              <div className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase">Completed Sessions</div>
              <div className="text-2xl font-black text-emerald-800 dark:text-emerald-300 mt-1">
                {interviewsList.filter(i => i.status === "completed").length}
              </div>
            </div>
            <div className="bg-amber-50 dark:bg-amber-500/10 p-4 rounded-xl border border-amber-200 dark:border-amber-500/20">
              <div className="text-xs font-bold text-amber-700 dark:text-amber-400 uppercase">Pending CAM Allocation</div>
              <div className="text-2xl font-black text-amber-800 dark:text-amber-300 mt-1">
                {interviewsList.filter(i => i.status.includes("pending")).length}
              </div>
            </div>
            <div className="bg-pink-50 dark:bg-pink-500/10 p-4 rounded-xl border border-pink-200 dark:border-pink-500/20">
              <div className="text-xs font-bold text-[#D528A2] uppercase">Evaluations Logged</div>
              <div className="text-2xl font-black text-[#D528A2] mt-1">{evaluationsList.length}</div>
            </div>
          </div>

          <div className="space-y-3">
            {interviewsList.map(i => (
              <div key={i.id} className="p-3.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700/60 flex justify-between items-center text-xs">
                <div>
                  <strong className="text-slate-900 dark:text-white font-bold">{i.subject}</strong> [{i.class_group || "All Classes"}] ({i.type.toUpperCase()}) • Requested by {i.mentor_name}
                  <div className="text-slate-500">{i.target_date} • {i.topics || "General"}</div>
                </div>
                <span className={`px-2.5 py-1 rounded-full font-extrabold uppercase text-[10px] ${
                  i.status === "completed" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300" : "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300"
                }`}>
                  {i.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
