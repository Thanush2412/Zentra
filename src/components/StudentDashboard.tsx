"use client";

import React, { useState, useEffect } from "react";
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
  Edit2
} from "lucide-react";
import { formatTimeLabel, calculateShiftSchedule, resolveClassGroupDetailsFromState, parseDbDate } from "@/lib/utils";

// Mock Library Books database for OPAC
interface BookItem {
  id: string;
  title: string;
  author: string;
  subject: string;
  shelf: string;
  status: "Available" | "Issued";
  expectedReturn?: string;
}

const MOCK_LIBRARY_BOOKS: BookItem[] = [
  { id: "B001", title: "Introduction to Python Programming", author: "Dr. Rowan Atkinson", subject: "Python Programming", shelf: "Shelf A-1", status: "Available" },
  { id: "B002", title: "Database Systems: Concepts and Design", author: "C. J. Date", subject: "Database Management Systems", shelf: "Shelf B-3", status: "Issued", expectedReturn: "2026-07-05" },
  { id: "B003", title: "Artificial Intelligence: A Modern Approach", author: "Stuart Russell & Peter Norvig", subject: "Principles of Artificial Intelligence", shelf: "Shelf C-2", status: "Available" },
  { id: "B004", title: "Statistics for Engineers and Scientists", author: "William Navidi", subject: "Descriptive Statistics", shelf: "Shelf D-1", status: "Available" },
  { id: "B005", title: "Learning Web Development with React and Next.js", author: "Brad Traversy", subject: "Website Designing", shelf: "Shelf E-4", status: "Issued", expectedReturn: "2026-07-12" },
  { id: "B006", title: "Digital Marketing Analytics & Strategy", author: "Chuck Hemann", subject: "Introduction to Digital Marketing", shelf: "Shelf F-2", status: "Available" },
  { id: "B007", title: "Banking Law and Practice", author: "P. N. Varshney", subject: "Principles and Practice of Banking", shelf: "Shelf G-1", status: "Available" },
  { id: "B008", title: "Pattern Making & Fashion Technology", author: "Helen Joseph Armstrong", subject: "Introduction to Fashion Industry & Terminology", shelf: "Shelf H-3", status: "Available" }
];

