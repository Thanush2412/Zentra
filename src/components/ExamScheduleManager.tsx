"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Award,
  Calendar,
  Clock,
  MapPin,
  Plus,
  Trash2,
  Edit2,
  Download,
  Search,
  BookOpen,
  FileSpreadsheet,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  X,
  Layers,
  Sparkles,
  Printer,
  CalendarRange,
  RefreshCw
} from "lucide-react";
import { useApp } from "@/context/AppContext";
import { useToast } from "@/context/ToastContext";

interface ExamSchedule {
  id: string;
  college_id: string;
  department: string;
  semester: string;
  exam_type: string;
  subject_name: string;
  subject_code?: string;
  exam_date: string;
  session_time: string;
  start_time: string;
  end_time: string;
  day_order?: string;
  hall_room: string;
  max_marks?: number;
  passing_marks?: number;
  created_by?: string;
  status: "Scheduled" | "Ongoing" | "Completed" | "Cancelled";
  created_at?: string;
}

interface SubjectFormRow {
  subject_name: string;
  subject_code?: string;
  included: boolean;
  exam_date: string;
  day_order: string;
  session_type: "FN" | "AN" | "custom";
  start_time: string;
  end_time: string;
  hall_room: string;
}

const PRESET_EXAM_SUGGESTIONS = [
  "CIA 1",
  "CIA 2",
  "CIA 3",
  "Model Exam",
  "Unit Test 1",
  "Unit Test 2",
  "Mid-Term Assessment",
  "Practical Lab Exam",
  "End Semester Final"
];

