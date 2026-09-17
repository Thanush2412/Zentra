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
  LifeBuoy
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

export function resolveKAMForCampus(campusName?: string): { kam: string; region: string; matchedCampus: string } {
  const norm = (campusName || "").trim().toLowerCase();
  for (const [kam, info] of Object.entries(KAM_CLUSTERS)) {
    for (const c of info.campuses) {
      if (c.trim().toLowerCase() === norm || norm.includes(c.trim().toLowerCase()) || c.trim().toLowerCase().includes(norm)) {
        return { kam, region: info.region, matchedCampus: c };
      }
    }
  }
  // Default fallback to Chennai cluster if unmapped
  return { kam: "Shyam Kumar", region: "Chennai", matchedCampus: campusName || "SDNB Vaishnav College for Women" };
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
const INITIAL_SKILL_RECORDS: SkillAuditRecord[] = [
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

const INITIAL_ACADEMIC_RECORDS: AcademicAuditRecord[] = [
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

const INITIAL_ATTENDANCE_RECORDS: AttendanceAuditRecord[] = [
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

  // Main navigation tabs inside the module
  const [activeSubTab, setActiveSubTab] = useState<"overview" | "ledger" | "wizard" | "peer_inbox" | "tickets" | "feedback">("overview");

  // Ledger sub-domain tab
  const [ledgerDomain, setLedgerDomain] = useState<"skill" | "academic" | "attendance" | "audit">("skill");
  const [ledgerSearch, setLedgerSearch] = useState("");
  const [ledgerStatusFilter, setLedgerStatusFilter] = useState("all");

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

    // Reset wizard and return to ledger
    setWizardStage(1);
    setActiveSubTab("ledger");
    setLedgerDomain("audit");
  };

  // --------------------------------------------------------------------------
  // PEER REVIEW SIGN-OFF HANDLER (For audits assigned to this CM)
  // --------------------------------------------------------------------------
  const [selectedPeerAuditForReview, setSelectedPeerAuditForReview] = useState<PeerAuditRecord | null>(null);
  const [signOffNotes, setSignOffNotes] = useState("");
  const [signOffWeeklyPlan, setSignOffWeeklyPlan] = useState<"Completed" | "In Progress" | "Not Completed">("Completed");
  const [signOffSkillDev, setSignOffSkillDev] = useState<"Completed" | "In Progress" | "Not Completed">("Completed");
  const [signOffAcademic, setSignOffAcademic] = useState<"Completed" | "In Progress" | "Not Completed">("Completed");

  // Incoming peer reviews assigned to this campus
  const incomingPeerReviews = useMemo(() => {
    const cNorm = (collegeName || "").trim().toLowerCase();
    return peerAudits.filter(
      (a) =>
        (a.reviewerCampus.trim().toLowerCase() === cNorm || cNorm.includes(a.reviewerCampus.trim().toLowerCase())) &&
        a.overall !== "Completed"
    );
  }, [peerAudits, collegeName]);

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

  // --------------------------------------------------------------------------
  // EXCEL EXPORT
  // --------------------------------------------------------------------------
  const handleExportExcel = async () => {
    try {
      const XLSX = await import("xlsx");
      const wb = XLSX.utils.book_new();

      // Skill Sheet
      const skillRows = skillRecords.map((r) => [
        r.id,
        r.mentor,
        r.campus,
        r.deptName,
        r.subject,
        r.criteria.genuine ? "Yes" : "No",
        r.criteria.weeklyPlan ? "Yes" : "No",
        r.criteria.tracker ? "Yes" : "No",
        r.criteria.assignment ? "Yes" : "No",
        r.criteria.assessment ? "Yes" : "No",
        `${r.score}%`,
        r.tasksAssigned,
        r.tasksCompleted,
        `${r.avgCompletionPct}%`,
        r.remarks,
        r.date,
        r.status
      ]);
      const wsSkill = XLSX.utils.aoa_to_sheet([
        [
          "Log ID",
          "Mentor Name",
          "Campus",
          "Department",
          "Skill Subject",
          "Genuine",
          "Weekly Plan",
          "Tracker",
          "Assignment",
          "Assessment",
          "Verification Score",
          "Tasks Assigned",
          "Tasks Completed",
          "Avg Completion",
          "Remarks",
          "Date",
          "Status"
        ],
        ...skillRows
      ]);
      XLSX.utils.book_append_sheet(wb, wsSkill, "Skill_Development");

      // Internal Audit Sheet
      const auditRows = peerAudits.map((r) => [
        r.id,
        r.campus,
        r.mentor,
        r.deptName,
        r.kam,
        r.reviewerCampus,
        r.weeklyPlan,
        r.skillDev,
        r.academic,
        r.overall,
        r.auditor,
        r.date,
        r.auditorNotes || ""
      ]);
      const wsAudit = XLSX.utils.aoa_to_sheet([
        [
          "Audit ID",
          "Audited Campus",
          "Mentor",
          "Department",
          "KAM Cluster",
          "Assigned Reviewer Campus",
          "Weekly Plan",
          "Skill Dev",
          "Coursework",
          "Overall Status",
          "Auditor",
          "Audit Date",
          "Reviewer Notes"
        ],
        ...auditRows
      ]);
      XLSX.utils.book_append_sheet(wb, wsAudit, "Internal_Peer_Audits");

      XLSX.writeFile(wb, `Campus_E_Audit_${collegeName.replace(/[^a-zA-Z0-9]/g, "_")}_${new Date().toISOString().slice(0, 10)}.xlsx`);
      toast("Campus audit ledger exported to Excel!", "success");
    } catch (e: any) {
      toast("Export failed: " + e.message, "error");
    }
  };

  // --------------------------------------------------------------------------
  // SCOPED METRICS CALCULATIONS FOR THIS CM'S CAMPUS
  // --------------------------------------------------------------------------
  const campusSkillRecords = useMemo(() => {
    if (role === "admin") return skillRecords;
    const norm = collegeName.trim().toLowerCase();
    return skillRecords.filter((r) => r.campus.trim().toLowerCase() === norm || norm.includes(r.campus.trim().toLowerCase()));
  }, [skillRecords, collegeName, role]);

  const campusAcadRecords = useMemo(() => {
    if (role === "admin") return academicRecords;
    const norm = collegeName.trim().toLowerCase();
    return academicRecords.filter((r) => r.campus.trim().toLowerCase() === norm || norm.includes(r.campus.trim().toLowerCase()));
  }, [academicRecords, collegeName, role]);

  const campusAttRecords = useMemo(() => {
    if (role === "admin") return attendanceRecords;
    const norm = collegeName.trim().toLowerCase();
    return attendanceRecords.filter((r) => r.campus.trim().toLowerCase() === norm || norm.includes(r.campus.trim().toLowerCase()));
  }, [attendanceRecords, collegeName, role]);

  const avgSkillScore = useMemo(() => {
    if (campusSkillRecords.length === 0) return 92;
    const sum = campusSkillRecords.reduce((acc, r) => acc + r.score, 0);
    return Math.round(sum / campusSkillRecords.length);
  }, [campusSkillRecords]);

  const avgAcadScore = useMemo(() => {
    if (campusAcadRecords.length === 0) return 90;
    const sum = campusAcadRecords.reduce((acc, r) => acc + r.score, 0);
    return Math.round(sum / campusAcadRecords.length);
  }, [campusAcadRecords]);

  const avgAttScore = useMemo(() => {
    if (campusAttRecords.length === 0) return 88;
    const sum = campusAttRecords.reduce((acc, r) => acc + r.score, 0);
    return Math.round(sum / campusAttRecords.length);
  }, [campusAttRecords]);

  const overallComplianceScore = Math.round((avgSkillScore + avgAcadScore + avgAttScore) / 3);

  // Filtered ledger rows based on selected domain tab and search
  const filteredLedgerRows = useMemo(() => {
    const q = ledgerSearch.toLowerCase().trim();
    if (ledgerDomain === "skill") {
      return campusSkillRecords.filter((r) => {
        if (ledgerStatusFilter !== "all" && r.status !== ledgerStatusFilter) return false;
        if (q) return r.mentor.toLowerCase().includes(q) || r.subject.toLowerCase().includes(q) || r.deptName.toLowerCase().includes(q);
        return true;
      });
    }
    if (ledgerDomain === "academic") {
      return campusAcadRecords.filter((r) => {
        if (ledgerStatusFilter !== "all" && r.status !== ledgerStatusFilter) return false;
        if (q) return r.mentor.toLowerCase().includes(q) || r.subject.toLowerCase().includes(q) || r.deptName.toLowerCase().includes(q);
        return true;
      });
    }
    if (ledgerDomain === "attendance") {
      return campusAttRecords.filter((r) => {
        if (ledgerStatusFilter !== "all" && r.status !== ledgerStatusFilter) return false;
        if (q) return r.mentor.toLowerCase().includes(q) || r.deptName.toLowerCase().includes(q);
        return true;
      });
    }
    // internal audit
    return peerAudits.filter((r) => {
      if (role !== "admin") {
        const cNorm = collegeName.trim().toLowerCase();
        const matchesCampus = r.campus.trim().toLowerCase() === cNorm || cNorm.includes(r.campus.trim().toLowerCase());
        const matchesReviewer = r.reviewerCampus.trim().toLowerCase() === cNorm || cNorm.includes(r.reviewerCampus.trim().toLowerCase());
        if (!matchesCampus && !matchesReviewer) return false;
      }
      if (ledgerStatusFilter !== "all" && r.overall !== ledgerStatusFilter) return false;
      if (q) return r.mentor.toLowerCase().includes(q) || r.campus.toLowerCase().includes(q) || r.reviewerCampus.toLowerCase().includes(q);
      return true;
    });
  }, [ledgerDomain, campusSkillRecords, campusAcadRecords, campusAttRecords, peerAudits, ledgerSearch, ledgerStatusFilter, role, collegeName]);

  return (
    <div className="space-y-6 font-sans">
      {/* ==================================================================== */}
      {/* 1. TOP HEADER & KAM CLUSTER IDENTITY                                */}
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
                  Campus E-Audit &amp; Peer Review Hub
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
                Standardized verification of Skill Development, Coursework Delivery, Attendance integrity &amp; Intra-KAM peer audits.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              type="button"
              onClick={handleExportExcel}
              className="px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs"
            >
              <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
              <span>Export Audit Ledger (.xlsx)</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setWizardStage(1);
                setActiveSubTab("wizard");
              }}
              className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold transition-all cursor-pointer flex items-center gap-1.5 shadow-xs"
            >
              <Send className="h-3.5 w-3.5" />
              <span>Record New Audit</span>
            </button>
          </div>
        </div>

        {/* Quick KPI Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-1">
          <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl">
            <span className="text-[9px] font-black uppercase tracking-wider text-emerald-800 block">Overall Compliance</span>
            <div className="text-xl font-black text-emerald-950 mt-1">{overallComplianceScore}%</div>
            <span className="text-[10px] text-emerald-700 font-medium">Campus Audit Grade</span>
          </div>

          <div className="p-3 bg-indigo-50/70 border border-indigo-200 rounded-xl">
            <span className="text-[9px] font-black uppercase tracking-wider text-indigo-800 block">Skill Development</span>
            <div className="text-xl font-black text-indigo-950 mt-1">{avgSkillScore}%</div>
            <span className="text-[10px] text-indigo-700 font-medium">{campusSkillRecords.length} Mentors logged</span>
          </div>

          <div className="p-3 bg-teal-50/70 border border-teal-200 rounded-xl">
            <span className="text-[9px] font-black uppercase tracking-wider text-teal-800 block">Coursework Progress</span>
            <div className="text-xl font-black text-teal-950 mt-1">{avgAcadScore}%</div>
            <span className="text-[10px] text-teal-700 font-medium">Syllabus compliance</span>
          </div>

          <div className="p-3 bg-purple-50/70 border border-purple-200 rounded-xl">
            <span className="text-[9px] font-black uppercase tracking-wider text-purple-800 block">Attendance Integrity</span>
            <div className="text-xl font-black text-purple-950 mt-1">{avgAttScore}%</div>
            <span className="text-[10px] text-purple-700 font-medium">Verified without proxy</span>
          </div>

          <div
            onClick={() => setActiveSubTab("peer_inbox")}
            className={`p-3 rounded-xl border cursor-pointer transition-all hover:scale-[1.02] ${
              incomingPeerReviews.length > 0 ? "bg-amber-50 border-amber-300 ring-2 ring-amber-200/50" : "bg-slate-50 border-slate-200"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className={`text-[9px] font-black uppercase tracking-wider ${incomingPeerReviews.length > 0 ? "text-amber-800" : "text-slate-600"}`}>
                Peer Reviews Inbox
              </span>
              <Inbox className={`h-3.5 w-3.5 ${incomingPeerReviews.length > 0 ? "text-amber-600" : "text-slate-400"}`} />
            </div>
            <div className={`text-xl font-black mt-1 ${incomingPeerReviews.length > 0 ? "text-amber-950" : "text-slate-800"}`}>
              {incomingPeerReviews.length} Assigned
            </div>
            <span className={`text-[10px] font-medium ${incomingPeerReviews.length > 0 ? "text-amber-700 font-bold underline" : "text-slate-500"}`}>
              {incomingPeerReviews.length > 0 ? "Requires your sign-off" : "All reviews cleared"}
            </span>
          </div>
        </div>

        {/* Sub-Tab Switcher Navigation */}
        <div className="flex items-center gap-1.5 overflow-x-auto pt-1 border-t border-slate-100">
          {[
            { id: "overview", label: "Executive Dashboard", icon: BarChart3 },
            { id: "ledger", label: "Audit Ledger & Reports", icon: FileText },
            { id: "wizard", label: "Record Audit (4-Stage Flow)", icon: Send },
            {
              id: "peer_inbox",
              label: `Assigned Peer Reviews (${incomingPeerReviews.length})`,
              icon: Inbox,
              badge: incomingPeerReviews.length > 0
            },
            { id: "tickets", label: "Help Desk & Tickets", icon: LifeBuoy },
            { id: "feedback", label: "Faculty NPS & Ratings", icon: ThumbsUp }
          ].map((t) => {
            const Icon = t.icon;
            const isActive = activeSubTab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveSubTab(t.id as any)}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                  isActive ? "bg-emerald-600 text-white shadow-xs" : "bg-slate-100 hover:bg-slate-200 text-slate-600"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{t.label}</span>
                {t.badge && (
                  <span className="h-2 w-2 rounded-full bg-amber-400 animate-ping ml-0.5" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ==================================================================== */}
      {/* VIEW 1: EXECUTIVE DASHBOARD & MENTOR LEADERBOARD                     */}
      {/* ==================================================================== */}
      {activeSubTab === "overview" && (
        <div className="space-y-6">
          {/* Domain Breakdown Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-slate-800 uppercase tracking-wider">Skill Development Audits</span>
                <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 text-[10px] font-black">{campusSkillRecords.length} Audited</span>
              </div>
              <p className="text-xs text-slate-500">
                Verifies genuine task marking, daily tracker compliance, and links to student repositories and assessments.
              </p>
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div className="bg-indigo-600 h-full rounded-full" style={{ width: `${avgSkillScore}%` }} />
                </div>
                <span className="text-xs font-black text-indigo-700">{avgSkillScore}%</span>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-slate-800 uppercase tracking-wider">Coursework Progress</span>
                <span className="px-2 py-0.5 rounded bg-teal-50 text-teal-700 text-[10px] font-black">{campusAcadRecords.length} Audited</span>
              </div>
              <p className="text-xs text-slate-500">
                Ensures syllabus coverage matches planned units, experiments are conducted on time, and materials are shared.
              </p>
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div className="bg-teal-600 h-full rounded-full" style={{ width: `${avgAcadScore}%` }} />
                </div>
                <span className="text-xs font-black text-teal-700">{avgAcadScore}%</span>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-slate-800 uppercase tracking-wider">Attendance Integrity</span>
                <span className="px-2 py-0.5 rounded bg-purple-50 text-purple-700 text-[10px] font-black">{campusAttRecords.length} Audited</span>
              </div>
              <p className="text-xs text-slate-500">
                Audits classroom biometric synchronicity, flags low-attendance cohorts (&lt;75%), and prevents proxy entries.
              </p>
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div className="bg-purple-600 h-full rounded-full" style={{ width: `${avgAttScore}%` }} />
                </div>
                <span className="text-xs font-black text-purple-700">{avgAttScore}%</span>
              </div>
            </div>
          </div>

          {/* Leaderboard & Needs Attention Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Mentor Audit Leaderboard */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-150 pb-3">
                <div className="flex items-center gap-2">
                  <Award className="h-4 w-4 text-emerald-600" />
                  <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                    Campus Mentor Compliance Leaderboard
                  </h3>
                </div>
                <span className="text-[10px] font-bold text-slate-400">Scored on genuineness</span>
              </div>

              <div className="space-y-2.5">
                {campusSkillRecords.map((m, idx) => (
                  <div key={m.uid} className="flex items-center justify-between p-3 rounded-xl bg-slate-50/70 border border-slate-200">
                    <div className="flex items-center gap-2.5">
                      <span className="h-6 w-6 rounded-full bg-white border border-slate-200 flex items-center justify-center text-xs font-black text-slate-700">
                        {idx + 1}
                      </span>
                      <div>
                        <div className="font-extrabold text-slate-900 text-xs">{m.mentor}</div>
                        <div className="text-[10px] text-slate-400 font-medium">{m.deptName}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-16 bg-slate-200 h-2 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${m.score >= 80 ? "bg-emerald-500" : m.score >= 50 ? "bg-amber-500" : "bg-rose-500"}`}
                          style={{ width: `${m.score}%` }}
                        />
                      </div>
                      <span className="text-xs font-black font-mono text-slate-900">{m.score}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Needs Attention / Gaps */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-150 pb-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                    Audit Alerts &amp; Compliance Gaps
                  </h3>
                </div>
                <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded">Action Items</span>
              </div>

              <div className="space-y-3">
                {incomingPeerReviews.length > 0 && (
                  <div className="p-3.5 rounded-xl bg-amber-50/80 border border-amber-200 flex items-start gap-3">
                    <Inbox className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-black text-xs text-amber-900 block">
                        {incomingPeerReviews.length} Peer Review(s) Waiting for Sign-Off
                      </span>
                      <p className="text-[11px] text-amber-800 mt-0.5">
                        Colleges in your KAM cluster have submitted audits routed to you for peer evaluation.
                      </p>
                      <button
                        type="button"
                        onClick={() => setActiveSubTab("peer_inbox")}
                        className="mt-2 text-xs font-extrabold text-amber-900 underline cursor-pointer"
                      >
                        Open Peer Review Inbox &rarr;
                      </button>
                    </div>
                  </div>
                )}

                {campusSkillRecords
                  .filter((r) => r.score < 80)
                  .map((r) => (
                    <div key={r.uid} className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-3">
                      <AlertCircle className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-xs text-rose-900">{r.mentor}</span>
                          <span className="px-1.5 py-0.5 bg-rose-100 text-rose-700 rounded text-[9px] font-black">Score: {r.score}%</span>
                        </div>
                        <p className="text-[11px] text-rose-800 mt-0.5">{r.remarks || "Assessment incomplete or daily tracker entry missed."}</p>
                      </div>
                    </div>
                  ))}

                {incomingPeerReviews.length === 0 && campusSkillRecords.every((r) => r.score >= 80) && (
                  <div className="p-8 text-center text-slate-400 space-y-1">
                    <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto" />
                    <p className="font-bold text-slate-700 text-xs">All Audits Cleared</p>
                    <p className="text-[11px] text-slate-400">No open compliance gaps or pending peer reviews on your desk.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* VIEW 2: REPORTS & AUDIT LEDGER (4 SUB-DOMAINS)                       */}
      {/* ==================================================================== */}
      {activeSubTab === "ledger" && (
        <div className="space-y-4">
          {/* Domain switcher pills */}
          <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 flex-wrap">
              {[
                { id: "skill", label: `Skill Development (${campusSkillRecords.length})` },
                { id: "academic", label: `Coursework Verification (${campusAcadRecords.length})` },
                { id: "attendance", label: `Attendance Integrity (${campusAttRecords.length})` },
                { id: "audit", label: `Internal Peer Audits (${peerAudits.length})` }
              ].map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => setLedgerDomain(d.id as any)}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    ledgerDomain === d.id ? "bg-slate-900 text-white shadow-xs" : "bg-slate-100 hover:bg-slate-200 text-slate-600"
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>

            {/* Search & Status Filter */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative min-w-[220px]">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search mentor or subject..."
                  value={ledgerSearch}
                  onChange={(e) => setLedgerSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <select
                value={ledgerStatusFilter}
                onChange={(e) => setLedgerStatusFilter(e.target.value)}
                className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-bold focus:outline-hidden"
              >
                <option value="all">All Statuses</option>
                <option value="Completed">Completed</option>
                <option value="In Progress">In Progress</option>
                <option value="Not Completed">Not Completed</option>
              </select>
            </div>
          </div>

          {/* Ledger Table */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
            <div className="overflow-x-auto scroll-touch">
              <table className="w-full border-collapse text-left text-xs min-w-[850px]">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[9px] whitespace-nowrap">
                    <th className="p-3">Log ID</th>
                    <th className="p-3">Mentor / Faculty</th>
                    <th className="p-3">Department &amp; Course</th>
                    {ledgerDomain === "skill" && <th className="p-3">Skill Subject</th>}
                    {ledgerDomain === "academic" && <th className="p-3">Coursework Subject</th>}
                    {ledgerDomain === "attendance" && <th className="p-3 text-center">&lt;75% Attendance</th>}
                    {ledgerDomain === "audit" && (
                      <>
                        <th className="p-3">KAM Cluster</th>
                        <th className="p-3">Assigned Peer Reviewer</th>
                      </>
                    )}
                    {ledgerDomain !== "audit" && <th className="p-3 text-center">Score</th>}
                    <th className="p-3 text-center">Status</th>
                    <th className="p-3">Verification Remarks</th>
                    <th className="p-3">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-150 bg-white font-medium">
                  {filteredLedgerRows.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="p-8 text-center text-slate-400 italic">
                        No audit records found matching your filters.
                      </td>
                    </tr>
                  ) : (
                    filteredLedgerRows.map((row: any) => {
                      const isComplete = row.status === "Completed" || row.overall === "Completed";
                      const scoreVal = row.score !== undefined ? row.score : null;
                      return (
                        <tr key={row.uid} className="hover:bg-slate-50/60 transition-colors">
                          <td className="p-3 font-mono text-[10.5px] font-bold text-slate-600">{row.id}</td>
                          <td className="p-3">
                            <div className="font-extrabold text-slate-900">{row.mentor}</div>
                            <div className="text-[10px] text-slate-400">{row.campus}</div>
                          </td>
                          <td className="p-3">
                            <div className="font-bold text-slate-800">{row.deptName}</div>
                            <div className="text-[10px] text-slate-400">{row.department}</div>
                          </td>

                          {ledgerDomain === "skill" && (
                            <td className="p-3 text-slate-800 font-bold max-w-[200px] truncate">
                              <div>{row.subject}</div>
                              {row.proof?.assignment?.link && (
                                <a
                                  href={row.proof.assignment.link}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-[10px] text-indigo-600 underline font-bold inline-flex items-center gap-0.5 mt-0.5"
                                >
                                  <span>View Proof</span>
                                  <ExternalLink className="h-2.5 w-2.5" />
                                </a>
                              )}
                            </td>
                          )}

                          {ledgerDomain === "academic" && <td className="p-3 text-slate-800 font-bold">{row.subject}</td>}

                          {ledgerDomain === "attendance" && (
                            <td className="p-3 text-center">
                              <span className="px-2 py-0.5 rounded-full bg-rose-50 border border-rose-200 text-rose-700 font-black text-[10px]">
                                {row.below75} Students
                              </span>
                            </td>
                          )}

                          {ledgerDomain === "audit" && (
                            <>
                              <td className="p-3">
                                <span className="px-2 py-0.5 rounded bg-purple-50 text-purple-700 font-extrabold text-[10px]">
                                  {row.kam} ({row.region})
                                </span>
                              </td>
                              <td className="p-3 font-bold text-slate-800">{row.reviewerCampus}</td>
                            </>
                          )}

                          {ledgerDomain !== "audit" && (
                            <td className="p-3 text-center">
                              <span
                                className={`px-2 py-0.5 rounded-full font-black text-[10.5px] font-mono ${
                                  scoreVal >= 80 ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-amber-50 text-amber-700 border border-amber-200"
                                }`}
                              >
                                {scoreVal}%
                              </span>
                            </td>
                          )}

                          <td className="p-3 text-center">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[9.5px] font-black uppercase ${
                                isComplete
                                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                  : "bg-amber-50 text-amber-700 border border-amber-200"
                              }`}
                            >
                              {row.status || row.overall}
                            </span>
                          </td>

                          <td className="p-3 text-slate-600 text-[11px] max-w-[240px] truncate" title={row.remarks || row.auditorNotes}>
                            {row.remarks || row.auditorNotes || "Verified compliant"}
                          </td>

                          <td className="p-3 text-slate-500 font-mono text-[10.5px] whitespace-nowrap">{row.date}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* VIEW 3: 4-STAGE RECORD AUDIT WIZARD                                 */}
      {/* ==================================================================== */}
      {activeSubTab === "wizard" && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-6 max-w-3xl mx-auto">
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
              </div>

              <div className="pt-4 flex justify-end">
                <button
                  type="button"
                  onClick={() => setWizardStage(2)}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-xs"
                >
                  <span>Continue to Skill Verification</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {/* STAGE 2: SKILL DEVELOPMENT VERIFICATION */}
          {wizardStage === 2 && (
            <div className="space-y-4">
              <div className="bg-indigo-50/60 border border-indigo-100 rounded-xl p-3 flex items-center justify-between">
                <div>
                  <span className="text-xs font-extrabold text-indigo-900 block">Stage 2: Skill Genuineness Verification</span>
                  <span className="text-[10px] text-indigo-700">Calculated Score: {calculatedSkillScore}%</span>
                </div>
                <Award className="h-5 w-5 text-indigo-600" />
              </div>

              <div className="space-y-2 border border-slate-200 rounded-xl p-4">
                {[
                  { label: "Was this skill log genuinely marked, not backdated or bulk-copied?", val: wizSkillGenuine, set: setWizSkillGenuine },
                  { label: "Was progress on this skill logged consistently against the weekly plan?", val: wizSkillWeeklyPlan, set: setWizSkillWeeklyPlan },
                  { label: "Was the daily tracker updated consistently by the mentor?", val: wizSkillTracker, set: setWizSkillTracker },
                  { label: "Was the related assignment completed and verified?", val: wizSkillAssignment, set: setWizSkillAssignment },
                  { label: "Was the related assessment/test completed?", val: wizSkillAssessment, set: setWizSkillAssessment }
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
                  Assignment / Assessment Proof Link (Google Drive / GitHub)
                </label>
                <input
                  type="text"
                  value={wizSkillProofLink}
                  onChange={(e) => setWizSkillProofLink(e.target.value)}
                  placeholder="https://drive.google.com/... or https://github.com/..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-mono text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
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

      {/* ==================================================================== */}
      {/* VIEW 4: INCOMING PEER REVIEWS INBOX (PEER INSPECT & SIGN-OFF)         */}
      {/* ==================================================================== */}
      {activeSubTab === "peer_inbox" && (
        <div className="space-y-5">
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-2">
            <div className="flex items-center gap-2">
              <Inbox className="h-5 w-5 text-amber-600" />
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">
                Peer Reviews Assigned to {collegeName}
              </h3>
            </div>
            <p className="text-xs text-slate-500 font-medium">
              These mentor audits were conducted by other colleges in your {activeKamInfo.region} cluster and routed to your desk for peer review sign-off.
            </p>
          </div>

          {incomingPeerReviews.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center shadow-xs space-y-2">
              <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto" />
              <h4 className="text-sm font-extrabold text-slate-800">Your Peer Review Inbox is Clear</h4>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                No incoming audits currently pending your review. As peer campus managers submit audits in your KAM cluster, they will land here automatically.
              </p>
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
                          className="text-xs text-indigo-600 font-bold underline inline-flex items-center gap-1"
                        >
                          <span>Inspect Student Code / Task Proof Repository</span>
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
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
                        placeholder="Type your verification findings, cross-checked dates, and sign-off remarks..."
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

      {/* ==================================================================== */}
      {/* VIEW 5: CAMPUS HELP DESK & TICKETS (FROM CONSOLIDATED TICKETING)    */}
      {/* ==================================================================== */}
      {activeSubTab === "tickets" && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-2">
            <div className="flex items-center gap-2">
              <LifeBuoy className="h-5 w-5 text-orange-600" />
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">
                Campus Help Desk &amp; Issue Tickets ({collegeName})
              </h3>
            </div>
            <p className="text-xs text-slate-500 font-medium">
              Synchronized from the Centralized Help Desk. Tracks operational issues, LMS glitches, and classroom support SLA.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 bg-white border border-slate-200 rounded-xl shadow-2xs">
              <span className="text-[9px] font-black uppercase tracking-wider text-slate-500 block">Total Tickets Logged</span>
              <div className="text-2xl font-black text-slate-900 mt-1">{CAMPUS_TICKETS_SAMPLE.length}</div>
              <span className="text-[10px] text-slate-400 font-medium">This semester</span>
            </div>
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl shadow-2xs">
              <span className="text-[9px] font-black uppercase tracking-wider text-emerald-800 block">Resolved Issues</span>
              <div className="text-2xl font-black text-emerald-950 mt-1">3</div>
              <span className="text-[10px] text-emerald-700 font-medium">75% Resolution Rate</span>
            </div>
            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl shadow-2xs">
              <span className="text-[9px] font-black uppercase tracking-wider text-amber-800 block">Active / In Progress</span>
              <div className="text-2xl font-black text-amber-950 mt-1">1</div>
              <span className="text-[10px] text-amber-700 font-medium">Within 24h SLA</span>
            </div>
            <div className="p-3.5 bg-indigo-50 border border-indigo-200 rounded-xl shadow-2xs">
              <span className="text-[9px] font-black uppercase tracking-wider text-indigo-800 block">SLA Compliance</span>
              <div className="text-2xl font-black text-indigo-950 mt-1">98.2%</div>
              <span className="text-[10px] text-indigo-700 font-medium">Excellent health</span>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <span className="text-xs font-black text-slate-800 uppercase tracking-wider">Recent Help Desk Activity</span>
              <span className="text-[10px] font-bold text-slate-500">Live Campus Queue</span>
            </div>
            <div className="divide-y divide-slate-150">
              {CAMPUS_TICKETS_SAMPLE.map((t) => (
                <div key={t.id} className="p-4 flex items-center justify-between hover:bg-slate-50/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs font-bold text-slate-600">{t.id}</span>
                    <div>
                      <div className="font-bold text-slate-900 text-xs">{t.title}</div>
                      <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-400 font-medium">
                        <span className="px-1.5 py-0.2 rounded bg-slate-100 text-slate-700">{t.category}</span>
                        <span>•</span>
                        <span>{t.time}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-[9.5px] font-black uppercase ${
                      t.status === "Resolved" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-amber-50 text-amber-700 border border-amber-200"
                    }`}>
                      {t.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* VIEW 6: FACULTY NPS & STUDENT FEEDBACK (FROM MENTOR-FEEDBACK.HTML)   */}
      {/* ==================================================================== */}
      {activeSubTab === "feedback" && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-2">
            <div className="flex items-center gap-2">
              <ThumbsUp className="h-5 w-5 text-indigo-600" />
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">
                Faculty Classroom Delivery &amp; NPS Ratings ({collegeName})
              </h3>
            </div>
            <p className="text-xs text-slate-500 font-medium">
              Synchronized from the Student Feedback Forms. Shows Net Promoter Score (NPS), faculty ratings, and classroom sentiment.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-5 bg-gradient-to-tr from-emerald-500 to-teal-600 text-white rounded-2xl shadow-xs space-y-1 text-center">
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-100 block">Campus Net Promoter Score</span>
              <div className="text-4xl font-black mt-1">+68.4</div>
              <span className="text-xs font-bold text-emerald-100 block mt-1">Excellent · World Class Rating</span>
            </div>

            <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-xs space-y-2">
              <span className="text-xs font-black uppercase tracking-wider text-slate-800 block">Overall Faculty Rating</span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-slate-900">4.62</span>
                <span className="text-xs font-bold text-slate-400">/ 5.0 Stars</span>
              </div>
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div className="bg-emerald-500 h-full rounded-full" style={{ width: "92.4%" }} />
              </div>
              <span className="text-[10px] text-slate-400 font-medium block">Across 1,240 verified student submissions</span>
            </div>

            <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-xs space-y-2">
              <span className="text-xs font-black uppercase tracking-wider text-slate-800 block">Top Feedback Highlights</span>
              <div className="flex flex-wrap gap-1.5 pt-1">
                <span className="px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[10px] font-extrabold">
                  + Interactive Coding (94%)
                </span>
                <span className="px-2 py-0.5 rounded-full bg-teal-50 border border-teal-200 text-teal-800 text-[10px] font-extrabold">
                  + Clear Doubt Clearing (91%)
                </span>
                <span className="px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-[10px] font-extrabold">
                  - Lab Internet Speed (14%)
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
