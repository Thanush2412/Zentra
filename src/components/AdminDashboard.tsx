"use client";

import React, { useState, useEffect } from "react";
import { useApp, SHIFT_TIME_SLOTS, Slot, Mentor, AuditLog, College, Subject, Department } from "@/context/AppContext";
import { useToast } from "@/context/ToastContext";
import { 
  Building2, 
  Users, 
  Grid, 
  History, 
  Search, 
  MapPin, 
  Clock, 
  Network, 
  Briefcase, 
  ShieldAlert, 
  ShieldCheck,
  ChevronRight, 
  ChevronDown,
  ChevronsLeft,
  ChevronsRight,
  Layers,
  GraduationCap,
  Plus,
  Edit,
  Trash2,
  X,
  Eye,
  UserCheck,
  Megaphone,
  Calendar,
  CalendarDays,
  LayoutDashboard,
  BookOpen,
  Menu,
  Sparkles,
  Sun,
  Moon
} from "lucide-react";
import { formatDate, formatTimeLabel, isMentorInProgram, getDeptFromClassGroup, calculateShiftSchedule, parseTimeToMinutes, formatMinutesToTime, ScheduleItem, ShiftParams, ShiftBreak } from "@/lib/utils";
import { MentorProfileModal } from "./MentorProfileModal";

const generateCodeFromName = (name: string): string => {
  const words = name.replace(/with|and|for/gi, "").split(/\s+/).filter(Boolean);
  let code = words.map(w => {
    const cleanWord = w.replace(/[^a-zA-Z]/g, "");
    if (!cleanWord) return "";
    if (cleanWord.toLowerCase() === "bsc") return "BSC";
    if (cleanWord.toLowerCase() === "bba") return "BBA";
    if (cleanWord.toLowerCase() === "bcom") return "BCOM";
    return cleanWord[0].toUpperCase();
  }).filter(Boolean).join("-");
  return code || "";
};

const formatYearWiseRooms = (defaultRoomStr?: string) => {
  if (!defaultRoomStr) return "None";
  if (!defaultRoomStr.startsWith("{")) return defaultRoomStr;
  try {
    const parsed = JSON.parse(defaultRoomStr);
    return Object.keys(parsed)
      .map(year => `Year ${year}: ${parsed[year]}`)
      .join(", ");
  } catch (_) {
    return defaultRoomStr;
  }
};

interface CAMUserFromDB {
  id: string;
  name: string;
  email: string;
  college_id: string;
  college_name: string;
  kam_id: string;
}

interface KAMUserFromDB {
  id: string;
  name: string;
  email: string;
  title: string;
}


