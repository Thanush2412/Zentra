"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useToast } from "@/context/ToastContext";
import {
  ShieldCheck,
  Building2,
  BookOpen,
  Calendar,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Search,
  Download,
  Filter,
  Users,
  Award,
  Clock,
  ChevronRight,
  ChevronLeft,
  ExternalLink,
  FileSpreadsheet,
  Check,
  X,
  FileText,
  HelpCircle,
  ArrowRight,
  TrendingUp,
  BarChart3,
  ThumbsUp,
  ThumbsDown,
  MessageSquare,
  AlertCircle,
  Sparkles,
  Inbox,
  Send,
  Lock,
  Layers,
  Percent,
  LifeBuoy,
  Handshake,
  Camera,
  RefreshCw,
  MapPin,
  Star,
  ImageIcon,
  History
} from "lucide-react";

// ============================================================================
// 1. KAM REGIONAL CLUSTERS & 26 COLLEGES (From Naveen's Standard Operating Procedure)
// ============================================================================
export interface KAMClusterInfo {
  region: string;
  kamName: string;
  campuses: string[];
}

export const KAM_CLUSTERS: Record<string, KAMClusterInfo> = {
  "Shyam Kumar": {
    region: "Chennai",
    kamName: "Shyam Kumar",
    campuses: [
      "SDNB Vaishnav College for Women",
      "AMET University",
      "Vinayaga Mission's Research Foundation School of Arts & Science",
      "Takshashila University",
      "TJS College of Arts and Science",
      "Patrician College of Arts & Science"
    ]
  },
  "Praveen Rao": {
    region: "KA and KL",
    kamName: "Praveen Rao",
    campuses: [
      "Alliance University",
      "Kristu Jayathi University",
      "St. Agnes College (Autonomous)",
      "Asian School of Business",
      "S-VYASA University"
    ]
  },
  "Guna Karthick": {
    region: "Rest of TN",
    kamName: "Guna Karthick",
    campuses: [
      "Kamaraj College",
      "Kamaraj Women's College",
      "Noorul Islam Centre for Higher Education (NICHE)",
      "Sri Amaraavathi College of Arts & Science",
      "Bharathidasan College of Arts & Science",
      "Nagarathinam Angalammal Arts & Science College",
      "TERF's College of Arts and Science",
      "Sasurie College of Arts and Science"
    ]
  },
  "New KAM": {
    region: "Coimbatore",
    kamName: "New KAM",
    campuses: [
      "Rathinam College of Arts & Science",
      "Sree Saraswathi Thyagaraja College",
      "VLB Janakiammal College of Arts and Science",
      "Hindusthan College of Arts & Science",
      "Kongunadu College of Arts and Science",
      "Sri Ramakrishna College of Arts and Science for Women",
      "Study World Group of Institution"
    ]
  }
};

export function resolveKAMForCampus(campusName?: string): { kam: string; region: string; matchedCampus: string; campuses: string[] } {
  const norm = (campusName || "").trim().toLowerCase();
  for (const [kam, info] of Object.entries(KAM_CLUSTERS)) {
    for (const c of info.campuses) {
      if (c.trim().toLowerCase() === norm || norm.includes(c.trim().toLowerCase()) || c.trim().toLowerCase().includes(norm)) {
        return { kam, region: info.region, matchedCampus: c, campuses: info.campuses };
      }
    }
  }
  // Default fallback to Chennai cluster if unmapped
  return {
    kam: "Shyam Kumar",
    region: "Chennai",
    matchedCampus: campusName || "SDNB Vaishnav College for Women",
    campuses: KAM_CLUSTERS["Shyam Kumar"]?.campuses || []
  };
}

// ============================================================================
// 2. DATA INTERFACES
// ============================================================================
export interface SkillAuditRecord {
  uid: string;
  id: string;
  mentor: string;
  campus: string;
  deptName: string;
  department: string;
  subject: string;
  criteria: {
    genuine: boolean;
    weeklyPlan: boolean;
    tracker: boolean;
    assignment: boolean;
    assessment: boolean;
  };
  proof?: {
    assignment?: { link?: string; fileName?: string };
    assessment?: { link?: string; fileName?: string };
  };
  score: number;
  tasksAssigned: number;
  tasksCompleted: number;
  avgCompletionPct: number;
  remarks: string;
  date: string;
  status: "Completed" | "In Progress" | "Not Completed";
}

export interface AcademicAuditRecord {
  uid: string;
  id: string;
  mentor: string;
  campus: string;
  deptName: string;
  department: string;
  subject: string;
  criteria: {
    assignmentGenuine: boolean;
    assessmentGenuine: boolean;
    beforeDeadline: boolean;
    studyMaterial: boolean;
  };
  score: number;
  remarks: string;
  date: string;
  status: "Completed" | "In Progress" | "Not Completed";
}

export interface AttendanceAuditRecord {
  uid: string;
  id: string;
  mentor: string;
  campus: string;
  deptName: string;
  department: string;
  below75: number;
  criteria: {
    markedDaily: boolean;
    crossVerified: boolean;
    noProxy: boolean;
    matchesTracker: boolean;
  };
  score: number;
  remarks: string;
  date: string;
  status: "Completed" | "In Progress" | "Not Completed";
}

export interface PeerAuditRecord {
  uid: string;
  id: string;
  campus: string;
  mentor: string;
  deptName: string;
  department: string;
  kam: string;
  region: string;
  reviewerCampus: string;
  reviewerCM: string;
  weeklyPlan: "Completed" | "In Progress" | "Not Completed";
  skillDev: "Completed" | "In Progress" | "Not Completed";
  academic: "Completed" | "In Progress" | "Not Completed";
  overall: "Completed" | "In Progress" | "Not Completed";
  auditor: string;
  date: string;
  auditorNotes?: string;
  evidenceSnapshot?: {
    skillScore?: number;
    academicScore?: number;
    attendanceScore?: number;
    proofLink?: string;
    remarks?: string;
  };
}

export interface PeerReviewHistoryRecord {
  pairKey: string;
  submittedCampus: string;
  submittedCM: string;
  reviewerCampus: string;
  reviewerCM: string;
  kam: string;
  region: string;
  monthKey: string;
  createdAt: string;
}

export interface CampusAuditManagerProps {
  collegeId?: string;
  collegeName?: string;
  role?: "cam" | "kam" | "admin" | "hr";
  userName?: string;
}

