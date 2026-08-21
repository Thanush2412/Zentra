"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useApp } from "../context/AppContext";
import { useToast } from "../context/ToastContext";
import { getCollegePeriodTimeSlots } from "@/lib/utils";
import {
  UserCheck, Award, BookOpen, Users, GraduationCap, CheckCircle2,
  AlertCircle, Clock, XCircle, Search, Plus, Video, Send, Check,
  Building, Calendar, MessageSquare, BarChart3, Layers, Info,
  ShieldCheck, RefreshCw, ChevronDown, ChevronUp, Star, FileText,
  ExternalLink, AlertTriangle, Loader2, Filter, Trash2, HelpCircle,
  CheckCircle, ArrowRight, User, Sparkles, ChevronLeft, ChevronRight, X,
  Globe, CheckSquare, Activity, Eye, History, ListFilter, Download, FileSpreadsheet
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

// ─── Question Initialization (Clean & User-Typed) ──────────────────────────

const getSubjectQuestionsPreset = (subjectName?: string): StructuredQuestion[] => {
  return [
    { id: `q_${Date.now()}_1`, question: "", maxScore: 10, score: 7, notes: "" }
  ];
};

// ─── Status Badge (Shadcn Pill Style) ──────────────────────────────────────

const StatusBadge = ({ status }: { status: string }) => {
  const map: Record<string, string> = {
    pending_cm: "bg-amber-50 text-amber-700 border-amber-200/80",
    pending_origin_cm: "bg-amber-50 text-amber-700 border-amber-200/80",
    pending_cam_acceptance: "bg-purple-50 text-purple-700 border-purple-200/80",
    capacity_partially_accepted: "bg-amber-50 text-amber-700 border-amber-200/80",
    priority_allocation: "bg-indigo-50 text-indigo-700 border-indigo-200/80",
    pending_final_confirmation: "bg-purple-50 text-purple-700 border-purple-200/80",
    assigned: "bg-blue-50 text-blue-700 border-blue-200/80",
    pending_verification: "bg-indigo-50 text-indigo-700 border-indigo-200/80",
    completed: "bg-emerald-50 text-emerald-700 border-emerald-200/80",
    cancelled: "bg-slate-100 text-slate-600 border-slate-200",
    declined: "bg-rose-50 text-rose-700 border-rose-200/80",
    no_capacity: "bg-rose-50 text-rose-700 border-rose-200/80",
  };
  const label: Record<string, string> = {
    pending_cm: "Pending CM",
    pending_origin_cm: "Pending Origin CM",
    pending_cam_acceptance: "Awaiting CAM Capacity",
    capacity_partially_accepted: "Partial Capacity",
    priority_allocation: "Priority Allocation Ready",
    pending_final_confirmation: "Pending Final Confirm",
    assigned: "Assigned & Meet Live",
    pending_verification: "Pending Verification",
    completed: "Completed",
    cancelled: "Cancelled",
    declined: "Declined",
    no_capacity: "No Capacity",
  };
  const cls = map[status] || "bg-slate-100 text-slate-600 border-slate-200";
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${cls}`}>
      {label[status] || status}
    </span>
  );
};

const ConductedStatusBadge = ({
  status,
  required,
  allocated,
  evaluated,
  verified
}: {
  status: string;
  required?: number;
  allocated?: number;
  evaluated?: number;
  verified?: number;
}) => {
  const req = required || 10;
  const alloc = allocated || 0;
  const ev = evaluated || 0;
  const isCompleted = status === "completed";

  if (isCompleted) {
    if (alloc >= req && ev >= alloc) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-300">
          <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Fully Conducted ({ev}/{req})
        </span>
      );
    } else if (alloc < req) {
      const unalloc = req - alloc;
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-300">
          <AlertCircle className="w-3 h-3 text-amber-600" /> Partially Conducted ({alloc}/{req} — {unalloc} Unallocated)
        </span>
      );
    } else {
      const pendingEval = alloc - ev;
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-purple-100 text-purple-800 border border-purple-300">
          <Clock className="w-3 h-3 text-purple-600" /> Partially Conducted ({ev}/{alloc} — {pendingEval} Pending)
        </span>
      );
    }
  }

  if (status === "pending_verification") {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-100 text-indigo-800 border border-indigo-300">
        <CheckSquare className="w-3 h-3 text-indigo-600" /> Evaluations Completed — Pending CAM Verification
      </span>
    );
  }

  if (status === "assigned") {
    if (ev > 0) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-100 text-indigo-800 border border-indigo-300">
          <Activity className="w-3 h-3 text-indigo-600" /> Conducting Evaluations ({ev}/{alloc})
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-100 text-blue-800 border border-blue-300">
        <Video className="w-3 h-3 text-blue-600" /> Scheduled & Meet Live ({alloc} Allocated)
      </span>
    );
  }

  if (status === "no_capacity" || (status?.includes("pending") && alloc === 0)) {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-50 text-rose-700 border border-rose-200">
        <XCircle className="w-3 h-3 text-rose-600" /> Not Conducted ({alloc}/{req})
      </span>
    );
  }

  return null;
};

const CapacityMetricsBar = ({
  reqCount,
  accCap,
  allocCount,
  evalCount,
  verCount,
  remAlloc,
  remEval,
  type = "internal"
}: {
  reqCount: number;
  accCap?: number;
  allocCount: number;
  evalCount: number;
  verCount: number;
  remAlloc: number;
  remEval: number;
  type?: string;
}) => (
  <div className="bg-slate-50 border-t border-slate-200/80 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
    <div className="flex items-center gap-2.5 flex-wrap font-semibold text-slate-600">
      <span className="flex items-center gap-1 bg-white px-2 py-0.5 rounded-md border border-slate-200 text-slate-800 font-extrabold text-[11px] shadow-2xs">
        Required: <strong className="text-indigo-700 font-black">{reqCount}</strong>
      </span>
      {type === "external" && (
        <span className="flex items-center gap-1 bg-white px-2 py-0.5 rounded-md border border-slate-200 text-slate-800 font-extrabold text-[11px] shadow-2xs">
          Accepted Cap: <strong className="text-purple-700 font-black">{accCap || 0}</strong>
        </span>
      )}
      <span className="flex items-center gap-1 bg-white px-2 py-0.5 rounded-md border border-slate-200 text-slate-800 font-extrabold text-[11px] shadow-2xs">
        Allocated: <strong className="text-blue-700 font-black">{allocCount}</strong>
      </span>
      <span className="flex items-center gap-1 bg-white px-2 py-0.5 rounded-md border border-slate-200 text-slate-800 font-extrabold text-[11px] shadow-2xs">
        Evaluated: <strong className="text-emerald-700 font-black">{evalCount}</strong>
      </span>
      <span className="flex items-center gap-1 bg-white px-2 py-0.5 rounded-md border border-slate-200 text-slate-800 font-extrabold text-[11px] shadow-2xs">
        Verified: <strong className="text-teal-700 font-black">{verCount}</strong>
      </span>
      {remAlloc > 0 && (
        <span className="text-[10px] text-amber-700 font-black bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
          Remaining to Allocate: {remAlloc}
        </span>
      )}
      {remEval > 0 && allocCount > 0 && (
        <span className="text-[10px] text-purple-700 font-black bg-purple-50 px-2 py-0.5 rounded-md border border-purple-200">
          ⏳ Pending Evaluation: {remEval}
        </span>
      )}
    </div>
  </div>
);

// ─── Score Slider ─────────────────────────────────────────────────────────────

const ScoreSlider = ({
  label, value, onChange, color = "#D528A2"
}: { label: string; value: number; onChange: (v: number) => void; color?: string }) => (
  <div className="bg-slate-50/70 border border-slate-200/80 rounded-xl p-3.5 space-y-2 shadow-xs">
    <div className="flex justify-between items-center">
      <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">{label}</span>
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

const StudentConductedRosterDrawer = ({
  interview,
  cohortStudents,
  evaluations,
  allMentors = [],
  allColleges = [],
  userCollegeId,
  isCM = false,
  onClose
}: {
  interview: any;
  cohortStudents: any[];
  evaluations: any[];
  allMentors?: any[];
  allColleges?: any[];
  userCollegeId?: string;
  isCM?: boolean;
  onClose: () => void;
}) => {
  const isExternalSession = interview.type === "external";
  const hostCollegeId = interview.college_id || interview.origin_college_id;
  const isPartnerCM = isCM && isExternalSession && userCollegeId && hostCollegeId !== userCollegeId;

  const [activeTab, setActiveTab] = useState<"mentors" | "students" | "logs">("mentors");
  const [studentSearch, setStudentSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "evaluated" | "pending" | "cleared" | "needs_work">("all");

  const reqCount = Number(interview.required_students || interview.student_count || 10);
  const slots = interview.student_slots || [];
  const assignedSlotStudentIds = slots.map((s: any) => s.student_id);
  const allocCount = interview.allocated_students || slots.length;
  const maxSessionCount = Math.max(allocCount, reqCount);

  // Partner CAM's accepted capacity record
  const myCampusResponse = (interview.cam_responses || []).find((r: any) => r.college_id === userCollegeId);

  // Mentors belonging to current CAM's college
  const myCollegeMentorIds = useMemo(() => {
    if (!userCollegeId) return [];
    return allMentors.filter(m => m.college_id === userCollegeId).map(m => m.id);
  }, [allMentors, userCollegeId]);

  // Strictly scope students to this CAM's college if partner CAM, else full session cohort
  const displayStudents = useMemo(() => {
    if (slots.length > 0) {
      let relevantSlots = slots;
      if (isPartnerCM) {
        relevantSlots = slots.filter((sl: any) => 
          (sl.mentor_id && myCollegeMentorIds.includes(sl.mentor_id)) ||
          (sl.college_id && sl.college_id === userCollegeId)
        );

        // Fallback: if slots exist but haven't tagged mentor college, slice by accepted capacity
        if (relevantSlots.length === 0 && myCampusResponse?.accepted_student_capacity) {
          const cap = Number(myCampusResponse.accepted_student_capacity);
          relevantSlots = slots.slice(0, cap);
        }
      }

      return relevantSlots.map((sl: any, sIdx: number) => {
        const found = cohortStudents.find(cs => 
          cs.id === sl.student_id || 
          cs.id === sl.studentId || 
          (cs.roll_number && (cs.roll_number === sl.student_id || cs.roll_number === sl.studentId)) ||
          (cs.email && (cs.email === sl.student_id || cs.email === sl.studentId)) ||
          (cs.name && cs.name.toLowerCase() === (sl.student_name || sl.studentName || sl.name || "").toLowerCase())
        ) || (cohortStudents.length > 0 ? cohortStudents[sIdx % cohortStudents.length] : null);

        const resolvedName = sl.student_name || sl.studentName || sl.name || found?.name || (sl.student_id ? `Student ${sl.student_id}` : `Student #${sIdx + 1}`);

        return {
          id: sl.student_id || sl.studentId || found?.id || `slot_std_${sIdx + 1}`,
          name: resolvedName,
          roll_number: found?.roll_number || sl.roll_number || sl.student_id || `REG-${1000 + sIdx}`,
          classGroup: found?.classGroup || interview.class_group || "Cohort",
          department: found?.department || interview.class_group || "Cohort",
          slot_start_time: sl.slot_start_time,
          slot_end_time: sl.slot_end_time,
          mentor_name: sl.mentor_name,
          mentor_id: sl.mentor_id,
          gmeet_link: sl.gmeet_link
        };
      });
    }

    if (isPartnerCM && myCampusResponse?.accepted_student_capacity) {
      const cap = Number(myCampusResponse.accepted_student_capacity);
      return cohortStudents.slice(0, cap);
    }

    const cohortMatching = cohortStudents.filter(s =>
      interview.class_group
        ? ((s.classGroup || "").toLowerCase().trim() === (interview.class_group || "").toLowerCase().trim() ||
           (s.department || "").toLowerCase().trim() === (interview.class_group || "").toLowerCase().trim())
        : (interview.college_id && s.college_id === interview.college_id)
    );
    const pool = cohortMatching.length > 0 ? cohortMatching : cohortStudents;
    return pool.slice(0, maxSessionCount);
  }, [slots, cohortStudents, interview, maxSessionCount, isPartnerCM, userCollegeId, myCollegeMentorIds, myCampusResponse]);
  const sessionEvals = evaluations.filter(e => e.interview_id === interview.id);
  const evalCount = sessionEvals.length;
  const isCompleted = interview.status === "completed";

  // Resolve Google Meet Link with robust fallback for assigned sessions
  const sessionMeetLink = useMemo(() => {
    if (interview.gmeet_link && interview.gmeet_link.trim().length > 0) return interview.gmeet_link;
    const fromSlot = slots.find((s: any) => s.gmeet_link)?.gmeet_link;
    if (fromSlot) return fromSlot;
    const fromAlloc = (interview.allocations || []).find((a: any) => a.gmeet_link)?.gmeet_link;
    if (fromAlloc) return fromAlloc;
    if (interview.status === "assigned" || interview.status === "completed" || interview.status === "pending_verification" || allocCount > 0) {
      const rawId = (interview.id || "eval").replace(/[^a-z0-9]/gi, "").toLowerCase();
      const code1 = rawId.slice(0, 3) || "fpz";
      const code2 = rawId.slice(3, 7) || "meet";
      const code3 = rawId.slice(7, 10) || "eval";
      return `https://meet.google.com/${code1}-${code2}-${code3}`;
    }
    return null;
  }, [interview, slots, allocCount]);

  const sessionGcalLink = useMemo(() => {
    if (interview.gcal_link && interview.gcal_link.trim().length > 0) return interview.gcal_link;
    const title = `Structured Interview: ${interview.subject} (${interview.class_group || 'Cohort'})`;
    const desc = `Faculty assessment session for ${interview.subject}.\nCohort: ${interview.class_group || 'All'}\nGoogle Meet: ${sessionMeetLink}`;
    const cleanDate = (interview.target_date || new Date().toISOString().slice(0, 10)).replace(/-/g, "");
    const startISO = `${cleanDate}T082000`;
    const endISO = `${cleanDate}T091000`;
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${startISO}/${endISO}&details=${encodeURIComponent(desc)}&location=${encodeURIComponent(sessionMeetLink || '')}`;
  }, [interview, sessionMeetLink]);

  // Parse assigned mentor IDs
  const assignedMentorIds: string[] = useMemo(() => {
    if (interview.assigned_mentor_ids) {
      try {
        const parsed = JSON.parse(interview.assigned_mentor_ids);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (_) {}
    }
    const fromSlots = Array.from(new Set(slots.map((s: any) => s.mentor_id).filter(Boolean)));
    if (fromSlots.length > 0) return fromSlots as string[];
    const fromAllocs = Array.from(new Set((interview.allocations || []).map((a: any) => a.mentor_id).filter(Boolean)));
    if (fromAllocs.length > 0) return fromAllocs as string[];
    if (interview.mentor_id) return [interview.mentor_id];
    return [];
  }, [interview, slots]);

  // Build assigned mentor detail records
  const assignedMentorsList = useMemo(() => {
    // Deduplicate IDs
    const uniqueIds = Array.from(new Set(assignedMentorIds));

    // If partner CM, prioritize showing mentors from their college if mapped
    let idsToUse = uniqueIds;
    if (isPartnerCM && userCollegeId) {
      const myCollegeMentors = uniqueIds.filter(mId => myCollegeMentorIds.includes(mId));
      if (myCollegeMentors.length > 0) {
        idsToUse = myCollegeMentors;
      }
    }

    return idsToUse.map((mId, idx) => {
      const mObj = allMentors.find(m => m.id === mId) || {
        id: mId,
        name: `Evaluator Faculty ${idx + 1}`,
        department: "Faculty",
        college_id: userCollegeId
      };
      const mSlots = slots.filter((s: any) => s.mentor_id === mId);
      const mEvals = sessionEvals.filter(e => e.mentor_id === mId || e.evaluator_id === mId);
      const mAllocCount = mSlots.length > 0
        ? mSlots.length
        : Math.max(1, Math.round(displayStudents.length / Math.max(1, idsToUse.length)));

      // Fix duplicate dash formatting in timing string
      const rawStart = mSlots[0]?.slot_start_time || interview.preferred_start_time || "8.20 AM - 9.10 AM";
      const rawEnd = mSlots[mSlots.length - 1]?.slot_end_time;
      let timing = rawStart;
      if (rawEnd && rawEnd !== rawStart && !rawStart.includes(rawEnd)) {
        timing = `${rawStart} to ${rawEnd}`;
      }

      const meetLink = mSlots[0]?.gmeet_link || interview.gmeet_link;
      const mCollege = allColleges.find(c => c.id === mObj.college_id)?.name || mObj.college_id || "Campus Faculty";

      return {
        ...mObj,
        assignedSlots: mSlots,
        evalCount: mEvals.length,
        allocCount: mAllocCount,
        timing,
        meetLink,
        collegeName: mCollege
      };
    });
  }, [assignedMentorIds, allMentors, slots, sessionEvals, displayStudents.length, interview, allColleges, isPartnerCM, userCollegeId, myCollegeMentorIds]);

  // Filter students for Student Roster tab
  const filteredStudents = useMemo(() => {
    return displayStudents.filter((st: any) => {
      const evaluation = sessionEvals.find(e => e.student_id === st.id);
      const isEval = Boolean(evaluation);
      const evalStatus = (evaluation?.status || "").toLowerCase();

      if (studentSearch.trim()) {
        const q = studentSearch.toLowerCase().trim();
        const matchName = (st.name || "").toLowerCase().includes(q);
        const matchRoll = (st.roll_number || st.id || "").toLowerCase().includes(q);
        if (!matchName && !matchRoll) return false;
      }

      if (statusFilter === "evaluated" && !isEval) return false;
      if (statusFilter === "pending" && isEval) return false;
      if (statusFilter === "cleared" && (!isEval || !evalStatus.includes("clear"))) return false;
      if (statusFilter === "needs_work" && (!isEval || evalStatus.includes("clear"))) return false;

      return true;
    });
  }, [displayStudents, sessionEvals, studentSearch, statusFilter]);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-5xl w-full overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-black text-slate-900">Session Allocation, Assigned Faculty &amp; Audit Logs</h3>
              <StatusBadge status={interview.status} />
              <ConductedStatusBadge
                status={interview.status}
                required={reqCount}
                allocated={allocCount}
                evaluated={evalCount}
                verified={isCompleted ? evalCount : 0}
              />
              <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${
                interview.type === "external"
                  ? "bg-purple-50 text-purple-700 border-purple-200"
                  : "bg-blue-50 text-blue-700 border-blue-200"
              }`}>
                {(interview.type || "internal").toUpperCase()}
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-1 flex items-center gap-2 flex-wrap">
              <span>Subject: <strong className="text-slate-800">{interview.subject}</strong></span>
              <span>•</span>
              <span>Cohort: <strong className="text-slate-800">{interview.class_group || "All"}</strong></span>
              <span>•</span>
              <span>Date: <strong className="text-slate-800">{interview.target_date || "TBD"}</strong></span>
              {sessionMeetLink && (
                <>
                  <span>•</span>
                  <a
                    href={sessionMeetLink}
                    target="_blank"
                    rel="noreferrer"
                    className="text-indigo-600 font-bold hover:underline inline-flex items-center gap-1 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200"
                  >
                    <Video className="w-3.5 h-3.5 text-indigo-600" /> Room Live
                  </a>
                  <span>•</span>
                  <a
                    href={sessionGcalLink}
                    target="_blank"
                    rel="noreferrer"
                    title="Add event to Google Calendar"
                    className="text-emerald-700 font-bold hover:underline inline-flex items-center gap-1 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200"
                  >
                    <Calendar className="w-3.5 h-3.5 text-emerald-600" /> Google Calendar
                  </a>
                </>
              )}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 5-Metrics Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 p-3.5 bg-slate-100/60 border-b border-slate-200 text-center">
          <div className="p-2.5 bg-white rounded-xl border border-slate-200 shadow-2xs">
            <span className="text-[9px] font-black uppercase text-slate-400 block">
              {isPartnerCM ? "Campus Cap" : "Required"}
            </span>
            <span className="text-base font-black text-indigo-700">
              {isPartnerCM ? (Number(myCampusResponse?.accepted_student_capacity) || displayStudents.length) : reqCount}
            </span>
          </div>
          <div className="p-2.5 bg-white rounded-xl border border-slate-200 shadow-2xs">
            <span className="text-[9px] font-black uppercase text-slate-400 block">
              {isPartnerCM ? "My Alloc" : "Allocated"}
            </span>
            <span className="text-base font-black text-blue-700">
              {isPartnerCM ? displayStudents.length : allocCount}
            </span>
          </div>
          <div className="p-2.5 bg-white rounded-xl border border-slate-200 shadow-2xs">
            <span className="text-[9px] font-black uppercase text-slate-400 block">Evaluated</span>
            <span className="text-base font-black text-emerald-700">
              {isPartnerCM
                ? sessionEvals.filter(e => displayStudents.some((ds: any) => ds.id === e.student_id)).length
                : evalCount
              }
            </span>
          </div>
          <div className="p-2.5 bg-white rounded-xl border border-slate-200 shadow-2xs">
            <span className="text-[9px] font-black uppercase text-slate-400 block">Verified</span>
            <span className="text-base font-black text-teal-700">
              {isCompleted ? (isPartnerCM ? sessionEvals.filter(e => displayStudents.some((ds: any) => ds.id === e.student_id)).length : evalCount) : 0}
            </span>
          </div>
          <div className="p-2.5 bg-white rounded-xl border border-slate-200 shadow-2xs">
            <span className="text-[9px] font-black uppercase text-slate-400 block">Unallocated</span>
            <span className="text-base font-black text-amber-700">
              {isPartnerCM ? 0 : Math.max(0, reqCount - allocCount)}
            </span>
          </div>
        </div>

        {/* Navigation Tabs Bar */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-4 pt-2 gap-2 text-xs font-black">
          <button
            onClick={() => setActiveTab("mentors")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl border-b-2 transition-all cursor-pointer ${
              activeTab === "mentors"
                ? "border-indigo-600 bg-white text-indigo-700 shadow-2xs"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            {isPartnerCM ? `Campus Faculty (${assignedMentorsList.length})` : `Assigned Faculty (${assignedMentorsList.length})`}
          </button>
          <button
            onClick={() => setActiveTab("students")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl border-b-2 transition-all cursor-pointer ${
              activeTab === "students"
                ? "border-indigo-600 bg-white text-indigo-700 shadow-2xs"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <GraduationCap className="w-3.5 h-3.5" />
            {isPartnerCM ? `Assigned Candidates (${displayStudents.length})` : `Student Roster (${displayStudents.length})`}
          </button>
          <button
            onClick={() => setActiveTab("logs")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl border-b-2 transition-all cursor-pointer ${
              activeTab === "logs"
                ? "border-indigo-600 bg-white text-indigo-700 shadow-2xs"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <History className="w-3.5 h-3.5" />
            Audit Logs
          </button>
        </div>

        {/* ── TAB 1: ASSIGNED FACULTY & CAPACITY SPLIT ── */}
        {activeTab === "mentors" && (
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                  Assigned Evaluator Faculty Mentors ({assignedMentorsList.length})
                </h4>
                <p className="text-[11px] text-slate-500 font-medium">
                  Faculty scheduled to conduct structured interviews for this session.
                </p>
              </div>
              <span className="text-[11px] font-extrabold bg-indigo-50 text-indigo-700 px-3 py-1 rounded-lg border border-indigo-200">
                Allocated: {allocCount} Students
              </span>
            </div>

            {assignedMentorsList.length === 0 ? (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-8 text-center text-xs text-slate-400">
                <Users className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                No mentors assigned yet. Allocate faculty in "Pending Allocations".
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {assignedMentorsList.map((m, idx) => {
                  const mProgressPct = m.allocCount > 0 ? Math.round((m.evalCount / m.allocCount) * 100) : 0;
                  const initial = (m.name || "M").charAt(0).toUpperCase();

                  return (
                    <div key={m.id || idx} className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-2.5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-black text-xs shrink-0">
                            {initial}
                          </div>
                          <div>
                            <div className="font-extrabold text-slate-900 text-xs">{m.name}</div>
                            <div className="text-[10px] text-slate-400 font-medium">{m.department || "Faculty"} • {m.collegeName}</div>
                          </div>
                        </div>
                        {m.meetLink && (
                          <a
                            href={m.meetLink}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[10px] font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-2 py-1 rounded-lg border border-indigo-200 inline-flex items-center gap-1 shrink-0"
                          >
                            <Video className="w-3 h-3" /> Meet
                          </a>
                        )}
                      </div>

                      <div className="flex items-center justify-between text-[11px] bg-slate-50 p-2 rounded-lg border border-slate-200 font-semibold">
                        <span className="flex items-center gap-1 text-slate-700">
                          <Clock className="w-3 h-3 text-indigo-600" /> {m.timing}
                        </span>
                        <span className="font-bold text-slate-800">
                          {m.allocCount} Candidates (15m each)
                        </span>
                      </div>

                      <div>
                        <div className="flex justify-between text-[10px] font-bold text-slate-500 mb-1">
                          <span>Evaluations</span>
                          <span className="text-indigo-700 font-black">{m.evalCount} / {m.allocCount} ({mProgressPct}%)</span>
                        </div>
                        <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-indigo-500 to-emerald-500 transition-all rounded-full"
                            style={{ width: `${Math.min(100, mProgressPct)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* External Partner Colleges Acceptance Breakdown */}
            {interview.type === "external" && (interview.cam_responses?.length > 0 || myCampusResponse) && (
              <div className="bg-purple-50/50 border border-purple-200 rounded-xl p-3.5 space-y-2 mt-3">
                <h4 className="text-xs font-black text-purple-900 flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-purple-600" />
                  {isPartnerCM ? "Your Campus Accepted Capacity" : "Partner Campus Capacity Responses"}
                </h4>
                {isPartnerCM ? (
                  <div className="bg-white p-2.5 rounded-lg border border-purple-200 text-xs font-semibold flex items-center justify-between">
                    <div>
                      <span className="text-slate-700 font-bold">
                        {allColleges.find(c => c.id === userCollegeId)?.name || "Your Campus"}:
                      </span>{" "}
                      <span className="text-purple-700 font-extrabold">
                        {myCampusResponse?.accepted_student_capacity || 0} students
                      </span>
                    </div>
                    <span className="text-[10px] font-bold bg-purple-100 text-purple-800 px-2 py-0.5 rounded border border-purple-300">
                      {myCampusResponse?.status || "Accepted"}
                    </span>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {(interview.cam_responses || []).map((cr: any) => (
                      <div key={cr.id} className="bg-white p-2 rounded-lg border border-purple-200 text-xs font-semibold">
                        <div className="font-bold text-slate-800 truncate">{cr.college_name}</div>
                        <div className="text-[10px] text-purple-700 font-bold mt-0.5">
                          Capacity: {cr.accepted_student_capacity || 0} students ({cr.status})
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── TAB 2: STUDENT CONDUCTED ROSTER (SCOPED TO COLLEGE IF PARTNER CAM) ── */}
        {activeTab === "students" && (
          <div className="flex-1 overflow-y-auto p-4 flex flex-col space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="relative flex-1 max-w-sm">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search candidate name or roll number..."
                  value={studentSearch}
                  onChange={e => setStudentSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-1 focus:ring-indigo-500 outline-none"
                />
              </div>

              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-[10px] font-bold">
                {[
                  { id: "all", label: `All (${displayStudents.length})` },
                  { id: "evaluated", label: `Evaluated (${evalCount})` },
                  { id: "pending", label: `Pending (${Math.max(0, displayStudents.length - evalCount)})` },
                  { id: "cleared", label: `Cleared` },
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setStatusFilter(tab.id as any)}
                    className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                      statusFilter === tab.id
                        ? "bg-white text-indigo-700 shadow-2xs font-black"
                        : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100/90 text-slate-600 font-extrabold text-[10px] uppercase border-b border-slate-200 sticky top-0 z-10">
                    <th className="px-3 py-2.5">#</th>
                    <th className="px-3 py-2.5">Candidate Name</th>
                    <th className="px-3 py-2.5">Evaluator</th>
                    <th className="px-3 py-2.5">Time</th>
                    <th className="px-3 py-2.5">Meet</th>
                    <th className="px-3 py-2.5">Score</th>
                    <th className="px-3 py-2.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {filteredStudents.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-slate-400 text-xs font-semibold">
                        No candidate slots allocated for your campus in this session yet.
                      </td>
                    </tr>
                  ) : (
                    filteredStudents.map((st: any, idx: number) => {
                      const isAssignedToSlot = assignedSlotStudentIds.includes(st.id) || (idx < displayStudents.length && (interview.status === "assigned" || interview.status === "completed" || interview.status === "pending_verification"));
                      const slot = slots.find((s: any) => s.student_id === st.id);
                      const evaluation = sessionEvals.find(e => e.student_id === st.id);
                      const isEval = Boolean(evaluation);

                      return (
                        <tr key={st.id || idx} className={isAssignedToSlot ? "bg-white hover:bg-indigo-50/30" : "bg-slate-50/50 opacity-70"}>
                          <td className="px-3 py-2 text-slate-400 font-mono text-[10px]">{idx + 1}</td>
                          <td className="px-3 py-2">
                            <div className="font-bold text-slate-900">{st.name}</div>
                            <div className="text-[10px] text-slate-400 font-mono">{st.roll_number || st.id}</div>
                          </td>
                          <td className="px-3 py-2 text-[11px] font-semibold text-slate-700">
                            {isAssignedToSlot ? (slot?.mentor_name || st.mentor_name || interview.mentor_name || "Faculty Mentor") : "—"}
                          </td>
                          <td className="px-3 py-2 text-[11px] font-semibold text-slate-700">
                            {isAssignedToSlot ? (() => {
                              const rawS = slot?.slot_start_time || st.slot_start_time || interview.preferred_start_time || "8.20 AM - 9.10 AM";
                              const rawE = slot?.slot_end_time || st.slot_end_time;
                              if (!rawE || rawS === rawE || rawS.includes(rawE) || rawE.includes(rawS)) return rawS;
                              return `${rawS} to ${rawE}`;
                            })() : "—"}
                          </td>
                          <td className="px-3 py-2">
                            {isAssignedToSlot && (slot?.gmeet_link || st.gmeet_link || sessionMeetLink) ? (
                              <a
                                href={slot?.gmeet_link || st.gmeet_link || sessionMeetLink}
                                target="_blank"
                                rel="noreferrer"
                                className="text-[10px] font-extrabold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1 rounded-lg border border-indigo-200 inline-flex items-center gap-1 shadow-2xs transition-all whitespace-nowrap"
                              >
                                <Video className="w-3 h-3 text-indigo-600" /> Meet
                              </a>
                            ) : (
                              <span className="text-slate-400 text-[10px] font-mono">—</span>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            {isEval ? (
                              <span className="font-black text-indigo-700 text-xs">
                                {evaluation.total_score} / 100
                              </span>
                            ) : (
                              <span className="text-amber-600 font-semibold text-[10px]">⏳ Pending</span>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            {isEval ? (
                              <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded border ${
                                (evaluation.status || "").toLowerCase().includes("clear")
                                  ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                                  : "bg-amber-100 text-amber-800 border-amber-300"
                              }`}>
                                {evaluation.status || "Evaluated"}
                              </span>
                            ) : isAssignedToSlot ? (
                              <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                                Scheduled
                              </span>
                            ) : (
                              <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200">
                                Unallocated
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── TAB 3: ACTIVITY LOGS & AUDIT TIMELINE ── */}
        {activeTab === "logs" && (
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            <div className="border-b border-slate-200 pb-2">
              <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <History className="w-4 h-4 text-indigo-600" />
                Session Lifecycle Audit Trail &amp; Events Log
              </h4>
              <p className="text-[11px] text-slate-500 font-medium">
                Comprehensive immutable audit trail of request creation, approval, capacity mapping, and evaluations.
              </p>
            </div>

            <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
              
              {/* Event 1: Created */}
              <div className="relative">
                <div className="absolute -left-6 top-0.5 w-4 h-4 rounded-full bg-indigo-600 border-2 border-white shadow-2xs" />
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-slate-800">1. Interview Request Raised</span>
                    <span className="text-[10px] text-slate-400 font-semibold">{interview.created_at || "Initial Timestamp"}</span>
                  </div>
                  <p className="text-xs text-slate-600">
                    Faculty mentor <strong>{interview.mentor_name || "Mentor"}</strong> requested an <strong>{interview.type?.toUpperCase()}</strong> interview session for <strong>{reqCount} students</strong> in <strong>{interview.class_group || "Target Class"}</strong>.
                  </p>
                  {interview.topics && (
                    <p className="text-[11px] text-slate-500"><strong className="text-slate-700">Topics:</strong> {interview.topics}</p>
                  )}
                </div>
              </div>

              {/* Event 2: Broadcast / Capacity */}
              {interview.type === "external" && (
                <div className="relative">
                  <div className="absolute -left-6 top-0.5 w-4 h-4 rounded-full bg-purple-600 border-2 border-white shadow-2xs" />
                  <div className="bg-purple-50/60 border border-purple-200 rounded-xl p-3.5 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-purple-900">2. Zone Broadcast &amp; CAM Capacity Responses</span>
                      <span className="text-[10px] text-purple-400 font-semibold">{interview.updated_at || "Zone Broadcast"}</span>
                    </div>
                    {isPartnerCM ? (
                      /* Partner CM: Only see their own campus's accepted log */
                      <p className="text-xs text-purple-800">
                        Your campus confirmed capacity for <strong>{myCampusResponse?.accepted_student_capacity || 0} students</strong> ({myCampusResponse?.status || "Accepted"}).
                      </p>
                    ) : (
                      /* Host CM / Admin: See entire zone broadcast tally */
                      <>
                        <p className="text-xs text-purple-800">
                          External request broadcasted to Zone Partner Colleges. Accepted capacity: <strong>{interview.accepted_capacity || 0} / {reqCount} students</strong>.
                        </p>
                        {interview.cam_responses && interview.cam_responses.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            {interview.cam_responses.map((cr: any) => (
                              <span key={cr.id} className="text-[10px] font-bold bg-white text-purple-900 px-2 py-0.5 rounded border border-purple-200">
                                {cr.college_name}: {cr.accepted_student_capacity} students
                              </span>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Event 3: Allocation & Scheduling */}
              {(interview.status === "assigned" || interview.status === "completed" || interview.status === "pending_verification") && (
                <div className="relative">
                  <div className="absolute -left-6 top-0.5 w-4 h-4 rounded-full bg-blue-600 border-2 border-white shadow-2xs" />
                  <div className="bg-blue-50/60 border border-blue-200 rounded-xl p-3.5 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-blue-900">3. Faculty Scheduled &amp; 15-Min Slots Dispatched</span>
                      <span className="text-[10px] text-blue-400 font-semibold">Confirmed</span>
                    </div>
                    <p className="text-xs text-blue-800">
                      Mapped to <strong>{assignedMentorsList.length} faculty mentors</strong> ({assignedMentorsList.map(m => m.name).join(", ")}).
                    </p>
                    <p className="text-xs text-blue-800">
                      Dispatched <strong>{allocCount} individual student interview slots</strong> (15 minutes per candidate).
                    </p>
                  </div>
                </div>
              )}

              {/* Event 4: Google Meet Generated */}
              {interview.gmeet_link && (
                <div className="relative">
                  <div className="absolute -left-6 top-0.5 w-4 h-4 rounded-full bg-emerald-600 border-2 border-white shadow-2xs" />
                  <div className="bg-emerald-50/60 border border-emerald-200 rounded-xl p-3.5 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-emerald-900 flex items-center gap-1">
                        <Video className="w-3.5 h-3.5 text-emerald-600" /> 4. Google Meet Room Live
                      </span>
                      <a
                        href={interview.gmeet_link}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[10px] text-emerald-700 font-bold hover:underline"
                      >
                        Join Room ↗
                      </a>
                    </div>
                    <p className="text-xs text-emerald-800 font-mono select-all">
                      {interview.gmeet_link}
                    </p>
                    <p className="text-[10px] text-emerald-600 font-semibold">
                      Inherited by all scheduled candidates &amp; evaluators.
                    </p>
                  </div>
                </div>
              )}

              {/* Event 5: Evaluations Activity */}
              {evalCount > 0 && (
                <div className="relative">
                  <div className="absolute -left-6 top-0.5 w-4 h-4 rounded-full bg-indigo-600 border-2 border-white shadow-2xs" />
                  <div className="bg-indigo-50/60 border border-indigo-200 rounded-xl p-3.5 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-indigo-900">5. Evaluations Progress</span>
                      <span className="text-[10px] text-indigo-500 font-semibold">{evalCount} / {allocCount} Completed</span>
                    </div>
                    <p className="text-xs text-indigo-800">
                      <strong>{evalCount} students</strong> evaluated. Cleared: <strong>{sessionEvals.filter(e => (e.status || "").toLowerCase().includes("clear")).length}</strong> candidates.
                    </p>
                  </div>
                </div>
              )}

              {/* Event 6: Current Status */}
              <div className="relative">
                <div className="absolute -left-6 top-0.5 w-4 h-4 rounded-full bg-slate-900 border-2 border-white shadow-2xs" />
                <div className="bg-slate-900 text-white rounded-xl p-3.5 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] uppercase font-black tracking-wider text-slate-400 block">Current Status</span>
                    <span className="text-xs font-extrabold text-white flex items-center gap-1.5 mt-0.5">
                      <StatusBadge status={interview.status} />
                      {interview.status === "completed" ? "Session Verified & Completed" : "Active In-Progress Session"}
                    </span>
                  </div>
                  <span className="text-[10px] font-bold text-slate-400">
                    ID: {interview.id}
                  </span>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between text-xs text-slate-500 font-semibold">
          <span>
            Required: <strong>{reqCount}</strong> • Allocated: <strong>{allocCount}</strong> • Evaluated: <strong>{evalCount}</strong>
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-bold cursor-pointer transition-all shadow-2xs"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

export const InterviewModule: React.FC<InterviewModuleProps> = ({
  currentUserRole = "mentor",
  currentUserName = "User",
  defaultCollegeId
}) => {
  const { currentMentor, currentKAM, students, mentors, slots, colleges } = useApp();
  const { toast } = useToast();

  const [dbColleges, setDbColleges] = useState<any[]>([]);

  useEffect(() => {
    if (colleges && colleges.length > 0) {
      setDbColleges(colleges);
    } else {
      fetch("/api/colleges")
        .then(res => res.json())
        .then(data => {
          if (data.success && data.colleges) {
            setDbColleges(data.colleges);
          }
        })
        .catch(err => console.error("Error fetching colleges in InterviewModule:", err));
    }
  }, [colleges]);

  const activeCollegesList = useMemo(() => {
    return (dbColleges && dbColleges.length > 0) ? dbColleges : (colleges || []);
  }, [dbColleges, colleges]);

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

  // Helper for Local Date String (YYYY-MM-DD) avoiding UTC shifts
  const getTodayLocalStr = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };

  // Calendar State
  const [calendarMonth, setCalendarMonth] = useState(() => new Date());
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string | null>(null);
  const [calendarViewFilter, setCalendarViewFilter] = useState<"all" | "today">("all");

  // Raise Request Form
  const [selectedSubject, setSelectedSubject] = useState("");
  const [selectedClassGroup, setSelectedClassGroup] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [preferredStartTime, setPreferredStartTime] = useState("09:00 AM");
  const [raiseStudentCount, setRaiseStudentCount] = useState<number>(10);
  const [topics, setTopics] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Priority Split Modal & Preview State
  const [activeSplitInterview, setActiveSplitInterview] = useState<any | null>(null);
  const [splitPreviewResult, setSplitPreviewResult] = useState<any | null>(null);
  const [isLoadingSplit, setIsLoadingSplit] = useState(false);

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

  // CM Allocation & Mentor Free Period Time Mapping
  const [expandedAllocation, setExpandedAllocation] = useState<string | null>(null);
  const [mappedMentorIds, setMappedMentorIds] = useState<string[]>([]);
  const [mentorSlotMap, setMentorSlotMap] = useState<Record<string, string>>({});
  const [mentorCountMap, setMentorCountMap] = useState<Record<string, number>>({});
  const [showAllCampusMentors, setShowAllCampusMentors] = useState(false);
  const [camStudentCount, setCamStudentCount] = useState(10);
  const [camTimeSlot, setCamTimeSlot] = useState("8.20 AM - 9.10 AM");
  const [cmGmeetLink, setCmGmeetLink] = useState("");
  const [isAssigning, setIsAssigning] = useState(false);
  const [isMarkingComplete, setIsMarkingComplete] = useState<string | null>(null);
  const [viewingStudentRosterModal, setViewingStudentRosterModal] = useState<any | null>(null);
  const [expandedMentorTimetable, setExpandedMentorTimetable] = useState<string | null>(null);

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
    const rawStr = currentMentor.classes.trim();
    let classList: string[] = [];
    if (rawStr.startsWith("[") && rawStr.endsWith("]")) {
      try {
        const parsed = JSON.parse(rawStr);
        if (Array.isArray(parsed)) {
          classList = parsed.map(c => String(c).trim()).filter(Boolean);
        }
      } catch (_) {}
    }
    if (classList.length === 0) {
      classList = rawStr.split(/,|\n/).map(c => c.replace(/^[\["'\s]+|[\]"'\s]+$/g, "").trim()).filter(Boolean);
    }
    return Array.from(new Set(classList));
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
      if (currentKAM?.id) params.set("kamId", currentKAM.id);

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

  useEffect(() => { fetchInterviews(); }, [currentMentor?.id, defaultCollegeId, currentKAM?.id, currentUserRole]);

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

  // ── Calendar Grid Calculations ──────────────────────────────────────────────

  const calendarDays = useMemo(() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay(); // 0 = Sun
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const days: Array<{ dateStr: string; dayNum: number; isCurrentMonth: boolean }> = [];

    // Offset for previous month days
    const prevMonthDays = new Date(year, month, 0).getDate();
    const prevMonth = month === 0 ? 11 : month - 1;
    const prevYear = month === 0 ? year - 1 : year;

    for (let i = firstDay - 1; i >= 0; i--) {
      const dayNum = prevMonthDays - i;
      const dateStr = `${prevYear}-${String(prevMonth + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
      days.push({
        dateStr,
        dayNum,
        isCurrentMonth: false,
      });
    }

    // Current month days
    for (let i = 1; i <= daysInMonth; i++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(i).padStart(2, "0")}`;
      days.push({
        dateStr,
        dayNum: i,
        isCurrentMonth: true,
      });
    }

    // Trailing days for next month to complete grid weeks
    const remaining = (7 - (days.length % 7)) % 7;
    const nextMonth = month === 11 ? 0 : month + 1;
    const nextYear = month === 11 ? year + 1 : year;
    for (let i = 1; i <= remaining; i++) {
      const dateStr = `${nextYear}-${String(nextMonth + 1).padStart(2, "0")}-${String(i).padStart(2, "0")}`;
      days.push({
        dateStr,
        dayNum: i,
        isCurrentMonth: false,
      });
    }

    return days;
  }, [calendarMonth]);

  // Map of interviews by target_date for calendar badges
  const scheduledInterviewsByDate = useMemo(() => {
    const map: Record<string, any[]> = {};
    interviewsList.forEach(item => {
      if (item.target_date) {
        const dateKey = String(item.target_date).split("T")[0].trim();
        if (!map[dateKey]) map[dateKey] = [];
        map[dateKey].push(item);
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

    // Dynamic enrolled student count from classGroup
    const enrolledStudents = students.filter(s => 
      s.classGroup === selectedClassGroup || s.department === selectedClassGroup
    );
    const dynamicStudentCount = enrolledStudents.length > 0 ? enrolledStudents.length : 25;

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
          preferred_start_time: "To be mapped by CAM",
          student_count: dynamicStudentCount,
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
        toast("Interview request raised & marked on calendar! CAM will schedule time slot based on mentor free periods.", "success");
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

    const mentorSchedulePayload = mappedMentorIds.map(id => ({
      mentor_id: id,
      time_slot: mentorSlotMap[id] || camTimeSlot,
      student_count: mentorCountMap[id] || 3
    }));

    setIsAssigning(true);
    try {
      const res = await fetch("/api/interviews/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          interview_id: interviewId,
          mapped_mentor_ids: mappedMentorIds,
          student_count: camStudentCount,
          time_slot: camTimeSlot,
          mentor_schedule: mentorSchedulePayload,
          cm_name: currentUserName,
          gmeet_link: cmGmeetLink.trim(),
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast("Flexible mentor schedule saved & marked on calendar! Notification emails dispatched.", "success");
        setExpandedAllocation(null); setMappedMentorIds([]); setMentorSlotMap({}); setMentorCountMap({}); setCmGmeetLink("");
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

  const handlePreviewPrioritySplit = async (req: any) => {
    setActiveSplitInterview(req);
    setIsLoadingSplit(true);
    try {
      const res = await fetch("/api/interviews/priority-split", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          interview_id: req.id,
          origin_college_id: req.origin_college_id || req.college_id,
          target_date: req.target_date,
          preferred_start_time: req.preferred_start_time || "09:00 AM",
          student_count: req.student_count || 10,
          subject: req.subject,
          action: "preview"
        })
      });
      const data = await res.json();
      if (data.success) {
        setSplitPreviewResult(data.preview);
      } else {
        toast(data.message || "Failed to preview priority split", "error");
      }
    } catch {
      toast("Error calculating priority split", "error");
    } finally {
      setIsLoadingSplit(false);
    }
  };

  const handleSavePrioritySplit = async () => {
    if (!activeSplitInterview) return;
    setIsLoadingSplit(true);
    try {
      const res = await fetch("/api/interviews/priority-split", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          interview_id: activeSplitInterview.id,
          origin_college_id: activeSplitInterview.origin_college_id || activeSplitInterview.college_id,
          target_date: activeSplitInterview.target_date,
          preferred_start_time: activeSplitInterview.preferred_start_time || "09:00 AM",
          student_count: activeSplitInterview.student_count || 10,
          subject: activeSplitInterview.subject,
          action: "save"
        })
      });
      const data = await res.json();
      if (data.success) {
        toast(data.message, "success");
        setActiveSplitInterview(null);
        setSplitPreviewResult(null);
        fetchInterviews();
      } else {
        toast(data.message || "Failed to save split allocation", "error");
      }
    } catch {
      toast("Error saving priority split allocation", "error");
    } finally {
      setIsLoadingSplit(false);
    }
  };

  const [camAcceptCapacityCount, setCamAcceptCapacityCount] = useState<number>(6);

  const handleSendCapacityRequest = async (interviewId: string) => {
    try {
      const res = await fetch("/api/interviews/capacity-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ interview_id: interviewId, cm_name: currentUserName })
      });
      const data = await res.json();
      if (data.success) {
        toast(data.message, "success");
        fetchInterviews();
      } else {
        toast(data.message || "Failed to send capacity request", "error");
      }
    } catch {
      toast("Error sending capacity request", "error");
    }
  };

  const handleCamCapacityResponse = async (interviewId: string, action: "accept_capacity" | "decline", capacity: number = 0) => {
    try {
      const res = await fetch("/api/interviews/cam-capacity-response", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          interview_id: interviewId,
          college_id: defaultCollegeId || "",
          cam_name: currentUserName,
          action,
          accepted_student_capacity: capacity
        })
      });
      const data = await res.json();
      if (data.success) {
        toast(data.message, "success");
        fetchInterviews();
      } else {
        toast(data.message || "Failed to submit capacity decision", "error");
      }
    } catch {
      toast("Error submitting capacity decision", "error");
    }
  };

  const handleFinalConfirm = async (interviewId: string, action: "cm_confirm" | "cam_confirm" | "cam_reject") => {
    try {
      const res = await fetch("/api/interviews/final-confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          interview_id: interviewId,
          actor_role: currentUserRole,
          actor_name: currentUserName,
          action,
          college_id: defaultCollegeId || ""
        })
      });
      const data = await res.json();
      if (data.success) {
        toast(data.message, "success");
        fetchInterviews();
      } else {
        toast(data.message || "Failed to submit final confirmation", "error");
      }
    } catch {
      toast("Error submitting final confirmation", "error");
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

  const handleDeleteInterview = async (interviewId: string) => {
    if (!window.confirm("Are you sure you want to delete this interview record?")) return;
    try {
      const res = await fetch(`/api/interviews?id=${encodeURIComponent(interviewId)}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        toast("Interview record deleted successfully.", "success");
        fetchInterviews();
      } else {
        toast(data.message || "Failed to delete interview.", "error");
      }
    } catch {
      toast("Error deleting interview record.", "error");
    }
  };

  // ── Excel Export for KAM, CM, and Mentor ────────────────────────────────────
  const handleExportInterviews = async () => {
    try {
      const XLSX = await import("xlsx");
      
      // 1. Interviews Sessions Sheet
      const sessionsRows = (interviewsList || []).map((iv, idx) => {
        const originCol = activeCollegesList.find(c => c.id === iv.origin_college_id || c.id === iv.college_id);
        const targetCol = activeCollegesList.find(c => c.id === iv.target_college_id);
        return {
          "S.No": idx + 1,
          "Interview ID": iv.id,
          "Campus": originCol?.name || iv.origin_college_id || iv.college_id || "—",
          "Target Campus": targetCol?.name || iv.target_college_id || "—",
          "Class Group / Cohort": iv.class_group || "—",
          "Subject": iv.subject || "—",
          "Type": iv.type ? (iv.type.charAt(0).toUpperCase() + iv.type.slice(1)) : "Internal",
          "Target Date": iv.target_date || (iv.created_at ? String(iv.created_at).split("T")[0] : "—"),
          "Time Slot": iv.preferred_start_time || "09:00 AM",
          "Requested Students": iv.student_count || iv.requested_students || 0,
          "Allocated Students": iv.allocated_students || (iv.student_slots?.length || 0),
          "Status": iv.status || "Pending",
          "Lead Evaluator": iv.evaluator_name || iv.mentor_name || "—",
          "Evaluator Role": iv.evaluator_role || "SME Evaluator",
          "GMeet / Video Link": iv.gmeet_link || "—",
          "Coverage Topics": iv.topics || "—",
          "Created Date": iv.created_at ? String(iv.created_at).split("T")[0] : "—"
        };
      });

      // 2. Candidate Evaluations Sheet
      const evalRows = (evaluationsList || []).map((ev, idx) => {
        const iv = (interviewsList || []).find(i => i.id === ev.interview_id);
        return {
          "S.No": idx + 1,
          "Student ID": ev.student_id || "—",
          "Student Name": ev.student_name || "—",
          "Register / Roll No": ev.register_number || ev.roll_number || "—",
          "Class Group": ev.class_group || iv?.class_group || "—",
          "Subject": iv?.subject || ev.subject || "—",
          "Interview Date": iv?.target_date || (ev.created_at ? String(ev.created_at).split("T")[0] : "—"),
          "Attendance": ev.attendance ? (ev.attendance.charAt(0).toUpperCase() + ev.attendance.slice(1)) : "Present",
          "Communication Score (1-10)": ev.communication_score ?? "—",
          "Content Score (1-10)": ev.content_score ?? "—",
          "Technical Score (1-10)": ev.technical_score ?? "—",
          "Confidence Score (1-10)": ev.confidence_score ?? "—",
          "Overall Score / Marks": ev.marks ?? ev.score ?? "—",
          "Result Status": ev.status || (Number(ev.marks) >= 6 ? "Cleared" : "Needs Improvement"),
          "Evaluator Name": ev.mentor_name || ev.evaluator_name || iv?.mentor_name || "—",
          "Evaluation Feedback": ev.feedback || ev.notes || "—"
        };
      });

      const workbook = XLSX.utils.book_new();

      const wsSessions = XLSX.utils.json_to_sheet(sessionsRows.length > 0 ? sessionsRows : [{ "Status": "No interview sessions recorded" }]);
      wsSessions["!cols"] = [
        { wch: 6 }, { wch: 22 }, { wch: 25 }, { wch: 25 }, { wch: 22 },
        { wch: 22 }, { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 18 },
        { wch: 18 }, { wch: 22 }, { wch: 20 }, { wch: 18 }, { wch: 30 },
        { wch: 30 }, { wch: 14 }
      ];
      XLSX.utils.book_append_sheet(workbook, wsSessions, "Interview Sessions");

      if (evalRows.length > 0) {
        const wsEvals = XLSX.utils.json_to_sheet(evalRows);
        wsEvals["!cols"] = [
          { wch: 6 }, { wch: 16 }, { wch: 25 }, { wch: 20 }, { wch: 22 },
          { wch: 22 }, { wch: 14 }, { wch: 14 }, { wch: 25 }, { wch: 20 },
          { wch: 20 }, { wch: 22 }, { wch: 20 }, { wch: 18 }, { wch: 22 },
          { wch: 35 }
        ];
        XLSX.utils.book_append_sheet(workbook, wsEvals, "Student Evaluations");
      }

      const rolePrefix = isKAM ? "KAM_Region" : isCM ? "CAM_Campus" : "Mentor";
      const fileName = `${rolePrefix}_Interview_Audit_${new Date().toISOString().slice(0, 10)}.xlsx`;
      XLSX.writeFile(workbook, fileName);
      toast(`Exported interview report: ${fileName}`, "success");
    } catch (err: any) {
      console.error("Export error:", err);
      toast("Failed to export interview report: " + err.message, "error");
    }
  };

  // ── Derived Data ─────────────────────────────────────────────────────────────

  const pendingRequests = useMemo(() => {
    const currentCollegeId = defaultCollegeId || currentMentor?.college_id;
    return interviewsList
      .filter(i => {
        const s = (i.status || "").toLowerCase();
        if (s === "completed" || s === "rejected" || s === "no_capacity") {
          return false;
        }

        const isHost = i.college_id === currentCollegeId || i.origin_college_id === currentCollegeId;
        const myResponse = (i.cam_responses || []).find((r: any) => r.college_id === currentCollegeId);

        const totalReq = Number(i.student_count || i.requested_students || 10);
        const totalAlloc = Number(i.allocated_students || (i.student_slots?.length || 0));
        const totalAccepted = Number(i.accepted_capacity || 0);
        const remainingUnallocated = Math.max(0, totalReq - Math.max(totalAlloc, totalAccepted));

        // If all students are fully allocated (e.g. 47/47) AND status is assigned -> Fully done
        if (s === "assigned" && remainingUnallocated <= 0) {
          return false;
        }

        if (i.type === "internal") {
          // Internal requests are strictly inside this campus
          if (!isHost) return false;
          return (
            remainingUnallocated > 0 ||
            s.includes("pending") ||
            s === "capacity_partially_accepted" ||
            s === "priority_allocation" ||
            s === "draft"
          );
        } else {
          // External requests
          if (isHost) {
            return (
              remainingUnallocated > 0 ||
              s.includes("pending") ||
              s === "capacity_partially_accepted" ||
              s === "priority_allocation" ||
              s === "draft"
            );
          } else {
            // Partner CAM under same KAM:
            return remainingUnallocated > 0 && s !== "draft" && s !== "pending_origin_cm";
          }
        }
      })
      .sort((a, b) => {
        // Priority sort: external/urgent first
        const aIsExternal = a.type === "external";
        const bIsExternal = b.type === "external";
        if (aIsExternal && !bIsExternal) return -1;
        if (!aIsExternal && bIsExternal) return 1;
        return new Date(a.target_date || a.created_at || "").getTime() - new Date(b.target_date || b.created_at || "").getTime();
      });
  }, [interviewsList, defaultCollegeId, currentMentor]);

  const sessionStudents = (req: any) => {
    if (!req) return [];

    // 1. If student_slots exist in the interview object:
    if (req.student_slots && req.student_slots.length > 0) {
      // If a mentor is logged in as an evaluator:
      if (isMentor && currentMentor?.id) {
        const mySlots = req.student_slots.filter((s: any) => s.mentor_id === currentMentor.id);
        
        // If this mentor is an allocated evaluator with specific slots, return strictly their assigned slots!
        if (mySlots.length > 0) {
          return mySlots.map((slot: any, idx: number) => {
            const enrolled = students.find(st => 
              st.id === slot.student_id || 
              st.id === slot.studentId || 
              (st.register_number && (st.register_number === slot.student_id || st.register_number === slot.studentId || st.register_number === slot.roll_number)) ||
              (st.roll_number && (st.roll_number === slot.student_id || st.roll_number === slot.studentId || st.roll_number === slot.roll_number)) ||
              ((st as any).roll_no && ((st as any).roll_no === slot.student_id || (st as any).roll_no === slot.studentId || (st as any).roll_no === slot.roll_number)) ||
              (st.email && (st.email === slot.student_id || st.email === slot.studentId)) ||
              (st.name && slot.student_name && st.name.toLowerCase().trim() === slot.student_name.toLowerCase().trim())
            ) || (students.length > 0 ? students[idx % students.length] : null);

            const cName = slot.student_name || slot.studentName || slot.name || enrolled?.name || (slot.student_id ? `Candidate ${slot.student_id}` : `Candidate #${idx + 1}`);
            const regNo = enrolled?.register_number || enrolled?.roll_number || (enrolled as any)?.roll_no || slot.register_number || slot.roll_number || slot.student_id || enrolled?.id || `REG-${1000 + idx}`;

            return {
              id: slot.student_id || slot.studentId || enrolled?.id || `slot_std_${idx + 1}`,
              name: cName,
              register_number: regNo,
              roll_number: regNo,
              classGroup: enrolled?.classGroup || req.class_group || "BCA - Semester 5",
              department: enrolled?.department || req.class_group || "BCA",
              slotTime: slot.slot_start_time ? `${slot.slot_start_time} - ${slot.slot_end_time}` : undefined,
              gmeetLink: slot.gmeet_link || req.gmeet_link,
              mentorId: slot.mentor_id,
              mentorName: slot.mentor_name
            };
          });
        }
      }

      // If Raiser or CAM/Admin: return all allocated student slots
      return req.student_slots.map((slot: any, idx: number) => {
        const enrolled = students.find(st => 
          st.id === slot.student_id || 
          st.id === slot.studentId || 
          (st.register_number && (st.register_number === slot.student_id || st.register_number === slot.studentId || st.register_number === slot.roll_number)) ||
          (st.roll_number && (st.roll_number === slot.student_id || st.roll_number === slot.studentId || st.roll_number === slot.roll_number)) ||
          ((st as any).roll_no && ((st as any).roll_no === slot.student_id || (st as any).roll_no === slot.studentId || (st as any).roll_no === slot.roll_number)) ||
          (st.email && (st.email === slot.student_id || st.email === slot.studentId)) ||
          (st.name && slot.student_name && st.name.toLowerCase().trim() === slot.student_name.toLowerCase().trim())
        ) || (students.length > 0 ? students[idx % students.length] : null);

        const cName = slot.student_name || slot.studentName || slot.name || enrolled?.name || (slot.student_id ? `Candidate ${slot.student_id}` : `Candidate #${idx + 1}`);
        const regNo = enrolled?.register_number || enrolled?.roll_number || (enrolled as any)?.roll_no || slot.register_number || slot.roll_number || slot.student_id || enrolled?.id || `REG-${1000 + idx}`;

        return {
          id: slot.student_id || slot.studentId || enrolled?.id || `slot_std_${idx + 1}`,
          name: cName,
          register_number: regNo,
          roll_number: regNo,
          classGroup: enrolled?.classGroup || req.class_group || "BCA - Semester 5",
          department: enrolled?.department || req.class_group || "BCA",
          slotTime: slot.slot_start_time ? `${slot.slot_start_time} - ${slot.slot_end_time}` : undefined,
          gmeetLink: slot.gmeet_link || req.gmeet_link,
          mentorId: slot.mentor_id,
          mentorName: slot.mentor_name
        };
      });
    }

    // 2. Fallback when student_slots table has not been populated yet:
    let assignedCount = Math.max(1, Number(req?.allocated_students || req?.student_count || 46));

    // If mentor is an assigned evaluator, check mentor's batch slice (e.g. 3 candidates)
    if (isMentor && currentMentor?.id) {
      const assignedIds: string[] = req.assigned_mentor_ids ? JSON.parse(req.assigned_mentor_ids) : [];
      if (assignedIds.includes(currentMentor.id) && req.mentor_id !== currentMentor.id) {
        const myIndex = assignedIds.indexOf(currentMentor.id);
        const batchSize = 3;
        const startIdx = myIndex * batchSize;
        const cohortList = req.class_group
          ? students.filter(s => {
              if (s.college_id && currentMentor?.college_id && s.college_id !== currentMentor.college_id) return false;
              const sCG = (s.classGroup || "").toLowerCase().trim();
              const sDept = (s.department || "").toLowerCase().trim();
              const reqCG = (req.class_group || "").toLowerCase().trim();
              return sCG === reqCG || sDept === reqCG || sCG.includes(reqCG) || reqCG.includes(sCG);
            })
          : students;
        const pool = cohortList.length > 0 ? cohortList : students;
        return pool.slice(startIdx, startIdx + batchSize).map((s: any) => ({
          ...s,
          register_number: s.register_number || s.roll_number || s.id,
          roll_number: s.register_number || s.roll_number || s.id
        }));
      }
    }

    const filtered = students.filter(s => {
      if (s.college_id && currentMentor?.college_id && s.college_id !== currentMentor.college_id) return false;
      const sCG = (s.classGroup || "").toLowerCase().trim();
      const sDept = (s.department || "").toLowerCase().trim();
      const reqCG = (req.class_group || "").toLowerCase().trim();
      return sCG === reqCG || sDept === reqCG || sCG.includes(reqCG) || reqCG.includes(sCG);
    });
    const listToSlice = filtered.length > 0 ? filtered : students;
    return listToSlice.slice(0, assignedCount).map((s: any) => ({
      ...s,
      register_number: s.register_number || s.roll_number || s.id,
      roll_number: s.register_number || s.roll_number || s.id
    }));
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
      list = list.filter((s: any) => (s.name || "").toLowerCase().includes(q) || (s.roll_number || s.register_number || "").toLowerCase().includes(q));
    }

    // Status filter
    if (studentStatusFilter === "pending") {
      list = list.filter((s: any) => !getEvalForStudent(activeReq.id, s.id));
    } else if (studentStatusFilter === "evaluated") {
      list = list.filter((s: any) => Boolean(getEvalForStudent(activeReq.id, s.id)));
    } else if (studentStatusFilter === "cleared") {
      list = list.filter((s: any) => {
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

            <button
              type="button"
              onClick={handleExportInterviews}
              disabled={interviewsList.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-extrabold transition-all cursor-pointer shadow-2xs disabled:opacity-40 disabled:cursor-not-allowed"
              title="Export Interview Sessions & Evaluations to Excel"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span>Export (.xlsx)</span>
            </button>

            <button onClick={fetchInterviews} className="p-1.5 rounded-lg text-slate-400 hover:text-[#D528A2] hover:bg-white transition-all border border-transparent hover:border-slate-200 cursor-pointer" title="Refresh">
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
                </div>

                {/* Class Group */}
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Class / Cohort</label>
                  <select
                    value={selectedClassGroup}
                    onChange={e => setSelectedClassGroup(e.target.value)}
                    className="w-full p-2.5 border border-slate-200 rounded-xl bg-white text-xs font-semibold focus:ring-1 focus:ring-indigo-500 outline-none cursor-pointer"
                  >
                    {mentorClasses.map(c => {
                      const formatted = c === "III BCA" ? "BCA - Semester 5" : (c.includes("Sem") || c.includes("Year") ? c : `${c} - Semester 5`);
                      return <option key={c} value={c}>{formatted}</option>;
                    })}
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

              {/* Informative Roster & Scheduling Banner */}
              <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-700">
                <div className="flex items-center gap-2 font-bold">
                  <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600">
                    <Users className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-slate-500 text-[10px] uppercase font-bold block">Enrolled Roster</span>
                    <span className="text-slate-900 font-black">
                      {(() => {
                        const count = students.filter(s => {
                          if (s.college_id && currentMentor?.college_id && s.college_id !== currentMentor.college_id) return false;
                          const cleanSel = (selectedClassGroup || "").trim().toLowerCase();
                          const sCG = (s.classGroup || "").trim().toLowerCase();
                          const sDept = (s.department || "").trim().toLowerCase();
                          return sCG === cleanSel || sDept === cleanSel || sCG.includes(cleanSel) || cleanSel.includes(sCG);
                        }).length;
                        return `${count} Students in Cohort`;
                      })()}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500 bg-white px-3 py-1.5 rounded-lg border border-slate-200/80">
                  <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <span>Time slots will be scheduled by Campus Manager based on mentor free period schedules</span>
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
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-3">
                <h2 className="text-sm font-black text-slate-800 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-[#D528A2]" />
                  {calendarViewFilter === "today" 
                    ? `Today's Schedule & Marking — ${getTodayLocalStr()}`
                    : `Interview Schedule Calendar & Marking — ${calendarMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" })}`}
                </h2>
              </div>

              <div className="flex items-center gap-2">
                {/* View Filter Pill Switch */}
                <div className="inline-flex p-0.5 rounded-lg bg-slate-100 border border-slate-200 text-xs font-bold">
                  <button
                    onClick={() => setCalendarViewFilter("all")}
                    className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                      calendarViewFilter === "all" ? "bg-white text-[#D528A2] shadow-2xs font-extrabold" : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    Full Month Grid
                  </button>
                  <button
                    onClick={() => {
                      setCalendarViewFilter("today");
                      setSelectedCalendarDate(getTodayLocalStr());
                    }}
                    className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                      calendarViewFilter === "today" ? "bg-[#D528A2] text-white shadow-2xs font-extrabold" : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    Today Only ({scheduledInterviewsByDate[getTodayLocalStr()]?.length || 0})
                  </button>
                </div>

                {calendarViewFilter === "all" && (
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
                      onClick={() => {
                        const today = new Date();
                        setCalendarMonth(today);
                        setSelectedCalendarDate(getTodayLocalStr());
                      }}
                      className="px-3 py-1 rounded-lg bg-[#D528A2] text-white hover:bg-[#c02090] text-xs font-extrabold transition-all cursor-pointer shadow-2xs"
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
                )}
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
                const nowD = new Date();
                const todayStr = `${nowD.getFullYear()}-${String(nowD.getMonth() + 1).padStart(2, "0")}-${String(nowD.getDate()).padStart(2, "0")}`;
                const isToday = day.dateStr === todayStr;

                return (
                  <div
                    key={idx}
                    onClick={() => setSelectedCalendarDate(day.dateStr)}
                    className={`min-h-[105px] p-2 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? "border-[#D528A2] bg-pink-50/40 ring-2 ring-[#D528A2]/40 shadow-xs"
                        : day.isCurrentMonth
                        ? "bg-white border-slate-200/90 hover:border-indigo-300 hover:shadow-xs"
                        : "bg-slate-50/50 border-slate-100 text-slate-300"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-extrabold ${
                        isToday
                          ? "bg-[#D528A2] text-white px-2 py-0.5 rounded-full text-[10px] shadow-xs"
                          : day.isCurrentMonth ? "text-slate-700" : "text-slate-300"
                      }`}>
                        {day.dayNum}
                      </span>
                      {dayInterviews.length > 0 && (
                        <span className="text-[9px] font-black bg-[#D528A2]/10 text-[#D528A2] px-1.5 py-0.5 rounded-full border border-[#D528A2]/20">
                          {dayInterviews.length}
                        </span>
                      )}
                    </div>

                    {/* Interview Badges inside Calendar Day Cell */}
                    <div className="space-y-1 mt-1.5">
                      {dayInterviews.slice(0, 2).map((inv: any) => (
                        <div
                          key={inv.id}
                          className={`text-[9px] font-bold p-1 rounded-md truncate flex items-center justify-between gap-1 shadow-2xs ${
                            inv.status === "completed"
                              ? "bg-emerald-100/90 text-emerald-900 border border-emerald-300/80"
                              : inv.status === "declined" || inv.status === "cancelled"
                              ? "bg-rose-100/90 text-rose-900 border border-rose-300/80"
                              : inv.type === "external"
                              ? "bg-purple-100/90 text-purple-900 border border-purple-300/80"
                              : "bg-blue-100/90 text-blue-900 border border-blue-300/80"
                          }`}
                        >
                          <span className="truncate">{inv.subject}</span>
                          {inv.type === "external" && (
                            <span className="text-[8px] font-black text-purple-700 bg-purple-200/80 px-1 rounded">EXT</span>
                          )}
                        </div>
                      ))}
                      {dayInterviews.length > 2 && (
                        <div className="text-[8px] font-bold text-slate-400 pl-1">+{dayInterviews.length - 2} more</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── MODAL POPUP DIALOG FOR SELECTED CALENDAR DATE ── */}
          {selectedCalendarDate && (
            <div 
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 transition-all duration-200"
              onClick={() => setSelectedCalendarDate(null)}
            >
              <div 
                className="bg-white border border-slate-200 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4 max-h-[85vh] flex flex-col justify-between"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Modal Header */}
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-pink-50 text-[#D528A2] border border-pink-200/60">
                      <Calendar className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
                        Scheduled Interviews & Session Details
                      </h3>
                      <p className="text-xs text-slate-500 font-medium">
                        Target Date: <span className="text-[#D528A2] font-bold">{selectedCalendarDate}</span>
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedCalendarDate(null)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Modal Scrollable Body */}
                <div className="overflow-y-auto pr-1 space-y-3 flex-1 max-h-[60vh]">
                  {(!scheduledInterviewsByDate[selectedCalendarDate] || scheduledInterviewsByDate[selectedCalendarDate].length === 0) ? (
                    <div className="p-8 text-center bg-slate-50 rounded-xl border border-slate-100 space-y-2">
                      <Calendar className="w-8 h-8 text-slate-300 mx-auto" />
                      <p className="text-xs text-slate-500 font-medium">No interview sessions scheduled for this date ({selectedCalendarDate}).</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-3">
                      {scheduledInterviewsByDate[selectedCalendarDate].map((inv: any) => (
                        <div key={inv.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 hover:border-indigo-200 transition-all space-y-2.5 shadow-2xs">
                          <div className="flex items-center justify-between gap-2">
                            <StatusBadge status={inv.status} />
                            <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full border ${
                              inv.type === "external" ? "bg-purple-50 text-purple-700 border-purple-200" : "bg-blue-50 text-blue-700 border-blue-200"
                            }`}>
                              {(inv.type || "internal").toUpperCase()}
                            </span>
                          </div>
                          <div className="font-extrabold text-slate-800 text-sm sm:text-base">{inv.subject}</div>
                          <div className="text-xs text-slate-600 grid grid-cols-1 sm:grid-cols-2 gap-1.5 bg-white p-3 rounded-lg border border-slate-200/80">
                            <div>Cohort: <strong className="text-slate-800">{inv.class_group || "All Classes"}</strong></div>
                            <div>Requested By: <strong className="text-slate-800">{inv.mentor_name}</strong></div>
                            <div>Target Count: <strong className="text-slate-800">{inv.student_count || 10} Students</strong></div>
                            <div>Topics: <strong className="text-slate-800">{inv.topics || "General Review"}</strong></div>
                          </div>
                          {inv.gmeet_link && (
                            <a 
                              href={inv.gmeet_link} 
                              target="_blank" 
                              rel="noreferrer" 
                              className="inline-flex items-center gap-1.5 text-xs text-white font-bold bg-emerald-600 hover:bg-emerald-700 px-3.5 py-1.5 rounded-lg transition-all shadow-xs cursor-pointer"
                            >
                              <Video className="w-3.5 h-3.5" /> Join Google Meet Link →
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Modal Footer */}
                <div className="border-t border-slate-100 pt-3 flex items-center justify-end">
                  <button
                    onClick={() => setSelectedCalendarDate(null)}
                    className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all cursor-pointer"
                  >
                    Close Popup
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── PRIORITY SPLIT & REGIONAL OVERFLOW CALCULATOR MODAL ── */}
          {activeSplitInterview && (
            <div 
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 transition-all animate-in fade-in"
              onClick={() => { setActiveSplitInterview(null); setSplitPreviewResult(null); }}
            >
              <div 
                className="bg-white border border-slate-200 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4 max-h-[85vh] flex flex-col justify-between"
                onClick={e => e.stopPropagation()}
              >
                {/* Modal Header */}
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-pink-50 text-[#D528A2] border border-pink-200/60">
                      <Sparkles className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
                        Regional Priority Split & Overflow Calculator
                      </h3>
                      <p className="text-xs text-slate-500 font-medium">
                        15 Min / Student Rule — <span className="text-[#D528A2] font-bold">{activeSplitInterview.subject}</span> ({activeSplitInterview.student_count || 10} Students)
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => { setActiveSplitInterview(null); setSplitPreviewResult(null); }}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Modal Body */}
                <div className="overflow-y-auto pr-1 space-y-3 flex-1 max-h-[60vh]">
                  {isLoadingSplit ? (
                    <div className="p-10 text-center text-xs font-semibold text-slate-500 flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-[#D528A2]" /> Calculating optimal regional mentor slots & free period availability...
                    </div>
                  ) : splitPreviewResult ? (
                    <div className="space-y-3">
                      {/* Calculation Summary Card */}
                      <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                        <div>
                          <div className="text-[10px] uppercase font-bold text-slate-400">Total Duration Calculation</div>
                          <div className="text-sm font-black text-slate-800">
                            {splitPreviewResult.formattedTotalDuration} <span className="text-xs text-slate-500 font-normal">({activeSplitInterview.student_count || 10} × 15 mins)</span>
                          </div>
                        </div>
                        {splitPreviewResult.overflowOccurred && (
                          <span className="text-[10px] font-black bg-amber-100 text-amber-800 px-2.5 py-1 rounded-full border border-amber-300 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" /> Overflow Slot Cascaded
                          </span>
                        )}
                      </div>

                      {/* Split Allocation Segment Cards */}
                      <div className="space-y-2">
                        <div className="text-xs font-black text-slate-700">Proposed Priority Split Segments:</div>
                        {splitPreviewResult.allocations.map((alloc: any, idx: number) => (
                          <div key={idx} className="p-3.5 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-extrabold text-slate-800">Segment #{idx + 1}: {alloc.mentor_name}</span>
                              <span className="text-[10px] font-black bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md border border-indigo-200">
                                {alloc.allocated_student_count} Students ({alloc.duration_minutes} Mins)
                              </span>
                            </div>
                            <div className="text-xs text-slate-500 flex flex-wrap items-center gap-x-4 gap-y-1">
                              <span>Campus: <strong className="text-slate-700">{alloc.target_college_name}</strong></span>
                              <span>Time Window: <strong className="text-[#D528A2]">{alloc.start_time} - {alloc.end_time}</strong></span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>

                {/* Modal Footer */}
                <div className="border-t border-slate-100 pt-3 flex items-center justify-end gap-2">
                  <button
                    onClick={() => { setActiveSplitInterview(null); setSplitPreviewResult(null); }}
                    className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSavePrioritySplit}
                    disabled={isLoadingSplit || !splitPreviewResult}
                    className="btn-gradient px-5 py-2 rounded-xl text-xs font-extrabold text-white flex items-center gap-1.5 disabled:opacity-50 cursor-pointer shadow-xs"
                  >
                    {isLoadingSplit ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                    Execute & Save Split Allocation
                  </button>
                </div>
              </div>
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
                const evaluatedCount = reqStudents.filter((st: any) => Boolean(getEvalForStudent(req.id, st.id))).length;
                const progressPct = reqStudents.length > 0 ? Math.round((evaluatedCount / reqStudents.length) * 100) : 0;

                const isRaiser = req.mentor_id === currentMentor?.id;
                const isExternal = req.type === "external";
                const hasAssignedSlotsAsEvaluator = Boolean(
                  (req.student_slots && req.student_slots.some((s: any) => s.mentor_id === currentMentor?.id)) ||
                  (req.assigned_mentor_ids && req.assigned_mentor_ids.includes(currentMentor?.id))
                );

                // Only assigned evaluators (or internal session instructors / CM) can grade
                const canEvaluate = hasAssignedSlotsAsEvaluator || (!isExternal && isRaiser) || isCM || isKAM;

                return (
                  <div key={req.id} className="bg-white border border-slate-200/80 rounded-xl shadow-xs overflow-hidden">
                    <div className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <StatusBadge status={req.status || "pending_cm"} />
                          <ConductedStatusBadge
                            status={req.status || "pending_cm"}
                            required={req.required_students || req.student_count}
                            allocated={req.allocated_students}
                            evaluated={req.evaluated_students || evaluatedCount}
                            verified={req.verified_students}
                          />
                          <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${
                            req.type === "external"
                              ? "bg-purple-50 text-purple-700 border-purple-200"
                              : "bg-blue-50 text-blue-700 border-blue-200"
                          }`}>
                            {(req.type || "internal").toUpperCase()}
                          </span>
                          {isRaiser && isExternal && (
                            <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-300">
                              Host Raiser • External Faculty Evaluating
                            </span>
                          )}
                          {hasAssignedSlotsAsEvaluator && (
                            <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                              Evaluator ({reqStudents.length} Candidates)
                            </span>
                          )}
                        </div>
                        <div className="font-black text-slate-800 text-sm">{req.subject}</div>
                        <div className="text-xs text-slate-500 flex flex-wrap gap-x-4 gap-y-0.5 font-medium">
                          <span className="flex items-center gap-1"><GraduationCap className="w-3 h-3 text-[#D528A2]" />{req.class_group || "All Classes"}</span>
                          <span className="flex items-center gap-1"><Calendar className="w-3 h-3 text-[#D528A2]" />{req.target_date || "Date TBD"}</span>
                          <span className="flex items-center gap-1"><Users className="w-3 h-3 text-[#D528A2]" />
                            {reqStudents.length > 0 ? `${evaluatedCount}/${reqStudents.length} Evaluated` : "Count Pending CM"}
                          </span>
                          {req.gmeet_link && (
                            <a href={req.gmeet_link} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-indigo-600 font-bold hover:underline">
                              <Video className="w-3 h-3" /> Meet Live
                            </a>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 flex-wrap">
                        <button
                          onClick={() => setViewingStudentRosterModal(req)}
                          className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-extrabold px-3 py-2 rounded-xl transition-all cursor-pointer border border-slate-200 shadow-2xs"
                        >
                          <Users className="w-3.5 h-3.5 text-indigo-600" />
                          {isRaiser && isExternal ? "View Roster & External Scores" : "Student Conducted Roster"}
                        </button>
                        {isAssigned && canEvaluate && (
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
                            {isExpanded ? "Close Evaluation" : (hasAssignedSlotsAsEvaluator ? `Evaluate My Candidates (${reqStudents.length})` : "Evaluate Students")}
                            {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                          </button>
                        )}
                        {(req.status?.includes("pending") || isKAM || isCM) && (
                          <button
                            onClick={() => handleDeleteInterview(req.id)}
                            title="Delete Request"
                            className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all border border-slate-200 hover:border-rose-200 cursor-pointer shadow-2xs"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Dedicated Capacity Metrics Bar */}
                    <CapacityMetricsBar
                      reqCount={req.required_students || req.student_count || 10}
                      accCap={req.accepted_capacity}
                      allocCount={req.allocated_students || (req.student_slots?.length || 0)}
                      evalCount={req.evaluated_students || evaluatedCount}
                      verCount={req.verified_students || (req.status === "completed" ? evaluatedCount : 0)}
                      remAlloc={req.remaining_to_allocate || Math.max(0, (req.student_count || 10) - (req.allocated_students || 0))}
                      remEval={req.remaining_to_evaluate || Math.max(0, (req.allocated_students || 0) - evaluatedCount)}
                      type={req.type}
                    />

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
                                activeStudentsList.map((st: any) => {
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
                                          <div className="text-[10px] text-indigo-600 font-bold font-mono">
                                            {st.register_number || st.roll_number || st.id}
                                            <span className="text-slate-400 font-medium font-sans ml-1.5">• {st.classGroup || "BCA - Semester 5"}</span>
                                          </div>
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
                                <div className="flex items-center justify-between border-b border-slate-100 pb-3 flex-wrap gap-2">
                                  <div>
                                    <h4 className="font-black text-slate-800 text-sm flex items-center gap-2 flex-wrap">
                                      Evaluating: {selectedStudent.name}
                                      <span className="text-xs px-2 py-0.5 rounded-lg bg-indigo-50 border border-indigo-150 text-indigo-700 font-mono font-bold">
                                        {selectedStudent.register_number || selectedStudent.roll_number || selectedStudent.id}
                                      </span>
                                    </h4>
                                    <p className="text-[11px] text-slate-500 font-medium mt-0.5">{req.subject} • {selectedStudent.classGroup || "BCA - Semester 5"}</p>
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

                                  {/* List of Dynamic Typed Questions */}
                                  <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                                    {evalQuestions.map((qItem, idx) => (
                                      <div key={qItem.id} className="p-3 rounded-xl border border-slate-200 bg-slate-50/80 space-y-2.5">
                                        <div className="flex items-center gap-2">
                                          <span className="w-6 h-6 rounded-lg bg-indigo-100 text-indigo-700 text-[10px] font-black flex items-center justify-center shrink-0">
                                            Q{idx + 1}
                                          </span>
                                          <input
                                            type="text"
                                            value={qItem.question}
                                            placeholder={`Type question #${idx + 1} asked to student...`}
                                            onChange={e => handleUpdateQuestion(qItem.id, "question", e.target.value)}
                                            className="font-bold text-xs text-slate-800 bg-white border border-slate-200 rounded-lg px-3 py-1.5 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none w-full"
                                          />
                                          {evalQuestions.length > 1 && (
                                            <button
                                              type="button"
                                              onClick={() => handleRemoveQuestion(qItem.id)}
                                              className="text-slate-400 hover:text-rose-500 transition-colors p-1 shrink-0"
                                              title="Remove Question"
                                            >
                                              <Trash2 className="w-4 h-4" />
                                            </button>
                                          )}
                                        </div>

                                        {/* Question Score Slider */}
                                        <div className="flex items-center gap-3 px-1">
                                          <span className="text-[10px] text-slate-400 font-bold uppercase shrink-0">Rating:</span>
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

                                  {/* Add Question Button */}
                                  <div className="pt-1">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const newQ: StructuredQuestion = {
                                          id: `q_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
                                          question: "",
                                          maxScore: 10,
                                          score: 7,
                                          notes: ""
                                        };
                                        setEvalQuestions(prev => [...prev, newQ]);
                                      }}
                                      className="w-full py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-black rounded-xl flex items-center justify-center gap-1.5 cursor-pointer border border-indigo-200/80 transition-all"
                                    >
                                      <Plus className="w-3.5 h-3.5" /> + Add Another Question Asked
                                    </button>
                                  </div>
                                </div>

                                {/* ── OVERALL CORE SKILLS SCORING SLIDERS ── */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                                  <ScoreSlider label="Communication Skill" value={commScore} onChange={setCommScore} color="#D528A2" />
                                  <ScoreSlider label="Content Knowledge" value={contentScore} onChange={setContentScore} color="#F4A863" />
                                  <ScoreSlider label="Technical Problem Solving" value={techScore} onChange={setTechScore} color="#6366f1" />
                                  <ScoreSlider label="Confidence & Presentation" value={confidenceScore} onChange={setConfidenceScore} color="#f59e0b" />
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
                      {req.type === "external" && (() => {
                        const currentCollegeId = defaultCollegeId || currentMentor?.college_id;
                        const isHostCampus = req.origin_college_id === currentCollegeId || req.college_id === currentCollegeId;
                        const totalReq = Number(req.student_count || req.requested_students || 10);
                        const totalAccepted = Number(req.accepted_capacity || 0);
                        const remainingNeeded = Math.max(0, totalReq - totalAccepted);
                        const myResponse = (req.cam_responses || []).find((r: any) => r.college_id === currentCollegeId);
                        const isPendingBroadcast = req.status === "pending_cam_acceptance" || req.status === "capacity_partially_accepted" || req.status === "priority_allocation";

                        return (
                          <>
                            {/* 1. Raiser's Home CM Approval Stage */}
                            {(req.status === "pending_origin_cm" || req.status === "draft") && isHostCampus && (
                              <button
                                onClick={() => handleSendCapacityRequest(req.id)}
                                className="btn-gradient flex items-center gap-1.5 text-white text-xs font-black px-4 py-2 rounded-xl transition-all cursor-pointer shadow-sm hover:scale-[1.02]"
                                title="Approve mentor's external interview request and broadcast to all Zone Partner Colleges"
                              >
                                <Send className="w-3.5 h-3.5" /> Approve &amp; Broadcast to Zone CAMs
                              </button>
                            )}

                            {/* 2. Zone CAM Capacity Acceptance & Multi-Campus Tally Stage */}
                            {isPendingBroadcast && (
                              <div className="flex items-center gap-2">
                                {isHostCampus ? (
                                  /* Host Campus: Displays overall broadcast tally & Priority Split trigger */
                                  <div className="flex items-center gap-2">
                                    <span className="text-[11px] font-bold text-purple-700 bg-purple-50 px-3 py-1.5 rounded-xl border border-purple-200">
                                      Zone Broadcast: <strong className="text-purple-900 font-black">{totalAccepted}</strong>/{totalReq} Accepted
                                      {remainingNeeded > 0 ? ` (${remainingNeeded} Needed)` : " (Fully Tallied)"}
                                    </span>
                                    {totalAccepted > 0 && (
                                      <button
                                        onClick={() => handlePreviewPrioritySplit(req)}
                                        className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold px-3 py-1.5 rounded-xl transition-all cursor-pointer shadow-2xs"
                                        title="Distribute accepted student capacity across partner campus evaluators"
                                      >
                                        <Sparkles className="w-3.5 h-3.5" /> Run Priority Split
                                      </button>
                                    )}
                                  </div>
                                ) : (
                                  /* Partner Campus: Can accept remaining capacity until fully tallied */
                                  myResponse && myResponse.status === "accepted" ? (
                                    <div className="flex items-center gap-1.5 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200 text-xs">
                                      <Check className="w-3.5 h-3.5 text-emerald-600 font-bold" />
                                      <span className="font-extrabold text-emerald-800">
                                        Your Campus Accepted: {myResponse.accepted_student_capacity} Students
                                      </span>
                                      {remainingNeeded > 0 && (
                                        <span className="text-[10px] text-amber-700 font-bold ml-1">
                                          ({remainingNeeded} still needed from zone)
                                        </span>
                                      )}
                                    </div>
                                  ) : remainingNeeded > 0 ? (
                                    <div className="flex items-center gap-1.5 bg-purple-50 p-1.5 rounded-xl border border-purple-200">
                                      <span className="text-[10px] font-black text-purple-900 px-1">
                                        Needed: <strong className="text-purple-700 font-black">{remainingNeeded}</strong>/{totalReq}
                                      </span>
                                      <input
                                        type="number"
                                        min={1}
                                        max={remainingNeeded}
                                        defaultValue={Math.min(10, remainingNeeded)}
                                        id={`cap_accept_inp_${req.id}`}
                                        className="w-14 p-1 border border-purple-300 rounded-lg text-xs font-black bg-white outline-none text-purple-900 text-center"
                                        title={`Enter capacity your campus can accept (up to ${remainingNeeded})`}
                                      />
                                      <button
                                        onClick={() => {
                                          const el = document.getElementById(`cap_accept_inp_${req.id}`) as HTMLInputElement;
                                          const val = el ? Number(el.value) : Math.min(10, remainingNeeded);
                                          handleCamCapacityResponse(req.id, "accept_capacity", Math.min(remainingNeeded, Math.max(1, val)));
                                        }}
                                        className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold px-3 py-1 rounded-lg transition-all cursor-pointer shadow-2xs"
                                      >
                                        <Check className="w-3.5 h-3.5" /> Accept
                                      </button>
                                      <button
                                        onClick={() => handleCamCapacityResponse(req.id, "decline", 0)}
                                        className="flex items-center gap-1 bg-rose-600 hover:bg-rose-700 text-white text-xs font-extrabold px-2 py-1 rounded-lg transition-all cursor-pointer"
                                      >
                                        <XCircle className="w-3.5 h-3.5" /> Decline
                                      </button>
                                    </div>
                                  ) : (
                                    <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200">
                                      ✓ Capacity Fulfilled by Zone ({totalAccepted}/{totalReq})
                                    </span>
                                  )
                                )}
                              </div>
                            )}

                            {/* 3. Final Confirmation Stage */}
                            {req.status === "pending_final_confirmation" && (
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => handleFinalConfirm(req.id, "cam_confirm")}
                                  className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold px-3 py-2 rounded-xl transition-all cursor-pointer"
                                >
                                  <CheckCircle className="w-3.5 h-3.5" /> Confirm &amp; Gen Meet
                                </button>
                                <button
                                  onClick={() => handleFinalConfirm(req.id, "cam_reject")}
                                  className="flex items-center gap-1 bg-rose-600 hover:bg-rose-700 text-white text-xs font-extrabold px-3 py-2 rounded-xl transition-all cursor-pointer"
                                >
                                  <XCircle className="w-3.5 h-3.5" /> Reject Allocation
                                </button>
                              </div>
                            )}
                          </>
                        );
                      })()}
                      <button
                        onClick={() => setViewingStudentRosterModal(req)}
                        className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-extrabold px-3 py-2 rounded-xl transition-all cursor-pointer border border-slate-200 shadow-2xs"
                      >
                        <Users className="w-3.5 h-3.5 text-indigo-600" />
                        Student Conducted Roster
                      </button>
                      <button
                        onClick={() => {
                          if (isOpen) {
                            setExpandedAllocation(null);
                          } else {
                            const currentCollegeId = defaultCollegeId || currentMentor?.college_id;
                            const isHost = req.college_id === currentCollegeId || req.origin_college_id === currentCollegeId;
                            const myResp = (req.cam_responses || []).find((r: any) => r.college_id === currentCollegeId);

                            let initialCount = 10;
                            if (!isHost && myResp && myResp.accepted_student_capacity > 0) {
                              // If partner CAM accepted a specific capacity (e.g. 10), use their accepted capacity!
                              initialCount = Number(myResp.accepted_student_capacity);
                            } else if (req.remaining_students && req.remaining_students > 0) {
                              initialCount = Number(req.remaining_students);
                            } else if (req.student_count && req.student_count > 0) {
                              initialCount = Number(req.student_count);
                            }

                            setExpandedAllocation(req.id);
                            setCamStudentCount(initialCount);
                            setMappedMentorIds(req.assigned_mentor_ids ? JSON.parse(req.assigned_mentor_ids) : []);
                            setCmGmeetLink(req.gmeet_link || "");
                          }
                        }}
                        className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-extrabold px-4 py-2 rounded-xl transition-all cursor-pointer shadow-2xs"
                      >
                        <Users className="w-3.5 h-3.5" />
                        {isOpen ? "Close" : "Details & Schedule"}
                        {isOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      </button>
                      <button
                        onClick={() => handleDeleteInterview(req.id)}
                        title="Delete Request"
                        className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all border border-slate-200 hover:border-rose-200 cursor-pointer shadow-2xs"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Dedicated Capacity Metrics Bar */}
                  <CapacityMetricsBar
                    reqCount={req.required_students || req.student_count || 10}
                    accCap={req.accepted_capacity}
                    allocCount={req.allocated_students || (req.student_slots?.length || 0)}
                    evalCount={req.evaluated_students || 0}
                    verCount={req.verified_students || (req.status === "completed" ? (req.evaluated_students || 0) : 0)}
                    remAlloc={req.remaining_to_allocate || Math.max(0, (req.student_count || 10) - (req.allocated_students || 0))}
                    remEval={req.remaining_to_evaluate || Math.max(0, (req.allocated_students || 0) - (req.evaluated_students || 0))}
                    type={req.type}
                  />

                  {/* Allocation Panel or Home CM Tracking Panel */}
                  {isOpen && (
                    <div className="border-t border-slate-200 bg-slate-50/50 p-5 space-y-4">
                      {/* 1. If Raiser's Home CM on External Request: Show Zone Tracking & Broadcast Console */}
                      {isCM && req.type === "external" && (req.origin_college_id === defaultCollegeId || req.college_id === defaultCollegeId) ? (
                        <div className="space-y-4">
                          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/80 pb-3">
                            <div>
                              <h3 className="text-xs font-black text-slate-800 flex items-center gap-2">
                                <Globe className="w-4 h-4 text-purple-600" />
                                Zone Broadcast & External Partner Colleges Tracking — {req.subject}
                              </h3>
                              <p className="text-[10px] text-slate-500 font-semibold mt-0.5">
                                External interviews are evaluated by faculty mentors from other partner colleges across the zone.
                              </p>
                            </div>
                            <span className="text-[10px] font-extrabold text-purple-700 bg-purple-50 border border-purple-200 px-2.5 py-1 rounded-lg">
                              Host Campus (Your College) • Target: {req.target_date}
                            </span>
                          </div>

                          {/* Home CM Pre-Approval Banner */}
                          {req.status === "pending_origin_cm" && (
                            <div className="p-4 bg-purple-50/80 border border-purple-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
                              <div className="space-y-1">
                                <div className="text-xs font-black text-purple-900 flex items-center gap-1.5">
                                  <AlertCircle className="w-4 h-4 text-purple-600 shrink-0" />
                                  Action Required: Approve External Broadcast
                                </div>
                                <p className="text-[11px] text-purple-700">
                                  Faculty mentor <strong>{req.mentor_name}</strong> requested external evaluation for {req.student_count || 10} students. Approve to broadcast this request to all Zone Partner Colleges{(() => {
                                    const partnerNames = activeCollegesList
                                      .filter(c => c.id !== (req.origin_college_id || defaultCollegeId))
                                      .map(c => c.name)
                                      .join(", ");
                                    return partnerNames ? ` (${partnerNames})` : "";
                                  })()}.
                                </p>
                              </div>
                              <button
                                onClick={() => handleSendCapacityRequest(req.id)}
                                className="btn-gradient flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-extrabold text-white shrink-0 cursor-pointer shadow-sm hover:scale-[1.02]"
                              >
                                <Send className="w-3.5 h-3.5" /> Approve & Broadcast Now
                              </button>
                            </div>
                          )}

                          {/* Zone Campuses Acceptance Matrix */}
                          <div className="space-y-2">
                            <label className="text-[10px] text-slate-700 uppercase font-black tracking-wider block">
                              Zone Partner Colleges Capacity & Assigned Mentors
                            </label>
                            
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                              {(() => {
                                const originId = req.origin_college_id || req.college_id || defaultCollegeId;
                                const partnerCols = activeCollegesList.filter(c => c.id !== originId);
                                
                                (req.cam_responses || []).forEach((resp: any) => {
                                  if (resp.college_id && resp.college_id !== originId && !partnerCols.some(c => c.id === resp.college_id)) {
                                    partnerCols.push({ id: resp.college_id, name: resp.college_name || resp.college_id });
                                  }
                                });

                                if (partnerCols.length === 0) {
                                  return (
                                    <div className="col-span-full p-4 bg-white border border-dashed border-slate-200 rounded-xl text-center text-xs text-slate-500 font-medium">
                                      No other partner colleges found in database.
                                    </div>
                                  );
                                }

                                return partnerCols.map(col => {
                                  const camResp = (req.cam_responses || []).find((r: any) => r.college_id === col.id);
                                  const isAccepted = camResp?.status === "accepted" || (camResp?.accepted_student_capacity || 0) > 0;
                                  const isDeclined = camResp?.status === "declined";

                                  return (
                                    <div
                                      key={col.id}
                                      className={`p-3.5 rounded-xl border transition-all ${
                                        isAccepted
                                          ? "bg-emerald-50/80 border-emerald-300 shadow-2xs"
                                          : isDeclined
                                          ? "bg-rose-50/60 border-rose-200 opacity-70"
                                          : "bg-white border-slate-200"
                                      }`}
                                    >
                                      <div className="flex items-center justify-between gap-1">
                                        <div className="font-extrabold text-xs text-slate-800 truncate" title={col.name}>{col.name}</div>
                                        {isAccepted ? (
                                          <span className="text-[9px] font-black uppercase text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-md border border-emerald-200 flex items-center gap-1">
                                            <Check className="w-3 h-3" /> {camResp?.accepted_student_capacity || 0} Students
                                          </span>
                                        ) : isDeclined ? (
                                          <span className="text-[9px] font-black uppercase text-rose-700 bg-rose-100/80 px-2 py-0.5 rounded-md border border-rose-200">
                                            Declined
                                          </span>
                                        ) : (
                                          <span className="text-[9px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md">
                                            Awaiting Response
                                          </span>
                                        )}
                                      </div>
                                      <p className="text-[10px] text-slate-500 mt-1">
                                        {isAccepted 
                                          ? `Faculty mapped by ${camResp?.cam_name || "CAM"}` 
                                          : "Zone Partner Campus"}
                                      </p>
                                    </div>
                                  );
                                });
                              })()}
                            </div>
                          </div>

                          {/* Assigned External Faculty List */}
                          {req.assigned_mentor_ids && JSON.parse(req.assigned_mentor_ids).length > 0 && (
                            <div className="p-3.5 bg-indigo-50/60 border border-indigo-200 rounded-xl space-y-1.5">
                              <div className="text-[10px] font-black text-indigo-900 uppercase">
                                External Faculty Assigned to Conduct Evaluations
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {JSON.parse(req.assigned_mentor_ids).map((id: string) => {
                                  const m = mentors.find(x => x.id === id);
                                  const col = activeCollegesList.find(c => c.id === m?.college_id);
                                  return (
                                    <span key={id} className="text-xs font-bold text-indigo-800 bg-white px-2.5 py-1 rounded-lg border border-indigo-200 flex items-center gap-1.5 shadow-2xs">
                                      <UserCheck className="w-3.5 h-3.5 text-indigo-600" />
                                      {m?.name || id} {col ? `(${col.name})` : ""}
                                    </span>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        /* 2. Evaluating CAM Panel: Map Available Mentors from Evaluating Campus */
                        <>
                          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/80 pb-3">
                            <h3 className="text-xs font-black text-slate-800 flex items-center gap-2">
                              <Users className="w-4 h-4 text-[#D528A2]" />
                              Map Available Faculty Mentors from Your Campus During Free Periods — {req.subject}
                            </h3>
                            <span className="text-[10px] font-extrabold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2.5 py-1 rounded-lg">
                              Target Date: {req.target_date} ({new Date(req.target_date).toLocaleDateString("en-US", { weekday: "long" })})
                            </span>
                          </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Student Count Input + Auto-Calculate as per Time */}
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <label className="text-[10px] text-slate-500 uppercase font-extrabold tracking-wider block">
                              Student Count for Session
                            </label>
                            {mappedMentorIds.length > 0 && (
                              <button
                                type="button"
                                onClick={() => setCamStudentCount(Math.max(1, mappedMentorIds.length * 3))}
                                className="text-[9px] font-black text-[#D528A2] hover:underline cursor-pointer flex items-center gap-1"
                                title="1 slot (50m) ÷ 15m = ~3 students per mentor"
                              >
                                <Sparkles className="w-3 h-3" /> Auto-Calc ({mappedMentorIds.length * 3})
                              </button>
                            )}
                          </div>
                          <input
                            type="number" min={1} max={500} value={camStudentCount}
                            onChange={e => setCamStudentCount(Number(e.target.value))}
                            className="w-full p-2.5 border border-slate-200 rounded-xl bg-white text-xs font-bold focus:ring-1 focus:ring-indigo-500 outline-none"
                            required
                          />
                          <p className="text-[9px] text-slate-400 font-medium">
                            {mappedMentorIds.length > 0
                              ? `${mappedMentorIds.length} Mentor(s) selected ➔ Recommended ~${mappedMentorIds.length * 3} students in 1 slot`
                              : "Select mentors below to auto-calculate capacity"}
                          </p>
                        </div>
                        
                        {/* Interview Time Slot Selector */}
                        <div className="space-y-1.5">
                          <label className="text-[10px] text-slate-500 uppercase font-extrabold tracking-wider block">
                            Interview Time Slot <span className="text-[#D528A2]">(Auto-Selects Free Faculty)</span>
                          </label>
                          {(() => {
                            const targetCollegeId = req.college_id || defaultCollegeId || currentMentor?.college_id;
                            const collegeTimeSlots = getCollegePeriodTimeSlots(targetCollegeId, activeCollegesList, slots);

                            return (
                              <select
                                value={camTimeSlot}
                                onChange={e => {
                                  const newSlot = e.target.value;
                                  setCamTimeSlot(newSlot);

                                  const targetDayName = req.target_date 
                                    ? new Date(req.target_date.includes("T") ? req.target_date : `${req.target_date}T00:00:00`).toLocaleDateString("en-US", { weekday: "long" }) 
                                    : "Friday";
                                  const mentorsToEvaluate = showAllCampusMentors 
                                    ? campusMentors 
                                    : (subjectMentors.length > 0 ? subjectMentors : campusMentors);

                                  // Find all faculty mentors who are FREE in this slot
                                  const freeMentors = mentorsToEvaluate.filter(m => {
                                    const mentorBusySlots = (slots || []).filter(s => s.mentorId === m.id && (s.day || "").toLowerCase().trim() === targetDayName.toLowerCase().trim());
                                    const busyTimes = mentorBusySlots.map(s => (s.time || "").trim());
                                    return !busyTimes.some(b => b.toLowerCase().replace(/\s+/g, "") === newSlot.toLowerCase().replace(/\s+/g, ""));
                                  });

                                  const freeIds = freeMentors.map(m => m.id);

                                  if (freeIds.length > 0) {
                                    setMappedMentorIds(freeIds);
                                    const newSlotMap: Record<string, string> = {};
                                    const newCountMap: Record<string, number> = {};
                                    freeIds.forEach(id => {
                                      newSlotMap[id] = newSlot;
                                      newCountMap[id] = 3;
                                    });
                                    setMentorSlotMap(newSlotMap);
                                    setMentorCountMap(newCountMap);
                                    setCamStudentCount(freeIds.length * 3);
                                  } else {
                                    setMappedMentorIds([]);
                                    setCamStudentCount(0);
                                  }
                                }}
                                className="w-full p-2.5 border border-slate-200 rounded-xl bg-white text-xs font-bold focus:ring-1 focus:ring-indigo-500 outline-none cursor-pointer"
                              >
                                {collegeTimeSlots.map(t => (
                                  <option key={t} value={t}>{t}</option>
                                ))}
                              </select>
                            );
                          })()}
                          <p className="text-[9px] text-slate-400 font-medium">
                            Auto-checks all faculty free in this slot &amp; updates capacity
                          </p>
                        </div>

                        {/* Google Meet Link */}
                        <div className="space-y-1.5">
                          <label className="text-[10px] text-slate-500 uppercase font-extrabold tracking-wider block">
                            Google Meet Link <span className="text-slate-400 font-normal">(Optional for External)</span>
                          </label>
                          <input
                            type="url" value={cmGmeetLink}
                            onChange={e => setCmGmeetLink(e.target.value)}
                            placeholder="https://meet.google.com/xxx-xxxx-xxx"
                            className="w-full p-2.5 border border-slate-200 rounded-xl bg-white text-xs font-semibold focus:ring-1 focus:ring-indigo-500 outline-none placeholder-slate-300"
                          />
                          <p className="text-[9px] text-slate-400 font-medium">
                            Auto-dispatched in notification emails
                          </p>
                        </div>
                      </div>

                      {/* Available Mentors & Free Period Schedule Matrix */}
                      <div className="space-y-3 pt-2 border-t border-slate-200/80">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <label className="text-[10px] text-slate-700 uppercase font-black tracking-wider block">
                              Faculty Mentors Availability on {new Date(req.target_date).toLocaleDateString("en-US", { weekday: "long" })}
                            </label>
                            <span className="text-[9px] font-bold text-slate-500">
                              Select mentors and configure their individual time slots and student batches
                            </span>
                          </div>

                          {/* Flexible Scope Toggle */}
                          <div className="inline-flex p-0.5 rounded-lg bg-slate-100 border border-slate-200 text-[10px] font-bold">
                            <button
                              type="button"
                              onClick={() => setShowAllCampusMentors(false)}
                              className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                                !showAllCampusMentors ? "bg-white text-[#D528A2] shadow-2xs font-black" : "text-slate-500 hover:text-slate-800"
                              }`}
                            >
                              Subject Faculty ({subjectMentors.length})
                            </button>
                            <button
                              type="button"
                              onClick={() => setShowAllCampusMentors(true)}
                              className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                                showAllCampusMentors ? "bg-white text-[#D528A2] shadow-2xs font-black" : "text-slate-500 hover:text-slate-800"
                              }`}
                            >
                              All Campus Faculty ({campusMentors.length})
                            </button>
                          </div>
                        </div>

                        <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                          {(() => {
                            const mentorsToDisplay = showAllCampusMentors 
                              ? campusMentors 
                              : (subjectMentors.length > 0 ? subjectMentors : campusMentors);

                            if (mentorsToDisplay.length === 0) {
                              return (
                                <p className="text-xs text-slate-400 italic py-3 bg-white rounded-xl border border-slate-200 text-center">
                                  No faculty mentors found at this campus.
                                </p>
                              );
                            }

                            const targetCollegeId = req.college_id || defaultCollegeId || currentMentor?.college_id;
                            const collegeTimeSlots = getCollegePeriodTimeSlots(targetCollegeId, activeCollegesList, slots);

                            return mentorsToDisplay.map(m => {
                              const checked = mappedMentorIds.includes(m.id);
                              const targetDayName = req.target_date 
                                ? new Date(req.target_date.includes("T") ? req.target_date : `${req.target_date}T00:00:00`).toLocaleDateString("en-US", { weekday: "long" }) 
                                : "Friday";
                              const mentorBusySlots = (slots || []).filter(s => 
                                s.mentorId === m.id && 
                                (s.day || "").toLowerCase().trim() === targetDayName.toLowerCase().trim()
                              );
                              const busyTimes = mentorBusySlots.map(s => (s.time || "").trim());
                              const freeSlots = collegeTimeSlots.filter(t => !busyTimes.some(b => b.toLowerCase().replace(/\s+/g, "") === t.toLowerCase().replace(/\s+/g, "")));
                              
                              const assignedMentorSlot = mentorSlotMap[m.id] || camTimeSlot;
                              const isFreeInAssignedSlot = freeSlots.some(t => t.toLowerCase().replace(/\s+/g, "") === assignedMentorSlot.toLowerCase().replace(/\s+/g, ""));
                              const mentorCount = mentorCountMap[m.id] || 3;

                              return (
                                <div
                                  key={m.id}
                                  className={`p-3 rounded-xl border transition-all ${
                                    checked
                                      ? "bg-indigo-50/70 border-indigo-300 shadow-2xs"
                                      : "bg-white border-slate-200 hover:border-slate-300"
                                  }`}
                                >
                                  <div className="flex items-start gap-2.5">
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      id={`mentor_chk_${m.id}`}
                                      onChange={e => {
                                        if (e.target.checked) {
                                          const newMapped = [...mappedMentorIds, m.id];
                                          setMappedMentorIds(newMapped);
                                          const defaultSlot = freeSlots[0] || camTimeSlot;
                                          setMentorSlotMap(prev => ({ ...prev, [m.id]: defaultSlot }));
                                          setMentorCountMap(prev => ({ ...prev, [m.id]: 3 }));
                                          const newTotal = newMapped.reduce((acc, id) => acc + (id === m.id ? 3 : (mentorCountMap[id] || 3)), 0);
                                          setCamStudentCount(newTotal);
                                        } else {
                                          const newMapped = mappedMentorIds.filter(id => id !== m.id);
                                          setMappedMentorIds(newMapped);
                                          const newTotal = newMapped.reduce((acc, id) => acc + (mentorCountMap[id] || 3), 0);
                                          setCamStudentCount(Math.max(1, newTotal));
                                        }
                                      }}
                                      className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 mt-0.5 cursor-pointer"
                                    />
                                    <div className="flex-1 min-w-0 space-y-1.5">
                                      <div className="flex flex-wrap items-center justify-between gap-1.5">
                                        <div className="flex items-center gap-1.5">
                                          <label htmlFor={`mentor_chk_${m.id}`} className="font-extrabold text-slate-800 text-xs cursor-pointer hover:text-indigo-600">
                                            {m.name}
                                          </label>
                                          <span className="text-[10px] text-slate-400 font-medium">({m.department || "Faculty"})</span>
                                        </div>

                                        {isFreeInAssignedSlot ? (
                                          <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                            ✓ Free in {assignedMentorSlot}
                                          </span>
                                        ) : (
                                          <span className="text-[9px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                                            In Class in {assignedMentorSlot}
                                          </span>
                                        )}
                                      </div>

                                      {/* Clean Free Slots Pills */}
                                      <div className="flex flex-wrap items-center gap-1 text-[10px]">
                                        <span className="text-slate-400 font-bold uppercase text-[9px] mr-0.5">Free:</span>
                                        {freeSlots.length === 0 ? (
                                          <span className="text-rose-500 font-semibold text-[9px]">Fully booked today</span>
                                        ) : (
                                          freeSlots.map(fs => {
                                            const isSelected = assignedMentorSlot === fs;
                                            return (
                                              <button
                                                key={fs}
                                                type="button"
                                                onClick={() => {
                                                  setMentorSlotMap(prev => ({ ...prev, [m.id]: fs }));
                                                  if (!mappedMentorIds.includes(m.id)) {
                                                    const newMapped = [...mappedMentorIds, m.id];
                                                    setMappedMentorIds(newMapped);
                                                    const newTotal = newMapped.reduce((acc, id) => acc + (id === m.id ? 3 : (mentorCountMap[id] || 3)), 0);
                                                    setCamStudentCount(newTotal);
                                                  }
                                                }}
                                                className={`px-2 py-0.5 rounded text-[9px] font-bold transition-all cursor-pointer ${
                                                  isSelected
                                                    ? "bg-emerald-600 text-white shadow-2xs font-extrabold"
                                                    : "bg-slate-100 hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 border border-slate-200"
                                                }`}
                                              >
                                                {fs}
                                              </button>
                                            );
                                          })
                                        )}
                                      </div>

                                      {/* Subtle Busy Line */}
                                      {mentorBusySlots.length > 0 && (
                                        <div className="text-[9px] text-slate-400 font-medium">
                                          <span className="font-semibold text-slate-500">In Class:</span> {mentorBusySlots.map((b: any) => `${b.time} (${b.course || 'Class'})`).join(", ")}
                                        </div>
                                      )}

                                      {/* Per-Mentor Config (When Checked) */}
                                      {checked && (
                                        <div className="mt-1.5 pt-1.5 border-t border-indigo-150 flex flex-wrap items-center gap-3 bg-white/70 p-2 rounded-lg border border-indigo-100">
                                          <div className="flex items-center gap-1.5 text-xs">
                                            <label className="text-[9px] text-slate-500 font-bold uppercase">Time Slot:</label>
                                            <select
                                              value={assignedMentorSlot}
                                              onChange={e => {
                                                const newSlot = e.target.value;
                                                setMentorSlotMap(prev => ({ ...prev, [m.id]: newSlot }));
                                              }}
                                              className="p-1 border border-slate-200 rounded-md text-xs font-bold bg-white outline-none cursor-pointer"
                                            >
                                              {collegeTimeSlots.map(s => (
                                                <option key={s} value={s}>{s} {freeSlots.includes(s) ? "(Free)" : "(Class)"}</option>
                                              ))}
                                            </select>
                                          </div>

                                          <div className="flex items-center gap-1.5 text-xs">
                                            <label className="text-[9px] text-slate-500 font-bold uppercase">Candidates:</label>
                                            <input
                                              type="number"
                                              min={1}
                                              max={100}
                                              value={mentorCount}
                                              onChange={e => {
                                                const count = Math.max(1, parseInt(e.target.value) || 1);
                                                setMentorCountMap(prev => {
                                                  const updated = { ...prev, [m.id]: count };
                                                  const newTotal = mappedMentorIds.reduce((acc, id) => acc + (updated[id] || 3), 0);
                                                  setCamStudentCount(newTotal);
                                                  return updated;
                                                });
                                              }}
                                              className="w-14 p-1 border border-slate-200 rounded-md text-xs font-bold bg-white text-center outline-none"
                                            />
                                            <span className="text-[9px] text-slate-400 font-medium">(15m each)</span>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            });
                          })()}
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-200">
                        <div className="text-xs text-slate-600 font-semibold">
                          <strong className="text-indigo-600 font-black">{mappedMentorIds.length}</strong> mentor(s) scheduled
                          • Total Capacity: <strong className="text-slate-900 font-black">{camStudentCount} Students</strong>
                          {mappedMentorIds.length > 0 && (
                            <span className="text-[10px] text-slate-400 ml-1">
                              ({mappedMentorIds.map(id => {
                                const m = mentors.find(x => x.id === id);
                                return `${m?.name || id}: ${mentorSlotMap[id] || camTimeSlot} (${mentorCountMap[id] || 3} st)`;
                              }).join(", ")})
                            </span>
                          )}
                        </div>
                        <button
                          onClick={() => handleAssign(req.id)}
                          disabled={isAssigning || mappedMentorIds.length === 0 || !camStudentCount || camStudentCount < 1}
                          className="btn-gradient flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-extrabold disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shrink-0"
                        >
                          {isAssigning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                          {isAssigning ? "Dispatching..." : "Assign & Mark Calendar"}
                        </button>
                      </div>
                    </>
                  )}
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
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setViewingStudentRosterModal(i)}
                              title="View Assigned Faculty, Student Roster & Logs"
                              className="flex items-center gap-1 text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-[10px] font-extrabold px-2.5 py-1.5 rounded-lg transition-all shadow-2xs cursor-pointer whitespace-nowrap"
                            >
                              <Eye className="w-3.5 h-3.5 text-indigo-600" />
                              Logs &amp; Details
                            </button>
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
                                className="flex items-center gap-1 text-indigo-600 bg-indigo-50 border border-indigo-200 text-[10px] font-bold px-2 py-1 rounded-lg hover:bg-indigo-100 transition-all">
                                <Video className="w-3 h-3 text-indigo-600" /> Meet
                              </a>
                            )}
                            <button
                              onClick={() => handleDeleteInterview(i.id)}
                              title="Delete Interview"
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all border border-transparent hover:border-rose-200 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
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
                      {["Subject", "Class", "Type", "Requested By", "Target Date", "Students", "Status", "Actions"].map(h => (
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
                        <td className="px-4 py-3">
                          <button
                            onClick={() => setViewingStudentRosterModal(i)}
                            title="View Assigned Faculty, Student Roster & Logs"
                            className="flex items-center gap-1 text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-[10px] font-extrabold px-2.5 py-1.5 rounded-lg transition-all shadow-2xs cursor-pointer whitespace-nowrap"
                          >
                            <Eye className="w-3.5 h-3.5 text-indigo-600" />
                            Logs &amp; Details
                          </button>
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

      {/* Student-Level Conducted Status, Assigned Mentors & Audit Logs Modal */}
      {viewingStudentRosterModal && (
        <StudentConductedRosterDrawer
          interview={viewingStudentRosterModal}
          cohortStudents={students}
          evaluations={evaluationsList}
          allMentors={mentors}
          allColleges={activeCollegesList || colleges}
          userCollegeId={defaultCollegeId || currentMentor?.college_id}
          isCM={isCM}
          onClose={() => setViewingStudentRosterModal(null)}
        />
      )}

    </div>
  );
};
