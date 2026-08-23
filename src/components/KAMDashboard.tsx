"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { useApp, Slot, Mentor, Student, Subject, College } from "@/context/AppContext";
import { useToast } from "@/context/ToastContext";
import {
  Building2,
  Users,
  Calendar,
  Clock,
  CheckCircle2,
  AlertTriangle,
  BookOpen,
  Settings,
  Award,
  TrendingUp,
  FileText,
  RefreshCw,
  Search,
  ChevronDown,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  GraduationCap,
  CalendarCheck2,
  IndianRupee,
  User,
  SlidersHorizontal,
  Download,
  Filter,
  Eye,
  ArrowUpRight,
  ShieldCheck,
  Mail,
  Phone,
  BarChart3,
  Layers,
  Sparkles,
  HeartPulse,
  Percent,
  CheckCircle,
  XCircle,
  FileSpreadsheet
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
  AreaChart, Area, CartesianGrid
} from "recharts";
import dynamic from "next/dynamic";

const Student360 = dynamic(() => import("./kam/students/Student360").then(m => m.Student360), { ssr: false });
const Mentor360 = dynamic(() => import("./kam/mentors/Mentor360").then(m => m.Mentor360), { ssr: false });
const StudentDirectory = dynamic(() => import("./kam/students/StudentDirectory").then(m => m.StudentDirectory), { ssr: false });
const KAMAnalytics = dynamic(() => import("./kam/analytics/KAMAnalytics").then(m => m.KAMAnalytics), { ssr: false });
const InterviewModule = dynamic(() => import("./InterviewModule").then(m => m.InterviewModule), { ssr: false });
const ExamScheduleManager = dynamic(() => import("./ExamScheduleManager").then(m => m.ExamScheduleManager), { ssr: false });

const KAMAcademicDelivery = dynamic(() => import("./kam/academic/KAMAcademicDelivery").then(m => m.KAMAcademicDelivery), { ssr: false });
const KAMStudentAcademicRisk = dynamic(() => import("./kam/students/KAMStudentAcademicRisk").then(m => m.KAMStudentAcademicRisk), { ssr: false });
const KAMPracticalSkills = dynamic(() => import("./kam/skills/KAMPracticalSkills").then(m => m.KAMPracticalSkills), { ssr: false });
const KAMFacultyGovernance = dynamic(() => import("./kam/mentors/KAMFacultyGovernance").then(m => m.KAMFacultyGovernance), { ssr: false });
const KAMFinanceAndWelfare = dynamic(() => import("./kam/shared/KAMFinanceAndWelfare").then(m => m.KAMFinanceAndWelfare), { ssr: false });
const KAMAssessmentsOversight = dynamic(() => import("./kam/academic/KAMAssessmentsOversight").then(m => m.KAMAssessmentsOversight), { ssr: false });
const KAMCampusesDirectory = dynamic(() => import("./kam/overview/KAMCampusesDirectory").then(m => m.KAMCampusesDirectory), { ssr: false });

import { Card } from "./Card";
import { Panel } from "./Panel";
import { Button } from "./Button";
import { formatDisplayDob, parseDateToYMD, evaluateDailyStudentAttendance, mapDayOrderToDayName } from "@/lib/utils";

/* ─── 1. Attendance Monitoring Infographics Banner ─── */
interface AttMonitoringChartProps {
  donutData: { name: string; value: number; color: string }[];
  cgChartData: { name: string; pct: number }[];
  onTrack: number;
  atRisk: number;
  critical: number;
  noData: number;
  overallAvgPct: number;
  filteredCount: number;
  workingDatesCount: number;
}

const AttMonitoringCharts = React.memo<AttMonitoringChartProps>(({
  donutData, cgChartData, onTrack, atRisk, critical, noData,
  overallAvgPct, filteredCount, workingDatesCount,
}) => {
  const shortageCount = atRisk + critical;
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 pb-2">
      {/* 4 Mini KPI Cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 shadow-xs">
          <p className="text-[10px] font-extrabold text-emerald-600 uppercase tracking-wider">Campus Avg</p>
          <p className="text-xl font-black text-emerald-700 mt-0.5">{overallAvgPct}%</p>
          <p className="text-[9px] text-emerald-500 font-semibold mt-0.5">across {filteredCount} students</p>
        </div>
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 shadow-xs">
          <p className="text-[10px] font-extrabold text-rose-600 uppercase tracking-wider">Shortage Alert</p>
          <p className="text-xl font-black text-rose-700 mt-0.5">{shortageCount}</p>
          <p className="text-[9px] text-rose-400 font-semibold mt-0.5">students below 75%</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs">
          <p className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">On Track</p>
          <p className="text-xl font-black text-slate-800 mt-0.5">{onTrack}</p>
          <p className="text-[9px] text-slate-400 font-semibold mt-0.5">students ≥ 75%</p>
        </div>
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3 shadow-xs">
          <p className="text-[10px] font-extrabold text-indigo-600 uppercase tracking-wider">Tracked Days</p>
          <p className="text-xl font-black text-indigo-700 mt-0.5">{workingDatesCount}</p>
          <p className="text-[9px] text-indigo-400 font-semibold mt-0.5">working days in range</p>
        </div>
      </div>

      {/* Donut: Student-level Compliance Split */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col shadow-xs">
        <p className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider mb-1">Student Compliance Split</p>
        <p className="text-[9px] text-slate-400 font-medium mb-2">Each segment = number of students</p>
        {donutData.length > 0 ? (
          <PieChart width={240} height={120} style={{ margin: "0 auto" }}>
            <Pie
              data={donutData} cx="50%" cy="50%"
              innerRadius={32} outerRadius={54}
              paddingAngle={3} dataKey="value"
              isAnimationActive={false}
            >
              {donutData.map((e, i) => <Cell key={i} fill={e.color} />)}
            </Pie>
            <Tooltip formatter={(v: any, n: any) => [`${v} students`, n]} />
          </PieChart>
        ) : (
          <div className="h-[120px] flex items-center justify-center text-xs text-slate-400 italic">No data</div>
        )}
        <div className="flex flex-col gap-1 mt-2">
          {donutData.map(d => (
            <div key={d.name} className="flex items-center justify-between text-[9px] font-bold text-slate-600">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full shrink-0" style={{ background: d.color }} />
                {d.name}
              </span>
              <span className="font-black">{d.value} students</span>
            </div>
          ))}
        </div>
      </div>

      {/* Bar: Class-group / Department Avg % */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
        <p className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider mb-1">Avg Attendance % by Class</p>
        <p className="text-[9px] text-slate-400 font-medium mb-2">≥75% Good &nbsp; 65–74% Average &nbsp; &lt;65% Low</p>
        {cgChartData.length > 0 ? (
          <BarChart
            width={320} height={Math.max(120, cgChartData.length * 24)}
            data={cgChartData} layout="vertical"
            margin={{ top: 0, right: 32, bottom: 0, left: 0 }}
          >
            <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 9 }} tickFormatter={v => `${v}%`} />
            <YAxis dataKey="name" type="category" tick={{ fontSize: 8, fontWeight: 700 }} width={100} />
            <Tooltip formatter={(v: any) => [`${v}%`, "Avg Attendance"]} />
            <Bar dataKey="pct" radius={[0, 4, 4, 0]} isAnimationActive={false}
              label={{ position: "right", fontSize: 8, fontWeight: 700, formatter: (v: any) => `${v}%` }}>
              {cgChartData.map((e, i) => (
                <Cell key={i} fill={e.pct >= 75 ? "#10b981" : e.pct >= 65 ? "#f59e0b" : "#f43f5e"} />
              ))}
            </Bar>
          </BarChart>
        ) : (
          <div className="h-[120px] flex items-center justify-center text-xs text-slate-400 italic">No attendance data in range</div>
        )}
      </div>
    </div>
  );
});
AttMonitoringCharts.displayName = "AttMonitoringCharts";

export interface KAMDashboardProps {
  activeTab?: string;
  onTabChange?: (tab: string) => void;
}