// Deterministic PRNG for Intra-KAM rotation engine
function mulberry32(a: number) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function strSeed(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

// Storage keys for browser persistence
const STORAGE_KEY_AUDIT_DATA = "fp_campus_audit_data_v2";
const STORAGE_KEY_PEER_HISTORY = "fp_campus_audit_peer_history_v2";

// ============================================================================
// INITIAL REALISTIC SEED DATA (Naveen's Cluster Records)
// ============================================================================
export const INITIAL_SKILL_RECORDS: SkillAuditRecord[] = [
  {
    uid: "sk_001",
    id: "LOG-SK-801",
    mentor: "Dr. K. Sangeetha",
    campus: "SDNB Vaishnav College for Women",
    deptName: "B.Sc Computer Science",
    department: "Computer Science",
    subject: "Full-Stack Web Architecture (React & Node)",
    criteria: { genuine: true, weeklyPlan: true, tracker: true, assignment: true, assessment: true },
    proof: { assignment: { link: "https://github.com/sdnb-cs/fullstack-assignments" }, assessment: { link: "https://drive.google.com/open?id=sdnb-assess-wk4" } },
    score: 100,
    tasksAssigned: 12,
    tasksCompleted: 11,
    avgCompletionPct: 92,
    remarks: "Excellent weekly cadence. Verified student repos against git commit timestamps.",
    date: "2026-09-12",
    status: "Completed"
  },
  {
    uid: "sk_002",
    id: "LOG-SK-802",
    mentor: "Prof. R. Vignesh",
    campus: "SDNB Vaishnav College for Women",
    deptName: "BCA Computer Applications",
    department: "Information Technology",
    subject: "Algorithms & Competitive Problem Solving",
    criteria: { genuine: true, weeklyPlan: true, tracker: true, assignment: true, assessment: false },
    proof: { assignment: { link: "https://hackerrank.com/contests/sdnb-bca-round2" } },
    score: 80,
    tasksAssigned: 15,
    tasksCompleted: 13,
    avgCompletionPct: 86,
    remarks: "Assessment scheduled for Friday afternoon. Assignment code reviews completed.",
    date: "2026-09-14",
    status: "In Progress"
  },
  {
    uid: "sk_003",
    id: "LOG-SK-803",
    mentor: "Dr. Arvind Menon",
    campus: "Alliance University",
    deptName: "B.Tech CSE",
    department: "Engineering",
    subject: "Cloud Computing & Kubernetes Containerization",
    criteria: { genuine: true, weeklyPlan: true, tracker: true, assignment: true, assessment: true },
    proof: { assignment: { link: "https://github.com/alliance-cloud/k8s-lab-submissions" } },
    score: 100,
    tasksAssigned: 10,
    tasksCompleted: 9,
    avgCompletionPct: 90,
    remarks: "Docker daemon logs cross-verified. Students deployed microservices on cluster.",
    date: "2026-09-11",
    status: "Completed"
  },
  {
    uid: "sk_004",
    id: "LOG-SK-804",
    mentor: "Mrs. Priya Lakshmi",
    campus: "Kamaraj College",
    deptName: "B.Com Professional Accounting",
    department: "Commerce",
    subject: "Financial Modeling & Tally Prime ERP",
    criteria: { genuine: true, weeklyPlan: true, tracker: false, assignment: true, assessment: false },
    proof: { assignment: { link: "https://drive.google.com/file/d/tally-prime-sheet" } },
    score: 60,
    tasksAssigned: 8,
    tasksCompleted: 5,
    avgCompletionPct: 62,
    remarks: "Daily tracker entry delayed by 2 days due to college sports day.",
    date: "2026-09-10",
    status: "In Progress"
  }
];

export const INITIAL_ACADEMIC_RECORDS: AcademicAuditRecord[] = [
  {
    uid: "ac_001",
    id: "TSK-AC-401",
    mentor: "Dr. K. Sangeetha",
    campus: "SDNB Vaishnav College for Women",
    deptName: "B.Sc Computer Science",
    department: "Computer Science",
    subject: "Database Management Systems & SQL",
    criteria: { assignmentGenuine: true, assessmentGenuine: true, beforeDeadline: true, studyMaterial: true },
    score: 100,
    remarks: "Unit 3 Normalization & BCNF fully conducted. Question bank shared on LMS.",
    date: "2026-09-13",
    status: "Completed"
  },
  {
    uid: "ac_002",
    id: "TSK-AC-402",
    mentor: "Prof. R. Vignesh",
    campus: "SDNB Vaishnav College for Women",
    deptName: "BCA Computer Applications",
    department: "Information Technology",
    subject: "Object Oriented Programming in Java",
    criteria: { assignmentGenuine: true, assessmentGenuine: true, beforeDeadline: false, studyMaterial: true },
    score: 75,
    remarks: "Lab experiment 5 submitted 1 day past deadline by cohort B.",
    date: "2026-09-14",
    status: "In Progress"
  },
  {
    uid: "ac_003",
    id: "TSK-AC-403",
    mentor: "Dr. M. Soundararajan",
    campus: "AMET University",
    deptName: "Marine Engineering",
    department: "Engineering",
    subject: "Marine Instrumentation & Sensor Networks",
    criteria: { assignmentGenuine: true, assessmentGenuine: true, beforeDeadline: true, studyMaterial: true },
    score: 100,
    remarks: "Sensors simulation recorded and verified with lab logbook.",
    date: "2026-09-12",
    status: "Completed"
  }
];

export const INITIAL_ATTENDANCE_RECORDS: AttendanceAuditRecord[] = [
  {
    uid: "at_001",
    id: "ATT-VER-301",
    mentor: "Dr. K. Sangeetha",
    campus: "SDNB Vaishnav College for Women",
    deptName: "B.Sc Computer Science",
    department: "Computer Science",
    below75: 3,
    criteria: { markedDaily: true, crossVerified: true, noProxy: true, matchesTracker: true },
    score: 100,
    remarks: "Biometric and classroom log matched 100%. SMS alerts sent to parents of 3 absentees.",
    date: "2026-09-13",
    status: "Completed"
  },
  {
    uid: "at_002",
    id: "ATT-VER-302",
    mentor: "Prof. R. Vignesh",
    campus: "SDNB Vaishnav College for Women",
    deptName: "BCA Computer Applications",
    department: "Information Technology",
    below75: 7,
    criteria: { markedDaily: true, crossVerified: true, noProxy: true, matchesTracker: false },
    score: 75,
    remarks: "Discrepancy of 2 students between morning period log and biometric machine.",
    date: "2026-09-14",
    status: "In Progress"
  }
];

const INITIAL_PEER_AUDITS: PeerAuditRecord[] = [
  {
    uid: "aud_001",
    id: "AUD-2026-081",
    campus: "AMET University",
    mentor: "Dr. M. Soundararajan",
    deptName: "Marine Engineering",
    department: "Engineering",
    kam: "Shyam Kumar",
    region: "Chennai",
    reviewerCampus: "SDNB Vaishnav College for Women",
    reviewerCM: "Campus Manager (SDNB Vaishnav)",
    weeklyPlan: "Completed",
    skillDev: "Completed",
    academic: "Completed",
    overall: "In Progress",
    auditor: "Campus Manager (AMET University)",
    date: "2026-09-14",
    auditorNotes: "Assigned to SDNB Vaishnav for Intra-KAM peer verification. Awaiting reviewer sign-off.",
    evidenceSnapshot: {
      skillScore: 94,
      academicScore: 100,
      attendanceScore: 100,
      proofLink: "https://github.com/amet-marine/sensor-lab-proofs",
      remarks: "Conducted 18 hours of micro-controller practicals. Excellent student attendance."
    }
  },
  {
    uid: "aud_002",
    id: "AUD-2026-080",
    campus: "SDNB Vaishnav College for Women",
    mentor: "Dr. K. Sangeetha",
    deptName: "B.Sc Computer Science",
    department: "Computer Science",
    kam: "Shyam Kumar",
    region: "Chennai",
    reviewerCampus: "Takshashila University",
    reviewerCM: "Campus Manager (Takshashila University)",
    weeklyPlan: "Completed",
    skillDev: "Completed",
    academic: "Completed",
    overall: "Completed",
    auditor: "Campus Manager (SDNB Vaishnav)",
    date: "2026-09-12",
    auditorNotes: "Signed off by Takshashila University CM. All code repositories and student tests verified.",
    evidenceSnapshot: {
      skillScore: 100,
      academicScore: 100,
      attendanceScore: 100,
      proofLink: "https://github.com/sdnb-cs/fullstack-assignments",
      remarks: "Flawless documentation. All 12 weekly exercises verified against timetable."
    }
  }
];

// Initial Peer Review Cooldown History (Chennai cluster)
const INITIAL_PEER_HISTORY: PeerReviewHistoryRecord[] = [
  {
    pairKey: "amet university<->sdnb vaishnav college for women",
    submittedCampus: "AMET University",
    submittedCM: "Campus Manager (AMET)",
    reviewerCampus: "SDNB Vaishnav College for Women",
    reviewerCM: "Campus Manager (SDNB Vaishnav)",
    kam: "Shyam Kumar",
    region: "Chennai",
    monthKey: "2026-09",
    createdAt: new Date().toISOString()
  }
];

// Initial Campus Ticketing Matrix (from Consolidated Ticketing report.html)
const CAMPUS_TICKETS_SAMPLE = [
  { id: "TCK-1092", category: "Academic Syllabus", title: "Unit 4 Data Structures lab server port blocked", priority: "High", status: "Resolved", time: "2h ago" },
  { id: "TCK-1088", category: "LMS Portal", title: "Student quiz submission timeout in Section B", priority: "Medium", status: "Resolved", time: "1d ago" },
  { id: "TCK-1085", category: "Attendance Discrepancy", title: "Biometric synch delay for Period 3 morning shift", priority: "Low", status: "In Progress", time: "2d ago" },
  { id: "TCK-1079", category: "Infrastructure", title: "HDMI projector cable replacement in Seminar Hall 2", priority: "Medium", status: "Resolved", time: "4d ago" }
];

// ============================================================================
// 2b. CLASSROOM OBSERVATION VIEW (form + gallery, college-scoped)
// ============================================================================

const OBS_RATING_DIMS = [
  { key: "rating_professionalism", label: "Professionalism" },
  { key: "rating_class_handling", label: "Class Handling" },
  { key: "rating_skill_development", label: "Skill Development" },
  { key: "rating_student_engagement", label: "Student Engagement" },
  { key: "rating_tasks_followup", label: "Tasks Follow-up" },
  { key: "rating_session_plan_adherence", label: "Session Plan Adherence" },
  { key: "rating_study_material_sharing", label: "Material Sharing" }
] as const;

export const ClassObservationView: React.FC<{
  collegeName: string;
  userName: string;
  observations: any[];
  loading: boolean;
  error: string;
  onRefresh: () => void;
  showForm: boolean;
  setShowForm: (v: boolean) => void;
  saving: boolean;
  setSaving: (v: boolean) => void;
  detail: any | null;
  setDetail: (v: any | null) => void;
}> = ({ collegeName, userName, observations, loading, error, onRefresh, showForm, setShowForm, saving, setSaving, detail, setDetail }) => {
  const { toast } = useToast();
  const [fTeacher, setFTeacher] = useState("");
  const [fDept, setFDept] = useState("");
  const [fSubject, setFSubject] = useState("");
  const [fDate, setFDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [fPhoto, setFPhoto] = useState<File | null>(null);
  const [fPhotoPreview, setFPhotoPreview] = useState("");
  const [fRatings, setFRatings] = useState<Record<string, number>>({});
  const [fOverall, setFOverall] = useState(4);
  const [fSatisfaction, setFSatisfaction] = useState<"satisfied" | "not_satisfied">("satisfied");
  const [fRemarks, setFRemarks] = useState("");

  const resetForm = () => {
    setFTeacher(""); setFDept(""); setFSubject("");
    setFDate(new Date().toISOString().slice(0, 10)); setFPhoto(null); setFPhotoPreview("");
    setFRatings({}); setFOverall(4); setFSatisfaction("satisfied"); setFRemarks("");
  };

  const wordCount = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

  const handleSubmit = async () => {
    if (!fTeacher.trim()) { toast("Enter the mentor / teacher observed.", "warning"); return; }
    if (fSatisfaction === "not_satisfied" && wordCount(fRemarks) < 20) {
      toast("For 'Not Satisfied', remarks must be at least 20 words explaining the concerns.", "warning");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        college: collegeName,
        manager_name: userName || null,
        class_name: fDept || null,
        department: fDept || null,
        subject: fSubject || null,
        course_name: fSubject || null,
        teacher_name: fTeacher.trim() || null,
        mentor_name: fTeacher.trim() || null,
        notes: fRemarks || null,
        comments: fRemarks || null,
        observation_date: fDate || null,
        rating_professionalism: fRatings.rating_professionalism ?? null,
        rating_class_handling: fRatings.rating_class_handling ?? null,
        rating_skill_development: fRatings.rating_skill_development ?? null,
        rating_student_engagement: fRatings.rating_student_engagement ?? null,
        rating_tasks_followup: fRatings.rating_tasks_followup ?? null,
        rating_session_plan_adherence: fRatings.rating_session_plan_adherence ?? null,
        rating_study_material_sharing: fRatings.rating_study_material_sharing ?? null,
        overall_rating: fOverall,
        satisfaction_status: fSatisfaction,
        satisfaction_remarks: fRemarks || null
      };
      let res: Response;
      if (fPhoto) {
        const fd = new FormData();
        fd.append("photo", fPhoto);
        fd.append("payload", JSON.stringify(payload));
        res = await fetch("/api/audit/observations", { method: "POST", body: fd });
      } else {
        res = await fetch("/api/audit/observations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
      }
      const data = await res.json();
      if (data.success) {
        toast(
          fSatisfaction === "not_satisfied"
            ? "Observation logged & escalation email sent to senior management."
            : "Classroom observation logged successfully.",
          "success"
        );
        resetForm();
        setShowForm(false);
        onRefresh();
      } else {
        toast(data.message || "Failed to save observation.", "error");
      }
    } catch (e: any) {
      toast("Network error while saving observation.", "error");
    } finally {
      setSaving(false);
    }
  };

  const avgObs = observations.length > 0
    ? Math.round((observations.reduce((s, o) => s + (Number(o.overall_rating) || 0), 0) / observations.length) * 10) / 10
    : null;
  const notSatisfiedCount = observations.filter(o => o.satisfaction_status === "not_satisfied").length;
  const thisMonthCount = observations.filter(o => (o.observation_date || String(o.created_at || "")).slice(0, 7) === new Date().toISOString().slice(0, 7)).length;


  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-2">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <Camera className="h-5 w-5 text-orange-600" />
            <div>
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">
                Classroom Observation Log ({collegeName})
              </h3>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Log classroom visits with photo evidence, dimension ratings, and satisfaction status. Not-satisfied entries escalate to senior management automatically.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onRefresh}
              className="p-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-600 transition-colors cursor-pointer"
              title="Refresh"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            </button>
            <button
              type="button"
              onClick={() => setShowForm(!showForm)}
              className={`px-4 py-2 text-xs font-extrabold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-xs ${
                showForm ? "bg-slate-200 text-slate-700 hover:bg-slate-300" : "bg-orange-600 hover:bg-orange-700 text-white"
              }`}
            >
              <Camera className="h-4 w-4" />
              <span>{showForm ? "Close Form" : "Log Observation"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 bg-white border border-slate-200 rounded-xl shadow-2xs">
          <span className="text-[9px] font-black uppercase tracking-wider text-slate-500 block">Total Observations</span>
          <div className="text-2xl font-black text-slate-900 mt-1">{observations.length}</div>
        </div>
        <div className="p-3.5 bg-indigo-50 border border-indigo-200 rounded-xl shadow-2xs">
          <span className="text-[9px] font-black uppercase tracking-wider text-indigo-700 block">This Month</span>
          <div className="text-2xl font-black text-indigo-900 mt-1">{thisMonthCount}</div>
        </div>
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl shadow-2xs">
          <span className="text-[9px] font-black uppercase tracking-wider text-emerald-700 block">Avg Overall Rating</span>
          <div className="text-2xl font-black text-emerald-900 mt-1">{avgObs ?? "—"}</div>
          <span className="text-[10px] text-emerald-700 font-medium">out of 5</span>
        </div>
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl shadow-2xs">
          <span className="text-[9px] font-black uppercase tracking-wider text-rose-700 block">Not Satisfied Flags</span>
          <div className="text-2xl font-black text-rose-900 mt-1">{notSatisfiedCount}</div>
          <span className="text-[10px] text-rose-700 font-medium">escalated</span>
        </div>
      </div>

      {error && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs font-bold text-rose-700">{error}</div>
      )}

      {/* Entry form */}
      {showForm && (
        <div className="bg-white border-2 border-orange-200 rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Sparkles className="h-4 w-4 text-orange-500" />
            <span className="text-xs font-black text-slate-800 uppercase tracking-wider">New Observation Entry</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="block text-[10px] font-black text-slate-600 uppercase tracking-wider mb-1">Mentor / Teacher *</label>
              <input value={fTeacher} onChange={(e) => setFTeacher(e.target.value)} placeholder="Faculty observed"
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-medium focus:outline-hidden focus:ring-1 focus:ring-orange-500" />
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-600 uppercase tracking-wider mb-1">Class / Department</label>
              <input value={fDept} onChange={(e) => setFDept(e.target.value)} placeholder="e.g. B.Sc CS — Sem 3"
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-medium focus:outline-hidden focus:ring-1 focus:ring-orange-500" />
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-600 uppercase tracking-wider mb-1">Subject / Course</label>
              <input value={fSubject} onChange={(e) => setFSubject(e.target.value)} placeholder="Subject taught"
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-medium focus:outline-hidden focus:ring-1 focus:ring-orange-500" />
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-600 uppercase tracking-wider mb-1">Observation Date</label>
              <input type="date" value={fDate} onChange={(e) => setFDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-medium focus:outline-hidden focus:ring-1 focus:ring-orange-500" />
            </div>
          </div>

          {/* Dimension ratings */}
          <div>
            <span className="text-[10px] font-black text-slate-600 uppercase tracking-wider block mb-2">Dimension Ratings (1–5)</span>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {OBS_RATING_DIMS.map((d) => (
                <div key={d.key} className="flex items-center justify-between bg-slate-50 border border-slate-100 rounded-xl px-3 py-2">
                  <span className="text-[10.5px] font-bold text-slate-700">{d.label}</span>
                  <select
                    value={fRatings[d.key] ?? ""}
                    onChange={(e) => setFRatings(prev => ({ ...prev, [d.key]: Number(e.target.value) }))}
                    className="bg-white border border-slate-200 rounded-lg text-[11px] font-black px-1.5 py-0.5 cursor-pointer focus:outline-hidden"
                  >
                    <option value="">—</option>
                    {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <span className="text-[10px] font-black text-slate-600 uppercase tracking-wider block mb-2">Overall Rating *</span>
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4, 5].map(n => (
                  <button key={n} type="button" onClick={() => setFOverall(n)}
                    className={`p-1 cursor-pointer transition-transform hover:scale-110 ${n <= fOverall ? "text-amber-400" : "text-slate-300"}`}>
                    <Star className={`h-7 w-7 ${n <= fOverall ? "fill-amber-400" : ""}`} />
                  </button>
                ))}
                <span className="text-xs font-black text-slate-600 ml-1">{fOverall}/5</span>
              </div>
            </div>
            <div>
              <span className="text-[10px] font-black text-slate-600 uppercase tracking-wider block mb-2">Satisfaction Status *</span>
              <div className="flex gap-2">
                <button type="button" onClick={() => setFSatisfaction("satisfied")}
                  className={`flex-1 py-2 rounded-xl text-xs font-extrabold border transition-all cursor-pointer ${
                    fSatisfaction === "satisfied" ? "bg-emerald-600 text-white border-emerald-600" : "bg-white text-slate-600 border-slate-200 hover:border-emerald-400"
                  }`}>
                  ✓ Satisfied
                </button>
                <button type="button" onClick={() => setFSatisfaction("not_satisfied")}
                  className={`flex-1 py-2 rounded-xl text-xs font-extrabold border transition-all cursor-pointer ${
                    fSatisfaction === "not_satisfied" ? "bg-rose-600 text-white border-rose-600" : "bg-white text-slate-600 border-slate-200 hover:border-rose-400"
                  }`}>
                  ✗ Not Satisfied
                </button>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-black text-slate-600 uppercase tracking-wider mb-1">
              {fSatisfaction === "not_satisfied" ? "Remarks (min 20 words, required) *" : "Remarks / Observations"}
            </label>
            <textarea rows={3} value={fRemarks} onChange={(e) => setFRemarks(e.target.value)}
              placeholder="What did you observe during the classroom visit? Teaching quality, engagement, discipline, infrastructure…"
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-medium focus:outline-hidden focus:ring-1 focus:ring-orange-500" />
            {fSatisfaction === "not_satisfied" && (
              <span className={`text-[10px] font-bold ${wordCount(fRemarks) >= 20 ? "text-emerald-600" : "text-rose-500"}`}>
                {wordCount(fRemarks)}/20 words minimum
              </span>
            )}
          </div>

          {/* Photo upload */}
          <div>
            <span className="text-[10px] font-black text-slate-600 uppercase tracking-wider block mb-2">Classroom Photo Evidence (optional, max 8MB)</span>
            {fPhotoPreview ? (
              <div className="relative inline-block">
                <img src={fPhotoPreview} alt="preview" className="h-28 rounded-xl border border-slate-200 object-cover" />
                <button type="button"
                  onClick={() => { setFPhoto(null); setFPhotoPreview(""); }}
                  className="absolute -top-2 -right-2 h-6 w-6 bg-rose-600 text-white rounded-full text-xs font-black cursor-pointer shadow-md">
                  ×
                </button>
              </div>
            ) : (
              <label className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-50 border-2 border-dashed border-slate-300 rounded-xl text-xs font-bold text-slate-500 hover:border-orange-400 hover:text-orange-600 transition-all cursor-pointer">
                <ImageIcon className="h-4 w-4" />
                Choose photo
                <input type="file" accept="image/*" className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0] || null;
                    setFPhoto(f);
                    if (f) setFPhotoPreview(URL.createObjectURL(f));
                  }} />
              </label>
            )}
          </div>

          <div className="flex justify-end pt-1">
            <button type="button" onClick={handleSubmit} disabled={saving}
              className="px-5 py-2.5 bg-orange-600 hover:bg-orange-700 disabled:opacity-60 text-white text-xs font-extrabold rounded-xl transition-all cursor-pointer flex items-center gap-2 shadow-xs">
              {saving ? (
                <><RefreshCw className="h-4 w-4 animate-spin" /><span>Saving…</span></>
              ) : (
                <><Check className="h-4 w-4" /><span>Submit Observation</span></>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Gallery */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <span className="text-xs font-black text-slate-800 uppercase tracking-wider">Observation Ledger</span>
          <span className="text-[10px] font-bold text-slate-500">{observations.length} entries</span>
        </div>
        {loading && observations.length === 0 ? (
          <div className="p-10 text-center text-xs font-bold text-slate-400 animate-pulse">Loading observations…</div>
        ) : observations.length === 0 ? (
          <div className="p-10 text-center space-y-1">
            <Camera className="h-8 w-8 text-slate-300 mx-auto" />
            <p className="text-xs text-slate-400 font-bold">No observations logged for this campus yet.</p>
            <p className="text-[10px] text-slate-400 font-medium">Use &quot;Log Observation&quot; to record your first classroom visit.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 max-h-[480px] overflow-y-auto">
            {observations.map((o) => {
              const rating = Number(o.overall_rating) || 0;
              const isNotSat = o.satisfaction_status === "not_satisfied";
              return (
                <button key={o.id || o.created_at} type="button" onClick={() => setDetail(o)}
                  className="w-full p-4 flex items-center justify-between hover:bg-slate-50/60 transition-colors text-left cursor-pointer">
                  <div className="flex items-center gap-3 min-w-0">
                    {o.photo_url ? (
                      <img src={o.photo_url} alt="" className="h-11 w-11 rounded-lg object-cover border border-slate-200 shrink-0" />
                    ) : (
                      <div className="h-11 w-11 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
                        <Camera className="h-4 w-4 text-slate-400" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="font-bold text-slate-900 text-xs truncate">{o.mentor_name || o.teacher_name || "Unknown mentor"}</div>
                      <div className="text-[10px] text-slate-400 font-medium truncate">
                        {o.department || o.class_name || "—"} · {o.observation_date ? new Date(o.observation_date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : ""}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase border ${
                      isNotSat ? "bg-rose-50 text-rose-700 border-rose-200" : "bg-emerald-50 text-emerald-700 border-emerald-200"
                    }`}>
                      {isNotSat ? "Not Satisfied" : "Satisfied"}
                    </span>
                    <span className={`text-sm font-black ${rating >= 4 ? "text-emerald-600" : rating >= 3 ? "text-amber-500" : "text-rose-500"}`}>
                      {rating || "—"}/5
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
        {/* Detail modal */}
        {detail && (
          <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setDetail(null)}>
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full max-h-[85vh] overflow-y-auto p-6 space-y-4"
              onClick={(e) => e.stopPropagation()}>
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    Classroom Observation · {detail.mentor_name || detail.teacher_name || "Unknown"}
                  </h3>
                  <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                    {detail.department || detail.class_name || "—"} · {detail.observation_date ? new Date(detail.observation_date).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }) : ""}
                  </p>
                </div>
                <button type="button" onClick={() => setDetail(null)} className="text-slate-400 hover:text-slate-700 text-xl font-black cursor-pointer">×</button>
              </div>

              {detail.photo_url && (
                <img src={detail.photo_url} alt="observation" className="w-full rounded-xl border border-slate-200 object-cover max-h-64" />
              )}

              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-[9px] font-black uppercase text-slate-400 block">Subject</span>
                  <span className="font-bold text-slate-700">{detail.subject || detail.course_name || "—"}</span>
                </div>
                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-[9px] font-black uppercase text-slate-400 block">Overall Rating</span>
                  <span className="font-black text-slate-800">{detail.overall_rating || "—"}/5</span>
                </div>
              </div>

              <div>
                <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block mb-2">Dimension Ratings</span>
                <div className="grid grid-cols-1 gap-1.5">
                  {OBS_RATING_DIMS.map(d => {
                    const v = detail[d.key];
                    if (v == null) return null;
                    return (
                      <div key={d.key} className="flex items-center gap-2">
                        <span className="text-[10.5px] font-bold text-slate-600 w-44 shrink-0">{d.label}</span>
                        <div className="flex-1 bg-slate-100 h-1.5 rounded-full overflow-hidden">
                          <div className="bg-indigo-500 h-full rounded-full" style={{ width: `${(Number(v) / 5) * 100}%` }} />
                        </div>
                        <span className="text-[10px] font-black text-slate-600">{v}/5</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {detail.satisfaction_remarks && (
                <div className={`p-3 rounded-xl border text-[11px] font-medium ${
                  detail.satisfaction_status === "not_satisfied"
                    ? "bg-rose-50 border-rose-200 text-rose-800"
                    : "bg-emerald-50 border-emerald-200 text-emerald-800"
                }`}>
                  <span className="block text-[9px] font-black uppercase tracking-wider mb-1">
                    Remarks · {detail.satisfaction_status === "not_satisfied" ? "Not Satisfied (Escalated)" : "Satisfied"}
                  </span>
                  {detail.satisfaction_remarks}
                </div>
              )}

              {detail.manager_name && (
                <p className="text-[10px] text-slate-400 font-medium">Logged by {detail.manager_name}</p>
              )}
            </div>
          </div>
        )}
    </div>
  );
};

// ============================================================================
// 3. MAIN COMPONENT
// ============================================================================
export const CampusAuditManager: React.FC<CampusAuditManagerProps> = ({
  collegeId,
  collegeName = "SDNB Vaishnav College for Women",
  role = "cam",
  userName = "Campus Manager"
}) => {
  const { toast } = useToast();

  // Resolved KAM cluster for active campus
  const activeKamInfo = useMemo(() => resolveKAMForCampus(collegeName), [collegeName]);

  // Main navigation tabs inside the module - STRICTLY ASSIGNED AUDITS & RECORD AUDIT
  const [activeSubTab, setActiveSubTab] = useState<"assigned" | "record">("assigned");
  const [assignedStatusFilter, setAssignedStatusFilter] = useState<"pending" | "completed">("pending");
  const [auditSubmittedSuccess, setAuditSubmittedSuccess] = useState(false);

  // Data states
  const [skillRecords, setSkillRecords] = useState<SkillAuditRecord[]>(INITIAL_SKILL_RECORDS);
  const [academicRecords, setAcademicRecords] = useState<AcademicAuditRecord[]>(INITIAL_ACADEMIC_RECORDS);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceAuditRecord[]>(INITIAL_ATTENDANCE_RECORDS);
  const [peerAudits, setPeerAudits] = useState<PeerAuditRecord[]>(INITIAL_PEER_AUDITS);
  const [peerHistory, setPeerHistory] = useState<PeerReviewHistoryRecord[]>(INITIAL_PEER_HISTORY);

  // Load persisted records from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_AUDIT_DATA);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.skill) setSkillRecords(parsed.skill);
        if (parsed.academic) setAcademicRecords(parsed.academic);
        if (parsed.attendance) setAttendanceRecords(parsed.attendance);
        if (parsed.peerAudits) setPeerAudits(parsed.peerAudits);
      }
      const savedHist = localStorage.getItem(STORAGE_KEY_PEER_HISTORY);
      if (savedHist) setPeerHistory(JSON.parse(savedHist));
    } catch (e) {
      console.warn("Could not load stored audit records", e);
    }
  }, []);

  // Save to localStorage whenever records change
  const persistAuditData = (
    skills: SkillAuditRecord[],
    academics: AcademicAuditRecord[],
    attendances: AttendanceAuditRecord[],
    peers: PeerAuditRecord[],
    history: PeerReviewHistoryRecord[]
  ) => {
    try {
      localStorage.setItem(
        STORAGE_KEY_AUDIT_DATA,
        JSON.stringify({ skill: skills, academic: academics, attendance: attendances, peerAudits: peers })
      );
      localStorage.setItem(STORAGE_KEY_PEER_HISTORY, JSON.stringify(history));
    } catch (e) {
      console.warn("Could not persist audit data", e);
    }
  };

  // --------------------------------------------------------------------------
  // INTRA-KAM PEER REVIEW ROTATION ENGINE (With 6-Audit Cooldown & Load Balancing)
  // --------------------------------------------------------------------------
  const getIntraKAMPeerReviewer = (submittedCampus: string) => {
    const kamInfo = resolveKAMForCampus(submittedCampus);
    const cluster = KAM_CLUSTERS[kamInfo.kam];
    const candidateCampuses = cluster.campuses.filter(
      (c) => c.trim().toLowerCase() !== submittedCampus.trim().toLowerCase()
    );

    if (candidateCampuses.length === 0) {
      return { reviewerCampus: submittedCampus, reviewerCM: "Campus Manager", kam: kamInfo.kam, region: kamInfo.region };
    }

    const subNorm = submittedCampus.trim().toLowerCase();
    const relevantHistory = peerHistory.filter((h) => {
      const a = (h.submittedCampus || "").trim().toLowerCase();
      const b = (h.reviewerCampus || "").trim().toLowerCase();
      return (a === subNorm || b === subNorm) && h.kam === kamInfo.kam;
    });

    const recentWindow = relevantHistory.slice(-6);
    const cooldowned = new Set(
      recentWindow.map((h) =>
        (h.submittedCampus || "").trim().toLowerCase() === subNorm ? (h.reviewerCampus || "").trim().toLowerCase() : (h.submittedCampus || "").trim().toLowerCase()
      )
    );

    let eligible = candidateCampuses.filter((c) => !cooldowned.has(c.trim().toLowerCase()));
    if (eligible.length === 0) eligible = candidateCampuses;

    // Load balancing: pick candidate with lowest assignments
    const counts = new Map<string, number>();
    candidateCampuses.forEach((c) => counts.set(c.trim().toLowerCase(), 0));
    peerHistory.slice(-20).forEach((h) => {
      const r = (h.reviewerCampus || "").trim().toLowerCase();
      if (counts.has(r)) counts.set(r, (counts.get(r) || 0) + 1);
    });

    eligible.sort((a, b) => (counts.get(a.trim().toLowerCase()) || 0) - (counts.get(b.trim().toLowerCase()) || 0));

    // Deterministic PRNG pick for stability
    const seed = strSeed(submittedCampus + "|" + peerAudits.length);
    const rng = mulberry32(seed);
    const selectedCampus = eligible[Math.floor(rng() * eligible.length)] || eligible[0];

    return {
      reviewerCampus: selectedCampus,
      reviewerCM: `Campus Manager (${selectedCampus})`,
      kam: kamInfo.kam,
      region: kamInfo.region
    };
  };

  // --------------------------------------------------------------------------
  // RECORD AUDIT WIZARD FORM STATE (4 Stages)
  // --------------------------------------------------------------------------
  const [wizardStage, setWizardStage] = useState<1 | 2 | 3 | 4>(1);

  // Setup / Form fields
  const [wizCampus, setWizCampus] = useState(collegeName);
  const [wizDeptName, setWizDeptName] = useState("B.Sc Computer Science");
  const [wizDepartment, setWizDepartment] = useState("Computer Science");
  const [wizMentor, setWizMentor] = useState("Dr. K. Sangeetha");
  const [wizSubject, setWizSubject] = useState("Full-Stack Web Architecture (React & Node)");
  const [wizDate, setWizDate] = useState(new Date().toISOString().slice(0, 10));

  // Stage 1: Skill criteria
  const [wizSkillGenuine, setWizSkillGenuine] = useState(true);
  const [wizSkillWeeklyPlan, setWizSkillWeeklyPlan] = useState(true);
  const [wizSkillTracker, setWizSkillTracker] = useState(true);
  const [wizSkillAssignment, setWizSkillAssignment] = useState(true);
  const [wizSkillAssessment, setWizSkillAssessment] = useState(true);
  const [wizSkillProofLink, setWizSkillProofLink] = useState("https://github.com/campus-submissions/skill-tasks");
  const [wizSkillAssigned, setWizSkillAssigned] = useState<number>(10);
  const [wizSkillCompleted, setWizSkillCompleted] = useState<number>(9);
  const [wizSkillRemarks, setWizSkillRemarks] = useState("Weekly code exercises and lab logs verified against git commits.");

  // Stage 2: Coursework criteria
  const [wizAcadAssignment, setWizAcadAssignment] = useState(true);
  const [wizAcadAssessment, setWizAcadAssessment] = useState(true);
  const [wizAcadBeforeDeadline, setWizAcadBeforeDeadline] = useState(true);
  const [wizAcadStudyMaterial, setWizAcadStudyMaterial] = useState(true);
  const [wizAcadRemarks, setWizAcadRemarks] = useState("Unit 3 & Unit 4 lecture demonstrations completed with question banks.");

  // Stage 3: Attendance criteria
  const [wizAttMarkedDaily, setWizAttMarkedDaily] = useState(true);
  const [wizAttCrossVerified, setWizAttCrossVerified] = useState(true);
  const [wizAttNoProxy, setWizAttNoProxy] = useState(true);
  const [wizAttMatchesTracker, setWizAttMatchesTracker] = useState(true);
  const [wizAttBelow75, setWizAttBelow75] = useState<number>(2);
  const [wizAttRemarks, setWizAttRemarks] = useState("Biometric logs cross-verified with mentor timetable slot attendance.");

  // Sync wizCampus when collegeName prop updates
  useEffect(() => {
    if (collegeName) setWizCampus(collegeName);
  }, [collegeName]);

  // Calculate scores
  const calculatedSkillScore = useMemo(() => {
    const checks = [wizSkillGenuine, wizSkillWeeklyPlan, wizSkillTracker, wizSkillAssignment, wizSkillAssessment];
    const met = checks.filter(Boolean).length;
    return Math.round((met / checks.length) * 100);
  }, [wizSkillGenuine, wizSkillWeeklyPlan, wizSkillTracker, wizSkillAssignment, wizSkillAssessment]);

  const calculatedAcadScore = useMemo(() => {
    const checks = [wizAcadAssignment, wizAcadAssessment, wizAcadBeforeDeadline, wizAcadStudyMaterial];
    const met = checks.filter(Boolean).length;
    return Math.round((met / checks.length) * 100);
  }, [wizAcadAssignment, wizAcadAssessment, wizAcadBeforeDeadline, wizAcadStudyMaterial]);

  const calculatedAttScore = useMemo(() => {
    const checks = [wizAttMarkedDaily, wizAttCrossVerified, wizAttNoProxy, wizAttMatchesTracker];
    const met = checks.filter(Boolean).length;
    return Math.round((met / checks.length) * 100);
  }, [wizAttMarkedDaily, wizAttCrossVerified, wizAttNoProxy, wizAttMatchesTracker]);

  // Submit complete 4-stage audit
  const handleCompleteWizard = () => {
    if (!wizMentor.trim()) {
      toast("Please enter the mentor's name before submitting.", "warning");
      return;
    }

    const timestamp = new Date().toISOString().slice(0, 10);
    const nextNum = peerAudits.length + 1;
    const auditId = `AUD-2026-${String(80 + nextNum).padStart(3, "0")}`;

    // 1. Skill record
    const newSkill: SkillAuditRecord = {
      uid: `sk_${Date.now()}`,
      id: `LOG-SK-${800 + nextNum}`,
      mentor: wizMentor,
      campus: wizCampus,
      deptName: wizDeptName,
      department: wizDepartment,
      subject: wizSubject,
      criteria: {
        genuine: wizSkillGenuine,
        weeklyPlan: wizSkillWeeklyPlan,
        tracker: wizSkillTracker,
        assignment: wizSkillAssignment,
        assessment: wizSkillAssessment
      },
      proof: {
        assignment: { link: wizSkillProofLink }
      },
      score: calculatedSkillScore,
      tasksAssigned: wizSkillAssigned,
      tasksCompleted: wizSkillCompleted,
      avgCompletionPct: wizSkillAssigned > 0 ? Math.round((wizSkillCompleted / wizSkillAssigned) * 100) : 0,
      remarks: wizSkillRemarks,
      date: timestamp,
      status: calculatedSkillScore >= 80 ? "Completed" : "In Progress"
    };

    // 2. Academic record
    const newAcad: AcademicAuditRecord = {
      uid: `ac_${Date.now()}`,
      id: `TSK-AC-${400 + nextNum}`,
      mentor: wizMentor,
      campus: wizCampus,
      deptName: wizDeptName,
      department: wizDepartment,
      subject: wizSubject,
      criteria: {
        assignmentGenuine: wizAcadAssignment,
        assessmentGenuine: wizAcadAssessment,
        beforeDeadline: wizAcadBeforeDeadline,
        studyMaterial: wizAcadStudyMaterial
      },
      score: calculatedAcadScore,
      remarks: wizAcadRemarks,
      date: timestamp,
      status: calculatedAcadScore >= 80 ? "Completed" : "In Progress"
    };

    // 3. Attendance record
    const newAtt: AttendanceAuditRecord = {
      uid: `at_${Date.now()}`,
      id: `ATT-VER-${300 + nextNum}`,
      mentor: wizMentor,
      campus: wizCampus,
      deptName: wizDeptName,
      department: wizDepartment,
      below75: wizAttBelow75,
      criteria: {
        markedDaily: wizAttMarkedDaily,
        crossVerified: wizAttCrossVerified,
        noProxy: wizAttNoProxy,
        matchesTracker: wizAttMatchesTracker
      },
      score: calculatedAttScore,
      remarks: wizAttRemarks,
      date: timestamp,
      status: calculatedAttScore >= 80 ? "Completed" : "In Progress"
    };

    // 4. Intra-KAM Peer assignment
    const peerAssignment = getIntraKAMPeerReviewer(wizCampus);

    const newPeerAudit: PeerAuditRecord = {
      uid: `aud_${Date.now()}`,
      id: auditId,
      campus: wizCampus,
      mentor: wizMentor,
      deptName: wizDeptName,
      department: wizDepartment,
      kam: peerAssignment.kam,
      region: peerAssignment.region,
      reviewerCampus: peerAssignment.reviewerCampus,
      reviewerCM: peerAssignment.reviewerCM,
      weeklyPlan: "Completed",
      skillDev: calculatedSkillScore >= 80 ? "Completed" : "In Progress",
      academic: calculatedAcadScore >= 80 ? "Completed" : "In Progress",
      overall: "In Progress",
      auditor: `${userName} (${wizCampus})`,
      date: timestamp,
      auditorNotes: `Audit recorded by ${wizCampus}. Routed to ${peerAssignment.reviewerCampus} under Intra-KAM ${peerAssignment.kam} cluster for peer sign-off.`,
      evidenceSnapshot: {
        skillScore: calculatedSkillScore,
        academicScore: calculatedAcadScore,
        attendanceScore: calculatedAttScore,
        proofLink: wizSkillProofLink,
        remarks: wizSkillRemarks
      }
    };

    const newHistItem: PeerReviewHistoryRecord = {
      pairKey: `${wizCampus.toLowerCase()}<->${peerAssignment.reviewerCampus.toLowerCase()}`,
      submittedCampus: wizCampus,
      submittedCM: userName,
      reviewerCampus: peerAssignment.reviewerCampus,
      reviewerCM: peerAssignment.reviewerCM,
      kam: peerAssignment.kam,
      region: peerAssignment.region,
      monthKey: timestamp.slice(0, 7),
      createdAt: new Date().toISOString()
    };

    const updatedSkills = [newSkill, ...skillRecords];
    const updatedAcads = [newAcad, ...academicRecords];
    const updatedAtts = [newAtt, ...attendanceRecords];
    const updatedPeers = [newPeerAudit, ...peerAudits];
    const updatedHist = [newHistItem, ...peerHistory];

    setSkillRecords(updatedSkills);
    setAcademicRecords(updatedAcads);
    setAttendanceRecords(updatedAtts);
    setPeerAudits(updatedPeers);
    setPeerHistory(updatedHist);

    persistAuditData(updatedSkills, updatedAcads, updatedAtts, updatedPeers, updatedHist);

    toast(
      `Audit recorded successfully! Routed to ${peerAssignment.reviewerCampus} for peer review under ${peerAssignment.kam} cluster.`,
      "success"
    );

    // Reset wizard and show success state
    setWizardStage(1);
    setAuditSubmittedSuccess(true);
    setActiveSubTab("record");
  };

  // --------------------------------------------------------------------------
  // PEER REVIEW SIGN-OFF HANDLER (For audits assigned to this CM)
  // --------------------------------------------------------------------------
  const [selectedPeerAuditForReview, setSelectedPeerAuditForReview] = useState<PeerAuditRecord | null>(null);
  const [signOffNotes, setSignOffNotes] = useState("");
  const [signOffWeeklyPlan, setSignOffWeeklyPlan] = useState<"Completed" | "In Progress" | "Not Completed">("Completed");
  const [signOffSkillDev, setSignOffSkillDev] = useState<"Completed" | "In Progress" | "Not Completed">("Completed");
  const [signOffAcademic, setSignOffAcademic] = useState<"Completed" | "In Progress" | "Not Completed">("Completed");

  // Active campus normalized
  const cNorm = (collegeName || "").trim().toLowerCase();

  // Incoming peer reviews assigned to this campus (Pending sign-off)
  const incomingPeerReviews = useMemo(() => {
    return peerAudits.filter(
      (a) =>
        (a.reviewerCampus.trim().toLowerCase() === cNorm || cNorm.includes(a.reviewerCampus.trim().toLowerCase())) &&
        a.overall !== "Completed"
    );
  }, [peerAudits, cNorm]);

  // Completed peer reviews assigned to this campus (Already signed off)
  const completedPeerReviews = useMemo(() => {
    return peerAudits.filter(
      (a) =>
        (a.reviewerCampus.trim().toLowerCase() === cNorm || cNorm.includes(a.reviewerCampus.trim().toLowerCase())) &&
        a.overall === "Completed"
    );
  }, [peerAudits, cNorm]);

  const handleSignOffPeerReview = () => {
    if (!selectedPeerAuditForReview) return;
    if (role === "kam") {
      toast("Policy Notice: Senior Managers (KAMs) cannot sign off on peer reviews. Peer sign-offs must be conducted by Campus Managers.", "error");
      return;
    }
    if (!signOffNotes.trim()) {
      toast("Please provide reviewer inspection notes before signing off.", "warning");
      return;
    }

    const updatedPeers = peerAudits.map((a) => {
      if (a.uid === selectedPeerAuditForReview.uid) {
        return {
          ...a,
          weeklyPlan: signOffWeeklyPlan,
          skillDev: signOffSkillDev,
          academic: signOffAcademic,
          overall: "Completed" as const,
          auditorNotes: `${signOffNotes} (Signed off by ${userName} from ${collegeName})`
        };
      }
      return a;
    });

    setPeerAudits(updatedPeers);
    persistAuditData(skillRecords, academicRecords, attendanceRecords, updatedPeers, peerHistory);

    toast(`Official Peer Review signed off for ${selectedPeerAuditForReview.campus}! Record published as Completed.`, "success");
    setSelectedPeerAuditForReview(null);
    setSignOffNotes("");
  };


  return (
    <div className="space-y-6 font-sans">
      {/* ==================================================================== */}
      {/* 1. TOP HEADER & STREAMLINED 2-TAB NAVIGATION                        */}
      {/* ==================================================================== */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-150 pb-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-600 flex items-center justify-center text-white shadow-xs">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider">
                  Campus E-Audit
                </h2>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[10px] font-black uppercase flex items-center gap-1">
                  <Building2 className="h-3 w-3 text-emerald-600" />
                  <span>{collegeName}</span>
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-[10px] font-extrabold flex items-center gap-1">
                  <span>{activeKamInfo.region} Cluster</span>
                  <span className="text-indigo-400">•</span>
                  <span>KAM: {activeKamInfo.kam}</span>
                </span>
              </div>
              <p className="text-[11.5px] text-slate-500 font-medium mt-0.5">
                Record operational mentor audits and review incoming peer audits assigned to your campus.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setWizardStage(1);
                setAuditSubmittedSuccess(false);
                setActiveSubTab("record");
              }}
              className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center gap-1.5 shadow-xs ${
                activeSubTab === "record"
                  ? "bg-emerald-600 text-white"
                  : "bg-slate-100 hover:bg-slate-200 text-slate-700"
              }`}
            >
              <Send className="h-3.5 w-3.5" />
              <span>+ Record New Audit</span>
            </button>
          </div>
        </div>

        {/* Focused 2-Tab Navigation */}
        <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
          <button
            type="button"
            onClick={() => setActiveSubTab("assigned")}
            className={`px-4 py-2 text-xs font-black rounded-xl transition-all cursor-pointer flex items-center gap-2 ${
              activeSubTab === "assigned"
                ? "bg-emerald-600 text-white shadow-xs"
                : "bg-slate-100 hover:bg-slate-200 text-slate-600"
            }`}
          >
            <Inbox className="h-4 w-4" />
            <span>Assigned Audits</span>
            {incomingPeerReviews.length > 0 && (
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                activeSubTab === "assigned" ? "bg-white text-emerald-800" : "bg-amber-500 text-white animate-pulse"
              }`}>
                {incomingPeerReviews.length} Pending
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveSubTab("record");
              setAuditSubmittedSuccess(false);
            }}
            className={`px-4 py-2 text-xs font-black rounded-xl transition-all cursor-pointer flex items-center gap-2 ${
              activeSubTab === "record"
                ? "bg-emerald-600 text-white shadow-xs"
                : "bg-slate-100 hover:bg-slate-200 text-slate-600"
            }`}
          >
            <Send className="h-4 w-4" />
            <span>Record Audit Form</span>
          </button>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* VIEW 1: ASSIGNED AUDITS (INBOX & SIGN-OFF)                           */}
      {/* ==================================================================== */}
      {activeSubTab === "assigned" && (
        <div className="space-y-4">
          {/* Header & Sub-filter pills */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Inbox className="h-4 w-4 text-emerald-600" />
              <span className="text-xs font-black text-slate-800 uppercase tracking-wider">
                Audits Assigned to {collegeName}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setAssignedStatusFilter("pending")}
                className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                  assignedStatusFilter === "pending"
                    ? "bg-amber-100 text-amber-900 border border-amber-300 shadow-2xs"
                    : "bg-slate-100 hover:bg-slate-200 text-slate-600"
                }`}
              >
                <span>Pending Sign-Off ({incomingPeerReviews.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setAssignedStatusFilter("completed")}
                className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                  assignedStatusFilter === "completed"
                    ? "bg-emerald-100 text-emerald-900 border border-emerald-300 shadow-2xs"
                    : "bg-slate-100 hover:bg-slate-200 text-slate-600"
                }`}
              >
                <span>Signed-Off / Completed ({completedPeerReviews.length})</span>
              </button>
            </div>
          </div>

          {/* Pending Sign-Off List */}
          {assignedStatusFilter === "pending" && (
            <div>
              {incomingPeerReviews.length === 0 ? (
                <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center shadow-xs space-y-3">
                  <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto" />
                  <h4 className="text-sm font-extrabold text-slate-800">Your Assigned Audits Queue is Clear</h4>
                  <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
                    No incoming audits currently pending your sign-off. When peer colleges in your {activeKamInfo.region} cluster submit mentor audits for review, they will appear here automatically.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveSubTab("record");
                      setAuditSubmittedSuccess(false);
                    }}
                    className="mt-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl transition-all cursor-pointer inline-flex items-center gap-1.5 shadow-xs"
                  >
                    <Send className="h-3.5 w-3.5" />
                    <span>Record an Audit for Your Campus &rarr;</span>
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {incomingPeerReviews.map((audit) => (
                    <div key={audit.uid} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
                      <div className="flex items-center justify-between border-b border-slate-150 pb-3">
                        <div>
                          <span className="font-mono text-[10px] text-slate-400 font-bold block">{audit.id}</span>
                          <div className="font-extrabold text-slate-900 text-sm mt-0.5">{audit.mentor}</div>
                          <div className="text-xs text-indigo-700 font-bold flex items-center gap-1 mt-0.5">
                            <Building2 className="h-3 w-3" />
                            <span>{audit.campus}</span>
                            <span>•</span>
                            <span className="text-slate-500">{audit.deptName}</span>
                          </div>
                        </div>
                        <span className="px-2.5 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-[10px] font-black uppercase">
                          Pending Sign-Off
                        </span>
                      </div>

                      {/* Evidence Snapshot Card */}
                      <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 block">Submitted Evidence Snapshot</span>
                        <div className="grid grid-cols-3 gap-2 text-center">
                          <div className="p-2 bg-white rounded-lg border border-slate-200">
                            <span className="text-[9px] text-slate-400 block font-bold">Skill Score</span>
                            <span className="font-mono font-black text-xs text-indigo-600">{audit.evidenceSnapshot?.skillScore || 90}%</span>
                          </div>
                          <div className="p-2 bg-white rounded-lg border border-slate-200">
                            <span className="text-[9px] text-slate-400 block font-bold">Coursework</span>
                            <span className="font-mono font-black text-xs text-teal-600">{audit.evidenceSnapshot?.academicScore || 100}%</span>
                          </div>
                          <div className="p-2 bg-white rounded-lg border border-slate-200">
                            <span className="text-[9px] text-slate-400 block font-bold">Attendance</span>
                            <span className="font-mono font-black text-xs text-purple-600">{audit.evidenceSnapshot?.attendanceScore || 100}%</span>
                          </div>
                        </div>

                        {audit.evidenceSnapshot?.proofLink && (
                          <div className="pt-1">
                            <a
                              href={audit.evidenceSnapshot.proofLink}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs text-indigo-600 font-bold underline inline-flex items-center gap-1 hover:text-indigo-800 transition-colors"
                            >
                              <span>Inspect Student Code / Task Proof Repository</span>
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          </div>
                        )}

                        {audit.evidenceSnapshot?.remarks && (
                          <p className="text-[11px] text-slate-600 italic bg-white p-2 rounded-lg border border-slate-150">
                            &ldquo;{audit.evidenceSnapshot.remarks}&rdquo;
                          </p>
                        )}
                      </div>

                      {/* Reviewer inspection form */}
                      <div className="space-y-3 pt-1">
                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 mb-1">
                            Reviewer Sign-Off Inspection Notes *
                          </label>
                          <textarea
                            rows={2}
                            value={selectedPeerAuditForReview?.uid === audit.uid ? signOffNotes : ""}
                            onChange={(e) => {
                              setSelectedPeerAuditForReview(audit);
                              setSignOffNotes(e.target.value);
                            }}
                            placeholder="Enter verification findings and sign-off remarks..."
                            className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
                          />
                        </div>

                        <div className="flex items-center justify-end">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedPeerAuditForReview(audit);
                              handleSignOffPeerReview();
                            }}
                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-xs"
                          >
                            <Check className="h-4 w-4" />
                            <span>Sign Off Peer Review</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Completed Sign-Offs List */}
          {assignedStatusFilter === "completed" && (
            <div>
              {completedPeerReviews.length === 0 ? (
                <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center shadow-xs space-y-2">
                  <p className="text-xs text-slate-400 font-medium">No completed peer reviews signed off yet.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {completedPeerReviews.map((audit) => (
                    <div key={audit.uid} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-3">
                      <div className="flex items-center justify-between border-b border-slate-150 pb-3">
                        <div>
                          <span className="font-mono text-[10px] text-slate-400 font-bold block">{audit.id}</span>
                          <div className="font-extrabold text-slate-900 text-sm mt-0.5">{audit.mentor}</div>
                          <div className="text-xs text-indigo-700 font-bold flex items-center gap-1 mt-0.5">
                            <Building2 className="h-3 w-3" />
                            <span>{audit.campus}</span>
                            <span>•</span>
                            <span className="text-slate-500">{audit.deptName}</span>
                          </div>
                        </div>
                        <span className="px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[10px] font-black uppercase flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                          <span>Signed Off</span>
                        </span>
                      </div>

                      <div className="p-3 bg-emerald-50/50 border border-emerald-100 rounded-xl space-y-1">
                        <span className="text-[10px] font-black uppercase text-emerald-800 block">Sign-Off Notes</span>
                        <p className="text-xs text-emerald-950 font-medium">{audit.auditorNotes || "Peer audit verified and approved."}</p>
                        <span className="text-[10px] text-slate-400 block mt-1">Audit Date: {audit.date}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ==================================================================== */}
      {/* VIEW 2: 4-STAGE RECORD AUDIT WIZARD                                 */}
      {/* ==================================================================== */}
      {activeSubTab === "record" && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-6 max-w-3xl mx-auto">
          {/* Audit Submitted Success Banner */}
          {auditSubmittedSuccess && (
            <div className="p-5 bg-emerald-50 border-2 border-emerald-200 rounded-2xl space-y-3 animate-in fade-in duration-200">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-8 w-8 text-emerald-600 shrink-0" />
                <div>
                  <h4 className="text-sm font-black text-emerald-900">Audit Recorded &amp; Dispatched Successfully!</h4>
                  <p className="text-xs text-emerald-700 font-medium mt-0.5">
                    Your mentor audit has been saved to the ledger and automatically routed to an intra-KAM peer campus for verification.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 pt-2 border-t border-emerald-200">
                <button
                  type="button"
                  onClick={() => {
                    setAuditSubmittedSuccess(false);
                    setWizardStage(1);
                  }}
                  className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black cursor-pointer shadow-xs transition-colors"
                >
                  + Record Another Mentor Audit
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAuditSubmittedSuccess(false);
                    setActiveSubTab("assigned");
                  }}
                  className="px-3.5 py-1.5 rounded-xl bg-white border border-emerald-300 text-emerald-800 hover:bg-emerald-100 text-xs font-bold cursor-pointer transition-colors"
                >
                  Go to Assigned Audits
                </button>
              </div>
            </div>
          )}

          {/* Wizard Step Progress Tracker */}
          <div className="border-b border-slate-150 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">
                  Campus E-Audit Recording Wizard
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Step {wizardStage} of 4:{" "}
                  {wizardStage === 1
                    ? "Audit Setup & Scope"
                    : wizardStage === 2
                    ? "Skill Development Verification"
                    : wizardStage === 3
                    ? "Coursework Delivery Verification"
                    : "Attendance Integrity & Peer Routing"}
                </p>
              </div>
              <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 text-xs font-black">
                {wizardStage === 1 ? "25%" : wizardStage === 2 ? "50%" : wizardStage === 3 ? "75%" : "100%"} Complete
              </span>
            </div>

            <div className="grid grid-cols-4 gap-2 mt-4">
              {[1, 2, 3, 4].map((step) => (
                <div
                  key={step}
                  className={`h-1.5 rounded-full transition-all ${
                    step <= wizardStage ? "bg-emerald-600" : "bg-slate-100"
                  }`}
                />
              ))}
            </div>
          </div>

          {/* STAGE 1: SETUP */}
          {wizardStage === 1 && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Audited Campus</label>
                  <input
                    type="text"
                    disabled
                    value={wizCampus}
                    className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 cursor-not-allowed"
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block">Locked to your active campus assignment.</span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Mentor Name *</label>
                  <input
                    type="text"
                    value={wizMentor}
                    onChange={(e) => setWizMentor(e.target.value)}
                    placeholder="e.g. Dr. K. Sangeetha"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Department / Course *</label>
                  <input
                    type="text"
                    value={wizDeptName}
                    onChange={(e) => setWizDeptName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Skill / Academic Subject *</label>
                  <input
                    type="text"
                    value={wizSubject}
                    onChange={(e) => setWizSubject(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Audit Conducted Date</label>
                  <input
                    type="date"
                    value={wizDate}
                    onChange={(e) => setWizDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                  />
                </div>
              </div>

              <div className="pt-4 flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    if (!wizMentor.trim()) {
                      toast("Please enter the mentor's name.", "warning");
                      return;
                    }
                    setWizardStage(2);
                  }}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-xs"
                >
                  <span>Continue to Skill Verification</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {/* STAGE 2: SKILL QUALITY VERIFICATION */}
          {wizardStage === 2 && (
            <div className="space-y-4">
              <div className="bg-indigo-50/60 border border-indigo-100 rounded-xl p-3 flex items-center justify-between">
                <div>
                  <span className="text-xs font-extrabold text-indigo-900 block">Stage 2: Skill Development Quality Check</span>
                  <span className="text-[10px] text-indigo-700">Calculated Score: {calculatedSkillScore}%</span>
                </div>
                <Award className="h-5 w-5 text-indigo-600" />
              </div>

              <div className="space-y-2 border border-slate-200 rounded-xl p-4">
                {[
                  { label: "Are daily student task tracker marks genuine (no arbitrary marks)?", val: wizSkillGenuine, set: setWizSkillGenuine },
                  { label: "Has the weekly syllabus / skill plan been prepared and adhered to?", val: wizSkillWeeklyPlan, set: setWizSkillWeeklyPlan },
                  { label: "Is the daily student tracker updated up to the current session?", val: wizSkillTracker, set: setWizSkillTracker },
                  { label: "Have coding tasks / practical exercises been assigned to learners?", val: wizSkillAssignment, set: setWizSkillAssignment },
                  { label: "Has hands-on lab assessment been completed with proof recorded?", val: wizSkillAssessment, set: setWizSkillAssessment }
                ].map((item, i) => (
                  <div key={i} className="flex items-center justify-between p-2.5 rounded-lg hover:bg-slate-50 border border-slate-100">
                    <span className="text-xs font-medium text-slate-800 pr-4">{item.label}</span>
                    <button
                      type="button"
                      onClick={() => item.set(!item.val)}
                      className={`px-3 py-1 text-xs font-extrabold rounded-lg transition-all cursor-pointer ${
                        item.val ? "bg-emerald-600 text-white" : "bg-rose-100 text-rose-700"
                      }`}
                    >
                      {item.val ? "✓ Yes" : "✕ No"}
                    </button>
                  </div>
                ))}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Student Work / GitHub Proof Link</label>
                <input
                  type="url"
                  value={wizSkillProofLink}
                  onChange={(e) => setWizSkillProofLink(e.target.value)}
                  placeholder="https://github.com/... or Google Drive folder"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Tasks Assigned</label>
                  <input
                    type="number"
                    value={wizSkillAssigned}
                    onChange={(e) => setWizSkillAssigned(parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Tasks Completed</label>
                  <input
                    type="number"
                    value={wizSkillCompleted}
                    onChange={(e) => setWizSkillCompleted(parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                  />
                </div>
              </div>

              <div className="pt-4 flex justify-between">
                <button
                  type="button"
                  onClick={() => setWizardStage(1)}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl transition-all cursor-pointer"
                >
                  &larr; Back
                </button>
                <button
                  type="button"
                  onClick={() => setWizardStage(3)}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-xs"
                >
                  <span>Continue to Coursework</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {/* STAGE 3: COURSEWORK DELIVERY VERIFICATION */}
          {wizardStage === 3 && (
            <div className="space-y-4">
              <div className="bg-teal-50/60 border border-teal-100 rounded-xl p-3 flex items-center justify-between">
                <div>
                  <span className="text-xs font-extrabold text-teal-900 block">Stage 3: Academic Coursework Verification</span>
                  <span className="text-[10px] text-teal-700">Calculated Score: {calculatedAcadScore}%</span>
                </div>
                <BookOpen className="h-5 w-5 text-teal-600" />
              </div>

              <div className="space-y-2 border border-slate-200 rounded-xl p-4">
                {[
                  { label: "Was the coursework assignment genuinely completed by learners?", val: wizAcadAssignment, set: setWizAcadAssignment },
                  { label: "Were tests/quizzes conducted without proxy or question leaks?", val: wizAcadAssessment, set: setWizAcadAssessment },
                  { label: "Was syllabus coverage submitted on or before the planned deadline?", val: wizAcadBeforeDeadline, set: setWizAcadBeforeDeadline },
                  { label: "Were study materials & slides provided on LMS for this module?", val: wizAcadStudyMaterial, set: setWizAcadStudyMaterial }
                ].map((item, i) => (
                  <div key={i} className="flex items-center justify-between p-2.5 rounded-lg hover:bg-slate-50 border border-slate-100">
                    <span className="text-xs font-medium text-slate-800 pr-4">{item.label}</span>
                    <button
                      type="button"
                      onClick={() => item.set(!item.val)}
                      className={`px-3 py-1 text-xs font-extrabold rounded-lg transition-all cursor-pointer ${
                        item.val ? "bg-emerald-600 text-white" : "bg-rose-100 text-rose-700"
                      }`}
                    >
                      {item.val ? "✓ Yes" : "✕ No"}
                    </button>
                  </div>
                ))}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Coursework Auditor Notes</label>
                <textarea
                  rows={2}
                  value={wizAcadRemarks}
                  onChange={(e) => setWizAcadRemarks(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div className="pt-4 flex justify-between">
                <button
                  type="button"
                  onClick={() => setWizardStage(2)}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl transition-all cursor-pointer"
                >
                  &larr; Back
                </button>
                <button
                  type="button"
                  onClick={() => setWizardStage(4)}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-xs"
                >
                  <span>Continue to Attendance &amp; Peer Routing</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {/* STAGE 4: ATTENDANCE & AUTOMATED INTRA-KAM PEER ROUTING */}
          {wizardStage === 4 && (
            <div className="space-y-4">
              <div className="bg-purple-50/60 border border-purple-100 rounded-xl p-3 flex items-center justify-between">
                <div>
                  <span className="text-xs font-extrabold text-purple-900 block">Stage 4: Attendance &amp; Peer Routing</span>
                  <span className="text-[10px] text-purple-700">Attendance Score: {calculatedAttScore}%</span>
                </div>
                <Clock className="h-5 w-5 text-purple-600" />
              </div>

              <div className="space-y-2 border border-slate-200 rounded-xl p-4">
                {[
                  { label: "Was attendance marked daily by mentor, not bulk-backdated?", val: wizAttMarkedDaily, set: setWizAttMarkedDaily },
                  { label: "Was attendance cross-verified with class biometric machine logs?", val: wizAttCrossVerified, set: setWizAttCrossVerified },
                  { label: "Are there zero detected proxy attendances?", val: wizAttNoProxy, set: setWizAttNoProxy },
                  { label: "Does attendance % match daily tracker reports?", val: wizAttMatchesTracker, set: setWizAttMatchesTracker }
                ].map((item, i) => (
                  <div key={i} className="flex items-center justify-between p-2.5 rounded-lg hover:bg-slate-50 border border-slate-100">
                    <span className="text-xs font-medium text-slate-800 pr-4">{item.label}</span>
                    <button
                      type="button"
                      onClick={() => item.set(!item.val)}
                      className={`px-3 py-1 text-xs font-extrabold rounded-lg transition-all cursor-pointer ${
                        item.val ? "bg-emerald-600 text-white" : "bg-rose-100 text-rose-700"
                      }`}
                    >
                      {item.val ? "✓ Yes" : "✕ No"}
                    </button>
                  </div>
                ))}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Count of Students Below 75% Attendance Threshold
                </label>
                <input
                  type="number"
                  value={wizAttBelow75}
                  onChange={(e) => setWizAttBelow75(parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                />
              </div>

              {/* Automated Intra-KAM Peer Matching Preview Box */}
              {(() => {
                const preview = getIntraKAMPeerReviewer(wizCampus);
                return (
                  <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200 space-y-2">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-emerald-700" />
                      <span className="text-xs font-black text-emerald-900 uppercase tracking-wider">
                        Automated Intra-KAM Peer Match Ready
                      </span>
                    </div>
                    <p className="text-xs text-emerald-800">
                      As soon as you submit, this audit will be automatically assigned to:
                    </p>
                    <div className="flex items-center gap-2 bg-white/80 p-2.5 rounded-lg border border-emerald-200 text-xs font-bold text-emerald-900">
                      <Building2 className="h-4 w-4 text-emerald-600" />
                      <span>{preview.reviewerCampus}</span>
                      <span className="text-emerald-400">•</span>
                      <span className="text-emerald-700">{preview.kam} Cluster ({preview.region})</span>
                    </div>
                    <span className="text-[10px] text-emerald-700 font-medium block">
                      Enforces 6-audit pairing cooldown and queue load balancing with zero self-audits.
                    </span>
                  </div>
                );
              })()}

              <div className="pt-4 flex justify-between">
                <button
                  type="button"
                  onClick={() => setWizardStage(3)}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl transition-all cursor-pointer"
                >
                  &larr; Back
                </button>
                <button
                  type="button"
                  onClick={handleCompleteWizard}
                  className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold rounded-xl transition-all cursor-pointer flex items-center gap-2 shadow-xs"
                >
                  <Send className="h-4 w-4" />
                  <span>Submit Audit &amp; Dispatch to Peer</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
