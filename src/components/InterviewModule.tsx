"use client";

import React, { useState, useMemo } from "react";
import { useApp, StudentInterview } from "../context/AppContext";
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
  TrendingUp,
  FileText,
  Star,
  Plus
} from "lucide-react";
import { Button } from "./Button";
import { Input } from "./Input";
import { Select } from "./Select";
import { Card } from "./Card";

interface InterviewModuleProps {
  currentUserRole?: "mentor" | "cm" | "kam" | "admin" | string;
  currentUserName?: string;
  defaultCollegeId?: string;
}

export const InterviewModule: React.FC<InterviewModuleProps> = ({
  currentUserRole = "mentor",
  currentUserName = "Evaluator",
  defaultCollegeId
}) => {
  const { students, subjectsList, departmentsList, interviews, addInterview, deleteInterview } = useApp();
  const { toast } = useToast();

  // Dual Button State: 'internal' | 'external'
  const [activeMode, setActiveMode] = useState<"internal" | "external">("internal");

  // ---------------------------------------------------------------------------
  // Internal Interview State
  // ---------------------------------------------------------------------------
  const [internalSubject, setInternalSubject] = useState<string>("");
  const [internalStudentId, setInternalStudentId] = useState<string>("");
  const [internalMarks, setInternalMarks] = useState<number | "">(80);
  const [internalTotalMarks, setInternalTotalMarks] = useState<number>(100);
  const [internalTechMarks, setInternalTechMarks] = useState<number | "">(40);
  const [internalCommMarks, setInternalCommMarks] = useState<number | "">(40);
  const [internalStatus, setInternalStatus] = useState<"Cleared" | "Pending" | "Needs Improvement" | "Failed">("Cleared");
  const [internalNotes, setInternalNotes] = useState<string>("");
  const [isSubmittingInternal, setIsSubmittingInternal] = useState<boolean>(false);

  // ---------------------------------------------------------------------------
  // External Interview State
  // ---------------------------------------------------------------------------
  const [externalClassGroup, setExternalClassGroup] = useState<string>("");
  const [externalSubject, setExternalSubject] = useState<string>("");
  const [externalStudentId, setExternalStudentId] = useState<string>("");
  const [externalMarks, setExternalMarks] = useState<number | "">(85);
  const [externalTotalMarks, setExternalTotalMarks] = useState<number>(100);
  const [externalTechMarks, setExternalTechMarks] = useState<number | "">(42);
  const [externalCommMarks, setExternalCommMarks] = useState<number | "">(43);
  const [externalStatus, setExternalStatus] = useState<"Cleared" | "Pending" | "Needs Improvement" | "Failed">("Cleared");
  const [externalNotes, setExternalNotes] = useState<string>("");
  const [isSubmittingExternal, setIsSubmittingExternal] = useState<boolean>(false);

  // Filters for External Table
  const [externalSearch, setExternalSearch] = useState<string>("");
  const [externalFilterClass, setExternalFilterClass] = useState<string>("ALL");
  const [externalFilterSubject, setExternalFilterSubject] = useState<string>("ALL");

  // ---------------------------------------------------------------------------
  // Computed Options
  // ---------------------------------------------------------------------------

  // All distinct Subjects
  const allSubjects = useMemo(() => {
    const names = Array.from(new Set(subjectsList.map(s => s.name).filter(Boolean))).sort();
    return names;
  }, [subjectsList]);

  // All distinct Class Groups
  const allClassGroups = useMemo(() => {
    const groups = Array.from(new Set(students.map(s => s.classGroup).filter(Boolean))).sort();
    return groups;
  }, [students]);

  // Internal: Students filtered by subject or department
  const internalStudents = useMemo(() => {
    if (!internalSubject) return students;
    // Find subject department
    const subjObj = subjectsList.find(s => s.name.toLowerCase().trim() === internalSubject.toLowerCase().trim());
    const dept = subjObj?.department?.toLowerCase().trim();
    if (!dept) return students;
    return students.filter(s => (s.department || "").toLowerCase().includes(dept) || (s.classGroup || "").toLowerCase().includes(dept));
  }, [students, internalSubject, subjectsList]);

  // External: Students filtered by chosen Class Group
  const externalStudents = useMemo(() => {
    if (!externalClassGroup) return students;
    return students.filter(s => s.classGroup === externalClassGroup);
  }, [students, externalClassGroup]);

  // Selected student objects
  const selectedInternalStudent = useMemo(() => {
    return students.find(s => s.id === internalStudentId) || null;
  }, [students, internalStudentId]);

  const selectedExternalStudent = useMemo(() => {
    return students.find(s => s.id === externalStudentId) || null;
  }, [students, externalStudentId]);

  // Filtered list of internal interviews for selected student or all internal
  const filteredInternalInterviews = useMemo(() => {
    return interviews.filter(i => {
      if (i.type !== "internal") return false;
      if (internalSubject && i.subject.toLowerCase().trim() !== internalSubject.toLowerCase().trim()) return false;
      if (internalStudentId && i.student_id !== internalStudentId) return false;
      return true;
    });
  }, [interviews, internalSubject, internalStudentId]);

  // Filtered list of external interviews for table view
  const filteredExternalInterviews = useMemo(() => {
    return interviews.filter(i => {
      if (i.type !== "external") return false;
      if (externalFilterClass !== "ALL" && i.class_group !== externalFilterClass) return false;
      if (externalFilterSubject !== "ALL" && i.subject.toLowerCase() !== externalFilterSubject.toLowerCase()) return false;
      if (externalSearch) {
        const query = externalSearch.toLowerCase();
        const sName = (i.student_name || "").toLowerCase();
        const evalName = (i.evaluator_name || "").toLowerCase();
        const notes = (i.notes || "").toLowerCase();
        if (!sName.includes(query) && !evalName.includes(query) && !notes.includes(query)) return false;
      }
      return true;
    });
  }, [interviews, externalFilterClass, externalFilterSubject, externalSearch]);

  // Overall Statistics
  const stats = useMemo(() => {
    const total = interviews.length;
    const cleared = interviews.filter(i => i.status === "Cleared").length;
    const internalCount = interviews.filter(i => i.type === "internal").length;
    const externalCount = interviews.filter(i => i.type === "external").length;
    const avgMarks = total > 0 ? Math.round(interviews.reduce((acc, i) => acc + (i.marks || 0), 0) / total) : 0;
    const clearedRate = total > 0 ? Math.round((cleared / total) * 100) : 0;

    return { total, cleared, clearedRate, internalCount, externalCount, avgMarks };
  }, [interviews]);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleSaveInternal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!internalSubject) {
      toast("Please select a subject for the internal interview.", "warning");
      return;
    }
    if (!internalStudentId) {
      toast("Please select a student from the dropdown.", "warning");
      return;
    }

    setIsSubmittingInternal(true);
    try {
      const res = await addInterview({
        student_id: internalStudentId,
        student_name: selectedInternalStudent?.name || "Student",
        class_group: selectedInternalStudent?.classGroup || "Default Class",
        subject: internalSubject,
        type: "internal",
        marks: Number(internalMarks) || 0,
        total_marks: Number(internalTotalMarks) || 100,
        technical_marks: Number(internalTechMarks) || 0,
        communication_marks: Number(internalCommMarks) || 0,
        status: internalStatus,
        evaluator_name: currentUserName,
        evaluator_role: currentUserRole,
        notes: internalNotes
      });

      if (res.success) {
        toast("Internal interview assessment saved successfully!", "success");
        setInternalNotes("");
      } else {
        toast(res.message || "Failed to save internal interview.", "error");
      }
    } catch (err: any) {
      toast("An error occurred while saving internal interview.", "error");
    } finally {
      setIsSubmittingInternal(false);
    }
  };

  const handleSaveExternal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!externalClassGroup) {
      toast("Please select a Class Group for the external interview.", "warning");
      return;
    }
    if (!externalSubject) {
      toast("Please select a Subject for the external interview.", "warning");
      return;
    }
    if (!externalStudentId) {
      toast("Please select a Student for the external interview.", "warning");
      return;
    }

    setIsSubmittingExternal(true);
    try {
      const res = await addInterview({
        student_id: externalStudentId,
        student_name: selectedExternalStudent?.name || "Student",
        class_group: externalClassGroup,
        subject: externalSubject,
        type: "external",
        marks: Number(externalMarks) || 0,
        total_marks: Number(externalTotalMarks) || 100,
        technical_marks: Number(externalTechMarks) || 0,
        communication_marks: Number(externalCommMarks) || 0,
        status: externalStatus,
        evaluator_name: currentUserName,
        evaluator_role: currentUserRole,
        notes: externalNotes
      });

      if (res.success) {
        toast("External interview assessment saved successfully!", "success");
        setExternalNotes("");
      } else {
        toast(res.message || "Failed to save external interview.", "error");
      }
    } catch (err: any) {
      toast("An error occurred while saving external interview.", "error");
    } finally {
      setIsSubmittingExternal(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this interview record?")) return;
    const res = await deleteInterview(id);
    if (res.success) {
      toast("Interview evaluation deleted.", "info");
    } else {
      toast("Failed to delete interview evaluation.", "error");
    }
  };

  // Helper badge formatting
  const getRoleBadge = (role: string) => {
    const r = role.toLowerCase();
    if (r === "mentor") return "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/20";
    if (r === "cm" || r === "cam") return "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300 border border-amber-200 dark:border-amber-500/20";
    if (r === "kam") return "bg-purple-50 text-purple-700 dark:bg-purple-500/10 dark:text-purple-300 border border-purple-200 dark:border-purple-500/20";
    return "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700";
  };

  const getStatusBadge = (status: string) => {
    if (status === "Cleared") return "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/20";
    if (status === "Pending") return "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300 border border-amber-200 dark:border-amber-500/20";
    if (status === "Needs Improvement") return "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300 border border-blue-200 dark:border-blue-500/20";
    return "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300 border border-rose-200 dark:border-rose-500/20";
  };

  return (
    <div className="space-y-6 font-sans">
      {/* ── Top Header Banner & Stats ────────────────────────────────────── */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-xs transition-all">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-md shrink-0">
              <Award className="h-7 w-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black text-slate-800 dark:text-slate-100 tracking-tight">Interview Module</h2>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${getRoleBadge(currentUserRole)}`}>
                  {currentUserRole.toUpperCase()} VIEW
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1">
                Conduct &amp; review student interviews for internal subjects or cross-class external evaluations. Accessible to Mentors, CM, and KAM.
              </p>
            </div>
          </div>

          {/* Dual Button Switcher */}
          <div className="flex items-center p-1.5 bg-slate-100 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700/60 shrink-0">
            <button
              onClick={() => setActiveMode("internal")}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                activeMode === "internal"
                  ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm border border-slate-200 dark:border-slate-700"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
              }`}
            >
              <UserCheck className="h-4 w-4" />
              Internal Interview
            </button>

            <button
              onClick={() => setActiveMode("external")}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                activeMode === "external"
                  ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm border border-slate-200 dark:border-slate-700"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
              }`}
            >
              <Award className="h-4 w-4" />
              External Interview
            </button>
          </div>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-slate-150 dark:border-slate-800">
          <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 rounded-2xl p-3.5 flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
              <FileText className="h-4 w-4" />
            </div>
            <div>
              <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Evaluated</span>
              <span className="text-lg font-black text-slate-800 dark:text-slate-100">{stats.total}</span>
            </div>
          </div>

          <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 rounded-2xl p-3.5 flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
              <CheckCircle2 className="h-4 w-4" />
            </div>
            <div>
              <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Clear Rate</span>
              <span className="text-lg font-black text-slate-800 dark:text-slate-100">{stats.clearedRate}%</span>
            </div>
          </div>

          <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 rounded-2xl p-3.5 flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold">
              <UserCheck className="h-4 w-4" />
            </div>
            <div>
              <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Internal Sessions</span>
              <span className="text-lg font-black text-slate-800 dark:text-slate-100">{stats.internalCount}</span>
            </div>
          </div>

          <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 rounded-2xl p-3.5 flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
              <Award className="h-4 w-4" />
            </div>
            <div>
              <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">External Sessions</span>
              <span className="text-lg font-black text-slate-800 dark:text-slate-100">{stats.externalCount}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── MODE 1: INTERNAL INTERVIEW ──────────────────────────────────── */}
      {activeMode === "internal" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Form & Student Selector */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-xs space-y-5">
              <div className="flex items-center justify-between border-b border-slate-150 dark:border-slate-800 pb-4">
                <div className="flex items-center gap-2">
                  <UserCheck className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                  <h3 className="text-base font-black text-slate-800 dark:text-slate-100">Internal Subject Evaluation</h3>
                </div>
                <span className="text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300">
                  Subject Scope
                </span>
              </div>

              <form onSubmit={handleSaveInternal} className="space-y-4">
                {/* 1. Subject Dropdown */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <BookOpen className="h-3.5 w-3.5 text-indigo-500" />
                    Select Subject <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={internalSubject}
                    onChange={(e) => {
                      setInternalSubject(e.target.value);
                      setInternalStudentId("");
                    }}
                    className="w-full text-xs font-semibold px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
                    required
                  >
                    <option value="">-- Choose Subject --</option>
                    {allSubjects.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>

                {/* 2. Student Dropdown */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <GraduationCap className="h-3.5 w-3.5 text-indigo-500" />
                    Select Student <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={internalStudentId}
                    onChange={(e) => setInternalStudentId(e.target.value)}
                    className="w-full text-xs font-semibold px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
                    required
                    disabled={!internalSubject}
                  >
                    <option value="">
                      {!internalSubject ? "Select subject first" : "-- Select Student via Dropdown --"}
                    </option>
                    {internalStudents.map(st => (
                      <option key={st.id} value={st.id}>
                        {st.name} ({st.classGroup || "No Class"}) {st.roll_number ? ` - ${st.roll_number}` : ""}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Selected Student Preview Card */}
                {selectedInternalStudent && (
                  <div className="p-3.5 rounded-2xl bg-indigo-50/60 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center text-sm shrink-0">
                      {selectedInternalStudent.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-xs font-black text-slate-800 dark:text-slate-100 truncate">{selectedInternalStudent.name}</h4>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                        {selectedInternalStudent.classGroup} &bull; Reg: {selectedInternalStudent.register_number || selectedInternalStudent.roll_number || "N/A"}
                      </p>
                    </div>
                  </div>
                )}

                {/* Score Breakdown inputs */}
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1">
                      Technical Score (50)
                    </label>
                    <input
                      type="number"
                      max={50}
                      min={0}
                      value={internalTechMarks}
                      onChange={(e) => {
                        const val = e.target.value === "" ? "" : Number(e.target.value);
                        setInternalTechMarks(val);
                        const cVal = Number(internalCommMarks) || 0;
                        setInternalMarks((Number(val) || 0) + cVal);
                      }}
                      className="w-full text-xs font-semibold px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1">
                      Soft Skills / Comm (50)
                    </label>
                    <input
                      type="number"
                      max={50}
                      min={0}
                      value={internalCommMarks}
                      onChange={(e) => {
                        const val = e.target.value === "" ? "" : Number(e.target.value);
                        setInternalCommMarks(val);
                        const tVal = Number(internalTechMarks) || 0;
                        setInternalMarks((Number(val) || 0) + tVal);
                      }}
                      className="w-full text-xs font-semibold px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1">
                      Total Marks (Out of {internalTotalMarks})
                    </label>
                    <input
                      type="number"
                      max={100}
                      min={0}
                      value={internalMarks}
                      onChange={(e) => setInternalMarks(e.target.value === "" ? "" : Number(e.target.value))}
                      className="w-full text-xs font-bold px-3 py-2 rounded-xl border border-indigo-200 dark:border-indigo-500/30 bg-indigo-50/30 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1">
                      Status Result
                    </label>
                    <select
                      value={internalStatus}
                      onChange={(e) => setInternalStatus(e.target.value as any)}
                      className="w-full text-xs font-semibold px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
                    >
                      <option value="Cleared">Cleared</option>
                      <option value="Pending">Pending</option>
                      <option value="Needs Improvement">Needs Improvement</option>
                      <option value="Failed">Failed</option>
                    </select>
                  </div>
                </div>

                {/* Notes & Feedback */}
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1">
                    Evaluator Feedback &amp; Remarks
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Enter internal interview assessment notes, strengths, and areas for improvement..."
                    value={internalNotes}
                    onChange={(e) => setInternalNotes(e.target.value)}
                    className="w-full text-xs font-medium p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmittingInternal}
                  className="w-full py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  {isSubmittingInternal ? "Saving Evaluation..." : "Save Internal Interview Marks"}
                </button>
              </form>
            </div>
          </div>

          {/* Right Column: History & Evaluations List */}
          <div className="lg:col-span-7 space-y-6">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-150 dark:border-slate-800 pb-4">
                <div>
                  <h3 className="text-base font-black text-slate-800 dark:text-slate-100">Internal Evaluation Records</h3>
                  <p className="text-xs text-slate-450 dark:text-slate-400 font-medium">
                    {internalSubject ? `Showing evaluations for ${internalSubject}` : "Showing all internal interview records"}
                  </p>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-[10px] font-black text-slate-600 dark:text-slate-300">
                  {filteredInternalInterviews.length} Records
                </span>
              </div>

              {filteredInternalInterviews.length === 0 ? (
                <div className="py-12 text-center space-y-3">
                  <UserCheck className="h-10 w-10 text-slate-300 mx-auto" />
                  <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
                    No internal interview records found for the selected subject.
                  </p>
                  <p className="text-[11px] text-slate-400">Select a subject and student on the left to record internal interview marks.</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
                  {filteredInternalInterviews.map((item) => (
                    <div
                      key={item.id}
                      className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 hover:border-indigo-200 dark:hover:border-indigo-500/30 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-black text-slate-800 dark:text-slate-100">{item.student_name}</span>
                          <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 bg-slate-200/60 dark:bg-slate-700/60 px-2 py-0.5 rounded-md">
                            {item.class_group}
                          </span>
                          <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full ${getStatusBadge(item.status)}`}>
                            {item.status}
                          </span>
                        </div>

                        <p className="text-xs text-indigo-600 dark:text-indigo-400 font-bold">
                          Subject: {item.subject}
                        </p>

                        {item.notes && (
                          <p className="text-xs text-slate-600 dark:text-slate-300 font-normal italic bg-white dark:bg-slate-900/60 p-2 rounded-xl border border-slate-150 dark:border-slate-800">
                            &ldquo;{item.notes}&rdquo;
                          </p>
                        )}

                        <div className="flex items-center gap-3 text-[10px] font-medium text-slate-400 pt-1">
                          <span>Evaluated by: <strong>{item.evaluator_name}</strong></span>
                          <span className={`px-2 py-0.2 rounded-md ${getRoleBadge(item.evaluator_role)}`}>
                            {item.evaluator_role.toUpperCase()}
                          </span>
                          <span>{new Date(item.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>

                      <div className="flex items-center sm:flex-col items-end justify-between sm:justify-center gap-2 shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-200 dark:border-slate-700">
                        <div className="text-right">
                          <span className="block text-[10px] uppercase font-bold text-slate-400">Score</span>
                          <span className="text-lg font-black text-indigo-600 dark:text-indigo-400">
                            {item.marks} / {item.total_marks || 100}
                          </span>
                        </div>

                        <button
                          onClick={() => handleDelete(item.id)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-all cursor-pointer"
                          title="Delete assessment"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── MODE 2: EXTERNAL INTERVIEW ──────────────────────────────────── */}
      {activeMode === "external" && (
        <div className="space-y-6">
          {/* External Evaluation Form */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-xs space-y-5">
            <div className="flex items-center justify-between border-b border-slate-150 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-2">
                <Award className="h-5 w-5 text-amber-500" />
                <h3 className="text-base font-black text-slate-800 dark:text-slate-100">External Interview Evaluation (Any Class &amp; Subject)</h3>
              </div>
              <span className="text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
                Cross-Class / External Evaluator
              </span>
            </div>

            <form onSubmit={handleSaveExternal} className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* 1. Class Group Dropdown */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5 text-amber-500" />
                  1. Select Class Group <span className="text-rose-500">*</span>
                </label>
                <select
                  value={externalClassGroup}
                  onChange={(e) => {
                    setExternalClassGroup(e.target.value);
                    setExternalStudentId("");
                  }}
                  className="w-full text-xs font-semibold px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:border-amber-500"
                  required
                >
                  <option value="">-- Choose Any Class Group --</option>
                  {allClassGroups.map(cg => (
                    <option key={cg} value={cg}>{cg}</option>
                  ))}
                </select>
              </div>

              {/* 2. Subject Dropdown */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <BookOpen className="h-3.5 w-3.5 text-amber-500" />
                  2. Select Subject <span className="text-rose-500">*</span>
                </label>
                <select
                  value={externalSubject}
                  onChange={(e) => setExternalSubject(e.target.value)}
                  className="w-full text-xs font-semibold px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:border-amber-500"
                  required
                >
                  <option value="">-- Choose Any Subject --</option>
                  {allSubjects.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              {/* 3. Student Dropdown */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <GraduationCap className="h-3.5 w-3.5 text-amber-500" />
                  3. Select Student <span className="text-rose-500">*</span>
                </label>
                <select
                  value={externalStudentId}
                  onChange={(e) => setExternalStudentId(e.target.value)}
                  className="w-full text-xs font-semibold px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:border-amber-500"
                  required
                  disabled={!externalClassGroup}
                >
                  <option value="">
                    {!externalClassGroup ? "Select Class Group first" : "-- Choose Student --"}
                  </option>
                  {externalStudents.map(st => (
                    <option key={st.id} value={st.id}>
                      {st.name} ({st.roll_number || st.register_number || st.email})
                    </option>
                  ))}
                </select>
              </div>

              {/* Score breakdown & Result status */}
              <div className="md:col-span-3 grid grid-cols-1 sm:grid-cols-4 gap-3 pt-2">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1">
                    Technical Score (50)
                  </label>
                  <input
                    type="number"
                    max={50}
                    min={0}
                    value={externalTechMarks}
                    onChange={(e) => {
                      const val = e.target.value === "" ? "" : Number(e.target.value);
                      setExternalTechMarks(val);
                      const cVal = Number(externalCommMarks) || 0;
                      setExternalMarks((Number(val) || 0) + cVal);
                    }}
                    className="w-full text-xs font-semibold px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1">
                    Comm &amp; Soft Skills (50)
                  </label>
                  <input
                    type="number"
                    max={50}
                    min={0}
                    value={externalCommMarks}
                    onChange={(e) => {
                      const val = e.target.value === "" ? "" : Number(e.target.value);
                      setExternalCommMarks(val);
                      const tVal = Number(externalTechMarks) || 0;
                      setExternalMarks((Number(val) || 0) + tVal);
                    }}
                    className="w-full text-xs font-semibold px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1">
                    External Total Marks (100)
                  </label>
                  <input
                    type="number"
                    max={100}
                    min={0}
                    value={externalMarks}
                    onChange={(e) => setExternalMarks(e.target.value === "" ? "" : Number(e.target.value))}
                    className="w-full text-xs font-bold px-3 py-2 rounded-xl border border-amber-200 dark:border-amber-500/30 bg-amber-50/30 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1">
                    Result Status
                  </label>
                  <select
                    value={externalStatus}
                    onChange={(e) => setExternalStatus(e.target.value as any)}
                    className="w-full text-xs font-semibold px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:border-amber-500"
                  >
                    <option value="Cleared">Cleared</option>
                    <option value="Pending">Pending</option>
                    <option value="Needs Improvement">Needs Improvement</option>
                    <option value="Failed">Failed</option>
                  </select>
                </div>
              </div>

              <div className="md:col-span-3 space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                  External Evaluator Feedback / Remarks
                </label>
                <textarea
                  rows={2}
                  placeholder="Provide detailed feedback for the external interview..."
                  value={externalNotes}
                  onChange={(e) => setExternalNotes(e.target.value)}
                  className="w-full text-xs font-medium p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="md:col-span-3 flex justify-end">
                <button
                  type="submit"
                  disabled={isSubmittingExternal}
                  className="py-3 px-6 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-black transition-all cursor-pointer flex items-center gap-2 shadow-sm disabled:opacity-50"
                >
                  <Award className="h-4 w-4" />
                  {isSubmittingExternal ? "Submitting..." : "Submit External Interview Marks"}
                </button>
              </div>
            </form>
          </div>

          {/* External Audit & Marks Table for KAM / CM / Mentors */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-150 dark:border-slate-800 pb-4">
              <div>
                <h3 className="text-base font-black text-slate-800 dark:text-slate-100">External Interview Audit Log</h3>
                <p className="text-xs text-slate-450 dark:text-slate-400 font-medium">
                  Read &amp; track external interview performance recorded for all classes &amp; subjects.
                </p>
              </div>

              {/* Filters */}
              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative">
                  <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search student or notes..."
                    value={externalSearch}
                    onChange={(e) => setExternalSearch(e.target.value)}
                    className="pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-slate-800 dark:text-slate-100 focus:outline-none focus:border-amber-500 w-44"
                  />
                </div>

                <select
                  value={externalFilterClass}
                  onChange={(e) => setExternalFilterClass(e.target.value)}
                  className="py-1.5 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-slate-100"
                >
                  <option value="ALL">All Class Groups</option>
                  {allClassGroups.map(cg => <option key={cg} value={cg}>{cg}</option>)}
                </select>

                <select
                  value={externalFilterSubject}
                  onChange={(e) => setExternalFilterSubject(e.target.value)}
                  className="py-1.5 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-slate-100"
                >
                  <option value="ALL">All Subjects</option>
                  {allSubjects.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">
                    <th className="py-3 px-3">Student Name</th>
                    <th className="py-3 px-3">Class Group</th>
                    <th className="py-3 px-3">Subject</th>
                    <th className="py-3 px-3 text-center">Marks</th>
                    <th className="py-3 px-3 text-center">Status</th>
                    <th className="py-3 px-3">Evaluator</th>
                    <th className="py-3 px-3">Remarks / Feedback</th>
                    <th className="py-3 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-150 dark:divide-slate-800">
                  {filteredExternalInterviews.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400 font-medium">
                        No external interview records found matching filters.
                      </td>
                    </tr>
                  ) : (
                    filteredExternalInterviews.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-all">
                        <td className="py-3 px-3 font-bold text-slate-800 dark:text-slate-100">{item.student_name}</td>
                        <td className="py-3 px-3 text-slate-600 dark:text-slate-300 font-semibold">{item.class_group}</td>
                        <td className="py-3 px-3 text-indigo-600 dark:text-indigo-400 font-semibold">{item.subject}</td>
                        <td className="py-3 px-3 text-center font-black text-amber-600 dark:text-amber-400">
                          {item.marks} / {item.total_marks || 100}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${getStatusBadge(item.status)}`}>
                            {item.status}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex flex-col">
                            <span className="font-bold text-slate-700 dark:text-slate-200">{item.evaluator_name}</span>
                            <span className={`text-[9px] font-extrabold px-1.5 py-0.2 rounded w-fit uppercase ${getRoleBadge(item.evaluator_role)}`}>
                              {item.evaluator_role}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-3 max-w-xs truncate text-slate-500 dark:text-slate-400 italic">
                          {item.notes || "—"}
                        </td>
                        <td className="py-3 px-3 text-right">
                          <button
                            onClick={() => handleDelete(item.id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-all cursor-pointer"
                            title="Delete assessment"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