export const ExamScheduleManager: React.FC = () => {
  const { currentCAM, departmentsList, coursesList, subjectsList } = useApp();
  const { toast, confirm: showConfirm } = useToast();

  const [exams, setExams] = useState<ExamSchedule[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedDeptFilter, setSelectedDeptFilter] = useState("all");
  const [selectedSemFilter, setSelectedSemFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Sub-Tab Switcher: Timetable Schedule vs Performance & Marks Registry
  const [activeMainTab, setActiveMainTab] = useState<"schedules" | "marks_registry">("schedules");
  const [campusMarksList, setCampusMarksList] = useState<any[]>([]);
  const [loadingCampusMarks, setLoadingCampusMarks] = useState<boolean>(false);
  const [marksExamTypeFilter, setMarksExamTypeFilter] = useState<string>("all");
  const [marksDeptFilter, setMarksDeptFilter] = useState<string>("all");
  const [marksStatusFilter, setMarksStatusFilter] = useState<"all" | "passed" | "arrears" | "absent">("all");
  const [marksSearchQuery, setMarksSearchQuery] = useState<string>("");

  // Accordion open/close state for dashboard groups
  const [openAccordions, setOpenAccordions] = useState<Record<string, boolean>>({});

  // Modal: Batch Timetable Creator Popup
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [batchExamName, setBatchExamName] = useState("CIA 1");
  const [batchDept, setBatchDept] = useState("");
  const [batchSem, setBatchSem] = useState("Semester 1");
  const [batchStartDate, setBatchStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [batchDefaultHall, setBatchDefaultHall] = useState("Main Examination Hall");
  const [batchSessionTiming, setBatchSessionTiming] = useState<"FN" | "AN" | "custom">("FN");
  const [batchDefaultDayOrder, setBatchDefaultDayOrder] = useState("Day 1");
  const [batchCustomStartTime, setBatchCustomStartTime] = useState("10:00 AM");
  const [batchCustomEndTime, setBatchCustomEndTime] = useState("01:00 PM");

  // Subject rows inside modal accordion
  const [subjectRows, setSubjectRows] = useState<SubjectFormRow[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const collegeId = currentCAM?.college_id || "Clg_c";

  // Derive department options strictly from database
  const availableDepartments = useMemo(() => {
    const fromDepts = (departmentsList || [])
      .filter((d: any) => !d.college_id || d.college_id === collegeId)
      .map((d: any) => d.name.trim());
    const fromCourses = (coursesList || [])
      .filter((c: any) => !c.college_id || c.college_id === collegeId)
      .map((c: any) => c.name.trim());
    return Array.from(new Set([...fromDepts, ...fromCourses])).filter(Boolean).sort();
  }, [departmentsList, coursesList, collegeId]);

  // Set default selected department on load
  useEffect(() => {
    if (availableDepartments.length > 0 && !batchDept) {
      setBatchDept(availableDepartments[0]);
    }
  }, [availableDepartments, batchDept]);

  // Fetch Exams
  const fetchExams = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/exams?college_id=${encodeURIComponent(collegeId)}`);
      const data = await res.json();
      if (data.success) {
        setExams(data.exams || []);
        // Automatically open the first group accordion by default
        if (data.exams && data.exams.length > 0) {
          const firstKey = `${data.exams[0].exam_type}_${data.exams[0].department}_${data.exams[0].semester}`;
          setOpenAccordions((prev) => ({ ...prev, [firstKey]: true }));
        }
      } else {
        toast(data.message || "Failed to load exams", "error");
      }
    } catch (e: any) {
      console.error("Error fetching exams:", e);
      toast("Error fetching exams: " + e.message, "error");
    } finally {
      setLoading(false);
    }
  };

  const fetchCampusMarks = async () => {
    setLoadingCampusMarks(true);
    try {
      const res = await fetch(`/api/exams/marks?college_id=${encodeURIComponent(collegeId)}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.marks)) {
        setCampusMarksList(data.marks);
      } else {
        setCampusMarksList([]);
      }
    } catch (e: any) {
      console.error("Error fetching campus marks:", e);
    } finally {
      setLoadingCampusMarks(false);
    }
  };

  useEffect(() => {
    fetchExams();
  }, [collegeId]);

  useEffect(() => {
    if (activeMainTab === "marks_registry") {
      fetchCampusMarks();
    }
  }, [activeMainTab, collegeId]);

  // Dynamic subjects matching chosen Department & Semester (deduplicated by name)
  const deptSubjects = useMemo(() => {
    if (!batchDept) return [];
    const matched = (subjectsList || []).filter((s: any) => {
      if (s.college_id && s.college_id !== collegeId) return false;
      const deptMatch =
        s.department?.toLowerCase().trim() === batchDept.toLowerCase().trim() ||
        s.department?.toLowerCase().includes(batchDept.toLowerCase().trim()) ||
        batchDept.toLowerCase().includes(s.department?.toLowerCase().trim());
      return deptMatch;
    });

    // Deduplicate by normalized subject name
    const seen = new Set<string>();
    const uniqueSubjects: any[] = [];
    for (const sub of matched) {
      const normName = sub.name.trim().toLowerCase();
      if (!seen.has(normName)) {
        seen.add(normName);
        uniqueSubjects.push(sub);
      }
    }
    return uniqueSubjects;
  }, [subjectsList, batchDept, collegeId]);

  // Initialize or re-populate modal subject rows when department or modal opens
  useEffect(() => {
    if (!isPopupOpen) return;

    if (deptSubjects.length === 0) {
      setSubjectRows([]);
      return;
    }

    let currentDate = new Date(batchStartDate || new Date());
    const initialRows: SubjectFormRow[] = deptSubjects.map((sub: any, idx: number) => {
      if (idx > 0) {
        currentDate.setDate(currentDate.getDate() + 1);
        if (currentDate.getDay() === 0) {
          // Skip Sunday
          currentDate.setDate(currentDate.getDate() + 1);
        }
      }
      const dStr = currentDate.toISOString().slice(0, 10);
      const isFn = batchSessionTiming === "FN";
      const isAn = batchSessionTiming === "AN";
      const startT = isFn ? "10:00 AM" : isAn ? "02:00 PM" : batchCustomStartTime;
      const endT = isFn ? "01:00 PM" : isAn ? "05:00 PM" : batchCustomEndTime;

      // Auto cycle Day 1 to Day 6
      const orderNum = (idx % 6) + 1;
      const dOrder = batchDefaultDayOrder !== "None" ? `Day ${orderNum}` : "None";

      return {
        subject_name: sub.name,
        subject_code: sub.code || undefined,
        included: true,
        exam_date: dStr,
        day_order: dOrder,
        session_type: batchSessionTiming,
        start_time: startT,
        end_time: endT,
        hall_room: batchDefaultHall
      };
    });

    setSubjectRows(initialRows);
  }, [isPopupOpen, batchDept, deptSubjects]);

  // Auto-recalculate dates sequentially
  const handleAutoSequenceDates = () => {
    if (!batchStartDate) {
      toast("Please pick a starting date first", "warning");
      return;
    }

    let currentDate = new Date(batchStartDate);
    let seqIdx = 0;
    const updated = subjectRows.map((row) => {
      if (!row.included) return row;
      if (seqIdx > 0) {
        currentDate.setDate(currentDate.getDate() + 1);
        if (currentDate.getDay() === 0) {
          // Skip Sunday
          currentDate.setDate(currentDate.getDate() + 1);
        }
      }
      const orderNum = (seqIdx % 6) + 1;
      seqIdx++;

      return {
        ...row,
        exam_date: currentDate.toISOString().slice(0, 10),
        day_order: batchDefaultDayOrder !== "None" ? `Day ${orderNum}` : "None",
        hall_room: batchDefaultHall
      };
    });

    setSubjectRows(updated);
    toast("Auto-sequenced consecutive exam dates and Day Orders (skipping Sundays)", "success");
  };

  // Toggle single subject inclusion
  const toggleSubjectIncluded = (index: number) => {
    setSubjectRows((prev) =>
      prev.map((row, idx) => (idx === index ? { ...row, included: !row.included } : row))
    );
  };

  // Update specific subject row field
  const updateSubjectRow = (index: number, updates: Partial<SubjectFormRow>) => {
    setSubjectRows((prev) =>
      prev.map((row, idx) => (idx === index ? { ...row, ...updates } : row))
    );
  };

  // Submit complete batch exam timetable
  const handlePublishTimetable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!batchExamName.trim()) {
      toast("Please enter an exam title (e.g. CIA 1)", "warning");
      return;
    }
    if (!batchDept) {
      toast("Please select a department", "warning");
      return;
    }

    const selectedToSchedule = subjectRows.filter((r) => r.included);
    if (selectedToSchedule.length === 0) {
      toast("Please select at least one subject to schedule", "warning");
      return;
    }

    setIsSubmitting(true);
    try {
      const payloadSchedules = selectedToSchedule.map((row) => {
        const sessionTimeStr =
          row.session_type === "FN"
            ? `${row.start_time || "10:00 AM"} - ${row.end_time || "01:00 PM"} (FN)`
            : row.session_type === "AN"
            ? `${row.start_time || "02:00 PM"} - ${row.end_time || "05:00 PM"} (AN)`
            : `${row.start_time} - ${row.end_time}`;

        return {
          id: `exam_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          college_id: collegeId,
          department: batchDept,
          semester: batchSem,
          exam_type: batchExamName.trim(),
          subject_name: row.subject_name,
          subject_code: row.subject_code,
          exam_date: row.exam_date,
          day_order: row.day_order || batchDefaultDayOrder || "Day 1",
          start_time: row.start_time,
          end_time: row.end_time,
          session_time: sessionTimeStr,
          hall_room: row.hall_room || batchDefaultHall,
          created_by: currentCAM?.name || "Campus Manager"
        };
      });

      const res = await fetch("/api/exams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schedules: payloadSchedules })
      });
      const data = await res.json();

      if (data.success) {
        toast(`Published ${payloadSchedules.length} exam slots for "${batchExamName}" (${batchDept})!`, "success");
        setIsPopupOpen(false);
        fetchExams();
        // Open the newly created group accordion
        const newKey = `${batchExamName.trim()}_${batchDept}_${batchSem}`;
        setOpenAccordions((prev) => ({ ...prev, [newKey]: true }));
      } else {
        toast(data.message || "Failed to publish timetable", "error");
      }
    } catch (err: any) {
      toast("Error: " + err.message, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete an entire Exam Timetable Batch
  const handleDeleteBatch = async (batchKey: string, batchTitle: string, examIds: string[]) => {
    const ok = await showConfirm({
      title: "Delete Exam Timetable Batch",
      message: `Are you sure you want to delete all ${examIds.length} scheduled exam slots for "${batchTitle}"?`,
      danger: true,
      confirmLabel: "Delete Full Timetable"
    });
    if (!ok) return;

    try {
      let failed = 0;
      for (const id of examIds) {
        const res = await fetch(`/api/exams?id=${id}`, { method: "DELETE" });
        const d = await res.json();
        if (!d.success) failed++;
      }

      if (failed === 0) {
        toast(`Deleted exam timetable batch "${batchTitle}"`, "success");
      } else {
        toast(`Deleted exam timetable with ${failed} warnings`, "warning");
      }
      fetchExams();
    } catch (err: any) {
      toast("Error deleting batch: " + err.message, "error");
    }
  };

  // Delete Single Slot
  const handleDeleteSingleExam = async (id: string, title: string) => {
    const ok = await showConfirm({
      title: "Delete Exam Slot",
      message: `Delete exam slot "${title}"?`,
      danger: true,
      confirmLabel: "Delete Slot"
    });
    if (!ok) return;

    try {
      const res = await fetch(`/api/exams?id=${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        toast("Exam slot deleted", "success");
        fetchExams();
      } else {
        toast(data.message || "Failed to delete exam", "error");
      }
    } catch (err: any) {
      toast("Error deleting: " + err.message, "error");
    }
  };

  // Group exams by [Exam Title + Department + Semester] for Accordion View
  const groupedExamBatches = useMemo(() => {
    const groups: Record<
      string,
      {
        key: string;
        exam_type: string;
        department: string;
        semester: string;
        slots: ExamSchedule[];
        minDate: string;
        maxDate: string;
      }
    > = {};

    exams.forEach((ex) => {
      // Apply filters
      if (selectedDeptFilter !== "all" && !ex.department.toLowerCase().includes(selectedDeptFilter.toLowerCase())) {
        return;
      }
      if (selectedSemFilter !== "all" && ex.semester !== selectedSemFilter) {
        return;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matches =
          ex.exam_type.toLowerCase().includes(q) ||
          ex.subject_name.toLowerCase().includes(q) ||
          ex.department.toLowerCase().includes(q) ||
          ex.hall_room?.toLowerCase().includes(q);
        if (!matches) return;
      }

      const key = `${ex.exam_type}_${ex.department}_${ex.semester}`;
      if (!groups[key]) {
        groups[key] = {
          key,
          exam_type: ex.exam_type,
          department: ex.department,
          semester: ex.semester,
          slots: [],
          minDate: ex.exam_date,
          maxDate: ex.exam_date
        };
      }
      groups[key].slots.push(ex);
      if (ex.exam_date < groups[key].minDate) groups[key].minDate = ex.exam_date;
      if (ex.exam_date > groups[key].maxDate) groups[key].maxDate = ex.exam_date;
    });

    // Sort slots inside each group by exam_date
    Object.values(groups).forEach((g) => {
      g.slots.sort((a, b) => a.exam_date.localeCompare(b.exam_date));
    });

    return Object.values(groups);
  }, [exams, selectedDeptFilter, selectedSemFilter, searchQuery]);

  const toggleAccordion = (key: string) => {
    setOpenAccordions((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Filtered Campus Marks for Performance Registry
  const filteredCampusMarks = useMemo(() => {
    return campusMarksList.filter(m => {
      if (marksExamTypeFilter !== "all" && m.exam_type !== marksExamTypeFilter) return false;
      if (marksDeptFilter !== "all") {
        const d = (m.exam_department || m.student_department || "").toLowerCase();
        if (!d.includes(marksDeptFilter.toLowerCase())) return false;
      }
      const isAbs = Boolean(m.is_absent);
      const mNum = m.marks_obtained !== null && m.marks_obtained !== undefined ? parseFloat(m.marks_obtained) : null;
      const maxM = parseFloat(m.max_marks || 50);
      const passM = parseFloat(m.passing_marks || (maxM * 0.4) || 20);
      const isPass = mNum !== null && mNum >= passM;

      if (marksStatusFilter === "passed" && (!isPass || isAbs)) return false;
      if (marksStatusFilter === "arrears" && (isPass || isAbs || mNum === null)) return false;
      if (marksStatusFilter === "absent" && !isAbs) return false;

      if (marksSearchQuery.trim()) {
        const q = marksSearchQuery.toLowerCase().trim();
        const matches = (m.student_name || "").toLowerCase().includes(q) ||
          (m.roll_number || "").toLowerCase().includes(q) ||
          (m.subject_name || "").toLowerCase().includes(q) ||
          (m.classGroup || "").toLowerCase().includes(q);
        if (!matches) return false;
      }
      return true;
    });
  }, [campusMarksList, marksExamTypeFilter, marksDeptFilter, marksStatusFilter, marksSearchQuery]);

  // Overall Campus Exam KPIs
  const campusMarksStats = useMemo(() => {
    let total = campusMarksList.length;
    let evaluated = 0;
    let passed = 0;
    let arrears = 0;
    let absent = 0;
    let totalPct = 0;

    campusMarksList.forEach(m => {
      if (m.is_absent) {
        absent++;
        arrears++;
      } else if (m.marks_obtained !== null && m.marks_obtained !== undefined) {
        evaluated++;
        const val = parseFloat(m.marks_obtained);
        const maxM = parseFloat(m.max_marks || 50);
        const passM = parseFloat(m.passing_marks || (maxM * 0.4) || 20);
        totalPct += (val / maxM) * 100;
        if (val >= passM) passed++;
        else arrears++;
      }
    });

    const passRate = (passed + (arrears - absent)) > 0 ? Math.round((passed / (passed + (arrears - absent))) * 100) : 0;
    const avgScore = evaluated > 0 ? (totalPct / evaluated).toFixed(1) : "—";

    return { total, evaluated, passed, arrears, absent, passRate, avgScore };
  }, [campusMarksList]);

  // Export CSV of Scheduled Exams
  const handleExportCSV = () => {
    const headers = ["Department", "Semester", "Exam_Name", "Subject_Name", "Exam_Date", "Session_Time", "Hall_Room"];
    const rows = exams.map((ex) => [
      ex.department,
      ex.semester,
      ex.exam_type,
      ex.subject_name,
      ex.exam_date,
      ex.session_time,
      ex.hall_room
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `exam_schedules_${collegeId}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast("Exam schedules exported to CSV", "success");
  };

  // Export CSV of Campus Exam Marksheets
  const handleExportMarksCSV = () => {
    if (filteredCampusMarks.length === 0) return;
    let csv = "Roll Number,Student Name,Department,Cohort,Exam Type,Subject Name,Subject Code,Exam Date,Marks Obtained,Max Marks,Percentage,Grade,Status,Evaluator Mentor,Remarks\n";
    filteredCampusMarks.forEach(m => {
      const isAbs = Boolean(m.is_absent);
      const mNum = m.marks_obtained !== null && m.marks_obtained !== undefined ? parseFloat(m.marks_obtained) : null;
      const maxM = parseFloat(m.max_marks || 50);
      const pct = mNum !== null ? ((mNum / maxM) * 100).toFixed(1) + "%" : "—";
      const passM = parseFloat(m.passing_marks || (maxM * 0.4) || 20);
      const isPass = mNum !== null && mNum >= passM;
      const status = isAbs ? "ABSENT" : isPass ? "PASSED" : "ARREAR / RE-APPEAR";
      csv += `"${m.roll_number || ""}","${m.student_name || ""}","${m.exam_department || m.student_department || ""}","${m.classGroup || ""}","${m.exam_type || ""}","${m.subject_name || ""}","${m.subject_code || ""}","${m.exam_date || ""}","${isAbs ? "AB" : mNum ?? "—"}","${maxM}","${pct}","${m.grade || ""}","${status}","${m.evaluated_by || ""}","${m.remarks || ""}"\n`;
    });
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Campus_Exam_Marks_Registry_${collegeId}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast("Campus marksheet registry exported to CSV", "success");
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-16 font-sans">
      {/* Header Banner */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-md">
            <Award className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-base font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
              Exam Timetable & Performance Studio
              <span className="px-2.5 py-0.5 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 text-[10px] font-black uppercase tracking-wider">
                Internal Assessments & Semester
              </span>
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Publish complete department assessment timetables, track faculty marks evaluation, and monitor campus pass rates.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          {/* Main Sub-Tab Pill Switcher */}
          <div className="flex items-center p-1 bg-slate-100 rounded-xl">
            <button
              type="button"
              onClick={() => setActiveMainTab("schedules")}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                activeMainTab === "schedules"
                  ? "bg-white text-indigo-700 shadow-xs"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Timetables ({exams.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveMainTab("marks_registry")}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                activeMainTab === "marks_registry"
                  ? "bg-white text-indigo-700 shadow-xs"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Marks Registry ({campusMarksList.length})
            </button>
          </div>

          {activeMainTab === "schedules" ? (
            <>
              <button
                type="button"
                onClick={handleExportCSV}
                className="inline-flex items-center justify-center gap-2 px-3.5 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 shadow-2xs transition-all cursor-pointer"
              >
                <Download className="h-4 w-4 text-emerald-600" />
                <span>Export CSV</span>
              </button>

              <button
                type="button"
                onClick={() => setIsPopupOpen(true)}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 btn-gradient text-white rounded-xl text-xs font-extrabold shadow-sm hover:shadow-md transition-all cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                <span>Schedule Timetable</span>
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={fetchCampusMarks}
                disabled={loadingCampusMarks}
                className="inline-flex items-center justify-center gap-2 px-3.5 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 transition-all cursor-pointer"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loadingCampusMarks ? "animate-spin text-indigo-600" : ""}`} />
                <span>Refresh</span>
              </button>

              <button
                type="button"
                onClick={handleExportMarksCSV}
                className="inline-flex items-center justify-center gap-2 px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-2xs"
              >
                <Download className="h-4 w-4 text-emerald-600" />
                <span>Export Marksheet CSV</span>
              </button>
            </>
          )}
        </div>
      </div>

      {activeMainTab === "schedules" ? (
        <>
          {/* KPI Stats Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Timetable Batches</p>
              <p className="text-xl font-extrabold text-slate-900 mt-1">{groupedExamBatches.length}</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Exam Slots</p>
              <p className="text-xl font-extrabold text-indigo-600 mt-1">{exams.length}</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Departments Active</p>
              <p className="text-xl font-extrabold text-slate-900 mt-1">
                {Array.from(new Set(exams.map((e) => e.department))).length}
              </p>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Assessment Types</p>
              <p className="text-xl font-extrabold text-purple-600 mt-1">
                {Array.from(new Set(exams.map((e) => e.exam_type))).length}
              </p>
            </div>
          </div>

          {/* Filters & Search */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
              {/* Department Filter */}
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl text-xs font-bold">
                <span className="text-slate-400 text-[10px] uppercase">Dept:</span>
                <select
                  value={selectedDeptFilter}
                  onChange={(e) => setSelectedDeptFilter(e.target.value)}
                  className="bg-transparent text-slate-700 outline-none cursor-pointer font-bold"
                >
                  <option value="all">All Departments</option>
                  {availableDepartments.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>

              {/* Semester Filter */}
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl text-xs font-bold">
                <span className="text-slate-400 text-[10px] uppercase">Sem:</span>
                <select
                  value={selectedSemFilter}
                  onChange={(e) => setSelectedSemFilter(e.target.value)}
                  className="bg-transparent text-slate-700 outline-none cursor-pointer font-bold"
                >
                  <option value="all">All Semesters</option>
                  {["Semester 1", "Semester 2", "Semester 3", "Semester 4", "Semester 5", "Semester 6"].map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Search */}
            <div className="relative w-full md:w-72">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search exam, subject, hall..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Main Accordion View: Grouped by Exam Batches */}
          <div className="space-y-4">
            {loading ? (
              <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center text-slate-400 font-bold shadow-sm">
                Loading exam timetables...
              </div>
            ) : groupedExamBatches.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center text-slate-400 shadow-sm">
                <div className="flex flex-col items-center justify-center gap-2">
                  <Award className="h-9 w-9 text-slate-300" />
                  <p className="font-extrabold text-slate-700 text-sm">No Exam Timetables Published</p>
                  <p className="text-xs text-slate-450 max-w-md">
                    Click <strong>"Schedule Exam Timetable"</strong> above to select a department and schedule assessment dates for all subjects.
                  </p>
                </div>
              </div>
            ) : (
              groupedExamBatches.map((batch) => {
                const isOpen = Boolean(openAccordions[batch.key]);
                const batchTitle = `${batch.exam_type} — ${batch.department} (${batch.semester})`;
                const allIds = batch.slots.map((s) => s.id);

                return (
                  <div
                    key={batch.key}
                    className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden transition-all duration-200"
                  >
                    {/* Accordion Header */}
                    <div
                      onClick={() => toggleAccordion(batch.key)}
                      className="p-4.5 sm:p-5 flex flex-wrap items-center justify-between gap-3 cursor-pointer select-none bg-slate-50/50 hover:bg-slate-50 transition-colors border-b border-slate-150"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-700 font-extrabold text-xs">
                          {batch.exam_type.substring(0, 3)}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-sm font-extrabold text-slate-900">{batchTitle}</h3>
                            <span className="px-2 py-0.5 rounded bg-indigo-50 border border-indigo-100 text-indigo-700 text-[10px] font-black uppercase">
                              {batch.slots.length} {batch.slots.length === 1 ? "Subject" : "Subjects"}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-[11px] text-slate-500 mt-1">
                            <span className="flex items-center gap-1 font-semibold text-slate-650">
                              <Calendar className="h-3 w-3 text-indigo-500 shrink-0" />
                              {batch.minDate} {batch.minDate !== batch.maxDate ? `to ${batch.maxDate}` : ""}
                            </span>
                            <span className="text-slate-300">•</span>
                            <span>{batch.department}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => handleDeleteBatch(batch.key, batchTitle, allIds)}
                          className="p-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-bold transition-all cursor-pointer"
                          title="Delete Full Timetable Batch"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleAccordion(batch.key)}
                          className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-all cursor-pointer"
                        >
                          {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>

                    {/* Accordion Body: Table of Subjects */}
                    {isOpen && (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse min-w-[650px]">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 text-slate-400 font-bold uppercase text-[9px]">
                              <th className="p-3.5 w-12 text-center">#</th>
                              <th className="p-3.5">Subject & Code</th>
                              <th className="p-3.5">Exam Date & Day Order</th>
                              <th className="p-3.5">Timing & Session</th>
                              <th className="p-3.5">Hall / Room</th>
                              <th className="p-3.5">Max Marks</th>
                              <th className="p-3.5 text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                            {batch.slots.map((slot, sIdx) => {
                              return (
                                <tr key={slot.id} className="hover:bg-slate-50/70 transition-colors">
                                  <td className="p-3.5 text-center font-mono text-[11px] text-slate-400">
                                    {sIdx + 1}
                                  </td>
                                  <td className="p-3.5">
                                    <span className="font-extrabold text-slate-900 block">{slot.subject_name}</span>
                                    {slot.subject_code && (
                                      <span className="text-[10px] text-slate-400 font-mono">{slot.subject_code}</span>
                                    )}
                                  </td>
                                  <td className="p-3.5 font-bold text-slate-800">
                                    <div className="flex flex-col gap-1">
                                      <div className="flex items-center gap-1.5">
                                        <Calendar className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
                                        <span>{slot.exam_date}</span>
                                      </div>
                                      {slot.day_order && slot.day_order !== "None" ? (
                                        <span className="inline-flex items-center w-max px-2 py-0.5 rounded-full bg-purple-50 border border-purple-200 text-purple-700 text-[9.5px] font-black uppercase">
                                          {slot.day_order}
                                        </span>
                                      ) : null}
                                    </div>
                                  </td>
                                  <td className="p-3.5 text-slate-600">
                                    <div className="flex items-center gap-1.5">
                                      <Clock className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                                      <span className="font-semibold text-slate-800">{slot.session_time || `${slot.start_time} - ${slot.end_time}`}</span>
                                    </div>
                                  </td>
                                  <td className="p-3.5">
                                    <span className="inline-flex items-center gap-1 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded text-[10px] text-slate-700 font-bold">
                                      <MapPin className="h-3 w-3 text-slate-400" />
                                      {slot.hall_room}
                                    </span>
                                  </td>
                                  <td className="p-3.5 font-bold text-slate-800">
                                    {slot.max_marks || 50} pts
                                  </td>
                                  <td className="p-3.5 text-right">
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteSingleExam(slot.id, slot.subject_name)}
                                      className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg cursor-pointer transition-all"
                                      title="Delete Single Slot"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
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
                );
              })
            )}
          </div>
        </>
      ) : (
        /* MARKS REGISTRY & PERFORMANCE VIEW */
        <div className="space-y-5">
          {/* Performance Summary KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3.5">
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Records</p>
              <p className="text-xl font-extrabold text-slate-900 mt-1">{campusMarksStats.total}</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
              <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">Passed Records</p>
              <p className="text-xl font-extrabold text-emerald-700 mt-1">{campusMarksStats.passed}</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
              <p className="text-[10px] font-bold uppercase tracking-wider text-rose-600">Arrears / Failures</p>
              <p className="text-xl font-extrabold text-rose-700 mt-1">{campusMarksStats.arrears}</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
              <p className="text-[10px] font-bold uppercase tracking-wider text-amber-600">Absentees</p>
              <p className="text-xl font-extrabold text-amber-700 mt-1">{campusMarksStats.absent}</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
              <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-600">Campus Pass Rate</p>
              <p className="text-xl font-extrabold text-indigo-700 mt-1">{campusMarksStats.passRate}%</p>
            </div>
          </div>

          {/* Marks Filter & Search Bar */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
              {/* Exam Type Filter */}
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl text-xs font-bold">
                <span className="text-slate-400 text-[10px] uppercase">Exam:</span>
                <select
                  value={marksExamTypeFilter}
                  onChange={(e) => setMarksExamTypeFilter(e.target.value)}
                  className="bg-transparent text-slate-700 outline-none cursor-pointer font-bold"
                >
                  <option value="all">All Assessments</option>
                  {PRESET_EXAM_SUGGESTIONS.map((ex) => (
                    <option key={ex} value={ex}>{ex}</option>
                  ))}
                </select>
              </div>

              {/* Department Filter */}
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl text-xs font-bold">
                <span className="text-slate-400 text-[10px] uppercase">Dept:</span>
                <select
                  value={marksDeptFilter}
                  onChange={(e) => setMarksDeptFilter(e.target.value)}
                  className="bg-transparent text-slate-700 outline-none cursor-pointer font-bold"
                >
                  <option value="all">All Departments</option>
                  {availableDepartments.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>

              {/* Status Tabs */}
              <div className="flex items-center p-1 bg-slate-100 rounded-xl">
                {(["all", "passed", "arrears", "absent"] as const).map(tab => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setMarksStatusFilter(tab)}
                    className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                      marksStatusFilter === tab
                        ? "bg-white text-slate-900 shadow-2xs"
                        : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    {tab === "all" ? "All Status" : tab === "passed" ? "Passed" : tab === "arrears" ? "Arrears" : "Absent"}
                  </button>
                ))}
              </div>
            </div>

            {/* Search Input */}
            <div className="relative w-full md:w-72">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search student, roll no, subject..."
                value={marksSearchQuery}
                onChange={(e) => setMarksSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Student Exam Marks Registry Table */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto max-h-[600px] scroll-touch">
              <table className="w-full text-left text-xs border-collapse min-w-[850px]">
                <thead className="bg-slate-50 text-slate-500 font-extrabold uppercase text-[10px] tracking-wider sticky top-0 border-b border-slate-200 z-10">
                  <tr>
                    <th className="p-3.5 text-center w-12">#</th>
                    <th className="p-3.5">Student Details</th>
                    <th className="p-3.5">Department / Cohort</th>
                    <th className="p-3.5">Exam & Subject</th>
                    <th className="p-3.5 text-center">Score (Out of)</th>
                    <th className="p-3.5 text-center">Score %</th>
                    <th className="p-3.5 text-center">Grade</th>
                    <th className="p-3.5 text-center">Status</th>
                    <th className="p-3.5">Evaluator Mentor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-150 bg-white font-medium">
                  {loadingCampusMarks ? (
                    <tr>
                      <td colSpan={9} className="p-12 text-center text-slate-400 font-bold">
                        <RefreshCw className="h-6 w-6 animate-spin mx-auto text-indigo-600 mb-2" />
                        Loading campus marks registry...
                      </td>
                    </tr>
                  ) : filteredCampusMarks.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="p-12 text-center text-slate-400 italic">
                        No evaluated exam marks found matching the criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredCampusMarks.map((m, idx) => {
                      const isAbs = Boolean(m.is_absent);
                      const mNum = m.marks_obtained !== null && m.marks_obtained !== undefined ? parseFloat(m.marks_obtained) : null;
                      const maxM = parseFloat(m.max_marks || 50);
                      const pct = mNum !== null ? Math.round((mNum / maxM) * 100) : 0;
                      const passM = parseFloat(m.passing_marks || (maxM * 0.4) || 20);
                      const isPass = mNum !== null && mNum >= passM;

                      return (
                        <tr key={m.id || idx} className="hover:bg-slate-50/60 transition-colors">
                          <td className="p-3.5 text-center font-mono text-[11px] text-slate-400">
                            {idx + 1}
                          </td>
                          <td className="p-3.5">
                            <div className="font-extrabold text-slate-900">{m.student_name}</div>
                            <div className="font-mono text-[10px] text-slate-400">{m.roll_number}</div>
                          </td>
                          <td className="p-3.5">
                            <div className="font-semibold text-slate-800">{m.exam_department || m.student_department}</div>
                            <div className="text-[10px] text-slate-400">{m.classGroup || m.semester}</div>
                          </td>
                          <td className="p-3.5">
                            <div className="flex items-center gap-1.5">
                              <span className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 text-[9px] font-black uppercase">
                                {m.exam_type}
                              </span>
                              <span className="font-extrabold text-slate-900">{m.subject_name}</span>
                            </div>
                            <div className="text-[10px] text-slate-400 mt-0.5">Date: {m.exam_date}</div>
                          </td>
                          <td className="p-3.5 text-center font-mono font-bold text-slate-900">
                            {isAbs ? (
                              <span className="text-rose-600">ABSENT</span>
                            ) : mNum !== null ? (
                              <span>{mNum} / {maxM}</span>
                            ) : (
                              <span className="text-amber-600 italic">Pending</span>
                            )}
                          </td>
                          <td className="p-3.5 text-center font-bold">
                            {isAbs || mNum === null ? "—" : `${pct}%`}
                          </td>
                          <td className="p-3.5 text-center">
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
                          <td className="p-3.5 text-center">
                            <span className={`px-2 py-0.5 rounded text-[9px] font-extrabold uppercase ${
                              isAbs
                                ? "bg-rose-50 text-rose-700 border border-rose-200"
                                : isPass
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : "bg-rose-50 text-rose-700 border border-rose-200"
                            }`}>
                              {isAbs ? "Absent" : isPass ? "Pass" : "Arrear"}
                            </span>
                          </td>
                          <td className="p-3.5 text-slate-600 text-[11px]">
                            <div className="font-semibold text-slate-800">{m.evaluated_by || "Faculty Mentor"}</div>
                            {m.remarks && <div className="text-slate-400 text-[10px] italic">{m.remarks}</div>}
                          </td>
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

      {/* POPUP MODAL: Schedule Exam Timetable with Subject Accordion */}
      {isPopupOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-3xl overflow-hidden animate-scaleUp my-8 max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-150 flex items-center justify-between bg-slate-50/60 shrink-0">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-650">
                  <CalendarRange className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900">Schedule Department Exam Timetable</h3>
                  <p className="text-[11px] text-slate-450">
                    Select department and configure assessment dates for each subject in one place.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsPopupOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handlePublishTimetable} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-5 sm:p-6 overflow-y-auto space-y-5 text-xs">
                {/* 1. Exam Type / Name */}
                <div className="space-y-1.5">
                  <label className="block text-[10.5px] font-extrabold text-slate-700 uppercase tracking-wider">
                    Exam Title / Type <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. CIA 1, CIA 2, Model Exam, Mid-Term..."
                    value={batchExamName}
                    onChange={(e) => setBatchExamName(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white text-xs font-bold text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <span className="text-[10px] text-slate-400 font-bold">Quick presets:</span>
                    {PRESET_EXAM_SUGGESTIONS.map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setBatchExamName(preset)}
                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition-all cursor-pointer ${
                          batchExamName.trim().toLowerCase() === preset.toLowerCase()
                            ? "bg-indigo-600 text-white shadow-2xs"
                            : "bg-slate-100 hover:bg-slate-200 text-slate-600"
                        }`}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 2. Department & Semester Selection */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 bg-slate-50 p-4 rounded-2xl border border-slate-150">
                  <div className="space-y-1.5">
                    <label className="block text-[10.5px] font-extrabold text-slate-700 uppercase tracking-wider">
                      Department <span className="text-rose-500">*</span>
                    </label>
                    <select
                      required
                      value={batchDept}
                      onChange={(e) => setBatchDept(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white text-xs font-bold text-slate-800 outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                    >
                      {availableDepartments.map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-[10.5px] font-extrabold text-slate-700 uppercase tracking-wider">
                      Semester <span className="text-rose-500">*</span>
                    </label>
                    <select
                      required
                      value={batchSem}
                      onChange={(e) => setBatchSem(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white text-xs font-bold text-slate-800 outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                    >
                      {["Semester 1", "Semester 2", "Semester 3", "Semester 4", "Semester 5", "Semester 6"].map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* 3. Global Batch Settings (Start Date, Day Order, Timings & Default Hall) */}
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-slate-50/80 p-4 rounded-2xl border border-slate-150">
                  <div className="space-y-1.5">
                    <label className="block text-[10.5px] font-extrabold text-slate-700 uppercase tracking-wider">
                      Starting Exam Date
                    </label>
                    <input
                      type="date"
                      value={batchStartDate}
                      onChange={(e) => setBatchStartDate(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white text-xs font-bold text-slate-800 outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-[10.5px] font-extrabold text-slate-700 uppercase tracking-wider">
                      Day Order Sequence
                    </label>
                    <select
                      value={batchDefaultDayOrder}
                      onChange={(e) => setBatchDefaultDayOrder(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white text-xs font-bold text-slate-800 outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                    >
                      <option value="Day 1">Start at Day 1</option>
                      <option value="Day 2">Start at Day 2</option>
                      <option value="Day 3">Start at Day 3</option>
                      <option value="Day 4">Start at Day 4</option>
                      <option value="Day 5">Start at Day 5</option>
                      <option value="Day 6">Start at Day 6</option>
                      <option value="None">None / No Day Order</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-[10.5px] font-extrabold text-slate-700 uppercase tracking-wider">
                      Campus Timing
                    </label>
                    <select
                      value={batchSessionTiming}
                      onChange={(e) => {
                        const val = e.target.value as "FN" | "AN" | "custom";
                        setBatchSessionTiming(val);
                        const sT = val === "FN" ? "10:00 AM" : val === "AN" ? "02:00 PM" : batchCustomStartTime;
                        const eT = val === "FN" ? "01:00 PM" : val === "AN" ? "05:00 PM" : batchCustomEndTime;
                        setSubjectRows(prev => prev.map(r => ({
                          ...r,
                          session_type: val,
                          start_time: sT,
                          end_time: eT
                        })));
                      }}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white text-xs font-bold text-slate-800 outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                    >
                      <option value="FN">FN (10:00 AM - 01:00 PM)</option>
                      <option value="AN">AN (02:00 PM - 05:00 PM)</option>
                      <option value="custom">Custom Timing Hours</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-[10.5px] font-extrabold text-slate-700 uppercase tracking-wider">
                      Default Hall / Room
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Main Hall 101"
                      value={batchDefaultHall}
                      onChange={(e) => setBatchDefaultHall(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white text-xs font-bold text-slate-800 outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>

                  {batchSessionTiming === "custom" && (
                    <div className="sm:col-span-4 grid grid-cols-2 gap-3 pt-2 border-t border-slate-200">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-600 uppercase">Start Time</label>
                        <input
                          type="text"
                          value={batchCustomStartTime}
                          placeholder="e.g. 09:30 AM"
                          onChange={(e) => {
                            setBatchCustomStartTime(e.target.value);
                            setSubjectRows(prev => prev.map(r => ({ ...r, start_time: e.target.value })));
                          }}
                          className="w-full px-3 py-1.5 border border-slate-200 rounded-lg bg-white text-xs font-semibold"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-600 uppercase">End Time</label>
                        <input
                          type="text"
                          value={batchCustomEndTime}
                          placeholder="e.g. 12:30 PM"
                          onChange={(e) => {
                            setBatchCustomEndTime(e.target.value);
                            setSubjectRows(prev => prev.map(r => ({ ...r, end_time: e.target.value })));
                          }}
                          className="w-full px-3 py-1.5 border border-slate-200 rounded-lg bg-white text-xs font-semibold"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* 4. Subject Accordion / Subject Matrix */}
                <div className="space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-800">
                        {batchDept} Subjects Timetable ({subjectRows.filter((r) => r.included).length} / {subjectRows.length} Included)
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={handleAutoSequenceDates}
                      className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 border border-indigo-150 text-indigo-700 rounded-lg text-[10.5px] font-extrabold flex items-center gap-1 transition-all cursor-pointer shadow-2xs"
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      <span>Auto-Sequence Consecutive Dates & Day Orders</span>
                    </button>
                  </div>

                  {subjectRows.length === 0 ? (
                    <div className="p-8 text-center bg-slate-50 border border-slate-150 rounded-2xl text-slate-400 font-medium">
                      No subjects found for <strong>{batchDept}</strong>. Please ensure subjects are created in Curriculum & Academic Configuration.
                    </div>
                  ) : (
                    <div className="space-y-2.5 max-h-[340px] overflow-y-auto pr-1">
                      {subjectRows.map((row, idx) => (
                        <div
                          key={`${row.subject_name}_${idx}`}
                          className={`p-3.5 rounded-xl border transition-all ${
                            row.included
                              ? "bg-white border-slate-200 shadow-2xs"
                              : "bg-slate-50 border-slate-150 opacity-60"
                          }`}
                        >
                          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3">
                            {/* Checkbox & Subject Name */}
                            <div className="flex items-center gap-2.5 flex-1 min-w-[200px]">
                              <input
                                type="checkbox"
                                checked={row.included}
                                onChange={() => toggleSubjectIncluded(idx)}
                                className="h-4 w-4 text-indigo-600 rounded cursor-pointer accent-indigo-600"
                              />
                              <div>
                                <p className="font-extrabold text-slate-900 text-xs">{row.subject_name}</p>
                                {row.subject_code && (
                                  <p className="text-[10px] text-slate-400 font-mono">{row.subject_code}</p>
                                )}
                              </div>
                            </div>

                            {/* Date, Day Order, Session, Timing, Hall inputs */}
                            {row.included && (
                              <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
                                <div className="flex items-center gap-1">
                                  <input
                                    type="date"
                                    required
                                    value={row.exam_date}
                                    onChange={(e) => updateSubjectRow(idx, { exam_date: e.target.value })}
                                    className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-bold bg-slate-50 text-slate-800"
                                    title="Exam Date"
                                  />
                                </div>

                                <select
                                  value={row.day_order}
                                  onChange={(e) => updateSubjectRow(idx, { day_order: e.target.value })}
                                  className="px-2 py-1.5 border border-purple-200 rounded-lg text-xs font-bold bg-purple-50 text-purple-700 cursor-pointer"
                                  title="Day Order"
                                >
                                  <option value="Day 1">Day 1</option>
                                  <option value="Day 2">Day 2</option>
                                  <option value="Day 3">Day 3</option>
                                  <option value="Day 4">Day 4</option>
                                  <option value="Day 5">Day 5</option>
                                  <option value="Day 6">Day 6</option>
                                  <option value="None">No Order</option>
                                </select>

                                <select
                                  value={row.session_type}
                                  onChange={(e) => {
                                    const val = e.target.value as "FN" | "AN" | "custom";
                                    updateSubjectRow(idx, {
                                      session_type: val,
                                      start_time: val === "FN" ? "10:00 AM" : val === "AN" ? "02:00 PM" : row.start_time,
                                      end_time: val === "FN" ? "01:00 PM" : val === "AN" ? "05:00 PM" : row.end_time
                                    });
                                  }}
                                  className="px-2 py-1.5 border border-slate-200 rounded-lg text-xs font-bold bg-slate-50 text-slate-800 cursor-pointer"
                                >
                                  <option value="FN">FN (10:00 - 01:00)</option>
                                  <option value="AN">AN (02:00 - 05:00)</option>
                                  <option value="custom">Custom</option>
                                </select>

                                {row.session_type === "custom" && (
                                  <div className="flex items-center gap-1">
                                    <input
                                      type="text"
                                      placeholder="Start"
                                      value={row.start_time}
                                      onChange={(e) => updateSubjectRow(idx, { start_time: e.target.value })}
                                      className="w-20 px-2 py-1.5 border border-slate-200 rounded-lg text-xs font-medium bg-slate-50 text-slate-800"
                                      title="Start Time"
                                    />
                                    <span className="text-slate-400 text-xs">-</span>
                                    <input
                                      type="text"
                                      placeholder="End"
                                      value={row.end_time}
                                      onChange={(e) => updateSubjectRow(idx, { end_time: e.target.value })}
                                      className="w-20 px-2 py-1.5 border border-slate-200 rounded-lg text-xs font-medium bg-slate-50 text-slate-800"
                                      title="End Time"
                                    />
                                  </div>
                                )}

                                <input
                                  type="text"
                                  placeholder="Hall Room"
                                  value={row.hall_room}
                                  onChange={(e) => updateSubjectRow(idx, { hall_room: e.target.value })}
                                  className="w-28 px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-medium bg-slate-50 text-slate-800"
                                  title="Hall / Room"
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-4 border-t border-slate-150 flex items-center justify-between bg-slate-50/60 shrink-0">
                <p className="text-[11px] text-slate-500 font-medium">
                  {subjectRows.filter((r) => r.included).length} of {subjectRows.length} subjects will be published.
                </p>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsPopupOpen(false)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-bold text-slate-650 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting || subjectRows.filter((r) => r.included).length === 0}
                    className="px-5 py-2 btn-gradient text-white rounded-xl text-xs font-extrabold shadow-sm hover:shadow-md cursor-pointer disabled:opacity-50"
                  >
                    {isSubmitting ? "Publishing Timetable..." : "Publish Exam Timetable"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