export interface StudentDashboardProps {
  activeTab?: "dashboard" | "schedule" | "marks" | "leave" | "exams" | "library" | "fees" | "profile" | "tracker" | "more_menu";
  onTabChange?: (tab: "dashboard" | "schedule" | "marks" | "leave" | "exams" | "library" | "fees" | "profile" | "tracker" | "more_menu") => void;
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
    colleges,
    coursesList,
    weeklyTasks,
    studentTracker,
    gradeStudentTask
  } = useApp();
  const { toast } = useToast();

  const [localActiveTab, setLocalActiveTab] = useState<"dashboard" | "schedule" | "marks" | "leave" | "exams" | "library" | "fees" | "profile" | "tracker" | "more_menu">("dashboard");
  const activeTab = propActiveTab || localActiveTab;
  const setActiveTab = onTabChange || setLocalActiveTab;

  const [isCollapsed, setIsCollapsed] = useState(false);
  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("fp_sidebar_collapsed") === "true";
      setIsCollapsed(stored);
    }
  }, []);

  // Student Tracker states
  const [studentTrackerSubject, setStudentTrackerSubject] = useState("");
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

  useEffect(() => {
    if (currentStudent?.college_id) {
      fetch(`/api/daily-configs?college_id=${currentStudent.college_id}`)
        .then(res => res.json())
        .then(data => {
          if (data.success && data.configs) {
            setDailyConfigsList(data.configs);
          }
        })
        .catch(err => console.error("Error fetching daily configs:", err));
    }
  }, [currentStudent]);
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

  // Dribbble Styled Task Management States
  const [tasksFilter, setTasksFilter] = useState<"all" | "todo" | "progress" | "done">("all");
  const [tasks, setTasks] = useState([
    { id: "t1", title: "Conduct virtual experiment on chemical reactions and prepare report", subject: "Chemistry", date: "Jun 30", status: "todo" },
    { id: "t2", title: "Complete term-matching task in biology lab handbook", subject: "Biology", date: "Jul 3", status: "progress" },
    { id: "t3", title: "Study the influence of cultural traditions on contemporary art", subject: "Art History", date: "Jun 27", status: "done" },
    { id: "t4", title: "Revise normal forms for Database Management Systems exam", subject: "DBMS", date: "Jul 5", status: "todo" }
  ]);
  const [showAddTaskForm, setShowAddTaskForm] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskSubject, setNewTaskSubject] = useState("General");
  const [newTaskDate, setNewTaskDate] = useState("Jul 1");

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

  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;
    setTasks(prev => [
      ...prev,
      {
        id: `t_${Date.now()}`,
        title: newTaskTitle,
        subject: newTaskSubject,
        date: newTaskDate,
        status: "todo"
      }
    ]);
    setNewTaskTitle("");
    setShowAddTaskForm(false);
  };

  const toggleTaskStatus = (id: string) => {
    setTasks(prev => prev.map(t => {
      if (t.id === id) {
        const nextStatus = t.status === "todo" ? "progress" : t.status === "progress" ? "done" : "todo";
        return { ...t, status: nextStatus };
      }
      return t;
    }));
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

  // 1. Get all slots for student's class group — using fuzzy match
  const myClassSlots = slots.filter(
    (s) => s.classGroup && normalizeClassGroup(s.classGroup) === studentGroupNorm
  );

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

  useEffect(() => {
    if (studentSubjects.length > 0 && !studentTrackerSubject) {
      setStudentTrackerSubject(studentSubjects[0].name);
    }
  }, [studentSubjects, studentTrackerSubject]);

  // 2. Get all attendance records for this student
  const myAttendance = studentAttendance.filter((a) => a.studentId === currentStudent.id);

  // 3. Filter leave requests for this student
  const myLeaveRequests = (leaveRequests || []).filter((r) => r.studentId === currentStudent.id);

  // Stats Calculations
  const totalClasses = myAttendance.length;
  const presentClasses = myAttendance.filter((a) => a.status === "present").length;
  const absentClasses = myAttendance.filter((a) => a.status === "absent").length;
  const overallPercentage = totalClasses > 0 ? (presentClasses / totalClasses) * 100 : 100;

  // Compute Bunk / Attendance Projection calculations
  const calculateBunkStats = () => {
    if (totalClasses === 0) return { status: "no_data", value: 0 };
    
    if (overallPercentage >= bunkTarget) {
      // How many classes can be skipped:
      // presentClasses / (totalClasses + x) >= target / 100 => x = Math.floor(presentClasses * 100 / target) - totalClasses
      const targetRatio = bunkTarget / 100;
      const maxTotal = Math.floor(presentClasses / targetRatio);
      const safeSkip = maxTotal - totalClasses;
      return {
        status: "safe",
        value: safeSkip >= 0 ? safeSkip : 0
      };
    } else {
      // How many classes must be attended consecutively:
      // (presentClasses + y) / (totalClasses + y) >= target / 100
      // => y = Math.ceil((target * totalClasses - 100 * presentClasses) / (100 - target))
      const targetPct = bunkTarget;
      const numerator = targetPct * totalClasses - 100 * presentClasses;
      const denominator = 100 - targetPct;
      const requiredConsecutive = Math.ceil(numerator / denominator);
      return {
        status: "shortage",
        value: requiredConsecutive >= 0 ? requiredConsecutive : 0
      };
    }
  };

  const bunkStats = calculateBunkStats();

  // Group attendance by Course
  const courseStats: Record<string, { present: number; absent: number; total: number }> = {};
  
  // Initialize with subjects mapped to their timetable slots
  myClassSlots.forEach((slot) => {
    if (slot.course && !courseStats[slot.course]) {
      courseStats[slot.course] = { present: 0, absent: 0, total: 0 };
    }
  });

  // Populate stats from attendance
  myAttendance.forEach((att) => {
    const slot = slots.find((s) => s.id === att.slotId);
    if (slot && slot.course) {
      if (!courseStats[slot.course]) {
        courseStats[slot.course] = { present: 0, absent: 0, total: 0 };
      }
      if (att.status === "present") {
        courseStats[slot.course].present++;
      } else {
        courseStats[slot.course].absent++;
      }
      courseStats[slot.course].total++;
    }
  });

  // Formulate static / realistic CIA marks based on course name
  const getCIAMarks = (courseName: string) => {
    // Generate deterministic mock marks based on student's name + course name length
    const baseVal = (currentStudent.name.length + courseName.length) % 10;
    
    // Scale Test 1 & 2 marks with actual attendance percentage to make it dynamic
    const attFactor = overallPercentage > 0 ? overallPercentage / 100 : 0.8;
    const test1 = Math.round((38 + baseVal % 5) * attFactor);
    const test2 = Math.round((40 + baseVal % 4) * attFactor);
    const assignment = Math.round(15 + baseVal % 6);
    const attendanceMark = Math.min(10, Math.ceil(overallPercentage / 10));

    return {
      test1: Math.min(50, test1),
      test2: Math.min(50, test2),
      assignment: Math.min(20, assignment),
      attendance: attendanceMark,
      total: Math.min(100, Math.round(((test1 + test2) / 100) * 80 + assignment + attendanceMark))
    };
  };

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
    const queryDay = getMappedDayForDate(dateStr, day);
    if (queryDay === "holiday") {
      return null;
    }
    // Find the slot for this class group at this time
    const slot = myClassSlots.find((s) => s.day === queryDay && s.time === time);
    if (!slot) return null;

    // Check if there is an approved handover (substitution) for this slot on this date
    const handover = (approvedHandovers || []).find((h) => h.slotId === slot.id && h.dateStr === dateStr);

    // Find if student has an attendance marked for this slot on this date
    const att = myAttendance.find((a) => a.slotId === slot.id && a.dateStr === dateStr);
    
    return {
      slot,
      handover,
      attendance: att || null
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
    // Fallback matching old logic
    const fallbackSlots = timeSlots || [];
    fallbackSlots.forEach((time, index) => {
      rows.push({ type: "slot", time });
      if (fallbackSlots.length === 5) {
        if (index === 1) {
          rows.push({ type: "break", label: " Break", timeRange: "Break Interval" });
        }
      } else {
        if (index === 1) {
          rows.push({ type: "break", label: " Break", timeRange: "11:00 AM - 11:15 AM" });
        } else if (index === 2) {
          rows.push({ type: "lunch", label: " Lunch Break", timeRange: "12:15 PM - 12:50 PM" });
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

  // Filter OPAC Books based on query
  const filteredBooks = MOCK_LIBRARY_BOOKS.filter((book) => {
    const q = librarySearch.toLowerCase();
    return (
      book.title.toLowerCase().includes(q) ||
      book.author.toLowerCase().includes(q) ||
      book.subject.toLowerCase().includes(q) ||
      book.id.toLowerCase().includes(q)
    );
  });

  // Handle Mock Fee Payment
  const triggerPayFee = (feeId: string) => {
    setPayingFeeId(feeId);
    setTimeout(() => {
      setPaidFees((prev) => ({ ...prev, [feeId]: true }));
      setPayingFeeId(null);
    }, 1200);
  };

  // Static/Deterministic mock fees list (kept for fallback)
  const mockFees = [
    { id: "fee_tuition", label: "Tuition Fees (Odd Semester)", amount: "₹45,000", dueDate: "2026-07-20" },
    { id: "fee_exam", label: "Semester Examination Fees", amount: "₹2,500", dueDate: "2026-08-05" },
    { id: "fee_library", label: "Library Resources Subscription Dues", amount: "₹1,200", dueDate: "2026-07-15" }
  ];

  // Real fee state from /api/fees
  const [feeData, setFeeData] = useState<any>(null);
  const [feeLoading, setFeeLoading] = useState(false);
  const [feePayModal, setFeePayModal] = useState<any | null>(null);
  const [feePayAmount, setFeePayAmount] = useState("");
  const [feePayMethod, setFeePayMethod] = useState("online");
  const [feePaySubmitting, setFeePaySubmitting] = useState(false);
  const [feePaySuccess, setFeePaySuccess] = useState<string | null>(null);

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
          if (t.class_group.toLowerCase().trim() !== (currentStudent?.classGroup || "").toLowerCase().trim()) return false;
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
                  { id: "marks", label: "Tests", icon: Award },
                  { id: "leave", label: "Leave & OD", icon: FileText },
                  { id: "tracker", label: "My Tasks & Grades", icon: GraduationCap },
                  { id: "exams", label: "Exams", icon: BookOpen },
                  { id: "library", label: "Library", icon: Book },
                  { id: "fees", label: "Fees", icon: CreditCard },
                  { id: "profile", label: "My Profile", icon: User }
                ].map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  const count = getNotificationCount(tab.id);
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as any)}
                      className={`w-full flex items-center rounded-2xl text-xs font-bold tracking-tight transition-all duration-200 cursor-pointer ${
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
            { id: "tracker", label: "Tasks", icon: GraduationCap },
            { id: "fees", label: "Fees", icon: CreditCard },
            { id: "more_menu", label: "More", icon: Menu },
          ].map(t => {
            const Icon = t.icon;
            const isActive = activeTab === t.id || (t.id === "more_menu" && ["marks", "leave", "exams", "library", "profile"].includes(activeTab));
            const pendingCount = t.id === "tracker"
              ? weeklyTasks.filter(task => {
                  if (task.class_group.toLowerCase().trim() !== (currentStudent?.classGroup || "").toLowerCase().trim()) return false;
                  const entry = studentTracker.find(e => e.student_id === currentStudent?.id && e.week_number === task.week_number && e.subject.toLowerCase().trim() === task.subject.toLowerCase().trim());
                  return !entry || !entry.submission_url;
                }).length
              : t.id === "fees" ? (feeData?.stats?.unpaidCount || 0) : 0;
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
              </button>
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
              {activeTab === "marks" && "Continuous Internal Assessment"}
              {activeTab === "leave" && "Student Leave & OD Tracker"}
              {activeTab === "exams" && "Semester Exams Seating"}
              {activeTab === "library" && "Library OPAC Catalog Search"}
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
              <button
                type="button"
                onClick={() => setActiveTab("marks")}
                className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl text-left hover:border-indigo-500 hover:ring-2 hover:ring-indigo-100 transition-all flex items-center gap-4 shadow-xs cursor-pointer group"
              >
                <div className="h-10 w-10 rounded-2xl bg-amber-50 dark:bg-amber-900/25 flex items-center justify-center text-amber-500 shrink-0 group-hover:scale-105 transition-transform">
                  <Award className="h-5 w-5" />
                </div>
                <div>
                  <span className="block text-xs font-bold text-slate-800 dark:text-slate-200">CIA Test Marks</span>
                  <span className="text-[10px] text-slate-450 dark:text-slate-400 font-medium">Internal assessment grades</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("leave")}
                className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl text-left hover:border-indigo-500 hover:ring-2 hover:ring-indigo-100 transition-all flex items-center gap-4 shadow-xs cursor-pointer group"
              >
                <div className="h-10 w-10 rounded-2xl bg-indigo-50 dark:bg-indigo-900/25 flex items-center justify-center text-indigo-500 shrink-0 group-hover:scale-105 transition-transform">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <span className="block text-xs font-bold text-slate-800 dark:text-slate-200">Leave & OD</span>
                  <span className="text-[10px] text-slate-455 dark:text-slate-400 font-medium">Apply and track requests</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("exams")}
                className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl text-left hover:border-indigo-500 hover:ring-2 hover:ring-indigo-100 transition-all flex items-center gap-4 shadow-xs cursor-pointer group"
              >
                <div className="h-10 w-10 rounded-2xl bg-rose-50 dark:bg-rose-900/25 flex items-center justify-center text-rose-500 shrink-0 group-hover:scale-105 transition-transform">
                  <BookOpen className="h-5 w-5" />
                </div>
                <div>
                  <span className="block text-xs font-bold text-slate-800 dark:text-slate-200">Exams Seating</span>
                  <span className="text-[10px] text-slate-455 dark:text-slate-400 font-medium">Seating and hall tickets</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("library")}
                className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl text-left hover:border-indigo-500 hover:ring-2 hover:ring-indigo-100 transition-all flex items-center gap-4 shadow-xs cursor-pointer group"
              >
                <div className="h-10 w-10 rounded-2xl bg-teal-50 dark:bg-teal-900/25 flex items-center justify-center text-teal-500 shrink-0 group-hover:scale-105 transition-transform">
                  <Book className="h-5 w-5" />
                </div>
                <div>
                  <span className="block text-xs font-bold text-slate-800 dark:text-slate-200">Library OPAC</span>
                  <span className="text-[10px] text-slate-455 dark:text-slate-400 font-medium">Search books and availability</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("profile")}
                className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl text-left hover:border-indigo-500 hover:ring-2 hover:ring-indigo-100 transition-all flex items-center gap-4 shadow-xs cursor-pointer group sm:col-span-2"
              >
                <div className="h-10 w-10 rounded-2xl bg-slate-100 dark:bg-slate-800/80 flex items-center justify-center text-slate-600 dark:text-slate-350 shrink-0 group-hover:scale-105 transition-transform">
                  <User className="h-5 w-5" />
                </div>
                <div>
                  <span className="block text-xs font-bold text-slate-800 dark:text-slate-200">My Profile</span>
                  <span className="text-[10px] text-slate-455 dark:text-slate-400 font-medium">Personal info and settings</span>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* Tab 1: Dashboard Attendance & Bunk Predictor */}
        {activeTab === "dashboard" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Left Columns (Col Span 2) */}
            <div className="lg:col-span-2 space-y-6">
              
              {/* Metrics cards row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                
                {/* 1. Attendance Card (Styled like GPA card in screenshot) */}
                <div className="bg-pastel-cream p-6 rounded-dribbble-card border-transparent relative flex flex-col justify-between shadow-xs min-h-[160px] group hover:shadow-md transition-all duration-300">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[10px] text-slate-500 font-extrabold uppercase tracking-widest block mb-1">Attendance GPA</span>
                      <span className="text-4xl font-extrabold text-slate-900">{(overallPercentage / 20).toFixed(1)}</span>
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                      <div className="p-2.5 bg-white/90 border border-slate-100 text-slate-800 rounded-full shrink-0 shadow-xs">
                        <ArrowUpRight className="h-4 w-4 text-slate-900 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wider ${
                        overallPercentage >= 75 ? "bg-emerald-100 text-emerald-800 border border-emerald-200/50" : "bg-rose-100 text-rose-800 border border-rose-200/50"
                      }`}>
                        {overallPercentage >= 75 ? "High" : "Low"}
                      </span>
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-450 font-semibold leading-relaxed mt-4">
                    Your attendance score translates to an elite academic standing. Keep it up!
                  </p>
                </div>

                {/* 2. On-time / Predictor Card (Styled like On-time rate card in screenshot) */}
                <div className="bg-pastel-blue p-6 rounded-dribbble-card border-transparent relative flex flex-col justify-between shadow-xs min-h-[160px] group hover:shadow-md transition-all duration-300">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[10px] text-slate-500 font-extrabold uppercase tracking-widest block mb-1">On-Time Rate</span>
                      <span className="text-4xl font-extrabold text-slate-900">{overallPercentage.toFixed(0)}%</span>
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                      <div className="p-2.5 bg-white/90 border border-slate-100 text-slate-800 rounded-full shrink-0 shadow-xs">
                        <ArrowUpRight className="h-4 w-4 text-slate-900 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wider ${
                        bunkStats.status === "safe" ? "bg-emerald-100 text-emerald-800 border border-emerald-200/50" : "bg-amber-100 text-amber-800 border border-amber-200/50"
                      }`}>
                        {bunkStats.status === "safe" ? "High" : "Alert"}
                      </span>
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-450 font-semibold leading-relaxed mt-4">
                    {bunkStats.status === "safe" ? (
                      <>You can safely skip the next <span className="font-extrabold text-slate-800 underline">{bunkStats.value} classes</span> consecutively without drops.</>
                    ) : (
                      <>You must attend the next <span className="font-bold text-slate-800 underline">{bunkStats.value} classes</span> to reach your {bunkTarget}% goal.</>
                    )}
                  </p>
                </div>

              </div>

              {/* My Tasks Card (Styled like My tasks card in screenshot) */}
              <div className="bg-white p-7 rounded-dribbble-panel border border-slate-100 shadow-xs space-y-6">
                <div className="flex items-center justify-between border-b border-slate-100/80 pb-4">
                  <div>
                    <h2 className="text-base font-extrabold text-slate-900 tracking-tight">My tasks</h2>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex rounded-full bg-slate-50 border border-slate-200/60 p-1">
                      {[
                        { id: "all", label: "All tasks" },
                        { id: "todo", label: "To do" },
                        { id: "progress", label: "In progress" },
                        { id: "done", label: "Done" }
                      ].map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setTasksFilter(t.id as any)}
                          className={`px-3 py-1 text-[10px] font-extrabold rounded-full transition-all cursor-pointer ${
                            tasksFilter === t.id
                              ? "bg-slate-900 text-white shadow-xs"
                              : "text-slate-500 hover:text-slate-900"
                          }`}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowAddTaskForm(!showAddTaskForm)}
                      className="p-1.5 rounded-full bg-slate-900 text-white hover:bg-slate-800 cursor-pointer shadow-xs transition-transform hover:scale-105"
                      title="Add task"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {/* Add Task Inline Form */}
                {showAddTaskForm && (
                  <form onSubmit={handleAddTask} className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3 animate-in fade-in duration-200">
                    <div className="text-xs font-bold text-slate-700">Add New Academic Task</div>
                    <input
                      type="text"
                      placeholder="Task description (e.g. Complete Chemistry practical report)"
                      value={newTaskTitle}
                      onChange={e => setNewTaskTitle(e.target.value)}
                      className="w-full p-2.5 border border-slate-205 rounded-xl bg-white text-xs font-semibold focus:ring-1 focus:ring-slate-800 outline-none shadow-xs"
                      required
                    />
                    <div className="grid grid-cols-2 gap-3">
                      <input
                        type="text"
                        placeholder="Subject (e.g. Chemistry)"
                        value={newTaskSubject}
                        onChange={e => setNewTaskSubject(e.target.value)}
                        className="p-2 border border-slate-205 rounded-xl bg-white text-xs font-semibold outline-none"
                      />
                      <input
                        type="text"
                        placeholder="Date (e.g. Jul 4)"
                        value={newTaskDate}
                        onChange={e => setNewTaskDate(e.target.value)}
                        className="p-2 border border-slate-205 rounded-xl bg-white text-xs font-semibold outline-none"
                      />
                    </div>
                    <div className="flex justify-end gap-2 pt-1">
                      <Button variant="secondary" size="sm" onClick={() => setShowAddTaskForm(false)}>Cancel</Button>
                      <Button type="submit" variant="primary" size="sm" className="bg-slate-900 text-white hover:bg-slate-800 border-none shadow-xs">Add Task</Button>
                    </div>
                  </form>
                )}

                {/* Tasks List */}
                <div className="space-y-3.5">
                  {tasks
                    .filter(t => tasksFilter === "all" || t.status === tasksFilter)
                    .map((task) => (
                      <div
                        key={task.id}
                        className="flex items-center justify-between p-4 bg-slate-50/50 border border-slate-100 rounded-2xl hover:bg-slate-50 hover:shadow-xs transition-all duration-200"
                      >
                        <div className="flex items-start gap-4">
                          <button
                            type="button"
                            onClick={() => toggleTaskStatus(task.id)}
                            className={`h-5 w-5 rounded-full border flex items-center justify-center shrink-0 mt-0.5 cursor-pointer transition-all duration-200 ${
                              task.status === "done"
                                ? "bg-emerald-500 border-emerald-550 text-white"
                                : task.status === "progress"
                                ? "bg-amber-400 border-amber-500 text-white"
                                : "bg-white border-slate-250 hover:border-slate-400"
                            }`}
                          >
                            {task.status === "done" && <Check className="h-3 w-3" />}
                            {task.status === "progress" && <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />}
                          </button>
                          <div>
                            <span className={`text-xs font-bold leading-tight block ${
                              task.status === "done" ? "text-slate-400 line-through font-semibold" : "text-slate-800"
                            }`}>
                              {task.title}
                            </span>
                            <span className="text-[9px] text-slate-400 font-extrabold uppercase mt-1 block tracking-wider">
                              {task.subject}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-[10px] text-slate-405 font-extrabold">{task.date}</span>
                          <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wider select-none ${
                            task.status === "done"
                              ? "bg-emerald-100 text-emerald-805 border border-emerald-200/50"
                              : task.status === "progress"
                              ? "bg-rose-105 text-rose-700 border border-rose-200/50"
                              : "bg-slate-100 text-slate-600 border border-slate-200/50"
                          }`}>
                            {task.status === "done" ? "Done" : task.status === "progress" ? "In progress" : "To do"}
                          </span>
                        </div>
                      </div>
                    ))}
                  {tasks.filter(t => tasksFilter === "all" || t.status === tasksFilter).length === 0 && (
                    <div className="text-center py-6 text-slate-400 text-xs italic font-semibold">
                      No tasks found in this section.
                    </div>
                  )}
                </div>
              </div>

            </div>

            {/* Right Column (Col Span 1) */}
            <div className="lg:col-span-1 space-y-6">
              
              {/* Class Attendance Grid Card */}
              <div className="bg-white p-7 rounded-dribbble-panel border border-slate-100 shadow-xs space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-extrabold text-slate-900 tracking-tight">Class attendance</h2>
                  <span className="px-2 py-0.5 bg-slate-50 border border-slate-100 rounded-lg text-[9px] font-black text-slate-500 uppercase tracking-widest">
                    Last 20 classes
                  </span>
                </div>

                <div className="space-y-4">
                  {/* Grid header */}
                  <div className="grid grid-cols-5 text-center text-[10px] font-black text-slate-400 uppercase tracking-wider">
                    <span>Mon</span>
                    <span>Tue</span>
                    <span>Wed</span>
                    <span>Thu</span>
                    <span>Fri</span>
                  </div>

                  {/* Dynamic grid mapping of attendance */}
                  <div className="grid grid-rows-4 gap-3.5">
                    {Array.from({ length: 4 }).map((_, weekIndex) => (
                      <div key={weekIndex} className="grid grid-cols-5 gap-3.5">
                        {Array.from({ length: 5 }).map((_, dayIndex) => {
                          const flatIndex = weekIndex * 5 + dayIndex;
                          const record = myAttendance[myAttendance.length - 1 - flatIndex];
                          
                          if (!record) {
                            return (
                              <div key={dayIndex} className="flex justify-center items-center">
                                <div 
                                  className="h-8 w-8 rounded-full flex items-center justify-center border border-dashed border-slate-200 bg-slate-50/50 text-slate-350 text-[10px]"
                                  title={`Period Slot ${flatIndex + 1} (Unmarked)`}
                                >
                                  -
                                </div>
                              </div>
                            );
                          }

                          const isPresent = record.status === "present";
                          
                          return (
                            <div key={dayIndex} className="flex justify-center items-center">
                              <div className={`h-8 w-8 rounded-full flex items-center justify-center transition-all ${
                                isPresent 
                                  ? "bg-emerald-50 text-emerald-650 border border-emerald-100 hover:scale-105 duration-200" 
                                  : "bg-rose-50 text-rose-650 border border-rose-100 hover:scale-105 duration-200"
                              }`} title={`Date: ${record.dateStr} (${record.status === "present" ? "Present" : "Absent"})`}>
                                {isPresent ? (
                                  <Check className="h-4.5 w-4.5 text-emerald-600 stroke-[3]" />
                                ) : (
                                  <X className="h-4 w-4 text-rose-600 stroke-[3]" />
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-slate-100/85 pt-4 text-[10px] font-extrabold uppercase text-slate-405">
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
                    <span>Present</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-rose-500 shrink-0" />
                    <span>Absent</span>
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
                  {myClassSlots.slice(0, 3).map((slot, index) => {
                    const mentor = mentors.find(m => m.id === slot.mentorId);
                    const teacherName = mentor?.name || "Dr. Instructor";
                    const initial = teacherName.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
                    
                    return (
                      <div key={slot.id || index} className="p-4 bg-slate-50/50 border border-slate-100 rounded-2xl flex items-center justify-between gap-4">
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
                            {slot.location || "Room A"}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                  {myClassSlots.length === 0 && (
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
          <div className="bg-white border border-slate-200 rounded-3xl p-6 space-y-4 shadow-sm">
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

            <div className="overflow-auto max-h-[70vh] rounded-2xl border border-slate-200 shadow-sm relative no-scrollbar">
              <table className="w-full table-fixed border-collapse text-left min-w-[800px]">
                <thead>
                  <tr className="text-xs text-slate-550 font-bold uppercase">
                    <th className="sticky top-0 left-0 z-30 p-4 w-[12%] text-slate-700 bg-slate-100/95 backdrop-blur-xs border-r border-b border-slate-200">Day / Date</th>
                    {(() => {
                      let slotCounter = 0;
                      return rows.map((col, idx) => {
                        if (col.type === "break" || col.type === "lunch") {
                          return (
                            <th key={idx} className="sticky top-0 z-20 p-4 text-xs font-bold text-slate-400 uppercase tracking-wider text-center select-none bg-slate-55/95 backdrop-blur-xs border-b border-slate-200 w-[8%]">
                              <div>{col.label}</div>
                              <div className="text-[9px] text-slate-450 font-normal mt-0.5">{formatTimeLabel(col.timeRange)}</div>
                            </th>
                          );
                        }
                        if (col.type === "slot") {
                          slotCounter++;
                          return (
                            <th key={col.time} className="sticky top-0 z-20 p-4 text-xs font-bold text-slate-700 bg-slate-55/95 backdrop-blur-xs border-b border-slate-200 w-[12%]">
                              <div>Period {slotCounter}</div>
                              <div className="text-[10px] text-slate-400 font-normal mt-0.5">{formatTimeLabel(col.time)}</div>
                            </th>
                          );
                        }
                        return null;
                      });
                    })()}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-150 bg-white">
                  {weekDates.map((date) => {
                    return (
                      <tr key={date.day} className="h-24 hover:bg-slate-55/10 transition-colors">
                        {/* First Cell: Day / Date */}
                        <td className="sticky left-0 z-10 p-3 text-xs font-bold text-slate-705 border-r border-slate-200 bg-slate-50/95 backdrop-blur-xs align-middle">
                          <div className="flex flex-col justify-center items-center">
                            <span className="text-sm font-black text-slate-900 leading-none">{date.day}</span>
                            <span className="text-[9px] text-slate-400 font-extrabold uppercase mt-1 leading-none">{date.formatted}</span>
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

                          return (
                            <td key={time} className="p-1.5 h-24 border-r border-slate-150 last:border-r-0 align-top bg-white">
                              {!cellData ? (
                                <div className="h-full flex items-center justify-center text-[9px] text-slate-400 italic border border-dashed border-slate-150 rounded-xl bg-slate-55/30">
                                  Free Period
                                </div>
                              ) : (
                                <div className="h-full flex flex-col justify-between p-2 rounded-xl border border-slate-200 bg-slate-50/20 shadow-sm relative overflow-hidden">
                                  <div className="space-y-1">
                                    <div className="text-[9px] font-extrabold text-indigo-650 truncate" title={cellData.handover?.course || cellData.slot.course}>
                                      {cellData.handover?.course || cellData.slot.course}
                                    </div>
                                    <div className="text-[8px] text-slate-450 font-bold truncate">
                                      {cellData.handover ? (
                                        <span className="text-slate-700 font-extrabold">{cellData.handover.coverStaffName}</span>
                                      ) : (
                                        mentors.find((m) => m.id === cellData.slot.mentorId)?.name || "Faculty"
                                      )}
                                    </div>
                                  </div>

                                  <div className="flex justify-between items-center text-[8.5px] mt-2 border-t border-slate-100 pt-1.5">
                                    <span className="flex items-center gap-0.5 text-slate-500 font-semibold bg-white border border-slate-200 px-1 rounded">
                                      <MapPin className="h-2 w-2 shrink-0" />
                                      {cellData.slot.location.split(" ")[0]}
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
                                      <span className="text-[8px] text-slate-400 italic">Unmarked</span>
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

        {/* Tab 3: Continuous Internal Assessment (CIA) */}
        {activeTab === "marks" && (
          <div className="bg-white border border-slate-200 rounded-3xl p-6 space-y-6 shadow-sm">
            <div>
              <h2 className="text-xs font-bold text-slate-550 uppercase tracking-wider">Continuous Internal Assessment (CIA)</h2>
              <p className="text-[11px] text-slate-450 mt-1">
                Real-time subject-wise continuous evaluation sheets and internal grade projection dashboard.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* GPA card summary */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 flex flex-col justify-between items-center text-center space-y-4">
                <h3 className="text-xs font-extrabold text-slate-650 uppercase tracking-wider">GPA Status</h3>
                
                <div className="h-24 w-24 rounded-full border-4 border-indigo-600 bg-white flex flex-col items-center justify-center shadow-inner">
                  <span className="text-2xl font-black text-indigo-700">8.42</span>
                  <span className="text-[8px] text-slate-450 uppercase font-black">SGPA</span>
                </div>

                <div className="text-[10px] text-slate-400">
                  Total Completed Credits: <span className="font-extrabold text-slate-800">22 / 22</span>
                </div>
              </div>

              <div className="md:col-span-2 overflow-x-auto rounded-2xl border border-slate-200 scroll-touch">
                <table className="w-full border-collapse text-left text-xs min-w-[600px]">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-550 font-bold uppercase text-[9px] whitespace-nowrap">
                      <th className="p-3">Course Title</th>
                      <th className="p-3 text-center">Test 1 (50)</th>
                      <th className="p-3 text-center">Test 2 (50)</th>
                      <th className="p-3 text-center">Assign. (20)</th>
                      <th className="p-3 text-center">Att. (10)</th>
                      <th className="p-3 text-center">CIA (100)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-150 bg-white font-medium">
                    {Object.keys(courseStats).length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-6 text-center text-slate-400 italic">No courses found.</td>
                      </tr>
                    ) : (
                      Object.keys(courseStats).map((courseName) => {
                        const marks = getCIAMarks(courseName);
                        return (
                          <tr key={courseName} className="hover:bg-slate-50/50 transition-colors">
                            <td className="p-3 font-extrabold text-slate-900 truncate max-w-[160px]">{courseName}</td>
                            <td className="p-3 text-center text-slate-700">{marks.test1}</td>
                            <td className="p-3 text-center text-slate-700">{marks.test2}</td>
                            <td className="p-3 text-center text-slate-700">{marks.assignment}</td>
                            <td className="p-3 text-center text-slate-700">{marks.attendance}</td>
                            <td className="p-3 text-center font-bold text-indigo-700">{marks.total}</td>
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

        {/* Tab 4: Leave & OD Applications */}
        {activeTab === "leave" && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Submission Form */}
            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
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
                  className="w-full py-2 btn-gradient text-white rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 shadow-sm transition-all hover:scale-[1.01] cursor-pointer"
                >
                  <Plus className="h-4 w-4" />
                  {submittingLeave ? "Submitting..." : "Submit Request"}
                </button>
              </form>
            </div>

            {/* Applications History log */}
            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4 md:col-span-2">
              <h2 className="text-xs font-bold text-slate-550 uppercase tracking-wider">Leave & OD Requests History</h2>
              
              {myLeaveRequests.length === 0 ? (
                <div className="text-center py-12 text-slate-400 italic text-xs">
                  No submitted leave or OD applications found.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-slate-150 scroll-touch">
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
                      {myLeaveRequests.map((req) => (
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
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 5: Exams & Seating */}
        {activeTab === "exams" && (
          <div className="bg-white border border-slate-200 rounded-3xl p-6 space-y-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-150 pb-3">
              <div>
                <h2 className="text-xs font-bold text-slate-550 uppercase tracking-wider">Examination Schedule & Tickets</h2>
                <p className="text-[11px] text-slate-450 mt-1">Download official hall tickets and verify allocated exam seating arrangements.</p>
              </div>

              <button
                type="button"
                onClick={() => toast("Hall Ticket download started. Check your downloads directory.", "info")}
                className="py-1.5 px-3 bg-indigo-50 hover:bg-indigo-100 border border-indigo-150 text-indigo-700 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Download className="h-4 w-4" />
                <span>Download Hall Ticket (PDF)</span>
              </button>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-slate-250 scroll-touch">
              <table className="w-full border-collapse text-left text-xs min-w-[600px]">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-550 font-bold uppercase text-[9px] whitespace-nowrap">
                    <th className="p-3">Date</th>
                    <th className="p-3">Subject / Course Code</th>
                    <th className="p-3">Session</th>
                    <th className="p-3">Block / Hall Room</th>
                    <th className="p-3 text-center">Seat No.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-150 bg-white font-medium">
                  {Object.keys(courseStats).length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-6 text-center text-slate-400 italic">No exams scheduled.</td>
                    </tr>
                  ) : (
                    Object.keys(courseStats).map((courseName, idx) => {
                      // Deterministic exam schedule details
                      const examDaysAhead = idx * 2 + 10;
                      const d = new Date();
                      d.setDate(d.getDate() + examDaysAhead);
                      const dateStr = d.toISOString().slice(0, 10);
                      const hall = `Hall ${101 + (idx % 3)}`;

                      return (
                        <tr key={courseName} className="hover:bg-slate-50/50 transition-colors">
                          <td className="p-3 text-slate-700 font-bold">{dateStr}</td>
                          <td className="p-3 font-extrabold text-slate-900 truncate max-w-[200px]">{courseName}</td>
                          <td className="p-3 text-slate-650">{idx % 2 === 0 ? "FN (09:30 AM - 12:30 PM)" : "AN (01:30 PM - 04:30 PM)"}</td>
                          <td className="p-3">
                            <span className="inline-flex items-center gap-1 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded text-[10px] text-slate-700 font-extrabold">
                              <MapPin className="h-3 w-3 shrink-0 text-slate-400" />
                              {hall} (Campus Block A)
                            </span>
                          </td>
                          <td className="p-3 text-center font-bold text-indigo-700">{idx * 4 + 17}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 6: Library OPAC Finder */}
        {activeTab === "library" && (
          <div className="bg-white border border-slate-200 rounded-3xl p-6 space-y-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-150 pb-3">
              <div>
                <h2 className="text-xs font-bold text-slate-550 uppercase tracking-wider">Library OPAC Book Finder</h2>
                <p className="text-[11px] text-slate-450 mt-1">Search the complete physical college library catalog and locate books instantly.</p>
              </div>

              {/* Search input bar */}
              <div className="relative w-full sm:w-72 shrink-0">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search books, authors, subjects..."
                  value={librarySearch}
                  onChange={(e) => setLibrarySearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white text-xs outline-none focus:ring-1 focus:ring-indigo-500 font-bold placeholder-slate-400"
                />
              </div>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-slate-250 scroll-touch">
              <table className="w-full border-collapse text-left text-xs min-w-[650px]">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-550 font-bold uppercase text-[9px] whitespace-nowrap">
                    <th className="p-3">Book ID</th>
                    <th className="p-3">Title</th>
                    <th className="p-3">Author</th>
                    <th className="p-3">Subject area</th>
                    <th className="p-3">Shelf Code</th>
                    <th className="p-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-150 bg-white font-medium">
                  {filteredBooks.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-6 text-center text-slate-400 italic">No matches found for search query.</td>
                    </tr>
                  ) : (
                    filteredBooks.map((book) => (
                      <tr key={book.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="p-3 text-slate-400 font-mono">{book.id}</td>
                        <td className="p-3 font-extrabold text-slate-900">{book.title}</td>
                        <td className="p-3 text-slate-650">{book.author}</td>
                        <td className="p-3 text-slate-450">{book.subject}</td>
                        <td className="p-3 text-slate-700 font-bold">{book.shelf}</td>
                        <td className="p-3">
                          {book.status === "Available" ? (
                            <span className="px-2 py-0.5 rounded bg-emerald-50 border border-emerald-100 text-emerald-700 text-[8.5px] font-black uppercase">
                              Available
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded bg-rose-50 border border-rose-100 text-rose-700 text-[8.5px] font-black uppercase flex flex-col items-start leading-none gap-0.5">
                              <span>Issued</span>
                              <span className="text-[7px] font-normal text-rose-500 font-mono">Due: {book.expectedReturn}</span>
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 7: Fees & Dues (Real Data) */}
        {activeTab === "fees" && (() => {
          if (!feeData && !feeLoading) fetchFeeData();
          const fmtR = (n: number) => "₹" + n.toLocaleString("en-IN", { maximumFractionDigits: 0 });

          if (feeLoading) return <div className="py-16 text-center text-sm text-slate-400">Loading your fee details…</div>;

          if (!feeData) return (
            <div className="bg-white border border-slate-200 rounded-3xl p-6 space-y-4 shadow-sm font-sans">
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
                  { label: "Status", value: stats.unpaidCount > 0 ? `${stats.unpaidCount} Unpaid` : "All Clear Yes", color: stats.unpaidCount > 0 ? "text-[#D528A2]" : "text-[#F4A863]", bg: "bg-slate-50" },
                ].map(({ label, value, color, bg }) => (
                  <div key={label} className={`rounded-2xl p-3.5 border border-slate-100 ${bg}`}>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{label}</p>
                    <p className={`text-base font-extrabold mt-1 ${color}`}>{value}</p>
                  </div>
                ))}
              </div>

              <div className="bg-white border border-slate-200 rounded-3xl p-5 space-y-3 shadow-sm">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider">Fee Breakdown</h3>
                  <button onClick={fetchFeeData} className="p-1.5 rounded-xl border border-slate-200 text-slate-400 hover:text-[#D528A2] cursor-pointer transition-colors"><RefreshCw className="h-3 w-3" /></button>
                </div>
                {fees.map((fee: any) => (
                  <div key={fee.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-2xl border border-slate-150 bg-slate-50/50 gap-3">
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
                          <a
                            href={fee.pay_link || "https://google.com"}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="py-1.5 px-4 btn-gradient text-white rounded-xl text-[10px] font-extrabold shadow-sm transition-all cursor-pointer inline-block text-center"
                          >
                            Pay Now
                          </a>
                        </>
                      )}
                    </div>
                  </div>
                ))}
                {fees.length === 0 && <p className="text-xs text-slate-400 text-center py-6">No fee records found.</p>}
              </div>

              {payments.length > 0 && (
                <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm">
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
                  <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-7">
                    {feePaySuccess ? (
                      <div className="text-center space-y-4">
                        <div className="h-14 w-14 rounded-full bg-slate-100 flex items-center justify-center mx-auto">
                          <CheckCircle2 className="h-8 w-8 text-[#D528A2]" />
                        </div>
                        <h3 className="text-lg font-extrabold text-slate-800">Payment Successful!</h3>
                        <p className="text-sm text-slate-500">Receipt No: <span className="font-bold text-[#D528A2]">{feePaySuccess}</span></p>
                        <button onClick={() => setFeePayModal(null)} className="w-full py-3 rounded-2xl btn-gradient text-white font-bold cursor-pointer transition-colors">Close</button>
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
                            <button onClick={() => setFeePayModal(null)} className="flex-1 py-2.5 rounded-2xl border border-slate-200 text-sm font-bold text-slate-600 cursor-pointer hover:bg-slate-50">Cancel</button>
                            <button onClick={handleFeePayment} disabled={!feePayAmount || feePaySubmitting} className="flex-1 py-2.5 rounded-2xl btn-gradient text-white text-sm font-bold cursor-pointer disabled:opacity-50">
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

        {/* Student Tracker Tab */}
        {activeTab === "tracker" && (
          <div className="space-y-6 font-sans">
            {/* Dropdown select for Subject */}
            <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs flex flex-wrap gap-4 items-center justify-between">
              <div className="space-y-1.5 flex-grow max-w-md">
                <label className="text-[10px] text-slate-455 font-extrabold uppercase tracking-wider block">Select Course Subject</label>
                <select
                  value={studentTrackerSubject}
                  onChange={(e) => setStudentTrackerSubject(e.target.value)}
                  className="w-full text-xs font-semibold px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-indigo-500 bg-white text-slate-800"
                >
                  {studentSubjects.map(s => (
                    <option key={s.id} value={s.name}>{s.name}</option>
                  ))}
                  {studentSubjects.length === 0 && <option value="">No subjects in this semester</option>}
                </select>
              </div>
              <div className="bg-indigo-50/50 border border-indigo-100 px-4 py-3 rounded-2xl max-w-sm text-right shrink-0">
                <div className="text-[10px] text-indigo-700 font-extrabold uppercase">Tracker Academic Session</div>
                <div className="text-xs font-bold text-slate-800 mt-0.5">{studentClassDetails.sem} • {studentClassDetails.year}</div>
              </div>
            </div>

            {/* Weeks List */}
            <div className="space-y-4">
              {Array.from({ length: 15 }, (_, i) => i + 1).map(wk => {
                const task = weeklyTasks.find(
                  t => t.class_group.toLowerCase().trim() === (currentStudent?.classGroup || "").toLowerCase().trim() &&
                       t.subject.toLowerCase().trim() === studentTrackerSubject.toLowerCase().trim() &&
                       t.week_number === wk
                );

                const entry = studentTracker.find(
                  e => e.student_id === currentStudent?.id &&
                       e.class_group.toLowerCase().trim() === (currentStudent?.classGroup || "").toLowerCase().trim() &&
                       e.subject.toLowerCase().trim() === studentTrackerSubject.toLowerCase().trim() &&
                       e.week_number === wk
                );

                const currentUrl = entry?.submission_url || "";
                const isSubmitting = submittingUrlMap[wk] || false;

                return (
                  <div key={wk} className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs space-y-4 hover:shadow-sm transition-all duration-200">
                    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-3">
                      <div className="flex items-center gap-2">
                        <span className="h-6.5 w-6.5 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-700 font-black text-xs flex items-center justify-center">
                          {wk}
                        </span>
                        <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">Week {wk} Task</h4>
                        {wk % 2 === 0 && (
                          <span className="px-2 py-0.5 bg-rose-100 text-rose-700 rounded-lg text-[9px] font-bold tracking-wide border border-rose-200">
                            ASSESSMENT / VIVA
                          </span>
                        )}
                      </div>

                      {/* Grades / Status Badge */}
                      {entry?.marks !== undefined && entry?.marks !== null ? (
                        <div className="flex items-center gap-2">
                          {entry?.viva_assessment && (
                            <span className="text-[9px] font-black uppercase text-indigo-700 bg-indigo-50 border border-indigo-200/80 px-2 py-0.5 rounded-md">
                              {entry.viva_assessment}
                            </span>
                          )}
                          <span className="text-[9px] text-slate-400 font-extrabold uppercase tracking-wide">Graded</span>
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-lg border text-xs font-black uppercase tracking-wider ${
                            entry.marks >= 8
                              ? "bg-teal-50 border-teal-150 text-teal-700"
                              : entry.marks >= 5
                                ? "bg-amber-50 border-amber-150 text-amber-700"
                                : "bg-rose-50 border-rose-150 text-rose-700"
                          }`}>
                            {entry.marks} / 10
                          </span>
                        </div>
                      ) : currentUrl ? (
                        <span className="text-[9.5px] font-black text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-lg border border-emerald-200/50 uppercase tracking-wide">
                          Submitted
                        </span>
                      ) : task ? (
                        <span className="text-[9.5px] font-black text-amber-600 bg-amber-50 px-2.5 py-0.5 rounded-lg border border-amber-200/50 uppercase tracking-wide">
                          {wk % 2 === 0 ? "Awaiting Assessment / Viva" : "Pending Submission"}
                        </span>
                      ) : (
                        <span className="text-[9.5px] font-black text-slate-400 bg-slate-50 px-2.5 py-0.5 rounded-lg border border-slate-200/50 uppercase tracking-wide">
                          No Task Assigned
                        </span>
                      )}
                    </div>

                    {task ? (
                      (() => {
                        const assignedDate = parseDbDate(task.created_at || task.updated_at);
                        const deadlineDate = new Date(assignedDate.getTime() + 3 * 24 * 60 * 60 * 1000);
                        const isPastDeadline = new Date() > deadlineDate;

                        return (
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* Task Details */}
                            <div className="space-y-3">
                              <div className="space-y-1.5">
                                <span className="text-[9px] text-slate-400 font-extrabold uppercase tracking-wider block">Assignment Description</span>
                                <p className="text-xs font-bold text-slate-800 leading-normal">{task.task_name}</p>
                              </div>
                              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-2">
                                <div className="space-y-0.5">
                                  <span className="text-[8px] text-slate-400 font-bold uppercase tracking-wider block">Assigned On</span>
                                  <span className="text-[10px] text-slate-700 font-semibold">{assignedDate.toLocaleDateString()} {assignedDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                </div>
                                <div className="space-y-0.5">
                                  <span className="text-[8px] text-slate-400 font-bold uppercase tracking-wider block">Deadline</span>
                                  <span className={`text-[10px] font-bold ${isPastDeadline ? 'text-rose-600' : 'text-indigo-600'}`}>
                                    {deadlineDate.toLocaleDateString()} {deadlineDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                  </span>
                                </div>
                              </div>
                               <div className="pt-2">
                                 <a
                                   href={task.task_pdf_url}
                                   target="_blank"
                                   rel="noreferrer"
                                   className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/20 dark:hover:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-200 shadow-xs hover:shadow-sm cursor-pointer"
                                 >
                                   <FileText className="h-4 w-4 shrink-0 text-indigo-500 animate-pulse-gentle" />
                                   <span>Download Reference Document / PDF</span>
                                 </a>
                               </div>
                            </div>

                                              <div className="space-y-4 lg:border-l lg:border-slate-100 lg:pl-6">
                               <div className="space-y-1.5">
                                 <span className="text-[9px] text-slate-400 font-extrabold uppercase tracking-wider block">Your Submission</span>

                                 {currentUrl && !editSubmissionMode[wk] ? (
                                   <div className="space-y-3 mt-2">
                                     <div className="rounded-2xl border border-slate-150 p-4 bg-slate-50/50 space-y-3 shadow-xs">
                                       <div className="flex items-start justify-between gap-3">
                                         <div className="space-y-1 truncate">
                                           <span className="text-[8px] text-slate-400 font-extrabold uppercase tracking-wider block">Submitted Link / File</span>
                                           {currentUrl.startsWith("https://example.com/simulated-upload/") ? (
                                             <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                                               <FileText className="h-4 w-4 text-indigo-500 shrink-0" />
                                               <span className="truncate">{decodeURIComponent(currentUrl.replace("https://example.com/simulated-upload/", ""))}</span>
                                             </div>
                                           ) : (
                                             <a
                                               href={currentUrl}
                                               target="_blank"
                                               rel="noreferrer"
                                               className="inline-flex items-center gap-1 text-xs font-bold text-indigo-650 hover:underline truncate"
                                             >
                                               <span className="truncate">{currentUrl}</span>
                                               <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-indigo-500" />
                                             </a>
                                           )}
                                         </div>
                                         <button
                                           type="button"
                                           disabled={isPastDeadline}
                                           onClick={() => setEditSubmissionMode(prev => ({ ...prev, [wk]: true }))}
                                           className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 hover:text-slate-900 font-bold text-[10px] transition-colors cursor-pointer disabled:opacity-50 shrink-0 shadow-xs"
                                         >
                                           <Edit2 className="h-3 w-3 text-slate-400" />
                                           <span>Edit</span>
                                         </button>
                                       </div>

                                       {entry?.updated_at && (
                                         <div className="flex items-center gap-1.5 text-[9px] text-slate-500 font-medium border-t border-slate-150/60 pt-2.5">
                                           <Clock className="h-3.5 w-3.5 text-slate-400" />
                                           <span>Submitted on:</span>
                                           <span className="font-bold text-slate-700">{parseDbDate(entry.updated_at).toLocaleString()}</span>
                                         </div>
                                       )}
                                     </div>
                                   </div>
                                 ) : (
                                   <div className="space-y-3 mt-2">
                                     {/* Toggle Selection */}
                                     <div className="flex gap-2">
                                       <button
                                         type="button"
                                         disabled={isPastDeadline || isSubmitting}
                                         onClick={() => setStudentUploadType(prev => ({ ...prev, [wk]: "url" }))}
                                         className={`flex-1 py-2 text-xs font-bold rounded-lg border transition-all ${
                                           (studentUploadType[wk] || "url") === "url" 
                                             ? "bg-[#D528A2]/10 border-[#D528A2]/30 text-[#D528A2]" 
                                             : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
                                         }`}
                                       >
                                         URL Link
                                       </button>
                                       <button
                                         type="button"
                                         disabled={isPastDeadline || isSubmitting}
                                         onClick={() => setStudentUploadType(prev => ({ ...prev, [wk]: "file" }))}
                                         className={`flex-1 py-2 text-xs font-bold rounded-lg border transition-all ${
                                           (studentUploadType[wk] || "url") === "file" 
                                             ? "bg-[#D528A2]/10 border-[#D528A2]/30 text-[#D528A2]" 
                                             : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
                                         }`}
                                       >
                                         Upload File
                                       </button>
                                     </div>

                                     {(studentUploadType[wk] || "url") === "url" ? (
                                       <form
                                         onSubmit={async (e) => {
                                           e.preventDefault();
                                           if (isPastDeadline) return;
                                           const form = e.target as HTMLFormElement;
                                           const urlInput = form.elements.namedItem("submissionUrl") as HTMLInputElement;
                                           const url = urlInput.value.trim();
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
                                             toast(res.message || "Submission failed.", "error");
                                           } else {
                                             toast("Submission URL saved!", "success");
                                             setEditSubmissionMode(prev => ({ ...prev, [wk]: false }));
                                           }
                                         }}
                                         className="flex flex-col sm:flex-row gap-2 mt-2"
                                       >
                                         <input
                                           type="url"
                                           required
                                           name="submissionUrl"
                                           defaultValue={currentUrl.startsWith("https://example.com/simulated-upload/") ? "" : currentUrl}
                                           disabled={isPastDeadline || isSubmitting}
                                           placeholder="e.g. GitHub Repository link, Drive PDF link"
                                           className="flex-1 text-xs font-semibold px-3 py-2.5 rounded-xl border border-slate-205 focus:outline-none focus:border-[#D528A2] bg-white text-slate-805 disabled:bg-slate-50 disabled:text-slate-400"
                                         />
                                         <div className="flex gap-2 shrink-0">
                                           <button
                                             type="submit"
                                             disabled={isPastDeadline || isSubmitting}
                                             className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm ${
                                               isPastDeadline 
                                                 ? "bg-slate-200 text-slate-500 cursor-not-allowed" 
                                                 : "bg-gradient-to-r from-[#D528A2] to-[#F4A863] text-white hover:opacity-90 disabled:opacity-50 cursor-pointer"
                                             }`}
                                           >
                                             {isPastDeadline ? "Deadline Passed" : isSubmitting ? "Submitting..." : currentUrl ? "Update" : "Submit"}
                                           </button>
                                           {currentUrl && (
                                             <button
                                               type="button"
                                               onClick={() => setEditSubmissionMode(prev => ({ ...prev, [wk]: false }))}
                                               className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold transition-all border border-slate-200 cursor-pointer"
                                             >
                                               Cancel
                                             </button>
                                           )}
                                         </div>
                                       </form>
                                     ) : (
                                       <div className="space-y-2 mt-2">
                                         <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-slate-300 border-dashed rounded-xl cursor-pointer bg-slate-50 hover:bg-slate-100 hover:border-[#D528A2]/45 transition-all">
                                           <div className="flex flex-col items-center justify-center pt-4 pb-4">
                                             <Upload className="w-5 h-5 mb-1 text-slate-400 animate-pulse-gentle" />
                                             <p className="text-[10px] text-slate-500 font-medium">Click to upload answer file</p>
                                             <p className="text-[9px] text-slate-400 font-semibold mt-0.5">PDF, DOCX, ZIP (MAX. 10MB)</p>
                                           </div>
                                           <input 
                                             type="file" 
                                             className="hidden" 
                                             accept=".pdf,.docx,.doc,.zip,.rar" 
                                             disabled={isPastDeadline || isSubmitting}
                                             onChange={async (e) => {
                                               if (e.target.files && e.target.files[0]) {
                                                 const file = e.target.files[0];
                                                 setSubmittingUrlMap(prev => ({ ...prev, [wk]: true }));
                                                 const simulatedUrl = "https://example.com/simulated-upload/" + encodeURIComponent(file.name);
                                                 const res = await gradeStudentTask({
                                                   studentId: currentStudent?.id || "",
                                                   classGroup: currentStudent?.classGroup || "",
                                                   subject: studentTrackerSubject,
                                                   weekNumber: wk,
                                                   submissionUrl: simulatedUrl
                                                 });
                                                 setSubmittingUrlMap(prev => ({ ...prev, [wk]: false }));
                                                 if (!res.success) {
                                                   toast(res.message || "File upload failed.", "error");
                                                 } else {
                                                   toast(`Uploaded: ${file.name} successfully!`, "success");
                                                   setEditSubmissionMode(prev => ({ ...prev, [wk]: false }));
                                                 }
                                               }
                                             }}
                                           />
                                         </label>
                                         
                                         {currentUrl.startsWith("https://example.com/simulated-upload/") && (
                                           <div className="text-[10px] text-emerald-600 font-bold flex items-center justify-between bg-emerald-50 px-3 py-2 rounded-lg border border-emerald-250">
                                             <div className="flex items-center gap-1.5 truncate">
                                               <span>Current File:</span>
                                               <span className="text-slate-700 truncate">{decodeURIComponent(currentUrl.replace("https://example.com/simulated-upload/", ""))}</span>
                                             </div>
                                             <a 
                                               href={currentUrl} 
                                               target="_blank" 
                                               rel="noreferrer" 
                                               className="text-[10px] text-[#D528A2] hover:underline shrink-0 ml-2"
                                             >
                                               View Document
                                             </a>
                                           </div>
                                         )}

                                         {currentUrl && (
                                           <div className="flex justify-end pt-1">
                                             <button
                                               type="button"
                                               onClick={() => setEditSubmissionMode(prev => ({ ...prev, [wk]: false }))}
                                               className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold transition-all border border-slate-200 cursor-pointer"
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


                          {/* Feedback */}
                          {entry?.viva_assessment && (
                            <div className="bg-indigo-50/50 border border-indigo-100/50 p-3 rounded-2xl space-y-1">
                              <span className="text-[9px] text-indigo-700 font-extrabold uppercase tracking-wider block">Faculty Feedback (VIVA / Assessment)</span>
                              <p className="text-[11px] font-semibold text-indigo-950 italic leading-relaxed">
                                &ldquo;{entry.viva_assessment}&rdquo;
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                        );
                      })()
                    ) : (
                      <div className="py-2">
                        <p className="text-xs text-slate-400 italic">No tasks have been assigned by your mentor for this week yet.</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Tab 8: My Profile */}
        {activeTab === "profile" && currentStudent && (() => {
          const isProfileEditAllowed = allowedProfileEditClasses.includes(currentStudent.classGroup);
          return (
            <form onSubmit={handleSaveProfile} className="space-y-6 font-sans">
              {/* Access Controller Banner */}
              <div className="flex justify-between items-center bg-white p-4.5 rounded-3xl border border-slate-100 shadow-sm flex-wrap gap-4">
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
                <div className="flex items-center gap-3 bg-indigo-50 border border-indigo-150 p-4.5 rounded-3xl justify-end flex-wrap">
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
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Register Number</span>
                      {isEditingProfile ? (
                        <input
                          type="text"
                          value={editRegisterNumber}
                          onChange={e => setEditRegisterNumber(e.target.value)}
                          placeholder="e.g. 2113411033001"
                          className="w-full px-3 py-1.5 border border-slate-200 rounded-xl bg-white text-xs font-bold focus:ring-1 focus:ring-indigo-500 outline-none text-slate-800"
                        />
                      ) : (
                        <span className="text-xs font-extrabold text-slate-800 block">{currentStudent.register_number || <span className="text-slate-400 italic">Not Added</span>}</span>
                      )}
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
                        <span className="text-xs font-extrabold text-slate-855 block">{currentStudent.aadhar_number || <span className="text-slate-400 italic">Not Added</span>}</span>
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
                  <div className="p-4 bg-white/80 rounded-2xl border border-slate-100/40">
                    <span className="text-3xl font-extrabold text-slate-900">{overallPercentage.toFixed(1)}%</span>
                    <span className="text-[9px] text-slate-455 font-extrabold uppercase tracking-wider block mt-1">Average Attendance</span>
                  </div>
                  <div className="p-4 bg-white/80 rounded-2xl border border-slate-100/40">
                    <span className="text-3xl font-extrabold text-slate-900">{(overallPercentage / 20).toFixed(2)}</span>
                    <span className="text-[9px] text-slate-455 font-extrabold uppercase tracking-wider block mt-1">Attendance GPA</span>
                  </div>
                  <div className="p-4 bg-white/80 rounded-2xl border border-slate-100/40">
                    <span className="text-3xl font-extrabold text-slate-900">{totalClasses}</span>
                    <span className="text-[9px] text-slate-455 font-extrabold uppercase tracking-wider block mt-1">Total Slots Marked</span>
                  </div>
                  <div className="p-4 bg-white/80 rounded-2xl border border-slate-105/40">
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
