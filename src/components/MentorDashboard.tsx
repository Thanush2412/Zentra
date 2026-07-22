"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useApp, Slot, Mentor, ApprovedHandover, Holiday } from "@/context/AppContext";
import { useToast } from "@/context/ToastContext";
import {
  Calendar,
  Clock,
  MapPin,
  Plus,
  ListTodo,
  Send,
  AlertCircle,
  X,
  UserCheck,
  CalendarCheck2,
  CheckCircle,
  XCircle,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  BookOpen,
  Filter,
  User,
  Search,
  Home,
  Sparkles,
  MinusCircle,
  PlusCircle,
  ClipboardList,
  GraduationCap,
  Upload,
  FileText,
  Users,
  RefreshCw,
  Check,
  Menu,
  Download,
  Lock
} from "lucide-react";
import * as XLSX from "xlsx";
import { formatDate, formatTimeLabel, isSubjectNameMatch, resolveClassGroupDetailsFromState, parseDbDate } from "@/lib/utils";
import { MentorProfileModal } from "./MentorProfileModal";

export interface MentorDashboardProps {
  activeTab?: "home" | "timetable" | "handovers" | "attendance" | "profile" | "tracker" | "demo_evaluations" | "more_menu";
  onTabChange?: (tab: "home" | "timetable" | "handovers" | "attendance" | "profile" | "tracker" | "demo_evaluations" | "more_menu") => void;
}

