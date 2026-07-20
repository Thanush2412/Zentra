"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { resolveClassGroupDetailsFromState } from "@/lib/utils";

export interface Mentor {
  id: string;
  name: string;
  email: string;
  role: "mentor";
  department: string;
  avatar: string;
  headerId?: string | null;
  headerName?: string;
  subjects?: string;
  classes?: string;
  shift?: ShiftType;
  college_id?: string;
  subject_group?: string;
}

export interface HeaderUser {
  id: string;
  name: string;
  role: "header";
  title: string;
  department: string;
  email: string;
  college_id?: string;
}

export interface HRUser {
  id: string;
  name: string;
  role: "hr";
  email: string;
}

export interface CampusManager {
  id: string;
  name: string;
  email: string;
  role: "cam";
  college_id: string;
  college_name: string;
  college_address?: string;
  kam_id: string;
  kam_name?: string;
}

export interface KAMUser {
  id: string;
  name: string;
  email: string;
  role: "kam";
  title: string;
}

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: "admin";
}

export interface College {
  id: string;
  name: string;
  address?: string;
  kam_id: string;
  has_shifts?: number;
  dept_count?: number;
  mentor_count?: number;
  slot_count?: number;
  shift_configs?: string;
  rooms?: string;
  working_days?: number;
}

export interface Student {
  id: string;
  name: string;
  email: string;
  role: "student";
  classGroup: string;
  department?: string;
  college_id?: string;
  register_number?: string;
  roll_number?: string;
  tenth_mark?: string;
  eleventh_mark?: string;
  twelfth_mark?: string;
  academic_group?: string;
  medium?: string;
  blood_group?: string;
  dob?: string;
  phone?: string;
  parent_phone?: string;
  aadhar_number?: string;
  linkedin_link?: string;
  github_id?: string;
  project_drive_link?: string;
  hackerrank_link?: string;
  leetcode_link?: string;
  figma_link?: string;
}

export interface StudentAttendance {
  id: string;
  studentId: string;
  slotId: string;
  dateStr: string;
  status: "present" | "absent" | "od";
  markedBy?: string;
  timestamp: string;
  type?: "Regular" | "Non-Regular";
  mode?: "Online" | "Offline";
  attendanceTypeSub?: string;
}

export interface Holiday {
  id: string;
  title: string;
  date: string;
  type: string;
  college_id: string;
}

export type Role = "mentor" | "hr" | "cam" | "kam" | "admin" | "student" | "fee_manager" | "sme" | "allocator";
export type ShiftType = "shift_1" | "shift_2" | "general";

export interface WeeklyTask {
  id: string;
  class_group: string;
  subject: string;
  week_number: number;
  mentor_id: string;
  task_name: string;
  task_pdf_url?: string;
  created_at?: string;
  updated_at?: string;
}

export interface StudentTrackerEntry {
  id: string;
  student_id: string;
  class_group: string;
  subject: string;
  week_number: number;
  submission_url?: string;
  viva_assessment?: string;
  marks?: number;
  graded_by?: string;
  updated_at?: string;
}

export interface Slot {
  id: string;
  mentorId: string;
  day: string;
  time: string;
  course: string;
  location: string;
  shift: ShiftType;
  classGroup?: string;
  semester?: string;
  year?: string;
  department?: string;
  college_id?: string;
}

export interface HandoverRequest {
  id: string;
  requestorId: string;
  requestorName: string;
  slotId: string;
  course: string;
  day: string;
  time: string;
  dateStr: string;
  dateFormatted: string;
  targetStaffId: string;
  targetStaffName: string;
  reason: string;
  status: "pending" | "pending_cam" | "approved" | "rejected";
  headerReason?: string;
  approvedBy?: string;
  timestamp: string;
  classGroup?: string;
  request_type?: "handover" | "swap_compensate";
  compensates_handover_id?: string;
}

export interface ApprovedHandover {
  requestId: string;
  slotId: string;
  dateStr: string;
  originalMentorId: string;
  coverStaffId: string;
  coverStaffName: string;
  course?: string;
  ledger_month?: string;
}

export interface AuditLog {
  id: string;
  type: "assignment" | "booking" | "handover_request" | "handover_approval" | "handover_rejection" | "csv_upload" | "release";
  description: string;
  actorName: string;
  actorRole: string;
  timestamp: string;
}

export interface Subject {
  id: string;
  department: string;
  semester: string;
  name: string;
  type: string;
  college_id?: string;
  year?: string;
  weekly_hours?: number;
  subject_group?: string;
}

export interface Department {
  id: string;
  name: string;
  college_id?: string;
  code?: string;
  description?: string;
  hod_name?: string;
  established_year?: string;
  status?: string;
  years?: number;
  start_date?: string;
  end_date?: string;
  start_year?: string;
  end_year?: string;
  default_room?: string;
  default_shift?: string;
}

export type Course = Department;

interface WeekDate {
  day: string;
  dateStr: string;
  formatted: string;
}

