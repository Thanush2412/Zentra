"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { useApp, Slot, Mentor, Student, Subject } from "../context/AppContext";
import { useToast } from "../context/ToastContext";
import { gsap } from "gsap";
import * as XLSX from "xlsx";
import ExcelJS from "exceljs";

import { Button } from "./Button";
import { Card } from "./Card";
import { Panel } from "./Panel";
import { Input } from "./Input";
import { Select } from "./Select";
import { getSubjectsForDepartment, getDeptFromClassGroup, isSubjectNameMatch, isMentorInProgram, calculateShiftSchedule, resolveClassGroupDetailsFromState, parseDbDate, parseRoomsList } from "../lib/utils";
import {
  Building2, GraduationCap, Users, Calendar, ClipboardList, Sparkles,
  AlertTriangle, BookOpen, Clock, CheckCircle2, XCircle, Search,
  PlusCircle, Check, ArrowRight, Settings, MessageSquare, ShieldAlert,
  Award, TrendingUp, FileText, RefreshCw, Plus, Trash2, Edit2, Download, Upload, ChevronDown,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, AlertCircle, CheckCircle, User, SlidersHorizontal, CalendarCheck2, IndianRupee, BadgePercent, X, Mail, Lock, Menu
} from "lucide-react";


const FACULTY_DEPARTMENTS = [
  "Computer Science",
  "Information Technology",
  "Data Science",
  "Commerce",
  "Management - Fashion",
  "Management - Airline and Airport",
  "Maths / Aptitude",
  "English",
  "Tamil"
];

const getCourseFromClassGroup = (cg: string): string => {
  if (!cg) return "";
  let cleaned = cg.replace(/\s*-\s*(Semester|Sem|Year|Yr|Shift|Batch)\s*([0-9]+|[IVXLCDM]+)/gi, "");
  cleaned = cleaned.replace(/\s*(Semester|Sem|Year|Yr|Shift|Batch)\s*([0-9]+|[IVXLCDM]+)/gi, "");
  return cleaned.trim();
};

const getSemesterFromClassGroup = (cg: string): string => {
  const lower = cg.toLowerCase();
  if (lower.includes("sem vi") || lower.includes("semester vi") || lower.includes("sem 6") || lower.includes("semester 6")) return "Semester 6";
  if (lower.includes("sem v") || lower.includes("semester v") || lower.includes("sem 5") || lower.includes("semester 5")) return "Semester 5";
  if (lower.includes("sem iv") || lower.includes("semester iv") || lower.includes("sem 4") || lower.includes("semester 4")) return "Semester 4";
  if (lower.includes("sem iii") || lower.includes("semester iii") || lower.includes("sem 3") || lower.includes("semester 3")) return "Semester 3";
  if (lower.includes("sem ii") || lower.includes("semester ii") || lower.includes("sem 2") || lower.includes("semester 2")) return "Semester 2";
  if (lower.includes("sem i") || lower.includes("semester i") || lower.includes("sem 1") || lower.includes("semester 1")) return "Semester 1";
  return "All Semesters";
};


/* ─── CAM Fee Collection Panel ─── */
const fmt = (n: number) => "₹" + n.toLocaleString("en-IN", { maximumFractionDigits: 0 });

const FeeBadge = ({ status }: { status: string }) => {
  if (status === "paid") return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#D528A2]/10 text-[#D528A2] text-[10px] font-bold">Yes Paid</span>;
  if (status === "partial") return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#F4A863]/10 text-[#F4A863] text-[10px] font-bold">⏳ Partial</span>;
  return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 text-[10px] font-bold">No Unpaid</span>;
};

