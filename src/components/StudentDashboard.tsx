"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useApp, Slot, StudentAttendance } from "@/context/AppContext";
import { useToast } from "@/context/ToastContext";
import { Button } from "./Button";
import {
  Calendar,
  User,
  Clock,
  BookOpen,
  CheckCircle,
  CheckCircle2,
  XCircle,
  AlertCircle,
  MapPin,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Search,
  Download,
  Book,
  FileText,
  CreditCard,
  Plus,
  Sparkles,
  Award,
  Activity,
  CheckSquare,
  ArrowUpRight,
  Check,
  X,
  GraduationCap,
  Upload,
  RefreshCw,
  Menu,
  Edit2,
  Loader2,
  Video,
  ExternalLink
} from "lucide-react";
import { formatTimeLabel, calculateShiftSchedule, resolveClassGroupDetailsFromState, parseDbDate, isCohortMatching, getDeptFromClassGroup, isSubjectNameMatch, evaluateDailyStudentAttendance, isExamDate, isSkillSubject, calculateWeekOffsetForDate } from "@/lib/utils";
import { Pagination } from "@/components/ui/Pagination";

// Library Books Interface
interface BookItem {
  id: string;
  title: string;
  author: string;
  subject: string;
  shelf: string;
  status: "Available" | "Issued";
  expectedReturn?: string;
}

export interface StudentDashboardProps {
  activeTab?: "dashboard" | "schedule" | "leave" | "exams" | "materials" | "library" | "fees" | "profile" | "tracker" | "interviews" | "more_menu";
  onTabChange?: (tab: "dashboard" | "schedule" | "leave" | "exams" | "materials" | "library" | "fees" | "profile" | "tracker" | "interviews" | "more_menu") => void;
}

