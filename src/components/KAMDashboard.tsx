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
import { Student360 } from "./kam/students/Student360";
import { Mentor360 } from "./kam/mentors/Mentor360";
import { StudentDirectory } from "./kam/students/StudentDirectory";
import { KAMAnalytics } from "./kam/analytics/KAMAnalytics";
import { InterviewModule } from "./InterviewModule";
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
    colleges,
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
    campuses: true,
    schedules: true,
    students: true,
    faculty: true,
    analytics: true
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

  // College-scoped datasets
  const activeCollegeStudents = useMemo(() => {
    if (selectedCollegeId === "all") return students;
    return students.filter(s => s.college_id === selectedCollegeId);
  }, [students, selectedCollegeId]);

  const activeCollegeMentors = useMemo(() => {
    if (selectedCollegeId === "all") return mentors;
    return mentors.filter(m => m.college_id === selectedCollegeId);
  }, [mentors, selectedCollegeId]);

  const activeCollegeSlots = useMemo(() => {
    if (selectedCollegeId === "all") return slots;
    return slots.filter(s => s.college_id === selectedCollegeId);
  }, [slots, selectedCollegeId]);

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
                title: "Portfolio Dashboard",
                icon: Building2,
                items: [
                  { id: "overview", label: "Executive Dashboard", icon: Building2 }
                ]
              },
              {
                id: "campuses",
                title: "Campuses & CAMs",
                icon: Building2,
                items: [
                  { id: "campuses", label: "Supervised Colleges", icon: Building2 },
                  { id: "cam_direct_reports", label: "CAM Direct Reports", icon: Users }
                ]
              },
              {
                id: "schedules",
                title: "Schedules & Monitoring",
                icon: Calendar,
                items: [
                  { id: "monitoring", label: "Attendance Monitoring", icon: Clock },
                  { id: "timetable", label: "Timetable Master", icon: Calendar }
                ]
              },
              {
                id: "students",
                title: "Students & 360",
                icon: GraduationCap,
                items: [
                  { id: "students_list", label: "Student Directory", icon: Users },
                  { id: "risk_students", label: "Risk Stratification", icon: AlertTriangle }
                ]
              },
              {
                id: "faculty",
                title: "Faculty Governance",
                icon: Users,
                items: [
                  { id: "faculty_workload", label: "Faculty Workload", icon: Users },
                  { id: "handovers", label: "Class Handovers", icon: CalendarCheck2 }
                ]
              },
              {
                id: "analytics",
                title: "Analytics & Insights",
                icon: BarChart3,
                items: [
                  { id: "analytics", label: "Campus Comparisons", icon: BarChart3 }
                ]
              },
              {
                id: "interviews",
                title: "Mock Interviews",
                icon: Award,
                items: [
                  { id: "interviews", label: "Regional Interviews & Export", icon: Award }
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
              {/* 5-Card Operational Metrics Row */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5 sm:gap-5 pt-1">
                {[
                  { label: selectedCollegeId === "all" ? "Assigned Campuses" : "Campus Scope", value: selectedCollegeId === "all" ? colleges.length : ((activeCollegeObj as any)?.code || activeCollegeObj?.name || "1"), icon: Building2, bg: "bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-yellow-500/10 border-amber-200/60", iconColor: "text-amber-600" },
                  { label: "Total Faculty", value: activeCollegeMentors.length, icon: Users, bg: "bg-gradient-to-br from-blue-500/10 via-indigo-500/5 to-sky-500/10 border-blue-200/60", iconColor: "text-blue-600" },
                  { label: "Total Students", value: activeCollegeStudents.length, icon: GraduationCap, bg: "bg-gradient-to-br from-purple-500/10 via-pink-500/5 to-fuchsia-500/10 border-purple-200/60", iconColor: "text-purple-600" },
                  { label: "Student Attendance Avg", value: calculatedAttendancePct, icon: CheckCircle2, bg: "bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-green-500/10 border-emerald-200/60", iconColor: "text-emerald-600", success: true },
                  { label: "Operational Health", value: "96%", icon: HeartPulse, bg: "bg-gradient-to-br from-rose-500/10 via-pink-500/5 to-red-500/10 border-rose-200/60", iconColor: "text-rose-600", success: true }
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

              {/* Supervised Institutions & Reporting CAMs */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-black text-slate-900 tracking-tight">Supervised Institutions & Reporting CAMs</h3>
                    <p className="text-xs font-semibold text-slate-400">Direct CAM reports, contact details, and institutional compliance health</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {colleges.map(c => {
                    const cStudents = students.filter(s => s.college_id === c.id);
                    const cMentors = mentors.filter(m => m.college_id === c.id);
                    const isSelected = selectedCollegeId === c.id;

                    return (
                      <div
                        key={c.id}
                        onClick={() => setSelectedCollegeId(isSelected ? "all" : c.id)}
                        className={`bg-white rounded-2xl p-5 border shadow-xs transition-all cursor-pointer hover:border-[#D528A2]/50 ${
                          isSelected ? "border-[#D528A2] ring-2 ring-[#D528A2]/10" : "border-slate-200"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-xl bg-[#D528A2]/10 text-[#D528A2] flex items-center justify-center font-black">
                              <Building2 className="h-5 w-5" />
                            </div>
                            <div>
                              <h4 className="text-xs font-black text-slate-900">{c.name}</h4>
                              <p className="text-[10px] font-bold text-slate-400">{(c as any).location || "Main Campus"} • {(c as any).code || c.id}</p>
                            </div>
                          </div>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                            96% Health
                          </span>
                        </div>

                        {/* Metrics Strip */}
                        <div className="grid grid-cols-3 gap-2 mt-4 py-3 border-y border-slate-100 text-center">
                          <div>
                            <span className="text-[10px] font-bold text-slate-400 uppercase">Students</span>
                            <p className="text-xs font-black text-slate-800">{cStudents.length || "—"}</p>
                          </div>
                          <div>
                            <span className="text-[10px] font-bold text-slate-400 uppercase">Faculty</span>
                            <p className="text-xs font-black text-slate-800">{cMentors.length || "—"}</p>
                          </div>
                          <div>
                            <span className="text-[10px] font-bold text-slate-400 uppercase">Working Days</span>
                            <p className="text-xs font-black text-slate-800">{c.working_days || 5} Days</p>
                          </div>
                        </div>

                        {/* Direct CAM Profile */}
                        <div className="mt-3 bg-slate-50/80 rounded-xl p-2.5 border border-slate-100 flex items-center justify-between text-xs">
                          <div>
                            <span className="text-[9px] font-black uppercase text-slate-400 block">Reporting CAM</span>
                            <span className="font-bold text-slate-800">{c.name.includes("SDNB") ? "Campus Academic Manager" : "Lead Operations Manager"}</span>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedCollegeId(c.id);
                              setActiveTab("monitoring");
                            }}
                            className="text-xs font-black text-[#D528A2] hover:underline flex items-center gap-1"
                          >
                            Open Attendance <ArrowUpRight className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
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

          {/* ── TAB 3: STUDENT DIRECTORY & 360 ── */}
          {activeTab === "students_list" && (
            <StudentDirectory
              initialCollegeId={selectedCollegeId}
              initialDepartment={selectedDept}
              initialClassGroup={selectedCohort}
            />
          )}

          {/* ── TAB 4: RISK STRATIFICATION ── */}
          {activeTab === "risk_students" && (
            <StudentDirectory
              initialCollegeId={selectedCollegeId}
              initialDepartment={selectedDept}
              initialClassGroup={selectedCohort}
              initialRiskFilter="at_risk"
            />
          )}

          {/* ── TAB 5: TIMETABLE MASTER (with Day Selector & Period Matrix) ── */}
          {activeTab === "timetable" && (
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                <div>
                  <h3 className="text-sm font-black text-slate-900">Weekly Timetable Schedule Master</h3>
                  <p className="text-xs font-medium text-slate-400">Class period allocations and room distributions for active campus scope</p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {/* Export Timetable */}
                  <button
                    type="button"
                    onClick={handleExportTimetable}
                    disabled={activeCollegeSlots.length === 0}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-extrabold transition-all cursor-pointer shadow-2xs disabled:opacity-50"
                  >
                    <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
                    <span>Export (.xlsx)</span>
                  </button>

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

                  {/* Day selector pills */}
                  <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-xl border border-slate-200 text-xs font-bold flex-wrap">
                  {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map(d => {
                    const isDaySelected = selectedTimetableDay.toLowerCase() === d.toLowerCase();
                    return (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setSelectedTimetableDay(d)}
                        className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                          isDaySelected
                            ? "bg-indigo-600 text-white shadow-xs"
                            : "text-slate-600 hover:bg-slate-200/60"
                        }`}
                      >
                        {d}
                      </button>
                    );
                  })}
                  </div>
                </div>
              </div>

              {/* Day's Slot Cards Grid */}
              <div className="space-y-3">
                <div className="flex justify-between items-center text-xs font-bold text-slate-500">
                  <span>Scheduled Slots on {selectedTimetableDay}: {daySlots.length} Sessions</span>
                  <span>Scope: {selectedCollegeId === "all" ? "All Campuses" : activeCollegeObj?.name}</span>
                </div>

                {daySlots.length === 0 ? (
                  <div className="p-12 text-center text-slate-400 font-bold bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                    No timetable periods scheduled on {selectedTimetableDay} for this scope.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {daySlots.map(s => {
                      const mentor = mentors.find(m => m.id === s.mentorId);
                      const col = colleges.find(c => c.id === s.college_id);

                      return (
                        <div key={s.id} className="bg-slate-50 hover:bg-white rounded-xl p-4 border border-slate-200 shadow-2xs hover:shadow-xs transition-all space-y-2.5">
                          <div className="flex justify-between items-start">
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase bg-indigo-50 text-indigo-700 border border-indigo-100">
                              {s.time}
                            </span>
                            <span className="text-[10px] font-bold text-slate-400">
                              Room: {s.location || "Default"}
                            </span>
                          </div>

                          <div>
                            <h4 className="text-xs font-black text-slate-900">{s.course}</h4>
                            <p className="text-[10px] text-slate-500 font-semibold">{s.classGroup || "General Batch"}</p>
                          </div>

                          <div
                            onClick={() => mentor && setSelectedMentorFor360(mentor.id)}
                            className="pt-2 border-t border-slate-200/80 flex items-center justify-between text-[11px] cursor-pointer hover:bg-slate-100/60 p-1 rounded-lg transition-colors"
                          >
                            <span className="font-bold text-slate-700 hover:text-[#D528A2] transition-colors">{mentor?.name || s.mentorId} 🔍</span>
                            <span className="text-[9px] font-black text-[#D528A2] uppercase">{col?.name?.includes("SDNB") ? "SDNB" : col?.name || "Campus"}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── TAB 6: FACULTY GOVERNANCE (with Capacity Workload Cards) ── */}
          {activeTab === "faculty_workload" && (
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-5">
              <div className="border-b border-slate-100 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-black text-slate-900">Faculty Staffing & Workload Distribution</h3>
                  <p className="text-xs font-medium text-slate-400">Weekly teaching allocations and lecture coverage per mentor (Click faculty to view 360° Profile)</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Export Faculty Workload */}
                  <button
                    type="button"
                    onClick={handleExportFacultyWorkload}
                    disabled={activeCollegeMentors.length === 0}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-extrabold transition-all cursor-pointer shadow-2xs disabled:opacity-50"
                  >
                    <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
                    <span>Export (.xlsx)</span>
                  </button>

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
                  <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1.5 rounded-xl">
                    {activeCollegeMentors.length} Faculty Members
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {activeCollegeMentors.map(m => {
                  const mSlots = slots.filter(s => s.mentorId === m.id);
                  const totalWeeklyHours = mSlots.length;
                  const capacityPct = Math.min(100, Math.round((totalWeeklyHours / 20) * 100));

                  return (
                    <div
                      key={m.id}
                      onClick={() => setSelectedMentorFor360(m.id)}
                      className="bg-slate-50 hover:bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs hover:shadow-xs space-y-3 cursor-pointer transition-all hover:border-pink-300"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="text-xs font-black text-slate-900 group-hover:text-[#D528A2]">{m.name}</h4>
                          <p className="text-[10px] text-slate-400 font-medium">{m.subject_group || (m as any).subject || "Faculty"}</p>
                        </div>
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-indigo-50 text-indigo-700 border border-indigo-100 flex items-center gap-1">
                          <span>View 360°</span>
                          <ChevronRight className="h-3 w-3" />
                        </span>
                      </div>

                      {/* Workload Progress Bar */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-[10px] font-bold">
                          <span className="text-slate-500">Weekly Load:</span>
                          <span className="text-[#D528A2] font-black">{totalWeeklyHours} Hours / 20h Target</span>
                        </div>
                        <div className="w-full bg-slate-200 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full transition-all ${
                              capacityPct >= 90 ? "bg-emerald-500" : capacityPct >= 60 ? "bg-indigo-500" : "bg-amber-500"
                            }`}
                            style={{ width: `${capacityPct}%` }}
                          />
                        </div>
                      </div>

                      <div className="pt-2 border-t border-slate-200/80 flex justify-between text-[10px] font-bold text-slate-400">
                        <span>Classes: {m.classes || "General"}</span>
                        <span>{capacityPct}% Capacity</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── TAB 7: HANDOVERS & GOVERNANCE ── */}
          {activeTab === "handovers" && (
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-5">
              <div className="border-b border-slate-100 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-black text-slate-900">Class Handover & Substitution Governance</h3>
                  <p className="text-xs font-medium text-slate-400">Faculty swap authorizations and class coverage audit logs</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
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
                  <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1.5 rounded-xl">
                    {handoverRequests.length} Handover Requests
                  </span>
                </div>
              </div>

              {handoverRequests.length === 0 ? (
                <div className="p-8 text-center text-slate-400 font-bold bg-slate-50 rounded-xl">
                  No active substitution or handover requests recorded.
                </div>
              ) : (
                <div className="space-y-2">
                  {handoverRequests.map(r => (
                    <div key={r.id} className="bg-slate-50 hover:bg-white p-3.5 rounded-xl border border-slate-200 flex items-center justify-between text-xs transition-all shadow-2xs">
                      <div>
                        <p className="font-black text-slate-900">{r.course}</p>
                        <p className="text-[10px] text-slate-400 font-semibold mt-0.5">{r.requestorName} → {r.targetStaffName} • {r.dateStr}</p>
                      </div>
                      <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                        {r.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── TAB 8: CROSS-CAMPUS ANALYTICS ── */}
          {activeTab === "analytics" && (
            <KAMAnalytics
              campuses={overviewData?.campuses || []}
              trendData={trendData}
            />
          )}

          {/* ── TAB 8B: MOCK INTERVIEWS & REGIONAL EXPORT ── */}
          {activeTab === "interviews" && (
            <div className="space-y-4 font-sans">
              <InterviewModule
                currentUserRole="kam"
                currentUserName={currentKAM?.name || "Key Account Manager"}
                defaultCollegeId={selectedCollegeId !== "all" ? selectedCollegeId : undefined}
              />
            </div>
          )}

          {/* ── TAB 1B: SUPERVISED CAMPUSES & CAM DIRECT REPORTS ── */}
          {(activeTab === "campuses" || activeTab === "cam_direct_reports") && (
            <div className="space-y-4 font-sans">
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                <div className="border-b border-slate-150 pb-3">
                  <h2 className="text-base font-black text-slate-800">Supervised Institutions & Reporting CAMs</h2>
                  <p className="text-xs text-slate-400 font-semibold mt-0.5">
                    Institutional health, operational SLAs, and direct CAM management contacts across your portfolio.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {colleges.map(c => {
                    const cStudents = students.filter(s => s.college_id === c.id);
                    const cMentors = mentors.filter(m => m.college_id === c.id);
                    const isSelected = selectedCollegeId === c.id;

                    return (
                      <div
                        key={c.id}
                        className={`bg-white rounded-2xl p-5 border shadow-xs transition-all ${
                          isSelected ? "border-[#D528A2] ring-2 ring-[#D528A2]/10" : "border-slate-200"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-xl bg-[#D528A2]/10 text-[#D528A2] flex items-center justify-center font-black">
                              <Building2 className="h-5 w-5" />
                            </div>
                            <div>
                              <h4 className="text-xs font-black text-slate-900">{c.name}</h4>
                              <p className="text-[10px] font-bold text-slate-400">{(c as any).location || "Main Campus"} • {(c as any).code || c.id}</p>
                            </div>
                          </div>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                            96% Health
                          </span>
                        </div>

                        <div className="grid grid-cols-3 gap-2 mt-4 py-3 border-y border-slate-100 text-center">
                          <div>
                            <span className="text-[10px] font-bold text-slate-400 uppercase">Students</span>
                            <p className="text-xs font-black text-slate-800">{cStudents.length || "—"}</p>
                          </div>
                          <div>
                            <span className="text-[10px] font-bold text-slate-400 uppercase">Faculty</span>
                            <p className="text-xs font-black text-slate-800">{cMentors.length || "—"}</p>
                          </div>
                          <div>
                            <span className="text-[10px] font-bold text-slate-400 uppercase">Working Days</span>
                            <p className="text-xs font-black text-slate-800">{c.working_days || 5} Days</p>
                          </div>
                        </div>

                        <div className="mt-3 space-y-2">
                          <div className="bg-slate-50/80 rounded-xl p-2.5 border border-slate-100 flex items-center justify-between text-xs">
                            <div>
                              <span className="text-[9px] font-black uppercase text-slate-400 block">Reporting CAM</span>
                              <span className="font-bold text-slate-800">{c.name.includes("SDNB") ? "Campus Academic Manager" : "Lead Operations Manager"}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedCollegeId(c.id);
                                  setActiveTab("monitoring");
                                }}
                                className="px-2 py-1 rounded-lg bg-indigo-50 text-indigo-700 font-bold hover:bg-indigo-100 transition-colors cursor-pointer"
                              >
                                Attendance
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedCollegeId(c.id);
                                  setActiveTab("timetable");
                                }}
                                className="px-2 py-1 rounded-lg bg-slate-100 text-slate-700 font-bold hover:bg-slate-200 transition-colors cursor-pointer"
                              >
                                Timetable
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ── TAB 9: ESCALATIONS & TASKS ── */}
          {(activeTab === "escalations" || activeTab === "tasks") && (
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
              <div className="border-b border-slate-150 pb-3">
                <h3 className="text-sm font-black text-slate-900">Campus Escalations & High-Priority Tasks</h3>
                <p className="text-xs text-slate-400 font-medium">Resolution tracking for escalated campus queries and SLA alerts</p>
              </div>
              <div className="space-y-3">
                <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/40 flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-bold text-slate-800">All Escalations Resolved</h4>
                    <p className="text-[11px] text-slate-500 mt-0.5 font-semibold leading-relaxed">
                      Zero critical open blockages reported across SDNB Vaishnav College or partner campuses.
                    </p>
                  </div>
                </div>
              </div>
            </div>
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