interface AppContextProps {
  mentors: Mentor[];
  slots: Slot[];
  requests: HandoverRequest[];
  approvedHandovers: ApprovedHandover[];
  auditLogs: AuditLog[];
  subjectsList: Subject[];
  colleges: College[];
  smes: any[];
  demoSessions: any[];
  demoRules: any[];
  demoSwapRequests: any[];
  currentRole: Role;
  currentMentor: Mentor | null;
  currentHR: HRUser | null;
  currentCAM: CampusManager | null;
  currentKAM: KAMUser | null;
  currentAdmin: AdminUser | null;
  currentSME: any | null;
  timeSlots: string[];
  daysOfWeek: string[];
  weekDates: WeekDate[];
  weekOffset: number;
  setWeekOffset: (offset: number) => void;
  isLoading: boolean;
  currentShift: ShiftType;
  setCurrentShift: (shift: ShiftType) => void;
  shiftTimeSlots: Record<ShiftType, string[]>;
  getTimeSlots: (shift: string, semesterOrClassGroup?: string) => string[];
  setRole: (role: Role, userId?: string, extra?: { collegeId?: string }) => void;
  assignSlot: (mentorId: string, day: string, time: string, course: string, location: string, classGroup?: string) => Promise<void>;
  deleteSlot: (slotId: string) => Promise<void>;
  updateSlot: (
    slotId: string,
    mentorId: string,
    day: string,
    time: string,
    course: string,
    location: string,
    classGroup?: string
  ) => Promise<{ success: boolean; message?: string }>;
  requestHandover: (
    mentorId: string,
    slotId: string,
    dateStr: string,
    dateFormatted: string,
    targetStaffId: string,
    reason: string,
    subjectName?: string
  ) => Promise<void>;
  requestSwapCompensate: (
    requestorId: string,
    offerSlotId: string,
    offerDateStr: string,
    offerDateFormatted: string,
    targetStaffId: string,
    compensatesHandoverId?: string,
    reason?: string,
    originalSubject?: string,
    originalMonth?: string
  ) => Promise<{ success: boolean; message: string }>;
  requestBooking: (mentorId: string, day: string, time: string, course: string, location: string, classGroup?: string) => Promise<{ success: boolean; message?: string }>;
  handleRequest: (requestId: string, status: "approved" | "rejected", headerReason?: string, actorRole?: string, course?: string) => Promise<void>;
  cancelRequest: (requestId: string) => Promise<{ success: boolean; message: string }>;
  importCSV: (csvContent: string) => Promise<{ success: boolean; message: string; count: number }>;
  clearAllData: () => Promise<{ success: boolean; message: string }>;
  createMentor: (mentor: Omit<Mentor, "role">) => Promise<{ success: boolean; message: string }>;
  updateMentor: (mentor: Omit<Mentor, "role">) => Promise<{ success: boolean; message: string }>;
  deleteMentor: (id: string) => Promise<{ success: boolean; message: string }>;
  bookDemoSession: (mentorId: string, mentorName: string, smeId: string, smeName: string, dateStr: string, timeSlot: string, subject: string, stream: string, week: number) => Promise<{ success: boolean; message: string }>;
  evaluateDemoSession: (sessionId: string, marks: number, comments: string) => Promise<{ success: boolean; message: string }>;
  correctStudentAttendance: (studentId: string, slotId: string, dateStr: string, newStatus: "present" | "absent" | "od", reason: string, isAdminOverride?: boolean) => Promise<{ success: boolean; message: string }>;
  bulkBookDemoSessions: (sessions: Array<{ mentorId: string; mentorName: string; smeId: string; smeName: string; dateStr: string; timeSlot: string; subject: string; stream: string; week: number }>) => Promise<{ success: boolean; message: string }>;
  updateDemoSession: (sessionId: string, dateStr: string, timeSlot: string, smeId: string, smeName: string) => Promise<{ success: boolean; message: string }>;
  swapDemoSessions: (session1Id: string, session2Id: string) => Promise<{ success: boolean; message: string }>;
  deleteDemoSession: (sessionId: string) => Promise<{ success: boolean; message: string }>;
  requestDemoSwap: (payload: any) => Promise<{ success: boolean; message: string }>;
  resolveDemoSwap: (requestId: string, status: "approved" | "rejected" | "pending_sme") => Promise<{ success: boolean; message: string }>;
  createDemoRule: (subject: string, week: number, target: number) => Promise<{ success: boolean; message: string }>;
  deleteDemoRule: (id: string) => Promise<{ success: boolean; message: string }>;
  generateTimetable: (
    classGroup: string, 
    shift: ShiftType, 
    defaultRoom: string,
    allocations?: Array<{
      subjectId: string;
      subjectName: string;
      mentorId: string;
      weeklyHours: number;
      room?: string;
    }>,
    previewOnly?: boolean
  ) => Promise<{ 
    success: boolean; 
    message: string; 
    count?: number; 
    previewSlots?: any[]; 
    unscheduled?: Array<{ subject: string; hours: number }> 
  }>;
  clearTimetable: (classGroup: string) => Promise<{ success: boolean; message: string }>;
  createSubject: (subject: Omit<Subject, "id">) => Promise<{ success: boolean; message: string }>;
  updateSubject: (subject: Subject) => Promise<{ success: boolean; message: string }>;
  deleteSubject: (id: string) => Promise<{ success: boolean; message: string }>;
  createCollege: (college: Omit<College, "dept_count" | "mentor_count" | "slot_count">) => Promise<{ success: boolean; message: string }>;
  updateCollege: (college: Omit<College, "dept_count" | "mentor_count" | "slot_count">) => Promise<{ success: boolean; message: string }>;
  deleteCollege: (id: string) => Promise<{ success: boolean; message: string; deletedCounts?: { mentors: number; students: number; cams: number } }>;
  createKAM: (kam: { id: string; name: string; email: string; title: string }) => Promise<{ success: boolean; message: string }>;
  updateKAM: (kam: { id: string; name: string; email: string; title: string }) => Promise<{ success: boolean; message: string }>;
  deleteKAM: (id: string) => Promise<{ success: boolean; message: string }>;
  createCAM: (cam: { id: string; name: string; email: string; college_id: string; kam_id: string }) => Promise<{ success: boolean; message: string }>;
  updateCAM: (cam: { id: string; name: string; email: string; college_id: string; kam_id: string }) => Promise<{ success: boolean; message: string }>;
  deleteCAM: (id: string) => Promise<{ success: boolean; message: string }>;
  departmentsList: Department[];
  coursesList: Course[];
  createDepartment: (dept: Omit<Department, "id">) => Promise<{ success: boolean; message: string }>;
  createCourse: (course: Omit<Course, "id">) => Promise<{ success: boolean; message: string }>;
  updateDepartment: (dept: Department) => Promise<{ success: boolean; message: string }>;
  updateCourse: (course: Course) => Promise<{ success: boolean; message: string }>;
  deleteDepartment: (id: string) => Promise<{ success: boolean; message: string; deletedCounts?: { slots: number; students: number; mentors: number; subjects: number } }>;
  deleteCourse: (id: string) => Promise<{ success: boolean; message: string; deletedCounts?: { slots: number; students: number; mentors: number; subjects: number } }>;
  refreshData: () => Promise<any>;
  students: Student[];
  studentAttendance: StudentAttendance[];
  currentStudent: Student | null;
  markAttendance: (
    slotId: string, 
    dateStr: string, 
    attendanceData: Array<{ studentId: string; status: "present" | "absent" | "od" | "not_marked" }>, 
    coveredSubject?: string,
    type?: "Regular" | "Non-Regular",
    mode?: "Online" | "Offline",
    attendanceTypeSub?: string
  ) => Promise<{ success: boolean; message: string }>;
  leaveRequests: any[];
  holidays: Holiday[];
  requestLeave: (type: "leave" | "od", dateStr: string, reason: string) => Promise<{ success: boolean; message?: string }>;
  handleLeaveRequest: (requestId: string, status: "approved" | "rejected") => Promise<{ success: boolean; message?: string }>;
  updateStudent: (student: Student) => Promise<{ success: boolean; message: string }>;
  weeklyTasks: WeeklyTask[];
  studentTracker: StudentTrackerEntry[];
  assignWeeklyTask: (taskData: { classGroup: string; subject: string; weekNumber: number; taskName: string; taskPdfUrl?: string; mentorId: string }) => Promise<{ success: boolean; task?: WeeklyTask; message?: string }>;
  gradeStudentTask: (entryData: { studentId: string; classGroup: string; subject: string; weekNumber: number; submissionUrl?: string; vivaAssessment?: string; marks?: number; gradedBy?: string }) => Promise<{ success: boolean; entry?: StudentTrackerEntry; message?: string }>;
  subjectGroups: Array<{ id: string; name: string; description: string }>;
  createSubjectGroup: (name: string, description: string, subjectIds?: string[]) => Promise<{ success: boolean; message: string }>;
  updateSubjectGroup: (id: string, name: string, description: string, subjectIds?: string[]) => Promise<{ success: boolean; message: string }>;
  deleteSubjectGroup: (id: string) => Promise<{ success: boolean; message: string }>;
  updateSmeSubjectGroup: (id: string, subject: string | null) => Promise<{ success: boolean; message: string }>;
  createSmeUser: (id: string, name: string, email: string, subject?: string) => Promise<{ success: boolean; message: string }>;
  updateSmeUser: (id: string, name: string, email: string, subject?: string) => Promise<{ success: boolean; message: string }>;
  deleteSmeUser: (id: string) => Promise<{ success: boolean; message: string }>;
  kamTasks: any[];
  campusIssues: any[];
  academicYears: string[];
  academicEvents: any[];
  facultyWorkloadLimits: { [key: string]: number };
  facultyShifts: { [key: string]: string };
  saveKamTask: (task: any) => Promise<{ success: boolean; task?: any; message?: string }>;
  deleteKamTask: (id: string) => Promise<{ success: boolean; message?: string }>;
  saveCampusIssue: (issue: any) => Promise<{ success: boolean; issue?: any; message?: string }>;
  updateCampusIssueStatus: (id: string, status?: string, resolvedAt?: string, escalated?: boolean, escalatedAt?: string) => Promise<{ success: boolean; message?: string }>;
  deleteCampusIssue: (id: string) => Promise<{ success: boolean; message?: string }>;
  saveAcademicYear: (yearName: string) => Promise<{ success: boolean; message?: string }>;
  deleteAcademicYear: (yearName: string) => Promise<{ success: boolean; message?: string }>;
  saveAcademicEvent: (event: any) => Promise<{ success: boolean; event?: any; message?: string }>;
  deleteAcademicEvent: (id: string) => Promise<{ success: boolean; message?: string }>;
  saveFacultyConfig: (mentorId: string, maxHours: number, shift: string) => Promise<{ success: boolean; message?: string }>;
  signupRequests: any[];
  submitSignupRequest: (reqData: any) => Promise<{ success: boolean; message: string }>;
  approveSignupRequest: (id: string, mappingData: any) => Promise<{ success: boolean; message: string }>;
  rejectSignupRequest: (id: string) => Promise<{ success: boolean; message: string }>;
  deleteSignupRequest: (id: string) => Promise<{ success: boolean; message: string }>;
}

const AppContext = createContext<AppContextProps | undefined>(undefined);

// Helper to get dates of the current week (Monday – Friday or Saturday)
export function getWeekDates(offsetWeeks: number = 0, baseDateStr?: string, workingDaysCount: number = 5): WeekDate[] {
  const dates: WeekDate[] = [];
  const today = baseDateStr ? new Date(baseDateStr) : new Date();
  
  if (baseDateStr) {
    const parts = baseDateStr.split('-');
    if (parts.length === 3) {
      const [y, m, d] = parts.map(Number);
      today.setFullYear(y, m - 1, d);
    }
  }

  today.setDate(today.getDate() + offsetWeeks * 7);
  const currentDay = today.getDay();
  const distanceToMonday = currentDay === 0 ? -6 : 1 - currentDay;
  const monday = new Date(today);
  monday.setDate(today.getDate() + distanceToMonday);

  const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const count = workingDaysCount === 6 ? 6 : 5;
  for (let i = 0; i < count; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    dates.push({
      day: days[i],
      dateStr: d.toISOString().split("T")[0],
      formatted: d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
    });
  }
  return dates;
}

export const SHIFT_TIME_SLOTS: Record<ShiftType, string[]> = {
  shift_1: [
    "8.20 AM - 9.10 AM",
    "9.10 AM - 10.00 AM",
    "10.20 AM - 11.10 AM",
    "11.10 AM - 12.00 PM",
    "12.00 PM - 12.50 PM"
  ],
  shift_2: [
    "1.00 PM - 1.50 PM",
    "1.50 PM - 2.40 PM",
    "3.00 PM - 3.50 PM",
    "3.50 PM - 4.40 PM",
    "4.40 PM - 5.30 PM"
  ],
  general: [
    "9.00 AM - 10.00 AM",
    "10.00 AM - 11.00 AM",
    "11.15 AM - 12.15 PM",
    "12.50 PM - 1.45 PM",
    "1.45 PM - 2.45 PM",
    "3.00 PM - 4.00 PM"
  ]
};