export const StudentDashboard: React.FC<StudentDashboardProps> = ({
  activeTab: propActiveTab,
  onTabChange
}) => {
  const {
    slots,
    studentAttendance,
    leaveRequests,
    requestLeave,
    currentStudent,
    timeSlots,
    daysOfWeek,
    weekDates,
    weekOffset,
    setWeekOffset,
    subjectsList,
    mentors,
    approvedHandovers,
    currentShift,
    setCurrentShift,
    updateStudent,
    interviews,
    interviewEvaluations,
    colleges,
    coursesList,
    weeklyTasks,
    studentTracker,
    gradeStudentTask,
    weeklyAcademicTasks,
    studentAcademicTracker,
    gradeStudentAcademicTask
  } = useApp();
  const { toast } = useToast();

  const [localActiveTab, setLocalActiveTab] = useState<"dashboard" | "schedule" | "leave" | "exams" | "materials" | "library" | "fees" | "profile" | "tracker" | "interviews" | "more_menu">("dashboard");
  const activeTab = propActiveTab || localActiveTab;
  const setActiveTab = onTabChange || setLocalActiveTab;

  const [highlightedDate, setHighlightedDate] = useState<string | null>(null);
  const [highlightedWeek, setHighlightedWeek] = useState<number | null>(null);

  // Handle notification jumps, search queries, and dynamic class/tab switching
  useEffect(() => {
    const handleNavigation = (targetUrl?: string, targetDate?: string, tabHint?: string) => {
      let urlStr = targetUrl || (typeof window !== "undefined" ? window.location.search : "");
      let dateParam = targetDate;
      let tabParam = tabHint;

      const params = new URLSearchParams(
        urlStr.includes("?")
          ? urlStr.split("?")[1]
          : (typeof window !== "undefined" ? window.location.search : "")
      );

      if (!dateParam) {
        dateParam = params.get("date") || undefined;
      }
      if (!tabParam) {
        tabParam = params.get("tab") || undefined;
      }

      const catParam = params.get("category");
      const subjParam = params.get("subject");
      const weekParam = params.get("week");
      const targetIdParam = params.get("targetId");

      if (catParam === "skill" || catParam === "academic") {
        setStudentTrackerCategory(catParam);
      }
      if (subjParam) {
        if (catParam === "academic") {
          setStudentAcadSubject(subjParam);
        } else {
          const matchSub =
            assignedMentorSubjects.find(
              (s) => s.toLowerCase().trim() === subjParam.toLowerCase().trim()
            ) ||
            studentSubjects.find(
              (s) => s.name.toLowerCase().trim() === subjParam.toLowerCase().trim()
            )?.name ||
            subjParam;
          setStudentTrackerSubject(matchSub);
        }
      }
      if (weekParam) {
        const wkNum = parseInt(weekParam, 10);
        if (!isNaN(wkNum)) {
          setStudentTrackerWeek(wkNum);
          setHighlightedWeek(wkNum);
          let attempts = 0;
          const scrollTarget = () => {
            attempts++;
            const el =
              document.getElementById(`skill-task-week-${wkNum}`) ||
              document.getElementById(`acad-task-week-${wkNum}`);
            if (el) {
              el.scrollIntoView({ behavior: "smooth", block: "center" });
            } else if (attempts < 10) {
              setTimeout(scrollTarget, 100);
            }
          };
          setTimeout(scrollTarget, 100);
          setTimeout(() => setHighlightedWeek(null), 6000);
        }
      }
      if (targetIdParam) {
        let attempts = 0;
        const scrollTargetId = () => {
          attempts++;
          const el = document.getElementById(targetIdParam);
          if (el) {
            el.scrollIntoView({ behavior: "smooth", block: "center" });
          } else if (attempts < 10) {
            setTimeout(scrollTargetId, 100);
          }
        };
        setTimeout(scrollTargetId, 100);
      }

      if (dateParam) {
        const offset = calculateWeekOffsetForDate(dateParam);
        setWeekOffset(offset);
        setHighlightedDate(dateParam);
        setActiveTab("schedule");
        
        // Auto scroll to target date row after render
        setTimeout(() => {
          const el = document.getElementById(`date-row-${dateParam}`);
          if (el) {
            el.scrollIntoView({ behavior: "smooth", block: "center" });
          }
        }, 300);

        setTimeout(() => {
          setHighlightedDate(null);
        }, 6000);
      } else if (tabParam && ["dashboard", "schedule", "marks", "leave", "exams", "library", "fees", "profile", "tracker", "interviews"].includes(tabParam)) {
        setActiveTab(tabParam as any);
      }
    };

    // 1. Check intent stored from notification click
    if (typeof window !== "undefined") {
      try {
        const stored = sessionStorage.getItem("fp_notif_target");
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Date.now() - (parsed.timestamp || 0) < 30000) {
            handleNavigation(parsed.url, parsed.date);
          }
          sessionStorage.removeItem("fp_notif_target");
        } else {
          handleNavigation();
        }
      } catch (_) {
        handleNavigation();
      }
    }

    // 2. Global event listener for instant reactive navigation while on this page
    const onNavEvent = (e: any) => {
      if (e?.detail) {
        handleNavigation(e.detail.url, e.detail.date);
      }
    };
    window.addEventListener("fp_navigate_target", onNavEvent);
    return () => window.removeEventListener("fp_navigate_target", onNavEvent);
  }, [activeTab, setActiveTab, setWeekOffset]);

  const [isCollapsed, setIsCollapsed] = useState(false);
  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("fp_sidebar_collapsed") === "true";
      setIsCollapsed(stored);
    }
  }, []);

  // Student Tracker states (Skill vs Academic)
  const [studentTrackerCategory, setStudentTrackerCategory] = useState<"skill" | "academic">("academic");
  const [studentTrackerSubject, setStudentTrackerSubject] = useState("");
  const [studentAcadSubject, setStudentAcadSubject] = useState("");
  const [studentTrackerWeek, setStudentTrackerWeek] = useState<number>(1);
  const [submittingUrlMap, setSubmittingUrlMap] = useState<Record<number, boolean>>({});
  const [studentUploadType, setStudentUploadType] = useState<Record<number, "url" | "file">>({});
  const [editSubmissionMode, setEditSubmissionMode] = useState<Record<number, boolean>>({});

  // State for Leave Submission Form
  const [leaveType, setLeaveType] = useState<"leave" | "od">("leave");
  const [leaveDate, setLeaveDate] = useState("");
  const [leaveReason, setLeaveReason] = useState("");
  const [submittingLeave, setSubmittingLeave] = useState(false);

  // State for OPAC library search
  const [librarySearch, setLibrarySearch] = useState("");
  
  // State for Dues payment
  const [paidFees, setPaidFees] = useState<Record<string, boolean>>({});

  const [dailyConfigsList, setDailyConfigsList] = useState<any[]>([]);
  const [studentExamsList, setStudentExamsList] = useState<any[]>([]);
  const [studentMarksList, setStudentMarksList] = useState<any[]>([]);
  const [examsLoading, setExamsLoading] = useState<boolean>(false);
  const [examSubTab, setExamSubTab] = useState<"schedule" | "results">("schedule");

  const fetchStudentExamsAndMarks = async () => {
    if (!currentStudent?.college_id) return;
    setExamsLoading(true);
    try {
      const dept = currentStudent.department || "";
      const [examsRes, marksRes] = await Promise.all([
        fetch(`/api/exams?college_id=${encodeURIComponent(currentStudent.college_id)}&department=${encodeURIComponent(dept)}`),
        fetch(`/api/exams/marks?student_id=${encodeURIComponent(currentStudent.id)}`)
      ]);
      const examsData = await examsRes.json();
      const marksData = await marksRes.json();
      if (examsData.success) {
        setStudentExamsList(examsData.exams || []);
      }
      if (marksData.success) {
        setStudentMarksList(marksData.marks || []);
      }
    } catch (e) {
      console.error("Error fetching exams & marks:", e);
    } finally {
      setExamsLoading(false);
    }
  };

  useEffect(() => {
    const collegeId = currentStudent?.college_id || "college_1";
    fetch(`/api/daily-configs?college_id=${encodeURIComponent(collegeId)}`)
      .then(res => res.json())
      .then(data => {
        if (data.success && data.configs) {
          setDailyConfigsList(data.configs);
        }
      })
      .catch(err => console.error("Error fetching daily configs:", err));

    fetchStudentExamsAndMarks();
  }, [currentStudent?.college_id, currentStudent?.department, currentStudent?.id]);
  const [payingFeeId, setPayingFeeId] = useState<string | null>(null);

  // Profile edit state
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editName, setEditName] = useState(currentStudent?.name || "");
  const [editEmail, setEditEmail] = useState(currentStudent?.email || "");
  const [editId, setEditId] = useState(currentStudent?.id || "");
  const [editDepartment, setEditDepartment] = useState(currentStudent?.department || "");
  const [editClassGroup, setEditClassGroup] = useState(currentStudent?.classGroup || "");
  const [editCollegeId, setEditCollegeId] = useState(currentStudent?.college_id || "college_1");
  const [editRegisterNumber, setEditRegisterNumber] = useState(currentStudent?.register_number || "");
  const [editRollNumber, setEditRollNumber] = useState(currentStudent?.roll_number || "");
  const [editTenthMark, setEditTenthMark] = useState(currentStudent?.tenth_mark || "");
  const [editEleventhMark, setEditEleventhMark] = useState(currentStudent?.eleventh_mark || "");
  const [editTwelfthMark, setEditTwelfthMark] = useState(currentStudent?.twelfth_mark || "");
  const [editAcademicGroup, setEditAcademicGroup] = useState(currentStudent?.academic_group || "");
  const [editMedium, setEditMedium] = useState(currentStudent?.medium || "");
  const [editBloodGroup, setEditBloodGroup] = useState(currentStudent?.blood_group || "");
  const [editDob, setEditDob] = useState(currentStudent?.dob || "");
  const [editPhone, setEditPhone] = useState(currentStudent?.phone || "");
  const [editParentPhone, setEditParentPhone] = useState(currentStudent?.parent_phone || "");
  const [editAadharNumber, setEditAadharNumber] = useState(currentStudent?.aadhar_number || "");
  const [editLinkedinLink, setEditLinkedinLink] = useState(currentStudent?.linkedin_link || "");
  const [editGithubId, setEditGithubId] = useState(currentStudent?.github_id || "");
  const [editProjectDriveLink, setEditProjectDriveLink] = useState(currentStudent?.project_drive_link || "");
  const [editHackerrankLink, setEditHackerrankLink] = useState(currentStudent?.hackerrank_link || "");
  const [editLeetcodeLink, setEditLeetcodeLink] = useState(currentStudent?.leetcode_link || "");
  const [editFigmaLink, setEditFigmaLink] = useState(currentStudent?.figma_link || "");
  const [allowedProfileEditClasses, setAllowedProfileEditClasses] = useState<string[]>([]);

  // State for Bunk Target Slider
  const [bunkTarget, setBunkTarget] = useState(75);

  // Pagination states
  const [booksPage, setBooksPage] = useState(1);
  const [booksPageSize, setBooksPageSize] = useState(25);
  const [leavePage, setLeavePage] = useState(1);
  const [leavePageSize, setLeavePageSize] = useState(25);

  // State for Class Attendance Calendar Month Navigation
  const [attendanceMonthOffset, setAttendanceMonthOffset] = useState<number>(0);

  const [studentInterviews, setStudentInterviews] = useState<any[]>([]);

  useEffect(() => {
    if (currentStudent?.id) {
      fetch(`/api/interviews?role=student&studentId=${currentStudent.id}&classGroup=${encodeURIComponent(currentStudent.classGroup || "")}&collegeId=${currentStudent.college_id || ""}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.success) {
            setStudentInterviews(data.interviews || []);
          }
        })
        .catch(() => {});
    }
  }, [currentStudent?.id, currentStudent?.classGroup, currentStudent?.college_id, activeTab]);

  useEffect(() => {
    const saved = localStorage.getItem("fp_allowed_profile_edit_classes");
    if (saved) {
      setAllowedProfileEditClasses(JSON.parse(saved));
    }
  }, [activeTab]);

  useEffect(() => {
    if (currentStudent) {
      setEditName(currentStudent.name);
      setEditEmail(currentStudent.email || "");
      setEditId(currentStudent.id);
      setEditDepartment(currentStudent.department || "");
      setEditClassGroup(currentStudent.classGroup || "");
      setEditCollegeId(currentStudent.college_id || "college_1");
      setEditRegisterNumber(currentStudent.register_number || "");
      setEditRollNumber(currentStudent.roll_number || "");
      setEditTenthMark(currentStudent.tenth_mark || "");
      setEditEleventhMark(currentStudent.eleventh_mark || "");
      setEditTwelfthMark(currentStudent.twelfth_mark || "");
      setEditAcademicGroup(currentStudent.academic_group || "");
      setEditMedium(currentStudent.medium || "");
      setEditBloodGroup(currentStudent.blood_group || "");
      setEditDob(currentStudent.dob || "");
      setEditPhone(currentStudent.phone || "");
      setEditParentPhone(currentStudent.parent_phone || "");
      setEditAadharNumber(currentStudent.aadhar_number || "");
      setEditLinkedinLink(currentStudent.linkedin_link || "");
      setEditGithubId(currentStudent.github_id || "");
      setEditProjectDriveLink(currentStudent.project_drive_link || "");
      setEditHackerrankLink(currentStudent.hackerrank_link || "");
      setEditLeetcodeLink(currentStudent.leetcode_link || "");
      setEditFigmaLink(currentStudent.figma_link || "");
    }
  }, [currentStudent]);

  const startEditingProfile = () => {
    if (currentStudent) {
      setEditName(currentStudent.name);
      setEditEmail(currentStudent.email || "");
      setEditId(currentStudent.id);
      setEditDepartment(currentStudent.department || "");
      setEditClassGroup(currentStudent.classGroup || "");
      setEditCollegeId(currentStudent.college_id || "college_1");
      setEditRegisterNumber(currentStudent.register_number || "");
      setEditRollNumber(currentStudent.roll_number || "");
      setEditTenthMark(currentStudent.tenth_mark || "");
      setEditEleventhMark(currentStudent.eleventh_mark || "");
      setEditTwelfthMark(currentStudent.twelfth_mark || "");
      setEditAcademicGroup(currentStudent.academic_group || "");
      setEditMedium(currentStudent.medium || "");
      setEditBloodGroup(currentStudent.blood_group || "");
      setEditDob(currentStudent.dob || "");
      setEditPhone(currentStudent.phone || "");
      setEditParentPhone(currentStudent.parent_phone || "");
      setEditAadharNumber(currentStudent.aadhar_number || "");
      setEditLinkedinLink(currentStudent.linkedin_link || "");
      setEditGithubId(currentStudent.github_id || "");
      setEditProjectDriveLink(currentStudent.project_drive_link || "");
      setEditHackerrankLink(currentStudent.hackerrank_link || "");
      setEditLeetcodeLink(currentStudent.leetcode_link || "");
      setEditFigmaLink(currentStudent.figma_link || "");
      setIsEditingProfile(true);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editName.trim()) {
      toast("Name is required.", "warning");
      return;
    }
    const res = await updateStudent({
      id: editId,
      name: editName,
      email: editEmail,
      role: "student",
      department: editDepartment,
      classGroup: editClassGroup,
      college_id: editCollegeId,
      register_number: editRegisterNumber,
      roll_number: editRollNumber,
      tenth_mark: editTenthMark,
      eleventh_mark: editEleventhMark,
      twelfth_mark: editTwelfthMark,
      academic_group: editAcademicGroup,
      medium: editMedium,
      blood_group: editBloodGroup,
      dob: editDob,
      phone: editPhone,
      parent_phone: editParentPhone,
      aadhar_number: editAadharNumber,
      linkedin_link: editLinkedinLink,
      github_id: editGithubId,
      project_drive_link: editProjectDriveLink,
      hackerrank_link: editHackerrankLink,
      leetcode_link: editLeetcodeLink,
      figma_link: editFigmaLink
    });
    if (res.success) {
      toast("Profile updated successfully!", "success");
      setIsEditingProfile(false);
    } else {
      toast("Error: " + res.message, "error");
    }
  };

  if (!currentStudent) return null;

  // Helper: normalize a classGroup string for fuzzy comparison (Bug #1+#5 fix)
  const normalizeClassGroup = (cg: string): string => {
    if (!cg) return "";
    return cg
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "")   // strip all non-alphanumeric
      .replace(/shift[12]/g, "");  // ignore shift suffix in comparison
  };

  const studentGroupNorm = normalizeClassGroup(currentStudent.classGroup);

  // Helper to parse student's classGroup into clean components
  const getStudentClassDetails = (classGroup?: string) => {
    if (!classGroup) return { course: "", shift: "", sem: "", year: "" };
    
    const { department, semester, year } = resolveClassGroupDetailsFromState(
      classGroup,
      subjectsList,
      coursesList
    );

    // Extract Shift
    let shift = "";
    if (classGroup.toLowerCase().includes("shift 1") || classGroup.toLowerCase().includes("shift_1")) {
      shift = "Shift 1";
    } else if (classGroup.toLowerCase().includes("shift 2") || classGroup.toLowerCase().includes("shift_2")) {
      shift = "Shift 2";
    } else {
      shift = "General Shift";
    }

    const num = parseInt(year.replace(/[^0-9]/g, ""), 10);
    const ordinalMap = ["", "1st Year", "2nd Year", "3rd Year", "4th Year"];
    const yearDisplay = ordinalMap[num] || year;

    return { course: department, shift, sem: semester, year: yearDisplay };
  };

  const studentClassDetails = getStudentClassDetails(currentStudent?.classGroup);
  const studentSubjects = subjectsList.filter(
    s => s.semester && s.semester.toLowerCase() === studentClassDetails.sem.toLowerCase()
  );

  // 1. Get all slots for student's class group — using robust fuzzy + cohort matching
  const myClassSlots = slots.filter((s) => {
    if (!currentStudent) return false;

    // Check college_id if set on slot and student
    if (s.college_id && currentStudent.college_id && s.college_id !== currentStudent.college_id) {
      return false;
    }

    // A. Direct or normalized classGroup match
    if (s.classGroup) {
      if (normalizeClassGroup(s.classGroup) === studentGroupNorm) return true;
      if (isCohortMatching(s.classGroup, currentStudent.classGroup, coursesList, subjectsList)) return true;
    }

    // B. Department and semester fallback matching
    const studentDept = currentStudent.department || "";
    const studentSem = currentStudent.semester || (currentStudent.classGroup ? currentStudent.classGroup.match(/Semester\s*\d+/i)?.[0] : "") || "";

    const slotDept = s.department || (s.classGroup ? getDeptFromClassGroup(s.classGroup) : "");
    const slotSem = s.semester || (s.classGroup ? s.classGroup.match(/Semester\s*\d+/i)?.[0] : "") || "";

    if (studentDept && slotDept && studentSem && slotSem) {
      const dMatch = studentDept.toLowerCase().trim() === slotDept.toLowerCase().trim() ||
                     getDeptFromClassGroup(studentDept).toLowerCase() === getDeptFromClassGroup(slotDept).toLowerCase();
      const sMatch = studentSem.toLowerCase().trim() === slotSem.toLowerCase().trim();
      if (dMatch && sMatch) return true;
    }

    // C. Subject match fallback: slot course matches one of student's semester subjects
    if (s.course && studentClassDetails?.sem) {
      const isSubjMatch = studentSubjects.some(sub => isSubjectNameMatch(sub.name, s.course));
      if (isSubjMatch) return true;
    }

    return false;
  });

  // Synchronize the current active shift with the student's actual timetable slot shift
  useEffect(() => {
    let studentShift: "shift_1" | "shift_2" | "general" = "general";
    if (myClassSlots.length > 0) {
      studentShift = myClassSlots[0].shift as "shift_1" | "shift_2" | "general";
    } else if (currentStudent?.classGroup) {
      const groupLower = currentStudent.classGroup.toLowerCase();
      if (groupLower.includes("shift 1") || groupLower.includes("shift_1")) {
        studentShift = "shift_1";
      } else if (groupLower.includes("shift 2") || groupLower.includes("shift_2")) {
        studentShift = "shift_2";
      }
    }
    
    if (studentShift && currentShift !== studentShift) {
      setCurrentShift(studentShift);
    }
  }, [myClassSlots, currentStudent, currentShift, setCurrentShift]);

  useEffect(() => {
    if (studentSubjects.length > 0 && !studentTrackerSubject) {
      setStudentTrackerSubject(studentSubjects[0].name);
    }
  }, [studentSubjects, studentTrackerSubject]);

  // 2. Get all attendance records for this student (Memoized)
  const myAttendance = useMemo(() => {
    return studentAttendance.filter((a) => a.studentId === currentStudent.id);
  }, [studentAttendance, currentStudent.id]);

  // 3. Filter leave requests for this student (Memoized)
  const myLeaveRequests = useMemo(() => {
    return (leaveRequests || []).filter((r) => r.studentId === currentStudent.id);
  }, [leaveRequests, currentStudent.id]);

  // Daily-evaluated Stats Calculations (1 period absent = full day absent, exam day single marking is enough)
  const evaluatedDailyStats = useMemo(() => {
    const recordsByDate = new Map<string, any[]>();
    myAttendance.forEach(att => {
      const arr = recordsByDate.get(att.dateStr) || [];
      arr.push(att);
      recordsByDate.set(att.dateStr, arr);
    });

    let totalDays = 0;
    let presentDays = 0;
    let absentDays = 0;

    recordsByDate.forEach((recs, dStr) => {
      const d = parseDbDate(dStr);
      const isSunday = d.getDay() === 0;
      const isExam = isExamDate(dStr, dailyConfigsList, studentAttendance);
      if (isSunday && !isExam) return; // Skip invalid Sunday records

      totalDays++;
      const evalRes = evaluateDailyStudentAttendance(recs, 0, isExam);
      presentDays += evalRes.presentDays;
      absentDays += evalRes.absentDays;
    });

    const overallPercentage = totalDays > 0 ? (presentDays / totalDays) * 100 : 100;
    return {
      totalClasses: totalDays,
      presentClasses: presentDays,
      absentClasses: absentDays,
      overallPercentage
    };
  }, [myAttendance, dailyConfigsList, studentAttendance]);

  const totalClasses = evaluatedDailyStats.totalClasses;
  const presentClasses = evaluatedDailyStats.presentClasses;
  const absentClasses = evaluatedDailyStats.absentClasses;
  const overallPercentage = evaluatedDailyStats.overallPercentage;

  // Compute Bunk / Attendance Projection calculations (Memoized)
  const bunkStats = useMemo(() => {
    if (totalClasses === 0) return { status: "no_data", value: 0 };
    
    if (overallPercentage >= bunkTarget) {
      const targetRatio = bunkTarget / 100;
      const maxTotal = Math.floor(presentClasses / targetRatio);
      const safeSkip = maxTotal - totalClasses;
      return {
        status: "safe",
        value: safeSkip >= 0 ? safeSkip : 0
      };
    } else {
      const targetPct = bunkTarget;
      const numerator = targetPct * totalClasses - 100 * presentClasses;
      const denominator = 100 - targetPct;
      const requiredConsecutive = Math.ceil(numerator / denominator);
      return {
        status: "shortage",
        value: requiredConsecutive >= 0 ? requiredConsecutive : 0
      };
    }
  }, [totalClasses, overallPercentage, presentClasses, bunkTarget]);

  // Group attendance by Course (Memoized)
  const courseStats = useMemo(() => {
    const statsObj: Record<string, { present: number; absent: number; total: number }> = {};
    
    myClassSlots.forEach((slot) => {
      if (slot.course && !statsObj[slot.course]) {
        statsObj[slot.course] = { present: 0, absent: 0, total: 0 };
      }
    });

    myAttendance.forEach((att) => {
      const slot = slots.find((s) => s.id === att.slotId);
      if (slot && slot.course) {
        if (!statsObj[slot.course]) {
          statsObj[slot.course] = { present: 0, absent: 0, total: 0 };
        }
        if (att.status === "present") {
          statsObj[slot.course].present++;
        } else {
          statsObj[slot.course].absent++;
        }
        statsObj[slot.course].total++;
      }
    });

    return statsObj;
  }, [myClassSlots, myAttendance, slots]);

  // Memoized Attendance Calendar Month view for Dashboard Class Attendance
  const attendanceCalendarData = useMemo(() => {
    const baseDate = new Date();
    const d = new Date(baseDate.getFullYear(), baseDate.getMonth() + attendanceMonthOffset, 1);
    const year = d.getFullYear();
    const month = d.getMonth();
    const monthName = d.toLocaleDateString("en-US", { month: "long", year: "numeric" });

    // Monday = 0, Tuesday = 1, ... Sunday = 6
    const firstDayIndex = (d.getDay() + 6) % 7;
    const totalDaysInMonth = new Date(year, month + 1, 0).getDate();

    const attendanceByDate = new Map<string, { present: number; absent: number; total: number }>();
    myAttendance.forEach(att => {
      const entry = attendanceByDate.get(att.dateStr) || { present: 0, absent: 0, total: 0 };
      if (att.status === "present") entry.present++;
      else entry.absent++;
      entry.total++;
      attendanceByDate.set(att.dateStr, entry);
    });

    const days: Array<{
      type: "pad" | "day";
      day?: number;
      dateStr?: string;
      status?: "present" | "absent" | "holiday" | "event" | "exam" | "unmarked";
      dayConfig?: any;
      attRecord?: any;
      key: string;
    }> = [];

    for (let i = 0; i < firstDayIndex; i++) {
      days.push({ type: "pad", key: `pad-${i}` });
    }

    let monthPresentDays = 0;
    let monthAbsentDays = 0;
    let monthTotalMarked = 0;

    for (let day = 1; day <= totalDaysInMonth; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const dayDate = new Date(year, month, day);
      const isSunday = dayDate.getDay() === 0;

      const dayConfig = dailyConfigsList.find((c: any) => c.dateStr === dateStr);
      const isHoliday = isSunday || dayConfig?.day_type === "holiday";
      const isEvent = dayConfig?.day_type === "event";
      const isExam = dayConfig?.day_type === "exam_day" || dayConfig?.day_type === "exam";

      // Sundays are weekly holidays and never have regular working attendance
      const attRecord = !isSunday || isExam || isEvent ? attendanceByDate.get(dateStr) : undefined;
      let status: "present" | "absent" | "holiday" | "event" | "exam" | "unmarked" = "unmarked";

      if (attRecord && attRecord.total > 0) {
        monthTotalMarked++;
        if (attRecord.absent > 0) {
          status = "absent";
          monthAbsentDays++;
        } else {
          status = "present";
          monthPresentDays++;
        }
      } else if (isHoliday) {
        status = isSunday ? "unmarked" : "holiday";
      } else if (isEvent) {
        status = "event";
      } else if (isExam) {
        status = "exam";
      }

      days.push({
        type: "day",
        day,
        dateStr,
        status,
        dayConfig,
        attRecord,
        key: dateStr
      });
    }

    const monthPercentage = monthTotalMarked > 0 ? Math.round((monthPresentDays / monthTotalMarked) * 100) : 100;

    return {
      monthName,
      days,
      monthPresentDays,
      monthAbsentDays,
      monthTotalMarked,
      monthPercentage
    };
  }, [attendanceMonthOffset, myAttendance, dailyConfigsList]);

  // Cohort Weekly Tasks for Dashboard View
  const dashboardCohortTasks = useMemo(() => {
    return (weeklyTasks || []).filter(task => 
      isCohortMatching(task.class_group, currentStudent?.classGroup, coursesList, subjectsList) ||
      (currentStudent?.department && task.class_group.toLowerCase().includes(currentStudent.department.toLowerCase().trim()))
    ).slice(0, 4);
  }, [weeklyTasks, currentStudent, coursesList, subjectsList]);

  // Subjects with mentor-assigned weekly tasks or marked as skill subjects for this student's class group
  const assignedMentorSubjects = useMemo(() => {
    const matchingTasks = (weeklyTasks || []).filter(task => 
      isCohortMatching(task.class_group, currentStudent?.classGroup, coursesList, subjectsList) ||
      (currentStudent?.department && task.class_group.toLowerCase().includes(currentStudent.department.toLowerCase().trim()))
    );
    const taskSubjects = Array.from(new Set(matchingTasks.map(t => t.subject).filter(Boolean)));
    
    // Also include enrolled semester subjects that are explicitly marked as skill subjects
    const skillEnrolledSubjects = (studentSubjects || []).filter(s => isSkillSubject(s)).map(s => s.name);
    
    const combined = Array.from(new Set([...taskSubjects, ...skillEnrolledSubjects])).filter(Boolean);
    return combined;
  }, [weeklyTasks, currentStudent, coursesList, subjectsList, studentSubjects]);

  // Automatically sync studentTrackerSubject with assignedMentorSubjects
  useEffect(() => {
    if (assignedMentorSubjects.length > 0) {
      if (
        !studentTrackerSubject ||
        !assignedMentorSubjects.some(
          (s) =>
            isSubjectNameMatch(s, studentTrackerSubject) ||
            s.toLowerCase().trim() === studentTrackerSubject.toLowerCase().trim()
        )
      ) {
        setStudentTrackerSubject(assignedMentorSubjects[0]);
      }
    } else if (studentSubjects.length > 0 && !studentTrackerSubject) {
      const skillSub = studentSubjects.find((s) => isSkillSubject(s));
      setStudentTrackerSubject(skillSub ? skillSub.name : studentSubjects[0].name);
    }
  }, [assignedMentorSubjects, studentSubjects, studentTrackerSubject]);



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

  // Helper to find slot attendance for a specific day/date and time slot
  const getAttendanceForCell = (day: string, dateStr: string, time: string) => {
    const dailyConfig = dailyConfigsList.find((c: any) => c.dateStr === dateStr);
    
    // 1. Holiday handling
    if (dailyConfig && dailyConfig.day_type === "holiday") {
      return {
        type: "holiday" as const,
        config: dailyConfig,
        attendance: null,
        slot: null,
        handover: null
      };
    }

    const queryDay = getMappedDayForDate(dateStr, day);

    // Look for date-level attendance (e.g. exam / event / general day attendance)
    const dayAttendance = myAttendance.find((a) => a.dateStr === dateStr);

    const normalizeTimeStr = (t?: string) => {
      if (!t) return "";
      return t.toLowerCase()
        .replace(/\./g, ":")
        .replace(/\s+/g, "")
        .replace(/^0/, "");
    };

    const normCellTime = normalizeTimeStr(time);

    // Find the slot for this class group at this time using flexible time matching
    const slot = myClassSlots.find((s) => {
      if (s.day !== queryDay) return false;
      if (s.time === time) return true;

      const normSlotTime = normalizeTimeStr(s.time);
      if (normSlotTime === normCellTime) return true;

      // Compare start times e.g. "9:00 AM" vs "09:00 AM - 10:00 AM"
      const cellStart = formatTimeLabel(time).toLowerCase().replace(/[^a-z0-9]/g, "");
      const slotStart = formatTimeLabel(s.time).toLowerCase().replace(/[^a-z0-9]/g, "");
      if (cellStart && slotStart && cellStart === slotStart) return true;

      return false;
    });

    const matchingExam = (studentExamsList || []).find((ex: any) => ex.exam_date === dateStr);
    const isExamDay = (dailyConfig && (dailyConfig.day_type === "exam_day" || dailyConfig.day_type === "exam")) || Boolean(matchingExam);

    if (isExamDay) {
      return {
        type: "exam" as const,
        config: dailyConfig || null,
        exam: matchingExam || null,
        attendance: dayAttendance || (slot ? myAttendance.find((a) => a.slotId === slot.id && a.dateStr === dateStr) : null) || null,
        slot: slot || null,
        handover: null
      };
    }

    if (!slot) {
      if (dailyConfig && dailyConfig.day_type === "event") {
        return {
          type: "event" as const,
          config: dailyConfig,
          exam: null,
          attendance: dayAttendance || null,
          slot: null,
          handover: null
        };
      }
      return null;
    }

    // Check if there is an approved handover (substitution) for this slot on this date
    const handover = (approvedHandovers || []).find((h) => h.slotId === slot.id && h.dateStr === dateStr);

    // Find if student has an attendance marked for this slot on this date or day-level attendance
    const att = myAttendance.find((a) => a.slotId === slot.id && a.dateStr === dateStr) || 
                (dailyConfig?.day_type === "event" ? dayAttendance : null);
    
    return {
      type: "slot" as const,
      slot,
      handover,
      exam: null,
      attendance: att || null,
      config: dailyConfig || null
    };
  };

  // Generate timetable rows with break/lunch intervals dynamically
  const rows: (
    | { type: "slot"; time: string; index?: number }
    | { type: "break" | "lunch"; label: string; timeRange: string }
  )[] = [];

  const collegeObj = colleges.find(c => c.id === currentStudent.college_id);
  const details = getStudentClassDetails(currentStudent.classGroup);
  
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
  if (collegeObj && collegeObj.shift_configs) {
    try {
      const parsed = JSON.parse(collegeObj.shift_configs);
      const semKey = getCleanSemesterKey(details.sem);
      if (semKey && parsed.semesters?.[semKey]?.[currentShift]) {
        activeParams = parsed.semesters[semKey][currentShift]?.custom_shift_params || null;
      }
      if (!activeParams && parsed.custom_shift_params?.[currentShift]) {
        activeParams = parsed.custom_shift_params[currentShift];
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

  if (scheduleItems.length > 0) {
    scheduleItems.forEach((item) => {
      if (item.type === "period") {
        rows.push({
          type: "slot",
          time: `${item.startTimeStr} - ${item.endTimeStr}`,
          index: item.index
        });
      } else {
        rows.push({
          type: "break",
          label: item.name,
          timeRange: `${item.startTimeStr} - ${item.endTimeStr}`
        });
      }
    });
  } else {
    // Dynamic chronological fallback matching actual time gaps
    const fallbackSlots = timeSlots || [];
    fallbackSlots.forEach((time, index) => {
      rows.push({ type: "slot", time });

      if (index < fallbackSlots.length - 1) {
        const partsCur = time.split(/\s*-\s*/);
        const partsNext = fallbackSlots[index + 1].split(/\s*-\s*/);

        if (partsCur.length >= 2 && partsNext.length >= 1) {
          const parseTimeMinutes = (tStr: string) => {
            if (!tStr) return { mins: 0, formatted: "" };
            const cleaned = tStr.trim();
            const match = cleaned.match(/(\d+)(?::|\.)(\d+)\s*(AM|PM)?/i);
            if (!match) return { mins: 0, formatted: cleaned };
            let h = parseInt(match[1], 10);
            const m = parseInt(match[2], 10);
            const isPM = (match[3] || "").toUpperCase() === "PM" || (cleaned.toLowerCase().includes("pm") && !cleaned.toLowerCase().includes("am"));
            const period = isPM ? "PM" : "AM";
            let h24 = h;
            if (isPM && h24 !== 12) h24 += 12;
            if (!isPM && h24 === 12) h24 = 0;
            const mins = h24 * 60 + m;
            const formatted = `${h}:${m.toString().padStart(2, "0")} ${period}`;
            return { mins, formatted };
          };

          const endCur = parseTimeMinutes(partsCur[1]);
          const startNext = parseTimeMinutes(partsNext[0]);
          const diffMins = startNext.mins - endCur.mins;

          if (diffMins > 5) {
            const isLunch = diffMins >= 35 || (endCur.mins >= 700 && endCur.mins <= 800);
            rows.push({
              type: isLunch ? "lunch" : "break",
              label: isLunch ? "Lunch Break" : "Break",
              timeRange: `${endCur.formatted} - ${startNext.formatted}`
            });
          }
        }
      }
    });
  }

  // Handle leave request submit
  const handleLeaveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leaveDate || !leaveReason) return;
    setSubmittingLeave(true);
    const res = await requestLeave(leaveType, leaveDate, leaveReason);
    if (res.success) {
      toast("Leave request submitted successfully.", "success");
    } else {
      toast(res.message || "Failed to submit leave request.", "error");
    }
    setLeaveDate("");
    setLeaveReason("");
    setSubmittingLeave(false);
  };

  // Dynamically map library resources from active DB subjectsList
  const libraryBooks: BookItem[] = useMemo(() => {
    const list = studentSubjects.length > 0 ? studentSubjects : (subjectsList || []);
    return list.map((subj, idx) => ({
      id: `BK-${subj.id || (idx + 1)}`,
      title: `${subj.name} — Curriculum Textbook & Reference Guide`,
      author: "Dept. Curriculum Faculty & Board of Studies",
      subject: subj.name,
      shelf: `Rack ${String.fromCharCode(65 + (idx % 8))}-${(idx % 4) + 1}`,
      status: "Available" as const
    }));
  }, [studentSubjects, subjectsList]);

  // Filter OPAC Books based on query
  const filteredBooks = libraryBooks.filter((book) => {
    const q = librarySearch.toLowerCase();
    return (
      book.title.toLowerCase().includes(q) ||
      book.author.toLowerCase().includes(q) ||
      book.subject.toLowerCase().includes(q) ||
      book.id.toLowerCase().includes(q)
    );
  });

  // Real fee state from /api/fees
  const [feeData, setFeeData] = useState<any>(null);
  const [feeLoading, setFeeLoading] = useState(false);
  const [feePayModal, setFeePayModal] = useState<any | null>(null);
  const [feePayAmount, setFeePayAmount] = useState("");
  const [feePayMethod, setFeePayMethod] = useState("online");
  const [feePaySubmitting, setFeePaySubmitting] = useState(false);
  const [feePaySuccess, setFeePaySuccess] = useState<string | null>(null);

  // Subject Materials (Unit-Wise Study Hub) Real State
  const [materialsList, setMaterialsList] = useState<any[]>([]);
  const [materialsLoading, setMaterialsLoading] = useState(false);
  const [selectedMaterialSubject, setSelectedMaterialSubject] = useState<string>("");
  const [selectedMaterialUnit, setSelectedMaterialUnit] = useState<number | "all">("all");
  const [materialTypeFilter, setMaterialTypeFilter] = useState<string>("all");
  const [materialSearchQuery, setMaterialSearchQuery] = useState("");
  const [previewMaterial, setPreviewMaterial] = useState<any | null>(null);

  const fetchSubjectMaterials = async (subj?: string) => {
    setMaterialsLoading(true);
    try {
      const targetSubj = subj || selectedMaterialSubject || (studentSubjects[0]?.name || "");
      const res = await fetch(`/api/materials?subject=${encodeURIComponent(targetSubj)}`);
      const data = await res.json();
      if (data.success) {
        setMaterialsList(data.materials || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setMaterialsLoading(false);
    }
  };

  useEffect(() => {
    if (studentSubjects.length > 0 && !selectedMaterialSubject) {
      setSelectedMaterialSubject(studentSubjects[0].name);
    }
  }, [studentSubjects, selectedMaterialSubject]);

  useEffect(() => {
    if (selectedMaterialSubject) {
      fetchSubjectMaterials(selectedMaterialSubject);
    }
  }, [selectedMaterialSubject]);

  const fetchFeeData = async () => {
    if (!currentStudent?.id) return;
    setFeeLoading(true);
    try {
      const res = await fetch(`/api/fees?role=student&studentId=${encodeURIComponent(currentStudent.id)}`);
      const json = await res.json();
      if (json.success) setFeeData(json);
    } catch (e) { console.error(e); }
    finally { setFeeLoading(false); }
  };

  const handleFeePayment = async () => {
    if (!feePayModal || !feePayAmount || !currentStudent) return;
    setFeePaySubmitting(true);
    try {
      const res = await fetch("/api/fees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          feeId: feePayModal.id,
          studentId: currentStudent.id,
          amount: Number(feePayAmount),
          paymentMethod: feePayMethod,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setFeePaySuccess(json.receiptNo);
        await fetchFeeData();
      }
    } finally { setFeePaySubmitting(false); }
  };

  return (
    <div className="flex-1 flex flex-col md:flex-row bg-warm-canvas text-slate-800 h-full overflow-hidden">
      {/* Dynamic sidebar for student portal modules */}
      {(() => {
        const pendingTrackerCount = weeklyTasks.filter(t => {
          const isMatch = isCohortMatching(t.class_group, currentStudent?.classGroup, coursesList, subjectsList);
          if (!isMatch) return false;
          const entry = studentTracker.find(e => e.student_id === currentStudent?.id && e.week_number === t.week_number && e.subject.toLowerCase().trim() === t.subject.toLowerCase().trim());
          return !entry || !entry.submission_url;
        }).length;

        const getNotificationCount = (tabId: string) => {
          if (tabId === "tracker") return pendingTrackerCount;
          if (tabId === "fees") return feeData?.stats?.unpaidCount || 0;
          return 0;
        };

        return (
          <aside className={`hidden md:flex shrink-0 flex-col justify-between floating-sidebar transition-all duration-300 ${isCollapsed ? "w-20 p-3" : "w-64 p-6"}`}>
            <div className="flex flex-col flex-1 overflow-y-auto">
              {/* Sidebar Link items */}
              <nav className="space-y-1 pt-2">
                {[
                  { id: "dashboard", label: "Dashboard", icon: Activity },
                  { id: "schedule", label: "Schedule", icon: Calendar },
                  { id: "interviews", label: "My Interviews", icon: Award },
                  { id: "leave", label: "Leave & OD", icon: FileText },
                  { id: "tracker", label: "Skill Development", icon: GraduationCap },
                  { id: "exams", label: "Exams", icon: BookOpen },
                  { id: "materials", label: "Subject Materials", icon: Book },
                  { id: "fees", label: "Fees", icon: CreditCard },
                  { id: "profile", label: "My Profile", icon: User }
                ].map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id || (tab.id === "materials" && activeTab === "library");
                  const count = getNotificationCount(tab.id);
                  return (
                    <a
                      key={tab.id}
                      href={`/student/${tab.id}`}
                      onClick={(e) => {
                        if (e.ctrlKey || e.metaKey || e.button === 1) return;
                        e.preventDefault();
                        if (tab.id === "tracker") {
                          setStudentTrackerCategory("skill");
                        }
                        window.location.href = `/student/${tab.id}`;
                      }}
                      className={`w-full flex items-center rounded-md text-xs font-bold tracking-tight transition-all duration-200 cursor-pointer ${
                        isCollapsed ? "justify-center px-0 py-3" : "justify-start gap-3 px-4 py-3 text-left"
                      } ${
                        isActive
                          ? "sidebar-active-item"
                          : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
                      }`}
                    >
                      <div className="relative flex items-center justify-center">
                        <Icon className={`h-4.5 w-4.5 shrink-0 ${isActive ? "text-[#4F46E5]" : "text-slate-400 group-hover:text-slate-650"}`} />
                        {isCollapsed && count > 0 && (
                          <span className="absolute -top-1.5 -right-1.5 block h-2.5 w-2.5 rounded-full bg-rose-500 ring-2 ring-white" />
                        )}
                      </div>
                      {!isCollapsed && <span>{tab.label}</span>}
                      {!isCollapsed && count > 0 && (
                        <span className="ml-auto bg-rose-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                          {count}
                        </span>
                      )}
                    </a>
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
                  className="h-8.5 w-8.5 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-50 shadow-xs transition-all cursor-pointer"
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
            { id: "dashboard", label: "Home", icon: Activity },
            { id: "schedule", label: "Schedule", icon: Calendar },
            { id: "tracker", label: "Skills", icon: GraduationCap },
            { id: "materials", label: "Materials", icon: Book },
            { id: "more_menu", label: "More", icon: Menu },
          ].map(t => {
            const Icon = t.icon;
            const isActive = activeTab === t.id || (t.id === "materials" && activeTab === "library") || (t.id === "more_menu" && ["leave", "exams", "fees", "profile"].includes(activeTab));
            const pendingCount = t.id === "tracker"
              ? weeklyTasks.filter(task => {
                  const isMatch = isCohortMatching(task.class_group, currentStudent?.classGroup, coursesList, subjectsList);
                  if (!isMatch) return false;
                  const entry = studentTracker.find(e => e.student_id === currentStudent?.id && e.week_number === task.week_number && e.subject.toLowerCase().trim() === task.subject.toLowerCase().trim());
                  return !entry || !entry.submission_url;
                }).length
              : t.id === "fees" ? (feeData?.stats?.unpaidCount || 0) : 0;
            return (
              <a
                key={t.id}
                href={`/student/${t.id}`}
                onClick={(e) => {
                  if (e.ctrlKey || e.metaKey || e.button === 1) return;
                  e.preventDefault();
                  if (t.id === "tracker") {
                    setStudentTrackerCategory("skill");
                  }
                  window.location.href = `/student/${t.id}`;
                }}
                className={`relative flex flex-col items-center justify-center gap-0.5 flex-1 py-1.5 rounded-xl transition-all cursor-pointer ${
                  isActive ? "text-indigo-600" : "text-slate-400"
                }`}
              >
                <div className="relative">
                  <Icon className={`h-4.5 w-4.5 transition-transform ${isActive ? "scale-110" : ""}`} />
                  {pendingCount > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 h-3 w-3 bg-rose-500 text-white text-[7px] font-bold rounded-full flex items-center justify-center">
                      {pendingCount}
                    </span>
                  )}
                </div>
                <span className={`text-[8px] font-semibold tracking-wide leading-none ${isActive ? "text-indigo-600" : "text-slate-400"}`}>
                  {t.label}
                </span>
                {isActive && <span className="absolute top-0 inset-x-1 h-0.5 bg-indigo-500 rounded-full" />}
              </a>
            );
          })}
        </div>
      </nav>

      <main className="flex-1 floating-main-panel p-4 md:p-6 lg:p-8 space-y-6 pb-20 md:pb-12 overflow-y-auto h-full scroll-touch">
        {/* Portal Header Summary */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-extrabold tracking-tight text-slate-900 leading-none">
              {activeTab === "dashboard" && "Dashboard"}
              {activeTab === "schedule" && "Weekly Class Timetable"}
              {activeTab === "interviews" && "Academic Mock Interviews"}
              {activeTab === "leave" && "Student Leave & OD Tracker"}
              {activeTab === "tracker" && "Skill Development & Lab Evaluations"}
              {activeTab === "exams" && "Semester Exams Seating"}
              {(activeTab === "materials" || activeTab === "library") && "Subject Materials & Study Resources"}
              {activeTab === "fees" && "Online Dues & Fees Administration"}
              {activeTab === "profile" && "My Profile Portal"}
              {activeTab === "more_menu" && "More Services & Portals"}
            </h1>
            <div className="h-1.5 w-1.5 rounded-full bg-indigo-600" />
            {(() => {
              const details = getStudentClassDetails(currentStudent.classGroup);
              return (
                <span className="text-xs text-slate-500 font-bold flex items-center gap-2 flex-wrap">
                  <span>{details.course}</span>
                  <span className="text-slate-300">•</span>
                  <span className="px-2 py-0.5 rounded bg-indigo-50 border border-indigo-100 text-[10px] font-black text-indigo-700">{details.year}</span>
                  <span className="text-slate-300">•</span>
                  <span className="px-2 py-0.5 rounded bg-teal-50 border border-teal-100 text-[10px] font-black text-teal-700">{details.sem}</span>
                  <span className="text-slate-300">•</span>
                  <span className="text-slate-400">{details.shift}</span>
                </span>
              );
            })()}
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 bg-indigo-50 border border-indigo-100 px-3 py-1 rounded-full text-indigo-700">
              <Sparkles className="h-3.5 w-3.5" />
              <span className="text-[9px] font-extrabold uppercase tracking-widest">
                Academic Session
              </span>
            </div>
          </div>
        </div>

        {/* Tab More Menu: Grid of remaining tabs */}
        {activeTab === "more_menu" && (
          <div className="space-y-6 animate-fadeIn pb-10">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

              <a
                href="/student/leave"
                onClick={(e) => {
                  if (e.ctrlKey || e.metaKey || e.button === 1) return;
                  e.preventDefault();
                  window.location.href = "/student/leave";
                }}
                className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-left hover:border-indigo-500 hover:ring-2 hover:ring-indigo-100 transition-all flex items-center gap-4 shadow-xs cursor-pointer group"
              >
                <div className="h-10 w-10 rounded-xl bg-indigo-50 dark:bg-indigo-900/25 flex items-center justify-center text-indigo-500 shrink-0 group-hover:scale-105 transition-transform">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <span className="block text-xs font-bold text-slate-800 dark:text-slate-200">Leave & OD</span>
                  <span className="text-[10px] text-slate-455 dark:text-slate-400 font-medium">Apply and track requests</span>
                </div>
              </a>

              <a
                href="/student/exams"
                onClick={(e) => {
                  if (e.ctrlKey || e.metaKey || e.button === 1) return;
                  e.preventDefault();
                  window.location.href = "/student/exams";
                }}
                className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-left hover:border-indigo-500 hover:ring-2 hover:ring-indigo-100 transition-all flex items-center gap-4 shadow-xs cursor-pointer group"
              >
                <div className="h-10 w-10 rounded-xl bg-rose-50 dark:bg-rose-900/25 flex items-center justify-center text-rose-500 shrink-0 group-hover:scale-105 transition-transform">
                  <BookOpen className="h-5 w-5" />
                </div>
                <div>
                  <span className="block text-xs font-bold text-slate-800 dark:text-slate-200">Exams Seating</span>
                  <span className="text-[10px] text-slate-455 dark:text-slate-400 font-medium">Seating and hall tickets</span>
                </div>
              </a>

              <a
                href="/student/materials"
                onClick={(e) => {
                  if (e.ctrlKey || e.metaKey || e.button === 1) return;
                  e.preventDefault();
                  window.location.href = "/student/materials";
                }}
                className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-left hover:border-indigo-500 hover:ring-2 hover:ring-indigo-100 transition-all flex items-center gap-4 shadow-xs cursor-pointer group"
              >
                <div className="h-10 w-10 rounded-xl bg-teal-50 dark:bg-teal-900/25 flex items-center justify-center text-teal-500 shrink-0 group-hover:scale-105 transition-transform">
                  <Book className="h-5 w-5" />
                </div>
                <div>
                  <span className="block text-xs font-bold text-slate-800 dark:text-slate-200">Subject Materials</span>
                  <span className="text-[10px] text-slate-455 dark:text-slate-400 font-medium">Unit-wise notes, slides & question banks</span>
                </div>
              </a>

              <a
                href="/student/profile"
                onClick={(e) => {
                  if (e.ctrlKey || e.metaKey || e.button === 1) return;
                  e.preventDefault();
                  window.location.href = "/student/profile";
                }}
                className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-left hover:border-indigo-500 hover:ring-2 hover:ring-indigo-100 transition-all flex items-center gap-4 shadow-xs cursor-pointer group sm:col-span-2"
              >
                <div className="h-10 w-10 rounded-xl bg-slate-100 dark:bg-slate-800/80 flex items-center justify-center text-slate-600 dark:text-slate-350 shrink-0 group-hover:scale-105 transition-transform">
                  <User className="h-5 w-5" />
                </div>
                <div>
                  <span className="block text-xs font-bold text-slate-800 dark:text-slate-200">My Profile</span>
                  <span className="text-[10px] text-slate-455 dark:text-slate-400 font-medium">Personal info and settings</span>
                </div>
              </a>
            </div>
          </div>
        )}

        {/* Tab 1: Dashboard Attendance & Bunk Predictor */}
        {activeTab === "dashboard" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fadeIn">
            {/* Left Columns (Col Span 2) */}
            <div className="lg:col-span-2 space-y-6">
                
                {/* Real-Time Overview Cards Row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                  {/* 3. Academic Mock Interviews Summary Tile */}
                  {(() => {
                    const upcomingInterview = (studentInterviews || []).find((inv: any) => inv.status !== "evaluated") || (studentInterviews || [])[0];
                    const evaluatedCount = (studentInterviews || []).filter((inv: any) => inv.status === "evaluated").length;

                    return (
                      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs relative flex flex-col justify-between group hover:shadow-md transition-all">
                        <div className="flex items-start justify-between">
                          <div className="space-y-1">
                            <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest block">Mock Interviews</span>
                            <span className="text-lg font-black text-slate-900">
                              {upcomingInterview ? upcomingInterview.subject || "Interview Round" : "No Pending Rounds"}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setActiveTab("interviews")}
                            className="p-2 bg-slate-50 border border-slate-200 text-slate-700 rounded-full shrink-0 shadow-2xs hover:bg-slate-100 cursor-pointer"
                            title="Open Interviews"
                          >
                            <ArrowUpRight className="h-3.5 w-3.5 text-slate-600" />
                          </button>
                        </div>
                        <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-100">
                          <span className="text-[10.5px] font-bold text-slate-500">
                            {upcomingInterview?.target_date ? `Date: ${upcomingInterview.target_date}` : `${evaluatedCount} Evaluated`}
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-indigo-50 text-indigo-700 border border-indigo-100">
                            {upcomingInterview ? upcomingInterview.status || "Scheduled" : "Active"}
                          </span>
                        </div>
                      </div>
                    );
                  })()}

                  {/* 4. Fees & Dues Standing Tile */}
                  {(() => {
                    const unpaidAmt = feeData?.stats?.totalUnpaidAmount || feeData?.stats?.pendingAmount || 0;
                    const isClear = unpaidAmt === 0;

                    return (
                      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs relative flex flex-col justify-between group hover:shadow-md transition-all">
                        <div className="flex items-start justify-between">
                          <div className="space-y-1">
                            <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest block">Semester Fees</span>
                            <span className="text-xl font-black text-slate-900">
                              {isClear ? "All Dues Cleared" : `₹${unpaidAmt.toLocaleString("en-IN")}`}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setActiveTab("fees")}
                            className="p-2 bg-slate-50 border border-slate-200 text-slate-700 rounded-full shrink-0 shadow-2xs hover:bg-slate-100 cursor-pointer"
                            title="Open Fees"
                          >
                            <ArrowUpRight className="h-3.5 w-3.5 text-slate-600" />
                          </button>
                        </div>
                        <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-100">
                          <span className="text-[10.5px] font-bold text-slate-500">
                            {isClear ? "Receipts available" : "Pending installment"}
                          </span>
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${
                            isClear ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-rose-50 text-rose-700 border border-rose-200"
                          }`}>
                            {isClear ? "Clear" : "Unpaid"}
                          </span>
                        </div>
                      </div>
                    );
                  })()}

                </div>

                {/* Curriculum Tasks & Weekly Submissions */}
                <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-5">
                  <div className="flex items-center justify-between border-b border-slate-100/80 pb-4">
                    <div>
                      <h2 className="text-base font-extrabold text-slate-900 tracking-tight">Curriculum Tasks & Submissions</h2>
                      <p className="text-[11px] text-slate-400 font-semibold mt-0.5">Assigned weekly practicals, lab exercises, and term evaluations</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        window.location.href = "/student/tracker?category=skill";
                      }}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-slate-900 hover:bg-slate-800 text-white text-[10px] font-extrabold cursor-pointer shadow-xs transition-all hover:scale-105"
                    >
                      <span>Open Tracker</span>
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {/* Tasks List from DB / Context */}
                  <div className="space-y-3.5">
                    {dashboardCohortTasks.length > 0 ? (
                      dashboardCohortTasks.map((task) => {
                        const studentSub = (studentTracker || []).find(
                          (st) =>
                            st.student_id === currentStudent.id &&
                            st.week_number === task.week_number &&
                            st.subject.toLowerCase().trim() === task.subject.toLowerCase().trim()
                        );
                        const isGraded = typeof studentSub?.marks === "number";
                        const isSubmitted = !!studentSub?.submission_url;
                        const formattedDate = task.created_at ? parseDbDate(task.created_at).toLocaleDateString() : undefined;

                        return (
                          <div
                            key={task.id || `${task.subject}-${task.week_number}`}
                            className="flex items-center justify-between p-4 bg-slate-50/50 border border-slate-100 rounded-xl hover:bg-slate-50 hover:shadow-xs transition-all duration-200"
                          >
                            <div className="flex items-start gap-3.5 min-w-0">
                              <div className={`h-8 w-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 text-[10px] font-black uppercase ${
                                isGraded
                                  ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                                  : isSubmitted
                                  ? "bg-indigo-100 text-indigo-800 border border-indigo-200"
                                  : "bg-amber-100 text-amber-800 border border-amber-200"
                              }`}>
                                W{task.week_number}
                              </div>
                              <div className="min-w-0">
                                <span className="text-xs font-bold text-slate-800 block truncate leading-tight">
                                  {task.task_name}
                                </span>
                                <div className="flex items-center gap-2 mt-1">
                                  <span className="text-[9.5px] text-slate-400 font-extrabold uppercase tracking-wider">
                                    {task.subject}
                                  </span>
                                  {formattedDate && (
                                    <span className="text-[9.5px] text-slate-400 font-medium flex items-center gap-0.5">
                                      • Assigned: {formattedDate}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-3 shrink-0">
                              <span className={`px-2.5 py-1 rounded-full text-[9px] font-extrabold uppercase tracking-wider select-none ${
                                isGraded
                                  ? "bg-emerald-100 text-emerald-805 border border-emerald-200/50"
                                  : isSubmitted
                                  ? "bg-indigo-50 text-indigo-700 border border-indigo-200/50"
                                  : "bg-amber-50 text-amber-700 border border-amber-200/50"
                              }`}>
                                {isGraded ? `Score: ${studentSub.marks}/10` : isSubmitted ? "Submitted" : "Pending"}
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  window.location.href = `/student/tracker?category=skill&subject=${encodeURIComponent(task.subject)}&week=${task.week_number}`;
                                }}
                                className="p-1.5 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 hover:text-slate-900 cursor-pointer shadow-2xs transition-colors"
                                title="Go to submission"
                              >
                                <ArrowUpRight className="h-3.5 w-3.5 text-slate-500" />
                              </button>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="text-center py-8 px-4 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                        <FileText className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                        <p className="text-xs font-bold text-slate-700">No active weekly submissions</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">Assigned faculty tasks and lab practicals will appear here.</p>
                        <button
                          type="button"
                          onClick={() => {
                            window.location.href = "/student/tracker?category=skill";
                          }}
                          className="mt-3 px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 shadow-2xs cursor-pointer inline-flex items-center gap-1.5"
                        >
                          <span>View Skill Tracker</span>
                          <ArrowUpRight className="h-3 w-3" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

              </div>

              {/* Right Column (Col Span 1) */}
              <div className="lg:col-span-1 space-y-6">
              
              {/* Class Attendance Calendar Card with Dates & Ticks */}
              <div className="bg-white p-7 rounded-dribbble-panel border border-slate-100 shadow-xs space-y-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-extrabold text-slate-900 tracking-tight">Class attendance</h2>
                    <span className="text-[10px] text-slate-400 font-bold block mt-0.5">
                      {attendanceCalendarData.monthName}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setAttendanceMonthOffset(prev => prev - 1)}
                      className="p-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200/80 text-slate-600 cursor-pointer shadow-2xs transition-colors"
                      title="Previous Month"
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setAttendanceMonthOffset(0)}
                      className={`px-2 py-1 text-[9px] font-black rounded-lg border transition-all cursor-pointer ${
                        attendanceMonthOffset === 0
                          ? "bg-slate-900 text-white border-slate-900"
                          : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      Current
                    </button>
                    <button
                      type="button"
                      onClick={() => setAttendanceMonthOffset(prev => prev + 1)}
                      className="p-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200/80 text-slate-600 cursor-pointer shadow-2xs transition-colors"
                      title="Next Month"
                    >
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  {/* Calendar 7-Day Header */}
                  <div className="grid grid-cols-7 text-center text-[9px] font-black text-slate-400 uppercase tracking-wider">
                    <span>Mon</span>
                    <span>Tue</span>
                    <span>Wed</span>
                    <span>Thu</span>
                    <span>Fri</span>
                    <span>Sat</span>
                    <span>Sun</span>
                  </div>

                  {/* Calendar Date Grid */}
                  <div className="grid grid-cols-7 gap-1.5">
                    {attendanceCalendarData.days.map((item) => {
                      if (item.type === "pad") {
                        return <div key={item.key} className="h-9 w-full" />;
                      }

                      const dayNum = item.day;
                      const status = item.status;
                      const dateStr = item.dateStr || "";

                      if (status === "present") {
                        return (
                          <div
                            key={item.key}
                            className="h-9 rounded-xl flex flex-col items-center justify-center bg-emerald-50 border border-emerald-200 text-emerald-800 transition-all hover:scale-105 shadow-2xs cursor-default relative group"
                            title={`Date: ${dateStr} - Present (Attended)`}
                          >
                            <span className="text-[9px] font-black leading-none">{dayNum}</span>
                            <Check className="h-3 w-3 text-emerald-600 stroke-[3] mt-0.5" />
                          </div>
                        );
                      }

                      if (status === "absent") {
                        return (
                          <div
                            key={item.key}
                            className="h-9 rounded-xl flex flex-col items-center justify-center bg-rose-50 border border-rose-200 text-rose-800 transition-all hover:scale-105 shadow-2xs cursor-default relative group"
                            title={`Date: ${dateStr} - Absent`}
                          >
                            <span className="text-[9px] font-black leading-none">{dayNum}</span>
                            <X className="h-3 w-3 text-rose-600 stroke-[3] mt-0.5" />
                          </div>
                        );
                      }

                      if (status === "holiday") {
                        return (
                          <div
                            key={item.key}
                            className="h-9 rounded-xl flex flex-col items-center justify-center bg-rose-50/40 border border-dashed border-rose-200/80 text-rose-600 cursor-default"
                            title={`Date: ${dateStr} - Holiday (${item.dayConfig?.notes || "College Holiday"})`}
                          >
                            <span className="text-[9px] font-black leading-none">{dayNum}</span>
                            <span className="text-[7.5px] font-black text-rose-500 mt-0.5 uppercase">H</span>
                          </div>
                        );
                      }

                      if (status === "event") {
                        return (
                          <div
                            key={item.key}
                            className="h-9 rounded-xl flex flex-col items-center justify-center bg-amber-50/60 border border-amber-200 text-amber-700 cursor-default"
                            title={`Date: ${dateStr} - Campus Event (${item.dayConfig?.notes || "Activity"})`}
                          >
                            <span className="text-[9px] font-black leading-none">{dayNum}</span>
                            <span className="text-[7.5px] font-black text-amber-600 mt-0.5 uppercase">E</span>
                          </div>
                        );
                      }

                      if (status === "exam") {
                        return (
                          <div
                            key={item.key}
                            className="h-9 rounded-xl flex flex-col items-center justify-center bg-purple-50/60 border border-purple-200 text-purple-700 cursor-default"
                            title={`Date: ${dateStr} - Exam Day (${item.dayConfig?.notes || "Assessment"})`}
                          >
                            <span className="text-[9px] font-black leading-none">{dayNum}</span>
                            <span className="text-[7.5px] font-black text-purple-600 mt-0.5 uppercase">Ex</span>
                          </div>
                        );
                      }

                      return (
                        <div
                          key={item.key}
                          className="h-9 rounded-xl flex items-center justify-center border border-slate-100 bg-slate-50/40 text-slate-400 text-[10px] font-bold"
                          title={`Date: ${dateStr}`}
                        >
                          {dayNum}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Calendar Legend & Stats Bar */}
                <div className="space-y-2 border-t border-slate-150/70 pt-3">
                  <div className="flex items-center justify-between text-[10px] font-extrabold uppercase text-slate-500">
                    <div className="flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
                      <span>Present: <strong className="text-slate-800">{attendanceCalendarData.monthPresentDays}</strong></span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-rose-500 shrink-0" />
                      <span>Absent: <strong className="text-slate-800">{attendanceCalendarData.monthAbsentDays}</strong></span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200/60">
                        {attendanceCalendarData.monthPercentage}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* My Schedule Card */}
              <div className="bg-white p-7 rounded-dribbble-panel border border-slate-100 shadow-xs space-y-5">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-extrabold text-slate-900 tracking-tight">My schedule</h2>
                  <span className="px-2 py-0.5 bg-slate-50 border border-slate-100 rounded-lg text-[9px] font-black text-slate-500 uppercase tracking-widest">
                    Today
                  </span>
                </div>

                <div className="space-y-4">
                  {/* Today's Scheduled Interview Banner if any */}
                  {(() => {
                    const todayStr = new Date().toISOString().slice(0, 10);
                    const todayInterview = studentInterviews.find(inv => inv.target_date === todayStr);
                    if (!todayInterview) return null;

                    const mySlot = (todayInterview.student_slots || []).find((s: any) => 
                      s.student_id === currentStudent?.id || s.roll_number === currentStudent?.roll_number
                    );
                    const meetLink = mySlot?.gmeet_link || todayInterview.gmeet_link;
                    const evaluator = mySlot?.mentor_name || todayInterview.mentor_name || "Faculty Evaluator";
                    const timing = mySlot?.slot_start_time || todayInterview.preferred_start_time || "8:20 AM - 8:35 AM";

                    return (
                      <div className="p-4 bg-purple-50/80 border border-purple-200 rounded-xl flex items-center justify-between gap-4 shadow-xs">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="h-8.5 w-8.5 rounded-full bg-purple-100 border border-purple-250 flex items-center justify-center font-bold text-purple-700 text-xs shrink-0 select-none">
                            I
                          </div>
                          <div className="min-w-0">
                            <span className="text-xs font-black text-purple-950 block truncate">{todayInterview.subject}</span>
                            <span className="text-[10px] text-purple-700 block truncate font-semibold mt-0.5">
                              Evaluator: {evaluator} • {timing}
                            </span>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          {meetLink ? (
                            <a
                              href={meetLink}
                              target="_blank"
                              rel="noreferrer"
                              className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[9.5px] font-black inline-flex items-center gap-1 shadow-2xs"
                            >
                              <Video className="w-3 h-3" /> Join Room
                            </a>
                          ) : (
                            <span className="inline-block px-2 py-0.5 bg-purple-100 text-purple-800 rounded text-[9px] font-bold">
                              Scheduled
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })()}

                  {myClassSlots.slice(0, 3).map((slot, index) => {
                    const mentor = mentors.find(m => m.id === slot.mentorId);
                    const teacherName = mentor?.name || (slot.department ? `${slot.department} Faculty` : "Faculty Instructor");
                    const initial = teacherName.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase() || "FA";
                    
                    return (
                      <div key={slot.id || index} className="p-4 bg-slate-50/50 border border-slate-100 rounded-xl flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="h-8.5 w-8.5 rounded-full bg-indigo-50 border border-slate-150 flex items-center justify-center font-bold text-indigo-650 text-xs shrink-0 select-none">
                            {initial}
                          </div>
                          <div className="min-w-0">
                            <span className="text-xs font-bold text-slate-800 block truncate">{slot.course || "Scheduled Period"}</span>
                            <span className="text-[10px] text-slate-455 block truncate font-semibold mt-0.5">{teacherName}</span>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-[9.5px] font-extrabold text-slate-500 block">{slot.time.split(" - ")[0]}</span>
                          <span className="inline-block px-2 py-0.5 bg-slate-100 border border-slate-200/50 rounded-lg text-[8.5px] font-extrabold text-slate-600 mt-1 font-mono uppercase">
                            {slot.location || "Classroom"}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                  {myClassSlots.length === 0 && !studentInterviews.some(inv => inv.target_date === new Date().toISOString().slice(0, 10)) && (
                    <div className="text-center py-6 text-slate-400 text-xs italic font-semibold">
                      No classes scheduled for today.
                    </div>
                  )}
                </div>
            </div>

            </div>

          </div>
        )}


        {/* Tab 2: e-Campus Timetable */}
        {activeTab === "schedule" && (
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-150 pb-3">
              <div>
                <h2 className="text-xs font-bold text-slate-550 uppercase tracking-wider">Weekly Class Timetable</h2>
                <p className="text-[11px] text-slate-450 mt-1">Displays scheduled courses and period attendance status for the selected week.</p>
              </div>
              
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200/60 shadow-inner shrink-0">
                <button
                  type="button"
                  onClick={() => setWeekOffset(weekOffset - 1)}
                  className="p-1 hover:bg-white rounded-lg text-slate-650 hover:text-indigo-650 transition-all cursor-pointer"
                  title="Previous Week"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>
                <span className="text-[10px] font-bold text-slate-755 px-2 min-w-[130px] text-center select-none font-sans">
                  {weekOffset === 0 ? "Current Week" : `${weekDates[0]?.formatted} – ${weekDates[weekDates.length - 1]?.formatted}`}
                </span>
                <button
                  type="button"
                  onClick={() => setWeekOffset(weekOffset + 1)}
                  className="p-1 hover:bg-white rounded-lg text-slate-650 hover:text-indigo-650 transition-all cursor-pointer"
                  title="Next Week"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            <div className="overflow-auto max-h-[70vh] rounded-xl border border-slate-200 shadow-sm relative no-scrollbar">
              <table className="w-full table-fixed border-collapse text-left min-w-[800px]">
                <thead>
                  <tr className="text-xs text-slate-550 dark:text-slate-300 font-bold uppercase">
                    <th className="sticky top-0 left-0 z-30 p-4 w-[12%] text-slate-700 dark:text-slate-200 bg-slate-100/95 dark:bg-[#141419] backdrop-blur-xs border-r border-b border-slate-200 dark:border-white/5">Day / Date</th>
                    {(() => {
                      let slotCounter = 0;
                      return rows.map((col, idx) => {
                        if (col.type === "break" || col.type === "lunch") {
                          return (
                            <th key={idx} className="sticky top-0 z-20 p-4 text-xs font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider text-center select-none bg-slate-55/95 dark:bg-[#0f0f14] backdrop-blur-xs border-b border-slate-200 dark:border-white/5 w-[8%]">
                              <div>{col.label}</div>
                              <div className="text-[9px] text-slate-450 dark:text-slate-400 font-normal mt-0.5">{formatTimeLabel(col.timeRange)}</div>
                            </th>
                          );
                        }
                        if (col.type === "slot") {
                          slotCounter++;
                          return (
                            <th key={col.time} className="sticky top-0 z-20 p-4 text-xs font-bold text-slate-700 dark:text-slate-200 bg-slate-55/95 dark:bg-[#141419] backdrop-blur-xs border-b border-slate-200 dark:border-white/5 w-[12%]">
                              <div>Period {slotCounter}</div>
                              <div className="text-[10px] text-slate-400 dark:text-slate-400 font-normal mt-0.5">{formatTimeLabel(col.time)}</div>
                            </th>
                          );
                        }
                        return null;
                      });
                    })()}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-150 dark:divide-white/5 bg-white dark:bg-[#101015]">
                  {weekDates.map((date) => {
                    const dayConfig = dailyConfigsList.find((c: any) => c.dateStr === date.dateStr);
                    const isHighlighted = highlightedDate === date.dateStr;

                    return (
                      <tr 
                        key={date.day} 
                        id={`date-row-${date.dateStr}`}
                        className={`h-24 transition-all duration-500 ${
                          isHighlighted 
                            ? "bg-indigo-50/80 dark:bg-indigo-950/40 ring-2 ring-indigo-500 ring-inset shadow-md" 
                            : "hover:bg-slate-55/10 dark:hover:bg-white/[0.02]"
                        }`}
                      >
                        {/* First Cell: Day / Date */}
                        <td className="sticky left-0 z-10 p-3 text-xs font-bold text-slate-705 border-r border-slate-200 bg-slate-50/95 dark:bg-[#141419] dark:border-white/5 backdrop-blur-xs align-middle">
                          <div className="flex flex-col justify-center items-center">
                            <span className="text-sm font-black text-slate-900 leading-none">{date.day}</span>
                            <span className="text-[9px] text-slate-400 font-extrabold uppercase mt-1 leading-none">{date.formatted}</span>
                            {dayConfig?.day_type === "holiday" && (
                              <span className="mt-1.5 px-1.5 py-0.5 rounded-full text-[7.5px] font-black uppercase bg-rose-100 text-rose-700 border border-rose-200 shrink-0" title={dayConfig.notes || "Holiday"}>
                                Holiday
                              </span>
                            )}
                            {dayConfig?.day_type === "event" && (
                              <span className="mt-1.5 px-1.5 py-0.5 rounded-full text-[7.5px] font-black uppercase bg-amber-100 text-amber-700 border border-amber-200 shrink-0" title={dayConfig.notes || "Campus Event"}>
                                Event
                              </span>
                            )}
                            {(dayConfig?.day_type === "exam_day" || dayConfig?.day_type === "exam") && (
                              <span className="mt-1.5 px-1.5 py-0.5 rounded-full text-[7.5px] font-black uppercase bg-purple-100 text-purple-700 border border-purple-200 shrink-0" title={dayConfig.notes || "Exam Day"}>
                                Exam Day
                              </span>
                            )}
                            {dayConfig?.day_order && dayConfig.day_order !== "None" && dayConfig.day_type !== "holiday" && (
                              <span className="mt-1.5 px-1.5 py-0.5 rounded-full text-[7.5px] font-black uppercase bg-indigo-50 text-indigo-700 border border-indigo-200 shrink-0">
                                {dayConfig.day_order}
                              </span>
                            )}
                            {studentInterviews.some((inv: any) => inv.target_date === date.dateStr) && (
                              <span className="mt-1 px-1.5 py-0.5 rounded-full text-[7.5px] font-black uppercase bg-purple-100 text-purple-700 border border-purple-200 shrink-0">
                                Interview
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Columns */}
                        {rows.map((col, cIdx) => {
                          if (col.type === "break" || col.type === "lunch") {
                            return (
                              <td 
                                key={`break-${cIdx}`} 
                                className="p-2 text-center text-xs font-extrabold text-slate-455 bg-slate-50/5 uppercase tracking-widest italic select-none border-r border-slate-150 last:border-r-0 align-middle"
                              >
                                {col.label}
                              </td>
                            );
                          }

                          if (col.type !== "slot") return null;
                          const time = col.time;
                          const cellData = getAttendanceForCell(date.day, date.dateStr, time);

                          // Check for student's scheduled interview session on this date & period
                          const interviewForSlot = studentInterviews?.find((inv: any) => {
                            if (inv.target_date !== date.dateStr) return false;
                            const prefTime = inv.preferred_start_time || "08:20 AM - 09:10 AM";
                            const slotTimeNorm = time.replace(/\s+/g, "").toLowerCase();
                            const prefTimeNorm = prefTime.replace(/\s+/g, "").toLowerCase();
                            if (slotTimeNorm.includes(prefTimeNorm) || prefTimeNorm.includes(slotTimeNorm)) return true;
                            
                            // Check student slots
                            if (inv.student_slots && inv.student_slots.some((s: any) => 
                              (s.student_id === currentStudent?.id || s.roll_number === currentStudent?.roll_number) && 
                              (s.slot_start_time?.includes(time) || time.includes(s.slot_start_time))
                            )) return true;

                            // Match by start hour
                            const startHourMin = prefTime.split("-")[0].trim().toLowerCase().replace(".", ":");
                            const cellStartHourMin = time.split("-")[0].trim().toLowerCase().replace(".", ":");
                            if (startHourMin && cellStartHourMin && (startHourMin.includes(cellStartHourMin) || cellStartHourMin.includes(startHourMin))) return true;

                            // If assigned and Period 1:
                            if ((time.startsWith("8.20") || time.startsWith("08:20") || time.startsWith("9.00") || time.startsWith("09:00")) && (inv.status === "assigned" || inv.status === "completed" || inv.status === "pending_verification")) return true;

                            return false;
                          });

                          if (interviewForSlot) {
                            const isCompleted = interviewForSlot.status === "completed";
                            const mySlot = (interviewForSlot.student_slots || []).find((s: any) => 
                              s.student_id === currentStudent?.id || s.roll_number === currentStudent?.roll_number
                            );
                            const meetLink = mySlot?.gmeet_link || interviewForSlot.gmeet_link;
                            const evaluatorName = mySlot?.mentor_name || interviewForSlot.mentor_name || "Faculty Evaluator";
                            const slotTiming = mySlot?.slot_start_time || interviewForSlot.preferred_start_time || "8:20 AM - 8:35 AM";

                            return (
                              <td key={time} className="p-1.5 h-24 border-r border-slate-150 dark:border-white/5 last:border-r-0 align-top bg-white dark:bg-[#101015]">
                                <div className={`h-full flex flex-col justify-between p-2 rounded-xl border text-xs shadow-xs transition-all ${
                                  isCompleted
                                    ? "bg-emerald-50/80 border-emerald-300 text-emerald-950"
                                    : "bg-purple-50/80 border-purple-300 text-purple-950 hover:shadow-sm"
                                }`}>
                                  <div>
                                    <div className="flex flex-wrap items-center gap-1 mb-1 max-w-full">
                                      <span className="px-1.5 py-0.5 rounded bg-purple-200/80 border border-purple-300 text-[7.5px] font-black text-purple-800 uppercase tracking-wide">
                                        INTERVIEW ({interviewForSlot.type?.toUpperCase() || "EXTERNAL"})
                                      </span>
                                    </div>
                                    <div className="font-extrabold text-[10px] leading-tight mb-1 text-purple-950 line-clamp-1" title={interviewForSlot.subject}>
                                      {interviewForSlot.subject}
                                    </div>
                                    <div className="text-[8px] text-purple-700 font-semibold truncate leading-none">
                                      Evaluator: {evaluatorName}
                                    </div>
                                  </div>

                                  <div className="flex items-center justify-between text-[8px] mt-1 pt-1.5 border-t border-purple-200/60 font-black uppercase">
                                    {meetLink ? (
                                      <a
                                        href={meetLink}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="text-indigo-600 hover:underline inline-flex items-center gap-0.5 font-bold"
                                      >
                                        <Video className="w-2.5 h-2.5" /> GMeet
                                      </a>
                                    ) : (
                                      <span className="text-purple-600 font-mono">{slotTiming}</span>
                                    )}
                                    <span className={`px-1.5 py-0.5 rounded text-[7.5px] ${
                                      isCompleted
                                        ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                                        : "bg-purple-100 text-purple-800 border border-purple-300"
                                    }`}>
                                      {isCompleted ? "Evaluated" : "Scheduled"}
                                    </span>
                                  </div>
                                </div>
                              </td>
                            );
                          }

                          if (cellData?.type === "holiday") {
                            return (
                              <td key={time} className="p-1.5 h-24 border-r border-slate-150 dark:border-white/5 last:border-r-0 align-middle bg-rose-50/10 dark:bg-rose-950/5">
                                <div className="h-full flex flex-col items-center justify-center p-2 rounded-xl border border-dashed border-rose-200 dark:border-rose-900/40 bg-rose-50/50 dark:bg-rose-950/20 text-center">
                                  <span className="text-[8.5px] font-black uppercase text-rose-700 dark:text-rose-400">College Holiday</span>
                                  <span className="text-[8px] text-rose-500 font-medium truncate max-w-full mt-0.5">{cellData.config?.notes || "No Classes Scheduled"}</span>
                                </div>
                              </td>
                            );
                          }

                          if (cellData?.type === "event") {
                            return (
                              <td key={time} className="p-1.5 h-24 border-r border-slate-150 dark:border-white/5 last:border-r-0 align-top bg-amber-50/15 dark:bg-amber-950/5">
                                <div className="h-full flex flex-col justify-between p-2 rounded-xl border border-amber-200 dark:border-amber-900/40 bg-amber-50/60 dark:bg-amber-950/20 shadow-xs">
                                  <div>
                                    <span className="px-1.5 py-0.5 rounded bg-amber-200/80 border border-amber-300 text-[7.5px] font-black text-amber-800 uppercase tracking-wide">
                                      CAMPUS EVENT
                                    </span>
                                    <div className="text-[9.5px] font-bold text-amber-950 dark:text-amber-200 mt-1 line-clamp-1">
                                      {cellData.config?.notes || "Campus Activity"}
                                    </div>
                                  </div>
                                  <div className="flex items-center justify-between text-[8px] mt-1 pt-1 border-t border-amber-200/60 font-black uppercase">
                                    <span className="text-amber-700">Event Session</span>
                                    {cellData.attendance ? (
                                      <span className={`px-1.5 py-0.5 rounded ${
                                        cellData.attendance.status === "present"
                                          ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                                          : "bg-rose-100 text-rose-800 border border-rose-300"
                                      }`}>
                                        {cellData.attendance.status}
                                      </span>
                                    ) : (
                                      <span className="text-amber-600/70 italic">Unmarked</span>
                                    )}
                                  </div>
                                </div>
                              </td>
                            );
                          }

                          if (cellData?.type === "exam") {
                            const examInfo = cellData.exam;
                            return (
                              <td key={time} className="p-1.5 h-24 border-r border-slate-150 dark:border-white/5 last:border-r-0 align-top bg-purple-50/20 dark:bg-purple-950/10">
                                <div className="h-full flex flex-col justify-between p-2 rounded-xl border border-purple-300 dark:border-purple-800/60 bg-purple-50/70 dark:bg-purple-950/30 shadow-xs">
                                  <div>
                                    <div className="flex items-center justify-between gap-1 mb-1">
                                      <span className="px-1.5 py-0.5 rounded bg-purple-600 text-[7.5px] font-black text-white uppercase tracking-wider">
                                        📝 {examInfo?.exam_type || "EXAMINATION"}
                                      </span>
                                      {examInfo?.hall_room && (
                                        <span className="text-[7.5px] font-bold text-purple-700 dark:text-purple-300 truncate max-w-[80px]">
                                          📍 {examInfo.hall_room}
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-[10px] font-extrabold text-purple-950 dark:text-purple-100 line-clamp-1 leading-tight">
                                      {examInfo?.subject_name || cellData.config?.notes || "Assessment Session"}
                                    </div>
                                  </div>
                                  <div className="flex items-center justify-between text-[8px] mt-1 pt-1 border-t border-purple-200/60 dark:border-purple-800/40 font-black uppercase">
                                    <span className="text-purple-700 dark:text-purple-300 font-mono">
                                      {examInfo?.session_time || formatTimeLabel(time)}
                                    </span>
                                    {cellData.attendance ? (
                                      <span className={`px-1.5 py-0.5 rounded text-[7.5px] ${
                                        cellData.attendance.status === "present"
                                          ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                                          : "bg-rose-100 text-rose-800 border border-rose-300"
                                      }`}>
                                        {cellData.attendance.status}
                                      </span>
                                    ) : (
                                      <span className="text-purple-600/70 italic text-[7.5px]">Exam Mode</span>
                                    )}
                                  </div>
                                </div>
                              </td>
                            );
                          }

                          return (
                            <td key={time} className="p-1.5 h-24 border-r border-slate-150 dark:border-white/5 last:border-r-0 align-top bg-white dark:bg-[#101015]">
                              {!cellData || !cellData.slot ? (
                                <div className="h-full flex items-center justify-center text-[9px] text-slate-400 italic border border-dashed border-slate-150 rounded-xl bg-slate-55/30">
                                  Free Period
                                </div>
                              ) : (
                                <div className="h-full flex flex-col justify-between p-2 rounded-xl border border-slate-200 dark:border-white/8 bg-slate-50/20 dark:bg-[#1c1c26] shadow-sm relative overflow-hidden">
                                  <div className="space-y-1">
                                    <div className="text-[9px] font-extrabold text-indigo-650 truncate" title={cellData.handover?.course || cellData.slot.course}>
                                      {cellData.handover?.course || cellData.slot.course}
                                    </div>
                                    <div className="text-[8px] text-slate-450 dark:text-slate-300 font-bold truncate">
                                      {cellData.handover ? (
                                        <span className="text-slate-700 font-extrabold">{cellData.handover.coverStaffName}</span>
                                      ) : (
                                        mentors.find((m) => m.id === cellData.slot.mentorId)?.name || "Faculty"
                                      )}
                                    </div>
                                  </div>

                                  <div className="flex justify-between items-center text-[8.5px] mt-2 border-t border-slate-100 pt-1.5">
                                    <span className="flex items-center gap-0.5 text-slate-500 dark:text-slate-300 font-semibold bg-white dark:bg-[#1c1c26] border border-slate-200 dark:border-white/10 px-1 rounded">
                                      <MapPin className="h-2 w-2 shrink-0" />
                                      {cellData.slot.location ? cellData.slot.location.split(" ")[0] : "Class"}
                                    </span>

                                    {cellData.attendance ? (
                                      <span
                                        className={`px-1 py-0.5 rounded text-[8px] font-black uppercase ${
                                          cellData.attendance.status === "present"
                                            ? "bg-emerald-50 border border-emerald-200 text-emerald-700"
                                            : "bg-rose-50 border border-rose-200 text-rose-700"
                                        }`}
                                      >
                                        {cellData.attendance.status}
                                      </span>
                                    ) : (
                                      <span className="text-[8px] text-slate-400 dark:text-slate-300 italic">Unmarked</span>
                                    )}
                                  </div>
                                </div>
                              )}
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



        {/* Tab: My Interviews & Evaluation Marks */}
        {activeTab === "interviews" && (
          <div className="space-y-6 font-sans">
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <h2 className="text-base font-black text-slate-900">My Interview Sessions &amp; Evaluation Marks</h2>
                  <p className="text-xs text-slate-450 font-medium mt-0.5">
                    View scheduled interview dates, evaluator ratings (Communication, Technical, Content, Confidence), questions asked, and clearance status.
                  </p>
                </div>
              </div>

              {(() => {
                const myCohortInterviews = (interviews || []).filter((inv: any) =>
                  inv.status !== "cancelled" && inv.status !== "declined" && (
                    (inv.class_group && inv.class_group.toLowerCase().trim() === currentStudent.classGroup?.toLowerCase().trim()) ||
                    (inv.student_slots && inv.student_slots.some((s: any) => s.student_id === currentStudent.id)) ||
                    inv.student_id === currentStudent.id
                  )
                );

                if (myCohortInterviews.length === 0) {
                  return (
                    <div className="text-center py-12 border border-slate-100 rounded-xl bg-slate-50/50">
                      <Award className="h-8 w-8 text-slate-350 mx-auto mb-2" />
                      <p className="text-xs font-bold text-slate-700">No Interview Sessions Scheduled</p>
                      <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Your cohort has no active interview allocations scheduled at this time.</p>
                    </div>
                  );
                }

                return (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {myCohortInterviews.map((inv: any) => {
                      const mySlot = (inv.student_slots || []).find(
                        (s: any) => s.student_id === currentStudent.id
                      );
                      const myEval = (interviewEvaluations || []).find(
                        (e: any) => e.interview_id === inv.id && e.student_id === currentStudent.id
                      );

                      const isAllocated = Boolean(mySlot) || (!inv.student_slots?.length && inv.status === "assigned");
                      const assignedTime = mySlot ? `${mySlot.slot_start_time} - ${mySlot.slot_end_time}` : (inv.preferred_start_time || "09:00 AM");
                      const assignedMentor = mySlot?.mentor_name || inv.mentor_name || "Assigned Faculty Evaluator";
                      const meetLink = mySlot?.gmeet_link || inv.gmeet_link;
                      const isVerified = inv.status === "completed";

                      return (
                        <div key={inv.id} className="p-5 rounded-xl border border-slate-200 bg-slate-50/30 space-y-3.5 shadow-xs">
                          <div className="flex items-center justify-between flex-wrap gap-2">
                            <span className="text-[9px] font-black uppercase px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                              {(inv.type || "internal").toUpperCase()} INTERVIEW
                            </span>
                            <span className="text-[10px] font-bold text-slate-500 bg-white px-2.5 py-0.5 rounded-lg border border-slate-200">
                              Target Date: {inv.target_date}
                            </span>
                          </div>

                          <div>
                            <h3 className="font-extrabold text-sm text-slate-900">{inv.subject}</h3>
                            <p className="text-[11px] text-slate-500 font-medium mt-0.5">Topics: {inv.topics || "General Technical & Viva Review"}</p>
                          </div>

                          {/* Allocation & Time Slot Window */}
                          {isAllocated ? (
                            <div className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-2">
                              <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                                <span className="flex items-center gap-1.5 text-indigo-700">
                                  <Clock className="w-3.5 h-3.5" /> Assigned Time: {assignedTime}
                                </span>
                                <span className="text-[10px] text-slate-500">
                                  Evaluator: <strong className="text-slate-800">{assignedMentor}</strong>
                                </span>
                              </div>

                              {meetLink && (
                                <div className="pt-1 flex items-center justify-between">
                                  <span className="text-[10px] font-semibold text-slate-400">Virtual Meeting Room:</span>
                                  <a
                                    href={meetLink}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1 bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-black px-3 py-1.5 rounded-lg transition-all shadow-2xs"
                                  >
                                    <Sparkles className="w-3.5 h-3.5" /> Join Live Google Meet
                                  </a>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-xl text-center text-[11px] font-semibold text-amber-800">
                              You are unallocated in this current batch (Capacity limited to {inv.allocated_students || inv.student_count || 10} students). You will be scheduled in the next upcoming cycle.
                            </div>
                          )}

                          {/* Evaluation Status & Multi-criteria Scores */}
                          {myEval ? (
                            <div className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-2.5">
                              <div className="flex items-center justify-between">
                                <span className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full ${
                                  myEval.status === "Cleared" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" :
                                  myEval.status === "Needs Improvement" ? "bg-amber-50 text-amber-700 border border-amber-200" :
                                  "bg-rose-50 text-rose-700 border border-rose-200"
                                }`}>
                                  {isVerified ? `✓ Conducted & Verified — ${myEval.status}` : `Conducted — Pending CAM Verification`}
                                </span>
                                <span className="text-xs font-black text-indigo-700">Total Score: {myEval.total_score || 0}/100</span>
                              </div>

                              <div className="grid grid-cols-4 gap-2 text-center text-[10px] bg-slate-50 p-2 rounded-lg font-bold border border-slate-100">
                                <div><span className="text-slate-400 block text-[8px]">COMM.</span>{myEval.communication_score}</div>
                                <div><span className="text-slate-400 block text-[8px]">CONTENT</span>{myEval.content_score}</div>
                                <div><span className="text-slate-400 block text-[8px]">TECH</span>{myEval.technical_score}</div>
                                <div><span className="text-slate-400 block text-[8px]">CONF.</span>{myEval.confidence_score}</div>
                              </div>

                              {myEval.questions_asked && (
                                <div className="text-[10.5px] text-slate-600">
                                  <strong>Questions Asked:</strong> &ldquo;{myEval.questions_asked}&rdquo;
                                </div>
                              )}
                              {myEval.remarks && (
                                <div className="text-[10.5px] text-indigo-700 italic">
                                  <strong>Evaluator Remarks:</strong> &ldquo;{myEval.remarks}&rdquo;
                                </div>
                              )}
                            </div>
                          ) : isAllocated ? (
                            <div className="p-3 bg-indigo-50/60 border border-indigo-150 rounded-xl text-center text-[11px] font-bold text-indigo-800">
                              ⏳ Scheduled & Ready — Awaiting Evaluation by {assignedMentor}
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {/* Tab 4: Leave & OD Applications */}
        {activeTab === "leave" && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Submission Form */}
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
              <h2 className="text-xs font-bold text-slate-550 uppercase tracking-wider">Apply for Leave / OD</h2>
              
              <form onSubmit={handleLeaveSubmit} className="space-y-3.5">
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">Request Type</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setLeaveType("leave")}
                      className={`py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                        leaveType === "leave"
                          ? "bg-slate-100 border-indigo-200 text-indigo-700 font-extrabold"
                          : "bg-white border-slate-200 text-slate-500 hover:text-slate-700"
                      }`}
                    >
                      Medical / Sick
                    </button>
                    <button
                      type="button"
                      onClick={() => setLeaveType("od")}
                      className={`py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                        leaveType === "od"
                          ? "bg-slate-100 border-indigo-200 text-indigo-700 font-extrabold"
                          : "bg-white border-slate-200 text-slate-500 hover:text-slate-700"
                      }`}
                    >
                      On-Duty (OD)
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">Target Date</label>
                  <input
                    type="date"
                    required
                    value={leaveDate}
                    onChange={(e) => setLeaveDate(e.target.value)}
                    className="w-full p-2 text-xs border border-slate-200 rounded-xl bg-slate-50 focus:bg-white outline-none focus:ring-1 focus:ring-indigo-500 font-bold"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">Reason / Explanation</label>
                  <textarea
                    required
                    rows={3}
                    placeholder="Enter reason for leave/OD request..."
                    value={leaveReason}
                    onChange={(e) => setLeaveReason(e.target.value)}
                    className="w-full p-2.5 text-xs border border-slate-200 rounded-xl bg-slate-50 focus:bg-white outline-none focus:ring-1 focus:ring-indigo-500 leading-normal"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submittingLeave}
                  className="w-full py-2 btn-gradient text-white rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 shadow-sm transition-all hover:scale-[1.01] cursor-pointer disabled:opacity-75 disabled:cursor-not-allowed"
                >
                  {submittingLeave ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin shrink-0 text-white" />
                      <span>Submitting...</span>
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4" />
                      <span>Submit Request</span>
                    </>
                  )}
                </button>
              </form>
            </div>

            {/* Applications History log */}
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4 md:col-span-2">
              <h2 className="text-xs font-bold text-slate-550 uppercase tracking-wider">Leave & OD Requests History</h2>
              
              {myLeaveRequests.length === 0 ? (
                <div className="text-center py-12 text-slate-400 italic text-xs">
                  No submitted leave or OD applications found.
                </div>
              ) : (() => {
                const paginatedLeaveRequests = myLeaveRequests.slice((leavePage - 1) * leavePageSize, leavePage * leavePageSize);
                return (
                  <div className="overflow-x-auto rounded-xl border border-slate-150 scroll-touch">
                    <table className="w-full border-collapse text-left text-xs min-w-[600px]">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-550 font-bold uppercase text-[9px] whitespace-nowrap">
                          <th className="p-3">Date</th>
                          <th className="p-3">Type</th>
                          <th className="p-3">Reason</th>
                          <th className="p-3">Status</th>
                          <th className="p-3">Action By</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-150 bg-white font-medium">
                        {paginatedLeaveRequests.map((req) => (
                          <tr key={req.id} className="hover:bg-slate-50/30 transition-colors">
                            <td className="p-3 text-slate-700">{req.dateStr}</td>
                            <td className="p-3">
                              <span className={`px-2 py-0.5 rounded text-[8.5px] font-black uppercase ${
                                req.type === "od" ? "bg-sky-50 text-sky-700 border border-sky-200" : "bg-indigo-50 text-indigo-700 border border-indigo-200"
                              }`}>
                                {req.type === "od" ? "On-Duty" : "Leave"}
                              </span>
                            </td>
                            <td className="p-3 text-slate-650 max-w-[200px] truncate" title={req.reason}>
                              {req.reason}
                            </td>
                            <td className="p-3">
                              <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase ${
                                req.status === "approved"
                                  ? "bg-emerald-50 border border-emerald-200 text-emerald-700"
                                  : req.status === "rejected"
                                  ? "bg-rose-50 border border-rose-200 text-rose-700"
                                  : "bg-amber-50 border border-amber-200 text-amber-700"
                              }`}>
                                {req.status}
                              </span>
                            </td>
                            <td className="p-3 text-slate-450 font-mono text-[9px]">{req.approvedBy || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <Pagination
                      currentPage={leavePage}
                      totalItems={myLeaveRequests.length}
                      pageSize={leavePageSize}
                      onPageChange={setLeavePage}
                      onPageSizeChange={setLeavePageSize}
                    />
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {/* Tab 5: Exams, Tickets & Assessment Scorecards */}
        {activeTab === "exams" && (() => {
          const displayExams = studentExamsList || [];
          const displayMarks = studentMarksList || [];

          // Compute summary stats for student results
          let totalMarks = 0;
          let totalMaxMarks = 0;
          let passedCount = 0;
          let arrearsCount = 0;
          let absentCount = 0;

          displayMarks.forEach((m: any) => {
            if (m.is_absent) {
              absentCount++;
              arrearsCount++;
            } else if (m.marks_obtained !== null && m.marks_obtained !== undefined) {
              totalMarks += parseFloat(m.marks_obtained);
              totalMaxMarks += parseFloat(m.max_marks || 50);
              const passM = parseFloat(m.passing_marks || (m.max_marks * 0.4) || 20);
              if (parseFloat(m.marks_obtained) >= passM) passedCount++;
              else arrearsCount++;
            }
          });

          const overallPct = totalMaxMarks > 0 ? ((totalMarks / totalMaxMarks) * 100).toFixed(1) : "—";

          return (
            <div className="space-y-5 font-sans">
              {/* Header Navigation & Sub-Tabs */}
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-150 pb-3.5">
                  <div className="flex items-center gap-2.5">
                    <div className="h-9 w-9 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-650">
                      <BookOpen className="h-5 w-5" />
                    </div>
                    <div>
                      <h2 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                        Assessments & Exam Hub
                        <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 text-[9px] font-black uppercase">
                          {currentStudent?.department || "Department"}
                        </span>
                      </h2>
                      <p className="text-[11px] text-slate-450 mt-0.5">
                        Track upcoming schedules, download hall tickets, and review evaluated subject scorecards.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Sub-tab pills */}
                    <div className="flex items-center p-1 bg-slate-100 rounded-xl">
                      <button
                        type="button"
                        onClick={() => setExamSubTab("schedule")}
                        className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                          examSubTab === "schedule"
                            ? "bg-white text-indigo-700 shadow-xs"
                            : "text-slate-500 hover:text-slate-800"
                        }`}
                      >
                        Timetable & Hall Tickets ({displayExams.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setExamSubTab("results")}
                        className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                          examSubTab === "results"
                            ? "bg-white text-indigo-700 shadow-xs"
                            : "text-slate-500 hover:text-slate-800"
                        }`}
                      >
                        Results & Scorecard ({displayMarks.length})
                      </button>
                    </div>

                    {examSubTab === "schedule" && displayExams.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          toast(`Official Hall Ticket generated for ${currentStudent.name} (${currentStudent.roll_number || currentStudent.register_number || currentStudent.id}).`, "success");
                        }}
                        className="py-2 px-3.5 bg-indigo-50 hover:bg-indigo-100 border border-indigo-150 text-indigo-700 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
                      >
                        <Download className="h-4 w-4" />
                        <span>Download Hall Ticket (PDF)</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Scorecard Quick KPIs (When on results view) */}
                {examSubTab === "results" && displayMarks.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                    <div className="p-3 bg-indigo-50/70 border border-indigo-200 rounded-xl text-center">
                      <span className="text-[9px] font-black uppercase text-indigo-800 block">Evaluated Papers</span>
                      <span className="text-lg font-black text-indigo-900">{displayMarks.length}</span>
                    </div>
                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-center">
                      <span className="text-[9px] font-black uppercase text-emerald-700 block">Passed</span>
                      <span className="text-lg font-black text-emerald-800">{passedCount}</span>
                    </div>
                    <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-center">
                      <span className="text-[9px] font-black uppercase text-rose-700 block">Arrears / Re-Appear</span>
                      <span className="text-lg font-black text-rose-800">{arrearsCount}</span>
                    </div>
                    <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl text-center">
                      <span className="text-[9px] font-black uppercase text-purple-700 block">Cumulative Score</span>
                      <span className="text-lg font-black text-purple-900">{overallPct}%</span>
                    </div>
                  </div>
                )}
              </div>

              {/* VIEW 1: EXAMINATION SCHEDULE & TICKETS */}
              {examSubTab === "schedule" && (
                <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                  <div className="overflow-x-auto scroll-touch">
                    <table className="w-full border-collapse text-left text-xs min-w-[650px]">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[9px] whitespace-nowrap">
                          <th className="p-3">Exam / Assessment</th>
                          <th className="p-3">Subject Name</th>
                          <th className="p-3">Exam Date</th>
                          <th className="p-3">Session & Timings</th>
                          <th className="p-3">Hall / Block</th>
                          <th className="p-3 text-center">Seat Number</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-150 bg-white font-medium">
                        {examsLoading ? (
                          <tr>
                            <td colSpan={6} className="p-8 text-center text-slate-400 font-bold">
                              Loading your assessment schedule...
                            </td>
                          </tr>
                        ) : displayExams.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="p-8 text-center text-slate-400 italic">
                              No examination schedules published for your enrolled courses at this time.
                            </td>
                          </tr>
                        ) : (
                          displayExams.map((ex: any, idx: number) => {
                            const seatNo = currentStudent.roll_number || currentStudent.register_number ? `${currentStudent.roll_number || currentStudent.register_number}` : `S-${100 + idx}`;
                            return (
                              <tr key={ex.id || idx} className="hover:bg-slate-50/60 transition-colors">
                                <td className="p-3">
                                  <span className="px-2 py-0.5 rounded-md bg-indigo-50 border border-indigo-100 text-indigo-700 text-[10.5px] font-extrabold">
                                    {ex.exam_type}
                                  </span>
                                </td>
                                <td className="p-3 font-extrabold text-slate-900 truncate max-w-[200px]">{ex.subject_name}</td>
                                <td className="p-3 text-slate-700 font-bold">
                                  <div className="flex items-center gap-1.5">
                                    <Calendar className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
                                    <span>{ex.exam_date}</span>
                                  </div>
                                </td>
                                <td className="p-3 text-slate-650">
                                  <div className="flex items-center gap-1.5 text-[10.5px]">
                                    <Clock className="h-3 w-3 text-slate-400 shrink-0" />
                                    <span>{ex.session_time || `${ex.start_time} - ${ex.end_time}`}</span>
                                  </div>
                                </td>
                                <td className="p-3">
                                  <span className="inline-flex items-center gap-1 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded text-[10px] text-slate-700 font-bold">
                                    <MapPin className="h-3 w-3 shrink-0 text-slate-400" />
                                    {ex.hall_room || "Main Examination Hall"}
                                  </span>
                                </td>
                                <td className="p-3 text-center font-bold text-indigo-700 font-mono">{seatNo}</td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* VIEW 2: ASSESSMENT RESULTS & SCORECARD */}
              {examSubTab === "results" && (
                <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                  <div className="overflow-x-auto scroll-touch">
                    <table className="w-full border-collapse text-left text-xs min-w-[700px]">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[9px] whitespace-nowrap">
                          <th className="p-3">Exam Type</th>
                          <th className="p-3">Subject Name</th>
                          <th className="p-3">Exam Date</th>
                          <th className="p-3 text-center">Marks Scored</th>
                          <th className="p-3 text-center">Score %</th>
                          <th className="p-3 text-center">Grade</th>
                          <th className="p-3 text-center">Status</th>
                          <th className="p-3">Evaluator / Remarks</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-150 bg-white font-medium">
                        {examsLoading ? (
                          <tr>
                            <td colSpan={8} className="p-8 text-center text-slate-400 font-bold">
                              Loading evaluated assessment scores...
                            </td>
                          </tr>
                        ) : displayMarks.length === 0 ? (
                          <tr>
                            <td colSpan={8} className="p-10 text-center text-slate-400 italic">
                              No marks published by faculty yet. As subject mentors evaluate papers, your results will appear here in real-time.
                            </td>
                          </tr>
                        ) : (
                          displayMarks.map((m: any, idx: number) => {
                            const isAbs = Boolean(m.is_absent);
                            const marksNum = m.marks_obtained !== null && m.marks_obtained !== undefined ? parseFloat(m.marks_obtained) : null;
                            const maxM = parseFloat(m.max_marks || 50);
                            const passM = parseFloat(m.passing_marks || (maxM * 0.4) || 20);
                            const pct = marksNum !== null ? Math.round((marksNum / maxM) * 100) : 0;
                            const isPass = marksNum !== null && marksNum >= passM;

                            return (
                              <tr key={m.id || idx} className="hover:bg-slate-50/60 transition-colors">
                                <td className="p-3">
                                  <span className="px-2 py-0.5 rounded-md bg-indigo-50 border border-indigo-100 text-indigo-700 text-[10.5px] font-extrabold">
                                    {m.exam_type}
                                  </span>
                                </td>
                                <td className="p-3">
                                  <div className="font-extrabold text-slate-900">{m.subject_name}</div>
                                  {m.subject_code && (
                                    <div className="text-[10px] text-slate-400 font-mono">{m.subject_code}</div>
                                  )}
                                </td>
                                <td className="p-3 text-slate-700 font-bold">
                                  {m.exam_date}
                                </td>
                                <td className="p-3 text-center font-extrabold">
                                  {isAbs ? (
                                    <span className="text-rose-600 font-mono">ABSENT</span>
                                  ) : marksNum !== null ? (
                                    <span className="text-slate-900 font-mono">
                                      {marksNum} <span className="text-slate-400 font-normal text-[11px]">/ {maxM}</span>
                                    </span>
                                  ) : (
                                    <span className="text-amber-600 italic">Pending</span>
                                  )}
                                </td>
                                <td className="p-3 text-center">
                                  {isAbs || marksNum === null ? (
                                    <span className="text-slate-400">—</span>
                                  ) : (
                                    <div className="flex flex-col items-center gap-1">
                                      <span className="font-black text-slate-800 text-[11px]">{pct}%</span>
                                      <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                        <div
                                          className={`h-full rounded-full ${pct >= 75 ? "bg-emerald-500" : pct >= 50 ? "bg-indigo-500" : "bg-rose-500"}`}
                                          style={{ width: `${Math.min(pct, 100)}%` }}
                                        />
                                      </div>
                                    </div>
                                  )}
                                </td>
                                <td className="p-3 text-center">
                                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                                    isAbs
                                      ? "bg-slate-100 text-slate-600"
                                      : m.grade === "O" || m.grade === "A+" || m.grade === "A"
                                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                      : m.grade === "B+" || m.grade === "B"
                                      ? "bg-indigo-50 text-indigo-700 border border-indigo-200"
                                      : isPass
                                      ? "bg-amber-50 text-amber-700 border border-amber-200"
                                      : "bg-rose-50 text-rose-700 border border-rose-200"
                                  }`}>
                                    {isAbs ? "AB" : m.grade || (isPass ? "PASS" : "RA")}
                                  </span>
                                </td>
                                <td className="p-3 text-center">
                                  <span className={`px-2 py-0.5 rounded-md text-[9px] font-extrabold uppercase ${
                                    isAbs
                                      ? "bg-rose-50 text-rose-700 border border-rose-200"
                                      : isPass
                                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                      : "bg-rose-50 text-rose-700 border border-rose-200"
                                  }`}>
                                    {isAbs ? "Absent" : isPass ? "Passed" : "Re-Appear"}
                                  </span>
                                </td>
                                <td className="p-3 text-[11px] text-slate-600">
                                  <div className="font-semibold text-slate-800">{m.evaluated_by || "Subject Mentor"}</div>
                                  {m.remarks && <div className="text-slate-400 text-[10px] italic mt-0.5">{m.remarks}</div>}
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
            </div>
          );
        })()}

        {/* Tab 6: Subject Materials (Unit-wise Study Hub) */}
        {(activeTab === "materials" || activeTab === "library") && (
          <div className="space-y-6 animate-fadeIn">
            {/* Subject Selector & Header */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
                      <BookOpen className="h-4 w-4" />
                    </div>
                    <h2 className="text-base font-black text-slate-900 tracking-tight">
                      Subject Materials & Unit-wise Study Hub
                    </h2>
                    <span className="px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200/60 text-[9px] font-black uppercase">
                      Curriculum Notes & PPTs
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 font-semibold mt-1">
                    Access verified unit-wise lecture notes, PPT presentations, question banks, and reference guides uploaded by course faculty.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => fetchSubjectMaterials(selectedMaterialSubject)}
                    className="p-2 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 cursor-pointer shadow-2xs transition-colors"
                    title="Refresh Materials"
                  >
                    <RefreshCw className={`h-4 w-4 ${materialsLoading ? "animate-spin text-indigo-600" : ""}`} />
                  </button>
                </div>
              </div>

              {/* Enrolled Subject Selector Pills */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] text-slate-400 font-black uppercase tracking-wider block">
                    Select Course Subject ({studentSubjects.length || 1})
                  </label>
                  <span className="text-[10px] text-slate-500 font-bold">
                    {studentClassDetails.sem} • {studentClassDetails.year}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {studentSubjects.map((subj) => {
                    const isSelected = selectedMaterialSubject.toLowerCase().trim() === subj.name.toLowerCase().trim();
                    return (
                      <button
                        key={subj.id || subj.name}
                        type="button"
                        onClick={() => setSelectedMaterialSubject(subj.name)}
                        className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-2 border shadow-xs ${
                          isSelected
                            ? "bg-slate-900 border-slate-900 text-white ring-2 ring-indigo-200 scale-105"
                            : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                        }`}
                      >
                        <GraduationCap className={`h-3.5 w-3.5 shrink-0 ${isSelected ? "text-indigo-300" : "text-slate-400"}`} />
                        <span>{subj.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Unit Tabs & Filters Bar */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                {/* Unit 1 to 5 Filter Tabs */}
                <div className="flex flex-wrap items-center gap-1.5 bg-slate-100/80 p-1 rounded-xl border border-slate-200/60">
                  <button
                    type="button"
                    onClick={() => setSelectedMaterialUnit("all")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                      selectedMaterialUnit === "all"
                        ? "bg-white text-slate-900 shadow-xs"
                        : "text-slate-500 hover:text-slate-900"
                    }`}
                  >
                    All Units
                  </button>
                  {[1, 2, 3, 4, 5].map((unitNum) => (
                    <button
                      key={`unit_tab_${unitNum}`}
                      type="button"
                      onClick={() => setSelectedMaterialUnit(unitNum)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                        selectedMaterialUnit === unitNum
                          ? "bg-white text-indigo-600 shadow-xs"
                          : "text-slate-500 hover:text-slate-900"
                      }`}
                    >
                      Unit {unitNum}
                    </button>
                  ))}
                </div>

                {/* Search Bar */}
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search topics, unit notes..."
                    value={materialSearchQuery}
                    onChange={(e) => setMaterialSearchQuery(e.target.value)}
                    className="w-full pl-8.5 pr-4 py-2 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white text-xs outline-none focus:ring-1 focus:ring-indigo-500 font-bold placeholder-slate-400"
                  />
                </div>
              </div>

              {/* Material Type Pills */}
              <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-100">
                <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider mr-1">Filter Type:</span>
                {[
                  { id: "all", label: "All Formats" },
                  { id: "notes", label: "PDF Notes" },
                  { id: "ppt", label: "Slides (PPT)" },
                  { id: "question_bank", label: "Question Banks" }
                ].map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setMaterialTypeFilter(t.id)}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer border ${
                      materialTypeFilter === t.id
                        ? "bg-indigo-50 border-indigo-200 text-indigo-700"
                        : "bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Materials Grid List */}
            {(() => {
              const filteredList = (materialsList || []).filter((item) => {
                const matchesSubject = isSubjectNameMatch(item.subject, selectedMaterialSubject) || item.subject.toLowerCase().trim() === selectedMaterialSubject.toLowerCase().trim();
                const matchesUnit = selectedMaterialUnit === "all" || item.unit_number === selectedMaterialUnit;
                const matchesType = materialTypeFilter === "all" || item.material_type === materialTypeFilter;
                const matchesSearch =
                  !materialSearchQuery ||
                  item.title.toLowerCase().includes(materialSearchQuery.toLowerCase()) ||
                  (item.description && item.description.toLowerCase().includes(materialSearchQuery.toLowerCase())) ||
                  (item.uploaded_by && item.uploaded_by.toLowerCase().includes(materialSearchQuery.toLowerCase()));

                return matchesSubject && matchesUnit && matchesType && matchesSearch;
              });

              if (materialsLoading) {
                return (
                  <div className="py-20 text-center text-sm font-bold text-slate-400 flex flex-col items-center justify-center gap-3">
                    <Loader2 className="h-7 w-7 text-indigo-600 animate-spin" />
                    <span>Loading subject study materials...</span>
                  </div>
                );
              }

              if (filteredList.length === 0) {
                return (
                  <div className="bg-white border border-dashed border-slate-200 rounded-2xl p-12 text-center space-y-3">
                    <div className="h-12 w-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto">
                      <BookOpen className="h-6 w-6" />
                    </div>
                    <h3 className="text-sm font-black text-slate-800">No Study Materials Found</h3>
                    <p className="text-xs text-slate-400 max-w-md mx-auto">
                      {selectedMaterialUnit !== "all"
                        ? `No uploads found for Unit ${selectedMaterialUnit} in ${selectedMaterialSubject}. Try switching to another unit or filter.`
                        : `Faculty has not yet published materials for ${selectedMaterialSubject}. Check back soon.`}
                    </p>
                  </div>
                );
              }

              return (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredList.map((mat) => {
                    const isPPT = mat.material_type === "ppt";
                    const isQuestionBank = mat.material_type === "question_bank";
                    const formattedDate = mat.created_at ? parseDbDate(mat.created_at).toLocaleDateString() : "Active Semester";

                    return (
                      <div
                        key={mat.id}
                        className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs hover:shadow-md hover:border-indigo-200 transition-all flex flex-col justify-between space-y-4 group"
                      >
                        <div className="space-y-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-2">
                              <span className="px-2.5 py-1 rounded-xl bg-slate-900 text-white font-black text-[10px] uppercase tracking-wider shadow-2xs">
                                Unit {mat.unit_number}
                              </span>
                              <span className={`px-2.5 py-1 rounded-xl text-[9.5px] font-black uppercase tracking-wider border ${
                                isPPT
                                  ? "bg-amber-50 text-amber-800 border-amber-200"
                                  : isQuestionBank
                                  ? "bg-purple-50 text-purple-800 border-purple-200"
                                  : "bg-indigo-50 text-indigo-800 border-indigo-200"
                              }`}>
                                {isPPT ? "Lecture PPT" : isQuestionBank ? "Question Bank" : "PDF Notes"}
                              </span>
                            </div>

                            <span className="text-[10px] font-bold text-slate-400">
                              {mat.file_size || "2.4 MB"}
                            </span>
                          </div>

                          <div>
                            <h3 className="text-sm font-black text-slate-900 group-hover:text-indigo-600 transition-colors leading-snug">
                              {mat.title}
                            </h3>
                            {mat.description && (
                              <p className="text-xs text-slate-500 font-medium leading-relaxed mt-1.5 line-clamp-3">
                                {mat.description}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <span className="text-[10px] text-slate-400 font-bold block truncate">
                              Faculty: <strong className="text-slate-700">{mat.uploaded_by || "Course Mentor"}</strong>
                            </span>
                            <span className="text-[9px] text-slate-400 font-medium block">
                              Published: {formattedDate}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => {
                                if (mat.file_url || mat.external_url) {
                                  window.open(mat.file_url || mat.external_url, "_blank");
                                } else {
                                  toast(`Downloading "${mat.title}" (${mat.file_size || "PDF"})`, "success");
                                }
                              }}
                              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs cursor-pointer transition-all hover:scale-105"
                            >
                              <Download className="h-3.5 w-3.5" />
                              <span>Download</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        )}

        {/* Tab 7: Fees & Dues (Real Data) */}
        {activeTab === "fees" && (() => {
          if (!feeData && !feeLoading) fetchFeeData();
          const fmtR = (n: number) => "₹" + n.toLocaleString("en-IN", { maximumFractionDigits: 0 });

          if (feeLoading) return <div className="py-16 text-center text-sm text-slate-400">Loading your fee details…</div>;

          if (!feeData) return (
            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4 shadow-sm font-sans">
              <h2 className="text-xs font-bold text-slate-550 uppercase tracking-wider">Fees & Online Payments</h2>
              <p className="text-[11px] text-slate-450 mt-1">Could not load fee data. Try refreshing.</p>
              <button onClick={fetchFeeData} className="px-4 py-2 rounded-xl btn-gradient text-white text-xs font-bold cursor-pointer">Retry</button>
            </div>
          );

          const { fees, payments, stats } = feeData;

          return (
            <div className="space-y-5 font-sans">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: "Total Fees", value: fmtR(stats.totalFees), color: "text-slate-800", bg: "bg-slate-50" },
                  { label: "Paid", value: fmtR(stats.totalPaid), color: "text-[#D528A2]", bg: "bg-slate-50" },
                  { label: "Due", value: fmtR(stats.totalOutstanding), color: "text-slate-500", bg: "bg-slate-50" },
                  { label: "Status", value: stats.unpaidCount > 0 ? `${stats.unpaidCount} Unpaid` : "All Clear", color: stats.unpaidCount > 0 ? "text-[#D528A2]" : "text-[#F4A863]", bg: "bg-slate-50" },
                ].map(({ label, value, color, bg }) => (
                  <div key={label} className={`rounded-xl p-3.5 border border-slate-100 ${bg}`}>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{label}</p>
                    <p className={`text-base font-extrabold mt-1 ${color}`}>{value}</p>
                  </div>
                ))}
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3 shadow-sm">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider">Fee Breakdown</h3>
                  <button onClick={fetchFeeData} className="p-1.5 rounded-xl border border-slate-200 text-slate-400 hover:text-[#D528A2] cursor-pointer transition-colors"><RefreshCw className="h-3 w-3" /></button>
                </div>
                {fees.map((fee: any) => (
                  <div key={fee.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border border-slate-150 bg-slate-50/50 gap-3">
                    <div className="space-y-0.5">
                      <h4 className="text-xs font-extrabold text-slate-800">{fee.term_name}</h4>
                      <div className="flex items-center gap-3 text-[10px] text-slate-450 font-bold">
                        <span>Total: <span className="text-slate-700">{fmtR(fee.amount)}</span></span>
                        <span>•</span>
                        <span>Paid: <span className="text-slate-800">{fmtR(fee.paid_amount)}</span></span>
                        {fee.due_date && <><span>•</span><span>Due: <span className="font-mono text-slate-600">{fee.due_date}</span></span></>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2.5 shrink-0 self-end sm:self-center">
                      {fee.status === "paid" ? (
                        <span className="px-3 py-1 rounded-xl bg-[#D528A2]/10 text-[#D528A2] text-[10px] font-extrabold flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5" /> Paid</span>
                      ) : (
                        <>
                          {fee.status === "partial" && <span className="px-2 py-0.5 rounded-full bg-[#F4A863]/10 text-[#F4A863] text-[10px] font-bold">Partial</span>}
                          {fee.pay_link ? (
                            <a
                              href={fee.pay_link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="py-1.5 px-4 btn-gradient text-white rounded-xl text-[10px] font-extrabold shadow-sm transition-all cursor-pointer inline-block text-center"
                            >
                              Pay Now
                            </a>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setFeePayModal(fee);
                                setFeePayAmount(String(fee.amount - fee.paid_amount));
                                setFeePaySuccess(null);
                              }}
                              className="py-1.5 px-4 btn-gradient text-white rounded-xl text-[10px] font-extrabold shadow-sm transition-all cursor-pointer inline-block text-center"
                            >
                              Pay Now
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                ))}
                {fees.length === 0 && <p className="text-xs text-slate-400 text-center py-6">No fee records found.</p>}
              </div>

              {payments.length > 0 && (
                <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                  <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-4">Payment History</h3>
                  <div className="space-y-2">
                    {[...payments].sort((a: any, b: any) => new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime()).map((p: any) => (
                      <div key={p.id} className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs">
                        <div>
                          <p className="font-bold text-slate-700">{p.receipt_no}</p>
                          <p className="text-[10px] text-slate-400 font-mono mt-0.5">{p.reference_no}</p>
                        </div>
                        <span className="px-2 py-0.5 rounded-full bg-[#D528A2]/10 text-[#D528A2] text-[9px] font-bold capitalize">{p.payment_method}</span>
                        <div className="text-right">
                          <p className="font-extrabold text-slate-800">{fmtR(p.amount)}</p>
                          <p className="text-[10px] text-slate-400">{new Date(p.payment_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {feePayModal && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                  <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-7">
                    {feePaySuccess ? (
                      <div className="text-center space-y-4">
                        <div className="h-14 w-14 rounded-full bg-slate-100 flex items-center justify-center mx-auto">
                          <CheckCircle2 className="h-8 w-8 text-[#D528A2]" />
                        </div>
                        <h3 className="text-lg font-extrabold text-slate-800">Payment Successful!</h3>
                        <p className="text-sm text-slate-500">Receipt No: <span className="font-bold text-[#D528A2]">{feePaySuccess}</span></p>
                        <button onClick={() => setFeePayModal(null)} className="w-full py-3 rounded-xl btn-gradient text-white font-bold cursor-pointer transition-colors">Close</button>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center justify-between mb-5">
                          <div>
                            <h3 className="text-base font-extrabold text-slate-800">Pay Fee Online</h3>
                            <p className="text-xs text-slate-500 mt-0.5">{feePayModal.term_name}</p>
                          </div>
                          <button onClick={() => setFeePayModal(null)} className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center cursor-pointer hover:bg-slate-200"><X className="h-4 w-4 text-slate-500" /></button>
                        </div>
                        <div className="space-y-4">
                          <div className="flex justify-between text-sm p-3 rounded-xl bg-slate-50 border border-slate-100">
                            <span className="font-semibold text-slate-600">Outstanding Balance</span>
                            <span className="font-extrabold text-[#D528A2]">{"₹" + (feePayModal.amount - feePayModal.paid_amount).toLocaleString("en-IN")}</span>
                          </div>
                          <div>
                            <label className="text-[11px] font-bold text-slate-600 block mb-1">Amount (₹)</label>
                            <input type="number" value={feePayAmount} onChange={e => setFeePayAmount(e.target.value)} max={feePayModal.amount - feePayModal.paid_amount} placeholder="Enter amount" className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#D528A2]/50" />
                          </div>
                          <div>
                            <label className="text-[11px] font-bold text-slate-600 block mb-1">Payment Method</label>
                            <div className="grid grid-cols-2 gap-2">
                              {["online", "card"].map(m => (
                                <button key={m} type="button" onClick={() => setFeePayMethod(m)} className={`py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border capitalize ${feePayMethod === m ? "btn-gradient text-white border-transparent" : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"}`}>{m === "online" ? "UPI / Net Banking" : "Card Payment"}</button>
                              ))}
                            </div>
                          </div>
                          <div className="flex gap-3 pt-1">
                            <button onClick={() => setFeePayModal(null)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 cursor-pointer hover:bg-slate-50">Cancel</button>
                            <button onClick={handleFeePayment} disabled={!feePayAmount || feePaySubmitting} className="flex-1 py-2.5 rounded-xl btn-gradient text-white text-sm font-bold cursor-pointer disabled:opacity-50">
                              {feePaySubmitting ? "Processing…" : "Confirm Payment"}
                            </button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {/* Student Tracker / Skill Development Tab */}
        {activeTab === "tracker" && (() => {
          // Helper to calculate task stats and new indicator for any subject
          const getSubjectTaskStats = (subjName: string) => {
            const matchingTasks = (weeklyTasks || []).filter(task => 
              (isCohortMatching(task.class_group, currentStudent?.classGroup, coursesList, subjectsList) ||
              (currentStudent?.department && task.class_group.toLowerCase().includes(currentStudent.department.toLowerCase().trim()))) &&
              task.subject.toLowerCase().trim() === subjName.toLowerCase().trim()
            );
            
            const entries = (studentTracker || []).filter(
              e => e.student_id === currentStudent?.id && e.subject.toLowerCase().trim() === subjName.toLowerCase().trim()
            );

            const submittedCount = matchingTasks.filter(t => entries.some(e => e.week_number === t.week_number && !!e.submission_url)).length;
            const gradedEntries = entries.filter(e => e.marks !== undefined && e.marks !== null);
            const pendingCount = Math.max(0, matchingTasks.length - submittedCount);

            const hasNew = matchingTasks.some(t => {
              const entry = entries.find(e => e.week_number === t.week_number);
              if (entry?.submission_url) return false;
              if (!t.created_at) return true;
              const tDate = parseDbDate(t.created_at);
              const diffDays = (new Date().getTime() - tDate.getTime()) / (1000 * 3600 * 24);
              return diffDays <= 7;
            });

            const totalMarks = gradedEntries.reduce((sum, e) => sum + (e.marks || 0), 0);
            const avgScore = gradedEntries.length > 0 ? (totalMarks / gradedEntries.length).toFixed(1) : null;

            return {
              totalAssigned: matchingTasks.length,
              submittedCount,
              gradedCount: gradedEntries.length,
              pendingCount,
              hasNew,
              avgScore
            };
          };

          const activeSubjectStats = getSubjectTaskStats(studentTrackerSubject);

          const allWeeks = Array.from({ length: 15 }, (_, i) => i + 1);
          const studentAcadSubjects = studentSubjects.filter(s => !isSkillSubject(s));
          const availableAcadSubjects = studentAcadSubjects.length > 0 ? studentAcadSubjects : studentSubjects;
          const activeAcadSubjName = studentAcadSubject || availableAcadSubjects[0]?.name || "";

          // Academic stats for student
          const getAcadSubjectStats = (subjName: string) => {
            const matchingTasks = (weeklyAcademicTasks || []).filter(task =>
              (isCohortMatching(task.class_group, currentStudent?.classGroup, coursesList, subjectsList) ||
                (currentStudent?.department && task.class_group.toLowerCase().includes(currentStudent.department.toLowerCase().trim()))) &&
              task.subject.toLowerCase().trim() === subjName.toLowerCase().trim()
            );

            const studentEmail = (currentStudent?.email || "").toLowerCase().trim();
            const entries = (studentAcademicTracker || []).filter(
              e => e.student_email.toLowerCase().trim() === studentEmail && e.subject.toLowerCase().trim() === subjName.toLowerCase().trim()
            );

            const evaluatedEntries = entries.filter(e => e.total_marks !== null || e.quiz_marks !== null || e.assessment_marks !== null || e.assignment_marks !== null);
            const totalScoreSum = evaluatedEntries.reduce((sum, e) => sum + (e.total_marks || 0), 0);
            const avgPct = evaluatedEntries.length > 0 ? Math.round((totalScoreSum / (evaluatedEntries.length * 30)) * 100) : null;

            return {
              totalAssigned: matchingTasks.length,
              evaluatedCount: evaluatedEntries.length,
              totalScoreSum,
              avgPct
            };
          };

          return (
            <div className="space-y-6 font-sans">
              {/* Category Switcher Banner: Academic vs Skill */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
                <div className="flex items-center gap-2 p-1 bg-slate-100 rounded-xl border border-slate-200/80 w-fit">
                  <button
                    type="button"
                    onClick={() => setStudentTrackerCategory("academic")}
                    className={`px-4 py-2 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center gap-2 ${
                      studentTrackerCategory === "academic"
                        ? "bg-white text-indigo-650 shadow-xs"
                        : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    <BookOpen className="h-4 w-4 text-indigo-600" />
                    <span>Academic Subjects (Quiz, Assessment, Assignment)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setStudentTrackerCategory("skill")}
                    className={`px-4 py-2 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center gap-2 ${
                      studentTrackerCategory === "skill"
                        ? "bg-white text-slate-900 shadow-xs"
                        : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    <GraduationCap className="h-4 w-4 text-indigo-600" />
                    <span>Skill Development Tasks</span>
                  </button>
                </div>

                <div className="text-[11px] font-bold text-slate-500 text-right">
                  {studentClassDetails.sem} • {studentClassDetails.year}
                </div>
              </div>

              {/* ────────────────────────────────────────────────────────────────────────── */}
              {/* SUB-VIEW 1: ACADEMIC WEEKLY TASKS & 3-COMPONENT EVALUATIONS                */}
              {/* ────────────────────────────────────────────────────────────────────────── */}
              {studentTrackerCategory === "academic" && (
                <div className="space-y-6 animate-fadeIn">
                  {/* Subject Selector Bar */}
                  <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block">
                        Select Academic Course
                      </label>
                      <span className="text-[10px] text-slate-400 font-bold font-mono">
                        User: {currentStudent?.email}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {availableAcadSubjects.map(sub => {
                        const isSelected = activeAcadSubjName.toLowerCase().trim() === sub.name.toLowerCase().trim();
                        const stats = getAcadSubjectStats(sub.name);

                        return (
                          <button
                            key={sub.id || sub.name}
                            type="button"
                            onClick={() => setStudentAcadSubject(sub.name)}
                            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 border ${
                              isSelected
                                ? "bg-indigo-600 border-indigo-600 text-white shadow-xs"
                                : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                            }`}
                          >
                            <BookOpen className={`h-3.5 w-3.5 ${isSelected ? "text-white" : "text-slate-400"}`} />
                            <span>{sub.name}</span>
                            {stats.avgPct !== null && (
                              <span className={`px-1.5 py-0.2 rounded text-[9px] font-extrabold ${
                                isSelected ? "bg-white/20 text-white" : "bg-emerald-100 text-emerald-800"
                              }`}>
                                {stats.avgPct}%
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* 15 Weeks Academic Tasks & Scoped Marks List */}
                  <div className="space-y-4">
                    {allWeeks.map(wk => {
                      const task = (weeklyAcademicTasks || []).find(
                        t => (isCohortMatching(t.class_group, currentStudent?.classGroup, coursesList, subjectsList) ||
                          (currentStudent?.department && t.class_group.toLowerCase().includes(currentStudent.department.toLowerCase().trim()))) &&
                          t.subject.toLowerCase().trim() === activeAcadSubjName.toLowerCase().trim() &&
                          t.week_number === wk
                      );

                      const studentEmail = (currentStudent?.email || "").toLowerCase().trim();
                      const entry = (studentAcademicTracker || []).find(
                        e => e.student_email.toLowerCase().trim() === studentEmail &&
                          e.subject.toLowerCase().trim() === activeAcadSubjName.toLowerCase().trim() &&
                          e.week_number === wk
                      );

                      const qMarks = entry?.quiz_marks;
                      const asMarks = entry?.assessment_marks;
                      const agMarks = entry?.assignment_marks;
                      const totalMarks = entry?.total_marks ?? (
                        (qMarks !== undefined && qMarks !== null) ||
                        (asMarks !== undefined && asMarks !== null) ||
                        (agMarks !== undefined && agMarks !== null)
                          ? ((Number(qMarks) || 0) + (Number(asMarks) || 0) + (Number(agMarks) || 0))
                          : null
                      );

                      const isEvaluated = totalMarks !== null;
                      const isSubmitted = !!entry?.submission_url;

                      return (
                        <div
                          key={`acad_wk_${wk}`}
                          id={`acad-task-week-${wk}`}
                          className={`bg-white border rounded-xl p-5 shadow-xs space-y-4 hover:shadow-sm transition-all duration-300 scroll-mt-24 ${
                            highlightedWeek === wk
                              ? "border-indigo-500 ring-4 ring-indigo-100 shadow-md scale-[1.01]"
                              : "border-slate-200"
                          }`}
                        >
                          {/* Week Card Header */}
                          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-3">
                            <div className="flex items-center gap-3">
                              <span className="h-7 w-7 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-700 font-black text-xs flex items-center justify-center shrink-0 font-mono">
                                W{wk}
                              </span>
                              <div>
                                <h4 className="text-xs font-black text-slate-800 uppercase tracking-wide flex items-center gap-2">
                                  Week {wk} Academic Evaluation
                                  {(() => {
                                    if (!task) return null;
                                    const targetTaskDate = task.task_date || task.created_at?.slice(0, 10);
                                    const stAttLogs = (studentAttendance || []).filter(a => {
                                      if (a.studentId !== currentStudent?.id) return false;
                                      const slot = (slots || []).find(sl => sl.id === a.slotId);
                                      const subj = a.coveredSubject || slot?.course || "";
                                      return isSubjectNameMatch(subj, activeAcadSubjName);
                                    });
                                    const exactDateLog = targetTaskDate ? stAttLogs.find(a => a.dateStr === targetTaskDate) : null;
                                    const sortedLogs = [...stAttLogs].sort((a, b) => (b.dateStr || "").localeCompare(a.dateStr || ""));
                                    const effectiveLog = exactDateLog || sortedLogs[0];
                                    let liveAtt = "Present";
                                    if (effectiveLog) {
                                      const st = (effectiveLog.status || "").toLowerCase();
                                      liveAtt = st === "absent" ? "Absent" : st === "od" ? "OD" : "Present";
                                    } else if (entry?.attendance_status) {
                                      liveAtt = entry.attendance_status;
                                    }

                                    return (
                                      <span className={`px-2 py-0.5 rounded text-[8.5px] font-black uppercase border ${
                                        liveAtt === "Absent"
                                          ? "bg-rose-50 text-rose-700 border-rose-200"
                                          : liveAtt === "OD"
                                            ? "bg-blue-50 text-blue-700 border-blue-200"
                                            : liveAtt === "Present"
                                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                              : "bg-slate-100 text-slate-500 border-slate-200"
                                      }`}>
                                        {liveAtt}
                                      </span>
                                    );
                                  })()}
                                </h4>
                              </div>
                            </div>

                            {/* Overall Score Badge */}
                            <div>
                              {isEvaluated ? (
                                <div className="flex items-center gap-2">
                                  <span className="text-[9px] text-slate-400 font-extrabold uppercase tracking-wide">Evaluated</span>
                                  <span className={`inline-flex items-center px-3 py-1 rounded-lg border text-xs font-black ${
                                    totalMarks! >= 24
                                      ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                                      : totalMarks! >= 15
                                        ? "bg-amber-50 border-amber-200 text-amber-800"
                                        : "bg-rose-50 border-rose-200 text-rose-800"
                                  }`}>
                                    Total Score: {totalMarks} / 30 ({Math.round((totalMarks! / 30) * 100)}%)
                                  </span>
                                </div>
                              ) : isSubmitted ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-bold">
                                  <CheckCircle className="h-3.5 w-3.5" />
                                  <span>Work Submitted (Awaiting Marks)</span>
                                </span>
                              ) : task ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-xs font-bold">
                                  <Clock className="h-3.5 w-3.5" />
                                  <span>Task Assigned</span>
                                </span>
                              ) : (
                                <span className="px-2.5 py-0.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-400 text-xs font-medium">
                                  No Task Guidelines
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Task Topics & Marks Grid */}
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                            {/* Left: Mentor Assigned Topics & Guidelines */}
                            <div className="space-y-3">
                              {task ? (
                                <>
                                  <div className="space-y-1">
                                    <span className="text-[9px] text-slate-400 font-extrabold uppercase tracking-wider block">
                                      Weekly Focus &amp; Overview
                                    </span>
                                    <p className="text-xs font-bold text-slate-800 leading-relaxed bg-slate-50 p-3 rounded-lg border border-slate-150">
                                      {task.task_name}
                                    </p>
                                  </div>

                                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                                    {task.quiz_topic && (
                                      <div className="p-2.5 bg-indigo-50/80 border border-indigo-200 rounded-xl space-y-1.5 shadow-2xs">
                                        <span className="text-[9.5px] font-black text-indigo-800 uppercase block">Quiz Component</span>
                                        {task.quiz_topic.startsWith("http") ? (
                                          <a
                                            href={task.quiz_topic}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-900 bg-indigo-100/90 px-2 py-0.5 rounded hover:bg-indigo-200 transition-colors"
                                          >
                                            <span>Open Quiz</span>
                                            <ExternalLink className="h-3 w-3" />
                                          </a>
                                        ) : (
                                          <span className="font-bold text-slate-800 text-[11px] block">{task.quiz_topic === "Enabled" ? "Active (0–10)" : task.quiz_topic}</span>
                                        )}
                                      </div>
                                    )}
                                    {task.assessment_topic && (
                                      <div className="p-2.5 bg-purple-50/80 border border-purple-200 rounded-xl space-y-1.5 shadow-2xs">
                                        <span className="text-[9.5px] font-black text-purple-800 uppercase block">Assessment Component</span>
                                        {task.assessment_topic.startsWith("http") ? (
                                          <a
                                            href={task.assessment_topic}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="inline-flex items-center gap-1 text-[11px] font-bold text-purple-900 bg-purple-100/90 px-2 py-0.5 rounded hover:bg-purple-200 transition-colors"
                                          >
                                            <span>Open Test Link</span>
                                            <ExternalLink className="h-3 w-3" />
                                          </a>
                                        ) : (
                                          <span className="font-bold text-slate-800 text-[11px] block">{task.assessment_topic === "Enabled" ? "Active (0–10)" : task.assessment_topic}</span>
                                        )}
                                      </div>
                                    )}
                                    {task.assignment_topic && (
                                      <div className="p-2.5 bg-emerald-50/80 border border-emerald-200 rounded-xl space-y-1.5 shadow-2xs">
                                        <span className="text-[9.5px] font-black text-emerald-800 uppercase block">Assignment Component</span>
                                        {task.assignment_topic.startsWith("http") ? (
                                          <a
                                            href={task.assignment_topic}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-900 bg-emerald-100/90 px-2 py-0.5 rounded hover:bg-emerald-200 transition-colors"
                                          >
                                            <span>Open Assignment</span>
                                            <ExternalLink className="h-3 w-3" />
                                          </a>
                                        ) : (
                                          <span className="font-bold text-slate-800 text-[11px] block">{task.assignment_topic === "Enabled" ? "Active (0–10)" : task.assignment_topic}</span>
                                        )}
                                      </div>
                                    )}
                                  </div>

                                  {task.task_pdf_url && (
                                    <a
                                      href={task.task_pdf_url}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 bg-indigo-50 border border-indigo-200 px-3 py-1.5 rounded-lg hover:bg-indigo-100 transition-colors"
                                    >
                                      <FileText className="h-3.5 w-3.5 text-indigo-600" />
                                      <span>View Task Material / PDF</span>
                                    </a>
                                  )}
                                </>
                              ) : (
                                <div className="py-4 text-center bg-slate-50/50 rounded-lg border border-dashed border-slate-200">
                                  <p className="text-xs text-slate-400 font-medium">No guidelines assigned for Week {wk} yet.</p>
                                </div>
                              )}
                            </div>

                            {/* Right: Evaluated 3-Component Score Breakdown */}
                            <div className="space-y-3 lg:border-l lg:border-slate-100 lg:pl-5">
                              <span className="text-[9px] text-slate-400 font-extrabold uppercase tracking-wider block">
                                Your Evaluated Component Marks (Scoped to {currentStudent?.email})
                              </span>

                              <div className="grid grid-cols-3 gap-2 text-center">
                                {/* Quiz Box */}
                                <div className="p-3 bg-amber-50/40 border border-amber-200 rounded-xl space-y-1">
                                  <span className="text-[9px] font-extrabold text-amber-800 uppercase block">Quiz</span>
                                  <div className="text-base font-black text-amber-950">
                                    {qMarks !== undefined && qMarks !== null ? `${qMarks} / 10` : "—"}
                                  </div>
                                </div>

                                {/* Assessment Box */}
                                <div className="p-3 bg-purple-50/40 border border-purple-200 rounded-xl space-y-1">
                                  <span className="text-[9px] font-extrabold text-purple-800 uppercase block">Assessment</span>
                                  <div className="text-base font-black text-purple-950">
                                    {asMarks !== undefined && asMarks !== null ? `${asMarks} / 10` : "—"}
                                  </div>
                                </div>

                                {/* Assignment Box */}
                                <div className="p-3 bg-emerald-50/40 border border-emerald-200 rounded-xl space-y-1">
                                  <span className="text-[9px] font-extrabold text-emerald-800 uppercase block">Assignment</span>
                                  <div className="text-base font-black text-emerald-950">
                                    {agMarks !== undefined && agMarks !== null ? `${agMarks} / 10` : "—"}
                                  </div>
                                </div>
                              </div>

                              {/* Faculty Feedback */}
                              {entry?.feedback && (
                                <div className="bg-slate-50 border border-slate-200 p-3 rounded-lg space-y-1">
                                  <span className="text-[9px] text-slate-500 font-extrabold uppercase tracking-wider block">
                                    Faculty Remarks &amp; Feedback
                                  </span>
                                  <p className="text-xs font-medium text-slate-700 italic leading-relaxed">
                                    &ldquo;{entry.feedback}&rdquo;
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ────────────────────────────────────────────────────────────────────────── */}
              {/* SUB-VIEW 2: SKILL DEVELOPMENT TASKS                                       */}
              {/* ────────────────────────────────────────────────────────────────────────── */}
              {studentTrackerCategory === "skill" && (
                <div className="space-y-6 animate-fadeIn">
                  {/* Subject Selector / Header with Clean NEW Indicator */}
                  {assignedMentorSubjects.length === 1 ? (
                    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-wrap gap-4 items-center justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block">Skill Development Course</span>
                          {activeSubjectStats.hasNew && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-rose-50 text-rose-700 border border-rose-200">
                              <span className="h-1.5 w-1.5 rounded-full bg-rose-600 animate-pulse" />
                              <span>New Tasks Active</span>
                            </span>
                          )}
                        </div>
                        <h3 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
                          <div className="h-7 w-7 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
                            <GraduationCap className="h-4 w-4" />
                          </div>
                          <span>{assignedMentorSubjects[0]}</span>
                        </h3>
                      </div>
                      <div className="bg-slate-50 border border-slate-200 px-4 py-2.5 rounded-xl text-right shrink-0">
                        <div className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wide">Academic Session</div>
                        <div className="text-xs font-bold text-slate-800 mt-0.5">{studentClassDetails.sem} • {studentClassDetails.year}</div>
                      </div>
                    </div>
                  ) : assignedMentorSubjects.length > 1 ? (
                    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block">Assigned Skill Development Courses</label>
                        <span className="text-[10px] text-slate-500 font-bold">{studentClassDetails.sem} • {studentClassDetails.year}</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {assignedMentorSubjects.map((subName) => {
                          const isSelected =
                            isSubjectNameMatch(studentTrackerSubject, subName) ||
                            studentTrackerSubject.toLowerCase().trim() === subName.toLowerCase().trim();
                          const subStats = getSubjectTaskStats(subName);
                          const cleanSubId = subName.toLowerCase().replace(/[^a-z0-9]/g, "-");

                          return (
                            <button
                              key={subName}
                              id={`skill-subject-btn-${cleanSubId}`}
                              data-subject={subName}
                              type="button"
                              onClick={() => {
                                setStudentTrackerSubject(subName);
                              }}
                              className={`relative px-4 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-2 border shadow-xs ${
                                isSelected
                                  ? "bg-slate-900 border-slate-900 text-white ring-2 ring-indigo-200 scale-105"
                                  : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                              }`}
                            >
                              <GraduationCap className={`h-4 w-4 shrink-0 ${isSelected ? "text-indigo-300" : "text-slate-400"}`} />
                              <span>{subName}</span>

                              {subStats.hasNew && (
                                <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase ${
                                  isSelected ? "bg-rose-500 text-white" : "bg-rose-100 text-rose-700"
                                }`}>
                                  NEW
                                </span>
                              )}

                              {subStats.pendingCount > 0 && (
                                <span className={`px-2 py-0.5 rounded-full text-[9px] font-black ${
                                  isSelected ? "bg-white/20 text-white" : "bg-amber-100 text-amber-800"
                                }`}>
                                  {subStats.pendingCount} Pending
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-wrap gap-4 items-center justify-between">
                      <div className="space-y-1.5 flex-grow max-w-md">
                        <label className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block">Select Skill Subject</label>
                        <select
                          value={studentTrackerSubject}
                          onChange={(e) => setStudentTrackerSubject(e.target.value)}
                          className="w-full text-xs font-semibold px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-indigo-500 bg-white text-slate-800"
                        >
                          {studentSubjects.filter(s => isSkillSubject(s)).map(s => (
                            <option key={s.id} value={s.name}>{s.name}</option>
                          ))}
                          {studentSubjects.filter(s => isSkillSubject(s)).length === 0 && <option value="">No Skill Development subjects in this semester</option>}
                        </select>
                      </div>
                      <div className="bg-slate-50 border border-slate-200 px-4 py-2.5 rounded-xl max-w-sm text-right shrink-0">
                        <div className="text-[10px] text-slate-500 font-extrabold uppercase">Academic Session</div>
                        <div className="text-xs font-bold text-slate-800 mt-0.5">{studentClassDetails.sem} • {studentClassDetails.year}</div>
                      </div>
                    </div>
                  )}

                  {/* Weeks Task Cards List */}
                  <div className="space-y-4">
                    {allWeeks.map(wk => {
                      const task = weeklyTasks.find(
                        t => (isCohortMatching(t.class_group, currentStudent?.classGroup, coursesList, subjectsList) ||
                              (currentStudent?.department && t.class_group.toLowerCase().includes(currentStudent.department.toLowerCase().trim()))) &&
                             (isSubjectNameMatch(t.subject, studentTrackerSubject) || t.subject.toLowerCase().trim() === studentTrackerSubject.toLowerCase().trim()) &&
                             t.week_number === wk
                      );

                      const entry = studentTracker.find(
                        e => e.student_id === currentStudent?.id &&
                             (isSubjectNameMatch(e.subject, studentTrackerSubject) || e.subject.toLowerCase().trim() === studentTrackerSubject.toLowerCase().trim()) &&
                             e.week_number === wk
                      );

                      const currentUrl = entry?.submission_url || "";
                      const isSubmitting = submittingUrlMap[wk] || false;
                      const isGraded = entry?.marks !== undefined && entry?.marks !== null;
                      const isSubmitted = !!currentUrl;

                      const assignedDate = task ? parseDbDate(task.created_at || task.updated_at) : null;
                      const isNewTask = task && !isSubmitted && assignedDate && ((new Date().getTime() - assignedDate.getTime()) / (1000 * 3600 * 24) <= 7);

                      return (
                        <div
                          key={wk}
                          id={`skill-task-week-${wk}`}
                          className={`bg-white border rounded-xl p-5 shadow-xs space-y-4 transition-all duration-300 scroll-mt-24 ${
                            highlightedWeek === wk
                              ? "border-indigo-500 ring-4 ring-indigo-100 shadow-md scale-[1.01]"
                              : isNewTask
                              ? "border-rose-300 ring-1 ring-rose-100"
                              : "border-slate-200"
                          }`}
                        >
                          {/* Task Card Header */}
                          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-3">
                            <div className="flex items-center gap-3">
                              <span className="h-7 w-7 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-700 font-bold text-xs flex items-center justify-center shrink-0">
                                W{wk}
                              </span>
                              <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide">Week {wk} Practical Task</h4>
                                  {isNewTask && (
                                    <span className="px-2 py-0.5 bg-rose-50 text-rose-700 border border-rose-200 rounded text-[9px] font-bold uppercase tracking-wide">
                                      New Assignment
                                    </span>
                                  )}
                                  {wk % 2 === 0 && (
                                    <span className="px-2 py-0.5 bg-purple-50 text-purple-700 rounded text-[9px] font-bold tracking-wide border border-purple-200">
                                      Assessment / Viva Week
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Status / Grade Badge */}
                            <div>
                              {isGraded ? (
                                <div className="flex items-center gap-2">
                                  <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wide">Evaluated</span>
                                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-lg border text-xs font-bold uppercase tracking-wider ${
                                    entry.marks! >= 8
                                      ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                                      : entry.marks! >= 5
                                        ? "bg-amber-50 border-amber-200 text-amber-700"
                                        : "bg-rose-50 border-rose-200 text-rose-700"
                                  }`}>
                                    Score: {entry.marks} / 10
                                  </span>
                                </div>
                              ) : isSubmitted ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold tracking-wide">
                                  <CheckCircle className="h-3.5 w-3.5" />
                                  <span>Submitted</span>
                                </span>
                              ) : task ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-xs font-bold tracking-wide">
                                  <Clock className="h-3.5 w-3.5" />
                                  <span>Pending Submission</span>
                                </span>
                              ) : (
                                <span className="px-2.5 py-0.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-400 text-xs font-medium tracking-wide">
                                  No Task Assigned
                                </span>
                              )}
                            </div>
                          </div>

                          {task ? (
                            (() => {
                              const taskAssignedDate = parseDbDate(task.created_at || task.updated_at);
                              const deadlineDate = new Date(taskAssignedDate.getTime() + 7 * 24 * 60 * 60 * 1000);
                              const isPastDeadline = new Date() > deadlineDate;

                              return (
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                                  {/* Left Column: Task Details */}
                                  <div className="space-y-3">
                                    <div className="space-y-1">
                                      <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Instructions</span>
                                      <p className="text-xs font-medium text-slate-800 leading-relaxed bg-slate-50 p-3 rounded-lg border border-slate-150">
                                        {task.task_name}
                                      </p>
                                    </div>

                                    <div className="flex flex-wrap items-center gap-4 text-xs">
                                      <div className="space-y-0.5">
                                        <span className="text-[8px] text-slate-400 font-bold uppercase tracking-wider block">Assigned Date</span>
                                        <span className="font-semibold text-slate-700">{taskAssignedDate.toLocaleDateString()}</span>
                                      </div>
                                      <div className="space-y-0.5">
                                        <span className="text-[8px] text-slate-400 font-bold uppercase tracking-wider block">Due Date</span>
                                        <span className={`font-semibold ${isPastDeadline ? "text-rose-600" : "text-indigo-600"}`}>
                                          {deadlineDate.toLocaleDateString()}
                                        </span>
                                      </div>
                                    </div>

                                    {task.task_pdf_url && (
                                      <div className="pt-1">
                                        <a
                                          href={task.task_pdf_url}
                                          target="_blank"
                                          rel="noreferrer"
                                          className="inline-flex items-center gap-2 px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-bold tracking-wider transition-all duration-200 cursor-pointer"
                                        >
                                          <FileText className="h-3.5 w-3.5 shrink-0 text-indigo-600" />
                                          <span>Reference Document / PDF</span>
                                        </a>
                                      </div>
                                    )}
                                  </div>

                                  {/* Right Column: Submission Area & Feedback */}
                                  <div className="space-y-3 lg:border-l lg:border-slate-100 lg:pl-5">
                                    <div className="space-y-2">
                                      <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Student Submission</span>

                                      {currentUrl && !editSubmissionMode[wk] ? (
                                        <div className="rounded-lg border border-slate-200 p-3.5 bg-slate-50 space-y-2.5">
                                          <div className="flex items-start justify-between gap-3">
                                            <div className="space-y-1 min-w-0">
                                              <span className="text-[8px] text-slate-400 font-bold uppercase tracking-wider block">Submitted Link / File</span>
                                              {currentUrl.startsWith("data:") ? (
                                                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                                                  <FileText className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
                                                  <a
                                                    href={currentUrl}
                                                    download={`Week_${wk}_Submission`}
                                                    className="inline-flex items-center gap-1 text-xs font-bold text-indigo-650 hover:underline truncate"
                                                  >
                                                    <span>Download Attached Document</span>
                                                    <Download className="h-3.5 w-3.5 shrink-0 text-indigo-600" />
                                                  </a>
                                                </div>
                                              ) : (
                                                <a
                                                  href={currentUrl}
                                                  target="_blank"
                                                  rel="noreferrer"
                                                  className="inline-flex items-center gap-1 text-xs font-bold text-indigo-650 hover:underline truncate max-w-full"
                                                >
                                                  <span className="truncate">{currentUrl}</span>
                                                  <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-indigo-600" />
                                                </a>
                                              )}
                                            </div>
                                            <button
                                              type="button"
                                              onClick={() => setEditSubmissionMode(prev => ({ ...prev, [wk]: true }))}
                                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 font-bold text-[10px] transition-colors cursor-pointer shrink-0"
                                            >
                                              <Edit2 className="h-3 w-3 text-slate-500" />
                                              <span>Edit</span>
                                            </button>
                                          </div>

                                          {entry?.updated_at && (
                                            <div className="flex items-center gap-1 text-[9px] text-slate-400 font-medium border-t border-slate-200 pt-2">
                                              <Clock className="h-3 w-3 text-slate-400" />
                                              <span>Submitted on: {parseDbDate(entry.updated_at).toLocaleString()}</span>
                                            </div>
                                          )}
                                        </div>
                                      ) : (
                                        <div className="space-y-2.5">
                                          {/* Toggle URL / File */}
                                          <div className="flex gap-2">
                                            <button
                                              type="button"
                                              disabled={isSubmitting}
                                              onClick={() => setStudentUploadType(prev => ({ ...prev, [wk]: "url" }))}
                                              className={`flex-1 py-1.5 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                                                (studentUploadType[wk] || "url") === "url"
                                                  ? "bg-indigo-50 border-indigo-300 text-indigo-700"
                                                  : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
                                              }`}
                                            >
                                              Web Link / URL
                                            </button>
                                            <button
                                              type="button"
                                              disabled={isSubmitting}
                                              onClick={() => setStudentUploadType(prev => ({ ...prev, [wk]: "file" }))}
                                              className={`flex-1 py-1.5 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                                                studentUploadType[wk] === "file"
                                                  ? "bg-indigo-50 border-indigo-300 text-indigo-700"
                                                  : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
                                              }`}
                                            >
                                              Upload Document
                                            </button>
                                          </div>

                                          {(studentUploadType[wk] || "url") === "url" ? (
                                            <form
                                              onSubmit={async (e) => {
                                                e.preventDefault();
                                                const form = e.target as HTMLFormElement;
                                                const input = form.elements.namedItem("submissionUrl") as HTMLInputElement;
                                                const url = input.value.trim();
                                                if (!url) return;

                                                setSubmittingUrlMap(prev => ({ ...prev, [wk]: true }));
                                                const res = await gradeStudentTask({
                                                  studentId: currentStudent?.id || "",
                                                  classGroup: currentStudent?.classGroup || "",
                                                  subject: studentTrackerSubject,
                                                  weekNumber: wk,
                                                  submissionUrl: url
                                                });
                                                setSubmittingUrlMap(prev => ({ ...prev, [wk]: false }));
                                                if (!res.success) {
                                                  toast(res.message || "Failed to submit URL.", "error");
                                                } else {
                                                  toast("Work submitted successfully!", "success");
                                                  setEditSubmissionMode(prev => ({ ...prev, [wk]: false }));
                                                }
                                              }}
                                              className="flex gap-2"
                                            >
                                              <input
                                                type="url"
                                                name="submissionUrl"
                                                defaultValue={currentUrl.startsWith("http") ? currentUrl : ""}
                                                placeholder="https://github.com/..."
                                                required
                                                disabled={isSubmitting}
                                                className="flex-1 px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
                                              />
                                              <button
                                                type="submit"
                                                disabled={isSubmitting}
                                                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg cursor-pointer transition-colors shadow-2xs disabled:opacity-50"
                                              >
                                                {isSubmitting ? "Saving..." : "Submit"}
                                              </button>
                                            </form>
                                          ) : (
                                            <div className="space-y-2 mt-1.5">
                                              <label className="flex flex-col items-center justify-center w-full h-20 border border-dashed border-slate-300 rounded-lg cursor-pointer bg-slate-50 hover:bg-slate-100 transition-all">
                                                <div className="flex flex-col items-center justify-center pt-2 pb-2">
                                                  <Upload className="w-4 h-4 mb-1 text-slate-400" />
                                                  <p className="text-xs text-slate-600 font-semibold">Click to select document</p>
                                                  <p className="text-[9px] text-slate-400">PDF, DOCX, ZIP (MAX. 10MB)</p>
                                                </div>
                                                <input
                                                  type="file"
                                                  className="hidden"
                                                  accept=".pdf,.docx,.doc,.zip,.rar"
                                                  disabled={isSubmitting}
                                                  onChange={async (e) => {
                                                    if (e.target.files && e.target.files[0]) {
                                                      const file = e.target.files[0];
                                                      setSubmittingUrlMap(prev => ({ ...prev, [wk]: true }));
                                                      const reader = new FileReader();
                                                      reader.onload = async () => {
                                                        const dataUrl = (reader.result as string) || "";
                                                        const res = await gradeStudentTask({
                                                          studentId: currentStudent?.id || "",
                                                          classGroup: currentStudent?.classGroup || "",
                                                          subject: studentTrackerSubject,
                                                          weekNumber: wk,
                                                          submissionUrl: dataUrl
                                                        });
                                                        setSubmittingUrlMap(prev => ({ ...prev, [wk]: false }));
                                                        if (!res.success) {
                                                          toast(res.message || "File upload failed.", "error");
                                                        } else {
                                                          toast(`Uploaded ${file.name} successfully.`, "success");
                                                          setEditSubmissionMode(prev => ({ ...prev, [wk]: false }));
                                                        }
                                                      };
                                                      reader.onerror = () => {
                                                        setSubmittingUrlMap(prev => ({ ...prev, [wk]: false }));
                                                        toast("Failed to read file.", "error");
                                                      };
                                                      reader.readAsDataURL(file);
                                                    }
                                                  }}
                                                />
                                              </label>

                                              {currentUrl && (
                                                <div className="flex justify-end pt-1">
                                                  <button
                                                    type="button"
                                                    onClick={() => setEditSubmissionMode(prev => ({ ...prev, [wk]: false }))}
                                                    className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold border border-slate-200 cursor-pointer"
                                                  >
                                                    Cancel Editing
                                                  </button>
                                                </div>
                                              )}
                                            </div>
                                          )}
                                        </div>
                                      )}
                                    </div>

                                    {/* Mentor Viva Feedback & Remarks */}
                                    {entry?.viva_assessment && (
                                      <div className="bg-slate-50 border border-slate-200 p-3 rounded-lg space-y-1">
                                        <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider block">Faculty Feedback</span>
                                        <p className="text-xs font-medium text-slate-700 italic leading-relaxed">
                                          &ldquo;{entry.viva_assessment}&rdquo;
                                        </p>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })()
                          ) : (
                            <div className="py-3 text-center bg-slate-50/50 rounded-lg border border-dashed border-slate-200">
                              <p className="text-xs text-slate-400 font-medium">No tasks assigned for Week {wk} yet.</p>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {/* Tab 8: My Profile */}
        {activeTab === "profile" && currentStudent && (() => {
          const isProfileEditAllowed = allowedProfileEditClasses.includes(currentStudent.classGroup);
          return (
            <form onSubmit={handleSaveProfile} className="space-y-6 font-sans">
              {/* Access Controller Banner */}
              <div className="flex justify-between items-center bg-white p-4.5 rounded-xl border border-slate-100 shadow-sm flex-wrap gap-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2.5 rounded-xl ${isProfileEditAllowed ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
                    {isProfileEditAllowed ? <CheckCircle className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
                  </div>
                  <div>
                    <h3 className="text-xs font-black text-slate-805">
                      {isProfileEditAllowed ? "Profile Editing Access Enabled" : "Profile Editing Access Locked"}
                    </h3>
                    <p className="text-[10px] text-slate-455 mt-0.5 font-semibold">
                      {isProfileEditAllowed 
                        ? "You are permitted to modify your academic and personal registration credentials." 
                        : "Editing has been disabled by your Campus Manager (CM) for your class group."}
                    </p>
                  </div>
                </div>
                
                {isProfileEditAllowed && !isEditingProfile && (
                  <button
                    type="button"
                    onClick={startEditingProfile}
                    className="px-4 py-2 bg-indigo-650 hover:bg-indigo-700 text-white rounded-xl text-xs font-extrabold shadow-sm transition-all hover:scale-[1.01] cursor-pointer"
                  >
                    Edit Profile Data
                  </button>
                )}
              </div>

              {/* Editing Action Row */}
              {isEditingProfile && (
                <div className="flex items-center gap-3 bg-indigo-50 border border-indigo-150 p-4.5 rounded-xl justify-end flex-wrap">
                  <span className="text-xs font-bold text-indigo-850 mr-auto">
                     You are in editing mode. Save your changes to persist them to the database.
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsEditingProfile(false)}
                    className="px-4 py-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl text-xs font-extrabold transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-indigo-655 hover:bg-indigo-705 text-white rounded-xl text-xs font-extrabold shadow-md transition-all cursor-pointer"
                  >
                    Save Changes
                  </button>
                </div>
              )}

              {/* Main Profile Info Row */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* Section 1: Personal & Primary Identity */}
                <div className="bg-white p-7 rounded-dribbble-panel border border-slate-100 shadow-sm space-y-5">
                  <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
                    <User className="h-5 w-5 text-indigo-650" />
                    <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">Personal & Identity Credentials</h3>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Full Name</span>
                      {isEditingProfile ? (
                        <input
                          type="text"
                          value={editName}
                          onChange={e => setEditName(e.target.value)}
                          className="w-full px-3 py-1.5 border border-slate-200 rounded-xl bg-white text-xs font-bold focus:ring-1 focus:ring-indigo-500 outline-none text-slate-800"
                          required
                        />
                      ) : (
                        <span className="text-xs font-extrabold text-slate-800 block">{currentStudent.name}</span>
                      )}
                    </div>

                    <div className="space-y-1">
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Register Number (Institutional)</span>
                      <span className="text-xs font-extrabold text-slate-800 block">{currentStudent.register_number || <span className="text-slate-400 italic">Not Assigned</span>}</span>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Roll Number</span>
                      {isEditingProfile ? (
                        <input
                          type="text"
                          value={editRollNumber}
                          onChange={e => setEditRollNumber(e.target.value)}
                          placeholder="e.g. 21CS01"
                          className="w-full px-3 py-1.5 border border-slate-200 rounded-xl bg-white text-xs font-bold focus:ring-1 focus:ring-indigo-500 outline-none text-slate-800"
                        />
                      ) : (
                        <span className="text-xs font-extrabold text-slate-800 block">{currentStudent.roll_number || <span className="text-slate-400 italic">Not Added</span>}</span>
                      )}
                    </div>

                    <div className="space-y-1">
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Aadhar Card Number</span>
                      {isEditingProfile ? (
                        <input
                          type="text"
                          value={editAadharNumber}
                          onChange={e => setEditAadharNumber(e.target.value)}
                          placeholder="e.g. 1234-5678-9012"
                          className="w-full px-3 py-1.5 border border-slate-200 rounded-xl bg-white text-xs font-bold focus:ring-1 focus:ring-indigo-500 outline-none text-slate-800"
                        />
                      ) : (
                        <span className="text-xs font-extrabold text-slate-855 block font-mono">
                          {currentStudent.aadhar_number
                            ? `XXXX-XXXX-${currentStudent.aadhar_number.replace(/\D/g, "").slice(-4) || "XXXX"}`
                            : <span className="text-slate-400 italic font-sans">Not Added</span>}
                        </span>
                      )}
                    </div>

                    <div className="space-y-1">
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Date of Birth (DOB)</span>
                      {isEditingProfile ? (
                        <input
                          type="date"
                          value={editDob}
                          onChange={e => setEditDob(e.target.value)}
                          className="w-full px-3 py-1.5 border border-slate-200 rounded-xl bg-white text-xs font-bold focus:ring-1 focus:ring-indigo-500 outline-none text-slate-800"
                        />
                      ) : (
                        <span className="text-xs font-extrabold text-slate-855 block">{currentStudent.dob || <span className="text-slate-400 italic">Not Added</span>}</span>
                      )}
                    </div>

                    <div className="space-y-1">
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Blood Group</span>
                      {isEditingProfile ? (
                        <select
                          value={editBloodGroup}
                          onChange={e => setEditBloodGroup(e.target.value)}
                          className="w-full px-3 py-1.5 border border-slate-200 rounded-xl bg-white text-xs font-bold focus:ring-1 focus:ring-indigo-500 outline-none text-slate-800 cursor-pointer"
                        >
                          <option value="">Select Group</option>
                          {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map(bg => (
                            <option key={bg} value={bg}>{bg}</option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-xs font-extrabold text-slate-855 block">{currentStudent.blood_group || <span className="text-slate-400 italic">Not Added</span>}</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Section 2: Contact Details */}
                <div className="bg-white p-7 rounded-dribbble-panel border border-slate-100 shadow-sm space-y-5">
                  <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
                    <Clock className="h-5 w-5 text-indigo-655" />
                    <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">Contact & Communications</h3>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1 sm:col-span-2">
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Primary Email</span>
                      {isEditingProfile ? (
                        <input
                          type="email"
                          value={editEmail}
                          onChange={e => setEditEmail(e.target.value)}
                          className="w-full px-3 py-1.5 border border-slate-200 rounded-xl bg-white text-xs font-bold focus:ring-1 focus:ring-indigo-500 outline-none text-slate-800"
                          required
                        />
                      ) : (
                        <span className="text-xs font-extrabold text-indigo-650 block break-all">{currentStudent.email}</span>
                      )}
                    </div>

                    <div className="space-y-1">
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Student Phone Number</span>
                      {isEditingProfile ? (
                        <input
                          type="text"
                          value={editPhone}
                          onChange={e => setEditPhone(e.target.value)}
                          placeholder="e.g. 9876543210"
                          className="w-full px-3 py-1.5 border border-slate-200 rounded-xl bg-white text-xs font-bold focus:ring-1 focus:ring-indigo-500 outline-none text-slate-800"
                        />
                      ) : (
                        <span className="text-xs font-extrabold text-slate-855 block">{currentStudent.phone || <span className="text-slate-400 italic">Not Added</span>}</span>
                      )}
                    </div>

                    <div className="space-y-1">
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Parent WhatsApp Number</span>
                      {isEditingProfile ? (
                        <input
                          type="text"
                          value={editParentPhone}
                          onChange={e => setEditParentPhone(e.target.value)}
                          placeholder="e.g. 8765432109"
                          className="w-full px-3 py-1.5 border border-slate-200 rounded-xl bg-white text-xs font-bold focus:ring-1 focus:ring-indigo-500 outline-none text-slate-800"
                        />
                      ) : (
                        <span className="text-xs font-extrabold text-slate-855 block">{currentStudent.parent_phone || <span className="text-slate-400 italic">Not Added</span>}</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Section 3: Academic History & Medium */}
                <div className="bg-white p-7 rounded-dribbble-panel border border-slate-100 shadow-sm space-y-5 lg:col-span-2">
                  <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
                    <BookOpen className="h-5 w-5 text-indigo-650" />
                    <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">Academic Background & Marks</h3>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                    <div className="space-y-1 sm:col-span-2 lg:col-span-2">
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Course Department</span>
                      {isEditingProfile ? (
                        <input
                          type="text"
                          value={editDepartment}
                          onChange={e => setEditDepartment(e.target.value)}
                          className="w-full px-3 py-1.5 border border-slate-200 rounded-xl bg-white text-xs font-bold focus:ring-1 focus:ring-indigo-500 outline-none text-slate-800"
                          required
                        />
                      ) : (
                        <span className="text-xs font-extrabold text-slate-850 block">{currentStudent.department}</span>
                      )}
                    </div>

                    <div className="space-y-1">
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">10th Mark (%)</span>
                      {isEditingProfile ? (
                        <input
                          type="text"
                          value={editTenthMark}
                          onChange={e => setEditTenthMark(e.target.value)}
                          placeholder="e.g. 92.4"
                          className="w-full px-3 py-1.5 border border-slate-200 rounded-xl bg-white text-xs font-bold focus:ring-1 focus:ring-indigo-500 outline-none text-slate-800"
                        />
                      ) : (
                        <span className="text-xs font-extrabold text-slate-850 block">{currentStudent.tenth_mark ? `${currentStudent.tenth_mark}%` : <span className="text-slate-400 italic">Not Added</span>}</span>
                      )}
                    </div>

                    <div className="space-y-1">
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">11th Mark (%)</span>
                      {isEditingProfile ? (
                        <input
                          type="text"
                          value={editEleventhMark}
                          onChange={e => setEditEleventhMark(e.target.value)}
                          placeholder="e.g. 88.5"
                          className="w-full px-3 py-1.5 border border-slate-200 rounded-xl bg-white text-xs font-bold focus:ring-1 focus:ring-indigo-500 outline-none text-slate-800"
                        />
                      ) : (
                        <span className="text-xs font-extrabold text-slate-850 block">{currentStudent.eleventh_mark ? `${currentStudent.eleventh_mark}%` : <span className="text-slate-400 italic">Not Added</span>}</span>
                      )}
                    </div>

                    <div className="space-y-1">
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">12th Mark (%)</span>
                      {isEditingProfile ? (
                        <input
                          type="text"
                          value={editTwelfthMark}
                          onChange={e => setEditTwelfthMark(e.target.value)}
                          placeholder="e.g. 94.0"
                          className="w-full px-3 py-1.5 border border-slate-200 rounded-xl bg-white text-xs font-bold focus:ring-1 focus:ring-indigo-500 outline-none text-slate-800"
                        />
                      ) : (
                        <span className="text-xs font-extrabold text-slate-850 block">{currentStudent.twelfth_mark ? `${currentStudent.twelfth_mark}%` : <span className="text-slate-400 italic">Not Added</span>}</span>
                      )}
                    </div>

                    <div className="space-y-1">
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">School Group</span>
                      {isEditingProfile ? (
                        <input
                          type="text"
                          value={editAcademicGroup}
                          onChange={e => setEditAcademicGroup(e.target.value)}
                          placeholder="e.g. Computer Science"
                          className="w-full px-3 py-1.5 border border-slate-200 rounded-xl bg-white text-xs font-bold focus:ring-1 focus:ring-indigo-500 outline-none text-slate-800"
                        />
                      ) : (
                        <span className="text-xs font-extrabold text-slate-855 block">{currentStudent.academic_group || <span className="text-slate-400 italic">Not Added</span>}</span>
                      )}
                    </div>

                    <div className="space-y-1">
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Medium of Study</span>
                      {isEditingProfile ? (
                        <select
                          value={editMedium}
                          onChange={e => setEditMedium(e.target.value)}
                          className="w-full px-3 py-1.5 border border-slate-200 rounded-xl bg-white text-xs font-bold focus:ring-1 focus:ring-indigo-500 outline-none text-slate-800 cursor-pointer"
                        >
                          <option value="">Select Medium</option>
                          <option value="English">English</option>
                          <option value="Tamil">Tamil</option>
                          <option value="Other">Other</option>
                        </select>
                      ) : (
                        <span className="text-xs font-extrabold text-slate-855 block">{currentStudent.medium || <span className="text-slate-400 italic">Not Added</span>}</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Section 4: Professional Portfolios & Practice Hubs */}
                <div className="bg-white p-7 rounded-dribbble-panel border border-slate-100 shadow-sm space-y-5 lg:col-span-2">
                  <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
                    <Sparkles className="h-5 w-5 text-indigo-650" />
                    <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">Professional Portfolios & Coding Profiles</h3>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                    {/* LinkedIn */}
                    <div className="space-y-1">
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">LinkedIn Profile</span>
                      {isEditingProfile ? (
                        <input
                          type="text"
                          value={editLinkedinLink}
                          onChange={e => setEditLinkedinLink(e.target.value)}
                          placeholder="linkedin.com/in/username"
                          className="w-full px-3 py-1.5 border border-slate-200 rounded-xl bg-white text-xs font-bold focus:ring-1 focus:ring-indigo-500 outline-none text-slate-800"
                        />
                      ) : (
                        (() => {
                          const val = currentStudent.linkedin_link;
                          if (!val) return <span className="text-xs text-slate-400 italic">Not Added</span>;
                          const href = val.startsWith("http") ? val : `https://${val}`;
                          return <a href={href} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-indigo-650 hover:underline break-all">{val}</a>;
                        })()
                      )}
                    </div>

                    {/* GitHub */}
                    <div className="space-y-1">
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block flex items-center gap-1.5">
                        GitHub ID
                        {(currentStudent.department?.toLowerCase().includes("computer") || currentStudent.classGroup?.toLowerCase().includes("cs")) && (
                          <span className="px-1.5 py-0.2 rounded bg-rose-50 border border-rose-100 text-rose-700 text-[8px] font-extrabold uppercase shrink-0">Mandatory for CS</span>
                        )}
                      </span>
                      {isEditingProfile ? (
                        <input
                          type="text"
                          value={editGithubId}
                          onChange={e => setEditGithubId(e.target.value)}
                          placeholder="e.g. githubusername"
                          className="w-full px-3 py-1.5 border border-slate-200 rounded-xl bg-white text-xs font-bold focus:ring-1 focus:ring-indigo-500 outline-none text-slate-800"
                        />
                      ) : (
                        (() => {
                          const val = currentStudent.github_id;
                          if (!val) return <span className="text-xs text-slate-400 italic">Not Added</span>;
                          const href = `https://github.com/${val.replace(/@/, "")}`;
                          return <a href={href} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-indigo-650 hover:underline break-all">{val}</a>;
                        })()
                      )}
                    </div>

                    {/* Project Drive Link */}
                    <div className="space-y-1">
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Project Drive Link</span>
                      {isEditingProfile ? (
                        <input
                          type="text"
                          value={editProjectDriveLink}
                          onChange={e => setEditProjectDriveLink(e.target.value)}
                          placeholder="drive.google.com/..."
                          className="w-full px-3 py-1.5 border border-slate-200 rounded-xl bg-white text-xs font-bold focus:ring-1 focus:ring-indigo-500 outline-none text-slate-800"
                        />
                      ) : (
                        (() => {
                          const val = currentStudent.project_drive_link;
                          if (!val) return <span className="text-xs text-slate-400 italic">Not Added</span>;
                          const href = val.startsWith("http") ? val : `https://${val}`;
                          return <a href={href} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-indigo-650 hover:underline break-all">Google Drive Folder Link</a>;
                        })()
                      )}
                    </div>

                    {/* HackerRank Profile Link */}
                    <div className="space-y-1">
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">HackerRank Profile</span>
                      {isEditingProfile ? (
                        <input
                          type="text"
                          value={editHackerrankLink}
                          onChange={e => setEditHackerrankLink(e.target.value)}
                          placeholder="hackerrank.com/username"
                          className="w-full px-3 py-1.5 border border-slate-200 rounded-xl bg-white text-xs font-bold focus:ring-1 focus:ring-indigo-500 outline-none text-slate-800"
                        />
                      ) : (
                        (() => {
                          const val = currentStudent.hackerrank_link;
                          if (!val) return <span className="text-xs text-slate-400 italic">Not Added</span>;
                          const href = val.startsWith("http") ? val : `https://${val}`;
                          return <a href={href} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-indigo-650 hover:underline break-all">{val}</a>;
                        })()
                      )}
                    </div>

                    {/* LeetCode Profile Link */}
                    <div className="space-y-1">
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">LeetCode Profile</span>
                      {isEditingProfile ? (
                        <input
                          type="text"
                          value={editLeetcodeLink}
                          onChange={e => setEditLeetcodeLink(e.target.value)}
                          placeholder="leetcode.com/username"
                          className="w-full px-3 py-1.5 border border-slate-200 rounded-xl bg-white text-xs font-bold focus:ring-1 focus:ring-indigo-500 outline-none text-slate-800"
                        />
                      ) : (
                        (() => {
                          const val = currentStudent.leetcode_link;
                          if (!val) return <span className="text-xs text-slate-400 italic">Not Added</span>;
                          const href = val.startsWith("http") ? val : `https://${val}`;
                          return <a href={href} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-indigo-650 hover:underline break-all">{val}</a>;
                        })()
                      )}
                    </div>

                    {/* Figma Profile */}
                    <div className="space-y-1">
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Figma Profile</span>
                      {isEditingProfile ? (
                        <input
                          type="text"
                          value={editFigmaLink}
                          onChange={e => setEditFigmaLink(e.target.value)}
                          placeholder="figma.com/@username"
                          className="w-full px-3 py-1.5 border border-slate-200 rounded-xl bg-white text-xs font-bold focus:ring-1 focus:ring-indigo-500 outline-none text-slate-800"
                        />
                      ) : (
                        (() => {
                          const val = currentStudent.figma_link;
                          if (!val) return <span className="text-xs text-slate-400 italic">Not Added</span>;
                          const href = val.startsWith("http") ? val : `https://${val}`;
                          return <a href={href} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-indigo-650 hover:underline break-all">{val}</a>;
                        })()
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Attendance & Engagement Stats Card */}
              <div className="bg-pastel-blue p-7 rounded-dribbble-panel border-transparent shadow-sm space-y-6">
                <h3 className="text-xs font-black text-slate-555 uppercase tracking-widest font-sans">Attendance Performance Stats</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 text-center">
                  <div className="p-4 bg-white/80 rounded-xl border border-slate-100/40">
                    <span className="text-3xl font-extrabold text-slate-900">{overallPercentage.toFixed(1)}%</span>
                    <span className="text-[9px] text-slate-455 font-extrabold uppercase tracking-wider block mt-1">Average Attendance</span>
                  </div>
                  <div className="p-4 bg-white/80 rounded-xl border border-slate-100/40">
                    <span className="text-3xl font-extrabold text-slate-900">{(overallPercentage / 20).toFixed(2)}</span>
                    <span className="text-[9px] text-slate-455 font-extrabold uppercase tracking-wider block mt-1">Attendance GPA</span>
                  </div>
                  <div className="p-4 bg-white/80 rounded-xl border border-slate-100/40">
                    <span className="text-3xl font-extrabold text-slate-900">{totalClasses}</span>
                    <span className="text-[9px] text-slate-455 font-extrabold uppercase tracking-wider block mt-1">Total Slots Marked</span>
                  </div>
                  <div className="p-4 bg-white/80 rounded-xl border border-slate-105/40">
                    <span className="text-3xl font-extrabold text-slate-900">{presentClasses}</span>
                    <span className="text-[9px] text-slate-455 font-extrabold uppercase tracking-wider block mt-1">Present Intervals</span>
                  </div>
                </div>
              </div>
            </form>
          );
        })()}
      </main>
    </div>
  );
};
