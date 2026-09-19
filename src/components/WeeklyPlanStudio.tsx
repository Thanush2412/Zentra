"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  CalendarRange,
  Calendar,
  Clock,
  BookOpen,
  CheckCircle2,
  AlertCircle,
  FileText,
  User,
  Building2,
  Plus,
  Trash2,
  Save,
  Send,
  Download,
  Search,
  Filter,
  RefreshCw,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  Eye,
  Check,
  X,
  MessageSquare,
  ShieldCheck,
  FileSpreadsheet,
  Layers,
  Sparkles,
  Edit2
} from "lucide-react";
import { useToast } from "@/context/ToastContext";

export interface DailySessionTask {
  day: string;
  date?: string;
  topic: string;
  objectives: string;
  teachingMode: "Theory" | "Lab / Practical" | "Hands-on Coding" | "Project Work" | "Assessment / Quiz" | "Revision";
  materialUrl?: string;
  status: "Planned" | "Completed" | "Rescheduled";
}

export interface WeeklyPlanRecord {
  id: string;
  college_id: string;
  mentor_id: string;
  mentor_name?: string;
  department?: string;
  subject: string;
  class_group: string;
  week_number: number;
  unit?: string;
  topics_planned?: string;
  session_plan: string | DailySessionTask[];
  learning_objectives?: string;
  teaching_mode?: string;
  material_url?: string;
  status: "Draft" | "Submitted" | "Verified" | "Needs Revision";
  cam_feedback?: string;
  verified_by?: string;
  verified_at?: string;
  created_at?: string;
  updated_at?: string;
}

const DEFAULT_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const TEACHING_MODES = [
  "Theory",
  "Lab / Practical",
  "Hands-on Coding",
  "Project Work",
  "Assessment / Quiz",
  "Revision"
] as const;