const DAYS_OF_WEEK = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // All data starts empty — populated exclusively from database via API
  const [mentors, setMentors] = useState<Mentor[]>([]);
  const [hrList, setHrList] = useState<HRUser[]>([]);
  const [colleges, setColleges] = useState<College[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [requests, setRequests] = useState<HandoverRequest[]>([]);
  const [approvedHandovers, setApprovedHandovers] = useState<ApprovedHandover[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [subjectsList, setSubjectsList] = useState<Subject[]>([]);
  const [departmentsList, setDepartmentsList] = useState<Department[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [studentAttendance, setStudentAttendance] = useState<StudentAttendance[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<any[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [weeklyTasks, setWeeklyTasks] = useState<WeeklyTask[]>([]);
  const [studentTracker, setStudentTracker] = useState<StudentTrackerEntry[]>([]);
  const [smes, setSmes] = useState<any[]>([]);
  const [demoSessions, setDemoSessions] = useState<any[]>([]);
  const [demoRules, setDemoRules] = useState<any[]>([]);
  const [demoSwapRequests, setDemoSwapRequests] = useState<any[]>([]);
  const [currentSME, setCurrentSME] = useState<any | null>(null);
  const [subjectGroups, setSubjectGroups] = useState<Array<{ id: string; name: string; description: string }>>([]);
  const coursesList = departmentsList;

  const [kamTasks, setKamTasks] = useState<any[]>([]);
  const [campusIssues, setCampusIssues] = useState<any[]>([]);
  const [academicYears, setAcademicYears] = useState<string[]>([]);
  const [academicEvents, setAcademicEvents] = useState<any[]>([]);
  const [facultyWorkloadLimits, setFacultyWorkloadLimits] = useState<{ [key: string]: number }>({});
  const [facultyShifts, setFacultyShifts] = useState<{ [key: string]: string }>({});
  const [signupRequests, setSignupRequests] = useState<any[]>([]);

  const [currentRole, setCurrentRoleState] = useState<Role>("mentor");
  const [currentMentor, setCurrentMentor] = useState<Mentor | null>(null);
  const [currentHR, setCurrentHR] = useState<HRUser | null>(null);
  const [currentCAM, setCurrentCAM] = useState<CampusManager | null>(null);
  const [currentKAM, setCurrentKAM] = useState<KAMUser | null>(null);
  const [currentAdmin, setCurrentAdmin] = useState<AdminUser | null>(null);
  const [currentStudent, setCurrentStudent] = useState<Student | null>(null);
  const [currentShift, setCurrentShiftState] = useState<ShiftType>("general");

  const [isLoading, setIsLoading] = useState(true);
  const [weekOffset, setWeekOffset] = useState<number>(0);
  const [baseDate, setBaseDate] = useState<string>(() => {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  });
  const activeCollegeId = 
    currentCAM?.college_id || 
    currentMentor?.college_id || 
    currentStudent?.college_id || 
    colleges[0]?.id;
  const activeCollegeObj = colleges.find(c => c.id === activeCollegeId);
  const workingDays = activeCollegeObj ? activeCollegeObj.working_days : 5;

  const weekDates = getWeekDates(weekOffset, baseDate, workingDays);

  const [customShiftTimeSlots, setCustomShiftTimeSlots] = useState<any>(SHIFT_TIME_SLOTS);

  useEffect(() => {
    // Determine active college ID
    const activeCollegeId = 
      currentCAM?.college_id || 
      currentMentor?.college_id || 
      currentStudent?.college_id || 
      colleges[0]?.id;

    if (!activeCollegeId) {
      setCustomShiftTimeSlots(SHIFT_TIME_SLOTS);
      return;
    }

    const collegeObj = colleges.find(c => c.id === activeCollegeId);
    if (collegeObj && collegeObj.shift_configs) {
      try {
        const parsed = JSON.parse(collegeObj.shift_configs);
        setCustomShiftTimeSlots({
          shift_1: parsed.shift_1 || SHIFT_TIME_SLOTS.shift_1,
          shift_2: parsed.shift_2 || SHIFT_TIME_SLOTS.shift_2,
          general: parsed.general || SHIFT_TIME_SLOTS.general,
          semesters: parsed.semester_configs || {}
        });
      } catch (e) {
        console.error("Failed to parse custom shift timings:", e);
        setCustomShiftTimeSlots(SHIFT_TIME_SLOTS);
      }
    } else {
      setCustomShiftTimeSlots(SHIFT_TIME_SLOTS);
    }
  }, [colleges, currentCAM, currentMentor, currentStudent]);

  // ── Fetch all data from the database ──────────────────────────────────────
  const refreshData = async () => {
    try {
      const role = localStorage.getItem("fp_current_role") || "";
      let userId = "";
      if (role === "admin") userId = localStorage.getItem("fp_admin_id") || "";
      else if (role === "kam") userId = localStorage.getItem("fp_kam_id") || "";
      else if (role === "cam") userId = localStorage.getItem("fp_cam_id") || "";
      else if (role === "mentor") userId = localStorage.getItem("fp_mentor_id") || "";
      else if (role === "student") userId = localStorage.getItem("fp_student_id") || "";

      const res = await fetch(`/api/data?role=${role}&userId=${encodeURIComponent(userId)}`);
      const data = await res.json();
      if (data.success) {
        setSlots(data.slots || []);
        setRequests(data.requests || []);
        setApprovedHandovers(data.approvedHandovers || []);
        setAuditLogs(data.auditLogs || []);
        setMentors(data.mentors || []);
        setHrList(data.hr || []);
        setSubjectsList(data.subjects || []);
        setDepartmentsList(data.departments || []);
        setStudents(data.students || []);
        setStudentAttendance(data.studentAttendance || []);
        setLeaveRequests(data.leaveRequests || []);
        setHolidays(data.holidays || []);
        setWeeklyTasks(data.weeklyTasks || []);
        setStudentTracker(data.studentTracker || []);
        setSmes(data.smes || []);
        setDemoSessions(data.demoSessions || []);
        setSubjectGroups(data.subjectGroups || []);
        setDemoRules(data.demoRules || []);
        setSignupRequests(data.signupRequests || []);

        // Parallel fetch for secondary metadata endpoints for fast page load / refresh
        Promise.allSettled([
          fetch("/api/requests/demo-swap").then(r => r.json()),
          fetch("/api/tasks").then(r => r.json()),
          fetch("/api/issues").then(r => r.json()),
          fetch("/api/academic-calendar").then(r => r.json()),
          fetch("/api/faculty-constraints").then(r => r.json()),
          fetch("/api/colleges").then(r => r.json())
        ]).then(([swapRes, tasksRes, issuesRes, calRes, constRes, collegesRes]) => {
          if (swapRes.status === "fulfilled" && swapRes.value?.success) setDemoSwapRequests(swapRes.value.requests || []);
          if (tasksRes.status === "fulfilled" && tasksRes.value?.success) setKamTasks(tasksRes.value.tasks || []);
          if (issuesRes.status === "fulfilled" && issuesRes.value?.success) setCampusIssues(issuesRes.value.issues || []);
          if (calRes.status === "fulfilled" && calRes.value?.success) {
            setAcademicYears(calRes.value.academicYears || []);
            setAcademicEvents(calRes.value.academicEvents || []);
          }
          if (constRes.status === "fulfilled" && constRes.value?.success) {
            setFacultyWorkloadLimits(constRes.value.workloadLimits || {});
            setFacultyShifts(constRes.value.shifts || {});
          }
          if (collegesRes.status === "fulfilled" && collegesRes.value?.success) setColleges(collegesRes.value.colleges || []);
        }).catch(err => console.error("Error in parallel metadata fetch:", err));

        return {
          mentors: data.mentors || [] as Mentor[],
          hr: data.hr || [] as HRUser[],
          students: data.students || [] as Student[],
          smes: data.smes || [] as any[]
        };
      }
    } catch (e) {
      console.error("Error fetching data from API:", e);
    }
    return { mentors: [] as Mentor[], hr: [] as HRUser[], students: [] as Student[], smes: [] as any[] };
  };

  useEffect(() => {
    const initApp = async () => {
      setIsLoading(true);
      document.documentElement.classList.remove("dark");

      // 1. Fetch all data from DB
      const dbData = await refreshData();

      // 2. Restore session from localStorage using DB-sourced user lists
      if (typeof window !== "undefined") {
        const loggedIn = localStorage.getItem("fp_logged_in") === "true";
        if (!loggedIn) {
          setCurrentRoleState("mentor");
          setCurrentMentor(null);
          setCurrentHR(null);
          setCurrentCAM(null);
          setCurrentKAM(null);
          setCurrentAdmin(null);
          setCurrentStudent(null);
          setIsLoading(false);
          return;
        }

        const storedRole = localStorage.getItem("fp_current_role") as Role | null;
        const storedMentorId = localStorage.getItem("fp_mentor_id");
        const storedCamId = localStorage.getItem("fp_cam_id");
        const storedKamId = localStorage.getItem("fp_kam_id");
        const storedAdminId = localStorage.getItem("fp_admin_id");
        const storedStudentId = localStorage.getItem("fp_student_id");
        const storedShift = localStorage.getItem("fp_current_shift") as ShiftType | null;

        const parsedRole: Role = storedRole || "mentor";
        setCurrentRoleState(parsedRole);
        if (storedShift) {
          setCurrentShiftState(storedShift);
        }

        if (parsedRole === "mentor") {
          const m = dbData.mentors.find((item: Mentor) => item.id === storedMentorId) || null;
          if (!m) {
            localStorage.clear();
            setCurrentMentor(null);
            setCurrentRoleState("mentor");
          } else {
            setCurrentMentor(m);
            setCurrentHR(null); setCurrentCAM(null); setCurrentKAM(null); setCurrentAdmin(null); setCurrentStudent(null);
            if (m.shift) {
              setCurrentShiftState(m.shift as ShiftType);
              localStorage.setItem("fp_current_shift", m.shift);
            }
          }
        } else if (parsedRole === "cam" && storedCamId) {
          let camFound = false;
          try {
            const camRes = await fetch(`/api/cam?id=${storedCamId}`);
            const camData = await camRes.json();
            if (camData.success && camData.cam) {
              setCurrentCAM({ ...camData.cam, role: "cam" });
              camFound = true;
            }
          } catch (_) {}
          if (!camFound) {
            localStorage.clear();
            setCurrentCAM(null);
            setCurrentRoleState("mentor");
          } else {
            setCurrentMentor(null); setCurrentHR(null); setCurrentKAM(null); setCurrentAdmin(null); setCurrentStudent(null);
          }
        } else if (parsedRole === "kam" && storedKamId) {
          let kamFound = false;
          try {
            const kamRes = await fetch(`/api/kam?id=${storedKamId}`);
            const kamData = await kamRes.json();
            if (kamData.success && kamData.kam) {
              setCurrentKAM({ ...kamData.kam, role: "kam" });
              kamFound = true;
            }
          } catch (_) {}
          if (!kamFound) {
            localStorage.clear();
            setCurrentKAM(null);
            setCurrentRoleState("mentor");
          } else {
            setCurrentMentor(null); setCurrentHR(null); setCurrentCAM(null); setCurrentAdmin(null); setCurrentStudent(null);
          }
        } else if (parsedRole === "admin" && storedAdminId) {
          let adminFound = false;
          try {
            const adminRes = await fetch(`/api/admin?id=${storedAdminId}`);
            const adminData = await adminRes.json();
            if (adminData.success && adminData.admin) {
              setCurrentAdmin({ ...adminData.admin, role: "admin" });
              adminFound = true;
            }
          } catch (_) {}
          if (!adminFound) {
            localStorage.clear();
            setCurrentAdmin(null);
            setCurrentRoleState("mentor");
          } else {
            setCurrentMentor(null); setCurrentHR(null); setCurrentCAM(null); setCurrentKAM(null); setCurrentStudent(null);
          }
        } else if (parsedRole === "student" && storedStudentId) {
          const s = dbData.students.find((item: Student) => item.id === storedStudentId) || null;
          if (!s) {
            localStorage.clear();
            setCurrentStudent(null);
            setCurrentRoleState("mentor");
          } else {
            setCurrentStudent(s);
            setCurrentMentor(null); setCurrentHR(null); setCurrentCAM(null); setCurrentKAM(null); setCurrentAdmin(null); setCurrentSME(null);
          }
        } else if (parsedRole === "sme") {
          const storedSmeId = localStorage.getItem("fp_sme_id");
          const s = dbData.smes?.find((item: any) => item.id === storedSmeId) || null;
          if (!s) {
            localStorage.clear();
            setCurrentSME(null);
            setCurrentRoleState("mentor");
          } else {
            setCurrentSME(s);
            setCurrentMentor(null); setCurrentHR(null); setCurrentCAM(null); setCurrentKAM(null); setCurrentAdmin(null); setCurrentStudent(null);
          }
        } else if (parsedRole === "allocator") {
          setCurrentMentor(null); setCurrentHR(null); setCurrentCAM(null); setCurrentKAM(null); setCurrentAdmin(null); setCurrentStudent(null); setCurrentSME(null);
        }
      }

      setIsLoading(false);
    };

    initApp();
  }, []);

  useEffect(() => {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    const todayStr = `${y}-${m}-${d}`;
    setBaseDate(todayStr);
  }, [currentStudent, currentMentor, studentAttendance, slots]);

  // ── Set current role and user from DB data ─────────────────────────────────
  const setRole = (role: Role, userId?: string, extra?: { collegeId?: string }) => {
    localStorage.setItem("fp_current_role", role);
    setCurrentRoleState(role);

    if (role === "mentor") {
      const selectedId = userId || currentMentor?.id;
      const m = mentors.find((item) => item.id === selectedId) || mentors[0] || null;
      setCurrentMentor(m);
      setCurrentHR(null); setCurrentCAM(null); setCurrentKAM(null); setCurrentAdmin(null); setCurrentStudent(null);
      if (m) {
        localStorage.setItem("fp_mentor_id", m.id);
        if (m.shift) {
          setCurrentShiftState(m.shift);
          localStorage.setItem("fp_current_shift", m.shift);
        }
      }
    } else if (role === "cam" && userId) {
      localStorage.setItem("fp_cam_id", userId);
      setCurrentMentor(null); setCurrentHR(null); setCurrentKAM(null); setCurrentAdmin(null); setCurrentStudent(null);
      // Fetch CAM data
      fetch(`/api/cam?id=${userId}`).then(r => r.json()).then(d => {
        if (d.success) setCurrentCAM({ ...d.cam, role: "cam" as const });
      });
    } else if (role === "kam" && userId) {
      localStorage.setItem("fp_kam_id", userId);
      setCurrentMentor(null); setCurrentHR(null); setCurrentCAM(null); setCurrentAdmin(null); setCurrentStudent(null);
      // Fetch KAM data
      fetch(`/api/kam?id=${userId}`).then(r => r.json()).then(d => {
        if (d.success) setCurrentKAM({ ...d.kam, role: "kam" as const });
      });
    } else if (role === "admin" && userId) {
      localStorage.setItem("fp_admin_id", userId);
      setCurrentMentor(null); setCurrentHR(null); setCurrentCAM(null); setCurrentKAM(null); setCurrentStudent(null);
      // Fetch Admin data
      fetch(`/api/admin?id=${userId}`).then(r => r.json()).then(d => {
        if (d.success) setCurrentAdmin({ ...d.admin, role: "admin" as const });
      });
    } else if (role === "student" && userId) {
      localStorage.setItem("fp_student_id", userId);
      const s = students.find((item) => item.id === userId) || students[0] || null;
      setCurrentStudent(s);
      setCurrentMentor(null); setCurrentHR(null); setCurrentCAM(null); setCurrentKAM(null); setCurrentAdmin(null); setCurrentSME(null);
    } else if (role === "fee_manager") {
      localStorage.setItem("fp_current_role", "fee_manager");
      setCurrentMentor(null); setCurrentHR(null); setCurrentCAM(null); setCurrentKAM(null); setCurrentAdmin(null); setCurrentStudent(null); setCurrentSME(null);
    } else if (role === "sme" && userId) {
      localStorage.setItem("fp_sme_id", userId);
      const s = smes.find((item) => item.id === userId) || smes[0] || null;
      setCurrentSME(s);
      setCurrentMentor(null); setCurrentHR(null); setCurrentCAM(null); setCurrentKAM(null); setCurrentAdmin(null); setCurrentStudent(null);
    } else if (role === "allocator") {
      localStorage.setItem("fp_current_role", "allocator");
      setCurrentMentor(null); setCurrentHR(null); setCurrentCAM(null); setCurrentKAM(null); setCurrentAdmin(null); setCurrentStudent(null); setCurrentSME(null);
    } else {
      setCurrentMentor(null);
      setCurrentHR(hrList[0] || null);
      setCurrentCAM(null); setCurrentKAM(null); setCurrentAdmin(null); setCurrentStudent(null); setCurrentSME(null);
    }

    refreshData();
  };

  const setCurrentShift = (shift: ShiftType) => {
    localStorage.setItem("fp_current_shift", shift);
    setCurrentShiftState(shift);
  };

  // Keep active user profile states in sync with refreshed database data
  useEffect(() => {
    if (currentRole === "sme" && currentSME) {
      const updatedSme = smes.find(s => s.id === currentSME.id);
      if (updatedSme && JSON.stringify(updatedSme) !== JSON.stringify(currentSME)) {
        setCurrentSME(updatedSme);
      }
    }
  }, [smes, currentRole, currentSME]);

  useEffect(() => {
    if (currentRole === "mentor" && currentMentor) {
      const updatedMentor = mentors.find(m => m.id === currentMentor.id);
      if (updatedMentor && JSON.stringify(updatedMentor) !== JSON.stringify(currentMentor)) {
        setCurrentMentor(updatedMentor);
      }
    }
  }, [mentors, currentRole, currentMentor]);

  useEffect(() => {
    if (currentRole === "student" && currentStudent) {
      const updatedStudent = students.find(s => s.id === currentStudent.id);
      if (updatedStudent && JSON.stringify(updatedStudent) !== JSON.stringify(currentStudent)) {
        setCurrentStudent(updatedStudent);
      }
    }
  }, [students, currentRole, currentStudent]);

  // ── Slot actions ───────────────────────────────────────────────────────────
  const assignSlot = async (mentorId: string, day: string, time: string, course: string, location: string, classGroup?: string) => {
    const actorName = currentCAM?.name || currentKAM?.name || "System";
    const actorRole = currentRole === "cam" ? "Campus Manager" : "Key Account Manager";
    const res = await fetch("/api/slots", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mentorId, day, time, course, location, actorName, actorRole, shift: currentShift, classGroup })
    });
    const data = await res.json();
    if (data.success) {
      await refreshData();
    } else {
      throw new Error(data.message || "Failed to assign slot");
    }
  };

  const deleteSlot = async (slotId: string) => {
    const actorName = currentCAM?.name || currentKAM?.name || "System";
    const actorRole = currentRole === "cam" ? "Campus Manager" : "Key Account Manager";
    const res = await fetch(`/api/slots?id=${slotId}&actorName=${encodeURIComponent(actorName)}&actorRole=${encodeURIComponent(actorRole)}`, {
      method: "DELETE"
    });
    const data = await res.json();
    if (data.success) {
      await refreshData();
    } else {
      throw new Error(data.message || "Failed to delete slot");
    }
  };

  const updateSlot = async (
    slotId: string,
    mentorId: string,
    day: string,
    time: string,
    course: string,
    location: string,
    classGroup?: string
  ): Promise<{ success: boolean; message?: string }> => {
    const actorName = currentCAM?.name || currentKAM?.name || currentMentor?.name || "System";
    const actorRole = currentRole === "cam" ? "Campus Manager" : currentRole === "kam" ? "Key Account Manager" : "Mentor";
    const res = await fetch("/api/slots", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: slotId, mentorId, day, time, course, location, actorName, actorRole, shift: currentShift, classGroup })
    });
    const data = await res.json();
    if (data.success) {
      await refreshData();
      return { success: true };
    } else {
      return { success: false, message: data.message || "Failed to update slot" };
    }
  };

  const requestHandover = async (
    mentorId: string,
    slotId: string,
    dateStr: string,
    dateFormatted: string,
    targetStaffId: string,
    reason: string,
    subjectName?: string
  ) => {
    const res = await fetch("/api/requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mentorId, slotId, dateStr, dateFormatted, targetStaffId, reason, subjectName })
    });
    const data = await res.json();
    if (data.success) {
      await refreshData();
    } else {
      throw new Error(data.message || "Failed to request handover");
    }
  };

  const requestSwapCompensate = async (
    requestorId: string,
    offerSlotId: string,
    offerDateStr: string,
    offerDateFormatted: string,
    targetStaffId: string,
    compensatesHandoverId?: string,
    reason?: string,
    originalSubject?: string,
    originalMonth?: string
  ): Promise<{ success: boolean; message: string }> => {
    const res = await fetch("/api/requests/swap", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requestorId, offerSlotId, offerDateStr, offerDateFormatted,
        targetStaffId, compensatesHandoverId, reason,
        originalSubject, originalMonth
      })
    });
    const data = await res.json();
    if (data.success) {
      await refreshData();
      return { success: true, message: data.message || "Swap offer sent!" };
    } else {
      return { success: false, message: data.message || "Failed to send swap offer." };
    }
  };

  const bookDemoSession = async (
    mentorId: string,
    mentorName: string,
    smeId: string,
    smeName: string,
    dateStr: string,
    timeSlot: string,
    subject: string,
    stream: string,
    week: number
  ): Promise<{ success: boolean; message: string }> => {
    const res = await fetch("/api/demo-sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "book",
        mentorId, mentorName, smeId, smeName, dateStr, timeSlot, subject, stream, week
      })
    });
    const data = await res.json();
    if (data.success) {
      await refreshData();
      return { success: true, message: data.message || "Demo allocated successfully!" };
    } else {
      return { success: false, message: data.message || "Failed to allocate demo." };
    }
  };

  const evaluateDemoSession = async (
    sessionId: string,
    marks: number,
    comments: string
  ): Promise<{ success: boolean; message: string }> => {
    const res = await fetch("/api/demo-sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "evaluate",
        sessionId, marks, comments
      })
    });
    const data = await res.json();
    if (data.success) {
      await refreshData();
      return { success: true, message: data.message || "Evaluation saved successfully!" };
    } else {
      return { success: false, message: data.message || "Failed to save evaluation." };
    }
  };

  const bulkBookDemoSessions = async (sessions: any[]): Promise<{ success: boolean; message: string }> => {
    try {
      const res = await fetch("/api/demo-sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "bulk-book", sessions })
      });
      const data = await res.json();
      if (data.success) {
        await refreshData();
        return { success: true, message: data.message || "Bulk demos allocated successfully!" };
      }
      return { success: false, message: data.message || "Failed to allocate bulk demos." };
    } catch (e: any) {
      return { success: false, message: e.message || "An unexpected error occurred." };
    }
  };

  const updateDemoSession = async (sessionId: string, dateStr: string, timeSlot: string, smeId: string, smeName: string): Promise<{ success: boolean; message: string }> => {
    try {
      const res = await fetch("/api/demo-sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update", sessionId, dateStr, timeSlot, smeId, smeName })
      });
      const data = await res.json();
      if (data.success) {
        await refreshData();
        return { success: true, message: data.message || "Demo session updated successfully." };
      }
      return { success: false, message: data.message || "Failed to update demo session." };
    } catch (e: any) {
      return { success: false, message: e.message || "An unexpected error occurred." };
    }
  };

  const swapDemoSessions = async (session1Id: string, session2Id: string): Promise<{ success: boolean; message: string }> => {
    try {
      const res = await fetch("/api/demo-sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "swap", session1Id, session2Id })
      });
      const data = await res.json();
      if (data.success) {
        await refreshData();
        return { success: true, message: data.message || "Demo sessions swapped successfully." };
      }
      return { success: false, message: data.message || "Failed to swap demo sessions." };
    } catch (e: any) {
      return { success: false, message: e.message || "An unexpected error occurred." };
    }
  };

  const requestDemoSwap = async (payload: any): Promise<{ success: boolean; message: string }> => {
    try {
      const res = await fetch("/api/requests/demo-swap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "request", ...payload })
      });
      const data = await res.json();
      if (data.success) {
        await refreshData();
        return { success: true, message: data.message || "Demo swap requested successfully." };
      }
      return { success: false, message: data.message || "Failed to request demo swap." };
    } catch (e: any) {
      return { success: false, message: e.message || "An unexpected error occurred." };
    }
  };

  const resolveDemoSwap = async (requestId: string, status: "approved" | "rejected" | "pending_sme"): Promise<{ success: boolean; message: string }> => {
    try {
      const res = await fetch("/api/requests/demo-swap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "resolve", requestId, status })
      });
      const data = await res.json();
      if (data.success) {
        await refreshData();
        return { success: true, message: data.message || `Demo swap request ${status} successfully.` };
      }
      return { success: false, message: data.message || "Failed to resolve swap request." };
    } catch (e: any) {
      return { success: false, message: e.message || "An unexpected error occurred." };
    }
  };

  const deleteDemoSession = async (sessionId: string): Promise<{ success: boolean; message: string }> => {
    try {
      const res = await fetch(`/api/demo-sessions?id=${sessionId}`, {
        method: "DELETE"
      });
      const data = await res.json();
      if (data.success) {
        await refreshData();
        return { success: true, message: data.message || "Demo session deleted successfully." };
      }
      return { success: false, message: data.message || "Failed to delete demo session." };
    } catch (e: any) {
      return { success: false, message: e.message || "An unexpected error occurred." };
    }
  };

  const createDemoRule = async (subject: string, week: number, target: number): Promise<{ success: boolean; message: string }> => {
    try {
      const res = await fetch("/api/demo-rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create", subject, week, target })
      });
      const data = await res.json();
      if (data.success) {
        await refreshData();
        return { success: true, message: data.message || "Rule created successfully!" };
      }
      return { success: false, message: data.message || "Failed to create rule." };
    } catch (e: any) {
      return { success: false, message: e.message || "An unexpected error occurred." };
    }
  };

  const deleteDemoRule = async (id: string): Promise<{ success: boolean; message: string }> => {
    try {
      const res = await fetch("/api/demo-rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", id })
      });
      const data = await res.json();
      if (data.success) {
        await refreshData();
        return { success: true, message: data.message || "Rule deleted successfully." };
      }
      return { success: false, message: data.message || "Failed to delete rule." };
    } catch (e: any) {
      return { success: false, message: e.message || "An unexpected error occurred." };
    }
  };

  const createSubjectGroup = async (name: string, description: string, subjectIds?: string[]): Promise<{ success: boolean; message: string }> => {
    try {
      const res = await fetch("/api/subject-groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description, subjectIds })
      });
      const data = await res.json();
      if (data.success) {
        await refreshData();
        return { success: true, message: data.message };
      }
      return { success: false, message: data.message || "Failed to create subject group." };
    } catch (e: any) {
      return { success: false, message: e.message || "An unexpected error occurred." };
    }
  };

  const updateSubjectGroup = async (id: string, name: string, description: string, subjectIds?: string[]): Promise<{ success: boolean; message: string }> => {
    try {
      const res = await fetch("/api/subject-groups", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, name, description, subjectIds })
      });
      const data = await res.json();
      if (data.success) {
        await refreshData();
        return { success: true, message: data.message };
      }
      return { success: false, message: data.message || "Failed to update subject group." };
    } catch (e: any) {
      return { success: false, message: e.message || "An unexpected error occurred." };
    }
  };

  const deleteSubjectGroup = async (id: string): Promise<{ success: boolean; message: string }> => {
    try {
      const res = await fetch(`/api/subject-groups?id=${id}`, {
        method: "DELETE"
      });
      const data = await res.json();
      if (data.success) {
        await refreshData();
        return { success: true, message: data.message };
      }
      return { success: false, message: data.message || "Failed to delete subject group." };
    } catch (e: any) {
      return { success: false, message: e.message || "An unexpected error occurred." };
    }
  };

  const updateSmeSubjectGroup = async (id: string, subject: string | null): Promise<{ success: boolean; message: string }> => {
    try {
      const res = await fetch("/api/smes", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, subject })
      });
      const data = await res.json();
      if (data.success) {
        await refreshData();
        return { success: true, message: data.message };
      }
      return { success: false, message: data.message || "Failed to update SME subject group." };
    } catch (e: any) {
      return { success: false, message: e.message || "An unexpected error occurred." };
    }
  };

  const createSmeUser = async (id: string, name: string, email: string, subject?: string): Promise<{ success: boolean; message: string }> => {
    try {
      const res = await fetch("/api/smes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, name, email, subject })
      });
      const data = await res.json();
      if (data.success) {
        await refreshData();
        return { success: true, message: data.message };
      }
      return { success: false, message: data.message || "Failed to create SME." };
    } catch (e: any) {
      return { success: false, message: e.message || "An unexpected error occurred." };
    }
  };

  const updateSmeUser = async (id: string, name: string, email: string, subject?: string): Promise<{ success: boolean; message: string }> => {
    try {
      const res = await fetch("/api/smes", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, name, email, subject })
      });
      const data = await res.json();
      if (data.success) {
        await refreshData();
        return { success: true, message: data.message };
      }
      return { success: false, message: data.message || "Failed to update SME." };
    } catch (e: any) {
      return { success: false, message: e.message || "An unexpected error occurred." };
    }
  };

  const deleteSmeUser = async (id: string): Promise<{ success: boolean; message: string }> => {
    try {
      const res = await fetch(`/api/smes?id=${id}`, {
        method: "DELETE"
      });
      const data = await res.json();
      if (data.success) {
        await refreshData();
        return { success: true, message: data.message };
      }
      return { success: false, message: data.message || "Failed to delete SME." };
    } catch (e: any) {
      return { success: false, message: e.message || "An unexpected error occurred." };
    }
  };

  const requestBooking = async (mentorId: string, day: string, time: string, course: string, location: string, classGroup?: string): Promise<{ success: boolean; message?: string }> => {
    const actorName = currentMentor?.name || "System";
    const res = await fetch("/api/slots", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mentorId, day, time, course, location, actorName, actorRole: "Mentor", shift: currentShift, classGroup })
    });
    const data = await res.json();
    if (data.success) {
      await refreshData();
      return { success: true };
    } else {
      return { success: false, message: data.message || "Failed to book slot." };
    }
  };
  const cancelRequest = async (requestId: string): Promise<{ success: boolean; message: string }> => {
    try {
      const res = await fetch(`/api/requests/${requestId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!data.success) {
        return { success: false, message: data.message || "Failed to cancel request" };
      }
      await refreshData();
      return { success: true, message: "Request cancelled successfully!" };
    } catch (error) {
      console.error(error);
      return { success: false, message: "An error occurred while cancelling the request." };
    }
  };


  const handleRequest = async (requestId: string, status: "approved" | "rejected", headerReason?: string, actorRole?: string, course?: string) => {
    const approverName = currentCAM?.name || currentKAM?.name || currentMentor?.name || "System User";
    const cleanActorRole = actorRole || (currentRole === "cam" ? "Campus Manager" : currentRole === "kam" ? "Key Account Manager" : "Mentor");
    const res = await fetch("/api/requests/review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requestId, status, headerReason, approverName, actorRole: cleanActorRole, course })
    });
    const data = await res.json();
    if (data.success) {
      await refreshData();
    } else {
      throw new Error(data.message || "Failed to process request");
    }
  };

  const importCSV = async (csvContent: string): Promise<{ success: boolean; message: string; count: number }> => {
    try {
      const lines = csvContent.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);
      if (lines.length <= 1) {
        return { success: false, message: "CSV has no data rows", count: 0 };
      }

      const hasHeader = lines[0].toLowerCase().includes("mentor") || lines[0].toLowerCase().includes("day");
      const dataLines = hasHeader ? lines.slice(1) : lines;

      const slotsToImport: { mentorId: string; day: string; time: string; course: string; location: string; shift: string; classGroup?: string }[] = [];

      const detectShiftFromTime = (time: string, classGroup?: string): ShiftType => {
        const normalized = time.toLowerCase().replace(/\s+/g, "");
        for (const shift of ["shift_1", "shift_2", "general"] as ShiftType[]) {
          const times = getTimeSlots(shift, classGroup);
          if (times.some(t => t.toLowerCase().replace(/\s+/g, "") === normalized)) {
            return shift;
          }
        }
        return "general";
      };

      for (const line of dataLines) {
        const parts = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map((p) => p.replace(/^"|"$/g, "").trim());
        if (parts.length >= 5) {
          const mentorIdOrEmailOrName = parts[0];
          const day = parts[1];
          const time = parts[2];
          const course = parts[3];
          const location = parts[4];
          const classGroup = parts[5] || "General Class";

          const mentor = mentors.find(
            (m) =>
              m.id.toLowerCase() === mentorIdOrEmailOrName.toLowerCase() ||
              m.name.toLowerCase() === mentorIdOrEmailOrName.toLowerCase() ||
              m.email.toLowerCase() === mentorIdOrEmailOrName.toLowerCase()
          );

          const normalizedDay = DAYS_OF_WEEK.find((d) => d.toLowerCase() === day.toLowerCase());
          
          const detectedShift = detectShiftFromTime(time, classGroup);
          const targetTimes = getTimeSlots(detectedShift, classGroup);
          const normalizedTime = targetTimes.find(
            (t) => t.toLowerCase().replace(/\s+/g, "") === time.toLowerCase().replace(/\s+/g, "")
          );

          if (mentor && normalizedDay && normalizedTime) {
            slotsToImport.push({
              mentorId: mentor.id,
              day: normalizedDay,
              time: normalizedTime,
              course,
              location,
              shift: detectedShift,
              classGroup
            });
          }
        }
      }

      if (slotsToImport.length > 0) {
        const actorName = currentCAM?.name || currentKAM?.name || "Manager";
        const res = await fetch("/api/slots/bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slots: slotsToImport, actorName })
        });
        const data = await res.json();
        if (data.success) {
          await refreshData();
          return { success: true, message: data.message, count: data.count };
        } else {
          return { success: false, message: data.message || "Import failed.", count: 0 };
        }
      }

      return { success: false, message: "No valid rows matched. CSV Format: mentor_name,day,time_slot,course,location", count: 0 };
    } catch {
      return { success: false, message: "Error parsing CSV file.", count: 0 };
    }
  };

  const markAttendance = async (
    slotId: string,
    dateStr: string,
    attendanceData: Array<{ studentId: string; status: "present" | "absent" | "od" | "not_marked" }>,
    coveredSubject?: string,
    type: "Regular" | "Non-Regular" = "Regular",
    mode: "Online" | "Offline" = "Offline",
    attendanceTypeSub?: string
  ): Promise<{ success: boolean; message: string }> => {
    try {
      const actorName = currentMentor?.name || "System";
      const actorRole = currentRole === "mentor" ? "Mentor" : "System";
      const res = await fetch("/api/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slotId,
          dateStr,
          attendance: attendanceData,
          markedBy: currentMentor?.id || "System",
          actorName,
          actorRole,
          coveredSubject,
          type,
          mode,
          attendanceTypeSub
        })
      });
      const data = await res.json();
      if (data.success) {
        await refreshData();
        return { success: true, message: "Attendance marked successfully." };
      } else {
        return { success: false, message: data.message || "Failed to mark attendance." };
      }
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  };

  const correctStudentAttendance = async (
    studentId: string,
    slotId: string,
    dateStr: string,
    newStatus: "present" | "absent" | "od",
    reason: string,
    isAdminOverride: boolean = false
  ): Promise<{ success: boolean; message: string }> => {
    try {
      const actorName = currentCAM?.name || currentAdmin?.name || "System";
      const actorRole = currentRole === "admin" ? "Super Admin" : "Campus Manager";
      const res = await fetch("/api/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "correct",
          studentId,
          slotId,
          dateStr,
          newStatus,
          reason,
          changedBy: actorName,
          changedByRole: actorRole,
          isAdminOverride
        })
      });
      const data = await res.json();
      if (data.success) {
        await refreshData();
        return { success: true, message: data.message };
      } else {
        return { success: false, message: data.message || "Failed to correct attendance." };
      }
    } catch (e: any) {
      return { success: false, message: e.message || "An unexpected error occurred." };
    }
  };

  const requestLeave = async (type: "leave" | "od", dateStr: string, reason: string): Promise<{ success: boolean; message?: string }> => {
    try {
      if (!currentStudent) return { success: false, message: "No student session" };
      const res = await fetch("/api/requests/leave", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: currentStudent.id,
          studentName: currentStudent.name,
          classGroup: currentStudent.classGroup,
          type,
          dateStr,
          reason
        })
      });
      const data = await res.json();
      if (data.success) {
        await refreshData();
        return { success: true };
      } else {
        return { success: false, message: data.message || "Failed to submit leave request" };
      }
    } catch (e: any) {
      console.error("Error submitting leave request:", e);
      return { success: false, message: e.message };
    }
  };

  const handleLeaveRequest = async (requestId: string, status: "approved" | "rejected"): Promise<{ success: boolean; message?: string }> => {
    try {
      const actorName = currentCAM?.name || currentKAM?.name || "System Admin";
      const res = await fetch("/api/requests/leave", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId,
          status,
          approvedBy: actorName
        })
      });
      const data = await res.json();
      if (data.success) {
        await refreshData();
        return { success: true };
      } else {
        return { success: false, message: data.message || "Failed to resolve leave request" };
      }
    } catch (e: any) {
      console.error("Error resolving leave request:", e);
      return { success: false, message: e.message };
    }
  };

  const clearAllData = async (): Promise<{ success: boolean; message: string }> => {
    const res = await fetch("/api/data", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "clear", confirm: "DELETE" })
    });
    const data = await res.json();
    if (data.success) {
      await refreshData();
      setRole("mentor");
      return { success: true, message: "All database records cleared." };
    } else {
      return { success: false, message: data.message || "Failed to clear database" };
    }
  };



  const createMentor = async (mentorData: Omit<Mentor, "role">) => {
    try {
      const res = await fetch("/api/mentors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mentorData)
      });
      const data = await res.json();
      if (data.success) {
        await refreshData();
      }
      return data;
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  };

  const updateMentor = async (mentorData: Omit<Mentor, "role">) => {
    try {
      const res = await fetch("/api/mentors", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mentorData)
      });
      const data = await res.json();
      if (data.success) {
        await refreshData();
      }
      return data;
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  };

  const deleteMentor = async (id: string) => {
    try {
      const res = await fetch(`/api/mentors?id=${id}`, {
        method: "DELETE"
      });
      const data = await res.json();
      if (data.success) {
        await refreshData();
      }
      return data;
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  };

  const parseSemesterFromClassGroup = (cg?: string): string => {
    if (!cg) return "";
    const lower = cg.toLowerCase();
    if (lower.includes("sem 1") || lower.includes("sem i") || lower.includes("semester 1") || lower.includes("semester i")) return "Semester 1";
    if (lower.includes("sem 2") || lower.includes("sem ii") || lower.includes("semester 2") || lower.includes("semester ii")) return "Semester 2";
    if (lower.includes("sem 3") || lower.includes("sem iii") || lower.includes("semester 3") || lower.includes("semester iii")) return "Semester 3";
    if (lower.includes("sem 4") || lower.includes("sem iv") || lower.includes("semester 4") || lower.includes("semester iv")) return "Semester 4";
    if (lower.includes("sem 5") || lower.includes("sem v") || lower.includes("semester 5") || lower.includes("semester v")) return "Semester 5";
    if (lower.includes("sem 6") || lower.includes("sem vi") || lower.includes("semester 6") || lower.includes("semester vi")) return "Semester 6";
    if (lower.includes("sem 7") || lower.includes("sem vii") || lower.includes("semester 7") || lower.includes("semester vii")) return "Semester 7";
    if (lower.includes("sem 8") || lower.includes("sem viii") || lower.includes("semester 8") || lower.includes("semester viii")) return "Semester 8";
    return "";
  };

  const getTimeSlots = (shift: string, semesterOrClassGroup?: string): string[] => {
    let semester = semesterOrClassGroup || "";
    if (semester && !semester.startsWith("Semester")) {
      semester = parseSemesterFromClassGroup(semester);
    }
    
    if (semester && customShiftTimeSlots.semesters?.[semester]) {
      const semConfig = customShiftTimeSlots.semesters[semester];
      if (semConfig[shift] && semConfig[shift].length > 0) {
        return semConfig[shift];
      }
    }
    
    return customShiftTimeSlots[shift] || customShiftTimeSlots["general"] || (SHIFT_TIME_SLOTS as any)[shift] || [];
  };

  const generateTimetable = async (
    classGroup: string, 
    shift: ShiftType, 
    defaultRoom: string,
    allocations?: Array<{
      subjectId: string;
      subjectName: string;
      mentorId: string;
      weeklyHours: number;
      room?: string;
    }>,
    previewOnly: boolean = false
  ) => {
    try {
      // ─── Helpers ────────────────────────────────────────────────────────────────
      function shuffleArray<T>(arr: T[]): T[] {
        const a = [...arr];
        for (let i = a.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
      }

      const { semester, year } = resolveClassGroupDetailsFromState(classGroup, subjectsList, coursesList);

      // ─── Build subjectsToAllocate ────────────────────────────────────────────
      const subjectsToAllocate: { mentorId: string; subject: string; hoursLeft: number; room: string }[] = [];

      if (allocations && allocations.length > 0) {
        allocations.forEach(a => {
          subjectsToAllocate.push({
            mentorId: a.mentorId,
            subject: a.subjectName,
            hoursLeft: a.weeklyHours,
            room: a.room || defaultRoom
          });
        });
      } else {
        // Fallback: use mentors that match the class group's department (Bug #2 fix)
        // Extract course/department name from classGroup (strip semester/shift suffixes)
        const normGroupName = classGroup.toLowerCase().replace(/[-–—\s]*(sem|semester|shift|year|yr)\s*\w+/gi, "").trim();
        const deptMentors = mentors.filter((m) => {
          if (!m.subjects || !m.subjects.trim()) return false;
          // Match by department field if it roughly matches the class group name
          if (m.department) {
            const normDept = m.department.toLowerCase().replace(/[^a-z0-9]/g, "");
            const normGroup = normGroupName.replace(/[^a-z0-9]/g, "");
            // Accept if they share a meaningful prefix (at least 6 chars) or dept contains class keywords
            if (normDept.includes(normGroup.slice(0, 6)) || normGroup.includes(normDept.slice(0, 6))) {
              return true;
            }
          }
          return false;
        });

        // If department filtering yields no results, fall back to all mentors with subjects (with a warning)
        const candidateMentors = deptMentors.length > 0
          ? deptMentors
          : mentors.filter((m) => m.subjects && m.subjects.trim().length > 0);

        if (candidateMentors.length === 0) {
          return { success: false, message: "No mentors with subjects found to allocate." };
        }

        candidateMentors.forEach((m) => {
          const subs = m.subjects ? m.subjects.split(/\n|\/|,|;/).map(s => s.trim()).filter(Boolean) : [];
          subs.forEach((sub) => {
            subjectsToAllocate.push({
              mentorId: m.id,
              subject: sub,
              hoursLeft: 4,
              room: defaultRoom
            });
          });
        });
      }

      if (subjectsToAllocate.length === 0) {
        return { success: false, message: "No subjects configured for allocation." };
      }

      // ─── Shuffle subjects for varied output each run ─────────────────────────
      const shuffledSubjects = shuffleArray(subjectsToAllocate);

      const targetTimeSlots = getTimeSlots(shift, classGroup);
      const generatedSlots: any[] = [];

      // ─── Build & shuffle day×time pairs for spread distribution ─────────────
      const allSlotPairs = shuffleArray(
        DAYS_OF_WEEK.flatMap(day => targetTimeSlots.map(time => ({ day, time })))
      );

      // ─── Daily cap: each subject max ceil(hours/5) slots per day ─────────────
      // key: `${subjectKey}::${day}` → count placed that day
      const dailyPlacedCount = new Map<string, number>();

      // ─── Main scheduling loop ─────────────────────────────────────────────────
      let lastAllocatedIndex = 0;

      for (const { day, time } of allSlotPairs) {
        // Skip if cohort already has any class at this (day, time) — regardless of shift label
        const isCohortBusy =
          slots.some(s => s.classGroup && s.classGroup.toLowerCase() === classGroup.toLowerCase() && s.day === day && s.time === time) ||
          generatedSlots.some(s => s.classGroup.toLowerCase() === classGroup.toLowerCase() && s.day === day && s.time === time);
        if (isCohortBusy) continue;

        let allocated = false;
        for (let attempt = 0; attempt < shuffledSubjects.length; attempt++) {
          const index = (lastAllocatedIndex + attempt) % shuffledSubjects.length;
          const candidate = shuffledSubjects[index];
          if (candidate.hoursLeft <= 0) continue;

          // Daily cap: max ceil(hoursLeft / 5) slots per day per subject
          const dailyKey = `${candidate.subject}::${candidate.mentorId}::${day}`;
          const dailyCount = dailyPlacedCount.get(dailyKey) || 0;
          const dailyAllowed = Math.max(1, Math.ceil(candidate.hoursLeft / 5));
          if (dailyCount >= dailyAllowed) continue;

          // Mentor clash check — across ALL cohorts/departments/shifts (physical person can only be in one place)
          const isMentorClash =
            slots.some(s => s.mentorId === candidate.mentorId && s.day === day && s.time === time) ||
            generatedSlots.some(s => s.mentorId === candidate.mentorId && s.day === day && s.time === time);
          if (isMentorClash) continue;

          // Room clash check — across ALL cohorts/departments/shifts (a room can only hold one class at a time)
          const isRoomClash = candidate.room.trim() !== "" && (
            slots.some(s => s.location.toLowerCase() === candidate.room.toLowerCase() && s.day === day && s.time === time) ||
            generatedSlots.some(s => s.location.toLowerCase() === candidate.room.toLowerCase() && s.day === day && s.time === time)
          );
          if (isRoomClash) continue;

          //  Place slot
          generatedSlots.push({
            mentorId: candidate.mentorId,
            day,
            time,
            course: candidate.subject,
            location: candidate.room,
            shift,
            classGroup,
            semester,
            year
          });

          candidate.hoursLeft--;
          dailyPlacedCount.set(dailyKey, dailyCount + 1);
          lastAllocatedIndex = (index + 1) % shuffledSubjects.length;
          allocated = true;
          break;
        }
      }

      // ─── Unscheduled workload report ─────────────────────────────────────────
      const unscheduled: { subject: string; hours: number }[] = [];
      shuffledSubjects.forEach(s => {
        if (s.hoursLeft > 0) {
          unscheduled.push({ subject: s.subject, hours: s.hoursLeft });
        }
      });

      if (previewOnly) {
        return {
          success: true,
          message: `Preview generated successfully. Placed ${generatedSlots.length} slots.`,
          previewSlots: generatedSlots,
          unscheduled
        };
      }

      if (generatedSlots.length === 0) {
        return { success: false, message: "Failed to generate any slots. All candidate mentors had scheduling clashes." };
      }

      const actorName = currentCAM?.name || currentKAM?.name || "System";
      const actorRole = currentRole === "cam" ? "Campus Manager" : "Key Account Manager";

      // Delete existing slots for this classGroup first
      await fetch(`/api/slots?classGroup=${encodeURIComponent(classGroup)}&actorName=${encodeURIComponent(actorName)}&actorRole=${encodeURIComponent(actorRole)}`, {
        method: "DELETE"
      });

      const res = await fetch("/api/slots/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slots: generatedSlots, actorName })
      });
      const data = await res.json();
      if (data.success) {
        await refreshData();
        return { success: true, message: data.message || "Timetable generated successfully.", count: generatedSlots.length, unscheduled };
      } else {
        return { success: false, message: data.message || "Bulk import failed." };
      }
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  };

  const clearTimetable = async (classGroup: string): Promise<{ success: boolean; message: string }> => {
    try {
      const actorName = currentCAM?.name || currentKAM?.name || "System";
      const actorRole = currentRole === "cam" ? "Campus Manager" : "Key Account Manager";

      const res = await fetch(`/api/slots?classGroup=${encodeURIComponent(classGroup)}&actorName=${encodeURIComponent(actorName)}&actorRole=${encodeURIComponent(actorRole)}`, {
        method: "DELETE"
      });
      const data = await res.json();
      if (data.success) {
        await refreshData();
        return { success: true, message: data.message || `Timetable for ${classGroup} cleared successfully.` };
      } else {
        return { success: false, message: data.message || "Failed to clear timetable." };
      }
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  };

  const createSubject = async (subjectData: Omit<Subject, "id">) => {
    try {
      const res = await fetch("/api/subjects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subjectData)
      });
      const data = await res.json();
      if (data.success) {
        await refreshData();
      }
      return data;
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  };

  const updateSubject = async (subjectData: Subject) => {
    try {
      const res = await fetch("/api/subjects", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subjectData)
      });
      const data = await res.json();
      if (data.success) {
        await refreshData();
      }
      return data;
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  };

  const deleteSubject = async (id: string) => {
    try {
      const res = await fetch(`/api/subjects?id=${id}`, {
        method: "DELETE"
      });
      const data = await res.json();
      if (data.success) {
        await refreshData();
      }
      return data;
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  };

  const createCollege = async (collegeData: Omit<College, "dept_count" | "mentor_count" | "slot_count">) => {
    try {
      const res = await fetch("/api/colleges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(collegeData)
      });
      const data = await res.json();
      if (data.success) {
        await refreshData();
      }
      return data;
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  };

  const updateCollege = async (collegeData: Omit<College, "dept_count" | "mentor_count" | "slot_count">) => {
    try {
      const res = await fetch("/api/colleges", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(collegeData)
      });
      const data = await res.json();
      if (data.success) {
        await refreshData();
      }
      return data;
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  };

  const deleteCollege = async (id: string) => {
    try {
      const res = await fetch(`/api/colleges?id=${id}`, {
        method: "DELETE"
      });
      const data = await res.json();
      if (data.success) {
        await refreshData();
      }
      return data;
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  };

  const createKAM = async (kamData: { id: string; name: string; email: string; title: string }) => {
    try {
      const res = await fetch("/api/kam", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(kamData)
      });
      const data = await res.json();
      if (data.success) {
        await refreshData();
      }
      return data;
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  };

  const updateKAM = async (kamData: { id: string; name: string; email: string; title: string }) => {
    try {
      const res = await fetch("/api/kam", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(kamData)
      });
      const data = await res.json();
      if (data.success) {
        await refreshData();
      }
      return data;
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  };

  const deleteKAM = async (id: string) => {
    try {
      const res = await fetch(`/api/kam?id=${id}`, {
        method: "DELETE"
      });
      const data = await res.json();
      if (data.success) {
        await refreshData();
      }
      return data;
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  };

  const createCAM = async (camData: { id: string; name: string; email: string; college_id: string; kam_id: string }) => {
    try {
      const res = await fetch("/api/cam", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(camData)
      });
      const data = await res.json();
      if (data.success) {
        await refreshData();
      }
      return data;
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  };

  const updateCAM = async (camData: { id: string; name: string; email: string; college_id: string; kam_id: string }) => {
    try {
      const res = await fetch("/api/cam", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(camData)
      });
      const data = await res.json();
      if (data.success) {
        await refreshData();
      }
      return data;
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  };

  const deleteCAM = async (id: string) => {
    try {
      const res = await fetch(`/api/cam?id=${id}`, {
        method: "DELETE"
      });
      const data = await res.json();
      if (data.success) {
        await refreshData();
      }
      return data;
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  };

  const createCourse = async (course: Omit<Course, "id">) => {
    try {
      const res = await fetch("/api/courses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(course)
      });
      const data = await res.json();
      if (data.success) {
        await refreshData();
      }
      return data;
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  };

  const updateCourse = async (course: Course) => {
    try {
      const res = await fetch("/api/courses", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(course)
      });
      const data = await res.json();
      if (data.success) {
        await refreshData();
      }
      return data;
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  };

  const updateStudent = async (student: Student) => {
    try {
      const res = await fetch("/api/students", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(student)
      });
      const data = await res.json();
      if (data.success) {
        await refreshData();
      }
      return data;
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  };

  const deleteCourse = async (id: string) => {
    try {
      const res = await fetch(`/api/courses?id=${id}`, {
        method: "DELETE"
      });
      const data = await res.json();
      if (data.success) {
        await refreshData();
      }
      return data;
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  };

  const createDepartment = createCourse;
  const updateDepartment = updateCourse;
  const deleteDepartment = deleteCourse;

  const assignWeeklyTask = async (taskData: {
    classGroup: string;
    subject: string;
    weekNumber: number;
    taskName: string;
    taskPdfUrl?: string;
    mentorId: string;
  }) => {
    try {
      const res = await fetch("/api/student-tracker", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "assign_task", ...taskData })
      });
      const data = await res.json();
      if (data.success && data.task) {
        setWeeklyTasks(prev => {
          const filtered = prev.filter(
            t => !(t.class_group === taskData.classGroup && t.subject === taskData.subject && t.week_number === taskData.weekNumber)
          );
          return [...filtered, data.task];
        });
        return { success: true, task: data.task };
      }
      return { success: false, message: data.message || "Failed to assign task." };
    } catch (e: any) {
      console.error("assignWeeklyTask error:", e);
      return { success: false, message: e.message };
    }
  };

  const gradeStudentTask = async (entryData: {
    studentId: string;
    classGroup: string;
    subject: string;
    weekNumber: number;
    submissionUrl?: string;
    vivaAssessment?: string;
    marks?: number;
    gradedBy?: string;
  }) => {
    try {
      const res = await fetch("/api/student-tracker", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "grade_entry", ...entryData })
      });
      const data = await res.json();
      if (data.success && data.entry) {
        setStudentTracker(prev => {
          const filtered = prev.filter(
            e => !(e.student_id === entryData.studentId && e.class_group === entryData.classGroup && e.subject === entryData.subject && e.week_number === entryData.weekNumber)
          );
          return [...filtered, data.entry];
        });
        return { success: true, entry: data.entry };
      }
      return { success: false, message: data.message || "Failed to update grade." };
    } catch (e: any) {
      console.error("gradeStudentTask error:", e);
      return { success: false, message: e.message };
    }
  };

  const saveKamTask = async (task: any) => {
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(task),
      });
      const data = await res.json();
      if (data.success) {
        await refreshData();
        return { success: true, task: data.task };
      }
      return { success: false, message: data.message || "Failed to save task" };
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  };

  const deleteKamTask = async (id: string) => {
    try {
      const res = await fetch(`/api/tasks?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        await refreshData();
        return { success: true };
      }
      return { success: false, message: data.message || "Failed to delete task" };
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  };

  const saveCampusIssue = async (issue: any) => {
    try {
      const res = await fetch("/api/issues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(issue),
      });
      const data = await res.json();
      if (data.success) {
        await refreshData();
        return { success: true, issue: data.issue };
      }
      return { success: false, message: data.message || "Failed to save issue" };
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  };

  const updateCampusIssueStatus = async (id: string, status?: string, resolvedAt?: string, escalated?: boolean, escalatedAt?: string) => {
    try {
      const res = await fetch("/api/issues", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status, resolvedAt, escalated, escalatedAt }),
      });
      const data = await res.json();
      if (data.success) {
        await refreshData();
        return { success: true };
      }
      return { success: false, message: data.message || "Failed to update issue status" };
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  };

  const deleteCampusIssue = async (id: string) => {
    try {
      const res = await fetch(`/api/issues?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        await refreshData();
        return { success: true };
      }
      return { success: false, message: data.message || "Failed to delete issue" };
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  };

  const saveAcademicYear = async (yearName: string) => {
    try {
      const res = await fetch("/api/academic-calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "year", data: { year_name: yearName } }),
      });
      const data = await res.json();
      if (data.success) {
        await refreshData();
        return { success: true };
      }
      return { success: false, message: data.message || "Failed to save year" };
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  };

  const deleteAcademicYear = async (yearName: string) => {
    try {
      const res = await fetch(`/api/academic-calendar?type=year&value=${encodeURIComponent(yearName)}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        await refreshData();
        return { success: true };
      }
      return { success: false, message: data.message || "Failed to delete year" };
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  };

  const saveAcademicEvent = async (event: any) => {
    try {
      const res = await fetch("/api/academic-calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "event", data: event }),
      });
      const data = await res.json();
      if (data.success) {
        await refreshData();
        return { success: true, event: data.event };
      }
      return { success: false, message: data.message || "Failed to save event" };
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  };

  const deleteAcademicEvent = async (id: string) => {
    try {
      const res = await fetch(`/api/academic-calendar?type=event&value=${encodeURIComponent(id)}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        await refreshData();
        return { success: true };
      }
      return { success: false, message: data.message || "Failed to delete event" };
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  };

  const saveFacultyConfig = async (mentorId: string, maxHours: number, shift: string) => {
    try {
      const res = await fetch("/api/faculty-constraints", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mentorId, maxHours, shift }),
      });
      const data = await res.json();
      if (data.success) {
        await refreshData();
        return { success: true };
      }
      return { success: false, message: data.message || "Failed to save config" };
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  };

  const submitSignupRequest = async (reqData: any) => {
    try {
      const res = await fetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(reqData)
      });
      const data = await res.json();
      if (data.success) {
        await refreshData();
        return { success: true, message: data.message };
      }
      return { success: false, message: data.message || "Failed to submit signup request" };
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  };

  const approveSignupRequest = async (id: string, mappingData: any) => {
    try {
      const res = await fetch("/api/admin/signup-requests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action: "approve", ...mappingData })
      });
      const data = await res.json();
      if (data.success) {
        await refreshData();
        return { success: true, message: data.message };
      }
      return { success: false, message: data.message || "Failed to approve request" };
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  };

  const rejectSignupRequest = async (id: string) => {
    try {
      const res = await fetch("/api/admin/signup-requests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action: "reject" })
      });
      const data = await res.json();
      if (data.success) {
        await refreshData();
        return { success: true, message: data.message };
      }
      return { success: false, message: data.message || "Failed to reject request" };
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  };

  const deleteSignupRequest = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/signup-requests?id=${encodeURIComponent(id)}`, {
        method: "DELETE"
      });
      const data = await res.json();
      if (data.success) {
        await refreshData();
        return { success: true, message: data.message };
      }
      return { success: false, message: data.message || "Failed to delete request" };
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  };

  return (
    <AppContext.Provider
      value={{
        mentors,
        slots,
        requests,
        approvedHandovers,
        auditLogs,
        subjectsList,
        colleges,
        smes,
        demoSessions,
        demoRules,
        demoSwapRequests,
        currentRole,
        currentMentor,
        currentHR,
        currentCAM,
        currentKAM,
        currentAdmin,
        currentSME,
        timeSlots: customShiftTimeSlots[currentShift],
        daysOfWeek: DAYS_OF_WEEK,
        weekDates,
        weekOffset,
        setWeekOffset,
        isLoading,
        currentShift,
        setCurrentShift,
        shiftTimeSlots: customShiftTimeSlots,
        getTimeSlots,
        setRole,
        assignSlot,
        deleteSlot,
        updateSlot,
        requestHandover,
        requestSwapCompensate,
        requestBooking,
        handleRequest,
        cancelRequest,
        importCSV,
        clearAllData,
        createMentor,
        updateMentor,
        deleteMentor,
        bookDemoSession,
        evaluateDemoSession,
        correctStudentAttendance,
        bulkBookDemoSessions,
        updateDemoSession,
        swapDemoSessions,
        deleteDemoSession,
        requestDemoSwap,
        resolveDemoSwap,
        generateTimetable,
        clearTimetable,
        createSubject,
        updateSubject,
        deleteSubject,
        createCollege,
        updateCollege,
        deleteCollege,
        createKAM,
        updateKAM,
        deleteKAM,
        createCAM,
        updateCAM,
        deleteCAM,
        departmentsList,
        coursesList,
        createDepartment,
        createCourse,
        updateDepartment,
        updateCourse,
        deleteDepartment,
        deleteCourse,
        refreshData,
        students,
        updateStudent,
        studentAttendance,
        currentStudent,
        markAttendance,
        leaveRequests,
        holidays,
        requestLeave,
        handleLeaveRequest,
        weeklyTasks,
        studentTracker,
        assignWeeklyTask,
        gradeStudentTask,
        subjectGroups,
        createSubjectGroup,
        updateSubjectGroup,
        deleteSubjectGroup,
        updateSmeSubjectGroup,
        createSmeUser,
        updateSmeUser,
        deleteSmeUser,
        createDemoRule,
        deleteDemoRule,
        kamTasks,
        campusIssues,
        academicYears,
        academicEvents,
        facultyWorkloadLimits,
        facultyShifts,
        saveKamTask,
        deleteKamTask,
        saveCampusIssue,
        updateCampusIssueStatus,
        deleteCampusIssue,
        saveAcademicYear,
        deleteAcademicYear,
        saveAcademicEvent,
        deleteAcademicEvent,
        saveFacultyConfig,
        signupRequests,
        submitSignupRequest,
        approveSignupRequest,
        rejectSignupRequest,
        deleteSignupRequest
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error("useApp must be used within an AppProvider");
  }
  return context;
};