export const MentorDashboard: React.FC<MentorDashboardProps> = ({
  activeTab: propActiveTab,
  onTabChange
}) => {
  const {
    slots,
    requests,
    approvedHandovers,
    mentors,
    currentMentor,
    timeSlots,
    weekDates,
    weekOffset,
    setWeekOffset,
    requestHandover,
    requestSwapCompensate,
    requestBooking,
    handleRequest,
    cancelRequest,
    currentShift,
    setCurrentShift,
    subjectsList,
    coursesList,
    students,
    studentAttendance,
    markAttendance,
    refreshData,
    holidays,
    leaveRequests,
    weeklyTasks,
    studentTracker,
    assignWeeklyTask,
    gradeStudentTask,
    demoSessions,
    demoSwapRequests,
    resolveDemoSwap,
    requestDemoSwap,
    colleges
  } = useApp();
  const { toast, confirm: showConfirm } = useToast();

  const [dailyConfigsList, setDailyConfigsList] = useState<any[]>([]);

  // Fetch fresh data on mount so generated timetables are immediately visible
  useEffect(() => {
    refreshData();
    setWeekOffset(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (currentMentor?.college_id) {
      fetch(`/api/daily-configs?college_id=${currentMentor.college_id}`)
        .then(res => res.json())
        .then(data => {
          if (data.success && data.configs) {
            setDailyConfigsList(data.configs);
          }
        })
        .catch(err => console.error("Error fetching daily configs:", err));
    }
  }, [currentMentor]);



  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [selectedCell, setSelectedCell] = useState<{
    day: string;
    dateStr: string;
    dateFormatted: string;
    time: string;
    slot?: Slot;
    type?: "own" | "covering";
    originalMentorId?: string;
    handover?: ApprovedHandover;
  } | null>(null);

  // Handover & Attendance form state
  const [modalTab, setModalTab] = useState<"attendance" | "handover">("attendance");
  const [localAttendance, setLocalAttendance] = useState<Record<string, "present" | "absent" | "od" | "not_marked">>({});
  const [originalAttendance, setOriginalAttendance] = useState<Record<string, "present" | "absent" | "od" | "not_marked">>({});
  const [isSubmittingAttendance, setIsSubmittingAttendance] = useState(false);
  const [targetStaffId, setTargetStaffId] = useState<string>("");
  const [reasonText, setReasonText] = useState("");
  const [formError, setFormError] = useState("");
  const [modalSemester, setModalSemester] = useState<string>("Semester 1");
  const [handoverSubject, setHandoverSubject] = useState<string>("original"); // "original" | "substitute_own" | "custom"
  const [selectedSubjName, setSelectedSubjName] = useState<string>("");
  const [customSubjName, setCustomSubjName] = useState<string>("");
  const [reviewingRequestId, setReviewingRequestId] = useState<string | null>(null);
  const [reviewReason, setReviewReason] = useState("");
  const [attendanceType, setAttendanceType] = useState<"Regular" | "Non-Regular">("Regular");
  const [attendanceMode, setAttendanceMode] = useState<"Online" | "Offline">("Offline");
  const [attendanceTypeSub, setAttendanceTypeSub] = useState<string>("Event");
  const [attendanceStep, setAttendanceStep] = useState<1 | 2 | 3>(1);
  // Target Classes Filter State
  const [selectedClassFilter, setSelectedClassFilter] = useState<string | null>(null);

  // Agenda Widget Day State (defaults to current day during week, fallback to Monday on weekends)
  const [agendaDay, setAgendaDay] = useState<string>(() => {
    const dayIndex = new Date().getDay();
    if (dayIndex === 0 || dayIndex === 6) return "Monday";
    return ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][dayIndex];
  });

  // ── Swap-to-Compensate Modal State ─────────────────────────────────────────
  interface SwapTarget {
    otherMentorId: string;
    otherMentorName: string;
    subject: string;
    month: string;
    balance: number;
    compensatesHandoverId?: string;
  }
  const [swapModalOpen, setSwapModalOpen] = useState(false);
  const [swapTarget, setSwapTarget] = useState<SwapTarget | null>(null);
  const [swapOfferSlotId, setSwapOfferSlotId] = useState<string>("");
  const [swapOfferWeekDate, setSwapOfferWeekDate] = useState<string>(""); // YYYY-MM-DD
  const [swapReason, setSwapReason] = useState("");
  const [swapSubmitting, setSwapSubmitting] = useState(false);
  const [swapError, setSwapError] = useState("");
  const [swapGridWeekOffset, setSwapGridWeekOffset] = useState(0);
  const [swapSuccess, setSwapSuccess] = useState("");

  // Mentor Demo Swap state hooks
  const [demoSwapModalSession, setDemoSwapModalSession] = useState<any | null>(null);
  const [demoSwapReason, setDemoSwapReason] = useState<string>("I am unavailable");
  const [demoSwapRemarks, setDemoSwapRemarks] = useState<string>("");
  const [demoSwapStep, setDemoSwapStep] = useState<number>(1);
  const [selectedProposedPeer, setSelectedProposedPeer] = useState<any | null>(null);
  const [demoSwapSubmitting, setDemoSwapSubmitting] = useState<boolean>(false);

  // Find peer mentors within same college/subject free at this slot
  const getInternalSwapRecommendations = (demo: any) => {
    if (!demo || !currentMentor) return [];

    const subjectGroup = demo.subject;

    const uniqueSlots = new Set<string>();
    slots.forEach(s => {
      if (s.time) uniqueSlots.add(s.time.trim());
    });
    const parseTimeToMinutes = (t: string) => {
      const match = t.match(/^(\d+)(?:\.(\d+))?\s*(AM|PM)/i);
      if (!match) return 9999;
      let hr = parseInt(match[1]);
      const min = match[2] ? parseInt(match[2]) : 0;
      const isPm = match[3].toUpperCase() === "PM";
      if (isPm && hr < 12) hr += 12;
      if (!isPm && hr === 12) hr = 0;
      return hr * 60 + min;
    };
    const derivedTimeSlots = Array.from(uniqueSlots).sort((a, b) => parseTimeToMinutes(a) - parseTimeToMinutes(b));

    const peerMentors = mentors.filter(m => 
      m.college_id === currentMentor.college_id &&
      m.id !== currentMentor.id &&
      m.subject_group?.toLowerCase().trim() === subjectGroup.toLowerCase().trim()
    );

    const candidates: any[] = [];
    peerMentors.forEach(m => {
      const isOnLeave = leaveRequests?.some((l: any) => l.mentorId === m.id && l.dateStr === demo.dateStr && l.status === "approved");
      if (isOnLeave) return;

      const dayName = weekDates.find(w => w.dateStr === demo.dateStr)?.day || "";
      const hasClass = slots.some(s => s.mentorId === m.id && s.day === dayName && s.time === demo.timeSlot);
      if (hasClass) return;

      const hasDemo = demoSessions.some(ds => ds.mentorId === m.id && ds.dateStr === demo.dateStr && ds.timeSlot === demo.timeSlot);
      if (hasDemo) return;

      const dailyLoad = demoSessions.filter(ds => ds.mentorId === m.id && ds.dateStr === demo.dateStr).length;
      if (dailyLoad >= 2) return;

      const idx = derivedTimeSlots.indexOf(demo.timeSlot);
      let consecutiveClash = false;
      if (idx !== -1) {
        const prevSlot = idx > 0 ? derivedTimeSlots[idx - 1] : "";
        const nextSlot = idx < derivedTimeSlots.length - 1 ? derivedTimeSlots[idx + 1] : "";
        const hasPrev = prevSlot && demoSessions.some(ds => ds.mentorId === m.id && ds.dateStr === demo.dateStr && ds.timeSlot === prevSlot);
        const hasNext = nextSlot && demoSessions.some(ds => ds.mentorId === m.id && ds.dateStr === demo.dateStr && ds.timeSlot === nextSlot);
        if (hasPrev || hasNext) consecutiveClash = true;
      }
      if (consecutiveClash) return;

      const weeklyLoad = demoSessions.filter(ds => ds.mentorId === m.id).length;

      candidates.push({
        mentorId: m.id,
        mentorName: m.name,
        subjectGroup: m.subject_group || "General",
        weeklyCount: weeklyLoad,
        score: 100 - (weeklyLoad * 5)
      });
    });

    return candidates.sort((a, b) => b.score - a.score);
  };

  const handleSubmitInternalSwap = async () => {
    if (!demoSwapModalSession || !selectedProposedPeer) return;

    setDemoSwapSubmitting(true);

    const payload = {
      sessionId: demoSwapModalSession.id,
      mentorId: demoSwapModalSession.mentorId,
      mentorName: demoSwapModalSession.mentorName,
      smeId: demoSwapModalSession.smeId,
      smeName: demoSwapModalSession.smeName,
      dateStr: demoSwapModalSession.dateStr,
      timeSlot: demoSwapModalSession.timeSlot,
      subject: demoSwapModalSession.subject,
      stream: demoSwapModalSession.stream,
      reason: demoSwapReason,
      remarks: demoSwapRemarks,
      swapType: "internal",
      proposedMentorId: selectedProposedPeer.mentorId,
      proposedMentorName: selectedProposedPeer.mentorName,
      proposedSmeId: demoSwapModalSession.smeId,
      proposedSmeName: demoSwapModalSession.smeName,
      proposedDateStr: demoSwapModalSession.dateStr,
      proposedTimeSlot: demoSwapModalSession.timeSlot
    };

    try {
      const res = await requestDemoSwap(payload);
      if (res.success) {
        toast("Internal swap request submitted to peer mentor successfully!", "success");
        setDemoSwapModalSession(null);
      } else {
        toast(res.message, "error");
      }
    } catch (e: any) {
      toast("An unexpected error occurred while requesting swap.", "error");
    } finally {
      setDemoSwapSubmitting(false);
    }
  };

  // Timetable Status Filter State
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<"active" | "pending" | "handover" | null>(null);

  // Timetable Location Filter State
  const [selectedLocationFilter, setSelectedLocationFilter] = useState<string | null>(null);

  // Active Dashboard Tab State
  const [localActiveTab, setLocalActiveTab] = useState<"home" | "timetable" | "handovers" | "attendance" | "profile" | "tracker" | "demo_evaluations" | "more_menu">("home");
  const activeTab = propActiveTab || localActiveTab;
  const setActiveTab = onTabChange || setLocalActiveTab;

  const [isCollapsed, setIsCollapsed] = useState(false);
  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("fp_sidebar_collapsed") === "true";
      setIsCollapsed(stored);
    }
  }, []);

  // Student Tracker filter and management states
  const mentorClasses = useMemo(() => {
    let rawItems: string[] = [];
    if (currentMentor?.classes) {
      rawItems = currentMentor.classes.split(/,|\n/).map((c: string) => c.trim()).filter(Boolean);
    }

    // Fallback 1: Check slots assigned to this mentor
    if (rawItems.length === 0 && currentMentor?.id) {
      const slotClasses = slots
        .filter(s => s.mentorId === currentMentor.id)
        .map(s => s.classGroup)
        .filter((cg): cg is string => Boolean(cg));
      rawItems = Array.from(new Set(slotClasses));
    }

    // Fallback 2: Check active student class groups in students table
    if (rawItems.length === 0 && students.length > 0) {
      const deptLower = currentMentor?.department ? currentMentor.department.toLowerCase().trim() : "";
      const studentClasses = students
        .filter(s => {
          if (!s.classGroup) return false;
          if (s.college_id && currentMentor?.college_id && s.college_id !== currentMentor.college_id) return false;
          if (!deptLower) return true;
          const sDept = (s.department || "").toLowerCase().trim();
          const sCg = s.classGroup.toLowerCase();
          return sDept.includes(deptLower) || deptLower.includes(sDept) || sCg.includes(deptLower) || deptLower.includes(sCg);
        })
        .map(s => s.classGroup)
        .filter((cg): cg is string => Boolean(cg));

      if (studentClasses.length > 0) {
        rawItems = Array.from(new Set(studentClasses));
      }
    }

    // Fallback 3: Check courses/departments in campus matching mentor's department
    if (rawItems.length === 0 && currentMentor?.department) {
      const deptLower = currentMentor.department.toLowerCase().trim();
      const matchingCourses = coursesList
        .filter(c => c.college_id === currentMentor.college_id || !c.college_id)
        .filter(c => c.name.toLowerCase().includes(deptLower) || deptLower.includes(c.name.toLowerCase()));

      const deptNames = matchingCourses.length > 0 ? matchingCourses.map(c => c.name) : [currentMentor.department];
      const sems = ["Semester 1", "Semester 2", "Semester 3", "Semester 4", "Semester 5", "Semester 6"];
      const shifts = currentMentor.shift === "shift_2" ? ["Shift 2"] : currentMentor.shift === "shift_1" ? ["Shift 1"] : ["Shift 1", "Shift 2"];

      deptNames.forEach(d => {
        shifts.forEach(sh => {
          sems.forEach(sem => {
            rawItems.push(`${d} - ${sh} - ${sem}`);
          });
        });
      });
    }

    const seenSignatures = new Set<string>();
    const cleaned: string[] = [];

    // Sort by length descending to prioritize most specific, full canonical names
    const sortedItems = [...rawItems].sort((a, b) => b.length - a.length);

    for (const item of sortedItems) {
      const lower = item.toLowerCase();
      const semMatch = lower.match(/sem(?:ester)?\s*([0-9ivx]+)/i);
      const semKey = semMatch ? semMatch[1] : "";
      const shiftKey = lower.includes("shift 1") || lower.includes("shift_1") ? "s1" : lower.includes("shift 2") || lower.includes("shift_2") ? "s2" : "";
      const deptKey = lower.includes("cs") || lower.includes("computer") ? "cs" : lower.includes("ds") || lower.includes("data") ? "ds" : lower.includes("it") ? "it" : lower.includes("com") ? "com" : lower.slice(0, 10);

      const sig = `${deptKey}_${shiftKey}_${semKey}`;
      if (!seenSignatures.has(sig)) {
        seenSignatures.add(sig);
        cleaned.push(item);
      }
    }
    return cleaned;
  }, [currentMentor, slots, coursesList]);

  const mentorSubjects = useMemo(() => {
    let rawSubjects: string[] = [];
    if (currentMentor?.subjects) {
      rawSubjects = currentMentor.subjects.split(/,|\n/).map((s: string) => s.trim()).filter(Boolean);
    }

    // Fallback 1: Check slots assigned to this mentor
    if (rawSubjects.length === 0 && currentMentor?.id) {
      const slotSubjs = slots
        .filter(s => s.mentorId === currentMentor.id)
        .map(s => s.course)
        .filter(Boolean);
      rawSubjects = Array.from(new Set(slotSubjs));
    }

    // Fallback 2: Check subjects matching mentor's department in subjectsList
    if (rawSubjects.length === 0 && currentMentor?.department) {
      const deptLower = currentMentor.department.toLowerCase().trim();
      const deptSubjs = subjectsList
        .filter(s => (s.college_id === currentMentor.college_id || !s.college_id) &&
                     s.department && (s.department.toLowerCase().includes(deptLower) || deptLower.includes(s.department.toLowerCase())))
        .map(s => s.name);
      rawSubjects = Array.from(new Set(deptSubjs));
    }

    return Array.from(new Set(rawSubjects));
  }, [currentMentor, slots, subjectsList]);

  const [trackerClassGroup, setTrackerClassGroup] = useState<string>("");
  const [trackerSubject, setTrackerSubject] = useState<string>("");
  const [trackerWeek, setTrackerWeek] = useState<number>(1);
  const [trackerTaskName, setTrackerTaskName] = useState("");
  const [trackerUploadType, setTrackerUploadType] = useState<"url" | "file">("url");
  const [trackerTaskPdf, setTrackerTaskPdf] = useState("");
  const [editingTask, setEditingTask] = useState(false);
  const [trackerSearchTerm, setTrackerSearchTerm] = useState("");
  const [trackerStatusFilter, setTrackerStatusFilter] = useState("all");
  const [saveStatusMap, setSaveStatusMap] = useState<Record<string, "idle" | "saving" | "saved" | "error">>({});

  const filteredMentorSubjects = useMemo(() => {
    if (!trackerClassGroup) return mentorSubjects;
    
    // 1. Check slots for this mentor in this exact classGroup
    if (currentMentor?.id) {
      const slotSubjs = slots
        .filter(s => s.mentorId === currentMentor.id && s.classGroup === trackerClassGroup)
        .map(s => s.course)
        .filter(Boolean);
      const uniqueSlotSubjs = Array.from(new Set(slotSubjs));
      if (uniqueSlotSubjs.length > 0) return uniqueSlotSubjs;
    }

    // 2. Filter mentorSubjects by semester of trackerClassGroup
    const semMatch = trackerClassGroup.toLowerCase().match(/sem(?:ester)?\s*([0-9ivx]+)/i);
    const semNum = semMatch ? semMatch[1] : "";
    
    if (semNum) {
      const matchedBySem = mentorSubjects.filter(subName => {
        const subObj = subjectsList.find(s => s.name.toLowerCase() === subName.toLowerCase());
        if (!subObj || !subObj.semester) return true;
        const subSemMatch = subObj.semester.toLowerCase().match(/sem(?:ester)?\s*([0-9ivx]+)/i);
        const subSemNum = subSemMatch ? subSemMatch[1] : "";
        return !subSemNum || subSemNum === semNum;
      });
      if (matchedBySem.length > 0) return matchedBySem;
    }

    return mentorSubjects;
  }, [trackerClassGroup, currentMentor, slots, mentorSubjects, subjectsList]);

  // Keep trackerSubject in sync whenever trackerClassGroup changes
  useEffect(() => {
    if (filteredMentorSubjects.length > 0 && !filteredMentorSubjects.includes(trackerSubject)) {
      setTrackerSubject(filteredMentorSubjects[0]);
    }
  }, [trackerClassGroup, filteredMentorSubjects, trackerSubject]);

  useEffect(() => {
    if (mentorClasses.length > 0 && !trackerClassGroup) {
      setTrackerClassGroup(mentorClasses[0]);
    }
    if (filteredMentorSubjects.length > 0 && !trackerSubject) {
      setTrackerSubject(filteredMentorSubjects[0]);
    }
  }, [currentMentor, mentorClasses, filteredMentorSubjects, trackerClassGroup, trackerSubject]);

  // Attendance Search and Range Select States
  const [attendanceSearchTerm, setAttendanceSearchTerm] = useState("");
  const [attendanceHistorySearch, setAttendanceHistorySearch] = useState("");
  
  // End of Semester Calculator States
  const [calcCohort, setCalcCohort] = useState("");
  const [calcStartDate, setCalcStartDate] = useState("2026-06-01");
  const [calcEndDate, setCalcEndDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [attendanceLogsSubTab, setAttendanceLogsSubTab] = useState<"history" | "calculator">("history");
  
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [lastCheckedId, setLastCheckedId] = useState<string | null>(null);
  const [isRangeOpen, setIsRangeOpen] = useState(false);
  const [rangeStartId, setRangeStartId] = useState("");
  const [rangeEndId, setRangeEndId] = useState("");



  // Helper to parse class group name and semester
  const parseClassGroup = (classGroup?: string) => {
    if (!classGroup) return { name: "General Class", sem: "" };
    const { department, semester } = resolveClassGroupDetailsFromState(classGroup, subjectsList, coursesList);
    const num = parseInt(semester.replace(/[^0-9]/g, ""), 10);
    const roman = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII"][num] || "";
    const semDisplay = roman ? `SEM ${roman}` : semester;
    return { name: department, sem: semDisplay };
  };

  // Helper to dynamically match class group to DB course
  const findCourseForClassGroup = (classGroup?: string) => {
    if (!classGroup) return null;
    const cgLower = classGroup.toLowerCase().trim();
    const sortedCourses = [...coursesList].sort((a, b) => b.name.length - a.name.length);
    for (const course of sortedCourses) {
      const courseNameLower = course.name.toLowerCase().trim();
      const courseCodeLower = (course.code || "").toLowerCase().trim();
      if (cgLower.includes(courseNameLower) || (courseCodeLower && cgLower.includes(courseCodeLower))) {
        return course;
      }
    }
    return null;
  };

  // Helper to get short class group name and semester
  const getShortClassGroup = (classGroup?: string) => {
    if (!classGroup) return { name: "General Class", sem: "" };
    
    const { name, sem } = parseClassGroup(classGroup);
    const course = findCourseForClassGroup(classGroup);
    let dept = course ? course.name : name;
    
    const c = classGroup.toLowerCase();
    if (c.includes("shift 1") || c.includes("shift-1") || c.includes("s1")) {
      dept += " (S1)";
    } else if (c.includes("shift 2") || c.includes("shift-2") || c.includes("s2")) {
      dept += " (S2)";
    }
    
    return { name: dept, sem };
  };

  // Helper to get semester name from a class string (for the buttons)
  const getSemForClass = (cls?: string) => {
    if (!cls) return "";
    const { semester } = resolveClassGroupDetailsFromState(cls, subjectsList, coursesList);
    const num = parseInt(semester.replace(/[^0-9]/g, ""), 10);
    const roman = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII"][num] || "";
    return roman ? `Sem ${roman}` : semester;
  };

  // Helper to match class group names with normalized comparison
  const isClassGroupMatch = (cg1?: string, cg2?: string) => {
    if (!cg1 || !cg2) return false;
    
    const clean1 = cg1.toLowerCase().trim();
    const clean2 = cg2.toLowerCase().trim();
    
    if (clean1 === clean2) return true;
    
    const course1 = findCourseForClassGroup(cg1);
    const course2 = findCourseForClassGroup(cg2);
    
    const s1 = getSemForClass(cg1);
    const s2 = getSemForClass(cg2);
    
    // If the resolved DB courses match, and the normalized semesters match, it's a match!
    if (course1 && course2 && course1.id === course2.id) {
      if (s1 && s2 && s1.toLowerCase() === s2.toLowerCase()) {
        return true;
      }
    }
    
    // Fallback: name comparison if courses aren't resolved
    const { name: name1 } = getShortClassGroup(cg1);
    const { name: name2 } = getShortClassGroup(cg2);
    if (name1 && name2 && name1.toLowerCase() === name2.toLowerCase()) {
      if (s1 && s2 && s1.toLowerCase() === s2.toLowerCase()) {
        return true;
      }
    }
    
    return false;
  };

  const getShortSemLabel = (semStr: string): string => {
    if (!semStr) return "";
    const s = semStr.toLowerCase();
    if (s.includes("vi") || s.includes("6")) return "Sem VI";
    if (s.includes("iv") || s.includes("4")) return "Sem IV";
    if (s.includes("v") || s.includes("5")) return "Sem V";
    if (s.includes("iii") || s.includes("3")) return "Sem III";
    if (s.includes("ii") || s.includes("2")) return "Sem II";
    if (s.includes("i") || s.includes("1")) return "Sem I";
    return semStr;
  };

  const getYearForClass = (classGroup?: string) => {
    if (!classGroup) return "";
    const cg = classGroup.toLowerCase();
    
    // 1. Check explicit semester numbers
    if (cg.includes("sem vi") || cg.includes("sem 6") || cg.includes("semester vi") || cg.includes("semester 6")) return "3rd Year";
    if (cg.includes("sem v") || cg.includes("sem 5") || cg.includes("semester v") || cg.includes("semester 5")) return "3rd Year";
    if (cg.includes("sem iv") || cg.includes("sem 4") || cg.includes("semester iv") || cg.includes("semester 4")) return "2nd Year";
    if (cg.includes("sem iii") || cg.includes("sem 3") || cg.includes("semester iii") || cg.includes("semester 3")) return "2nd Year";
    if (cg.includes("sem ii") || cg.includes("sem 2") || cg.includes("semester ii") || cg.includes("semester 2")) return "1st Year";
    if (cg.includes("sem i") || cg.includes("sem 1") || cg.includes("semester i") || cg.includes("semester 1")) return "1st Year";
    
    // 2. Check by cohort year in parentheses (fallback)
    if (cg.includes("2026-2029")) return "1st Year";
    if (cg.includes("2025-2028")) return "2nd Year";
    if (cg.includes("2024-2027")) return "3rd Year";
    
    // 3. Fallback to explicit year strings
    if (cg.includes("3rd year") || cg.includes("3rdyr") || cg.includes("3rd yr") || cg.includes("3nd year") || cg.includes("3ndyr")) return "3rd Year";
    if (cg.includes("2nd year") || cg.includes("2ndyr") || cg.includes("2nd yr")) return "2nd Year";
    if (cg.includes("1st year") || cg.includes("1styr") || cg.includes("1st yr") || cg.includes("1nd year") || cg.includes("1ndyr")) return "1st Year";
    
    return "";
  };

  const getClassGroupLabel = (classGroup?: string) => {
    if (!classGroup) return "";
    const { name: shortDept, sem: shortSem } = getShortClassGroup(classGroup);
    const yearStr = getYearForClass(classGroup);
    const calculatedSem = shortSem || getSemForClass(classGroup);
    return `${shortDept}${yearStr ? ` ${yearStr}` : ""}${calculatedSem ? ` (${calculatedSem})` : ""}`;
  };

  // Parse the START time from a slot time string (e.g. "8.20 AM - 9.10 AM", "9.00 A.M to 10.00 A.M")
  const parseSlotStartTime = (timeStr: string): Date | null => {
    const match = timeStr.match(/(\d{1,2})[.:]\s*(\d{2})\s*(A\.?M\.?|P\.?M\.?)/i);
    if (!match) return null;
    let hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    const period = match[3].replace(/\./g, "").toUpperCase();
    if (period === "PM" && hours !== 12) hours += 12;
    if (period === "AM" && hours === 12) hours = 0;
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes, 0);
  };

  const parseSlotStartTimeForDate = (timeStr: string, dateStr: string): Date | null => {
    const match = timeStr.match(/(\d{1,2})[.:]\s*(\d{2})\s*(A\.?M\.?|P\.?M\.?)/i);
    if (!match) return null;
    let hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    const period = match[3].replace(/\./g, "").toUpperCase();
    if (period === "PM" && hours !== 12) hours += 12;
    if (period === "AM" && hours === 12) hours = 0;

    let year = new Date().getFullYear();
    let month = new Date().getMonth();
    let day = new Date().getDate();

    if (dateStr.includes("-")) {
      const parts = dateStr.split("-");
      if (parts.length === 3) {
        year = parseInt(parts[0], 10);
        month = parseInt(parts[1], 10) - 1;
        day = parseInt(parts[2], 10);
      }
    } else {
      const parts = dateStr.split(" ");
      if (parts.length >= 2) {
        day = parseInt(parts[0], 10);
        const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
        const mName = parts[1].substring(0,3);
        const mIdx = monthNames.findIndex(m => m.toLowerCase() === mName.toLowerCase());
        if (mIdx !== -1) month = mIdx;
        if (parts.length >= 3) year = parseInt(parts[2], 10);
      }
    }

    return new Date(year, month, day, hours, minutes, 0);
  };

  const checkAttendanceWindow = (dateStr: string, timeStr: string) => {
    const startTime = parseSlotStartTimeForDate(timeStr, dateStr);
    if (!startTime) return { open: true };

    const now = new Date();
    if (now < startTime) {
      return { open: false, reason: "future", message: "Class has not started yet." };
    }

    const durationLimit = 12 * 60 * 60 * 1000;
    const endTime = new Date(startTime.getTime() + durationLimit);

    if (now > endTime) {
      return { 
        open: false, 
        reason: "expired", 
        message: `Attendance window is closed. It locked on ${endTime.toLocaleDateString("en-GB", {day:'numeric', month:'short'})} at ${endTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} (12 hours after class start).` 
      };
    }

    return { open: true };
  };

  // Helper to filter slots matching active class button
  const doesClassMatchFilter = (classGroup?: string, filter?: string | null) => {
    if (!filter) return true;
    if (!classGroup) return false;
    return getClassGroupLabel(classGroup) === filter;
  };

  const getSemesterFromSlot = (slot: Slot): string => {
    if (slot.classGroup) {
      const parsed = parseClassGroup(slot.classGroup);
      if (parsed.sem) {
        const s = parsed.sem.toLowerCase();
        if (s.includes("sem vi") || s.includes("semester vi") || s.includes("semester 6") || s.includes("sem 6")) return "Semester 6";
        if (s.includes("sem v") || s.includes("semester v") || s.includes("semester 5") || s.includes("sem 5")) return "Semester 5";
        if (s.includes("sem iv") || s.includes("semester iv") || s.includes("semester 4") || s.includes("sem 4")) return "Semester 4";
        if (s.includes("sem iii") || s.includes("semester iii") || s.includes("semester 3") || s.includes("sem 3")) return "Semester 3";
        if (s.includes("sem ii") || s.includes("semester ii") || s.includes("semester 2") || s.includes("sem 2")) return "Semester 2";
        if (s.includes("sem i") || s.includes("semester i") || s.includes("semester 1") || s.includes("sem 1")) return "Semester 1";
      }
      
      const year = getYearForClass(slot.classGroup);
      if (slot.course) {
        const subjectObj = subjectsList.find(sub => isSubjectNameMatch(sub.name, slot.course));
        if (subjectObj && subjectObj.semester) {
          const semNum = subjectObj.semester.match(/\d+/);
          if (semNum) return `Semester ${semNum[0]}`;
        }
      }

      if (year === "1st Year") return "Semester 1";
      if (year === "2nd Year") return "Semester 3";
      if (year === "3rd Year") return "Semester 5";
    }

    if (slot.course) {
      const subjectObj = subjectsList.find(sub => isSubjectNameMatch(sub.name, slot.course));
      if (subjectObj && subjectObj.semester) {
        const semNum = subjectObj.semester.match(/\d+/);
        if (semNum) return `Semester ${semNum[0]}`;
      }
    }
    
    return "Semester 1";
  };

  const mentorMatchesSemester = (mentor: Mentor, semester: string): boolean => {
    const targetNormSem = semester.toLowerCase().replace(/\s+/g, ""); // e.g. "semester1", "semester3", "semester5"
    if (!targetNormSem) return true;

    const normalizeSemName = (semName: string): string => {
      const s = semName.toLowerCase();
      if (s.includes("sem vi") || s.includes("semester vi") || s.includes("semester 6") || s.includes("sem 6")) return "semester6";
      if (s.includes("sem v") || s.includes("semester v") || s.includes("semester 5") || s.includes("sem 5")) return "semester5";
      if (s.includes("sem iv") || s.includes("semester iv") || s.includes("semester 4") || s.includes("sem 4")) return "semester4";
      if (s.includes("sem iii") || s.includes("semester iii") || s.includes("semester 3") || s.includes("sem 3")) return "semester3";
      if (s.includes("sem ii") || s.includes("semester ii") || s.includes("semester 2") || s.includes("sem 2")) return "semester2";
      if (s.includes("sem i") || s.includes("semester i") || s.includes("semester 1") || s.includes("sem 1")) return "semester1";
      return "";
    };

    // 1. Check current slots assigned to this mentor
    const mentorSlots = slots.filter(s => s.mentorId === mentor.id);
    const hasMatchingSlot = mentorSlots.some(slot => {
      if (slot.classGroup) {
        const parsed = parseClassGroup(slot.classGroup);
        if (parsed.sem && normalizeSemName(parsed.sem) === targetNormSem) {
          return true;
        }
        const year = getYearForClass(slot.classGroup);
        if (year === "1st Year" && (targetNormSem === "semester1" || targetNormSem === "semester2")) return true;
        if (year === "2nd Year" && (targetNormSem === "semester3" || targetNormSem === "semester4")) return true;
        if (year === "3rd Year" && (targetNormSem === "semester5" || targetNormSem === "semester6")) return true;
      }
      if (slot.course) {
        const subjectObj = subjectsList.find(sub => isSubjectNameMatch(sub.name, slot.course));
        if (subjectObj && subjectObj.semester && normalizeSemName(subjectObj.semester) === targetNormSem) {
          return true;
        }
      }
      return false;
    });

    if (hasMatchingSlot) return true;

    // 2. Check mentor's profile classes field
    if (mentor.classes) {
      const classesLines = mentor.classes.split("\n").map(c => c.trim().toLowerCase()).filter(Boolean);
      const hasMatchingClass = classesLines.some(line => {
        if ((targetNormSem === "semester1" || targetNormSem === "semester2") && (line.includes("1st year") || line.includes("1styr") || line.includes("1st yr") || line.includes("1nd year") || line.includes("1ndyr"))) {
          return true;
        }
        if ((targetNormSem === "semester3" || targetNormSem === "semester4") && (line.includes("2nd year") || line.includes("2ndyr") || line.includes("2nd yr"))) {
          return true;
        }
        if ((targetNormSem === "semester5" || targetNormSem === "semester6") && (line.includes("3rd year") || line.includes("3rdyr") || line.includes("3rd yr") || line.includes("3nd year") || line.includes("3ndyr"))) {
          return true;
        }
        const lineSem = normalizeSemName(line);
        if (lineSem === targetNormSem) return true;
        return false;
      });
      if (hasMatchingClass) return true;
    }

    // 3. Check mentor's profile subjects field
    if (mentor.subjects) {
      const subjectLines = mentor.subjects.split(/\n|\/|,|;/).map(s => s.trim()).filter(Boolean);
      const hasMatchingSubject = subjectLines.some(line => {
        const match = subjectsList.find(sub => isSubjectNameMatch(sub.name, line));
        if (match && match.semester && normalizeSemName(match.semester) === targetNormSem) {
          return true;
        }
        return false;
      });
      if (hasMatchingSubject) return true;
    }

    return false;
  };

  const getCoveringStaffOptions = (slot: Slot) => {
    if (!currentMentor) return { sorted: [], classGroupMentorIds: new Set<string>(), classGroupMentorSubjects: new Map<string, string[]>() };
    const myId = currentMentor.id;
    const myDept = currentMentor.department;

    // 1. Get all mentors in the same department (excluding current mentor)
    const sameDeptMentors = mentors.filter(m => m.id !== myId && m.department === myDept);
    
    // 2. Get all mentors who teach the same class group (excluding current mentor) and their subjects
    const classGroupMentorIds = new Set<string>();
    const classGroupMentorSubjects = new Map<string, string[]>();
    if (slot.classGroup) {
      slots.forEach(s => {
        if (s.classGroup === slot.classGroup && s.mentorId !== myId) {
          classGroupMentorIds.add(s.mentorId);
          if (s.course) {
            const subs = classGroupMentorSubjects.get(s.mentorId) || [];
            if (!subs.includes(s.course)) {
              subs.push(s.course);
            }
            classGroupMentorSubjects.set(s.mentorId, subs);
          }
        }
      });
    }
    const classGroupMentors = mentors.filter(m => classGroupMentorIds.has(m.id));
    
    // Combine them
    const combined = new Map<string, Mentor>();
    
    // Add class group mentors first
    classGroupMentors.forEach(m => combined.set(m.id, m));
    // Add department mentors
    sameDeptMentors.forEach(m => combined.set(m.id, m));
    
    const list = Array.from(combined.values());
    
    // Sort
    const sorted = [...list].sort((a, b) => {
      const aIsClassGroup = classGroupMentorIds.has(a.id) ? 1 : 0;
      const bIsClassGroup = classGroupMentorIds.has(b.id) ? 1 : 0;
      
      if (aIsClassGroup !== bIsClassGroup) {
        return bIsClassGroup - aIsClassGroup; // class group mentors first
      }
      
      const aMatch = mentorMatchesSemester(a, modalSemester) ? 1 : 0;
      const bMatch = mentorMatchesSemester(b, modalSemester) ? 1 : 0;
      return bMatch - aMatch;
    });
    
    return { sorted, classGroupMentorIds, classGroupMentorSubjects };
  };

  const isMentorOccupied = (mentorId: string, day: string, time: string, shift: string, dateStr: string) => {
    // 1. Has a regular slot at this time
    const hasRegularSlot = slots.some(s => 
      s.mentorId === mentorId && 
      s.day === day && 
      s.time === time && 
      s.shift === shift
    );
    
    // 2. Is already covering another class at this time on this date
    const isCovering = approvedHandovers.some(h => 
      h.coverStaffId === mentorId && 
      h.dateStr === dateStr && 
      (() => {
        const os = slots.find(s => s.id === h.slotId);
        return os && os.day === day && os.time === time && os.shift === shift;
      })()
    );

    // 3. Has handed over their own slot at this time on this date (absent)
    const isAbsent = approvedHandovers.some(h => 
      h.originalMentorId === mentorId && 
      h.dateStr === dateStr && 
      (() => {
        const os = slots.find(s => s.id === h.slotId);
        return os && os.day === day && os.time === time && os.shift === shift;
      })()
    );

    return hasRegularSlot || isCovering || isAbsent;
  };

  const handleClassFilterClick = (cls: string) => {
    if (selectedClassFilter === cls) {
      setSelectedClassFilter(null);
    } else {
      setSelectedClassFilter(cls);
    }
  };

  // Set current shift to the mentor's profile shift loaded from Excel sheet
  React.useEffect(() => {
    if (currentMentor && currentMentor.shift) {
      if (currentShift !== currentMentor.shift) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setCurrentShift(currentMentor.shift);
      }
    }
  }, [currentMentor, currentShift, setCurrentShift]);

  if (!currentMentor) return null;

  // ── Actual duration calculator ──────────────────────────────────────────
  const parseSlotMinutes = (timeStr: string): number => {
    const parts = timeStr.replace(/to/i, "-").split("-").map(p => p.trim()).filter(Boolean);
    if (parts.length < 2) return 60;
    const parseTime = (t: string): number | null => {
      const m = t.match(/(\d{1,2})[.:]\s*(\d{2})\s*(A\.?M\.?|P\.?M\.?)/i);
      if (!m) return null;
      let h = parseInt(m[1], 10);
      const min = parseInt(m[2], 10);
      const period = m[3].replace(/\./g, "").toUpperCase();
      if (period === "PM" && h !== 12) h += 12;
      if (period === "AM" && h === 12) h = 0;
      return h * 60 + min;
    };
    const start = parseTime(parts[0]);
    const end = parseTime(parts[parts.length - 1]);
    if (start === null || end === null || end <= start) return 60;
    return end - start;
  };

  const toHrs = (mins: number) => (mins / 60).toFixed(1).replace(".0", "");

  const cleanSubjectName = (name: string): string => {
    return name.trim().replace(/[,;/]+$/, "").trim();
  };

  const getCanonicalSubjectName = (name: string): string => {
    const cleaned = cleanSubjectName(name);
    const match = subjectsList.find(sub => isSubjectNameMatch(sub.name, cleaned));
    return match ? match.name : cleaned;
  };

  // Find unique class groups this mentor teaches
  const mentorClassGroups = useMemo(() => {
    const groups = new Set<string>();
    slots.forEach(s => {
      if (s.mentorId === currentMentor?.id && s.classGroup) {
        groups.add(s.classGroup);
      }
    });
    return Array.from(groups);
  }, [slots, currentMentor?.id]);

  useEffect(() => {
    if (!calcCohort && mentorClassGroups.length > 0) {
      setCalcCohort(mentorClassGroups[0]);
    }
  }, [mentorClassGroups, calcCohort]);

  // End of Semester Cumulative Attendance Calculation with Holiday Factor
  const semesterReports = useMemo(() => {
    if (!calcCohort) return [];
    
    // Get all students in this cohort
    const cohortStudents = students.filter(s => isClassGroupMatch(s.classGroup, calcCohort));
    
    // Get all slots for this cohort
    const cohortSlots = slots.filter(s => s.classGroup && isClassGroupMatch(s.classGroup, calcCohort));
    
    // Find all holidays in this date range
    const collegeHolidays = holidays.filter(h => {
      return h.date >= calcStartDate && h.date <= calcEndDate;
    });
    const holidayDates = new Set(collegeHolidays.map(h => h.date));
    
    // Generate dates in range (excluding weekends and holidays)
    const activeDates: string[] = [];
    let cur = new Date(calcStartDate);
    const end = new Date(calcEndDate);
    while (cur <= end) {
      const dateStr = cur.toISOString().slice(0, 10);
      const dayIndex = cur.getDay(); // 0 is Sunday, 6 is Saturday
      
      if (dayIndex !== 0 && dayIndex !== 6 && !holidayDates.has(dateStr)) {
        activeDates.push(dateStr);
      }
      cur.setDate(cur.getDate() + 1);
    }
    
    // For each student, compute attendance
    return cohortStudents.map(student => {
      let conducted = 0;
      let present = 0;
      let absent = 0;
      
      activeDates.forEach(dateStr => {
        const d = new Date(dateStr);
        const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
        const dayName = dayNames[d.getDay()];
        
        // Find slots scheduled on this weekday
        const daySlots = cohortSlots.filter(s => s.day === dayName);
        
        daySlots.forEach(slot => {
          // Check if attendance was marked for this slot on this date
          const marked = studentAttendance.filter(a => a.slotId === slot.id && a.dateStr === dateStr);
          if (marked.length > 0) {
            conducted++;
            const record = marked.find(a => a.studentId === student.id);
            if (record) {
              if (record.status === "present") {
                present++;
              } else {
                // Check if student has approved leave request for this date
                const hasLeave = leaveRequests.some(l => 
                  l.studentId === student.id && 
                  l.status === "approved" && 
                  l.dateStr === dateStr
                );
                if (hasLeave) {
                  present++; // Excused count as present
                } else {
                  absent++;
                }
              }
            } else {
              absent++;
            }
          }
        });
      });
      
      const percentage = conducted > 0 ? Math.round((present / conducted) * 100) : 100;
      
      return {
        student,
        conducted,
        present,
        absent,
        percentage
      };
    });
  }, [calcCohort, calcStartDate, calcEndDate, students, slots, holidays, studentAttendance, leaveRequests]);

  // Split subjects and classes strings
  const subjectsArray = currentMentor.subjects
    ? currentMentor.subjects.split(/\n|\/|,|;/).map(s => getCanonicalSubjectName(s)).filter(Boolean)
    : [];
  // Filter slots for the current mentor — show ALL their slots regardless of shift
  // (timetable may have been generated under any shift label; we display them all)
  const mySlots = slots.filter((s) => s.mentorId === currentMentor.id);

  // Filter slots for the current mentor (already declared above)
  const myRequests = requests.filter((r) => r.requestorId === currentMentor.id);
  const myCoverageRequests = requests.filter((r) => r.targetStaffId === currentMentor.id && r.status !== "pending_cam");

  // Timetable hours (own slots)
  const targetMinutes = mySlots.reduce((acc, s) => acc + parseSlotMinutes(s.time), 0);

  // Extra coverage hours for the current week (from approved handovers scheduled in this week's dates)
  const currentWeekDateStrings = weekDates.map(d => d.dateStr);
  const currentWeekCoveredHandovers = approvedHandovers.filter(
    h => h.coverStaffId === currentMentor.id && currentWeekDateStrings.includes(h.dateStr)
  );
  const currentWeekCoveredSlots = currentWeekCoveredHandovers
    .map(h => slots.find(s => s.id === h.slotId))
    .filter(Boolean) as Slot[];
  const coveredMinutes = currentWeekCoveredSlots.reduce((acc, s) => acc + parseSlotMinutes(s.time), 0);

  // Handed-over hours for the current week (original mentor is current mentor and handover is approved)
  const currentWeekHandedOverHandovers = approvedHandovers.filter(
    h => h.originalMentorId === currentMentor.id && currentWeekDateStrings.includes(h.dateStr)
  );
  const currentWeekHandedOverSlots = currentWeekHandedOverHandovers
    .map(h => slots.find(s => s.id === h.slotId))
    .filter(Boolean) as Slot[];
  const handedOverMinutes = currentWeekHandedOverSlots.reduce((acc, s) => acc + parseSlotMinutes(s.time), 0);

  const totalMinutes = targetMinutes - handedOverMinutes + coveredMinutes;

  // Calculate unique active semesters in this teacher's timetable
  const activeSemesters = Array.from(
    new Set(
      [
        ...mySlots.map(s => getSemesterFromSlot(s)),
        ...slots.filter((slot) => 
          approvedHandovers.some((h) => h.coverStaffId === currentMentor.id && h.slotId === slot.id) &&
          slot.shift === currentShift
        ).map(s => getSemesterFromSlot(s))
      ].filter(Boolean)
    )
  ).sort((a, b) => {
    const numA = parseInt(a.replace(/^\D+/g, ''), 10) || 0;
    const numB = parseInt(b.replace(/^\D+/g, ''), 10) || 0;
    return numA - numB;
  });

  // Calculate unique active semesters in this teacher's department & college
  const deptMentors = mentors.filter(
    (m) => m.college_id === currentMentor.college_id && m.department === currentMentor.department
  );
  const deptMentorIds = new Set(deptMentors.map((m) => m.id));
  const deptSlots = slots.filter((s) => deptMentorIds.has(s.mentorId));

  const deptSemestersWithTimetable = Array.from(
    new Set(deptSlots.map((s) => getSemesterFromSlot(s)).filter(Boolean))
  ).sort((a, b) => {
    const numA = parseInt(a.replace(/^\D+/g, ""), 10) || 0;
    const numB = parseInt(b.replace(/^\D+/g, ""), 10) || 0;
    return numA - numB;
  });

  const getCohortLabelForSemester = (semLabel: string) => {
    const mentorDept = currentMentor?.department;
    if (!mentorDept) return "";
    const course = (coursesList || []).find(c => c.name === mentorDept);
    if (!course) return "";

    const semNumMatch = semLabel.match(/\d+/);
    if (!semNumMatch) return "";
    const semNum = parseInt(semNumMatch[0], 10);
    const yearIndex = Math.ceil(semNum / 2); // e.g. Year 1, 2, 3, or 4

    const baseStartYear = Number(course.start_year || "2026");
    const duration = Number(course.years || 4);

    const cohortStart = baseStartYear - (yearIndex - 1);
    const cohortEnd = cohortStart + duration;

    return ` (${cohortStart}-${cohortEnd})`;
  };

  // Calculate target and covered minutes per subject dynamically
  const subjectTargetMinutesMap: Record<string, number> = {};
  mySlots.forEach((slot) => {
    const course = getCanonicalSubjectName(slot.course || "General");
    subjectTargetMinutesMap[course] = (subjectTargetMinutesMap[course] || 0) + parseSlotMinutes(slot.time);
  });

  const subjectCoveredMinutesMap: Record<string, number> = {};
  currentWeekCoveredSlots.forEach((slot) => {
    const course = getCanonicalSubjectName(slot.course || "General");
    subjectCoveredMinutesMap[course] = (subjectCoveredMinutesMap[course] || 0) + parseSlotMinutes(slot.time);
  });

  const weeklyCoveredSubjects = currentWeekCoveredSlots.map(s => getCanonicalSubjectName(s.course || "General"));
  const allMentorSubjects = Array.from(new Set([
    ...subjectsArray,
    ...mySlots.map(s => getCanonicalSubjectName(s.course || "General")),
    ...weeklyCoveredSubjects
  ]));

  // Helper to resolve the active day for a calendar date, accounting for CAM Day Order overrides
  const getMappedDayForDate = (dateStr: string, defaultDay: string) => {
    const dailyConfig = dailyConfigsList.find((c: any) => c.dateStr === dateStr);
    
    // If it's a holiday, return a special holiday flag
    if (dailyConfig && dailyConfig.day_type === "holiday") {
      return "holiday";
    }

    if (dailyConfig && dailyConfig.day_order && dailyConfig.day_order !== "None") {
      const match = dailyConfig.day_order.match(/^Day (\d+)$/);
      if (match) {
        const orderNum = parseInt(match[1]);
        const dayNames = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
        if (orderNum >= 1 && orderNum <= dayNames.length) {
          return dayNames[orderNum - 1];
        }
      }
    }
    return defaultDay;
  };

  const getAgendaClassesForDay = (dayName: string) => {
    const dateObj = weekDates.find(d => d.day === dayName);
    const dateStr = dateObj ? dateObj.dateStr : "";
    
    const queryDay = getMappedDayForDate(dateStr, dayName);
    if (queryDay === "holiday") {
      return []; // Return no classes on holidays
    }

    // 1. Own slots for this day (all shifts — show everything assigned to this mentor)
    const ownSlots = slots.filter(s => s.mentorId === currentMentor.id && s.day === queryDay);
    
    // Filter out slots that have been handed over to someone else on this date
    const activeOwnClasses = ownSlots.map(slot => {
      const isHandedOver = approvedHandovers.some(h => h.slotId === slot.id && h.dateStr === dateStr);
      const pendingHandover = requests.find(r => r.slotId === slot.id && r.dateStr === dateStr && r.status === "pending");
      const hasAttendance = studentAttendance.some(a => a.slotId === slot.id && a.dateStr === dateStr);
      
      return {
        slot,
        type: "own" as const,
        isHandedOver,
        pendingHandover,
        hasAttendance,
        roleLabel: "Regular Class"
      };
    });
    
    // 2. Covered slots (handed over to us on this date)
    const coveredHandovers = approvedHandovers.filter(h => h.coverStaffId === currentMentor.id && h.dateStr === dateStr);
    const activeCoverClasses = coveredHandovers.map(h => {
      const slot = slots.find(s => s.id === h.slotId);
      const hasAttendance = slot ? studentAttendance.some(a => a.slotId === slot.id && a.dateStr === dateStr) : false;
      return {
        slot,
        type: "covering" as const,
        isHandedOver: false,
        pendingHandover: null,
        hasAttendance,
        roleLabel: `Substitution for ${h.coverStaffName || 'Faculty'}`
      };
    })
    .filter((x) => x.slot !== undefined)
    .map(x => ({
      ...x,
      slot: x.slot as Slot
    }));
    
    // Merge and sort by time
    const allAgendaClasses = [...activeOwnClasses, ...activeCoverClasses].sort((a, b) => {
      return a.slot.time.localeCompare(b.slot.time);
    });
    
    return allAgendaClasses;
  };

  // Get unique locations from mySlots and covering slots for filtering
  const uniqueLocations = Array.from(
    new Set([
      ...mySlots.map((s) => s.location),
      ...slots.filter((slot) => 
        approvedHandovers.some((h) => h.coverStaffId === currentMentor.id && h.slotId === slot.id)
      ).map((s) => s.location)
    ].filter(Boolean))
  );

  // Get unique class display labels from mySlots and covering slots for filtering dynamically from scheduled slots
  const uniqueClassLabels = Array.from(
    new Set(
      [
        ...mySlots.map((s) => s.classGroup),
        ...slots.filter((slot) => 
          approvedHandovers.some((h) => h.coverStaffId === currentMentor.id && h.slotId === slot.id)
        ).map((s) => s.classGroup)
      ]
      .filter(Boolean)
      .map((cg) => getClassGroupLabel(cg))
    )
  );

  // Helper to find slot for a day & time slot, and check if it's owned or covered on a specific date
  const getSlotAt = (day: string, dateStr: string, time: string) => {
    const queryDay = getMappedDayForDate(dateStr, day);
    if (queryDay === "holiday") {
      return null;
    }

    // 1. Check if the logged-in mentor has their own slot assigned at this (queryDay, time)
    const ownSlot = slots.find((s) => s.mentorId === currentMentor.id && s.day === queryDay && s.time === time);
    
    // Check Handover state for this slot on this date
    const pendingReq = ownSlot ? requests.find(r => r.slotId === ownSlot.id && r.dateStr === dateStr && r.status === "pending") : null;
    const approvedReq = ownSlot ? approvedHandovers.find(h => h.slotId === ownSlot.id && h.dateStr === dateStr) : null;

    // 2. Check if another mentor handed over their slot to this logged-in mentor on this date (approved)
    const coverHandover = approvedHandovers.find(
      (h) => h.dateStr === dateStr && h.coverStaffId === currentMentor.id && (() => {
        const slotOfHandover = slots.find(s => s.id === h.slotId);
        return slotOfHandover && slotOfHandover.day === queryDay && slotOfHandover.time === time;
      })()
    );
    const coverSlot = coverHandover ? slots.find((s) => s.id === coverHandover.slotId) : null;

    // Determine status of the cell
    let cellStatus: "active" | "pending" | "handover" | null = null;
    let slotObj = null;
    let typeObj: "own" | "covering" | null = null;

    if (ownSlot) {
      slotObj = ownSlot;
      typeObj = "own";
      if (approvedReq) {
        cellStatus = "handover";
      } else if (pendingReq) {
        cellStatus = "pending";
      } else {
        cellStatus = "active";
      }
    } else if (coverSlot) {
      slotObj = coverSlot;
      typeObj = "covering";
      cellStatus = "handover";
    }

    if (!slotObj) return null;

    // Apply target class filter
    if (selectedClassFilter && !doesClassMatchFilter(slotObj.classGroup, selectedClassFilter)) {
      return null;
    }

    // Apply status filter
    if (selectedStatusFilter && cellStatus !== selectedStatusFilter) {
      return null;
    }

    // Apply location filter
    if (selectedLocationFilter && slotObj.location !== selectedLocationFilter) {
      return null;
    }

    if (typeObj === "own") {
      return { slot: ownSlot!, type: "own" as const, handover: approvedReq || undefined };
    } else {
      return { slot: coverSlot!, type: "covering" as const, originalMentorId: coverHandover!.originalMentorId, handover: coverHandover };
    }
  };

  // Calculate filtered slots list
  const getFilteredSlotsList = () => {
    const list: { slot: Slot; day: string; dateStr: string; dateFormatted: string; type: "own" | "covering"; status: "active" | "pending" | "handover"; originalMentorId?: string }[] = [];
    
    // Check all dates and times
    weekDates.forEach((date) => {
      timeSlots.forEach((time) => {
        const slotResult = getSlotAt(date.day, date.dateStr, time);
        if (slotResult) {
          const ownSlot = slotResult.slot;
          const pendingReq = ownSlot ? requests.find(r => r.slotId === ownSlot.id && r.dateStr === date.dateStr && r.status === "pending") : null;
          const approvedReq = ownSlot ? approvedHandovers.find(h => h.slotId === ownSlot.id && h.dateStr === date.dateStr) : null;
          
          let status: "active" | "pending" | "handover" = "active";
          if (slotResult.type === "own") {
            if (approvedReq) {
              status = "handover";
            } else if (pendingReq) {
              status = "pending";
            }
          } else {
            status = "handover";
          }

          list.push({
            slot: slotResult.slot,
            day: date.day,
            dateStr: date.dateStr,
            dateFormatted: date.formatted,
            type: slotResult.type,
            status,
            originalMentorId: slotResult.type === "covering" ? slotResult.originalMentorId : undefined
          });
        }
      });
    });

    return list;
  };

  const isFilterActive = selectedClassFilter !== null || selectedStatusFilter !== null || selectedLocationFilter !== null;
  const filteredSlotsList = isFilterActive ? getFilteredSlotsList() : [];

  const hasMatchingSlotInRow = (time: string) => {
    return weekDates.some((date) => {
      const slotResult = getSlotAt(date.day, date.dateStr, time);
      return slotResult !== null;
    });
  };

  const rows: (
    | { type: "slot"; time: string }
    | { type: "break" | "lunch"; label: string; timeRange: string }
  )[] = [];

  timeSlots.forEach((time, index) => {
    rows.push({ type: "slot", time });
    
    if (currentShift === "shift_1" && index === 1) {
      rows.push({ type: "break", label: "Break", timeRange: "10:00 AM - 10:20 AM" });
    } else if (currentShift === "shift_2" && index === 1) {
      rows.push({ type: "break", label: "Break", timeRange: "02:40 PM - 03:00 PM" });
    } else if (currentShift === "general") {
      if (index === 1) {
        rows.push({ type: "break", label: "Break", timeRange: "11:00 AM - 11:15 AM" });
      } else if (index === 2) {
        rows.push({ type: "lunch", label: "Lunch Break", timeRange: "12:15 PM - 12:50 PM" });
      }
    }
  });

  const handleCellClick = (day: string, dateStr: string, dateFormatted: string, time: string) => {
    const slotResult = getSlotAt(day, dateStr, time);
    if (!slotResult) return;

    const slot = slotResult.slot;
    setSelectedCell({
      day,
      dateStr,
      dateFormatted,
      time,
      slot,
      type: slotResult.type,
      originalMentorId: slotResult.type === "covering" ? slotResult.originalMentorId : undefined,
      handover: slotResult.handover
    });
    setReasonText("");
    setFormError("");
    setTargetStaffId("");
    setHandoverSubject("original");
    setSelectedSubjName("");
    setCustomSubjName("");
    
    // Reset attendance search/select states
    setAttendanceSearchTerm("");
    setSelectedStudentIds([]);
    setLastCheckedId(null);
    setIsRangeOpen(false);
    setRangeStartId("");
    setRangeEndId("");

    // Initialize local attendance
    const classStudents = students.filter(
      (s) => isClassGroupMatch(s.classGroup, slot.classGroup)
    );

    const initialAttendance: Record<string, "present" | "absent" | "od" | "not_marked"> = {};
    classStudents.forEach((student) => {
      const existing = studentAttendance.find(
        (a) => a.studentId === student.id && a.slotId === slot.id && a.dateStr === dateStr
      );
      initialAttendance[student.id] = existing ? (existing.status as any) : "present";
    });
    setLocalAttendance(initialAttendance);
    setOriginalAttendance(initialAttendance);

    const firstExisting = studentAttendance.find(
      (a) => a.slotId === slot.id && a.dateStr === dateStr
    );
    if (firstExisting) {
      setAttendanceType((firstExisting.type as any) || "Regular");
      setAttendanceMode((firstExisting.mode as any) || "Offline");
      setAttendanceTypeSub(firstExisting.attendanceTypeSub || "Event");
    } else {
      setAttendanceType("Regular");
      setAttendanceMode("Offline");
      setAttendanceTypeSub("Event");
    }

    // Determine default tab based on whether class has already started or is in the future
    const todayStr = new Date().toISOString().slice(0, 10);
    const isFuture = dateStr > todayStr || (dateStr === todayStr && (() => {
      const periodStart = parseSlotStartTime(time);
      return periodStart ? new Date() < periodStart : false;
    })());

    if (slotResult.type === "covering") {
      setModalTab("attendance");
    } else {
      if (isFuture) {
        setModalTab("handover");
      } else {
        setModalTab("attendance");
      }
    }

    const targetSem = getSemesterFromSlot(slot);
    setModalSemester(targetSem);

    // Fetch daily config asynchronously to resolve type & mode preset by CAM
    if (!firstExisting && currentMentor?.college_id) {
      fetch(`/api/daily-configs?college_id=${currentMentor.college_id}`)
        .then(res => res.json())
        .then(data => {
          if (data.success && data.configs) {
            const configForDate = data.configs.find((c: any) => c.dateStr === dateStr);
            if (configForDate) {
              if (configForDate.day_type === "event" || configForDate.day_type === "exam_day") {
                setAttendanceType("Non-Regular");
                setAttendanceTypeSub(configForDate.day_type === "event" ? "Event" : "Exam");
              } else {
                setAttendanceType("Regular");
              }
              setAttendanceMode(configForDate.session_mode === "Online" ? "Online" : "Offline");
            }
          }
        })
        .catch(err => console.error("Error fetching daily config on click:", err));
    }

    // Go straight to Roster Grid (Step 2) as configured by CAM daily
    setAttendanceStep(2);
    setIsModalOpen(true);
  };

  const submitAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCell || !selectedCell.slot) return;

    if (!reasonText.trim()) {
      setFormError("Please provide a reason for this class handover.");
      return;
    }
    if (!targetStaffId) {
      setFormError("You must select a staff member of your department to cover the class.");
      return;
    }

    const isOccupied = isMentorOccupied(
      targetStaffId,
      selectedCell.slot.day,
      selectedCell.slot.time,
      selectedCell.slot.shift,
      selectedCell.dateStr
    );
    if (isOccupied) {
      setFormError("The selected staff member is occupied during this period.");
      return;
    }

    let finalSubject = selectedCell.slot.course;
    if (handoverSubject === "substitute_own") {
      if (!selectedSubjName) {
        setFormError("Please select the subject to be taught from the covering mentor's list.");
        return;
      }
      finalSubject = selectedSubjName;
    } else if (handoverSubject === "custom") {
      if (!customSubjName.trim()) {
        setFormError("Please enter the custom subject to be taught.");
        return;
      }
      finalSubject = customSubjName.trim();
    }

    await requestHandover(
      currentMentor.id,
      selectedCell.slot.id,
      selectedCell.dateStr,
      selectedCell.dateFormatted,
      targetStaffId,
      reasonText,
      finalSubject
    );

    setIsModalOpen(false);
  };

  return (
    <div className="flex-1 flex flex-col md:flex-row bg-warm-canvas text-slate-800 font-sans h-full overflow-hidden">
      {(() => {
        const getNotificationCount = (tabId: string) => {
          if (tabId === "handovers" && currentMentor) {
            return requests.filter(r => r.targetStaffId === currentMentor.id && r.status === "pending").length;
          }
          return 0;
        };

        return (
          <aside className={`hidden md:flex shrink-0 flex-col justify-between sticky top-6 z-30 floating-sidebar transition-all duration-300 ${isCollapsed ? "w-20 p-3" : "w-64 p-5"}`}>
            <div className="flex flex-col flex-1 overflow-y-auto">
              <nav className={`py-2 space-y-1 ${isCollapsed ? "px-1" : "px-4"}`}>
                {[
                  { id: "home", label: "Home", icon: Home },
                  { id: "timetable", label: "Timetable Hub", icon: Calendar },
                  { id: "demo_evaluations", label: "Demo Evaluations", icon: Sparkles },
                  { id: "attendance", label: "Attendance Logs", icon: ClipboardList },
                  { id: "tracker", label: "Student Tracker", icon: GraduationCap },
                  { id: "handovers", label: "My Handovers", icon: Clock },
                  { id: "profile", label: "My Profile", icon: User }
                ].map(t => {
                  const Icon = t.icon;
                  const isActive = activeTab === t.id;
                  const count = getNotificationCount(t.id);
                  return (
                    <button
                      key={t.id}
                      onClick={() => setActiveTab(t.id as any)}
                      className={`w-full flex items-center rounded-2xl text-xs font-bold tracking-tight transition-all duration-200 cursor-pointer ${
                        isCollapsed ? "justify-center px-0 py-3" : "justify-start gap-3 px-4 py-3 text-left"
                      } ${
                        isActive
                          ? "sidebar-active-item"
                          : "text-slate-500 hover:text-slate-855 hover:bg-slate-50"
                      }`}
                    >
                      <div className="relative flex items-center justify-center">
                        <Icon className={`h-4.5 w-4.5 shrink-0 ${isActive ? "text-[#4F46E5]" : "text-slate-400 group-hover:text-slate-650"}`} />
                        {isCollapsed && count > 0 && (
                          <span className="absolute -top-1.5 -right-1.5 block h-2.5 w-2.5 rounded-full bg-rose-500 ring-2 ring-white" />
                        )}
                      </div>
                      {!isCollapsed && <span>{t.label}</span>}
                      {!isCollapsed && count > 0 && (
                        <span className="ml-auto bg-rose-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                          {count}
                        </span>
                      )}
                    </button>
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
      {(() => {
        const tabs = [
          { id: "home", label: "Home", icon: Home },
          { id: "timetable", label: "Timetable", icon: Calendar },
          { id: "attendance", label: "Attendance", icon: ClipboardList },
          { id: "tracker", label: "Tracker", icon: GraduationCap },
          { id: "more_menu", label: "More", icon: Menu },
        ];
        return (
          <nav className="flex md:hidden fixed bottom-0 inset-x-0 z-50 mobile-bottom-nav safe-area-bottom">
            <div className="flex w-full justify-around items-center py-2 px-1">
              {tabs.map(t => {
                const Icon = t.icon;
                const isActive = activeTab === t.id || (t.id === "more_menu" && ["handovers", "profile", "demo_evaluations"].includes(activeTab));
                const count = t.id === "more_menu" && currentMentor
                  ? requests.filter(r => r.targetStaffId === currentMentor.id && r.status === "pending").length
                  : 0;
                return (
                  <button
                    key={t.id}
                    onClick={() => setActiveTab(t.id as any)}
                    className={`relative flex flex-col items-center justify-center gap-0.5 flex-1 py-1.5 rounded-xl transition-all cursor-pointer ${
                      isActive ? "text-indigo-600" : "text-slate-400"
                    }`}
                  >
                    <div className="relative">
                      <Icon className={`h-5 w-5 transition-transform ${isActive ? "scale-110" : ""}`} />
                      {count > 0 && (
                        <span className="absolute -top-1.5 -right-1.5 h-3.5 w-3.5 bg-rose-500 text-white text-[8px] font-bold rounded-full flex items-center justify-center">
                          {count}
                        </span>
                      )}
                    </div>
                    <span className={`text-[9px] font-semibold tracking-wide leading-none ${isActive ? "text-indigo-600" : "text-slate-400"}`}>
                      {t.label}
                    </span>
                    {isActive && (
                      <span className="absolute top-0 inset-x-2 h-0.5 bg-indigo-500 rounded-full" />
                    )}
                  </button>
                );
              })}
            </div>
          </nav>
        );
      })()}

      <main className="flex-grow overflow-x-hidden overflow-y-auto h-full floating-main-panel p-4 md:p-6 space-y-6 pb-20 md:pb-6 scroll-touch">
        {/* Tab More Menu: Grid of remaining tabs */}
        {activeTab === "more_menu" && (
          <div className="space-y-6 animate-fadeIn pb-10">
            <h2 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider">More Tools & Portals</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setActiveTab("handovers")}
                className="p-5 bg-white border border-slate-200 rounded-3xl text-left hover:border-indigo-500 hover:ring-2 hover:ring-indigo-100 transition-all flex items-center gap-4 shadow-xs cursor-pointer group"
              >
                <div className="h-10 w-10 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0 group-hover:scale-105 transition-transform">
                  <Clock className="h-5 w-5" />
                </div>
                <div>
                  <span className="block text-xs font-bold text-slate-800">Class Handovers</span>
                  <span className="text-[10px] text-slate-400 font-medium">Manage swaps and handovers</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("demo_evaluations")}
                className="p-5 bg-white border border-slate-200 rounded-3xl text-left hover:border-indigo-500 hover:ring-2 hover:ring-indigo-100 transition-all flex items-center gap-4 shadow-xs cursor-pointer group"
              >
                <div className="h-10 w-10 rounded-2xl bg-pink-50 flex items-center justify-center text-pink-500 shrink-0 group-hover:scale-105 transition-transform">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <span className="block text-xs font-bold text-slate-800">Demo Evaluations</span>
                  <span className="text-[10px] text-slate-400 font-medium">Grade candidate presentations</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("profile")}
                className="p-5 bg-white border border-slate-200 rounded-3xl text-left hover:border-indigo-500 hover:ring-2 hover:ring-indigo-100 transition-all flex items-center gap-4 shadow-xs cursor-pointer group sm:col-span-2"
              >
                <div className="h-10 w-10 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-650 shrink-0 group-hover:scale-105 transition-transform">
                  <User className="h-5 w-5" />
                </div>
                <div>
                  <span className="block text-xs font-bold text-slate-800">My Profile</span>
                  <span className="text-[10px] text-slate-400 font-medium">View profile stats & info</span>
                </div>
              </button>
            </div>
          </div>
        )}

        {activeTab === "home" && (
          <>

        {/*  Dedicated Metrics Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Timetable Target */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3.5 hover:shadow-sm transition-all">
            <div className="h-10 w-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0">
              <Calendar className="h-5 w-5" />
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block">Scheduled Base</span>
              <span className="text-lg font-black text-slate-800">{toHrs(targetMinutes)} hrs</span>
            </div>
          </div>

          {/* Card 2: Coverages Received */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3.5 hover:shadow-sm transition-all">
            <div className="h-10 w-10 rounded-xl bg-teal-50 flex items-center justify-center text-teal-600 shrink-0">
              <PlusCircle className="h-5 w-5" />
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block">Coverages Recv. (+)</span>
              <span className="text-lg font-black text-teal-600">
                {coveredMinutes > 0 ? `+${toHrs(coveredMinutes)} hrs` : "0 hrs"}
              </span>
            </div>
          </div>

          {/* Card 3: Handovers Given */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3.5 hover:shadow-sm transition-all">
            <div className="h-10 w-10 rounded-xl bg-rose-50 flex items-center justify-center text-rose-600 shrink-0">
              <MinusCircle className="h-5 w-5" />
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block">Handovers Given (-)</span>
              <span className="text-lg font-black text-rose-600">
                {handedOverMinutes > 0 ? `-${toHrs(handedOverMinutes)} hrs` : "0 hrs"}
              </span>
            </div>
          </div>

          {/* Card 4: Net Actual Workload */}
          <div className="bg-white p-4 rounded-2xl border border-indigo-200 shadow-sm flex items-center gap-3.5 relative overflow-hidden hover:shadow-md transition-all">
            <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-indigo-500 to-teal-400"></div>
            <div className="h-10 w-10 rounded-xl bg-indigo-100/50 flex items-center justify-center text-indigo-700 shrink-0">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <span className="text-[10px] text-slate-555 font-extrabold uppercase tracking-wider block">Net Workload</span>
              <span className="text-lg font-black text-gradient">{toHrs(totalMinutes)} hrs</span>
            </div>
          </div>
        </div>

        {/*  Mentor Dashboard Widgets Area */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Today's Agenda (Col-span 2) */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white border border-gray-200 rounded-3xl p-6 shadow-xs flex flex-col space-y-5 h-auto lg:h-full">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-4 gap-4">
                <div className="flex items-center gap-2">
                  <CalendarCheck2 className="h-5 w-5 text-indigo-500 shrink-0" />
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Today's Class Agenda</h3>
                    <p className="text-xs text-slate-400 font-semibold mt-0.5">
                      Your scheduled teachings and substitutions.
                    </p>
                  </div>
                </div>

                {/* Day Quick selector */}
                <div className="flex items-center justify-between sm:justify-start gap-1 bg-slate-50 p-1 rounded-xl border border-slate-200/80 overflow-x-auto no-scrollbar w-full sm:w-auto shrink-0">
                  {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"].map((dName) => {
                    const isSel = agendaDay === dName;
                    return (
                      <button
                        key={dName}
                        type="button"
                        onClick={() => setAgendaDay(dName)}
                        className={`flex-1 sm:flex-none text-center px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap ${
                          isSel ? "bg-indigo-600 text-white shadow-sm" : "text-slate-500 hover:text-slate-800"
                        }`}
                      >
                        {dName.slice(0, 3)}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Agenda List */}
              {(() => {
                const agendaClasses = getAgendaClassesForDay(agendaDay);
                const dateObj = weekDates.find(d => d.day === agendaDay);
                const dateFormatted = dateObj ? dateObj.formatted : "";
                const dateStr = dateObj ? dateObj.dateStr : "";

                if (agendaClasses.length === 0) {
                  return (
                    <div className="flex-grow flex flex-col items-center justify-center py-12 text-center space-y-2">
                      <div className="h-12 w-12 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400">
                        <Calendar className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-750">No classes scheduled</p>
                        <p className="text-[10px] text-slate-400 font-semibold mt-0.5">{agendaDay}, {dateFormatted || "This week"}</p>
                      </div>
                    </div>
                  );
                }

                return (
                  <div className="divide-y divide-slate-100 flex-grow overflow-y-auto max-h-[360px] pr-1 space-y-3">
                    {agendaClasses.map((item, idx) => {
                      const isCovering = item.type === "covering";
                      const isHandedOver = item.isHandedOver;
                      
                      return (
                        <div 
                          key={idx} 
                          onClick={() => {
                            if (item.slot) {
                              handleCellClick(agendaDay, dateStr, dateFormatted || "", item.slot.time);
                            }
                          }}
                          className={`pt-3.5 pb-3.5 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer hover:bg-slate-50/50 rounded-xl px-2.5 -mx-2.5 transition-all border border-transparent hover:border-slate-100 ${
                            isHandedOver ? "opacity-60" : ""
                          }`}
                        >
                          <div className="flex gap-3 items-start w-full">
                            <div className="h-9 w-9 rounded-xl bg-indigo-50 border border-indigo-100/50 flex items-center justify-center text-indigo-650 shrink-0 mt-0.5">
                              <Clock className="h-4.5 w-4.5" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h4 className="text-xs font-bold text-slate-800 line-clamp-1">{getCanonicalSubjectName(item.slot.course)}</h4>
                                <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase shrink-0 ${
                                  isCovering 
                                    ? "bg-blue-50 border border-blue-200 text-blue-700" 
                                    : isHandedOver
                                      ? "bg-slate-100 border border-slate-200 text-slate-500"
                                      : "bg-indigo-50 border border-indigo-100 text-indigo-700"
                                }`}>
                                  {item.roleLabel}
                                </span>
                              </div>
                              <p className="text-[10px] text-slate-400 font-semibold mt-0.5">
                                {formatTimeLabel(item.slot.time)} • Room: <span className="font-bold text-slate-655">{item.slot.location}</span>
                              </p>
                              <div className="flex items-center gap-1.5 mt-1.5">
                                <span className="text-[9px] font-extrabold text-slate-500 bg-slate-50 border border-slate-205 px-1.5 py-0.5 rounded">
                                  {getShortClassGroup(item.slot.classGroup).name}
                                </span>
                                {getShortClassGroup(item.slot.classGroup).sem && (
                                  <span className="text-[9px] font-extrabold text-slate-500 bg-slate-50 border border-slate-205 px-1.5 py-0.5 rounded">
                                    {getShortClassGroup(item.slot.classGroup).sem}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="shrink-0 flex items-center w-full sm:w-auto mt-1 sm:mt-0">
                            {isHandedOver ? (
                              <span className="text-[9.5px] font-black text-slate-455 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200/80 w-full sm:w-auto text-center">
                                Covered by Colleague
                              </span>
                            ) : item.hasAttendance ? (
                              <span className="text-[9.5px] font-black text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200/80 flex items-center justify-center gap-1 w-full sm:w-auto text-center">
                                <CheckCircle className="h-3 w-3 shrink-0" /> Marked
                              </span>
                            ) : (
                              <button
                                type="button"
                                className="w-full sm:w-auto text-center px-3 py-1.5 bg-indigo-600 text-white hover:bg-indigo-700 font-black text-[9.5px] uppercase tracking-wider rounded-lg shadow-xs transition-all cursor-pointer"
                              >
                                Mark Attendance
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>

            {/*  Compensation & Workload Balance Ledger */}
            <div className="bg-white border border-gray-200 rounded-3xl p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5 text-indigo-500" />
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Compensation &amp; Workload Balance Ledger</h3>
                    <p className="text-xs text-slate-400 font-semibold mt-0.5">
                      Track classes handed over or covered, and pending hour compensations.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  <span className="px-2 py-0.5 rounded bg-rose-50 border border-rose-200 text-rose-600">Given (-)</span>
                  <span className="px-2 py-0.5 rounded bg-teal-50 border border-teal-200 text-teal-600">Covered (+)</span>
                </div>
              </div>

              {(() => {
                interface LedgerRecord {
                  otherName: string;
                  otherId: string;
                  subject: string;
                  month: string;
                  given: number;
                  received: number;
                }
                const ledgerMap = new Map<string, LedgerRecord>();
                const getLedgerKey = (otherId: string, subject: string, month: string) =>
                  `${otherId}_#_${subject}_#_${month}`;
                const currentMonthStr = new Date().toISOString().slice(0, 7);

                const cleanSubjectName = (name: string) =>
                  name.replace(/\s*-\s*(Semester|Sem)\s+\d+/i, "")
                      .replace(/\s*-\s*Year\s+\d+/i, "")
                      .replace(/\s*-\s*[IVXLCDM]+$/g, "")
                      .trim();

                // Handed-over classes (giver = this mentor)
                approvedHandovers.forEach(h => {
                  if (h.originalMentorId === currentMentor.id) {
                    const otherId = h.coverStaffId;
                    const otherMentor = mentors.find(m => m.id === otherId);
                    const otherName = otherMentor?.name || h.coverStaffName || "Staff";
                    const slot = slots.find(s => s.id === h.slotId);
                    const subject = cleanSubjectName(h.course || (slot ? slot.course : "Unknown Subject"));
                    const month = h.ledger_month || (h.dateStr || "").slice(0, 7);
                    const key = getLedgerKey(otherId, subject, month);
                    const record = ledgerMap.get(key) || { otherName, otherId, subject, month, given: 0, received: 0 };
                    record.given += 1;
                    ledgerMap.set(key, record);
                  }
                });

                // Covered classes (receiver = this mentor)
                approvedHandovers.forEach(h => {
                  if (h.coverStaffId === currentMentor.id) {
                    const otherId = h.originalMentorId;
                    const otherMentor = mentors.find(m => m.id === otherId);
                    const otherName = otherMentor?.name || "Staff";
                    const slot = slots.find(s => s.id === h.slotId);
                    const subject = cleanSubjectName(h.course || (slot ? slot.course : "Unknown Subject"));
                    const month = h.ledger_month || (h.dateStr || "").slice(0, 7);
                    const key = getLedgerKey(otherId, subject, month);
                    const record = ledgerMap.get(key) || { otherName, otherId, subject, month, given: 0, received: 0 };
                    record.received += 1;
                    ledgerMap.set(key, record);
                  }
                });

                const ledgerList = Array.from(ledgerMap.values()).map(data => ({
                  ...data,
                  balance: data.given - data.received // + means you owe them; - means they owe you
                }));

                const formatMonthLabel = (mStr: string) => {
                  if (!mStr) return "";
                  const [yr, mn] = mStr.split("-");
                  return new Date(parseInt(yr), parseInt(mn) - 1, 1)
                    .toLocaleString("default", { month: "short", year: "numeric" });
                };

                if (ledgerList.length === 0) {
                  return (
                    <div className="text-center py-6 border border-slate-150 rounded-xl bg-slate-50/30">
                      <p className="text-xs text-slate-455 italic">No approved handover history to calculate balance.</p>
                    </div>
                  );
                }

                return (
                  <div className="overflow-x-auto border border-slate-200 rounded-xl shadow-xs scroll-touch">
                    <table className="w-full border-collapse text-left text-xs min-w-[700px]">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-550 font-bold uppercase text-[9.5px] whitespace-nowrap">
                          <th className="p-3">Month</th>
                          <th className="p-3">Subject</th>
                          <th className="p-3">Faculty Member</th>
                          <th className="p-3 text-center">Given (−)</th>
                          <th className="p-3 text-center">Covered (+)</th>
                          <th className="p-3 text-right">Balance</th>
                          <th className="p-3 text-right">Compensation Status</th>
                          <th className="p-3 text-center">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {ledgerList.map((row, idx) => {
                          const isPastMonth = row.month < currentMonthStr;
                          return (
                            <tr key={idx} className="hover:bg-slate-50/50 transition-colors text-slate-700">
                              <td className="p-3 font-semibold whitespace-nowrap">{formatMonthLabel(row.month)}</td>
                              <td className="p-3 font-medium text-slate-600">{row.subject}</td>
                              <td className="p-3 font-bold text-slate-800">{row.otherName}</td>
                              <td className="p-3 text-center">
                                {row.given > 0
                                  ? <span className="px-2 py-0.5 rounded bg-rose-50 border border-rose-200 text-rose-700 font-black">−{row.given} hr{row.given > 1 ? "s" : ""}</span>
                                  : <span className="text-slate-300 font-semibold">—</span>}
                              </td>
                              <td className="p-3 text-center">
                                {row.received > 0
                                  ? <span className="px-2 py-0.5 rounded bg-teal-50 border border-teal-200 text-teal-700 font-black">+{row.received} hr{row.received > 1 ? "s" : ""}</span>
                                  : <span className="text-slate-300 font-semibold">—</span>}
                              </td>
                              <td className={`p-3 text-right font-black text-sm ${row.balance > 0 ? "text-rose-600" : row.balance < 0 ? "text-emerald-600" : "text-slate-500"}`}>
                                {row.balance > 0 ? `+${row.balance}` : row.balance}
                              </td>
                              <td className="p-3 text-right">
                                {row.balance === 0 ? (
                                  <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200 text-[9px] font-black uppercase">Balanced Yes</span>
                                ) : isPastMonth ? (
                                  <span className="px-2 py-0.5 rounded bg-red-50 text-rose-700 border border-red-200 text-[9px] font-black uppercase animate-pulse">
                                    {row.balance > 0 ? `You owe ${row.balance} hr` : `Owed ${Math.abs(row.balance)} hr`} — Overdue
                                  </span>
                                ) : row.balance > 0 ? (
                                  <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 text-[9px] font-black uppercase">
                                    Compensate {row.balance} hr to {row.otherName.split(" ")[0]}
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-[9px] font-black uppercase">
                                    {row.otherName.split(" ")[0]} owes you {Math.abs(row.balance)} hr
                                  </span>
                                )}
                              </td>
                              <td className="p-3 text-center">
                                {row.balance > 0 ? (
                                  (() => {
                                    // Check if there's already a pending swap offer for this pair
                                    const pendingSwap = requests.find(
                                      r => r.requestorId === currentMentor.id &&
                                           r.targetStaffId === row.otherId &&
                                           r.request_type === "swap_compensate" &&
                                           (r.status === "pending" || r.status === "pending_cam")
                                    );
                                    return pendingSwap ? (
                                      <span className="px-2 py-0.5 rounded bg-indigo-50 border border-indigo-200 text-indigo-600 text-[9px] font-black uppercase">Offer Sent Yes</span>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setSwapTarget({
                                            otherMentorId: row.otherId,
                                            otherMentorName: row.otherName,
                                            subject: row.subject,
                                            month: row.month,
                                            balance: row.balance
                                          });
                                          setSwapOfferSlotId("");
                                          setSwapOfferWeekDate("");
                                          setSwapReason("");
                                          setSwapError("");
                                          setSwapSuccess("");
                                          setSwapModalOpen(true);
                                        }}
                                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[9.5px] font-black uppercase tracking-wide transition-colors shadow-sm"
                                      >
                                        ↔ Ask Swap
                                      </button>
                                    );
                                  })()
                                ) : (
                                  <span className="text-slate-300 text-[9px]">—</span>
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

            {/* Right Column: Quick Actions + Subjects Breakdown + Recent Activity */}
            <div className="space-y-6">
              {/* Upcoming Demo Reviews Widget */}
              {(() => {
                const upcomingDemos = demoSessions.filter(ds => ds.mentorId === currentMentor.id && ds.status === "scheduled");
                if (upcomingDemos.length === 0) return null;
                return (
                  <div className="bg-gradient-to-br from-pink-50/50 via-white to-white border border-pink-100 rounded-3xl p-5 shadow-xs space-y-4">
                    <div className="flex items-center justify-between border-b border-pink-100/50 pb-2">
                      <div className="flex items-center gap-2">
                        <Sparkles className="h-4.5 w-4.5 text-pink-500 animate-pulse" />
                        <h3 className="text-xs font-black text-slate-805 uppercase tracking-widest">Upcoming Demo Reviews</h3>
                      </div>
                      <span className="px-2 py-0.5 bg-pink-50 border border-pink-150 text-pink-600 text-[8px] font-black uppercase rounded-lg">
                        {upcomingDemos.length} Scheduled
                      </span>
                    </div>

                    <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                      {upcomingDemos.slice(0, 2).map((demo) => (
                        <div key={demo.id} className="p-3 rounded-xl bg-slate-50/30 border border-slate-150 flex flex-col gap-1">
                          <div className="flex justify-between items-center">
                            <span className="text-[9px] font-black text-slate-450">{demo.dateStr}</span>
                            <span className="text-[9px] font-bold text-slate-500">{demo.timeSlot}</span>
                          </div>
                          <div className="text-xs font-black text-slate-800">{demo.subject}</div>
                          <div className="text-[9.5px] text-slate-550 font-semibold">SME Evaluator: {demo.smeName}</div>
                        </div>
                      ))}
                    </div>

                    <button
                      onClick={() => setActiveTab("demo_evaluations")}
                      className="w-full py-2 bg-pink-50 hover:bg-pink-100/80 text-pink-700 font-bold border border-pink-150 rounded-xl text-[10.5px] transition-colors cursor-pointer text-center"
                    >
                      Open Evaluations Hub
                    </button>
                  </div>
                );
              })()}
              {/* Quick Action Center */}
              <div className="hidden md:block bg-white border border-gray-200 rounded-3xl p-5 shadow-xs space-y-4">
                <h3 className="text-xs font-black text-slate-805 uppercase tracking-widest border-b border-slate-100 pb-2">Quick Actions</h3>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      const element = document.getElementById("timetable-grid");
                      if (element) {
                        element.scrollIntoView({ behavior: "smooth" });
                      } else {
                        setActiveTab("timetable");
                      }
                    }}
                    className="flex flex-col items-center justify-center p-3.5 rounded-2xl border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/10 text-center gap-2 transition-all cursor-pointer bg-white"
                  >
                    <div className="h-9 w-9 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-650 shrink-0">
                      <Calendar className="h-4.5 w-4.5" />
                    </div>
                    <div>
                      <span className="block text-[11px] font-black text-slate-800 leading-tight">Request Swap</span>
                      <span className="text-[8px] text-slate-400 font-extrabold uppercase tracking-wider mt-0.5 block">Grid</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab("handovers")}
                    className="flex flex-col items-center justify-center p-3.5 rounded-2xl border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/10 text-center gap-2 transition-all cursor-pointer bg-white"
                  >
                    <div className="h-9 w-9 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-655 shrink-0">
                      <Clock className="h-4.5 w-4.5" />
                    </div>
                    <div>
                      <span className="block text-[11px] font-black text-slate-800 leading-tight">Handover Logs</span>
                      <span className="text-[8px] text-slate-400 font-extrabold uppercase tracking-wider mt-0.5 block">History</span>
                    </div>
                  </button>
                </div>
              </div>

              {/* Assigned Subjects breakdown */}
              {allMentorSubjects.length > 0 && (
                <div className="bg-white border border-gray-200 rounded-3xl p-5 shadow-xs space-y-3">
                  <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest border-b border-slate-100 pb-2">My Subjects</h3>
                  <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                    {allMentorSubjects.map((sub, idx) => {
                      const targetMins = subjectTargetMinutesMap[sub] || 0;
                      const coveredMins = subjectCoveredMinutesMap[sub] || 0;
                      
                      return (
                        <div key={idx} className="p-3 rounded-xl bg-slate-50/50 border border-slate-200/80 flex flex-col gap-1.5">
                          <div className="flex justify-between items-start gap-2">
                            <span className="text-xs font-bold text-slate-800 line-clamp-1">{sub}</span>
                          </div>
                          <div className="flex gap-1.5">
                            {targetMins > 0 && (
                              <span className="px-2 py-0.5 rounded bg-indigo-50 border border-indigo-100 text-indigo-700 text-[8.5px] font-black uppercase">
                                {toHrs(targetMins)} hr{toHrs(targetMins) !== '1' ? 's' : ''}/wk
                              </span>
                            )}
                            {coveredMins > 0 && (
                              <span className="px-2 py-0.5 rounded bg-teal-50 border border-teal-200 text-teal-700 text-[8.5px] font-black uppercase">
                                +{toHrs(coveredMins)} hr{toHrs(coveredMins) !== '1' ? 's' : ''} substitution
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Recent Handover Activity */}
              <div className="bg-white border border-gray-200 rounded-3xl p-5 shadow-xs space-y-3">
                <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest border-b border-slate-100 pb-2">Recent Handovers</h3>
                {myRequests.length === 0 && myCoverageRequests.length === 0 ? (
                  <p className="text-[11px] text-slate-400 italic text-center py-4">No recent handover activity</p>
                ) : (
                  <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-1">
                    {[...myRequests, ...myCoverageRequests]
                      .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
                      .slice(0, 3)
                      .map((req, idx) => {
                        const isSent = req.requestorId === currentMentor.id;
                        const isPending = req.status === "pending";
                        const isAppr = req.status === "approved";
                        
                        return (
                          <div key={idx} className="p-3 rounded-xl bg-slate-50/50 border border-slate-200/80 space-y-1.5 text-[11px]">
                            <div className="flex justify-between items-center gap-2">
                              <span className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded ${
                                isSent ? "bg-purple-50 text-purple-700 border border-purple-100" : "bg-blue-50 text-blue-700 border border-blue-100"
                              }`}>
                                {isSent ? "Sent Request" : "Incoming Cover"}
                              </span>
                              <span className={`text-[8.5px] font-black uppercase ${
                                isAppr ? "text-emerald-650" : isPending ? "text-amber-600" : "text-rose-505"
                              }`}>
                                {req.status}
                              </span>
                            </div>
                            <p className="text-slate-700 font-medium">
                              {isSent ? `For: ${req.targetStaffName}` : `From: ${req.requestorName}`}
                            </p>
                            <p className="text-slate-455 text-[10px]">
                              {req.course} • {req.dateFormatted}
                            </p>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
            </div>
          </div>



          </>
        )}

      {/* Main Timetable Interface */}
      {activeTab === "timetable" && (
        <div id="timetable-grid" className="bg-white border border-gray-200/80 rounded-3xl p-6 space-y-6 backdrop-blur-md shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-indigo-650" />
                <h2 className="text-lg font-bold text-gray-900">Your Personal Timetable</h2>
              </div>
              
              {/* Week Navigation */}
              <div className="flex items-center gap-1 bg-gray-100/80 p-1 rounded-xl border border-gray-200/60 shadow-inner">
                <button
                  type="button"
                  onClick={() => setWeekOffset(weekOffset - 1)}
                  className="p-1.5 hover:bg-white rounded-lg text-gray-600 hover:text-indigo-650 transition-all cursor-pointer"
                  title="Previous Week"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>
                <span className="text-[10px] font-bold text-gray-755 px-2 min-w-[130px] text-center select-none">
                  {weekDates.some(d => d.dateStr === new Date().toISOString().slice(0, 10)) ? "Current Week" : `${weekDates[0]?.formatted} – ${weekDates[weekDates.length - 1]?.formatted}`}
                </span>
                <button
                  type="button"
                  onClick={() => setWeekOffset(weekOffset + 1)}
                  className="p-1.5 hover:bg-white rounded-lg text-gray-600 hover:text-indigo-650 transition-all cursor-pointer"
                  title="Next Week"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Shift Selector - Hidden or Locked based on Mentor Shift */}
              {currentMentor.shift ? (
                <span className="px-3.5 py-1.5 rounded-xl bg-indigo-50 border border-indigo-200 text-[10px] font-bold text-indigo-700 shadow-sm flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-indigo-500" />
                  {currentMentor.shift === "shift_1" && "Shift 1 Timetable"}
                  {currentMentor.shift === "shift_2" && "Shift 2 Timetable"}
                  {currentMentor.shift === "general" && "General Shift Timetable"}
                </span>
              ) : (
                <div className="flex bg-gray-55 p-1 rounded-xl border border-gray-200 shadow-inner">
                  <button
                    type="button"
                    onClick={() => setCurrentShift("shift_1")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      currentShift === "shift_1"
                        ? "btn-gradient shadow-sm text-white"
                        : "text-gray-550 hover:text-gray-900"
                    }`}
                  >
                    Shift 1
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrentShift("shift_2")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      currentShift === "shift_2"
                        ? "btn-gradient shadow-sm text-white"
                        : "text-gray-550 hover:text-gray-900"
                    }`}
                  >
                    Shift 2
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrentShift("general")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      currentShift === "general"
                        ? "btn-gradient shadow-sm text-white"
                        : "text-gray-550 hover:text-gray-900"
                    }`}
                  >
                    General
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Timetable Control Center (Filters & Legends) - Always visible in Timetable Tab */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-gray-50/50 p-5 rounded-2xl border border-gray-150 shadow-inner text-xs">
            {/* 1. Status Filters */}
            <div className="space-y-2">
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">Status Filters</span>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedStatusFilter(selectedStatusFilter === "active" ? null : "active")}
                  className={`px-3 py-1.5 rounded-xl text-[10px] font-bold shadow-sm transition-all cursor-pointer flex items-center gap-2 border ${
                    selectedStatusFilter === "active"
                      ? "bg-indigo-650 border-indigo-650 text-white hover:bg-indigo-700"
                      : "bg-white border-gray-200 text-gray-750 hover:bg-gray-55"
                  }`}
                >
                  <span className={`h-2 w-2 rounded-full ${selectedStatusFilter === "active" ? "bg-white" : "bg-indigo-600"}`}></span>
                  My Active Class
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedStatusFilter(selectedStatusFilter === "pending" ? null : "pending")}
                  className={`px-3 py-1.5 rounded-xl text-[10px] font-bold shadow-sm transition-all cursor-pointer flex items-center gap-2 border ${
                    selectedStatusFilter === "pending"
                      ? "bg-amber-600 border-amber-600 text-white hover:bg-amber-700"
                      : "bg-amber-50/60 border-amber-300 text-amber-900 hover:bg-amber-100/40"
                  }`}
                >
                  <span className={`h-2 w-2 rounded-full ${selectedStatusFilter === "pending" ? "bg-white" : "bg-amber-500 animate-pulse"}`}></span>
                  Cover Pending
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedStatusFilter(selectedStatusFilter === "handover" ? null : "handover")}
                  className={`px-3 py-1.5 rounded-xl text-[10px] font-bold shadow-sm transition-all cursor-pointer flex items-center gap-2 border ${
                    selectedStatusFilter === "handover"
                      ? "bg-blue-600 border-blue-600 text-white hover:bg-blue-700"
                      : "bg-blue-50/50 border-blue-200 text-blue-900 hover:bg-blue-100/40"
                  }`}
                >
                  <span className={`h-2 w-2 rounded-full ${selectedStatusFilter === "handover" ? "bg-white" : "bg-blue-500"}`}></span>
                  Handed Over / Covering
                </button>
              </div>
            </div>

            {/* 2. Location Legends */}
            {uniqueLocations.length > 0 && (
              <div className="space-y-2">
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">Location Legends</span>
                <div className="flex flex-wrap gap-2">
                  {uniqueLocations.map((loc, idx) => {
                    const isSelected = selectedLocationFilter === loc;
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setSelectedLocationFilter(selectedLocationFilter === loc ? null : loc)}
                        className={`px-3 py-1.5 rounded-xl text-[10px] font-bold shadow-sm transition-all cursor-pointer flex items-center gap-2 border ${
                          isSelected
                            ? "bg-purple-600 border-purple-600 text-white hover:bg-purple-700"
                            : "bg-purple-50/50 border-purple-200 text-purple-905 hover:bg-purple-100/40"
                        }`}
                      >
                        <span className={`h-2 w-2 rounded-full ${isSelected ? "bg-white" : "bg-purple-500"}`}></span>
                        {loc}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 3. Target Classes Buttons */}
            {uniqueClassLabels.length > 0 && (
              <div className="space-y-2">
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">Target Classes (Semesters)</span>
                <div className="flex flex-wrap gap-2">
                  {uniqueClassLabels.map((displayLabel, idx) => {
                    const isSelected = selectedClassFilter === displayLabel;
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleClassFilterClick(displayLabel)}
                        className={`px-3 py-1.5 rounded-xl text-[10px] font-bold shadow-sm transition-all cursor-pointer border ${
                          isSelected
                            ? "bg-teal-600 border-teal-600 text-white hover:bg-teal-700 shadow-inner"
                            : "bg-teal-55 border-teal-105 text-teal-700 hover:bg-teal-100/60"
                        }`}
                      >
                        {displayLabel}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="overflow-auto max-h-[70vh] rounded-2xl border border-gray-200 shadow-sm relative no-scrollbar">
            {/* Weekly Grid Table View */}
            <table className="w-full table-fixed border-collapse text-left min-w-[950px]">
              <thead>
                <tr className="text-xs font-bold uppercase border-b border-gray-200">
                  <th className="sticky top-0 left-0 z-30 p-4 text-gray-500 bg-gray-100/95 backdrop-blur-xs border-r border-b border-gray-200 w-[12%]">Day / Date</th>
                  {(() => {
                    let slotCounter = 0;
                    return rows.map((col, idx) => {
                      if (col.type === "break" || col.type === "lunch") {
                        return (
                          <th key={idx} className="sticky top-0 z-20 p-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-center select-none bg-gray-50/95 backdrop-blur-xs border-b border-gray-200 w-[8%]">
                            <div>{col.label}</div>
                            <div className="text-[9px] text-gray-450 font-normal mt-0.5">{formatTimeLabel(col.timeRange)}</div>
                          </th>
                        );
                      }
                      if (col.type === "slot") {
                        slotCounter++;
                        return (
                          <th key={col.time} className="sticky top-0 z-20 p-4 text-xs font-bold text-gray-750 bg-gray-55/95 backdrop-blur-xs border-b border-gray-200 w-[12%]">
                            <div>Period {slotCounter}</div>
                            <div className="text-[10px] text-gray-400 font-normal mt-0.5">{formatTimeLabel(col.time)}</div>
                          </th>
                        );
                      }
                      return null;
                    });
                  })()}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-150 bg-white">
                {weekDates.map((date) => {
                  return (
                    <tr key={date.day} className="h-24 hover:bg-gray-55/10 transition-colors">
                      {/* First Cell: Day / Date */}
                      <td className="sticky left-0 z-10 p-3 text-xs font-bold text-gray-705 border-r border-gray-200 bg-gray-50/95 backdrop-blur-xs align-middle">
                        <div className="flex flex-col justify-center items-center">
                          <span className="text-sm font-black text-gray-900 leading-none">{date.day}</span>
                          <span className="text-[9px] text-gray-400 font-extrabold uppercase mt-1 leading-none">{date.formatted}</span>
                        </div>
                      </td>
                      
                      {/* Columns */}
                      {rows.map((col, cIdx) => {
                        if (col.type === "break" || col.type === "lunch") {
                          return (
                            <td 
                              key={`break-${cIdx}`} 
                              className="p-2 text-center text-xs font-extrabold text-gray-455 bg-gray-50/5 uppercase tracking-widest italic select-none border-r border-gray-150 last:border-r-0 align-middle"
                            >
                              {col.label}
                            </td>
                          );
                        }
                        
                        if (col.type !== "slot") return null;
                        const time = col.time;
                        const slotResult = getSlotAt(date.day, date.dateStr, time);
                        const slot = slotResult?.slot;
                        const isOwn = slotResult?.type === "own";
                        const isCovering = slotResult?.type === "covering";
                        
                        // Check Handover state for this slot on this date
                        const pendingReq = requests.find(r => r.slotId === slot?.id && r.dateStr === date.dateStr && r.status === "pending");
                        const approvedReq = approvedHandovers.find(h => h.slotId === slot?.id && h.dateStr === date.dateStr);
                        const hasAttendance = slot ? studentAttendance.some(a => a.slotId === slot.id && a.dateStr === date.dateStr) : false;
                        
                        let cellStatus: "active" | "pending" | "handover" | null = null;
                        if (slot) {
                          if (approvedReq || isCovering) cellStatus = "handover";
                          else if (pendingReq) cellStatus = "pending";
                          else cellStatus = "active";
                        }
                        
                        // Apply filters if filter active
                        const isFilteredOut = isFilterActive && (
                          (selectedClassFilter && (!slot || !doesClassMatchFilter(slot.classGroup, selectedClassFilter))) ||
                          (selectedStatusFilter && cellStatus !== selectedStatusFilter) ||
                          (selectedLocationFilter && (!slot || slot.location !== selectedLocationFilter))
                        );

                        const todayStr = new Date().toISOString().slice(0, 10);
                        const isFuture = date.dateStr > todayStr || (date.dateStr === todayStr && (() => {
                          const periodStart = parseSlotStartTime(time);
                          return periodStart ? new Date() < periodStart : false;
                        })());

                        let cardClass = "";
                        if (hasAttendance) {
                          cardClass = "bg-emerald-50/30 border-emerald-200 text-emerald-950 hover:border-emerald-450";
                        } else if (!isFuture) {
                          cardClass = "bg-amber-50/20 border-amber-300 text-amber-950 hover:border-amber-450";
                        } else if (isCovering || approvedReq) {
                          cardClass = "bg-blue-50/40 border-blue-200 text-blue-905 hover:border-blue-300";
                        } else if (pendingReq) {
                          cardClass = "bg-amber-50/50 border-amber-300 text-amber-900 hover:border-amber-400";
                        } else {
                          cardClass = "bg-white border-slate-200 text-slate-700 hover:border-indigo-400";
                        }

                        return (
                          <td
                            key={time}
                            onClick={slot && !isFilteredOut ? () => handleCellClick(date.day, date.dateStr, date.formatted, time) : undefined}
                            className={`p-1.5 h-24 border-r border-gray-150 last:border-r-0 transition-all ${
                              slot && !isFilteredOut ? "cursor-pointer hover:bg-gray-55/50" : isFilterActive ? "bg-white" : "bg-gray-50/10"
                            }`}
                          >
                            {slot && !isFilteredOut ? (
                              <div className={`h-full flex flex-col justify-between p-2 rounded-xl border text-xs transition-all shadow-sm ${cardClass}`}>
                                <div>
                                  {(() => {
                                    const { name, sem } = getShortClassGroup(slot.classGroup);
                                    const yearStr = getYearForClass(slot.classGroup);
                                    const calculatedSem = sem || getSemForClass(slot.classGroup) || (slot.course ? getShortSemLabel(getSemesterFromSlot(slot)) : "");
                                    return (
                                      <div className="flex flex-wrap items-center gap-1 mb-1.5 max-w-full">
                                        {/* Department Badge */}
                                        <span className="px-1.2 py-0.5 rounded bg-indigo-50 border border-indigo-100 text-[8px] font-black text-indigo-700 uppercase tracking-wide truncate max-w-[50px]" title={name}>
                                          {name}
                                        </span>
                                        {/* Year Badge */}
                                        {yearStr && (
                                          <span className="px-1 py-0.5 rounded bg-amber-50 border border-amber-255 text-[7.5px] font-black text-amber-700 uppercase shrink-0">
                                            {yearStr.replace(" Year", " Yr")}
                                          </span>
                                        )}
                                        {/* Semester Badge */}
                                        {calculatedSem && (
                                          <span className="px-1 py-0.5 rounded bg-teal-50 border border-teal-200 text-[7.5px] font-black text-teal-700 uppercase shrink-0">
                                            {calculatedSem}
                                          </span>
                                        )}
                                      </div>
                                    );
                                  })()}
                                  
                                  <div className="font-extrabold text-[10.5px] text-gray-800 line-clamp-2 leading-tight mb-1" title={approvedReq?.course || slot.course}>
                                    {getCanonicalSubjectName(approvedReq?.course || slot.course)}
                                  </div>
                                  <div className="flex items-center gap-1 text-[10px] text-gray-555">
                                    <MapPin className="h-2.5 w-2.5 shrink-0 text-gray-400" />
                                    <span className="truncate font-semibold">{slot.location}</span>
                                  </div>
                                </div>

                                <div className="flex items-center justify-between text-[9px] mt-1 pt-1.5 border-t border-slate-100 font-semibold">
                                  {hasAttendance ? (
                                    <span className="text-[8.5px] font-bold text-emerald-600 flex items-center gap-0.5">
                                      <CheckCircle className="h-3.5 w-3.5 shrink-0" /> Marked
                                    </span>
                                  ) : !isFuture ? (
                                    <span className="text-[8.5px] font-black text-amber-700 flex items-center gap-0.5 uppercase tracking-wider animate-pulse">
                                      ⚠️ Pending
                                    </span>
                                  ) : isCovering ? (
                                    <span className="text-blue-600 flex items-center gap-0.5 truncate">
                                      Cover: {mentors.find(m => m.id === slotResult.originalMentorId)?.name?.split(" ")[0] || "Staff"}
                                    </span>
                                  ) : approvedReq ? (
                                    <span className="text-blue-600 flex items-center gap-0.5 truncate">
                                      Covered: {approvedReq.coverStaffName?.split(" ")[0] || "Staff"}
                                    </span>
                                  ) : pendingReq ? (
                                    <span className="text-amber-600 truncate">
                                      Cover Pending
                                    </span>
                                  ) : (
                                    <span className="text-gray-550">My Class</span>
                                  )}

                                  <span className={`px-1.5 py-0.5 rounded-[4px] text-[7.5px] font-extrabold uppercase ${isCovering || approvedReq
                                      ? 'bg-blue-100 text-blue-700 border border-blue-200/50'
                                      : pendingReq
                                        ? 'bg-amber-105 text-amber-700 border border-amber-200/50'
                                        : 'bg-indigo-55 text-indigo-700 border border-indigo-100'
                                    }`}>
                                    {isCovering ? 'Covering' : approvedReq ? 'Handed Over' : pendingReq ? 'Pending' : 'Active'}
                                  </span>
                                </div>
                              </div>
                            ) : (() => {
                              const demoSession = demoSessions?.find(
                                (ds) =>
                                  ds.mentorId === currentMentor.id &&
                                  ds.dateStr === date.dateStr &&
                                  ds.timeSlot === time
                              );
                              if (demoSession) {
                                const isCompleted = demoSession.status === "completed";
                                return (
                                  <div className={`h-full flex flex-col justify-between p-2 rounded-xl border text-xs shadow-sm ${
                                    isCompleted
                                      ? "bg-emerald-50/70 border-emerald-250 text-emerald-900"
                                      : "bg-pink-50/50 border-pink-200 text-pink-905"
                                  }`}>
                                    <div>
                                      <div className="flex flex-wrap items-center gap-1 mb-1 max-w-full">
                                        <span className="px-1.5 py-0.5 rounded bg-pink-100 dark:bg-pink-950 border border-pink-250 text-[7px] font-black text-pink-700 dark:text-pink-400 uppercase tracking-wide">
                                          Demo Review
                                        </span>
                                        <span className="text-[7.5px] font-black text-pink-400">Week {demoSession.week}</span>
                                      </div>
                                      <div className="font-extrabold text-[10px] leading-tight mb-1 text-gray-800 dark:text-white line-clamp-1">
                                        {demoSession.subject}
                                      </div>
                                      <div className="text-[8px] text-gray-500 font-semibold truncate leading-none">
                                        SME: {demoSession.smeName}
                                      </div>
                                    </div>
                                    <div className="flex items-center justify-between text-[7.5px] mt-1 pt-1.5 border-t border-slate-100 dark:border-slate-800 font-black uppercase">
                                      {isCompleted ? (
                                        <span className="text-emerald-600">Score: {demoSession.marks}</span>
                                      ) : (
                                        <span className="text-pink-600">Scheduled</span>
                                      )}
                                    </div>
                                  </div>
                                );
                              }
                              return isFilterActive ? null : (
                                <div className="h-full flex items-center justify-center border border-dashed border-gray-250 rounded-xl bg-gray-50/10">
                                  <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">No class</span>
                                </div>
                              );
                            })()}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Handover Requests Tracker */}
      {activeTab === "handovers" && (
        <div className="bg-white border border-gray-200 rounded-3xl p-6 backdrop-blur-md shadow-sm space-y-8">
          <div className="flex items-center gap-2 mb-2">
            <ListTodo className="h-5 w-5 text-indigo-655" />
            <h2 className="text-lg font-bold text-gray-900">Class Handover Tracker</h2>
          </div>

          {/* Section 1: Requests Sent */}
          <div className="space-y-3">
            <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">Handovers Requested By You (Sent)</h3>
            {myRequests.length === 0 ? (
              <div className="text-center py-6 border border-gray-150 rounded-xl bg-gray-50/50">
                <p className="text-xs text-gray-500">No sent handover requests submitted yet.</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-gray-205 shadow-sm">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200 text-gray-550 font-bold uppercase text-[10px]">
                      <th className="p-3">Handover Date</th>
                      <th className="p-3">Course / Time</th>
                      <th className="p-3">Covering Staff</th>
                      <th className="p-3">Reason</th>
                      <th className="p-3">Approval Status</th>
                      <th className="p-3">Timestamp</th>
                      <th className="p-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-150 bg-white">
                    {myRequests.map((req) => (
                      <tr key={req.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="p-3 font-bold text-gray-805">
                          <span className="flex items-center gap-1">
                            <CalendarCheck2 className="h-3.5 w-3.5 text-indigo-655" />
                            {req.dateFormatted} ({req.dateStr})
                          </span>
                        </td>
                        <td className="p-3">
                          {(() => {
                            const { name, sem } = getShortClassGroup(req.classGroup);
                            const yearStr = getYearForClass(req.classGroup);
                            return (
                              <div className="flex items-center gap-1.5 flex-wrap mb-1">
                                <span className="px-1.5 py-0.5 rounded bg-indigo-50 border border-indigo-100 text-[8.5px] font-black text-indigo-700 uppercase tracking-wide truncate max-w-[120px]" title={name}>
                                  {name}
                                </span>
                                {yearStr && (
                                  <span className="px-1.5 py-0.5 rounded bg-amber-50 border border-amber-200 text-[8px] font-black text-amber-700 uppercase shrink-0">
                                    {yearStr}
                                  </span>
                                )}
                                {sem && (
                                  <span className="px-1.5 py-0.5 rounded bg-teal-55 border border-teal-200 text-[8px] font-black text-teal-700 uppercase shrink-0">
                                    {sem}
                                  </span>
                                )}
                              </div>
                            );
                          })()}
                          <div className="font-bold text-gray-900">{req.course}</div>
                          <div className="text-[10px] text-gray-550">{req.day}, {formatTimeLabel(req.time)}</div>
                        </td>
                        <td className="p-3 font-bold text-gray-805">
                          <span className="flex items-center gap-1">
                            <UserCheck className="h-3.5 w-3.5 text-indigo-655" />
                            {req.targetStaffName}
                          </span>
                        </td>
                        <td className="p-3 max-w-xs truncate text-gray-650 italic" title={req.reason}>
                          &ldquo;{req.reason}&rdquo;
                        </td>
                        <td className="p-3">
                          <div className="space-y-1">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded text-[9px] font-extrabold uppercase ${req.status === "approved"
                                ? "bg-teal-100 text-teal-800 border border-teal-200/50"
                                : req.status === "rejected"
                                  ? "bg-red-100 text-red-800 border border-red-200/50"
                                  : req.status === "pending_cam"
                                    ? "bg-indigo-150 text-indigo-800 border border-indigo-200/50"
                                    : "bg-amber-100 text-amber-805 border border-amber-200/50"
                              }`}>
                              {req.status === "pending_cam" ? "Awaiting CAM Approval" : req.status}
                            </span>
                            {req.headerReason && (
                              <div className="text-[9px] text-gray-500 border-l-2 border-gray-200 pl-1.5 mt-1">
                                <strong>Note:</strong> {req.headerReason}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="p-3 text-gray-500 font-medium">
                          {formatDate(req.timestamp)}
                        </td>
                        <td className="p-3 text-right">
                          {(req.status === "pending" || req.status === "pending_cam") && (
                            <button
                              type="button"
                              onClick={async () => { const r = await cancelRequest(req.id); toast(r.message, r.success ? "success" : "error"); }}
                              className="px-2.5 py-1.5 rounded-lg bg-red-50 text-red-650 hover:bg-red-100 hover:text-red-700 border border-red-200 transition-colors inline-flex items-center gap-1 text-[10px] font-bold shadow-sm"
                              title="Cancel Request"
                            >
                              <XCircle className="h-3.5 w-3.5" />
                              Cancel
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>



                  {/* Section 2: Requests Received */}
                  <div className="space-y-3 pt-2">
                    <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">Coverage Tasks Assigned To You (Received)</h3>
                    {myCoverageRequests.length === 0 ? (
                      <div className="text-center py-6 border border-gray-150 rounded-xl bg-gray-50/50">
                        <p className="text-xs text-gray-550">No coverage tasks assigned to you yet.</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto rounded-2xl border border-gray-205 shadow-sm">
                        <table className="w-full border-collapse text-left text-xs">
                          <thead>
                            <tr className="bg-gray-55 border-b border-gray-200 text-gray-550 font-bold uppercase text-[10px]">
                              <th className="p-3">Handover Date</th>
                              <th className="p-3">Course / Time</th>
                              <th className="p-3">Requestor (Staff)</th>
                              <th className="p-3">Reason</th>
                              <th className="p-3">Approval Status</th>
                              <th className="p-3">Actions</th>
                              <th className="p-3">Timestamp</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-150 bg-white">
                            {myCoverageRequests.map((req) => (
                              <tr key={req.id} className="hover:bg-gray-50/50 transition-colors">
                                <td className="p-3 font-bold text-gray-805">
                                  <span className="flex items-center gap-1">
                                    <CalendarCheck2 className="h-3.5 w-3.5 text-indigo-655" />
                                    {req.dateFormatted} ({req.dateStr})
                                  </span>
                                </td>
                                <td className="p-3">
                                  {(() => {
                                    const { name, sem } = getShortClassGroup(req.classGroup);
                                    const yearStr = getYearForClass(req.classGroup);
                                    return (
                                      <div className="flex items-center gap-1.5 flex-wrap mb-1">
                                        <span className="px-1.5 py-0.5 rounded bg-indigo-50 border border-indigo-100 text-[8.5px] font-black text-indigo-700 uppercase tracking-wide truncate max-w-[120px]" title={name}>
                                          {name}
                                        </span>
                                        {yearStr && (
                                          <span className="px-1.5 py-0.5 rounded bg-amber-50 border border-amber-200 text-[8px] font-black text-amber-700 uppercase shrink-0">
                                            {yearStr}
                                          </span>
                                        )}
                                        {sem && (
                                          <span className="px-1.5 py-0.5 rounded bg-teal-55 border border-teal-200 text-[8px] font-black text-teal-700 uppercase shrink-0">
                                            {sem}
                                          </span>
                                        )}
                                      </div>
                                    );
                                  })()}
                                  <div className="font-bold text-gray-900">{req.course}</div>
                                  <div className="text-[10px] text-gray-550">{req.day}, {formatTimeLabel(req.time)}</div>
                                </td>
                                <td className="p-3 font-bold text-gray-805">
                                  <div className="flex flex-col gap-1">
                                    <span className="flex items-center gap-1">
                                      <UserCheck className="h-3.5 w-3.5 text-indigo-655" />
                                      {req.requestorName}
                                    </span>
                                    {req.request_type === "swap_compensate" && (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-100 border border-indigo-200 text-indigo-700 text-[8.5px] font-black uppercase tracking-wide w-fit">
                                        ↔ Swap Offer — Compensation
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="p-3 max-w-xs truncate text-gray-650 italic" title={req.reason}>
                                  {req.request_type === "swap_compensate" ? (
                                    <span className="text-indigo-700 not-italic font-semibold">
                                      {req.requestorName.split(" ")[0]} is offering this class as compensation for a past handover.
                                    </span>
                                  ) : (
                                    <>&ldquo;{req.reason}&rdquo;</>
                                  )}
                                </td>
                                <td className="p-3">
                                  <div className="space-y-1">
                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded text-[9px] font-extrabold uppercase ${req.status === "approved"
                                        ? "bg-teal-100 text-teal-800 border border-teal-200/50"
                                        : req.status === "rejected"
                                          ? "bg-red-100 text-red-800 border border-red-200/50"
                                          : "bg-amber-105 text-amber-805 border border-amber-200/50"
                                      }`}>
                                      {req.status}
                                    </span>
                                    {req.headerReason && (
                                      <div className="text-[9px] text-gray-500 border-l-2 border-gray-200 pl-1.5 mt-1">
                                        <strong>Note:</strong> {req.headerReason}
                                      </div>
                                    )}
                                  </div>
                                </td>
                                <td className="p-3">
                                  {req.status === "pending" ? (
                                    <div className="flex gap-2">
                                      <button
                                        type="button"
                                        onClick={async () => {
                                          if (await showConfirm({ message: "Are you sure you want to accept this handover request?", confirmLabel: "Accept" })) {
                                            await handleRequest(req.id, "approved", "", "Mentor", req.course);
                                            toast("Handover request accepted.", "success");
                                          }
                                        }}
                                        className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[9.5px] font-bold shadow-sm transition-colors cursor-pointer"
                                      >
                                        Accept
                                      </button>
                                      <button
                                        type="button"
                                        onClick={async () => {
                                          if (await showConfirm({ message: "Are you sure you want to reject this handover request?", danger: true, confirmLabel: "Reject" })) {
                                            await handleRequest(req.id, "rejected", "", "Mentor");
                                            toast("Handover request rejected.", "info");
                                          }
                                        }}
                                        className="px-2.5 py-1.5 bg-red-50 hover:bg-red-100 border border-red-200 text-red-655 rounded-lg text-[9.5px] font-bold shadow-sm transition-colors cursor-pointer"
                                      >
                                        Reject
                                      </button>
                                    </div>
                                  ) : (
                                    <span className="text-[10px] text-gray-400 font-semibold italic uppercase">
                                      {req.status}
                                    </span>
                                  )}
                                </td>
                                <td className="p-3 text-gray-500 font-medium whitespace-nowrap">
                                  {formatDate(req.timestamp)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )}



      {/* Tab 4: My Profile */}
      {activeTab === "profile" && (
        <div className="space-y-6 font-sans">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Profile Summary Card */}
            <div className="bg-pastel-cream p-7 rounded-dribbble-panel border-transparent shadow-sm flex flex-col items-center justify-between text-center min-h-[300px] group hover:shadow-md transition-all duration-300">
              <div className="flex flex-col items-center space-y-4 w-full">
                <div className="h-20 w-20 rounded-full bg-indigo-650 border-4 border-white text-white flex items-center justify-center text-3xl font-black shadow-md uppercase">
                  {currentMentor.name.substring(0, 2)}
                </div>
                <div>
                  <h2 className="text-lg font-extrabold text-slate-900 leading-tight">{currentMentor.name}</h2>
                  <p className="text-[10px] text-slate-455 font-bold uppercase tracking-wider mt-1">Faculty Mentor Profile</p>
                </div>
                <div className="flex flex-wrap justify-center gap-1.5 pt-1">
                  <span className="px-2 py-0.5 rounded bg-white/80 border border-slate-150 text-[9px] font-black text-slate-700 uppercase">
                    {currentMentor.shift === "shift_1" ? "Shift 1" : currentMentor.shift === "shift_2" ? "Shift 2" : "General Shift"}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-white/80 border border-slate-150 text-[9px] font-black text-slate-700 uppercase">
                    {currentMentor.department}
                  </span>
                </div>
              </div>
              
              <div className="w-full border-t border-slate-155/60 pt-4 mt-4 text-left space-y-2">
                <div className="flex justify-between text-[11px] font-bold">
                  <span className="text-slate-455">Faculty ID</span>
                  <span className="text-slate-800 font-mono">{currentMentor.id}</span>
                </div>
                <div className="flex justify-between text-[11px] font-bold">
                  <span className="text-slate-455">Primary Email</span>
                  <span className="text-slate-800 truncate max-w-[170px]" title={currentMentor.email}>{currentMentor.email}</span>
                </div>
              </div>
            </div>

            {/* Teaching Details Card */}
            <div className="md:col-span-2 bg-white p-7 rounded-dribbble-panel border border-slate-100 shadow-sm space-y-6 flex flex-col justify-between">
              <div>
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Academic & Curricular Assignments</h3>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Assigned Teaching Subjects</span>
                    <div className="flex flex-wrap gap-2">
                      {currentMentor.subjects && currentMentor.subjects.split(/,|\n/).length > 0 ? (
                        currentMentor.subjects.split(/,|\n/).map((subj, idx) => (
                          <span key={idx} className="px-2.5 py-1 rounded-xl bg-indigo-50 border border-indigo-100 text-xs font-bold text-indigo-700">
                            {subj.trim()}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-slate-400 italic">No assigned subjects registered.</span>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Target Student Class Groups</span>
                    <div className="flex flex-wrap gap-2">
                      {currentMentor.classes && currentMentor.classes.split(/,|\n/).length > 0 ? (
                        currentMentor.classes.split(/,|\n/).map((cls, idx) => (
                          <span key={idx} className="px-2.5 py-1 rounded-xl bg-teal-55 border border-teal-100 text-xs font-bold text-teal-700">
                            {cls.trim()}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-slate-400 italic">No assigned class groups registered.</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-2xl flex items-center gap-3">
                <Sparkles className="h-5 w-5 text-indigo-650 shrink-0" />
                <div className="text-[11px] text-indigo-850 font-semibold leading-normal">
                  Your academic profile and subjects list are managed by your Campus Academic Manager (CAM). Shift changes or subject reallocations will be updated automatically upon approval.
                </div>
              </div>
            </div>
          </div>

          {/* Timetable Statistics */}
          <div className="bg-pastel-blue p-7 rounded-dribbble-panel border-transparent shadow-sm space-y-6">
            <h3 className="text-xs font-black text-slate-555 uppercase tracking-widest font-sans">Workload & Coverage Metrics</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 text-center">
              <div className="p-4 bg-white/80 rounded-2xl border border-slate-100/40">
                <span className="text-3xl font-extrabold text-slate-900">
                  {slots.filter(s => s.mentorId === currentMentor.id).length}
                </span>
                <span className="text-[9px] text-slate-455 font-extrabold uppercase tracking-wider block mt-1">Weekly Teaching Slots</span>
              </div>
              <div className="p-4 bg-white/80 rounded-2xl border border-slate-100/40">
                <span className="text-3xl font-extrabold text-slate-900">
                  {requests.filter(r => r.requestorId === currentMentor.id).length}
                </span>
                <span className="text-[9px] text-slate-455 font-extrabold uppercase tracking-wider block mt-1">Handovers Requested</span>
              </div>
              <div className="p-4 bg-white/80 rounded-2xl border border-slate-100/40">
                <span className="text-3xl font-extrabold text-slate-900">
                  {requests.filter(r => r.targetStaffId === currentMentor.id && r.status === "approved").length}
                </span>
                <span className="text-[9px] text-slate-455 font-extrabold uppercase tracking-wider block mt-1">Substitution Duties Covered</span>
              </div>
              <div className="p-4 bg-white/80 rounded-2xl border border-slate-105/40">
                <span className="text-3xl font-extrabold text-slate-900">
                  {studentAttendance.filter(a => a.markedBy === currentMentor.id).length}
                </span>
                <span className="text-[9px] text-slate-455 font-extrabold uppercase tracking-wider block mt-1">Attendance Records Marked</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3.5: Attendance Logs */}
      {activeTab === "attendance" && (() => {
        // Group attendance marked by this mentor
        const mentorAtt = studentAttendance.filter(a => a.markedBy === currentMentor.id);
        
        // Group by slotId + "_" + dateStr
        const groups: Record<string, {
          slotId: string;
          dateStr: string;
          timestamp: string;
          records: typeof studentAttendance;
        }> = {};
        
        mentorAtt.forEach(att => {
          const key = `${att.slotId}_${att.dateStr}`;
          if (!groups[key]) {
            groups[key] = {
              slotId: att.slotId,
              dateStr: att.dateStr,
              timestamp: att.timestamp,
              records: []
            };
          }
          groups[key].records.push(att);
        });
        
        const markedSessions = Object.values(groups).map(g => {
          const slot = slots.find(s => s.id === g.slotId);
          const presentCount = g.records.filter(r => r.status === "present").length;
          const absentCount = g.records.filter(r => r.status === "absent").length;
          const totalMarked = g.records.length;
          const percent = totalMarked > 0 ? Math.round((presentCount / totalMarked) * 100) : 100;
          
          return {
            ...g,
            slot,
            presentCount,
            absentCount,
            totalMarked,
            percent
          };
        }).sort((a, b) => b.dateStr.localeCompare(a.dateStr) || b.timestamp.localeCompare(a.timestamp));

        const filteredSessions = markedSessions.filter(s => {
          const q = attendanceHistorySearch.toLowerCase().trim();
          if (!q) return true;
          const courseName = s.slot?.course?.toLowerCase() || "";
          const classGroup = s.slot?.classGroup?.toLowerCase() || "";
          const date = s.dateStr?.toLowerCase() || "";
          return courseName.includes(q) || classGroup.includes(q) || date.includes(q);
        });

        // Active holidays in the calculator range
        const activeHolidays = holidays.filter(h => h.date >= calcStartDate && h.date <= calcEndDate);

        return (
          <div className="space-y-6 font-sans">
            {/* Sub-navigation tabs */}
            <div className="flex gap-5 border-b border-slate-200 pb-px">
              <button
                type="button"
                onClick={() => setAttendanceLogsSubTab("history")}
                className={`pb-3 text-xs font-black uppercase tracking-wider transition-all relative cursor-pointer ${
                  attendanceLogsSubTab === "history"
                    ? "text-indigo-600 border-b-2 border-indigo-600"
                    : "text-slate-400 hover:text-slate-700"
                }`}
              >
                Marked Session History
              </button>
              <button
                type="button"
                onClick={() => setAttendanceLogsSubTab("calculator")}
                className={`pb-3 text-xs font-black uppercase tracking-wider transition-all relative cursor-pointer ${
                  attendanceLogsSubTab === "calculator"
                    ? "text-indigo-600 border-b-2 border-indigo-600"
                    : "text-slate-400 hover:text-slate-700"
                }`}
              >
                Semester Audit Calculator
              </button>
            </div>

            {attendanceLogsSubTab === "history" ? (
              <div className="bg-white p-7 rounded-dribbble-panel border border-slate-100 shadow-sm space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-base font-black text-slate-905">Class-wise Attendance Logs</h2>
                    <p className="text-xs text-slate-400 font-semibold mt-0.5">Records of all period attendance sheets you have submitted.</p>
                  </div>
                  
                  {/* Search Log Bar */}
                  <div className="relative w-full sm:w-72">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                      <Search className="h-4 w-4 text-slate-400" />
                    </span>
                    <input
                      type="text"
                      placeholder="Search course or cohort..."
                      value={attendanceHistorySearch}
                      onChange={(e) => setAttendanceHistorySearch(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 border border-slate-205 rounded-xl bg-white text-xs font-semibold focus:ring-1 focus:ring-slate-800 outline-none shadow-xs"
                    />
                  </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto rounded-2xl border border-slate-205 shadow-sm">
                  <table className="w-full border-collapse text-left text-xs font-semibold">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-550 font-bold uppercase text-[9.5px]">
                        <th className="p-3.5 border-r border-slate-100">Session Date</th>
                        <th className="p-3.5 border-r border-slate-100">Course Name / Period</th>
                        <th className="p-3.5 border-r border-slate-100">Class Group (Cohort)</th>
                        <th className="p-3.5 border-r border-slate-100">Classroom</th>
                        <th className="p-3.5 border-r border-slate-100 text-center">Marked Count</th>
                        <th className="p-3.5 border-r border-slate-100 text-center">Present / Absent</th>
                        <th className="p-3.5 border-r border-slate-100 text-center">Attendance %</th>
                        <th className="p-3.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white text-slate-700">
                      {filteredSessions.map((session, idx) => {
                        if (!session.slot) return null;
                        return (
                          <tr key={idx} className="hover:bg-slate-55/35 transition-colors">
                            <td className="p-3.5 font-bold text-slate-805 border-r border-slate-100">
                              {session.dateStr}
                            </td>
                            <td className="p-3.5 border-r border-slate-100">
                              <div className="font-bold text-slate-805">{session.slot.course}</div>
                              <div className="text-[10px] text-slate-400">{session.slot.time}</div>
                            </td>
                            <td className="p-3.5 font-bold text-slate-805 border-r border-slate-100">
                              {session.slot.classGroup}
                            </td>
                            <td className="p-3.5 text-slate-500 border-r border-slate-100">
                              <span className="bg-slate-100 px-2 py-0.5 rounded text-[10px] font-bold">
                                {session.slot.location}
                              </span>
                            </td>
                            <td className="p-3.5 text-center font-bold border-r border-slate-100">
                              {session.totalMarked} students
                            </td>
                            <td className="p-3.5 text-center border-r border-slate-100">
                              <span className="text-emerald-600 font-bold">{session.presentCount} P</span>
                              <span className="text-slate-355 mx-1">•</span>
                              <span className="text-rose-650 font-bold">{session.absentCount} A</span>
                            </td>
                            <td className="p-3.5 text-center border-r border-slate-100">
                              <span className={`px-2 py-0.5 rounded font-black text-[10px] ${
                                session.percent >= 75
                                  ? "bg-emerald-50 text-emerald-705 border border-emerald-100"
                                  : "bg-rose-50 text-rose-705 border border-rose-100"
                              }`}>
                                {session.percent}%
                              </span>
                            </td>
                            <td className="p-3.5 text-right">
                              <button
                                type="button"
                                onClick={() => {
                                  const weekday = new Date(session.dateStr).toLocaleDateString("en-US", { weekday: "long" });
                                  const dateFormatted = new Date(session.dateStr).toLocaleDateString("en-US", {
                                    weekday: "long",
                                    year: "numeric",
                                    month: "long",
                                    day: "numeric"
                                  });
                                  handleCellClick(weekday, session.dateStr, dateFormatted, session.slot!.time);
                                }}
                                className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-705 rounded-lg text-[9.5px] font-bold shadow-xs transition-colors cursor-pointer"
                              >
                                View & Edit
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                      {filteredSessions.length === 0 && (
                        <tr>
                          <td colSpan={8} className="p-8 text-center text-xs text-slate-400 italic">
                            No marked attendance logs found.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="bg-white p-7 rounded-dribbble-panel border border-slate-100 shadow-sm space-y-6">
                <div>
                  <h2 className="text-base font-black text-slate-905">Semester Attendance Audit</h2>
                  <p className="text-xs text-slate-400 font-semibold mt-0.5">Calculate dynamic cumulative student attendance averages, automatically excluding holidays.</p>
                </div>

                {/* Filters */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50/50 p-5 rounded-2xl border border-slate-150">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Select Cohort (Class Group)</label>
                    <select
                      value={calcCohort}
                      onChange={(e) => setCalcCohort(e.target.value)}
                      className="w-full p-2.5 bg-white border border-slate-205 rounded-xl text-xs font-bold outline-none cursor-pointer"
                    >
                      <option value="" disabled>Choose cohort...</option>
                      {mentorClassGroups.map(cg => (
                        <option key={cg} value={cg}>{cg}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Semester Start Date</label>
                    <input
                      type="date"
                      value={calcStartDate}
                      onChange={(e) => setCalcStartDate(e.target.value)}
                      className="w-full p-2.5 bg-white border border-slate-205 rounded-xl text-xs font-semibold outline-none"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Semester End Date</label>
                    <input
                      type="date"
                      value={calcEndDate}
                      onChange={(e) => setCalcEndDate(e.target.value)}
                      className="w-full p-2.5 bg-white border border-slate-205 rounded-xl text-xs font-semibold outline-none"
                    />
                  </div>
                </div>

                {/* Holiday Status Notification Banner */}
                <div className="bg-indigo-50/50 border border-indigo-150 p-4 rounded-2xl space-y-2">
                  <div className="flex items-center gap-2 text-indigo-850 font-bold text-[11px]">
                    <AlertCircle className="h-4.5 w-4.5 text-indigo-600 shrink-0" />
                    <span>Holiday Marking Policy Active</span>
                  </div>
                  <p className="text-[10px] text-indigo-700 leading-normal font-medium">
                    Conducted slot denominators exclude all Saturdays, Sundays, and campus-scheduled holidays. If any holiday dates fall within the audit range, no periods are counted on those dates.
                  </p>
                  
                  {activeHolidays.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5 pt-1.5 border-t border-indigo-100/50">
                      <span className="text-[9px] font-bold text-indigo-500 uppercase self-center mr-1">Holidays in range:</span>
                      {activeHolidays.map(hol => (
                        <span key={hol.id} className="px-2 py-0.5 rounded-md bg-white border border-indigo-200 text-[9.5px] font-black text-indigo-700" title={hol.type}>
                          {hol.title} ({hol.date})
                        </span>
                      ))}
                    </div>
                  ) : (
                    <div className="text-[9px] text-indigo-400 italic pt-1 border-t border-indigo-100/30">
                      No public holidays configured in this date range.
                    </div>
                  )}
                </div>

                {/* Calculation Results Table */}
                <div className="overflow-x-auto rounded-2xl border border-slate-205 shadow-sm">
                  <table className="w-full border-collapse text-left text-xs font-semibold">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-550 font-bold uppercase text-[9.5px]">
                        <th className="p-3.5 border-r border-slate-100">Student Name</th>
                        <th className="p-3.5 border-r border-slate-100">Student ID</th>
                        <th className="p-3.5 border-r border-slate-100 text-center">Periods Conducted</th>
                        <th className="p-3.5 border-r border-slate-100 text-center">Periods Attended (Excused)</th>
                        <th className="p-3.5 border-r border-slate-100 text-center">Periods Absent</th>
                        <th className="p-3.5 border-r border-slate-100 text-center">Cumulative %</th>
                        <th className="p-3.5 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white text-slate-700">
                      {semesterReports.map(({ student, conducted, present, absent, percentage }, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                          <td className="p-3.5 font-bold text-slate-805 border-r border-slate-100">
                            {student.name}
                          </td>
                          <td className="p-3.5 font-mono text-slate-500 border-r border-slate-100">
                            {student.id}
                          </td>
                          <td className="p-3.5 text-center font-bold border-r border-slate-100">
                            {conducted}
                          </td>
                          <td className="p-3.5 text-center text-emerald-600 font-bold border-r border-slate-100">
                            {present}
                          </td>
                          <td className="p-3.5 text-center text-rose-600 font-bold border-r border-slate-100">
                            {absent}
                          </td>
                          <td className="p-3.5 text-center border-r border-slate-100">
                            <span className={`px-2 py-0.5 rounded font-black text-[10px] ${
                              percentage >= 75
                                ? "bg-emerald-50 text-emerald-705 border border-emerald-100"
                                : "bg-rose-50 text-rose-705 border border-rose-100"
                            }`}>
                              {percentage}%
                            </span>
                          </td>
                          <td className="p-3.5 text-center">
                            <span className={`px-2 py-0.5 rounded text-[9.5px] font-black uppercase tracking-wider ${
                              percentage >= 75
                                ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                                : "bg-rose-100 text-rose-800 border border-rose-200"
                            }`}>
                              {percentage >= 75 ? "Eligible" : "Shortage"}
                            </span>
                          </td>
                        </tr>
                      ))}
                      {semesterReports.length === 0 && (
                        <tr>
                          <td colSpan={7} className="p-8 text-center text-slate-400 italic">
                            Select a class group above to calculate cumulative semester attendance.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Audit lock actions */}
                {semesterReports.length > 0 && (
                  <div className="flex justify-end gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        const csvRows = [
                          ["Student Name", "Student ID", "Conducted", "Attended", "Absent", "Percentage", "Status"],
                          ...semesterReports.map(r => [
                            r.student.name,
                            r.student.id,
                            r.conducted,
                            r.present,
                            r.absent,
                            `${r.percentage}%`,
                            r.percentage >= 75 ? "ELIGIBLE" : "SHORTAGE"
                          ])
                        ];
                        const csvContent = "data:text/csv;charset=utf-8," + csvRows.map(e => e.join(",")).join("\n");
                        const encodedUri = encodeURI(csvContent);
                        const link = document.createElement("a");
                        link.setAttribute("href", encodedUri);
                        link.setAttribute("download", `attendance_semester_report_${calcCohort.replace(/\s+/g, "_")}.csv`);
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                      }}
                      className="px-4 py-2 rounded-xl border border-slate-205 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95"
                    >
                      Export CSV Report
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        toast(`Semester Attendance Audited & Locked for "${calcCohort}". Total: ${semesterReports.length} students — Eligible: ${semesterReports.filter(r => r.percentage >= 75).length}, Shortage: ${semesterReports.filter(r => r.percentage < 75).length}.`, "success");
                      }}
                      className="px-4 py-2 rounded-xl bg-[#4F46E5] hover:bg-indigo-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95 border-none"
                    >
                      Verify & Lock Semester Record
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })()}

      {/* Modal / Slider Drawer */}
      {isModalOpen && selectedCell && selectedCell.slot && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/55 backdrop-blur-sm p-0 sm:p-4">
          <div className="relative w-full max-w-2xl h-[90vh] sm:h-[640px] bg-white border-t sm:border border-slate-205 rounded-t-3xl sm:rounded-3xl shadow-2xl p-4 sm:p-5 flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-200">
            <div className="absolute right-0 top-0 h-24 w-24 rounded-full bg-indigo-500/5 blur-xl pointer-events-none"></div>

            {/* Header */}
            <div className="relative z-10 flex items-center justify-between mb-3.5 shrink-0">
              <h3 className="text-lg font-bold text-gray-955">
                Class Actions - {selectedCell.slot.course}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-gray-655 transition-colors cursor-pointer"
                type="button"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Sleek Segmented Switch for Tabs */}
            <div className="flex bg-slate-100/60 p-1 rounded-2xl border border-slate-200/50 mb-3.5 shrink-0">
              <button
                type="button"
                onClick={() => setModalTab("attendance")}
                className={`flex-1 py-2 rounded-xl font-black text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  modalTab === "attendance"
                    ? "bg-white text-indigo-655 shadow-sm border border-slate-250/20"
                    : "text-slate-500 hover:text-slate-800 hover:bg-white/40"
                }`}
              >
                <CheckCircle className="h-3.5 w-3.5" />
                Mark Attendance
              </button>
              <button
                type="button"
                onClick={() => setModalTab("handover")}
                className={`flex-1 py-2 rounded-xl font-black text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  modalTab === "handover"
                    ? "bg-white text-indigo-655 shadow-sm border border-slate-250/20"
                    : "text-slate-500 hover:text-slate-800 hover:bg-white/40"
                }`}
              >
                <Send className="h-3.5 w-3.5" />
                Request Handover
              </button>
            </div>

            {/* Slot Info Card — Sleek horizontal glassmorphic ribbon */}
            {(() => {
              const { name: deptShort, sem } = getShortClassGroup(selectedCell.slot.classGroup);
              const yearStr = getYearForClass(selectedCell.slot.classGroup);
              const shiftLabel = selectedCell.slot.shift === "shift_1" ? "Shift 1" : selectedCell.slot.shift === "shift_2" ? "Shift 2" : "General";
              return (
                <div className="mb-3.5 p-3 rounded-2xl bg-indigo-50/40 border border-indigo-100/55 flex flex-wrap items-center justify-between gap-3 text-xs shadow-xs shrink-0">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-lg bg-indigo-600 text-white text-[9.5px] font-black uppercase tracking-wider">{deptShort || "Class"}</span>
                    {yearStr && <span className="px-2 py-0.5 rounded-lg bg-amber-100 text-amber-800 text-[9.5px] font-black uppercase border border-amber-200">{yearStr}</span>}
                    {sem && <span className="px-2 py-0.5 rounded-lg bg-teal-100 text-teal-800 text-[9.5px] font-black uppercase border border-teal-200">{sem}</span>}
                    <span className="px-2 py-0.5 rounded-lg bg-slate-100 text-slate-500 text-[9.5px] font-extrabold border border-slate-200">{shiftLabel}</span>
                  </div>
                  <div className="flex items-center gap-3 text-slate-655 text-[11px] font-bold">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
                      {selectedCell.dateFormatted}
                    </span>
                    <span className="text-slate-300">|</span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
                      {formatTimeLabel(selectedCell.time)}
                    </span>
                    {selectedCell.slot.location && (
                      <>
                        <span className="text-slate-300">|</span>
                        <span className="flex items-center gap-1 truncate max-w-[120px]">
                          <MapPin className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
                          {selectedCell.slot.location}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              );
            })()}

            {formError && (
              <div className="mb-3.5 p-3 bg-red-50 border border-red-100 rounded-xl flex items-start gap-2 text-xs text-red-655 shrink-0 animate-in fade-in">
                <AlertCircle className="h-4.5 w-4.5 shrink-0 mt-0.5" />
                <span>{formError}</span>
              </div>
            )}

            {/* Attendance Tab */}
            {modalTab === "attendance" && (() => {
              const today = new Date();
              const y = today.getFullYear();
              const m = String(today.getMonth() + 1).padStart(2, '0');
              const d = String(today.getDate()).padStart(2, '0');
              const todayStr = `${y}-${m}-${d}`;

              const windowCheck = checkAttendanceWindow(selectedCell.dateStr, selectedCell.time);
              const isLocked = !windowCheck.open && windowCheck.reason === "expired";
              const isFuture = windowCheck.reason === "future";

              const approvedReq = approvedHandovers.find(h => h.slotId === selectedCell.slot!.id && h.dateStr === selectedCell.dateStr);

              // 1. If it's a future class, they cannot mark attendance
              if (isFuture) {
                return (
                  <div className="py-8 px-4 bg-amber-50 border border-amber-100 rounded-2xl text-center text-xs text-amber-805 space-y-2 shrink-0">
                    <AlertCircle className="h-8 w-8 mx-auto text-amber-500" />
                    <p className="font-bold">Attendance cannot be marked yet</p>
                    <p className="text-gray-500 font-medium">You can only mark attendance for classes that have already started or are in the past.</p>
                  </div>
                );
              }

              // 1b. If the attendance window has expired (Locked)
              if (isLocked) {
                const prevExisting = studentAttendance.filter(
                  (a) => a.slotId === selectedCell.slot!.id && a.dateStr === selectedCell.dateStr
                );
                const prevPresent = prevExisting.filter(a => a.status === "present").length;
                const prevAbsent = prevExisting.filter(a => a.status === "absent").length;
                const prevOD = prevExisting.filter(a => a.status === "od").length;
                return (
                  <div className="py-6 px-4 bg-red-50/50 border border-red-100 rounded-2xl text-center text-xs text-red-800 space-y-3 shrink-0 overflow-y-auto">
                    <Lock className="h-8 w-8 mx-auto text-red-500" />
                    <p className="font-bold text-sm">Attendance Window Closed</p>
                    <p className="text-gray-500 font-semibold">{windowCheck.message}</p>
                    {prevExisting.length > 0 ? (
                      <div className="mt-3 p-4 bg-white rounded-2xl border border-red-150 text-left text-slate-700 space-y-2 shadow-sm">
                        <p className="font-black text-xs text-slate-800 uppercase tracking-wider mb-2 border-b pb-1">Marked Summary:</p>
                        <p className="flex justify-between"><span>Present:</span> <span className="font-black text-emerald-600">{prevPresent}</span></p>
                        <p className="flex justify-between"><span>Absent:</span> <span className="font-black text-rose-600">{prevAbsent}</span></p>
                        <p className="flex justify-between"><span>OD (On Duty):</span> <span className="font-black text-blue-600">{prevOD}</span></p>
                        <p className="text-[10px] text-slate-450 font-bold mt-3 italic text-center block bg-slate-50 p-2 rounded-xl border">Contact your Campus Manager (CAM) for in-person corrections.</p>
                      </div>
                    ) : (
                      <p className="text-[10px] text-slate-450 italic font-semibold">No attendance was marked for this slot before the window closed.</p>
                    )}
                    <button type="button" onClick={() => setIsModalOpen(false)} className="w-full bg-white border border-red-200 hover:bg-red-50 text-red-700 rounded-xl py-2.5 text-xs font-bold mt-2 transition-all cursor-pointer">Close</button>
                  </div>
                );
              }

              // 2. If it's their own class, but handed over to someone else (approved handover exists)
              // and the logged in mentor is the original mentor
              if (selectedCell.type === "own" && approvedReq) {
                return (
                  <div className="py-8 px-4 bg-blue-50 border border-blue-100 rounded-2xl text-center text-xs text-blue-800 space-y-2 shrink-0">
                    <CheckCircle className="h-8 w-8 mx-auto text-blue-500" />
                    <p className="font-bold">Class Handed Over</p>
                    <p className="text-gray-500 font-medium">This class has been handed over to <span className="font-bold">{approvedReq.coverStaffName}</span>. They are responsible for marking attendance.</p>
                  </div>
                );
              }

              // 3. Otherwise, they can mark attendance
              const classStudents = students.filter(
                (student) => isClassGroupMatch(student.classGroup, selectedCell.slot!.classGroup)
              );

              if (classStudents.length === 0) {
                return (
                  <div className="py-8 px-4 bg-gray-50 border border-gray-150 rounded-2xl text-center text-xs text-gray-500 shrink-0">
                    <p className="font-bold">No students registered</p>
                    <p className="text-[10px] text-gray-400 mt-1">There are no students registered under the class group: <span className="font-semibold">{selectedCell.slot!.classGroup}</span>.</p>
                  </div>
                );
              }

              const isPastDay = selectedCell.dateStr < todayStr || isLocked;

              // Bug #13 fix: check if attendance was already marked for this slot+date
              const existingAttendance = studentAttendance.filter(
                (a) => a.slotId === selectedCell.slot!.id && a.dateStr === selectedCell.dateStr
              );
              const alreadyMarked = existingAttendance.length > 0;
              const prevPresent = existingAttendance.filter(a => a.status === "present").length;
              const prevAbsent = existingAttendance.filter(a => a.status === "absent").length;

              const presentCount = Object.values(localAttendance).filter(v => v === "present").length;
              const absentCount = Object.values(localAttendance).filter(v => v === "absent").length;
              const odCount = Object.values(localAttendance).filter(v => v === "od").length;
              const notMarkedCount = classStudents.length - presentCount - absentCount - odCount;

              const filteredStudents = classStudents.filter(s =>
                s.name.toLowerCase().includes(attendanceSearchTerm.toLowerCase()) ||
                s.id.toLowerCase().includes(attendanceSearchTerm.toLowerCase())
              );

              const handleToggleStudent = (studentId: string) => {
                if (isPastDay) return;
                setLocalAttendance(prev => {
                  const current = prev[studentId] || "not_marked";
                  let next: "present" | "absent" | "od" | "not_marked";
                  if (current === "not_marked") next = "present";
                  else if (current === "present") next = "absent";
                  else if (current === "absent") next = "od";
                  else next = "not_marked";
                  return {
                    ...prev,
                    [studentId]: next
                  };
                });
              };

              const handleMarkAll = (status: "present" | "absent" | "od" | "not_marked") => {
                if (isPastDay) return;
                const updated: Record<string, "present" | "absent" | "od" | "not_marked"> = {};
                classStudents.forEach(s => {
                  updated[s.id] = status;
                });
                setLocalAttendance(updated);
              };

              const handleStudentCheckboxClick = (e: React.MouseEvent, studentId: string) => {
                e.stopPropagation();
                const isChecked = selectedStudentIds.includes(studentId);
                let newSelected = [...selectedStudentIds];

                if (e.shiftKey && lastCheckedId) {
                  const startIdx = filteredStudents.findIndex(s => s.id === lastCheckedId);
                  const endIdx = filteredStudents.findIndex(s => s.id === studentId);
                  if (startIdx !== -1 && endIdx !== -1) {
                    const minIdx = Math.min(startIdx, endIdx);
                    const maxIdx = Math.max(startIdx, endIdx);
                    const rangeIds = filteredStudents.slice(minIdx, maxIdx + 1).map(s => s.id);
                    
                    if (!isChecked) {
                      newSelected = Array.from(new Set([...newSelected, ...rangeIds]));
                    } else {
                      newSelected = newSelected.filter(id => !rangeIds.includes(id));
                    }
                  }
                } else {
                  if (isChecked) {
                    newSelected = newSelected.filter(id => id !== studentId);
                  } else {
                    newSelected.push(studentId);
                  }
                }

                setSelectedStudentIds(newSelected);
                setLastCheckedId(studentId);
              };

              const applyRangeSelection = () => {
                if (!rangeStartId || !rangeEndId) return;
                const startIdx = filteredStudents.findIndex(s => s.id === rangeStartId);
                const endIdx = filteredStudents.findIndex(s => s.id === rangeEndId);
                if (startIdx !== -1 && endIdx !== -1) {
                  const minIdx = Math.min(startIdx, endIdx);
                  const maxIdx = Math.max(startIdx, endIdx);
                  const rangeIds = filteredStudents.slice(minIdx, maxIdx + 1).map(s => s.id);
                  setSelectedStudentIds(prev => Array.from(new Set([...prev, ...rangeIds])));
                }
              };

              const handleBulkMark = (status: "present" | "absent" | "od" | "not_marked") => {
                setLocalAttendance(prev => {
                  const updated = { ...prev };
                  selectedStudentIds.forEach(id => {
                    updated[id] = status;
                  });
                  return updated;
                });
                setSelectedStudentIds([]);
              };

              const handleSaveAttendance = async () => {
                const windowCheck = checkAttendanceWindow(selectedCell.dateStr, selectedCell.time);
                if (!windowCheck.open && windowCheck.reason === "expired") {
                  setFormError(windowCheck.message || "Attendance window is closed.");
                  return;
                }

                setIsSubmittingAttendance(true);
                setFormError("");
                try {
                  const attendancePayload = classStudents.map(s => ({
                    studentId: s.id,
                    status: localAttendance[s.id] || "not_marked"
                  }));
                  
                  let finalSubject = selectedCell.slot!.course;
                  if (selectedCell.type === "covering") {
                    if (handoverSubject === "substitute_own") {
                      if (!selectedSubjName) {
                        setFormError("Please select the subject covered.");
                        setIsSubmittingAttendance(false);
                        return;
                      }
                      finalSubject = selectedSubjName;
                    } else if (handoverSubject === "custom") {
                      if (!customSubjName.trim()) {
                        setFormError("Please enter the custom subject covered.");
                        setIsSubmittingAttendance(false);
                        return;
                      }
                      finalSubject = customSubjName.trim();
                    }
                  }

                  const res = await markAttendance(
                    selectedCell.slot!.id, 
                    selectedCell.dateStr, 
                    attendancePayload,
                    selectedCell.type === "covering" ? finalSubject : undefined,
                    attendanceType,
                    attendanceMode,
                    attendanceType === "Non-Regular" ? attendanceTypeSub : undefined
                  );
                  if (res.success) {
                    setIsModalOpen(false);
                  } else {
                    setFormError(res.message || "Failed to mark attendance.");
                  }
                } catch (err: any) {
                  setFormError(err.message || "Something went wrong.");
                } finally {
                  setIsSubmittingAttendance(false);
                }
              };

              return (
                <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                  {/* Step Tracker (Only shown if NOT past/locked) */}
                  {!isPastDay && (
                    <div className="flex items-center justify-between gap-2 p-1 border-b border-slate-100 pb-3 shrink-0 mb-3.5">
                      {[
                        { num: 1, label: "Setup" },
                        { num: 2, label: "Roster Grid" },
                        { num: 3, label: "Review & Save" }
                      ].map((step, idx) => {
                        const isActive = attendanceStep === step.num;
                        const isCompleted = attendanceStep > step.num;
                        return (
                          <React.Fragment key={step.num}>
                            <div className="flex items-center gap-2">
                              <span className={`h-5 w-5 rounded-full text-[10px] font-semibold flex items-center justify-center border transition-all ${
                                isActive ? "bg-slate-900 border-slate-900 text-white shadow-xs" :
                                isCompleted ? "bg-emerald-500 border-emerald-500 text-white" :
                                "bg-white border-slate-200 text-slate-400"
                              }`}>
                                {isCompleted ? <Check className="h-3 w-3" /> : step.num}
                              </span>
                              <span className={`text-xs font-medium ${
                                isActive ? "text-slate-900 font-semibold" : "text-slate-400"
                              }`}>
                                {step.label}
                              </span>
                            </div>
                            {idx < 2 && <div className="h-[1px] bg-slate-200 flex-1 mx-2" />}
                          </React.Fragment>
                        );
                      })}
                    </div>
                  )}

                  {/* Warning banner for past dates */}
                  {isPastDay && !isLocked && (
                    <div className="p-3 bg-amber-50/50 border border-amber-200 text-amber-800 text-xs rounded-lg flex items-center gap-1.5 font-medium shadow-xs shrink-0 mb-3">
                      <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
                      <span>Warning: Attendance for past dates is in View-Only mode.</span>
                    </div>
                  )}

                  {/* Step 1: Setup (Only shown if NOT past/locked) */}
                  {attendanceStep === 1 && !isPastDay && (
                    <div className="flex-1 min-h-0 flex flex-col overflow-hidden animate-in fade-in duration-150">
                      <div className="flex-1 min-h-0 overflow-y-auto space-y-4 py-1 pr-1 pb-1">
                        {alreadyMarked && (
                          <div className="p-3 bg-indigo-50 border border-indigo-200 text-indigo-850 text-xs rounded-lg flex items-center gap-2 font-medium shadow-xs">
                            <CheckCircle className="h-4 w-4 shrink-0 text-indigo-655" />
                            <span>
                              Attendance already marked: {prevPresent} present, {prevAbsent} absent.
                              Saving again will overwrite the previous record.
                            </span>
                          </div>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {/* Type Selection */}
                          <div className="space-y-2">
                            <label className="text-xs font-medium text-slate-500">Attendance Type</label>
                            <div className="flex flex-col gap-2">
                              <button
                                type="button"
                                onClick={() => setAttendanceType("Regular")}
                                className={`p-3 text-left rounded-lg border transition-all cursor-pointer flex flex-col gap-1 ${
                                  attendanceType === "Regular"
                                    ? "bg-slate-55 border-slate-900 ring-1 ring-slate-900"
                                    : "bg-white border-slate-200 hover:bg-slate-50"
                                }`}
                              >
                                <span className="font-semibold text-xs text-slate-900">Regular Class</span>
                                <span className="text-[10px] text-slate-400 leading-tight">Standard syllabus session matching current timetable.</span>
                              </button>
                              
                              <button
                                type="button"
                                onClick={() => setAttendanceType("Non-Regular")}
                                className={`p-3 text-left rounded-lg border transition-all cursor-pointer flex flex-col gap-1 ${
                                  attendanceType === "Non-Regular"
                                    ? "bg-slate-55 border-slate-900 ring-1 ring-slate-900"
                                    : "bg-white border-slate-200 hover:bg-slate-50"
                                }`}
                              >
                                <span className="font-semibold text-xs text-slate-900">Non-Regular Session</span>
                                <span className="text-[10px] text-slate-400 leading-tight">Special sessions like events, examinations, or guest lectures.</span>
                              </button>
                            </div>

                            {attendanceType === "Non-Regular" && (
                              <div className="pt-2 animate-in slide-in-from-top-1 duration-100">
                                <label className="text-[10px] text-slate-450 uppercase tracking-wider font-semibold block mb-1">Select Sub-Category</label>
                                <select
                                  value={attendanceTypeSub}
                                  onChange={(e) => setAttendanceTypeSub(e.target.value)}
                                  className="w-full bg-white border border-slate-200 rounded-md px-3 py-1.5 text-xs font-semibold text-slate-800 outline-none shadow-sm cursor-pointer focus:border-slate-400"
                                >
                                  <option value="Event">Event</option>
                                  <option value="Exam">Exam</option>
                                  <option value="Activity">Activity</option>
                                  <option value="Others">Others</option>
                                </select>
                              </div>
                            )}
                          </div>

                          {/* Mode Selection */}
                          <div className="space-y-2">
                            <label className="text-xs font-medium text-slate-500">Session Mode</label>
                            <div className="flex flex-col gap-2">
                              <button
                                type="button"
                                onClick={() => setAttendanceMode("Offline")}
                                className={`p-3 text-left rounded-lg border transition-all cursor-pointer flex flex-col gap-1 ${
                                  attendanceMode === "Offline"
                                    ? "bg-slate-55 border-slate-900 ring-1 ring-slate-900"
                                    : "bg-white border-slate-200 hover:bg-slate-50"
                                }`}
                              >
                                <span className="font-semibold text-xs text-slate-900">Offline (In-Person)</span>
                                <span className="text-[10px] text-slate-400 leading-tight">Class held physically on campus in designated classrooms.</span>
                              </button>
                              
                              <button
                                type="button"
                                onClick={() => setAttendanceMode("Online")}
                                className={`p-3 text-left rounded-lg border transition-all cursor-pointer flex flex-col gap-1 ${
                                  attendanceMode === "Online"
                                    ? "bg-slate-55 border-slate-900 ring-1 ring-slate-900"
                                    : "bg-white border-slate-200 hover:bg-slate-50"
                                }`}
                              >
                                <span className="font-semibold text-xs text-slate-900">Online (Remote)</span>
                                <span className="text-[10px] text-slate-400 leading-tight">Virtual class held via Google Meet, Zoom, or Teams.</span>
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Covered Subject Selection for Substitution Classes */}
                        {selectedCell.type === "covering" && (
                          <div className="p-3 bg-slate-50/50 border border-slate-200 rounded-lg space-y-2.5 mt-1 animate-in slide-in-from-top-1 duration-150">
                            <p className="text-[10px] text-slate-450 uppercase tracking-wider font-semibold">Covered Subject for this Substitution</p>
                            <div className="flex flex-col sm:flex-row gap-2">
                              {["original", "substitute_own", "custom"].map(modeOpt => (
                                <button
                                  key={modeOpt}
                                  type="button"
                                  onClick={() => setHandoverSubject(modeOpt)}
                                  className={`flex-1 px-3 py-1.5 text-center rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                                    handoverSubject === modeOpt
                                      ? "bg-slate-900 text-white border-slate-900 shadow-sm"
                                      : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
                                  }`}
                                >
                                  {modeOpt === "original" ? `Original (${selectedCell.handover?.course || selectedCell.slot!.course})` :
                                   modeOpt === "substitute_own" ? "My Own" : "Custom"}
                                </button>
                              ))}
                            </div>
                            {handoverSubject === "substitute_own" && (
                              <select
                                value={selectedSubjName}
                                onChange={(e) => setSelectedSubjName(e.target.value)}
                                className="w-full bg-white border border-slate-200 rounded-md px-3 py-1.5 text-xs font-semibold text-slate-800 outline-none cursor-pointer focus:border-slate-400"
                              >
                                <option value="">-- Choose Subject --</option>
                                {(currentMentor?.subjects || "").split(/\n|,|;/).map(s => s.trim()).filter(Boolean).map((s, idx) => (
                                  <option key={idx} value={s}>{s}</option>
                                ))}
                              </select>
                            )}
                            {handoverSubject === "custom" && (
                              <input
                                type="text"
                                placeholder="e.g. Revision Class, Lab Session"
                                value={customSubjName}
                                onChange={(e) => setCustomSubjName(e.target.value)}
                                className="w-full bg-white border border-slate-200 rounded-md px-3 py-1.5 text-xs font-semibold text-slate-800 outline-none focus:border-slate-400"
                              />
                            )}
                          </div>
                        )}
                      </div>

                      <div className="flex gap-3 pt-3 border-t border-slate-100 mt-3 shrink-0">
                        <button
                          type="button"
                          onClick={() => setIsModalOpen(false)}
                          className="flex-1 bg-white hover:bg-slate-50 text-slate-700 font-semibold rounded-md py-2.5 text-xs border border-slate-200 transition-colors cursor-pointer text-center"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => setAttendanceStep(2)}
                          className="flex-1 bg-slate-900 hover:bg-slate-900/90 text-white font-semibold rounded-md py-2.5 text-xs transition-colors cursor-pointer text-center shadow-xs"
                        >
                          Next: Mark Attendance
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Step 2: Roster Grid (Visual Tap Cards Grid with search) */}
                  {attendanceStep === 2 && (
                    <div className="flex-1 min-h-0 flex flex-col overflow-hidden animate-in fade-in duration-150">
                      {/* Search Bar & Range Button */}
                      <div className="flex gap-2 shrink-0 mb-3">
                        <div className="relative flex-grow">
                          <span className="absolute inset-y-0 left-0 flex items-center pl-2.5 pointer-events-none">
                            <Search className="h-4 w-4 text-slate-400" />
                          </span>
                          <input
                            type="text"
                            placeholder="Search name or register ID..."
                            value={attendanceSearchTerm}
                            onChange={(e) => setAttendanceSearchTerm(e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded-lg pl-8 pr-7 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-450 focus:ring-1 focus:ring-slate-950 transition-all"
                          />
                          {attendanceSearchTerm && (
                            <button
                              type="button"
                              onClick={() => setAttendanceSearchTerm("")}
                              className="absolute inset-y-0 right-0 flex items-center pr-2.5 text-slate-400 hover:text-slate-655"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                        {!isPastDay && (
                          <button
                            type="button"
                            onClick={() => setIsRangeOpen(!isRangeOpen)}
                            className={`px-3 py-1.5 border rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors shrink-0 ${
                              isRangeOpen
                                ? "bg-slate-100 border-slate-300 text-slate-955"
                                : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                            }`}
                          >
                            <Filter className="h-4 w-4 text-slate-400" />
                            Range
                          </button>
                        )}
                      </div>

                      {/* Collapsible Range Selector */}
                      {isRangeOpen && !isPastDay && (
                        <div className="bg-slate-50/50 border border-slate-200 rounded-lg p-3 text-xs space-y-2.5 animate-fadeIn shrink-0 mb-3">
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <label className="text-[10px] text-slate-450 font-bold uppercase tracking-wider">From Student</label>
                              <select
                                value={rangeStartId}
                                onChange={(e) => setRangeStartId(e.target.value)}
                                className="w-full bg-white border border-slate-200 rounded-md px-2 py-1 text-xs focus:outline-none"
                              >
                                <option value="">Select start...</option>
                                {filteredStudents.map(s => (
                                  <option key={s.id} value={s.id}>{s.name} ({s.id.slice(-6)})</option>
                                ))}
                              </select>
                            </div>
                            <div className="space-y-1">
                              <label className="text-[10px] text-slate-450 font-bold uppercase tracking-wider">To Student</label>
                              <select
                                value={rangeEndId}
                                onChange={(e) => setRangeEndId(e.target.value)}
                                className="w-full bg-white border border-slate-200 rounded-md px-2 py-1 text-xs focus:outline-none"
                              >
                                <option value="">Select end...</option>
                                {filteredStudents.map(s => (
                                  <option key={s.id} value={s.id}>{s.name} ({s.id.slice(-6)})</option>
                                ))}
                              </select>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={applyRangeSelection}
                              className="flex-1 bg-slate-900 hover:bg-slate-900/90 text-white font-semibold rounded-md py-1.5 text-xs transition-colors cursor-pointer"
                            >
                              Select Range
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setRangeStartId("");
                                setRangeEndId("");
                              }}
                              className="px-3 bg-white hover:bg-slate-100 text-slate-700 font-semibold rounded-md py-1.5 text-xs border border-slate-200 transition-colors cursor-pointer"
                            >
                              Clear
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Header indicators */}
                      <div className="flex items-center justify-between text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 font-medium text-slate-600 shrink-0 mb-3">
                        <div>Students: <span className="text-slate-955 font-semibold">{classStudents.length}</span></div>
                        <div className="flex gap-3">
                          <span className="text-emerald-700 font-semibold">Present: {presentCount}</span>
                          <span className="text-rose-700 font-semibold">Absent: {absentCount}</span>
                          <span className="text-blue-700 font-semibold">OD: {odCount}</span>
                        </div>
                      </div>

                      {/* Bulk Actions Panel (if selections are active) */}
                      {selectedStudentIds.length > 0 && !isPastDay && (
                        <div className="p-2 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between gap-3 animate-slideDown shadow-xs shrink-0 mb-3">
                          <div className="flex items-center gap-1.5 text-xs">
                            <span className="h-4.5 w-4.5 rounded-full bg-slate-900 text-white font-bold text-[10px] flex items-center justify-center shrink-0">
                              {selectedStudentIds.length}
                            </span>
                            <span className="font-semibold text-slate-900 text-xs">Selected</span>
                          </div>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => handleBulkMark("present")}
                              className="px-2.5 py-1 rounded-md bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 font-semibold text-[10px] cursor-pointer"
                            >
                              Present
                            </button>
                            <button
                              type="button"
                              onClick={() => handleBulkMark("absent")}
                              className="px-2.5 py-1 rounded-md bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-800 font-semibold text-[10px] cursor-pointer"
                            >
                              Absent
                            </button>
                            <button
                              type="button"
                              onClick={() => handleBulkMark("od")}
                              className="px-2.5 py-1 rounded-md bg-blue-55 hover:bg-blue-100 border border-blue-200 text-blue-800 font-semibold text-[10px] cursor-pointer"
                            >
                              OD
                            </button>
                            <button
                              type="button"
                              onClick={() => setSelectedStudentIds([])}
                              className="text-[10px] text-slate-400 hover:text-slate-600 font-semibold px-1 cursor-pointer"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Header quick toggle */}
                      {!isPastDay && (
                        <div className="flex items-center justify-between px-3 py-1.5 bg-slate-50/50 border border-slate-200 rounded-lg text-xs text-slate-550 font-medium shrink-0 mb-3">
                          <label className="flex items-center gap-2 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={filteredStudents.length > 0 && filteredStudents.every(s => selectedStudentIds.includes(s.id))}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  const allFilteredIds = filteredStudents.map(s => s.id);
                                  setSelectedStudentIds(prev => Array.from(new Set([...prev, ...allFilteredIds])));
                                } else {
                                  const allFilteredIds = filteredStudents.map(s => s.id);
                                  setSelectedStudentIds(prev => prev.filter(id => !allFilteredIds.includes(id)));
                                }
                              }}
                              className="h-4 w-4 rounded border-slate-350 text-slate-900 focus:ring-slate-900 cursor-pointer"
                            />
                            <span className="font-semibold text-slate-700">Select All Shown ({filteredStudents.length})</span>
                          </label>

                          {selectedStudentIds.length === 0 && (
                            <div className="flex items-center gap-3">
                              <button
                                type="button"
                                onClick={() => handleMarkAll("present")}
                                className="text-emerald-700 hover:text-emerald-800 font-semibold cursor-pointer hover:underline"
                              >
                                All Present
                              </button>
                              <span className="text-slate-300">|</span>
                              <button
                                type="button"
                                onClick={() => handleMarkAll("absent")}
                                className="text-rose-700 hover:text-rose-800 font-semibold cursor-pointer hover:underline"
                              >
                                All Absent
                              </button>
                              <span className="text-slate-300">|</span>
                              <button
                                type="button"
                                onClick={() => setLocalAttendance(originalAttendance)}
                                className="text-slate-500 hover:text-slate-700 font-semibold cursor-pointer hover:underline"
                              >
                                Reset
                              </button>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Visual Cards Grid */}
                      <div className="flex-1 min-h-0 overflow-y-auto border border-slate-200 rounded-lg p-3 pr-1 bg-white mb-3">
                        {filteredStudents.length === 0 ? (
                          <div className="py-8 text-center text-xs text-slate-400 font-medium">
                            No students match your search filter
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            {filteredStudents.map((student) => {
                              const status = localAttendance[student.id] || "present";
                              const isSelected = selectedStudentIds.includes(student.id);
                              
                              const statusConfig = 
                                status === "present" ? { bg: "bg-emerald-50/20 border-emerald-250 text-emerald-850 hover:bg-emerald-50/40 hover:border-emerald-300", badge: "bg-emerald-100 border-emerald-250 text-emerald-805", label: "Present", icon: CheckCircle } :
                                status === "absent" ? { bg: "bg-rose-50/25 border-rose-250 text-rose-850 hover:bg-rose-50/40 hover:border-rose-300", badge: "bg-rose-100 border-rose-250 text-rose-805", label: "Absent", icon: XCircle } :
                                status === "od" ? { bg: "bg-blue-50/20 border-blue-250 text-blue-800 hover:bg-blue-50/40 hover:border-blue-300", badge: "bg-blue-100 border-blue-250 text-blue-855", label: "OD", icon: Sparkles } :
                                { bg: "bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100", badge: "bg-slate-100 border-slate-200 text-slate-600", label: "Not Marked", icon: AlertCircle };

                              const StatusIcon = statusConfig.icon;

                              return (
                                <div
                                  key={student.id}
                                  onClick={() => {
                                    if (!isPastDay) {
                                      // Cycle status: present -> absent -> od -> present
                                      setLocalAttendance(prev => {
                                        const cur = prev[student.id] || "present";
                                        const next = cur === "present" ? "absent" : cur === "absent" ? "od" : "present";
                                        return { ...prev, [student.id]: next };
                                      });
                                    }
                                  }}
                                  className={`p-3 border rounded-lg flex items-center justify-between transition-all duration-150 ${
                                    isPastDay ? "cursor-default opacity-85" : "cursor-pointer hover:scale-[1.005] hover:shadow-xs active:scale-[0.995]"
                                  } ${isSelected ? "ring-1 ring-slate-900 border-slate-900" : ""} ${statusConfig.bg}`}
                                >
                                  <div className="flex items-center gap-2.5 pr-2">
                                    {!isPastDay && (
                                      <input
                                        type="checkbox"
                                        checked={isSelected}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleStudentCheckboxClick(e as any, student.id);
                                        }}
                                        onChange={() => {}}
                                        className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900 cursor-pointer shrink-0"
                                      />
                                    )}
                                    <div className="leading-tight">
                                      <p className="font-semibold text-xs text-slate-900 tracking-tight">{student.name}</p>
                                      <p className="text-[10px] font-mono text-slate-400 mt-0.5 uppercase">{student.id}</p>
                                    </div>
                                  </div>
                                  <div className={`flex items-center gap-1 shrink-0 px-2 py-0.5 rounded-full border text-[10px] font-semibold ${statusConfig.badge}`}>
                                    <StatusIcon className="h-3 w-3 shrink-0" />
                                    <span className="tracking-wide">
                                      {statusConfig.label}
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {/* Wizard Actions */}
                      <div className="flex gap-3 pt-3 border-t border-slate-100 shrink-0 mt-auto">
                        {isPastDay ? (
                          <button
                            type="button"
                            onClick={() => setIsModalOpen(false)}
                            className="w-full bg-white hover:bg-slate-50 text-slate-700 font-semibold rounded-md py-2.5 text-xs border border-slate-200 transition-colors cursor-pointer text-center"
                          >
                            Close
                          </button>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => setIsModalOpen(false)}
                              className="flex-1 bg-white hover:bg-slate-50 text-slate-700 font-semibold rounded-md py-2.5 text-xs border border-slate-200 transition-colors cursor-pointer text-center"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={() => setAttendanceStep(3)}
                              className="flex-1 bg-slate-900 hover:bg-slate-900/90 text-white font-semibold rounded-md py-2.5 text-xs transition-colors cursor-pointer text-center shadow-xs"
                            >
                              Review & Save →
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Step 3: Review & Save (Only shown if NOT past/locked) */}
                  {attendanceStep === 3 && !isPastDay && (
                    <div className="flex-1 min-h-0 flex flex-col overflow-hidden animate-in fade-in duration-150">
                      <div className="flex-1 min-h-0 overflow-y-auto space-y-4 py-1 pr-1 pb-1">
                        <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-3.5 shadow-xs">
                          <h4 className="font-semibold text-xs text-slate-900 uppercase tracking-wider border-b pb-2 flex justify-between items-center">
                            <span>Verification Summary</span>
                            <span className="text-[10px] text-slate-400 font-medium lowercase">Please review before saving</span>
                          </h4>
                          
                          <div className="grid grid-cols-3 gap-3 text-center">
                            <div className="bg-emerald-50/50 border border-emerald-100 p-2 rounded-lg">
                              <p className="text-[10px] text-emerald-805 uppercase font-semibold tracking-wide">Present</p>
                              <p className="font-bold text-lg text-emerald-700 mt-0.5">{presentCount}</p>
                            </div>
                            <div className="bg-rose-50/50 border border-rose-100 p-2 rounded-lg">
                              <p className="text-[10px] text-rose-805 uppercase font-semibold tracking-wide">Absent</p>
                              <p className="font-bold text-lg text-rose-700 mt-0.5">{absentCount}</p>
                            </div>
                            <div className="bg-blue-50/50 border border-blue-100 p-2 rounded-lg">
                              <p className="text-[10px] text-blue-805 uppercase font-semibold tracking-wide">OD</p>
                              <p className="font-bold text-lg text-blue-700 mt-0.5">{odCount}</p>
                            </div>
                          </div>

                          {/* List Exceptions */}
                          {(absentCount > 0 || odCount > 0) ? (
                            <div className="space-y-2.5 pt-1">
                              {absentCount > 0 && (
                                <div className="space-y-1">
                                  <span className="text-[10px] text-rose-600 uppercase tracking-wider font-semibold">Absent ({absentCount}):</span>
                                  <div className="flex flex-wrap gap-1.5">
                                    {classStudents.filter(s => localAttendance[s.id] === "absent").map(s => (
                                      <span key={s.id} className="px-2.5 py-0.5 bg-rose-50 border border-rose-200 text-rose-805 text-xs rounded-md font-medium">
                                        {s.name}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {odCount > 0 && (
                                <div className="space-y-1">
                                  <span className="text-[10px] text-blue-600 uppercase tracking-wider font-semibold">On Duty ({odCount}):</span>
                                  <div className="flex flex-wrap gap-1.5">
                                    {classStudents.filter(s => localAttendance[s.id] === "od").map(s => (
                                      <span key={s.id} className="px-2.5 py-0.5 bg-blue-50 border border-blue-200 text-blue-800 text-xs rounded-md font-medium">
                                        {s.name}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="p-3 bg-white border border-slate-200 rounded-lg text-center text-slate-500 font-medium text-xs flex items-center justify-center gap-1.5">
                              <CheckCircle className="h-4 w-4 text-emerald-500" />
                              <span>All {classStudents.length} students are Present. No exceptions marked.</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Step 3 Wizard Actions */}
                      <div className="flex gap-3 pt-3 border-t border-slate-100 shrink-0 mt-3">
                        <button
                          type="button"
                          onClick={() => setAttendanceStep(2)}
                          className="flex-1 bg-white hover:bg-slate-50 text-slate-700 font-semibold rounded-md py-2.5 text-xs border border-slate-200 transition-colors cursor-pointer text-center"
                        >
                          Back
                        </button>
                        
                        <button
                          type="button"
                          onClick={handleSaveAttendance}
                          disabled={isSubmittingAttendance}
                          className="flex-1 bg-slate-900 hover:bg-slate-900/90 text-white font-semibold rounded-md py-2.5 text-xs flex items-center justify-center gap-1.5 shadow-md transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isSubmittingAttendance ? "Saving..." : "Confirm & Save"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Handover Tab */}
            {modalTab === "handover" && (() => {
              const todayStr = new Date().toISOString().slice(0, 10);
              const isFuture = selectedCell.dateStr > todayStr || (selectedCell.dateStr === todayStr && (() => {
                const periodStart = parseSlotStartTime(selectedCell.time);
                return periodStart ? new Date() < periodStart : false;
              })());

              // 1. Cannot request handover for coverage class
              if (selectedCell.type === "covering") {
                return (
                  <div className="py-8 px-4 bg-rose-50 border border-rose-100 rounded-2xl text-center text-xs text-rose-800 space-y-2 shrink-0">
                    <AlertCircle className="h-8 w-8 mx-auto text-rose-500" />
                    <p className="font-bold">Cannot Handover Coverage Class</p>
                    <p className="text-gray-500 font-medium">You are covering this class for <span className="font-bold">{mentors.find(m => m.id === selectedCell.originalMentorId)?.name || "another staff member"}</span>. You cannot request handover for a class you are covering.</p>
                  </div>
                );
              }

              // 2. Prevent requesting handover if already pending or approved
              const pendingReq = requests.find(r => r.slotId === selectedCell.slot!.id && r.dateStr === selectedCell.dateStr && (r.status === "pending" || r.status === "pending_cam"));
              const approvedReq = approvedHandovers.find(h => h.slotId === selectedCell.slot!.id && h.dateStr === selectedCell.dateStr);

              if (approvedReq) {
                return (
                  <div className="py-8 px-4 bg-teal-55 border border-teal-100 rounded-2xl text-center text-xs text-teal-800 space-y-2 shrink-0">
                    <CheckCircle className="h-8 w-8 mx-auto text-teal-500" />
                    <p className="font-bold">Handover Approved</p>
                    <p className="text-gray-500 font-medium">This class slot has already been approved for handover on this date to <span className="font-bold">{approvedReq.coverStaffName}</span>.</p>
                  </div>
                );
              }

              if (pendingReq) {
                return (
                  <div className="py-8 px-4 bg-amber-50 border border-amber-100 rounded-2xl text-center text-xs text-amber-805 space-y-2 shrink-0">
                    <AlertCircle className="h-8 w-8 mx-auto text-amber-500 animate-pulse" />
                    <p className="font-bold">Handover Pending</p>
                    <p className="text-gray-500 font-medium">A handover request for this class slot on this date is already pending approval (Sent to: <span className="font-bold text-amber-900">{pendingReq.targetStaffName}</span>).</p>
                  </div>
                );
              }

              // 3. Otherwise, render the form
              return (
                <form onSubmit={submitAction} className="flex-1 min-h-0 flex flex-col overflow-hidden">
                  <div className="flex-1 min-h-0 overflow-y-auto space-y-4 py-1 pr-1 pb-1">
                    {!isFuture && (
                      <div className="p-3 bg-indigo-50 border border-indigo-100 text-indigo-900 text-[11px] rounded-xl font-semibold flex gap-1.5 items-start">
                        <AlertCircle className="h-4 w-4 shrink-0 text-indigo-600 mt-0.5" />
                        <div>
                          <span className="font-bold text-indigo-700">Emergency Request:</span> Since this class period has already passed, this request requires Campus Academic Manager (CAM) approval first. Once approved, the cover staff can accept it.
                        </div>
                      </div>
                    )}
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-gray-705">Select Semester</label>
                      <select
                        value={modalSemester}
                        disabled={true}
                        className="w-full bg-gray-50 border border-gray-205 rounded-xl px-3 py-2.5 text-xs text-gray-500 focus:outline-none cursor-not-allowed font-bold"
                      >
                        <option value="Semester 1">Semester 1</option>
                        <option value="Semester 2">Semester 2</option>
                        <option value="Semester 3">Semester 3</option>
                        <option value="Semester 4">Semester 4</option>
                        <option value="Semester 5">Semester 5</option>
                        <option value="Semester 6">Semester 6</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-gray-755 font-black">Select Covering Staff Member</label>
                      <select
                        value={targetStaffId}
                        onChange={(e) => setTargetStaffId(e.target.value)}
                        className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-xs text-gray-855 focus:outline-none focus:ring-1 focus:ring-indigo-650"
                      >
                        <option value="">-- Choose Covering Staff --</option>
                        {(() => {
                          const { sorted, classGroupMentorIds, classGroupMentorSubjects } = getCoveringStaffOptions(selectedCell.slot!);
                          
                          return sorted.map(m => {
                            const isClassGroup = classGroupMentorIds.has(m.id);
                            const isOccupied = isMentorOccupied(
                              m.id,
                              selectedCell.slot!.day,
                              selectedCell.slot!.time,
                              selectedCell.slot!.shift,
                              selectedCell.dateStr
                            );

                            let badge = "";
                            if (isClassGroup) {
                              const subs = classGroupMentorSubjects.get(m.id) || [];
                              badge = subs.length > 0 ? ` (${subs.join(", ")})` : "";
                            }

                            let label = m.name + badge;
                            if (isOccupied) {
                              label = `Warning: [Occupied] ${label}`;
                            }
                            
                            return (
                              <option key={m.id} value={m.id} disabled={isOccupied}>
                                {label}
                              </option>
                            );
                          });
                        })()}
                        {(() => {
                          const { sorted } = getCoveringStaffOptions(selectedCell.slot!);
                          return sorted.length === 0 && (
                            <option value="">No other staff available to assign</option>
                          );
                        })()}
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-gray-705">Reason for Class Handover</label>
                      <textarea
                        rows={3}
                        placeholder="e.g. Attending a conference / Medical leaves. Need class coverage on this day."
                        value={reasonText}
                        onChange={(e) => setReasonText(e.target.value)}
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-xs text-gray-800 focus:outline-none focus:ring-1 focus:ring-indigo-650 focus:border-indigo-650"
                      />
                    </div>
                  </div>

                  <div className="flex gap-3 pt-3 border-t border-slate-100 mt-3 shrink-0">
                    <button
                      type="button"
                      onClick={() => setIsModalOpen(false)}
                      className="flex-1 bg-gray-100 hover:bg-gray-150 text-gray-655 hover:text-gray-800 rounded-xl py-2.5 text-xs font-bold border border-gray-200 transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="flex-1 btn-gradient text-white font-extrabold rounded-xl py-2.5 text-xs flex items-center justify-center gap-1.5 shadow-md transition-colors cursor-pointer border-none"
                    >
                      <Send className="h-3.5 w-3.5" />
                      Request Handover
                    </button>
                  </div>
                </form>
              );
            })()}
          </div>
        </div>
      )}

      {activeTab === "tracker" && (() => {
        const currentTask = weeklyTasks.find(
          t => t.class_group === trackerClassGroup &&
               t.subject === trackerSubject &&
               t.week_number === trackerWeek
        );

        const classStudents = students.filter(
          s => s.classGroup && s.classGroup.toLowerCase().trim() === trackerClassGroup.toLowerCase().trim()
        );

        const exportTrackerData = () => {
          try {
            const dataRows = classStudents.map((student, idx) => {
              const rowObj: any = {
                "S.No": idx + 1,
                "Student ID": student.id,
                "Student Name": student.name,
              };

              // Add columns for weeks 1 to 15
              for (let wk = 1; wk <= 15; wk++) {
                const entry = studentTracker.find(
                  e => e.student_id === student.id &&
                       e.class_group === trackerClassGroup &&
                       e.subject === trackerSubject &&
                       e.week_number === wk
                );
                rowObj[`W${wk} Status`] = entry?.submission_url ? "Submitted" : "Not Submitted";
                rowObj[`W${wk} Link`] = entry?.submission_url || "—";
                if (wk % 2 === 0) {
                  rowObj[`W${wk} Eval Type`] = entry?.viva_assessment || "—";
                }
                rowObj[`W${wk} Marks`] = entry?.marks !== undefined && entry?.marks !== null ? entry.marks : "—";
              }

              return rowObj;
            });

            const worksheet = XLSX.utils.json_to_sheet(dataRows);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, "Weekly Marks");

            const filename = `${trackerClassGroup.replace(/[^a-zA-Z0-9]/g, "_")}_${trackerSubject.replace(/[^a-zA-Z0-9]/g, "_")}_Tracker.xlsx`;
            XLSX.writeFile(workbook, filename);
            toast("Tracker data exported successfully!", "success");
          } catch (err: any) {
            console.error("Export error:", err);
            toast("Failed to export tracker data.", "error");
          }
        };

        return (
        <div className="space-y-6 font-sans">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-150 pb-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0">
                <GraduationCap className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-black text-slate-800 leading-tight">Weekly Student Task &amp; Submission Tracker</h2>
                <p className="text-xs text-slate-455 font-medium mt-0.5">
                  Assign weekly tasks, view student submissions, and enter marks up to 10.
                </p>
              </div>
            </div>
          </div>

          {/* Interactive Class, Subject & Week Selector Bar */}
          <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs space-y-4 font-sans">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              {/* Left: Responsive Class, Subject & Week Selectors */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1">
                {/* Class Group Select - Flex Grow for long names */}
                <div className="space-y-1 sm:flex-[2.5] min-w-0">
                  <label className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block">Class Group</label>
                  <select
                    value={trackerClassGroup}
                    onChange={(e) => setTrackerClassGroup(e.target.value)}
                    className="w-full text-xs font-bold px-3 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-[#D528A2]/10 focus:border-[#D528A2] bg-slate-50/50 text-slate-800 cursor-pointer truncate"
                  >
                    {mentorClasses.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                {/* Subject Select */}
                <div className="space-y-1 sm:flex-1 min-w-0">
                  <label className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block">Subject</label>
                  <select
                    value={trackerSubject}
                    onChange={(e) => setTrackerSubject(e.target.value)}
                    className="w-full text-xs font-bold px-3 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-[#D528A2]/10 focus:border-[#D528A2] bg-slate-50/50 text-slate-800 cursor-pointer truncate"
                  >
                    {filteredMentorSubjects.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>

                {/* Week Select */}
                <div className="space-y-1 sm:flex-1 min-w-[130px]">
                  <label className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block">Week Number</label>
                  <select
                    value={trackerWeek}
                    onChange={(e) => setTrackerWeek(parseInt(e.target.value, 10))}
                    className="w-full text-xs font-bold px-3 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-[#D528A2]/10 focus:border-[#D528A2] bg-slate-50/50 text-slate-800 cursor-pointer"
                  >
                    {Array.from({ length: 15 }, (_, i) => i + 1).map(wk => (
                      <option key={wk} value={wk}>Week {wk} {wk % 2 === 0 ? "(Assessment)" : ""}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Right: Export Button */}
              <div className="flex items-center gap-2 shrink-0 pt-2 lg:pt-0">
                <button
                  type="button"
                  onClick={exportTrackerData}
                  disabled={classStudents.length === 0}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold border border-slate-200 hover:bg-slate-50 text-slate-700 flex items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed bg-white shadow-xs"
                >
                  <Download className="h-4 w-4 text-slate-500" />
                  <span>Export Report</span>
                </button>
              </div>
            </div>
          </div>

          {/* Task Assignment Feature Card */}
          {(() => {
            const currentTask = weeklyTasks.find(
              t => t.class_group === trackerClassGroup &&
                   t.subject === trackerSubject &&
                   t.week_number === trackerWeek
            );

            return (
              <div className="bg-gradient-to-r from-indigo-500/5 via-teal-500/5 to-transparent border border-indigo-100 rounded-3xl p-5 shadow-xs space-y-3 font-sans">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-indigo-100/50 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600">
                      <BookOpen className="h-4 w-4" />
                    </div>
                    <div>
                      <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                        Week {trackerWeek} Task Assignment
                        {trackerWeek % 2 === 0 ? (
                          <span className="px-2 py-0.5 bg-rose-100 text-rose-700 rounded-md text-[9px] font-extrabold tracking-wide border border-rose-200">
                            BI-WEEKLY VIVA &amp; ASSESSMENT
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-md text-[9px] font-extrabold tracking-wide border border-emerald-200">
                            REGULAR TASK
                          </span>
                        )}
                      </h3>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setTrackerTaskName(currentTask?.task_name || "");
                      setTrackerTaskPdf(currentTask?.task_pdf_url || "");
                      setEditingTask(true);
                    }}
                    className="btn-gradient px-4 py-2 rounded-xl text-xs font-bold text-white shadow-sm flex items-center gap-1.5 cursor-pointer transition-all shrink-0"
                  >
                    <BookOpen className="h-3.5 w-3.5" />
                    <span>{currentTask ? "Edit Assignment" : "Assign Task"}</span>
                  </button>
                </div>

                {currentTask ? (
                  <div className="bg-white border border-slate-150 p-4 rounded-2xl flex flex-col md:flex-row justify-between md:items-center gap-4 shadow-xs">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 text-[10px] font-extrabold font-mono rounded border border-indigo-150">
                          Week {trackerWeek}
                        </span>
                        <div className="text-sm font-extrabold text-slate-900 leading-snug">
                          {currentTask.task_name}
                        </div>
                      </div>
                      {currentTask.task_pdf_url ? (
                        <a
                          href={currentTask.task_pdf_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 text-[10.5px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-150 px-3 py-1 rounded-lg hover:bg-indigo-100 transition-colors"
                        >
                          <FileText className="h-3.5 w-3.5 text-indigo-600" />
                          <span>View Reference Document</span>
                        </a>
                      ) : (
                        <span className="text-[10px] text-slate-400 italic block">No reference document attached</span>
                      )}
                    </div>

                    <div className="flex flex-col md:items-end text-[10px] text-slate-500 font-medium gap-1 shrink-0 border-t md:border-t-0 pt-2 md:pt-0 border-slate-100">
                      {(() => {
                        const assigned = parseDbDate(currentTask.created_at || currentTask.updated_at);
                        const deadline = new Date(assigned.getTime() + 3 * 24 * 60 * 60 * 1000);
                        const isExpired = new Date() > deadline;
                        return (
                          <>
                            <div className="flex items-center gap-1">
                              <span className="text-slate-400 font-semibold">Assigned Date:</span>
                              <span className="font-bold text-slate-700">{assigned.toLocaleDateString()} {assigned.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="text-slate-400 font-semibold">Submission Deadline:</span>
                              <span className={`font-extrabold ${isExpired ? "text-rose-600" : "text-emerald-600"}`}>
                                {deadline.toLocaleDateString()} ({isExpired ? "Expired" : "3 Days"})
                              </span>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-6 bg-white/60 border border-dashed border-indigo-200 rounded-2xl flex flex-col items-center justify-center gap-2">
                    <p className="text-xs text-slate-500 font-medium">No task assigned for Week {trackerWeek} in {trackerSubject} yet.</p>
                    <button
                      onClick={() => {
                        setTrackerTaskName("");
                        setTrackerTaskPdf("");
                        setEditingTask(true);
                      }}
                      className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-sm transition-all"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>Assign Week {trackerWeek} Task</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })()}

          {/* Student Submissions & Evaluation */}
          {weeklyTasks.some(
            t => t.class_group === trackerClassGroup &&
                 t.subject === trackerSubject &&
                 t.week_number === trackerWeek
          ) && (
            <div className="bg-white border border-slate-250/60 rounded-3xl p-6 shadow-xs space-y-5">
            {/* Student Submissions Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-slate-700">
                  <ClipboardList className="h-4 w-4 text-white" />
                </div>
                <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest">
                  Student Submissions &amp; Evaluation
                </h3>
              </div>
              {(() => {
                const classStudents = students.filter(
                  s => s.classGroup && s.classGroup.toLowerCase().trim() === trackerClassGroup.toLowerCase().trim()
                );
                
                // Calculate 15-week class metrics
                const assignedWeeksList = Array.from({ length: 15 }, (_, i) => i + 1).filter(wk =>
                  weeklyTasks.some(t => t.class_group === trackerClassGroup && t.subject === trackerSubject && t.week_number === wk)
                );
                const assignedWeeksCount = assignedWeeksList.length;

                let totalSubmissionsCount = 0;
                let totalMarksSum = 0;
                let totalGradedEntriesCount = 0;

                classStudents.forEach(st => {
                  for (let wk = 1; wk <= 15; wk++) {
                    const entry = studentTracker.find(
                      e => e.student_id === st.id &&
                           e.class_group === trackerClassGroup &&
                           e.subject === trackerSubject &&
                           e.week_number === wk
                    );
                    if (entry?.submission_url) totalSubmissionsCount++;
                    if (entry?.marks !== undefined && entry?.marks !== null && !isNaN(entry.marks)) {
                      totalMarksSum += entry.marks;
                      totalGradedEntriesCount++;
                    }
                  }
                });

                const totalPossible = classStudents.length * (assignedWeeksCount || 1);
                const overallPct = totalPossible > 0 ? Math.round((totalSubmissionsCount / totalPossible) * 100) : 0;
                const avgScore = totalGradedEntriesCount > 0 ? (totalMarksSum / totalGradedEntriesCount).toFixed(1) : "—";

                const currentWeekSubmittedCount = classStudents.filter(s => {
                  const entry = studentTracker.find(
                    e => e.student_id === s.id &&
                         e.class_group === trackerClassGroup &&
                         e.subject === trackerSubject &&
                         e.week_number === trackerWeek
                  );
                  return entry && !!entry.submission_url;
                }).length;

                return classStudents.length > 0 ? (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-[10px] font-bold">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-full border border-indigo-150 flex items-center gap-1.5">
                        <Sparkles className="h-3 w-3 text-indigo-500" />
                        <span>15-Wk Completion: <strong className="text-indigo-900">{overallPct}%</strong></span>
                      </span>
                      <span className="bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-full border border-emerald-200">
                        Avg Marks: <strong className="text-emerald-900">{avgScore} / 10</strong>
                      </span>
                      <span className="bg-amber-50 text-amber-700 px-3 py-1.5 rounded-full border border-amber-200">
                        Tasks Assigned: <strong className="text-amber-900">{assignedWeeksCount} / 15 Weeks</strong>
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="bg-emerald-100 text-emerald-700 px-3 py-1.5 rounded-full border border-emerald-200">
                        W{trackerWeek} Submitted: {currentWeekSubmittedCount} / {classStudents.length}
                      </span>
                      <span className="bg-rose-100 text-rose-700 px-3 py-1.5 rounded-full border border-rose-200">
                        Not Submitted: {classStudents.length - currentWeekSubmittedCount}
                      </span>
                    </div>
                  </div>
                ) : null;
              })()}
            </div>
            {(() => {
              const classStudents = students.filter(
                s => s.classGroup && s.classGroup.toLowerCase().trim() === trackerClassGroup.toLowerCase().trim()
              );
              const assignedWeeksCount = Array.from({ length: 15 }, (_, i) => i + 1).filter(wk =>
                weeklyTasks.some(t => t.class_group === trackerClassGroup && t.subject === trackerSubject && t.week_number === wk)
              ).length;

              if (classStudents.length === 0) {
                return (
                  <div className="text-center py-8">
                    <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-slate-50 mb-2">
                      <Users className="h-6 w-6 text-slate-300" />
                    </div>
                    <p className="text-xs text-slate-455 italic">No students registered in class &ldquo;{trackerClassGroup}&rdquo;.</p>
                  </div>
                );
              }

              // 1. Filter the classStudents based on trackerSearchTerm and trackerStatusFilter
              const filteredClassStudents = classStudents.filter(student => {
                const matchesSearch = student.name.toLowerCase().includes(trackerSearchTerm.toLowerCase()) ||
                                      student.id.toLowerCase().includes(trackerSearchTerm.toLowerCase());
                
                const entry = studentTracker.find(
                  e => e.student_id === student.id &&
                       e.class_group === trackerClassGroup &&
                       e.subject === trackerSubject &&
                       e.week_number === trackerWeek
                );
                
                const isSubmitted = !!entry?.submission_url;
                
                if (trackerStatusFilter === "submitted") return matchesSearch && isSubmitted;
                if (trackerStatusFilter === "not_submitted") return matchesSearch && !isSubmitted;
                return matchesSearch;
              });

              return (
                <div className="space-y-4">
                  {/* Filters Header Bar */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-150">
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="relative">
                        <input
                          type="text"
                          value={trackerSearchTerm}
                          onChange={(e) => setTrackerSearchTerm(e.target.value)}
                          placeholder=" Search by student name or roll..."
                          className="pl-4 pr-4 py-2.5 text-xs border border-slate-205 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#D528A2]/10 focus:border-[#D528A2] w-64 bg-white font-medium text-slate-800"
                        />
                      </div>
                      <select
                        value={trackerStatusFilter}
                        onChange={(e) => setTrackerStatusFilter(e.target.value)}
                        className="px-3.5 py-2.5 text-xs border border-slate-205 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#D528A2]/10 focus:border-[#D528A2] bg-white font-bold text-slate-700 cursor-pointer"
                      >
                        <option value="all">All Statuses</option>
                        <option value="submitted">Submitted</option>
                        <option value="not_submitted">Not Submitted</option>
                      </select>
                    </div>

                    <div className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider">
                      Showing {filteredClassStudents.length} of {classStudents.length} Students
                    </div>
                  </div>

                  <div className="overflow-x-auto rounded-2xl border border-slate-205 shadow-xs bg-white scroll-touch">
                    <table className="w-full border-collapse text-left text-xs font-semibold min-w-[980px]">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-550 font-bold uppercase text-[9.5px] whitespace-nowrap">
                          <th className="p-4 w-[50px] text-center border-r border-slate-100/60">S.No</th>
                          <th className="p-4 border-r border-slate-100/60 min-w-[180px]">Student Name / Roll</th>
                          <th className="p-4 border-r border-slate-100/60 min-w-[260px]">15-Week Progress Matrix</th>
                          <th className="p-4 border-r border-slate-100/60 w-[130px]">W{trackerWeek} Status</th>
                          <th className="p-4 text-center border-r border-slate-100/60 w-[130px]">Submission Link</th>
                          {trackerWeek % 2 === 0 && (
                            <th className="p-4 border-r border-slate-100/60 w-[180px]">Evaluation Type</th>
                          )}
                          <th className="p-4 text-center w-[110px]">Marks (0-10)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white text-slate-700">
                        {filteredClassStudents.map((student, idx) => {
                          const entry = studentTracker.find(
                            e => e.student_id === student.id &&
                                 e.class_group === trackerClassGroup &&
                                 e.subject === trackerSubject &&
                                 e.week_number === trackerWeek
                          );

                          const currentMarks = entry?.marks !== undefined && entry?.marks !== null ? entry.marks : "";
                          const currentFeedback = entry?.viva_assessment || "";
                          const currentUrl = entry?.submission_url || "";
                          const status = saveStatusMap[student.id] || "idle";

                          return (
                            <tr key={`${student.id}_wk${trackerWeek}`} className="hover:bg-slate-50/50 transition-colors">
                              <td className="p-4 text-center font-bold text-slate-400 border-r border-slate-100/60">
                                {idx + 1}
                              </td>
                              <td className="p-4 border-r border-slate-100/60">
                                <div className="font-bold text-slate-805">{student.name}</div>
                                <div className="text-[10px] text-slate-400 font-mono mt-0.5">{student.id}</div>
                              </td>
                              <td className="p-3 border-r border-slate-100/60">
                                {(() => {
                                  let studentSubmittedWeeks = 0;
                                  let studentGradedWeeks = 0;

                                  const dots = Array.from({ length: 15 }, (_, i) => i + 1).map(wk => {
                                    const isAssigned = weeklyTasks.some(
                                      t => t.class_group === trackerClassGroup && t.subject === trackerSubject && t.week_number === wk
                                    );
                                    const stEntry = studentTracker.find(
                                      e => e.student_id === student.id &&
                                           e.class_group === trackerClassGroup &&
                                           e.subject === trackerSubject &&
                                           e.week_number === wk
                                    );
                                    const isSubmitted = !!stEntry?.submission_url;
                                    const isGraded = stEntry?.marks !== undefined && stEntry?.marks !== null;

                                    if (isSubmitted) studentSubmittedWeeks++;
                                    if (isGraded) studentGradedWeeks++;

                                    let colorClass = "bg-slate-100 text-slate-400 hover:bg-slate-200";
                                    if (isGraded) colorClass = "bg-indigo-600 text-white font-bold shadow-xs";
                                    else if (isSubmitted) colorClass = "bg-emerald-500 text-white font-bold shadow-xs";
                                    else if (isAssigned) colorClass = "bg-rose-100 text-rose-700 font-bold border border-rose-200";

                                    const isCurrent = trackerWeek === wk;

                                    return (
                                      <button
                                        key={wk}
                                        type="button"
                                        onClick={() => setTrackerWeek(wk)}
                                        title={`Week ${wk}: ${isSubmitted ? (isGraded ? `Graded (${stEntry?.marks}/10)` : "Submitted") : isAssigned ? "Pending Submission" : "Unassigned"} - Click to view`}
                                        className={`h-5 w-5 rounded-md text-[8.5px] font-black transition-all flex items-center justify-center cursor-pointer ${colorClass} ${
                                          isCurrent ? "ring-2 ring-[#D528A2] scale-110 z-10 shadow-sm" : ""
                                        }`}
                                      >
                                        {wk}
                                      </button>
                                    );
                                  });

                                  const completionPct = assignedWeeksCount > 0 ? Math.round((studentSubmittedWeeks / assignedWeeksCount) * 100) : 0;

                                  return (
                                    <div className="space-y-1.5 min-w-[220px]">
                                      <div className="flex items-center justify-between text-[10px]">
                                        <span className="font-extrabold text-slate-700">{studentSubmittedWeeks} / {assignedWeeksCount || 15} Wks ({completionPct}%)</span>
                                        {studentGradedWeeks > 0 && (
                                          <span className="text-[9px] font-black text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-150">
                                            {studentGradedWeeks} Graded
                                          </span>
                                        )}
                                      </div>
                                      <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                                        <div
                                          className="bg-gradient-to-r from-emerald-500 to-indigo-600 h-1.5 rounded-full transition-all duration-300"
                                          style={{ width: `${Math.min(100, completionPct)}%` }}
                                        />
                                      </div>
                                      <div className="flex flex-wrap items-center gap-1 pt-0.5">
                                        {dots}
                                      </div>
                                    </div>
                                  );
                                })()}
                              </td>
                              <td className="p-4 border-r border-slate-100/60">
                                <div className="flex items-center gap-2">
                                  {currentUrl ? (
                                    <span className="text-[9px] font-black uppercase text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-2 py-1 rounded-md">
                                      Submitted
                                    </span>
                                  ) : (
                                    <span className="text-[9px] font-black uppercase text-rose-700 bg-rose-50 border border-rose-200/80 px-2 py-1 rounded-md">
                                      Not Submitted
                                    </span>
                                  )}
                                  
                                  {/* Sync Status Icon */}
                                  {status === "saving" && (
                                    <span className="w-3.5 h-3.5 border-2 border-[#D528A2] border-t-transparent rounded-full animate-spin"></span>
                                  )}
                                  {status === "saved" && (
                                    <CheckCircle className="h-4 w-4 text-emerald-600" />
                                  )}
                                  {status === "error" && (
                                    <AlertCircle className="h-4 w-4 text-rose-500" />
                                  )}
                                </div>
                              </td>
                              <td className="p-4 text-center border-r border-slate-100/60 font-semibold">
                                {currentUrl ? (
                                  <a
                                    href={currentUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center justify-center gap-1 text-xs font-bold text-[#D528A2] hover:underline"
                                  >
                                    <BookOpen className="h-3.5 w-3.5" />
                                    <span>View Work</span>
                                  </a>
                                ) : (
                                  <span className="text-slate-350 text-xs">—</span>
                                )}
                              </td>
                              {trackerWeek % 2 === 0 && (
                                <td className="p-4 border-r border-slate-100/60">
                                  <select
                                    defaultValue={currentFeedback === "VIVA conducted" ? "viva" : currentFeedback === "Assessment completed" ? "assessment" : ""}
                                    onChange={async (e) => {
                                      const val = e.target.value;
                                      setSaveStatusMap(prev => ({ ...prev, [student.id]: "saving" }));
                                      const res = await gradeStudentTask({
                                        studentId: student.id,
                                        classGroup: trackerClassGroup,
                                        subject: trackerSubject,
                                        weekNumber: trackerWeek,
                                        vivaAssessment: val === "viva" ? "VIVA conducted" : val === "assessment" ? "Assessment completed" : "",
                                        gradedBy: currentMentor?.id || ""
                                      });
                                      setSaveStatusMap(prev => ({ ...prev, [student.id]: res.success ? "saved" : "error" }));
                                      setTimeout(() => {
                                        setSaveStatusMap(prev => ({ ...prev, [student.id]: "idle" }));
                                      }, 2000);
                                    }}
                                    className="w-full text-xs font-bold px-2 py-1.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-[#D528A2] bg-white text-slate-700 cursor-pointer"
                                  >
                                    <option value="">Select Type...</option>
                                    <option value="viva"> VIVA</option>
                                    <option value="assessment"> Assessment</option>
                                  </select>
                                </td>
                              )}
                              <td className="p-4">
                                <input
                                  type="number"
                                  min="0"
                                  max="10"
                                  step="0.5"
                                  defaultValue={currentMarks}
                                  onBlur={async (e) => {
                                    const val = e.target.value;
                                    if (val === String(currentMarks)) return;
                                    if (val !== "" && (parseFloat(val) < 0 || parseFloat(val) > 10)) {
                                      toast("Marks must be between 0 and 10.", "warning");
                                      return;
                                    }
                                    setSaveStatusMap(prev => ({ ...prev, [student.id]: "saving" }));
                                    const res = await gradeStudentTask({
                                      studentId: student.id,
                                      classGroup: trackerClassGroup,
                                      subject: trackerSubject,
                                      weekNumber: trackerWeek,
                                      marks: val !== "" ? parseFloat(val) : null as any,
                                      gradedBy: currentMentor?.id || ""
                                    });
                                    setSaveStatusMap(prev => ({ ...prev, [student.id]: res.success ? "saved" : "error" }));
                                    setTimeout(() => {
                                      setSaveStatusMap(prev => ({ ...prev, [student.id]: "idle" }));
                                    }, 2000);
                                  }}
                                  placeholder="—"
                                  className="w-full text-center text-xs font-black px-2 py-1.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-400 bg-slate-50 text-slate-800"
                                />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })()}
          </div>
          )}
        </div>
      );
    })()}

          {/* Tab: Demo Evaluations */}
          {((activeTab as string) === "demo_evaluations") && (() => {
            const myDemos = demoSessions.filter(ds => ds.mentorId === currentMentor.id);
            const pendingDemos = myDemos.filter(d => d.status !== "completed");
            const completedDemos = myDemos.filter(d => d.status === "completed");
            
            const totalDemos = myDemos.length;
            const completedCount = completedDemos.length;
            const avgScore = completedCount > 0 
              ? Math.round(completedDemos.reduce((sum, d) => sum + (d.marks || 0), 0) / completedCount) 
              : 0;

            return (
              <div className="space-y-6 font-sans">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-150 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-pink-50 flex items-center justify-center text-pink-600 shrink-0">
                      <Sparkles className="h-5 w-5" />
                    </div>
                    <div>
                      <h2 className="text-lg font-black text-slate-800 leading-tight">My Demo Evaluations</h2>
                      <p className="text-xs text-slate-455 font-medium mt-0.5">
                        Track upcoming demo evaluations and review grades, marks, and feedback from Subject Matter Experts.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Statistics Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-white border border-slate-205 rounded-3xl p-5 shadow-xs flex items-center gap-4">
                    <div className="p-3 bg-indigo-50 border border-indigo-100 text-indigo-650 rounded-2xl">
                      <Calendar className="h-5 w-5" />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wide">Total Scheduled</span>
                      <p className="text-2xl font-black text-slate-800">{totalDemos}</p>
                    </div>
                  </div>

                  <div className="bg-white border border-slate-205 rounded-3xl p-5 shadow-xs flex items-center gap-4">
                    <div className="p-3 bg-pink-50 border border-pink-100 text-pink-650 rounded-2xl">
                      <Sparkles className="h-5 w-5" />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wide">Evaluations Done</span>
                      <p className="text-2xl font-black text-slate-800">{completedCount}</p>
                    </div>
                  </div>

                  <div className="bg-white border border-slate-205 rounded-3xl p-5 shadow-xs flex items-center gap-4">
                    <div className="p-3 bg-emerald-50 border border-emerald-100 text-emerald-650 rounded-2xl">
                      <GraduationCap className="h-5 w-5" />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-405 font-extrabold uppercase tracking-wide">Average Score</span>
                      <p className="text-2xl font-black text-slate-800">{completedCount > 0 ? `${avgScore} / 100` : "N/A"}</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  
                  {/* Left Column: Upcoming Evaluations (1/3 width) */}
                  <div className="lg:col-span-1 space-y-4">
                    <div className="bg-white border border-slate-205 rounded-3xl p-5 shadow-xs space-y-4">
                      <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest border-b border-slate-100 pb-2">Upcoming Reviews</h3>
                      
                      {pendingDemos.length > 0 ? (
                        <div className="space-y-4">
                          {pendingDemos.map(demo => (
                            <div key={demo.id} className="p-4 bg-slate-50/50 border border-slate-150 rounded-2xl space-y-2">
                              <div className="flex justify-between items-center">
                                <span className="px-2 py-0.5 bg-indigo-50 border border-indigo-150 text-indigo-600 text-[8px] font-black uppercase rounded">
                                  {demo.subject}
                                </span>
                                <span className="px-2 py-0.5 bg-amber-55 text-amber-800 text-[8px] font-black uppercase rounded border border-amber-200">
                                  Pending
                                </span>
                              </div>
                              <div>
                                <p className="text-[11.5px] font-bold text-slate-800">{demo.dateStr}</p>
                                <p className="text-[10px] text-slate-455 font-semibold">{demo.timeSlot}</p>
                              </div>
                              <div className="text-[9.5px] text-slate-505 font-medium">
                                Evaluator: <span className="font-bold text-slate-705">{demo.smeName}</span>
                              </div>
                              
                              <button
                                onClick={() => {
                                  setDemoSwapModalSession(demo);
                                  setDemoSwapReason("I am unavailable");
                                  setDemoSwapRemarks("");
                                  setDemoSwapStep(1);
                                  setSelectedProposedPeer(null);
                                }}
                                className="w-full mt-2 py-1.5 bg-white hover:bg-slate-105 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-[10px] font-black rounded-lg border border-slate-200 dark:border-slate-700 flex items-center justify-center gap-1 transition-all"
                              >
                                <RefreshCw className="h-2.5 w-2.5 text-indigo-500" />
                                Request Internal Swap
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400 italic text-center py-6">No upcoming demo reviews scheduled.</p>
                      )}

                      {/* Received Proposals */}
                      {(() => {
                        const received = demoSwapRequests?.filter(
                          (r: any) => r.proposedMentorId === currentMentor.id && r.status === "pending_peer"
                        ) || [];
                        if (received.length === 0) return null;
                        return (
                          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
                            <h4 className="text-[10px] font-black uppercase text-indigo-500 tracking-wider">Swap Proposals Received</h4>
                            {received.map((req: any) => (
                              <div key={req.id} className="p-3 bg-indigo-50/20 border border-indigo-150 rounded-xl space-y-2 text-xs">
                                <p className="font-semibold text-slate-800 dark:text-slate-100">
                                  {req.mentorName} wants to swap:
                                </p>
                                <p className="text-[10.5px] text-slate-550">{req.subject} • {req.dateStr} • {req.timeSlot}</p>
                                {req.reason && <p className="text-[10px] text-slate-450 italic">"{req.reason}"</p>}
                                <div className="flex gap-2 pt-1">
                                  <button
                                    onClick={async () => {
                                      const res = await resolveDemoSwap(req.id, "rejected");
                                      if (res.success) toast("Proposal rejected.", "success");
                                    }}
                                    className="flex-1 py-1 text-[10px] font-bold border border-slate-250 hover:bg-slate-100 rounded-lg text-slate-600 transition-all cursor-pointer text-center"
                                  >
                                    Reject
                                  </button>
                                  <button
                                    onClick={async () => {
                                      const res = await resolveDemoSwap(req.id, "pending_sme");
                                      if (res.success) toast("Proposal accepted! Awaiting SME approval.", "success");
                                    }}
                                    className="flex-1 py-1 text-[10px] font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-all cursor-pointer text-center"
                                  >
                                    Accept
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        );
                      })()}

                      {/* Sent Proposals Status */}
                      {(() => {
                        const sent = demoSwapRequests?.filter(
                          (r: any) => r.mentorId === currentMentor.id && r.swapType === "internal"
                        ) || [];
                        if (sent.length === 0) return null;
                        return (
                          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
                            <h4 className="text-[10px] font-black uppercase text-slate-405 tracking-wider">Sent Swap Requests</h4>
                            <div className="space-y-2">
                              {sent.map((req: any) => (
                                <div key={req.id} className="p-2.5 bg-slate-50 border border-slate-150 rounded-xl flex items-center justify-between text-[11px] gap-2">
                                  <div className="min-w-0">
                                    <p className="font-bold text-slate-700 dark:text-slate-350 truncate">Peer: {req.proposedMentorName}</p>
                                    <p className="text-[9.5px] text-slate-400">{req.dateStr} • {req.timeSlot}</p>
                                  </div>
                                  <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase shrink-0 ${
                                    req.status === "approved"
                                      ? "bg-emerald-100 text-emerald-700"
                                      : req.status === "rejected"
                                        ? "bg-rose-100 text-rose-700"
                                        : req.status === "pending_sme"
                                          ? "bg-indigo-100 text-indigo-700"
                                          : "bg-amber-105 text-amber-700"
                                  }`}>
                                    {req.status === "pending_peer" ? "Peer Pend" : req.status === "pending_sme" ? "SME Pend" : req.status}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Right Column: Completed Evaluations & Feedback (2/3 width) */}
                  <div className="lg:col-span-2 space-y-4">
                    <div className="bg-white border border-slate-205 rounded-3xl p-5 shadow-xs space-y-4">
                      <h3 className="text-xs font-black text-slate-805 uppercase tracking-widest border-b border-slate-100 pb-2">Completed Evaluations</h3>
                      
                      {completedDemos.length > 0 ? (
                        <div className="space-y-4">
                          {completedDemos.map(demo => (
                            <div key={demo.id} className="p-5 border border-slate-150 hover:border-indigo-200 rounded-2xl bg-white transition-all shadow-xs flex flex-col md:flex-row justify-between gap-4">
                              <div className="space-y-2 flex-grow">
                                <div className="flex items-center gap-2">
                                  <span className="px-2 py-0.5 bg-indigo-50 border border-indigo-100 text-indigo-700 text-[8.5px] font-black uppercase rounded-lg">
                                    {demo.subject}
                                  </span>
                                  <span className="text-[9.5px] font-semibold text-slate-400">{demo.dateStr} • {demo.timeSlot}</span>
                                </div>
                                <div className="text-[10px] text-slate-505 font-medium">
                                  Evaluator: <span className="font-bold text-slate-705">{demo.smeName}</span> • Cohort: <span className="font-bold text-slate-705">{demo.stream}</span>
                                </div>
                                {demo.comments && (
                                  <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl mt-2 text-xs text-slate-655 font-medium leading-relaxed italic">
                                    &ldquo;{demo.comments}&rdquo;
                                  </div>
                                )}
                              </div>
                              <div className="shrink-0 flex items-center md:justify-end">
                                <div className="px-4 py-2 bg-emerald-50 border border-emerald-100 text-emerald-700 rounded-xl text-center shadow-xs">
                                  <div className="text-[9px] font-black uppercase text-emerald-600 tracking-wider">Score</div>
                                  <div className="text-lg font-black">{demo.marks} / 100</div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400 italic text-center py-10">No completed evaluations found.</p>
                      )}
                    </div>
                  </div>

                </div>
              </div>
            );
          })()}

          {editingTask && (() => {
            const currentTask = weeklyTasks.find(
              t => t.class_group === trackerClassGroup &&
                   t.subject === trackerSubject &&
                   t.week_number === trackerWeek
            );
            return (
              <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
              <div className="bg-white rounded-3xl border border-gray-150 shadow-xl max-w-2xl w-full overflow-hidden animate-slideUp flex flex-col">
                <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100 bg-gray-50">
                  <h3 className="font-extrabold text-gray-900 text-sm flex items-center gap-1.5">
                    <BookOpen className="h-5 w-5 text-indigo-650" />
                    <span>{currentTask ? "Edit Assignment Details" : "Assign New Task"}</span>
                  </h3>
                  <button
                    onClick={() => setEditingTask(false)}
                    className="p-1 hover:bg-gray-250 rounded-lg transition-colors cursor-pointer text-gray-500 hover:text-gray-800"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!trackerTaskName.trim()) return;
                    const res = await assignWeeklyTask({
                      classGroup: trackerClassGroup,
                      subject: trackerSubject,
                      weekNumber: trackerWeek,
                      taskName: trackerTaskName,
                      taskPdfUrl: trackerTaskPdf || undefined,
                      mentorId: currentMentor?.id || ""
                    });
                    if (res.success) {
                      setEditingTask(false);
                      toast("Task assigned successfully!", "success");
                    } else {
                      toast(res.message || "Failed to save task.", "error");
                    }
                  }}
                  className="p-6 space-y-5"
                >
                  <div className="space-y-4">
                    {/* Selectors in Modal */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wide block">Class Group</label>
                        <select
                          value={trackerClassGroup}
                          onChange={(e) => setTrackerClassGroup(e.target.value)}
                          className="w-full text-xs font-semibold px-3 py-2.5 rounded-xl border border-slate-250 focus:outline-none focus:ring-1 focus:ring-[#D528A2] bg-slate-50"
                        >
                          {mentorClasses.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wide block">Subject</label>
                        <select
                          value={trackerSubject}
                          onChange={(e) => setTrackerSubject(e.target.value)}
                          className="w-full text-xs font-semibold px-3 py-2.5 rounded-xl border border-slate-250 focus:outline-none focus:ring-1 focus:ring-[#D528A2] bg-slate-50"
                        >
                          {filteredMentorSubjects.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wide block">Week</label>
                        <select
                          value={trackerWeek}
                          onChange={(e) => setTrackerWeek(parseInt(e.target.value, 10))}
                          className="w-full text-xs font-semibold px-3 py-2.5 rounded-xl border border-slate-250 focus:outline-none focus:ring-1 focus:ring-[#D528A2] bg-slate-50"
                        >
                          {Array.from({ length: 15 }, (_, i) => i + 1).map(wk => <option key={wk} value={wk}>Week {wk}</option>)}
                        </select>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wide block">
                        Task Name / Description *
                      </label>
                      <input
                        type="text"
                        required
                        value={trackerTaskName}
                        onChange={(e) => setTrackerTaskName(e.target.value)}
                        placeholder="e.g. Experiment 1: SQL Join Operations"
                        className="w-full text-xs font-semibold px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#D528A2]/10 focus:border-[#D528A2] bg-slate-50 text-slate-800"
                      />
                    </div>

                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setTrackerUploadType("url")}
                          className={`flex-1 py-2.5 text-xs font-bold rounded-xl border transition-all ${trackerUploadType === "url" ? "bg-[#D528A2]/10 border-[#D528A2]/30 text-[#D528A2]" : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"}`}
                        >
                          URL Link
                        </button>
                        <button
                          type="button"
                          onClick={() => setTrackerUploadType("file")}
                          className={`flex-1 py-2.5 text-xs font-bold rounded-xl border transition-all ${trackerUploadType === "file" ? "bg-[#D528A2]/10 border-[#D528A2]/30 text-[#D528A2]" : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"}`}
                        >
                          Upload File
                        </button>
                      </div>
                      
                      {trackerUploadType === "url" ? (
                        <div className="space-y-1.5 mt-2">
                          <label className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wide block">
                            Reference PDF URL / Drive Link
                          </label>
                          <input
                            type="url"
                            value={trackerTaskPdf}
                            onChange={(e) => setTrackerTaskPdf(e.target.value)}
                            placeholder="e.g. https://drive.google.com/..."
                            className="w-full text-xs font-semibold px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:border-[#D528A2] focus:ring-2 focus:ring-[#D528A2]/10 bg-slate-50 text-slate-800"
                          />
                        </div>
                      ) : (
                        <div className="space-y-1.5 mt-2">
                          <label className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wide block">
                            Choose Reference File
                          </label>
                          <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-slate-300 border-dashed rounded-xl cursor-pointer bg-slate-50 hover:bg-slate-100 hover:border-[#D528A2]/40 transition-all">
                            <div className="flex flex-col items-center justify-center pt-5 pb-6">
                              <Upload className="w-5 h-5 mb-1 text-slate-400" />
                              <p className="text-[10px] text-slate-500 font-medium">Click to upload or drag and drop</p>
                              <p className="text-[9px] text-slate-400 font-semibold mt-0.5">PDF, DOCX (MAX. 10MB)</p>
                            </div>
                            <input type="file" className="hidden" accept=".pdf,.docx,.doc,.pptx" onChange={(e) => {
                              if(e.target.files && e.target.files[0]) {
                                toast("File selected: " + e.target.files[0].name, "success");
                                setTrackerTaskPdf("https://example.com/simulated-upload/" + encodeURIComponent(e.target.files[0].name));
                              }
                            }} />
                          </label>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Info Panel */}
                  <div className="bg-[#D528A2]/5 rounded-xl p-3 border border-[#D528A2]/10 space-y-2">
                    <div className="flex justify-between items-center text-[10px]">
                      <span className="font-bold text-slate-600">Deadline:</span>
                      <span className="font-black text-[#D528A2]">3 Days from Assignment</span>
                    </div>
                    <div className="flex justify-between items-center text-[10px]">
                      <span className="font-bold text-slate-600">Week Type:</span>
                      {trackerWeek % 2 === 0 ? (
                        <span className="font-black text-rose-600 bg-rose-100 px-2 py-0.5 rounded-lg border border-rose-200">ASSESSMENT / VIVA</span>
                      ) : (
                        <span className="font-black text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-lg border border-emerald-200">REGULAR WEEK</span>
                      )}
                    </div>
                  </div>

                  <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setEditingTask(false)}
                      className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="btn-gradient px-6 py-2.5 rounded-xl text-white font-bold text-xs shadow-md transition-colors cursor-pointer flex items-center gap-2"
                    >
                      <BookOpen className="h-4 w-4" /> Save Task
                    </button>
                  </div>
                </form>
              </div>
            </div>
            );
          })()}


      </main>

      <MentorProfileModal
        mentor={currentMentor}
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
      />
      {/* ↔ Swap-to-Compensate Modal */}
      {swapModalOpen && swapTarget && (() => {
        const target = swapTarget;
        // Build 2-week grid for swap selection
        const dayOrder = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
        const swapGridDates: { day: string; dateStr: string; formatted: string }[] = [];
        const baseDate = new Date();
        baseDate.setDate(baseDate.getDate() + swapGridWeekOffset * 7);
        const dow = baseDate.getDay();
        const monday = new Date(baseDate);
        monday.setDate(baseDate.getDate() - (dow === 0 ? 6 : dow - 1));
        for (let i = 0; i < 5; i++) {
          const d = new Date(monday);
          d.setDate(monday.getDate() + i);
          swapGridDates.push({
            day: dayOrder[i],
            dateStr: d.toISOString().slice(0, 10),
            formatted: d.toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
          });
        }
        const todayStr = new Date().toISOString().slice(0, 10);
        // Show the OTHER mentor's timetable — you are offering to cover one of THEIR classes
        const theirSlots = slots.filter(s => s.mentorId === target.otherMentorId);
        const swapGridRows = rows; // reuse computed time-column structure from main timetable

        return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 transition-all duration-300">
          <div className={`bg-white rounded-3xl shadow-2xl w-full overflow-hidden flex flex-col transition-all duration-300 ${swapSuccess ? "max-w-md" : "max-w-5xl max-h-[90vh]"}`}>
            {/* Modal Header */}
            <div style={{background: "linear-gradient(135deg, #D528A2 0%, #F4A863 100%)"}} className="p-5 text-white flex-shrink-0">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-black tracking-tight">
                    {swapSuccess ? "Offer Sent!" : `Cover a Class for ${target.otherMentorName}`}
                  </h2>
                  <p className="text-white/75 text-xs mt-1 font-medium">
                    {swapSuccess ? "Swap request submitted successfully" : `Pick one of ${target.otherMentorName}'s upcoming slots below — you will cover it as payback`}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => { setSwapModalOpen(false); setSwapSuccess(""); setSwapError(""); setSwapGridWeekOffset(0); }}
                  className="p-2 rounded-xl hover:bg-white/20 transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto flex-1">
              {swapSuccess ? (
                <div className="py-6 px-4 text-center flex flex-col items-center justify-center space-y-4 animate-in fade-in zoom-in-95 duration-200">
                  <div className="w-16 h-16 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-500 shadow-sm animate-bounce">
                    <CheckCircle className="h-10 w-10" />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-slate-800">Swap Offer Sent Successfully</h3>
                    <p className="text-xs text-slate-500 mt-1 font-medium leading-relaxed">
                      {target.otherMentorName} will see this offer in their pending requests and receive an email notification.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setSwapModalOpen(false); setSwapSuccess(""); setSwapGridWeekOffset(0); }}
                    className="w-full max-w-[200px] py-2.5 text-xs font-black text-white rounded-xl shadow-md hover:shadow-lg hover:scale-[1.02] transition-all"
                    style={{background: "linear-gradient(135deg, #D528A2 0%, #F4A863 100%)"}}
                  >
                    Done
                  </button>
                </div>
              ) : (
                <>
                  {/* Context Card */}
                  <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 flex gap-3">
                    <AlertCircle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-black text-amber-800">Compensation Required</p>
                      <p className="text-xs text-amber-700 mt-0.5">
                        You owe <strong>{target.otherMentorName}</strong> <strong>{target.balance} class hour{target.balance > 1 ? "s" : ""}</strong> for <em>{target.subject}</em> ({target.month}).
                        Select one of <strong>{target.otherMentorName}&apos;s</strong> upcoming classes below that you will take over as compensation.
                      </p>
                    </div>
                  </div>
                <div className="space-y-4">
                  {/* Timetable Grid Picker */}
                  <div className="space-y-2">
                    {/* Week Navigation */}
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-black text-slate-700 uppercase tracking-wider">Pick One of {target.otherMentorName}&apos;s Classes to Cover</label>
                      <div className="flex items-center gap-2 bg-slate-100 rounded-xl px-3 py-1.5">
                        <button type="button" onClick={() => setSwapGridWeekOffset(swapGridWeekOffset - 1)} className="p-0.5 hover:text-[#D528A2] transition-colors">
                          <ChevronLeft className="h-3.5 w-3.5" />
                        </button>
                        <span className="text-[10px] font-black text-slate-700 min-w-[110px] text-center">
                          {swapGridWeekOffset === 0 ? "Current Week" : `${swapGridDates[0]?.formatted} – ${swapGridDates[4]?.formatted}`}
                        </span>
                        <button type="button" onClick={() => setSwapGridWeekOffset(swapGridWeekOffset + 1)} className="p-0.5 hover:text-[#D528A2] transition-colors">
                          <ChevronRight className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Grid */}
                    <div className="overflow-x-auto rounded-2xl border border-slate-200">
                      <table className="w-full table-fixed border-collapse text-left min-w-[700px]">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200">
                            <th className="p-2 text-[10px] font-bold uppercase text-slate-500 w-[12%]">Day</th>
                            {(() => {
                              let sc = 0;
                              return swapGridRows.map((col, idx) => {
                                if (col.type === "break" || col.type === "lunch") {
                                  return (
                                    <th key={idx} className="p-2 text-[9px] font-bold text-slate-400 uppercase text-center bg-slate-50/50 w-[8%]">
                                      {col.label}
                                    </th>
                                  );
                                }
                                if (col.type === "slot") {
                                  sc++;
                                  return (
                                    <th key={col.time} className="p-2 text-[10px] font-bold text-slate-700 w-[12%]">
                                      <div>P{sc}</div>
                                      <div className="text-[8px] text-slate-400 font-normal">{col.time}</div>
                                    </th>
                                  );
                                }
                                return null;
                              });
                            })()}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                          {swapGridDates.map((date) => (
                            <tr key={date.day} className="h-20">
                              <td className="p-2 text-[10px] font-bold text-slate-700 border-r border-slate-200 bg-slate-50/20 align-middle">
                                <div className="flex flex-col items-center justify-center">
                                  <span className="font-black text-slate-900 leading-none text-[11px]">{date.day.slice(0,3)}</span>
                                  <span className="text-[8px] text-slate-400 font-extrabold uppercase mt-0.5">{date.formatted}</span>
                                </div>
                              </td>
                              {swapGridRows.map((col, cIdx) => {
                                if (col.type === "break" || col.type === "lunch") {
                                  return (
                                    <td key={`brk-${cIdx}`} className="p-1 text-center text-[9px] font-extrabold text-slate-400 bg-slate-50/40 border-r border-slate-100 last:border-r-0 align-middle italic">
                                      {col.label}
                                    </td>
                                  );
                                }
                                if (col.type !== "slot") return null;
                                const time = col.time;
                                const slot = theirSlots.find(s => s.day === date.day && s.time === time);
                                const isPast = date.dateStr < todayStr;
                                // Already covered by someone else on this date
                                const alreadyHandedOver = slot ? approvedHandovers.some(ah => ah.slotId === slot.id && ah.dateStr === date.dateStr) : false;
                                const isSelectable = slot && !isPast && !alreadyHandedOver;
                                const isSelected = slot ? (swapOfferSlotId === slot.id && swapOfferWeekDate === date.dateStr) : false;

                                return (
                                  <td
                                    key={time}
                                    onClick={isSelectable ? () => { setSwapOfferSlotId(slot!.id); setSwapOfferWeekDate(date.dateStr); } : undefined}
                                    className={`p-1.5 h-20 border-r border-slate-100 last:border-r-0 transition-all ${
                                      isSelected
                                        ? "cursor-pointer"
                                        : isSelectable
                                          ? "cursor-pointer hover:bg-pink-50/30"
                                          : "bg-slate-50/30"
                                    }`}
                                    style={isSelected ? {background: "rgba(213,40,162,0.07)"} : undefined}
                                  >
                                    {slot ? (
                                      <div className={`h-full flex flex-col justify-between p-1.5 rounded-xl border text-[9px] transition-all ${
                                        isSelected
                                          ? "text-white shadow-md"
                                          : alreadyHandedOver || isPast
                                            ? "bg-slate-100 border-slate-200 text-slate-400 opacity-50"
                                            : "bg-white border-slate-200 text-slate-700 hover:shadow-sm"
                                      }`}
                                      style={isSelected ? {background: "linear-gradient(135deg, #D528A2 0%, #F4A863 100%)", borderColor: "#D528A2"} : !alreadyHandedOver && !isPast ? undefined : undefined}>
                                        <div className="font-black leading-tight truncate">{slot.course}</div>
                                        <div className={`text-[8px] font-semibold truncate ${isSelected ? "text-white/70" : "text-slate-400"}`}>
                                          {slot.classGroup}
                                        </div>
                                        {isSelected && (
                                          <div className="text-[7px] font-black uppercase tracking-wide text-white/60 mt-0.5">Selected</div>
                                        )}
                                        {alreadyHandedOver && (
                                          <div className="text-[7px] font-black uppercase text-slate-400">Handed Over</div>
                                        )}
                                      </div>
                                    ) : (
                                      <div className="h-full flex items-center justify-center">
                                        <div className="w-full h-full border border-dashed border-slate-150 rounded-xl bg-slate-50/20" />
                                      </div>
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Selected slot summary */}
                    {swapOfferSlotId && swapOfferWeekDate && (() => {
                      const sel = slots.find(s => s.id === swapOfferSlotId);
                      if (!sel) return null;
                      const selDate = new Date(swapOfferWeekDate + "T00:00:00").toLocaleDateString("en-IN", { weekday: "long", month: "short", day: "numeric" });
                      return (
                        <div className="rounded-xl px-3 py-2.5 flex items-center justify-between border" style={{background: "rgba(213,40,162,0.07)", borderColor: "rgba(213,40,162,0.25)"}}>
                          <div>
                            <p className="text-xs font-black" style={{color: "#D528A2"}}>{sel.course}</p>
                            <p className="text-[10px] font-medium" style={{color: "#c0239a"}}>{selDate} · {sel.time} · {sel.classGroup}</p>
                          </div>
                          <button type="button" onClick={() => { setSwapOfferSlotId(""); setSwapOfferWeekDate(""); }} className="transition-colors" style={{color: "#D528A2"}}>
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Optional Reason */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-black text-slate-700 uppercase tracking-wider">
                      Note (optional)
                    </label>
                    <textarea
                      rows={2}
                      value={swapReason}
                      onChange={e => setSwapReason(e.target.value)}
                      placeholder={`e.g. Compensating for ${target.subject} handover in ${target.month}`}
                      className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 resize-none text-slate-700" style={{"--tw-ring-color": "rgba(213,40,162,0.4)"} as React.CSSProperties}
                    />
                  </div>

                  {swapError && (
                    <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2 text-xs text-red-700 font-semibold">
                      {swapError}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-3 pt-1">
                    <button
                      type="button"
                      onClick={() => { setSwapModalOpen(false); setSwapError(""); setSwapGridWeekOffset(0); }}
                      className="flex-1 px-4 py-2.5 text-xs font-black text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={!swapOfferSlotId || !swapOfferWeekDate || swapSubmitting}
                      onClick={async () => {
                        if (!swapOfferSlotId || !swapOfferWeekDate) {
                          setSwapError("Please select a slot from the timetable above.");
                          return;
                        }
                        setSwapSubmitting(true);
                        setSwapError("");
                        const offerSlot = slots.find(s => s.id === swapOfferSlotId);
                        const dateLabel = new Date(swapOfferWeekDate + "T00:00:00")
                          .toLocaleDateString("en-US", { month: "short", day: "numeric" });
                        const result = await requestSwapCompensate(
                          currentMentor?.id || "",
                          swapOfferSlotId,
                          swapOfferWeekDate,
                          dateLabel,
                          target.otherMentorId,
                          target.compensatesHandoverId,
                          swapReason || `Compensating for ${target.subject} (${target.month}).`,
                          target.subject,
                          target.month
                        );
                        setSwapSubmitting(false);
                        if (result.success) {
                          setSwapSuccess(result.message);
                          setSwapGridWeekOffset(0);
                        } else {
                          setSwapError(result.message);
                        }
                      }}
                      className="flex-1 px-4 py-2.5 text-xs font-black text-white rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 shadow-md hover:shadow-lg hover:scale-[1.02]"
                      style={{background: "linear-gradient(135deg, #D528A2 0%, #F4A863 100%)"}}
                    >
                      {swapSubmitting ? (
                        <span className="flex items-center gap-1"><span className="animate-spin inline-block">↻</span> Sending…</span>
                      ) : (
                        <span>Send Swap Offer</span>
                      )}
                    </button>
                  </div>
                </div>
                </>
              )}
            </div>
          </div>
        </div>
        );
      })()}

      {/* Mentor Internal Swap Modal */}
      {demoSwapModalSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 w-full max-w-md shadow-2xl relative animate-in zoom-in-95 duration-200 space-y-4 flex flex-col max-h-[85vh]">
            
            <button
              onClick={() => setDemoSwapModalSession(null)}
              className="absolute right-4 top-4 p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-400 hover:text-slate-800 dark:hover:text-white transition-colors cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3 shrink-0">
              <RefreshCw className="h-5 w-5 text-indigo-500 animate-spin-slow" />
              <div>
                <h3 className="text-sm font-black uppercase text-slate-855 dark:text-white tracking-wider">
                  Request Internal Swap
                </h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">
                  Swap this review session with a peer from your college
                </p>
              </div>
            </div>

            {demoSwapStep === 1 ? (
              <div className="space-y-4">
                <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-150 text-[11px] text-slate-600 dark:text-slate-350 space-y-1">
                  <p><strong>Demo Subject:</strong> {demoSwapModalSession.subject} (Cohort: {demoSwapModalSession.stream})</p>
                  <p><strong>Date / Period:</strong> {demoSwapModalSession.dateStr} • {demoSwapModalSession.timeSlot}</p>
                </div>

                <div>
                  <label className="text-[9px] font-black uppercase text-slate-400 block mb-1.5">Reason for Swap</label>
                  <select
                    value={demoSwapReason}
                    onChange={(e) => setDemoSwapReason(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-205 dark:border-slate-750 bg-slate-50 dark:bg-slate-800 text-xs text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold"
                  >
                    <option value="I am unavailable">I am unavailable</option>
                    <option value="Leave Approved">Leave Approved</option>
                    <option value="Meeting">Meeting</option>
                    <option value="Emergency">Emergency</option>
                    <option value="Other (Remarks)">Other (Remarks)</option>
                  </select>
                </div>

                <div>
                  <label className="text-[9px] font-black uppercase text-slate-400 block mb-1.5">Remarks (Optional)</label>
                  <textarea
                    rows={3}
                    value={demoSwapRemarks}
                    onChange={(e) => setDemoSwapRemarks(e.target.value)}
                    placeholder="Describe details for peer mentor review..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-205 dark:border-slate-750 bg-slate-50 dark:bg-slate-800 text-xs text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setDemoSwapModalSession(null)}
                    className="flex-1 px-4 py-2.5 text-xs font-black text-slate-655 border border-slate-200 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => setDemoSwapStep(2)}
                    className="flex-1 px-4 py-2.5 text-xs font-black text-white bg-indigo-650 hover:bg-indigo-700 rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    Find Eligible Peers
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4 flex-grow flex flex-col min-h-0">
                <span className="text-[9px] font-black uppercase text-slate-400 block tracking-wider">AI Suggested Peer Matches</span>
                
                <div className="flex-1 overflow-y-auto pr-1 space-y-2 max-h-[220px]">
                  {getInternalSwapRecommendations(demoSwapModalSession).length > 0 ? (
                    getInternalSwapRecommendations(demoSwapModalSession).map((peer: any) => (
                      <div
                        key={peer.mentorId}
                        onClick={() => setSelectedProposedPeer(peer)}
                        className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${selectedProposedPeer?.mentorId === peer.mentorId ? "border-indigo-500 bg-indigo-50/20" : "border-slate-200 dark:border-slate-800 hover:border-indigo-300"}`}
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-800 dark:text-white truncate">{peer.mentorName}</p>
                          <span className="text-[9px] text-slate-400 block mt-0.5">Weekly Demos scheduled: {peer.weeklyCount}</span>
                        </div>
                        <div className="flex items-center gap-2 text-right shrink-0">
                          <div>
                            <span className="text-[8px] font-black uppercase text-indigo-500 block">Match</span>
                            <span className="text-xs font-black text-indigo-605 dark:text-indigo-400">{peer.score}%</span>
                          </div>
                          {selectedProposedPeer?.mentorId === peer.mentorId && (
                            <Check className="h-4 w-4 text-indigo-500" />
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-slate-400 italic text-center py-8">No free peer mentors matching {demoSwapModalSession.subject} found at your college for this timeslot.</p>
                  )}
                </div>

                <div className="flex gap-3 pt-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setDemoSwapStep(1)}
                    className="flex-1 px-4 py-2.5 text-xs font-black text-slate-655 border border-slate-200 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    disabled={demoSwapSubmitting || !selectedProposedPeer}
                    onClick={handleSubmitInternalSwap}
                    className="flex-grow px-4 py-2.5 text-xs font-black text-white bg-indigo-650 hover:bg-indigo-700 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-1.5 shadow-xs"
                  >
                    {demoSwapSubmitting ? "Submitting..." : "Send Proposal"}
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>
      )}

    </div>
  );
};