export function KAMDashboard({ activeTab: externalTab, onTabChange }: KAMDashboardProps = {}) {
  const {
    colleges: rawColleges,
    currentKAM,
    mentors,
    slots,
    students,
    studentAttendance,
    leaveRequests,
    requests: handoverRequests,
    academicYears,
    departmentsList,
    holidays,
    refreshData,
    isDataLoading
  } = useApp();

  const { toast } = useToast ? useToast() : { toast: (_m: string, _t?: string) => {} };

  const storedUserEmail = typeof window !== "undefined" ? (localStorage.getItem("fp_user_email") || "") : "";
  const isSuperAdmin = storedUserEmail.toLowerCase().trim() === "thanush@faceprep.in";

  // Filter colleges strictly to those assigned to this KAM — never fall back to all
  const colleges = useMemo(() => {
    if (isSuperAdmin || !currentKAM?.id) return rawColleges;
    return rawColleges.filter(c => c.kam_id === currentKAM.id || (c as any).kamId === currentKAM.id);
  }, [rawColleges, currentKAM?.id, isSuperAdmin]);

  const assignedCollegeIds = useMemo(() => new Set(colleges.map(c => c.id)), [colleges]);

  // Internal tab state matching CAM navigation patterns
  const [internalTab, setInternalTab] = useState<string>("overview");
  const activeTab = externalTab || internalTab;

  const setActiveTab = (tab: string) => {
    setInternalTab(tab);
    if (onTabChange) onTabChange(tab);
  };

  // Sidebar collapse state
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("fp_kam_sidebar_collapsed") === "true";
    }
    return false;
  });

  const [expandedGroups, setExpandedGroups] = useState<{ [key: string]: boolean }>({
    dashboard: true,
    academic: true,
    students: true,
    faculty: true,
    operations: true,
    placement: true
  });

  // Active Campus Selection Scope (Defaults to "all" for Portfolio view)
  const [selectedCollegeId, setSelectedCollegeId] = useState<string>("all");

  // Daily configs from DB for day orders, day types, and holidays with remarks
  const [dailyConfigsList, setDailyConfigsList] = useState<any[]>([]);

  useEffect(() => {
    let isMounted = true;
    async function loadDailyConfigs() {
      try {
        const collegeParam = selectedCollegeId && selectedCollegeId !== "all" ? `?college_id=${encodeURIComponent(selectedCollegeId)}` : "";
        const res = await fetch(`/api/daily-configs${collegeParam}`);
        const json = await res.json();
        if (json.success && isMounted) {
          setDailyConfigsList(json.configs || []);
        }
      } catch (err) {
        console.error("Failed to load daily configs:", err);
      }
    }
    loadDailyConfigs();
    return () => { isMounted = false; };
  }, [selectedCollegeId]);

  // Filter Bar state
  const [selectedDept, setSelectedDept] = useState<string>("all");
  const [selectedCohort, setSelectedCohort] = useState<string>("all");
  const [selectedShift, setSelectedShift] = useState<string>("all");
  const [studentSearch, setStudentSearch] = useState<string>("");
  const [selectedStudentFor360, setSelectedStudentFor360] = useState<string | null>(null);
  const [selectedMentorFor360, setSelectedMentorFor360] = useState<string | null>(null);
  const [selectedTimetableDay, setSelectedTimetableDay] = useState<string>("Monday");

  // Date range for monitoring matrix
  const todayStr = useMemo(() => {
    return new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().split("T")[0];
  }, []);

  const [attendanceStartDate, setAttendanceStartDate] = useState<string>("2026-06-15");
  const [attendanceEndDate, setAttendanceEndDate] = useState<string>(todayStr);
  const [attendancePage, setAttendancePage] = useState<number>(1);
  const [attendancePageSize, setAttendancePageSize] = useState<number>(25);

  // Targeted API Overview Data
  const [overviewData, setOverviewData] = useState<any | null>(null);
  const [trendData, setTrendData] = useState<any[]>([]);

  useEffect(() => {
    let isMounted = true;
    async function loadOverview() {
      try {
        const kamParam = currentKAM?.id ? `?kamId=${encodeURIComponent(currentKAM.id)}` : "";
        const res = await fetch(`/api/kam/overview${kamParam}`);
        const json = await res.json();
        if (json.success && isMounted) {
          setOverviewData(json);
        }
      } catch (err) {
        console.error("Failed to load KAM overview:", err);
      }
    }
    loadOverview();
    return () => { isMounted = false; };
  }, [currentKAM?.id]);

  useEffect(() => {
    let isMounted = true;
    async function loadTrends() {
      try {
        const params = new URLSearchParams();
        if (selectedCollegeId !== "all") params.append("collegeId", selectedCollegeId);
        if (selectedDept !== "all") params.append("department", selectedDept);
        if (selectedCohort !== "all") params.append("classGroup", selectedCohort);
        if (attendanceStartDate) params.append("startDate", attendanceStartDate);
        if (attendanceEndDate) params.append("endDate", attendanceEndDate);

        const res = await fetch(`/api/kam/analytics/attendance?${params.toString()}`);
        const json = await res.json();
        if (json.success && isMounted) {
          setTrendData(json.trend || []);
        }
      } catch (err) {
        console.error("Failed to load trends:", err);
      }
    }
    loadTrends();
    return () => { isMounted = false; };
  }, [selectedCollegeId, selectedDept, selectedCohort, attendanceStartDate, attendanceEndDate]);

  // College-scoped datasets strictly bounded to KAM jurisdiction
  const activeCollegeStudents = useMemo(() => {
    const kamScoped = students.filter(s => s.college_id && assignedCollegeIds.has(s.college_id));
    if (selectedCollegeId === "all") return kamScoped.length > 0 ? kamScoped : students;
    return kamScoped.filter(s => s.college_id === selectedCollegeId);
  }, [students, assignedCollegeIds, selectedCollegeId]);

  const activeCollegeMentors = useMemo(() => {
    const kamScoped = mentors.filter(m => m.college_id && assignedCollegeIds.has(m.college_id));
    if (selectedCollegeId === "all") return kamScoped.length > 0 ? kamScoped : mentors;
    return kamScoped.filter(m => m.college_id === selectedCollegeId);
  }, [mentors, assignedCollegeIds, selectedCollegeId]);

  const activeCollegeSlots = useMemo(() => {
    const kamScoped = slots.filter(s => s.college_id && assignedCollegeIds.has(s.college_id));
    if (selectedCollegeId === "all") return kamScoped.length > 0 ? kamScoped : slots;
    return kamScoped.filter(s => s.college_id === selectedCollegeId);
  }, [slots, assignedCollegeIds, selectedCollegeId]);

  // Distinct departments and cohorts
  const departments = useMemo(() => {
    const set = new Set<string>();
    activeCollegeStudents.forEach(s => { if (s.department) set.add(s.department); });
    return Array.from(set).sort();
  }, [activeCollegeStudents]);

  const cohorts = useMemo(() => {
    const set = new Set<string>();
    activeCollegeStudents.forEach(s => { if (s.classGroup) set.add(s.classGroup); });
    return Array.from(set).sort();
  }, [activeCollegeStudents]);

  // O(1) Daily Config Map lookup by dateStr
  const dailyConfigMap = useMemo(() => {
    const map = new Map<string, any>();
    (dailyConfigsList || []).forEach((c: any) => {
      if (c?.dateStr) map.set(c.dateStr, c);
    });
    return map;
  }, [dailyConfigsList]);

  // O(1) Holiday map lookup combining static holidays AND dailyConfigsList where day_type === 'holiday'
  const holidayMap = useMemo(() => {
    const map = new Map<string, any>();
    (holidays || []).forEach((h: any) => {
      const d = h?.date || h?.dateStr;
      if (d) map.set(d, { isHoliday: true, name: h.name || h.description || "College Holiday", notes: h.notes || h.name || "College Holiday" });
    });
    (dailyConfigsList || []).forEach((c: any) => {
      if (c?.dateStr && (c.day_type === "holiday" || (c.day_order && c.day_order.toLowerCase() === "none" && c.day_type === "holiday"))) {
        const existing = map.get(c.dateStr);
        map.set(c.dateStr, {
          isHoliday: true,
          name: c.notes || existing?.name || "College Holiday",
          notes: c.notes || existing?.notes || "College Holiday",
          ...c
        });
      }
    });
    return map;
  }, [holidays, dailyConfigsList]);

  // Working dates list for Attendance Matrix
  const workingDates = useMemo(() => {
    const dateSet = new Set<string>();
    const rangeStart = new Date(attendanceStartDate + "T00:00:00");
    const rangeEnd = new Date(attendanceEndDate + "T00:00:00");

    if (!isNaN(rangeStart.getTime()) && !isNaN(rangeEnd.getTime())) {
      const cur = new Date(rangeStart);
      while (cur <= rangeEnd) {
        const dow = cur.getDay();
        const ymd = cur.toISOString().split("T")[0];
        if (dow !== 0) dateSet.add(ymd); // Exclude Sundays
        cur.setDate(cur.getDate() + 1);
      }
    }
    (dailyConfigsList || []).forEach(cfg => {
      if (cfg.dateStr && cfg.dateStr >= attendanceStartDate && cfg.dateStr <= attendanceEndDate) {
        dateSet.add(cfg.dateStr);
      }
    });
    return Array.from(dateSet).sort();
  }, [attendanceStartDate, attendanceEndDate, dailyConfigsList]);

  // Precomputed dayNameMap for O(1) cell lookups, respecting Day Order (Day 1->Mon, Day 2->Tue, etc.)
  const dayNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    workingDates.forEach(dStr => {
      const cfg = dailyConfigMap.get(dStr);
      const defaultWeekday = new Date(dStr + "T00:00:00").toLocaleDateString("en-US", { weekday: "long" });
      map[dStr] = mapDayOrderToDayName(cfg?.day_order, defaultWeekday);
    });
    return map;
  }, [workingDates, dailyConfigMap]);

  // Robust Student ID Alias Lookup (Matches ID, Roll Number, or Register Number)
  const studentIdLookup = useMemo(() => {
    const map = new Map<string, typeof students[0]>();
    students.forEach(s => {
      if (s.id) map.set(s.id.toLowerCase().trim(), s);
      if (s.roll_number) map.set(s.roll_number.toLowerCase().trim(), s);
      if (s.register_number) map.set(s.register_number.toLowerCase().trim(), s);
    });
    return map;
  }, [students]);

  // Slot Lookup Map: `${day}__${classGroup.toLowerCase()}` -> slots[]
  const slotMap = useMemo(() => {
    const map = new Map<string, any[]>();
    slots.forEach(s => {
      const rawKey = `${s.day}__${(s.classGroup || "").toLowerCase().trim()}`;
      const normKey = `${s.day}__${(s.classGroup || "").replace(/\s*\(\d{4}[–\-]\d{4}\)/g, "").replace(/\s*-\s*Batch\s*\d{4}[–\-]\d{4}/gi, "").trim().toLowerCase()}`;
      
      const arr = map.get(rawKey);
      if (arr) arr.push(s);
      else map.set(rawKey, [s]);

      if (normKey !== rawKey) {
        const normArr = map.get(normKey);
        if (normArr) normArr.push(s);
        else map.set(normKey, [s]);
      }
    });
    return map;
  }, [slots]);

  // Attendance Fast Lookup Map: `${studentId}_${dateStr}` -> records[]
  const attendanceMap = useMemo(() => {
    const map = new Map<string, any[]>();
    studentAttendance.forEach(a => {
      const rawId = (a.studentId || "").toLowerCase().trim();
      const st = studentIdLookup.get(rawId);
      const resolvedId = st ? st.id : a.studentId;
      const key = `${resolvedId}_${a.dateStr}`;
      const arr = map.get(key);
      if (arr) arr.push(a);
      else map.set(key, [a]);
    });
    return map;
  }, [studentAttendance, studentIdLookup]);

  // Filtered students for monitoring table
  const filteredStudents = useMemo(() => {
    const q = studentSearch.trim().toLowerCase();
    return activeCollegeStudents.filter(s => {
      const matchesSearch = !q || s.name.toLowerCase().includes(q) ||
        (s.roll_number && s.roll_number.toLowerCase().includes(q)) ||
        (s.register_number && s.register_number.toLowerCase().includes(q)) ||
        s.id.toLowerCase().includes(q);
      const matchesDept = selectedDept === "all" || s.department === selectedDept;
      const matchesCohort = selectedCohort === "all" || s.classGroup === selectedCohort;
      return matchesSearch && matchesDept && matchesCohort;
    });
  }, [activeCollegeStudents, studentSearch, selectedDept, selectedCohort]);

  // Pre-computed per-student daily stats matching CAM exact algorithm
  const studentStats = useMemo(() => {
    return filteredStudents.map(st => {
      let presentDays = 0;
      let absentDays = 0;
      let totalMarkedDays = 0;

      workingDates.forEach(dStr => {
        const hol = holidayMap.get(dStr);
        const cfg = dailyConfigMap.get(dStr);
        if (hol || cfg?.day_type === "holiday") return; // Exclude holidays from compliance calculations

        const dayName = dayNameMap[dStr];
        const daySlots = slotMap.get(`${dayName}__${(st.classGroup || "").toLowerCase().trim()}`) || [];
        const dayAtt = attendanceMap.get(`${st.id}_${dStr}`) || [];

        if (daySlots.length > 0 || dayAtt.length > 0) {
          const evalRes = evaluateDailyStudentAttendance(dayAtt, daySlots.length, false, false, cfg?.notes || "");
          if (evalRes.status === "P" || evalRes.status === "OD") {
            presentDays++;
            totalMarkedDays++;
          } else if (evalRes.status === "A") {
            absentDays++;
            totalMarkedDays++;
          }
        }
      });

      const pct = totalMarkedDays > 0 ? Math.round((presentDays / totalMarkedDays) * 100) : 0;
      return {
        id: st.id,
        classGroup: st.classGroup,
        department: st.department,
        presentDays,
        absentDays,
        totalMarkedDays,
        pct
      };
    });
  }, [filteredStudents, workingDates, slotMap, attendanceMap, dayNameMap]);

  // Paginated students slice for ultra-fast DOM rendering
  const paginatedStudents = useMemo(() => {
    if (attendancePageSize === 0) return filteredStudents;
    const start = (attendancePage - 1) * attendancePageSize;
    return filteredStudents.slice(start, start + attendancePageSize);
  }, [filteredStudents, attendancePage, attendancePageSize]);

  // Infographics derived stats for AttMonitoringCharts
  const attChartInfographics = useMemo(() => {
    let onTrack = 0;
    let atRisk = 0;
    let critical = 0;
    let noData = 0;
    let totalPcts = 0;
    let validCount = 0;

    const cgMap: Record<string, { totalPct: number; count: number }> = {};

    studentStats.forEach(st => {
      if (st.totalMarkedDays === 0) {
        noData++;
      } else if (st.pct >= 75) {
        onTrack++;
        totalPcts += st.pct;
        validCount++;
      } else if (st.pct >= 65) {
        atRisk++;
        totalPcts += st.pct;
        validCount++;
      } else {
        critical++;
        totalPcts += st.pct;
        validCount++;
      }

      const cgKey = st.department || st.classGroup || "General";
      if (!cgMap[cgKey]) cgMap[cgKey] = { totalPct: 0, count: 0 };
      if (st.totalMarkedDays > 0) {
        cgMap[cgKey].totalPct += st.pct;
        cgMap[cgKey].count++;
      }
    });

    const cgChartData = Object.entries(cgMap)
      .map(([name, val]) => ({
        name: name.length > 14 ? name.slice(0, 14) + "…" : name,
        pct: val.count > 0 ? Math.round(val.totalPct / val.count) : 0
      }))
      .sort((a, b) => b.pct - a.pct)
      .slice(0, 6);

    const overallAvgPct = validCount > 0 ? Math.round((totalPcts / validCount) * 10) / 10 : 0;

    const donutData = [
      { name: "On Track (≥75%)", value: onTrack, color: "#10b981" },
      { name: "At Risk (65–74%)", value: atRisk, color: "#f59e0b" },
      { name: "Critical (<65%)", value: critical, color: "#f43f5e" },
      { name: "No Data", value: noData, color: "#cbd5e1" }
    ].filter(d => d.value > 0);

    return {
      donutData,
      cgChartData,
      onTrack,
      atRisk,
      critical,
      noData,
      overallAvgPct
    };
  }, [studentStats]);

  // KPI Calculations
  const calculatedAttendancePct = useMemo(() => {
    if (studentStats.length === 0) return "0.0%";
    const validStats = studentStats.filter(s => s.totalMarkedDays > 0);
    if (validStats.length === 0) return "0.0%";
    const avg = validStats.reduce((acc, s) => acc + s.pct, 0) / validStats.length;
    return avg.toFixed(1) + "%";
  }, [studentStats]);

  const activeCollegeObj = colleges.find(c => c.id === selectedCollegeId);

  // Timetable Day Filtered Slots
  const daySlots = useMemo(() => {
    return activeCollegeSlots.filter(s => s.day?.toLowerCase() === selectedTimetableDay.toLowerCase());
  }, [activeCollegeSlots, selectedTimetableDay]);

  // Export Master Multi-Date Attendance Register
  const handleExportAttendanceRegister = async () => {
    try {
      const XLSX = await import("xlsx");
      const dateHeaders = workingDates.map(dStr => {
        const cfg = dailyConfigMap.get(dStr);
        const hol = holidayMap.get(dStr);
        const dmy = formatDisplayDob(dStr) || dStr;
        const notes = cfg?.notes || hol?.notes || "";
        if (hol || cfg?.day_type === "holiday") {
          return `${dmy} [Holiday${notes ? `: ${notes}` : ""}]`;
        }
        if (cfg?.day_order && cfg.day_order !== "None") {
          return `${dmy} [${cfg.day_order}${notes ? ` - ${notes}` : ""}]`;
        }
        if (cfg?.day_type && cfg.day_type !== "working") {
          return `${dmy} [${cfg.day_type.replace("_", " ")}${notes ? `: ${notes}` : ""}]`;
        }
        if (notes) {
          return `${dmy} [${notes}]`;
        }
        return dmy;
      });

      const headers = [
        "Sl. No.",
        "Roll No",
        "Student Name",
        "Department",
        "Class / Batch",
        "Total Days",
        "Total Present",
        "Total Absent",
        "Attendance %",
        ...dateHeaders
      ];

      const rows = filteredStudents.map((st, idx) => {
        const stStats = studentStats.find(s => s.id === st.id);
        const totalDays = stStats ? stStats.totalMarkedDays : 0;
        const presentDays = stStats ? stStats.presentDays : 0;
        const absentDays = stStats ? stStats.absentDays : 0;
        const pct = stStats ? stStats.pct : 0;

        const dateStatuses = workingDates.map(dStr => {
          const hol = holidayMap.get(dStr);
          const cfg = dailyConfigMap.get(dStr);
          const isHoliday = !!hol || cfg?.day_type === "holiday";
          const notes = cfg?.notes || hol?.notes || "";

          if (isHoliday) {
            return "H";
          }

          const dayName = dayNameMap[dStr];
          const daySlotsForDate = slotMap.get(`${dayName}__${(st.classGroup || "").toLowerCase().trim()}`) || [];
          const dayMarks = attendanceMap.get(`${st.id}_${dStr}`) || [];
          if (daySlotsForDate.length === 0 && dayMarks.length === 0) return "—";
          const isEvent = cfg?.day_type === "event" || (dayMarks || []).some(a => (a as any).attendanceTypeSub === "Event");
          const isExam = !isEvent && (cfg?.day_type === "exam_day" || cfg?.day_type === "exam");
          const evalRes = evaluateDailyStudentAttendance(dayMarks, daySlotsForDate.length, isExam, false, notes);
          return evalRes.status;
        });

        return [
          idx + 1,
          st.roll_number || st.id,
          st.name,
          st.department || "General",
          st.classGroup || "General Batch",
          totalDays,
          presentDays,
          absentDays,
          `${pct}%`,
          ...dateStatuses
        ];
      });

      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Attendance Register");
      XLSX.writeFile(wb, `Attendance_Register_${attendanceStartDate}_to_${attendanceEndDate}.xlsx`);
      toast("Attendance register exported to Excel!", "success");
    } catch (err: any) {
      toast("Export failed: " + err.message, "error");
    }
  };

  // Export Weekly Timetable Schedule to Excel
  const handleExportTimetable = async () => {
    try {
      const XLSX = await import("xlsx");
      const headers = ["Day", "Time Slot", "Course Name", "Batch / Class Group", "Faculty / Mentor", "Room", "Institution"];
      const rows = activeCollegeSlots.map(s => {
        const mentor = mentors.find(m => m.id === s.mentorId);
        const col = colleges.find(c => c.id === s.college_id);
        return [
          s.day,
          s.time,
          s.course,
          s.classGroup || "General Batch",
          mentor?.name || s.mentorId,
          s.location || "Default",
          col?.name || "Campus"
        ];
      });
      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Weekly Timetable");
      XLSX.writeFile(wb, `Weekly_Timetable_${selectedCollegeId === "all" ? "All_Campuses" : activeCollegeObj?.name?.replace(/[^a-zA-Z0-9]/g, "_")}.xlsx`);
      toast("Timetable exported to Excel!", "success");
    } catch (err: any) {
      toast("Export failed: " + err.message, "error");
    }
  };

  // Export Faculty Workload & Allocation Ledger to Excel
  const handleExportFacultyWorkload = async () => {
    try {
      const XLSX = await import("xlsx");
      const headers = ["Sl. No.", "Faculty Name", "Email", "Department", "Classification", "Campus", "Weekly Assigned Hours", "Capacity Target", "Load %", "Status"];
      const rows = activeCollegeMentors.map((m, idx) => {
        const mSlots = slots.filter(s => s.mentorId === m.id);
        const totalWeeklyHours = mSlots.length;
        const capacityPct = Math.round((totalWeeklyHours / 20) * 100);
        const status = totalWeeklyHours > 22 ? "Overload" : totalWeeklyHours >= 14 ? "Optimal" : "Underload";
        const col = colleges.find(c => c.id === m.college_id);
        return [
          idx + 1,
          m.name,
          m.email,
          m.department || "General",
          m.mentor_group || "General Faculty",
          col?.name || "Institution",
          totalWeeklyHours,
          20,
          `${capacityPct}%`,
          status
        ];
      });
      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Faculty Workload");
      XLSX.writeFile(wb, `Faculty_Workload_Ledger_${new Date().toISOString().slice(0, 10)}.xlsx`);
      toast("Faculty workload ledger exported to Excel!", "success");
    } catch (err: any) {
      toast("Export failed: " + err.message, "error");
    }
  };

  return (
    <div className="flex-1 flex flex-col md:flex-row bg-warm-canvas text-slate-800 font-sans h-full overflow-hidden">
      {/* ── 1. Floating Left Sidebar (Exact CAM Visual Pattern) ── */}
      <aside className={`hidden md:flex shrink-0 flex-col justify-between sticky top-6 z-30 floating-sidebar transition-all duration-300 ${isCollapsed ? "w-20 p-2.5" : "w-[270px] p-3.5"}`}>
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Header Brand */}
          <div className="px-2 py-2 mb-2 flex items-center gap-2.5 border-b border-slate-100 dark:border-slate-800">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-[#D528A2] to-pink-500 flex items-center justify-center text-white font-black shadow-md shadow-[#D528A2]/25 shrink-0">
              <Building2 className="h-5 w-5" />
            </div>
            {!isCollapsed && (
              <div className="min-w-0">
                <h2 className="text-xs font-black text-slate-900 tracking-tight truncate">KAM Executive Portal</h2>
                <p className="text-[10px] font-bold text-slate-400 truncate">Supervising {colleges.length} Campuses</p>
              </div>
            )}
          </div>

          {/* Navigation Groups */}
          <nav className={`py-1 space-y-1.5 overflow-y-auto max-h-[calc(100vh-12rem)] custom-scrollbar ${isCollapsed ? "px-0.5" : "px-1.5"}`}>
            {[
              {
                id: "dashboard",
                title: "Executive Overview",
                icon: Building2,
                items: [
                  { id: "overview", label: "Executive Command Center", icon: Building2 }
                ]
              },
              {
                id: "academic",
                title: "Academic & Curriculum",
                icon: BookOpen,
                items: [
                  { id: "academic_delivery", label: "Syllabus Delivery SLA", icon: BookOpen },
                  { id: "practical_skills", label: "Practical Lab & Skills", icon: FileSpreadsheet },
                  { id: "academic_exams", label: "Assessment & CIA Exams", icon: Award }
                ]
              },
              {
                id: "students",
                title: "Students & 360°",
                icon: GraduationCap,
                items: [
                  { id: "monitoring", label: "Attendance & OD Register", icon: Clock },
                  { id: "academic_risk", label: "Academic Risk Matrix", icon: AlertTriangle },
                  { id: "students_list", label: "Student Directory & 360°", icon: Users }
                ]
              },
              {
                id: "faculty",
                title: "Faculty Governance",
                icon: Users,
                items: [
                  { id: "faculty_attendance", label: "Daily Punch & Leaves", icon: User },
                  { id: "demo_quality", label: "SME Demo Teaching Quality", icon: Award }
                ]
              },
              {
                id: "operations",
                title: "Institutions & Operations",
                icon: Building2,
                items: [
                  { id: "campuses", label: "Supervised Campuses & CAMs", icon: Building2 },
                  { id: "fee_analytics", label: "Portfolio Fee Recovery", icon: IndianRupee },
                  { id: "feedback_issues", label: "Issue SLAs & Grievances", icon: Layers }
                ]
              },
              {
                id: "placement",
                title: "Placement & Events",
                icon: Sparkles,
                items: [
                  { id: "interviews", label: "Mock Interviews & Evaluators", icon: Award },
                  { id: "events_calendar", label: "Regional Events Calendar", icon: Calendar }
                ]
              }
            ].map(group => {
              const Icon = group.icon;
              const isSingleItem = group.items.length === 1;
              const isAnyChildActive = group.items.some(item => activeTab === item.id);
              const isExpanded = expandedGroups[group.id];

              return (
                <div key={group.id} className="relative py-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      if (isSingleItem) {
                        setActiveTab(group.items[0].id);
                      } else {
                        setExpandedGroups(prev => ({ ...prev, [group.id]: !prev[group.id] }));
                      }
                    }}
                    className={`sidebar-group-btn w-full flex items-center rounded-xl transition-all duration-200 cursor-pointer ${
                      isCollapsed ? "justify-center px-0 py-3" : "justify-between px-3 py-2.5 text-left"
                    } ${
                      isAnyChildActive
                        ? "bg-gradient-to-r from-[#D528A2] to-pink-600 text-white shadow-md shadow-[#D528A2]/25 font-black border-none"
                        : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/80 font-bold hover:translate-x-0.5"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Icon className={`h-4.5 w-4.5 shrink-0 transition-colors ${
                        isAnyChildActive ? "text-white" : "text-slate-400"
                      }`} />
                      {!isCollapsed && <span className="text-xs font-extrabold tracking-tight leading-tight">{group.title}</span>}
                    </div>
                    {!isCollapsed && !isSingleItem && (
                      <ChevronRight className={`h-3.5 w-3.5 transition-transform duration-200 ${
                        isExpanded ? "rotate-90" : ""
                      } ${isAnyChildActive ? "text-white" : "text-slate-400"}`} />
                    )}
                  </button>

                  {/* Submenu Accordion */}
                  {!isCollapsed && !isSingleItem && isExpanded && (
                    <div className="pl-4 pt-1.5 pb-1 space-y-1 animate-fadeIn">
                      {group.items.map(child => {
                        const ChildIcon = child.icon;
                        const isChildActive = activeTab === child.id;
                        return (
                          <button
                            key={child.id}
                            type="button"
                            onClick={() => setActiveTab(child.id)}
                            className={`w-full flex items-center justify-start gap-2.5 px-3 py-2 text-left rounded-xl text-[11px] font-bold tracking-tight transition-all duration-150 cursor-pointer ${
                              isChildActive
                                ? "bg-[#D528A2]/10 text-[#D528A2] border-l-2 border-[#D528A2] font-black"
                                : "text-slate-600 hover:text-[#D528A2] hover:bg-[#D528A2]/5"
                            }`}
                          >
                            <ChildIcon className={`h-3.5 w-3.5 shrink-0 ${isChildActive ? "text-[#D528A2]" : "text-slate-400"}`} />
                            <span className="flex-1 text-xs font-semibold leading-snug">{child.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Collapse Button */}
        <div className="border-t border-slate-200/80 pt-2 shrink-0 flex justify-center">
          <button
            type="button"
            onClick={() => {
              const next = !isCollapsed;
              setIsCollapsed(next);
              if (typeof window !== "undefined") localStorage.setItem("fp_kam_sidebar_collapsed", String(next));
            }}
            className="h-8 w-8 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-600 hover:text-slate-900 hover:bg-slate-100 shadow-xs transition-all cursor-pointer"
          >
            {isCollapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
          </button>
        </div>
      </aside>

      {/* ── 2. Main Workspace Canvas ── */}
      <main className="flex-1 flex flex-col overflow-x-hidden overflow-y-auto h-full pb-20 md:pb-12 scroll-touch">
        <div className="p-6 space-y-6 flex-1 max-w-7xl w-full mx-auto">
          {/* ── TAB 1: EXECUTIVE OVERVIEW / PULSE ── */}
          {activeTab === "overview" && (
            <div className="space-y-6">
              {/* Overview Header with Embedded College Filter */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                <div>
                  <h1 className="text-base font-black text-slate-900">Executive Portfolio Pulse</h1>
                  <p className="text-xs text-slate-400 font-semibold mt-0.5">
                    High-level attendance health, risk distribution, and institutional metrics
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {/* Embedded College Selector Dropdown */}
                  <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
                    <Building2 className="h-3.5 w-3.5 text-[#D528A2]" />
                    <select
                      value={selectedCollegeId}
                      onChange={e => setSelectedCollegeId(e.target.value)}
                      className="text-xs font-bold text-slate-800 bg-transparent outline-none cursor-pointer"
                    >
                      <option value="all">🏢 All Campuses ({colleges.length})</option>
                      {colleges.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <button
                    type="button"
                    onClick={() => refreshData(false)}
                    disabled={isDataLoading}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${isDataLoading ? "animate-spin text-[#D528A2]" : ""}`} />
                    <span>Sync</span>
                  </button>
                </div>
              </div>
              {/* 4-Card Operational Metrics Row — all from real data */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 sm:gap-5 pt-1">
                {[
                  { label: selectedCollegeId === "all" ? "Assigned Campuses" : "Campus Scope", value: selectedCollegeId === "all" ? colleges.length : ((activeCollegeObj as any)?.code || activeCollegeObj?.name || "1"), icon: Building2, bg: "bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-yellow-500/10 border-amber-200/60", iconColor: "text-amber-600" },
                  { label: "Total Faculty", value: activeCollegeMentors.length, icon: Users, bg: "bg-gradient-to-br from-blue-500/10 via-indigo-500/5 to-sky-500/10 border-blue-200/60", iconColor: "text-blue-600" },
                  { label: "Total Students", value: activeCollegeStudents.length, icon: GraduationCap, bg: "bg-gradient-to-br from-purple-500/10 via-pink-500/5 to-fuchsia-500/10 border-purple-200/60", iconColor: "text-purple-600" },
                  { label: "Avg. Student Attendance", value: calculatedAttendancePct, icon: CheckCircle2, bg: "bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-green-500/10 border-emerald-200/60", iconColor: "text-emerald-600", success: true }
                ].map((card, idx) => (
                  <Card
                    key={idx}
                    label={card.label}
                    value={card.value}
                    icon={<card.icon className={`h-4 w-4 sm:h-5 sm:w-5 ${card.iconColor}`} />}
                    success={card.success}
                    className={`${card.bg} relative group`}
                  />
                ))}
              </div>

              {/* 30-Day Moving Average Attendance Area Trend Chart + Risk Breakdown Row */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                <div className="lg:col-span-2 bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider">Attendance Trajectory & 30-Day Moving Avg</h3>
                      <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Historical conduction rates across all enrolled student batches</p>
                    </div>
                    <span className="text-xs font-black text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-100">
                      Portfolio Avg: {calculatedAttendancePct}
                    </span>
                  </div>

                  <div className="h-52 w-full">
                    {trendData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                          <defs>
                            <linearGradient id="colorAtt" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#D528A2" stopOpacity={0.4}/>
                              <stop offset="95%" stopColor="#D528A2" stopOpacity={0.0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis dataKey="date" tick={{ fontSize: 9 }} tickLine={false} />
                          <YAxis domain={[0, 100]} tick={{ fontSize: 9 }} tickLine={false} tickFormatter={v => `${v}%`} />
                          <Tooltip formatter={(v: any) => [`${v}%`, "Attendance Rate"]} />
                          <Area type="monotone" dataKey="attendancePct" stroke="#D528A2" strokeWidth={2.5} fillOpacity={1} fill="url(#colorAtt)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-full flex items-center justify-center text-xs text-slate-400 font-bold">
                        Collecting attendance time-series logs…
                      </div>
                    )}
                  </div>
                </div>

                {/* Risk Stratification Donut */}
                <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex flex-col justify-between">
                  <div>
                    <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider">Student Risk Stratification</h3>
                    <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Attendance compliance breakdown</p>
                  </div>

                  <div className="py-2">
                    <PieChart width={220} height={120} style={{ margin: "0 auto" }}>
                      <Pie
                        data={attChartInfographics.donutData} cx="50%" cy="50%"
                        innerRadius={30} outerRadius={50} paddingAngle={3} dataKey="value" isAnimationActive={false}
                      >
                        {attChartInfographics.donutData.map((e, i) => <Cell key={i} fill={e.color} />)}
                      </Pie>
                      <Tooltip formatter={(v: any, n: any) => [`${v} students`, n]} />
                    </PieChart>
                  </div>

                  <div className="space-y-1.5 pt-2 border-t border-slate-100">
                    <div className="flex justify-between text-[10px] font-bold">
                      <span className="text-emerald-700">🟢 On Track (≥75%):</span>
                      <span className="font-black text-slate-800">{attChartInfographics.onTrack} Students</span>
                    </div>
                    <div className="flex justify-between text-[10px] font-bold">
                      <span className="text-amber-700">🟡 At Risk (65–74%):</span>
                      <span className="font-black text-slate-800">{attChartInfographics.atRisk} Students</span>
                    </div>
                    <div className="flex justify-between text-[10px] font-bold">
                      <span className="text-rose-700">🔴 Critical (&lt;65%):</span>
                      <span className="font-black text-slate-800">{attChartInfographics.critical} Students</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Campus Summary Table (compact, no duplicate cards) */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-black text-slate-900 tracking-tight">Supervised Institutions</h3>
                    <p className="text-xs font-semibold text-slate-400">Click a campus to drill down into attendance monitoring</p>
                  </div>
                </div>
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="text-left px-4 py-2.5 font-black text-slate-600 uppercase text-[10px] tracking-wider">Institution</th>
                        <th className="text-center px-3 py-2.5 font-black text-slate-600 uppercase text-[10px] tracking-wider">Students</th>
                        <th className="text-center px-3 py-2.5 font-black text-slate-600 uppercase text-[10px] tracking-wider">Faculty</th>
                        <th className="text-center px-3 py-2.5 font-black text-slate-600 uppercase text-[10px] tracking-wider">Attendance</th>
                        <th className="text-center px-3 py-2.5 font-black text-slate-600 uppercase text-[10px] tracking-wider">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {colleges.map(c => {
                        const cStudents = students.filter(s => s.college_id === c.id);
                        const cMentors = mentors.filter(m => m.college_id === c.id);
                        const cStudentIds = new Set(cStudents.map(s => s.id));
                        const cAttendance = studentAttendance.filter(a => cStudentIds.has(a.studentId));
                        const cPresent = cAttendance.filter(a => a.status === "present" || a.status === "P").length;
                        const cAttPct = cAttendance.length > 0 ? Math.round((cPresent / cAttendance.length) * 100) : null;
                        const attColor = cAttPct === null ? "text-slate-400" : cAttPct >= 75 ? "text-emerald-700 font-black" : cAttPct >= 65 ? "text-amber-700 font-black" : "text-rose-700 font-black";

                        return (
                          <tr key={c.id} className="hover:bg-slate-50/70 transition-colors">
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2.5">
                                <div className="h-7 w-7 rounded-lg bg-[#D528A2]/10 text-[#D528A2] flex items-center justify-center">
                                  <Building2 className="h-3.5 w-3.5" />
                                </div>
                                <div>
                                  <p className="font-black text-slate-900 text-[11px]">{c.name}</p>
                                  <p className="text-[9px] font-bold text-slate-400">{c.id}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-3 py-3 text-center font-black text-slate-700">{cStudents.length || "—"}</td>
                            <td className="px-3 py-3 text-center font-black text-slate-700">{cMentors.length || "—"}</td>
                            <td className={`px-3 py-3 text-center ${attColor}`}>{cAttPct !== null ? `${cAttPct}%` : "—"}</td>
                            <td className="px-3 py-3 text-center">
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedCollegeId(c.id);
                                  setActiveTab("monitoring");
                                }}
                                className="text-[10px] font-black text-[#D528A2] hover:underline flex items-center gap-1 mx-auto"
                              >
                                Attendance <ArrowUpRight className="h-3 w-3" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ── TAB 2: ATTENDANCE MONITORING MATRIX (with Live Infographics) ── */}
          {activeTab === "monitoring" && (
            <div className="space-y-4 font-sans">
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                {/* Header & Title */}
                <div className="border-b border-slate-150 pb-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                  <div>
                    <h2 className="text-base font-black text-slate-800">Master Student Attendance Directory</h2>
                    <p className="text-xs text-slate-400 font-semibold mt-0.5">
                      Date-wise horizontal attendance matrix with strict roll-number matching and period-level compliance tracking.
                    </p>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={handleExportAttendanceRegister}
                      disabled={filteredStudents.length === 0}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-extrabold transition-all cursor-pointer shadow-2xs disabled:opacity-50"
                    >
                      <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
                      <span>Export Register (.xlsx)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveTab("students_list")}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-extrabold transition-all cursor-pointer"
                    >
                      <Users className="h-3.5 w-3.5" />
                      <span>Student 360° Roster</span>
                    </button>
                  </div>
                </div>

                {/* ── ATTENDANCE INFOGRAPHICS ROW ── */}
                {studentStats.length > 0 && (
                  <AttMonitoringCharts
                    donutData={attChartInfographics.donutData}
                    cgChartData={attChartInfographics.cgChartData}
                    onTrack={attChartInfographics.onTrack}
                    atRisk={attChartInfographics.atRisk}
                    critical={attChartInfographics.critical}
                    noData={attChartInfographics.noData}
                    overallAvgPct={attChartInfographics.overallAvgPct}
                    filteredCount={filteredStudents.length}
                    workingDatesCount={workingDates.length}
                  />
                )}

                {/* Filter Toolbar */}
                <div className="flex flex-col lg:flex-row lg:items-center gap-3 flex-wrap">
                  {/* From & To Date Pickers */}
                  <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">From:</span>
                    <input
                      type="date"
                      value={attendanceStartDate}
                      onChange={e => e.target.value && setAttendanceStartDate(e.target.value)}
                      className="text-xs font-bold text-slate-800 outline-none cursor-pointer bg-transparent"
                    />
                  </div>

                  <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">To:</span>
                    <input
                      type="date"
                      value={attendanceEndDate}
                      onChange={e => e.target.value && setAttendanceEndDate(e.target.value)}
                      className="text-xs font-bold text-slate-800 outline-none cursor-pointer bg-transparent"
                    />
                  </div>

                  <span className="text-[11px] font-extrabold text-[#D528A2] bg-[#D528A2]/10 px-2.5 py-1.5 rounded-lg border border-[#D528A2]/20 whitespace-nowrap">
                    {workingDates.length} date columns
                  </span>

                  {/* Presets */}
                  <div className="flex items-center gap-1 flex-wrap text-[11px] font-bold">
                    {[
                      { key: "all", label: "All", start: "2026-06-15" },
                      { key: "this_month", label: "This Month", start: "2026-08-01" },
                      { key: "past_30", label: "30D", start: "2026-07-20" },
                      { key: "past_7", label: "7D", start: "2026-08-13" },
                      { key: "jun", label: "Jun", start: "2026-06-15", end: "2026-06-30" },
                      { key: "jul", label: "Jul", start: "2026-07-01", end: "2026-07-31" },
                      { key: "aug", label: "Aug", start: "2026-08-01", end: "2026-08-31" }
                    ].map(p => (
                      <button
                        key={p.key}
                        type="button"
                        onClick={() => {
                          setAttendanceStartDate(p.start);
                          if (p.end) setAttendanceEndDate(p.end);
                          else setAttendanceEndDate(todayStr);
                        }}
                        className="px-2 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-slate-600 transition-all cursor-pointer text-[10px]"
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>

                  {/* Embedded College Filter */}
                  <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
                    <Building2 className="h-3.5 w-3.5 text-[#D528A2]" />
                    <select
                      value={selectedCollegeId}
                      onChange={e => setSelectedCollegeId(e.target.value)}
                      className="text-xs font-bold text-slate-800 bg-transparent outline-none cursor-pointer"
                    >
                      <option value="all">🏢 All Campuses ({colleges.length})</option>
                      {colleges.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="hidden lg:block w-px h-6 bg-slate-200" />

                  {/* Search */}
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search name, roll no..."
                      value={studentSearch}
                      onChange={e => setStudentSearch(e.target.value)}
                      className="pl-8 pr-3 py-1.5 border border-slate-200 bg-slate-50 text-xs rounded-xl focus:outline-none focus:ring-1 focus:ring-[#D528A2] font-semibold w-44"
                    />
                  </div>

                  {/* Department Filter */}
                  <select
                    value={selectedDept}
                    onChange={e => setSelectedDept(e.target.value)}
                    className="px-2.5 py-1.5 border border-slate-200 bg-slate-50 text-xs rounded-xl focus:outline-none focus:ring-1 focus:ring-[#D528A2] font-semibold text-slate-700"
                  >
                    <option value="all">All Departments ({departments.length})</option>
                    {departments.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>

                  {/* Cohort Filter */}
                  <select
                    value={selectedCohort}
                    onChange={e => setSelectedCohort(e.target.value)}
                    className="px-2.5 py-1.5 border border-slate-200 bg-slate-50 text-xs rounded-xl focus:outline-none focus:ring-1 focus:ring-[#D528A2] font-semibold text-slate-700"
                  >
                    <option value="all">All Cohorts ({cohorts.length})</option>
                    {cohorts.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                {/* Master Multi-Date Attendance Register Table */}
                <div className="border border-slate-200 rounded-xl overflow-x-auto shadow-2xs max-h-[600px] overflow-y-auto">
                  <table className="w-full text-left border-collapse text-[11px] whitespace-nowrap">
                    <thead className="sticky top-0 z-20 bg-slate-100 text-slate-700 font-extrabold uppercase text-[9px] tracking-wider border-b border-slate-300">
                      <tr>
                        <th className="p-2.5 border-r border-slate-200 text-center w-12 sticky left-0 z-30 bg-slate-100">Sl. No.</th>
                        <th className="p-2.5 border-r border-slate-200 min-w-[100px] sticky left-12 z-30 bg-slate-100">Roll No</th>
                        <th className="p-2.5 border-r border-slate-200 min-w-[170px] sticky left-[112px] z-30 bg-slate-100">Student Name</th>
                        <th className="p-2.5 border-r border-slate-200 min-w-[130px]">Department</th>
                        <th className="p-2.5 border-r border-slate-200 text-center min-w-[70px]">Total days</th>
                        <th className="p-2.5 border-r border-slate-200 text-center min-w-[85px] text-emerald-700">Total Present</th>
                        <th className="p-2.5 border-r border-slate-200 text-center min-w-[85px] text-rose-700">Total Absent</th>
                        <th className="p-2.5 border-r border-slate-200 text-center min-w-[65px] text-indigo-700">%</th>
                        
                        {/* Working Date Column Headers */}
                        {workingDates.map(dStr => {
                          const cfg = dailyConfigMap.get(dStr);
                          const holidayObj = holidayMap.get(dStr);
                          const isHoliday = !!holidayObj || cfg?.day_type === "holiday";
                          const isEvent = !isHoliday && (cfg?.day_type === "event");
                          const isExam = !isHoliday && !isEvent && (cfg?.day_type === "exam_day" || cfg?.day_type === "exam");
                          const dayOrder = (cfg?.day_order && cfg.day_order !== "None" && !isHoliday) ? cfg.day_order : null;
                          const notes = cfg?.notes || holidayObj?.notes || holidayObj?.name || "";

                          const calendarDay = new Date(dStr + "T00:00:00").toLocaleDateString("en-US", { weekday: "short" });
                          const fullCalendarDay = new Date(dStr + "T00:00:00").toLocaleDateString("en-US", { weekday: "long" });
                          const isToday = dStr === todayStr;

                          const tooltipText = `${formatDisplayDob(dStr) || dStr} (${fullCalendarDay})${dayOrder ? ` • Order: ${dayOrder}` : ""}${isHoliday ? ` • Holiday: ${notes || "College Holiday"}` : isEvent ? ` • Event: ${notes || "Campus Event"}` : isExam ? ` • Exam Day: ${notes || "Assessment"}` : " • Regular Working Day"}${cfg?.session_mode ? ` • Mode: ${cfg.session_mode}` : ""}${notes && !isHoliday ? `\nRemarks: ${notes}` : ""}`;

                          return (
                            <th
                              key={dStr}
                              className={`p-2 border-r border-slate-200 text-center min-w-[85px] transition-colors ${
                                isToday ? "bg-indigo-50/90 border-b-2 border-b-indigo-600" : isHoliday ? "bg-rose-50/40" : isExam ? "bg-purple-50/60" : isEvent ? "bg-amber-50/40" : ""
                              }`}
                              title={tooltipText}
                            >
                              {isToday && (
                                <span className="inline-block px-1.5 py-0.2 rounded-full bg-indigo-600 text-white text-[7.5px] font-black uppercase mb-0.5">
                                  TODAY
                                </span>
                              )}
                              <div className={`font-extrabold text-[9.5px] ${isToday ? "text-indigo-900 font-black" : isHoliday ? "text-rose-900" : isExam ? "text-purple-900" : isEvent ? "text-amber-900" : "text-slate-700"}`}>
                                {formatDisplayDob(dStr) || dStr}
                              </div>
                              <div className="flex items-center justify-center gap-1 mt-0.5 flex-wrap">
                                <span className="text-[8px] text-slate-400 font-semibold">{calendarDay}</span>
                                {dayOrder && (
                                  <span className="text-[7.5px] font-black px-1.5 py-0.2 rounded bg-indigo-600 text-white uppercase tracking-tight shadow-2xs">
                                    {dayOrder}
                                  </span>
                                )}
                                <span className={`text-[7px] font-black px-1 py-0.2 rounded uppercase ${
                                  isHoliday ? "bg-rose-100 text-rose-800 border border-rose-200" : isEvent ? "bg-amber-100 text-amber-800 border border-amber-200" : isExam ? "bg-purple-100 text-purple-800 border border-purple-200" : "bg-slate-200/70 text-slate-600"
                                }`}>
                                  {isHoliday ? "Holiday" : isEvent ? "Event" : isExam ? "Exam" : "Working"}
                                </span>
                              </div>
                              {notes && (
                                <div className="text-[7.5px] font-bold text-slate-500 truncate max-w-[85px] mx-auto mt-0.5" title={notes}>
                                  {notes}
                                </div>
                              )}
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white text-slate-700 text-xs">
                      {filteredStudents.length === 0 ? (
                        <tr>
                          <td colSpan={8 + workingDates.length} className="p-8 text-center text-slate-400 font-bold">
                            No student records match the active filters.
                          </td>
                        </tr>
                      ) : (
                        paginatedStudents.map((st, idx) => {
                          const stStats = studentStats.find(s => s.id === st.id);
                          const totalDays = stStats ? stStats.totalMarkedDays : 0;
                          const presentDays = stStats ? stStats.presentDays : 0;
                          const absentDays = stStats ? stStats.absentDays : 0;
                          const pct = stStats ? stStats.pct : 0;
                          const rowSerial = attendancePageSize > 0 ? ((attendancePage - 1) * attendancePageSize) + idx + 1 : idx + 1;

                          return (
                            <tr
                              key={st.id}
                              onClick={() => setSelectedStudentFor360(st.id)}
                              className="hover:bg-indigo-50/30 transition-colors cursor-pointer"
                            >
                              <td className="p-2.5 text-center font-bold text-slate-400 border-r border-slate-100 sticky left-0 z-10 bg-white">
                                {rowSerial}
                              </td>
                              <td className="p-2.5 font-mono text-[11px] font-semibold text-slate-600 border-r border-slate-100 sticky left-12 z-10 bg-white">
                                {st.roll_number || st.id}
                              </td>
                              <td className="p-2.5 font-bold text-slate-900 border-r border-slate-100 sticky left-[112px] z-10 bg-white">
                                <span className="hover:text-[#D528A2] transition-colors">{st.name}</span>
                              </td>
                              <td className="p-2.5 text-slate-600 border-r border-slate-100">
                                {st.department || "General"}
                              </td>
                              <td className="p-2.5 text-center font-bold text-slate-700 border-r border-slate-100">
                                {totalDays}
                              </td>
                              <td className="p-2.5 text-center font-bold text-emerald-600 border-r border-slate-100">
                                {presentDays}
                              </td>
                              <td className="p-2.5 text-center font-bold text-rose-600 border-r border-slate-100">
                                {absentDays}
                              </td>
                              <td className="p-2.5 text-center font-black border-r border-slate-100">
                                <span className={`px-2 py-0.5 rounded-md text-[10px] font-black ${
                                  pct >= 75
                                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                    : pct >= 60
                                    ? "bg-amber-50 text-amber-700 border border-amber-200"
                                    : "bg-rose-50 text-rose-700 border border-rose-200"
                                }`}>
                                  {pct}%
                                </span>
                              </td>

                              {/* Date-wise Cells */}
                              {workingDates.map(dStr => {
                                const cfg = dailyConfigMap.get(dStr);
                                const holidayObj = holidayMap.get(dStr);
                                const isHoliday = !!holidayObj || cfg?.day_type === "holiday";
                                const notes = cfg?.notes || holidayObj?.notes || holidayObj?.name || "";

                                if (isHoliday) {
                                  return (
                                    <td key={dStr} className="p-1.5 text-center border-r border-slate-100 bg-rose-50/20">
                                      <span
                                        className="inline-block px-1.5 py-0.5 rounded text-[9.5px] font-black uppercase bg-rose-100 text-rose-800 border border-rose-200 shadow-2xs"
                                        title={`${st.name} | ${formatDisplayDob(dStr) || dStr}\n🎉 Holiday: ${notes || "College Holiday"}\n(No classes scheduled)`}
                                      >
                                        H
                                      </span>
                                    </td>
                                  );
                                }

                                const dayName = dayNameMap[dStr];
                                const daySlotsForCell = slotMap.get(`${dayName}__${(st.classGroup || "").toLowerCase().trim()}`) || [];
                                const dayMarks = attendanceMap.get(`${st.id}_${dStr}`) || [];

                                if (daySlotsForCell.length === 0 && dayMarks.length === 0) {
                                  return (
                                    <td key={dStr} className="p-1.5 text-center border-r border-slate-100 text-slate-300">
                                      <span className="text-[10px]">—</span>
                                    </td>
                                  );
                                }

                                const isEvent = cfg?.day_type === "event" || (dayMarks || []).some(a => (a as any).attendanceTypeSub === "Event");
                                const isExam = !isEvent && (cfg?.day_type === "exam_day" || cfg?.day_type === "exam");
                                const evalRes = evaluateDailyStudentAttendance(dayMarks, daySlotsForCell.length, isExam, false, notes);

                                let badgeColor = "bg-slate-50 text-slate-400 border-slate-200";
                                if (evalRes.status === "OD") badgeColor = "bg-purple-100 text-purple-800 border-purple-200";
                                else if (evalRes.status === "P") badgeColor = "bg-emerald-100 text-emerald-800 border-emerald-200";
                                else if (evalRes.status === "A") badgeColor = "bg-rose-100 text-rose-800 border-rose-200";

                                const dayOrderLabel = cfg?.day_order && cfg.day_order !== "None" ? ` [${cfg.day_order}]` : "";
                                const tooltipText = `${st.name} | ${formatDisplayDob(dStr) || dStr} (${dayName}${dayOrderLabel})${notes ? `\nNote: ${notes}` : ""}\n${evalRes.tooltipInfo}`;

                                return (
                                  <td key={dStr} className="p-1.5 text-center border-r border-slate-100">
                                    <span
                                      className={`inline-block px-1.5 py-0.5 rounded text-[9.5px] font-black uppercase border ${badgeColor}`}
                                      title={tooltipText}
                                    >
                                      {evalRes.status}
                                    </span>
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Controls */}
                {filteredStudents.length > 0 && (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-150 text-xs font-bold text-slate-500">
                    <div className="flex items-center gap-2">
                      <span>Showing {attendancePageSize > 0 ? Math.min(filteredStudents.length, (attendancePage - 1) * attendancePageSize + 1) : 1}–{attendancePageSize > 0 ? Math.min(filteredStudents.length, attendancePage * attendancePageSize) : filteredStudents.length} of {filteredStudents.length} students</span>
                      <select
                        value={attendancePageSize}
                        onChange={e => {
                          setAttendancePageSize(Number(e.target.value));
                          setAttendancePage(1);
                        }}
                        className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-slate-700 text-xs font-bold outline-none cursor-pointer"
                      >
                        <option value={25}>25 / page</option>
                        <option value={50}>50 / page</option>
                        <option value={100}>100 / page</option>
                        <option value={0}>All students</option>
                      </select>
                    </div>

                    {attendancePageSize > 0 && Math.ceil(filteredStudents.length / attendancePageSize) > 1 && (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          disabled={attendancePage <= 1}
                          onClick={() => setAttendancePage(p => Math.max(1, p - 1))}
                          className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 disabled:opacity-40 border border-slate-200 rounded-lg text-slate-700 transition-all cursor-pointer font-bold disabled:cursor-not-allowed"
                        >
                          Previous
                        </button>
                        <span className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg font-black text-slate-800">
                          {attendancePage} / {Math.ceil(filteredStudents.length / attendancePageSize)}
                        </span>
                        <button
                          type="button"
                          disabled={attendancePage >= Math.ceil(filteredStudents.length / attendancePageSize)}
                          onClick={() => setAttendancePage(p => p + 1)}
                          className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 disabled:opacity-40 border border-slate-200 rounded-lg text-slate-700 transition-all cursor-pointer font-bold disabled:cursor-not-allowed"
                        >
                          Next
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── TAB: STUDENT DIRECTORY & 360 ── */}
          {activeTab === "students_list" && (
            <StudentDirectory
              initialCollegeId={selectedCollegeId}
              kamId={currentKAM?.id ?? undefined}
              initialDepartment={selectedDept}
              initialClassGroup={selectedCohort}
            />
          )}









          {/* ── TAB: SUPERVISED INSTITUTIONS & CAM LEADERSHIP ── */}
          {activeTab === "campuses" && (
            <KAMCampusesDirectory
              selectedCollegeId={selectedCollegeId}
              onSelectCollege={setSelectedCollegeId}
              onNavigateTab={setActiveTab}
            />
          )}



          {/* ── TAB: ACADEMIC SYLLABUS DELIVERY TRACKER ── */}
          {activeTab === "academic_delivery" && (
            <KAMAcademicDelivery selectedCollegeId={selectedCollegeId} kamId={currentKAM?.id ?? undefined} />
          )}

          {/* ── TAB: PRACTICAL LAB & SKILLS PROGRESS ── */}
          {activeTab === "practical_skills" && (
            <KAMPracticalSkills selectedCollegeId={selectedCollegeId} kamId={currentKAM?.id ?? undefined} />
          )}

          {/* ── TAB: REGIONAL ASSESSMENT & CIA EXAMS OVERSIGHT ── */}
          {activeTab === "academic_exams" && (
            <KAMAssessmentsOversight selectedCollegeId={selectedCollegeId} kamId={currentKAM?.id ?? undefined} />
          )}

          {/* ── TAB: STUDENT ACADEMIC RISK MATRIX ── */}
          {activeTab === "academic_risk" && (
            <KAMStudentAcademicRisk
              selectedCollegeId={selectedCollegeId}
              kamId={currentKAM?.id ?? undefined}
              onOpenStudent360={(id) => setSelectedStudentFor360(id)}
            />
          )}

          {/* ── TAB: MOCK INTERVIEWS & REGIONAL EXPORT ── */}
          {activeTab === "interviews" && (
            <div className="space-y-4 font-sans">
              <InterviewModule
                currentUserRole="kam"
                currentUserName={currentKAM?.name || "Key Account Manager"}
                defaultCollegeId={selectedCollegeId !== "all" ? selectedCollegeId : undefined}
              />
            </div>
          )}

          {/* ── TAB: FACULTY DAILY PUNCH & ATTENDANCE ── */}
          {activeTab === "faculty_attendance" && (
            <KAMFacultyGovernance
              initialSubTab="punch"
              selectedCollegeId={selectedCollegeId}
              kamId={currentKAM?.id ?? undefined}
              onOpenMentor360={(id) => setSelectedMentorFor360(id)}
            />
          )}

          {/* ── TAB: SME DEMO TEACHING QUALITY ── */}
          {activeTab === "demo_quality" && (
            <KAMFacultyGovernance
              initialSubTab="demos"
              selectedCollegeId={selectedCollegeId}
              kamId={currentKAM?.id ?? undefined}
              onOpenMentor360={(id) => setSelectedMentorFor360(id)}
            />
          )}

          {/* ── TAB: PORTFOLIO FEE RECOVERY & AGING ── */}
          {activeTab === "fee_analytics" && (
            <KAMFinanceAndWelfare
              initialSubTab="fees"
              selectedCollegeId={selectedCollegeId}
              kamId={currentKAM?.id ?? undefined}
            />
          )}

          {/* ── TAB: STUDENT LEAVES & OD DISPENSATION ── */}
          {activeTab === "student_leaves" && (
            <KAMFinanceAndWelfare
              initialSubTab="leaves"
              selectedCollegeId={selectedCollegeId}
              kamId={currentKAM?.id ?? undefined}
            />
          )}

          {/* ── TAB: FEEDBACK & ISSUE RESOLUTION SLAS ── */}
          {activeTab === "feedback_issues" && (
            <KAMFinanceAndWelfare
              initialSubTab="issues"
              selectedCollegeId={selectedCollegeId}
              kamId={currentKAM?.id ?? undefined}
            />
          )}

          {/* ── TAB: REGIONAL ACADEMIC EVENTS CALENDAR ── */}
          {activeTab === "events_calendar" && (
            <KAMFinanceAndWelfare
              initialSubTab="events"
              selectedCollegeId={selectedCollegeId}
              kamId={currentKAM?.id ?? undefined}
            />
          )}



          {/* ── TAB 10: KAM PROFILE ── */}
          {activeTab === "profile" && (
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-6 max-w-xl">
              <div className="flex items-center gap-4">
                <div className="h-16 w-16 rounded-2xl bg-gradient-to-tr from-[#D528A2] to-pink-500 text-white flex items-center justify-center font-black text-xl shadow-md">
                  <User className="h-8 w-8" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">{currentKAM?.name || "Key Account Manager"}</h3>
                  <p className="text-xs text-slate-400 font-semibold">{currentKAM?.email || "kam@faceprep.in"}</p>
                  <span className="inline-block mt-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-[#D528A2]/10 text-[#D528A2]">
                    Key Account Manager
                  </span>
                </div>
              </div>

              <div className="border-t border-slate-100 pt-4 space-y-3 text-xs font-semibold">
                <div className="flex justify-between py-1.5 border-b border-slate-50">
                  <span className="text-slate-400">Assigned Campuses:</span>
                  <span className="font-bold text-slate-800">{colleges.length} Institutions</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-50">
                  <span className="text-slate-400">Total Supervised Students:</span>
                  <span className="font-bold text-slate-800">{students.length} Enrolled</span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-slate-400">Direct CAM Reports:</span>
                  <span className="font-bold text-indigo-600">Active</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Student 360 Modal */}
      {selectedStudentFor360 && (
        <Student360
          studentId={selectedStudentFor360}
          onClose={() => setSelectedStudentFor360(null)}
        />
      )}

      {/* Mentor 360 Modal */}
      {selectedMentorFor360 && (
        <Mentor360
          mentorId={selectedMentorFor360}
          onClose={() => setSelectedMentorFor360(null)}
        />
      )}
    </div>
  );
}

export default KAMDashboard;