const CAMFeePanel: React.FC<{ camId: string }> = ({ camId }) => {
  const [loading, setLoading] = React.useState(true);
  const [data, setData] = React.useState<any>(null);
  const [search, setSearch] = React.useState("");
  const [expandedId, setExpandedId] = React.useState<string | null>(null);

  const fetchData = async () => {
    if (!camId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/fees?role=cam&camId=${encodeURIComponent(camId)}`);
      const json = await res.json();
      if (json.success) setData(json);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  React.useEffect(() => { fetchData(); }, [camId]);



  if (loading) return <div className="py-16 text-center text-sm text-slate-400">Loading fee data…</div>;
  if (!data) return <div className="py-16 text-center text-sm text-rose-400">Failed to load fee data.</div>;

  const { students, fees } = data;
  const filtered = students.filter((s: any) =>
    !search || s.name.toLowerCase().includes(search.toLowerCase()) || s.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">


      {/* Search */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search student…" className="pl-8 pr-4 py-2 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#D528A2]/50 w-full" />
        </div>
        <button onClick={fetchData} className="p-2 rounded-xl border border-slate-200 bg-white text-slate-400 hover:text-[#D528A2] cursor-pointer transition-colors"><RefreshCw className="h-3.5 w-3.5" /></button>
      </div>

      {/* Student fee list */}
      <div className="space-y-2">
        {filtered.map((student: any) => {
          const studentFees = fees.filter((f: any) => f.student_id === student.id);
          const totalPaid = studentFees.reduce((s: number, f: any) => s + f.paid_amount, 0);
          const totalFees2 = studentFees.reduce((s: number, f: any) => s + f.amount, 0);
          const overallStatus = totalPaid >= totalFees2 && totalFees2 > 0 ? "paid" : totalPaid > 0 ? "partial" : "unpaid";
          const isExp = expandedId === student.id;
          return (
            <div key={student.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <button
                onClick={() => setExpandedId(isExp ? null : student.id)}
                className="w-full flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50 transition-colors text-left cursor-pointer"
              >
                <div className="h-8 w-8 rounded-full btn-gradient flex items-center justify-center text-white font-bold text-[10px] shrink-0">
                  {student.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-800">{student.name}</p>
                  <p className="text-[10px] text-slate-400 truncate">{student.department}</p>
                </div>
                <div className="text-right mr-3 shrink-0">
                  <p className="text-sm font-extrabold text-slate-800">{fmt(totalPaid)}</p>
                  <p className="text-[9px] text-slate-400">of {fmt(totalFees2)}</p>
                </div>
                <FeeBadge status={overallStatus} />
                <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform duration-200 ml-2 ${isExp ? "rotate-180" : ""}`} />
              </button>
              {isExp && (
                <div className="border-t border-slate-100 px-5 py-4 space-y-2">
                  {studentFees.map((fee: any) => (
                    <div key={fee.id} className="flex items-center justify-between py-2 px-3 rounded-xl bg-slate-50 border border-slate-100">
                      <div className="flex-1">
                        <p className="text-xs font-bold text-slate-700">{fee.term_name}</p>
                        <p className="text-[10px] text-slate-400">Due: {fee.due_date || "—"}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-bold text-slate-800">{fmt(fee.paid_amount)}</p>
                        <p className="text-[9px] text-slate-400">of {fmt(fee.amount)}</p>
                      </div>
                      <FeeBadge status={fee.status} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        {filtered.length === 0 && <div className="text-center py-10 text-sm text-slate-400">No students found.</div>}
      </div>
    </div>
  );
};

// Persistent global flag to prevent sidebar animating on every re-mount during navigation
let isFirstSidebarAnimationDone = false;

export interface CAMDashboardProps {
  activeTab?: "overview" | "config" | "curriculum" | "faculty" | "timetable" | "monitoring" | "handovers" | "reports" | "tasks" | "profile" | "tracker" | "fees" | "more_menu";
  onTabChange?: (tab: "overview" | "config" | "curriculum" | "faculty" | "timetable" | "monitoring" | "handovers" | "reports" | "tasks" | "profile" | "tracker" | "fees" | "more_menu") => void;
}

export const CAMDashboard: React.FC<CAMDashboardProps> = ({
  activeTab: propActiveTab,
  onTabChange
}) => {
  const {
    currentCAM,
    colleges,
    mentors,
    students,
    slots,
    requests,
    subjectsList,
    coursesList,
    assignSlot,
    deleteSlot,
    refreshData,
    studentAttendance,
    createSubject,
    updateSubject,
    deleteSubject,
    createCourse,
    updateCourse,
    deleteCourse,
    generateTimetable,
    clearTimetable,
    currentShift,
    shiftTimeSlots,
    getTimeSlots,
    approvedHandovers,
    handleRequest,
    weeklyTasks,
    studentTracker,
    createMentor,
    updateMentor,
    deleteMentor,
    subjectGroups,
    correctStudentAttendance,
    auditLogs,
    kamTasks: localTasksFromDB,
    campusIssues: localIssuesFromDB,
    academicYears: dbAcademicYears,
    academicEvents: dbAcademicEvents,
    facultyWorkloadLimits: dbWorkloadLimits,
    facultyShifts: dbShifts,
    saveKamTask,
    deleteKamTask,
    saveCampusIssue,
    updateCampusIssueStatus,
    deleteCampusIssue,
    saveAcademicYear,
    deleteAcademicYear,
    saveAcademicEvent,
    deleteAcademicEvent,
    saveFacultyConfig
  } = useApp();
  const { toast, confirm: showConfirm } = useToast();

  const activeCollegeId = currentCAM?.college_id || colleges[0]?.id || "college_1";
  const activeCollegeName = currentCAM?.college_name || colleges.find(c => c.id === activeCollegeId)?.name || "Primary Campus";

  // Tab State
  const [localActiveTab, setLocalActiveTab] = useState<"overview" | "config" | "curriculum" | "faculty" | "timetable" | "monitoring" | "handovers" | "reports" | "tasks" | "profile" | "tracker" | "fees" | "students_list" | "more_menu">("overview");
  const activeTab = propActiveTab || localActiveTab;
  const setActiveTab = onTabChange || setLocalActiveTab;

  // GSAP Container reference
  const containerRef = useRef<HTMLDivElement>(null);

  // GSAP Tab Change entrance animation
  useEffect(() => {
    if (typeof window !== "undefined" && containerRef.current) {
      // Find all card-like elements dynamically
      const cardElements = Array.from(
        containerRef.current.querySelectorAll(
          ".rounded-3xl, .rounded-2xl, .rounded-xl, .bg-white, .bg-pastel-cream, .bg-pastel-blue, .bg-pastel-purple, .bg-pastel-green, .animate-gsap-card"
        )
      ).filter(el => {
        // Exclude elements inside the sidebar, header, or the outer page container
        if (el.closest(".floating-sidebar") || el.closest("header") || el.tagName === "ASIDE") {
          return false;
        }
        // Exclude nested cards (only animate the outermost container to avoid double animation)
        const parentCard = el.parentElement?.closest(
          ".rounded-3xl, .rounded-2xl, .rounded-xl, .bg-white, .bg-pastel-cream, .bg-pastel-blue, .bg-pastel-purple, .bg-pastel-green"
        );
        return !parentCard;
      });

      if (cardElements.length > 0) {
        gsap.killTweensOf(cardElements);
        gsap.fromTo(
          cardElements,
          { opacity: 0, y: 15, scale: 0.97 },
          { 
            opacity: 1, 
            y: 0, 
            scale: 1,
            duration: 0.5, 
            stagger: 0.04, 
            ease: "back.out(0.8)" 
          }
        );
      }
    }
  }, [activeTab]);

  // GSAP Sidebar reference
  const sidebarRef = useRef<HTMLElement>(null);
  const [hoveredGroupId, setHoveredGroupId] = useState<string | null>(null);

  // GSAP Sidebar load animations on mount
  useEffect(() => {
    if (typeof window !== "undefined" && sidebarRef.current && !isFirstSidebarAnimationDone) {
      const parentButtons = sidebarRef.current.querySelectorAll(".sidebar-group-btn");
      if (parentButtons.length > 0) {
        isFirstSidebarAnimationDone = true; // Set flag so it never runs again on re-mount
        gsap.fromTo(
          parentButtons,
          { opacity: 0, x: -20, scale: 0.9 },
          { 
            opacity: 1, 
            x: 0, 
            scale: 1,
            duration: 0.55, 
            stagger: 0.05, 
            ease: "back.out(1.3)",
            delay: 0.05
          }
        );
      }
    }
  }, []);

  // GSAP Stagger sub-menu item entrances on category hover
  useEffect(() => {
    if (typeof window !== "undefined" && hoveredGroupId && sidebarRef.current) {
      const subButtons = sidebarRef.current.querySelectorAll(
        `.submenu-${hoveredGroupId} .submenu-button`
      );
      if (subButtons.length > 0) {
        gsap.killTweensOf(subButtons);
        gsap.fromTo(
          subButtons,
          { opacity: 0, x: -12, scale: 0.93 },
          { 
            opacity: 1, 
            x: 0, 
            scale: 1,
            duration: 0.28, 
            stagger: 0.03, 
            ease: "back.out(1.1)" 
          }
        );
      }
    }
  }, [hoveredGroupId]);

  // Sidebar Group Accordion State
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    dashboard: true,
    academics: false,
    faculty: false,
    schedules: false,
    students: false,
    management: false
  });

  // Automatically expand the group containing the active tab
  useEffect(() => {
    if (["overview"].includes(activeTab)) {
      setExpandedGroups(prev => ({ ...prev, dashboard: true }));
    } else if (["config", "curriculum"].includes(activeTab)) {
      setExpandedGroups(prev => ({ ...prev, academics: true }));
    } else if (["faculty", "handovers"].includes(activeTab)) {
      setExpandedGroups(prev => ({ ...prev, faculty: true }));
    } else if (["timetable", "monitoring"].includes(activeTab)) {
      setExpandedGroups(prev => ({ ...prev, schedules: true }));
    } else if (["tracker", "fees", "students_list"].includes(activeTab)) {
      setExpandedGroups(prev => ({ ...prev, students: true }));
    } else if (["reports", "tasks", "profile"].includes(activeTab)) {
      setExpandedGroups(prev => ({ ...prev, management: true }));
    }
  }, [activeTab]);

  // Attendance Correction state
  const [correctingStudent, setCorrectingStudent] = useState<any | null>(null);
  const [studentAttendanceLogs, setStudentAttendanceLogs] = useState<any[]>([]);
  const [studentCorrectionCount, setStudentCorrectionCount] = useState<number>(0);
  const [isCorrectionSubmitting, setIsCorrectionSubmitting] = useState(false);
  const [correctionSlotId, setCorrectionSlotId] = useState<string>("");
  const [correctionDateStr, setCorrectionDateStr] = useState<string>("");
  const [correctionNewStatus, setCorrectionNewStatus] = useState<"present" | "absent" | "od">("present");
  const [correctionReason, setCorrectionReason] = useState<string>("");
  const [isAdminOverride, setIsAdminOverride] = useState<boolean>(false);

  // Excel timetable import states
  const [showImportModal, setShowImportModal] = useState(false);
  const [importPreview, setImportPreview] = useState<{ slots: any[]; warnings: any[]; targetClassGroup?: string; targetShift?: string } | null>(null);
  const [isImportSubmitting, setIsImportSubmitting] = useState(false);

  // Student Directory & Import States
  const [showStudentImportModal, setShowStudentImportModal] = useState(false);
  const [studentImportPreview, setStudentImportPreview] = useState<{ parsed: any[]; warnings: string[]; targetClassGroup: string } | null>(null);
  const [isStudentImportSubmitting, setIsStudentImportSubmitting] = useState(false);
  const [studentDirSearch, setStudentDirSearch] = useState("");
  const [studentDirDeptFilter, setStudentDirDeptFilter] = useState("all");
  const [studentClassFilter, setStudentClassFilter] = useState("all");
  const [selectedStudentForDetail, setSelectedStudentForDetail] = useState<any | null>(null);
  // Template download selectors (3 separate pickers)
  const [templateDept, setTemplateDept] = useState<string>("");
  const [templateShift, setTemplateShift] = useState<string>("Shift 1");
  const [templateSem, setTemplateSem] = useState<string>("Semester 1");

  // Download Student Excel Template matching requested headers
  const handleDownloadStudentTemplate = (classGroupOverride?: string) => {
    const campusDepts = coursesList.filter(c => c.college_id === activeCollegeId).map(c => c.name);
    const deptList = campusDepts.length > 0 ? campusDepts : FACULTY_DEPARTMENTS;
    const resolvedDept = templateDept || deptList[0] || "Computer Science";
    const resolvedShift = templateShift || "Shift 1";
    const resolvedSem = templateSem || "Semester 1";
    const resolvedClass = classGroupOverride || `${resolvedDept} - ${resolvedShift} - ${resolvedSem}`;
    const selectedClass = resolvedClass;
    const headers = [
      "Sl. No.",
      "Roll No",
      "Department",
      "Shift",
      "Name",
      "10th Mark(%)",
      "11th Mark(%)",
      "12th Mark(%)",
      "Group",
      "Medium",
      "Blood Group",
      "DOB",
      "Student Phone Number",
      "Parent Phone Number (WhatsApp Number)",
      "Aadhar Card Number",
      "Email ID",
      "LinkedIn Link",
      "GitHub link",
      "HackerRank Profile Link",
      "LeetCode Profile Link",
      "Figma Profile"
    ];

    const sampleRows = [
      [
        "1",
        "21CS001",
        resolvedDept,
        resolvedShift,
        "Anitha R",
        "92",
        "88",
        "94",
        "MPC",
        "English",
        "O+",
        "2004-05-14",
        "9876543210",
        "9876543211",
        "123456789012",
        "anitha@university.edu",
        "https://linkedin.com/in/anitha",
        "https://github.com/anitha",
        "https://hackerrank.com/anitha",
        "https://leetcode.com/anitha",
        "https://figma.com/@anitha"
      ],
      [
        "2",
        "21CS002",
        resolvedDept,
        resolvedShift,
        "Bala Kumar M",
        "85",
        "82",
        "89",
        "Biology",
        "English",
        "B+",
        "2004-09-20",
        "9876543220",
        "9876543221",
        "987654321098",
        "bala@university.edu",
        "https://linkedin.com/in/bala",
        "https://github.com/bala",
        "https://hackerrank.com/bala",
        "https://leetcode.com/bala",
        "https://figma.com/@bala"
      ]
    ];

    const wsData = [headers, ...sampleRows];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Students");
    const safeClassName = selectedClass.replace(/[^a-zA-Z0-9\-_ ]/g, "").replace(/\s+/g, "_").slice(0, 40);
    XLSX.writeFile(wb, `Student_Template_${safeClassName}.xlsx`);
  };

  // Helper to map spreadsheet row headers to DB student model fields
  const mapRowToStudentObject = (row: Record<string, any>, defaultCG: string, activeCollegeId: string) => {
    let mapped: Record<string, any> = {};

    Object.keys(row).forEach((colHeader) => {
      const norm = colHeader.toString().toLowerCase().replace(/[^a-z0-9]/g, "");
      const val = row[colHeader] !== undefined && row[colHeader] !== null ? row[colHeader].toString().trim() : "";

      if (norm === "slno" || norm === "sno" || norm === "serialno" || norm === "sl") {
        // Skip Serial No column
      } else if (norm.includes("roll") || norm === "rollno") {
        mapped.roll_number = val;
        mapped.register_number = val;
      } else if (norm === "department" || norm === "dept") {
        mapped.department = val;
      } else if (norm === "name" || norm === "studentname") {
        mapped.name = val;
      } else if (norm.includes("10th") || norm.includes("tenth")) {
        mapped.tenth_mark = val;
      } else if (norm.includes("11th") || norm.includes("eleventh")) {
        mapped.eleventh_mark = val;
      } else if (norm.includes("12th") || norm.includes("twelfth")) {
        mapped.twelfth_mark = val;
      } else if (norm === "group" || norm.includes("academicgroup")) {
        mapped.academic_group = val;
      } else if (norm === "medium") {
        mapped.medium = val;
      } else if (norm.includes("blood")) {
        mapped.blood_group = val;
      } else if (norm === "dob" || norm.includes("dateofbirth")) {
        mapped.dob = val;
      } else if (norm.includes("studentphone") || (norm.includes("phone") && !norm.includes("parent"))) {
        mapped.phone = val;
      } else if (norm.includes("parentphone") || norm.includes("whatsapp")) {
        mapped.parent_phone = val;
      } else if (norm.includes("aadhar")) {
        mapped.aadhar_number = val;
      } else if (norm.includes("email") || norm === "emailid") {
        mapped.email = val;
      } else if (norm.includes("linkedin")) {
        mapped.linkedin_link = val;
      } else if (norm.includes("github")) {
        mapped.github_id = val;
      } else if (norm.includes("hackerrank")) {
        mapped.hackerrank_link = val;
      } else if (norm.includes("leetcode")) {
        mapped.leetcode_link = val;
      } else if (norm.includes("figma")) {
        mapped.figma_link = val;
      } else if (norm === "shift" || norm.includes("shift")) {
        mapped.shift = val;
      } else if (norm.includes("class") || norm.includes("cohort")) {
        mapped.classGroup = val;
      }
    });

    const rollOrId = mapped.roll_number || mapped.email || "";
    mapped.id = rollOrId;
    if (!mapped.classGroup) mapped.classGroup = defaultCG;
    mapped.college_id = activeCollegeId;

    // Auto-derive department from classGroup if not in sheet
    if (!mapped.department && mapped.classGroup) {
      mapped.department = getDeptFromClassGroup(mapped.classGroup);
    }

    // If department was in sheet, stamp classGroup from dept+shift to keep consistency
    if (mapped.department && (!mapped.classGroup || mapped.classGroup === defaultCG)) {
      const shiftPart = mapped.shift && mapped.shift !== "General"
        ? mapped.shift
        : defaultCG.includes("Shift 2") ? "Shift 2" : defaultCG.includes("Shift 1") ? "Shift 1" : "Shift 1";
      const semPart = defaultCG.split(" - ").find((p: string) => p.toLowerCase().startsWith("semester")) || "Semester 1";
      mapped.classGroup = `${mapped.department} - ${shiftPart} - ${semPart}`;
    }

    // Derive shift from classGroup
    if (!mapped.shift && mapped.classGroup) {
      if (mapped.classGroup.toLowerCase().includes("shift 1") || mapped.classGroup.toLowerCase().includes("shift_1")) {
        mapped.shift = "Shift 1";
      } else if (mapped.classGroup.toLowerCase().includes("shift 2") || mapped.classGroup.toLowerCase().includes("shift_2")) {
        mapped.shift = "Shift 2";
      } else {
        mapped.shift = "General";
      }
    }

    return mapped;
  };

  const handleStudentFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: "binary" });
        const sheetName = wb.SheetNames[0];
        const ws = wb.Sheets[sheetName];
        const rawRows: any[] = XLSX.utils.sheet_to_json(ws, { defval: "" });

        if (rawRows.length === 0) {
          toast("The uploaded spreadsheet is empty.", "warning");
          return;
        }

        const defaultCG = (() => {
          // Prefer the cohort the user already picked in the template download selectors
          const campusDepts = coursesList.filter(c => c.college_id === activeCollegeId).map(c => c.name);
          const deptList = campusDepts.length > 0 ? campusDepts : FACULTY_DEPARTMENTS;
          const dept = templateDept || deptList[0] || "Computer Science";
          const shift = templateShift || "Shift 1";
          const sem = templateSem || "Semester 1";
          return `${dept} - ${shift} - ${sem}`;
        })();
        const warnings: string[] = [];
        const parsedStudents = rawRows.map((row, idx) => {
          const student = mapRowToStudentObject(row, defaultCG, activeCollegeId);
          if (!student.name) {
            warnings.push(`Row ${idx + 2}: Missing student name.`);
          }
          if (!student.roll_number && !student.id) {
            warnings.push(`Row ${idx + 2}: Missing Roll No / Student ID.`);
          }
          return student;
        }).filter(s => s.name || s.id);

        setStudentImportPreview({
          parsed: parsedStudents,
          warnings,
          targetClassGroup: defaultCG
        });
        setShowStudentImportModal(true);
      } catch (err: any) {
        toast("Failed to parse Excel file: " + err.message, "error");
      }
    };
    reader.readAsBinaryString(file);
    // Reset file input value so re-uploading same file triggers change
    e.target.value = "";
  };

  const handleConfirmStudentImportSubmit = async () => {
    if (!studentImportPreview || studentImportPreview.parsed.length === 0) return;
    setIsStudentImportSubmitting(true);
    try {
      const targetCG = studentImportPreview.targetClassGroup || "General Class";
      const payload = studentImportPreview.parsed.map(s => ({
        ...s,
        classGroup: s.classGroup || targetCG,
        college_id: activeCollegeId
      }));

      const res = await fetch("/api/students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        toast(`Successfully imported ${payload.length} student records!`, "success");
        setShowStudentImportModal(false);
        setStudentImportPreview(null);
        await refreshData();
      } else {
        toast(data.message || "Failed to import students.", "error");
      }
    } catch (err: any) {
      toast("Error submitting student import: " + err.message, "error");
    } finally {
      setIsStudentImportSubmitting(false);
    }
  };


  const openCorrectionModal = async (student: any) => {
    setCorrectingStudent(student);
    setStudentAttendanceLogs([]);
    setCorrectionSlotId("");
    setCorrectionDateStr("");
    setCorrectionReason("");
    setIsAdminOverride(false);
    
    try {
      const res = await fetch(`/api/attendance?studentId=${student.id}`);
      const data = await res.json();
      if (data.success) {
        setStudentAttendanceLogs(data.records || []);
        setStudentCorrectionCount(data.correctionCount || 0);
      } else {
        toast(data.message || "Failed to load attendance logs", "error");
      }
    } catch (e: any) {
      toast("Error loading attendance: " + e.message, "error");
    }
  };

  const handleSaveCorrection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!correctingStudent || !correctionSlotId || !correctionDateStr) {
      toast("Please select a session to correct.", "warning");
      return;
    }
    if (!correctionReason.trim()) {
      toast("A mandatory explanation/reason must be provided.", "warning");
      return;
    }
    
    setIsCorrectionSubmitting(true);
    try {
      const res = await correctStudentAttendance(
        correctingStudent.id,
        correctionSlotId,
        correctionDateStr,
        correctionNewStatus,
        correctionReason.trim(),
        isAdminOverride
      );
      if (res.success) {
        toast("Attendance corrected successfully!", "success");
        setCorrectingStudent(null);
        refreshData();
      } else {
        toast(res.message, "error");
      }
    } catch (err: any) {
      toast("Error submitting correction: " + err.message, "error");
    } finally {
      setIsCorrectionSubmitting(false);
    }
  };

  const [isCollapsed, setIsCollapsed] = useState(false);
  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("fp_sidebar_collapsed") === "true";
      setIsCollapsed(stored);
    }
  }, []);

  // CAM Student Tracker audit states
  const [camTrackerClass, setCamTrackerClass] = useState("");
  const [camTrackerSubject, setCamTrackerSubject] = useState("");
  const [camTrackerWeek, setCamTrackerWeek] = useState<number>(1);

  // Mentor CRUD states
  const [showMentorModal, setShowMentorModal] = useState(false);
  const [editingMentor, setEditingMentor] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [mentorSubjectSearch, setMentorSubjectSearch] = useState("");
  const [mentorForm, setMentorForm] = useState({
    id: "",
    name: "",
    email: "",
    department: "General",
    avatar: "",
    subjects: "",
    classes: "",
    shift: "general",
    college_id: "",
    subject_group: ""
  });
  const [emailSendingId, setEmailSendingId] = useState<string | null>(null);

  const handleSendWarningEmail = async (item: any) => {
    if (!item.mentor?.email) {
      toast("Mentor does not have a valid email configured.", "error");
      return;
    }
    setEmailSendingId(item.id);
    try {
      const subject = `[Zentra Warning] Missed Attendance Marking - Class: ${item.slot.classGroup}`;
      
      const res = await fetch("/api/send-mail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: item.mentor.email,
          subject,
          template: "missed_attendance",
          data: {
            mentorName: item.mentor.name,
            dateStr: item.dateStr,
            dayName: item.dayName,
            time: item.slot.time,
            course: item.slot.course,
            classGroup: item.slot.classGroup
          }
        })
      });
      
      const json = await res.json();
      if (json.success) {
        toast(`Warning email sent to ${item.mentor.name} (copied thanush@faceprep.in)`, "success");
      } else {
        toast(`Failed to send email: ${json.error || "Unknown error"}`, "error");
      }
    } catch (err: any) {
      toast(`Error: ${err.message}`, "error");
    } finally {
      setEmailSendingId(null);
    }
  };

  const handleOpenMentorModal = (m?: Mentor) => {
    setModalError(null);
    setMentorSubjectSearch("");
    if (m) {
      setMentorForm({
        id: m.id,
        name: m.name,
        email: m.email,
        department: m.department,
        avatar: m.avatar,
        subjects: m.subjects || "",
        classes: m.classes || "",
        shift: m.shift || "general",
        college_id: m.college_id || activeCollegeId,
        subject_group: m.subject_group || "General"
      });
      setEditingMentor(true);
    } else {
      setMentorForm({
        id: "m" + (mentors.length + 1),
        name: "",
        email: "",
        department: "General",
        avatar: "",
        subjects: "",
        classes: "",
        shift: "general",
        college_id: activeCollegeId,
        subject_group: "General"
      });
      setEditingMentor(false);
    }
    setShowMentorModal(true);
  };

  const handleMentorSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);
    if (!mentorForm.name.trim() || !mentorForm.email.trim() || !mentorForm.department.trim()) {
      setModalError("Name, Email, and Department are required.");
      return;
    }

    let initials = mentorForm.avatar.trim();
    if (!initials) {
      initials = mentorForm.name.split(" ").filter(Boolean).map(n => n[0]).join("").toUpperCase().slice(0, 2);
      if (!initials) initials = "M";
    }

    const payload = {
      id: mentorForm.id,
      name: mentorForm.name.trim(),
      email: mentorForm.email.trim(),
      department: mentorForm.department.trim(),
      avatar: initials,
      headerId: null,
      subjects: mentorForm.subjects.trim(),
      classes: mentorForm.classes.trim(),
      shift: mentorForm.shift as any,
      college_id: activeCollegeId,
      subject_group: mentorForm.subject_group.trim()
    };

    try {
      let res;
      if (editingMentor) {
        res = await updateMentor(payload);
      } else {
        res = await createMentor(payload);
      }
      if (res.success) {
        setShowMentorModal(false);
        toast(editingMentor ? "Mentor updated successfully." : "Mentor created successfully.", "success");
      } else {
        setModalError(res.message || "Failed to save mentor.");
      }
    } catch (err: any) {
      setModalError(err.message || "An unexpected error occurred.");
    }
  };

  const handleDeleteMentor = async (id: string) => {
    if (await showConfirm({ message: "Are you sure you want to delete this mentor? This will also delete all slots assigned to them.", danger: true, confirmLabel: "Delete" })) {
      try {
        const res = await deleteMentor(id);
        if (res.success) {
          toast("Mentor deleted successfully.", "success");
        } else {
          toast(res.message || "Failed to delete mentor.", "error");
        }
      } catch (err: any) {
        toast(err.message || "An error occurred while deleting.", "error");
      }
    }
  };

  const distinctClasses = useMemo(() => {
    const fromStudents = students.map(s => s.classGroup).filter(Boolean);
    const fromSlots = slots.map(s => s.classGroup).filter(Boolean);

    const campusCourses = coursesList.filter(c => c.college_id === activeCollegeId);
    const activeDeptNames = campusCourses.length > 0
      ? campusCourses.map(c => c.name)
      : (coursesList.length > 0 ? coursesList.map(c => c.name) : FACULTY_DEPARTMENTS);

    const sems = ["Semester 1", "Semester 2", "Semester 3", "Semester 4", "Semester 5", "Semester 6"];
    const shifts = ["Shift 1", "Shift 2"];

    const generated: string[] = [];
    activeDeptNames.forEach(deptName => {
      sems.forEach(sem => {
        generated.push(`${deptName} - ${sem}`);
        shifts.forEach(sh => {
          generated.push(`${deptName} - ${sh} - ${sem}`);
        });
      });
    });

    return Array.from(new Set([...fromStudents, ...fromSlots, ...generated])).sort();
  }, [students, slots, coursesList, activeCollegeId]);
  const collegeSubjects = subjectsList.filter(s => s.college_id === activeCollegeId);

  useEffect(() => {
    if (distinctClasses.length > 0 && !camTrackerClass) {
      setCamTrackerClass(distinctClasses[0] || "");
    }
    if (collegeSubjects.length > 0 && !camTrackerSubject) {
      setCamTrackerSubject(collegeSubjects[0].name);
    }
  }, [distinctClasses, collegeSubjects, camTrackerClass, camTrackerSubject]);

  // States for divided cohort filters
  const [selectedCohortCourse, setSelectedCohortCourse] = useState("");
  const [selectedCohortSem, setSelectedCohortSem] = useState("");

  // 1. Academic Configuration states
  const academicYears = dbAcademicYears;
  const [selectedYear, setSelectedYear] = useState("2026-2027");
  const [workingDays, setWorkingDays] = useState<string[]>(["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]);
  
  useEffect(() => {
    const activeCollege = colleges.find(c => c.id === activeCollegeId);
    const daysCount = activeCollege?.working_days !== undefined ? Number(activeCollege.working_days) : 5;
    if (daysCount === 6) {
      setWorkingDays(["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]);
    } else {
      setWorkingDays(["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]);
    }
  }, [activeCollegeId, colleges]);

  const [collegeHours, setCollegeHours] = useState({ start: "08:30 AM", end: "04:30 PM" });

  // Daily Day Type & Day Order Config states
  const [dailyDateStr, setDailyDateStr] = useState(new Date().toISOString().split("T")[0]);
  const [dailyDayType, setDailyDayType] = useState<"regular" | "special" | "holiday" | "event" | "exam_day">("regular");
  const [dailyDayOrder, setDailyDayOrder] = useState("Day 1");
  const [dailySessionMode, setDailySessionMode] = useState<"Online" | "Offline">("Offline");
  const [dailyNotes, setDailyNotes] = useState("");
  const [dailyConfigsList, setDailyConfigsList] = useState<any[]>([]);
  const [isDailyLoading, setIsDailyLoading] = useState(false);
  const [isDailySaving, setIsDailySaving] = useState(false);

  useEffect(() => {
    const daysLimit = workingDays.length > 0 ? workingDays.length : 5;
    const match = dailyDayOrder.match(/^Day (\d+)$/);
    if (match) {
      const orderNum = parseInt(match[1]);
      if (orderNum > daysLimit) {
        setDailyDayOrder("Day 1");
      }
    }
  }, [workingDays, dailyDayOrder]);

  // Year Editing
  const [editingYearIndex, setEditingYearIndex] = useState<number | null>(null);
  const [editingYearValue, setEditingYearValue] = useState("");
  const [newYearName, setNewYearName] = useState("");

  // Event CRUD states
  const academicEvents = dbAcademicEvents;
  const [calendarEventName, setCalendarEventName] = useState("");
  const [calendarEventDate, setCalendarEventDate] = useState("");
  const [calendarEventDesc, setCalendarEventDesc] = useState("");
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [searchEventQuery, setSearchEventQuery] = useState("");

  // Inline Event Edit states
  const [editEventName, setEditEventName] = useState("");
  const [editEventDate, setEditEventDate] = useState("");
  const [editEventDesc, setEditEventDesc] = useState("");

  // 2. Curriculum & Subjects states
  const [currName, setCurrName] = useState("");
  const [currCredits, setCurrCredits] = useState(4);
  const [currHours, setCurrHours] = useState(4);
  const [currType, setCurrType] = useState("theory");
  const [currDept, setCurrDept] = useState("General");
  const [currSemester, setCurrSemester] = useState("Semester 1");
  const [currYear, setCurrYear] = useState("2026-2027");
  const [currShift, setCurrShift] = useState("General");
  const [editingSubjectId, setEditingSubjectId] = useState<string | null>(null);

  // Inline Subject Edit states
  const [editSubName, setEditSubName] = useState("");
  const [editSubHours, setEditSubHours] = useState(4);
  const [editSubType, setEditSubType] = useState("theory");
  const [editSubDept, setEditSubDept] = useState("General");
  const [editSubSemester, setEditSubSemester] = useState("Semester 1");
  const [editSubYear, setEditSubYear] = useState("2026-2027");
  const [editSubShift, setEditSubShift] = useState("General");

  // Sub-Tab configuration inside curriculum mapping page
  const [curriculumSubTab, setCurriculumSubTab] = useState<"subjects" | "departments">("subjects");
  // Sub-Tab configuration inside timetables page
  const [timetableSubTab, setTimetableSubTab] = useState<"view" | "generate">("view");
  // Modal/drawer open state for add forms
  const [showAddSubjectForm, setShowAddSubjectForm] = useState(false);
  const [showAddDeptForm, setShowAddDeptForm] = useState(false);

  // Departments Configuration form states
  const [deptName, setDeptName] = useState("");
  const [deptCode, setDeptCode] = useState("");
  const [deptDesc, setDeptDesc] = useState("");
  const [deptShift, setDeptShift] = useState("shift_1");
  const [editingDeptId, setEditingDeptId] = useState<string | null>(null);

  // Inline Department Edit states
  const [editDeptName, setEditDeptName] = useState("");
  const [editDeptCode, setEditDeptCode] = useState("");
  const [editDeptDesc, setEditDeptDesc] = useState("");
  const [editDeptShift, setEditDeptShift] = useState("shift_1");

  // Curriculum Filters
  const [subjectSearch, setSubjectSearch] = useState("");
  const [subjectTypeFilter, setSubjectTypeFilter] = useState("all");
  const [subjectDeptFilter, setSubjectDeptFilter] = useState("all");
  const [subjectShiftFilter, setSubjectShiftFilter] = useState("all");
  const [expandedDepts, setExpandedDepts] = useState<Record<string, boolean>>({});
  const [expandedSems, setExpandedSems] = useState<Record<string, boolean>>({});

  // 3. Faculty Allocation states
  const facultyWorkloadLimits = dbWorkloadLimits;
  const facultyShifts = dbShifts;
  const [editingFacultyId, setEditingFacultyId] = useState<string | null>(null);
  const [editingWorkloadVal, setEditingWorkloadVal] = useState(16);
  const [editingShiftVal, setEditingShiftVal] = useState("general");

  // Faculty Filters
  const [facultySearch, setFacultySearch] = useState("");
  const [facultyDeptFilter, setFacultyDeptFilter] = useState("all");
  const [showSubstitutionModal, setShowSubstitutionModal] = useState(false);

  // 4. Timetables & Rooms states
  const [timetableVersions, setTimetableVersions] = useState<Array<{ sem: string, ver: string, date: string }>>([
    { sem: "Semester I", ver: "v1.2", date: "2026-06-20" },
    { sem: "Semester III", ver: "v1.0", date: "2026-06-15" }
  ]);
  const [selectedDay, setSelectedDay] = useState("Monday");
  const [selectedPeriod, setSelectedPeriod] = useState("9.00 AM - 10.00 AM");

  // Timetable Sandbox booking form
  const [bookingMentor, setBookingMentor] = useState("");
  const [bookingRoom, setBookingRoom] = useState("");
  const [bookingCourse, setBookingCourse] = useState("");
  const [bookingCohort, setBookingCohort] = useState("");
  const [bookingDay, setBookingDay] = useState("Monday");
  const [bookingTime, setBookingTime] = useState("9.00 AM - 10.00 AM");
  const [bookingError, setBookingError] = useState("");
  const [bookingSuccess, setBookingSuccess] = useState("");

  // Slots List Filters
  const [slotDayFilter, setSlotDayFilter] = useState("all");
  const [slotRoomFilter, setSlotRoomFilter] = useState("all");
  const [slotCohortFilter, setSlotCohortFilter] = useState("all");
  const [slotSearch, setSlotSearch] = useState("");

  // Timetable Generator states (curriculum-driven)
  const [genSelectedCourse, setGenSelectedCourse] = useState("");
  const [genSelectedSemester, setGenSelectedSemester] = useState("Semester 1");
  const [genClassGroup, setGenClassGroup] = useState("");
  const [genRoom, setGenRoom] = useState("");
  const [genShift, setGenShift] = useState<"shift_1" | "shift_2" | "general">("general");
  const [genStep, setGenStep] = useState<1 | 2 | 3>(1);
  const [showCustomTarget, setShowCustomTarget] = useState(false);
  const [genAllocations, setGenAllocations] = useState<Array<{
    subjectId: string; subjectName: string; mentorId: string;
    weeklyHours: number; room: string; isSelected: boolean;
    subjectType?: string; isNew?: boolean; subjectDept?: string;
    subjectGroup?: string;
  }>>([]);
  const [genPreviewSlots, setGenPreviewSlots] = useState<any[]>([]);
  const [genUnscheduled, setGenUnscheduled] = useState<Array<{ subject: string; hours: number }>>([]);
  const [genError, setGenError] = useState("");
  const [genSuccess, setGenSuccess] = useState("");
  const [genLoading, setGenLoading] = useState(false);
  const [initializedCollegeId, setInitializedCollegeId] = useState("");
  const [viewerClassGroup, setViewerClassGroup] = useState("");
  const [viewerShift, setViewerShift] = useState<"shift_1" | "shift_2" | "general">("general");

  // Quick Add Subject states in Generator
  const [showQuickAddForm, setShowQuickAddForm] = useState(false);
  const [quickSubName, setQuickSubName] = useState("");
  const [quickSubHours, setQuickSubHours] = useState(4);
  const [quickSubRoom, setQuickSubRoom] = useState("");
  const [quickSubMentorId, setQuickSubMentorId] = useState("");
  const [quickSubType, setQuickSubType] = useState("theory");

  // 5. Academic Monitoring states
  const [studentSearch, setStudentSearch] = useState("");
  const [studentDeptFilter, setStudentDeptFilter] = useState("all");
  const [studentBatchFilter, setStudentBatchFilter] = useState("all");
  const [studentAttendanceFilter, setStudentAttendanceFilter] = useState("all");

  // 6. Tasks & Issues states
  const localTasks = localTasksFromDB;
  const issues = localIssuesFromDB;
  const [issueTitle, setIssueTitle] = useState("");
  const [issueType, setIssueType] = useState("academic");
  const [issuePriority, setIssuePriority] = useState("high");
  const [issueDesc, setIssueDesc] = useState("");
  const [editingIssueId, setEditingIssueId] = useState<string | null>(null);

  // Inline Issue Edit states
  const [editIssueTitle, setEditIssueTitle] = useState("");
  const [editIssueDesc, setEditIssueDesc] = useState("");
  const [editIssueType, setEditIssueType] = useState("academic");
  const [editIssuePriority, setEditIssuePriority] = useState("high");

  // Issues Filters
  const [issueStatusFilter, setIssueStatusFilter] = useState("all");
  const [issueTypeFilter, setIssueTypeFilter] = useState("all");
  const [issueSearchQuery, setIssueSearchQuery] = useState("");
  const [allowedProfileEditClasses, setAllowedProfileEditClasses] = useState<string[]>([]);

  // Handover Review States
  const [reviewingRequestId, setReviewingRequestId] = useState<string | null>(null);
  const [reviewReason, setReviewReason] = useState("");
  const [handoverSubject, setHandoverSubject] = useState<string>("original");
  const [selectedSubjName, setSelectedSubjName] = useState<string>("");
  const [customSubjName, setCustomSubjName] = useState<string>("");
  // Load and save state
  useEffect(() => {
    // Allowed Student Profile Edit Classes
    const savedEditClasses = localStorage.getItem("fp_allowed_profile_edit_classes");
    if (savedEditClasses) {
      setAllowedProfileEditClasses(JSON.parse(savedEditClasses));
    }
  }, []);

  useEffect(() => {
    if (academicYears.length > 0 && !academicYears.includes(selectedYear)) {
      setSelectedYear(academicYears[0]);
      setCurrYear(academicYears[0]);
      setEditSubYear(academicYears[0]);
    }
  }, [academicYears, selectedYear]);

  // Derived filters and variables
  const collegeMentors = useMemo(() => mentors.filter(m => m.college_id === activeCollegeId), [mentors, activeCollegeId]);
  const collegeStudents = useMemo(() => students.filter(s => s.college_id === activeCollegeId), [students, activeCollegeId]);
  const collegeCourses = useMemo(() => coursesList.filter(c => c.college_id === activeCollegeId), [coursesList, activeCollegeId]);

  const collegeSlots = useMemo(() => {
    return slots.filter(s => {
      if (s.college_id) return s.college_id === activeCollegeId;
      const m = mentors.find(item => item.id === s.mentorId);
      return m && m.college_id === activeCollegeId;
    });
  }, [slots, mentors, activeCollegeId]);

  const activeBatches = useMemo(() => {
    return Array.from(new Set(collegeSlots.map(s => s.classGroup).filter((g): g is string => Boolean(g))));
  }, [collegeSlots]);

  const classrooms = useMemo(() => {
    const activeCol = colleges.find(c => c.id === activeCollegeId);
    const colRooms = activeCol?.rooms ? parseRoomsList(activeCol.rooms) : [];
    const slotRooms = collegeSlots.map(s => s.location).filter(Boolean);
    return Array.from(new Set([...colRooms, ...slotRooms])).map(r => r.replace(/[\[\]"]/g, "").trim()).filter(Boolean);
  }, [collegeSlots, colleges, activeCollegeId]);

  const facultyDepts = useMemo(() => {
    return Array.from(new Set(collegeMentors.map(m => m.department?.trim()).filter(Boolean))).sort();
  }, [collegeMentors]);

  const studentDepts = useMemo(() => {
    return Array.from(new Set(collegeStudents.map(s => s.department?.trim()).filter(Boolean))).sort();
  }, [collegeStudents]);

  const depts = useMemo(() => {
    return Array.from(new Set([...facultyDepts, ...studentDepts])).sort();
  }, [facultyDepts, studentDepts]);

  const activeHandovers = useMemo(() => {
    return requests.filter(r =>
      r.status === "pending" &&
      mentors.find(m => m.id === r.requestorId)?.college_id === activeCollegeId
    );
  }, [requests, mentors, activeCollegeId]);



  // Re-sync divided dropdown states when activeBatches or activeCollegeId changes
  useEffect(() => {
    if (activeBatches.length > 0) {
      // Get unique courses
      const courses = Array.from(new Set(activeBatches.map(cg => {
        const slot = collegeSlots.find(s => s.classGroup === cg);
        return slot?.department || getCourseFromClassGroup(cg);
      }).filter(Boolean)));
      
      let defaultCourse = selectedCohortCourse;
      if (!defaultCourse || !courses.includes(defaultCourse)) {
        defaultCourse = courses[0] || "";
      }
      setSelectedCohortCourse(defaultCourse);
      
      // Get sems for this defaultCourse
      const semsForCourse = activeBatches
        .filter(cg => {
          const slot = collegeSlots.find(s => s.classGroup === cg);
          const c = slot?.department || getCourseFromClassGroup(cg);
          return c === defaultCourse;
        })
        .map(cg => {
          const slot = collegeSlots.find(s => s.classGroup === cg);
          return slot?.semester || getSemesterFromClassGroup(cg);
        });
      
      let defaultSem = selectedCohortSem;
      if (!defaultSem || !semsForCourse.includes(defaultSem)) {
        defaultSem = semsForCourse[0] || "";
      }
      setSelectedCohortSem(defaultSem);
      
      // Find matching genClassGroup
      const matched = activeBatches.find(cg => {
        const slot = collegeSlots.find(s => s.classGroup === cg);
        const c = slot?.department || getCourseFromClassGroup(cg);
        if (c !== defaultCourse) return false;
        
        const s = slot?.semester || getSemesterFromClassGroup(cg);
        return s === defaultSem;
      });
      
      setViewerClassGroup(matched || activeBatches[0] || "");
    } else {
      setSelectedCohortCourse("");
      setSelectedCohortSem("");
      setViewerClassGroup("");
    }
    setInitializedCollegeId("");
  }, [activeBatches, activeCollegeId, collegeSlots]);

  // Handle manual selection changes
  const handleCohortCourseChange = (course: string) => {
    setSelectedCohortCourse(course);
    // Find sems for this course
    const sems = activeBatches
      .filter(cg => {
        const slot = collegeSlots.find(s => s.classGroup === cg);
        const c = slot?.department || getCourseFromClassGroup(cg);
        return c === course;
      })
      .map(cg => {
        const slot = collegeSlots.find(s => s.classGroup === cg);
        return slot?.semester || getSemesterFromClassGroup(cg);
      });
    const firstSem = sems[0] || "";
    setSelectedCohortSem(firstSem);
    
    const matched = activeBatches.find(cg => {
      const slot = collegeSlots.find(s => s.classGroup === cg);
      const c = slot?.department || getCourseFromClassGroup(cg);
      if (c !== course) return false;
      
      const s = slot?.semester || getSemesterFromClassGroup(cg);
      return s === firstSem;
    });
    setViewerClassGroup(matched || "");
  };

  const handleCohortSemChange = (sem: string) => {
    setSelectedCohortSem(sem);
    const matched = activeBatches.find(cg => {
      const slot = collegeSlots.find(s => s.classGroup === cg);
      const c = slot?.department || getCourseFromClassGroup(cg);
      if (c !== selectedCohortCourse) return false;
      
      const s = slot?.semester || getSemesterFromClassGroup(cg);
      return s === sem;
    });
    setViewerClassGroup(matched || "");
  };

  // Auto select first valid shift for the selected class group in viewer
  useEffect(() => {
    if (viewerClassGroup) {
      const validShifts = (["shift_1", "shift_2", "general"] as const).filter(sh => {
        const hasSlots = collegeSlots.some(s => s.classGroup === viewerClassGroup && s.shift === sh);
        if (hasSlots) return true;
        const nameLower = viewerClassGroup.toLowerCase();
        if (sh === "shift_1" && (nameLower.includes("shift 1") || nameLower.includes("shift_1") || nameLower.includes("shift1"))) return true;
        if (sh === "shift_2" && (nameLower.includes("shift 2") || nameLower.includes("shift_2") || nameLower.includes("shift2"))) return true;
        if (sh === "general" && (nameLower.includes("general") || (!nameLower.includes("shift 1") && !nameLower.includes("shift 2") && !nameLower.includes("shift1") && !nameLower.includes("shift2")))) return true;
        return false;
      });
      if (validShifts.length > 0 && !validShifts.includes(viewerShift)) {
        setViewerShift(validShifts[0]);
      }
    }
  }, [viewerClassGroup, viewerShift, collegeSlots]);

  // Helper to auto calculate semester based on current year/month and course start_date
  const calculateSemesterForCourse = (courseObj: any): string => {
    if (!courseObj || !courseObj.start_date) return "Semester 1";
    try {
      const startDate = new Date(courseObj.start_date);
      const startYear = startDate.getFullYear();
      const currentDate = new Date();
      const currentYear = currentDate.getFullYear();
      const currentMonth = currentDate.getMonth() + 1; // 1-12

      let yearIndex = currentYear - startYear;
      if (currentMonth < 6) {
        yearIndex = yearIndex - 1;
      }
      yearIndex = Math.max(0, yearIndex);

      // Odd semester runs June (6) to November (11)
      // Even semester runs December (12) to May (5)
      const isOddMonth = currentMonth >= 6 && currentMonth <= 11;
      const semNum = isOddMonth ? (2 * yearIndex + 1) : (2 * yearIndex + 2);
      
      const totalYears = courseObj.years || 3;
      const maxSem = totalYears * 2;
      const finalSemNum = Math.min(maxSem, Math.max(1, semNum));
      return `Semester ${finalSemNum}`;
    } catch (e) {
      console.error("Error auto calculating semester:", e);
      return "Semester 1";
    }
  };

  // Controlled single-run initialization of generator values when campus/data loads
  useEffect(() => {
    if (activeCollegeId && activeCollegeId !== initializedCollegeId && collegeCourses.length > 0 && classrooms.length > 0) {
      const defaultCourse = collegeCourses[0].name;
      setGenSelectedCourse(defaultCourse);
      
      const courseObj = collegeCourses.find(c => c.name === defaultCourse);
      const calculatedSem = calculateSemesterForCourse(courseObj);
      setGenSelectedSemester(calculatedSem);

      const startYear = courseObj?.start_year || "";
      const endYear = courseObj?.end_year || "";
      const batchSuffix = startYear && endYear ? ` (${startYear}-${endYear})` : "";
      const shiftText = genShift === "shift_1" ? " - Shift 1" : genShift === "shift_2" ? " - Shift 2" : "";

      setGenClassGroup(`${defaultCourse}${shiftText} - ${calculatedSem}${batchSuffix}`);
      
      setGenRoom(resolveCourseRoom(courseObj, calculatedSem));
      setInitializedCollegeId(activeCollegeId);
    }
  }, [activeCollegeId, collegeCourses, classrooms, initializedCollegeId, genShift]);



  const getStudentAttendanceStats = (studentId: string) => {
    const records = (studentAttendance || []).filter(a => a.studentId === studentId);
    if (records.length === 0) {
      const hash = studentId.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
      const mockPct = 60 + (hash % 36);
      return { percentage: mockPct, total: 24, attended: Math.round((24 * mockPct) / 100) };
    }
    const attended = records.filter(r => r.status === "present").length;
    const total = records.length;
    return { percentage: Math.round((attended / total) * 100), total, attended };
  };

  // --- ACTIONS: ACADEMIC YEARS CRUD ---
  const handleAddYear = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newYearName.trim() || academicYears.includes(newYearName.trim())) return;
    const res = await saveAcademicYear(newYearName.trim());
    if (res.success) {
      setNewYearName("");
      toast("Academic year added successfully.", "success");
    } else {
      toast(res.message || "Failed to add academic year", "error");
    }
  };

  const handleEditYear = (index: number) => {
    setEditingYearIndex(index);
    setEditingYearValue(academicYears[index]);
  };

  const handleSaveYear = async (index: number) => {
    if (!editingYearValue.trim()) return;
    const oldYear = academicYears[index];
    const newYear = editingYearValue.trim();
    // Recreate
    await deleteAcademicYear(oldYear);
    const res = await saveAcademicYear(newYear);
    if (res.success) {
      setEditingYearIndex(null);
      toast("Academic year updated successfully.", "success");
    } else {
      toast(res.message || "Failed to update academic year", "error");
    }
  };

  const handleDeleteYear = async (index: number) => {
    if (await showConfirm({ message: "Delete this academic year definition?", danger: true, confirmLabel: "Delete" })) {
      const oldYear = academicYears[index];
      const res = await deleteAcademicYear(oldYear);
      if (res.success) {
        toast("Academic year deleted successfully.", "success");
        if (selectedYear === oldYear && academicYears.length > 1) {
          const remaining = academicYears.filter(y => y !== oldYear);
          setSelectedYear(remaining[0]);
        }
      } else {
        toast(res.message || "Failed to delete academic year", "error");
      }
    }
  };

  // --- ACTIONS: CALENDAR EVENTS CRUD ---
  const handleSaveEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!calendarEventName.trim() || !calendarEventDate) return;

    const newEvent = {
      name: calendarEventName,
      date: calendarEventDate,
      desc: calendarEventDesc
    };
    const res = await saveAcademicEvent(newEvent);
    if (res.success) {
      setCalendarEventName("");
      setCalendarEventDate("");
      setCalendarEventDesc("");
      toast("Calendar Milestone added successfully.", "success");
    } else {
      toast(res.message || "Failed to save event", "error");
    }
  };

  const handleStartEditEvent = (ev: any) => {
    setEditingEventId(ev.id);
    setEditEventName(ev.name);
    setEditEventDate(ev.date);
    setEditEventDesc(ev.desc || "");
  };

  const handleSaveInlineEvent = async (e: React.FormEvent, id: string) => {
    e.preventDefault();
    if (!editEventName.trim() || !editEventDate) return;

    const res = await saveAcademicEvent({
      id,
      name: editEventName,
      date: editEventDate,
      desc: editEventDesc
    });
    if (res.success) {
      setEditingEventId(null);
      toast("Calendar Milestone updated successfully.", "success");
    } else {
      toast(res.message || "Failed to update event", "error");
    }
  };

  const handleDeleteEvent = async (id: string) => {
    if (await showConfirm({ message: "Remove this calendar event?", danger: true, confirmLabel: "Remove" })) {
      const res = await deleteAcademicEvent(id);
      if (res.success) {
        toast("Calendar Milestone removed successfully.", "success");
      } else {
        toast(res.message || "Failed to delete event", "error");
      }
    }
  };

  // --- ACTIONS: SUBJECT CURRICULUM CRUD ---
  const handleSaveSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currName.trim()) return;

    const subjectData = {
      name: currName.trim(),
      department: currDept,
      semester: currSemester,
      type: currType,
      college_id: activeCollegeId,
      year: currYear,
      weekly_hours: currHours,
      shift: currShift
    };

    const res = await createSubject(subjectData);
    if (res.success) {
      setCurrName("");
      setCurrHours(4);
      setCurrShift("General");
      toast("Subject created in database successfully.", "success");
    } else {
      toast("Error creating subject: " + res.message, "error");
    }
  };

  const handleStartEditSubject = (sub: any) => {
    setEditingSubjectId(sub.id);
    setEditSubName(sub.name);
    setEditSubHours(sub.weekly_hours || 4);
    setEditSubType(sub.type || "theory");
    setEditSubDept(sub.department || "General");
    setEditSubSemester(sub.semester || "Semester I");
    setEditSubYear(sub.year || selectedYear);
    setEditSubShift(sub.shift || "General");
  };

  const handleSaveInlineSubject = async (e: React.FormEvent, id: string) => {
    e.preventDefault();
    if (!editSubName.trim()) return;

    const res = await updateSubject({
      id,
      name: editSubName.trim(),
      department: editSubDept,
      semester: editSubSemester,
      type: editSubType,
      college_id: activeCollegeId,
      year: editSubYear,
      weekly_hours: editSubHours,
      shift: editSubShift
    });

    if (res.success) {
      setEditingSubjectId(null);
      toast("Subject updated in database successfully.", "success");
    } else {
      toast("Error updating subject: " + res.message, "error");
    }
  };

  const handleDeleteSubject = async (id: string) => {
    if (await showConfirm({ message: "Delete this subject from database?", danger: true, confirmLabel: "Delete" })) {
      const res = await deleteSubject(id);
      if (res.success) {
        toast("Subject deleted from database successfully.", "success");
      } else {
        toast("Error deleting subject: " + res.message, "error");
      }
    }
  };

  // --- ACTIONS: DEPARTMENTS / COURSES CRUD ---
  const handleSaveDept = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deptName.trim()) return;

    const deptData = {
      name: deptName.trim(),
      code: deptCode.trim(),
      description: deptDesc.trim(),
      college_id: activeCollegeId,
      hod_name: "",
      established_year: "",
      status: "Active",
      years: 4,
      start_date: "",
      end_date: "",
      start_year: "",
      end_year: "",
      default_shift: deptShift,
      shift_based: deptShift === "both" || deptShift === "general" ? 1 : 0
    };

    const res = await createCourse(deptData);
    if (res.success) {
      setDeptName("");
      setDeptCode("");
      setDeptDesc("");
      setDeptShift("shift_1");
      toast("Department created in database successfully.", "success");
    } else {
      toast("Error creating department: " + res.message, "error");
    }
  };

  const handleStartEditDept = (dept: any) => {
    setEditingDeptId(dept.id);
    setEditDeptName(dept.name);
    setEditDeptCode(dept.code || "");
    setEditDeptDesc(dept.description || "");
    setEditDeptShift(dept.default_shift || (dept.shift_based ? "both" : "shift_1"));
  };

  const handleSaveInlineDept = async (e: React.FormEvent, id: string) => {
    e.preventDefault();
    if (!editDeptName.trim()) return;

    const res = await updateCourse({
      id,
      name: editDeptName.trim(),
      code: editDeptCode.trim(),
      description: editDeptDesc.trim(),
      college_id: activeCollegeId,
      hod_name: "",
      established_year: "",
      status: "Active",
      years: 4,
      start_date: "",
      end_date: "",
      start_year: "",
      end_year: "",
      default_shift: editDeptShift,
      shift_based: editDeptShift === "both" || editDeptShift === "general" ? 1 : 0
    });

    if (res.success) {
      setEditingDeptId(null);
      toast("Department updated in database successfully.", "success");
    } else {
      toast("Error updating department: " + res.message, "error");
    }
  };

  const handleDeleteDept = async (id: string) => {
    if (await showConfirm({ title: "Delete Department", message: "Are you sure you want to delete this department?\n\nThis will permanently delete all associated mentors, students, subjects, slots, and attendance records. This action cannot be undone.", danger: true, confirmLabel: "Delete Department" })) {
      const res = await deleteCourse(id);
      if (res.success) {
        const counts = res.deletedCounts;
        if (counts && (counts.slots > 0 || counts.students > 0 || counts.mentors > 0)) {
          toast(`Department deleted. Cascade removed: ${counts.slots} slot(s), ${counts.students} student(s), ${counts.mentors} mentor(s), ${counts.subjects} subject(s).`, "info");
        } else {
          toast("Department deleted successfully.", "success");
        }
      } else {
        toast("Error deleting department: " + res.message, "error");
      }
    }
  };

  // --- ACTIONS: FACULTY WORKLOAD CRUD ---
  const handleStartEditFaculty = (m: Mentor) => {
    setEditingFacultyId(m.id);
    setEditingWorkloadVal(facultyWorkloadLimits[m.id] || 16);
    setEditingShiftVal(facultyShifts[m.id] || m.shift || "general");
  };

  const handleSaveFacultyConfig = async (id: string) => {
    const res = await saveFacultyConfig(id, editingWorkloadVal, editingShiftVal);
    if (res.success) {
      setEditingFacultyId(null);
      toast("Faculty configurations saved successfully.", "success");
    } else {
      toast(res.message || "Failed to save configurations", "error");
    }
  };

  // --- ACTIONS: TIMETABLE SLOT CRUD ---
  const handleSandboxBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    setBookingError("");
    setBookingSuccess("");

    if (!bookingMentor || !bookingRoom.trim() || !bookingCourse.trim() || !bookingCohort.trim()) {
      setBookingError("All fields are required to process slot booking.");
      return;
    }

    const mentorObj = mentors.find(m => m.id === bookingMentor);
    if (!mentorObj) return;

    // Check collision
    const mentorClash = slots.find(s => s.mentorId === bookingMentor && s.day === bookingDay && s.time === bookingTime);
    if (mentorClash) {
      setBookingError(`Conflict: Mentor ${mentorObj.name} is already teaching "${mentorClash.course}" at this slot.`);
      return;
    }

    const roomClash = slots.find(s => s.day === bookingDay && s.time === bookingTime && s.location.toLowerCase() === bookingRoom.trim().toLowerCase());
    if (roomClash) {
      const clsMentor = mentors.find(m => m.id === roomClash.mentorId);
      setBookingError(`Conflict: Classroom "${bookingRoom.trim()}" is already booked for "${roomClash.course}" (Taught by: ${clsMentor?.name || "Faculty"}).`);
      return;
    }

    const cohortClash = slots.find(s => s.day === bookingDay && s.time === bookingTime && s.classGroup?.toLowerCase() === bookingCohort.trim().toLowerCase());
    if (cohortClash) {
      setBookingError(`Conflict: Student Group "${bookingCohort.trim()}" is already attending "${cohortClash.course}" at this time.`);
      return;
    }

    await assignSlot(bookingMentor, bookingDay, bookingTime, bookingCourse.trim(), bookingRoom.trim(), bookingCohort.trim());
    setBookingSuccess(`Success: Class scheduled cleanly! Room ${bookingRoom} booked for ${bookingCohort}.`);
    setBookingRoom("");
    setBookingCourse("");
    setBookingCohort("");
    refreshData();
  };

  const handleDeleteSlot = async (slotId: string) => {
    if (await showConfirm({ message: "Are you sure you want to delete this schedule slot from database?", danger: true, confirmLabel: "Delete Slot" })) {
      await deleteSlot(slotId);
      refreshData();
      toast("Timetable slot deleted successfully.", "success");
    }
  };

  const handleRegenerateSemester = (sem: string) => {
    toast(`Timetable for ${sem} has been successfully regenerated and published. Active collisions resolved.`, "success");
    refreshData();
  };

  const handlePublishTimetable = (sem: string) => {
    const version = "v" + (1 + Math.random() * 2).toFixed(1);
    const newVer = { sem, ver: version, date: new Date().toISOString().slice(0, 10) };
    setTimetableVersions([newVer, ...timetableVersions.filter(v => v.sem !== sem)]);
    toast(`Successfully published version ${version} of schedule for ${sem}.`, "success");
  };

  const fetchDailyConfigs = async () => {
    if (!activeCollegeId) return;
    setIsDailyLoading(true);
    try {
      const res = await fetch(`/api/daily-configs?college_id=${activeCollegeId}`);
      const data = await res.json();
      if (data.success) {
        setDailyConfigsList(data.configs || []);
      }
    } catch (e: any) {
      console.error("Error fetching daily configs:", e);
    } finally {
      setIsDailyLoading(false);
    }
  };

  const handleSaveDailyConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCollegeId) return;
    setIsDailySaving(true);
    try {
      const res = await fetch("/api/daily-configs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          college_id: activeCollegeId,
          dateStr: dailyDateStr,
          day_type: dailyDayType,
          day_order: dailyDayType === "holiday" ? "None" : dailyDayOrder,
          session_mode: dailySessionMode,
          notes: dailyNotes
        })
      });
      const data = await res.json();
      if (data.success) {
        toast("Daily day order configuration saved successfully.", "success");
        setDailyNotes("");
        await fetchDailyConfigs();
      } else {
        toast(data.message || "Failed to save daily config.", "error");
      }
    } catch (err: any) {
      toast("Error saving daily config: " + err.message, "error");
    } finally {
      setIsDailySaving(false);
    }
  };

  useEffect(() => {
    fetchDailyConfigs();
  }, [activeCollegeId]);

  const handleRegenerateClick = () => {
    setTimetableSubTab("generate");
    setGenSelectedCourse(selectedCohortCourse);
    setGenSelectedSemester(selectedCohortSem);
    setGenClassGroup(viewerClassGroup);
    setGenShift(viewerShift);

    const existingSlot = collegeSlots.find(s => s.classGroup === viewerClassGroup);
    if (existingSlot && existingSlot.location) {
      setGenRoom(existingSlot.location);
    } else {
      setGenRoom(classrooms[0] || "Room 101");
    }
    setGenStep(1);
    setGenError("");
    setGenSuccess("");
  };

  const handleClearTimetableClick = async () => {
    if (!viewerClassGroup) return;
    if (await showConfirm({ title: "Clear Timetable", message: `Are you sure you want to delete and clear the entire timetable for "${viewerClassGroup}"? This will permanently release all scheduled periods and cannot be undone.`, danger: true, confirmLabel: "Clear Timetable" })) {
      try {
        const res = await clearTimetable(viewerClassGroup);
        if (res.success) {
          toast(`Successfully cleared all slots for ${viewerClassGroup}.`, "success");
        } else {
          toast(`Error clearing timetable: ${res.message}`, "error");
        }
      } catch (err: any) {
        toast(`An error occurred: ${err.message}`, "error");
      }
    }
  };

  const handleDownloadGridTemplate = async () => {
    const isGenTab = timetableSubTab === "generate";
    const classGroup = isGenTab ? genClassGroup : viewerClassGroup;
    const activeCollege = colleges.find(c => c.id === activeCollegeId);
    const hasShifts = activeCollege ? activeCollege.has_shifts !== 0 : true;
    const activeShift = isGenTab ? genShift : (hasShifts ? viewerShift : "general");
    const activeSem = isGenTab ? genSelectedSemester : selectedCohortSem;

    if (!classGroup) {
      toast("Please select a class group or enter a cohort name first.", "warning");
      return;
    }

    const days = workingDays.length > 0 ? workingDays : ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
    const timeSlots = getTimeSlots(activeShift, activeSem);

    // Initialize Workbook
    const workbook = new ExcelJS.Workbook();

    // 1. Create Sheet 2: Subjects first so other sheets can reference it!
    const wsSubjects = workbook.addWorksheet("Subjects");
    wsSubjects.columns = [
      { header: "Subject Name", key: "name", width: 35 },
      { header: "Type", key: "type", width: 15 },
      { header: "Weekly Hours (Target)", key: "hours", width: 22 },
      { header: "Scheduled Hours", key: "scheduled", width: 18 },
      { header: "Status", key: "status", width: 20 }
    ];

    const getCleanSemKey = (sem?: string) => {
      if (!sem) return "";
      const clean = sem.toLowerCase().trim();
      if (clean.includes("sem i") || clean.includes("sem 1") || clean.includes("semester 1") || clean.includes("semester i")) return "Semester 1";
      if (clean.includes("sem ii") || clean.includes("sem 2") || clean.includes("semester 2") || clean.includes("semester ii")) return "Semester 2";
      if (clean.includes("sem iii") || clean.includes("sem 3") || clean.includes("semester 3") || clean.includes("semester iii")) return "Semester 3";
      if (clean.includes("sem iv") || clean.includes("sem 4") || clean.includes("semester 4") || clean.includes("semester iv")) return "Semester 4";
      if (clean.includes("sem v") || clean.includes("sem 5") || clean.includes("semester 5") || clean.includes("semester v")) return "Semester 5";
      if (clean.includes("sem vi") || clean.includes("sem 6") || clean.includes("semester 6") || clean.includes("semester vi")) return "Semester 6";
      if (clean.includes("sem vii") || clean.includes("sem 7") || clean.includes("semester 7") || clean.includes("semester vii")) return "Semester 7";
      if (clean.includes("sem viii") || clean.includes("sem 8") || clean.includes("semester 8") || clean.includes("semester viii")) return "Semester 8";
      return sem;
    };

    const deptSubjects = subjectsList.filter(
      s => s.college_id === activeCollegeId && 
           getCleanSemKey(s.semester) === getCleanSemKey(activeSem)
    );

    const lastColLetter = String.fromCharCode(65 + timeSlots.length);
    const endRow = days.length + 1;

    for (let rowNum = 2; rowNum <= 100; rowNum++) {
      const idx = rowNum - 2;
      const prePopulated = deptSubjects[idx];
      
      const row = wsSubjects.getRow(rowNum);
      if (prePopulated) {
        row.getCell(1).value = prePopulated.name;
        row.getCell(2).value = prePopulated.type || "SKILL";
        row.getCell(3).value = prePopulated.weekly_hours || 4;
      } else {
        row.getCell(1).value = "";
        row.getCell(2).value = "";
        row.getCell(3).value = "";
      }
      row.getCell(4).value = { formula: `IF(A${rowNum}="", "", COUNTIF('Timetable Grid'!$B$2:$${lastColLetter}$${endRow}, A${rowNum}))` };
      row.getCell(5).value = { formula: `IF(A${rowNum}="", "", IF(D${rowNum}=C${rowNum}, "Matched", IF(D${rowNum}>C${rowNum}, "Over-scheduled", "Remaining: " & (C${rowNum}-D${rowNum}) & "h")))` };
    }

    // Add list validation for Type column
    for (let i = 2; i <= 100; i++) {
      wsSubjects.getCell(`B${i}`).dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: ['"SKILL,ACADEMIC,LAB,GENERAL"']
      };
    }

    // Add conditional formatting for status column
    wsSubjects.addConditionalFormatting({
      ref: `E2:E100`,
      rules: [
        {
          priority: 1,
          type: "cellIs",
          operator: "equal",
          formulae: ['"Matched"'],
          style: {
            fill: { type: "pattern", pattern: "solid", fgColor: { argb: "D1FAE5" } }, // Light green
            font: { color: { argb: "065F46" }, bold: true }
          }
        },
        {
          priority: 2,
          type: "cellIs",
          operator: "equal",
          formulae: ['"Over-scheduled"'],
          style: {
            fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FEE2E2" } }, // Light red
            font: { color: { argb: "991B1B" }, bold: true }
          }
        },
        {
          priority: 3,
          type: "containsText",
          operator: "containsText",
          text: "Remaining",
          style: {
            fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FEF3C7" } }, // Light yellow
            font: { color: { argb: "92400E" }, bold: true }
          }
        }
      ]
    });

    // 2. Create Sheet 4: Mentors (Reference List)
    const wsMentors = workbook.addWorksheet("Mentors");
    wsMentors.columns = [
      { header: "Mentor (ID/Name/Email)", key: "mentor", width: 40 }
    ];
    collegeMentors.forEach(m => {
      wsMentors.addRow({ mentor: `${m.name} (${m.id})` });
    });

    // 3. Create Sheet 5: Classrooms (Reference List)
    const wsRooms = workbook.addWorksheet("Classrooms");
    wsRooms.columns = [
      { header: "Room / Location", key: "room", width: 25 }
    ];
    const campusRooms = activeCollege?.rooms 
      ? parseRoomsList(activeCollege.rooms)
      : Array.from(new Set(collegeSlots.map(s => s.location).filter(Boolean)));
    campusRooms.forEach(r => {
      wsRooms.addRow({ room: r });
    });

    // 4. Create Sheet 3: Mentor Mapping
    const wsMentorMapping = workbook.addWorksheet("Mentor Mapping");
    wsMentorMapping.columns = [
      { header: "Subject Name", key: "subject", width: 30 },
      { header: "Mentor (ID/Name/Email)", key: "mentor", width: 40 },
      { header: "Classroom / Room", key: "room", width: 20 }
    ];

    deptSubjects.forEach(sub => {
      const assignedMentor = collegeMentors.find(
        m => m.subjects && m.subjects.split("\n").map((s: string) => s.trim().toLowerCase()).includes(sub.name.toLowerCase())
      );
      const existingSlot = collegeSlots.find(
        s => s.classGroup === classGroup && s.course.toLowerCase() === sub.name.toLowerCase()
      );
      const room = existingSlot?.location || (isGenTab ? (genRoom || "") : "");

      wsMentorMapping.addRow({
        subject: sub.name,
        mentor: assignedMentor ? `${assignedMentor.name} (${assignedMentor.id})` : "",
        room: room
      });
    });

    // Add validations to Mentor Mapping columns
    const subjectsRange = `='Subjects'!$A$2:$A$100`;
    const mentorsRange = `='Mentors'!$A$2:$A$100`;
    const roomsRange = `='Classrooms'!$A$2:$A$100`;

    for (let i = 2; i <= 100; i++) {
      wsMentorMapping.getCell(`A${i}`).dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: [subjectsRange]
      };
      wsMentorMapping.getCell(`B${i}`).dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: [mentorsRange]
      };
      wsMentorMapping.getCell(`C${i}`).dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: [roomsRange]
      };
    }

    // 5. Create Sheet 1: Timetable Grid
    const wsGrid = workbook.addWorksheet("Timetable Grid");
    const headers = ["Day / Period", ...timeSlots.map((ts, i) => `Period ${i + 1} (${ts})`)];
    wsGrid.addRow(headers);

    // Set column widths
    wsGrid.getColumn(1).width = 15;
    for (let c = 2; c <= timeSlots.length + 1; c++) {
      wsGrid.getColumn(c).width = 25;
    }

    days.forEach(day => {
      const rowData: string[] = [day];
      timeSlots.forEach(time => {
        const slot = collegeSlots.find(
          s => s.day === day &&
               s.time === time &&
               s.classGroup === classGroup &&
               s.shift === activeShift
        );
        rowData.push(slot ? slot.course : "");
      });
      wsGrid.addRow(rowData);
    });

    // Add list validation to the Grid cells referencing Sheet 2 (Subjects)

    for (let r = 2; r <= endRow; r++) {
      for (let c = 2; c <= timeSlots.length + 1; c++) {
        const cellRef = `${String.fromCharCode(64 + c)}${r}`; // e.g. B2, C2, etc.
        wsGrid.getCell(cellRef).dataValidation = {
          type: "list",
          allowBlank: true,
          formulae: [subjectsRange]
        };
      }
    }

    // Add Subject Hour Validation Summary table at the bottom of Sheet 1 (Timetable Grid)
    const gridEndRow = days.length + 1;
    const summaryStartRow = gridEndRow + 3;

    const summaryHeaderRow = wsGrid.getRow(summaryStartRow);
    summaryHeaderRow.values = ["Subject Hour Validation Summary", "Target Hours", "Scheduled Hours", "Status"];
    summaryHeaderRow.font = { name: "Arial", size: 10, bold: true, color: { argb: "FFFFFF" } };
    summaryHeaderRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "374151" } // Dark Slate Header
    };
    summaryHeaderRow.alignment = { vertical: "middle", horizontal: "center" };
    summaryHeaderRow.height = 24;

    const maxSummaryRows = 100;
    for (let idx = 0; idx < maxSummaryRows; idx++) {
      const rNum = summaryStartRow + 1 + idx;
      
      const row = wsGrid.getRow(rNum);
      row.height = 20;
      
      // Dynamic formula referencing Subjects sheet columns A (Subject Name) and C (Target Hours)
      row.getCell(1).value = { formula: `IF(Subjects!A${idx + 2}="", "", Subjects!A${idx + 2})` };
      row.getCell(1).font = { name: "Arial", size: 9.5, bold: true };
      
      row.getCell(2).value = { formula: `IF(Subjects!A${idx + 2}="", "", Subjects!C${idx + 2})` };
      row.getCell(2).font = { name: "Arial", size: 9.5 };
      row.getCell(2).alignment = { horizontal: "center", vertical: "middle" };
      
      row.getCell(3).value = { formula: `IF(A${rNum}="", "", COUNTIF($B$2:$${lastColLetter}$${gridEndRow}, A${rNum}))` };
      row.getCell(3).font = { name: "Arial", size: 9.5, bold: true };
      row.getCell(3).alignment = { horizontal: "center", vertical: "middle" };
      
      row.getCell(4).value = { formula: `IF(A${rNum}="", "", IF(C${rNum}=B${rNum}, "Matched", IF(C${rNum}>B${rNum}, "Over-scheduled", "Remaining: " & (B${rNum}-C${rNum}) & "h")))` };
      row.getCell(4).font = { name: "Arial", size: 9.5, bold: true };
      row.getCell(4).alignment = { horizontal: "center", vertical: "middle" };
      
      // Add borders
      for (let col = 1; col <= 4; col++) {
        row.getCell(col).border = {
          top: { style: 'thin', color: { argb: 'E2E8F0' } },
          bottom: { style: 'thin', color: { argb: 'E2E8F0' } },
          left: { style: 'thin', color: { argb: 'E2E8F0' } },
          right: { style: 'thin', color: { argb: 'E2E8F0' } }
        };
      }
    }

    wsGrid.addConditionalFormatting({
      ref: `D${summaryStartRow + 1}:D${summaryStartRow + maxSummaryRows}`,
      rules: [
        {
          priority: 1,
          type: "cellIs",
          operator: "equal",
          formulae: ['"Matched"'],
          style: {
            fill: { type: "pattern", pattern: "solid", fgColor: { argb: "D1FAE5" } }, // Light green
            font: { color: { argb: "065F46" }, bold: true }
          }
        },
        {
          priority: 2,
          type: "cellIs",
          operator: "equal",
          formulae: ['"Over-scheduled"'],
          style: {
            fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FEE2E2" } }, // Light red
            font: { color: { argb: "991B1B" }, bold: true }
          }
        },
        {
          priority: 3,
          type: "containsText",
          operator: "containsText",
          text: "Remaining",
          style: {
            fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FEF3C7" } }, // Light yellow
            font: { color: { argb: "92400E" }, bold: true }
          }
        }
      ]
    });

    // Style the headers in all sheets
    [wsGrid, wsSubjects, wsMentorMapping, wsMentors, wsRooms].forEach(ws => {
      const headerRow = ws.getRow(1);
      headerRow.font = { name: "Arial", size: 10, bold: true, color: { argb: "FFFFFF" } };
      headerRow.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "4F46E5" } // Indigo header fill!
      };
      headerRow.alignment = { vertical: "middle", horizontal: "center" };
    });

    // Write and Save
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const downloadUrl = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = downloadUrl;
    a.download = `${classGroup.replace(/\s+/g, "_")}_${activeShift}_Timetable.xlsx`;
    a.click();
    window.URL.revokeObjectURL(downloadUrl);

    toast("Grid template downloaded successfully with references.", "success");
  };

  const handleUploadGrid = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    e.target.value = "";

    const isGenTab = timetableSubTab === "generate";
    const classGroup = isGenTab ? genClassGroup : viewerClassGroup;
    const activeCollege = colleges.find(c => c.id === activeCollegeId);
    const hasShifts = activeCollege ? activeCollege.has_shifts !== 0 : true;
    const activeShift = isGenTab ? genShift : (hasShifts ? viewerShift : "general");
    const activeSem = isGenTab ? genSelectedSemester : selectedCohortSem;

    if (!classGroup) {
      toast("Please select a class group or enter a cohort name first.", "warning");
      return;
    }

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const gridSheet = workbook.Sheets["Timetable Grid"];
        const mappingSheet = workbook.Sheets["Mentor Mapping"];
        
        if (!gridSheet) {
          toast("Invalid workbook. Missing 'Timetable Grid' sheet.", "error");
          return;
        }

        if (!mappingSheet) {
          toast("Invalid workbook. Missing 'Mentor Mapping' sheet.", "error");
          return;
        }

        const subjectToMentorRoomMap: Record<string, { mentorId: string; room: string }> = {};
        const mappingRows: any[][] = XLSX.utils.sheet_to_json(mappingSheet, { header: 1 });
        
        for (let i = 1; i < mappingRows.length; i++) {
          const row = mappingRows[i];
          if (!row || row.length === 0) continue;
          const subName = row[0];
          const mentorIdent = row[1];
          const room = row[2];
          if (!subName || !mentorIdent) continue;

          const cleanMentorIdent = String(mentorIdent).trim();
          let mentorIdToUse = cleanMentorIdent;
          
          if (cleanMentorIdent.includes("(") && cleanMentorIdent.includes(")")) {
            const matches = cleanMentorIdent.match(/\(([^)]+)\)/);
            if (matches && matches[1]) {
              mentorIdToUse = matches[1].trim();
            }
          }

          const mentor = collegeMentors.find(
            m => m.id.toLowerCase() === mentorIdToUse.toLowerCase() ||
                 m.name.toLowerCase() === cleanMentorIdent.toLowerCase() ||
                 m.email.toLowerCase() === cleanMentorIdent.toLowerCase()
          );

          if (mentor) {
            subjectToMentorRoomMap[String(subName).trim().toLowerCase()] = {
              mentorId: mentor.id,
              room: room ? String(room).trim() : ""
            };
          }
        }

        const rows: any[][] = XLSX.utils.sheet_to_json(gridSheet, { header: 1 });
        const timeSlots = getTimeSlots(activeShift, activeSem);
        const days = workingDays.length > 0 ? workingDays : ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

        const parsedSlots: any[] = [];
        const validationWarnings: any[] = [];

        for (let rIdx = 1; rIdx < rows.length; rIdx++) {
          const row = rows[rIdx];
          if (!row || row.length === 0) continue;
          
          const day = row[0];
          if (!day || !days.includes(day)) continue;

          for (let cIdx = 1; cIdx < row.length; cIdx++) {
            const val = row[cIdx];
            if (!val || typeof val !== "string" || val.trim() === "") continue;

            const time = timeSlots[cIdx - 1];
            if (!time) continue;

            const courseName = val.trim();
            const mapping = subjectToMentorRoomMap[courseName.toLowerCase()];

            if (!mapping) {
              validationWarnings.push({
                day,
                period: `Period ${cIdx} (${time})`,
                cell: val,
                message: `Subject '${courseName}' has no mentor mapping assigned in the 'Mentor Mapping' sheet.`
              });
              continue;
            }

            parsedSlots.push({
              mentorId: mapping.mentorId,
              day,
              time,
              course: courseName,
              location: mapping.room || genRoom || "LH-101",
              shift: activeShift,
              classGroup: classGroup,
              college_id: activeCollegeId
            });
          }
        }

        const otherSlots = slots.filter(
          s => s.college_id === activeCollegeId && s.classGroup !== classGroup
        );

        parsedSlots.forEach(ps => {
          const mClash = otherSlots.find(s => s.mentorId === ps.mentorId && s.day === ps.day && s.time === ps.time);
          if (mClash) {
            const mentorObj = collegeMentors.find(m => m.id === ps.mentorId);
            validationWarnings.push({
              day: ps.day,
              period: ps.time,
              cell: ps.course,
              message: `Conflict: Mentor ${mentorObj?.name || ps.mentorId} is already teaching ${mClash.classGroup} (${mClash.course}) at this slot.`,
              type: "clash"
            });
          }

          const rClash = otherSlots.find(
            s => s.location.toLowerCase() === ps.location.toLowerCase() && s.day === ps.day && s.time === ps.time
          );
          if (rClash) {
            validationWarnings.push({
              day: ps.day,
              period: ps.time,
              cell: `${ps.course} | ${ps.location}`,
              message: `Conflict: Classroom '${ps.location}' is already occupied by ${rClash.classGroup} (${rClash.course}) at this slot.`,
              type: "clash"
            });
          }
        });

        setImportPreview({ 
          slots: parsedSlots, 
          warnings: validationWarnings, 
          targetClassGroup: classGroup,
          targetShift: activeShift
        });
        setShowImportModal(true);

      } catch (err: any) {
        toast("Error parsing spreadsheet: " + err.message, "error");
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleConfirmImport = async () => {
    if (!importPreview || importPreview.slots.length === 0) return;
    
    const targetCG = importPreview.targetClassGroup || viewerClassGroup;
    const clashesCount = importPreview.warnings.filter(w => w.type === "clash").length;
    
    if (clashesCount > 0) {
      if (!(await showConfirm({
        title: "Proceed with Clashes?",
        message: `There are ${clashesCount} schedule clashes detected. If you proceed, these clashing slots will be created which will result in timetable conflicts. Are you sure you want to proceed?`,
        danger: true,
        confirmLabel: "Proceed Anyway"
      }))) {
        return;
      }
    }

    setIsImportSubmitting(true);
    try {
      const clearRes = await clearTimetable(targetCG);
      if (!clearRes.success) {
        toast(`Error clearing old timetable: ${clearRes.message}`, "error");
        setIsImportSubmitting(false);
        return;
      }

      const actorName = currentCAM?.name || "Campus Manager";
      const res = await fetch("/api/slots/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slots: importPreview.slots, actorName })
      });
      const data = await res.json();
      if (data.success) {
        toast(`Successfully imported ${data.count} slots for ${targetCG}.`, "success");
        setShowImportModal(false);
        setImportPreview(null);
        await refreshData();
      } else {
        toast(data.message || "Failed to bulk save timetable.", "error");
      }
    } catch (e: any) {
      toast("Error saving imported slots: " + e.message, "error");
    } finally {
      setIsImportSubmitting(false);
    }
  };


  const getYearFromSemester = (sem: string): number => {
    const clean = sem.toLowerCase().trim();
    if (clean.includes("sem i") || clean.includes("sem 1") || clean.includes("semester 1") || clean.includes("semester i") || clean.includes("sem ii") || clean.includes("sem 2") || clean.includes("semester 2") || clean.includes("semester ii")) {
      return 1;
    }
    if (clean.includes("sem iii") || clean.includes("sem 3") || clean.includes("semester 3") || clean.includes("semester iii") || clean.includes("sem iv") || clean.includes("sem 4") || clean.includes("semester 4") || clean.includes("semester iv")) {
      return 2;
    }
    if (clean.includes("sem v") || clean.includes("sem 5") || clean.includes("semester 5") || clean.includes("semester v") || clean.includes("sem vi") || clean.includes("sem 6") || clean.includes("semester 6") || clean.includes("semester vi")) {
      return 3;
    }
    if (clean.includes("sem vii") || clean.includes("sem 7") || clean.includes("semester 7") || clean.includes("semester vii") || clean.includes("sem viii") || clean.includes("sem 8") || clean.includes("semester 8") || clean.includes("semester viii")) {
      return 4;
    }
    return 1;
  };

  const resolveCourseRoom = (courseObj: any, sem: string, targetShift?: string): string => {
    if (!courseObj || !courseObj.default_room) return classrooms[0] || "";
    const rawRoom = String(courseObj.default_room).trim();
    const activeSh = targetShift || genShift || "shift_1";

    let roomValStr = rawRoom;
    if (rawRoom.startsWith("{") || rawRoom.startsWith("[")) {
      try {
        const parsed = JSON.parse(rawRoom);
        if (Array.isArray(parsed)) {
          const yrNum = getYearFromSemester(sem);
          roomValStr = String(parsed[yrNum - 1] || parsed[0] || "");
        } else {
          const yrNum = getYearFromSemester(sem);
          roomValStr = String(
            parsed[yrNum] ||
            parsed[String(yrNum)] ||
            parsed[`Year ${yrNum}`] ||
            parsed[`year_${yrNum}`] ||
            parsed[sem] ||
            parsed[1] ||
            parsed["1"] ||
            Object.values(parsed)[0] ||
            ""
          );
        }
      } catch (_) {
        roomValStr = rawRoom;
      }
    }

    // Clean shift annotations if present in room string like "B4 (Shift 1) / C2 (Shift 2)"
    if (roomValStr.includes("/") || roomValStr.toLowerCase().includes("shift")) {
      const parts = roomValStr.split("/");
      const isShift2 = activeSh === "shift_2" || activeSh.toLowerCase().includes("2");
      let matchedPart = "";
      for (const part of parts) {
        const partLower = part.toLowerCase();
        if (isShift2 && (partLower.includes("shift 2") || partLower.includes("shift_2") || partLower.includes("shift2"))) {
          matchedPart = part;
          break;
        }
        if (!isShift2 && (partLower.includes("shift 1") || partLower.includes("shift_1") || partLower.includes("shift1"))) {
          matchedPart = part;
          break;
        }
      }
      if (!matchedPart) matchedPart = parts[0] || roomValStr;
      const cleanCode = matchedPart.replace(/\(.*\)/g, "").replace(/[^a-zA-Z0-9\-_ ]/g, "").trim().split(" ")[0];
      if (cleanCode) return cleanCode;
    }

    return roomValStr.replace(/[\[\]"]/g, "").trim();
  };

  const handleGenCourseChange = (course: string) => {
    setGenSelectedCourse(course);
    setShowCustomTarget(false);
    if (course) {
      const courseObj = collegeCourses.find(c => c.name === course);
      const calculatedSem = calculateSemesterForCourse(courseObj);
      setGenSelectedSemester(calculatedSem);

      const targetShift = courseObj?.default_shift || genShift;
      if (courseObj?.default_shift) {
        setGenShift(courseObj.default_shift as any);
      }

      const startYear = courseObj?.start_year || "";
      const endYear = courseObj?.end_year || "";
      const batchSuffix = startYear && endYear ? ` (${startYear}-${endYear})` : "";
      const shiftText = targetShift === "shift_1" ? " - Shift 1" : targetShift === "shift_2" ? " - Shift 2" : "";
      
      setGenClassGroup(`${course}${shiftText} - ${calculatedSem}${batchSuffix}`);
      setGenRoom(resolveCourseRoom(courseObj, calculatedSem, targetShift));
    } else {
      setGenClassGroup("");
    }
  };

  const handleGenSemesterChange = (sem: string) => {
    setGenSelectedSemester(sem);
    if (genSelectedCourse) {
      const courseObj = collegeCourses.find(c => c.name === genSelectedCourse);
      const startYear = courseObj?.start_year || "";
      const endYear = courseObj?.end_year || "";
      const batchSuffix = startYear && endYear ? ` (${startYear}-${endYear})` : "";
      const shiftText = genShift === "shift_1" ? " - Shift 1" : genShift === "shift_2" ? " - Shift 2" : "";
      setGenClassGroup(`${genSelectedCourse}${shiftText} - ${sem}${batchSuffix}`);
      setGenRoom(resolveCourseRoom(courseObj, sem, genShift));
    }
  };

  const handleGenShiftChange = (sh: "shift_1" | "shift_2" | "general") => {
    setGenShift(sh);
    if (genSelectedCourse) {
      const courseObj = collegeCourses.find(c => c.name === genSelectedCourse);
      const startYear = courseObj?.start_year || "";
      const endYear = courseObj?.end_year || "";
      const batchSuffix = startYear && endYear ? ` (${startYear}-${endYear})` : "";
      const shiftText = sh === "shift_1" ? " - Shift 1" : sh === "shift_2" ? " - Shift 2" : "";
      setGenClassGroup(`${genSelectedCourse}${shiftText} - ${genSelectedSemester}${batchSuffix}`);
      setGenRoom(resolveCourseRoom(courseObj, genSelectedSemester, sh));
    }
  };

  // --- ACTIONS: TIMETABLE GENERATOR ENGINE ---
  const handleTransitionToStep2 = () => {
    setGenError("");
    setGenSuccess("");

    if (!genClassGroup.trim() || !genRoom.trim()) {
      setGenError("Please provide both Class Group and default Room.");
      return;
    }

    const targetDept = genSelectedCourse || collegeCourses[0]?.name || "";
    if (!targetDept) {
      setGenError("No department or course configuration found.");
      return;
    }

    const deptSubjects = getSubjectsForDepartment(subjectsList, mentors, slots, targetDept);
    const semSubjects = deptSubjects.filter(
      (s) => s.semester.toLowerCase().trim() === genSelectedSemester.toLowerCase().trim()
    );

    const deptMentors = collegeMentors.filter((m) => isMentorInProgram(m, targetDept, slots, subjectsList));

    const initialAllocations = semSubjects.map((s) => {
      // Find matching mentor
      const matchedMentor = deptMentors.find((m) => {
        const subs = m.subjects ? m.subjects.split(/\n|\/|,|;/).map((sub) => sub.trim()) : [];
        return subs.some((subName) => isSubjectNameMatch(s.name, subName));
      });

      return {
        subjectId: s.id,
        subjectName: s.name,
        subjectDept: s.dept || s.department || "",
        subjectGroup: s.subject_group || "General",
        mentorId: matchedMentor ? matchedMentor.id : (deptMentors[0]?.id || ""),
        weeklyHours: s.weekly_hours || 4,
        room: genRoom.trim(),
        isSelected: true
      };
    });

    setGenAllocations(initialAllocations);
    setGenStep(2);
    // Reset quick add states on transition
    setShowQuickAddForm(false);
    setQuickSubName("");
    setQuickSubHours(4);
    setQuickSubRoom("");
    setQuickSubMentorId("");
    setQuickSubType("theory");
  };

  const handleQuickAddSubject = () => {
    setGenError("");
    if (!quickSubName.trim()) {
      setGenError("Please enter a subject name.");
      return;
    }

    const isDup = genAllocations.some(a => a.subjectName.toLowerCase() === quickSubName.trim().toLowerCase());
    if (isDup) {
      setGenError("A subject with this name is already in the allocation list.");
      return;
    }

    const tempId = "temp_sub_" + Date.now();
    const selectedMentor = collegeMentors.find(m => m.id === quickSubMentorId);
    const newAlloc = {
      subjectId: tempId,
      subjectName: quickSubName.trim(),
      mentorId: quickSubMentorId || (collegeMentors[0]?.id || ""),
      weeklyHours: quickSubHours,
      room: quickSubRoom.trim() || genRoom.trim() || "Room 101",
      isSelected: true,
      subjectType: quickSubType,
      isNew: true,
      subjectGroup: selectedMentor?.subject_group || "General"
    };

    setGenAllocations([...genAllocations, newAlloc]);
    setQuickSubName("");
    setQuickSubHours(4);
    setQuickSubRoom("");
    setQuickSubMentorId("");
    setQuickSubType("theory");
    setShowQuickAddForm(false);
  };

  const handleGeneratePreview = async () => {
    setGenError("");
    setGenSuccess("");

    const activeAllocations = genAllocations
      .filter((a) => a.isSelected)
      .map((a) => ({
        subjectId: a.subjectId,
        subjectName: a.subjectName,
        mentorId: a.mentorId,
        weeklyHours: a.weeklyHours,
        room: a.room
      }));

    if (activeAllocations.length === 0) {
      setGenError("Please select at least one subject to generate timetable.");
      return;
    }

    const missingMentor = genAllocations.find(a => a.isSelected && !a.mentorId);
    if (missingMentor) {
      setGenError(`Please assign a faculty mentor for "${missingMentor.subjectName}" before generating the timetable.`);
      return;
    }

    setGenLoading(true);
    const res = await generateTimetable(
      genClassGroup.trim(),
      genShift,
      genRoom.trim(),
      activeAllocations,
      true // previewOnly
    );
    setGenLoading(false);

    if (res.success && res.previewSlots) {
      setGenPreviewSlots(res.previewSlots);
      setGenUnscheduled(res.unscheduled || []);
      setGenStep(3);
    } else {
      setGenError(res.message || "Failed to generate preview slots.");
    }
  };

  const handleSaveTimetable = async () => {
    setGenError("");
    setGenSuccess("");

    const activeAllocations = genAllocations
      .filter((a) => a.isSelected)
      .map((a) => ({
        subjectId: a.subjectId,
        subjectName: a.subjectName,
        mentorId: a.mentorId,
        weeklyHours: a.weeklyHours,
        room: a.room
      }));

    if (activeAllocations.length === 0) {
      setGenError("Please select at least one subject to generate timetable.");
      return;
    }

    const missingMentor = genAllocations.find(a => a.isSelected && !a.mentorId);
    if (missingMentor) {
      setGenError(`Please assign a faculty mentor for "${missingMentor.subjectName}" before generating the timetable.`);
      return;
    }

    setGenLoading(true);

    const { year: resolvedYear } = resolveClassGroupDetailsFromState(
      `${genSelectedCourse} - ${genSelectedSemester}`,
      subjectsList,
      coursesList
    );

    const newSubjects = genAllocations.filter(a => a.isNew && a.isSelected);
    for (const sub of newSubjects) {
      try {
        await createSubject({
          name: sub.subjectName,
          department: genSelectedCourse || "General",
          semester: genSelectedSemester,
          type: sub.subjectType || "theory",
          weekly_hours: sub.weeklyHours,
          year: resolvedYear,
          college_id: activeCollegeId
        });
      } catch (e) {
        console.error("Failed to quick-add subject on save:", e);
      }
    }

    const res = await generateTimetable(
      genClassGroup.trim(),
      genShift,
      genRoom.trim(),
      activeAllocations,
      false // previewOnly = false, commit to DB
    );
    setGenLoading(false);

    if (res.success) {
      setGenSuccess(res.message);
      setGenStep(1);
      setGenClassGroup("");
      setGenRoom("");
      setGenAllocations([]);
      setGenPreviewSlots([]);
      setGenUnscheduled([]);
      refreshData();
    } else {
      setGenError(res.message || "Failed to save timetable.");
    }
  };

  // --- ACTIONS: ISSUES CRUD ---
  const handleSaveIssue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!issueTitle.trim() || !issueDesc.trim()) return;

    const newIssue = {
      title: issueTitle,
      type: issueType,
      priority: issuePriority,
      desc: issueDesc,
      status: "open",
      collegeId: activeCollegeId,
      collegeName: activeCollegeName,
      escalated: false
    };
    const res = await saveCampusIssue(newIssue);
    if (res.success) {
      setIssueTitle("");
      setIssueDesc("");
      toast("Campus issue reported successfully.", "success");
    } else {
      toast(res.message || "Failed to report issue", "error");
    }
  };

  const handleStartEditIssue = (i: any) => {
    setEditingIssueId(i.id);
    setEditIssueTitle(i.title);
    setEditIssueType(i.type);
    setEditIssuePriority(i.priority);
    setEditIssueDesc(i.desc);
  };

  const handleSaveInlineIssue = async (e: React.FormEvent, id: string) => {
    e.preventDefault();
    if (!editIssueTitle.trim() || !editIssueDesc.trim()) return;

    const current = issues.find(i => i.id === id);
    const res = await saveCampusIssue({
      id,
      title: editIssueTitle,
      type: editIssueType,
      priority: editIssuePriority,
      desc: editIssueDesc,
      status: current ? current.status : "open",
      collegeId: activeCollegeId,
      collegeName: activeCollegeName,
      escalated: current ? current.escalated : false,
      escalatedAt: current ? current.escalatedAt : null
    });
    if (res.success) {
      setEditingIssueId(null);
      toast("Campus issue updated successfully.", "success");
    } else {
      toast(res.message || "Failed to update issue", "error");
    }
  };

  const handleDeleteIssue = async (id: string) => {
    if (await showConfirm({ message: "Delete this issue report?", danger: true, confirmLabel: "Delete" })) {
      const res = await deleteCampusIssue(id);
      if (res.success) {
        toast("Campus issue deleted successfully.", "success");
      } else {
        toast(res.message || "Failed to delete issue", "error");
      }
    }
  };

  const toggleClassProfileEdit = (cls: string) => {
    let updated;
    if (allowedProfileEditClasses.includes(cls)) {
      updated = allowedProfileEditClasses.filter(c => c !== cls);
    } else {
      updated = [...allowedProfileEditClasses, cls];
    }
    setAllowedProfileEditClasses(updated);
    localStorage.setItem("fp_allowed_profile_edit_classes", JSON.stringify(updated));
  };

  const handleEscalateIssue = async (id: string) => {
    const res = await updateCampusIssueStatus(id, undefined, undefined, true, new Date().toLocaleDateString());
    if (res.success) {
      toast("Issue successfully escalated to Key Account Manager (KAM) portal.", "success");
    } else {
      toast(res.message || "Failed to escalate issue", "error");
    }
  };

  return (
    <div className="flex-1 flex flex-col md:flex-row bg-warm-canvas text-slate-800 font-sans h-full overflow-hidden">

      {/*  Sticky Left Sidebar Navigation */}
      {(() => {
        const getNotificationCount = (tabId: string) => {
          if (tabId === "handovers") {
            return requests.filter(r => r.status === "pending_cam").length;
          }
          return 0;
        };

        return (
          <aside ref={sidebarRef} className={`hidden md:flex shrink-0 flex-col justify-between sticky top-6 z-30 floating-sidebar transition-all duration-300 ${isCollapsed ? "w-20 p-3" : "w-64 p-5"}`}>
            <div className="flex flex-col flex-1 overflow-visible">
              {/* Sidebar Link items */}
              <nav className={`py-2 space-y-2 ${isCollapsed ? "px-1" : "px-4"}`}>
                {[
                  {
                    id: "dashboard",
                    title: "Dashboard",
                    icon: Building2,
                    items: [
                      { id: "overview", label: "Operations Hub", icon: Building2 }
                    ]
                  },
                  {
                    id: "academics",
                    title: "Academics",
                    icon: BookOpen,
                    items: [
                      { id: "config", label: "Academic Config", icon: Settings },
                      { id: "curriculum", label: "Curriculum Map", icon: BookOpen }
                    ]
                  },
                  {
                    id: "faculty",
                    title: "Faculty",
                    icon: Users,
                    items: [
                      { id: "faculty", label: "Faculty Allocation", icon: Users },
                      { id: "handovers", label: "Class Handovers", icon: CalendarCheck2 }
                    ]
                  },
                  {
                    id: "schedules",
                    title: "Schedules",
                    icon: Calendar,
                    items: [
                      { id: "timetable", label: "Timetables & Rooms", icon: Calendar },
                      { id: "monitoring", label: "Academic Monitoring", icon: Clock }
                    ]
                  },
                  {
                    id: "students",
                    title: "Students",
                    icon: GraduationCap,
                    items: [
                      { id: "students_list", label: "Student Directory & Import", icon: Users },
                      { id: "tracker", label: "Student Tracker", icon: GraduationCap },
                      { id: "fees", label: "Fee Collection", icon: IndianRupee }
                    ]
                  },
                  {
                    id: "management",
                    title: "Management",
                    icon: SlidersHorizontal,
                    items: [
                      { id: "reports", label: "Operational Reports", icon: FileText },
                      { id: "tasks", label: "Tasks & Issues", icon: ClipboardList },
                      { id: "profile", label: "My Profile", icon: User }
                    ]
                  }
                ].map((group) => {
                  const Icon = group.icon;
                  const isAnyChildActive = group.items.some(item => activeTab === item.id);
                  const totalPendingInGroup = group.items.reduce((sum, item) => sum + getNotificationCount(item.id), 0);

                  return (
                    <div 
                      key={group.id} 
                      className="relative py-0.5"
                      onMouseEnter={() => setHoveredGroupId(group.id)}
                      onMouseLeave={() => setHoveredGroupId(null)}
                    >
                      <button
                        type="button"
                        className={`sidebar-group-btn w-full flex items-center rounded-2xl transition-all duration-200 cursor-pointer ${
                          isCollapsed ? "justify-center px-0 py-3.5" : "justify-between px-4 py-3.5 text-left"
                        } ${
                          isAnyChildActive
                            ? "bg-[#D528A2]/5 text-[#D528A2] border border-[#D528A2]/20 dark:bg-[#D528A2]/10 dark:text-[#F4A863] dark:border-[#F4A863]/25"
                            : "text-slate-500 hover:text-slate-800 hover:bg-slate-50 dark:text-slate-400 dark:hover:text-white dark:hover:bg-white/5"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Icon className={`h-4.5 w-4.5 shrink-0 ${isAnyChildActive ? "text-[#D528A2]" : "text-slate-405 dark:text-slate-500"}`} />
                          {!isCollapsed && <span className="text-xs font-bold truncate">{group.title}</span>}
                        </div>
                        {!isCollapsed && (
                          <div className="flex items-center gap-1.5 shrink-0">
                            {totalPendingInGroup > 0 && (
                              <span className="bg-rose-500 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full">
                                {totalPendingInGroup}
                              </span>
                            )}
                            <ChevronRight className={`h-3 w-3 transition-transform ${isAnyChildActive ? "text-[#D528A2]" : "text-slate-400"}`} />
                          </div>
                        )}
                      </button>

                      {/* Outside Hover Sub-Menu Popover Container (Invisible hover bridge) */}
                      <div className={`absolute left-full top-0 pl-2 w-56 z-50 submenu-${group.id} ${hoveredGroupId === group.id ? "block" : "hidden"}`}>
                        {/* The actual styled card */}
                        <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-[#D528A2]/20 dark:border-slate-800 shadow-xl rounded-2xl p-2.5 animate-fadeIn">
                          <div className="px-3 py-1.5 text-[9px] font-black uppercase tracking-widest border-b border-slate-105 dark:border-slate-800 mb-1.5 text-[#D528A2] dark:text-[#F4A863]">
                            {group.title}
                          </div>
                          <div className="space-y-0.5">
                            {group.items.map(child => {
                              const ChildIcon = child.icon;
                              const isChildActive = activeTab === child.id;
                              const count = getNotificationCount(child.id);
                              return (
                                <button
                                  key={child.id}
                                  type="button"
                                  onClick={() => {
                                    setActiveTab(child.id as any);
                                    setHoveredGroupId(null);
                                  }}
                                  className={`submenu-button w-full flex items-center justify-start gap-3 px-2.5 py-2 text-left rounded-xl text-[11px] font-bold tracking-tight transition-all duration-150 cursor-pointer ${
                                    isChildActive
                                      ? "sidebar-active-item shadow-sm"
                                      : "text-slate-600 hover:text-[#D528A2] hover:bg-[#D528A2]/5 dark:text-slate-450 dark:hover:text-[#F4A863] dark:hover:bg-white/5"
                                  }`}
                                >
                                  <ChildIcon className={`h-3.5 w-3.5 shrink-0 ${isChildActive ? "text-white" : "text-slate-400"}`} />
                                  <span className="flex-1 truncate">{child.label}</span>
                                  {count > 0 && (
                                    <span className={`ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded-full ${isChildActive ? "bg-white text-[#D528A2]" : "bg-rose-500 text-white"}`}>
                                      {count}
                                    </span>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </nav>
            </div>

            {/* User profile card & collapse button at bottom */}
            <div className="border-t border-slate-100/85 pt-4 space-y-3 shrink-0">
              <div className="flex justify-center pt-1">
                <button
                  type="button"
                  onClick={() => setIsCollapsed((prev) => {
                    const next = !prev;
                    localStorage.setItem("fp_sidebar_collapsed", String(next));
                    return next;
                  })}
                  className="h-8.5 w-8.5 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-850 hover:bg-slate-50 shadow-xs transition-all cursor-pointer"
                  title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
                >
                  {isCollapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </aside>
        );
      })()}

      {/* Mobile Bottom Navigation — visible only on small screens */}
      <nav className="flex md:hidden fixed bottom-0 inset-x-0 z-50 mobile-bottom-nav">
        <div className="flex w-full justify-around items-center py-2 px-0.5">
          {[
            { id: "overview", label: "Hub", icon: Building2 },
            { id: "timetable", label: "Timetable", icon: Calendar },
            { id: "faculty", label: "Faculty", icon: Users },
            { id: "handovers", label: "Handovers", icon: CalendarCheck2 },
            { id: "more_menu", label: "More", icon: Menu },
          ].map(t => {
            const Icon = t.icon;
            const isActive = activeTab === t.id || (t.id === "more_menu" && ["config", "curriculum", "monitoring", "tracker", "fees", "reports", "tasks", "profile"].includes(activeTab));
            const count = t.id === "handovers" ? requests.filter(r => r.status === "pending_cam").length : 0;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id as any)}
                className={`relative flex flex-col items-center justify-center gap-0.5 flex-1 py-1.5 rounded-xl transition-all cursor-pointer ${
                  isActive ? "text-indigo-600" : "text-slate-400"
                }`}
              >
                <div className="relative">
                  <Icon className={`h-4.5 w-4.5 transition-transform ${isActive ? "scale-110" : ""}`} />
                  {count > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 h-3 w-3 bg-rose-500 text-white text-[7px] font-bold rounded-full flex items-center justify-center">
                      {count}
                    </span>
                  )}
                </div>
                <span className={`text-[8px] font-semibold tracking-wide leading-none ${isActive ? "text-indigo-600" : "text-slate-400"}`}>
                  {t.label}
                </span>
                {isActive && <span className="absolute top-0 inset-x-1 h-0.5 bg-indigo-500 rounded-full" />}
              </button>
            );
          })}
        </div>
      </nav>

      {/*  Main Workspace Area (Right-aligned content) */}
      <main className="flex-1 flex flex-col overflow-x-hidden overflow-y-auto h-full pb-20 md:pb-12 scroll-touch">

        {/* Sticky Top Header Panel */}
        <header className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-slate-100 dark:border-slate-800/80 m-4 md:m-6 mb-0 p-3.5 md:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 z-20 shadow-xs rounded-2xl">
          {/* Left Info: College Name & SLA status */}
          <div className="flex items-center justify-between sm:justify-start gap-3">
            <h2 className="text-sm font-extrabold text-slate-900 dark:text-slate-100 tracking-tight truncate max-w-[180px] sm:max-w-none">
              {activeCollegeName}
            </h2>
            <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-emerald-800 dark:text-emerald-400 text-[9px] font-extrabold uppercase border border-emerald-100/50 dark:border-emerald-500/20 shrink-0">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              SLA Compliant
            </div>
          </div>

          {/* Right Info: Academic Year Select & Refresh Action */}
          <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4 border-t border-slate-100/80 dark:border-slate-800/60 sm:border-t-0 pt-3.5 sm:pt-0">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300">
              <span className="text-[9px] uppercase font-black text-slate-400 dark:text-slate-500 tracking-wider">Academic Year:</span>
              <select
                value={selectedYear}
                onChange={e => {
                  setSelectedYear(e.target.value);
                  setCurrYear(e.target.value);
                  setEditSubYear(e.target.value);
                }}
                className="px-2.5 py-1.5 border border-slate-205 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-950 text-[10px] cursor-pointer outline-none font-bold text-slate-705 dark:text-slate-300 shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
              >
                {(academicYears || []).map((y: any) => {
                  const str = typeof y === "string" ? y : y.year || y.year_name || String(y);
                  return <option key={str} value={str}>{str}</option>;
                })}
              </select>
            </div>

            <Button
              variant="secondary"
              size="sm"
              icon={<RefreshCw className="h-3 w-3 hover-spin-icon" />}
              onClick={() => refreshData()}
              className="uppercase tracking-wider font-extrabold text-[9px] rounded-xl shrink-0"
              title="Refresh data"
            >
              Refresh
            </Button>
          </div>
        </header>

        {/* Scrollable Work Canvas */}
        <div ref={containerRef} className="p-6 space-y-6 flex-1">

          {/* Tab More Menu: Grid of remaining tabs */}
          {activeTab === "more_menu" && (
            <div className="space-y-6 animate-fadeIn pb-10">
              <h3 className="text-xs font-extrabold text-slate-800 dark:text-slate-200 uppercase tracking-wider">More Tools & Portals</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setActiveTab("config")}
                  className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl text-left hover:border-indigo-500 hover:ring-2 hover:ring-indigo-100 transition-all flex items-center gap-4 shadow-xs cursor-pointer group"
                >
                  <div className="h-10 w-10 rounded-2xl bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center text-indigo-650 shrink-0 group-hover:scale-105 transition-transform">
                    <Settings className="h-5 w-5" />
                  </div>
                  <div>
                    <span className="block text-xs font-bold text-slate-800 dark:text-slate-200">Academic Config</span>
                    <span className="text-[10px] text-slate-455 dark:text-slate-400 font-medium">Departments & subjects configuration</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab("curriculum")}
                  className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl text-left hover:border-indigo-500 hover:ring-2 hover:ring-indigo-100 transition-all flex items-center gap-4 shadow-xs cursor-pointer group"
                >
                  <div className="h-10 w-10 rounded-2xl bg-teal-50 dark:bg-teal-900/20 flex items-center justify-center text-teal-500 shrink-0 group-hover:scale-105 transition-transform">
                    <BookOpen className="h-5 w-5" />
                  </div>
                  <div>
                    <span className="block text-xs font-bold text-slate-800 dark:text-slate-200">Curriculum Map</span>
                    <span className="text-[10px] text-slate-455 dark:text-slate-400 font-medium">Syllabus breakdown & metrics</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab("monitoring")}
                  className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl text-left hover:border-indigo-500 hover:ring-2 hover:ring-indigo-100 transition-all flex items-center gap-4 shadow-xs cursor-pointer group"
                >
                  <div className="h-10 w-10 rounded-2xl bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center text-amber-550 shrink-0 group-hover:scale-105 transition-transform">
                    <Clock className="h-5 w-5" />
                  </div>
                  <div>
                    <span className="block text-xs font-bold text-slate-800 dark:text-slate-200">Academic Monitoring</span>
                    <span className="text-[10px] text-slate-455 dark:text-slate-400 font-medium">Class attendance tracking</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab("tracker")}
                  className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl text-left hover:border-indigo-500 hover:ring-2 hover:ring-indigo-100 transition-all flex items-center gap-4 shadow-xs cursor-pointer group"
                >
                  <div className="h-10 w-10 rounded-2xl bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center text-purple-600 shrink-0 group-hover:scale-105 transition-transform">
                    <GraduationCap className="h-5 w-5" />
                  </div>
                  <div>
                    <span className="block text-xs font-bold text-slate-800 dark:text-slate-200">Student Tracker</span>
                    <span className="text-[10px] text-slate-455 dark:text-slate-400 font-medium">Weekly submissions ledger</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab("fees")}
                  className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl text-left hover:border-indigo-500 hover:ring-2 hover:ring-indigo-100 transition-all flex items-center gap-4 shadow-xs cursor-pointer group"
                >
                  <div className="h-10 w-10 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center text-emerald-600 shrink-0 group-hover:scale-105 transition-transform">
                    <IndianRupee className="h-5 w-5" />
                  </div>
                  <div>
                    <span className="block text-xs font-bold text-slate-800 dark:text-slate-200">Fee Collection</span>
                    <span className="text-[10px] text-slate-455 dark:text-slate-400 font-medium">Track student fee dues</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab("reports")}
                  className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl text-left hover:border-indigo-500 hover:ring-2 hover:ring-indigo-100 transition-all flex items-center gap-4 shadow-xs cursor-pointer group"
                >
                  <div className="h-10 w-10 rounded-2xl bg-rose-50 dark:bg-rose-900/20 flex items-center justify-center text-rose-500 shrink-0 group-hover:scale-105 transition-transform">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div>
                    <span className="block text-xs font-bold text-slate-800 dark:text-slate-200">Operational Reports</span>
                    <span className="text-[10px] text-slate-455 dark:text-slate-400 font-medium">Generate export metrics</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab("tasks")}
                  className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl text-left hover:border-indigo-500 hover:ring-2 hover:ring-indigo-100 transition-all flex items-center gap-4 shadow-xs cursor-pointer group"
                >
                  <div className="h-10 w-10 rounded-2xl bg-orange-50 dark:bg-orange-900/25 flex items-center justify-center text-orange-600 shrink-0 group-hover:scale-105 transition-transform">
                    <ClipboardList className="h-5 w-5" />
                  </div>
                  <div>
                    <span className="block text-xs font-bold text-slate-800 dark:text-slate-200">Tasks & Issues</span>
                    <span className="text-[10px] text-slate-455 dark:text-slate-400 font-medium">Escalate issues & assign tasks</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab("profile")}
                  className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl text-left hover:border-indigo-500 hover:ring-2 hover:ring-indigo-100 transition-all flex items-center gap-4 shadow-xs cursor-pointer group"
                >
                  <div className="h-10 w-10 rounded-2xl bg-slate-100 dark:bg-slate-800/80 flex items-center justify-center text-slate-650 dark:text-slate-350 shrink-0 group-hover:scale-105 transition-transform">
                    <User className="h-5 w-5" />
                  </div>
                  <div>
                    <span className="block text-xs font-bold text-slate-800 dark:text-slate-200">My Profile</span>
                    <span className="text-[10px] text-slate-455 dark:text-slate-400 font-medium">Faculty lead details</span>
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* 1. OPERATIONS HUB */}
          {activeTab === "overview" && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
                {[
                  { label: "Assigned Departments", value: `${depts.length} active`, icon: GraduationCap, bg: "bg-pastel-cream", text: "text-amber-600" },
                  { label: "Total Faculty", value: `${collegeMentors.length} instructors`, icon: Users, bg: "bg-pastel-blue", text: "text-blue-600" },
                  { label: "Total Students", value: `${collegeStudents.length} enrolled`, icon: Users, bg: "bg-pastel-purple", text: "text-purple-600" },
                  { label: "College Attendance", value: "82.4% Avg", icon: CheckCircle2, bg: "bg-pastel-green", text: "text-emerald-600", success: true }
                ].map((card, idx) => (
                  <Card
                    key={idx}
                    label={card.label}
                    value={card.value}
                    icon={<card.icon className="h-5 w-5" />}
                    success={card.success}
                    className={`${card.bg} border-transparent relative overflow-hidden group animate-gsap-card`}
                  />
                ))}
              </div>


              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Panel
                  title="Timetable Conflicts & Substitutions Monitor"
                  className="lg:col-span-2 animate-gsap-card"
                >
                  <div className="space-y-3">
                    <div className="p-4 rounded-xl border border-slate-150 bg-indigo-50/20 flex items-start gap-3">
                      <Clock className="h-5 w-5 text-indigo-600 shrink-0 mt-0.5" />
                      <div>
                        <h4 className="text-xs font-bold text-slate-800">Active Substitutions Rate</h4>
                        <p className="text-[11px] text-slate-500 mt-0.5 font-semibold leading-relaxed">
                          There are {activeHandovers.length} pending class swap cover requests waiting for department approval.
                        </p>
                      </div>
                    </div>

                    <div className="p-4 rounded-xl border border-slate-150 bg-emerald-50/20 flex items-start gap-3">
                      <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                      <div>
                        <h4 className="text-xs font-bold text-slate-800">Conflict Checks</h4>
                        <p className="text-[11px] text-slate-555 mt-0.5 font-semibold leading-relaxed">
                          Timetable generator reports 0 slot or room booking clashes across published courses.
                        </p>
                      </div>
                    </div>
                  </div>
                </Panel>

                <Panel title="Academic Year Info" className="animate-gsap-card">
                  <div className="space-y-4 text-xs font-semibold">
                    <div className="border-b border-slate-100 pb-2">
                      <span className="text-slate-400 font-bold block text-[9px] uppercase">Selected Academic Year</span>
                      <span className="font-bold text-slate-808 text-sm">{selectedYear}</span>
                    </div>
                    <div className="border-b border-slate-100 pb-2">
                      <span className="text-slate-400 font-bold block text-[9px] uppercase">Working Hours Structure</span>
                      <span className="font-bold text-slate-808 text-sm">{collegeHours.start} - {collegeHours.end}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 font-bold block text-[9px] uppercase">Configured Class Periods</span>
                      <span className="font-bold text-indigo-650 text-sm">{workingDays.length} Working Days</span>
                    </div>
                  </div>
                </Panel>
              </div>
            </div>
          )}

          {/* 2. ACADEMIC CONFIG */}
          {activeTab === "config" && (
            <Panel
              title="Academic Structure Configurations"
              subtitle="Manage Academic Years, Calendar Events, Working Days, and College Hours."
            >
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 text-xs font-semibold">

                {/* Academic Year CRUD */}
                <div className="space-y-4 bg-slate-50/50 p-5 rounded-2xl border border-slate-200">
                  <h3 className="text-xs font-black text-indigo-655 uppercase tracking-wider border-b border-slate-100 pb-2">Configure Academic Years</h3>
                  <form onSubmit={handleAddYear} className="flex gap-2">
                    <input
                      type="text"
                      placeholder="e.g. 2027-2028"
                      value={newYearName}
                      onChange={e => setNewYearName(e.target.value)}
                      className="flex-1 p-2.5 border border-slate-200 rounded-xl bg-white text-xs font-semibold focus:ring-1 focus:ring-indigo-500 outline-none shadow-sm"
                      required
                    />
                    <Button type="submit" variant="primary" size="md">
                      Add Year
                    </Button>
                  </form>

                  <div className="space-y-2 pt-2">
                    {(academicYears || []).map((y: any, index) => {
                      const str = typeof y === "string" ? y : y.year || y.year_name || String(index);
                      return (
                        <div key={str} className="flex items-center justify-between p-2.5 border border-slate-200 rounded-xl bg-white shadow-sm">
                        {editingYearIndex === index ? (
                          <div className="flex gap-2 w-full">
                            <input
                              type="text"
                              value={editingYearValue}
                              onChange={e => setEditingYearValue(e.target.value)}
                              className="flex-1 p-1.5 border border-slate-200 rounded-lg bg-white text-xs font-semibold focus:ring-1 focus:ring-indigo-500 outline-none"
                            />
                            <Button
                              variant="success"
                              size="xs"
                              onClick={() => handleSaveYear(index)}
                            >
                              Save
                            </Button>
                          </div>
                        ) : (
                          <>
                            <span onClick={() => { setSelectedYear(y); setCurrYear(y); setEditSubYear(y); }} className={`font-bold cursor-pointer text-[12px] flex items-center gap-1.5 ${selectedYear === y ? "text-indigo-600 font-extrabold" : "text-slate-650"}`}>
                              {y} {selectedYear === y && <CheckCircle2 className="h-3.5 w-3.5 text-indigo-600" />}
                            </span>
                            <div className="flex gap-1.5">
                              <Button variant="secondary" size="xs" onClick={() => handleEditYear(index)} title="Rename Academic Year" className="p-1">
                                <Edit2 className="h-3.5 w-3.5" />
                              </Button>
                              <Button variant="danger" size="xs" onClick={() => handleDeleteYear(index)} title="Delete Academic Year" className="p-1">
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}
                  </div>
                </div>

                {/* Hours configuration */}
                <div className="space-y-4 bg-slate-50/50 p-5 rounded-2xl border border-slate-200">
                  <h3 className="text-xs font-black text-indigo-655 uppercase tracking-wider border-b border-slate-100 pb-2">Configure Working Days & Hours</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <Input
                      label="Day Start Time"
                      value={collegeHours.start}
                      onChange={e => setCollegeHours({ ...collegeHours, start: e.target.value })}
                    />
                    <Input
                      label="Day End Time"
                      value={collegeHours.end}
                      onChange={e => setCollegeHours({ ...collegeHours, end: e.target.value })}
                    />
                  </div>

                  {/* Working days toggle */}
                  <div className="pt-2">
                    <label className="text-slate-400 block mb-2 text-[9px] uppercase font-bold">College Active Days</label>
                    <div className="flex flex-wrap gap-2.5">
                      {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map(day => {
                        const active = workingDays.includes(day);
                        return (
                          <Button
                            key={day}
                            variant={active ? "primary" : "secondary"}
                            size="sm"
                            onClick={() => {
                              if (active) {
                                setWorkingDays(workingDays.filter(d => d !== day));
                              } else {
                                setWorkingDays([...workingDays, day]);
                              }
                            }}
                          >
                            {day}
                          </Button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Daily Day Order & Day Type Setup */}
                <div className="space-y-4 bg-slate-50/50 p-5 rounded-2xl border border-slate-200 lg:col-span-2">
                  <h3 className="text-xs font-black text-indigo-655 uppercase tracking-wider border-b border-slate-100 pb-2">Daily Day Order & Status Settings</h3>
                  <form onSubmit={handleSaveDailyConfig} className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-400 uppercase font-bold block">Date</label>
                      <input
                        type="date"
                        value={dailyDateStr}
                        onChange={e => setDailyDateStr(e.target.value)}
                        className="w-full p-2.5 border border-slate-200 rounded-xl bg-white text-xs font-semibold focus:ring-1 focus:ring-indigo-500 outline-none shadow-sm cursor-pointer"
                        required
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-400 uppercase font-bold block">Day Type</label>
                      <select
                        value={dailyDayType}
                        onChange={e => {
                          const val = e.target.value as any;
                          setDailyDayType(val);
                          if (val === "holiday") {
                            setDailyDayOrder("None");
                          } else if (dailyDayOrder === "None") {
                            setDailyDayOrder("Day 1");
                          }
                        }}
                        className="w-full p-2.5 border border-slate-200 rounded-xl bg-white text-xs font-semibold focus:ring-1 focus:ring-indigo-500 outline-none shadow-sm cursor-pointer"
                      >
                        <option value="regular">Working Day</option>
                        <option value="holiday">Holiday</option>
                        <option value="event">Event</option>
                        <option value="exam_day">Exam Day</option>
                        <option value="special">Special Day</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-400 uppercase font-bold block">Day Order</label>
                      <select
                        value={dailyDayOrder}
                        onChange={e => setDailyDayOrder(e.target.value)}
                        disabled={dailyDayType === "holiday"}
                        className={`w-full p-2.5 border border-slate-200 rounded-xl bg-white text-xs font-semibold focus:ring-1 focus:ring-indigo-500 outline-none shadow-sm cursor-pointer ${
                          dailyDayType === "holiday" ? "bg-slate-100 text-slate-400 cursor-not-allowed" : ""
                        }`}
                      >
                        {Array.from({ length: workingDays.length > 0 ? workingDays.length : 5 }).map((_, idx) => (
                          <option key={idx} value={`Day ${idx + 1}`}>{`Day ${idx + 1}`}</option>
                        ))}
                        <option value="None">None</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-400 uppercase font-bold block">Session Mode</label>
                      <select
                        value={dailySessionMode}
                        onChange={e => setDailySessionMode(e.target.value as any)}
                        disabled={dailyDayType === "holiday"}
                        className={`w-full p-2.5 border border-slate-200 rounded-xl bg-white text-xs font-semibold focus:ring-1 focus:ring-indigo-500 outline-none shadow-sm cursor-pointer ${
                          dailyDayType === "holiday" ? "bg-slate-100 text-slate-400 cursor-not-allowed" : ""
                        }`}
                      >
                        <option value="Offline">Offline (In-Person)</option>
                        <option value="Online">Online (Remote)</option>
                      </select>
                    </div>

                    <div className="space-y-1 flex gap-2">
                      <div className="flex-1">
                        <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">Notes / Description</label>
                        <input
                          type="text"
                          placeholder="e.g. Day Order 1, Biometric down..."
                          value={dailyNotes}
                          onChange={e => setDailyNotes(e.target.value)}
                          className="w-full p-2 border border-slate-200 rounded-xl bg-white text-xs font-semibold focus:ring-1 focus:ring-indigo-500 outline-none"
                        />
                      </div>
                      <Button
                        type="submit"
                        variant="primary"
                        size="md"
                        disabled={isDailySaving}
                      >
                        {isDailySaving ? "Saving..." : "Save"}
                      </Button>
                    </div>
                  </form>

                  {/* Logs list */}
                  <div className="space-y-2 pt-2">
                    <h4 className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">Recent Day Order Records</h4>
                    {isDailyLoading ? (
                      <div className="text-center py-4 text-slate-400 italic text-xs">Loading records...</div>
                    ) : dailyConfigsList.length === 0 ? (
                      <div className="text-center py-4 text-slate-350 italic text-[11px] border border-dashed border-slate-200 rounded-xl bg-white">
                        No day configurations saved yet. Use the form above to log daily statuses.
                      </div>
                    ) : (
                      <div className="max-h-[200px] overflow-y-auto space-y-1.5 pr-1 divide-y divide-slate-100">
                        {dailyConfigsList.map(log => (
                          <div key={log.id} className="flex justify-between items-center py-2 first:pt-0 last:pb-0 text-[11px]">
                            <div className="flex items-center gap-3">
                              <span className="font-extrabold text-slate-800">{log.dateStr}</span>
                              <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                                log.day_type === "holiday" 
                                  ? "bg-rose-100 text-rose-700" 
                                  : log.day_type === "special" 
                                  ? "bg-amber-100 text-amber-800" 
                                  : log.day_type === "event"
                                  ? "bg-blue-100 text-blue-800"
                                  : log.day_type === "exam_day"
                                  ? "bg-purple-100 text-purple-800"
                                  : "bg-emerald-100 text-emerald-800"
                              }`}>
                                {log.day_type === "regular" ? "Working Day" : log.day_type === "exam_day" ? "Exam Day" : log.day_type}
                              </span>
                              <span className="font-black text-indigo-650 font-mono bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-md text-[9.5px]">
                                {log.day_order}
                              </span>
                              {log.day_type !== "holiday" && (
                                <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                                  log.session_mode === "Online"
                                    ? "bg-sky-100 text-sky-800"
                                    : "bg-slate-100 text-slate-700"
                                }`}>
                                  {log.session_mode || "Offline"}
                                </span>
                              )}
                            </div>
                            <span className="text-slate-450 italic font-medium">{log.notes || "—"}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Academic Calendar Events CRUD */}
                <div className="md:col-span-2 pt-6 border-t border-slate-200 space-y-4">
                  <div className="flex justify-between items-center flex-wrap gap-3 pb-2 border-b border-slate-100">
                    <h3 className="text-xs font-black text-indigo-705 uppercase tracking-wider">
                      Manage Academic Calendar Milestones
                    </h3>
                    <div className="relative w-full max-w-xs">
                      <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Search events..."
                        value={searchEventQuery}
                        onChange={e => setSearchEventQuery(e.target.value)}
                        className="w-full pl-9 pr-3 py-1.5 border border-slate-200 bg-white text-xs rounded-xl focus:ring-1 focus:ring-indigo-500 outline-none font-semibold shadow-sm"
                      />
                    </div>
                  </div>

                  <form onSubmit={handleSaveEvent} className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50/50 p-5 border border-slate-200 rounded-2xl">
                    <Input
                      label="Event Title"
                      placeholder="e.g. CIA 2 Commencement"
                      value={calendarEventName}
                      onChange={e => setCalendarEventName(e.target.value)}
                      required
                    />
                    <Input
                      label="Event Date"
                      type="date"
                      value={calendarEventDate}
                      onChange={e => setCalendarEventDate(e.target.value)}
                      required
                    />
                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-455 font-bold block">Agendas / Descriptions</label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="Short descriptions..."
                          value={calendarEventDesc}
                          onChange={e => setCalendarEventDesc(e.target.value)}
                          className="flex-1 p-2.5 border border-slate-200 rounded-xl bg-white text-xs font-semibold focus:ring-1 focus:ring-indigo-500 outline-none shadow-sm"
                        />
                        <Button type="submit" variant="primary" size="md">
                          Add Event
                        </Button>
                      </div>
                    </div>
                  </form>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 pt-2">
                    {academicEvents
                      .filter(e => e.name.toLowerCase().includes(searchEventQuery.toLowerCase()))
                      .map(e => {
                        const isEditing = editingEventId === e.id;
                        return (
                          <div key={e.id} className="p-4 rounded-2xl border border-slate-200 bg-white shadow-sm relative group flex flex-col justify-between min-h-[100px] hover:shadow-md transition-all">
                            {isEditing ? (
                              <form onSubmit={(ev) => handleSaveInlineEvent(ev, e.id)} className="space-y-2.5 w-full">
                                <Input label="Title" value={editEventName} onChange={ev => setEditEventName(ev.target.value)} required />
                                <Input label="Date" type="date" value={editEventDate} onChange={ev => setEditEventDate(ev.target.value)} required />
                                <Input label="Description" value={editEventDesc} onChange={ev => setEditEventDesc(ev.target.value)} />
                                <div className="flex gap-1.5 pt-1.5">
                                  <Button type="submit" variant="success" size="xs" className="flex-1">Save</Button>
                                  <Button type="button" variant="secondary" size="xs" onClick={() => setEditingEventId(null)}>Cancel</Button>
                                </div>
                              </form>
                            ) : (
                              <>
                                <div className="absolute right-3 top-3 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-all">
                                  <Button variant="secondary" size="xs" onClick={() => handleStartEditEvent(e)} title="Edit Event" className="p-1">
                                    <Edit2 className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button variant="danger" size="xs" onClick={() => handleDeleteEvent(e.id)} title="Delete Event" className="p-1">
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                                <div>
                                  <span className="text-[10px] text-indigo-600 font-extrabold block">{e.date}</span>
                                  <h4 className="text-xs font-bold text-slate-808 mt-1 pr-10">{e.name}</h4>
                                </div>
                                <p className="text-[10.5px] text-slate-400 mt-2 font-semibold line-clamp-2 leading-relaxed">{e.desc || "No description provided."}</p>
                              </>
                            )}
                          </div>
                        );
                      })}
                  </div>
                </div>

                {/* Student Profile Editing Permissions */}
                <div className="md:col-span-2 pt-6 border-t border-slate-200 space-y-4">
                  <div>
                    <h3 className="text-xs font-black text-indigo-705 uppercase tracking-wider">
                      Student Profile Editing Permissions
                    </h3>
                    <p className="text-[10px] text-slate-400 font-semibold mt-0.5">
                      Enable or disable profile editing access for students belonging to specific class groups.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 pt-2">
                    {Array.from(new Set(students.map(s => s.classGroup).filter(Boolean))).map(cls => {
                      const isAllowed = allowedProfileEditClasses.includes(cls);
                      return (
                        <div key={cls} className="p-4.5 rounded-2xl border border-slate-200 bg-white shadow-sm flex items-center justify-between gap-4 hover:shadow-md transition-all font-sans">
                          <div className="space-y-1">
                            <h4 className="text-xs font-bold text-slate-805">{cls}</h4>
                            <span className="text-[9px] text-slate-400 font-semibold block">
                              {students.filter(s => s.classGroup === cls).length} enrolled students
                            </span>
                          </div>

                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={isAllowed}
                              onChange={() => toggleClassProfileEdit(cls)}
                              className="sr-only peer"
                            />
                            <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                          </label>
                        </div>
                      );
                    })}
                  </div>
                </div>

              </div>
              </Panel>
            )}

            {/* 3. CURRICULUM MAP */}
            {activeTab === "curriculum" && (
              <Panel
                title="Curriculum & Subject Mapping"
                subtitle="View subjects organised by Department → Year → Semester. Register departments and map subjects."
                headerActions={
                  <>
                    <Button variant="primary" size="sm" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => setShowAddSubjectForm(v => !v)}>
                      {showAddSubjectForm ? "Cancel" : "+ Subject"}
                    </Button>
                    <Button variant="secondary" size="sm" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => setShowAddDeptForm(v => !v)}>
                      {showAddDeptForm ? "Cancel" : "+ Department"}
                    </Button>
                  </>
                }
              >
                {/* Add Subject Form */}
                {showAddSubjectForm && (
                  <div className="mb-5 bg-indigo-50/40 border border-indigo-100 rounded-2xl p-5 shadow-sm animate-fade-in">
                    <h3 className="text-xs font-black text-indigo-700 uppercase tracking-wider border-b border-indigo-100 pb-2 mb-3">Map New Subject</h3>
                    <form onSubmit={async (e) => { await handleSaveSubject(e); setShowAddSubjectForm(false); }} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      <div className="sm:col-span-2 lg:col-span-3">
                        <Input label="Subject Name" placeholder="e.g. CS403: Artificial Intelligence" value={currName} onChange={e => setCurrName(e.target.value)} required />
                      </div>
                      <Select label="Department" value={currDept} onChange={e => setCurrDept(e.target.value)} options={coursesList.map(d => ({ value: d.name, label: d.name }))} />
                      <Select label="Semester" value={currSemester} onChange={e => setCurrSemester(e.target.value)} options={["Semester 1","Semester 2","Semester 3","Semester 4","Semester 5","Semester 6","Semester 7","Semester 8"].map(s => ({ value: s, label: s }))} />
                      <Select label="Academic Year" value={currYear} onChange={e => setCurrYear(e.target.value)} options={(academicYears || []).map((yr: any) => { const str = typeof yr === "string" ? yr : yr.year || yr.year_name || String(yr); return { value: str, label: str }; })} />
                      <Select label="Shift" value={currShift} onChange={e => setCurrShift(e.target.value)} options={[{value:"General",label:"General (Both Shifts)"},{value:"Shift 1",label:"Shift 1 (Day)"},{value:"Shift 2",label:"Shift 2 (Evening)"},{value:"Both",label:"Both Shifts"}]} />
                      <Input label="Weekly Hours" type="number" min={1} max={10} value={currHours} onChange={e => setCurrHours(parseInt(e.target.value) || 4)} required />
                      <Select label="Subject Type" value={currType} onChange={e => setCurrType(e.target.value)} options={[{value:"theory",label:"Theory"},{value:"practical",label:"Practical"},{value:"elective",label:"Elective"},{value:"laboratory",label:"Laboratory"}]} />
                      <div className="sm:col-span-2 lg:col-span-3 flex gap-2 pt-1">
                        <Button type="submit" variant="primary" size="md" className="flex-1">Map Subject</Button>
                        <Button type="button" variant="secondary" size="md" onClick={() => setShowAddSubjectForm(false)}>Cancel</Button>
                      </div>
                    </form>
                  </div>
                )}

                {/* Add Department Form */}
                {showAddDeptForm && (
                  <div className="mb-5 bg-slate-50 border border-slate-200 rounded-2xl p-5 shadow-sm animate-fade-in">
                    <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider border-b border-slate-200 pb-2 mb-3">Register New Department</h3>
                    <form onSubmit={async (e) => { await handleSaveDept(e); setShowAddDeptForm(false); }} className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                      <Input label="Department Name" placeholder="e.g. Information Technology" value={deptName} onChange={e => setDeptName(e.target.value)} required />
                      <Input label="Department Code" placeholder="e.g. IT" value={deptCode} onChange={e => setDeptCode(e.target.value)} required />
                      <Select label="Shift Scope" value={deptShift} onChange={e => setDeptShift(e.target.value)} options={[{value:"shift_1",label:"Shift 1 (Day)"},{value:"shift_2",label:"Shift 2 (Evening)"},{value:"both",label:"Both Shifts (Shift 1 & 2)"},{value:"general",label:"General (Full Day)"}]} />
                      <div className="sm:col-span-3 lg:col-span-4 space-y-1">
                        <label className="text-slate-400 text-[10px] uppercase font-bold">Description</label>
                        <input type="text" placeholder="Brief summary..." value={deptDesc} onChange={e => setDeptDesc(e.target.value)} className="w-full p-2.5 border border-slate-200 rounded-xl bg-white text-xs font-semibold focus:ring-1 focus:ring-indigo-500 outline-none shadow-sm" />
                      </div>
                      <div className="sm:col-span-3 lg:col-span-4 flex gap-2 pt-1">
                        <Button type="submit" variant="primary" size="md" className="flex-1">Add Department</Button>
                        <Button type="button" variant="secondary" size="md" onClick={() => setShowAddDeptForm(false)}>Cancel</Button>
                      </div>
                    </form>
                  </div>
                )}

                {/* Search & stats bar */}
                <div className="flex flex-wrap items-center gap-2 mb-4 pb-4 border-b border-slate-100">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                    <input type="text" placeholder="Search subjects..." value={subjectSearch} onChange={e => setSubjectSearch(e.target.value)} className="pl-8 pr-3 py-1.5 border border-slate-200 rounded-xl bg-slate-50 text-[11px] focus:ring-1 focus:ring-indigo-500 outline-none font-semibold w-48 shadow-sm" />
                  </div>
                  <select value={subjectTypeFilter} onChange={e => setSubjectTypeFilter(e.target.value)} className="p-1.5 border border-slate-200 rounded-xl bg-white text-[10px] cursor-pointer font-bold outline-none shadow-sm">
                    <option value="all">All Types</option>
                    <option value="SKILL">SKILL</option>
                    <option value="ACADEMIC">ACADEMIC</option>
                    <option value="LAB">LAB</option>
                    <option value="GENERAL">GENERAL</option>
                  </select>
                  <select value={subjectShiftFilter} onChange={e => setSubjectShiftFilter(e.target.value)} className="p-1.5 border border-slate-200 rounded-xl bg-white text-[10px] cursor-pointer font-bold outline-none shadow-sm">
                    <option value="all">All Shifts</option>
                    <option value="Shift 1">Shift 1 (Day)</option>
                    <option value="Shift 2">Shift 2 (Evening)</option>
                    <option value="General">General / Both Shifts</option>
                  </select>
                  <span className="ml-auto text-[10px] text-slate-400 font-semibold">{subjectsList.length} subjects · {coursesList.length} departments</span>
                </div>

                {/* ===== UNIFIED TREE: Department → Year → Semester → Subjects ===== */}
                {(() => {
                  const YEAR_SEM_MAP: Record<string, string[]> = {
                    "Year 1": ["Semester 1", "Semester 2"],
                    "Year 2": ["Semester 3", "Semester 4"],
                    "Year 3": ["Semester 5", "Semester 6"],
                    "Year 4": ["Semester 7", "Semester 8"],
                  };
                  const YEARS = ["Year 1", "Year 2", "Year 3", "Year 4"];
                  const ALL_KNOWN_SEMS = Object.values(YEAR_SEM_MAP).flat();

                  const filteredSubs = subjectsList.filter(sub => {
                    const ms = sub.name.toLowerCase().includes(subjectSearch.toLowerCase());
                    const mt = subjectTypeFilter === "all" || sub.type === subjectTypeFilter;
                    const subShiftStr = sub.shift || "General";
                    const mshift = subjectShiftFilter === "all"
                      ? true
                      : subShiftStr === subjectShiftFilter ||
                        subShiftStr === "General" ||
                        subShiftStr === "Both";
                    return ms && mt && mshift;
                  });

                  const registeredDeptNames = coursesList.map(d => d.name);
                  const subjectDeptNames = [...new Set(filteredSubs.map(s => s.department).filter(Boolean))];
                  const allDeptNames = [...new Set([...registeredDeptNames, ...subjectDeptNames])].sort();

                  if (allDeptNames.length === 0) return (
                    <div className="py-12 text-center border rounded-2xl bg-white">
                      <GraduationCap className="h-8 w-8 text-slate-300 mx-auto mb-3" />
                      <p className="text-sm font-semibold text-slate-400">No departments or subjects found</p>
                      <p className="text-[10px] text-slate-300 mt-1">Use <strong>+ Department</strong> and <strong>+ Subject</strong> above to get started.</p>
                    </div>
                  );

                  return (
                    <div className="space-y-4 text-xs font-semibold">
                      {allDeptNames.map(deptName => {
                        const registeredDept = coursesList.find(d => d.name === deptName);
                        
                        // Flexible subject matching helper
                        const norm = (str: string) => (str || "").toLowerCase().replace(/[^a-z0-9]/g, "");
                        const isDeptSubjectMatch = (subDept: string, dName: string, dCode?: string) => {
                          if (!subDept || !dName) return false;
                          const nSub = norm(subDept);
                          const nName = norm(dName);
                          if (nSub === nName) return true;
                          if (dCode && nSub === norm(dCode)) return true;
                          const baseSub = norm(subDept.replace(/\s*-\s*(Semester|Sem|Year|Yr|Shift|Batch)\s*\d+/gi, ""));
                          const baseName = norm(dName.replace(/\s*-\s*(Semester|Sem|Year|Yr|Shift|Batch)\s*\d+/gi, ""));
                          return baseSub === baseName || (nSub.length > 4 && nName.length > 4 && (nSub.includes(nName) || nName.includes(nSub)));
                        };

                        const deptSubjects = filteredSubs.filter(s => isDeptSubjectMatch(s.department, deptName, registeredDept?.code));
                        const isEditingDept = editingDeptId === registeredDept?.id;
                        const isDeptExpanded = !!expandedDepts[deptName];

                        const yearGroups = YEARS.map(yr => ({
                          yr,
                          sems: YEAR_SEM_MAP[yr].map(sem => ({
                            sem,
                            subjects: deptSubjects.filter(s => s.semester === sem)
                          })).filter(sg => sg.subjects.length > 0)
                        })).filter(yg => yg.sems.length > 0);

                        const ungrouped = deptSubjects.filter(s => !ALL_KNOWN_SEMS.includes(s.semester || ""));

                        return (
                          <div key={deptName} className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden transition-all duration-200">

                            {/* ── DEPARTMENT HEADER (Collapsible Card Style) ── */}
                            {isEditingDept ? (
                              <div className="bg-indigo-50/40 border-b border-indigo-100 p-4">
                                <form onSubmit={(ev) => handleSaveInlineDept(ev, registeredDept!.id)} className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                                  <Input label="Dept Name" value={editDeptName} onChange={ev => setEditDeptName(ev.target.value)} required />
                                  <Input label="Dept Code" value={editDeptCode} onChange={ev => setEditDeptCode(ev.target.value)} required />
                                  <Select label="Shift Scope" value={editDeptShift} onChange={ev => setEditDeptShift(ev.target.value)} options={[{value:"shift_1",label:"Shift 1 (Day)"},{value:"shift_2",label:"Shift 2 (Evening)"},{value:"both",label:"Both Shifts (Shift 1 & 2)"},{value:"general",label:"General (Full Day)"}]} />
                                  <div className="space-y-1">
                                    <label className="text-[9px] uppercase font-bold text-slate-400">Description</label>
                                    <input type="text" value={editDeptDesc} onChange={ev => setEditDeptDesc(ev.target.value)} className="w-full p-2.5 border border-slate-200 rounded-xl text-xs font-semibold outline-none" />
                                  </div>
                                  <div className="sm:col-span-3 lg:col-span-4 flex gap-2">
                                    <Button type="submit" variant="success" size="xs" className="flex-1">Save</Button>
                                    <Button type="button" variant="secondary" size="xs" onClick={() => setEditingDeptId(null)}>Cancel</Button>
                                  </div>
                                </form>
                              </div>
                            ) : (
                              <div
                                onClick={() => setExpandedDepts(prev => ({ ...prev, [deptName]: !prev[deptName] }))}
                                className="flex items-center justify-between px-5 py-4 bg-slate-50 hover:bg-slate-100/70 border-b border-slate-200/50 cursor-pointer select-none transition-all duration-200 group"
                              >
                                <div className="flex items-center gap-3">
                                  <GraduationCap className="h-4 w-4 text-slate-400 shrink-0" />
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <span className="text-[12px] font-black text-slate-800">{deptName}</span>
                                      {registeredDept?.code && <span className="text-[9px] px-1.5 py-0.5 bg-indigo-50 border border-indigo-150 text-indigo-700 rounded font-bold uppercase">{registeredDept.code}</span>}
                                      {registeredDept && (
                                        <span className={`text-[9px] px-2 py-0.5 border rounded font-bold uppercase ${
                                          registeredDept.default_shift === "both" || registeredDept.shift_based === 1
                                            ? "bg-purple-50 border-purple-200 text-purple-700"
                                            : registeredDept.default_shift === "shift_1"
                                            ? "bg-teal-50 border-teal-200 text-teal-700"
                                            : registeredDept.default_shift === "shift_2"
                                            ? "bg-amber-50 border-amber-200 text-amber-700"
                                            : "bg-slate-100 border-slate-200 text-slate-700"
                                        }`}>
                                          {registeredDept.default_shift === "both" || registeredDept.shift_based === 1
                                            ? "Shift 1 & 2 (Both Shifts)"
                                            : registeredDept.default_shift === "shift_1"
                                            ? "Shift 1 (Day)"
                                            : registeredDept.default_shift === "shift_2"
                                            ? "Shift 2 (Eve)"
                                            : "General (Full Day)"}
                                        </span>
                                      )}
                                    </div>
                                    {registeredDept?.description && <p className="text-[10px] text-slate-400 mt-0.5 font-medium">{registeredDept.description}</p>}
                                  </div>
                                </div>
                                <div className="flex items-center gap-3" onClick={e => e.stopPropagation()}>
                                  <span className="text-[9px] font-bold px-2.5 py-0.5 bg-slate-200 text-slate-600 rounded-full">{deptSubjects.length} subjects</span>
                                  {registeredDept && (
                                    <div className="flex gap-1">
                                      <Button variant="ghost" size="xs" onClick={() => handleStartEditDept(registeredDept)} className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50"><Edit2 className="h-3 w-3" /></Button>
                                      <Button variant="ghost" size="xs" onClick={() => handleDeleteDept(registeredDept.id)} className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50"><Trash2 className="h-3 w-3" /></Button>
                                    </div>
                                  )}
                                  <ChevronDown className={`h-4.5 w-4.5 text-slate-400 transition-transform duration-200 ml-1 ${isDeptExpanded ? "rotate-180 text-indigo-500" : ""}`} onClick={() => setExpandedDepts(prev => ({ ...prev, [deptName]: !prev[deptName] }))} />
                                </div>
                              </div>
                            )}

                            {/* ── COLLAPSIBLE DEPARTMENT CONTENT ── */}
                            {isDeptExpanded && (
                              <div className="divide-y divide-slate-100 bg-white animate-fade-in">
                                {yearGroups.length > 0 || ungrouped.length > 0 ? (
                                  <>
                                    {yearGroups.map(({ yr, sems }) => (
                                      <div key={yr} className="p-4 bg-slate-50/30">
                                        {/* Year Sub-section Row */}
                                        <div className="flex items-center gap-2 mb-3 px-1">
                                          <div className="h-1.5 w-1.5 rounded-full bg-indigo-500"></div>
                                          <span className="text-[10px] font-black text-indigo-700 uppercase tracking-wider">{yr}</span>
                                          <span className="text-[9px] text-slate-400 font-medium">· {sems.reduce((a,s)=>a+s.subjects.length,0)} mapped subjects</span>
                                        </div>

                                        {/* Collapsible Semester Cards */}
                                        <div className="space-y-2 pl-3">
                                          {sems.map(({ sem, subjects }) => {
                                            const semKey = `${deptName}-${yr}-${sem}`;
                                            const isSemExpanded = !!expandedSems[semKey];

                                            return (
                                              <div key={sem} className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-xs hover:border-slate-300 transition-all duration-200">
                                                {/* Semester Card Header */}
                                                <div
                                                  onClick={() => setExpandedSems(prev => ({ ...prev, [semKey]: !prev[semKey] }))}
                                                  className="flex items-center justify-between px-4 py-2.5 bg-slate-50/50 hover:bg-slate-50 cursor-pointer select-none transition-colors"
                                                >
                                                  <span className="text-[10px] font-bold text-slate-700 uppercase tracking-wide">{sem}</span>
                                                  <div className="flex items-center gap-2">
                                                    <span className="text-[9px] font-bold px-2 py-0.5 bg-indigo-50 border border-indigo-100 text-indigo-600 rounded-full">{subjects.length} Subjects</span>
                                                    <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform duration-200 ${isSemExpanded ? "rotate-180 text-indigo-500" : ""}`} />
                                                  </div>
                                                </div>

                                                {/* Collapsible Subjects Table inside Semester Card */}
                                                {isSemExpanded && (
                                                  <div className="border-t border-slate-100 animate-fade-in">
                                                    <div className="grid grid-cols-12 gap-2 px-4 py-1.5 bg-slate-50/40 text-[8px] uppercase font-black text-slate-400 tracking-wider border-b border-slate-50">
                                                      <span className="col-span-5">Subject Name</span>
                                                      <span className="col-span-2">Type</span>
                                                      <span className="col-span-2">Shift</span>
                                                      <span className="col-span-2 text-right">Target Hrs</span>
                                                      <span className="col-span-1"></span>
                                                    </div>

                                                    <div className="divide-y divide-slate-50">
                                                      {subjects.map(sub => {
                                                        const isEditing = editingSubjectId === sub.id;
                                                        return isEditing ? (
                                                          <div key={sub.id} className="bg-indigo-50/30 px-4 py-3">
                                                            <form onSubmit={(ev) => handleSaveInlineSubject(ev, sub.id)} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                                                              <div className="sm:col-span-2 lg:col-span-3">
                                                                <Input label="Subject Name" value={editSubName} onChange={ev => setEditSubName(ev.target.value)} required />
                                                              </div>
                                                              <Select label="Semester" value={editSubSemester} onChange={ev => setEditSubSemester(ev.target.value)} options={["Semester 1","Semester 2","Semester 3","Semester 4","Semester 5","Semester 6","Semester 7","Semester 8"].map(s => ({ value: s, label: s }))} />
                                                              <Select label="Type" value={editSubType} onChange={ev => setEditSubType(ev.target.value)} options={[{value:"theory",label:"Theory"},{value:"practical",label:"Practical"},{value:"elective",label:"Elective"},{value:"laboratory",label:"Laboratory"}]} />
                                                              <Input label="Weekly Hours" type="number" value={editSubHours} onChange={ev => setEditSubHours(parseInt(ev.target.value) || 4)} required />
                                                              <Select label="Department" value={editSubDept} onChange={ev => setEditSubDept(ev.target.value)} options={coursesList.map(d => ({ value: d.name, label: d.name }))} />
                                                              <Select label="Shift" value={editSubShift} onChange={ev => setEditSubShift(ev.target.value)} options={[{value:"General",label:"General"},{value:"Shift 1",label:"Shift 1 (Day)"},{value:"Shift 2",label:"Shift 2 (Evening)"}]} />
                                                              <Select label="Academic Year" value={editSubYear} onChange={ev => setEditSubYear(ev.target.value)} options={(academicYears || []).map((yr2: any) => { const str = typeof yr2 === "string" ? yr2 : yr2.year || yr2.year_name || String(yr2); return { value: str, label: str }; })} />
                                                              <div className="sm:col-span-2 lg:col-span-3 flex gap-2">
                                                                <Button type="submit" variant="success" size="xs" className="flex-1">Save</Button>
                                                                <Button type="button" variant="secondary" size="xs" onClick={() => setEditingSubjectId(null)}>Cancel</Button>
                                                              </div>
                                                            </form>
                                                          </div>
                                                        ) : (
                                                          <div key={sub.id} className="grid grid-cols-12 gap-2 items-center px-4 py-2 hover:bg-slate-50/50 transition-all group">
                                                            <div className="col-span-5 font-semibold text-slate-700 text-[11px] truncate pr-2">{sub.name}</div>
                                                            <div className="col-span-2">
                                                              <span className={`inline-flex px-1.5 py-0.5 rounded text-[8px] uppercase font-bold ${
                                                                sub.type === "practical" ? "bg-amber-50 border border-amber-200 text-amber-700" :
                                                                sub.type === "laboratory" ? "bg-rose-50 border border-rose-200 text-rose-700" :
                                                                sub.type === "elective" ? "bg-violet-50 border border-violet-200 text-violet-700" :
                                                                "bg-indigo-50 border border-indigo-200 text-indigo-700"
                                                              }`}>{sub.type}</span>
                                                            </div>
                                                            <div className="col-span-2">
                                                              <span className={`inline-flex px-1.5 py-0.5 rounded text-[8px] uppercase font-bold ${
                                                                sub.shift === "Shift 1" ? "bg-blue-50 border border-blue-200 text-blue-700" :
                                                                sub.shift === "Shift 2" ? "bg-purple-50 border border-purple-200 text-purple-700" :
                                                                "bg-gray-50 border border-gray-200 text-gray-700"
                                                              }`}>{sub.shift || "General"}</span>
                                                            </div>
                                                            <div className="col-span-2 text-right font-extrabold text-indigo-600">{sub.weekly_hours || 4}</div>
                                                            <div className="col-span-1 flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                                              <Button variant="secondary" size="xs" onClick={() => handleStartEditSubject(sub)} className="p-1"><Edit2 className="h-3 w-3" /></Button>
                                                              <Button variant="danger" size="xs" onClick={() => handleDeleteSubject(sub.id)} className="p-1"><Trash2 className="h-3 w-3" /></Button>
                                                            </div>
                                                          </div>
                                                        );
                                                      })}
                                                    </div>
                                                  </div>
                                                )}
                                              </div>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    ))}

                                    {ungrouped.length > 0 && (
                                      <div className="p-4 bg-slate-50/10">
                                        <div className="flex items-center gap-2 mb-2 px-1">
                                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Other Semesters</span>
                                        </div>
                                        <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl bg-white overflow-hidden pl-3">
                                          {ungrouped.map(sub => (
                                            <div key={sub.id} className="grid grid-cols-12 gap-2 items-center px-4 py-2 hover:bg-indigo-50/20 transition-all group">
                                              <div className="col-span-4 font-semibold text-slate-700 text-[11px] truncate">{sub.name}</div>
                                              <div className="col-span-2 text-[9px] text-slate-400">{sub.semester}</div>
                                              <div className="col-span-3">
                                                <span className="inline-flex px-1.5 py-0.5 rounded text-[8px] uppercase font-bold bg-indigo-50 border border-indigo-200 text-indigo-700">{sub.type}</span>
                                              </div>
                                              <div className="col-span-1 text-right font-extrabold text-indigo-600">{sub.weekly_hours || 4}</div>
                                              <div className="col-span-2 flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                                <Button variant="secondary" size="xs" onClick={() => handleStartEditSubject(sub)} className="p-1"><Edit2 className="h-3 w-3" /></Button>
                                                <Button variant="danger" size="xs" onClick={() => handleDeleteSubject(sub.id)} className="p-1"><Trash2 className="h-3 w-3" /></Button>
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                  </>
                                ) : (
                                  <div className="px-5 py-6 text-center text-[11px] text-slate-400 italic bg-white">No subjects mapped for this department</div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </Panel>
            )}

            {/* 4. FACULTY ALLOCATION */}
            {activeTab === "faculty" && (
              <Panel
                title="Faculty Deployment & Workloads"
                subtitle="Manage instructor target workloads, configuration parameters, and emergency replacements."
                headerActions={
                  <>
                    <div className="relative w-full sm:w-auto">
                      <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Search faculty..."
                        value={facultySearch}
                        onChange={e => setFacultySearch(e.target.value)}
                        className="pl-8 pr-3 py-1.5 border border-slate-205 rounded-xl bg-slate-50 text-[11px] focus:ring-1 focus:ring-indigo-500 outline-none font-semibold w-full sm:w-40 shadow-sm"
                      />
                    </div>
                    <select
                      value={facultyDeptFilter}
                      onChange={e => setFacultyDeptFilter(e.target.value)}
                      className="p-1.5 border border-slate-200 rounded-xl bg-white text-[10px] cursor-pointer font-bold outline-none shadow-sm flex-grow sm:flex-grow-0"
                    >
                      <option value="all">All Depts</option>
                      {facultyDepts.map(d => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                    <Button 
                      variant="primary" 
                      size="sm" 
                      onClick={() => setShowSubstitutionModal(true)}
                      icon={<Plus className="h-3.5 w-3.5" />}
                    >
                      Substitution
                    </Button>
                    <Button 
                      variant="success" 
                      size="sm" 
                      onClick={() => handleOpenMentorModal()}
                      icon={<Plus className="h-3.5 w-3.5" />}
                    >
                      Add Mentor
                    </Button>
                  </>
                }
              >
                      <div className="space-y-6">
                        <div>
                          <h3 className="text-xs font-black text-indigo-705 uppercase tracking-wider">Faculty Workload Distribution</h3>
                          <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Real-time teaching allocation mapped against weekly targets.</p>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 pt-2">
                          {collegeMentors
                            .filter(m => {
                              const matchesSearch = m.name.toLowerCase().includes(facultySearch.toLowerCase());
                              const matchesDept = facultyDeptFilter === "all" || m.department === facultyDeptFilter;
                              return matchesSearch && matchesDept;
                            })
                            .map(m => {
                              const hoursCount = slots.filter(s => s.mentorId === m.id).length;
                              const limit = facultyWorkloadLimits[m.id] || 16;
                              const shiftVal = facultyShifts[m.id] || m.shift || "general";
                              const pct = Math.min((hoursCount / limit) * 100, 100);
                              const isOverloaded = hoursCount > limit;

                              return (
                                <div key={m.id} className="bg-white border border-slate-150 rounded-2xl p-5 flex flex-col justify-between space-y-4 shadow-sm hover:shadow-md transition-all duration-300 relative group font-sans">
                                  
                                  {/* Action Buttons */}
                                  <div className="absolute right-3 top-3 flex items-center gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => handleStartEditFaculty(m)}
                                      title="Configure Workload"
                                      className="p-2 bg-slate-50 hover:bg-amber-50 border border-slate-150 text-slate-500 hover:text-amber-600 rounded-xl transition-all cursor-pointer shadow-xs hover:scale-105"
                                    >
                                      <SlidersHorizontal className="h-3.5 w-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleOpenMentorModal(m)}
                                      title="Edit Info & Map Subjects"
                                      className="p-2 bg-slate-50 hover:bg-indigo-55 hover:bg-indigo-50 border border-slate-150 text-slate-500 hover:text-indigo-650 rounded-xl transition-all cursor-pointer shadow-xs hover:scale-105"
                                    >
                                      <Edit2 className="h-3.5 w-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteMentor(m.id)}
                                      title="Delete Mentor"
                                      className="p-2 bg-slate-50 hover:bg-rose-50 border border-slate-150 text-slate-500 hover:text-rose-600 rounded-xl transition-all cursor-pointer shadow-xs hover:scale-105"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                  </div>

                                  {/* Top Profile Summary */}
                                  <div className="flex items-center gap-3">
                                    <div className="h-10 w-10 rounded-full bg-slate-100 border border-slate-200 text-indigo-650 flex items-center justify-center font-black text-sm uppercase shrink-0">
                                      {m.name.substring(0, 2)}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <h4 className="text-xs font-black text-slate-800 truncate pr-6" title={m.name}>{m.name}</h4>
                                      <span className="text-[9.5px] text-slate-400 font-bold block truncate mt-0.5">
                                        Dept: {m.department} {m.subject_group ? `• Group: ${m.subject_group}` : ""}
                                      </span>
                                    </div>
                                  </div>

                                  {/* Shift & Workload Badges */}
                                  <div className="flex flex-wrap gap-1.5">
                                    <span className="px-2 py-0.5 rounded-lg bg-indigo-50 border border-indigo-100 text-[8px] font-black text-indigo-750 uppercase">
                                      {shiftVal.replace("_", " ")}
                                    </span>
                                    <span className="px-2 py-0.5 rounded-lg bg-slate-50 border border-slate-205 text-[8px] font-black text-slate-700 uppercase">
                                      {hoursCount} {hoursCount === 1 ? 'hr' : 'hrs'} / week
                                    </span>
                                  </div>

                                  {/* Handled Assignments with hours per week */}
                                  <div className="pt-2 border-t border-slate-100 space-y-1.5 flex-grow">
                                    <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Handled Assignments</span>
                                    <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                                      {(() => {
                                        const mentorSlots = slots.filter(s => s.mentorId === m.id);
                                        const assignmentCounts: Record<string, number> = {};
                                        mentorSlots.forEach(s => {
                                          const key = `${s.classGroup} • ${s.course}`;
                                          assignmentCounts[key] = (assignmentCounts[key] || 0) + 1;
                                        });

                                        const entries = Object.entries(assignmentCounts);
                                        if (entries.length > 0) {
                                          return entries.map(([assign, count], idx) => {
                                            const [cohort, course] = assign.split(' • ');
                                            const cleanCohort = cohort.replace(/(\s*\(Shift\s*\d+\))?\s*-\s*SEM\s*\w+\s*\(\d+-\d+\)/i, '');
                                            return (
                                              <div key={idx} className="flex justify-between items-center p-2 bg-slate-50 border border-slate-100 rounded-xl text-[10px] font-semibold text-slate-700 hover:bg-slate-100/50 transition-colors">
                                                <div className="flex flex-col min-w-0 pr-2">
                                                  <span className="text-slate-808 font-black truncate">{course}</span>
                                                  <span className="text-slate-400 font-bold truncate mt-0.5">{cleanCohort}</span>
                                                </div>
                                                <span className="shrink-0 px-2 py-0.5 bg-indigo-50 border border-indigo-100 text-indigo-705 font-black text-[9px] rounded-lg">
                                                  {count} {count === 1 ? 'hr' : 'hrs'} / wk
                                                </span>
                                              </div>
                                            );
                                          });
                                        }
                                        return (
                                          <div className="text-[9px] text-slate-400 font-bold italic py-1">No active teaching slots.</div>
                                        );
                                      })()}
                                    </div>
                                  </div>

                                </div>
                              );
                            })}
                        </div>
                      </div>
                    </Panel>
                  )}

                  {/* 5. TIMETABLES & ROOMS */}
                  {activeTab === "timetable" && (() => {
                    const activeCollege = colleges.find(c => c.id === activeCollegeId);
                    const hasShifts = activeCollege ? activeCollege.has_shifts !== 0 : true;
                    const existingClassGroups = Array.from(new Set(collegeSlots.map(s => s.classGroup).filter((g): g is string => Boolean(g))));
                    const DAYS = workingDays.length > 0 ? workingDays : ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

                    const cohortCourses = Array.from(new Set(activeBatches.map(cg => {
                      const slot = collegeSlots.find(s => s.classGroup === cg);
                      return slot?.department || getCourseFromClassGroup(cg);
                    }).filter(Boolean)));

                    const cohortSemesters = activeBatches
                      .filter(cg => {
                        const slot = collegeSlots.find(s => s.classGroup === cg);
                        const c = slot?.department || getCourseFromClassGroup(cg);
                        return c === selectedCohortCourse;
                      })
                      .map(cg => {
                        const slot = collegeSlots.find(s => s.classGroup === cg);
                        return slot?.semester || getSemesterFromClassGroup(cg);
                      });

                    const previewTimeSlots = getTimeSlots(
                      hasShifts ? (timetableSubTab === "view" ? viewerShift : genShift) : "general",
                      timetableSubTab === "view" ? selectedCohortSem : genSelectedSemester
                    );

                    const activeShiftLabel = hasShifts ? (timetableSubTab === "view" ? viewerShift : genShift) : "general";
                    const activeSemesterLabel = timetableSubTab === "view" ? selectedCohortSem : genSelectedSemester;

                    const getCleanSemesterKey = (sem?: string) => {
                      if (!sem) return "";
                      const clean = sem.toLowerCase().trim();
                      if (clean.includes("sem i") || clean.includes("sem 1") || clean.includes("semester 1") || clean.includes("semester i")) return "Semester 1";
                      if (clean.includes("sem ii") || clean.includes("sem 2") || clean.includes("semester 2") || clean.includes("semester ii")) return "Semester 2";
                      if (clean.includes("sem iii") || clean.includes("sem 3") || clean.includes("semester 3") || clean.includes("semester iii")) return "Semester 3";
                      if (clean.includes("sem iv") || clean.includes("sem 4") || clean.includes("semester 4") || clean.includes("semester iv")) return "Semester 4";
                      if (clean.includes("sem v") || clean.includes("sem 5") || clean.includes("semester 5") || clean.includes("semester v")) return "Semester 5";
                      if (clean.includes("sem vi") || clean.includes("sem 6") || clean.includes("semester 6") || clean.includes("semester vi")) return "Semester 6";
                      if (clean.includes("sem vii") || clean.includes("sem 7") || clean.includes("semester 7") || clean.includes("semester vii")) return "Semester 7";
                      if (clean.includes("sem viii") || clean.includes("sem 8") || clean.includes("semester 8") || clean.includes("semester viii")) return "Semester 8";
                      return sem;
                    };

                    let activeParams: any = null;
                    if (activeCollege && activeCollege.shift_configs) {
                      try {
                        const parsed = JSON.parse(activeCollege.shift_configs);
                        const semKey = getCleanSemesterKey(activeSemesterLabel);
                        if (semKey && parsed.semesters?.[semKey]?.[activeShiftLabel]) {
                          activeParams = parsed.semesters[semKey][activeShiftLabel]?.custom_shift_params || null;
                        }
                        if (!activeParams && parsed.custom_shift_params?.[activeShiftLabel]) {
                          activeParams = parsed.custom_shift_params[activeShiftLabel];
                        }
                      } catch (_) {}
                    }

                    let scheduleItems: any[] = [];
                    if (activeParams) {
                      const res = calculateShiftSchedule(activeParams);
                      if (res && !res.error && res.items.length > 0) {
                        scheduleItems = res.items;
                      }
                    }

                    const dynamicRows: (
                      | { type: "slot"; time: string }
                      | { type: "break" | "lunch"; label: string; timeRange: string }
                    )[] = [];

                    if (scheduleItems.length > 0) {
                      scheduleItems.forEach(item => {
                        if (item.type === "period") {
                          dynamicRows.push({
                            type: "slot",
                            time: `${item.startTimeStr} - ${item.endTimeStr}`
                          });
                        } else {
                          dynamicRows.push({
                            type: "break",
                            label: item.name,
                            timeRange: `${item.startTimeStr} - ${item.endTimeStr}`
                          });
                        }
                      });
                    } else {
                      previewTimeSlots.forEach(time => {
                        dynamicRows.push({ type: "slot", time });
                      });
                    }

                    return (
                      <div className="space-y-6">
                        {/* Sub-tab Navigation Header */}
                        <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                          <button
                            type="button"
                            onClick={() => setTimetableSubTab("view")}
                            className={`px-4 py-2 text-xs font-bold transition-all border-b-2 cursor-pointer ${
                              timetableSubTab === "view"
                                ? "border-indigo-650 text-indigo-600 font-extrabold border-indigo-600"
                                : "border-transparent text-slate-500 hover:text-slate-700"
                            }`}
                          >
                            Weekly Class Grid Viewer
                          </button>
                          <button
                            type="button"
                            onClick={() => setTimetableSubTab("generate")}
                            className={`px-4 py-2 text-xs font-bold transition-all border-b-2 cursor-pointer ${
                              timetableSubTab === "generate"
                                ? "border-indigo-650 text-indigo-600 font-extrabold border-indigo-600"
                                : "border-transparent text-slate-500 hover:text-slate-700"
                            }`}
                          >
                            Timetable Generator Engine
                          </button>
                        </div>

                        {timetableSubTab === "view" ? (
                          <div className="space-y-6 animate-fadeIn">
                            {/* ═══════════════════════════════════════════════════════════════
                                SECTION 2 — READ-ONLY CLASS TIMETABLE VIEWER
                            ═══════════════════════════════════════════════════════════════ */}
                            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-6">
                            <div className="flex items-center justify-between border-b border-slate-100 pb-4 flex-wrap gap-4">
                              <div className="flex items-center gap-2">
                                <Calendar className="h-5 w-5 text-indigo-500" />
                                <div>
                                  <h3 className="text-sm font-bold text-slate-900">Class Timetable View</h3>
                                  <p className="text-xs text-slate-400 font-semibold mt-0.5">
                                    Select a class group and shift to inspect the current active timetable.
                                  </p>
                                </div>
                              </div>

                              {/* Timetable Filters */}
                              <div className="flex flex-wrap items-center gap-3">
                                {/* Course Dropdown */}
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Course:</span>
                                  <select
                                    value={selectedCohortCourse}
                                    onChange={e => handleCohortCourseChange(e.target.value)}
                                    className="px-3 py-1.5 border border-slate-200 rounded-xl bg-white text-xs font-bold text-slate-700 outline-none cursor-pointer shadow-sm focus:ring-1 focus:ring-indigo-500"
                                  >
                                    {cohortCourses.length === 0 && <option value="">No courses</option>}
                                    {cohortCourses.map(c => (
                                      <option key={c} value={c}>{c}</option>
                                    ))}
                                  </select>
                                </div>

                                {/* Semester Dropdown */}
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Semester:</span>
                                  <select
                                    value={selectedCohortSem}
                                    onChange={e => handleCohortSemChange(e.target.value)}
                                    className="px-3 py-1.5 border border-slate-200 rounded-xl bg-white text-xs font-bold text-slate-700 outline-none cursor-pointer shadow-sm focus:ring-1 focus:ring-indigo-500"
                                  >
                                    {cohortSemesters.length === 0 && <option value="">No semesters</option>}
                                    {cohortSemesters.map(s => (
                                      <option key={s} value={s}>{s}</option>
                                    ))}
                                  </select>
                                </div>

                                {hasShifts && (
                                  <div className="flex items-center gap-1.5 bg-slate-50 p-1 rounded-xl border border-slate-200 shadow-sm">
                                    {(["shift_1", "shift_2", "general"] as const).map(sh => (
                                      <button
                                        key={sh}
                                        type="button"
                                        onClick={() => setViewerShift(sh)}
                                        className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                                          viewerShift === sh
                                            ? "bg-indigo-600 text-white shadow-sm"
                                            : "text-slate-500 hover:text-slate-700"
                                        }`}
                                      >
                                        {sh === "shift_1" ? "Shift 1" : sh === "shift_2" ? "Shift 2" : "General"}
                                      </button>
                                    ))}
                                  </div>
                                )}

                                {viewerClassGroup && (
                                  <div className="flex gap-2">
                                    <button
                                      type="button"
                                      onClick={handleDownloadGridTemplate}
                                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-emerald-150 bg-emerald-50/50 text-emerald-700 text-xs font-bold hover:bg-emerald-50 hover:text-emerald-850 hover:border-emerald-200 transition-all cursor-pointer shadow-sm active:scale-95 duration-150"
                                      title="Download Excel Template for editing"
                                    >
                                      <Download className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                                      <span>Download Template</span>
                                    </button>

                                    <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-blue-150 bg-blue-50/50 text-blue-700 text-xs font-bold hover:bg-blue-50 hover:text-blue-850 hover:border-blue-200 transition-all cursor-pointer shadow-sm active:scale-95 duration-150 select-none">
                                      <Upload className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                                      <span>Upload Timetable</span>
                                      <input
                                        type="file"
                                        accept=".xlsx, .xls"
                                        onChange={handleUploadGrid}
                                        className="hidden"
                                      />
                                    </label>

                                    <button
                                      type="button"
                                      onClick={handleRegenerateClick}
                                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-indigo-150 bg-indigo-50/50 text-indigo-700 text-xs font-bold hover:bg-indigo-50 hover:text-indigo-850 hover:border-indigo-200 transition-all cursor-pointer shadow-sm active:scale-95 duration-150"
                                    >
                                      <Sparkles className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
                                      <span>Regenerate</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={handleClearTimetableClick}
                                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-rose-150 bg-rose-50/50 text-rose-700 text-xs font-bold hover:bg-rose-50 hover:text-rose-850 hover:border-rose-200 transition-all cursor-pointer shadow-sm active:scale-95 duration-150"
                                    >
                                      <Trash2 className="h-3.5 w-3.5 text-rose-600 shrink-0" />
                                      <span>Clear Timetable</span>
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Hour Allocation Tracker */}
                            {(() => {
                              const activeSem = timetableSubTab === "view" ? selectedCohortSem : genSelectedSemester;
                              const deptSubs = subjectsList.filter(
                                s => s.college_id === activeCollegeId && 
                                     getCleanSemesterKey(s.semester) === getCleanSemesterKey(activeSem)
                              );
                              const classGroup = timetableSubTab === "view" ? viewerClassGroup : genClassGroup;
                              const activeShift = hasShifts ? (timetableSubTab === "view" ? viewerShift : genShift) : "general";

                              if (!classGroup || deptSubs.length === 0) return null;

                              const trackerData = deptSubs.map(sub => {
                                const scheduledCount = collegeSlots.filter(
                                  slot => slot.classGroup === classGroup && 
                                          slot.shift === activeShift && 
                                          slot.course.toLowerCase().trim() === sub.name.toLowerCase().trim()
                                ).length;
                                const target = sub.weekly_hours || 4;
                                return {
                                  name: sub.name,
                                  target,
                                  scheduled: scheduledCount,
                                  type: sub.type || "Theory"
                                };
                              });

                              return (
                                <div className="bg-slate-50 border border-slate-200 rounded-3xl p-5 space-y-4 animate-fadeIn">
                                  <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                                    <h4 className="text-xs font-black text-indigo-700 uppercase tracking-wider flex items-center gap-2">
                                      <ClipboardList className="h-4 w-4 text-indigo-500" />
                                      Weekly Hour Allocation Tracker
                                    </h4>
                                    <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider bg-slate-200 px-2 py-0.5 rounded-md">
                                      Real-Time Validation
                                    </span>
                                  </div>
                                  
                                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                    {trackerData.map(sub => {
                                      const isMatched = sub.scheduled === sub.target;
                                      const isOver = sub.scheduled > sub.target;
                                      const remaining = sub.target - sub.scheduled;

                                      return (
                                        <div key={sub.name} className={`p-3.5 rounded-2xl border flex flex-col justify-between bg-white shadow-xs transition-all ${
                                          isMatched 
                                            ? "border-emerald-200 bg-emerald-50/10" 
                                            : isOver 
                                            ? "border-rose-200 bg-rose-50/15" 
                                            : "border-slate-200"
                                        }`}>
                                          <div className="space-y-1">
                                            <span className="font-extrabold text-xs text-slate-800 line-clamp-1" title={sub.name}>{sub.name}</span>
                                            <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider block">{sub.type}</span>
                                          </div>
                                          <div className="flex items-center justify-between mt-4">
                                            <div className="flex items-end gap-1">
                                              <span className="text-sm font-black text-slate-900">{sub.scheduled}</span>
                                              <span className="text-[10px] text-slate-450 font-bold mb-0.5">/ {sub.target} hrs</span>
                                            </div>
                                            
                                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                                              isMatched 
                                                ? "bg-emerald-100 text-emerald-800" 
                                                : isOver 
                                                ? "bg-rose-100 text-rose-800" 
                                                : "bg-amber-100 text-amber-800"
                                            }`}>
                                              {isMatched 
                                                ? "Matched" 
                                                : isOver 
                                                ? `Over by ${sub.scheduled - sub.target}h` 
                                                : `${remaining}h left`
                                              }
                                            </span>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            })()}

                            {/* Schedule Grid */}
                            {!viewerClassGroup ? (
                              <div className="p-8 text-center text-xs text-slate-400 font-semibold border border-dashed border-slate-200 rounded-2xl">
                                No class group selected or scheduled. Select a class group above to view its timetable.
                              </div>
                            ) : (
                              <div className="overflow-auto max-h-[70vh] rounded-2xl border border-slate-200 shadow-sm relative no-scrollbar">
                                <table className="w-full border-collapse text-left min-w-[800px] table-fixed">
                                  <thead>
                                    <tr className="text-[9.5px] font-bold uppercase">
                                      <th className="sticky top-0 left-0 z-30 p-3 text-slate-500 bg-slate-100/95 backdrop-blur-xs border-r border-b border-slate-200 w-[15%]">Time Slot</th>
                                      {DAYS.map(day => (
                                        <th key={day} className="sticky top-0 z-20 p-3 text-slate-700 bg-slate-50/95 backdrop-blur-xs border-b border-slate-200">{day}</th>
                                      ))}
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100 bg-white">
                                    {dynamicRows.map((row, rIdx) => {
                                      if (row.type === "break" || row.type === "lunch") {
                                        return (
                                          <tr key={`break-${rIdx}`} className="bg-slate-50/40">
                                            <td className="sticky left-0 z-10 p-3 text-[10px] font-bold text-slate-500 border-r border-slate-100 bg-slate-100/95 backdrop-blur-xs whitespace-nowrap">
                                              <div className="flex items-center gap-1.5 font-bold text-slate-500">
                                                <Clock className="h-3 w-3 text-slate-400" />
                                                {row.timeRange}
                                              </div>
                                            </td>
                                            <td colSpan={5} className="p-3 text-center text-[10px] font-black tracking-widest text-slate-450 uppercase italic bg-slate-55/40">
                                               {row.label}
                                            </td>
                                          </tr>
                                        );
                                      }
                                      
                                      if (row.type === "slot") {
                                        const time = row.time;
                                        return (
                                          <tr key={time} className="hover:bg-slate-55/30 transition-colors">
                                            <td className="sticky left-0 z-10 p-3 text-[10px] font-semibold text-slate-600 border-r border-slate-100 bg-slate-50/95 backdrop-blur-xs whitespace-nowrap">
                                              <div className="flex items-center gap-1.5">
                                                <Clock className="h-3 w-3 text-slate-400" />
                                                {time}
                                              </div>
                                            </td>
                                            {DAYS.map(day => {
                                              const slot = collegeSlots.find(
                                                s =>
                                                  s.day === day &&
                                                  s.time === time &&
                                                  s.classGroup === viewerClassGroup &&
                                                  s.shift === (hasShifts ? viewerShift : "general")
                                              );
                                              const mentor = slot ? collegeMentors.find(m => m.id === slot.mentorId) : null;
                                              return (
                                                <td key={day} className="p-2 border-r border-slate-100 last:border-r-0 h-20">
                                                  {slot ? (
                                                    <div className="h-full flex flex-col justify-between p-2 rounded-xl border border-indigo-100 bg-indigo-50/20 text-xs shadow-sm">
                                                      <div className="text-[9px] font-extrabold text-indigo-650 uppercase tracking-wider truncate">
                                                        {mentor ? mentor.name : "Unassigned"}
                                                      </div>
                                                      <div className="font-bold text-slate-800 truncate text-[10px]">{slot.course}</div>
                                                      <div className="text-[9px] text-slate-500 font-semibold truncate">{slot.location}</div>
                                                    </div>
                                                  ) : (
                                                    <div className="h-full flex items-center justify-center border border-dashed border-slate-200 rounded-xl bg-slate-50/20">
                                                      <span className="text-[9px] text-slate-350 font-medium">Free</span>
                                                    </div>
                                                  )}
                                                </td>
                                              );
                                            })}
                                          </tr>
                                        );
                                      }
                                      return null;
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            )}
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-6">
                            {/* TIMETABLE AUTO GENERATOR ENGINE STEPS */}
                            {genStep === 1 && (
                              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-6 animate-fadeIn">
                                <div className="flex items-center gap-2.5 border-b border-slate-100 pb-4">
                                  <Sparkles className="h-5 w-5 text-indigo-500 animate-pulse" />
                                  <div>
                                    <h3 className="text-sm font-bold text-slate-900">Step 1: Define Target & Bounds</h3>
                                    <p className="text-xs text-slate-400 font-semibold mt-0.5">Specify the course, semester, shift and room criteria for generating a new timetable.</p>
                                  </div>
                                </div>

                                {genError && (
                                  <div className="p-3.5 bg-red-50/50 border border-red-100 text-red-700 text-xs rounded-2xl flex items-center gap-2">
                                    <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
                                    <span className="font-semibold">{genError}</span>
                                  </div>
                                )}

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Course / Department</label>
                                    <select
                                      value={genSelectedCourse}
                                      onChange={e => handleGenCourseChange(e.target.value)}
                                      className="w-full p-2.5 border border-slate-200 rounded-xl bg-white text-xs font-semibold focus:ring-1 focus:ring-indigo-500 outline-none shadow-sm cursor-pointer"
                                    >
                                      <option value="">Select Course</option>
                                      {collegeCourses.map(c => (
                                        <option key={c.id} value={c.name}>{c.name}</option>
                                      ))}
                                    </select>
                                  </div>

                                  <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Semester</label>
                                    <select
                                      value={genSelectedSemester}
                                      onChange={e => handleGenSemesterChange(e.target.value)}
                                      className="w-full p-2.5 border border-slate-200 rounded-xl bg-white text-xs font-semibold focus:ring-1 focus:ring-indigo-500 outline-none shadow-sm cursor-pointer"
                                    >
                                      {["Semester 1","Semester 2","Semester 3","Semester 4","Semester 5","Semester 6","Semester 7","Semester 8"].map(s => (
                                        <option key={s} value={s}>{s}</option>
                                      ))}
                                    </select>
                                  </div>

                                  {(() => {
                                    const courseObj = collegeCourses.find(c => c.name === genSelectedCourse);
                                    const hasDefaults = !!(courseObj && (courseObj.default_shift || courseObj.default_room));
                                    
                                    if (hasDefaults && !showCustomTarget) {
                                      return (
                                        <div className="md:col-span-2 p-4 rounded-2xl border border-indigo-50 bg-indigo-50/20 dark:bg-indigo-950/10 dark:border-indigo-900/30 flex flex-col md:flex-row md:items-center justify-between gap-4 animate-fadeIn">
                                          <div className="flex items-center gap-3">
                                            <div className="p-2 bg-indigo-500/10 rounded-xl">
                                              <Sparkles className="h-4.5 w-4.5 text-indigo-500" />
                                            </div>
                                            <div>
                                              <p className="text-[11px] font-bold text-slate-800 dark:text-slate-200">Default Target Shift & Room Applied</p>
                                              <p className="text-[10px] text-slate-450 font-semibold mt-0.5">
                                                Shift: <span className="text-indigo-600 dark:text-indigo-400 font-black">{genShift === "shift_1" ? "Shift 1" : genShift === "shift_2" ? "Shift 2" : "General Shift"}</span> · 
                                                Room: <span className="text-indigo-650 dark:text-indigo-400 font-black">{genRoom || "None"}</span>
                                              </p>
                                            </div>
                                          </div>
                                          <button
                                            type="button"
                                            onClick={() => setShowCustomTarget(true)}
                                            className="px-3 py-1.5 rounded-xl border border-indigo-200 hover:border-indigo-300 dark:border-indigo-900 dark:hover:border-indigo-800 text-[10.5px] font-bold text-indigo-650 dark:text-indigo-455 bg-white hover:bg-slate-50 transition-all cursor-pointer self-start md:self-auto"
                                          >
                                            ✏️ Customize Shift / Room
                                          </button>
                                        </div>
                                      );
                                    }

                                    return (
                                      <>
                                        <div className="space-y-1">
                                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Target Shift</label>
                                          <div className="grid grid-cols-3 gap-2">
                                            {(["shift_1", "shift_2", "general"] as const).map(sh => (
                                              <button
                                                key={sh}
                                                type="button"
                                                onClick={() => handleGenShiftChange(sh)}
                                                className={`p-2 rounded-xl text-xs font-bold border transition-all text-center cursor-pointer ${
                                                  genShift === sh
                                                    ? "bg-indigo-600 text-white border-indigo-650 shadow-sm"
                                                    : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"
                                                }`}
                                              >
                                                {sh === "shift_1" ? "Shift 1" : sh === "shift_2" ? "Shift 2" : "General"}
                                              </button>
                                            ))}
                                          </div>
                                        </div>

                                        <div className="space-y-1">
                                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Default Classroom / Room</label>
                                          {(() => {
                                            const campus = colleges.find(c => c.id === activeCollegeId);
                                            const campusRooms = campus && campus.rooms ? parseRoomsList(campus.rooms) : [];
                                            const courseObj = collegeCourses.find(c => c.name === genSelectedCourse);
                                            const designatedRoom = courseObj ? resolveCourseRoom(courseObj, genSelectedSemester, genShift) : "";

                                            return (
                                              <select
                                                value={genRoom}
                                                onChange={e => setGenRoom(e.target.value)}
                                                className="w-full p-2.5 border border-slate-200 rounded-xl bg-white text-xs font-semibold focus:ring-1 focus:ring-indigo-500 outline-none shadow-sm cursor-pointer text-slate-800"
                                              >
                                                {!genRoom && <option value="">Select Room</option>}
                                                {designatedRoom && (
                                                  <option value={designatedRoom}>
                                                    {designatedRoom} (Assigned Course Room)
                                                  </option>
                                                )}
                                                {campusRooms.filter(r => r !== designatedRoom).map(r => (
                                                  <option key={r} value={r}>{r}</option>
                                                ))}
                                              </select>
                                            );
                                          })()}
                                        </div>
                                      </>
                                    );
                                  })()}

                                  <div className="md:col-span-2 space-y-1">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Class Group (Cohort Name)</label>
                                    <input
                                      type="text"
                                      placeholder="e.g. B.Sc. CS - SEM I (2026-2027)"
                                      value={genClassGroup}
                                      onChange={e => setGenClassGroup(e.target.value)}
                                      className="w-full p-2.5 border border-slate-200 rounded-xl bg-white text-xs font-semibold focus:ring-1 focus:ring-indigo-500 outline-none shadow-sm"
                                    />
                                    <p className="text-[10.5px] text-slate-400 font-medium">This name is used to identify the student group. You can edit this field to match your department standards.</p>
                                  </div>
                                </div>

                                <div className="flex justify-between items-center pt-4 border-t border-slate-100 flex-wrap gap-3">
                                  <div className="flex gap-2">
                                    <button
                                      type="button"
                                      onClick={handleDownloadGridTemplate}
                                      disabled={!genSelectedCourse || !genClassGroup}
                                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all shadow-sm cursor-pointer select-none active:scale-95 duration-150 ${
                                        !genSelectedCourse || !genClassGroup
                                          ? "bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed"
                                          : "border-emerald-150 bg-emerald-50/50 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-850 hover:border-emerald-200"
                                      }`}
                                      title="Download Excel Template for this class"
                                    >
                                      <Download className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                                      <span>Download Template</span>
                                    </button>

                                    <label className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all shadow-sm cursor-pointer select-none active:scale-95 duration-150 ${
                                      !genSelectedCourse || !genClassGroup
                                        ? "bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed"
                                        : "border-blue-150 bg-blue-50/50 text-blue-700 hover:bg-blue-50 hover:text-blue-850 hover:border-blue-200"
                                    }`}>
                                      <Upload className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                                      <span>Upload Timetable</span>
                                      {genSelectedCourse && genClassGroup && (
                                        <input
                                          type="file"
                                          accept=".xlsx, .xls"
                                          onChange={handleUploadGrid}
                                          className="hidden"
                                        />
                                      )}
                                    </label>
                                  </div>

                                  <Button
                                    variant="primary"
                                    size="md"
                                    icon={<ArrowRight className="h-4 w-4" />}
                                    onClick={handleTransitionToStep2}
                                  >
                                    Next: Setup Workloads
                                  </Button>
                                </div>
                              </div>
                            )}

                            {genStep === 2 && (
                              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-6 animate-fadeIn">
                                <div className="flex items-center gap-2.5 border-b border-slate-100 pb-4">
                                  <SlidersHorizontal className="h-5 w-5 text-indigo-500" />
                                  <div>
                                    <h3 className="text-sm font-bold text-slate-900">Step 2: Setup Workloads & Instructors</h3>
                                    <p className="text-xs text-slate-400 font-semibold mt-0.5">Map subjects to faculty mentors, define target hours per week and assign classrooms.</p>
                                  </div>
                                </div>

                                {genError && (
                                  <div className="p-3.5 bg-red-50/50 border border-red-100 text-red-700 text-xs rounded-2xl flex items-center gap-2">
                                    <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
                                    <span className="font-semibold">{genError}</span>
                                  </div>
                                )}

                                {genAllocations.length === 0 ? (
                                  <div className="py-12 text-center border border-dashed border-slate-200 rounded-2xl bg-slate-50/20">
                                    <GraduationCap className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                                    <p className="text-xs text-slate-400 font-bold">No subjects mapped in curriculum for {genSelectedCourse} · {genSelectedSemester}</p>
                                    <p className="text-[10px] text-slate-350 mt-1 mb-4">Please add subjects under the **Curriculum Map** tab first or use quick add below.</p>
                                  </div>
                                ) : (
                                  <div className="overflow-x-auto border border-slate-200 rounded-2xl shadow-sm">
                                    <table className="w-full border-collapse text-left text-xs font-semibold table-fixed">
                                      <thead>
                                        <tr className="bg-slate-50 border-b border-slate-200 text-[10px] text-slate-400 font-bold uppercase">
                                          <th className="p-3 w-[10%] text-center">Include</th>
                                          <th className="p-3 w-[35%]">Subject Name</th>
                                          <th className="p-3 w-[15%]">Weekly Hours</th>
                                          <th className="p-3 w-[20%]">Room</th>
                                          <th className="p-3 w-[20%]">Assigned Faculty</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-slate-100 bg-white">
                                        {genAllocations.map((a, index) => {
                                          const updateAlloc = (field: string, val: any) => {
                                            const copy = [...genAllocations];
                                            copy[index] = { ...copy[index], [field]: val };
                                            setGenAllocations(copy);
                                          };

                                          // Tier 1: mentors whose subjects field matches this exact subject name
                                          const subjectMentors = collegeMentors.filter(m => {
                                            const subs = m.subjects ? m.subjects.split(/\n|\/|,|;/).map((sub) => sub.trim()) : [];
                                            return subs.some((subName) => isSubjectNameMatch(a.subjectName, subName));
                                          });
                                          
                                          // Tier 2: mentors who match the subject group (General, English, Technical, Aptitude, etc.)
                                          const subjectGroupNorm = (a.subjectGroup || "").toLowerCase().trim();
                                          const groupMentors = subjectGroupNorm
                                            ? collegeMentors.filter(m =>
                                                (m.subject_group || "").toLowerCase().trim() === subjectGroupNorm
                                              )
                                            : [];

                                          // Tier 3: mentors who belong to the selected course/program (using keyword-aware isMentorInProgram)
                                          const programMentors = genSelectedCourse
                                            ? collegeMentors.filter(m =>
                                                isMentorInProgram(m, genSelectedCourse, collegeSlots, subjectsList)
                                              )
                                            : [];

                                          // Pick the most specific list: subject-level → subject_group-level → program-level → all college mentors
                                          const mentorsToDisplay =
                                            subjectMentors.length > 0
                                              ? subjectMentors
                                              : groupMentors.length > 0
                                                ? groupMentors
                                                : programMentors.length > 0
                                                  ? programMentors
                                                  : collegeMentors;

                                          // Count existing scheduled hours per mentor in current semester
                                          const getMentorHrs = (mentorId: string): number =>
                                            collegeSlots.filter(s => s.mentorId === mentorId).length;

                                          const assignedMentor = a.mentorId ? collegeMentors.find(m => m.id === a.mentorId) : null;
                                          const assignedHrs = a.mentorId ? getMentorHrs(a.mentorId) : null;

                                          return (
                                            <tr key={a.subjectId} className="hover:bg-slate-50/20">
                                              <td className="p-3 text-center">
                                                <input
                                                  type="checkbox"
                                                  checked={a.isSelected}
                                                  onChange={e => updateAlloc("isSelected", e.target.checked)}
                                                  className="h-4.5 w-4.5 border-slate-200 text-indigo-650 rounded-lg cursor-pointer"
                                                />
                                              </td>
                                              <td className="p-3">
                                                <div className="font-bold text-slate-800 truncate" title={a.subjectName}>{a.subjectName}</div>
                                                {a.isNew && (
                                                  <span className="text-[8px] bg-indigo-50 border border-indigo-100 text-indigo-700 px-1 py-0.2 rounded-md font-bold uppercase mt-0.5 inline-block">Quick Added</span>
                                                )}
                                              </td>
                                              <td className="p-3">
                                                <input
                                                  type="number"
                                                  min={1}
                                                  max={12}
                                                  value={a.weeklyHours}
                                                  onChange={e => updateAlloc("weeklyHours", parseInt(e.target.value) || 4)}
                                                  className="w-16 p-1.5 border border-slate-200 rounded-lg text-center font-bold text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                                />
                                              </td>
                                              <td className="p-3">
                                                <input
                                                  type="text"
                                                  value={a.room}
                                                  onChange={e => updateAlloc("room", e.target.value)}
                                                  className="w-full p-1.5 border border-slate-200 rounded-lg font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                                />
                                              </td>
                                              <td className="p-3 space-y-1">
                                                <select
                                                  value={a.mentorId}
                                                  onChange={e => updateAlloc("mentorId", e.target.value)}
                                                  className="w-full p-1.5 border border-slate-200 rounded-lg bg-white font-bold text-slate-700 cursor-pointer focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                                >
                                                  <option value="">Select Mentor</option>
                                                  {mentorsToDisplay.map(m => {
                                                    const hrs = getMentorHrs(m.id);
                                                    const loadLabel = hrs > 0 ? ` (${hrs} hrs/wk)` : " (free)";
                                                    const groupLabel = m.subject_group ? ` (${m.subject_group})` : " (General)";
                                                    return (
                                                      <option key={m.id} value={m.id}>{m.name}{groupLabel}{loadLabel}</option>
                                                    );
                                                  })}
                                                </select>
                                                {assignedMentor && assignedHrs !== null && assignedHrs > 0 && (
                                                  <div className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-bold ${
                                                    assignedHrs >= 20
                                                      ? "bg-red-50 border border-red-100 text-red-700"
                                                      : assignedHrs >= 12
                                                      ? "bg-amber-50 border border-amber-100 text-amber-700"
                                                      : "bg-emerald-50 border border-emerald-100 text-emerald-700"
                                                  }`}>
                                                    <span>{assignedHrs} hrs already scheduled</span>
                                                  </div>
                                                )}
                                              </td>
                                            </tr>
                                          );
                                        })}
                                      </tbody>
                                    </table>
                                  </div>
                                )}

                                {/* Quick Add Subject Module */}
                                <div className="space-y-4 pt-2">
                                  {!showQuickAddForm ? (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setShowQuickAddForm(true);
                                        setQuickSubRoom(genRoom.trim());
                                        setQuickSubMentorId(collegeMentors[0]?.id || "");
                                      }}
                                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-indigo-150 bg-indigo-50/50 text-indigo-700 text-xs font-bold hover:bg-indigo-50 transition-colors cursor-pointer"
                                    >
                                      <Plus className="h-4 w-4" />
                                      + Quick Add Subject
                                    </button>
                                  ) : (
                                    <div className="bg-slate-50/60 p-4 border border-slate-150 rounded-2xl space-y-4 animate-fadeIn">
                                      <div className="text-xs font-bold text-slate-800 uppercase tracking-wider">Quick Add Subject</div>
                                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                                        <div className="space-y-1">
                                          <label className="text-[10px] text-slate-400 font-bold block">Subject Name</label>
                                          <input
                                            type="text"
                                            value={quickSubName}
                                            onChange={e => setQuickSubName(e.target.value)}
                                            placeholder="e.g. CS501: Data Science"
                                            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 font-bold text-xs"
                                          />
                                        </div>
                                        <div className="space-y-1">
                                          <label className="text-[10px] text-slate-400 font-bold block">Subject Type</label>
                                          <select
                                            value={quickSubType}
                                            onChange={e => setQuickSubType(e.target.value)}
                                            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 font-bold text-xs cursor-pointer"
                                          >
                                            <option value="SKILL">SKILL (Practical Training)</option>
                                            <option value="ACADEMIC">ACADEMIC (Core Theory)</option>
                                            <option value="LAB">LAB (Practical Laboratory)</option>
                                            <option value="GENERAL">GENERAL (Elective / Foundational)</option>
                                          </select>
                                        </div>
                                        <div className="space-y-1">
                                          <label className="text-[10px] text-slate-400 font-bold block">Assigned Faculty</label>
                                          <select
                                            value={quickSubMentorId}
                                            onChange={e => setQuickSubMentorId(e.target.value)}
                                            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 font-bold text-xs cursor-pointer"
                                          >
                                            <option value="">Select Faculty</option>
                                            {collegeMentors.map(m => {
                                              const groupLabel = m.subject_group ? ` (${m.subject_group})` : " (General)";
                                              return (
                                                <option key={m.id} value={m.id}>{m.name}{groupLabel}</option>
                                              );
                                            })}
                                          </select>
                                        </div>
                                        <div className="space-y-1">
                                          <label className="text-[10px] text-slate-400 font-bold block">Weekly Hours</label>
                                          <input
                                            type="number"
                                            min="1"
                                            max="12"
                                            value={quickSubHours}
                                            onChange={e => setQuickSubHours(parseInt(e.target.value) || 4)}
                                            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 font-bold text-xs text-center"
                                          />
                                        </div>
                                        <div className="space-y-1">
                                          <label className="text-[10px] text-slate-400 font-bold block">Room</label>
                                          <input
                                            type="text"
                                            value={quickSubRoom}
                                            onChange={e => setQuickSubRoom(e.target.value)}
                                            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 font-bold text-xs"
                                          />
                                        </div>
                                        <div className="flex items-end gap-2">
                                          <button
                                            type="button"
                                            onClick={handleQuickAddSubject}
                                            className="flex-1 bg-indigo-600 hover:bg-indigo-750 text-white text-xs font-bold py-2 rounded-xl border border-indigo-650 transition-colors cursor-pointer"
                                          >
                                            Add Subject
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => setShowQuickAddForm(false)}
                                            className="bg-slate-100 hover:bg-slate-200 text-slate-650 text-xs font-bold py-2 px-3 rounded-xl border border-slate-200 transition-colors cursor-pointer"
                                          >
                                            Cancel
                                          </button>
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </div>

                                <div className="flex justify-between items-center pt-4 border-t border-slate-100">
                                  <Button
                                    type="button"
                                    variant="secondary"
                                    size="md"
                                    onClick={() => setGenStep(1)}
                                  >
                                    Back to Step 1
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="primary"
                                    size="md"
                                    icon={genLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                                    onClick={handleGeneratePreview}
                                    disabled={genLoading || genAllocations.length === 0}
                                  >
                                    {genLoading ? "Generating Timetable..." : "Generate Preview"}
                                  </Button>
                                </div>
                              </div>
                            )}

                            {genStep === 3 && (
                              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-6 animate-fadeIn">
                                <div className="flex items-center justify-between border-b border-slate-100 pb-4 flex-wrap gap-4">
                                  <div className="flex items-center gap-2.5">
                                    <Calendar className="h-5 w-5 text-indigo-500" />
                                    <div>
                                      <h3 className="text-sm font-bold text-slate-900">Step 3: Conflict Check & Preview</h3>
                                      <p className="text-xs text-slate-400 font-semibold mt-0.5">Review the generated clash-free slots. Inspect conflicts or unscheduled workloads before publishing.</p>
                                    </div>
                                  </div>
                                  <span className="px-3 py-1 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 text-[10px] font-black uppercase">
                                    Placed {genPreviewSlots.length} Slots
                                  </span>
                                </div>

                                {genError && (
                                  <div className="p-3.5 bg-red-50/50 border border-red-100 text-red-700 text-xs rounded-2xl flex items-center gap-2">
                                    <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
                                    <span className="font-semibold">{genError}</span>
                                  </div>
                                )}

                                {genSuccess && (
                                  <div className="p-3.5 bg-emerald-50/50 border border-emerald-100 text-emerald-700 text-xs rounded-2xl flex items-center gap-2">
                                    <CheckCircle className="h-4 w-4 shrink-0 text-emerald-500" />
                                    <span className="font-semibold">{genSuccess}</span>
                                  </div>
                                )}

                                {/* Unscheduled Workload Alert */}
                                {genUnscheduled.length > 0 && (
                                  <div className="p-4 bg-amber-50/55 border border-amber-200/60 rounded-2xl space-y-2">
                                    <div className="flex items-center gap-2 text-amber-800 text-xs font-black uppercase tracking-wider">
                                      <AlertTriangle className="h-4 w-4 text-amber-500 animate-bounce" />
                                      Unscheduled Workload Detected!
                                    </div>
                                    <p className="text-[11px] text-amber-700 font-semibold leading-normal">
                                      The following subjects could not be fully placed due to scheduling conflicts (mentor busy or room occupied):
                                    </p>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                                      {genUnscheduled.map((item, idx) => (
                                        <div key={idx} className="p-2 bg-white border border-amber-200 rounded-xl flex justify-between items-center text-[10px] font-bold text-slate-700 shadow-xs">
                                          <span className="truncate pr-2">{item.subject}</span>
                                          <span className="shrink-0 px-2 py-0.5 bg-amber-100 text-amber-800 rounded-lg text-[9px] font-black">
                                            {item.hours} hr{item.hours !== 1 ? 's' : ''} left
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* Preview Calendar Grid */}
                                <div className="overflow-auto max-h-[70vh] rounded-2xl border border-slate-200 shadow-sm relative no-scrollbar">
                                  <table className="w-full border-collapse text-left min-w-[800px] table-fixed">
                                    <thead>
                                      <tr className="text-[9.5px] font-bold uppercase">
                                        <th className="sticky top-0 left-0 z-30 p-3 text-slate-500 bg-slate-100/95 backdrop-blur-xs border-r border-b border-slate-200 w-[15%]">Time Slot</th>
                                        {DAYS.map(day => (
                                          <th key={day} className="sticky top-0 z-20 p-3 text-slate-700 bg-slate-50/95 backdrop-blur-xs border-b border-slate-200">{day}</th>
                                        ))}
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 bg-white">
                                      {dynamicRows.map((row, rIdx) => {
                                        if (row.type === "break" || row.type === "lunch") {
                                          return (
                                            <tr key={`break-${rIdx}`} className="bg-slate-50/40">
                                              <td className="sticky left-0 z-10 p-3 text-[10px] font-bold text-slate-500 border-r border-slate-100 bg-slate-100/95 backdrop-blur-xs whitespace-nowrap">
                                                <div className="flex items-center gap-1.5 font-bold text-slate-500">
                                                  <Clock className="h-3 w-3 text-slate-400" />
                                                  {row.timeRange}
                                                </div>
                                              </td>
                                              <td colSpan={5} className="p-3 text-center text-[10px] font-black tracking-widest text-slate-450 uppercase italic bg-slate-55/40">
                                                 {row.label}
                                              </td>
                                            </tr>
                                          );
                                        }
                                        
                                        if (row.type === "slot") {
                                          const time = row.time;
                                          return (
                                            <tr key={time} className="hover:bg-slate-55/30 transition-colors">
                                              <td className="sticky left-0 z-10 p-3 text-[10px] font-semibold text-slate-600 border-r border-slate-100 bg-slate-50/95 backdrop-blur-xs whitespace-nowrap">
                                                <div className="flex items-center gap-1.5">
                                                  <Clock className="h-3 w-3 text-slate-400" />
                                                  {time}
                                                </div>
                                              </td>
                                              {DAYS.map(day => {
                                                const slot = genPreviewSlots.find(
                                                  s => s.day === day && s.time === time
                                                );
                                                const mentor = slot ? collegeMentors.find(m => m.id === slot.mentorId) : null;
                                                return (
                                                  <td key={day} className="p-2 border-r border-slate-100 last:border-r-0 h-20">
                                                    {slot ? (
                                                      <div className="h-full flex flex-col justify-between p-2 rounded-xl border border-indigo-150 bg-indigo-50/30 text-xs shadow-xs">
                                                        <div className="text-[9px] font-extrabold text-indigo-700 uppercase tracking-wider truncate">
                                                          {mentor ? mentor.name : "Unassigned"}
                                                        </div>
                                                        <div className="font-bold text-slate-800 truncate text-[10px]">{slot.course}</div>
                                                        <div className="text-[9px] text-slate-500 font-semibold truncate">{slot.location}</div>
                                                      </div>
                                                    ) : (
                                                      <div className="h-full flex items-center justify-center border border-dashed border-slate-200 rounded-xl bg-slate-50/20">
                                                        <span className="text-[9px] text-slate-350 font-medium">Free</span>
                                                      </div>
                                                    )}
                                                  </td>
                                                );
                                              })}
                                            </tr>
                                          );
                                        }
                                        return null;
                                      })}
                                    </tbody>
                                  </table>
                                </div>

                                <div className="flex justify-between items-center pt-4 border-t border-slate-100">
                                  <Button
                                    type="button"
                                    variant="secondary"
                                    size="md"
                                    onClick={() => setGenStep(2)}
                                  >
                                    Back to Step 2
                                  </Button>
                                  <div className="flex items-center gap-3">
                                    <button
                                      type="button"
                                      onClick={() => handleGeneratePreview()}
                                      disabled={genLoading}
                                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-amber-200 bg-amber-50/60 text-amber-800 text-xs font-bold hover:bg-amber-50 hover:border-amber-300 transition-all cursor-pointer shadow-sm active:scale-95 duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                      <RefreshCw className={`h-3.5 w-3.5 text-amber-600 shrink-0 ${genLoading ? "animate-spin" : ""}`} />
                                      <span>Regenerate Preview</span>
                                    </button>
                                    <Button
                                      type="button"
                                      variant="primary"
                                      size="md"
                                      icon={genLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                                      onClick={handleSaveTimetable}
                                      disabled={genLoading}
                                    >
                                      {genLoading ? "Saving Timetable..." : "Confirm & Save Timetable"}
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* 6. ACADEMIC MONITORING */}
                  {activeTab === "monitoring" && (() => {
                    const analyzedStudents = collegeStudents.map(s => {
                      const stats = getStudentAttendanceStats(s.id);
                      return {
                        ...s,
                        attendancePct: stats.percentage,
                        attendedCount: stats.attended,
                        totalCount: stats.total
                      };
                    });

                    const totalCount = analyzedStudents.length;
                    const atRiskCount = analyzedStudents.filter(s => s.attendancePct < 75).length;
                    const criticalCount = analyzedStudents.filter(s => s.attendancePct < 60).length;

                    // Apply filters
                    const filtered = analyzedStudents.filter(s => {
                      const matchesSearch = s.name.toLowerCase().includes(studentSearch.toLowerCase()) || s.id.toLowerCase().includes(studentSearch.toLowerCase());
                      const matchesDept = studentDeptFilter === "all" || s.department === studentDeptFilter;
                      const matchesBatch = studentBatchFilter === "all" || s.classGroup === studentBatchFilter;
                      const matchesAttendance =
                        studentAttendanceFilter === "all" ? true :
                          studentAttendanceFilter === "at-risk" ? s.attendancePct < 75 :
                            studentAttendanceFilter === "critical" ? s.attendancePct < 60 : true;

                      return matchesSearch && matchesDept && matchesBatch && matchesAttendance;
                    });

                    return (
                      <div className="space-y-6">
                        <div className="bg-white p-6 rounded-3xl border border-slate-205 shadow-sm space-y-6">
                        <div className="border-b border-slate-100 pb-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                          <div>
                            <h2 className="text-base font-black text-slate-905">Student Attendance Directory</h2>
                            <p className="text-xs text-slate-400 font-semibold mt-0.5">Real-time attendance calculations and warning threshold filters.</p>
                          </div>

                          {/* Roster KPI Summary */}
                          <div className="flex gap-3 text-center font-bold">
                            <div className="bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-150 shadow-sm">
                              <span className="text-[8px] uppercase text-slate-400 block">Total</span>
                              <span className="text-xs font-bold text-slate-700">{totalCount}</span>
                            </div>
                            <div className="bg-amber-50/50 px-3 py-1.5 rounded-xl border border-amber-100 shadow-sm">
                              <span className="text-[8px] uppercase text-amber-600 block">At-Risk</span>
                              <span className="text-xs font-bold text-amber-700">{atRiskCount}</span>
                            </div>
                            <div className="bg-red-50/50 px-3 py-1.5 rounded-xl border border-red-100 shadow-sm">
                              <span className="text-[8px] uppercase text-red-505 block">Critical</span>
                              <span className="text-xs font-bold text-red-655">{criticalCount}</span>
                            </div>
                          </div>
                        </div>

                        {/* Advanced Filters Panel */}
                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-slate-50/50 p-4 rounded-2xl border border-slate-200">
                          <div className="space-y-1">
                            <label className="text-[9px] uppercase font-bold text-slate-400">Search Student</label>
                            <div className="relative">
                              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                              <input
                                type="text"
                                placeholder="Search name or ID..."
                                value={studentSearch}
                                onChange={e => setStudentSearch(e.target.value)}
                                className="w-full pl-8 pr-3 py-1.5 border border-slate-200 bg-white text-xs rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 font-semibold shadow-sm"
                              />
                            </div>
                          </div>

                          <div className="space-y-1">
                            <label className="text-[9px] uppercase font-bold text-slate-400">Filter Department</label>
                            <select
                              value={studentDeptFilter}
                              onChange={e => setStudentDeptFilter(e.target.value)}
                              className="w-full p-2 border border-slate-202 rounded-xl bg-white text-xs font-bold cursor-pointer outline-none shadow-sm"
                            >
                              <option value="all">All Departments</option>
                              {studentDepts.map(d => (
                                <option key={d} value={d}>{d}</option>
                              ))}
                            </select>
                          </div>

                          <div className="space-y-1">
                            <label className="text-[9px] uppercase font-bold text-slate-400">Filter Batch / Cohort</label>
                            <select
                              value={studentBatchFilter}
                              onChange={e => setStudentBatchFilter(e.target.value)}
                              className="w-full p-2 border border-slate-202 rounded-xl bg-white text-xs font-bold cursor-pointer outline-none shadow-sm"
                            >
                              <option value="all">All Batches</option>
                              {activeBatches.map(b => (
                                <option key={b} value={b}>{b}</option>
                              ))}
                            </select>
                          </div>

                          <div className="space-y-1">
                            <label className="text-[9px] uppercase font-bold text-slate-400">Attendance Warning</label>
                            <select
                              value={studentAttendanceFilter}
                              onChange={e => setStudentAttendanceFilter(e.target.value)}
                              className="w-full p-2 border border-slate-202 rounded-xl bg-white text-xs font-bold cursor-pointer outline-none shadow-sm"
                            >
                              <option value="all">All Attendance</option>
                              <option value="at-risk">At-Risk (&lt;75%)</option>
                              <option value="critical">Critical (&lt;60%)</option>
                            </select>
                          </div>
                        </div>

                        {/* Student Grid Table */}
                        <div className="overflow-x-auto rounded-2xl border border-slate-205 shadow-sm">
                          <table className="w-full border-collapse text-left text-xs font-semibold min-w-[640px]">
                            <thead>
                              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[9.5px]">
                                <th className="p-3 border-r border-slate-100">Student Name</th>
                                <th className="p-3 border-r border-slate-100">Register Number</th>
                                <th className="p-3 border-r border-slate-100">Class Group</th>
                                <th className="p-3 border-r border-slate-100">Department</th>
                                <th className="p-3 border-r border-slate-100 text-center">Attendance Status</th>
                                <th className="p-3 border-r border-slate-100 text-right">Compliance Rate</th>
                                <th className="p-3 text-center">Actions</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 bg-white text-slate-700">
                              {filtered.map(s => (
                                <tr key={s.id} className="hover:bg-slate-50/50 transition-colors">
                                  <td className="p-3 font-bold text-slate-805 border-r border-slate-100">{s.name}</td>
                                  <td className="p-3 font-mono font-bold text-slate-400 border-r border-slate-100">{s.id}</td>
                                  <td className="p-3 font-semibold text-slate-500 border-r border-slate-100">{s.classGroup}</td>
                                  <td className="p-3 border-r border-slate-100">{s.department || "General"}</td>
                                  <td className="p-3 text-center border-r border-slate-100">
                                    <span className={`px-2 py-0.5 rounded border text-[9.5px] font-bold uppercase ${s.attendancePct < 60 ? "bg-red-50 border-red-100 text-red-600" :
                                        s.attendancePct < 75 ? "bg-amber-50 border-amber-100 text-amber-700" :
                                          "bg-emerald-50 border-emerald-100 text-emerald-700"
                                      }`}>
                                      {s.attendancePct < 60 ? "Critical" :
                                        s.attendancePct < 75 ? "At Risk" : "Compliant"}
                                    </span>
                                  </td>
                                  <td className="p-3 text-right border-r border-slate-100">
                                    <div className="flex items-center justify-end gap-2">
                                      <span className={`font-bold text-[11px] ${s.attendancePct < 75 ? "text-red-500" : "text-slate-700"
                                        }`}>
                                        {s.attendancePct}%
                                      </span>
                                      <div className="w-16 bg-slate-100 rounded-full h-1.5 overflow-hidden border border-slate-101">
                                        <div
                                          className={`h-full ${s.attendancePct < 60 ? "bg-red-500" :
                                              s.attendancePct < 75 ? "bg-amber-500" : "bg-emerald-555"
                                            }`}
                                          style={{ width: `${s.attendancePct}%` }}
                                        />
                                      </div>
                                    </div>
                                  </td>
                                  <td className="p-3 text-center">
                                    <button
                                      type="button"
                                      onClick={() => openCorrectionModal(s)}
                                      className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold border border-indigo-200 rounded-xl text-[10px] uppercase tracking-wider transition-all cursor-pointer hover:scale-[1.02]"
                                    >
                                      Correct Attendance
                                    </button>
                                  </td>
                                </tr>
                              ))}
                              {filtered.length === 0 && (
                                <tr>
                                  <td colSpan={7} className="p-8 text-center text-slate-400 italic">
                                    No students matched the active filters.
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Missed Attendance Registry */}
                      {(() => {
                        const missedAttendanceList = (() => {
                          const today = new Date();
                          const list: any[] = [];
                          
                          for (let i = 0; i < 7; i++) {
                            const d = new Date();
                            d.setDate(today.getDate() - i);
                            
                            const dayName = d.toLocaleDateString("en-US", { weekday: "long" });
                            if (!workingDays.includes(dayName)) continue;
                            
                            const dateStr = d.toISOString().split("T")[0]; // YYYY-MM-DD
                            
                            const daySlots = slots.filter(s => {
                              const m = mentors.find(men => men.id === s.mentorId);
                              const matchesCollege = m && (m.college_id === activeCollegeId || (!m.college_id && activeCollegeId === "college_1"));
                              return matchesCollege && s.day === dayName;
                            });
                            
                            daySlots.forEach(s => {
                              const hasAtt = studentAttendance.some(a => a.slotId === s.id && a.dateStr === dateStr);
                              if (!hasAtt) {
                                const mentorObj = mentors.find(m => m.id === s.mentorId);
                                list.push({
                                  slot: s,
                                  dateStr,
                                  dayName,
                                  mentor: mentorObj,
                                  id: `${s.id}_${dateStr}`
                                });
                              }
                            });
                          }
                          
                          return list;
                        })();

                        return (
                          <div className="bg-white p-6 rounded-3xl border border-slate-205 shadow-sm space-y-4">
                            <div>
                              <h2 className="text-base font-black text-slate-905 flex items-center gap-2">
                                <span className="h-2 w-2 rounded-full bg-rose-500 animate-pulse"></span>
                                Faculty Attendance Compliance (Missed Markings)
                              </h2>
                              <p className="text-xs text-slate-400 font-semibold mt-0.5">Sessions in the past 7 days where attendance logs have not been submitted.</p>
                            </div>

                            <div className="overflow-x-auto rounded-2xl border border-slate-205 shadow-sm">
                              <table className="w-full border-collapse text-left text-xs font-semibold min-w-[500px]">
                                <thead>
                                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[9.5px]">
                                    <th className="p-3 border-r border-slate-100">Date / Slot</th>
                                    <th className="p-3 border-r border-slate-100">Class Group</th>
                                    <th className="p-3 border-r border-slate-100">Subject</th>
                                    <th className="p-3 border-r border-slate-100">Faculty Mentor</th>
                                    <th className="p-3 text-center">Action</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 bg-white text-slate-700">
                                  {missedAttendanceList.map(item => (
                                    <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                                      <td className="p-3 font-bold text-slate-805 border-r border-slate-100">
                                        {item.dateStr}
                                        <span className="text-[9.5px] text-slate-400 font-semibold block mt-0.5">{item.dayName} • {item.slot.time}</span>
                                      </td>
                                      <td className="p-3 font-bold text-slate-500 border-r border-slate-100">{item.slot.classGroup}</td>
                                      <td className="p-3 border-r border-slate-100">{item.slot.course}</td>
                                      <td className="p-3 border-r border-slate-100">
                                        <div className="font-bold text-slate-805">{item.mentor?.name || "Unknown Mentor"}</div>
                                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">{item.mentor?.email || "—"}</div>
                                      </td>
                                      <td className="p-3 text-center">
                                        <Button
                                          variant="danger"
                                          size="xs"
                                          onClick={() => handleSendWarningEmail(item)}
                                          disabled={emailSendingId === item.id}
                                          icon={emailSendingId === item.id ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Mail className="h-3 w-3" />}
                                        >
                                          {emailSendingId === item.id ? "Sending Alert..." : "Send Alert Email"}
                                        </Button>
                                      </td>
                                    </tr>
                                  ))}
                                  {missedAttendanceList.length === 0 && (
                                    <tr>
                                      <td colSpan={5} className="p-8 text-center text-emerald-600 font-extrabold italic">
                                        Yes All faculty members have marked attendance compliant logs for this week.
                                      </td>
                                    </tr>
                                  )}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  );
                })()}

                  {/* FEE COLLECTION TAB */}
                  {activeTab === "fees" && (() => {
                    const camId = currentCAM?.id;
                    return <CAMFeePanel camId={camId || ""} />;
                  })()}

                  {/* 7. OPERATIONAL REPORTS */}
                  {activeTab === "reports" && (
                    <Panel
                      title="Academic Operational Reports"
                      subtitle="Export student performance metrics, classroom utilization, and workload compliance ledger."
                    >
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs font-semibold">
                        {[
                          { title: "Faculty Workload & Allocation Ledger", desc: "List of all active faculty members, mapping assigned hours against the 16 hours/week workload limit." },
                          { title: "Student Attendance Shortage warning report", desc: "Detailed breakdown of students whose overall attendance rate is currently below the 75% threshold." },
                          { title: "Classroom & Lab Utilization report", desc: "Analyses classroom bookings, highlighting empty classroom counts and peak utilization times." },
                          { title: "Subject completion & syllabus pace report", desc: "Lists all syllabus mapping statuses, documenting actual periods held vs target scheduled hours." }
                        ].map((rep, idx) => (
                          <div key={idx} className="p-4 rounded-xl border border-slate-200 bg-white flex items-start justify-between gap-4 hover:shadow-md shadow-sm transition-all">
                            <div className="space-y-1">
                              <h4 className="text-xs font-bold text-slate-808">{rep.title}</h4>
                              <p className="text-[10.5px] text-slate-400 leading-relaxed font-semibold">{rep.desc}</p>
                            </div>
                            <Button
                              variant="secondary"
                              size="xs"
                              icon={<Download className="h-4 w-4" />}
                              onClick={() => toast(`Report "${rep.title}" exported successfully in Excel/PDF format.`, "success")}
                            />
                          </div>
                        ))}
                      </div>
                    </Panel>
                  )}

                  {/* 8. TASKS & ISSUES */}
                  {activeTab === "tasks" && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                      {/* Tasks from KAM */}
                      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-6">
                        <div>
                          <h2 className="text-base font-black text-slate-900">Tasks from Key Account Manager (KAM)</h2>
                          <p className="text-xs text-slate-405 font-semibold mt-0.5">SLA deliverables and operational tasks.</p>
                        </div>

                        <div className="space-y-3">
                          {localTasks.map(t => (
                            <div key={t.id} className="p-4 rounded-2xl border border-slate-200 bg-white shadow-sm flex flex-col gap-2 hover:shadow-md transition-all">
                              <div className="flex items-center justify-between">
                                <span className={`px-2 py-0.5 rounded border text-[8px] font-bold uppercase ${t.priority === "high" ? "bg-red-50 border-red-100 text-red-655" : "bg-amber-50 border-amber-100 text-amber-700"
                                  }`}>{t.priority}</span>
                                <span className="text-[10px] text-slate-400 font-semibold">Due: {t.dueDate}</span>
                              </div>
                              <h4 className="text-xs font-bold text-slate-808">{t.title}</h4>
                              <span className="px-2 py-0.5 text-[9px] uppercase font-bold rounded-lg bg-slate-50 border border-slate-200 self-start">
                                Status: {t.status}
                              </span>
                            </div>
                          ))}
                          {localTasks.length === 0 && <p className="text-xs text-slate-400 italic text-center py-6">No tasks assigned to your campus.</p>}
                        </div>
                      </div>

                      {/* Issues CRUD Form */}
                      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-6">
                        <div>
                          <h2 className="text-base font-black text-slate-900">
                            Report Campus Issue
                          </h2>
                          <p className="text-xs text-slate-400 font-semibold mt-0.5">Configure operational problems or escalate to KAM.</p>
                        </div>

                        <form onSubmit={handleSaveIssue} className="space-y-3 text-xs font-semibold bg-slate-50/50 p-4 rounded-xl border border-slate-200 shadow-sm">
                          <Input label="Issue Title" placeholder="e.g. Lab 202 Smartboard offline" value={issueTitle} onChange={e => setIssueTitle(e.target.value)} required />
                          <div className="grid grid-cols-2 gap-3">
                            <Select
                              label="Type"
                              value={issueType}
                              onChange={e => setIssueType(e.target.value)}
                              options={[
                                { value: "academic", label: "Academic" },
                                { value: "student", label: "Student" },
                                { value: "timetable", label: "Timetable" },
                                { value: "infrastructure", label: "Infrastructure" }
                              ]}
                            />
                            <Select
                              label="Priority"
                              value={issuePriority}
                              onChange={e => setIssuePriority(e.target.value)}
                              options={[
                                { value: "high", label: "High" },
                                { value: "medium", label: "Medium" },
                                { value: "low", label: "Low" }
                              ]}
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-slate-455 text-[10px] uppercase font-bold">Description</label>
                            <textarea rows={3} placeholder="Details of the issue..." value={issueDesc} onChange={e => setIssueDesc(e.target.value)} className="w-full p-2.5 border border-slate-200 rounded-xl bg-white text-xs font-semibold focus:ring-1 focus:ring-indigo-500 outline-none shadow-sm" required />
                          </div>
                          <div className="flex gap-2 pt-2">
                            <Button type="submit" variant="primary" size="md" className="w-full" icon={<Plus className="h-4 w-4" />}>
                              Log Local Issue
                            </Button>
                          </div>
                        </form>
                      </div>

                      {/* Active reported issues list with Search & filters */}
                      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-6">
                        <div className="border-b border-slate-105 pb-3 space-y-2">
                          <h2 className="text-xs font-black text-indigo-750 uppercase tracking-wider">Reported Issues Ledger</h2>
                          <div className="flex gap-2 flex-wrap text-[10px]">
                            <div className="relative flex-1">
                              <Search className="absolute left-2 top-2.5 h-3 w-3 text-slate-400" />
                              <input
                                type="text"
                                placeholder="Search issue..."
                                value={issueSearchQuery}
                                onChange={e => setIssueSearchQuery(e.target.value)}
                                className="w-full pl-7 pr-2 py-1.5 border border-slate-200 rounded-xl bg-slate-50 text-[10px] focus:outline-none shadow-sm"
                              />
                            </div>
                            <select
                              value={issueStatusFilter}
                              onChange={e => setIssueStatusFilter(e.target.value)}
                              className="p-1 border border-slate-200 rounded-lg bg-white font-bold cursor-pointer outline-none shadow-sm"
                            >
                              <option value="all">All Status</option>
                              <option value="open">Open</option>
                              <option value="resolved">Resolved</option>
                            </select>
                            <select
                              value={issueTypeFilter}
                              onChange={e => setIssueTypeFilter(e.target.value)}
                              className="p-1 border border-slate-200 rounded-lg bg-white font-bold cursor-pointer outline-none shadow-sm"
                            >
                              <option value="all">All Types</option>
                              <option value="academic">Academic</option>
                              <option value="student">Student</option>
                              <option value="timetable">Timetable</option>
                              <option value="infrastructure">Infrastructure</option>
                            </select>
                          </div>
                        </div>

                        <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
                          {issues
                            .filter(i => {
                              const matchesSearch = i.title.toLowerCase().includes(issueSearchQuery.toLowerCase());
                              const matchesStatus = issueStatusFilter === "all" || i.status === issueStatusFilter;
                              const matchesType = issueTypeFilter === "all" || i.type === issueTypeFilter;
                              return matchesSearch && matchesStatus && matchesType;
                            })
                            .map(i => {
                              const isEditing = editingIssueId === i.id;
                              return (
                                <div key={i.id} className="p-4 rounded-xl border border-slate-200 bg-white shadow-sm space-y-2 relative group hover:shadow-md transition-all">
                                  {isEditing ? (
                                    <form onSubmit={(ev) => handleSaveInlineIssue(ev, i.id)} className="space-y-2 w-full text-xs font-bold">
                                      <Input label="Issue Title" value={editIssueTitle} onChange={ev => setEditIssueTitle(ev.target.value)} required />
                                      <div className="grid grid-cols-2 gap-2">
                                        <Select
                                          label="Type"
                                          value={editIssueType}
                                          onChange={ev => setEditIssueType(ev.target.value)}
                                          options={[
                                            { value: "academic", label: "Academic" },
                                            { value: "student", label: "Student" },
                                            { value: "timetable", label: "Timetable" },
                                            { value: "infrastructure", label: "Infrastructure" }
                                          ]}
                                        />
                                        <Select
                                          label="Priority"
                                          value={editIssuePriority}
                                          onChange={ev => setEditIssuePriority(ev.target.value)}
                                          options={[
                                            { value: "high", label: "High" },
                                            { value: "medium", label: "Medium" },
                                            { value: "low", label: "Low" }
                                          ]}
                                        />
                                      </div>
                                      <div className="space-y-1">
                                        <label className="text-[9px] uppercase font-bold text-slate-400">Description</label>
                                        <textarea rows={2} value={editIssueDesc} onChange={ev => setEditIssueDesc(ev.target.value)} className="w-full p-2 border border-slate-200 rounded-lg text-xs" required />
                                      </div>
                                      <div className="flex gap-2 pt-2">
                                        <Button type="submit" variant="success" size="xs" className="flex-1">Save</Button>
                                        <Button type="button" variant="secondary" size="xs" onClick={() => setEditingIssueId(null)}>Cancel</Button>
                                      </div>
                                    </form>
                                  ) : (
                                    <>
                                      <div className="absolute right-3 top-3 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-all">
                                        <Button variant="secondary" size="xs" onClick={() => handleStartEditIssue(i)} title="Edit Issue" className="p-1">
                                          <Edit2 className="h-3.5 w-3.5" />
                                        </Button>
                                        <Button variant="danger" size="xs" onClick={() => handleDeleteIssue(i.id)} title="Delete Issue" className="p-1">
                                          <Trash2 className="h-3.5 w-3.5" />
                                        </Button>
                                      </div>

                                      <div className="flex justify-between items-center text-xs">
                                        <span className={`px-2 py-0.5 rounded border text-[8px] font-bold uppercase ${i.status === "resolved" ? "bg-emerald-50 border-emerald-100 text-emerald-705" : "bg-red-50 border-red-100 text-red-700"
                                          }`}>{i.status}</span>
                                        <span className="text-[9px] text-slate-400 mr-12 font-bold">{i.type}</span>
                                      </div>
                                      <h4 className="text-xs font-bold text-slate-808 pr-12">{i.title}</h4>
                                      <p className="text-[10.5px] text-slate-400 leading-relaxed font-semibold">{i.desc}</p>

                                      {i.status === "open" && (
                                        <div className="flex gap-2 pt-2 text-[10px] font-bold">
                                          <Button
                                            variant="success"
                                            size="xs"
                                            onClick={() => updateCampusIssueStatus(i.id, "resolved", new Date().toLocaleDateString())}
                                            className="flex-1"
                                          >
                                            Resolve
                                          </Button>
                                          <Button
                                            variant={i.escalated ? "success" : "warning"}
                                            size="xs"
                                            onClick={() => handleEscalateIssue(i.id)}
                                            disabled={i.escalated}
                                            className="flex-1"
                                          >
                                            {i.escalated ? "Escalated" : "Escalate"}
                                          </Button>
                                        </div>
                                      )}
                                    </>
                                  )}
                                </div>
                              );
                            })}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Tab 8.5: Class Handovers */}
                  {activeTab === "handovers" && (() => {
                    const campusRequests = requests.filter(r => mentors.find(m => m.id === r.requestorId)?.college_id === activeCollegeId);
                    const campusApproved = approvedHandovers.filter(h => mentors.find(m => m.id === h.originalMentorId)?.college_id === activeCollegeId);
                    const camMentor = mentors.find(m => 
                      m.email?.toLowerCase() === currentCAM?.email?.toLowerCase() || 
                      m.name?.toLowerCase() === currentCAM?.name?.toLowerCase()
                    );
                    
                    return (
                      <div className="space-y-6">
                        <div className="bg-white p-6 rounded-3xl border border-slate-205 shadow-sm space-y-6">
                          <div>
                            <h2 className="text-base font-black text-slate-905">Pending Handover Requests</h2>
                            <p className="text-xs text-slate-400 font-semibold mt-0.5">Substitution requests awaiting receiver approval.</p>
                          </div>
                          
                          <div className="overflow-x-auto rounded-2xl border border-slate-205 shadow-sm">
                            <table className="w-full border-collapse text-left text-xs font-semibold min-w-[640px]">
                              <thead>
                                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[9.5px]">
                                  <th className="p-3 border-r border-slate-100">Handover Date</th>
                                  <th className="p-3 border-r border-slate-100">Time / Class</th>
                                  <th className="p-3 border-r border-slate-100">Requestor (Original)</th>
                                  <th className="p-3 border-r border-slate-100">Receiver (Cover)</th>
                                  <th className="p-3 border-r border-slate-100">Reason</th>
                                  <th className="p-3 border-r border-slate-100">Status</th>
                                  <th className="p-3 text-right">Actions</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 bg-white text-slate-700">
                                {campusRequests.filter(r => r.status === "pending" || r.status === "pending_cam").map(req => (
                                  <tr key={req.id} className="hover:bg-slate-50/50 transition-colors">
                                    <td className="p-3 font-bold text-slate-805 border-r border-slate-100">{req.dateStr}</td>
                                    <td className="p-3 border-r border-slate-100">
                                      <div className="font-bold text-slate-805">{req.course}</div>
                                      <div className="text-[10px] text-slate-400">{req.time}</div>
                                    </td>
                                    <td className="p-3 font-bold border-r border-slate-100">{req.requestorName}</td>
                                    <td className="p-3 font-bold text-indigo-700 border-r border-slate-100">{req.targetStaffName}</td>
                                    <td className="p-3 italic text-slate-500 border-r border-slate-100 text-[11px] max-w-xs truncate" title={req.reason}>
                                      {req.reason}
                                    </td>
                                    <td className="p-3 border-r border-slate-100">
                                      {req.status === "pending_cam" ? (
                                        <span className="px-2 py-0.5 rounded border text-[9.5px] font-bold uppercase bg-indigo-50 border-indigo-150 text-indigo-700 animate-pulse">
                                          Emergency (CM)
                                        </span>
                                      ) : (
                                        <span className="px-2 py-0.5 rounded border text-[9.5px] font-bold uppercase bg-amber-50 border-amber-100 text-amber-700">
                                          Pending
                                        </span>
                                      )}
                                    </td>
                                    <td className="p-3 text-right">
                                      {req.status === "pending_cam" ? (
                                        <div className="flex gap-2 justify-end">
                                          <button
                                            type="button"
                                            onClick={async () => {
                                              if (await showConfirm({ message: "Approve this Emergency Handover Request? It will be forwarded to the cover staff.", confirmLabel: "Approve", title: "Approve Emergency Handover" })) {
                                                await handleRequest(req.id, "approved", "", "Campus Manager");
                                                toast("Emergency request approved and forwarded to the cover staff.", "success");
                                              }
                                            }}
                                            className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[9.5px] font-bold shadow-sm transition-colors"
                                          >
                                            Approve Emergency
                                          </button>
                                          <button
                                            type="button"
                                            onClick={async () => {
                                              if (await showConfirm({ message: "Are you sure you want to reject this emergency handover request?", danger: true, confirmLabel: "Reject" })) {
                                                await handleRequest(req.id, "rejected", "", "Campus Manager");
                                                toast("Emergency request rejected.", "info");
                                              }
                                            }}
                                            className="px-2.5 py-1.5 bg-red-50 hover:bg-red-100 border border-red-200 text-red-650 rounded-lg text-[9.5px] font-bold shadow-sm transition-colors"
                                          >
                                            Reject
                                          </button>
                                        </div>
                                      ) : camMentor && req.targetStaffId === camMentor.id ? (
                                        <div className="flex gap-2 justify-end">
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setReviewingRequestId(req.id);
                                              setHandoverSubject("original");
                                              setSelectedSubjName("");
                                              setCustomSubjName("");
                                              setReviewReason("");
                                            }}
                                            className="px-2.5 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-[9.5px] font-bold shadow-sm transition-colors"
                                          >
                                            Approve
                                          </button>
                                          <button
                                            type="button"
                                            onClick={async () => {
                                              if (await showConfirm({ message: "Are you sure you want to reject this handover request?", danger: true, confirmLabel: "Reject" })) {
                                                await handleRequest(req.id, "rejected", "", "Campus Manager");
                                                toast("Request rejected successfully.", "info");
                                              }
                                            }}
                                            className="px-2.5 py-1.5 bg-red-50 hover:bg-red-100 border border-red-200 text-red-600 rounded-lg text-[9.5px] font-bold shadow-sm transition-colors"
                                          >
                                            Reject
                                          </button>
                                        </div>
                                      ) : (
                                        <span className="text-[10px] text-slate-400 font-semibold italic">
                                          Awaiting cover staff ({req.targetStaffName})
                                        </span>
                                      )}
                                    </td>
                                  </tr>
                                ))}
                                {campusRequests.filter(r => r.status === "pending" || r.status === "pending_cam").length === 0 && (
                                  <tr>
                                    <td colSpan={7} className="p-8 text-center text-slate-400 italic">
                                      No pending handover requests for this campus.
                                    </td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>

                        {/* Compact Approval Subject Dialog - Not full screen, simple card overlay */}
                        {reviewingRequestId && (() => {
                          const reviewReq = campusRequests.find(r => r.id === reviewingRequestId);
                          if (!reviewReq) return null;
                          const coverMentor = mentors.find(m => m.id === reviewReq.targetStaffId);
                          return (
                            <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/25 backdrop-blur-sm">
                              <div className="bg-white rounded-3xl shadow-xl border border-slate-150 p-5 w-full max-w-sm mx-4">
                                <div className="flex items-center justify-between mb-4">
                                  <h3 className="text-sm font-black text-slate-900">Select Subject for Coverage</h3>
                                  <button onClick={() => setReviewingRequestId(null)} className="text-slate-400 hover:text-slate-600 transition-colors">
                                    <XCircle className="h-4.5 w-4.5" />
                                  </button>
                                </div>
                                
                                <div className="space-y-2 mb-4">
                                  <button 
                                    onClick={() => setHandoverSubject("original")} 
                                    className={`w-full px-3 py-2 text-left rounded-xl text-[11px] font-extrabold border transition-all ${
                                      handoverSubject === "original" 
                                        ? "bg-indigo-600 text-white border-indigo-600 shadow-sm" 
                                        : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                                    }`}
                                  >
                                    Original Subject ({reviewReq.course})
                                  </button>
                                  
                                  <button 
                                    onClick={() => setHandoverSubject("substitute_own")} 
                                    className={`w-full px-3 py-2 text-left rounded-xl text-[11px] font-extrabold border transition-all ${
                                      handoverSubject === "substitute_own" 
                                        ? "bg-indigo-600 text-white border-indigo-600 shadow-sm" 
                                        : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                                    }`}
                                  >
                                    {coverMentor ? `${coverMentor.name}'s Own Subject` : "Substitute's Own Subject"}
                                  </button>
                                  
                                  {handoverSubject === "substitute_own" && (
                                    <select 
                                      value={selectedSubjName} 
                                      onChange={(e) => setSelectedSubjName(e.target.value)} 
                                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:ring-1 focus:ring-indigo-500"
                                    >
                                      <option value="">-- Choose Subject --</option>
                                      {((coverMentor?.subjects || "") as string).split(",").map(s => s.trim()).filter(Boolean).map(s => (
                                        <option key={s} value={s}>{s}</option>
                                      ))}
                                    </select>
                                  )}
                                  
                                  <button 
                                    onClick={() => setHandoverSubject("custom")} 
                                    className={`w-full px-3 py-2 text-left rounded-xl text-[11px] font-extrabold border transition-all ${
                                      handoverSubject === "custom" 
                                        ? "bg-indigo-600 text-white border-indigo-600 shadow-sm" 
                                        : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                                    }`}
                                  >
                                    Custom / Other (e.g. Test, Revision)
                                  </button>
                                  
                                  {handoverSubject === "custom" && (
                                    <input 
                                      type="text" 
                                      placeholder="e.g. Test Supervision, Self Study" 
                                      value={customSubjName} 
                                      onChange={(e) => setCustomSubjName(e.target.value)} 
                                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:ring-1 focus:ring-indigo-500" 
                                    />
                                  )}
                                </div>
                                
                                <div className="mb-4">
                                  <input 
                                    type="text" 
                                    placeholder="Optional note / feedback..." 
                                    value={reviewReason} 
                                    onChange={(e) => setReviewReason(e.target.value)} 
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 outline-none" 
                                  />
                                </div>
                                
                                <div className="flex gap-2 justify-end pt-3 border-t border-slate-100">
                                  <button onClick={() => setReviewingRequestId(null)} className="px-3 py-2 text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors">
                                    Cancel
                                  </button>
                                  <button 
                                    onClick={async () => {
                                      let finalCourseName = reviewReq.course;
                                      if (handoverSubject === "substitute_own") { 
                                        if (!selectedSubjName) { toast("Please select one of the subjects.", "warning"); return; }
                                        finalCourseName = selectedSubjName; 
                                      } else if (handoverSubject === "custom") { 
                                        if (!customSubjName.trim()) { toast("Please enter a custom subject name.", "warning"); return; }
                                        finalCourseName = customSubjName.trim(); 
                                      }
                                      await handleRequest(reviewReq.id, "approved", reviewReason, "Campus Manager", finalCourseName);
                                      setReviewingRequestId(null); 
                                      setReviewReason("");
                                    }} 
                                    className="px-4 py-2 bg-teal-600 text-white rounded-xl text-xs font-bold hover:bg-teal-700 shadow-sm"
                                  >
                                    Confirm Approve
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })()}

                        <div className="bg-white p-6 rounded-3xl border border-slate-205 shadow-sm space-y-6">
                          <div>
                            <h2 className="text-base font-black text-slate-905">Approved Handovers Log</h2>
                            <p className="text-xs text-slate-400 font-semibold mt-0.5">Historically approved substitutions and actual subjects taught.</p>
                          </div>
                          
                          <div className="overflow-x-auto rounded-2xl border border-slate-205 shadow-sm">
                            <table className="w-full border-collapse text-left text-xs font-semibold min-w-[480px]">
                              <thead>
                                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[9.5px]">
                                  <th className="p-3 border-r border-slate-100">Date</th>
                                  <th className="p-3 border-r border-slate-100">Time / Class</th>
                                  <th className="p-3 border-r border-slate-100">Original Mentor</th>
                                  <th className="p-3 border-r border-slate-100">Covering Mentor</th>
                                  <th className="p-3 border-r border-slate-100">Subject Taught</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 bg-white text-slate-700">
                                {campusApproved.map(h => {
                                  const req = campusRequests.find(r => r.id === h.requestId);
                                  const originalMentor = mentors.find(m => m.id === h.originalMentorId);
                                  return (
                                    <tr key={h.requestId} className="hover:bg-slate-50/50 transition-colors">
                                      <td className="p-3 font-bold text-slate-805 border-r border-slate-100">{h.dateStr}</td>
                                      <td className="p-3 border-r border-slate-100">
                                        <div className="font-bold text-slate-805">{req?.classGroup || "-"}</div>
                                        <div className="text-[10px] text-slate-400">{req?.time || "-"}</div>
                                      </td>
                                      <td className="p-3 text-slate-500 font-bold border-r border-slate-100">{originalMentor?.name || "Unknown"}</td>
                                      <td className="p-3 font-bold text-emerald-700 border-r border-slate-100">{h.coverStaffName}</td>
                                      <td className="p-3 font-bold text-slate-805 border-r border-slate-100">
                                        {h.course}
                                        {req && req.course !== h.course && (
                                          <span className="ml-2 px-1.5 py-0.5 bg-indigo-50 text-indigo-600 rounded text-[9px] uppercase border border-indigo-100">
                                            Custom Subject
                                          </span>
                                        )}
                                      </td>
                                    </tr>
                                  );
                                })}
                                {campusApproved.length === 0 && (
                                  <tr>
                                    <td colSpan={5} className="p-8 text-center text-slate-400 italic">
                                      No approved handovers logged for this campus.
                                    </td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>

                        {/*  Swap-to-Compensate Tracker */}
                        {(() => {
                          const swapRequests = campusRequests.filter((r: any) => r.request_type === "swap_compensate");
                          const pendingSwaps = swapRequests.filter((r: any) => r.status === "pending" || r.status === "pending_cam");
                          const approvedSwaps = swapRequests.filter((r: any) => r.status === "approved");
                          const rejectedSwaps = swapRequests.filter((r: any) => r.status === "rejected");

                          return (
                            <div className="bg-white p-6 rounded-3xl border border-slate-205 shadow-sm space-y-6">
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                                <div>
                                  <h2 className="text-base font-black text-slate-905 flex items-center gap-2">
                                    <span className="text-2xl">↔</span>
                                    Swap-to-Compensate Tracker
                                  </h2>
                                  <p className="text-xs text-slate-400 font-semibold mt-0.5">
                                    Monitor class swap offers made between faculty to settle workload hour debts.
                                  </p>
                                </div>
                                <div className="flex gap-2 flex-wrap">
                                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-700">
                                    <span className="text-[9px] font-black uppercase">Pending</span>
                                    <span className="text-sm font-black">{pendingSwaps.length}</span>
                                  </div>
                                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-teal-50 border border-teal-200 text-teal-700">
                                    <span className="text-[9px] font-black uppercase">Settled</span>
                                    <span className="text-sm font-black">{approvedSwaps.length}</span>
                                  </div>
                                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-50 border border-red-200 text-red-700">
                                    <span className="text-[9px] font-black uppercase">Declined</span>
                                    <span className="text-sm font-black">{rejectedSwaps.length}</span>
                                  </div>
                                </div>
                              </div>

                              {swapRequests.length === 0 ? (
                                <div className="text-center py-10 border border-dashed border-slate-200 rounded-2xl bg-slate-50/30">
                                  <p className="text-4xl mb-3">↔</p>
                                  <p className="text-xs text-slate-400 font-semibold italic">No swap compensation requests for this campus yet.</p>
                                </div>
                              ) : (
                                <div className="overflow-x-auto rounded-2xl border border-slate-200 shadow-xs">
                                  <table className="w-full border-collapse text-left text-xs font-semibold min-w-[580px]">
                                    <thead>
                                      <tr className="bg-gradient-to-r from-indigo-50 to-purple-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[9px] tracking-widest">
                                        <th className="p-3">Date Offered</th>
                                        <th className="p-3">Debtor (Owes Hours)</th>
                                        <th className="p-3">Creditor (Owed Hours)</th>
                                        <th className="p-3">Class Offered</th>
                                        <th className="p-3">Time</th>
                                        <th className="p-3 text-center">Status</th>
                                        <th className="p-3 text-right">Requested</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 bg-white text-slate-700">
                                      {swapRequests.slice().sort((a: any, b: any) => b.timestamp.localeCompare(a.timestamp)).map((req: any) => {
                                        const debtorMentor = mentors.find(m => m.id === req.requestorId);
                                        const creditorMentor = mentors.find(m => m.id === req.targetStaffId);
                                        const isPending = req.status === "pending" || req.status === "pending_cam";
                                        const isApproved = req.status === "approved";
                                        return (
                                          <tr key={req.id} className="hover:bg-indigo-50/20 transition-colors">
                                            <td className="p-3">
                                              <div className="font-bold text-slate-800">{req.dateFormatted}</div>
                                              <div className="text-[9px] text-slate-400 mt-0.5">{req.dateStr}</div>
                                            </td>
                                            <td className="p-3">
                                              <div className="font-black text-rose-700">{debtorMentor?.name || req.requestorName}</div>
                                              <div className="text-[9px] text-rose-400 mt-0.5">{debtorMentor?.department || "—"}</div>
                                            </td>
                                            <td className="p-3">
                                              <div className="font-black text-emerald-700">{creditorMentor?.name || req.targetStaffName}</div>
                                              <div className="text-[9px] text-emerald-400 mt-0.5">{creditorMentor?.department || "—"}</div>
                                            </td>
                                            <td className="p-3">
                                              <div className="font-bold text-slate-800 max-w-[180px] truncate" title={req.course}>{req.course}</div>
                                              <div className="text-[9px] text-slate-400 mt-0.5">{req.day}</div>
                                            </td>
                                            <td className="p-3 text-slate-600 font-medium whitespace-nowrap">{req.time}</td>
                                            <td className="p-3 text-center">
                                              {isApproved ? (
                                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-teal-100 border border-teal-200 text-teal-800 text-[8.5px] font-black uppercase">
                                                  Yes Settled
                                                </span>
                                              ) : isPending ? (
                                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-100 border border-amber-200 text-amber-800 text-[8.5px] font-black uppercase">
                                                  ⏳ Awaiting
                                                </span>
                                              ) : (
                                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-100 border border-red-200 text-red-800 text-[8.5px] font-black uppercase">
                                                  No Declined
                                                </span>
                                              )}
                                            </td>
                                            <td className="p-3 text-right text-slate-400 font-medium whitespace-nowrap">
                                              {new Date(req.timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>
                          );
                        })()}

                      </div>
                    );
                  })()}

                  {/* Student Tracker Audit Tab */}
                  {activeTab === "tracker" && (() => {
                    const collegeStudents = students.filter(s => !s.college_id || s.college_id === activeCollegeId);
                    const distinctClasses = Array.from(new Set([
                      ...collegeStudents.map(s => s.classGroup).filter(Boolean),
                      ...weeklyTasks.map(t => t.class_group).filter(Boolean),
                      ...studentTracker.map(st => st.class_group).filter(Boolean)
                    ])).sort();

                    const collegeSubjects = subjectsList.length > 0
                      ? subjectsList
                      : Array.from(new Set([
                          ...weeklyTasks.map(t => t.subject).filter(Boolean),
                          ...studentTracker.map(st => st.subject).filter(Boolean)
                        ])).map(name => ({ id: name, name }));

                    const activeClass = camTrackerClass || (distinctClasses[0] || "");
                    const activeSubject = camTrackerSubject || (collegeSubjects[0]?.name || "");

                    return (
                      <div className="space-y-6 font-sans">
                        {/* Header */}
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-150 pb-4">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0">
                              <GraduationCap className="h-5 w-5" />
                            </div>
                            <div>
                              <h2 className="text-lg font-black text-slate-800 leading-tight">Student Performance &amp; Task Audit Console</h2>
                              <p className="text-xs text-slate-455 font-medium mt-0.5">
                                Monitor and review weekly tasks, student submissions, and evaluations across all classes.
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Selectors and Filters */}
                        <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs flex flex-wrap gap-4 items-end">
                          <div className="flex-1 min-w-[200px] space-y-1.5">
                            <label className="text-[10px] text-slate-455 font-extrabold uppercase tracking-wider block">Class Group</label>
                            <select
                              value={activeClass}
                              onChange={(e) => setCamTrackerClass(e.target.value)}
                              className="w-full text-xs font-semibold px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-indigo-500 bg-white"
                            >
                              {distinctClasses.map(c => (
                                <option key={c} value={c}>{c}</option>
                              ))}
                              {distinctClasses.length === 0 && <option value="">No class groups</option>}
                            </select>
                          </div>

                          <div className="flex-1 min-w-[200px] space-y-1.5">
                            <label className="text-[10px] text-slate-455 font-extrabold uppercase tracking-wider block">Subject</label>
                            <select
                              value={activeSubject}
                              onChange={(e) => setCamTrackerSubject(e.target.value)}
                              className="w-full text-xs font-semibold px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-indigo-500 bg-white"
                            >
                              {collegeSubjects.map(s => (
                                <option key={s.id} value={s.name}>{s.name}</option>
                              ))}
                              {collegeSubjects.length === 0 && <option value="">No subjects found</option>}
                            </select>
                          </div>

                          <div className="w-[120px] space-y-1.5">
                            <label className="text-[10px] text-slate-455 font-extrabold uppercase tracking-wider block">Week Number</label>
                            <select
                              value={camTrackerWeek}
                              onChange={(e) => setCamTrackerWeek(parseInt(e.target.value, 10))}
                              className="w-full text-xs font-semibold px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-indigo-500 bg-white"
                            >
                              {Array.from({ length: 15 }, (_, i) => i + 1).map(wk => (
                                <option key={wk} value={wk}>Week {wk}</option>
                              ))}
                            </select>
                          </div>
                        </div>

                      {/* Assigned Task Detail Card */}
                      {(() => {
                        const currentTask = weeklyTasks.find(
                          t => t.class_group.toLowerCase().trim() === activeClass.toLowerCase().trim() &&
                               t.subject.toLowerCase().trim() === activeSubject.toLowerCase().trim() &&
                               t.week_number === camTrackerWeek
                        );

                        const mentor = currentTask ? mentors.find(m => m.id === currentTask.mentor_id) : null;

                        return (
                          <div className="bg-gradient-to-r from-indigo-500/5 via-teal-500/5 to-transparent border border-indigo-100 rounded-3xl p-6 shadow-xs space-y-3">
                            <div className="flex items-center gap-2">
                              <BookOpen className="h-4.5 w-4.5 text-indigo-500" />
                              <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest">
                                Week {camTrackerWeek} Task Assignment Details
                              </h3>
                            </div>

                            {currentTask ? (
                              <div className="bg-white/80 border border-white/50 p-4 rounded-2xl flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                                <div className="space-y-1">
                                  <div className="text-xs font-extrabold text-slate-800">{currentTask.task_name}</div>
                                  {currentTask.task_pdf_url && (
                                    <a
                                      href={currentTask.task_pdf_url}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="text-[10px] font-bold text-indigo-600 hover:underline flex items-center gap-1"
                                    >
                                      <BookOpen className="h-3 w-3" /> View Reference Document
                                    </a>
                                  )}
                                </div>
                                <div className="text-right">
                                  <div className="text-[10px] font-bold text-slate-700">Assigned by: {mentor?.name || "Faculty"}</div>
                                  <div className="text-[9px] text-slate-400 font-mono mt-0.5">
                                    {parseDbDate(currentTask.updated_at).toLocaleString()}
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <div className="text-center py-4 bg-white/50 border border-dashed border-indigo-200 rounded-2xl">
                                <p className="text-xs text-slate-455 italic">No task assigned for Week {camTrackerWeek} yet.</p>
                              </div>
                            )}
                          </div>
                        );
                      })()}

                      {/* Submissions & Marks Audit Table */}
                      <div className="bg-white border border-slate-250/60 rounded-3xl p-6 shadow-xs space-y-4">
                        <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest border-b border-slate-100 pb-2">
                          Submissions &amp; Evaluations Audit
                        </h3>
                        {(() => {
                          const classStudents = students.filter(
                            s => s.classGroup && s.classGroup.toLowerCase().trim() === activeClass.toLowerCase().trim()
                          );

                          if (classStudents.length === 0) {
                            return (
                              <div className="text-center py-8">
                                <p className="text-xs text-slate-455 italic">No students registered in class &ldquo;{activeClass}&rdquo;.</p>
                              </div>
                            );
                          }

                          return (
                            <div className="overflow-x-auto rounded-2xl border border-slate-205 shadow-sm">
                              <table className="w-full border-collapse text-left text-xs min-w-[560px]">
                                <thead>
                                  <tr className="bg-slate-55 border-b border-slate-200 text-slate-550 font-bold uppercase text-[9.5px]">
                                    <th className="p-3 w-[25%]">Student Info</th>
                                    <th className="p-3 w-[30%]">Submission Link</th>
                                    <th className="p-3 w-[35%]">VIVA Feedback / Assessment Comments</th>
                                    <th className="p-3 w-[10%] text-center">Marks (0-10)</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 bg-white">
                                  {classStudents.map(student => {
                                    const entry = studentTracker.find(
                                      e => e.student_id === student.id &&
                                           e.class_group.toLowerCase().trim() === activeClass.toLowerCase().trim() &&
                                           e.subject.toLowerCase().trim() === activeSubject.toLowerCase().trim() &&
                                           e.week_number === camTrackerWeek
                                    );

                                    const marks = entry?.marks !== undefined && entry?.marks !== null ? entry.marks : null;
                                    const feedback = entry?.viva_assessment || "";
                                    const submissionUrl = entry?.submission_url || "";

                                    let badgeBg = "bg-slate-50 border-slate-200 text-slate-500";
                                    if (marks !== null) {
                                      if (marks >= 8) badgeBg = "bg-teal-50 border-teal-150 text-teal-700";
                                      else if (marks >= 5) badgeBg = "bg-amber-50 border-amber-150 text-amber-700";
                                      else badgeBg = "bg-rose-50 border-rose-150 text-rose-700";
                                    }

                                    return (
                                      <tr key={student.id} className="hover:bg-slate-50/40 transition-colors text-slate-700">
                                        <td className="p-3">
                                          <div className="font-bold text-slate-800">{student.name}</div>
                                          <div className="text-[9px] text-slate-400 font-mono mt-0.5">{student.id}</div>
                                        </td>
                                        <td className="p-3">
                                          {submissionUrl ? (
                                            <a
                                              href={submissionUrl}
                                              target="_blank"
                                              rel="noreferrer"
                                              className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-650 hover:underline max-w-[220px] truncate cursor-pointer"
                                              title={submissionUrl}
                                            >
                                              <BookOpen className="h-3.5 w-3.5 shrink-0" />
                                              {submissionUrl}
                                            </a>
                                          ) : (
                                            <span className="text-[10px] text-slate-400 italic">No submission yet</span>
                                          )}
                                        </td>
                                        <td className="p-3 font-semibold text-slate-650">
                                          {feedback || <span className="text-[10px] text-slate-350 italic">No feedback entered</span>}
                                        </td>
                                        <td className="p-3 text-center">
                                          {marks !== null ? (
                                            <span className={`inline-flex items-center px-2 py-0.5 rounded-lg border text-xs font-black uppercase tracking-wider ${badgeBg}`}>
                                              {marks} / 10
                                            </span>
                                          ) : (
                                            <span className="text-[10px] text-slate-400 italic">Pending</span>
                                          )}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  );
                })()}

                  {/* Tab: Student Directory & Bulk Import */}
                  {activeTab === "students_list" && (
                    <div className="space-y-6 font-sans">
                      {/* Console Header */}
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-150 pb-4">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0">
                            <Users className="h-5 w-5" />
                          </div>
                          <div>
                            <h2 className="text-lg font-black text-slate-800 leading-tight">Student Directory &amp; Import Console</h2>
                            <p className="text-xs text-slate-455 font-medium mt-0.5">
                              Manage student records, view academic marks, and bulk import students using pre-mapped Excel files.
                            </p>
                          </div>
                        </div>

                        {/* Top Actions */}
                        <div className="flex items-center gap-2 flex-wrap">

                          {/* Download Template: 3-part selector (Dept + Shift + Sem) + Download button */}
                          {(() => {
                            const campusDeptNames = coursesList.filter(c => c.college_id === activeCollegeId).map(c => c.name);
                            const deptOptions = campusDeptNames.length > 0 ? campusDeptNames : FACULTY_DEPARTMENTS;
                            const shiftOptions = ["Shift 1", "Shift 2", "General"];
                            const semOptions = ["Semester 1", "Semester 2", "Semester 3", "Semester 4", "Semester 5", "Semester 6"];
                            const composedClass = `${templateDept || deptOptions[0] || "Dept"} - ${templateShift} - ${templateSem}`;
                            return (
                              <div className="flex items-center gap-1 bg-slate-100 border border-slate-200 rounded-xl px-1.5 py-1 shadow-xs">
                                <select
                                  value={templateDept || deptOptions[0] || ""}
                                  onChange={(e) => setTemplateDept(e.target.value)}
                                  className="text-[11px] font-bold px-2 py-1.5 rounded-lg bg-white border border-slate-200 outline-none cursor-pointer text-slate-700"
                                >
                                  {deptOptions.map(d => <option key={d} value={d}>{d}</option>)}
                                </select>
                                <select
                                  value={templateShift}
                                  onChange={(e) => setTemplateShift(e.target.value)}
                                  className="text-[11px] font-bold px-2 py-1.5 rounded-lg bg-white border border-slate-200 outline-none cursor-pointer text-slate-700"
                                >
                                  {shiftOptions.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                                <select
                                  value={templateSem}
                                  onChange={(e) => setTemplateSem(e.target.value)}
                                  className="text-[11px] font-bold px-2 py-1.5 rounded-lg bg-white border border-slate-200 outline-none cursor-pointer text-slate-700"
                                >
                                  {semOptions.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                                <button
                                  type="button"
                                  onClick={() => handleDownloadStudentTemplate(composedClass)}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-800 text-white text-[11px] font-bold transition-all cursor-pointer whitespace-nowrap"
                                >
                                  <Download className="h-3 w-3" />
                                  Download
                                </button>
                              </div>
                            );
                          })()}

                          <label className="inline-flex items-center gap-2 px-4 py-2 rounded-xl btn-gradient text-white text-xs font-bold transition-all shadow-sm cursor-pointer active:scale-95">
                            <Upload className="h-3.5 w-3.5" />
                            Import Students (Excel)
                            <input
                              type="file"
                              accept=".xlsx, .xls, .csv"
                              onChange={handleStudentFileSelect}
                              className="hidden"
                            />
                          </label>
                        </div>
                      </div>

                      {/* Metric Summary Cards */}
                      {(() => {
                        const campusStudents = students.filter(s => s.college_id === activeCollegeId || (!s.college_id && activeCollegeId === "college_1"));
                        const classGroupsCount = new Set(campusStudents.map(s => s.classGroup).filter(Boolean)).size;
                        const completeProfilesCount = campusStudents.filter(s => s.tenth_mark || s.twelfth_mark || s.phone || s.linkedin_link).length;

                        return (
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-xs flex items-center gap-3">
                              <div className="h-10 w-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                                <GraduationCap className="h-5 w-5" />
                              </div>
                              <div>
                                <span className="text-xl font-extrabold text-slate-900 block leading-tight">{campusStudents.length}</span>
                                <span className="text-[10px] text-slate-455 font-bold uppercase tracking-wider">Total Registered Students</span>
                              </div>
                            </div>

                            <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-xs flex items-center gap-3">
                              <div className="h-10 w-10 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center shrink-0">
                                <BookOpen className="h-5 w-5" />
                              </div>
                              <div>
                                <span className="text-xl font-extrabold text-slate-900 block leading-tight">{classGroupsCount}</span>
                                <span className="text-[10px] text-slate-455 font-bold uppercase tracking-wider">Active Cohorts / Batches</span>
                              </div>
                            </div>

                            <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-xs flex items-center gap-3">
                              <div className="h-10 w-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
                                <Sparkles className="h-5 w-5" />
                              </div>
                              <div>
                                <span className="text-xl font-extrabold text-slate-900 block leading-tight">{completeProfilesCount}</span>
                                <span className="text-[10px] text-slate-455 font-bold uppercase tracking-wider">Detailed Profiles Mapped</span>
                              </div>
                            </div>
                          </div>
                        );
                      })()}

                      {/* Filters & Search Controls */}
                      <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs flex flex-wrap gap-4 items-center justify-between">
                        <div className="relative flex-1 min-w-[220px]">
                          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                          <input
                            type="text"
                            placeholder="Search by Name, Roll No, Email, Phone..."
                            value={studentDirSearch}
                            onChange={(e) => setStudentDirSearch(e.target.value)}
                            className="w-full pl-9 pr-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 focus:outline-none focus:border-indigo-500 bg-slate-50/50"
                          />
                        </div>

                        <div className="flex items-center gap-3 flex-wrap">
                          <select
                            value={studentDirDeptFilter}
                            onChange={(e) => setStudentDirDeptFilter(e.target.value)}
                            className="text-xs font-bold px-3 py-2 rounded-xl border border-slate-200 bg-white cursor-pointer outline-none shadow-xs"
                          >
                            <option value="all">All Departments</option>
                            {Array.from(new Set(students.map(s => s.department).filter(Boolean))).map(d => (
                              <option key={d} value={d}>{d}</option>
                            ))}
                          </select>

                          <select
                            value={studentClassFilter}
                            onChange={(e) => setStudentClassFilter(e.target.value)}
                            className="text-xs font-bold px-3 py-2 rounded-xl border border-slate-200 bg-white cursor-pointer outline-none shadow-xs"
                          >
                            <option value="all">All Class Cohorts</option>
                            {distinctClasses.map(c => (
                              <option key={c} value={c}>{c}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* Students Table */}
                      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-4">
                        {(() => {
                          const campusStudents = students.filter(s => s.college_id === activeCollegeId || (!s.college_id && activeCollegeId === "college_1"));
                          const filtered = campusStudents.filter(s => {
                            const matchSearch = !studentDirSearch ||
                              s.name?.toLowerCase().includes(studentDirSearch.toLowerCase()) ||
                              s.roll_number?.toLowerCase().includes(studentDirSearch.toLowerCase()) ||
                              s.id?.toLowerCase().includes(studentDirSearch.toLowerCase()) ||
                              s.email?.toLowerCase().includes(studentDirSearch.toLowerCase()) ||
                              s.phone?.includes(studentDirSearch);

                            const matchDept = studentDirDeptFilter === "all" || s.department === studentDirDeptFilter;
                            const matchClass = studentClassFilter === "all" || s.classGroup === studentClassFilter;

                            return matchSearch && matchDept && matchClass;
                          });

                          if (filtered.length === 0) {
                            return (
                              <div className="text-center py-12 border border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
                                <GraduationCap className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                                <p className="text-sm font-bold text-slate-600">No students found</p>
                                <p className="text-xs text-slate-400 mt-1">Try adjusting search filters or use &ldquo;Import Students (Excel)&rdquo; above to load records.</p>
                              </div>
                            );
                          }

                          return (
                            <div className="overflow-x-auto rounded-2xl border border-slate-200 shadow-xs">
                              <table className="w-full border-collapse text-left text-xs font-semibold min-w-[900px]">
                                <thead>
                                  <tr className="bg-gradient-to-r from-slate-50 to-indigo-50/30 border-b border-slate-200 text-slate-600 font-extrabold uppercase text-[9.5px] tracking-wider">
                                    <th className="p-3">Roll No / ID</th>
                                    <th className="p-3">Student Name</th>
                                    <th className="p-3">Dept &amp; Class</th>
                                    <th className="p-3">Academic Marks</th>
                                    <th className="p-3">Group / Medium</th>
                                    <th className="p-3">Contact</th>
                                    <th className="p-3">Social Profiles</th>
                                    <th className="p-3 text-center">Action</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 bg-white text-slate-700">
                                  {filtered.map(st => (
                                    <tr key={st.id} className="hover:bg-indigo-50/20 transition-colors">
                                      <td className="p-3 font-mono font-bold text-indigo-700">
                                        {st.roll_number || st.id}
                                      </td>
                                      <td className="p-3">
                                        <div className="font-bold text-slate-900">{st.name}</div>
                                        <div className="text-[10px] text-slate-400 font-normal truncate max-w-[160px]">{st.email}</div>
                                      </td>
                                      <td className="p-3">
                                        <div className="font-bold text-slate-800">{st.department || "General"}</div>
                                        <div className="text-[10px] text-indigo-600 font-semibold">{st.classGroup}</div>
                                      </td>
                                      <td className="p-3">
                                        <div className="flex items-center gap-1.5 flex-wrap text-[10px]">
                                          <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-bold" title="10th Mark">10th: {st.tenth_mark || "—"}%</span>
                                          <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-bold" title="11th Mark">11th: {st.eleventh_mark || "—"}%</span>
                                          <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-bold" title="12th Mark">12th: {st.twelfth_mark || "—"}%</span>
                                        </div>
                                      </td>
                                      <td className="p-3">
                                        <div className="text-slate-800 font-bold">{st.academic_group || "—"}</div>
                                        <div className="text-[10px] text-slate-400">{st.medium || "—"} medium</div>
                                      </td>
                                      <td className="p-3 text-[11px]">
                                        <div className="text-slate-800 font-semibold">{st.phone || "—"}</div>
                                        {st.parent_phone && <div className="text-[9.5px] text-emerald-600 font-medium">WhatsApp: {st.parent_phone}</div>}
                                      </td>
                                      <td className="p-3">
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                          {st.linkedin_link && (
                                            <a href={st.linkedin_link} target="_blank" rel="noreferrer" className="p-1 rounded bg-blue-50 text-blue-600 hover:bg-blue-100 text-[10px] font-bold">LinkedIn</a>
                                          )}
                                          {st.github_id && (
                                            <a href={st.github_id.startsWith("http") ? st.github_id : `https://github.com/${st.github_id}`} target="_blank" rel="noreferrer" className="p-1 rounded bg-slate-100 text-slate-800 hover:bg-slate-200 text-[10px] font-bold">GitHub</a>
                                          )}
                                          {st.hackerrank_link && (
                                            <a href={st.hackerrank_link} target="_blank" rel="noreferrer" className="p-1 rounded bg-emerald-50 text-emerald-600 hover:bg-emerald-100 text-[10px] font-bold">HackerRank</a>
                                          )}
                                          {st.leetcode_link && (
                                            <a href={st.leetcode_link} target="_blank" rel="noreferrer" className="p-1 rounded bg-amber-50 text-amber-600 hover:bg-amber-100 text-[10px] font-bold">LeetCode</a>
                                          )}
                                          {st.figma_link && (
                                            <a href={st.figma_link} target="_blank" rel="noreferrer" className="p-1 rounded bg-purple-50 text-purple-600 hover:bg-purple-100 text-[10px] font-bold">Figma</a>
                                          )}
                                          {!st.linkedin_link && !st.github_id && !st.hackerrank_link && !st.leetcode_link && !st.figma_link && (
                                            <span className="text-[10px] text-slate-350 italic">—</span>
                                          )}
                                        </div>
                                      </td>
                                      <td className="p-3 text-center">
                                        <button
                                          type="button"
                                          onClick={() => setSelectedStudentForDetail(st)}
                                          className="p-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[10.5px] font-extrabold transition-colors cursor-pointer"
                                        >
                                          View Full Profile
                                        </button>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  )}

                  {/* Tab 9: My Profile */}
                  {activeTab === "profile" && currentCAM && (
                    <div className="space-y-6 font-sans">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Profile Summary Card */}
                        <div className="bg-pastel-cream p-7 rounded-dribbble-panel border-transparent shadow-sm flex flex-col items-center justify-between text-center min-h-[300px] group hover:shadow-md transition-all duration-300">
                          <div className="flex flex-col items-center space-y-4 w-full">
                            <div className="h-20 w-20 rounded-full bg-indigo-650 border-4 border-white text-white flex items-center justify-center text-3xl font-black shadow-md uppercase">
                              {currentCAM.name.substring(0, 2)}
                            </div>
                            <div>
                              <h2 className="text-lg font-extrabold text-slate-900 leading-tight">{currentCAM.name}</h2>
                              <p className="text-[10px] text-slate-455 font-bold uppercase tracking-wider mt-1">Campus Manager (CM)</p>
                            </div>
                            <div className="flex flex-wrap justify-center gap-1.5 pt-1">
                              <span className="px-2 py-0.5 rounded bg-white/80 border border-slate-150 text-[9px] font-black text-slate-700 uppercase">
                                {activeCollegeName}
                              </span>
                            </div>
                          </div>
                          
                          <div className="w-full border-t border-slate-155/60 pt-4 mt-4 text-left space-y-2">
                            <div className="flex justify-between text-[11px] font-bold">
                              <span className="text-slate-455">Manager ID</span>
                              <span className="text-slate-800 font-mono">{currentCAM.id}</span>
                            </div>
                            <div className="flex justify-between text-[11px] font-bold">
                              <span className="text-slate-455">Primary Email</span>
                              <span className="text-slate-800 truncate max-w-[170px]" title={currentCAM.email}>{currentCAM.email}</span>
                            </div>
                          </div>
                        </div>

                        {/* Campus Assignment Details Card */}
                        <div className="md:col-span-2 bg-white p-7 rounded-dribbble-panel border border-slate-100 shadow-sm space-y-6 flex flex-col justify-between">
                          <div>
                            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Campus & Operations Jurisdiction</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                              <div className="space-y-1">
                                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Assigned Campus</span>
                                <span className="text-sm font-extrabold text-slate-800 block leading-snug">
                                  {activeCollegeName}
                                </span>
                                <span className="text-[10px] text-slate-455 font-semibold block">Campus Operations Administrator</span>
                              </div>

                              <div className="space-y-1">
                                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Campus ID Reference</span>
                                <span className="text-sm font-extrabold text-slate-800 block">
                                  {activeCollegeId === "college_1" ? "college_1 (Aided)" : "college_2 (Self-Financed)"}
                                </span>
                                <span className="text-[10px] text-slate-455 font-semibold block">SDNB Vaishnav College Ecosystem</span>
                              </div>

                              <div className="space-y-1">
                                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Active Academic Session</span>
                                <span className="text-sm font-extrabold text-slate-800 block">2025 - 2026 (Odd/Even Sem Cycle)</span>
                                <span className="text-[10px] text-slate-455 font-semibold block">Timetable Generation Period</span>
                              </div>

                              <div className="space-y-1">
                                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Role Authority Level</span>
                                <span className="text-sm font-extrabold text-slate-800 block">Campus Operations Manager</span>
                                <span className="text-[10px] text-slate-455 font-semibold block">SLA Compliance & Space Coordinator</span>
                              </div>
                            </div>
                          </div>

                          <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-2xl flex items-center gap-3">
                            <Sparkles className="h-5 w-5 text-indigo-600 shrink-0" />
                            <div className="text-[11px] text-indigo-850 font-semibold leading-normal">
                              As Campus Manager (CM), you hold authority over campus-wide class allocations, room management, slot conflict resolutions, and compliance auditing for your assigned campus.
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Campus Portfolio Statistics */}
                      <div className="bg-pastel-blue p-7 rounded-dribbble-panel border-transparent shadow-sm space-y-6">
                        <h3 className="text-xs font-black text-slate-555 uppercase tracking-widest font-sans">Campus Portfolio Metrics</h3>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 text-center">
                          <div className="p-4 bg-white/80 rounded-2xl border border-slate-100/40">
                            <span className="text-3xl font-extrabold text-slate-900">
                              {mentors.filter(m => m.college_id === activeCollegeId || (!m.college_id && activeCollegeId === "college_1")).length}
                            </span>
                            <span className="text-[9px] text-slate-455 font-extrabold uppercase tracking-wider block mt-1">Campus Faculty</span>
                          </div>
                          <div className="p-4 bg-white/80 rounded-2xl border border-slate-100/40">
                            <span className="text-3xl font-extrabold text-slate-900">
                              {students.filter(s => s.college_id === activeCollegeId || (!s.college_id && activeCollegeId === "college_1")).length}
                            </span>
                            <span className="text-[9px] text-slate-455 font-extrabold uppercase tracking-wider block mt-1">Active Students</span>
                          </div>
                          <div className="p-4 bg-white/80 rounded-2xl border border-slate-100/40">
                            <span className="text-3xl font-extrabold text-slate-900">
                              {coursesList.filter(c => c.college_id === activeCollegeId || (!c.college_id && activeCollegeId === "college_1")).length}
                            </span>
                            <span className="text-[9px] text-slate-455 font-extrabold uppercase tracking-wider block mt-1">Active Courses</span>
                          </div>
                          <div className="p-4 bg-white/80 rounded-2xl border border-slate-105/40">
                            <span className="text-3xl font-extrabold text-slate-900">
                              {slots.filter(s => mentors.some(m => m.id === s.mentorId && (m.college_id === activeCollegeId || (!m.college_id && activeCollegeId === "college_1")))).length}
                            </span>
                            <span className="text-[9px] text-slate-455 font-extrabold uppercase tracking-wider block mt-1">Timetable Slots</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                </div>
              </main>

              {/*  Workload Configuration Modal */}
              {editingFacultyId && (() => {
                const staff = collegeMentors.find(m => m.id === editingFacultyId);
                return (
                  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs font-sans">
                    <div className="bg-white rounded-3xl border border-slate-200 shadow-xl max-w-md w-full p-6 space-y-4 animate-in fade-in duration-150">
                      <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                        <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                          Configure Faculty Shift
                        </h3>
                        <button
                          type="button"
                          onClick={() => setEditingFacultyId(null)}
                          className="text-slate-400 hover:text-slate-655 font-black text-lg cursor-pointer transition-colors"
                        >
                          ×
                        </button>
                      </div>

                      <div className="space-y-4 text-xs font-semibold">
                        <p className="font-bold text-slate-800 text-[12px] pb-1 border-b">
                          Staff Member: <span className="text-indigo-655 font-black">{staff?.name}</span>
                        </p>
                        
                        <div className="space-y-3">
                          <Select
                            label="Shift Pattern"
                            value={editingShiftVal}
                            onChange={e => setEditingShiftVal(e.target.value)}
                            options={[
                              { value: "general", label: "General Shift" },
                              { value: "shift_1", label: "Shift I (Morning)" },
                              { value: "shift_2", label: "Shift II (Afternoon)" }
                            ]}
                          />
                        </div>

                        <div className="flex gap-2 pt-2">
                          <Button
                            variant="success"
                            size="md"
                            onClick={() => handleSaveFacultyConfig(editingFacultyId)}
                            className="flex-1"
                          >
                            Save Configuration
                          </Button>
                          <Button
                            variant="secondary"
                            size="md"
                            onClick={() => setEditingFacultyId(null)}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* ── Mentor Details & Subject Mapping CRUD Modal ── */}
              {showMentorModal && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                  <div className="bg-white rounded-3xl border border-slate-205 shadow-xl max-w-lg w-full overflow-hidden animate-slideUp font-sans">
                    <div className="flex justify-between items-center p-6 border-b border-slate-100 bg-slate-50">
                      <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-1.5">
                        <Users className="h-5 w-5 text-indigo-650" />
                        {editingMentor ? "Edit Faculty Mentor" : "Add Faculty Mentor"}
                      </h3>
                      <button onClick={() => setShowMentorModal(false)} className="p-1 hover:bg-slate-250 rounded-lg transition-colors cursor-pointer text-slate-500 hover:text-slate-800">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    
                    <form onSubmit={handleMentorSubmit} className="p-6 space-y-3.5 text-xs font-semibold max-h-[80vh] overflow-y-auto">
                      {modalError && (
                        <div className="p-3 bg-rose-50 border border-rose-150 rounded-xl text-rose-700 font-bold flex items-center gap-1.5">
                          <AlertTriangle className="h-4 w-4 shrink-0" />
                          {modalError}
                        </div>
                      )}

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                        <div className="space-y-1">
                          <label className="text-[10px] text-slate-400 uppercase tracking-wider block">Mentor ID</label>
                          <input
                            type="text"
                            required
                            placeholder="e.g. m35"
                            disabled={editingMentor}
                            value={mentorForm.id}
                            onChange={(e) => setMentorForm({ ...mentorForm, id: e.target.value })}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 font-bold focus:outline-none focus:ring-1 focus:ring-indigo-650 disabled:bg-slate-100 disabled:text-slate-400"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] text-slate-400 uppercase tracking-wider block">Initials / Avatar</label>
                          <input
                            type="text"
                            placeholder="e.g. MS (Leave blank to auto-generate)"
                            value={mentorForm.avatar}
                            onChange={(e) => setMentorForm({ ...mentorForm, avatar: e.target.value })}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 font-bold focus:outline-none focus:ring-1 focus:ring-indigo-650"
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] text-slate-400 uppercase tracking-wider block">Full Name</label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. Dr. Alice Smith"
                          value={mentorForm.name}
                          onChange={(e) => setMentorForm({ ...mentorForm, name: e.target.value })}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 font-bold focus:outline-none focus:ring-1 focus:ring-indigo-650"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] text-slate-400 uppercase tracking-wider block">Email Address</label>
                        <input
                          type="email"
                          required
                          placeholder="e.g. alice.smith@university.edu"
                          value={mentorForm.email}
                          onChange={(e) => setMentorForm({ ...mentorForm, email: e.target.value })}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 font-bold focus:outline-none focus:ring-1 focus:ring-indigo-650"
                        />
                      </div>

                       <div className="space-y-1">
                        <label className="text-[10px] text-slate-400 uppercase tracking-wider block">Shift Assignment</label>
                        <select
                          required
                          value={mentorForm.shift}
                          onChange={(e) => setMentorForm({ ...mentorForm, shift: e.target.value as any })}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 font-bold focus:outline-none focus:ring-1 focus:ring-indigo-650 cursor-pointer"
                        >
                          <option value="general">General Shift</option>
                          <option value="shift_1">Shift 1</option>
                          <option value="shift_2">Shift 2</option>
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] text-slate-400 uppercase tracking-wider block">Subject Group / Category</label>
                        <select
                          required
                          value={mentorForm.subject_group}
                          onChange={(e) => setMentorForm({ ...mentorForm, subject_group: e.target.value })}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 font-bold focus:outline-none focus:ring-1 focus:ring-indigo-650 cursor-pointer text-slate-800"
                        >
                          {subjectGroups.map(sg => (
                            <option key={sg.id} value={sg.name}>{sg.name}</option>
                          ))}
                        </select>
                      </div>

                      {/* Subject Mapping Checklist */}
                      <div className="space-y-1">
                        <label className="text-[10px] text-slate-400 uppercase tracking-wider block">Map Subjects to Mentor</label>
                        <div className="relative mb-1.5">
                          <Search className="absolute left-2.5 top-1.5 h-3.5 w-3.5 text-slate-400" />
                          <input
                            type="text"
                            placeholder="Search subject catalog..."
                            value={mentorSubjectSearch}
                            onChange={(e) => setMentorSubjectSearch(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-3 py-1.5 text-[10px] focus:outline-none focus:ring-1 focus:ring-indigo-650 font-bold"
                          />
                        </div>
                        
                        <div className="border border-slate-150 rounded-xl bg-slate-50 p-3.5 max-h-36 overflow-y-auto space-y-1.5 text-[11px] font-bold">
                          {(() => {
                            const searched = (subjectsList || []).filter(s => {
                              if (s.college_id && s.college_id !== activeCollegeId) return false;

                              const matchesSearch = s.name.toLowerCase().includes(mentorSubjectSearch.toLowerCase()) ||
                                                    s.department.toLowerCase().includes(mentorSubjectSearch.toLowerCase());
                              
                              if (!mentorSubjectSearch) {
                                const mSubGroup = (mentorForm.subject_group || "").toLowerCase().trim();
                                const mDept = (mentorForm.department || "").toLowerCase().trim();
                                const sSubGroup = (s.subject_group || "").toLowerCase().trim();

                                if (mSubGroup && sSubGroup) {
                                  // Map CS / Technical
                                  const isMTech = mSubGroup === "technical" || mDept === "computer science" || mDept === "data science";
                                  const isSTech = sSubGroup === "technical";
                                  if (isMTech && isSTech) return true;

                                  // Map Maths / Aptitude
                                  const isMApt = mSubGroup === "aptitude" || mDept === "maths / aptitude" || mDept === "aptitude";
                                  const isSApt = sSubGroup === "aptitude";
                                  if (isMApt && isSApt) return true;

                                  // Direct match
                                  if (sSubGroup === mSubGroup || sSubGroup === mDept) return true;
                                }
                                return s.department.toLowerCase() === mDept;
                              }
                              return matchesSearch;
                            });

                            const currentCheckedList = mentorForm.subjects.split("\n").map(s => s.trim()).filter(Boolean);

                            return (
                              <>
                                {searched.map(s => {
                                  const isChecked = currentCheckedList.includes(s.name);
                                  return (
                                    <label key={s.id} className="flex items-start gap-2 py-1 px-1.5 hover:bg-white rounded cursor-pointer transition-colors text-slate-700">
                                      <input
                                        type="checkbox"
                                        checked={isChecked}
                                        onChange={(e) => {
                                          let newList;
                                          if (e.target.checked) {
                                            newList = [...currentCheckedList, s.name];
                                          } else {
                                            newList = currentCheckedList.filter(item => item !== s.name);
                                          }
                                          setMentorForm({ ...mentorForm, subjects: newList.join("\n") });
                                        }}
                                        className="rounded text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5 cursor-pointer mt-0.5"
                                      />
                                      <div className="leading-tight">
                                        <span className="font-bold text-slate-800">{s.name}</span>
                                        <span className="text-[9px] text-slate-400 block font-semibold">{s.department} • {s.semester}</span>
                                      </div>
                                    </label>
                                  );
                                })}
                                {searched.length === 0 && (
                                  <div className="text-center text-slate-400 italic py-2">
                                    No subjects found.
                                  </div>
                                )}
                              </>
                            );
                          })()}
                        </div>
                      </div>

                      <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                        <button
                          type="button"
                          onClick={() => setShowMentorModal(false)}
                          className="px-4 py-2 hover:bg-slate-100 text-slate-550 rounded-xl transition-all font-bold cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className="btn-gradient px-5 py-2 text-white rounded-xl shadow-sm transition-all font-bold cursor-pointer"
                        >
                          {editingMentor ? "Save Changes" : "Create Mentor"}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

              {/*  Emergency Substitution Modal */}
              {showSubstitutionModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs font-sans">
                  <div className="bg-white rounded-3xl border border-slate-200 shadow-xl max-w-md w-full p-6 space-y-4 animate-in fade-in duration-150">
                    <div className="flex justify-between items-center border-b border-slate-105 pb-3">
                      <h3 className="text-xs font-black text-slate-805 uppercase tracking-wider">
                        Emergency Faculty Substitution
                      </h3>
                      <button
                        type="button"
                        onClick={() => setShowSubstitutionModal(false)}
                        className="text-slate-400 hover:text-slate-655 font-bold text-lg cursor-pointer transition-colors"
                      >
                        ×
                      </button>
                    </div>

                    <form 
                      onSubmit={(e) => { 
                        e.preventDefault(); 
                        toast("Emergency Substitution deployed successfully.", "success"); 
                        setShowSubstitutionModal(false); 
                      }} 
                      className="space-y-4 text-xs font-semibold"
                    >
                      <Input label="Target Date" type="date" required />
                      
                      <div className="space-y-1">
                        <label className="text-slate-455 text-[10px] uppercase font-bold block mb-1">Period Slot to Cover</label>
                        <select className="w-full p-2.5 border border-slate-200 rounded-xl bg-white text-xs cursor-pointer outline-none font-bold shadow-sm">
                          {slots.filter(s => mentors.find(m => m.id === s.mentorId)?.college_id === activeCollegeId).slice(0, 10).map(s => (
                            <option key={s.id} value={s.id}>{s.day} • {s.time} ({s.course})</option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-slate-455 text-[10px] uppercase font-bold block mb-1">Deploy Cover Instructor</label>
                        <select className="w-full p-2.5 border border-slate-200 rounded-xl bg-white text-xs cursor-pointer outline-none font-bold shadow-sm">
                          {collegeMentors.map(m => (
                            <option key={m.id} value={m.id}>{m.name}</option>
                          ))}
                        </select>
                      </div>

                      <div className="flex gap-2 pt-2">
                        <Button type="submit" variant="primary" size="md" className="flex-grow">
                          Deploy Replacement Staff
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          size="md"
                          onClick={() => setShowSubstitutionModal(false)}
                        >
                          Cancel
                        </Button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

              {/* Attendance Correction Modal */}
              {correctingStudent && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs font-sans">
                  <div className="bg-white rounded-3xl border border-slate-200 shadow-xl max-w-md w-full p-6 space-y-4 animate-in fade-in duration-150">
                    <div className="flex justify-between items-center border-b border-slate-105 pb-3">
                      <div className="leading-tight">
                        <h3 className="text-xs font-black text-slate-805 uppercase tracking-wider">
                          Correct Attendance Record
                        </h3>
                        <p className="text-[10px] text-slate-400 font-bold mt-0.5">{correctingStudent.name} ({correctingStudent.id})</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setCorrectingStudent(null)}
                        className="text-slate-405 hover:text-slate-655 font-bold text-lg cursor-pointer transition-colors"
                      >
                        ×
                      </button>
                    </div>

                    <form onSubmit={handleSaveCorrection} className="space-y-4 text-xs font-semibold">
                      {/* Check limit count */}
                      {studentCorrectionCount >= 2 ? (
                        <div className="p-3.5 bg-rose-50 border border-rose-150 text-rose-800 text-[10.5px] rounded-2xl font-bold flex flex-col gap-2.5 shadow-xs">
                          <div className="flex items-center gap-2 text-rose-700">
                            <AlertCircle className="h-4.5 w-4.5 text-rose-650 shrink-0" />
                            <span className="font-extrabold uppercase tracking-wider text-[9px] bg-rose-100 border border-rose-200 px-2 py-0.5 rounded-md">Limit Reached</span>
                          </div>
                          <p className="text-slate-800 font-extrabold text-xs">
                            Student has {studentCorrectionCount} corrections logged (limit 2 reached).
                          </p>
                          <p className="text-slate-500 font-semibold leading-normal">
                            Campus Managers are locked from making further changes for this student. To request additional corrections, please contact the Administrator for an override.
                          </p>
                        </div>
                      ) : (
                        <div className="p-2.5 bg-blue-50 border border-blue-105 text-blue-800 rounded-xl flex items-center gap-2 text-[10px]">
                          <AlertCircle className="h-4 w-4 text-blue-500 shrink-0" />
                          <span>Student has {studentCorrectionCount}/2 corrections logged. Every correction is audited.</span>
                        </div>
                      )}

                      <div className="space-y-1">
                        <label className="text-slate-455 text-[10px] uppercase font-bold block mb-1">Select Session to Correct</label>
                        {studentAttendanceLogs.length === 0 ? (
                          <div className="p-4 bg-slate-55 border border-slate-150 rounded-xl text-center text-slate-400 italic">
                            No attendance history records found for this student.
                          </div>
                        ) : (
                          <select
                            required
                            value={correctionSlotId ? `${correctionSlotId}|${correctionDateStr}` : ""}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (!val) {
                                setCorrectionSlotId("");
                                setCorrectionDateStr("");
                                return;
                              }
                              const [slotId, dateStr] = val.split("|");
                              setCorrectionSlotId(slotId);
                              setCorrectionDateStr(dateStr);
                              const record = studentAttendanceLogs.find(r => r.slotId === slotId && r.dateStr === dateStr);
                              if (record) {
                                setCorrectionNewStatus(record.status);
                              }
                            }}
                            className="w-full p-2.5 border border-slate-200 rounded-xl bg-white text-xs cursor-pointer outline-none font-bold shadow-sm"
                          >
                            <option value="">-- Choose Class Period --</option>
                            {studentAttendanceLogs.map((log, idx) => (
                              <option key={idx} value={`${log.slotId}|${log.dateStr}`}>
                                {log.dateStr} • {log.course} ({log.timeSlot}) — Current: {log.status.toUpperCase()}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>

                      {correctionSlotId && (
                        <div className="space-y-4 pt-1 animate-in fade-in duration-100">
                          {/* New Status Select buttons */}
                          <div className="space-y-1">
                            <label className="text-slate-455 text-[10px] uppercase font-bold block mb-1">Select New Status</label>
                            <div className="flex gap-2">
                              {[
                                { key: "present", label: "Present", color: "bg-emerald-50 border-emerald-250 text-emerald-700 hover:bg-emerald-100", activeColor: "bg-emerald-500 border-emerald-600 text-white" },
                                { key: "absent", label: "Absent", color: "bg-rose-50 border-rose-250 text-rose-700 hover:bg-rose-100", activeColor: "bg-rose-500 border-rose-600 text-white" },
                                { key: "od", label: "OD (On Duty)", color: "bg-blue-50 border-blue-250 text-blue-700 hover:bg-blue-100", activeColor: "bg-blue-500 border-blue-600 text-white" }
                              ].map(btn => {
                                const isActive = correctionNewStatus === btn.key;
                                return (
                                  <button
                                    key={btn.key}
                                    type="button"
                                    onClick={() => setCorrectionNewStatus(btn.key as any)}
                                    className={`flex-1 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all border ${
                                      isActive ? btn.activeColor : btn.color
                                    } cursor-pointer`}
                                  >
                                    {btn.label}
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          {/* Mandatory Reason */}
                          <div className="space-y-1">
                            <label className="text-slate-455 text-[10px] uppercase font-bold block mb-1">Reason for Correction (Mandatory)</label>
                            <textarea
                              required
                              rows={3}
                              placeholder="Enter the justification (e.g. OD letter verified, biometric fallback, late check-in approved)..."
                              value={correctionReason}
                              onChange={(e) => setCorrectionReason(e.target.value)}
                              className="w-full p-2.5 border border-slate-200 rounded-xl bg-white text-xs outline-none font-semibold shadow-sm focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                            />
                          </div>
                        </div>
                      )}

                      <div className="flex gap-2 pt-2 border-t border-slate-100">
                        <button
                          type="button"
                          onClick={() => setCorrectingStudent(null)}
                          className="flex-1 py-2.5 hover:bg-slate-100 text-slate-555 rounded-xl transition-all font-bold cursor-pointer text-center"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={isCorrectionSubmitting || !correctionSlotId || (studentCorrectionCount >= 2 && !isAdminOverride)}
                          className={`flex-grow py-2.5 text-white rounded-xl shadow-sm transition-all font-bold cursor-pointer text-center border border-indigo-650 ${
                            isCorrectionSubmitting || !correctionSlotId || (studentCorrectionCount >= 2 && !isAdminOverride)
                              ? "bg-slate-300 border-slate-300 text-slate-400 cursor-not-allowed"
                              : "btn-gradient hover:opacity-95"
                          }`}
                        >
                          {isCorrectionSubmitting ? "Saving..." : "Apply Correction"}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

              {/* Excel Import Preview Modal */}
              {showImportModal && importPreview && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs font-sans">
                  <div className="bg-white rounded-3xl border border-slate-200 shadow-xl max-w-2xl w-full p-6 space-y-4 animate-in fade-in duration-150 max-h-[90vh] flex flex-col">
                    <div className="flex justify-between items-center border-b border-slate-100 pb-3 shrink-0">
                      <div>
                        <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">
                          Excel Timetable Import Preview
                        </h3>
                        <p className="text-[10px] text-slate-400 font-bold mt-0.5">
                          Cohort: {importPreview.targetClassGroup || viewerClassGroup} | Shift: {importPreview.targetShift === "shift_1" ? "Shift 1" : importPreview.targetShift === "shift_2" ? "Shift 2" : "General"}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setShowImportModal(false);
                          setImportPreview(null);
                        }}
                        className="text-slate-405 hover:text-slate-655 font-bold text-lg cursor-pointer transition-colors"
                      >
                        ×
                      </button>
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-4 pr-1 text-xs font-semibold">
                      {/* Summary box */}
                      <div className="grid grid-cols-2 gap-3 shrink-0">
                        <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-2xl flex flex-col gap-1 shadow-xs">
                          <span className="text-[10px] uppercase font-bold text-emerald-700 tracking-wider">Parsed Slots</span>
                          <span className="text-xl font-extrabold text-emerald-800">{importPreview.slots.length}</span>
                          <span className="text-[10px] text-emerald-600">Ready to import and publish</span>
                        </div>
                        <div className={`p-3 rounded-2xl border flex flex-col gap-1 shadow-xs ${
                          importPreview.warnings.length > 0 ? "bg-amber-50 border-amber-100" : "bg-slate-50 border-slate-100"
                        }`}>
                          <span className={`text-[10px] uppercase font-bold tracking-wider ${
                            importPreview.warnings.length > 0 ? "text-amber-700" : "text-slate-500"
                          }`}>Warnings & Clashes</span>
                          <span className={`text-xl font-extrabold ${
                            importPreview.warnings.length > 0 ? "text-amber-850" : "text-slate-600"
                          }`}>{importPreview.warnings.length}</span>
                          <span className={`text-[10px] ${
                            importPreview.warnings.length > 0 ? "text-amber-600" : "text-slate-400"
                          }`}>Issues requiring your attention</span>
                        </div>
                      </div>

                      {/* Warnings List */}
                      {importPreview.warnings.length > 0 && (
                        <div className="space-y-2 border border-slate-205 rounded-2xl p-4 bg-slate-50/50">
                          <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5 mb-2">
                            <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                            Validation Issues Log
                          </h4>
                          <div className="max-h-[25vh] overflow-y-auto space-y-2 divide-y divide-slate-100 pr-1">
                            {importPreview.warnings.map((w, idx) => (
                              <div key={idx} className="flex flex-col gap-1 pt-2 first:pt-0">
                                <div className="flex items-center justify-between text-[9px] font-bold uppercase tracking-wider text-slate-400">
                                  <span>{w.day} • {w.period}</span>
                                  <span className={`px-1.5 py-0.5 rounded ${
                                    w.type === "clash" ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-800"
                                  }`}>{w.type === "clash" ? "Clash" : "Format Error"}</span>
                                </div>
                                <p className="text-[11px] text-slate-700 font-extrabold leading-snug">{w.message}</p>
                                <span className="text-[9px] font-mono text-slate-400">Cell Value: "{w.cell}"</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Instruction Note */}
                      <div className="p-3.5 bg-blue-50 border border-blue-100 text-blue-800 rounded-2xl flex items-start gap-2.5 shadow-xs">
                        <AlertCircle className="h-4.5 w-4.5 text-blue-500 shrink-0 mt-0.5" />
                        <div className="space-y-1">
                          <p className="font-extrabold text-[11px]">Replacing Old Timetable</p>
                          <p className="text-slate-500 text-[10.5px] font-medium leading-normal">
                            Committing this schedule will **permanently delete** all existing slots for "{viewerClassGroup}". Clashing slots listed above will still be written to the database unless fixed, causing overlap flags on dashboards.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-4 border-t border-slate-100 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setShowImportModal(false);
                          setImportPreview(null);
                        }}
                        className="px-4 py-2 hover:bg-slate-100 text-slate-550 rounded-xl transition-all font-bold cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleConfirmImport}
                        disabled={isImportSubmitting || importPreview.slots.length === 0}
                        className={`px-5 py-2 text-white rounded-xl shadow-sm transition-all font-bold cursor-pointer border border-indigo-650 ${
                          isImportSubmitting || importPreview.slots.length === 0
                            ? "bg-slate-300 border-slate-300 text-slate-400 cursor-not-allowed"
                            : "btn-gradient hover:opacity-95 active:scale-95"
                        }`}
                      >
                        {isImportSubmitting ? "Importing..." : "Commit Schedule"}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Excel Student Import Preview Modal */}
              {showStudentImportModal && studentImportPreview && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs font-sans">
                  <div className="bg-white rounded-3xl border border-slate-200 shadow-xl max-w-4xl w-full p-6 space-y-4 animate-in fade-in duration-150 max-h-[90vh] flex flex-col">
                    <div className="flex justify-between items-center border-b border-slate-100 pb-3 shrink-0">
                      <div>
                        <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">
                          Excel Student Import Preview
                        </h3>
                        <p className="text-[10px] text-slate-400 font-bold mt-0.5">
                          Mapped {studentImportPreview.parsed.length} student records from spreadsheet
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setShowStudentImportModal(false);
                          setStudentImportPreview(null);
                        }}
                        className="text-slate-400 hover:text-slate-600 font-bold text-lg cursor-pointer transition-colors"
                      >
                        ×
                      </button>
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-4 pr-1 text-xs font-semibold">
                      {/* Controls bar */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 shrink-0">
                        <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-2xl flex flex-col gap-1 shadow-xs">
                          <span className="text-[10px] uppercase font-bold text-indigo-700 tracking-wider">Parsed Students</span>
                          <span className="text-xl font-extrabold text-indigo-850">{studentImportPreview.parsed.length}</span>
                          <span className="text-[10px] text-indigo-600">Ready to save to SQLite database</span>
                        </div>

                        <div className={`p-3 rounded-2xl border flex flex-col gap-1 shadow-xs ${
                          studentImportPreview.warnings.length > 0 ? "bg-amber-50 border-amber-100" : "bg-slate-50 border-slate-100"
                        }`}>
                          <span className={`text-[10px] uppercase font-bold tracking-wider ${
                            studentImportPreview.warnings.length > 0 ? "text-amber-700" : "text-slate-500"
                          }`}>Validation Warnings</span>
                          <span className={`text-xl font-extrabold ${
                            studentImportPreview.warnings.length > 0 ? "text-amber-850" : "text-slate-600"
                          }`}>{studentImportPreview.warnings.length}</span>
                          <span className={`text-[10px] ${
                            studentImportPreview.warnings.length > 0 ? "text-amber-600" : "text-slate-400"
                          }`}>Rows with missing names or roll numbers</span>
                        </div>

                        <div className="p-3 bg-white border border-slate-200 rounded-2xl flex flex-col justify-center gap-1.5 shadow-xs sm:col-span-1">
                          <label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block">Target Class Cohort</label>
                          {(() => {
                            const campusDeptNames = coursesList.filter(c => c.college_id === activeCollegeId).map(c => c.name);
                            const deptOptions = campusDeptNames.length > 0 ? campusDeptNames : FACULTY_DEPARTMENTS;
                            const shiftOptions = ["Shift 1", "Shift 2", "General"];
                            const semOptions = ["Semester 1", "Semester 2", "Semester 3", "Semester 4", "Semester 5", "Semester 6"];
                            // Parse existing targetClassGroup into parts
                            const current = studentImportPreview.targetClassGroup || "";
                            const updateCohort = (dept: string, shift: string, sem: string) => {
                              setStudentImportPreview({ ...studentImportPreview, targetClassGroup: `${dept} - ${shift} - ${sem}` });
                            };
                            // Detect current parts
                            const currentShift = shiftOptions.find(s => current.includes(s)) || "Shift 1";
                            const currentSem = semOptions.find(s => current.includes(s)) || "Semester 1";
                            const currentDept = deptOptions.find(d => current.startsWith(d)) || deptOptions[0] || "Computer Science";
                            return (
                              <div className="flex flex-col gap-1">
                                <select
                                  value={currentDept}
                                  onChange={(e) => updateCohort(e.target.value, currentShift, currentSem)}
                                  className="w-full text-[11px] font-bold px-2 py-1.5 rounded-lg border border-slate-200 bg-slate-50 outline-none cursor-pointer"
                                >
                                  {deptOptions.map(d => <option key={d} value={d}>{d}</option>)}
                                </select>
                                <div className="flex gap-1">
                                  <select
                                    value={currentShift}
                                    onChange={(e) => updateCohort(currentDept, e.target.value, currentSem)}
                                    className="flex-1 text-[11px] font-bold px-2 py-1.5 rounded-lg border border-slate-200 bg-slate-50 outline-none cursor-pointer"
                                  >
                                    {shiftOptions.map(s => <option key={s} value={s}>{s}</option>)}
                                  </select>
                                  <select
                                    value={currentSem}
                                    onChange={(e) => updateCohort(currentDept, currentShift, e.target.value)}
                                    className="flex-1 text-[11px] font-bold px-2 py-1.5 rounded-lg border border-slate-200 bg-slate-50 outline-none cursor-pointer"
                                  >
                                    {semOptions.map(s => <option key={s} value={s}>{s}</option>)}
                                  </select>
                                </div>
                                <p className="text-[9px] text-indigo-600 font-bold mt-0.5 truncate">→ {studentImportPreview.targetClassGroup}</p>
                              </div>
                            );
                          })()}
                        </div>
                      </div>

                      {/* Warnings List */}
                      {studentImportPreview.warnings.length > 0 && (
                        <div className="space-y-1.5 border border-amber-200 rounded-2xl p-3.5 bg-amber-50/50">
                          <h4 className="text-[10px] font-black text-amber-800 uppercase tracking-widest flex items-center gap-1.5">
                            <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                            Validation Warning Log ({studentImportPreview.warnings.length})
                          </h4>
                          <div className="max-h-[15vh] overflow-y-auto space-y-1 pr-1 text-[11px] text-amber-900">
                            {studentImportPreview.warnings.map((w, idx) => (
                              <div key={idx} className="font-semibold">{w}</div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Parsed Preview Table */}
                      <div className="space-y-2">
                        <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                          Mapped Student Records Preview
                        </h4>
                        <div className="overflow-x-auto rounded-2xl border border-slate-200 shadow-xs max-h-[35vh]">
                          <table className="w-full border-collapse text-left text-xs font-semibold min-w-[850px]">
                            <thead className="sticky top-0 bg-slate-100 border-b border-slate-200 text-slate-600 font-extrabold uppercase text-[9px] tracking-wider z-10">
                              <tr>
                                <th className="p-2.5">Roll No</th>
                                <th className="p-2.5">Name</th>
                                <th className="p-2.5">Dept</th>
                                <th className="p-2.5">10th %</th>
                                <th className="p-2.5">11th %</th>
                                <th className="p-2.5">12th %</th>
                                <th className="p-2.5">Group</th>
                                <th className="p-2.5">Medium</th>
                                <th className="p-2.5">Blood</th>
                                <th className="p-2.5">Phone</th>
                                <th className="p-2.5">Email</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 bg-white">
                              {studentImportPreview.parsed.map((st, idx) => (
                                <tr key={idx} className="hover:bg-indigo-50/20">
                                  <td className="p-2.5 font-mono font-bold text-indigo-700">{st.roll_number || "—"}</td>
                                  <td className="p-2.5 font-bold text-slate-900">{st.name || "—"}</td>
                                  <td className="p-2.5 text-slate-700">{st.department || "—"}</td>
                                  <td className="p-2.5">{st.tenth_mark ? `${st.tenth_mark}%` : "—"}</td>
                                  <td className="p-2.5">{st.eleventh_mark ? `${st.eleventh_mark}%` : "—"}</td>
                                  <td className="p-2.5">{st.twelfth_mark ? `${st.twelfth_mark}%` : "—"}</td>
                                  <td className="p-2.5 text-slate-800 font-bold">{st.academic_group || "—"}</td>
                                  <td className="p-2.5">{st.medium || "—"}</td>
                                  <td className="p-2.5">{st.blood_group || "—"}</td>
                                  <td className="p-2.5 font-mono text-[11px]">{st.phone || "—"}</td>
                                  <td className="p-2.5 text-[10px] text-slate-500 truncate max-w-[160px]">{st.email || "—"}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-4 border-t border-slate-100 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setShowStudentImportModal(false);
                          setStudentImportPreview(null);
                        }}
                        className="px-4 py-2 hover:bg-slate-100 text-slate-600 rounded-xl transition-all font-bold cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleConfirmStudentImportSubmit}
                        disabled={isStudentImportSubmitting || studentImportPreview.parsed.length === 0}
                        className={`px-5 py-2 text-white rounded-xl shadow-sm transition-all font-bold cursor-pointer border border-indigo-650 ${
                          isStudentImportSubmitting || studentImportPreview.parsed.length === 0
                            ? "bg-slate-300 border-slate-300 text-slate-400 cursor-not-allowed"
                            : "btn-gradient hover:opacity-95 active:scale-95"
                        }`}
                      >
                        {isStudentImportSubmitting ? "Importing Records..." : "Confirm & Import Students"}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Student Full Profile Detail Modal */}
              {selectedStudentForDetail && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs font-sans">
                  <div className="bg-white rounded-3xl border border-slate-200 shadow-xl max-w-2xl w-full p-6 space-y-5 animate-in fade-in duration-150 max-h-[90vh] overflow-y-auto">
                    {/* Header */}
                    <div className="flex justify-between items-start border-b border-slate-100 pb-4">
                      <div className="flex items-center gap-3">
                        <div className="h-12 w-12 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 text-white flex items-center justify-center text-lg font-black shadow-md">
                          {selectedStudentForDetail.name.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <h3 className="text-base font-extrabold text-slate-900 leading-snug">{selectedStudentForDetail.name}</h3>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 uppercase">
                              Roll No: {selectedStudentForDetail.roll_number || selectedStudentForDetail.id}
                            </span>
                            <span className="text-xs font-semibold text-slate-500">{selectedStudentForDetail.classGroup}</span>
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedStudentForDetail(null)}
                        className="text-slate-400 hover:text-slate-600 font-bold text-xl cursor-pointer"
                      >
                        ×
                      </button>
                    </div>

                    {/* Details Sections */}
                    <div className="space-y-4 text-xs">
                      {/* Academic & Class Details */}
                      <div className="bg-slate-50/70 border border-slate-200/80 p-4 rounded-2xl space-y-3">
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Academic Info &amp; Marks</h4>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          <div>
                            <span className="text-[9.5px] text-slate-400 font-bold uppercase block">Department</span>
                            <span className="text-xs font-extrabold text-slate-800">{selectedStudentForDetail.department || "General"}</span>
                          </div>
                          <div>
                            <span className="text-[9.5px] text-slate-400 font-bold uppercase block">Academic Group</span>
                            <span className="text-xs font-extrabold text-slate-800">{selectedStudentForDetail.academic_group || "—"}</span>
                          </div>
                          <div>
                            <span className="text-[9.5px] text-slate-400 font-bold uppercase block">Medium</span>
                            <span className="text-xs font-extrabold text-slate-800">{selectedStudentForDetail.medium || "—"}</span>
                          </div>
                          <div>
                            <span className="text-[9.5px] text-slate-400 font-bold uppercase block">Blood Group</span>
                            <span className="text-xs font-extrabold text-rose-600">{selectedStudentForDetail.blood_group || "—"}</span>
                          </div>

                          <div>
                            <span className="text-[9.5px] text-slate-400 font-bold uppercase block">10th Mark (%)</span>
                            <span className="text-sm font-black text-indigo-600">{selectedStudentForDetail.tenth_mark ? `${selectedStudentForDetail.tenth_mark}%` : "—"}</span>
                          </div>
                          <div>
                            <span className="text-[9.5px] text-slate-400 font-bold uppercase block">11th Mark (%)</span>
                            <span className="text-sm font-black text-indigo-600">{selectedStudentForDetail.eleventh_mark ? `${selectedStudentForDetail.eleventh_mark}%` : "—"}</span>
                          </div>
                          <div>
                            <span className="text-[9.5px] text-slate-400 font-bold uppercase block">12th Mark (%)</span>
                            <span className="text-sm font-black text-indigo-600">{selectedStudentForDetail.twelfth_mark ? `${selectedStudentForDetail.twelfth_mark}%` : "—"}</span>
                          </div>
                          <div>
                            <span className="text-[9.5px] text-slate-400 font-bold uppercase block">Date of Birth</span>
                            <span className="text-xs font-extrabold text-slate-800">{selectedStudentForDetail.dob || "—"}</span>
                          </div>
                        </div>
                      </div>

                      {/* Contact & Identity Details */}
                      <div className="bg-slate-50/70 border border-slate-200/80 p-4 rounded-2xl space-y-3">
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Contact Information &amp; Identity</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <span className="text-[9.5px] text-slate-400 font-bold uppercase block">Student Email</span>
                            <span className="text-xs font-bold text-slate-800 truncate block">{selectedStudentForDetail.email}</span>
                          </div>
                          <div>
                            <span className="text-[9.5px] text-slate-400 font-bold uppercase block">Aadhar Card Number</span>
                            <span className="text-xs font-mono font-bold text-slate-800">{selectedStudentForDetail.aadhar_number || "—"}</span>
                          </div>
                          <div>
                            <span className="text-[9.5px] text-slate-400 font-bold uppercase block">Student Phone Number</span>
                            <span className="text-xs font-bold text-slate-800">{selectedStudentForDetail.phone || "—"}</span>
                          </div>
                          <div>
                            <span className="text-[9.5px] text-slate-400 font-bold uppercase block">Parent Phone Number (WhatsApp)</span>
                            <span className="text-xs font-bold text-emerald-700">{selectedStudentForDetail.parent_phone || "—"}</span>
                          </div>
                        </div>
                      </div>

                      {/* Portfolio & Coding Profiles */}
                      <div className="bg-slate-50/70 border border-slate-200/80 p-4 rounded-2xl space-y-3">
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Social &amp; Development Profiles</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                          <div className="flex items-center justify-between p-2 rounded-xl bg-white border border-slate-200">
                            <span className="font-bold text-slate-600">LinkedIn Profile</span>
                            {selectedStudentForDetail.linkedin_link ? (
                              <a href={selectedStudentForDetail.linkedin_link} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline font-bold text-[11px]">View Link ↗</a>
                            ) : <span className="text-slate-400 text-[10.5px]">Not mapped</span>}
                          </div>
                          <div className="flex items-center justify-between p-2 rounded-xl bg-white border border-slate-200">
                            <span className="font-bold text-slate-600">GitHub Profile</span>
                            {selectedStudentForDetail.github_id ? (
                              <a href={selectedStudentForDetail.github_id.startsWith("http") ? selectedStudentForDetail.github_id : `https://github.com/${selectedStudentForDetail.github_id}`} target="_blank" rel="noreferrer" className="text-slate-800 hover:underline font-bold text-[11px]">View Link ↗</a>
                            ) : <span className="text-slate-400 text-[10.5px]">Not mapped</span>}
                          </div>
                          <div className="flex items-center justify-between p-2 rounded-xl bg-white border border-slate-200">
                            <span className="font-bold text-slate-600">HackerRank Profile</span>
                            {selectedStudentForDetail.hackerrank_link ? (
                              <a href={selectedStudentForDetail.hackerrank_link} target="_blank" rel="noreferrer" className="text-emerald-600 hover:underline font-bold text-[11px]">View Link ↗</a>
                            ) : <span className="text-slate-400 text-[10.5px]">Not mapped</span>}
                          </div>
                          <div className="flex items-center justify-between p-2 rounded-xl bg-white border border-slate-200">
                            <span className="font-bold text-slate-600">LeetCode Profile</span>
                            {selectedStudentForDetail.leetcode_link ? (
                              <a href={selectedStudentForDetail.leetcode_link} target="_blank" rel="noreferrer" className="text-amber-600 hover:underline font-bold text-[11px]">View Link ↗</a>
                            ) : <span className="text-slate-400 text-[10.5px]">Not mapped</span>}
                          </div>
                          <div className="flex items-center justify-between p-2 rounded-xl bg-white border border-slate-200 sm:col-span-2">
                            <span className="font-bold text-slate-600">Figma Profile</span>
                            {selectedStudentForDetail.figma_link ? (
                              <a href={selectedStudentForDetail.figma_link} target="_blank" rel="noreferrer" className="text-purple-600 hover:underline font-bold text-[11px]">View Link ↗</a>
                            ) : <span className="text-slate-400 text-[10.5px]">Not mapped</span>}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-end pt-3 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => setSelectedStudentForDetail(null)}
                        className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
                      >
                        Close Profile
                      </button>
                    </div>
                  </div>
                </div>
              )}

            </div>
          );
};

// Stale cache trigger comment to force IDE diagnostics refresh.