export interface AdminDashboardProps {
  activeTab?: "overview" | "campuses" | "kams" | "cams" | "mentors" | "subjects" | "schedules" | "hierarchy" | "logs" | "courses" | "announcements" | "holidays" | "sessions" | "users" | "smes" | "more_menu";
  onTabChange?: (tab: "overview" | "campuses" | "kams" | "cams" | "mentors" | "subjects" | "schedules" | "hierarchy" | "logs" | "courses" | "announcements" | "holidays" | "sessions" | "users" | "smes" | "more_menu") => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  activeTab: propActiveTab,
  onTabChange
}) => {
  const {
    currentAdmin,
    colleges,
    mentors,
    students,
    slots,
    auditLogs,
    subjectsList,
    createCollege,
    updateCollege,
    deleteCollege,
    createKAM,
    updateKAM,
    deleteKAM,
    createCAM,
    updateCAM,
    deleteCAM,
    createMentor,
    updateMentor,
    deleteMentor,
    createSubject,
    updateSubject,
    deleteSubject,
    coursesList,
    createCourse,
    updateCourse,
    deleteCourse,
    refreshData,
    subjectGroups,
    createSubjectGroup,
    updateSubjectGroup,
    deleteSubjectGroup,
    smes,
    createSmeUser,
    updateSmeUser,
    deleteSmeUser,
    signupRequests,
    approveSignupRequest,
    rejectSignupRequest,
    deleteSignupRequest
  } = useApp();
  const { toast, confirm: showConfirm } = useToast();

  const navGroups = [
    {
      title: "Dashboard",
      icon: LayoutDashboard,
      items: [
        { id: "overview", label: "Overview", icon: LayoutDashboard }
      ]
    },
    {
      title: "Organization",
      icon: Building2,
      items: [
        { id: "campuses", label: "Campuses", icon: Building2 },
        { id: "courses", label: "Courses", icon: Network },
        { id: "subjects", label: "Subjects", icon: GraduationCap }
      ]
    },
    {
      title: "People",
      icon: Users,
      items: [
        { id: "kams", label: "Key Account Managers", icon: Briefcase },
        { id: "cams", label: "Campus Managers", icon: Users },
        { id: "mentors", label: "Faculty Mentors", icon: UserCheck },
        { id: "smes", label: "Subject Matter Experts", icon: BookOpen },
        { id: "users", label: "User Credentials", icon: ShieldCheck }
      ]
    },
    {
      title: "Operations",
      icon: Grid,
      items: [
        { id: "schedules", label: "Schedules", icon: Grid },
        { id: "holidays", label: "Holidays", icon: Calendar },
        { id: "announcements", label: "Announcements", icon: Megaphone }
      ]
    },
    {
      title: "System",
      icon: History,
      items: [
        { id: "sessions", label: "Login Sessions", icon: History },
        { id: "logs", label: "Audit Logs", icon: History }
      ]
    }
  ];

  const [localActiveTab, setLocalActiveTab] = useState<"overview" | "campuses" | "kams" | "cams" | "mentors" | "subjects" | "schedules" | "hierarchy" | "logs" | "courses" | "announcements" | "holidays" | "sessions" | "users" | "smes" | "more_menu">("overview");
  const activeTab = propActiveTab || localActiveTab;
  const setActiveTab = onTabChange || setLocalActiveTab;

  const [isCollapsed, setIsCollapsed] = useState(false);
  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("fp_sidebar_collapsed") === "true";
      setIsCollapsed(stored);
    }
  }, []);
  const [drillDownCollegeId, setDrillDownCollegeId] = useState<string | null>(null);

  // New features relational lists
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [holidays, setHolidays] = useState<any[]>([]);
  const [loginHistory, setLoginHistory] = useState<any[]>([]);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);

  // User tab sub-navigation & Signup approval modal states
  const [userSubTab, setUserSubTab] = useState<"directory" | "signups">("directory");
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [approvingSignup, setApprovingSignup] = useState<any | null>(null);
  const [mappingType, setMappingType] = useState<"create_new" | "link_existing">("create_new");
  const [selectedReferenceId, setSelectedReferenceId] = useState("");
  const [mappingCollegeId, setMappingCollegeId] = useState("");
  const [mappingDept, setMappingDept] = useState("");
  const [mappingClassGroup, setMappingClassGroup] = useState("");
  const [approvingRole, setApprovingRole] = useState("student");

  // Announcement compose modal state
  const [showAnnModal, setShowAnnModal] = useState(false);
  const [annForm, setAnnForm] = useState({ title: "", description: "", target_role: "All", college_id: "" });

  // Holiday compose modal state
  const [showHolModal, setShowHolModal] = useState(false);
  const [holForm, setHolForm] = useState({ title: "", date: "", type: "National Holiday", college_id: "" });

  // Stats from custom DB fetch
  const [camList, setCamList] = useState<CAMUserFromDB[]>([]);
  const [kamList, setKamList] = useState<KAMUserFromDB[]>([]);
  const [isDataLoading, setIsDataLoading] = useState(true);

  // Modal states
  const [showCampusModal, setShowCampusModal] = useState(false);
  const [campusSuccessCreatedId, setCampusSuccessCreatedId] = useState<string | null>(null);
  const [campusForm, setCampusForm] = useState<{
    id: string;
    name: string;
    address: string;
    kam_id: string;
    has_shifts: number;
    shift_configs?: string;
    rooms: string;
    code: string;
    academic_year: string;
    manager: string;
    working_days?: number;
  }>({
    id: "",
    name: "",
    address: "",
    kam_id: "",
    has_shifts: 1,
    shift_configs: "",
    rooms: "",
    code: "",
    academic_year: "2026-2027",
    manager: "",
    working_days: 5
  });
  const [editingCampus, setEditingCampus] = useState<boolean>(false);
  const [campusFieldErrors, setCampusFieldErrors] = useState<Record<string, boolean>>({});
  const [courseFieldErrors, setCourseFieldErrors] = useState<Record<string, boolean>>({});
  const [campusWizardStep, setCampusWizardStep] = useState<number>(1);
  const [wizardCourses, setWizardCourses] = useState<any[]>([]);
  const [wizardCourseForm, setWizardCourseForm] = useState<{
    name: string;
    years: number;
    sections: Record<number, number>;
    sectionRooms: Record<string, string>;
    default_shift: string;
    start_date: string;
    end_date: string;
    start_year: string;
    end_year: string;
    description: string;
  }>({
    name: "",
    years: 3,
    sections: { 1: 1, 2: 1, 3: 1, 4: 1, 5: 1 },
    sectionRooms: {},
    default_shift: "general",
    start_date: "",
    end_date: "",
    start_year: "",
    end_year: "",
    description: ""
  });
  const [shift1Timings, setShift1Timings] = useState("");
  const [shift2Timings, setShift2Timings] = useState("");
  const [generalTimings, setGeneralTimings] = useState("");
  
  const [activeConfigShift, setActiveConfigShift] = useState<"shift_1" | "shift_2" | "general">("general");
  const [shiftConfigsParams, setShiftConfigsParams] = useState<Record<"shift_1" | "shift_2" | "general", ShiftParams>>({
    shift_1: { label: "Shift 1", startTime: "08:30 AM", periodDuration: 50, periodsCount: 5, mode: "duration", breaks: [] },
    shift_2: { label: "Shift 2", startTime: "01:00 PM", periodDuration: 50, periodsCount: 5, mode: "duration", breaks: [] },
    general: { label: "General Shift", startTime: "09:00 AM", periodDuration: 50, periodsCount: 6, mode: "duration", breaks: [] }
  });
  const [activeConfigSemester, setActiveConfigSemester] = useState<string>("All Semesters");
  const [semesterConfigsMap, setSemesterConfigsMap] = useState<Record<string, Record<"shift_1" | "shift_2" | "general", ShiftParams>>>({});
  const [newBreakName, setNewBreakName] = useState("");
  const [newBreakDuration, setNewBreakDuration] = useState(15);
  const [newBreakAfterPeriod, setNewBreakAfterPeriod] = useState(2);

  const [showKamModal, setShowKamModal] = useState(false);
  const [kamForm, setKamForm] = useState<{ id: string; name: string; email: string; title: string }>({ id: "", name: "", email: "", title: "" });
  const [editingKam, setEditingKam] = useState<boolean>(false);

  const [showCamModal, setShowCamModal] = useState(false);
  const [camForm, setCamForm] = useState<{ id: string; name: string; email: string; college_id: string; kam_id: string }>({ id: "", name: "", email: "", college_id: "", kam_id: "" });
  const [editingCam, setEditingCam] = useState<boolean>(false);

  // Department CRUD states
  const [showDeptModal, setShowDeptModal] = useState(false);
  const [deptForm, setDeptForm] = useState<{
    id: string;
    name: string;
    college_id?: string;
    code?: string;
    description?: string;
    status?: string;
    years?: number;
    start_date?: string;
    end_date?: string;
    start_year?: string;
    end_year?: string;
    default_room?: string;
    default_shift?: string;
  }>({
    id: "",
    name: "",
    college_id: "",
    code: "",
    description: "",
    status: "Active",
    years: 4,
    start_date: "",
    end_date: "",
    start_year: "",
    end_year: "",
    default_room: "",
    default_shift: "general"
  });
  const [editingDept, setEditingDept] = useState<boolean>(false);
  const [newDeptNames, setNewDeptNames] = useState<Record<string, string>>({});
  const [expandedColleges, setExpandedColleges] = useState<Record<string, boolean>>({ college_1: true, college_2: true });

  // SME CRUD states
  const [showSmeModal, setShowSmeModal] = useState(false);
  const [isEditingSme, setIsEditingSme] = useState(false);
  const [smeForm, setSmeForm] = useState<{
    id: string;
    name: string;
    email: string;
    subject: string;
  }>({
    id: "",
    name: "",
    email: "",
    subject: ""
  });

  // Mentor CRUD states
  const [showMentorModal, setShowMentorModal] = useState(false);
  const [mentorForm, setMentorForm] = useState<{
    id: string;
    name: string;
    email: string;
    department: string;
    avatar: string;
    subjects: string;
    classes: string;
    shift: "shift_1" | "shift_2" | "general";
    college_id: string;
    subject_group: string;
  }>({
    id: "",
    name: "",
    email: "",
    department: "",
    avatar: "",
    subjects: "",
    classes: "",
    shift: "general",
    college_id: "",
    subject_group: "",
  });
  const [editingMentor, setEditingMentor] = useState<boolean>(false);
  const [mentorSubjectSearch, setMentorSubjectSearch] = useState("");
  // Mentor Profile states
  const [selectedProfileMentor, setSelectedProfileMentor] = useState<Mentor | null>(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  // Subject CRUD states
  const [showSubjectModal, setShowSubjectModal] = useState(false);
  const [subjectForm, setSubjectForm] = useState<{
    id: string;
    name: string;
    department: string;
    semester: string;
    type: string;
    college_id: string;
    year: string;
    weekly_hours: number;
    mentorIds: string[];
    subject_group: string;
  }>({
    id: "",
    name: "",
    department: "",
    semester: "Semester 1",
    type: "theory",
    college_id: "",
    year: "Year 1",
    weekly_hours: 4,
    mentorIds: [],
    subject_group: "General"
  });
  const [editingSubject, setEditingSubject] = useState<any>(null);

  // Department expand & view states
  const [expandedDepts, setExpandedDepts] = useState<Record<string, boolean>>({});
  const [expandedDeptYears, setExpandedDeptYears] = useState<Record<string, boolean>>({});
  const [subjectCollegeFilter, setSubjectCollegeFilter] = useState("all");
  const [subjectSemesterFilter, setSubjectSemesterFilter] = useState("all");
  const [lockDeptAndYear, setLockDeptAndYear] = useState(false);
  const [subjectsSubTab, setSubjectsSubTab] = useState<"catalog" | "groups">("catalog");
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [groupForm, setGroupForm] = useState<{ id: string; name: string; description: string; subjectIds: string[] }>({
    id: "",
    name: "",
    description: "",
    subjectIds: []
  });
  const [editingGroup, setEditingGroup] = useState<any>(null);
  const [groupSubjectSearch, setGroupSubjectSearch] = useState("");

  const toggleDeptYear = (deptId: string, year: string) => {
    const key = `${deptId}_${year}`;
    setExpandedDeptYears(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const [modalError, setModalError] = useState<string | null>(null);

  // Search & Filter States
  const [searchQuery, setSearchQuery] = useState("");
  const [collegeFilter, setCollegeFilter] = useState("all");
  const [dayFilter, setDayFilter] = useState("all");
  const [shiftFilter, setShiftFilter] = useState("all");

  // Hierarchy expansion state
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({
    admin: true
  });

  const toggleNode = (nodeId: string) => {
    setExpandedNodes(prev => ({
      ...prev,
      [nodeId]: !prev[nodeId]
    }));
  };

  const fetchAdminDetails = async () => {
    try {
      setIsDataLoading(true);
      const res = await fetch("/api/colleges");
      const data = await res.json();
      if (data.success) {
        setCamList(data.campusManagers || []);
        setKamList(data.kamUsers || []);
      }

      // Load all additional relational tables from centralized api/data
      const dataRes = await fetch("/api/data");
      const dataJson = await dataRes.json();
      if (dataJson.success) {
        setAnnouncements(dataJson.announcements || []);
        setHolidays(dataJson.holidays || []);
        setLoginHistory(dataJson.loginHistory || []);
        setUsersList(dataJson.users || []);
        setNotifications(dataJson.notifications || []);
      }
    } catch (e) {
      console.error("Failed to fetch admin stats:", e);
    } finally {
      setIsDataLoading(false);
    }
  };

  const handleComposeAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!annForm.title.trim()) return;
    try {
      const res = await fetch("/api/announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(annForm)
      });
      const data = await res.json();
      if (data.success) {
        setShowAnnModal(false);
        setAnnForm({ title: "", description: "", target_role: "All", college_id: "" });
        await fetchAdminDetails();
      } else {
        toast(data.message || "Failed to create announcement.", "error");
      }
    } catch (err) {
      console.error("Compose announcement error:", err);
    }
  };

  const handleDeleteAnnouncement = async (id: string) => {
    if (await showConfirm({ message: "Are you sure you want to delete this announcement?", danger: true, confirmLabel: "Delete" })) {
      try {
        const res = await fetch(`/api/announcements?id=${id}`, { method: "DELETE" });
        const data = await res.json();
        if (data.success) {
          await fetchAdminDetails();
        } else {
          toast(data.message || "Failed to delete announcement.", "error");
        }
      } catch (err) {
        console.error("Delete announcement error:", err);
      }
    }
  };

  const handleAddHoliday = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!holForm.title.trim() || !holForm.date) return;
    try {
      const res = await fetch("/api/holidays", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(holForm)
      });
      const data = await res.json();
      if (data.success) {
        setShowHolModal(false);
        setHolForm({ title: "", date: "", type: "National Holiday", college_id: "" });
        await fetchAdminDetails();
      } else {
        toast(data.message || "Failed to add holiday.", "error");
      }
    } catch (err) {
      console.error("Add holiday error:", err);
    }
  };

  const handleDeleteHoliday = async (id: string) => {
    if (await showConfirm({ message: "Are you sure you want to delete this holiday?", danger: true, confirmLabel: "Delete" })) {
      try {
        const res = await fetch(`/api/holidays?id=${id}`, { method: "DELETE" });
        const data = await res.json();
        if (data.success) {
          await fetchAdminDetails();
        } else {
          toast(data.message || "Failed to delete holiday.", "error");
        }
      } catch (err) {
        console.error("Delete holiday error:", err);
      }
    }
  };

  const handleToggleUserStatus = async (userId: string) => {
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, action: "toggle_status" })
      });
      const data = await res.json();
      if (data.success) {
        await fetchAdminDetails();
      } else {
        toast(data.message || "Failed to toggle status.", "error");
      }
    } catch (err) {
      console.error("Toggle status error:", err);
    }
  };

  const handleResetUserPassword = async (userId: string) => {
    if (await showConfirm({ message: "Are you sure you want to reset this user's password to 'password123'?", confirmLabel: "Reset" })) {
      try {
        const res = await fetch("/api/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId, action: "reset_password" })
        });
        const data = await res.json();
        if (data.success) {
          toast("Password reset successfully.", "success");
          await fetchAdminDetails();
        } else {
          toast(data.message || "Failed to reset password.", "error");
        }
      } catch (err) {
        console.error("Reset password error:", err);
      }
    }
  };

  const handleApproveSignupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!approvingSignup) return;

    try {
      const res = await approveSignupRequest(approvingSignup.id, {
        role: approvingRole,
        mappingType,
        selectedReferenceId: mappingType === "link_existing" ? selectedReferenceId : null,
        collegeId: mappingCollegeId || null,
        department: mappingDept || null,   // kept for backwards compat, ignored by new API
        group: mappingDept || null,
        classGroup: mappingClassGroup || null
      });

      if (res.success) {
        toast("Signup request approved and mapped successfully.", "success");
        setShowApprovalModal(false);
        setApprovingSignup(null);
        setSelectedReferenceId("");
        setMappingCollegeId("");
        setMappingDept("");
        setMappingClassGroup("");
        await fetchAdminDetails();
      } else {
        toast(res.message || "Failed to approve signup request.", "error");
      }
    } catch (err: any) {
      toast(err.message || "An error occurred.", "error");
    }
  };

  const handleRejectSignup = async (id: string) => {
    if (await showConfirm({ message: "Are you sure you want to reject this signup request?", danger: true, confirmLabel: "Reject" })) {
      try {
        const res = await rejectSignupRequest(id);
        if (res.success) {
          toast("Signup request rejected.", "success");
          await fetchAdminDetails();
        } else {
          toast(res.message || "Failed to reject signup request.", "error");
        }
      } catch (err: any) {
        toast(err.message || "An error occurred.", "error");
      }
    }
  };

  const handleDeleteSignupRequest = async (id: string) => {
    if (await showConfirm({ message: "Are you sure you want to permanently delete this request log?", danger: true, confirmLabel: "Delete" })) {
      try {
        const res = await deleteSignupRequest(id);
        if (res.success) {
          toast("Request log deleted.", "success");
          await fetchAdminDetails();
        } else {
          toast(res.message || "Failed to delete request log.", "error");
        }
      } catch (err: any) {
        toast(err.message || "An error occurred.", "error");
      }
    }
  };

  useEffect(() => {
    refreshData();
    fetchAdminDetails();
  }, []);

  // Campus handlers
  const handleOpenCampusModal = (col?: College) => {
    setModalError(null);
    setActiveConfigShift("general");
    
    let s1Params: ShiftParams = { label: "Shift 1", startTime: "08:30 AM", periodDuration: 50, periodsCount: 5, mode: "duration", breaks: [] };
    let s2Params: ShiftParams = { label: "Shift 2", startTime: "01:00 PM", periodDuration: 50, periodsCount: 5, mode: "duration", breaks: [] };
    let genParams: ShiftParams = { label: "General Shift", startTime: "09:00 AM", periodDuration: 50, periodsCount: 6, mode: "duration", breaks: [] };

    const initialMap: Record<string, Record<"shift_1" | "shift_2" | "general", ShiftParams>> = {};

    if (col) {
      let s1 = "";
      let s2 = "";
      let gen = "";
      if (col.shift_configs) {
        try {
          const parsed = JSON.parse(col.shift_configs);
          if (Array.isArray(parsed.shift_1)) s1 = parsed.shift_1.join("\n");
          if (Array.isArray(parsed.shift_2)) s2 = parsed.shift_2.join("\n");
          if (Array.isArray(parsed.general)) gen = parsed.general.join("\n");

          if (parsed.custom_shift_params) {
            if (parsed.custom_shift_params.shift_1) s1Params = { ...parsed.custom_shift_params.shift_1, label: parsed.custom_shift_params.shift_1.label || "Shift 1" };
            if (parsed.custom_shift_params.shift_2) s2Params = { ...parsed.custom_shift_params.shift_2, label: parsed.custom_shift_params.shift_2.label || "Shift 2" };
            if (parsed.custom_shift_params.general) genParams = { ...parsed.custom_shift_params.general, label: parsed.custom_shift_params.general.label || "General Shift" };
          } else {
            // Legacy fallbacks
            if (Array.isArray(parsed.shift_1) && parsed.shift_1.length > 0) {
              const times = parsed.shift_1[0].split("-").map((t: string) => t.trim());
              s1Params.startTime = times[0];
              s1Params.periodsCount = parsed.shift_1.length;
            }
            if (Array.isArray(parsed.shift_2) && parsed.shift_2.length > 0) {
              const times = parsed.shift_2[0].split("-").map((t: string) => t.trim());
              s2Params.startTime = times[0];
              s2Params.periodsCount = parsed.shift_2.length;
            }
            if (Array.isArray(parsed.general) && parsed.general.length > 0) {
              const times = parsed.general[0].split("-").map((t: string) => t.trim());
              genParams.startTime = times[0];
              genParams.periodsCount = parsed.general.length;
            }
          }

          // Load semester configs
          if (parsed.semester_configs) {
            Object.keys(parsed.semester_configs).forEach(sem => {
              const semData = parsed.semester_configs[sem];
              initialMap[sem] = {
                shift_1: semData.custom_shift_params?.shift_1 || { label: "Shift 1", startTime: "08:30 AM", periodDuration: 50, periodsCount: 5, mode: "duration", breaks: [] },
                shift_2: semData.custom_shift_params?.shift_2 || { label: "Shift 2", startTime: "01:00 PM", periodDuration: 50, periodsCount: 5, mode: "duration", breaks: [] },
                general: semData.custom_shift_params?.general || { label: "General Shift", startTime: "09:00 AM", periodDuration: 50, periodsCount: 6, mode: "duration", breaks: [] }
              };
            });
          }
        } catch (_) {}
      }
      if (!s1) s1 = SHIFT_TIME_SLOTS.shift_1.join("\n");
      if (!s2) s2 = SHIFT_TIME_SLOTS.shift_2.join("\n");
      if (!gen) gen = SHIFT_TIME_SLOTS.general.join("\n");
      setShift1Timings(s1);
      setShift2Timings(s2);
      setGeneralTimings(gen);

      setShiftConfigsParams({
        shift_1: s1Params,
        shift_2: s2Params,
        general: genParams
      });

      initialMap["All Semesters"] = {
        shift_1: { ...s1Params },
        shift_2: { ...s2Params },
        general: { ...genParams }
      };

      setCampusForm({
        id: col.id,
        name: col.name,
        address: col.address || "",
        kam_id: col.kam_id,
        has_shifts: col.has_shifts === undefined ? 1 : col.has_shifts,
        shift_configs: col.shift_configs || "",
        rooms: col.rooms || "",
        code: (col as any).code || "",
        academic_year: (col as any).academic_year || "2026-2027",
        manager: (col as any).manager || "",
        working_days: (col as any).working_days === undefined ? 5 : Number((col as any).working_days)
      });
      setEditingCampus(true);
      setCampusWizardStep(1);
      const existing = coursesList.filter(d => d.college_id === col.id || (col.id === "college_1" && !d.college_id));
      setWizardCourses(existing.map(c => {
        let sections: Record<number, number> = { 1: 1, 2: 1, 3: 1, 4: 1, 5: 1 };
        let sectionRooms: Record<string, string> = {};
        if (c.default_room) {
          try {
            const parsed = JSON.parse(c.default_room);
            if (typeof parsed === "object") {
              sectionRooms = parsed;
              // Reconstruct section counts from parsed keys
              const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
              Object.keys(parsed).forEach(key => {
                const match = key.match(/Year\s*(\d+)\s*Section\s*([A-Z])/i);
                if (match) {
                  const y = parseInt(match[1], 10);
                  counts[y] = Math.max(counts[y] || 0, match[2].toUpperCase().charCodeAt(0) - 64);
                }
              });
              for (let y = 1; y <= 5; y++) {
                if (counts[y] > 0) sections[y] = counts[y];
              }
            }
          } catch (_) {}
        }
        return { ...c, isExisting: true, sections, sectionRooms };
      }));
    } else {
      setShift1Timings(SHIFT_TIME_SLOTS.shift_1.join("\n"));
      setShift2Timings(SHIFT_TIME_SLOTS.shift_2.join("\n"));
      setGeneralTimings(SHIFT_TIME_SLOTS.general.join("\n"));
 
      setShiftConfigsParams({
        shift_1: { label: "Shift 1", startTime: "08:30 AM", periodDuration: 50, periodsCount: 5, mode: "duration", breaks: [] },
        shift_2: { label: "Shift 2", startTime: "01:00 PM", periodDuration: 50, periodsCount: 5, mode: "duration", breaks: [] },
        general: { label: "General Shift", startTime: "09:00 AM", periodDuration: 50, periodsCount: 6, mode: "duration", breaks: [] }
      });
 
      initialMap["All Semesters"] = {
        shift_1: { label: "Shift 1", startTime: "08:30 AM", periodDuration: 50, periodsCount: 5, mode: "duration", breaks: [] },
        shift_2: { label: "Shift 2", startTime: "01:00 PM", periodDuration: 50, periodsCount: 5, mode: "duration", breaks: [] },
        general: { label: "General Shift", startTime: "09:00 AM", periodDuration: 50, periodsCount: 6, mode: "duration", breaks: [] }
      };
 
      setCampusForm({
        id: "",
        name: "",
        address: "",
        kam_id: kamList[0]?.id || "",
        has_shifts: 1,
        shift_configs: "",
        rooms: "",
        code: "",
        academic_year: "2026-2027",
        manager: "",
        working_days: 5
      });
      setEditingCampus(false);
      setCampusWizardStep(1);
      setWizardCourses([]);
      setCampusSuccessCreatedId(null);
      setWizardCourseForm({
        name: "",
        years: 3,
        sections: { 1: 1, 2: 1, 3: 1, 4: 1, 5: 1 },
        sectionRooms: {},
        default_shift: "general",
        start_date: "",
        end_date: "",
        start_year: "",
        end_year: "",
        description: ""
      });
    }
    
    setSemesterConfigsMap(initialMap);
    setActiveConfigSemester("All Semesters");
    setNewBreakName("");
    setNewBreakDuration(15);
    setNewBreakAfterPeriod(2);
    setCampusFieldErrors({});
    setCourseFieldErrors({});
    
    setShowCampusModal(true);
  };

  const handleSemesterChange = (newSem: string) => {
    const updatedMap = {
      ...semesterConfigsMap,
      [activeConfigSemester]: {
        shift_1: { ...shiftConfigsParams.shift_1 },
        shift_2: { ...shiftConfigsParams.shift_2 },
        general: { ...shiftConfigsParams.general }
      }
    };

    setSemesterConfigsMap(updatedMap);

    const targetParams = updatedMap[newSem] || updatedMap["All Semesters"] || shiftConfigsParams;
    setShiftConfigsParams({
      shift_1: { ...targetParams.shift_1 },
      shift_2: { ...targetParams.shift_2 },
      general: { ...targetParams.general }
    });

    setActiveConfigSemester(newSem);
    setNewBreakName("");
  };

  const handleCampusSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);
    try {
      const finalMap = {
        ...semesterConfigsMap,
        [activeConfigSemester]: {
          shift_1: { ...shiftConfigsParams.shift_1 },
          shift_2: { ...shiftConfigsParams.shift_2 },
          general: { ...shiftConfigsParams.general }
        }
      };

      const allSemsMap = finalMap["All Semesters"] || shiftConfigsParams;
      
      // Ensure at least one break is configured for active shifts
      for (const sem of Object.keys(finalMap)) {
        const semParams = finalMap[sem];
        if (campusForm.has_shifts === 1) {
          if (!semParams.shift_1.breaks || semParams.shift_1.breaks.length === 0) {
            setModalError(`${sem} - Shift 1: At least one break must be configured.`);
            return;
          }
          if (!semParams.shift_2.breaks || semParams.shift_2.breaks.length === 0) {
            setModalError(`${sem} - Shift 2: At least one break must be configured.`);
            return;
          }
        } else {
          if (!semParams.general.breaks || semParams.general.breaks.length === 0) {
            setModalError(`${sem} - General Shift: At least one break must be configured.`);
            return;
          }
        }
      }

      const s1Schedule = calculateShiftSchedule(allSemsMap.shift_1);
      const s2Schedule = calculateShiftSchedule(allSemsMap.shift_2);
      const genSchedule = calculateShiftSchedule(allSemsMap.general);
      
      if (s1Schedule.error && campusForm.has_shifts === 1) {
        setModalError(`All Semesters - Shift 1: ${s1Schedule.error}`);
        return;
      }
      if (s2Schedule.error && campusForm.has_shifts === 1) {
        setModalError(`All Semesters - Shift 2: ${s2Schedule.error}`);
        return;
      }
      if (genSchedule.error) {
        setModalError(`All Semesters - General Shift: ${genSchedule.error}`);
        return;
      }

      const compiledShift1 = s1Schedule.items.filter(item => item.type === "period").map(item => `${item.startTimeStr} - ${item.endTimeStr}`);
      const compiledShift2 = s2Schedule.items.filter(item => item.type === "period").map(item => `${item.startTimeStr} - ${item.endTimeStr}`);
      const compiledGeneral = genSchedule.items.filter(item => item.type === "period").map(item => `${item.startTimeStr} - ${item.endTimeStr}`);

      const semesterConfigsCompiled: Record<string, any> = {};
      
      for (const sem of Object.keys(finalMap)) {
        if (sem === "All Semesters") continue;
        const semParams = finalMap[sem];
        const semS1 = calculateShiftSchedule(semParams.shift_1);
        const semS2 = calculateShiftSchedule(semParams.shift_2);
        const semGen = calculateShiftSchedule(semParams.general);

        if (semS1.error && campusForm.has_shifts === 1) {
          setModalError(`${sem} - Shift 1: ${semS1.error}`);
          return;
        }
        if (semS2.error && campusForm.has_shifts === 1) {
          setModalError(`${sem} - Shift 2: ${semS2.error}`);
          return;
        }
        if (semGen.error) {
          setModalError(`${sem} - General Shift: ${semGen.error}`);
          return;
        }

        semesterConfigsCompiled[sem] = {
          shift_1: semS1.items.filter(item => item.type === "period").map(item => `${item.startTimeStr} - ${item.endTimeStr}`),
          shift_2: semS2.items.filter(item => item.type === "period").map(item => `${item.startTimeStr} - ${item.endTimeStr}`),
          general: semGen.items.filter(item => item.type === "period").map(item => `${item.startTimeStr} - ${item.endTimeStr}`),
          custom_shift_params: semParams
        };
      }

      const parsedConfigs = {
        shift_1: compiledShift1,
        shift_2: compiledShift2,
        general: compiledGeneral,
        custom_shift_params: allSemsMap,
        semester_configs: semesterConfigsCompiled
      };
      
      // Auto-compile rooms list from all wizard courses
      const allRooms = new Set<string>();
      wizardCourses.forEach(c => {
        if (c.default_room) {
          if (c.default_room.startsWith("{")) {
            try {
              const parsed = JSON.parse(c.default_room);
              Object.values(parsed).forEach((r: any) => {
                if (r && typeof r === 'string' && r.trim()) {
                  allRooms.add(r.trim());
                }
              });
            } catch (_) {}
          } else {
            allRooms.add(c.default_room.trim());
          }
        }
      });
      const autoRoomsList = Array.from(allRooms).join(", ");
      
      let collegeId = campusForm.id;
      if (!editingCampus) {
        const cleanCode = campusForm.code || generateCodeFromName(campusForm.name) || Date.now().toString();
        collegeId = "Clg_" + cleanCode.trim().replace(/[^a-zA-Z0-9]/g, "");
      }

      const updatedForm = {
        ...campusForm,
        id: collegeId,
        rooms: autoRoomsList || campusForm.rooms,
        shift_configs: JSON.stringify(parsedConfigs)
      };
      
      let res;
      if (editingCampus) {
        res = await updateCollege(updatedForm);
      } else {
        res = await createCollege(updatedForm);
      }
      if (res.success) {
        // Update selected Campus Manager assignment if specified
        if (updatedForm.manager) {
          const selectedCamObj = camList.find(cm => cm.id === updatedForm.manager);
          if (selectedCamObj) {
            await updateCAM({
              id: selectedCamObj.id,
              name: selectedCamObj.name,
              email: selectedCamObj.email,
              college_id: updatedForm.id,
              kam_id: selectedCamObj.kam_id
            });
          }
        }

        // Save new wizard courses if any
        const newCourses = wizardCourses.filter(c => !c.isExisting);
        for (const course of newCourses) {
          await createCourse({
            name: course.name,
            college_id: updatedForm.id,
            code: course.code || course.name.toLowerCase().replace(/[^a-z0-9]/g, "_"),
            description: course.description || "",
            years: Number(course.years) || 3,
            start_date: course.start_date || new Date().toISOString().split("T")[0],
            end_date: course.end_date || new Date(Date.now() + 3 * 365 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
            start_year: course.start_year || new Date().getFullYear().toString(),
            end_year: course.end_year || (new Date().getFullYear() + (Number(course.years) || 3)).toString(),
            default_room: course.default_room || null,
            default_shift: course.default_shift || null
          });
        }
        await refreshData();
        await fetchAdminDetails();
        if (!editingCampus) {
          setCampusSuccessCreatedId(updatedForm.id);
        } else {
          setShowCampusModal(false);
        }
      } else {
        setModalError(res.message || "Failed to save campus.");
      }
    } catch (err: any) {
      setModalError(err.message || "An unexpected error occurred.");
    }
  };

  const handleDeleteCampus = async (id: string) => {
    if (await showConfirm({ title: "Delete Campus", message: "Are you sure you want to delete this campus?\n\nThis will permanently delete all associated mentors, students, courses, slots, and attendance records. This action cannot be undone.", danger: true, confirmLabel: "Delete Campus" })) {
      try {
        const res = await deleteCollege(id);
        if (res.success) {
          await refreshData();
          await fetchAdminDetails();
          const counts = res.deletedCounts;
          if (counts && (counts.mentors > 0 || counts.students > 0)) {
            toast(`Campus deleted. Cascade removed: ${counts.mentors} mentor(s), ${counts.students} student(s), ${counts.cams} CAM(s) and all associated records.`, "info");
          } else {
            toast("Campus deleted successfully.", "success");
          }
        } else {
          toast(res.message || "Failed to delete campus.", "error");
        }
      } catch (err: any) {
        toast(err.message || "An error occurred while deleting.", "error");
      }
    }
  };

  // KAM handlers
  const handleOpenKamModal = (kam?: KAMUserFromDB) => {
    setModalError(null);
    if (kam) {
      setKamForm({
        id: kam.id,
        name: kam.name,
        email: kam.email,
        title: kam.title
      });
      setEditingKam(true);
    } else {
      setKamForm({
        id: "",
        name: "",
        email: "",
        title: "Key Account Manager"
      });
      setEditingKam(false);
    }
    setShowKamModal(true);
  };

  const handleKamSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);
    try {
      let res;
      if (editingKam) {
        res = await updateKAM(kamForm);
      } else {
        res = await createKAM(kamForm);
      }
      if (res.success) {
        setShowKamModal(false);
        await fetchAdminDetails();
      } else {
        setModalError(res.message || "Failed to save KAM.");
      }
    } catch (err: any) {
      setModalError(err.message || "An unexpected error occurred.");
    }
  };

  const handleDeleteKam = async (id: string) => {
    if (await showConfirm({ message: "Are you sure you want to delete this KAM? This action cannot be undone.", danger: true, confirmLabel: "Delete" })) {
      try {
        const res = await deleteKAM(id);
        if (res.success) {
          toast("KAM deleted successfully.", "success");
          await fetchAdminDetails();
        } else {
          toast(res.message || "Failed to delete KAM.", "error");
        }
      } catch (err: any) {
        toast(err.message || "An error occurred while deleting.", "error");
      }
    }
  };

  // CAM handlers
  const handleOpenCamModal = (cam?: CAMUserFromDB) => {
    setModalError(null);
    if (cam) {
      setCamForm({
        id: cam.id,
        name: cam.name,
        email: cam.email,
        college_id: cam.college_id,
        kam_id: cam.kam_id
      });
      setEditingCam(true);
    } else {
      setCamForm({
        id: "",
        name: "",
        email: "",
        college_id: colleges[0]?.id || "",
        kam_id: kamList[0]?.id || ""
      });
      setEditingCam(false);
    }
    setShowCamModal(true);
  };

  const handleCamSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);
    try {
      let res;
      if (editingCam) {
        res = await updateCAM(camForm);
      } else {
        res = await createCAM(camForm);
      }
      if (res.success) {
        setShowCamModal(false);
        await fetchAdminDetails();
      } else {
        setModalError(res.message || "Failed to save Campus Manager.");
      }
    } catch (err: any) {
      setModalError(err.message || "An unexpected error occurred.");
    }
  };

  const handleDeleteCam = async (id: string) => {
    if (await showConfirm({ message: "Are you sure you want to delete this Campus Manager? This action cannot be undone.", danger: true, confirmLabel: "Delete" })) {
      try {
        const res = await deleteCAM(id);
        if (res.success) {
          toast("Campus Manager deleted successfully.", "success");
          await fetchAdminDetails();
        } else {
          toast(res.message || "Failed to delete Campus Manager.", "error");
        }
      } catch (err: any) {
        toast(err.message || "An error occurred while deleting.", "error");
      }
    }
  };

  // SME handlers
  const handleOpenSmeModal = (sme?: any) => {
    if (sme) {
      setIsEditingSme(true);
      setSmeForm({
        id: sme.id,
        name: sme.name,
        email: sme.email,
        subject: sme.subject || ""
      });
    } else {
      setIsEditingSme(false);
      // Auto-generate unique SME ID like sme_4, sme_5
      const maxNum = (smes || []).reduce((acc, curr) => {
        const num = parseInt(curr.id.replace("sme_", ""));
        return isNaN(num) ? acc : Math.max(acc, num);
      }, 0);
      setSmeForm({
        id: `sme_${maxNum + 1}`,
        name: "",
        email: "",
        subject: subjectGroups[0]?.name || ""
      });
    }
    setShowSmeModal(true);
  };

  const handleSaveSme = async () => {
    if (!smeForm.id || !smeForm.name || !smeForm.email) {
      toast("Please fill in all required fields.", "error");
      return;
    }

    try {
      if (isEditingSme) {
        const res = await updateSmeUser(smeForm.id, smeForm.name, smeForm.email, smeForm.subject);
        if (res.success) {
          toast("SME updated successfully.", "success");
          setShowSmeModal(false);
        } else {
          toast(res.message, "error");
        }
      } else {
        const res = await createSmeUser(smeForm.id, smeForm.name, smeForm.email, smeForm.subject);
        if (res.success) {
          toast("SME created successfully.", "success");
          setShowSmeModal(false);
        } else {
          toast(res.message, "error");
        }
      }
    } catch (e: any) {
      toast(e.message || "An error occurred.", "error");
    }
  };

  const handleDeleteSme = async (id: string) => {
    if (await showConfirm({ message: "Are you sure you want to delete this SME? They will also lose their login credentials." })) {
      try {
        const res = await deleteSmeUser(id);
        if (res.success) {
          toast("SME deleted successfully.", "success");
        } else {
          toast(res.message, "error");
        }
      } catch (e: any) {
        toast(e.message || "An error occurred.", "error");
      }
    }
  };

  // Mentor handlers
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
        college_id: m.college_id || colleges[0]?.id || "",
        subject_group: m.subject_group || "General"
      });
      setEditingMentor(true);
    } else {
      setMentorForm({
        id: "m" + (mentors.length + 1),
        name: "",
        email: "",
        department: "",
        avatar: "",
        subjects: "",
        classes: "",
        shift: "general",
        college_id: colleges[0]?.id || "",
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

    // Auto generate avatar initials if empty
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
      headerId: null, // HOD role is removed
      subjects: mentorForm.subjects.trim(),
      classes: mentorForm.classes.trim(),
      shift: mentorForm.shift,
      college_id: mentorForm.college_id,
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
        await fetchAdminDetails();
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
          await fetchAdminDetails();
        } else {
          toast(res.message || "Failed to delete mentor.", "error");
        }
      } catch (err: any) {
        toast(err.message || "An error occurred while deleting.", "error");
      }
    }
  };

  // Subject handlers
  const handleOpenSubjectModal = (s?: Subject, defaultDept?: string, defaultYear?: string) => {
    setModalError(null);
    if (s) {
      setSubjectForm({
        id: s.id,
        name: s.name,
        department: s.department,
        semester: s.semester,
        type: s.type,
        college_id: s.college_id || "",
        year: s.year || "Year 1",
        weekly_hours: s.weekly_hours || 4,
        mentorIds: [],
        subject_group: s.subject_group || "General"
      });
      setEditingSubject(s);
      setLockDeptAndYear(false);
    } else {
      let defaultSem = "Semester 1";
      if (defaultYear === "Year 2") defaultSem = "Semester 3";
      else if (defaultYear === "Year 3") defaultSem = "Semester 5";
      else if (defaultYear === "Year 4") defaultSem = "Semester 7";

      setSubjectForm({
        id: "",
        name: "",
        department: defaultDept || "",
        semester: defaultSem,
        type: "theory",
        college_id: colleges[0]?.id || "",
        year: defaultYear || "Year 1",
        weekly_hours: 4,
        mentorIds: [],
        subject_group: "General"
      });
      setEditingSubject(null);
      setLockDeptAndYear(!!defaultDept);
    }
    setShowSubjectModal(true);
  };

  const handleSubjectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);
    if (!subjectForm.name.trim() || !subjectForm.department.trim()) {
      setModalError("Subject Name and Department are required.");
      return;
    }
    if (!subjectForm.college_id) {
      setModalError("Please select a campus for this subject.");
      return;
    }

    const payload = {
      name: subjectForm.name.trim(),
      department: subjectForm.department.trim(),
      semester: subjectForm.semester,
      type: subjectForm.type,
      college_id: subjectForm.college_id || undefined,
      year: subjectForm.year,
      weekly_hours: subjectForm.weekly_hours,
      subject_group: subjectForm.subject_group
    };

    try {
      let res;
      if (editingSubject) {
        res = await updateSubject({ ...payload, id: editingSubject.id });
      } else {
        res = await createSubject(payload);
        // After subject created, append it to each selected mentor's subjects list
        if (res.success && subjectForm.mentorIds.length > 0) {
          for (const mId of subjectForm.mentorIds) {
            const mentor = mentors.find(m => m.id === mId);
            if (!mentor) continue;
            const existingSubs = mentor.subjects ? mentor.subjects.split(/\n|,|;/).map(s => s.trim()).filter(Boolean) : [];
            if (!existingSubs.includes(subjectForm.name.trim())) {
              existingSubs.push(subjectForm.name.trim());
            }
            await updateMentor({ ...mentor, subjects: existingSubs.join("\n") });
          }
        }
      }
      if (res.success) {
        setShowSubjectModal(false);
        await fetchAdminDetails();
      } else {
        setModalError(res.message || "Failed to save subject.");
      }
    } catch (err: any) {
      setModalError(err.message || "An unexpected error occurred.");
    }
  };

  const handleDeleteSubject = async (id: string) => {
    if (await showConfirm({ message: "Are you sure you want to delete this subject?", danger: true, confirmLabel: "Delete" })) {
      try {
        const res = await deleteSubject(id);
        if (res.success) {
          toast("Subject deleted successfully.", "success");
          await fetchAdminDetails();
        } else {
          toast(res.message || "Failed to delete subject.", "error");
        }
      } catch (err: any) {
        toast(err.message || "An error occurred while deleting.", "error");
      }
    }
  };

  const handleOpenGroupModal = (g?: any) => {
    setModalError(null);
    setGroupSubjectSearch("");
    if (g) {
      const associatedIds = (subjectsList || []).filter(s => s.subject_group === g.name).map(s => s.id);
      setGroupForm({
        id: g.id,
        name: g.name,
        description: g.description || "",
        subjectIds: associatedIds
      });
      setEditingGroup(g);
    } else {
      setGroupForm({
        id: "",
        name: "",
        description: "",
        subjectIds: []
      });
      setEditingGroup(null);
    }
    setShowGroupModal(true);
  };

  const handleGroupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);
    if (!groupForm.name.trim()) {
      setModalError("Group Name is required.");
      return;
    }

    try {
      let res;
      if (editingGroup) {
        res = await updateSubjectGroup(editingGroup.id, groupForm.name.trim(), groupForm.description.trim(), groupForm.subjectIds);
      } else {
        res = await createSubjectGroup(groupForm.name.trim(), groupForm.description.trim(), groupForm.subjectIds);
      }
      if (res.success) {
        setShowGroupModal(false);
        await fetchAdminDetails();
        toast(editingGroup ? "Subject group updated." : "Subject group created.", "success");
      } else {
        setModalError(res.message || "Failed to save subject group.");
      }
    } catch (err: any) {
      setModalError(err.message || "An unexpected error occurred.");
    }
  };

  const handleDeleteGroup = async (id: string) => {
    if (await showConfirm({ message: "Are you sure you want to delete this subject group? Mentors and subjects in this group will be reset to 'General'.", danger: true, confirmLabel: "Delete" })) {
      try {
        const res = await deleteSubjectGroup(id);
        if (res.success) {
          toast("Subject group deleted successfully.", "success");
          await fetchAdminDetails();
        } else {
          toast(res.message || "Failed to delete subject group.", "error");
        }
      } catch (err: any) {
        toast(err.message || "An error occurred while deleting.", "error");
      }
    }
  };

  // Department Handlers
  const handleOpenDeptModal = (dept?: Department, collegeId?: string) => {
    setModalError(null);
    if (dept) {
      setDeptForm({
        id: dept.id,
        name: dept.name,
        college_id: dept.college_id || "",
        code: dept.code || "",
        description: dept.description || "",
        status: dept.status || "Active",
        years: dept.years ? Number(dept.years) : 4,
        start_date: dept.start_date || "",
        end_date: dept.end_date || "",
        start_year: dept.start_year || "",
        end_year: dept.end_year || "",
        default_room: dept.default_room || "",
        default_shift: dept.default_shift || "general"
      });
      setEditingDept(true);
    } else {
      setDeptForm({
        id: "",
        name: "",
        college_id: collegeId || colleges[0]?.id || "",
        code: "",
        description: "",
        status: "Active",
        years: 4,
        start_date: "",
        end_date: "",
        start_year: "",
        end_year: "",
        default_room: "",
        default_shift: "general"
      });
      setEditingDept(false);
    }
    setShowDeptModal(true);
  };

  const autoCalculateCourseDates = (startDateStr: string, durationYears: number) => {
    if (!startDateStr) return {};
    const startDate = new Date(startDateStr);
    if (isNaN(startDate.getTime())) return {};

    const endDate = new Date(startDate);
    endDate.setFullYear(startDate.getFullYear() + durationYears);

    const endYearStr = endDate.getFullYear().toString();
    const endMonthStr = String(endDate.getMonth() + 1).padStart(2, '0');
    const endDayStr = String(endDate.getDate()).padStart(2, '0');
    const endDateStr = `${endYearStr}-${endMonthStr}-${endDayStr}`;

    const startYearStr = startDate.getFullYear().toString();

    return {
      end_date: endDateStr,
      start_year: startYearStr,
      end_year: endYearStr
    };
  };

  const handleCourseStartDateChange = (val: string) => {
    const years = deptForm.years || 4;
    const calculated = autoCalculateCourseDates(val, years);
    setDeptForm(prev => ({
      ...prev,
      start_date: val,
      ...calculated
    }));
  };

  const handleCourseYearsChange = (val: number) => {
    const calculated = autoCalculateCourseDates(deptForm.start_date || "", val);
    setDeptForm(prev => ({
      ...prev,
      years: val,
      ...calculated
    }));
  };

  const handleYearRoomChange = (yearNum: number, roomVal: string) => {
    let currentRooms: Record<number, string> = {};
    try {
      if (deptForm.default_room && deptForm.default_room.startsWith("{")) {
        currentRooms = JSON.parse(deptForm.default_room);
      } else if (deptForm.default_room) {
        currentRooms = { 1: deptForm.default_room };
      }
    } catch (_) {}
    currentRooms[yearNum] = roomVal;
    setDeptForm(prev => ({
      ...prev,
      default_room: JSON.stringify(currentRooms)
    }));
  };

  const handleDeptSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);
    if (!deptForm.name.trim()) {
      setModalError("Course Name is required.");
      return;
    }

    try {
      let res;
      const autoCode = generateCodeFromName(deptForm.name.trim());
      if (editingDept) {
        res = await updateCourse({
          ...deptForm,
          code: autoCode
        } as Department);
      } else {
        res = await createCourse({
          name: deptForm.name.trim(),
          college_id: deptForm.college_id,
          code: autoCode,
          description: deptForm.description?.trim(),
          status: deptForm.status,
          years: deptForm.years ? Number(deptForm.years) : 4,
          start_date: deptForm.start_date,
          end_date: deptForm.end_date,
          start_year: deptForm.start_year,
          end_year: deptForm.end_year,
          default_room: deptForm.default_room,
          default_shift: deptForm.default_shift
        } as Omit<Department, "id">);
      }
      if (res.success) {
        setShowDeptModal(false);
        await fetchAdminDetails();
      } else {
        setModalError(res.message || "Failed to save course.");
      }
    } catch (err: any) {
      setModalError(err.message || "An unexpected error occurred.");
    }
  };

  const handleDeleteDept = async (id: string, name: string) => {
    if (await showConfirm({ title: "Delete Course", message: `Are you sure you want to delete the course "${name}"?\n\nThis will permanently delete all associated mentors, students, subjects, slots, and attendance records. This action cannot be undone.`, danger: true, confirmLabel: "Delete Course" })) {
      try {
        const res = await deleteCourse(id);
        if (res.success) {
          await fetchAdminDetails();
          const counts = res.deletedCounts;
          if (counts && (counts.slots > 0 || counts.students > 0 || counts.mentors > 0)) {
            toast(`Course "${name}" deleted. Cascade removed: ${counts.slots} slot(s), ${counts.students} student(s), ${counts.mentors} mentor(s), ${counts.subjects} subject(s).`, "info");
          } else {
            toast(`Course "${name}" deleted successfully.`, "success");
          }
        } else {
          toast(res.message || "Failed to delete course.", "error");
        }
      } catch (err: any) {
        toast(err.message || "An error occurred while deleting.", "error");
      }
    }
  };


  // Filter schedules
  const filteredSlots = slots.filter(slot => {
    const mentorObj = mentors.find(m => m.id === slot.mentorId);
    const collegeId = slot.college_id || mentorObj?.college_id || "college_1";
    
    const matchesSearch = slot.course.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (mentorObj?.name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
                          slot.location.toLowerCase().includes(searchQuery.toLowerCase());
                          
    const matchesCollege = collegeFilter === "all" || collegeId === collegeFilter;
    const matchesDay = dayFilter === "all" || slot.day === dayFilter;
    const matchesShift = shiftFilter === "all" || slot.shift === shiftFilter;

    return matchesSearch && matchesCollege && matchesDay && matchesShift;
  });

  // Filter audit logs
  const filteredLogs = auditLogs.filter(log => {
    return log.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
           log.actorName.toLowerCase().includes(searchQuery.toLowerCase()) ||
           log.actorRole.toLowerCase().includes(searchQuery.toLowerCase());
  });

  // Filter mentors
  const filteredMentors = mentors.filter(m => {
    const colName = colleges.find(c => c.id === m.college_id)?.name || "";
    return m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
           m.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
           m.department.toLowerCase().includes(searchQuery.toLowerCase()) ||
           colName.toLowerCase().includes(searchQuery.toLowerCase()) ||
           (m.subjects || "").toLowerCase().includes(searchQuery.toLowerCase());
  });

  // Filter subjects
  const filteredSubjects = (subjectsList || []).filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
           s.department.toLowerCase().includes(searchQuery.toLowerCase()) ||
           s.semester.toLowerCase().includes(searchQuery.toLowerCase()) ||
           (colleges.find(c => c.id === s.college_id)?.name || "").toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCollege = subjectCollegeFilter === "all" || s.college_id === subjectCollegeFilter;
    const matchesSemester = subjectSemesterFilter === "all" || s.semester === subjectSemesterFilter;
    return matchesSearch && matchesCollege && matchesSemester;
  });

  return (
    <div className="flex-1 flex flex-col md:flex-row bg-warm-canvas text-slate-800 font-sans h-full overflow-hidden">
      {/* ── Sticky Left Sidebar — nav items + collapse only ── */}
      <aside className={`hidden md:flex shrink-0 flex-col sticky top-0 z-30 floating-sidebar transition-all duration-300 h-full ${
        isCollapsed ? "w-[72px]" : "w-[230px]"
      }`}>

        {/* Collapse / Expand toggle */}
        <div className={`flex items-center shrink-0 py-3 border-b border-slate-100 ${
          isCollapsed ? "justify-center" : "justify-end px-3"
        }`}>
          <button
            onClick={() => setIsCollapsed((prev) => {
              const next = !prev;
              localStorage.setItem("fp_sidebar_collapsed", String(next));
              return next;
            })}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition-all cursor-pointer"
            title={isCollapsed ? "Expand" : "Collapse"}
          >
            {isCollapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
          </button>
        </div>

        {/* Nav items — Hover Flyout dropdowns outside sidebar */}
        <nav className="flex-1 py-6 px-3 space-y-4">
          {navGroups.map(group => {
            const GroupIcon = group.icon;
            const hasActiveItem = group.items.some(item => item.id === activeTab);

            return (
              <div key={group.title} className="group/nav-group relative">
                {/* Category Header Row */}
                <div
                  className={`w-full flex items-center justify-between rounded-xl transition-all duration-150 cursor-pointer ${
                    isCollapsed ? "justify-center p-3" : "px-4 py-3"
                  } ${
                    hasActiveItem
                      ? "bg-[#D528A2]/10 text-[#D528A2] font-extrabold shadow-sm border border-[#D528A2]/20"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-50 border border-transparent"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <GroupIcon className={`h-5 w-5 shrink-0 ${hasActiveItem ? "text-[#D528A2]" : "text-slate-400"}`} />
                    {!isCollapsed && (
                      <span className="text-[13px] font-bold tracking-wide uppercase">
                        {group.title}
                      </span>
                    )}
                  </div>
                  {!isCollapsed && (
                    <ChevronRight className={`h-4 w-4 shrink-0 transition-transform duration-200 group-hover/nav-group:translate-x-1 ${
                      hasActiveItem ? "text-[#D528A2]/80" : "text-slate-400"
                    }`} />
                  )}
                </div>

                {/* Floating Dropdown Outside (To the right) on Hover */}
                <div className="invisible opacity-0 group-hover/nav-group:visible group-hover/nav-group:opacity-100 absolute left-full top-0 ml-2 bg-white border border-gray-250 rounded-2xl shadow-xl p-3 min-w-[210px] z-50 space-y-2 border-l-4 border-l-[#D528A2] transition-all duration-150 transform translate-x-2 group-hover/nav-group:translate-x-0 pointer-events-auto">
                  <div className="px-2.5 py-1 text-[10px] font-black text-[#D528A2] uppercase tracking-wider border-b border-[#D528A2]/10 pb-1.5 mb-1.5">
                    {group.title}
                  </div>
                  <div className="space-y-1">
                    {group.items.map(t => {
                      const Icon = t.icon;
                      const isActive = activeTab === t.id;
                      return (
                        <button
                          key={t.id}
                          onClick={() => {
                            setActiveTab(t.id as any);
                          }}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[12.5px] font-semibold transition-all duration-150 cursor-pointer text-left border-none ${
                            isActive
                              ? "sidebar-active-item font-black shadow-sm"
                              : "text-slate-650 hover:text-[#D528A2] hover:bg-[#D528A2]/5"
                          }`}
                        >
                          <Icon className={`h-4.5 w-4.5 shrink-0 ${isActive ? "text-white" : "text-slate-450 group-hover:text-[#D528A2]"}`} />
                          <span className="truncate">{t.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </nav>
      </aside>

      {/* Mobile Bottom Navigation — visible only on small screens */}
      <nav className="flex md:hidden fixed bottom-0 inset-x-0 z-50 mobile-bottom-nav">
        <div className="flex w-full justify-around items-center py-2 px-0.5">
          {[
            { id: "overview", label: "Home", icon: LayoutDashboard },
            { id: "campuses", label: "Campuses", icon: Building2 },
            { id: "mentors", label: "Faculty", icon: UserCheck },
            { id: "schedules", label: "Schedules", icon: CalendarDays },
            { id: "more_menu", label: "More", icon: Menu },
          ].map(t => {
            const Icon = t.icon;
            const isActive = activeTab === t.id || (t.id === "more_menu" && ["courses", "subjects", "kams", "cams", "smes", "users", "holidays", "announcements", "logs"].includes(activeTab));
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id as any)}
                className={`relative flex flex-col items-center justify-center gap-0.5 flex-1 py-1.5 rounded-xl transition-all cursor-pointer ${
                  isActive ? "text-indigo-600" : "text-slate-400"
                }`}
              >
                <Icon className={`h-4.5 w-4.5 transition-transform ${isActive ? "scale-110" : ""}`} />
                <span className={`text-[8px] font-semibold tracking-wide leading-none ${isActive ? "text-indigo-600" : "text-slate-400"}`}>
                  {t.label}
                </span>
                {isActive && <span className="absolute top-0 inset-x-1 h-0.5 bg-indigo-500 rounded-full" />}
              </button>
            );
          })}
        </div>
      </nav>


      {/*  Main Scrollable Content Area — 40px left padding (px-10) */}
      <main className="flex-grow overflow-x-hidden overflow-y-auto h-full pt-4 md:pt-8 pb-20 md:pb-16 px-4 md:px-10 space-y-6 scroll-touch">

        {/* Tab More Menu: Grid of remaining tabs */}
        {activeTab === "more_menu" && (
          <div className="space-y-6 animate-fadeIn pb-10">
            <h2 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider">More Admin Portals</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setActiveTab("courses")}
                className="p-5 bg-white border border-slate-200 rounded-3xl text-left hover:border-[#D528A2] hover:ring-2 hover:ring-[#D528A2]/10 transition-all flex items-center gap-4 shadow-xs cursor-pointer group"
              >
                <div className="h-10 w-10 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-550 shrink-0 group-hover:scale-105 transition-transform">
                  <Network className="h-5 w-5" />
                </div>
                <div>
                  <span className="block text-xs font-bold text-slate-800">Academic Courses</span>
                  <span className="text-[10px] text-slate-400 font-medium">Manage degree programs</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("subjects")}
                className="p-5 bg-white border border-slate-200 rounded-3xl text-left hover:border-[#D528A2] hover:ring-2 hover:ring-[#D528A2]/10 transition-all flex items-center gap-4 shadow-xs cursor-pointer group"
              >
                <div className="h-10 w-10 rounded-2xl bg-teal-50 flex items-center justify-center text-teal-600 shrink-0 group-hover:scale-105 transition-transform">
                  <GraduationCap className="h-5 w-5" />
                </div>
                <div>
                  <span className="block text-xs font-bold text-slate-800">Subject Database</span>
                  <span className="text-[10px] text-slate-400 font-medium">Syllabus hour targets</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("kams")}
                className="p-5 bg-white border border-slate-200 rounded-3xl text-left hover:border-[#D528A2] hover:ring-2 hover:ring-[#D528A2]/10 transition-all flex items-center gap-4 shadow-xs cursor-pointer group"
              >
                <div className="h-10 w-10 rounded-2xl bg-amber-50 flex items-center justify-center text-amber-550 shrink-0 group-hover:scale-105 transition-transform">
                  <Briefcase className="h-5 w-5" />
                </div>
                <div>
                  <span className="block text-xs font-bold text-slate-800">Key Account Managers</span>
                  <span className="text-[10px] text-slate-400 font-medium">Regional university coordinators</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("cams")}
                className="p-5 bg-white border border-slate-200 rounded-3xl text-left hover:border-[#D528A2] hover:ring-2 hover:ring-[#D528A2]/10 transition-all flex items-center gap-4 shadow-xs cursor-pointer group"
              >
                <div className="h-10 w-10 rounded-2xl bg-purple-50 flex items-center justify-center text-purple-600 shrink-0 group-hover:scale-105 transition-transform">
                  <Users className="h-5 w-5" />
                </div>
                <div>
                  <span className="block text-xs font-bold text-slate-800">Campus Managers</span>
                  <span className="text-[10px] text-slate-400 font-medium">Campus operational leads</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("smes")}
                className="p-5 bg-white border border-slate-200 rounded-3xl text-left hover:border-[#D528A2] hover:ring-2 hover:ring-[#D528A2]/10 transition-all flex items-center gap-4 shadow-xs cursor-pointer group"
              >
                <div className="h-10 w-10 rounded-2xl bg-rose-50 flex items-center justify-center text-rose-500 shrink-0 group-hover:scale-105 transition-transform">
                  <BookOpen className="h-5 w-5" />
                </div>
                <div>
                  <span className="block text-xs font-bold text-slate-800">Evaluator SMEs</span>
                  <span className="text-[10px] text-slate-400 font-medium">Subject Matter Experts hub</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("users")}
                className="p-5 bg-white border border-slate-200 rounded-3xl text-left hover:border-[#D528A2] hover:ring-2 hover:ring-[#D528A2]/10 transition-all flex items-center gap-4 shadow-xs cursor-pointer group"
              >
                <div className="h-10 w-10 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-600 shrink-0 group-hover:scale-105 transition-transform">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <span className="block text-xs font-bold text-slate-800">User Credentials</span>
                  <span className="text-[10px] text-slate-400 font-medium">Manage access logs & logins</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("holidays")}
                className="p-5 bg-white border border-slate-200 rounded-3xl text-left hover:border-[#D528A2] hover:ring-2 hover:ring-[#D528A2]/10 transition-all flex items-center gap-4 shadow-xs cursor-pointer group"
              >
                <div className="h-10 w-10 rounded-2xl bg-orange-50 flex items-center justify-center text-orange-600 shrink-0 group-hover:scale-105 transition-transform">
                  <Calendar className="h-5 w-5" />
                </div>
                <div>
                  <span className="block text-xs font-bold text-slate-800">Holidays Calendar</span>
                  <span className="text-[10px] text-slate-400 font-medium">University holidays configuration</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("announcements")}
                className="p-5 bg-white border border-slate-200 rounded-3xl text-left hover:border-[#D528A2] hover:ring-2 hover:ring-[#D528A2]/10 transition-all flex items-center gap-4 shadow-xs cursor-pointer group"
              >
                <div className="h-10 w-10 rounded-2xl bg-pink-50 flex items-center justify-center text-pink-500 shrink-0 group-hover:scale-105 transition-transform">
                  <Megaphone className="h-5 w-5" />
                </div>
                <div>
                  <span className="block text-xs font-bold text-slate-800">Announcements</span>
                  <span className="text-[10px] text-slate-400 font-medium">Broadcast system alerts</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("logs")}
                className="p-5 bg-white border border-slate-200 rounded-3xl text-left hover:border-[#D528A2] hover:ring-2 hover:ring-[#D528A2]/10 transition-all flex items-center gap-4 shadow-xs cursor-pointer group sm:col-span-2"
              >
                <div className="h-10 w-10 rounded-2xl bg-slate-900 text-white flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                  <History className="h-5 w-5" />
                </div>
                <div>
                  <span className="block text-xs font-bold text-slate-800">System Audit Logs</span>
                  <span className="text-[10px] text-slate-400 font-medium">Security & change history logs</span>
                </div>
              </button>
            </div>
          </div>
        )}

        {activeTab === "overview" && (
          <>
            {/* ── Top Section Bar / Page Header ── */}
            <div className="mt-6 md:mt-[32px] mb-5 md:mb-[28px] flex flex-wrap items-start justify-between gap-3 border-b border-gray-150 pb-5 admin-page-header">
              <div>
                <h1 className="text-xl md:text-[36px] font-bold tracking-tight text-gray-900 leading-tight">Admin Control Console</h1>
                <p className="text-sm md:text-[15px] font-normal text-gray-500 mt-1">Manage all university campuses</p>
              </div>
              <div className="text-right">
                <span className="text-base md:text-[20px] font-bold text-gray-900 block leading-tight">
                  Campuses Directory
                </span>
                <p className="text-sm md:text-[14px] font-normal text-gray-400 mt-1">
                  {colleges.length} Active Campuses
                </p>
              </div>
            </div>

            {/* ── KPI Stats Row (Visible on campuses tab only) ── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
              {/* Card 1 */}
              <div className="bg-white border border-gray-150 rounded-2xl p-4 md:p-6 shadow-sm flex flex-col justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
                    <Building2 className="h-4 w-4 text-indigo-500" />
                  </div>
                  <span className="text-[11px] md:text-[13px] font-semibold tracking-[0.8px] text-gray-500 uppercase">Total Campuses</span>
                </div>
                <span className="text-[36px] md:text-[48px] font-bold text-gray-900 mt-3 block leading-none admin-kpi-value">{colleges.length}</span>
                <span className="text-xs md:text-[14px] font-normal text-gray-400 mt-2 block">Active campuses</span>
              </div>

              {/* Card 2 */}
              <div className="bg-white border border-gray-150 rounded-2xl p-4 md:p-6 shadow-sm flex flex-col justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-xl bg-teal-50 flex items-center justify-center shrink-0">
                    <Users className="h-4 w-4 text-teal-600" />
                  </div>
                  <span className="text-[11px] md:text-[13px] font-semibold tracking-[0.8px] text-gray-500 uppercase">Total Mentors</span>
                </div>
                <span className="text-[36px] md:text-[48px] font-bold text-gray-900 mt-3 block leading-none admin-kpi-value">{mentors.length}</span>
                <span className="text-xs md:text-[14px] font-normal text-gray-400 mt-2 block">Across all campuses</span>
              </div>

              {/* Card 3 */}
              <div className="bg-white border border-gray-150 rounded-2xl p-4 md:p-6 shadow-sm flex flex-col justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
                    <Grid className="h-4 w-4 text-amber-500" />
                  </div>
                  <span className="text-[11px] md:text-[13px] font-semibold tracking-[0.8px] text-gray-500 uppercase">Active Slots</span>
                </div>
                <div>
                  <span className="text-[36px] md:text-[48px] font-bold text-gray-900 mt-3 block leading-none admin-kpi-value">{slots.length}</span>
                  <div className="mt-3 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.min(100, Math.round((slots.length / 500) * 100))}%`,
                        background: "linear-gradient(to right, #D528A2, #F4A863)"
                      }}
                    />
                  </div>
                  <span className="text-xs md:text-[14px] font-normal text-gray-400 mt-2 block">Out of 500 ({Math.round((slots.length / 500) * 100)}%)</span>
                </div>
              </div>

              {/* Card 4 */}
              <div className="bg-white border border-gray-150 rounded-2xl p-4 md:p-6 shadow-sm flex flex-col justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-xl bg-rose-50 flex items-center justify-center shrink-0">
                    <Layers className="h-4 w-4 text-rose-500" />
                  </div>
                  <span className="text-[11px] md:text-[13px] font-semibold tracking-[0.8px] text-gray-500 uppercase">Total Courses</span>
                </div>
                <span className="text-[36px] md:text-[48px] font-bold text-gray-900 mt-3 block leading-none admin-kpi-value">{coursesList.length}</span>
                <span className="text-xs md:text-[14px] font-normal text-gray-400 mt-2 block">Courses available</span>
              </div>
            </div>
          </>
        )}

        {/* TABS CONTAINER */}
        <div className="bg-white border border-gray-200 rounded-3xl p-6 shadow-sm min-h-[400px]">
          {/* ── Tab: Overview ── */}
          {activeTab === "overview" && (
            <div className="space-y-8 animate-fadeIn text-xs">
              {/* Split Screen: Campuses Summary & Reporting Hierarchy */}
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                {/* Campuses Overview Card */}
                <div className="bg-white border border-gray-150 rounded-2xl p-5 shadow-xs flex flex-col">
                  <div className="flex items-center gap-2 mb-4 pb-3 border-b border-gray-100">
                    <Building2 className="h-5 w-5 text-indigo-650" />
                    <h3 className="text-sm font-bold text-gray-900">Campus Breakdown</h3>
                  </div>
                  <div className="space-y-3 flex-grow overflow-y-auto max-h-[300px] pr-1">
                    {colleges.map((col) => {
                      const colMentors = mentors.filter(m => m.college_id === col.id);
                      const colSlots = slots.filter(s => colMentors.some(m => m.id === s.mentorId));
                      return (
                        <div key={col.id} className="flex items-center justify-between p-3 bg-gray-50/50 hover:bg-gray-50 transition-all rounded-xl border border-gray-150/60">
                          <div>
                            <span className="font-extrabold text-gray-900 block">{col.name}</span>
                            <span className="text-[10px] text-gray-400 font-semibold">{col.address || "No address"}</span>
                          </div>
                          <div className="flex gap-2">
                            <span className="bg-teal-50 border border-teal-100 text-teal-700 px-2 py-0.5 rounded-full text-[9px] font-bold whitespace-nowrap">
                              {colMentors.length} Mentors
                            </span>
                            <span className="bg-indigo-50 border border-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full text-[9px] font-bold whitespace-nowrap">
                              {colSlots.length} Slots
                            </span>
                          </div>
                        </div>
                      );
                    })}
                    {colleges.length === 0 && (
                      <p className="text-gray-450 italic text-center py-8">No colleges registered yet.</p>
                    )}
                  </div>
                </div>

                {/* Hierarchy Quick Tree */}
                <div className="bg-white border border-gray-150 rounded-2xl p-5 shadow-xs flex flex-col">
                  <div className="flex items-center gap-2 mb-4 pb-3 border-b border-gray-100">
                    <Network className="h-5 w-5 text-indigo-655" />
                    <h3 className="text-sm font-bold text-gray-900">System Hierarchy</h3>
                  </div>
                  <p className="text-[10px] text-gray-450 font-semibold mb-3 leading-relaxed">
                    Interactive Reporting Chain of Command (Super Admin → Key Account Managers → Campuses)
                  </p>
                  <div className="bg-gray-50 border border-gray-150 rounded-2xl p-4 shadow-inner space-y-3 max-h-[300px] overflow-y-auto text-xs">
                    {/* Super Admin Level */}
                    <div className="space-y-2">
                      <div 
                        onClick={() => toggleNode("admin")}
                        className="flex items-center gap-2 p-2.5 bg-white border border-indigo-150 rounded-xl shadow-xs cursor-pointer hover:border-indigo-350 transition-all"
                      >
                        {expandedNodes["admin"] ? <ChevronDown className="h-3.5 w-3.5 text-indigo-550 shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 text-indigo-550 shrink-0" />}
                        <div className="h-6 w-6 rounded-full bg-indigo-600 text-white flex items-center justify-center font-black text-[9px] shrink-0">SU</div>
                        <div className="min-w-0">
                          <div className="font-bold text-gray-900 text-xs truncate">Super Admin</div>
                          <div className="text-[9px] text-gray-450 truncate">{currentAdmin?.name || "System Admin"}</div>
                        </div>
                      </div>

                      {expandedNodes["admin"] && (
                        <div className="pl-6 border-l border-dashed border-gray-300 ml-4 space-y-2 pt-1">
                          {kamList.map(kam => {
                            const kamNodeId = `kam-${kam.id}`;
                            const kamColleges = colleges.filter(c => c.kam_id === kam.id);
                            return (
                              <div key={kam.id} className="space-y-1">
                                <div 
                                  onClick={() => toggleNode(kamNodeId)}
                                  className="flex items-center gap-2 p-2 bg-white border border-gray-200 rounded-xl shadow-xs cursor-pointer hover:border-indigo-250 transition-all"
                                >
                                  {expandedNodes[kamNodeId] ? <ChevronDown className="h-3 w-3 text-gray-500 shrink-0" /> : <ChevronRight className="h-3 w-3 text-gray-500 shrink-0" />}
                                  <div className="h-5 w-5 rounded-full bg-amber-500 text-white flex items-center justify-center font-black text-[8px] shrink-0">KAM</div>
                                  <div className="min-w-0">
                                    <div className="font-bold text-gray-900 text-[10.5px] truncate">{kam.name}</div>
                                    <div className="text-[8.5px] text-gray-400 truncate">{kamColleges.length} Campus(es)</div>
                                  </div>
                                </div>
                                {expandedNodes[kamNodeId] && (
                                  <div className="pl-6 border-l border-dashed border-gray-300 ml-3 space-y-1 pt-1">
                                    {kamColleges.map(col => (
                                      <div key={col.id} className="flex items-center gap-1.5 p-1.5 bg-white border border-gray-150 rounded-lg text-[9.5px] text-gray-700">
                                        <Building2 className="h-3 w-3 text-gray-450 shrink-0" />
                                        <span className="font-extrabold truncate">{col.name}</span>
                                      </div>
                                    ))}
                                    {kamColleges.length === 0 && <span className="text-[9px] text-gray-450 italic pl-2 block">No campuses assigned</span>}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                          {kamList.length === 0 && <span className="text-[9.5px] text-gray-455 italic pl-2 block">No Key Account Managers registered</span>}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Recent Audit Logs Summary */}
              <div className="bg-white border border-gray-150 rounded-2xl p-5 shadow-xs">
                <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100">
                  <div className="flex items-center gap-2">
                    <History className="h-5 w-5 text-indigo-650" />
                    <h3 className="text-sm font-bold text-gray-900">Recent Audit Logs</h3>
                  </div>
                  <button 
                    onClick={() => setActiveTab("logs")}
                    className="text-indigo-650 hover:text-indigo-800 font-extrabold text-[10px] transition-all bg-transparent border-none cursor-pointer p-0"
                  >
                    View All Logs →
                  </button>
                </div>
                <div className="overflow-x-auto rounded-xl border border-gray-150">
                  <table className="w-full border-collapse text-left text-[11px] font-medium text-gray-700 min-w-[500px]">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200 text-gray-555 font-bold uppercase text-[9px] tracking-wider">
                        <th className="px-3 py-2">Timestamp</th>
                        <th className="px-3 py-2">Actor</th>
                        <th className="px-3 py-2">Role</th>
                        <th className="px-3 py-2">Description</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white">
                      {filteredLogs.slice(0, 5).map((log) => (
                        <tr key={log.id} className="hover:bg-gray-55/30 transition-colors">
                          <td className="px-3 py-2 text-gray-450 whitespace-nowrap font-semibold">{formatDate(log.timestamp)}</td>
                          <td className="px-3 py-2 font-bold text-gray-900">{log.actorName}</td>
                          <td className="px-3 py-2 font-extrabold text-indigo-700 uppercase text-[9px] tracking-wider">{log.actorRole}</td>
                          <td className="px-3 py-2 text-gray-600 font-semibold">{log.description}</td>
                        </tr>
                      ))}
                      {filteredLogs.length === 0 && (
                        <tr>
                          <td colSpan={4} className="py-6 text-center text-gray-400 italic">No logs recorded yet.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ── Tab: Campuses ── */}
          {activeTab === "campuses" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-gray-150 pb-4 flex-wrap gap-4">
                <div>
                  <h2 className="text-[28px] font-bold text-gray-900 leading-tight">Campuses</h2>
                  <p className="text-[15px] font-normal text-gray-500 mt-1">Manage all active university campuses</p>
                </div>
                <button
                onClick={() => handleOpenCampusModal()}
                className="h-11 px-5 rounded-xl text-xs font-bold btn-gradient flex items-center gap-1.5 cursor-pointer shadow-sm text-white"
              >
                <Plus className="h-4 w-4" />
                Add Campus
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {colleges.map((col) => {
                const colMentors = mentors.filter(m => m.college_id === col.id);
                const colSlots = slots.filter(s => colMentors.some(m => m.id === s.mentorId));
                const colDeptsCount = Array.from(new Set(colMentors.map(m => m.department).filter(Boolean))).length;
                const cam = camList.find(cm => cm.college_id === col.id);
                const kamOwner = kamList.find(k => k.id === col.kam_id);
                
                // Helper to split long titles elegantly
                const renderCampusName = (name: string) => {
                  if (name.includes(" of ")) {
                    const parts = name.split(" of ");
                    return (
                      <>
                        <div className="text-[20px] font-semibold text-gray-900 leading-snug">{parts[0]}</div>
                        <div className="text-[13px] font-medium text-gray-400 mt-0.5">of {parts[1]}</div>
                      </>
                    );
                  }
                  return <div className="text-[20px] font-semibold text-gray-900 leading-snug">{name}</div>;
                };

                return (
                  <div key={col.id} className="p-6 rounded-2xl border border-gray-200 bg-white hover:shadow-md transition-all flex flex-col justify-between min-h-[320px] relative overflow-hidden group">
                    {/* Shift badge in top-right corner with 12px padding */}
                    <div className="absolute top-3 right-3">
                      <span className={`px-2 py-0.5 rounded text-[8.5px] font-black uppercase tracking-wider ${
                        col.has_shifts === 0 
                          ? "bg-amber-50 text-amber-700 border border-amber-200" 
                          : "bg-teal-50 text-teal-700 border border-teal-200"
                      }`}>
                        {col.has_shifts === 0 ? "General Shift Only" : "Multi-Shift"}
                      </span>
                    </div>

                    <div className="space-y-4">
                      <div>
                        {renderCampusName(col.name)}
                        <p className="text-[13px] text-gray-400 mt-1 flex items-center gap-1 font-medium">
                          <MapPin className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                          {col.address || "No Address Added"}
                        </p>
                      </div>

                      {/* Fixed width label columns (120px label, remaining value) */}
                      <div className="bg-gray-55 border border-gray-150 rounded-xl p-3.5 text-[13px] space-y-1.5">
                        <div className="flex text-gray-500">
                          <span className="w-[120px] shrink-0 font-medium">KAM Owner</span>
                          <span className="font-bold text-gray-900">: {kamOwner ? kamOwner.name : "Unassigned"}</span>
                        </div>
                        <div className="flex text-gray-500">
                          <span className="w-[120px] shrink-0 font-medium">Campus Manager</span>
                          <span className="font-bold text-gray-900">: {cam ? cam.name : "Unassigned"}</span>
                        </div>
                      </div>

                      {/* Statistics Row: Symmetrical vertical layout */}
                      <div className="grid grid-cols-3 gap-2.5 text-center">
                        <div className="bg-gray-55 p-2 rounded-xl border border-gray-100 flex flex-col items-center justify-center">
                          <div className="font-bold text-gray-900 text-lg leading-none">{colMentors.length}</div>
                          <div className="text-[10px] text-gray-400 font-semibold mt-1">Faculty</div>
                        </div>
                        <div className="bg-gray-55 p-2 rounded-xl border border-gray-100 flex flex-col items-center justify-center">
                          <div className="font-bold text-gray-900 text-lg leading-none">{colSlots.length}</div>
                          <div className="text-[10px] text-gray-400 font-semibold mt-1">Slots</div>
                        </div>
                        <div className="bg-gray-55 p-2 rounded-xl border border-gray-100 flex flex-col items-center justify-center">
                          <div className="font-bold text-gray-900 text-lg leading-none">{colDeptsCount}</div>
                          <div className="text-[10px] text-gray-400 font-semibold mt-1">Depts</div>
                        </div>
                      </div>
                    </div>

                    {/* Bottom Buttons: Manage Campus button first, edit/delete with 20px gap below */}
                    <div className="flex flex-col gap-3 mt-auto pt-4 border-t border-gray-100">
                      <button
                        onClick={() => setDrillDownCollegeId(col.id)}
                        className="w-full btn-gradient font-bold py-2.5 rounded-xl text-xs text-white transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        Manage Campus Console
                      </button>
                      <div className="flex justify-center gap-5">
                        <button
                          onClick={() => handleOpenCampusModal(col)}
                          title="Edit Campus Details"
                          className="p-2 bg-gray-50 border border-gray-200 text-gray-500 hover:text-indigo-650 hover:bg-indigo-50 rounded-xl transition-all cursor-pointer"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteCampus(col.id)}
                          title="Delete Campus"
                          className="p-2 bg-gray-50 border border-gray-200 text-gray-500 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all cursor-pointer"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Tab: Key Account Managers ── */}
        {activeTab === "kams" && (
          <div className="space-y-6 animate-fadeIn">
            <div className="flex items-center justify-between border-b border-gray-150 pb-3 flex-wrap gap-4">
              <div className="flex items-center gap-2">
                <Briefcase className="h-5 w-5 text-indigo-655" />
                <h2 className="text-lg font-bold text-gray-900">Key Account Managers Directory</h2>
              </div>
              <button
                onClick={() => handleOpenKamModal()}
                className="btn-gradient shadow-sm text-white px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                Add KAM
              </button>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-gray-200">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-gray-555 font-bold uppercase">
                    <th className="p-4">Name</th>
                    <th className="p-4">Email</th>
                    <th className="p-4">Role Title</th>
                    <th className="p-4">Assigned Campuses</th>
                    <th className="p-4 text-center">Managed Mentors</th>
                    <th className="p-4 text-center">Total Scheduled Hours</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-150 bg-white">
                  {kamList.map((kam) => {
                    const kamColleges = colleges.filter(c => c.kam_id === kam.id);
                    const kamMentors = mentors.filter(m => kamColleges.some(c => c.id === m.college_id));
                    const kamSlots = slots.filter(s => kamMentors.some(m => m.id === s.mentorId));
                    return (
                      <tr key={kam.id} className="hover:bg-gray-55/50 transition-colors">
                        <td className="p-4 font-bold text-gray-955 flex items-center gap-2">
                          <div className="h-7 w-7 rounded-full bg-indigo-50 border border-indigo-150 text-indigo-600 flex items-center justify-center font-extrabold text-[10px]">
                            {kam.name.split(" ").map(w => w[0]).join("")}
                          </div>
                          {kam.name}
                        </td>
                        <td className="p-4 text-gray-550">{kam.email}</td>
                        <td className="p-4 text-gray-800 font-medium">{kam.title}</td>
                        <td className="p-4">
                          <div className="flex flex-wrap gap-1">
                            {kamColleges.map(c => (
                              <span key={c.id} className="px-2 py-0.5 rounded bg-indigo-50 border border-indigo-100 text-[10px] font-bold text-indigo-700">
                                {c.name}
                              </span>
                            ))}
                            {kamColleges.length === 0 && <span className="text-gray-400 italic">None</span>}
                          </div>
                        </td>
                        <td className="p-4 text-center font-bold text-gray-805">{kamMentors.length}</td>
                        <td className="p-4 text-center font-black text-indigo-650 text-sm">{kamSlots.length} hr(s)</td>
                        <td className="p-4 text-right whitespace-nowrap">
                          <div className="flex justify-end gap-1.5">
                            <button
                              onClick={() => handleOpenKamModal(kam)}
                              className="p-1.5 bg-gray-50 border border-gray-250 text-gray-650 hover:text-indigo-600 hover:bg-indigo-55 rounded-lg transition-all cursor-pointer"
                            >
                              <Edit className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteKam(kam.id)}
                              className="p-1.5 bg-gray-50 border border-gray-250 text-gray-655 hover:text-rose-600 hover:bg-rose-55 rounded-lg transition-all cursor-pointer"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {kamList.length === 0 && (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-gray-400 italic">No Key Account Managers found. Click "Add KAM" to create one.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

          {/* ── Charts Row ── */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Donut: Mentors Overview */}
            <div className="bg-white border border-gray-150 rounded-2xl p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-gray-900">Mentors Overview</h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 font-semibold">This Month</span>
              </div>
              <div className="flex items-center gap-5">
                {/* SVG donut */}
                <div className="relative flex-shrink-0">
                  <svg width="90" height="90" viewBox="0 0 90 90">
                    <circle cx="45" cy="45" r="34" fill="none" stroke="#e5e7eb" strokeWidth="12" />
                    {/* Active — ~70% */}
                    <circle cx="45" cy="45" r="34" fill="none" stroke="#6366f1" strokeWidth="12"
                      strokeDasharray={`${Math.round(2*Math.PI*34*0.706)} ${Math.round(2*Math.PI*34)}`}
                      strokeDashoffset={Math.round(2*Math.PI*34*0.25)} strokeLinecap="round" />
                    {/* On Leave — ~17.6% */}
                    <circle cx="45" cy="45" r="34" fill="none" stroke="#f59e0b" strokeWidth="12"
                      strokeDasharray={`${Math.round(2*Math.PI*34*0.176)} ${Math.round(2*Math.PI*34)}`}
                      strokeDashoffset={Math.round(-2*Math.PI*34*0.456)} strokeLinecap="round" />
                    {/* Inactive — ~11.8% */}
                    <circle cx="45" cy="45" r="34" fill="none" stroke="#f43f5e" strokeWidth="12"
                      strokeDasharray={`${Math.round(2*Math.PI*34*0.118)} ${Math.round(2*Math.PI*34)}`}
                      strokeDashoffset={Math.round(-2*Math.PI*34*0.632)} strokeLinecap="round" />
                    <text x="45" y="49" textAnchor="middle" className="text-xs font-black" fontSize="14" fontWeight="800" fill="currentColor">{mentors.length}</text>
                    <text x="45" y="60" textAnchor="middle" fontSize="8" fill="#9ca3af">Total</text>
                  </svg>
                </div>
                <div className="space-y-1.5 text-[11px]">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-indigo-500 shrink-0" />
                    <span className="text-gray-600">Active</span>
                    <span className="ml-auto font-bold text-gray-900">{Math.round(mentors.length * 0.706)} ({(70.6).toFixed(1)}%)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-amber-400 shrink-0" />
                    <span className="text-gray-600">On Leave</span>
                    <span className="ml-auto font-bold text-gray-900">{Math.round(mentors.length * 0.176)} ({(17.6).toFixed(1)}%)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-rose-400 shrink-0" />
                    <span className="text-gray-600">Inactive</span>
                    <span className="ml-auto font-bold text-gray-900">{Math.round(mentors.length * 0.118)} ({(11.8).toFixed(1)}%)</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Line: Scheduled Hours Trend */}
            <div className="bg-white border border-gray-150 rounded-2xl p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-gray-900">Scheduled Hours Trend</h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 font-semibold">This Month</span>
              </div>
              <div className="relative h-[90px]">
                <svg width="100%" height="100%" viewBox="0 0 300 90" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="lineGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#6366f1" stopOpacity="0.3" />
                      <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <path d="M0,80 C30,75 60,60 90,50 C120,40 150,30 180,22 C210,15 240,18 270,12 L300,8"
                    fill="none" stroke="#6366f1" strokeWidth="2.5" strokeLinecap="round" />
                  <path d="M0,80 C30,75 60,60 90,50 C120,40 150,30 180,22 C210,15 240,18 270,12 L300,8 L300,90 L0,90 Z"
                    fill="url(#lineGrad)" />
                  <circle cx="270" cy="12" r="4" fill="#6366f1" stroke="white" strokeWidth="2" />
                </svg>
                <div className="flex justify-between text-[9px] text-gray-400 mt-1">
                  <span>May 1</span><span>May 8</span><span>May 15</span><span>May 22</span><span>May 29</span>
                </div>
              </div>
            </div>

            {/* System Activity feed */}
            <div className="bg-white border border-gray-150 rounded-2xl p-5 shadow-sm space-y-3">
              <h3 className="text-sm font-bold text-gray-900">System Activity</h3>
              <div className="space-y-3">
                {[
                  { icon: UserCheck, color: "bg-emerald-50 text-emerald-600", title: "New mentor added", sub: `Dr. ${mentors[0]?.name ?? "Faculty"} added`, time: "2h ago" },
                  { icon: Grid, color: "bg-amber-50 text-amber-600", title: "Schedule updated", sub: "Chemistry Lab schedule updated", time: "4h ago" },
                  { icon: GraduationCap, color: "bg-indigo-50 text-indigo-600", title: "New course created", sub: "AI course added", time: "1d ago" },
                  { icon: ShieldCheck, color: "bg-slate-100 text-slate-600", title: "User login", sub: `Admin logged in`, time: "1d ago" },
                ].map((ev, i) => {
                  const Ev = ev.icon;
                  return (
                    <div key={i} className="flex items-start gap-3">
                      <div className={`h-7 w-7 rounded-lg ${ev.color} flex items-center justify-center shrink-0`}>
                        <Ev className="h-3.5 w-3.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-bold text-gray-900 leading-tight">{ev.title}</p>
                        <p className="text-[10px] text-gray-400 truncate">{ev.sub}</p>
                      </div>
                      <span className="text-[9px] text-gray-400 whitespace-nowrap shrink-0">{ev.time}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
        )}

        {/* ── Tab: Campus Managers ── */}
        {activeTab === "cams" && (
          <div className="space-y-6 animate-fadeIn">
            <div className="flex items-center justify-between border-b border-gray-150 pb-3 flex-wrap gap-4">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-indigo-655" />
                <h2 className="text-lg font-bold text-gray-900">Campus Managers (CM) Directory</h2>
              </div>
              <button
                onClick={() => handleOpenCamModal()}
                className="btn-gradient shadow-sm text-white px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                Add Campus Manager
              </button>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-gray-200">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-gray-555 font-bold uppercase">
                    <th className="p-4">Name</th>
                    <th className="p-4">Email Address</th>
                    <th className="p-4">Reporting Campus</th>
                    <th className="p-4">Reporting KAM Manager</th>
                    <th className="p-4 text-center">Courses</th>
                    <th className="p-4 text-center">Faculty Count</th>
                    <th className="p-4 text-center">Slots Booked</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-150 bg-white">
                  {camList.map((cam) => {
                    const colObj = colleges.find(c => c.id === cam.college_id);
                    const kamObj = kamList.find(k => k.id === cam.kam_id);
                    
                    const camMentors = mentors.filter(m => m.college_id === cam.college_id);
                    const camSlots = slots.filter(s => camMentors.some(m => m.id === s.mentorId));
                    const camDeptsCount = Array.from(new Set(camMentors.map(m => m.department).filter(Boolean))).length;
                    
                    return (
                      <tr key={cam.id} className="hover:bg-gray-55/50 transition-colors">
                        <td className="p-4 font-bold text-gray-955 flex items-center gap-2">
                          <div className="h-7 w-7 rounded-full bg-indigo-50 border border-indigo-150 text-indigo-600 flex items-center justify-center font-extrabold text-[10px]">
                            {cam.name.split(" ").map(w => w[0]).join("")}
                          </div>
                          {cam.name}
                        </td>
                        <td className="p-4 text-gray-550">{cam.email}</td>
                        <td className="p-4 text-gray-800 font-bold">{cam.college_name || (colObj ? colObj.name : "Unassigned")}</td>
                        <td className="p-4 font-medium text-gray-600">{kamObj ? kamObj.name : "Unassigned"}</td>
                        <td className="p-4 text-center font-bold text-gray-805">{camDeptsCount}</td>
                        <td className="p-4 text-center font-bold text-gray-805">{camMentors.length}</td>
                        <td className="p-4 text-center font-black text-indigo-650 text-sm">{camSlots.length}</td>
                        <td className="p-4 text-right whitespace-nowrap">
                          <div className="flex justify-end gap-1.5">
                            <button
                              onClick={() => handleOpenCamModal(cam)}
                              className="p-1.5 bg-gray-50 border border-gray-250 text-gray-655 hover:text-indigo-600 hover:bg-indigo-55 rounded-lg transition-all cursor-pointer"
                            >
                              <Edit className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteCam(cam.id)}
                              className="p-1.5 bg-gray-50 border border-gray-255 text-gray-655 hover:text-rose-600 hover:bg-rose-55 rounded-lg transition-all cursor-pointer"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {camList.length === 0 && (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-gray-400 italic">No Campus Managers found. Click "Add Campus Manager" to create one.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Tab: Faculty Mentors ── */}
        {activeTab === "mentors" && (
          <div className="space-y-6 animate-fadeIn">
            <div className="flex items-center justify-between border-b border-gray-150 pb-3 flex-wrap gap-4">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-indigo-655" />
                <h2 className="text-lg font-bold text-gray-900">Faculty Mentors Directory</h2>
              </div>
              <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
                <div className="relative w-full sm:w-64 flex-1 sm:flex-none">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search mentors by name, dept, campus, subjects..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="bg-gray-50 border border-gray-205 rounded-xl pl-9 pr-4 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-600 focus:border-indigo-600 transition-all w-full font-medium text-gray-800"
                  />
                </div>
                <button
                  onClick={() => handleOpenMentorModal()}
                  className="btn-gradient shadow-sm text-white px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer shrink-0"
                >
                  <Plus className="h-4 w-4" />
                  Add Mentor
                </button>
              </div>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-gray-200">
              <table className="w-full border-collapse text-left text-xs min-w-[850px]">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-gray-500 font-bold uppercase tracking-wider">
                    <th className="px-5 py-4">Mentor</th>
                    <th className="px-5 py-4">Email</th>
                    <th className="px-5 py-4">Department</th>
                    <th className="px-5 py-4">Assigned Campus</th>
                    <th className="px-5 py-4">Shift</th>
                    <th className="px-5 py-4">Mapped Subjects</th>
                    <th className="px-5 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-150">
                  {filteredMentors.map((m) => {
                    const col = colleges.find(c => c.id === m.college_id);
                    const mentorSubjectsList = m.subjects ? m.subjects.split("\n").map(s => s.trim()).filter(Boolean) : [];
                    return (
                      <tr key={m.id} className="hover:bg-gray-50/50 transition-colors font-medium text-gray-755">
                        <td className="px-5 py-4 flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full btn-gradient flex items-center justify-center font-extrabold text-white text-[11px] shadow-sm shrink-0">
                            {m.avatar}
                          </div>
                          <div>
                            <span className="font-bold text-gray-900 block">{m.name}</span>
                            <span className="text-[10px] text-gray-400 font-mono font-semibold">{m.id}</span>
                          </div>
                        </td>
                        <td className="px-5 py-4 font-mono font-semibold text-gray-600">{m.email}</td>
                        <td className="px-5 py-4">
                          <span className="px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-755 border border-indigo-100 text-[10px] font-bold block w-fit">
                            {m.department}
                          </span>
                          {m.subject_group && (
                            <span className="text-[9px] text-gray-400 font-bold block mt-1">
                              Group: {m.subject_group}
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-4 text-gray-900 font-bold">{col ? col.name : <span className="text-gray-400 italic">Unassigned</span>}</td>
                        <td className="px-5 py-4 uppercase">
                          <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                            m.shift === "shift_1" ? "bg-teal-50 text-teal-700 border border-teal-200" :
                            m.shift === "shift_2" ? "bg-indigo-50 text-indigo-700 border border-indigo-200" :
                            "bg-amber-50 text-amber-700 border border-amber-200"
                          }`}>
                            {m.shift ? m.shift.replace("_", " ") : "general"}
                          </span>
                        </td>
                        <td className="px-5 py-4 max-w-xs">
                          <div className="flex flex-wrap gap-1 max-h-16 overflow-y-auto">
                            {mentorSubjectsList.length > 0 ? (
                              mentorSubjectsList.map((sub, idx) => (
                                <span key={idx} className="px-2 py-0.5 bg-gray-50 border border-gray-200 rounded text-[9.5px] text-gray-600 truncate">
                                  {sub}
                                </span>
                              ))
                            ) : (
                              <span className="text-gray-400 italic">No subjects mapped</span>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => {
                                setSelectedProfileMentor(m);
                                setIsProfileOpen(true);
                              }}
                              className="p-1.5 hover:bg-emerald-50 border border-transparent hover:border-emerald-250 text-emerald-600 hover:text-emerald-700 rounded-lg transition-all cursor-pointer"
                              title="View Workload Profile"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleOpenMentorModal(m)}
                              className="p-1.5 hover:bg-indigo-50 border border-transparent hover:border-indigo-200 text-gray-650 hover:text-indigo-650 rounded-lg transition-all cursor-pointer"
                              title="Edit Mentor"
                            >
                              <Edit className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteMentor(m.id)}
                              className="p-1.5 hover:bg-rose-50 border border-transparent hover:border-rose-250 text-gray-655 hover:text-rose-600 rounded-lg transition-all cursor-pointer"
                              title="Delete Mentor"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredMentors.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-5 py-8 text-center text-gray-450 italic bg-white">
                        No mentors found matching your search.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {activeTab === "courses" && (
          <div className="space-y-6 animate-fadeIn font-sans text-xs">
            <div className="flex items-center justify-between border-b border-gray-150 pb-3 flex-wrap gap-4">
              <div className="flex items-center gap-2">
                <Layers className="h-5 w-5 text-indigo-655" />
                <div>
                  <h2 className="text-lg font-bold text-gray-900 font-sans">Courses &amp; Curriculum</h2>
                  <p className="text-[10px] text-gray-400 font-semibold mt-0.5">Manage courses and their academic year curricula grouped by campus</p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search name, subjects..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="bg-gray-55 border border-gray-205 rounded-xl pl-9 pr-4 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-600 focus:border-indigo-600 transition-all w-56 font-semibold text-gray-800"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-6">
              {colleges.map((col) => {
                const isColExpanded = expandedColleges[col.id] !== false; // defaults to true
                const collegeDepts = coursesList.filter(d => d.college_id === col.id || (col.id === "college_1" && !d.college_id));
                const filteredDepts = collegeDepts.filter(dept => {
                  const matchesDept = dept.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                    dept.id.toLowerCase().includes(searchQuery.toLowerCase());
                  const matchesSubjects = (subjectsList || []).some(
                    s => s.department === dept.name && s.name.toLowerCase().includes(searchQuery.toLowerCase())
                  );
                  return matchesDept || matchesSubjects;
                });

                return (
                  <div key={col.id} className="border border-gray-200 rounded-2xl bg-white shadow-sm overflow-hidden">
                    {/* College section header */}
                    <div className="p-4 bg-gray-50 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <button
                        onClick={() => setExpandedColleges(prev => ({ ...prev, [col.id]: !prev[col.id] }))}
                        className="flex flex-wrap items-center gap-x-2 gap-y-1 hover:text-indigo-650 transition-all text-left font-extrabold cursor-pointer border-none bg-transparent p-0 max-w-full"
                      >
                        {isColExpanded ? (
                          <ChevronDown className="h-5 w-5 text-gray-555 shrink-0" />
                        ) : (
                          <ChevronRight className="h-5 w-5 text-gray-555 shrink-0" />
                        )}
                        <Building2 className="h-5 w-5 text-indigo-600 shrink-0" />
                        <div className="leading-tight flex-1 min-w-0">
                          <span className="text-sm font-black text-gray-900 block truncate sm:whitespace-normal">{col.name}</span>
                          <span className="text-[10px] text-gray-400 block font-normal mt-0.5 truncate sm:whitespace-normal">{col.address || "No Address"}</span>
                        </div>
                        <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded text-[10px] font-bold ml-2 shrink-0">
                          {filteredDepts.length} course(s)
                        </span>
                      </button>

                      {/* Stylized Add Course Button that opens the rich modal */}
                      <button
                        type="button"
                        onClick={() => handleOpenDeptModal(undefined, col.id)}
                        className="btn-gradient shadow-sm text-white px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 shrink-0 cursor-pointer border-none"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Add Course
                      </button>
                    </div>

                    {isColExpanded && (
                      <div className="p-4 space-y-4">
                        {filteredDepts.length === 0 ? (
                          <div className="text-center py-6 text-gray-400 italic">
                            No courses found for this campus.
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {filteredDepts.map((dept) => {
                              const facultyCount = mentors.filter(m => isMentorInProgram(m, dept.name, slots, subjectsList)).length;
                              const deptSubjects = (subjectsList || []).filter(s => s.department === dept.name);
                              const isDeptExpanded = expandedDepts[dept.id];
                              const deptSlots = slots.filter(s => (s.department || getDeptFromClassGroup(s.classGroup)) === dept.name);

                              return (
                                <div key={dept.id} className="border border-gray-150 rounded-xl overflow-hidden bg-gray-50/20">
                                  {/* Department row */}
                                  <div className="p-3 bg-white border-b border-gray-150 flex items-center justify-between gap-4 flex-wrap">
                                    <button
                                      onClick={() => setExpandedDepts(prev => ({ ...prev, [dept.id]: !prev[dept.id] }))}
                                      className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 hover:text-indigo-650 transition-all text-left font-bold cursor-pointer border-none bg-transparent p-0 max-w-full"
                                    >
                                      {isDeptExpanded ? (
                                        <ChevronDown className="h-4 w-4 text-gray-555 shrink-0" />
                                      ) : (
                                        <ChevronRight className="h-4 w-4 text-gray-555 shrink-0" />
                                      )}
                                      <span className="text-xs font-black text-gray-900">{dept.name}</span>
                                      {dept.code && (
                                        <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-755 border border-indigo-100 text-[9px] font-bold">
                                          {dept.code}
                                        </span>
                                      )}
                                      {dept.start_year && dept.end_year && (
                                        <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-600 text-[9px] font-extrabold whitespace-nowrap">
                                          {dept.start_year}–{dept.end_year}
                                        </span>
                                      )}
                                      <span className={`px-2 py-0.5 rounded-full text-[8.5px] font-bold whitespace-nowrap ${
                                        dept.status === "Inactive" ? "bg-rose-50 text-rose-700 border border-rose-200" : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                      }`}>
                                        {dept.status || "Active"}
                                      </span>
                                      {/* Timetable badge: show per-shift breakdown */}
                                      {(() => {
                                        const shift1 = deptSlots.filter(s => s.shift === 'shift_1').length;
                                        const shift2 = deptSlots.filter(s => s.shift === 'shift_2').length;
                                        const general = deptSlots.filter(s => s.shift === 'general').length;
                                        return deptSlots.length > 0 ? (
                                          <span className="px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-[8.5px] font-extrabold text-emerald-700 flex items-center gap-1 shadow-xs whitespace-nowrap">
                                            <span className="h-1 w-1 rounded-full bg-emerald-600 animate-pulse shrink-0"></span>
                                            {deptSlots.length} Slots
                                            {shift1 > 0 && <span className="bg-teal-100 text-teal-700 px-1 py-0.5 rounded text-[7.5px] font-black">S1:{shift1}</span>}
                                            {shift2 > 0 && <span className="bg-indigo-100 text-indigo-700 px-1 py-0.5 rounded text-[7.5px] font-black">S2:{shift2}</span>}
                                            {general > 0 && <span className="bg-amber-100 text-amber-700 px-1 py-0.5 rounded text-[7.5px] font-black">Gen:{general}</span>}
                                          </span>
                                        ) : (
                                          <span className="px-2 py-0.5 rounded-full bg-slate-50 border border-slate-200 text-[8.5px] font-extrabold text-slate-400 whitespace-nowrap">
                                            No Timetable
                                          </span>
                                        );
                                      })()}
                                    </button>

                                    <div className="flex items-center gap-4 text-[11px] font-bold text-gray-600">
                                      <span>Faculty: <span className="text-gray-900">{facultyCount}</span></span>
                                      <span>Subjects: <span className="text-gray-900">{deptSubjects.length}</span></span>
                                      
                                      <div className="flex items-center gap-1.5 ml-2 border-l border-gray-200 pl-3">
                                        <button
                                          onClick={() => handleOpenDeptModal(dept)}
                                          className="p-1 hover:bg-indigo-55 border border-transparent hover:border-indigo-150 text-gray-555 hover:text-indigo-650 rounded transition-all cursor-pointer bg-transparent"
                                          title="Edit Course"
                                        >
                                          <Edit className="h-3.5 w-3.5" />
                                        </button>
                                        <button
                                          onClick={() => handleDeleteDept(dept.id, dept.name)}
                                          className="p-1 hover:bg-rose-55 border border-transparent hover:border-rose-250 text-gray-555 hover:text-rose-600 rounded transition-all cursor-pointer bg-transparent"
                                          title="Delete Course"
                                        >
                                          <Trash2 className="h-3.5 w-3.5" />
                                        </button>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Department expanded: show Overview Card and Year collapsible cards */}
                                  {isDeptExpanded && (
                                    <div className="p-3 bg-gray-50/50 space-y-4">
                                      {/* Course Overview Details Card */}
                                      <div className="bg-white border border-gray-150 rounded-xl p-4 shadow-sm flex flex-col md:flex-row justify-between gap-4">
                                        <div className="space-y-2 flex-1">
                                          <div className="flex items-center gap-3">
                                            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">Course Details</span>
                                          </div>
                                          <p className="text-[11px] text-gray-550 leading-relaxed font-semibold">
                                            {dept.description || "No description provided for this course."}
                                          </p>
                                        </div>
                                        <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-[11px] font-bold text-gray-600 shrink-0 md:border-l md:border-gray-150 md:pl-6 md:min-w-[280px]">
                                          <div>
                                            <span className="text-[9px] uppercase tracking-wider text-gray-400 block mb-0.5">Course Duration</span>
                                            <span className="text-gray-900 font-extrabold">
                                              {dept.years || 4} Year(s) ({Number(dept.years || 4) * 2} Semesters)
                                            </span>
                                          </div>
                                          <div>
                                            <span className="text-[9px] uppercase tracking-wider text-gray-400 block mb-0.5">Code Prefix</span>
                                            <span className="text-indigo-650 font-extrabold">{dept.code || "None"}</span>
                                          </div>
                                          <div>
                                            <span className="text-[9px] uppercase tracking-wider text-gray-400 block mb-0.5">Offerings</span>
                                            <span className="text-gray-900 font-extrabold">{dept.default_shift === "both" ? "Shift 1 & 2" : dept.default_shift === "shift_2" ? "Shift 2" : "Shift 1 / General"}</span>
                                          </div>
                                          <div className="col-span-2">
                                            <span className="text-[9px] uppercase tracking-wider text-gray-400 block mb-0.5">Assigned Classrooms</span>
                                            <span className="text-gray-900 font-extrabold block">
                                              {formatYearWiseRooms(dept.default_room)}
                                            </span>
                                          </div>
                                          <div>
                                            <span className="text-[9px] uppercase tracking-wider text-gray-400 block mb-0.5">Current Status</span>
                                            <span className={`inline-flex items-center gap-1 text-[10px] ${
                                              dept.status === "Inactive" ? "text-rose-600 font-extrabold" : "text-emerald-600 font-extrabold"
                                            }`}>
                                              <span className={`h-1.5 w-1.5 rounded-full ${
                                                dept.status === "Inactive" ? "bg-rose-600" : "bg-emerald-600"
                                              }`} />
                                              {dept.status || "Active"}
                                            </span>
                                          </div>
                                        </div>
                                      </div>

                                      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                                        {Array.from({ length: dept.years ? Number(dept.years) : 4 }, (_, i) => `Year ${i + 1}`).map((yr, i) => {
                                          const yrSubjects = deptSubjects.filter(s => s.year === yr && (searchQuery === "" || s.name.toLowerCase().includes(searchQuery.toLowerCase())));
                                          const yearKey = `${dept.id}_${yr}`;
                                          const isYearExpanded = expandedDeptYears[yearKey] !== false; // default to expanded/true

                                          const semOdd = `Semester ${2 * (i + 1) - 1}`;
                                          const semEven = `Semester ${2 * (i + 1)}`;
                                          const oddCount = yrSubjects.filter(s => s.semester === semOdd).length;
                                          const evenCount = yrSubjects.filter(s => s.semester === semEven).length;

                                          return (
                                            <div key={yr} className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm flex flex-col">
                                              {/* Year card header */}
                                              <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-gray-50 border-b border-gray-150 font-bold text-gray-805 text-xs gap-2">
                                                <button
                                                  onClick={() => toggleDeptYear(dept.id, yr)}
                                                  className="flex flex-wrap items-center gap-x-2 gap-y-1 hover:text-indigo-650 transition-all text-left font-extrabold cursor-pointer border-none bg-transparent p-0 max-w-full"
                                                >
                                                  {isYearExpanded ? (
                                                    <ChevronDown className="h-4 w-4 text-gray-550 shrink-0" />
                                                  ) : (
                                                    <ChevronRight className="h-4 w-4 text-gray-555 shrink-0" />
                                                  )}
                                                  <div className="flex items-baseline gap-1.5">
                                                    <span>{yr}</span>
                                                    <span className="text-[10.5px] text-gray-400 font-semibold lowercase">
                                                      (sem {2 * (i + 1) - 1}/{2 * (i + 1)})
                                                    </span>
                                                  </div>
                                                  <div className="flex flex-wrap gap-1.5 sm:ml-2">
                                                    <span className="bg-indigo-50 border border-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full text-[9px] font-extrabold whitespace-nowrap">
                                                      Sem {2 * (i + 1) - 1}: {oddCount}
                                                    </span>
                                                    <span className="bg-purple-50 border border-purple-100 text-purple-700 px-2 py-0.5 rounded-full text-[9px] font-extrabold whitespace-nowrap">
                                                      Sem {2 * (i + 1)}: {evenCount}
                                                    </span>
                                                  </div>
                                                </button>
                                                
                                                <button
                                                  onClick={() => handleOpenSubjectModal(undefined, dept.name, yr)}
                                                  className="flex items-center justify-center gap-1 text-[10px] bg-indigo-50 border border-indigo-150 text-indigo-700 hover:bg-indigo-600 hover:text-white hover:border-indigo-600 px-2 py-1 rounded-lg transition-all font-bold cursor-pointer w-full sm:w-auto shrink-0"
                                                >
                                                  <Plus className="h-3 w-3" />
                                                  Add Subject
                                                </button>
                                              </div>

                                              {/* Year card body: subjects list grouped by semester */}
                                               {isYearExpanded && (
                                                 <div className="p-3.5 flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50/30">
                                                   {/* Odd Semester Column */}
                                                   <div className="flex flex-col border border-gray-150 rounded-xl p-3 bg-white shadow-xs">
                                                     <div className="flex items-center justify-between pb-2 border-b border-gray-100 mb-2">
                                                       <span className="font-extrabold text-[10px] uppercase tracking-wider text-indigo-700">{semOdd}</span>
                                                       <span className="bg-indigo-50 border border-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full text-[8.5px] font-extrabold">{oddCount} subject(s)</span>
                                                     </div>
                                                     {yrSubjects.filter(s => s.semester === semOdd).length === 0 ? (
                                                       <div className="text-center py-6 text-gray-400 italic text-[10px] my-auto">No subjects mapped to {semOdd} yet.</div>
                                                     ) : (
                                                       <div className="overflow-x-auto">
                                                         <table className="w-full border-collapse text-left text-[11px] font-medium text-gray-700 min-w-[340px]">
                                                           <thead>
                                                             <tr className="border-b border-gray-150 text-[9px] text-gray-400 font-extrabold uppercase tracking-wider bg-gray-50/50">
                                                               <th className="px-2 py-1.5">Subject Name</th>
                                                               <th className="px-2 py-1.5">Type</th>
                                                                <th className="px-2 py-1.5">Timetable</th>
                                                               <th className="px-2 py-1.5 text-right">Actions</th>
                                                             </tr>
                                                           </thead>
                                                           <tbody className="divide-y divide-gray-100">
                                                             {yrSubjects.filter(s => s.semester === semOdd).map(sub => (
                                                               <tr key={sub.id} className="hover:bg-gray-50/30 transition-colors">
                                                                 <td className="px-2 py-2">
                                                                   <div className="font-bold text-gray-900 leading-tight">
                                                                     {sub.name}
                                                                   </div>
                                                                   <div className="font-mono text-[8px] text-gray-400 mt-0.5">{sub.id}</div>
                                                                 </td>
                                                                 <td className="px-2 py-2">
                                                                   <span className={`px-1.5 py-0.5 rounded-full text-[8px] font-bold capitalize ${
                                                                     sub.type === "theory" ? "bg-blue-50 text-blue-700 border border-blue-200" : "bg-purple-50 text-purple-700 border border-purple-200"
                                                                   }`}>
                                                                     {sub.type}
                                                                   </span>
                                                                 </td>
                                                                  <td className="px-2 py-2">
                                                                    {(() => {
                                                                      const subSlots = slots.filter(s => s.course.toLowerCase() === sub.name.toLowerCase() && (s.department || getDeptFromClassGroup(s.classGroup)) === sub.department);
                                                                      return subSlots.length > 0 ? (
                                                                        <span className="px-1.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-100 text-emerald-700 text-[8.5px] font-extrabold inline-flex items-center gap-0.5 shadow-xs">
                                                                          <span className="h-1 w-1 rounded-full bg-emerald-500 animate-pulse shrink-0"></span>
                                                                          Scheduled ({subSlots.length} hrs)
                                                                        </span>
                                                                      ) : (
                                                                        <span className="px-1.5 py-0.5 rounded-full bg-slate-50 border border-slate-150 text-slate-400 text-[8.5px] font-medium">
                                                                          Unscheduled
                                                                        </span>
                                                                      );
                                                                    })()}
                                                                  </td>
                                                                  <td className="px-2 py-2 text-right">
                                                                   <div className="flex items-center justify-end gap-0.5">
                                                                     <button
                                                                       onClick={() => handleOpenSubjectModal(sub)}
                                                                       className="p-1 hover:bg-indigo-50 border border-transparent hover:border-indigo-150 text-gray-555 hover:text-indigo-650 rounded transition-all cursor-pointer bg-transparent"
                                                                       title="Edit Subject"
                                                                     >
                                                                       <Edit className="h-3 w-3" />
                                                                     </button>
                                                                     <button
                                                                       onClick={() => handleDeleteSubject(sub.id)}
                                                                       className="p-1 hover:bg-rose-50 border border-transparent hover:border-rose-150 text-gray-555 hover:text-rose-600 rounded transition-all cursor-pointer bg-transparent"
                                                                       title="Delete Subject"
                                                                     >
                                                                       <Trash2 className="h-3 w-3" />
                                                                     </button>
                                                                   </div>
                                                                 </td>
                                                               </tr>
                                                             ))}
                                                           </tbody>
                                                         </table>
                                                       </div>
                                                     )}
                                                   </div>

                                                   {/* Even Semester Column */}
                                                   <div className="flex flex-col border border-gray-150 rounded-xl p-3 bg-white shadow-xs">
                                                     <div className="flex items-center justify-between pb-2 border-b border-gray-100 mb-2">
                                                       <span className="font-extrabold text-[10px] uppercase tracking-wider text-purple-700">{semEven}</span>
                                                       <span className="bg-purple-50 border border-purple-100 text-purple-700 px-2 py-0.5 rounded-full text-[8.5px] font-extrabold">{evenCount} subject(s)</span>
                                                     </div>
                                                     {yrSubjects.filter(s => s.semester === semEven).length === 0 ? (
                                                       <div className="text-center py-6 text-gray-400 italic text-[10px] my-auto">No subjects mapped to {semEven} yet.</div>
                                                     ) : (
                                                       <div className="overflow-x-auto">
                                                         <table className="w-full border-collapse text-left text-[11px] font-medium text-gray-700 min-w-[340px]">
                                                           <thead>
                                                             <tr className="border-b border-gray-150 text-[9px] text-gray-400 font-extrabold uppercase tracking-wider bg-gray-50/50">
                                                               <th className="px-2 py-1.5">Subject Name</th>
                                                               <th className="px-2 py-1.5">Type</th>
                                                                <th className="px-2 py-1.5">Timetable</th>
                                                               <th className="px-2 py-1.5 text-right">Actions</th>
                                                             </tr>
                                                           </thead>
                                                           <tbody className="divide-y divide-gray-100">
                                                             {yrSubjects.filter(s => s.semester === semEven).map(sub => (
                                                               <tr key={sub.id} className="hover:bg-gray-50/30 transition-colors">
                                                                 <td className="px-2 py-2">
                                                                   <div className="font-bold text-gray-900 leading-tight">
                                                                     {sub.name}
                                                                   </div>
                                                                   <div className="font-mono text-[8px] text-gray-400 mt-0.5">{sub.id}</div>
                                                                 </td>
                                                                 <td className="px-2 py-2">
                                                                   <span className={`px-1.5 py-0.5 rounded-full text-[8px] font-bold capitalize ${
                                                                     sub.type === "theory" ? "bg-blue-50 text-blue-700 border border-blue-200" : "bg-purple-50 text-purple-700 border border-purple-200"
                                                                   }`}>
                                                                     {sub.type}
                                                                   </span>
                                                                 </td>
                                                                  <td className="px-2 py-2">
                                                                    {(() => {
                                                                      const subSlots = slots.filter(s => s.course.toLowerCase() === sub.name.toLowerCase() && (s.department || getDeptFromClassGroup(s.classGroup)) === sub.department);
                                                                      return subSlots.length > 0 ? (
                                                                        <span className="px-1.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-100 text-emerald-700 text-[8.5px] font-extrabold inline-flex items-center gap-0.5 shadow-xs">
                                                                          <span className="h-1 w-1 rounded-full bg-emerald-500 animate-pulse shrink-0"></span>
                                                                          Scheduled ({subSlots.length} hrs)
                                                                        </span>
                                                                      ) : (
                                                                        <span className="px-1.5 py-0.5 rounded-full bg-slate-50 border border-slate-150 text-slate-400 text-[8.5px] font-medium">
                                                                          Unscheduled
                                                                        </span>
                                                                      );
                                                                    })()}
                                                                  </td>
                                                                  <td className="px-2 py-2 text-right">
                                                                   <div className="flex items-center justify-end gap-0.5">
                                                                     <button
                                                                       onClick={() => handleOpenSubjectModal(sub)}
                                                                       className="p-1 hover:bg-indigo-50 border border-transparent hover:border-indigo-150 text-gray-555 hover:text-indigo-650 rounded transition-all cursor-pointer bg-transparent"
                                                                       title="Edit Subject"
                                                                     >
                                                                       <Edit className="h-3 w-3" />
                                                                     </button>
                                                                     <button
                                                                       onClick={() => handleDeleteSubject(sub.id)}
                                                                       className="p-1 hover:bg-rose-50 border border-transparent hover:border-rose-150 text-gray-555 hover:text-rose-600 rounded transition-all cursor-pointer bg-transparent"
                                                                       title="Delete Subject"
                                                                     >
                                                                       <Trash2 className="h-3 w-3" />
                                                                     </button>
                                                                   </div>
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
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        {activeTab === "subjects" && (
          <div className="space-y-6 animate-fadeIn font-sans text-xs">
            <div className="flex items-center justify-between border-b border-gray-150 pb-3 flex-wrap gap-4">
              <div className="flex items-center gap-2">
                <GraduationCap className="h-5 w-5 text-indigo-655" />
                <div>
                  <h2 className="text-lg font-bold text-gray-900 font-sans">Subjects Master Directory</h2>
                  <p className="text-[10px] text-gray-400 font-semibold mt-0.5">Manage individual syllabus items, semester mappings, and teaching slots</p>
                </div>
              </div>
              {subjectsSubTab === "catalog" && (
                <button
                  onClick={() => handleOpenSubjectModal()}
                  className="btn-gradient shadow-sm text-white px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 shrink-0 cursor-pointer border-none"
                >
                  <Plus className="h-4 w-4" />
                  Add Subject
                </button>
              )}
            </div>

            {/* Sub Tabs Selector */}
            <div className="flex border-b border-gray-150 gap-6">
              <button
                onClick={() => setSubjectsSubTab("catalog")}
                className={`pb-2 px-1 text-xs font-black transition-all ${subjectsSubTab === "catalog" ? "border-b-2 border-indigo-650 text-indigo-650" : "text-gray-405 hover:text-gray-600"}`}
              >
                Subjects Catalog
              </button>
              <button
                onClick={() => setSubjectsSubTab("groups")}
                className={`pb-2 px-1 text-xs font-black transition-all ${subjectsSubTab === "groups" ? "border-b-2 border-indigo-650 text-indigo-650" : "text-gray-405 hover:text-gray-600"}`}
              >
                Subject Groups
              </button>
            </div>

            {subjectsSubTab === "catalog" ? (
              <>
                {/* Filters Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 border border-gray-150 rounded-2xl shadow-xs">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search name, ID, course..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-gray-55 border border-gray-205 rounded-xl pl-9 pr-4 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-600 focus:border-indigo-600 transition-all w-56 font-semibold text-gray-800"
                />
              </div>

              <div className="flex items-center gap-3">
                {/* College filter */}
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Campus:</span>
                  <select
                    value={subjectCollegeFilter}
                    onChange={(e) => setSubjectCollegeFilter(e.target.value)}
                    className="bg-gray-55 border border-gray-205 rounded-xl px-3 py-1.5 font-semibold text-gray-700 focus:outline-none focus:ring-1 focus:ring-indigo-600 focus:border-indigo-600 text-xs cursor-pointer"
                  >
                    <option value="all">All Campuses</option>
                    {colleges.map((col) => (
                      <option key={col.id} value={col.id}>{col.name}</option>
                    ))}
                  </select>
                </div>

                {/* Semester filter */}
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Semester:</span>
                  <select
                    value={subjectSemesterFilter}
                    onChange={(e) => setSubjectSemesterFilter(e.target.value)}
                    className="bg-gray-55 border border-gray-205 rounded-xl px-3 py-1.5 font-semibold text-gray-700 focus:outline-none focus:ring-1 focus:ring-indigo-600 focus:border-indigo-600 text-xs cursor-pointer"
                  >
                    <option value="all">All Semesters</option>
                    {Array.from({ length: 8 }, (_, i) => `Semester ${i + 1}`).map((sem) => (
                      <option key={sem} value={sem}>{sem}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Subjects Table */}
            <div className="overflow-x-auto rounded-2xl border border-gray-200 shadow-sm bg-white">
              <table className="w-full border-collapse text-left text-xs min-w-[700px]">
                <thead>
                  <tr className="bg-gray-55 border-b border-gray-200 text-gray-555 font-bold uppercase text-[9px] tracking-wider">
                    <th className="p-4">ID</th>
                    <th className="p-4">Subject Name</th>
                    <th className="p-4">Campus</th>
                    <th className="p-4">Department / Course</th>
                    <th className="p-4">Subject Group</th>
                    <th className="p-4">Year &amp; Semester</th>
                    <th className="p-4">Type</th>
                    <th className="p-4">Weekly Hours</th>
                    <th className="p-4">Timetable Coverage</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-150 bg-white">
                  {filteredSubjects.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="p-8 text-center text-gray-450 italic bg-white">
                        No subjects found matching the selected criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredSubjects.map((sub) => {
                      const campusName = colleges.find(c => c.id === sub.college_id)?.name || "Unknown Campus";
                      const subSlots = slots.filter(
                        slot => slot.course.toLowerCase() === sub.name.toLowerCase() && 
                                (slot.department || getDeptFromClassGroup(slot.classGroup)) === sub.department
                      );

                      const targetHours = sub.weekly_hours || 4;
                      const scheduledHours = subSlots.length;
                      let statusBadge = null;

                      if (scheduledHours === 0) {
                        statusBadge = (
                          <span className="px-2 py-0.5 rounded-full bg-slate-55 border border-slate-150 text-slate-400 text-[9.5px] font-bold">
                            Unscheduled (0/{targetHours} hrs)
                          </span>
                        );
                      } else if (scheduledHours === targetHours) {
                        statusBadge = (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[9.5px] font-black inline-flex items-center gap-1 shadow-xs">
                            <span className="h-1 w-1 rounded-full bg-emerald-500 animate-pulse shrink-0"></span>
                            Fully Scheduled ({scheduledHours}/{targetHours} hrs)
                          </span>
                        );
                      } else if (scheduledHours < targetHours) {
                        statusBadge = (
                          <span className="px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-[9.5px] font-extrabold inline-flex items-center gap-1 shadow-xs">
                            Under-scheduled ({scheduledHours}/{targetHours} hrs)
                          </span>
                        );
                      } else {
                        statusBadge = (
                          <span className="px-2 py-0.5 rounded-full bg-rose-50 border border-rose-200 text-rose-700 text-[9.5px] font-extrabold inline-flex items-center gap-1 shadow-xs">
                            Over-scheduled ({scheduledHours}/{targetHours} hrs)
                          </span>
                        );
                      }

                      return (
                        <tr key={sub.id} className="hover:bg-gray-55/30 transition-colors">
                          <td className="p-4 font-mono text-[10px] text-gray-400 font-semibold">{sub.id}</td>
                          <td className="p-4 font-bold text-gray-900">{sub.name}</td>
                          <td className="p-4 text-gray-600 font-semibold">{campusName}</td>
                          <td className="p-4 text-gray-600 font-semibold">{sub.department}</td>
                          <td className="p-4">
                            <span className="px-2 py-0.5 rounded-full bg-pink-50 border border-pink-100 text-pink-700 text-[10px] font-bold">
                              {sub.subject_group || "General"}
                            </span>
                          </td>
                          <td className="p-4">
                            <span className="font-bold text-gray-855 block">{sub.year || "Year 1"}</span>
                            <span className="text-[10px] text-indigo-650 font-extrabold">{sub.semester}</span>
                          </td>
                          <td className="p-4">
                            <span className={`px-2 py-0.5 rounded-full text-[8.5px] font-bold capitalize ${
                              sub.type === "theory" 
                                ? "bg-blue-50 text-blue-700 border border-blue-200" 
                                : sub.type === "practical"
                                  ? "bg-purple-50 text-purple-700 border border-purple-200"
                                  : "bg-amber-50 text-amber-700 border border-amber-200"
                            }`}>
                              {sub.type}
                            </span>
                          </td>
                          <td className="p-4 font-bold text-gray-800 text-[11px]">
                            {targetHours} hr(s)
                          </td>
                          <td className="p-4">
                            {statusBadge}
                          </td>
                          <td className="p-4 text-right whitespace-nowrap">
                            <div className="flex justify-end gap-1.5">
                              <button
                                onClick={() => handleOpenSubjectModal(sub)}
                                className="p-1.5 bg-gray-50 border border-gray-250 text-gray-655 hover:text-indigo-600 hover:bg-indigo-55 rounded-lg transition-all cursor-pointer"
                                title="Edit Subject"
                              >
                                <Edit className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteSubject(sub.id)}
                                className="p-1.5 bg-gray-50 border border-gray-250 text-gray-655 hover:text-rose-600 hover:bg-rose-55 rounded-lg transition-all cursor-pointer"
                                title="Delete Subject"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
              </>
            ) : (
              <div className="space-y-6">
                <div className="flex justify-between items-center bg-white p-4 border border-gray-150 rounded-2xl shadow-xs">
                  <div>
                    <h3 className="text-xs font-black text-gray-800 uppercase tracking-wider">Configured Subject Groups</h3>
                    <p className="text-[10px] text-gray-400 font-semibold mt-0.5">Create custom groups to cluster subjects (e.g. English, Aptitude, Soft Skills) and allocate them on timetables.</p>
                  </div>
                  <button
                    onClick={() => handleOpenGroupModal()}
                    className="btn-gradient shadow-sm text-white px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer border-none"
                  >
                    <Plus className="h-4 w-4" />
                    Create Subject Group
                  </button>
                </div>

                <div className="overflow-x-auto rounded-2xl border border-gray-200 shadow-sm bg-white">
                  <table className="w-full border-collapse text-left text-xs min-w-[600px]">
                    <thead>
                      <tr className="bg-gray-55 border-b border-gray-200 text-gray-555 font-bold uppercase text-[9px] tracking-wider">
                        <th className="p-4 w-[15%]">ID</th>
                        <th className="p-4 w-[25%]">Group Name</th>
                        <th className="p-4 w-[40%]">Description</th>
                        <th className="p-4 w-[10%] text-center">Subjects Count</th>
                        <th className="p-4 w-[10%] text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-150 bg-white">
                      {(subjectGroups || []).map((g) => {
                        const count = (subjectsList || []).filter(s => s.subject_group === g.name).length;
                        return (
                          <tr key={g.id} className="hover:bg-gray-55/30 transition-colors">
                            <td className="p-4 font-mono text-[10px] text-gray-400 font-semibold">{g.id}</td>
                            <td className="p-4">
                              <span className="px-2.5 py-0.5 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 text-[10px] font-bold">
                                {g.name}
                              </span>
                            </td>
                            <td className="p-4 text-gray-600 font-semibold">{g.description || "—"}</td>
                            <td className="p-4 text-center font-bold text-gray-700">{count}</td>
                            <td className="p-4 text-right">
                              <div className="flex justify-end gap-1.5">
                                <button
                                  onClick={() => handleOpenGroupModal(g)}
                                  className="p-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-205 text-slate-500 rounded-lg transition-colors cursor-pointer"
                                  title="Edit Group"
                                >
                                  <Edit className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  onClick={() => handleDeleteGroup(g.id)}
                                  className="p-1.5 bg-slate-50 hover:bg-rose-55 border border-slate-205 text-slate-500 hover:text-rose-600 rounded-lg transition-colors cursor-pointer"
                                  title="Delete Group"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Tab: Global Schedule Grid ── */}
        {activeTab === "schedules" && (
          <div className="space-y-6 animate-fadeIn">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-150 pb-3">
              <div className="flex items-center gap-2">
                <Grid className="h-5 w-5 text-indigo-655" />
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Global Scheduled slots</h2>
                  <p className="text-[10px] text-gray-400 font-semibold mt-0.5">Filter and review timetables across the entire university network</p>
                </div>
              </div>

              {/* Filters */}
              <div className="flex flex-wrap gap-2">
                <select
                  value={collegeFilter}
                  onChange={(e) => setCollegeFilter(e.target.value)}
                  className="bg-white border border-gray-200 rounded-xl px-2.5 py-1.5 text-xs text-gray-705 font-bold focus:outline-none cursor-pointer"
                >
                  <option value="all">All Campuses</option>
                  {colleges.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>

                <select
                  value={dayFilter}
                  onChange={(e) => setDayFilter(e.target.value)}
                  className="bg-white border border-gray-200 rounded-xl px-2.5 py-1.5 text-xs text-gray-705 font-bold focus:outline-none cursor-pointer"
                >
                  <option value="all">All Days</option>
                  {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"].map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>

                <select
                  value={shiftFilter}
                  onChange={(e) => setShiftFilter(e.target.value)}
                  className="bg-white border border-gray-200 rounded-xl px-2.5 py-1.5 text-xs text-gray-705 font-bold focus:outline-none cursor-pointer"
                >
                  <option value="all">All Shifts</option>
                  <option value="shift_1">Shift 1</option>
                  <option value="shift_2">Shift 2</option>
                  <option value="general">General Shift</option>
                </select>
              </div>
            </div>

            {/* Search slot bar */}
            <div className="relative max-w-md">
              <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search slot, mentor, room or course..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-10 pr-4 py-2 text-xs text-gray-800 focus:outline-none focus:ring-1 focus:ring-indigo-650"
              />
            </div>

            {filteredSlots.length === 0 ? (
              <div className="text-center py-16 border border-gray-200 rounded-2xl bg-gray-55/50">
                <Grid className="h-10 w-10 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-555 font-semibold">No slot schedules matched your filter query.</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-gray-200">
                <table className="w-full border-collapse text-left text-xs min-w-[850px]">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200 text-gray-555 font-bold uppercase">
                      <th className="p-3">Campus</th>
                      <th className="p-3">Mentor</th>
                      <th className="p-3">Day</th>
                      <th className="p-3">Time Slot</th>
                      <th className="p-3">Shift</th>
                      <th className="p-3">Course / Class Group</th>
                      <th className="p-3">Room</th>
                      <th className="p-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-150 bg-white">
                    {filteredSlots.map((slot) => {
                      const mentorObj = mentors.find(m => m.id === slot.mentorId);
                      const colObj = colleges.find(c => c.id === (mentorObj?.college_id || "college_1"));
                      
                      return (
                        <tr key={slot.id} className="hover:bg-gray-55/30 transition-colors">
                          <td className="p-3 text-gray-805 font-bold">{colObj?.name || "FP City Campus"}</td>
                          <td className="p-3 flex items-center gap-2">
                            <div className="h-6 w-6 rounded-full btn-gradient flex items-center justify-center font-extrabold text-white text-[9px]">
                              {mentorObj?.avatar || "M"}
                            </div>
                            <div>
                              <div className="font-bold text-gray-900">{mentorObj?.name}</div>
                              <div className="text-[9.5px] text-gray-400">{mentorObj?.department}</div>
                            </div>
                          </td>
                          <td className="p-3 text-gray-800 font-semibold">{slot.day}</td>
                          <td className="p-3 text-gray-500 whitespace-nowrap">{formatTimeLabel(slot.time)}</td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded text-[8.5px] font-bold uppercase ${
                              slot.shift === "shift_1" ? "bg-amber-50 text-amber-600 border border-amber-100"
                              : slot.shift === "shift_2" ? "bg-teal-50 text-teal-600 border border-teal-100"
                              : "bg-indigo-50 text-indigo-600 border border-indigo-100"
                            }`}>
                              {slot.shift.replace("_", " ")}
                            </span>
                          </td>
                          <td className="p-3">
                            <div className="font-extrabold text-indigo-700">{slot.course}</div>
                            <div className="text-[9.5px] text-gray-400 font-semibold uppercase">{slot.classGroup || "General Class"}</div>
                          </td>
                          <td className="p-3 text-gray-600">{slot.location}</td>
                          <td className="p-3 text-right">
                            <button
                              onClick={() => {
                                if (colObj) {
                                  setDrillDownCollegeId(colObj.id);
                                }
                              }}
                              className="px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-600 hover:text-white border border-indigo-200 transition-all font-bold text-[10.5px] text-indigo-650 cursor-pointer"
                            >
                              Manage Campus
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── Tab: Reporting Hierarchy Tree ── */}
        {activeTab === "hierarchy" && (
          <div className="space-y-6 animate-fadeIn">
            <div className="flex items-center gap-2 border-b border-gray-150 pb-3">
              <Network className="h-5 w-5 text-indigo-655" />
              <h2 className="text-lg font-bold text-gray-900">Interactive Reporting Hierarchy</h2>
            </div>
            <p className="text-xs text-gray-550 font-medium mb-4">
              Explore the chain of command of the university system, from Super Admin down to Faculty Mentors. Click on caret icons to expand or collapse nodes.
            </p>

            {/* Tree Start */}
            <div className="bg-gray-50 border border-gray-150 rounded-2xl p-6 shadow-inner space-y-4 text-xs select-none">
              {/* Level 0: Super Admin */}
              <div className="space-y-2">
                <div 
                  onClick={() => toggleNode("admin")}
                  className="flex items-center gap-2 p-3 bg-white border border-indigo-200 rounded-xl max-w-md shadow-sm cursor-pointer hover:border-indigo-400 transition-all"
                >
                  {expandedNodes["admin"] ? <ChevronDown className="h-4 w-4 text-indigo-550" /> : <ChevronRight className="h-4 w-4 text-indigo-550" />}
                  <div className="h-7 w-7 rounded-full bg-indigo-600 text-white flex items-center justify-center font-black">SU</div>
                  <div>
                    <div className="font-extrabold text-gray-900 text-sm">Super Admin</div>
                    <div className="text-[10px] text-gray-400">{currentAdmin?.name || "System Admin"} ({currentAdmin?.email || "admin@university.edu"})</div>
                  </div>
                </div>

                {/* Level 1: KAMs */}
                {expandedNodes["admin"] && (
                  <div className="pl-8 border-l border-dashed border-gray-300 ml-5 space-y-3 pt-2">
                    {kamList.map(kam => {
                      const kamNodeId = `kam-${kam.id}`;
                      const kamColleges = colleges.filter(c => c.kam_id === kam.id);
                      
                      return (
                        <div key={kam.id} className="space-y-2">
                          <div 
                            onClick={() => toggleNode(kamNodeId)}
                            className="flex items-center gap-2 p-2.5 bg-white border border-gray-200 rounded-xl max-w-sm shadow-sm cursor-pointer hover:border-indigo-300 transition-all"
                          >
                            {expandedNodes[kamNodeId] ? <ChevronDown className="h-3.5 w-3.5 text-gray-500" /> : <ChevronRight className="h-3.5 w-3.5 text-gray-500" />}
                            <div className="h-6 w-6 rounded-full bg-amber-500 text-white flex items-center justify-center font-black">KAM</div>
                            <div>
                              <div className="font-bold text-gray-905">{kam.name}</div>
                              <div className="text-[9px] text-gray-400">{kam.title} • {kamColleges.length} Campus(es)</div>
                            </div>
                          </div>

                          {/* Level 2: Campuses & CAMs */}
                          {expandedNodes[kamNodeId] && (
                            <div className="pl-6 border-l border-dashed border-gray-300 ml-4 space-y-3 pt-1">
                              {kamColleges.map(col => {
                                const colNodeId = `col-${col.id}`;
                                const cam = camList.find(cm => cm.college_id === col.id);
                                const colMentors = mentors.filter(m => m.college_id === col.id);
                                
                                return (
                                  <div key={col.id} className="space-y-2">
                                    <div 
                                      onClick={() => toggleNode(colNodeId)}
                                      className="flex items-center gap-2 p-2.5 bg-white border border-gray-200 rounded-xl max-w-xs shadow-sm cursor-pointer hover:border-indigo-300 transition-all"
                                    >
                                      {expandedNodes[colNodeId] ? <ChevronDown className="h-3.5 w-3.5 text-gray-500" /> : <ChevronRight className="h-3.5 w-3.5 text-gray-500" />}
                                      <div className="h-6 w-6 rounded-full bg-teal-500 text-white flex items-center justify-center font-black">CAM</div>
                                      <div>
                                        <div className="font-extrabold text-gray-855 leading-tight">{col.name}</div>
                                        <div className="text-[9px] text-gray-400 font-medium">CAM: {cam ? cam.name : "Unassigned"} ({colMentors.length} Faculty)</div>
                                      </div>
                                    </div>

                                    {/* Level 3: Mentors */}
                                    {expandedNodes[colNodeId] && (
                                      <div className="pl-6 border-l border-dashed border-gray-300 ml-4 space-y-2 pt-1">
                                        {colMentors.map(mentor => (
                                          <div 
                                            key={mentor.id}
                                            className="flex items-center gap-1.5 p-1.5 bg-white border border-gray-150 rounded-xl max-w-[240px] shadow-sm animate-fadeIn"
                                          >
                                            <div className="h-6 w-6 rounded-full btn-gradient text-white flex items-center justify-center font-extrabold text-[9px] shrink-0">
                                              {mentor.avatar}
                                            </div>
                                            <div className="min-w-0">
                                              <div className="font-extrabold text-gray-805 truncate text-[10px] leading-tight">{mentor.name}</div>
                                              <div className="text-[8px] text-gray-450 font-bold uppercase tracking-wider mt-0.5 truncate">{mentor.department} • {mentor.shift || "general"}</div>
                                            </div>
                                          </div>
                                        ))}
                                        {colMentors.length === 0 && (
                                          <span className="text-[9px] text-gray-400 italic pl-1">No faculty mentors configured</span>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Tab: Global Audit Logs ── */}
        {activeTab === "logs" && (
          <div className="space-y-6 animate-fadeIn">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-150 pb-3">
              <div className="flex items-center gap-2">
                <History className="h-5 w-5 text-indigo-655" />
                <h2 className="text-lg font-bold text-gray-900">Global System Audit Logs</h2>
              </div>
            </div>

            {/* Search Audit Logs */}
            <div className="relative max-w-md mb-4">
              <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Filter logs by actor, action description, role..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-10 pr-4 py-2 text-xs text-gray-800 focus:outline-none focus:ring-1 focus:ring-indigo-650"
              />
            </div>

            {filteredLogs.length === 0 ? (
              <div className="text-center py-16 border border-gray-200 rounded-2xl bg-gray-55/50">
                <ShieldAlert className="h-10 w-10 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-555 font-semibold">No audit logs found matching your query.</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-gray-200">
                <table className="w-full border-collapse text-left text-xs min-w-[700px]">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200 text-gray-555 font-bold uppercase">
                      <th className="p-3 w-1/4">Actor</th>
                      <th className="p-3 w-7/12">Action Detail</th>
                      <th className="p-3 w-1/6 text-right">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-150 bg-white">
                    {filteredLogs.map((log) => {
                      // Determine badge color for logs
                      const isHandover = log.type.includes("handover");
                      const isCsv = log.type.includes("csv");
                      
                      return (
                        <tr key={log.id} className="hover:bg-gray-55/30 transition-colors">
                          <td className="p-3">
                            <div className="font-bold text-gray-900">{log.actorName}</div>
                            <div className="text-[9px] font-black uppercase text-indigo-600 mt-0.5">{log.actorRole}</div>
                          </td>
                          <td className="p-3">
                            <div className="text-gray-700 font-medium leading-snug">{log.description}</div>
                            <div className="mt-1 flex items-center gap-1.5">
                              <span className={`px-1.5 py-0.2 rounded text-[7.5px] font-black uppercase ${
                                isHandover ? "bg-amber-50 text-amber-700 border border-amber-150"
                                : isCsv ? "bg-teal-50 text-teal-700 border border-teal-150"
                                : "bg-indigo-50 text-indigo-700 border border-indigo-150"
                              }`}>
                                {log.type.replace("_", " ")}
                              </span>
                            </div>
                          </td>
                          <td className="p-3 text-right text-gray-400 font-semibold whitespace-nowrap">
                            {formatDate(log.timestamp)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── Tab: Announcements ── */}
        {activeTab === "announcements" && (
          <div className="space-y-6 animate-fadeIn font-sans text-xs">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-150 pb-3">
              <div className="flex items-center gap-2">
                <Megaphone className="h-5 w-5 text-indigo-650" />
                <h2 className="text-lg font-bold text-gray-900">Campus Announcements Panel</h2>
              </div>
              <button
                onClick={() => {
                  setModalError(null);
                  setAnnForm({ title: "", description: "", target_role: "All", college_id: "" });
                  setShowAnnModal(true);
                }}
                className="btn-gradient shadow-sm text-white px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                Compose Announcement
              </button>
            </div>

            {announcements.length === 0 ? (
              <div className="text-center py-16 border border-gray-205 rounded-2xl bg-gray-55/50">
                <Megaphone className="h-10 w-10 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-555 font-semibold">No announcements published yet.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {announcements.map((ann) => {
                  const targetCampus = colleges.find(c => c.id === ann.college_id)?.name || "All Campuses";
                  return (
                    <div key={ann.id} className="p-6 bg-white border border-gray-200 rounded-2xl shadow-sm hover:shadow-md transition-all relative flex flex-col justify-between">
                      <div className="space-y-3">
                        <div className="flex justify-between items-start gap-4">
                          <h3 className="text-sm font-bold text-gray-900 leading-snug">{ann.title}</h3>
                          <button
                            onClick={() => handleDeleteAnnouncement(ann.id)}
                            className="p-1 hover:bg-rose-50 text-gray-400 hover:text-rose-600 rounded-lg transition-colors cursor-pointer"
                            title="Delete Announcement"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <p className="text-xs text-gray-600 font-semibold leading-relaxed whitespace-pre-line">{ann.description}</p>
                      </div>

                      <div className="mt-5 pt-4 border-t border-gray-100 flex flex-wrap justify-between items-center text-[10px] text-gray-450 gap-2">
                        <div className="flex flex-wrap gap-1.5">
                          <span className="px-2 py-0.5 rounded bg-pink-50 border border-pink-100 text-pink-700 font-bold">
                            Role: {ann.target_role}
                          </span>
                          <span className="px-2 py-0.5 rounded bg-indigo-50 border border-indigo-100 text-indigo-700 font-bold">
                            Campus: {targetCampus}
                          </span>
                        </div>
                        <span className="font-semibold">{formatDate(ann.created_at)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Tab: Holidays ── */}
        {activeTab === "holidays" && (
          <div className="space-y-6 animate-fadeIn font-sans text-xs">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-150 pb-3">
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-indigo-650" />
                <h2 className="text-lg font-bold text-gray-900">Campus Holidays Scheduler</h2>
              </div>
              <button
                onClick={() => {
                  setModalError(null);
                  setHolForm({ title: "", date: "", type: "National Holiday", college_id: "" });
                  setShowHolModal(true);
                }}
                className="btn-gradient shadow-sm text-white px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 composition-btn cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                Schedule Holiday
              </button>
            </div>

            {holidays.length === 0 ? (
              <div className="text-center py-16 border border-gray-205 rounded-2xl bg-gray-55/50">
                <Calendar className="h-10 w-10 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-555 font-semibold">No holidays scheduled.</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-gray-200">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200 text-gray-555 font-bold uppercase">
                      <th className="p-4">Holiday Title</th>
                      <th className="p-4">Date</th>
                      <th className="p-4">Type</th>
                      <th className="p-4">Applicable Campus</th>
                      <th className="p-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-150 bg-white font-medium text-gray-700">
                    {holidays.map((hol) => {
                      const targetCampus = colleges.find(c => c.id === hol.college_id)?.name || "All Campuses";
                      return (
                        <tr key={hol.id} className="hover:bg-gray-55/50 transition-colors">
                          <td className="p-4 font-bold text-gray-900">{hol.title}</td>
                          <td className="p-4 font-semibold text-indigo-650">{hol.date}</td>
                          <td className="p-4">
                            <span className="px-2.5 py-0.5 rounded-full bg-indigo-50 border border-indigo-150 text-[10px] font-bold text-indigo-700">
                              {hol.type}
                            </span>
                          </td>
                          <td className="p-4 text-gray-500 font-bold">{targetCampus}</td>
                          <td className="p-4 text-right">
                            <button
                              onClick={() => handleDeleteHoliday(hol.id)}
                              className="p-1.5 hover:bg-rose-50 text-gray-400 hover:text-rose-600 rounded-lg transition-colors cursor-pointer"
                              title="Delete Holiday"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── Tab: Centralized Users ── */}
        {activeTab === "users" && (() => {
          const pendingSignupsCount = signupRequests.filter(r => r.status === 'pending').length;
          return (
            <div className="space-y-6 animate-fadeIn font-sans text-xs">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-150 pb-3">
                <div className="flex items-center gap-2">
                  <UserCheck className="h-5 w-5 text-indigo-650" />
                  <h2 className="text-lg font-bold text-gray-900">Centralized User Credentials Directory</h2>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setUserSubTab("directory")}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      userSubTab === "directory"
                        ? "bg-indigo-600 text-white shadow-sm"
                        : "bg-gray-100 hover:bg-gray-200 text-gray-700"
                    }`}
                  >
                    Active Users
                  </button>
                  <button
                    onClick={() => setUserSubTab("signups")}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                      userSubTab === "signups"
                        ? "bg-indigo-600 text-white shadow-sm"
                        : "bg-gray-100 hover:bg-gray-200 text-gray-700"
                    }`}
                  >
                    Pending Signups
                    {pendingSignupsCount > 0 && (
                      <span className="px-1.5 py-0.5 rounded-full bg-rose-550 text-[10px] font-black text-white leading-none">
                        {pendingSignupsCount}
                      </span>
                    )}
                  </button>
                </div>
              </div>

              {userSubTab === "directory" ? (
                <div className="overflow-x-auto rounded-2xl border border-gray-200">
                  <table className="w-full border-collapse text-left text-xs">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200 text-gray-555 font-bold uppercase">
                        <th className="p-4">Email</th>
                        <th className="p-4">Reference ID / Username</th>
                        <th className="p-4">Role</th>
                        <th className="p-4">Status</th>
                        <th className="p-4">Last Login</th>
                        <th className="p-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-150 bg-white font-medium text-gray-700">
                      {usersList.map((user) => (
                        <tr key={user.id} className="hover:bg-gray-55/50 transition-colors">
                          <td className="p-4 font-bold text-gray-900 font-mono">{user.email}</td>
                          <td className="p-4 font-mono font-semibold text-gray-500">{user.reference_id || user.id}</td>
                          <td className="p-4">
                            <span className="px-2.5 py-0.5 rounded bg-teal-50 border border-teal-150 text-[10px] font-bold text-teal-700 uppercase">
                              {user.role}
                            </span>
                          </td>
                          <td className="p-4">
                            <button
                              onClick={() => handleToggleUserStatus(user.id)}
                              className={`px-2.5 py-0.5 rounded text-[10px] font-bold uppercase cursor-pointer border ${
                                user.status === "Active"
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                                  : "bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100"
                              }`}
                              title="Toggle Status (Active / Inactive)"
                            >
                              {user.status || "Active"}
                            </button>
                          </td>
                          <td className="p-4 text-gray-450 font-semibold">
                            {user.last_login ? formatDate(user.last_login) : "Never logged in"}
                          </td>
                          <td className="p-4 text-right">
                            <button
                              onClick={() => handleResetUserPassword(user.id)}
                              className="px-3 py-1.5 bg-gray-50 border border-gray-250 text-gray-700 hover:text-indigo-650 hover:bg-indigo-50 rounded-xl transition-all cursor-pointer font-bold text-[10px]"
                              title="Reset password to password123"
                            >
                              Reset Password
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-gray-200">
                  <table className="w-full border-collapse text-left text-xs">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200 text-gray-555 font-bold uppercase">
                        <th className="p-4">Name</th>
                        <th className="p-4">Email</th>
                        <th className="p-4">Requested Role</th>
                        <th className="p-4">Campus / College</th>
                        <th className="p-4">Status</th>
                        <th className="p-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-150 bg-white font-medium text-gray-700">
                      {signupRequests.map((req) => {
                        const targetCol = colleges.find(c => c.id === req.college_id);
                        return (
                          <tr key={req.id} className="hover:bg-gray-55/50 transition-colors">
                            <td className="p-4 font-bold text-gray-900">{req.name}</td>
                            <td className="p-4 font-mono font-semibold text-gray-650">{req.email}</td>
                            <td className="p-4">
                              <span className="px-2 py-0.5 rounded bg-indigo-50 border border-indigo-150 text-[10px] font-bold text-indigo-700 uppercase">
                                {req.requested_role === "pending" ? "Pending Assignment" : req.requested_role}
                              </span>
                            </td>
                            <td className="p-4 text-gray-500 font-bold">{targetCol ? targetCol.name : "Unassigned"}</td>
                            <td className="p-4">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                                req.status === "pending"
                                  ? "bg-amber-50 text-amber-700 border-amber-200"
                                  : req.status === "approved"
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                  : "bg-rose-50 text-rose-700 border-rose-200"
                              }`}>
                                {req.status}
                              </span>
                            </td>
                            <td className="p-4 text-right space-x-2">
                              {req.status === "pending" && (
                                <>
                                  <button
                                    onClick={() => {
                                      setApprovingSignup(req);
                                      setMappingCollegeId(req.college_id || "");
                                      setMappingType("create_new");
                                      setShowApprovalModal(true);
                                    }}
                                    className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-all cursor-pointer font-bold text-[10px]"
                                  >
                                    Approve & Map
                                  </button>
                                  <button
                                    onClick={() => handleRejectSignup(req.id)}
                                    className="px-2.5 py-1.5 bg-rose-50 border border-rose-250 text-rose-700 hover:bg-rose-100 rounded-xl transition-all cursor-pointer font-bold text-[10px]"
                                  >
                                    Reject
                                  </button>
                                </>
                              )}
                              <button
                                onClick={() => handleDeleteSignupRequest(req.id)}
                                className="p-1.5 hover:bg-rose-50 text-gray-400 hover:text-rose-600 rounded-lg transition-colors cursor-pointer inline-flex items-center align-middle"
                                title="Delete Log"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                      {signupRequests.length === 0 && (
                        <tr>
                          <td colSpan={7} className="p-6 text-center text-gray-500 italic">
                            No signup requests submitted yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Approval Mapping Modal */}
              {showApprovalModal && approvingSignup && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                  <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-gray-150 overflow-hidden animate-scaleIn font-sans">
                    <div className="p-6 border-b border-gray-150 flex justify-between items-center bg-gray-50">
                      <div>
                        <h3 className="text-base font-black text-gray-900">Approve & Map User Request</h3>
                        <p className="text-[10px] text-gray-500 font-semibold mt-0.5">Map credentials for {approvingSignup.email}</p>
                      </div>
                      <button
                        onClick={() => {
                          setShowApprovalModal(false);
                          setApprovingSignup(null);
                        }}
                        className="text-gray-400 hover:text-gray-600 font-bold text-lg cursor-pointer"
                      >
                        ✕
                      </button>
                    </div>

                    <form onSubmit={handleApproveSignupSubmit} className="p-6 space-y-4 text-xs font-semibold">
                      {/* User Details */}
                      <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200/50 space-y-1">
                        <div className="flex justify-between">
                          <span className="text-gray-500">Name:</span>
                          <span className="text-gray-900 font-bold">{approvingSignup.name}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Access Requested:</span>
                          <span className="text-indigo-650 font-bold uppercase">Pending Decision</span>
                        </div>
                      </div>

                      {/* Role selection - Admin Decides! */}
                      <div className="space-y-1">
                        <label className="text-[10px] text-gray-400 uppercase tracking-wider block font-bold">Assign Target Role</label>
                        <select
                          required
                          value={approvingRole}
                          onChange={(e) => {
                            setApprovingRole(e.target.value);
                            setSelectedReferenceId("");
                            setMappingCollegeId("");
                            setMappingDept("");
                            setMappingClassGroup("");
                          }}
                          className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 font-bold focus:outline-none focus:ring-1 focus:ring-indigo-650 cursor-pointer"
                        >
                          <option value="student">Student</option>
                          <option value="mentor">Mentor / Faculty</option>
                          <option value="cam">Campus Manager (HOD)</option>
                          <option value="sme">Subject Matter Expert (SME)</option>
                        </select>
                      </div>

                      {/* Mapping Type Selection */}
                      <div className="space-y-1">
                        <label className="text-[10px] text-gray-400 uppercase tracking-wider block font-bold">Mapping Action</label>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => setMappingType("create_new")}
                            className={`py-2 px-3 rounded-xl border font-bold text-center cursor-pointer transition-all ${
                              mappingType === "create_new"
                                ? "bg-indigo-50 border-indigo-600 text-indigo-600 animate-fadeIn"
                                : "bg-white border-gray-250 text-gray-605 hover:bg-gray-50"
                            }`}
                          >
                            Create New Profile
                          </button>
                          <button
                            type="button"
                            onClick={() => setMappingType("link_existing")}
                            className={`py-2 px-3 rounded-xl border font-bold text-center cursor-pointer transition-all ${
                              mappingType === "link_existing"
                                ? "bg-indigo-50 border-indigo-600 text-indigo-600 animate-fadeIn"
                                : "bg-white border-gray-250 text-gray-605 hover:bg-gray-50"
                            }`}
                          >
                            Link to Existing
                          </button>
                        </div>
                      </div>

                      {/* Conditional Fields based on selection */}
                      {mappingType === "link_existing" ? (
                        // Link Existing Dropdown
                        <div className="space-y-1">
                          <label className="text-[10px] text-gray-400 uppercase tracking-wider block font-bold">Select Profile to Link</label>
                          <select
                            required
                            value={selectedReferenceId}
                            onChange={(e) => setSelectedReferenceId(e.target.value)}
                            className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 font-bold focus:outline-none focus:ring-1 focus:ring-indigo-650 cursor-pointer"
                          >
                            <option value="">-- Choose Profile --</option>
                            {approvingRole === "mentor" &&
                              mentors
                                .filter((m: any) => !usersList.some((u: any) => u.reference_id === m.id))
                                .map((m: any) => (
                                  <option key={m.id} value={m.id}>
                                    {m.name} ({m.email}) - {m.id}
                                  </option>
                                ))}
                            {approvingRole === "student" &&
                              students
                                .filter((s: any) => !usersList.some((u: any) => u.reference_id === s.id))
                                .map((s: any) => (
                                  <option key={s.id} value={s.id}>
                                    {s.name} ({s.email}) - {s.id}
                                  </option>
                                ))}
                            {approvingRole === "cam" &&
                              camList
                                .filter((c: any) => !usersList.some((u: any) => u.reference_id === c.id))
                                .map((c: any) => (
                                  <option key={c.id} value={c.id}>
                                    {c.name} ({c.email}) - {c.id}
                                  </option>
                                ))}
                            {approvingRole === "sme" &&
                              smes
                                .filter((s: any) => !usersList.some((u: any) => u.reference_id === s.id))
                                .map((s: any) => (
                                  <option key={s.id} value={s.id}>
                                    {s.name} ({s.email}) - {s.id}
                                  </option>
                                ))}
                          </select>
                        </div>
                      ) : (
                        // Create New Profile Fields
                        <div className="space-y-3">
                          {/* College selection (except for SME) */}
                          {approvingRole !== "sme" && (
                            <div className="space-y-1">
                              <label className="text-[10px] text-gray-400 uppercase tracking-wider block font-bold">Assign College / Campus</label>
                              <select
                                required
                                value={mappingCollegeId}
                                onChange={(e) => setMappingCollegeId(e.target.value)}
                                className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 font-bold focus:outline-none focus:ring-1 focus:ring-indigo-650 cursor-pointer"
                              >
                                <option value="">-- Choose Campus --</option>
                                {colleges.map((col) => (
                                  <option key={col.id} value={col.id}>
                                    {col.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}

                          {/* Group selection (for mentor/student) */}
                          {(approvingRole === "mentor" || approvingRole === "student") && (
                            <div className="space-y-1">
                              <label className="text-[10px] text-gray-400 uppercase tracking-wider block font-bold">Group</label>
                              <select
                                required
                                value={mappingDept}
                                onChange={(e) => setMappingDept(e.target.value)}
                                className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 font-bold focus:outline-none focus:ring-1 focus:ring-indigo-650 cursor-pointer"
                              >
                                <option value="">-- Choose Group --</option>
                                {subjectGroups.map((sg) => (
                                  <option key={sg.id} value={sg.name}>
                                    {sg.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}

                          {/* Class Group selection (for student) */}
                          {approvingRole === "student" && (
                            <div className="space-y-1">
                              <label className="text-[10px] text-gray-400 uppercase tracking-wider block font-bold">Class Cohort / Group</label>
                              <input
                                type="text"
                                required
                                placeholder="e.g. CS-A, BCOM-B"
                                value={mappingClassGroup}
                                onChange={(e) => setMappingClassGroup(e.target.value)}
                                className="w-full bg-white border border-gray-200 rounded-xl px-3.5 py-2 font-bold focus:outline-none focus:ring-1 focus:ring-indigo-650"
                              />
                            </div>
                          )}
                        </div>
                      )}

                      {/* Footer Buttons */}
                      <div className="flex gap-3 pt-3 border-t border-gray-150">
                        <button
                          type="button"
                          onClick={() => {
                            setShowApprovalModal(false);
                            setApprovingSignup(null);
                          }}
                          className="flex-1 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl text-center cursor-pointer transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-center cursor-pointer transition-colors shadow"
                        >
                          Approve & Save
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {/* ── Tab: Subject Matter Experts (SMEs) ── */}
        {activeTab === "smes" && (
          <div className="space-y-6 animate-fadeIn font-sans text-xs">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-150 pb-3">
              <div className="flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-indigo-650" />
                <h2 className="text-lg font-bold text-gray-900">Subject Matter Experts (SMEs) Directory</h2>
              </div>
              <button
                onClick={() => handleOpenSmeModal()}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold flex items-center gap-1.5 transition-all shadow-md cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                Add SME
              </button>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-gray-200">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-gray-555 font-bold uppercase">
                    <th className="p-4">ID</th>
                    <th className="p-4">Name</th>
                    <th className="p-4">Email</th>
                    <th className="p-4">Subject Specialization / Group</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-150 bg-white font-medium text-gray-700">
                  {smes && smes.length > 0 ? (
                    smes.map((sme) => (
                      <tr key={sme.id} className="hover:bg-gray-55/50 transition-colors">
                        <td className="p-4 font-mono font-semibold text-gray-500">{sme.id}</td>
                        <td className="p-4 font-bold text-gray-900">{sme.name}</td>
                        <td className="p-4 font-mono font-semibold text-gray-600">{sme.email}</td>
                        <td className="p-4">
                          <span className="px-2.5 py-0.5 rounded bg-violet-50 border border-violet-150 text-[10px] font-bold text-violet-700 uppercase">
                            {sme.subject || "Unassigned"}
                          </span>
                        </td>
                        <td className="p-4 text-right space-x-2">
                          <button
                            onClick={() => handleOpenSmeModal(sme)}
                            className="p-1.5 hover:bg-indigo-50 hover:text-indigo-650 rounded-lg text-gray-400 transition-colors cursor-pointer inline-flex"
                            title="Edit SME"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteSme(sme.id)}
                            className="p-1.5 hover:bg-rose-50 hover:text-rose-650 rounded-lg text-gray-400 transition-colors cursor-pointer inline-flex"
                            title="Delete SME"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-gray-450 italic bg-slate-50/50">
                        No Subject Matter Experts registered in the database yet. Click "Add SME" to get started.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Tab: Sessions History ── */}
        {activeTab === "sessions" && (
          <div className="space-y-6 animate-fadeIn font-sans text-xs">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-150 pb-3">
              <div className="flex items-center gap-2">
                <History className="h-5 w-5 text-indigo-650" />
                <h2 className="text-lg font-bold text-gray-900">Centralized User Login Sessions Audit</h2>
              </div>
            </div>

            {loginHistory.length === 0 ? (
              <div className="text-center py-16 border border-gray-205 rounded-2xl bg-gray-55/50">
                <History className="h-10 w-10 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-555 font-semibold">No login sessions recorded.</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-gray-200">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200 text-gray-555 font-bold uppercase">
                      <th className="p-4">User ID / Email</th>
                      <th className="p-4">Login Time</th>
                      <th className="p-4">IP Address</th>
                      <th className="p-4">Device / Client</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-150 bg-white font-medium text-gray-700">
                    {loginHistory.map((hist) => {
                      const matchedUser = usersList.find(u => u.id === hist.user_id);
                      return (
                        <tr key={hist.id} className="hover:bg-gray-55/50 transition-colors">
                          <td className="p-4">
                            <div className="font-bold text-gray-900 font-mono">{matchedUser ? matchedUser.email : hist.user_id}</div>
                            {matchedUser && (
                              <span className="text-[9px] font-black uppercase text-indigo-600 mt-0.5 block">
                                {matchedUser.role}
                              </span>
                            )}
                          </td>
                          <td className="p-4 font-semibold text-indigo-650">{formatDate(hist.login_time)}</td>
                          <td className="p-4 font-mono text-gray-500">{hist.ip || "127.0.0.1"}</td>
                          <td className="p-4 text-gray-500">{hist.device || "Browser"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
      {/* ── Campus Modal ── */}
      {showCampusModal && (
        <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl border border-gray-150 shadow-xl max-w-2xl w-full overflow-hidden animate-slideUp flex flex-col my-auto max-h-[90vh]">
            {/* Modal Header */}
            <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100 bg-gray-50">
              <h3 className="font-extrabold text-gray-900 text-sm flex items-center gap-1.5">
                <Building2 className="h-5 w-5 text-indigo-650" />
                {editingCampus ? "Edit Campus" : campusSuccessCreatedId ? "Campus Created!" : "Add New Campus"}
              </h3>
              <button
                type="button"
                onClick={() => { setShowCampusModal(false); setCampusSuccessCreatedId(null); }}
                className="p-1 hover:bg-gray-250 rounded-lg transition-colors cursor-pointer text-gray-500 hover:text-gray-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* ── SUCCESS SCREEN ── */}
            {campusSuccessCreatedId ? (
              <div className="p-8 space-y-6 animate-fadeIn">
                <div className="text-center space-y-2">
                  <div className="h-16 w-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto">
                    <span className="text-3xl"></span>
                  </div>
                  <h4 className="font-black text-gray-900 text-base">Campus Created Successfully!</h4>
                  <p className="text-xs text-gray-500 font-semibold">What would you like to do next?</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCampusModal(false);
                      setCampusSuccessCreatedId(null);
                      setActiveTab("campuses");
                    }}
                    className="flex flex-col items-center gap-1.5 p-4 bg-indigo-50 hover:bg-indigo-100 border border-indigo-150 rounded-2xl transition-all cursor-pointer group"
                  >
                    <Building2 className="h-5 w-5 text-indigo-650 group-hover:scale-110 transition-transform" />
                    <span className="text-xs font-extrabold text-indigo-700">Open Campus</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowCampusModal(false);
                      setCampusSuccessCreatedId(null);
                      setShowCamModal(true);
                      setCamForm({ id: "", name: "", email: "", college_id: campusSuccessCreatedId, kam_id: "" });
                      setEditingCam(false);
                    }}
                    className="flex flex-col items-center gap-1.5 p-4 bg-violet-50 hover:bg-violet-100 border border-violet-150 rounded-2xl transition-all cursor-pointer group"
                  >
                    <Users className="h-5 w-5 text-violet-650 group-hover:scale-110 transition-transform" />
                    <span className="text-xs font-extrabold text-violet-700">Add Campus Manager</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowCampusModal(false);
                      setCampusSuccessCreatedId(null);
                      setShowSubjectModal(true);
                    }}
                    className="flex flex-col items-center gap-1.5 p-4 bg-amber-50 hover:bg-amber-100 border border-amber-150 rounded-2xl transition-all cursor-pointer group"
                  >
                    <BookOpen className="h-5 w-5 text-amber-650 group-hover:scale-110 transition-transform" />
                    <span className="text-xs font-extrabold text-amber-700">Add Subjects</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowCampusModal(false);
                      setCampusSuccessCreatedId(null);
                      setActiveTab("schedules");
                    }}
                    className="flex flex-col items-center gap-1.5 p-4 bg-emerald-50 hover:bg-emerald-100 border border-emerald-150 rounded-2xl transition-all cursor-pointer group"
                  >
                    <CalendarDays className="h-5 w-5 text-emerald-650 group-hover:scale-110 transition-transform" />
                    <span className="text-xs font-extrabold text-emerald-700">Generate Timetable</span>
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => { setShowCampusModal(false); setCampusSuccessCreatedId(null); }}
                  className="w-full py-2.5 text-gray-500 hover:text-gray-800 font-bold text-xs transition-colors cursor-pointer"
                >
                  Close
                </button>
              </div>
            ) : (
              <form onSubmit={handleCampusSubmit} className="flex flex-col flex-1 min-h-0 text-xs font-semibold">
                {/* Stepper */}
                <div className="flex items-center px-6 py-4 bg-gray-50 border-b border-gray-150 shrink-0 gap-0">
                  {[
                    { step: 1, label: "Campus Info" },
                    { step: 2, label: "Courses" },
                    { step: 3, label: "Shift Config" },
                    { step: 4, label: "Review" }
                  ].map((s, idx) => {
                     const isActive = campusWizardStep === s.step;
                     const isDone = campusWizardStep > s.step;
                     return (
                     <React.Fragment key={s.step}>
                       <div className="flex items-center gap-1.5 shrink-0">
                         <div
                           className={`h-7 w-7 rounded-full flex items-center justify-center text-[11px] font-black transition-all ${isDone ? 'text-white' : isActive ? 'text-white' : 'text-gray-400'}`}
                           style={{
                             background: isDone ? '#10b981' : isActive ? 'linear-gradient(135deg,#6366f1,#4f46e5)' : '#e5e7eb',
                             boxShadow: isActive ? '0 0 0 4px rgba(99,102,241,0.18), 0 2px 8px rgba(99,102,241,0.35)' : 'none'
                           }}
                         >
                           {isDone ? "Yes" : s.step}
                         </div>
                         <span
                           className={`text-[9.5px] uppercase tracking-wider font-extrabold whitespace-nowrap transition-colors ${isActive ? '' : isDone ? 'text-emerald-600' : 'text-gray-400'}`}
                           style={isActive ? { color: '#4f46e5' } : {}}
                         >
                           {s.label}
                         </span>
                       </div>
                       {idx < 3 && (
                         <div
                           className="flex-1 h-[3px] mx-2 rounded-full transition-all"
                           style={{
                             background: isDone
                               ? 'linear-gradient(to right,#10b981,#34d399)'
                               : isActive
                               ? 'linear-gradient(to right,#6366f1 30%,#e5e7eb)'
                               : '#e5e7eb'
                           }}
                         />
                       )}
                     </React.Fragment>
                   )})}
                </div>

                <div className="p-6 overflow-y-auto space-y-4 flex-1">
                  {modalError && (
                    <div className="p-3 bg-rose-50 border border-rose-150 rounded-xl text-rose-700 font-bold flex items-center gap-1.5">
                      <ShieldAlert className="h-4 w-4 shrink-0" />
                      {modalError}
                    </div>
                  )}

                  {/* ────────────────── STEP 1: CAMPUS INFO ────────────────── */}
                  {campusWizardStep === 1 && (
                    <div className="space-y-4 animate-fadeIn">
                      <div className="pb-1 border-b border-gray-100">
                        <h4 className="text-xs font-black text-gray-800 uppercase tracking-wider">Campus Information</h4>
                        <p className="text-[9.5px] text-gray-400 font-semibold mt-0.5">Only campus-level details here. Courses and timings come next.</p>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1 col-span-2">
                          <label className="text-[10px] text-gray-400 uppercase tracking-wider block font-bold">Campus Name *</label>
                          <input
                            type="text"
                            required
                            placeholder="e.g. FP South Campus"
                            value={campusForm.name}
                            onChange={(e) => {
                              const name = e.target.value;
                              const code = name
                                .toLowerCase()
                                .replace(/[^a-z0-9\s]/g, "")
                                .trim()
                                .split(/\s+/)
                                .map((w, i) => i === 0 ? w : w.charAt(0).toUpperCase() + w.slice(1))
                                .join("")
                                .substring(0, 12);
                              setCampusForm({ ...campusForm, name, code: campusForm.code || code });
                            }}
                            className="w-full bg-gray-55 border border-gray-200 rounded-xl px-3.5 py-2.5 font-bold focus:outline-none focus:ring-1 focus:ring-indigo-650"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] text-gray-400 uppercase tracking-wider block font-bold">
                            Campus Code
                            <span className="ml-1 text-indigo-500 font-bold normal-case">(Auto-generated)</span>
                          </label>
                          <input
                            type="text"
                            required
                            placeholder="Auto-generated from name"
                            disabled={editingCampus}
                            value={campusForm.code}
                            onChange={(e) => setCampusForm({ ...campusForm, code: e.target.value })}
                            className="w-full bg-gray-100 border border-gray-200 rounded-xl px-3.5 py-2.5 font-bold focus:outline-none focus:ring-1 focus:ring-indigo-650 text-gray-500 disabled:text-gray-400"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] text-gray-400 uppercase tracking-wider block font-bold">Academic Year *</label>
                          <select
                            required
                            value={campusForm.academic_year}
                            onChange={(e) => setCampusForm({ ...campusForm, academic_year: e.target.value })}
                            className="w-full bg-gray-55 border border-gray-200 rounded-xl px-3 py-2.5 font-bold focus:outline-none focus:ring-1 focus:ring-indigo-650 cursor-pointer"
                          >
                            {["2024-2025", "2025-2026", "2026-2027", "2027-2028", "2028-2029"].map(yr => (
                              <option key={yr} value={yr}>{yr}</option>
                            ))}
                          </select>
                        </div>

                        <div className="space-y-1 col-span-2">
                          <label className="text-[10px] text-gray-400 uppercase tracking-wider block font-bold">Address / Location *</label>
                          <input
                            type="text"
                            required
                            placeholder="e.g. 78, West Tambaram, Chennai"
                            value={campusForm.address}
                            onChange={(e) => setCampusForm({ ...campusForm, address: e.target.value })}
                            className="w-full bg-gray-55 border border-gray-200 rounded-xl px-3.5 py-2.5 font-bold focus:outline-none focus:ring-1 focus:ring-indigo-650"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] text-gray-400 uppercase tracking-wider block font-bold">KAM (Key Account Manager) *</label>
                          <select
                            required
                            value={campusForm.kam_id}
                            onChange={(e) => setCampusForm({ ...campusForm, kam_id: e.target.value })}
                            className="w-full bg-gray-55 border border-gray-200 rounded-xl px-3 py-2.5 font-bold focus:outline-none focus:ring-1 focus:ring-indigo-650 cursor-pointer"
                          >
                            <option value="">Select KAM</option>
                            {kamList.map(kam => (
                              <option key={kam.id} value={kam.id}>{kam.name}</option>
                            ))}
                          </select>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] text-gray-400 uppercase tracking-wider block font-bold">Campus Manager <span className="text-gray-400 font-semibold normal-case">(Optional)</span></label>
                          <select
                            value={campusForm.manager}
                            onChange={(e) => setCampusForm({ ...campusForm, manager: e.target.value })}
                            className="w-full bg-gray-55 border border-gray-200 rounded-xl px-3 py-2.5 font-bold focus:outline-none focus:ring-1 focus:ring-indigo-650 cursor-pointer"
                          >
                            <option value="">Select CAM (Optional)</option>
                            {camList.map(cam => (
                              <option key={cam.id} value={cam.id}>{cam.name}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* Shift Mode Toggle */}
                      <div className="space-y-1">
                        <label className="text-[10px] text-gray-400 uppercase tracking-wider block font-bold">Shift Mode *</label>
                        <div className="flex gap-3">
                          <button
                            type="button"
                            onClick={() => setCampusForm({ ...campusForm, has_shifts: 0 })}
                            className={`flex-1 flex items-center gap-2 p-3 rounded-xl border-2 transition-all cursor-pointer ${
                              campusForm.has_shifts === 0
                                ? "border-indigo-500 bg-indigo-50 text-indigo-800"
                                : "border-gray-200 bg-white text-gray-500 hover:border-gray-300"
                            }`}
                          >
                            <div className={`h-4 w-4 rounded-full border-2 flex items-center justify-center ${campusForm.has_shifts === 0 ? "border-indigo-500" : "border-gray-300"}`}>
                              {campusForm.has_shifts === 0 && <div className="h-2 w-2 rounded-full bg-indigo-500" />}
                            </div>
                            <div className="text-left">
                              <div className="font-extrabold text-[11px]">General Shift</div>
                              <div className="text-[9px] font-semibold opacity-70">Single shift for all students</div>
                            </div>
                          </button>
                          <button
                            type="button"
                            onClick={() => setCampusForm({ ...campusForm, has_shifts: 1 })}
                            className={`flex-1 flex items-center gap-2 p-3 rounded-xl border-2 transition-all cursor-pointer ${
                              campusForm.has_shifts === 1
                                ? "border-indigo-500 bg-indigo-50 text-indigo-800"
                                : "border-gray-200 bg-white text-gray-500 hover:border-gray-300"
                            }`}
                          >
                            <div className={`h-4 w-4 rounded-full border-2 flex items-center justify-center ${campusForm.has_shifts === 1 ? "border-indigo-500" : "border-gray-300"}`}>
                              {campusForm.has_shifts === 1 && <div className="h-2 w-2 rounded-full bg-indigo-500" />}
                            </div>
                            <div className="text-left">
                              <div className="font-extrabold text-[11px]">Multiple Shifts</div>
                              <div className="text-[9px] font-semibold opacity-70">Shift 1 &amp; Shift 2 separately</div>
                            </div>
                          </button>
                        </div>
                      </div>

                      {/* Working Days Config */}
                      <div className="space-y-1">
                        <label className="text-[10px] text-gray-400 uppercase tracking-wider block font-bold">Working Days *</label>
                        <div className="flex gap-3">
                          <button
                            type="button"
                            onClick={() => setCampusForm({ ...campusForm, working_days: 5 })}
                            className={`flex-1 flex items-center gap-2 p-3 rounded-xl border-2 transition-all cursor-pointer ${
                              (campusForm.working_days ?? 5) === 5
                                ? "border-indigo-500 bg-indigo-50 text-indigo-800"
                                : "border-gray-200 bg-white text-gray-500 hover:border-gray-300"
                            }`}
                          >
                            <div className={`h-4 w-4 rounded-full border-2 flex items-center justify-center ${(campusForm.working_days ?? 5) === 5 ? "border-indigo-500" : "border-gray-300"}`}>
                              {(campusForm.working_days ?? 5) === 5 && <div className="h-2 w-2 rounded-full bg-indigo-500" />}
                            </div>
                            <div className="text-left">
                              <div className="font-extrabold text-[11px]">5 Working Days</div>
                              <div className="text-[9px] font-semibold opacity-70">Monday to Friday schedule</div>
                            </div>
                          </button>
                          <button
                            type="button"
                            onClick={() => setCampusForm({ ...campusForm, working_days: 6 })}
                            className={`flex-1 flex items-center gap-2 p-3 rounded-xl border-2 transition-all cursor-pointer ${
                              (campusForm.working_days ?? 5) === 6
                                ? "border-indigo-500 bg-indigo-50 text-indigo-800"
                                : "border-gray-200 bg-white text-gray-500 hover:border-gray-300"
                            }`}
                          >
                            <div className={`h-4 w-4 rounded-full border-2 flex items-center justify-center ${(campusForm.working_days ?? 5) === 6 ? "border-indigo-500" : "border-gray-300"}`}>
                              {(campusForm.working_days ?? 5) === 6 && <div className="h-2 w-2 rounded-full bg-indigo-500" />}
                            </div>
                            <div className="text-left">
                              <div className="font-extrabold text-[11px]">6 Working Days</div>
                              <div className="text-[9px] font-semibold opacity-70">Monday to Saturday schedule</div>
                            </div>
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ────────────────── STEP 2: COURSES ────────────────── */}
                  {campusWizardStep === 2 && (
                    <div className="space-y-4 animate-fadeIn">
                      <div className="pb-1 border-b border-gray-100 flex items-center justify-between">
                        <div>
                          <h4 className="text-xs font-black text-gray-800 uppercase tracking-wider">Courses</h4>
                          <p className="text-[9.5px] text-gray-400 font-semibold mt-0.5">Add courses and assign rooms for each year &amp; section.</p>
                        </div>
                        <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-150 px-2 py-0.5 rounded-full">
                          {wizardCourses.length} Course{wizardCourses.length !== 1 ? "s" : ""}
                        </span>
                      </div>

                      {/* Existing / Added Courses List */}
                      {wizardCourses.length > 0 && (
                        <div className="space-y-2 max-h-[180px] overflow-y-auto pr-1">
                          {wizardCourses.map((c, idx) => (
                            <div key={idx} className="flex items-start justify-between bg-indigo-50/40 border border-indigo-100 p-3 rounded-2xl gap-2">
                              <div className="space-y-1 flex-1 min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="font-extrabold text-xs text-gray-800">{c.name}</span>
                                  <span className="px-1.5 rounded bg-indigo-50 border border-indigo-150 text-indigo-700 text-[8px] font-extrabold uppercase shrink-0">
                                    {c.years} Yrs · {c.years * 2} Sem
                                  </span>
                                  {c.isExisting && (
                                    <span className="px-1.5 rounded bg-emerald-50 border border-emerald-150 text-emerald-700 text-[8px] font-extrabold uppercase shrink-0">Saved</span>
                                  )}
                                </div>
                                {c.sectionRooms && Object.keys(c.sectionRooms).length > 0 && (
                                  <div className="text-[9px] text-gray-455 font-bold flex flex-wrap gap-1.5">
                                    {Object.entries(c.sectionRooms as Record<string, string>).map(([key, room]) => (
                                      <span key={key} className="bg-white border border-gray-150 px-1.5 py-0.5 rounded-lg">
                                        {key}: <span className="text-gray-700">{room}</span>
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                              {!c.isExisting && (
                                <button
                                  type="button"
                                  onClick={() => setWizardCourses(prev => prev.filter((_, i) => i !== idx))}
                                  className="text-[10px] text-red-500 font-extrabold hover:text-red-700 bg-red-50 hover:bg-red-100 px-2.5 py-1 rounded-xl transition-colors cursor-pointer shrink-0"
                                >
                                  Remove
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Add Course Sub-Form */}
                      <div className="bg-slate-50/60 p-4 rounded-2xl border border-gray-205 space-y-3.5">
                        <div className="text-[10px] font-black text-gray-550 uppercase tracking-wider">+ Add Course</div>

                        {/* Course Name */}
                        <div className="space-y-1">
                          <label className={`text-[9.5px] uppercase font-bold block transition-colors ${courseFieldErrors.name ? 'text-red-500' : 'text-gray-400'}`}>Course Name *</label>
                          <input
                            type="text"
                            value={wizardCourseForm.name}
                            onChange={(e) => {
                              setWizardCourseForm({ ...wizardCourseForm, name: e.target.value });
                              if (e.target.value.trim()) setCourseFieldErrors(prev => ({ ...prev, name: false }));
                            }}
                            placeholder="e.g. B. Sc Computer Science"
                            className={`w-full rounded-xl px-3 py-2 font-bold text-xs focus:outline-none focus:ring-2 transition-all ${
                              courseFieldErrors.name 
                                ? 'border-2 border-red-400 bg-red-50 focus:ring-red-200' 
                                : 'bg-white border border-gray-200 focus:ring-indigo-100 focus:border-indigo-400'
                            }`}
                          />
                          {courseFieldErrors.name && <p className="text-[9px] text-red-500 font-bold mt-0.5"> Course name is required</p>}
                        </div>

                        {/* Duration Buttons */}
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <label className="text-[9.5px] text-gray-400 uppercase font-bold block">Duration *</label>
                            <span className="text-[9px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-full">
                              {wizardCourseForm.years * 2} Semesters (Auto)
                            </span>
                          </div>
                          <div className="flex gap-2">
                            {[2, 3, 4, 5].map(y => (
                              <button
                                key={y}
                                type="button"
                                onClick={() => {
                                  const newSections: Record<number, number> = {};
                                  for (let i = 1; i <= y; i++) {
                                    newSections[i] = wizardCourseForm.sections[i] || 1;
                                  }
                                  setWizardCourseForm(prev => ({ ...prev, years: y, sections: newSections, sectionRooms: {} }));
                                }}
                                className={`flex-1 py-2 rounded-xl font-extrabold text-xs transition-all cursor-pointer border-2 ${
                                  wizardCourseForm.years === y
                                    ? "bg-indigo-600 border-indigo-600 text-white shadow-sm"
                                    : "bg-white border-gray-200 text-gray-600 hover:border-indigo-300"
                                }`}
                              >
                                {y} Yrs
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Number of Sections per Year */}
                        <div className="space-y-2">
                          <label className="text-[9.5px] text-gray-400 uppercase font-bold block">Sections per Year *</label>
                          <div className="grid grid-cols-2 gap-2">
                            {Array.from({ length: wizardCourseForm.years }, (_, i) => i + 1).map(yr => (
                              <div key={yr} className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2">
                                <span className="text-[9.5px] font-extrabold text-gray-700 w-12 shrink-0">Year {yr}</span>
                                <div className="flex items-center gap-1 ml-auto">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const cur = wizardCourseForm.sections[yr] || 1;
                                      if (cur > 1) {
                                        setWizardCourseForm(prev => ({
                                          ...prev,
                                          sections: { ...prev.sections, [yr]: cur - 1 },
                                          sectionRooms: {}
                                        }));
                                      }
                                    }}
                                    className="h-5 w-5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 font-black flex items-center justify-center cursor-pointer transition-colors text-sm"
                                  >−</button>
                                  <span className="w-5 text-center font-extrabold text-xs text-gray-800">
                                    {wizardCourseForm.sections[yr] || 1}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const cur = wizardCourseForm.sections[yr] || 1;
                                      setWizardCourseForm(prev => ({
                                        ...prev,
                                        sections: { ...prev.sections, [yr]: cur + 1 },
                                        sectionRooms: {}
                                      }));
                                    }}
                                    className="h-5 w-5 rounded-lg bg-indigo-100 hover:bg-indigo-200 text-indigo-700 font-black flex items-center justify-center cursor-pointer transition-colors text-sm"
                                  >+</button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Section-wise Room Allocation */}
                        <div className="space-y-2">
                          <label className={`text-[9.5px] uppercase font-bold block transition-colors ${
                            Object.keys(courseFieldErrors).some(k => k.startsWith("Year")) ? 'text-red-500' : 'text-gray-400'
                          }`}>Room Allocation (per Section) *</label>
                          <div className="space-y-1.5">
                            {Array.from({ length: wizardCourseForm.years }, (_, yi) => yi + 1).map(yr => {
                              const secCount = wizardCourseForm.sections[yr] || 1;
                              return Array.from({ length: secCount }, (_, si) => {
                                const sectionLetter = String.fromCharCode(65 + si);
                                const key = `Year ${yr} Section ${sectionLetter}`;
                                const isErr = !!courseFieldErrors[key];
                                return (
                                  <div key={key} className="flex items-center gap-2">
                                    <span className={`text-[9.5px] font-extrabold w-32 shrink-0 border rounded-lg px-2 py-1.5 transition-colors ${
                                      isErr 
                                        ? 'text-red-700 bg-red-50 border-red-200' 
                                        : 'text-gray-600 bg-gray-50 border-gray-150'
                                    }`}>
                                      Yr {yr} – Sec {sectionLetter}
                                    </span>
                                    <input
                                      type="text"
                                      required
                                      placeholder={`Room for Year ${yr} Section ${sectionLetter}`}
                                      value={wizardCourseForm.sectionRooms[key] || ""}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        setWizardCourseForm(prev => ({
                                          ...prev,
                                          sectionRooms: { ...prev.sectionRooms, [key]: val }
                                        }));
                                        if (val.trim()) setCourseFieldErrors(prev => ({ ...prev, [key]: false }));
                                      }}
                                      className={`flex-1 rounded-xl px-3 py-1.5 font-bold text-xs focus:outline-none focus:ring-2 transition-all ${
                                        isErr
                                          ? 'border-2 border-red-400 bg-red-50 focus:ring-red-200'
                                          : 'bg-white border border-gray-200 focus:ring-indigo-100 focus:border-indigo-400'
                                      }`}
                                    />
                                  </div>
                                );
                              });
                            })}
                          </div>
                        </div>

                        {/* Default Shift */}
                        <div className="space-y-1">
                          <label className="text-[9.5px] text-gray-400 uppercase font-bold block">Default Shift</label>
                          <select
                            value={wizardCourseForm.default_shift}
                            onChange={(e) => setWizardCourseForm({ ...wizardCourseForm, default_shift: e.target.value })}
                            className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 font-bold text-xs cursor-pointer focus:ring-1 focus:ring-indigo-500 outline-none text-gray-800"
                          >
                            <option value="general">General Shift</option>
                            {campusForm.has_shifts === 1 && (
                              <>
                                <option value="shift_1">Shift 1</option>
                                <option value="shift_2">Shift 2</option>
                              </>
                            )}
                          </select>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            setModalError(null);
                            const errs: Record<string, boolean> = {};
                            if (!wizardCourseForm.name.trim()) {
                              errs.name = true;
                            }
                            
                            const missingRooms: string[] = [];
                            for (let yr = 1; yr <= wizardCourseForm.years; yr++) {
                              const secCount = wizardCourseForm.sections[yr] || 1;
                              for (let si = 0; si < secCount; si++) {
                                const sectionLetter = String.fromCharCode(65 + si);
                                const key = `Year ${yr} Section ${sectionLetter}`;
                                if (!wizardCourseForm.sectionRooms[key]?.trim()) {
                                  missingRooms.push(key);
                                  errs[key] = true;
                                }
                              }
                            }

                            if (Object.keys(errs).length > 0) {
                              setCourseFieldErrors(errs);
                              if (errs.name && missingRooms.length > 0) {
                                setModalError("Please specify Course Name and assign rooms for all sections.");
                              } else if (errs.name) {
                                setModalError("Course name is required.");
                              } else {
                                setModalError(`Please assign rooms for: ${missingRooms.join(", ")}`);
                              }
                              return;
                            }

                            setCourseFieldErrors({});
                            setModalError(null);
                            const newC = {
                              ...wizardCourseForm,
                              default_room: JSON.stringify(wizardCourseForm.sectionRooms),
                              isExisting: false
                            };
                            setWizardCourses([...wizardCourses, newC]);
                            setWizardCourseForm({
                              name: "",
                              years: 3,
                              sections: { 1: 1, 2: 1, 3: 1, 4: 1, 5: 1 },
                              sectionRooms: {},
                              default_shift: "general",
                              start_date: "",
                              end_date: "",
                              start_year: "",
                              end_year: "",
                              description: ""
                            });
                          }}
                          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-extrabold py-2.5 rounded-xl shadow-sm hover:scale-[1.01] transition-all cursor-pointer"
                        >
                          + Add Course to Campus List
                        </button>
                      </div>
                    </div>
                  )}

                  {/* ────────────────── STEP 3: SHIFT CONFIG ────────────────── */}
                  {campusWizardStep === 3 && (
                    <div className="space-y-4 animate-fadeIn">
                      <div className="pb-1 border-b border-gray-100">
                        <h4 className="text-xs font-black text-gray-800 uppercase tracking-wider">Shift Configuration</h4>
                        <p className="text-[9.5px] text-gray-400 font-semibold mt-0.5">Configure start time, period durations, and breaks for each shift.</p>
                      </div>

                      <div className="flex flex-col gap-3">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-black text-indigo-650 uppercase tracking-wider">
                            {campusForm.has_shifts === 1 ? "Shift Configurations" : "General Shift Configuration"}
                          </h4>
                          {campusForm.has_shifts === 1 && (
                            <div className="flex bg-gray-100 p-1 rounded-xl gap-1">
                              {(["shift_1", "shift_2", "general"] as const).map(sh => (
                                <button
                                  key={sh}
                                  type="button"
                                  onClick={() => {
                                    setActiveConfigShift(sh);
                                    setNewBreakName("");
                                  }}
                                  className={`px-3 py-1 rounded-lg text-[10px] font-extrabold transition-all cursor-pointer ${
                                    activeConfigShift === sh
                                      ? "bg-white text-indigo-655 shadow-sm"
                                      : "text-gray-500 hover:text-gray-800"
                                  }`}
                                >
                                  {shiftConfigsParams[sh].label}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-2 bg-indigo-50/40 p-2.5 rounded-xl border border-indigo-100/50">
                          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Configure Semester:</span>
                          <select
                            value={activeConfigSemester}
                            onChange={(e) => handleSemesterChange(e.target.value)}
                            className="flex-1 bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 font-bold text-xs focus:outline-none focus:ring-1 focus:ring-indigo-650 cursor-pointer"
                          >
                            <option value="All Semesters">All Semesters (Default Fallback)</option>
                            {["Semester 1", "Semester 2", "Semester 3", "Semester 4", "Semester 5", "Semester 6", "Semester 7", "Semester 8"].map(sem => (
                              <option key={sem} value={sem}>{sem}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="bg-slate-50/50 p-4 border border-gray-205 rounded-2xl space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="text-[10px] text-gray-400 uppercase tracking-wider block font-bold">Shift Name / Label</label>
                            <input
                              type="text"
                              required
                              value={shiftConfigsParams[activeConfigShift].label}
                              onChange={(e) => {
                                const val = e.target.value;
                                setShiftConfigsParams(prev => ({
                                  ...prev,
                                  [activeConfigShift]: { ...prev[activeConfigShift], label: val }
                                }));
                              }}
                              placeholder="e.g. Regular Shift"
                              className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 font-bold focus:outline-none focus:ring-1 focus:ring-indigo-650 text-xs"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="text-[10px] text-gray-400 uppercase tracking-wider block font-bold">Start Time</label>
                            <input
                              type="text"
                              required
                              value={shiftConfigsParams[activeConfigShift].startTime}
                              onChange={(e) => {
                                const val = e.target.value;
                                setShiftConfigsParams(prev => ({
                                  ...prev,
                                  [activeConfigShift]: { ...prev[activeConfigShift], startTime: val }
                                }));
                              }}
                              placeholder="e.g. 09:00 AM"
                              className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 font-bold focus:outline-none focus:ring-1 focus:ring-indigo-650 text-xs"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="text-[10px] text-gray-400 uppercase tracking-wider block font-bold">Period Duration (minutes)</label>
                            <input
                              type="number"
                              min="1"
                              required
                              value={shiftConfigsParams[activeConfigShift].periodDuration}
                              onChange={(e) => {
                                const val = parseInt(e.target.value, 10) || 0;
                                setShiftConfigsParams(prev => ({
                                  ...prev,
                                  [activeConfigShift]: { ...prev[activeConfigShift], periodDuration: val }
                                }));
                              }}
                              className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 font-bold focus:outline-none focus:ring-1 focus:ring-indigo-650 text-xs"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="text-[10px] text-gray-400 uppercase tracking-wider block font-bold">Calculation Mode</label>
                            <select
                              value={shiftConfigsParams[activeConfigShift].mode}
                              onChange={(e) => {
                                const mode = e.target.value as "duration" | "fixed";
                                setShiftConfigsParams(prev => ({
                                  ...prev,
                                  [activeConfigShift]: {
                                    ...prev[activeConfigShift],
                                    mode,
                                    endTime: mode === "fixed" ? "04:30 PM" : undefined
                                  }
                                }));
                              }}
                              className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 font-bold focus:outline-none focus:ring-1 focus:ring-indigo-650 text-xs cursor-pointer"
                            >
                              <option value="duration">Specify Number of Periods</option>
                              <option value="fixed">Specify Shift End Time</option>
                            </select>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {shiftConfigsParams[activeConfigShift].mode === "duration" ? (
                            <div className="space-y-1">
                              <label className="text-[10px] text-gray-400 uppercase tracking-wider block font-bold">Number of Periods</label>
                              <input
                                type="number"
                                min="1"
                                required
                                value={shiftConfigsParams[activeConfigShift].periodsCount}
                                onChange={(e) => {
                                  const val = parseInt(e.target.value, 10) || 0;
                                  setShiftConfigsParams(prev => ({
                                    ...prev,
                                    [activeConfigShift]: { ...prev[activeConfigShift], periodsCount: val }
                                  }));
                                }}
                                className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 font-bold focus:outline-none focus:ring-1 focus:ring-indigo-650 text-xs"
                              />
                            </div>
                          ) : (
                            <div className="space-y-1">
                              <label className="text-[10px] text-gray-400 uppercase tracking-wider block font-bold">Shift End Time</label>
                              <input
                                type="text"
                                required
                                value={shiftConfigsParams[activeConfigShift].endTime || ""}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setShiftConfigsParams(prev => ({
                                    ...prev,
                                    [activeConfigShift]: { ...prev[activeConfigShift], endTime: val }
                                  }));
                                }}
                                placeholder="e.g. 04:30 PM"
                                className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 font-bold focus:outline-none focus:ring-1 focus:ring-indigo-650 text-xs"
                              />
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Breaks */}
                      <div className="space-y-3 bg-white p-4 border border-gray-205 rounded-2xl">
                        <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                          <span className="text-[10px] uppercase font-bold text-gray-455 tracking-wider">Configured Breaks</span>
                          <span className="text-[9px] text-indigo-500 font-bold bg-indigo-50 px-2 py-0.5 rounded-full">
                            {shiftConfigsParams[activeConfigShift].breaks.length} Breaks
                          </span>
                        </div>

                        {shiftConfigsParams[activeConfigShift].breaks.length === 0 ? (
                          <p className="text-[10px] text-gray-400 font-semibold text-center py-2">No breaks configured for this shift.</p>
                        ) : (
                          <div className="space-y-2">
                            {shiftConfigsParams[activeConfigShift].breaks.map((brk) => (
                              <div key={brk.id} className="flex items-center justify-between bg-slate-50/50 p-2.5 rounded-xl border border-gray-150">
                                <div>
                                  <div className="font-extrabold text-xs text-gray-800">{brk.name}</div>
                                  <div className="text-[9.5px] font-bold text-gray-455 mt-0.5">
                                    {brk.duration} min • Occurs after Period {brk.afterPeriod}
                                  </div>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    disabled={brk.afterPeriod <= 1}
                                    onClick={() => {
                                      const updatedBreaks = shiftConfigsParams[activeConfigShift].breaks.map(b =>
                                        b.id === brk.id ? { ...b, afterPeriod: b.afterPeriod - 1 } : b
                                      );
                                      setShiftConfigsParams(prev => ({
                                        ...prev,
                                        [activeConfigShift]: { ...prev[activeConfigShift], breaks: updatedBreaks }
                                      }));
                                    }}
                                    className="p-1 text-gray-400 hover:text-indigo-650 hover:bg-slate-100 rounded-lg cursor-pointer transition-colors disabled:opacity-30 disabled:pointer-events-none"
                                  >▲</button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const updatedBreaks = shiftConfigsParams[activeConfigShift].breaks.map(b =>
                                        b.id === brk.id ? { ...b, afterPeriod: b.afterPeriod + 1 } : b
                                      );
                                      setShiftConfigsParams(prev => ({
                                        ...prev,
                                        [activeConfigShift]: { ...prev[activeConfigShift], breaks: updatedBreaks }
                                      }));
                                    }}
                                    className="p-1 text-gray-400 hover:text-indigo-650 hover:bg-slate-100 rounded-lg cursor-pointer transition-colors"
                                  >▼</button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const updatedBreaks = shiftConfigsParams[activeConfigShift].breaks.filter(b => b.id !== brk.id);
                                      setShiftConfigsParams(prev => ({
                                        ...prev,
                                        [activeConfigShift]: { ...prev[activeConfigShift], breaks: updatedBreaks }
                                      }));
                                    }}
                                    className="text-[10px] text-red-500 font-extrabold hover:text-red-750 bg-red-50 hover:bg-red-100 px-2 py-1 rounded-lg transition-colors cursor-pointer"
                                  >Remove</button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        <div className="bg-slate-50/50 p-3 rounded-xl border border-gray-150 border-dashed space-y-3 mt-3">
                          <div className="text-[10px] font-bold text-gray-555 uppercase tracking-wider">Add Custom Break</div>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            <div className="space-y-1">
                              <label className="text-[9px] text-gray-400 uppercase font-bold block">Break Name</label>
                              <input
                                type="text"
                                value={newBreakName}
                                onChange={(e) => setNewBreakName(e.target.value)}
                                placeholder="e.g. Lunch"
                                className="w-full bg-white border border-gray-200 rounded-lg px-2 py-1.5 font-bold text-xs"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[9px] text-gray-400 uppercase font-bold block">Duration (min)</label>
                              <input
                                type="number"
                                min="1"
                                value={newBreakDuration}
                                onChange={(e) => setNewBreakDuration(parseInt(e.target.value, 10) || 0)}
                                className="w-full bg-white border border-gray-200 rounded-lg px-2 py-1.5 font-bold text-xs"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[9px] text-gray-400 uppercase font-bold block">After Period</label>
                              <input
                                type="number"
                                min="1"
                                value={newBreakAfterPeriod}
                                onChange={(e) => setNewBreakAfterPeriod(parseInt(e.target.value, 10) || 0)}
                                className="w-full bg-white border border-gray-200 rounded-lg px-2 py-1.5 font-bold text-xs"
                              />
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              if (!newBreakName.trim()) {
                                toast("Please enter a break name.", "warning");
                                return;
                              }
                              const id = "b_" + Date.now();
                              const brk: ShiftBreak = {
                                id,
                                name: newBreakName.trim(),
                                duration: newBreakDuration,
                                afterPeriod: newBreakAfterPeriod
                              };
                              setShiftConfigsParams(prev => ({
                                ...prev,
                                [activeConfigShift]: {
                                  ...prev[activeConfigShift],
                                  breaks: [...prev[activeConfigShift].breaks, brk]
                                }
                              }));
                              setNewBreakName("");
                            }}
                            className="w-full bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[10px] font-extrabold py-2 rounded-xl border border-indigo-150 transition-colors cursor-pointer"
                          >
                            + Add Break to Shift
                          </button>
                        </div>
                      </div>

                      {/* Live Timeline Preview */}
                      {(() => {
                        const schedule = calculateShiftSchedule(shiftConfigsParams[activeConfigShift]);
                        return (
                          <div className="bg-slate-50 p-4 border border-gray-205 rounded-3xl space-y-3">
                            <div className="flex items-center justify-between border-b border-gray-150 pb-2">
                              <div className="text-[10px] uppercase font-black text-gray-900 tracking-wider">Live Timetable Preview</div>
                              {schedule.overallEndTime && (
                                <div className="text-[10px] font-bold text-indigo-650 bg-indigo-50 px-2.5 py-0.5 rounded-full">
                                  Ends: {schedule.overallEndTime} ({schedule.totalPeriods} Periods)
                                </div>
                              )}
                            </div>
                            {schedule.error ? (
                              <div className="text-[10.5px] font-bold text-amber-600 bg-amber-50 border border-amber-150 rounded-xl p-3">
                                {schedule.error}
                              </div>
                            ) : (shiftConfigsParams[activeConfigShift].breaks.length === 0) ? (
                              <div className="text-[9.5px] font-bold text-amber-700 bg-amber-50 border border-amber-150 rounded-xl p-2.5 flex items-center gap-1.5">
                                <span>⚠️</span>
                                <span>At least one break must be configured for this shift.</span>
                              </div>
                            ) : schedule.items.length === 0 ? (
                              <p className="text-[10px] text-gray-400 font-semibold py-2">No periods calculated yet.</p>
                            ) : (
                              <div className="relative border-l border-indigo-150 ml-3 pl-4 py-1 space-y-2 text-[10.5px]">
                                {schedule.items.map((item, index) => {
                                  const isBreak = item.type === "break";
                                  return (
                                    <div key={index} className="relative flex items-center justify-between gap-4">
                                      <div className={`absolute -left-[20.5px] w-2 h-2 rounded-full border ${
                                        isBreak ? "bg-amber-400 border-amber-500" : "bg-indigo-550 border-indigo-650"
                                      }`} />
                                      <div className="flex-grow flex items-center justify-between">
                                        <span className={`font-bold ${isBreak ? "text-amber-700" : "text-gray-800"}`}>
                                          {item.name}
                                        </span>
                                        <span className="font-mono font-bold text-gray-500">
                                          {item.startTimeStr} - {item.endTimeStr}
                                        </span>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  {/* ────────────────── STEP 4: REVIEW ────────────────── */}
                  {campusWizardStep === 4 && (
                    <div className="space-y-4 animate-fadeIn">
                      <div className="pb-1 border-b border-gray-100">
                        <h4 className="text-xs font-black text-gray-800 uppercase tracking-wider">Review & Create</h4>
                        <p className="text-[9.5px] text-gray-400 font-semibold mt-0.5">Confirm all details before creating the campus.</p>
                      </div>

                      {/* Campus Info Summary */}
                      <div className="bg-indigo-50/40 border border-indigo-100 rounded-2xl p-4 space-y-2">
                        <div className="text-[10px] font-black text-indigo-700 uppercase tracking-wider mb-2">Campus Info</div>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                          <div>
                            <div className="text-[9px] text-gray-400 uppercase font-bold">Campus Name</div>
                            <div className="text-xs font-extrabold text-gray-800">{campusForm.name || "—"}</div>
                          </div>
                          <div>
                            <div className="text-[9px] text-gray-400 uppercase font-bold">Code</div>
                            <div className="text-xs font-extrabold text-gray-800">{campusForm.code || "—"}</div>
                          </div>
                          <div>
                            <div className="text-[9px] text-gray-400 uppercase font-bold">Academic Year</div>
                            <div className="text-xs font-extrabold text-gray-800">{campusForm.academic_year || "—"}</div>
                          </div>
                          <div>
                            <div className="text-[9px] text-gray-400 uppercase font-bold">Shift Mode</div>
                            <div className="text-xs font-extrabold text-gray-800">{campusForm.has_shifts === 1 ? "Multiple Shifts" : "General Shift"}</div>
                          </div>
                          <div className="col-span-2">
                            <div className="text-[9px] text-gray-400 uppercase font-bold">Address</div>
                            <div className="text-xs font-extrabold text-gray-800">{campusForm.address || "—"}</div>
                          </div>
                          <div>
                            <div className="text-[9px] text-gray-400 uppercase font-bold">KAM</div>
                            <div className="text-xs font-extrabold text-gray-800">
                              {kamList.find(k => k.id === campusForm.kam_id)?.name || "—"}
                            </div>
                          </div>
                          <div>
                            <div className="text-[9px] text-gray-400 uppercase font-bold">Campus Manager</div>
                            <div className="text-xs font-extrabold text-gray-800">
                              {camList.find(c => c.id === campusForm.manager)?.name || "Not assigned"}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Courses Summary */}
                      <div className="bg-slate-50 border border-gray-200 rounded-2xl p-4 space-y-2">
                        <div className="text-[10px] font-black text-gray-700 uppercase tracking-wider mb-2">
                          Courses ({wizardCourses.length})
                        </div>
                        {wizardCourses.length === 0 ? (
                          <p className="text-[10px] text-gray-400 font-semibold">No courses added.</p>
                        ) : (
                          <div className="space-y-2">
                            {wizardCourses.map((c, idx) => (
                              <div key={idx} className="bg-white border border-gray-150 rounded-xl p-3 space-y-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-extrabold text-xs text-gray-800">{c.name}</span>
                                  <span className="text-[8px] font-extrabold bg-indigo-50 border border-indigo-100 text-indigo-700 px-1.5 py-0.2 rounded uppercase">
                                    {c.years}Y · {c.years * 2} Sem
                                  </span>
                                </div>
                                {c.sectionRooms && Object.keys(c.sectionRooms).length > 0 && (
                                  <div className="flex flex-wrap gap-1.5">
                                    {Object.entries(c.sectionRooms as Record<string, string>).map(([key, room]) => (
                                      <span key={key} className="text-[8.5px] font-bold text-gray-600 bg-gray-50 border border-gray-150 px-1.5 py-0.5 rounded-lg">
                                        {key}: <span className="text-gray-800">{room}</span>
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Shift Summary */}
                      <div className="bg-slate-50 border border-gray-200 rounded-2xl p-4 space-y-2">
                        <div className="text-[10px] font-black text-gray-700 uppercase tracking-wider mb-2">Shift Schedule</div>
                        {(campusForm.has_shifts === 1 ? (["shift_1", "shift_2", "general"] as const) : (["general"] as const)).map(sh => {
                          const p = shiftConfigsParams[sh];
                          const schedule = calculateShiftSchedule(p);
                          return (
                            <div key={sh} className="space-y-1">
                              <div className="text-[10px] font-extrabold text-indigo-700">{p.label}</div>
                              <div className="text-[9.5px] text-gray-600 font-bold">
                                Start: {p.startTime} · {p.periodsCount} Periods · {p.periodDuration} min/period
                                {schedule.overallEndTime && ` · Ends: ${schedule.overallEndTime}`}
                              </div>
                              {p.breaks.length > 0 && (
                                <div className="flex flex-wrap gap-1">
                                  {p.breaks.map(b => (
                                    <span key={b.id} className="text-[8.5px] font-bold bg-amber-50 border border-amber-100 text-amber-700 px-1.5 py-0.5 rounded-lg">
                                      {b.name} ({b.duration}min after P{b.afterPeriod})
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer Navigation */}
                <div className="flex justify-between gap-2 px-6 py-4 border-t border-gray-100 bg-gray-50/50 rounded-b-3xl shrink-0">
                  <div>
                    {campusWizardStep > 1 && (
                      <button
                        type="button"
                        onClick={() => { setCampusWizardStep(campusWizardStep - 1); setModalError(null); }}
                        className="px-4 py-2 hover:bg-gray-100 text-gray-550 rounded-xl transition-all font-bold cursor-pointer"
                      >
                        ← Back
                      </button>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => { setShowCampusModal(false); setCampusSuccessCreatedId(null); }}
                      className="px-4 py-2 hover:bg-gray-100 text-gray-500 rounded-xl transition-all font-bold cursor-pointer"
                    >
                      Cancel
                    </button>
                    {campusWizardStep < 4 ? (
                      <button
                        type="button"
                        onClick={() => {
                          setModalError(null);
                          setCampusFieldErrors({});
                          if (campusWizardStep === 1) {
                            const errs: Record<string, boolean> = {};
                            if (!campusForm.name.trim()) errs.name = true;
                            if (!campusForm.address.trim()) errs.address = true;
                            if (!campusForm.kam_id) errs.kam_id = true;
                            if (Object.keys(errs).length > 0) {
                              setCampusFieldErrors(errs);
                              setModalError("Please fill in all required fields highlighted in red.");
                              return;
                            }
                          }
                          if (campusWizardStep === 2 && wizardCourses.length === 0) {
                            setModalError("Please add at least one course before continuing.");
                            return;
                          }
                          if (campusWizardStep === 3) {
                            if (campusForm.has_shifts === 1) {
                              if (!shiftConfigsParams.shift_1.breaks || shiftConfigsParams.shift_1.breaks.length === 0) {
                                setModalError("Shift 1: Please add at least one break before continuing.");
                                return;
                              }
                              if (!shiftConfigsParams.shift_2.breaks || shiftConfigsParams.shift_2.breaks.length === 0) {
                                setModalError("Shift 2: Please add at least one break before continuing.");
                                return;
                              }
                            } else {
                              if (!shiftConfigsParams.general.breaks || shiftConfigsParams.general.breaks.length === 0) {
                                setModalError("General Shift: Please add at least one break before continuing.");
                                return;
                              }
                            }
                          }
                          setCampusWizardStep(campusWizardStep + 1);
                        }}
                        className="btn-gradient px-5 py-2 text-white rounded-xl shadow-sm transition-all font-bold cursor-pointer"
                      >
                        Next Step →
                      </button>
                    ) : (
                      <button
                        type="submit"
                        className="btn-gradient px-5 py-2 text-white rounded-xl shadow-sm transition-all font-bold cursor-pointer"
                      >
                        {editingCampus ? "Save Changes" : "Yes Create Campus"}
                      </button>
                    )}
                  </div>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {showKamModal && (
        <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-gray-150 shadow-xl max-w-md w-full overflow-hidden animate-slideUp">
            <div className="flex justify-between items-center p-6 border-b border-gray-100 bg-gray-50">
              <h3 className="font-extrabold text-gray-900 text-sm flex items-center gap-1.5">
                <Briefcase className="h-5 w-5 text-indigo-655" />
                {editingKam ? "Edit Key Account Manager" : "Add Key Account Manager"}
              </h3>
              <button onClick={() => setShowKamModal(false)} className="p-1 hover:bg-gray-250 rounded-lg transition-colors cursor-pointer text-gray-500 hover:text-gray-800">
                <X className="h-4 w-4" />
              </button>
            </div>
            
            <form onSubmit={handleKamSubmit} className="p-6 space-y-4 text-xs font-semibold">
              {modalError && (
                <div className="p-3 bg-rose-50 border border-rose-150 rounded-xl text-rose-700 font-bold flex items-center gap-1.5">
                  <ShieldAlert className="h-4 w-4 shrink-0" />
                  {modalError}
                </div>
              )}
              
              <div className="space-y-1">
                <label className="text-[10px] text-gray-400 uppercase tracking-wider block">KAM ID</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. kam_3"
                  disabled={editingKam}
                  value={kamForm.id}
                  onChange={(e) => setKamForm({ ...kamForm, id: e.target.value })}
                  className="w-full bg-gray-55 border border-gray-200 rounded-xl px-3.5 py-2.5 font-bold focus:outline-none focus:ring-1 focus:ring-indigo-650 disabled:bg-gray-100 disabled:text-gray-400"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-gray-400 uppercase tracking-wider block">Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ramesh Dev"
                  value={kamForm.name}
                  onChange={(e) => setKamForm({ ...kamForm, name: e.target.value })}
                  className="w-full bg-gray-55 border border-gray-200 rounded-xl px-3.5 py-2.5 font-bold focus:outline-none focus:ring-1 focus:ring-indigo-650"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-gray-400 uppercase tracking-wider block">Email Address</label>
                <input
                  type="email"
                  required
                  placeholder="e.g. ramesh.kam@university.edu"
                  value={kamForm.email}
                  onChange={(e) => setKamForm({ ...kamForm, email: e.target.value })}
                  className="w-full bg-gray-55 border border-gray-200 rounded-xl px-3.5 py-2.5 font-bold focus:outline-none focus:ring-1 focus:ring-indigo-650"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-gray-400 uppercase tracking-wider block">Title / Position</label>
                <input
                  type="text"
                  placeholder="e.g. Key Account Manager"
                  value={kamForm.title}
                  onChange={(e) => setKamForm({ ...kamForm, title: e.target.value })}
                  className="w-full bg-gray-55 border border-gray-200 rounded-xl px-3.5 py-2.5 font-bold focus:outline-none focus:ring-1 focus:ring-indigo-650"
                />
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowKamModal(false)}
                  className="px-4 py-2 hover:bg-gray-100 text-gray-550 rounded-xl transition-all font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-gradient px-5 py-2 text-white rounded-xl shadow-sm transition-all font-bold cursor-pointer"
                >
                  {editingKam ? "Save Changes" : "Create KAM"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── CAM Modal ── */}
      {showCamModal && (
        <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-gray-150 shadow-xl max-w-md w-full overflow-hidden animate-slideUp">
            <div className="flex justify-between items-center p-6 border-b border-gray-100 bg-gray-50">
              <h3 className="font-extrabold text-gray-900 text-sm flex items-center gap-1.5">
                <Users className="h-5 w-5 text-indigo-655" />
                {editingCam ? "Edit Campus Manager" : "Add Campus Manager"}
              </h3>
              <button onClick={() => setShowCamModal(false)} className="p-1 hover:bg-gray-250 rounded-lg transition-colors cursor-pointer text-gray-500 hover:text-gray-800">
                <X className="h-4 w-4" />
              </button>
            </div>
            
            <form onSubmit={handleCamSubmit} className="p-6 space-y-4 text-xs font-semibold">
              {modalError && (
                <div className="p-3 bg-rose-50 border border-rose-150 rounded-xl text-rose-700 font-bold flex items-center gap-1.5">
                  <ShieldAlert className="h-4 w-4 shrink-0" />
                  {modalError}
                </div>
              )}
              
              <div className="space-y-1">
                <label className="text-[10px] text-gray-400 uppercase tracking-wider block">CAM ID</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. cam_3"
                  disabled={editingCam}
                  value={camForm.id}
                  onChange={(e) => setCamForm({ ...camForm, id: e.target.value })}
                  className="w-full bg-gray-55 border border-gray-200 rounded-xl px-3.5 py-2.5 font-bold focus:outline-none focus:ring-1 focus:ring-indigo-650 disabled:bg-gray-100 disabled:text-gray-400"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-gray-400 uppercase tracking-wider block">Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Priya Venkatesh"
                  value={camForm.name}
                  onChange={(e) => setCamForm({ ...camForm, name: e.target.value })}
                  className="w-full bg-gray-55 border border-gray-200 rounded-xl px-3.5 py-2.5 font-bold focus:outline-none focus:ring-1 focus:ring-indigo-650"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-gray-400 uppercase tracking-wider block">Email Address</label>
                <input
                  type="email"
                  required
                  placeholder="e.g. priya.cam@university.edu"
                  value={camForm.email}
                  onChange={(e) => setCamForm({ ...camForm, email: e.target.value })}
                  className="w-full bg-gray-55 border border-gray-200 rounded-xl px-3.5 py-2.5 font-bold focus:outline-none focus:ring-1 focus:ring-indigo-650"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-gray-400 uppercase tracking-wider block">Assigned Campus</label>
                <select
                  required
                  value={camForm.college_id}
                  onChange={(e) => setCamForm({ ...camForm, college_id: e.target.value })}
                  className="w-full bg-gray-55 border border-gray-200 rounded-xl px-3 py-2.5 font-bold focus:outline-none focus:ring-1 focus:ring-indigo-650 cursor-pointer"
                >
                  <option value="">Select Campus</option>
                  {colleges.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-gray-400 uppercase tracking-wider block">Reporting KAM Manager</label>
                <select
                  required
                  value={camForm.kam_id}
                  onChange={(e) => setCamForm({ ...camForm, kam_id: e.target.value })}
                  className="w-full bg-gray-55 border border-gray-200 rounded-xl px-3 py-2.5 font-bold focus:outline-none focus:ring-1 focus:ring-indigo-650 cursor-pointer"
                >
                  <option value="">Select Reporting KAM</option>
                  {kamList.map(kam => (
                    <option key={kam.id} value={kam.id}>{kam.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowCamModal(false)}
                  className="px-4 py-2 hover:bg-gray-100 text-gray-550 rounded-xl transition-all font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-gradient px-5 py-2 text-white rounded-xl shadow-sm transition-all font-bold cursor-pointer"
                >
                  {editingCam ? "Save Changes" : "Create Campus Manager"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── SME Modal ── */}
      {showSmeModal && (
        <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-gray-150 shadow-xl max-w-md w-full overflow-hidden animate-slideUp">
            <div className="flex justify-between items-center p-6 border-b border-gray-100 bg-gray-50">
              <h3 className="font-extrabold text-gray-900 text-sm flex items-center gap-1.5 font-sans">
                <BookOpen className="h-5 w-5 text-indigo-650" />
                {isEditingSme ? "Edit Subject Matter Expert" : "Add Subject Matter Expert"}
              </h3>
              <button onClick={() => setShowSmeModal(false)} className="p-1 hover:bg-gray-250 rounded-lg transition-colors cursor-pointer text-gray-500 hover:text-gray-800">
                <X className="h-4 w-4" />
              </button>
            </div>
            
            <div className="p-6 space-y-4 text-xs font-semibold font-sans">
              <div className="space-y-1">
                <label className="text-[10px] text-gray-400 uppercase tracking-wider block">SME ID</label>
                <input
                  type="text"
                  disabled={isEditingSme}
                  value={smeForm.id}
                  onChange={(e) => setSmeForm({ ...smeForm, id: e.target.value })}
                  placeholder="e.g. sme_4"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-gray-700 bg-white outline-none focus:ring-1 focus:ring-indigo-650 disabled:bg-gray-100 disabled:text-gray-400 font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-gray-400 uppercase tracking-wider block">Full Name</label>
                <input
                  type="text"
                  value={smeForm.name}
                  onChange={(e) => setSmeForm({ ...smeForm, name: e.target.value })}
                  placeholder="e.g. Dr. Ramesh Kumar"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-gray-700 bg-white outline-none focus:ring-1 focus:ring-indigo-650"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-gray-400 uppercase tracking-wider block">Email Address</label>
                <input
                  type="email"
                  value={smeForm.email}
                  onChange={(e) => setSmeForm({ ...smeForm, email: e.target.value })}
                  placeholder="e.g. ramesh.sme@zentra.edu"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-gray-700 bg-white outline-none focus:ring-1 focus:ring-indigo-650"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-gray-400 uppercase tracking-wider block">Subject Group Specialization</label>
                <select
                  value={smeForm.subject}
                  onChange={(e) => setSmeForm({ ...smeForm, subject: e.target.value })}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-gray-700 bg-white outline-none focus:ring-1 focus:ring-indigo-650"
                >
                  <option value="">-- Unassigned --</option>
                  {subjectGroups && subjectGroups.map(sg => (
                    <option key={sg.id} value={sg.name}>{sg.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowSmeModal(false)}
                  className="px-4 py-2 border border-gray-200 rounded-xl hover:bg-gray-50 text-gray-700 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveSme}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-all shadow-md cursor-pointer"
                >
                  Save SME
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Mentor Modal ── */}
      {showMentorModal && (
        <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-gray-150 shadow-xl max-w-lg w-full overflow-hidden animate-slideUp">
            <div className="flex justify-between items-center p-6 border-b border-gray-100 bg-gray-50">
              <h3 className="font-extrabold text-gray-900 text-sm flex items-center gap-1.5">
                <Users className="h-5 w-5 text-indigo-650" />
                {editingMentor ? "Edit Faculty Mentor" : "Add Faculty Mentor"}
              </h3>
              <button onClick={() => setShowMentorModal(false)} className="p-1 hover:bg-gray-250 rounded-lg transition-colors cursor-pointer text-gray-500 hover:text-gray-800">
                <X className="h-4 w-4" />
              </button>
            </div>
            
            <form onSubmit={handleMentorSubmit} className="p-6 space-y-3.5 text-xs font-semibold max-h-[80vh] overflow-y-auto">
              {modalError && (
                <div className="p-3 bg-rose-50 border border-rose-150 rounded-xl text-rose-700 font-bold flex items-center gap-1.5">
                  <ShieldAlert className="h-4 w-4 shrink-0" />
                  {modalError}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                <div className="space-y-1">
                  <label className="text-[10px] text-gray-400 uppercase tracking-wider block">Mentor ID</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. m35"
                    disabled={editingMentor}
                    value={mentorForm.id}
                    onChange={(e) => setMentorForm({ ...mentorForm, id: e.target.value })}
                    className="w-full bg-gray-55 border border-gray-200 rounded-xl px-3.5 py-2.5 font-bold focus:outline-none focus:ring-1 focus:ring-indigo-650 disabled:bg-gray-100 disabled:text-gray-400"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-gray-400 uppercase tracking-wider block">Initials / Avatar</label>
                  <input
                    type="text"
                    placeholder="e.g. MS (Leave blank to auto-generate)"
                    value={mentorForm.avatar}
                    onChange={(e) => setMentorForm({ ...mentorForm, avatar: e.target.value })}
                    className="w-full bg-gray-55 border border-gray-200 rounded-xl px-3.5 py-2.5 font-bold focus:outline-none focus:ring-1 focus:ring-indigo-650"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-gray-400 uppercase tracking-wider block">Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Dr. Alice Smith"
                  value={mentorForm.name}
                  onChange={(e) => setMentorForm({ ...mentorForm, name: e.target.value })}
                  className="w-full bg-gray-55 border border-gray-200 rounded-xl px-3.5 py-2.5 font-bold focus:outline-none focus:ring-1 focus:ring-indigo-650"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-gray-400 uppercase tracking-wider block">Email Address</label>
                <input
                  type="email"
                  required
                  placeholder="e.g. alice.smith@university.edu"
                  value={mentorForm.email}
                  onChange={(e) => setMentorForm({ ...mentorForm, email: e.target.value })}
                  className="w-full bg-gray-55 border border-gray-200 rounded-xl px-3.5 py-2.5 font-bold focus:outline-none focus:ring-1 focus:ring-indigo-650"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                <div className="space-y-1">
                  <label className="text-[10px] text-gray-400 uppercase tracking-wider block">Assigned Campus</label>
                  <select
                    required
                    value={mentorForm.college_id}
                    onChange={(e) => setMentorForm({ ...mentorForm, college_id: e.target.value })}
                    className="w-full bg-gray-55 border border-gray-200 rounded-xl px-3 py-2.5 font-bold focus:outline-none focus:ring-1 focus:ring-indigo-650 cursor-pointer"
                  >
                    <option value="">Select Campus</option>
                    {colleges.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-gray-400 uppercase tracking-wider block">Shift Assignment</label>
                  <select
                    required
                    value={mentorForm.shift}
                    onChange={(e) => setMentorForm({ ...mentorForm, shift: e.target.value as any })}
                    className="w-full bg-gray-55 border border-gray-200 rounded-xl px-3 py-2.5 font-bold focus:outline-none focus:ring-1 focus:ring-indigo-650 cursor-pointer"
                  >
                    <option value="general">General Shift</option>
                    <option value="shift_1">Shift 1</option>
                    <option value="shift_2">Shift 2</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-gray-400 uppercase tracking-wider block">Group</label>
                <select
                  required
                  value={mentorForm.department}
                  onChange={(e) => setMentorForm({ ...mentorForm, department: e.target.value })}
                  className="w-full bg-gray-55 border border-gray-200 rounded-xl px-3 py-2.5 font-bold focus:outline-none focus:ring-1 focus:ring-indigo-650 cursor-pointer text-gray-800"
                >
                  <option value="">— Select Group —</option>
                  {subjectGroups.map(sg => (
                    <option key={sg.id} value={sg.name}>{sg.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-gray-400 uppercase tracking-wider block">Subject Group / Category</label>
                <select
                  required
                  value={mentorForm.subject_group}
                  onChange={(e) => setMentorForm({ ...mentorForm, subject_group: e.target.value })}
                  className="w-full bg-gray-55 border border-gray-200 rounded-xl px-3 py-2.5 font-bold focus:outline-none focus:ring-1 focus:ring-indigo-650 cursor-pointer text-gray-800"
                >
                  {subjectGroups.map(sg => (
                    <option key={sg.id} value={sg.name}>{sg.name}</option>
                  ))}
                </select>
              </div>

              {/* Subject Mapping Checklist */}
              <div className="space-y-1">
                <label className="text-[10px] text-gray-400 uppercase tracking-wider block">Map Subjects to Mentor</label>
                <div className="relative mb-1.5">
                  <Search className="absolute left-2.5 top-1.5 h-3.5 w-3.5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search subject catalog..."
                    value={mentorSubjectSearch}
                    onChange={(e) => setMentorSubjectSearch(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg pl-8 pr-3 py-1.5 text-[10px] focus:outline-none focus:ring-1 focus:ring-indigo-650 font-bold"
                  />
                </div>
                
                <div className="border border-gray-150 rounded-xl bg-gray-55 p-3.5 max-h-36 overflow-y-auto space-y-1.5 text-[11px] font-bold">
                  {(() => {
                    const searched = (subjectsList || []).filter(s => {
                      const matchesSearch = s.name.toLowerCase().includes(mentorSubjectSearch.toLowerCase()) ||
                                            s.department.toLowerCase().includes(mentorSubjectSearch.toLowerCase());
                      if (!mentorSubjectSearch && mentorForm.department) {
                        return s.department.toLowerCase() === mentorForm.department.toLowerCase();
                      }
                      return matchesSearch;
                    });

                    const currentCheckedList = mentorForm.subjects.split("\n").map(s => s.trim()).filter(Boolean);

                    return (
                      <>
                        {searched.map(s => {
                          const isChecked = currentCheckedList.includes(s.name);
                          return (
                            <label key={s.id} className="flex items-start gap-2 py-1 px-1.5 hover:bg-white rounded cursor-pointer transition-colors text-gray-700">
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
                                <span className="font-bold text-gray-800">{s.name}</span>
                                <span className="text-[9px] text-gray-400 block font-semibold">{s.department} • {s.semester}</span>
                              </div>
                            </label>
                          );
                        })}
                        {searched.length === 0 && (
                          <div className="text-center text-gray-450 italic py-2">
                            No subjects found. Select/input a department to filter or search catalog.
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowMentorModal(false)}
                  className="px-4 py-2 hover:bg-gray-100 text-gray-550 rounded-xl transition-all font-bold cursor-pointer"
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

      {showSubjectModal && (
        <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className={`bg-white rounded-3xl border border-gray-150 shadow-xl w-full overflow-hidden animate-slideUp transition-all ${editingSubject ? "max-w-md" : "max-w-3xl"}`}>
            <div className="flex justify-between items-center p-5 border-b border-gray-100 bg-gray-50">
              <h3 className="font-extrabold text-gray-900 text-sm flex items-center gap-1.5">
                <GraduationCap className="h-5 w-5 text-indigo-655" />
                {editingSubject ? "Edit Subject Details" : "Add Subject to Catalog"}
              </h3>
              <button onClick={() => setShowSubjectModal(false)} className="p-1 hover:bg-gray-250 rounded-lg transition-colors cursor-pointer text-gray-500 hover:text-gray-800">
                <X className="h-4 w-4" />
              </button>
            </div>
            
            <form onSubmit={handleSubjectSubmit} className="p-5 space-y-4 text-xs font-semibold">
              {modalError && (
                <div className="p-3 bg-rose-50 border border-rose-150 rounded-xl text-rose-700 font-bold flex items-center gap-1.5">
                  <ShieldAlert className="h-4 w-4 shrink-0" />
                  {modalError}
                </div>
              )}

              <div className={editingSubject ? "space-y-3" : "grid grid-cols-1 md:grid-cols-2 gap-6"}>
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-[10px] text-gray-400 uppercase tracking-wider block">Subject Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Modern Natural Language Processing"
                      value={subjectForm.name}
                      onChange={(e) => setSubjectForm({ ...subjectForm, name: e.target.value })}
                      className="w-full bg-gray-55 border border-gray-200 rounded-xl px-3 py-2 font-bold focus:outline-none focus:ring-1 focus:ring-indigo-650 text-gray-800"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] text-gray-400 uppercase tracking-wider block">Course Name</label>
                      <select
                        required
                        disabled={lockDeptAndYear}
                        value={subjectForm.department}
                        onChange={(e) => setSubjectForm({ ...subjectForm, department: e.target.value })}
                        className="w-full bg-gray-55 border border-gray-200 rounded-xl px-3 py-2 font-bold focus:outline-none focus:ring-1 focus:ring-indigo-650 cursor-pointer text-gray-800 disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        <option value="">— Select Course —</option>
                        {coursesList.map(dept => (
                          <option key={dept.id} value={dept.name}>{dept.name}</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] text-gray-400 uppercase tracking-wider block">Assigned Campus</label>
                      <select
                        required
                        value={subjectForm.college_id}
                        onChange={(e) => setSubjectForm({ ...subjectForm, college_id: e.target.value })}
                        className="w-full bg-gray-55 border border-gray-200 rounded-xl px-3 py-2 font-bold focus:outline-none focus:ring-1 focus:ring-indigo-650 cursor-pointer text-gray-805"
                      >
                        <option value="">— Campus —</option>
                        {colleges.map(c => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] text-gray-400 uppercase tracking-wider block">Academic Year</label>
                      <select
                        required
                        disabled={lockDeptAndYear}
                        value={subjectForm.year}
                        onChange={(e) => {
                          const newYear = e.target.value;
                          let newSem = "Semester 1";
                          if (newYear === "Year 2") newSem = "Semester 3";
                          else if (newYear === "Year 3") newSem = "Semester 5";
                          else if (newYear === "Year 4") newSem = "Semester 7";
                          setSubjectForm({ ...subjectForm, year: newYear, semester: newSem });
                        }}
                        className="w-full bg-gray-55 border border-gray-200 rounded-xl px-3 py-2 font-bold focus:outline-none focus:ring-1 focus:ring-indigo-650 cursor-pointer text-gray-800 disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        <option value="Year 1">Year 1</option>
                        <option value="Year 2">Year 2</option>
                        <option value="Year 3">Year 3</option>
                        <option value="Year 4">Year 4</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] text-gray-400 uppercase tracking-wider block">Semester</label>
                      <select
                        required
                        value={subjectForm.semester}
                        onChange={(e) => setSubjectForm({ ...subjectForm, semester: e.target.value })}
                        className="w-full bg-gray-55 border border-gray-200 rounded-xl px-3 py-2 font-bold focus:outline-none focus:ring-1 focus:ring-indigo-650 cursor-pointer text-gray-800"
                      >
                        {subjectForm.year === "Year 1" && (
                          <>
                            <option value="Semester 1">Semester 1</option>
                            <option value="Semester 2">Semester 2</option>
                          </>
                        )}
                        {subjectForm.year === "Year 2" && (
                          <>
                            <option value="Semester 3">Semester 3</option>
                            <option value="Semester 4">Semester 4</option>
                          </>
                        )}
                        {subjectForm.year === "Year 3" && (
                          <>
                            <option value="Semester 5">Semester 5</option>
                            <option value="Semester 6">Semester 6</option>
                          </>
                        )}
                        {subjectForm.year === "Year 4" && (
                          <>
                            <option value="Semester 7">Semester 7</option>
                            <option value="Semester 8">Semester 8</option>
                          </>
                        )}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] text-gray-400 uppercase tracking-wider block font-bold">Subject Type / Domain</label>
                      <select
                        required
                        value={subjectForm.type}
                        onChange={(e) => setSubjectForm({ ...subjectForm, type: e.target.value })}
                        className="w-full bg-gray-55 border border-gray-200 rounded-xl px-3 py-2 font-bold focus:outline-none focus:ring-1 focus:ring-indigo-650 cursor-pointer text-gray-800"
                      >
                        <option value="SKILL">SKILL (Practical Training)</option>
                        <option value="ACADEMIC">ACADEMIC (Core Theory)</option>
                        <option value="LAB">LAB (Practical Laboratory)</option>
                        <option value="GENERAL">GENERAL (Elective / Foundational)</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] text-gray-400 uppercase tracking-wider block">Weekly Hours</label>
                      <input
                        type="number"
                        required
                        min={1}
                        max={20}
                        placeholder="e.g. 4"
                        value={subjectForm.weekly_hours}
                        onChange={(e) => setSubjectForm({ ...subjectForm, weekly_hours: parseInt(e.target.value) || 4 })}
                        className="w-full bg-gray-55 border border-gray-200 rounded-xl px-3.5 py-2 font-bold focus:outline-none focus:ring-1 focus:ring-[#D528A2] text-gray-805"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] text-gray-400 uppercase tracking-wider block">Subject Group / Category</label>
                    <select
                      required
                      value={subjectForm.subject_group}
                      onChange={(e) => setSubjectForm({ ...subjectForm, subject_group: e.target.value })}
                      className="w-full bg-gray-55 border border-gray-200 rounded-xl px-3 py-2 font-bold focus:outline-none focus:ring-1 focus:ring-indigo-650 cursor-pointer text-gray-800"
                    >
                      {subjectGroups.map(sg => (
                        <option key={sg.id} value={sg.name}>{sg.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {!editingSubject && (() => {
                  const campusMentors = mentors.filter(m => m.college_id === subjectForm.college_id);
                  if (campusMentors.length === 0) {
                    return (
                      <div className="flex flex-col items-center justify-center p-8 bg-gray-55 border border-dashed border-gray-200 rounded-2xl h-full text-center">
                        <Users className="h-8 w-8 text-gray-300 mb-2" />
                        <span className="text-[11px] text-gray-400 font-bold">No Staff on Selected Campus</span>
                        <span className="text-[9px] text-gray-400 mt-0.5">You can link staff to this subject later.</span>
                      </div>
                    );
                  }
                  return (
                    <div className="flex flex-col h-full space-y-2">
                      <label className="text-[10px] text-gray-400 uppercase tracking-wider block">
                        Assign Staff <span className="text-gray-300 font-normal normal-case">(optional)</span>
                      </label>
                      <div className="flex-1 max-h-64 overflow-y-auto rounded-2xl border border-gray-200 divide-y divide-gray-100 bg-gray-55">
                        {campusMentors.map(m => {
                          const checked = subjectForm.mentorIds.includes(m.id);
                          return (
                            <label
                              key={m.id}
                              className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-indigo-50/40 transition-colors"
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => {
                                  const next = checked
                                    ? subjectForm.mentorIds.filter(id => id !== m.id)
                                    : [...subjectForm.mentorIds, m.id];
                                  setSubjectForm({ ...subjectForm, mentorIds: next });
                                }}
                                className="h-3.5 w-3.5 rounded border-gray-300 text-indigo-600 cursor-pointer"
                              />
                              <div className="min-w-0 flex-1">
                                <div className="font-bold text-gray-800 truncate text-xs">{m.name}</div>
                                {m.department && <div className="text-[9px] text-gray-400 truncate">{m.department}</div>}
                              </div>
                              {checked && (
                                <span className="shrink-0 text-[8px] bg-indigo-50 border border-indigo-100 text-indigo-700 px-1 py-0.2 rounded font-black">Assigned</span>
                              )}
                            </label>
                          );
                        })}
                      </div>
                      {subjectForm.mentorIds.length > 0 && (
                        <p className="text-[10px] text-indigo-600 font-semibold leading-none pt-1">
                          {subjectForm.mentorIds.length} mentor{subjectForm.mentorIds.length > 1 ? "s" : ""} will be linked.
                        </p>
                      )}
                    </div>
                  );
                })()}
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowSubjectModal(false)}
                  className="px-4 py-2 hover:bg-gray-100 text-gray-555 rounded-xl transition-all font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-gradient px-5 py-2 text-white rounded-xl shadow-sm transition-all font-bold cursor-pointer"
                >
                  {editingSubject ? "Save Changes" : "Create Subject"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Course Modal ── */}
      {showDeptModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
          <div className="bg-white rounded-3xl border border-gray-150 shadow-2xl max-w-2xl w-full flex flex-col max-h-[85vh] overflow-hidden animate-slideUp">
            {/* Header (Fixed) */}
            <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100 bg-gray-50/80 shrink-0">
              <h3 className="font-extrabold text-gray-900 text-sm flex items-center gap-2">
                <div className="h-8 w-8 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                  <Layers className="h-4 w-4 text-indigo-650" />
                </div>
                {editingDept ? "Edit Course Details" : "Add Course"}
              </h3>
              <button onClick={() => setShowDeptModal(false)} className="p-1.5 hover:bg-gray-200 rounded-xl transition-colors cursor-pointer text-gray-500 hover:text-gray-800">
                <X className="h-4 w-4" />
              </button>
            </div>
            
            {/* Scrollable Form Body */}
            <form onSubmit={handleDeptSubmit} className="flex-1 overflow-y-auto p-6 space-y-4 text-xs font-semibold">
              {modalError && (
                <div className="p-3 bg-rose-50 border border-rose-150 rounded-xl text-rose-700 font-bold flex items-center gap-1.5">
                  <ShieldAlert className="h-4 w-4 shrink-0" />
                  {modalError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1 sm:col-span-2">
                  <label className="text-[10px] text-gray-400 uppercase tracking-wider block font-bold">Course Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Computer Science with Artificial Intelligence"
                    value={deptForm.name}
                    onChange={(e) => setDeptForm({ ...deptForm, name: e.target.value })}
                    className="w-full bg-gray-55 border border-gray-200 rounded-xl px-3.5 py-2.5 font-bold focus:outline-none focus:ring-1 focus:ring-indigo-650 text-gray-800"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-gray-400 uppercase tracking-wider block font-bold">Course Duration</label>
                  <select
                    value={deptForm.years || 4}
                    onChange={(e) => handleCourseYearsChange(Number(e.target.value))}
                    className="w-full bg-gray-55 border border-gray-200 rounded-xl px-3 py-2.5 font-bold focus:outline-none focus:ring-1 focus:ring-indigo-650 cursor-pointer text-gray-800"
                  >
                    <option value={1}>1 Year (2 Semesters)</option>
                    <option value={2}>2 Years (4 Semesters)</option>
                    <option value={3}>3 Years (6 Semesters)</option>
                    <option value={4}>4 Years (8 Semesters)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-gray-400 uppercase tracking-wider block font-bold">Status</label>
                  <select
                    value={deptForm.status || "Active"}
                    onChange={(e) => setDeptForm({ ...deptForm, status: e.target.value })}
                    className="w-full bg-gray-55 border border-gray-200 rounded-xl px-3 py-2.5 font-bold focus:outline-none focus:ring-1 focus:ring-indigo-650 cursor-pointer text-gray-800"
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>

                <div className="space-y-1 sm:col-span-2">
                  <label className="text-[10px] text-gray-400 uppercase tracking-wider block font-bold">Assigned Campus</label>
                  <select
                    required
                    value={deptForm.college_id || ""}
                    onChange={(e) => setDeptForm({ ...deptForm, college_id: e.target.value })}
                    className="w-full bg-gray-55 border border-gray-200 rounded-xl px-3 py-2.5 font-bold focus:outline-none focus:ring-1 focus:ring-indigo-650 cursor-pointer text-gray-800"
                  >
                    <option value="">— Select Campus —</option>
                    {colleges.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-3 sm:col-span-2 border-t border-gray-150 pt-4 mt-2">
                  <h4 className="text-[10px] font-black text-indigo-650 uppercase tracking-wider">
                    Classroom Allocations (Year-wise)
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {(() => {
                      const campus = colleges.find(c => c.id === deptForm.college_id);
                      const campusRooms = campus && campus.rooms ? campus.rooms.split(",").map(r => r.trim()).filter(Boolean) : [];
                      
                      const suggestions = new Set<string>(campusRooms);
                      coursesList
                        .filter(d => d.college_id === deptForm.college_id && d.id !== deptForm.id)
                        .forEach(d => {
                          if (d.default_room) {
                            if (d.default_room.startsWith("{")) {
                              try {
                                const parsed = JSON.parse(d.default_room);
                                Object.values(parsed).forEach((r: any) => {
                                  if (r && typeof r === 'string' && r.trim()) {
                                    suggestions.add(r.trim());
                                  }
                                });
                              } catch (_) {}
                            } else {
                              suggestions.add(d.default_room.trim());
                            }
                          }
                        });

                      const suggestionArray = Array.from(suggestions);

                      return (
                        <>
                          {Array.from({ length: Number(deptForm.years || 3) }, (_, idx) => {
                            const yearNum = idx + 1;
                            let currentRoom = "";
                            try {
                              if (deptForm.default_room && deptForm.default_room.startsWith("{")) {
                                const parsed = JSON.parse(deptForm.default_room);
                                currentRoom = parsed[yearNum] || "";
                              } else if (deptForm.default_room && yearNum === 1) {
                                currentRoom = deptForm.default_room;
                              }
                            } catch (_) {}

                            return (
                              <div key={yearNum} className="space-y-1">
                                <label className="text-[9.5px] text-gray-400 font-bold block uppercase tracking-wider">
                                  Year {yearNum} Room
                                </label>
                                <input
                                  type="text"
                                  list={`rooms-suggest-modal-${deptForm.college_id || 'none'}`}
                                  placeholder={`e.g. Room for Year ${yearNum}`}
                                  value={currentRoom}
                                  onChange={(e) => handleYearRoomChange(yearNum, e.target.value)}
                                  className="w-full bg-gray-55 border border-gray-200 rounded-xl px-3.5 py-2 font-bold focus:outline-none focus:ring-1 focus:ring-indigo-650 text-gray-805 text-xs font-semibold"
                                />
                              </div>
                            );
                          })}
                          
                          {suggestionArray.length > 0 && (
                            <datalist id={`rooms-suggest-modal-${deptForm.college_id || 'none'}`}>
                              {suggestionArray.map(r => (
                                <option key={r} value={r} />
                              ))}
                            </datalist>
                          )}
                        </>
                      );
                    })()}
                  </div>
                </div>

                <div className="space-y-2 sm:col-span-2 bg-indigo-50/60 dark:bg-slate-900/60 p-4 rounded-2xl border border-indigo-100 dark:border-slate-800">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[10px] text-indigo-900 dark:text-indigo-300 uppercase tracking-wider block font-black flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 text-indigo-600" />
                      Course Shift Scope & Period Time Schedule
                    </label>
                    <span className="text-[9px] font-extrabold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
                      {deptForm.default_shift === "both" ? "Shift 1 & 2 Dual Offerings" : deptForm.default_shift === "shift_2" ? "Shift 2 Evening" : deptForm.default_shift === "shift_1" ? "Shift 1 Day" : "General Full Day"}
                    </span>
                  </div>
                  <select
                    value={deptForm.default_shift || "shift_1"}
                    onChange={(e) => setDeptForm({ ...deptForm, default_shift: e.target.value })}
                    className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 font-bold focus:outline-none focus:ring-1 focus:ring-indigo-650 cursor-pointer text-gray-800 text-xs shadow-xs"
                  >
                    <option value="shift_1">Shift 1 — Morning / Day (08:20 AM - 12:50 PM)</option>
                    <option value="shift_2">Shift 2 — Evening (01:00 PM - 05:30 PM)</option>
                    <option value="both">Both Shifts — Dual Offerings (Shift 1 & Shift 2)</option>
                    <option value="general">General — Full Day (09:00 AM - 04:00 PM)</option>
                  </select>

                  {/* Active Period Timings Preview */}
                  <div className="mt-2.5 pt-2.5 border-t border-indigo-100/80 dark:border-slate-800/80 space-y-1.5">
                    <span className="text-[9.5px] font-extrabold uppercase text-slate-500 block tracking-wider">Configured Timings & Period Schedule:</span>
                    <div className="flex flex-wrap gap-1.5">
                      {(!deptForm.default_shift || deptForm.default_shift === "shift_1") && (
                        <>
                          <span className="px-2 py-0.5 bg-white text-indigo-700 border border-indigo-200 rounded-lg text-[9.5px] font-bold">P1: 8.20 AM - 9.10 AM</span>
                          <span className="px-2 py-0.5 bg-white text-indigo-700 border border-indigo-200 rounded-lg text-[9.5px] font-bold">P2: 9.10 AM - 10.00 AM</span>
                          <span className="px-2 py-0.5 bg-white text-indigo-700 border border-indigo-200 rounded-lg text-[9.5px] font-bold">P3: 10.20 AM - 11.10 AM</span>
                          <span className="px-2 py-0.5 bg-white text-indigo-700 border border-indigo-200 rounded-lg text-[9.5px] font-bold">P4: 11.10 AM - 12.00 PM</span>
                          <span className="px-2 py-0.5 bg-white text-indigo-700 border border-indigo-200 rounded-lg text-[9.5px] font-bold">P5: 12.00 PM - 12.50 PM</span>
                        </>
                      )}
                      {deptForm.default_shift === "shift_2" && (
                        <>
                          <span className="px-2 py-0.5 bg-white text-purple-700 border border-purple-200 rounded-lg text-[9.5px] font-bold">P1: 1.00 PM - 1.50 PM</span>
                          <span className="px-2 py-0.5 bg-white text-purple-700 border border-purple-200 rounded-lg text-[9.5px] font-bold">P2: 1.50 PM - 2.40 PM</span>
                          <span className="px-2 py-0.5 bg-white text-purple-700 border border-purple-200 rounded-lg text-[9.5px] font-bold">P3: 3.00 PM - 3.50 PM</span>
                          <span className="px-2 py-0.5 bg-white text-purple-700 border border-purple-200 rounded-lg text-[9.5px] font-bold">P4: 3.50 PM - 4.40 PM</span>
                          <span className="px-2 py-0.5 bg-white text-purple-700 border border-purple-200 rounded-lg text-[9.5px] font-bold">P5: 4.40 PM - 5.30 PM</span>
                        </>
                      )}
                      {deptForm.default_shift === "both" && (
                        <div className="space-y-2.5 w-full pt-1">
                          <div className="p-2.5 rounded-xl bg-white dark:bg-slate-950 border border-indigo-150 space-y-1.5 shadow-2xs">
                            <span className="text-[9.5px] font-black uppercase text-indigo-700 dark:text-indigo-400 block tracking-wider flex items-center gap-1.5">
                              <Sun className="h-3 w-3 text-amber-500" />
                              Shift 1 (Morning Section Periods):
                            </span>
                            <div className="flex flex-wrap gap-1.5">
                              <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg text-[9px] font-bold">P1: 8.20 AM - 9.10 AM</span>
                              <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg text-[9px] font-bold">P2: 9.10 AM - 10.00 AM</span>
                              <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg text-[9px] font-bold">P3: 10.20 AM - 11.10 AM</span>
                              <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg text-[9px] font-bold">P4: 11.10 AM - 12.00 PM</span>
                              <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg text-[9px] font-bold">P5: 12.00 PM - 12.50 PM</span>
                            </div>
                          </div>

                          <div className="p-2.5 rounded-xl bg-white dark:bg-slate-950 border border-purple-150 space-y-1.5 shadow-2xs">
                            <span className="text-[9.5px] font-black uppercase text-purple-700 dark:text-purple-400 block tracking-wider flex items-center gap-1.5">
                              <Moon className="h-3 w-3 text-purple-500" />
                              Shift 2 (Evening Section Periods):
                            </span>
                            <div className="flex flex-wrap gap-1.5">
                              <span className="px-2 py-0.5 bg-purple-50 text-purple-700 border border-purple-200 rounded-lg text-[9px] font-bold">P1: 1.00 PM - 1.50 PM</span>
                              <span className="px-2 py-0.5 bg-purple-50 text-purple-700 border border-purple-200 rounded-lg text-[9px] font-bold">P2: 1.50 PM - 2.40 PM</span>
                              <span className="px-2 py-0.5 bg-purple-50 text-purple-700 border border-purple-200 rounded-lg text-[9px] font-bold">P3: 3.00 PM - 3.50 PM</span>
                              <span className="px-2 py-0.5 bg-purple-50 text-purple-700 border border-purple-200 rounded-lg text-[9px] font-bold">P4: 3.50 PM - 4.40 PM</span>
                              <span className="px-2 py-0.5 bg-purple-50 text-purple-700 border border-purple-200 rounded-lg text-[9px] font-bold">P5: 4.40 PM - 5.30 PM</span>
                            </div>
                          </div>

                          <p className="text-[9px] text-slate-500 font-bold italic">
                            * Dual cohort course synced with campus Shift 1 and Shift 2 period schedules.
                          </p>
                        </div>
                      )}
                      {deptForm.default_shift === "general" && (
                        <>
                          <span className="px-2 py-0.5 bg-white text-slate-700 border border-slate-200 rounded-lg text-[9.5px] font-bold">General Full Day (09:00 AM - 04:00 PM)</span>
                        </>
                      )}
                    </div>

                    {/* Custom Shift Period Slot Timing Adjustments */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-indigo-100 dark:border-slate-800">
                      {(deptForm.default_shift === "shift_1" || deptForm.default_shift === "both" || !deptForm.default_shift) && (
                        <div className="space-y-1 bg-white dark:bg-slate-950 p-2.5 rounded-xl border border-indigo-100 dark:border-slate-800">
                          <label className="text-[9.5px] font-black uppercase text-indigo-700 dark:text-indigo-300 block flex items-center gap-1">
                            <Sun className="h-3 w-3 text-amber-500" /> Shift 1 Hours (Morning)
                          </label>
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              defaultValue="08:20 AM"
                              placeholder="08:20 AM"
                              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1.5 text-[11px] font-bold text-slate-800 dark:text-slate-200"
                            />
                            <span className="text-[10px] text-slate-400 font-bold">to</span>
                            <input
                              type="text"
                              defaultValue="12:50 PM"
                              placeholder="12:50 PM"
                              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1.5 text-[11px] font-bold text-slate-800 dark:text-slate-200"
                            />
                          </div>
                        </div>
                      )}

                      {(deptForm.default_shift === "shift_2" || deptForm.default_shift === "both") && (
                        <div className="space-y-1 bg-white dark:bg-slate-950 p-2.5 rounded-xl border border-purple-100 dark:border-slate-800">
                          <label className="text-[9.5px] font-black uppercase text-purple-700 dark:text-purple-300 block flex items-center gap-1">
                            <Moon className="h-3 w-3 text-purple-500" /> Shift 2 Hours (Evening)
                          </label>
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              defaultValue="01:00 PM"
                              placeholder="01:00 PM"
                              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1.5 text-[11px] font-bold text-slate-800 dark:text-slate-200"
                            />
                            <span className="text-[10px] text-slate-400 font-bold">to</span>
                            <input
                              type="text"
                              defaultValue="05:30 PM"
                              placeholder="05:30 PM"
                              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1.5 text-[11px] font-bold text-slate-800 dark:text-slate-200"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-1 sm:col-span-2">
                  <label className="text-[10px] text-gray-400 uppercase tracking-wider block font-bold">Description</label>
                  <textarea
                    placeholder="Enter course summary or notes..."
                    value={deptForm.description || ""}
                    onChange={(e) => setDeptForm({ ...deptForm, description: e.target.value })}
                    rows={2}
                    className="w-full bg-gray-55 border border-gray-200 rounded-xl px-3.5 py-2 font-bold focus:outline-none focus:ring-1 focus:ring-indigo-650 text-gray-800 resize-none font-semibold"
                  />
                </div>
              </div>

              {/* Sticky Footer */}
              <div className="flex justify-end gap-2.5 pt-4 mt-4 border-t border-gray-100 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowDeptModal(false)}
                  className="px-4 py-2 hover:bg-gray-100 text-gray-555 rounded-xl transition-all font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-gradient px-5 py-2 text-white rounded-xl shadow-sm transition-all font-bold cursor-pointer"
                >
                  {editingDept ? "Save Changes" : "Create Course"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Subject Group Modal ── */}
      {showGroupModal && (
        <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-gray-150 shadow-xl max-w-md w-full overflow-hidden animate-slideUp">
            <div className="flex justify-between items-center p-6 border-b border-gray-100 bg-gray-50">
              <h3 className="font-extrabold text-gray-900 text-sm flex items-center gap-1.5 font-sans">
                <Layers className="h-5 w-5 text-indigo-650" />
                {editingGroup ? "Edit Subject Group" : "Create Subject Group"}
              </h3>
              <button onClick={() => setShowGroupModal(false)} className="p-1 hover:bg-gray-250 rounded-lg transition-colors cursor-pointer text-gray-500 hover:text-gray-800">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleGroupSubmit} className="p-6 space-y-4 text-xs font-semibold">
              {modalError && (
                <div className="p-3 bg-rose-50 border border-rose-150 rounded-xl text-rose-700 font-bold flex items-center gap-1.5">
                  <ShieldAlert className="h-4 w-4 shrink-0" />
                  {modalError}
                </div>
              )}

              <div className="space-y-1">
                <label className="text-[10px] text-gray-400 uppercase tracking-wider block">Group Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. English, Aptitude, Soft Skills, Technical"
                  value={groupForm.name}
                  onChange={(e) => setGroupForm({ ...groupForm, name: e.target.value })}
                  className="w-full bg-gray-55 border border-gray-200 rounded-xl px-3.5 py-2.5 font-bold focus:outline-none focus:ring-1 focus:ring-indigo-655"
                  disabled={editingGroup && editingGroup.name === "General"}
                />
                {editingGroup && editingGroup.name === "General" && (
                  <p className="text-[9px] text-amber-605 mt-1 font-bold">The default "General" group name cannot be modified.</p>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-gray-400 uppercase tracking-wider block">Description</label>
                <textarea
                  placeholder="Provide a brief description for this subject group..."
                  value={groupForm.description}
                  onChange={(e) => setGroupForm({ ...groupForm, description: e.target.value })}
                  className="w-full bg-gray-55 border border-gray-200 rounded-xl px-3.5 py-2.5 font-bold focus:outline-none focus:ring-1 focus:ring-indigo-655 h-20 resize-none"
                />
              </div>

              {/* Map Subjects checklist */}
              <div className="space-y-1">
                <label className="text-[10px] text-gray-400 uppercase tracking-wider block">Map Subjects to Group</label>
                <div className="relative mb-1.5">
                  <Search className="absolute left-2.5 top-1.5 h-3.5 w-3.5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search subject catalog..."
                    value={groupSubjectSearch}
                    onChange={(e) => setGroupSubjectSearch(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg pl-8 pr-3 py-1.5 text-[10px] focus:outline-none focus:ring-1 focus:ring-indigo-650 font-bold"
                  />
                </div>
                
                <div className="border border-gray-150 rounded-xl bg-gray-55 p-3.5 max-h-44 overflow-y-auto space-y-1.5 text-[11px] font-bold">
                  {(() => {
                    const searched = (subjectsList || []).filter(s => 
                      s.name.toLowerCase().includes(groupSubjectSearch.toLowerCase()) ||
                      s.department.toLowerCase().includes(groupSubjectSearch.toLowerCase())
                    );

                    return (
                      <>
                        {searched.map(s => {
                          const isChecked = groupForm.subjectIds.includes(s.id);
                          return (
                            <label key={s.id} className="flex items-start gap-2 py-1 px-1.5 hover:bg-white rounded cursor-pointer transition-colors text-gray-700">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) => {
                                  let next;
                                  if (e.target.checked) {
                                    next = [...groupForm.subjectIds, s.id];
                                  } else {
                                    next = groupForm.subjectIds.filter(id => id !== s.id);
                                  }
                                  setGroupForm({ ...groupForm, subjectIds: next });
                                }}
                                className="rounded text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5 cursor-pointer mt-0.5"
                              />
                              <div className="leading-tight flex-1">
                                <span className="font-bold text-gray-800">{s.name}</span>
                                <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                  <span className="text-[9px] text-gray-400 font-semibold">{s.department} • {s.semester}</span>
                                  {s.subject_group && s.subject_group !== "General" && (
                                    <span className={`text-[8.5px] px-1 py-0.2 rounded font-black ${
                                      s.subject_group === (editingGroup?.name)
                                        ? "bg-indigo-55 text-indigo-700 border border-indigo-100"
                                        : "bg-amber-50 text-amber-700 border border-amber-100"
                                    }`}>
                                      Group: {s.subject_group}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </label>
                          );
                        })}
                        {searched.length === 0 && (
                          <div className="text-center text-gray-400 italic py-2 text-[10px]">
                            No subjects found.
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowGroupModal(false)}
                  className="px-4 py-2 hover:bg-gray-100 text-gray-555 rounded-xl transition-all font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-gradient px-5 py-2 text-white rounded-xl shadow-sm transition-all font-bold cursor-pointer"
                >
                  {editingGroup ? "Save Changes" : "Create Group"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Compose Announcement Modal ── */}
      {showAnnModal && (
        <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-gray-150 shadow-xl max-w-md w-full overflow-hidden animate-slideUp">
            <div className="flex justify-between items-center p-6 border-b border-gray-100 bg-gray-55">
              <h3 className="font-extrabold text-gray-905 text-sm flex items-center gap-1.5">
                <Megaphone className="h-5 w-5 text-indigo-650" />
                Compose Campus Announcement
              </h3>
              <button onClick={() => setShowAnnModal(false)} className="p-1 hover:bg-gray-250 rounded-lg transition-colors cursor-pointer text-gray-500 hover:text-gray-800">
                <X className="h-4 w-4" />
              </button>
            </div>
            
            <form onSubmit={handleComposeAnnouncement} className="p-6 space-y-4 text-xs font-semibold">
              <div className="space-y-1">
                <label className="text-[10px] text-gray-400 uppercase tracking-wider block">Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. End Semester Examinations Schedule"
                  value={annForm.title}
                  onChange={(e) => setAnnForm({ ...annForm, title: e.target.value })}
                  className="w-full bg-gray-55 border border-gray-200 rounded-xl px-3.5 py-2.5 font-bold focus:outline-none focus:ring-1 focus:ring-indigo-650"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-gray-400 uppercase tracking-wider block">Description</label>
                <textarea
                  required
                  placeholder="Compose notice content here..."
                  value={annForm.description}
                  onChange={(e) => setAnnForm({ ...annForm, description: e.target.value })}
                  rows={4}
                  className="w-full bg-gray-55 border border-gray-200 rounded-xl px-3.5 py-2.5 font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-650 text-gray-805 resize-none"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                <div className="space-y-1">
                  <label className="text-[10px] text-gray-400 uppercase tracking-wider block">Target Role</label>
                  <select
                    required
                    value={annForm.target_role}
                    onChange={(e) => setAnnForm({ ...annForm, target_role: e.target.value })}
                    className="w-full bg-gray-55 border border-gray-200 rounded-xl px-3 py-2.5 font-bold focus:outline-none focus:ring-1 focus:ring-indigo-655 cursor-pointer"
                  >
                    <option value="All">All Roles</option>
                    <option value="student">Students</option>
                    <option value="mentor">Mentors</option>
                    <option value="cam">Campus Managers</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-gray-400 uppercase tracking-wider block">Target Campus</label>
                  <select
                    value={annForm.college_id}
                    onChange={(e) => setAnnForm({ ...annForm, college_id: e.target.value })}
                    className="w-full bg-gray-55 border border-gray-200 rounded-xl px-3 py-2.5 font-bold focus:outline-none focus:ring-1 focus:ring-indigo-655 cursor-pointer"
                  >
                    <option value="">All Campuses</option>
                    {colleges.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowAnnModal(false)}
                  className="px-4 py-2 hover:bg-gray-100 text-gray-550 rounded-xl transition-all font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-gradient px-5 py-2 text-white rounded-xl shadow-sm transition-all font-bold cursor-pointer"
                >
                  Publish Notice
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Schedule Holiday Modal ── */}
      {showHolModal && (
        <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-gray-150 shadow-xl max-w-md w-full overflow-hidden animate-slideUp">
            <div className="flex justify-between items-center p-6 border-b border-gray-100 bg-gray-55">
              <h3 className="font-extrabold text-gray-905 text-sm flex items-center gap-1.5">
                <Calendar className="h-5 w-5 text-indigo-650" />
                Schedule Campus Holiday
              </h3>
              <button onClick={() => setShowHolModal(false)} className="p-1 hover:bg-gray-250 rounded-lg transition-colors cursor-pointer text-gray-500 hover:text-gray-800">
                <X className="h-4 w-4" />
              </button>
            </div>
            
            <form onSubmit={handleAddHoliday} className="p-6 space-y-4 text-xs font-semibold">
              <div className="space-y-1">
                <label className="text-[10px] text-gray-400 uppercase tracking-wider block">Holiday Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Independence Day"
                  value={holForm.title}
                  onChange={(e) => setHolForm({ ...holForm, title: e.target.value })}
                  className="w-full bg-gray-55 border border-gray-200 rounded-xl px-3.5 py-2.5 font-bold focus:outline-none focus:ring-1 focus:ring-indigo-650"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-gray-400 uppercase tracking-wider block">Date</label>
                <input
                  type="date"
                  required
                  value={holForm.date}
                  onChange={(e) => setHolForm({ ...holForm, date: e.target.value })}
                  className="w-full bg-gray-55 border border-gray-200 rounded-xl px-3.5 py-2.5 font-bold focus:outline-none focus:ring-1 focus:ring-indigo-650 text-gray-800"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                <div className="space-y-1">
                  <label className="text-[10px] text-gray-400 uppercase tracking-wider block">Holiday Type</label>
                  <select
                    required
                    value={holForm.type}
                    onChange={(e) => setHolForm({ ...holForm, type: e.target.value })}
                    className="w-full bg-gray-55 border border-gray-200 rounded-xl px-3 py-2.5 font-bold focus:outline-none focus:ring-1 focus:ring-indigo-655 cursor-pointer"
                  >
                    <option value="National Holiday">National Holiday</option>
                    <option value="Regional Holiday">Regional Holiday</option>
                    <option value="College Holiday">College Holiday</option>
                    <option value="Declared Holiday">Declared Holiday</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-gray-400 uppercase tracking-wider block">Campus scope</label>
                  <select
                    value={holForm.college_id}
                    onChange={(e) => setHolForm({ ...holForm, college_id: e.target.value })}
                    className="w-full bg-gray-55 border border-gray-200 rounded-xl px-3 py-2.5 font-bold focus:outline-none focus:ring-1 focus:ring-indigo-655 cursor-pointer"
                  >
                    <option value="">All Campuses</option>
                    {colleges.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowHolModal(false)}
                  className="px-4 py-2 hover:bg-gray-100 text-gray-550 rounded-xl transition-all font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-gradient px-5 py-2 text-white rounded-xl shadow-sm transition-all font-bold cursor-pointer"
                >
                  Save Holiday
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      </main>

      {selectedProfileMentor && (
        <MentorProfileModal
          mentor={selectedProfileMentor}
          isOpen={isProfileOpen}
          onClose={() => {
            setIsProfileOpen(false);
            setSelectedProfileMentor(null);
          }}
        />
      )}
    </div>
  );
};