// Helper to parse session plan
export function parseSessionPlan(raw: string | DailySessionTask[] | undefined): DailySessionTask[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/* =========================================================================
   1. MENTOR WEEKLY PLAN STUDIO (For Mentors to create & submit all-days tasks)
   ========================================================================= */
export interface MentorWeeklyPlanStudioProps {
  mentorId: string;
  mentorName: string;
  collegeId?: string;
  collegeName?: string;
  department?: string;
  assignedClasses?: string[];
  assignedSubjects?: string[];
}

export const MentorWeeklyPlanStudio: React.FC<MentorWeeklyPlanStudioProps> = ({
  mentorId,
  mentorName,
  collegeId,
  collegeName,
  department,
  assignedClasses = [],
  assignedSubjects = []
}) => {
  const { toast } = useToast();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [plans, setPlans] = useState<WeeklyPlanRecord[]>([]);

  // Selection state
  const [selectedWeek, setSelectedWeek] = useState<number>(1);
  const [selectedClass, setSelectedClass] = useState<string>(assignedClasses[0] || "Default Cohort");
  const [selectedSubject, setSelectedSubject] = useState<string>(assignedSubjects[0] || "General Subject");
  const [unitName, setUnitName] = useState<string>("Unit 1");
  const [weekSummary, setWeekSummary] = useState<string>("");
  const [learningObjectives, setLearningObjectives] = useState<string>("");
  const [resourceDocUrl, setResourceDocUrl] = useState<string>("");

  // Daily Tasks (Monday through Saturday)
  const [dailyTasks, setDailyTasks] = useState<DailySessionTask[]>(
    DEFAULT_DAYS.map(day => ({
      day,
      topic: "",
      objectives: "",
      teachingMode: "Theory",
      materialUrl: "",
      status: "Planned"
    }))
  );

  const [currentPlanId, setCurrentPlanId] = useState<string | null>(null);
  const [currentStatus, setCurrentStatus] = useState<"Draft" | "Submitted" | "Verified" | "Needs Revision">("Draft");
  const [currentFeedback, setCurrentFeedback] = useState<string>("");
  const [verifiedBy, setVerifiedBy] = useState<string>("");
  const [verifiedAt, setVerifiedAt] = useState<string>("");

  // Fetch existing plans for this mentor
  const fetchPlans = useCallback(async () => {
    if (!collegeId || !mentorId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/weekly-plan?collegeId=${encodeURIComponent(collegeId)}&mentorId=${encodeURIComponent(mentorId)}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.plans)) {
        setPlans(data.plans);
      }
    } catch (e: any) {
      console.error("Error fetching weekly plans:", e);
    } finally {
      setLoading(false);
    }
  }, [collegeId, mentorId]);

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  // When selection changes, load existing matching plan if available
  useEffect(() => {
    const match = plans.find(
      p =>
        p.week_number === selectedWeek &&
        p.class_group.toLowerCase().trim() === selectedClass.toLowerCase().trim() &&
        p.subject.toLowerCase().trim() === selectedSubject.toLowerCase().trim()
    );

    if (match) {
      setCurrentPlanId(match.id);
      setCurrentStatus(match.status);
      setCurrentFeedback(match.cam_feedback || "");
      setVerifiedBy(match.verified_by || "");
      setVerifiedAt(match.verified_at || "");
      setUnitName(match.unit || "Unit 1");
      setWeekSummary(match.topics_planned || "");
      setLearningObjectives(match.learning_objectives || "");
      setResourceDocUrl(match.material_url || "");

      const loadedTasks = parseSessionPlan(match.session_plan);
      if (loadedTasks.length > 0) {
        setDailyTasks(loadedTasks);
      } else {
        setDailyTasks(
          DEFAULT_DAYS.map(day => ({
            day,
            topic: "",
            objectives: "",
            teachingMode: "Theory",
            materialUrl: "",
            status: "Planned"
          }))
        );
      }
    } else {
      setCurrentPlanId(null);
      setCurrentStatus("Draft");
      setCurrentFeedback("");
      setVerifiedBy("");
      setVerifiedAt("");
      setWeekSummary("");
      setLearningObjectives("");
      setResourceDocUrl("");
      setDailyTasks(
        DEFAULT_DAYS.map(day => ({
          day,
          topic: "",
          objectives: "",
          teachingMode: "Theory",
          materialUrl: "",
          status: "Planned"
        }))
      );
    }
  }, [selectedWeek, selectedClass, selectedSubject, plans]);

  // Handle task field updates for a day
  const updateDailyTask = (idx: number, field: keyof DailySessionTask, value: any) => {
    setDailyTasks(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      return next;
    });
  };

  // Save Plan (as Draft or Submitted)
  const handleSavePlan = async (statusToSave: "Draft" | "Submitted") => {
    if (!selectedClass || !selectedSubject) {
      toast("Please select a valid cohort and subject.", "error");
      return;
    }

    // Validation for submission
    if (statusToSave === "Submitted") {
      const hasAtLeastOneTopic = dailyTasks.some(t => t.topic.trim().length > 0);
      if (!hasAtLeastOneTopic) {
        toast("Please fill in the planned topic for at least one day before submitting.", "error");
        return;
      }
    }

    setSaving(true);
    try {
      const payload = {
        id: currentPlanId || undefined,
        collegeId,
        mentorId,
        mentorName,
        department: department || "",
        subject: selectedSubject,
        classGroup: selectedClass,
        weekNumber: selectedWeek,
        unit: unitName,
        topicsPlanned: weekSummary,
        sessionPlan: dailyTasks,
        learningObjectives,
        teachingMode: "Offline",
        materialUrl: resourceDocUrl,
        status: statusToSave
      };

      const res = await fetch("/api/weekly-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (data.success) {
        toast(
          statusToSave === "Submitted"
            ? "Weekly plan submitted to CM, SME, and KAM for verification!"
            : "Weekly plan saved as draft.",
          "success"
        );
        await fetchPlans();
      } else {
        toast(data.message || "Failed to save weekly plan", "error");
      }
    } catch (e: any) {
      toast("Error saving weekly plan: " + e.message, "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 font-sans">
      {/* ─── Top Header Card ─── */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
              <CalendarRange className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-black text-slate-900">Weekly Teaching Plan Studio</h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-indigo-50 border border-indigo-200 text-indigo-700">
                  Faculty: {mentorName}
                </span>
                {collegeName && (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-slate-100 text-slate-700">
                    {collegeName}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Plan all-days teaching tasks (Monday to Saturday) and submit to your CM, SME, and KAM.
              </p>
            </div>
          </div>

          {/* Actions & Status */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={() => handleSavePlan("Draft")}
              className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Save className="h-3.5 w-3.5" />
              <span>Save Draft</span>
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => handleSavePlan("Submitted")}
              className="px-4 py-2 rounded-xl text-xs font-black text-white bg-indigo-600 hover:bg-indigo-700 shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Send className="h-3.5 w-3.5" />
              <span>{currentStatus === "Submitted" || currentStatus === "Verified" ? "Update & Resubmit" : "Submit Plan"}</span>
            </button>
          </div>
        </div>

        {/* Status & Feedback Alert */}
        {currentStatus === "Needs Revision" && currentFeedback && (
          <div className="mt-4 p-4 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <div className="text-xs font-black text-amber-900 uppercase tracking-wider">Revision Requested by Reviewer</div>
              <p className="text-xs text-amber-800 font-medium mt-1">{currentFeedback}</p>
              <span className="text-[10px] text-amber-700 font-bold block mt-1">Please make the requested adjustments and click "Update & Resubmit".</span>
            </div>
          </div>
        )}

        {currentStatus === "Verified" && (
          <div className="mt-4 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
            <div className="text-xs font-bold text-emerald-800">
              This weekly plan has been verified by <span className="font-extrabold">{verifiedBy || "Campus Manager"}</span>
              {verifiedAt && <span> on {verifiedAt}</span>}.
            </div>
          </div>
        )}

        {/* Plan Selectors Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-4">
          {/* Week Selector */}
          <div>
            <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">Academic Week</label>
            <select
              value={selectedWeek}
              onChange={e => setSelectedWeek(parseInt(e.target.value, 10))}
              className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
            >
              {Array.from({ length: 16 }, (_, i) => i + 1).map(w => (
                <option key={w} value={w}>
                  Week {w}
                </option>
              ))}
            </select>
          </div>

          {/* Cohort / Class Group */}
          <div>
            <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">Class / Cohort</label>
            <select
              value={selectedClass}
              onChange={e => setSelectedClass(e.target.value)}
              className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
            >
              {assignedClasses.length > 0 ? (
                assignedClasses.map(c => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))
              ) : (
                <option value={selectedClass}>{selectedClass}</option>
              )}
            </select>
          </div>

          {/* Subject */}
          <div>
            <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">Subject</label>
            <select
              value={selectedSubject}
              onChange={e => setSelectedSubject(e.target.value)}
              className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
            >
              {assignedSubjects.length > 0 ? (
                assignedSubjects.map(s => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))
              ) : (
                <option value={selectedSubject}>{selectedSubject}</option>
              )}
            </select>
          </div>

          {/* Unit / Module */}
          <div>
            <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">Unit / Module</label>
            <input
              type="text"
              placeholder="e.g. Unit 2: Data Structures"
              value={unitName}
              onChange={e => setUnitName(e.target.value)}
              className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </div>

        {/* Global Week Overview Details */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-3 border-t border-slate-100 mt-4">
          <div className="md:col-span-1">
            <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">Weekly Focus / Key Topics</label>
            <input
              type="text"
              placeholder="e.g. Tree structures, Binary trees, BST search operations"
              value={weekSummary}
              onChange={e => setWeekSummary(e.target.value)}
              className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <div className="md:col-span-1">
            <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">Learning Objectives</label>
            <input
              type="text"
              placeholder="e.g. Students should be able to implement BST insert/delete in C++"
              value={learningObjectives}
              onChange={e => setLearningObjectives(e.target.value)}
              className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <div className="md:col-span-1">
            <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">Shared Study Material URL / Repo</label>
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                placeholder="https://drive.google.com/... or LMS link"
                value={resourceDocUrl}
                onChange={e => setResourceDocUrl(e.target.value)}
                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 outline-none focus:ring-1 focus:ring-indigo-500"
              />
              {resourceDocUrl && (
                <a
                  href={resourceDocUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="p-2 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-100 transition-colors"
                  title="Open Link"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ─── Day-by-Day Task Cards (Monday through Saturday) ─── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">
              All-Days Task Schedule (Monday – Saturday)
            </h3>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-indigo-50 text-indigo-700 border border-indigo-200">
              6 Days
            </span>
          </div>
          <span className="text-[11px] text-slate-500 font-medium">
            Status: <span className={`font-black ${currentStatus === "Verified" ? "text-emerald-600" : currentStatus === "Submitted" ? "text-indigo-600" : currentStatus === "Needs Revision" ? "text-amber-600" : "text-slate-500"}`}>{currentStatus}</span>
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {dailyTasks.map((task, idx) => (
            <div
              key={task.day}
              className="bg-white border border-slate-200/90 hover:border-indigo-300 rounded-2xl p-4 shadow-xs transition-all space-y-3"
            >
              {/* Day Header */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <div className="flex items-center gap-2">
                  <div className="h-7 w-7 rounded-lg bg-indigo-50 text-indigo-700 font-black text-xs flex items-center justify-center border border-indigo-100">
                    D{idx + 1}
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-slate-900">{task.day}</h4>
                    <span className="text-[9.5px] font-bold text-slate-400">Class Session</span>
                  </div>
                </div>

                {/* Mode Selector */}
                <select
                  value={task.teachingMode}
                  onChange={e => updateDailyTask(idx, "teachingMode", e.target.value)}
                  className="text-[10px] font-black p-1 bg-slate-50 border border-slate-200 rounded-lg text-indigo-700 outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                >
                  {TEACHING_MODES.map(m => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>

              {/* Topic Planned */}
              <div>
                <label className="block text-[9.5px] font-black uppercase tracking-wider text-slate-400 mb-1">
                  Topic / Task Planned *
                </label>
                <textarea
                  rows={2}
                  placeholder={`What will be taught on ${task.day}?`}
                  value={task.topic}
                  onChange={e => updateDailyTask(idx, "topic", e.target.value)}
                  className="w-full p-2 bg-slate-50/80 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:ring-1 focus:ring-indigo-500 resize-none"
                />
              </div>

              {/* Sub-objectives / Tasks */}
              <div>
                <label className="block text-[9.5px] font-black uppercase tracking-wider text-slate-400 mb-1">
                  Key Concepts / Hands-on Activity
                </label>
                <input
                  type="text"
                  placeholder="e.g. Inorder traversal code & practice"
                  value={task.objectives}
                  onChange={e => updateDailyTask(idx, "objectives", e.target.value)}
                  className="w-full p-1.5 bg-slate-50/80 border border-slate-200 rounded-lg text-xs font-medium text-slate-800 outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              {/* Material URL */}
              <div>
                <label className="block text-[9.5px] font-black uppercase tracking-wider text-slate-400 mb-1">
                  Resource Link / Slide Deck
                </label>
                <input
                  type="text"
                  placeholder="https://..."
                  value={task.materialUrl || ""}
                  onChange={e => updateDailyTask(idx, "materialUrl", e.target.value)}
                  className="w-full p-1.5 bg-slate-50/80 border border-slate-200 rounded-lg text-[11px] font-medium text-slate-700 outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

/* =========================================================================
   2. MANAGER & SME WEEKLY PLAN VIEWER (For CM, SME, and KAM to view & verify)
   ========================================================================= */
export interface WeeklyPlanViewerProps {
  collegeId?: string;
  collegeName?: string;
  role: "cm" | "sme" | "kam" | "admin";
  reviewerName: string;
  allowedCollegeIds?: string[];
  allColleges?: { id: string; name: string }[];
}

export const WeeklyPlanViewer: React.FC<WeeklyPlanViewerProps> = ({
  collegeId,
  collegeName,
  role,
  reviewerName,
  allowedCollegeIds,
  allColleges = []
}) => {
  const { toast } = useToast();

  const [loading, setLoading] = useState(false);
  const [plans, setPlans] = useState<WeeklyPlanRecord[]>([]);

  // Filters
  const [selectedCollege, setSelectedCollege] = useState<string>(collegeId || "all");
  const [selectedWeek, setSelectedWeek] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Modal / Feedback state
  const [selectedPlanForReview, setSelectedPlanForReview] = useState<WeeklyPlanRecord | null>(null);
  const [feedbackInput, setFeedbackInput] = useState<string>("");
  const [submittingReview, setSubmittingReview] = useState<boolean>(false);

  // Detail Drawer
  const [inspectingPlan, setInspectingPlan] = useState<WeeklyPlanRecord | null>(null);

  const fetchPlans = useCallback(async () => {
    setLoading(true);
    try {
      const q = selectedCollege && selectedCollege !== "all" ? `?collegeId=${encodeURIComponent(selectedCollege)}` : "";
      const res = await fetch(`/api/weekly-plan${q}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.plans)) {
        setPlans(data.plans);
      }
    } catch (e: any) {
      console.error("Error fetching weekly plans:", e);
    } finally {
      setLoading(false);
    }
  }, [selectedCollege]);

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  // Filtered plans
  const filteredPlans = useMemo(() => {
    return plans.filter(p => {
      if (allowedCollegeIds && allowedCollegeIds.length > 0 && !allowedCollegeIds.includes(p.college_id)) {
        return false;
      }
      if (selectedCollege !== "all" && p.college_id !== selectedCollege) {
        return false;
      }
      if (selectedWeek !== "all" && String(p.week_number) !== selectedWeek) {
        return false;
      }
      if (selectedStatus !== "all" && p.status !== selectedStatus) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchMentor = (p.mentor_name || "").toLowerCase().includes(q);
        const matchSubj = (p.subject || "").toLowerCase().includes(q);
        const matchClass = (p.class_group || "").toLowerCase().includes(q);
        const matchDept = (p.department || "").toLowerCase().includes(q);
        if (!matchMentor && !matchSubj && !matchClass && !matchDept) return false;
      }
      return true;
    });
  }, [plans, allowedCollegeIds, selectedCollege, selectedWeek, selectedStatus, searchQuery]);

  // KPIs
  const totalCount = filteredPlans.length;
  const verifiedCount = filteredPlans.filter(p => p.status === "Verified").length;
  const pendingCount = filteredPlans.filter(p => p.status === "Submitted").length;
  const revisionCount = filteredPlans.filter(p => p.status === "Needs Revision").length;

  // Handle Review Action (Verify or Request Revision)
  const handleReviewAction = async (status: "Verified" | "Needs Revision") => {
    if (!selectedPlanForReview) return;
    setSubmittingReview(true);
    try {
      const res = await fetch("/api/weekly-plan", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selectedPlanForReview.id,
          status,
          camFeedback: status === "Needs Revision" ? feedbackInput : "",
          verifiedBy: reviewerName
        })
      });
      const data = await res.json();
      if (data.success) {
        toast(`Weekly plan marked as ${status}.`, "success");
        setSelectedPlanForReview(null);
        setFeedbackInput("");
        await fetchPlans();
      } else {
        toast(data.message || "Failed to update review", "error");
      }
    } catch (e: any) {
      toast("Error: " + e.message, "error");
    } finally {
      setSubmittingReview(false);
    }
  };

  // Export to Excel
  const handleExportExcel = async () => {
    try {
      const XLSX = await import("xlsx");
      const rows = filteredPlans.flatMap(p => {
        const tasks = parseSessionPlan(p.session_plan);
        if (tasks.length === 0) {
          return [
            {
              "Plan ID": p.id,
              "Campus ID": p.college_id,
              "Faculty Name": p.mentor_name || "—",
              "Department": p.department || "—",
              "Class / Cohort": p.class_group,
              "Subject": p.subject,
              "Week": `Week ${p.week_number}`,
              "Unit": p.unit || "—",
              "Day": "—",
              "Daily Topic": p.topics_planned || "—",
              "Teaching Mode": "—",
              "Status": p.status,
              "Reviewer Feedback": p.cam_feedback || "—"
            }
          ];
        }
        return tasks.map(t => ({
          "Plan ID": p.id,
          "Campus ID": p.college_id,
          "Faculty Name": p.mentor_name || "—",
          "Department": p.department || "—",
          "Class / Cohort": p.class_group,
          "Subject": p.subject,
          "Week": `Week ${p.week_number}`,
          "Unit": p.unit || "—",
          "Day": t.day,
          "Daily Topic": t.topic,
          "Learning Objectives": t.objectives,
          "Teaching Mode": t.teachingMode,
          "Material Link": t.materialUrl || "—",
          "Status": p.status,
          "Reviewer Feedback": p.cam_feedback || "—"
        }));
      });

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(rows);
      XLSX.utils.book_append_sheet(wb, ws, "WeeklyPlans");
      XLSX.writeFile(wb, `Weekly_Plans_${new Date().toISOString().split("T")[0]}.xlsx`);
      toast("Weekly plans exported successfully.", "success");
    } catch (e: any) {
      toast("Export failed: " + e.message, "error");
    }
  };

  return (
    <div className="space-y-6 font-sans">
      {/* ─── Top Header Card ─── */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-600 flex items-center justify-center text-white shadow-xs">
              <CalendarRange className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-black text-slate-900">Faculty Weekly Teaching Plans</h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-indigo-50 border border-indigo-200 text-indigo-700">
                  {role.toUpperCase()} View
                </span>
                {collegeName && (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                    {collegeName}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Review submitted all-days teaching roadmaps, verify curriculum pacing, and leave feedback.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={fetchPlans}
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors cursor-pointer"
              title="Refresh Plans"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin text-indigo-600" : ""}`} />
            </button>
            <button
              type="button"
              onClick={handleExportExcel}
              className="px-3.5 py-2 rounded-xl text-xs font-extrabold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Export Excel</span>
            </button>
          </div>
        </div>

        {/* KPI Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
          <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Total Plans</span>
            <span className="text-2xl font-black text-slate-900 mt-1 block">{totalCount}</span>
          </div>
          <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl">
            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700 block">Verified Plans</span>
            <span className="text-2xl font-black text-emerald-800 mt-1 block">{verifiedCount}</span>
          </div>
          <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl">
            <span className="text-[10px] font-black uppercase tracking-wider text-amber-700 block">Pending Review</span>
            <span className="text-2xl font-black text-amber-800 mt-1 block">{pendingCount}</span>
          </div>
          <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl">
            <span className="text-[10px] font-black uppercase tracking-wider text-rose-700 block">Needs Revision</span>
            <span className="text-2xl font-black text-rose-800 mt-1 block">{revisionCount}</span>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-2">
          {/* College Filter (if multiple available) */}
          {allColleges.length > 1 && (
            <div>
              <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">Campus</label>
              <select
                value={selectedCollege}
                onChange={e => setSelectedCollege(e.target.value)}
                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
              >
                <option value="all">All Campuses</option>
                {allColleges.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Week Filter */}
          <div>
            <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">Week</label>
            <select
              value={selectedWeek}
              onChange={e => setSelectedWeek(e.target.value)}
              className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="all">All Academic Weeks</option>
              {Array.from({ length: 16 }, (_, i) => i + 1).map(w => (
                <option key={w} value={String(w)}>
                  Week {w}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">Status</label>
            <select
              value={selectedStatus}
              onChange={e => setSelectedStatus(e.target.value)}
              className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="all">All Statuses</option>
              <option value="Submitted">Submitted (Pending Review)</option>
              <option value="Verified">Verified</option>
              <option value="Needs Revision">Needs Revision</option>
              <option value="Draft">Draft</option>
            </select>
          </div>

          {/* Search Input */}
          <div className={allColleges.length <= 1 ? "md:col-span-2" : ""}>
            <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">Search</label>
            <div className="relative">
              <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search mentor, subject, cohort..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>
        </div>
      </div>

      {/* ─── Plans Table ─── */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs min-w-[850px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-black uppercase tracking-wider text-slate-600">
                <th className="p-3.5">Week</th>
                <th className="p-3.5">Faculty / Mentor</th>
                <th className="p-3.5">Department</th>
                <th className="p-3.5">Class / Cohort</th>
                <th className="p-3.5">Subject</th>
                <th className="p-3.5">Unit</th>
                <th className="p-3.5 text-center">Days Planned</th>
                <th className="p-3.5 text-center">Status</th>
                <th className="p-3.5 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {filteredPlans.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-slate-400 italic">
                    No weekly plans found matching your filters.
                  </td>
                </tr>
              ) : (
                filteredPlans.map(plan => {
                  const tasks = parseSessionPlan(plan.session_plan);
                  const filledDaysCount = tasks.filter(t => t.topic.trim().length > 0).length;

                  return (
                    <tr
                      key={plan.id}
                      onClick={() => setInspectingPlan(plan)}
                      className="hover:bg-indigo-50/40 cursor-pointer transition-colors group"
                    >
                      <td className="p-3.5 font-black text-indigo-700">Week {plan.week_number}</td>
                      <td className="p-3.5">
                        <div className="font-extrabold text-slate-900">{plan.mentor_name || "Unassigned"}</div>
                        <div className="text-[10px] text-slate-400">{plan.mentor_id}</div>
                      </td>
                      <td className="p-3.5 text-slate-700">{plan.department || "—"}</td>
                      <td className="p-3.5">
                        <span className="px-2 py-0.5 rounded-lg bg-slate-100 text-slate-800 font-bold text-[11px]">
                          {plan.class_group}
                        </span>
                      </td>
                      <td className="p-3.5 font-bold text-slate-800">{plan.subject}</td>
                      <td className="p-3.5 text-slate-600">{plan.unit || "—"}</td>
                      <td className="p-3.5 text-center">
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-slate-100 text-slate-700">
                          {filledDaysCount} / 6 Days
                        </span>
                      </td>
                      <td className="p-3.5 text-center">
                        <span
                          className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${
                            plan.status === "Verified"
                              ? "bg-emerald-100 text-emerald-800"
                              : plan.status === "Needs Revision"
                              ? "bg-rose-100 text-rose-800"
                              : plan.status === "Submitted"
                              ? "bg-indigo-100 text-indigo-800"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {plan.status}
                        </span>
                      </td>
                      <td className="p-3.5 text-center" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setInspectingPlan(plan)}
                            className="px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white font-bold text-[10.5px] transition-colors cursor-pointer flex items-center gap-1"
                          >
                            <Eye className="h-3 w-3" />
                            <span>View</span>
                          </button>
                          {(role === "cm" || role === "sme" || role === "admin") && (
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedPlanForReview(plan);
                                setFeedbackInput(plan.cam_feedback || "");
                              }}
                              className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[10.5px] transition-colors cursor-pointer"
                            >
                              Review
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── Detailed Plan Inspection Modal ─── */}
      {inspectingPlan && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4 animate-in fade-in duration-200"
          onClick={() => setInspectingPlan(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/80">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600 shrink-0">
                  <CalendarRange className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base font-black text-slate-900">
                      Week {inspectingPlan.week_number} Teaching Plan: {inspectingPlan.subject}
                    </h3>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-indigo-100 text-indigo-800">
                      {inspectingPlan.status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    Faculty: <span className="font-bold text-slate-800">{inspectingPlan.mentor_name}</span> • Cohort:{" "}
                    <span className="font-bold text-slate-800">{inspectingPlan.class_group}</span> • Unit:{" "}
                    <span className="font-bold text-slate-800">{inspectingPlan.unit || "—"}</span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setInspectingPlan(null)}
                className="h-8 w-8 rounded-full bg-slate-200/70 hover:bg-slate-300 text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto space-y-5">
              {/* Summary details */}
              {(inspectingPlan.topics_planned || inspectingPlan.learning_objectives || inspectingPlan.material_url) && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-4 rounded-xl bg-slate-50 border border-slate-200/80">
                  {inspectingPlan.topics_planned && (
                    <div>
                      <span className="text-[10px] font-black uppercase text-slate-400 block mb-0.5">Weekly Focus</span>
                      <p className="text-xs font-semibold text-slate-800">{inspectingPlan.topics_planned}</p>
                    </div>
                  )}
                  {inspectingPlan.learning_objectives && (
                    <div>
                      <span className="text-[10px] font-black uppercase text-slate-400 block mb-0.5">Learning Goals</span>
                      <p className="text-xs font-semibold text-slate-800">{inspectingPlan.learning_objectives}</p>
                    </div>
                  )}
                  {inspectingPlan.material_url && (
                    <div>
                      <span className="text-[10px] font-black uppercase text-slate-400 block mb-0.5">Study Materials</span>
                      <a
                        href={inspectingPlan.material_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs font-bold text-indigo-600 hover:underline flex items-center gap-1"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        <span>Open Document Link</span>
                      </a>
                    </div>
                  )}
                </div>
              )}

              {/* Day-by-Day Tasks */}
              <div>
                <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider mb-3">
                  All-Days Task Roadmap (Monday – Saturday)
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {parseSessionPlan(inspectingPlan.session_plan).map((task, idx) => (
                    <div
                      key={task.day}
                      className="p-3.5 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-2"
                    >
                      <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                        <span className="text-xs font-black text-slate-900">{task.day}</span>
                        <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 font-extrabold text-[9.5px]">
                          {task.teachingMode}
                        </span>
                      </div>
                      <div>
                        <span className="text-[9.5px] font-black uppercase text-slate-400 block">Topic / Task</span>
                        <p className="text-xs font-bold text-slate-800 mt-0.5">
                          {task.topic || <span className="text-slate-400 italic">No topic specified</span>}
                        </p>
                      </div>
                      {task.objectives && (
                        <div>
                          <span className="text-[9.5px] font-black uppercase text-slate-400 block">Activity / Focus</span>
                          <p className="text-[11px] text-slate-600 mt-0.5">{task.objectives}</p>
                        </div>
                      )}
                      {task.materialUrl && (
                        <div className="pt-1">
                          <a
                            href={task.materialUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[10.5px] text-indigo-600 font-bold hover:underline flex items-center gap-1"
                          >
                            <ExternalLink className="h-3 w-3" />
                            <span>Resource Link</span>
                          </a>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Reviewer Feedback (if any) */}
              {inspectingPlan.cam_feedback && (
                <div className="p-4 rounded-xl bg-amber-50 border border-amber-200">
                  <span className="text-xs font-black text-amber-900 uppercase tracking-wider block">Reviewer Feedback:</span>
                  <p className="text-xs text-amber-800 font-medium mt-1">{inspectingPlan.cam_feedback}</p>
                  {inspectingPlan.verified_by && (
                    <span className="text-[10px] text-amber-700 font-bold block mt-1">
                      By {inspectingPlan.verified_by} on {inspectingPlan.verified_at}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-6 py-3.5 border-t border-slate-100 bg-slate-50/50">
              <span className="text-xs text-slate-400 font-medium">Plan ID: {inspectingPlan.id}</span>
              <div className="flex items-center gap-2">
                {(role === "cm" || role === "sme" || role === "admin") && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedPlanForReview(inspectingPlan);
                      setFeedbackInput(inspectingPlan.cam_feedback || "");
                      setInspectingPlan(null);
                    }}
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black transition-colors cursor-pointer"
                  >
                    Review / Verify
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setInspectingPlan(null)}
                  className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Review & Verification Modal ─── */}
      {selectedPlanForReview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4 animate-in fade-in duration-200"
          onClick={() => setSelectedPlanForReview(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden animate-in zoom-in-95 duration-200"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-sm font-black text-slate-900">Review Weekly Teaching Plan</h3>
                  <p className="text-xs text-slate-500 font-medium">
                    Faculty: {selectedPlanForReview.mentor_name} • Week {selectedPlanForReview.week_number}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedPlanForReview(null)}
                  className="h-7 w-7 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center hover:bg-slate-200"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Feedback / Revision Guidance (Optional for Verification, Required for Revision)
                </label>
                <textarea
                  rows={4}
                  placeholder="e.g. Please include hands-on lab exercise details on Thursday..."
                  value={feedbackInput}
                  onChange={e => setFeedbackInput(e.target.value)}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  disabled={submittingReview}
                  onClick={() => setSelectedPlanForReview(null)}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={submittingReview || !feedbackInput.trim()}
                  onClick={() => handleReviewAction("Needs Revision")}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 disabled:opacity-50"
                >
                  Request Revision
                </button>
                <button
                  type="button"
                  disabled={submittingReview}
                  onClick={() => handleReviewAction("Verified")}
                  className="px-4 py-2 rounded-xl text-xs font-black text-white bg-emerald-600 hover:bg-emerald-700 shadow-xs disabled:opacity-50"
                >
                  ✓ Verify Plan
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
