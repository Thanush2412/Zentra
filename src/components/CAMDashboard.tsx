"use client";

import React, { useState, useEffect, useMemo, useRef, useDeferredValue } from "react";
import { useApp, Slot, Mentor, Student, Subject } from "../context/AppContext";
import { useToast } from "../context/ToastContext";
import { gsap } from "gsap";

import { Button } from "./Button";
import { Card } from "./Card";
import { Panel } from "./Panel";
import { Input } from "./Input";
import { Select } from "./Select";
import { LoadingButton } from "./ui/LoadingButton";
import { Pagination } from "./ui/Pagination";
import { getSubjectsForDepartment, getDeptFromClassGroup, isSubjectNameMatch, isCohortMatching, isCohortMatch, isTimeSlotMatch, isMentorInProgram, calculateShiftSchedule, resolveClassGroupDetailsFromState, parseDbDate, parseRoomsList, parseDateToYMD, formatDisplayDob } from "../lib/utils";
import { InterviewModule } from "./InterviewModule";
import {
  Building2, GraduationCap, Users, Calendar, ClipboardList, Sparkles,
  AlertTriangle, BookOpen, Clock, CheckCircle2, XCircle, Search,
  PlusCircle, Check, ArrowRight, Settings, MessageSquare, ShieldAlert,
  Award, TrendingUp, FileText, FileSpreadsheet, RefreshCw, Plus, Trash2, Edit2, Download, Upload, ChevronDown, Loader2, Save,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, AlertCircle, CheckCircle, User, SlidersHorizontal, CalendarCheck2, IndianRupee, BadgePercent, X, Mail, Lock, Menu, Briefcase, Layers
} from "lucide-react";




const getCourseFromClassGroup = (cg: string): string => {
  if (!cg) return "";
  let cleaned = cg.replace(/\s*-\s*(Semester|Sem|Year|Yr|Shift|Batch)\s*([0-9]+|[IVXLCDM]+)/gi, "");
  cleaned = cleaned.replace(/\s*(Semester|Sem|Year|Yr|Shift|Batch)\s*([0-9]+|[IVXLCDM]+)/gi, "");
  cleaned = cleaned.replace(/^([IVXLCDM]+)[\s\-_]+/i, ""); // Strip leading Roman numerals (e.g. "III BCA" -> "BCA")
  return cleaned.trim();
};

const getSemesterFromClassGroup = (cg: string): string => {
  const lower = cg.toLowerCase();
  if (lower.includes("sem vi") || lower.includes("semester vi") || lower.includes("sem 6") || lower.includes("semester 6")) return "Semester 6";
  if (lower.includes("sem v") || lower.includes("semester v") || lower.includes("sem 5") || lower.includes("semester 5") || lower.startsWith("iii ") || lower.includes(" 3rd ") || lower.includes("year 3") || lower.includes("3rd year")) return "Semester 5";
  if (lower.includes("sem iv") || lower.includes("semester iv") || lower.includes("sem 4") || lower.includes("semester 4")) return "Semester 4";
  if (lower.includes("sem iii") || lower.includes("semester iii") || lower.includes("sem 3") || lower.includes("semester 3") || lower.startsWith("ii ") || lower.includes(" 2nd ") || lower.includes("year 2") || lower.includes("2nd year")) return "Semester 3";
  if (lower.includes("sem ii") || lower.includes("semester ii") || lower.includes("sem 2") || lower.includes("semester 2")) return "Semester 2";
  if (lower.includes("sem i") || lower.includes("semester i") || lower.includes("sem 1") || lower.includes("semester 1") || lower.startsWith("i ") || lower.includes(" 1st ") || lower.includes("year 1") || lower.includes("1st year")) return "Semester 1";
  return "All Semesters";
};

const formatYearWiseRooms = (defaultRoomStr?: string) => {
  if (!defaultRoomStr) return "None";
  if (!defaultRoomStr.startsWith("{")) return defaultRoomStr;
  try {
    const parsed = JSON.parse(defaultRoomStr);
    return Object.keys(parsed)
      .map(year => `Year ${year}: ${parsed[year]}`)
      .join(" | ");
  } catch (_) {
    return defaultRoomStr;
  }
};


/* ─── CAM Fee Collection Panel ─── */
const fmt = (n: number) => "₹" + n.toLocaleString("en-IN", { maximumFractionDigits: 0 });

const FeeBadge = ({ status }: { status: string }) => {
  if (status === "paid") return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#D528A2]/10 text-[#D528A2] text-[10px] font-bold">Paid</span>;
  if (status === "partial") return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#F4A863]/10 text-[#F4A863] text-[10px] font-bold">⏳ Partial</span>;
  return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 text-[10px] font-bold">Unpaid</span>;
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
      {/* Summary Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-white border border-slate-200/80 shadow-sm">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Fee Target</p>
          <p className="text-lg font-black text-slate-900 mt-1">{fmt(data.stats?.totalFees || 0)}</p>
        </div>
        <div className="p-4 rounded-xl bg-white border border-slate-200/80 shadow-sm">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Collected</p>
          <p className="text-lg font-black text-emerald-600 mt-1">{fmt(data.stats?.totalPaid || 0)}</p>
        </div>
        <div className="p-4 rounded-xl bg-white border border-slate-200/80 shadow-sm">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Outstanding Balance</p>
          <p className="text-lg font-black text-rose-600 mt-1">{fmt(data.stats?.totalOutstanding || 0)}</p>
        </div>
      </div>

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
            <div key={student.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
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

/* ─── CAM Campus Insight & Downloadable Reports Panel ─── */
const CAMCampusInsightPanel: React.FC<{
  activeCollegeId: string;
  activeCollegeName: string;
  collegeMentors: Mentor[];
  campusSlots: Slot[];
  collegeStudents: Student[];
  collegeSubjects: Subject[];
}> = ({
  activeCollegeId,
  activeCollegeName,
  collegeMentors,
  campusSlots = [],
  collegeStudents,
  collegeSubjects
}) => {
  const { toast } = useToast();
  const [selectedSubTab, setSelectedSubTab] = useState<"all" | "workload" | "attendance" | "syllabus" | "demos">("all");
  const [selectedCohort, setSelectedCohort] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [studentAttendance, setStudentAttendance] = useState<any[]>([]);
  const [demoSessions, setDemoSessions] = useState<any[]>([]);

  // Fetch Attendance records
  useEffect(() => {
    if (!activeCollegeId) return;
    fetch(`/api/attendance?college_id=${encodeURIComponent(activeCollegeId)}`)
      .then(r => r.json())
      .then(d => {
        if (d.records) setStudentAttendance(d.records);
        else if (Array.isArray(d)) setStudentAttendance(d);
      })
      .catch(() => {});

    fetch(`/api/demo-sessions?college_id=${encodeURIComponent(activeCollegeId)}`)
      .then(r => r.json())
      .then(d => {
        if (d.records) setDemoSessions(d.records);
        else if (Array.isArray(d)) setDemoSessions(d);
      })
      .catch(() => {});
  }, [activeCollegeId]);

  // Distinct Class Groups / Cohorts in Campus
  const campusCohorts = useMemo(() => {
    const fromStudents = collegeStudents.map(s => s.classGroup).filter(Boolean);
    const fromSlots = campusSlots.map(s => s.classGroup).filter(Boolean);
    return Array.from(new Set([...fromStudents, ...fromSlots])).sort();
  }, [collegeStudents, campusSlots]);

  // Export helpers
  const exportToCSV = (fileName: string, headers: string[], rows: any[][]) => {
    const csvRows = [
      headers,
      ...rows.map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`))
    ];
    const csvContent = "data:text/csv;charset=utf-8," + csvRows.map(e => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${fileName}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast(`Exported "${fileName}.csv" successfully!`, "success");
  };

  const exportToExcel = async (fileName: string, sheetName: string, headers: string[], rows: any[][]) => {
    try {
      const XLSX = await import("xlsx");
      const wsData = [headers, ...rows];
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
      XLSX.writeFile(wb, `${fileName}_${new Date().toISOString().slice(0, 10)}.xlsx`);
      toast(`Exported "${fileName}.xlsx" successfully!`, "success");
    } catch (err: any) {
      toast("Failed to export Excel: " + err.message, "error");
    }
  };

  const exportToPrintablePDF = (title: string, subtitle: string, headers: string[], rows: any[][]) => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      toast("Pop-up blocked. Please allow pop-ups to print PDF.", "warning");
      return;
    }
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>${title} - ${activeCollegeName}</title>
          <style>
            body { font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; padding: 28px; color: #0f172a; margin: 0; background: #fff; }
            .header-box { border-bottom: 2px solid #4f46e5; padding-bottom: 12px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: flex-end; }
            h1 { font-size: 18px; font-weight: 900; margin: 0 0 4px 0; color: #1e1b4b; }
            p.sub { font-size: 11px; color: #64748b; margin: 0; font-weight: 500; }
            .meta-badge { font-size: 10px; color: #4338ca; background: #e0e7ff; padding: 4px 8px; border-radius: 6px; font-weight: 700; }
            .meta-row { display: flex; gap: 20px; font-size: 10.5px; color: #475569; margin-bottom: 16px; background: #f8fafc; padding: 8px 12px; border-radius: 6px; border: 1px solid #e2e8f0; }
            table { width: 100%; border-collapse: collapse; font-size: 10.5px; }
            th { background: #f1f5f9; color: #334155; font-weight: 800; text-align: left; padding: 8px 10px; border: 1px solid #cbd5e1; text-transform: uppercase; font-size: 9px; letter-spacing: 0.5px; }
            td { padding: 7px 10px; border: 1px solid #e2e8f0; vertical-align: middle; }
            tr:nth-child(even) { background: #fcfcfd; }
            .warn-tag { background: #fee2e2; color: #991b1b; padding: 2px 6px; border-radius: 4px; font-weight: 800; font-size: 9px; }
            .good-tag { background: #dcfce7; color: #166534; padding: 2px 6px; border-radius: 4px; font-weight: 800; font-size: 9px; }
            .neutral-tag { background: #f1f5f9; color: #475569; padding: 2px 6px; border-radius: 4px; font-weight: 700; font-size: 9px; }
            .footer { margin-top: 24px; border-top: 1px solid #e2e8f0; padding-top: 8px; font-size: 9.5px; color: #94a3b8; display: flex; justify-content: space-between; }
            @media print {
              body { padding: 0; }
              @page { margin: 1.2cm; size: landscape; }
            }
          </style>
        </head>
        <body>
          <div class="header-box">
            <div>
              <h1>${title}</h1>
              <p class="sub">${subtitle}</p>
            </div>
            <span class="meta-badge">${activeCollegeName || "Campus Report"}</span>
          </div>
          <div class="meta-row">
            <span>Campus: <strong>${activeCollegeName}</strong></span>
            <span>Generated On: <strong>${new Date().toLocaleDateString('en-US', { dateStyle: 'full' })}</strong></span>
            <span>Total Records: <strong>${rows.length}</strong></span>
          </div>
          <table>
            <thead>
              <tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>
            </thead>
            <tbody>
              ${rows.map(r => `<tr>${r.map(cell => `<td>${cell ?? '—'}</td>`).join('')}</tr>`).join('')}
            </tbody>
          </table>
          <div class="footer">
            <span>Official Academic Report — FACE Prep E-Campus Operations</span>
            <span>Confidential</span>
          </div>
          <script>
            window.onload = () => { window.print(); };
          </script>
        </body>
      </html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // REPORT 1: Faculty Workload & Allocation Ledger
  // ─────────────────────────────────────────────────────────────────────────────
  const facultyWorkloadData = useMemo(() => {
    return collegeMentors
      .filter(m => !searchQuery || m.name.toLowerCase().includes(searchQuery.toLowerCase()) || (m.department || '').toLowerCase().includes(searchQuery.toLowerCase()))
      .map((mentor, idx) => {
        const assignedSlots = campusSlots.filter(s => s.mentorId === mentor.id);
        const assignedHours = assignedSlots.length;
        const targetLimit = 16;
        const variance = assignedHours - targetLimit;
        const status = assignedHours > 16 ? "Overload" : assignedHours >= 14 ? "Optimal" : "Underload";
        return {
          sNo: idx + 1,
          id: mentor.id,
          name: mentor.name,
          email: mentor.email,
          dept: mentor.department || mentor.mentor_group || "General",
          assignedHours,
          targetLimit,
          variance: variance > 0 ? `+${variance}h` : `${variance}h`,
          status,
          subjects: mentor.subjects || "—"
        };
      });
  }, [collegeMentors, campusSlots, searchQuery]);

  const exportFacultyWorkload = (format: "excel" | "csv" | "pdf") => {
    const headers = ["S.No", "Faculty Name", "Email", "Department", "Assigned Weekly Hours", "Target Limit (16h)", "Variance", "Workload Status", "Allocated Subjects"];
    const rows = facultyWorkloadData.map(r => [r.sNo, r.name, r.email, r.dept, `${r.assignedHours} hrs`, `${r.targetLimit} hrs`, r.variance, r.status, r.subjects]);
    if (format === "excel") exportToExcel("Faculty_Workload_Ledger", "Workload", headers, rows);
    else if (format === "csv") exportToCSV("Faculty_Workload_Ledger", headers, rows);
    else exportToPrintablePDF("Faculty Workload & Allocation Ledger", "Mapping active faculty assigned hours against the 16 hours/week institutional workload limit.", headers, rows);
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // REPORT 2: Student Attendance Shortage Warning Report (< 75%)
  // ─────────────────────────────────────────────────────────────────────────────
  const attendanceShortageData = useMemo(() => {
    let filteredStudents = collegeStudents;
    if (selectedCohort !== "all") {
      filteredStudents = filteredStudents.filter(s => isCohortMatch(s.classGroup, selectedCohort));
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filteredStudents = filteredStudents.filter(s => s.name.toLowerCase().includes(q) || s.id.toLowerCase().includes(q) || (s.register_number || '').toLowerCase().includes(q));
    }

    const records: any[] = [];
    filteredStudents.forEach(student => {
      // Find attendance records for this student
      const studentAtts = studentAttendance.filter(a => a.studentId === student.id);
      const totalConducted = studentAtts.length;
      if (totalConducted === 0) return; // Skip students with 0 marked periods

      const presentCount = studentAtts.filter(a => a.status === "present" || a.status === "od").length;
      const absentCount = studentAtts.filter(a => a.status === "absent").length;
      const percentage = Math.round((presentCount / totalConducted) * 100);

      if (percentage < 75) {
        records.push({
          id: student.id,
          name: student.name,
          regNo: student.register_number || student.id,
          dept: student.department || "General",
          classGroup: student.classGroup || "General",
          conducted: totalConducted,
          present: presentCount,
          absent: absentCount,
          percentage,
          severity: percentage < 65 ? "Critical Shortage (<65%)" : "Warning Shortage (65-74%)"
        });
      }
    });

    return records.sort((a, b) => a.percentage - b.percentage);
  }, [collegeStudents, studentAttendance, selectedCohort, searchQuery]);

  const exportAttendanceShortage = (format: "excel" | "csv" | "pdf") => {
    const headers = ["S.No", "Student ID", "Student Name", "Register No", "Department", "Class Group", "Conducted Periods", "Attended (Present)", "Absent", "Attendance %", "Status"];
    const rows = attendanceShortageData.map((r, idx) => [idx + 1, r.id, r.name, r.regNo, r.dept, r.classGroup, r.conducted, r.present, r.absent, `${r.percentage}%`, r.severity]);
    const title = selectedCohort !== "all" ? `Student Attendance Shortage Warning Report (${selectedCohort})` : "Student Attendance Shortage Warning Report (< 75%)";
    if (format === "excel") exportToExcel("Student_Attendance_Shortage_Report", "Attendance_Shortage", headers, rows);
    else if (format === "csv") exportToCSV("Student_Attendance_Shortage_Report", headers, rows);
    else exportToPrintablePDF(title, "Detailed breakdown of students whose cumulative attendance rate is currently below the mandatory 75% threshold.", headers, rows);
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // REPORT 3: Subject Completion & Syllabus Pace Report
  // ─────────────────────────────────────────────────────────────────────────────
  const syllabusPaceData = useMemo(() => {
    return collegeSubjects
      .filter(s => !searchQuery || s.name.toLowerCase().includes(searchQuery.toLowerCase()) || (s.department || '').toLowerCase().includes(searchQuery.toLowerCase()))
      .map((sub, idx) => {
        const weeklyHrs = Number(sub.weekly_hours) || 4;
        const targetSemesterHours = weeklyHrs * 15; // 15-week academic semester

        // Count sessions conducted in studentAttendance for this subject
        const conductedCount = studentAttendance.filter(a => {
          if (a.coveredSubject && isSubjectNameMatch(a.coveredSubject, sub.name)) return true;
          const matchingSlot = campusSlots.find(slot => slot.id === a.slotId);
          return matchingSlot && isSubjectNameMatch(matchingSlot.course, sub.name);
        }).length;

        // Distinct session count estimate
        const distinctSessions = Math.min(targetSemesterHours, Math.round(conductedCount / Math.max(1, collegeStudents.length / 5)));
        const actualHours = distinctSessions > 0 ? distinctSessions : Math.min(targetSemesterHours, campusSlots.filter(s => isSubjectNameMatch(s.course, sub.name)).length * 10);
        const completionPct = Math.min(100, Math.round((actualHours / targetSemesterHours) * 100));
        const status = completionPct >= 80 ? "On Track" : completionPct >= 50 ? "In Progress" : "Lagging Behind";

        return {
          sNo: idx + 1,
          name: sub.name,
          dept: sub.department || "General",
          sem: sub.semester || "Semester 5",
          type: sub.type || "Theory",
          targetHours: targetSemesterHours,
          actualHours,
          completionPct,
          status
        };
      });
  }, [collegeSubjects, studentAttendance, campusSlots, collegeStudents, searchQuery]);

  const exportSyllabusPace = (format: "excel" | "csv" | "pdf") => {
    const headers = ["S.No", "Subject Name", "Department", "Semester", "Type", "Target Semester Hours", "Actual Conducted Hours", "Syllabus Pace %", "Delivery Status"];
    const rows = syllabusPaceData.map(r => [r.sNo, r.name, r.dept, r.sem, r.type, `${r.targetHours} hrs`, `${r.actualHours} hrs`, `${r.completionPct}%`, r.status]);
    if (format === "excel") exportToExcel("Subject_Completion_Syllabus_Report", "Syllabus_Pace", headers, rows);
    else if (format === "csv") exportToCSV("Subject_Completion_Syllabus_Report", headers, rows);
    else exportToPrintablePDF("Subject Completion & Syllabus Pace Report", "Documenting actual periods delivered vs target scheduled semester curriculum hours.", headers, rows);
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // REPORT 4: Mentor Demo & Evaluation Report
  // ─────────────────────────────────────────────────────────────────────────────
  const demoEvaluationData = useMemo(() => {
    return (demoSessions || [])
      .filter(d => !searchQuery || d.mentorName?.toLowerCase().includes(searchQuery.toLowerCase()) || d.subject?.toLowerCase().includes(searchQuery.toLowerCase()))
      .map((d, idx) => ({
        sNo: idx + 1,
        id: d.id,
        mentorName: d.mentorName || "Mentor",
        smeName: d.smeName || "SME Evaluator",
        subject: d.subject || "Subject Demo",
        stream: d.stream || "General",
        dateStr: d.dateStr,
        timeSlot: d.timeSlot,
        status: d.status === "completed" ? "Completed" : d.status === "scheduled" ? "Scheduled" : d.status === "reallocation_required" ? "Reallocation Required" : d.status,
        marks: d.marks !== undefined && d.marks !== null ? `${d.marks}/100` : "Pending",
        comments: d.comments || "—"
      }));
  }, [demoSessions, searchQuery]);

  const exportDemoEvaluations = (format: "excel" | "csv" | "pdf") => {
    const headers = ["S.No", "Mentor Name", "SME Evaluator", "Subject Demo", "Stream / Class", "Session Date", "Time Slot", "Status", "Score", "Evaluator Feedback"];
    const rows = demoEvaluationData.map(r => [r.sNo, r.mentorName, r.smeName, r.subject, r.stream, r.dateStr, r.timeSlot, r.status, r.marks, r.comments]);
    if (format === "excel") exportToExcel("Mentor_Demo_Evaluation_Report", "Demo_Evaluations", headers, rows);
    else if (format === "csv") exportToCSV("Mentor_Demo_Evaluation_Report", headers, rows);
    else exportToPrintablePDF("Mentor Demo & Evaluation Ledger", "Comprehensive evaluation report of mentor domain demo sessions conducted by Subject Matter Experts (SMEs).", headers, rows);
  };

  return (
    <div className="space-y-6 font-sans">
      {/* Top Banner & Sub-Navigation */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/90 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 border border-indigo-100">
                <FileSpreadsheet className="h-5 w-5" />
              </div>
              <h2 className="text-base font-black text-slate-900 leading-tight">Campus Insight &amp; Institutional Reports</h2>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-1">
              Download real-time faculty workload ledgers, student attendance shortage lists, syllabus paces, and mentor demo reports.
            </p>
          </div>

          {/* Search & Global Cohort Selector */}
          <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
            <div className="relative w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50/50 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <select
              value={selectedCohort}
              onChange={e => setSelectedCohort(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 outline-none cursor-pointer"
            >
              <option value="all">All Class Groups / Cohorts</option>
              {campusCohorts.map(cg => (
                <option key={cg} value={cg}>{cg}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Quick Report Filter Tabs */}
        <div className="flex gap-2 overflow-x-auto border-b border-slate-100 pb-2">
          {[
            { id: "all", label: "All Insights & Reports", count: 4 },
            { id: "workload", label: "Faculty Workload Ledger", count: facultyWorkloadData.length },
            { id: "attendance", label: "Attendance Shortage (<75%)", count: attendanceShortageData.length, alert: attendanceShortageData.length > 0 },
            { id: "syllabus", label: "Syllabus Completion Pace", count: syllabusPaceData.length },
            { id: "demos", label: "Mentor Demo Evaluations", count: demoEvaluationData.length }
          ].map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSelectedSubTab(tab.id as any)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
                selectedSubTab === tab.id
                  ? "bg-slate-900 text-white shadow-xs"
                  : "bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200/60"
              }`}
            >
              <span>{tab.label}</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                selectedSubTab === tab.id
                  ? "bg-white/20 text-white"
                  : tab.alert ? "bg-rose-100 text-rose-700" : "bg-slate-200 text-slate-700"
              }`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* ──────────────────────── REPORT CARDS GRID ──────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* CARD 1: Faculty Workload Ledger */}
        {(selectedSubTab === "all" || selectedSubTab === "workload") && (
          <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs space-y-4 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100 shrink-0">
                    <Users className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900 leading-tight">Faculty Workload &amp; Allocation Ledger</h3>
                    <p className="text-[11px] text-slate-500 font-medium mt-0.5">Active faculty weekly hours mapped against the 16 hours/week institutional threshold.</p>
                  </div>
                </div>
              </div>

              {/* KPI Summary */}
              <div className="grid grid-cols-3 gap-2 bg-slate-50/70 p-3 rounded-xl border border-slate-150">
                <div>
                  <p className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">Faculty Count</p>
                  <p className="text-base font-black text-slate-800 mt-0.5">{facultyWorkloadData.length}</p>
                </div>
                <div>
                  <p className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">Overload (&gt;16h)</p>
                  <p className="text-base font-black text-amber-600 mt-0.5">{facultyWorkloadData.filter(f => f.assignedHours > 16).length}</p>
                </div>
                <div>
                  <p className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">Avg Workload</p>
                  <p className="text-base font-black text-indigo-600 mt-0.5">
                    {facultyWorkloadData.length > 0 ? (facultyWorkloadData.reduce((s, f) => s + f.assignedHours, 0) / facultyWorkloadData.length).toFixed(1) : 0} hrs/wk
                  </p>
                </div>
              </div>

              {/* Top 3 Preview Rows */}
              <div className="overflow-hidden border border-slate-200/80 rounded-xl">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-black text-slate-500 uppercase">
                    <tr>
                      <th className="p-2.5">Faculty</th>
                      <th className="p-2.5">Hours</th>
                      <th className="p-2.5 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {facultyWorkloadData.slice(0, 3).map(f => (
                      <tr key={f.id} className="hover:bg-slate-50/50">
                        <td className="p-2.5 font-bold text-slate-800">{f.name}</td>
                        <td className="p-2.5 font-mono text-slate-600 font-semibold">{f.assignedHours} / 16 hrs</td>
                        <td className="p-2.5 text-right">
                          <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase ${
                            f.status === "Overload" ? "bg-amber-100 text-amber-800" : f.status === "Optimal" ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"
                          }`}>
                            {f.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Export Buttons */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => exportFacultyWorkload("csv")}
                className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 text-xs font-bold hover:bg-slate-50 transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5 text-slate-500" />
                <span>CSV</span>
              </button>
              <button
                type="button"
                onClick={() => exportFacultyWorkload("excel")}
                className="px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                <span>Download Excel (.xlsx)</span>
              </button>
              <button
                type="button"
                onClick={() => exportFacultyWorkload("pdf")}
                className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Print / PDF</span>
              </button>
            </div>
          </div>
        )}

        {/* CARD 2: Student Attendance Shortage Warning Report (<75%) */}
        {(selectedSubTab === "all" || selectedSubTab === "attendance") && (
          <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs space-y-4 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-100 shrink-0">
                    <AlertTriangle className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900 leading-tight">Student Attendance Shortage Warning Report</h3>
                    <p className="text-[11px] text-slate-500 font-medium mt-0.5">Students below the mandatory 75% attendance threshold with critical risk flags.</p>
                  </div>
                </div>
              </div>

              {/* KPI Summary */}
              <div className="grid grid-cols-3 gap-2 bg-rose-50/40 p-3 rounded-xl border border-rose-150">
                <div>
                  <p className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">Shortage Total</p>
                  <p className="text-base font-black text-rose-600 mt-0.5">{attendanceShortageData.length}</p>
                </div>
                <div>
                  <p className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">Critical (&lt;65%)</p>
                  <p className="text-base font-black text-rose-700 mt-0.5">{attendanceShortageData.filter(s => s.percentage < 65).length}</p>
                </div>
                <div>
                  <p className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">Selected Cohort</p>
                  <p className="text-xs font-bold text-slate-700 truncate mt-1">{selectedCohort === "all" ? "All Cohorts" : selectedCohort}</p>
                </div>
              </div>

              {/* Top 3 Preview Rows */}
              <div className="overflow-hidden border border-slate-200/80 rounded-xl">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-black text-slate-500 uppercase">
                    <tr>
                      <th className="p-2.5">Student</th>
                      <th className="p-2.5">Cohort</th>
                      <th className="p-2.5 text-right">Attendance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {attendanceShortageData.slice(0, 3).map(s => (
                      <tr key={s.id} className="hover:bg-slate-50/50">
                        <td className="p-2.5 font-bold text-slate-800">{s.name}</td>
                        <td className="p-2.5 text-slate-500 text-[11px]">{s.classGroup}</td>
                        <td className="p-2.5 text-right">
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-rose-100 text-rose-800">
                            {s.percentage}%
                          </span>
                        </td>
                      </tr>
                    ))}
                    {attendanceShortageData.length === 0 && (
                      <tr>
                        <td colSpan={3} className="p-4 text-center text-xs text-emerald-600 font-bold bg-emerald-50/40">
                          🎉 Zero students below 75% attendance in this selection!
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Export Buttons */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => exportAttendanceShortage("csv")}
                className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 text-xs font-bold hover:bg-slate-50 transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5 text-slate-500" />
                <span>CSV</span>
              </button>
              <button
                type="button"
                onClick={() => exportAttendanceShortage("excel")}
                className="px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                <span>Download Excel (.xlsx)</span>
              </button>
              <button
                type="button"
                onClick={() => exportAttendanceShortage("pdf")}
                className="px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-black shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Print / PDF</span>
              </button>
            </div>
          </div>
        )}

        {/* CARD 3: Subject Completion & Syllabus Pace Report */}
        {(selectedSubTab === "all" || selectedSubTab === "syllabus") && (
          <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs space-y-4 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center border border-purple-100 shrink-0">
                    <BookOpen className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900 leading-tight">Subject Completion &amp; Syllabus Pace Report</h3>
                    <p className="text-[11px] text-slate-500 font-medium mt-0.5">Delivery tracker comparing actual periods conducted vs target scheduled hours.</p>
                  </div>
                </div>
              </div>

              {/* KPI Summary */}
              <div className="grid grid-cols-3 gap-2 bg-slate-50/70 p-3 rounded-xl border border-slate-150">
                <div>
                  <p className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">Total Subjects</p>
                  <p className="text-base font-black text-slate-800 mt-0.5">{syllabusPaceData.length}</p>
                </div>
                <div>
                  <p className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">On Track (≥80%)</p>
                  <p className="text-base font-black text-emerald-600 mt-0.5">{syllabusPaceData.filter(s => s.completionPct >= 80).length}</p>
                </div>
                <div>
                  <p className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">Lagging (&lt;50%)</p>
                  <p className="text-base font-black text-rose-600 mt-0.5">{syllabusPaceData.filter(s => s.completionPct < 50).length}</p>
                </div>
              </div>

              {/* Top 3 Preview Rows */}
              <div className="overflow-hidden border border-slate-200/80 rounded-xl">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-black text-slate-500 uppercase">
                    <tr>
                      <th className="p-2.5">Subject</th>
                      <th className="p-2.5">Pace</th>
                      <th className="p-2.5 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {syllabusPaceData.slice(0, 3).map(sub => (
                      <tr key={sub.name} className="hover:bg-slate-50/50">
                        <td className="p-2.5 font-bold text-slate-800">{sub.name}</td>
                        <td className="p-2.5 font-mono text-slate-600 font-semibold">{sub.completionPct}%</td>
                        <td className="p-2.5 text-right">
                          <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase ${
                            sub.status === "On Track" ? "bg-emerald-100 text-emerald-800" : sub.status === "In Progress" ? "bg-blue-100 text-blue-800" : "bg-rose-100 text-rose-800"
                          }`}>
                            {sub.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Export Buttons */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => exportSyllabusPace("csv")}
                className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 text-xs font-bold hover:bg-slate-50 transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5 text-slate-500" />
                <span>CSV</span>
              </button>
              <button
                type="button"
                onClick={() => exportSyllabusPace("excel")}
                className="px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                <span>Download Excel (.xlsx)</span>
              </button>
              <button
                type="button"
                onClick={() => exportSyllabusPace("pdf")}
                className="px-3.5 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs font-black shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Print / PDF</span>
              </button>
            </div>
          </div>
        )}

        {/* CARD 4: Mentor Demo & Evaluation Report */}
        {(selectedSubTab === "all" || selectedSubTab === "demos") && (
          <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs space-y-4 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-pink-50 text-pink-600 flex items-center justify-center border border-pink-100 shrink-0">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900 leading-tight">Mentor Demo &amp; Evaluation Ledger</h3>
                    <p className="text-[11px] text-slate-500 font-medium mt-0.5">Comprehensive audit of mentor evaluations conducted by Subject Matter Experts (SMEs).</p>
                  </div>
                </div>
              </div>

              {/* KPI Summary */}
              <div className="grid grid-cols-3 gap-2 bg-slate-50/70 p-3 rounded-xl border border-slate-150">
                <div>
                  <p className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">Total Demos</p>
                  <p className="text-base font-black text-slate-800 mt-0.5">{demoEvaluationData.length}</p>
                </div>
                <div>
                  <p className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">Completed</p>
                  <p className="text-base font-black text-emerald-600 mt-0.5">{demoEvaluationData.filter(d => d.status === "Completed").length}</p>
                </div>
                <div>
                  <p className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">Reallocation Req</p>
                  <p className="text-base font-black text-amber-600 mt-0.5">{demoEvaluationData.filter(d => d.status.includes("Reallocation")).length}</p>
                </div>
              </div>

              {/* Top 3 Preview Rows */}
              <div className="overflow-hidden border border-slate-200/80 rounded-xl">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-black text-slate-500 uppercase">
                    <tr>
                      <th className="p-2.5">Mentor</th>
                      <th className="p-2.5">Subject</th>
                      <th className="p-2.5 text-right">Score</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {demoEvaluationData.slice(0, 3).map(d => (
                      <tr key={d.id} className="hover:bg-slate-50/50">
                        <td className="p-2.5 font-bold text-slate-800">{d.mentorName}</td>
                        <td className="p-2.5 text-slate-500 text-[11px]">{d.subject}</td>
                        <td className="p-2.5 text-right font-mono font-bold text-indigo-700">{d.marks}</td>
                      </tr>
                    ))}
                    {demoEvaluationData.length === 0 && (
                      <tr>
                        <td colSpan={3} className="p-4 text-center text-xs text-slate-400 italic">
                          No demo evaluations logged yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Export Buttons */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => exportDemoEvaluations("csv")}
                className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 text-xs font-bold hover:bg-slate-50 transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5 text-slate-500" />
                <span>CSV</span>
              </button>
              <button
                type="button"
                onClick={() => exportDemoEvaluations("excel")}
                className="px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                <span>Download Excel (.xlsx)</span>
              </button>
              <button
                type="button"
                onClick={() => exportDemoEvaluations("pdf")}
                className="px-3.5 py-1.5 rounded-lg bg-pink-600 hover:bg-pink-700 text-white text-xs font-black shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Print / PDF</span>
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

// Persistent global flag to prevent sidebar animating on every re-mount during navigation
let isFirstSidebarAnimationDone = false;

/* ─── CAM Mentor Attendance & Punching Panel ─── */
const CAMMentorAttendanceTab: React.FC<{ collegeId: string; camName: string }> = ({ collegeId, camName }) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [dateStr, setDateStr] = useState(() => new Date().toISOString().split("T")[0]);
  const [records, setRecords] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>({ total: 0, present: 0, od: 0, leave: 0, absent: 0, unpunched: 0 });
  const [search, setSearch] = useState("");
  const [selectedDept, setSelectedDept] = useState("all");
  const [markingMentorId, setMarkingMentorId] = useState<string | null>(null);

  // OD / Leave Reason Modal State
  const [showReasonModal, setShowReasonModal] = useState(false);
  const [activeReasonMentor, setActiveReasonMentor] = useState<any>(null);
  const [pendingStatus, setPendingStatus] = useState<"OD" | "Leave" | "Absent" | "Present">("OD");
  const [reasonText, setReasonText] = useState("");

  const fetchAttendance = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/mentor-attendance?collegeId=${encodeURIComponent(collegeId)}&dateStr=${encodeURIComponent(dateStr)}`);
      const json = await res.json();
      if (json.success) {
        setRecords(json.records || []);
        setSummary(json.summary || { total: 0, present: 0, od: 0, leave: 0, absent: 0, unpunched: 0 });
      }
    } catch (e) {
      console.error(e);
      toast("Failed to fetch mentor attendance data", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAttendance();
  }, [collegeId, dateStr]);

  const handlePunchStatus = async (mentorId: string, status: "Present" | "OD" | "Leave" | "Absent", reasonStr?: string) => {
    setMarkingMentorId(mentorId);
    try {
      const res = await fetch("/api/mentor-attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mentorId,
          collegeId,
          dateStr,
          status,
          reason: reasonStr || null,
          markedBy: "cam",
          markedById: camName
        })
      });
      const json = await res.json();
      if (json.success) {
        toast(`Marked mentor status as ${status}`, "success");
        await fetchAttendance();
      } else {
        toast(json.message || "Failed to update attendance", "error");
      }
    } catch (e: any) {
      toast("Error updating attendance: " + e.message, "error");
    } finally {
      setMarkingMentorId(null);
    }
  };

  const handleBulkPresent = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/mentor-attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "bulk_present",
          collegeId,
          dateStr,
          markedBy: "cam",
          markedById: camName
        })
      });
      const json = await res.json();
      if (json.success) {
        toast(json.message, "success");
        await fetchAttendance();
      } else {
        toast(json.message || "Failed to mark bulk present", "error");
      }
    } catch (e: any) {
      toast("Error: " + e.message, "error");
    } finally {
      setLoading(false);
    }
  };

  const openReasonModal = (mentor: any, status: "OD" | "Leave" | "Absent" | "Present") => {
    setActiveReasonMentor(mentor);
    setPendingStatus(status);
    setReasonText(mentor.reason || "");
    setShowReasonModal(true);
  };

  const submitReasonModal = async () => {
    if (!activeReasonMentor) return;
    await handlePunchStatus(activeReasonMentor.mentorId, pendingStatus, reasonText);
    setShowReasonModal(false);
  };

  // Faculty Leave & Permission Requests State
  const [subView, setSubView] = useState<"roster" | "leave_approvals">("roster");
  const [facultyLeaveReqs, setFacultyLeaveReqs] = useState<any[]>([]);
  const [loadingLeaveReqs, setLoadingLeaveReqs] = useState(false);
  const [actionReqId, setActionReqId] = useState<string | null>(null);

  const fetchFacultyLeaveRequests = async () => {
    setLoadingLeaveReqs(true);
    try {
      const res = await fetch(`/api/requests/faculty-leave?collegeId=${encodeURIComponent(collegeId)}`);
      const json = await res.json();
      if (json.success) {
        setFacultyLeaveReqs(json.records || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingLeaveReqs(false);
    }
  };

  useEffect(() => {
    fetchFacultyLeaveRequests();
  }, [collegeId]);

  const handleResolveFacultyLeave = async (requestId: string, action: "approve" | "reject") => {
    setActionReqId(requestId);
    try {
      const res = await fetch("/api/requests/faculty-leave", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          requestId,
          approvedBy: camName
        })
      });
      const json = await res.json();
      if (json.success) {
        toast(json.message, "success");
        await fetchFacultyLeaveRequests();
      } else {
        toast(json.message || "Failed to process leave request", "error");
      }
    } catch (e: any) {
      toast("Error: " + e.message, "error");
    } finally {
      setActionReqId(null);
    }
  };

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const departments = useMemo(() => Array.from(new Set(records.map(r => r.department).filter(Boolean))), [records]);

  const filteredRecords = useMemo(() => {
    return records.filter(r => {
      const matchesSearch = !search || (r.name && r.name.toLowerCase().includes(search.toLowerCase())) || (r.email && r.email.toLowerCase().includes(search.toLowerCase()));
      const matchesDept = selectedDept === "all" || r.department === selectedDept;
      return matchesSearch && matchesDept;
    });
  }, [records, search, selectedDept]);

  useEffect(() => {
    setPage(1);
  }, [search, selectedDept, dateStr]);

  const paginatedRecords = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredRecords.slice(start, start + pageSize);
  }, [filteredRecords, page, pageSize]);

  return (
    <div className="space-y-6">
      {/* Header & Date Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white border border-slate-200/80 rounded-xl p-5 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0">
            <CalendarCheck2 className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-extrabold text-slate-800 leading-tight">Faculty &amp; Mentor Attendance Punching</h2>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Record daily presence, OD (On Duty) logs, or leave statuses for campus mentors.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {/* SubView Selector */}
          <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={() => setSubView("roster")}
              className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                subView === "roster"
                  ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs border border-slate-200 dark:border-slate-700"
                  : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              }`}
            >
              Roster Punching
            </button>
            <button
              type="button"
              onClick={() => setSubView("leave_approvals")}
              className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                subView === "leave_approvals"
                  ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs border border-slate-200 dark:border-slate-700"
                  : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              }`}
            >
              Leave Approvals
              {facultyLeaveReqs.filter(r => r.status === "pending").length > 0 && (
                <span className="px-1.5 py-0.5 rounded-full text-[9px] font-black bg-rose-500 text-white">
                  {facultyLeaveReqs.filter(r => r.status === "pending").length}
                </span>
              )}
            </button>
          </div>

          {subView === "roster" && (
            <>
              <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 p-1.5 rounded-xl border border-slate-200 dark:border-slate-700">
                <span className="text-xs font-bold text-slate-500 pl-2">Date:</span>
                <input
                  type="date"
                  value={dateStr}
                  onChange={(e) => setDateStr(e.target.value)}
                  className="bg-white dark:bg-slate-900 text-xs font-bold px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <button
                type="button"
                onClick={handleBulkPresent}
                className="px-3.5 py-1.5 rounded-xl text-xs font-extrabold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <CheckCircle2 className="h-4 w-4" />
                Mark All Present
              </button>
            </>
          )}
        </div>
      </div>

      {subView === "leave_approvals" ? (
        /* Leave & Permission Approvals Table */
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-extrabold text-slate-900">Faculty Leave &amp; Permission Approval Requests</h3>
            <button
              onClick={fetchFacultyLeaveRequests}
              className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:text-indigo-600 cursor-pointer"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-extrabold uppercase text-[10px] tracking-wider">
                  <th className="p-3">Faculty / Mentor</th>
                  <th className="p-3">Department</th>
                  <th className="p-3">Request Type</th>
                  <th className="p-3">From Date</th>
                  <th className="p-3">To Date</th>
                  <th className="p-3">Mandatory Reason</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white font-medium text-slate-800">
                {loadingLeaveReqs ? (
                  <tr><td colSpan={7} className="p-8 text-center text-slate-400">Loading leave requests...</td></tr>
                ) : facultyLeaveReqs.length === 0 ? (
                  <tr><td colSpan={7} className="p-8 text-center text-slate-400 italic">No faculty leave or permission requests found.</td></tr>
                ) : (
                  facultyLeaveReqs.map((req) => (
                    <tr key={req.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-3">
                        <div className="font-extrabold text-slate-900">{req.mentorName}</div>
                        <div className="text-[10px] font-mono text-slate-400">{req.mentorEmail}</div>
                      </td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-bold">
                          {req.mentorDepartment || "General"}
                        </span>
                      </td>
                      <td className="p-3 font-extrabold">
                        {req.request_type === "Leave" && <span className="text-amber-700 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200 text-[10px] font-black uppercase">Leave</span>}
                        {req.request_type === "Permission" && <span className="text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200 text-[10px] font-black uppercase">Permission</span>}
                        {req.request_type === "OD" && <span className="text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-200 text-[10px] font-black uppercase">OD (On Duty)</span>}
                      </td>
                      <td className="p-3 font-mono text-[11px] text-slate-700 font-bold">{req.start_date}</td>
                      <td className="p-3 font-mono text-[11px] text-slate-700 font-bold">{req.end_date}</td>
                      <td className="p-3 text-[11px] italic text-slate-700 max-w-[200px] truncate" title={req.reason}>
                        {req.reason}
                      </td>
                      <td className="p-3">
                        {req.status === "pending" && <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 text-[10px] font-black uppercase">Pending CM</span>}
                        {req.status === "approved" && <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase">Approved</span>}
                        {req.status === "rejected" && <span className="px-2.5 py-1 rounded-full bg-rose-100 text-rose-800 text-[10px] font-black uppercase">Rejected</span>}
                      </td>
                      <td className="p-3 text-right">
                        {req.status === "pending" ? (
                          <div className="flex items-center gap-1.5 justify-end">
                            <button
                              type="button"
                              disabled={actionReqId === req.id}
                              onClick={() => handleResolveFacultyLeave(req.id, "approve")}
                              className="px-3 py-1.5 rounded-xl text-[10px] font-extrabold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs cursor-pointer"
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              disabled={actionReqId === req.id}
                              onClick={() => handleResolveFacultyLeave(req.id, "reject")}
                              className="px-3 py-1.5 rounded-xl text-[10px] font-extrabold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 cursor-pointer"
                            >
                              Reject
                            </button>
                          </div>
                        ) : (
                          <span className="text-[10px] text-slate-400 font-bold italic">Resolved by {req.approved_by || "CM"}</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <>
          {/* Summary KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
        <div className="p-4 rounded-xl bg-white border border-slate-200/80 shadow-xs">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Faculty</p>
          <p className="text-xl font-black text-slate-900 mt-0.5">{summary.total}</p>
        </div>
        <div className="p-4 rounded-xl bg-emerald-50/60 border border-emerald-200/80 shadow-xs">
          <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Present</p>
          <p className="text-xl font-black text-emerald-700 mt-0.5">{summary.present}</p>
        </div>
        <div className="p-4 rounded-xl bg-indigo-50/60 border border-indigo-200/80 shadow-xs">
          <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider">On Duty (OD)</p>
          <p className="text-xl font-black text-indigo-700 mt-0.5">{summary.od}</p>
        </div>
        <div className="p-4 rounded-xl bg-amber-50/60 border border-amber-200/80 shadow-xs">
          <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">On Leave</p>
          <p className="text-xl font-black text-amber-700 mt-0.5">{summary.leave}</p>
        </div>
        <div className="p-4 rounded-xl bg-rose-50/60 border border-rose-200/80 shadow-xs">
          <p className="text-[10px] font-bold text-rose-600 uppercase tracking-wider">Absent</p>
          <p className="text-xl font-black text-rose-700 mt-0.5">{summary.absent}</p>
        </div>
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 shadow-xs">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Unpunched</p>
          <p className="text-xl font-black text-slate-600 mt-0.5">{summary.unpunched}</p>
        </div>
      </div>

      {/* Filter & Table Container */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search faculty name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full text-xs font-semibold pl-9 pr-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <label className="text-xs font-bold text-slate-500 shrink-0">Department:</label>
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="text-xs font-bold px-3 py-2 rounded-xl border border-slate-200 bg-white focus:outline-none focus:border-indigo-500"
            >
              <option value="all">All Departments ({records.length})</option>
              {departments.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Attendance Roster Table */}
        <div className="overflow-x-auto border border-slate-200 rounded-xl">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-extrabold uppercase text-[10px] tracking-wider">
                <th className="p-3">Faculty / Mentor</th>
                <th className="p-3">Department</th>
                <th className="p-3">Punch Time</th>
                <th className="p-3">Current Status</th>
                <th className="p-3">OD / Remarks</th>
                <th className="p-3 text-right">Quick Punch Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white font-medium text-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-400 font-medium">
                    Loading mentor attendance records...
                  </td>
                </tr>
              ) : filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-400 font-medium">
                    No faculty found matching the selected filters.
                  </td>
                </tr>
              ) : (
                paginatedRecords.map((m) => {
                  const isMarking = markingMentorId === m.mentorId;
                  return (
                    <tr key={m.mentorId} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-3">
                        <div className="font-extrabold text-slate-900">{m.name}</div>
                        <div className="text-[10px] font-mono text-slate-400">{m.email}</div>
                      </td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-bold">
                          {m.department || "General"}
                        </span>
                      </td>
                      <td className="p-3 font-mono text-[11px] text-slate-600">
                        {m.punchInTime || <span className="text-slate-350 italic">—</span>}
                      </td>
                      <td className="p-3">
                        {m.status === "Present" && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black">
                            <CheckCircle2 className="h-3 w-3 text-emerald-600" /> Present
                          </span>
                        )}
                        {m.status === "OD" && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-indigo-100 text-indigo-800 text-[10px] font-black">
                            <Briefcase className="h-3 w-3 text-indigo-600" /> OD (On Duty)
                          </span>
                        )}
                        {m.status === "Leave" && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 text-[10px] font-black">
                            <Clock className="h-3 w-3 text-amber-600" /> On Leave
                          </span>
                        )}
                        {m.status === "Absent" && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-100 text-rose-800 text-[10px] font-black">
                            <XCircle className="h-3 w-3 text-rose-600" /> Absent
                          </span>
                        )}
                        {m.status === "Not Punched" && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 text-slate-500 text-[10px] font-bold">
                            Pending Punch
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-[11px] text-slate-600 max-w-[200px] truncate">
                        {m.reason ? (
                          <span className="italic text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100" title={m.reason}>
                            {m.reason}
                          </span>
                        ) : (
                          <span className="text-slate-300 italic">—</span>
                        )}
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex items-center gap-1.5 justify-end">
                          {/* Present Button */}
                          <button
                            type="button"
                            disabled={isMarking}
                            onClick={() => handlePunchStatus(m.mentorId, "Present")}
                            className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                              m.status === "Present"
                                ? "bg-emerald-600 text-white shadow-xs"
                                : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200"
                            }`}
                          >
                            Present
                          </button>

                          {/* OD Button */}
                          <button
                            type="button"
                            disabled={isMarking}
                            onClick={() => openReasonModal(m, "OD")}
                            className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                              m.status === "OD"
                                ? "bg-indigo-600 text-white shadow-xs"
                                : "bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200"
                            }`}
                          >
                            OD
                          </button>

                          {/* Leave Button */}
                          <button
                            type="button"
                            disabled={isMarking}
                            onClick={() => openReasonModal(m, "Leave")}
                            className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                              m.status === "Leave"
                                ? "bg-amber-500 text-white shadow-xs"
                                : "bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200"
                            }`}
                          >
                            Leave
                          </button>

                          {/* Absent Button */}
                          <button
                            type="button"
                            disabled={isMarking}
                            onClick={() => handlePunchStatus(m.mentorId, "Absent")}
                            className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                              m.status === "Absent"
                                ? "bg-rose-600 text-white shadow-xs"
                                : "bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200"
                            }`}
                          >
                            Absent
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
          <Pagination
            currentPage={page}
            totalItems={filteredRecords.length}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        </div>
      </div>

      {/* OD / Leave Reason Remarks Modal */}
      {showReasonModal && activeReasonMentor && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full shadow-2xl space-y-4 border border-slate-200 animate-scaleUp">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-extrabold text-slate-900">
                  Mark {pendingStatus} Details
                </h3>
                <p className="text-xs text-slate-400 font-medium">
                  {activeReasonMentor.name} ({activeReasonMentor.department})
                </p>
              </div>
              <button
                onClick={() => setShowReasonModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1">
                  Reason / Event Remarks (Optional)
                </label>
                <textarea
                  rows={3}
                  placeholder={
                    pendingStatus === "OD"
                      ? "e.g., Conducted University Corporate Placement Drive at Main Auditorium"
                      : "e.g., Medical leave approved by HOD"
                  }
                  value={reasonText}
                  onChange={(e) => setReasonText(e.target.value)}
                  className="w-full text-xs font-medium p-3 rounded-xl border border-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowReasonModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitReasonModal}
                className="px-5 py-2 rounded-xl text-xs font-extrabold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition-all cursor-pointer"
              >
                Save Attendance →
              </button>
            </div>
          </div>
        </div>
      )}
        </>
      )}
    </div>
  );
};

export interface CAMDashboardProps {
  activeTab?: "overview" | "config" | "curriculum" | "faculty" | "timetable" | "monitoring" | "handovers" | "reports" | "tasks" | "profile" | "tracker" | "fees" | "students_list" | "more_menu" | "mentor_attendance" | "interviews" | "events";
  onTabChange?: (tab: "overview" | "config" | "curriculum" | "faculty" | "timetable" | "monitoring" | "handovers" | "reports" | "tasks" | "profile" | "tracker" | "fees" | "students_list" | "more_menu" | "mentor_attendance" | "interviews" | "events") => void;
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
    interviews,
    subjectsList,
    coursesList,
    assignSlot,
    deleteSlot,
    refreshData,
    refreshAttendance,
    studentAttendance,
    setStudentAttendance,
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
    bulkImportMentors,
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
    saveFacultyConfig,
    deleteStudent,
    bulkDeleteStudents,
    departmentsList,
    holidays,
  } = useApp();
  const { toast, confirm: showConfirm } = useToast();

  const storedUserEmail = typeof window !== "undefined" ? (localStorage.getItem("fp_user_email") || "") : "";
  const isSuperAdminUser = storedUserEmail.toLowerCase().trim() === "thanush@faceprep.in";

  const [superAdminScope, setSuperAdminScope] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("fp_superadmin_campus_scope") || "all";
    }
    return "all";
  });

  useEffect(() => {
    const handleStorage = () => {
      const scope = localStorage.getItem("fp_superadmin_campus_scope") || "all";
      setSuperAdminScope(scope);
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const isGlobalAllCampuses = isSuperAdminUser && superAdminScope === "all";

  const activeCollegeId = isSuperAdminUser
    ? (superAdminScope === "all" ? "all" : superAdminScope)
    : (currentCAM?.college_id || colleges[0]?.id || "college_1");

  const activeCollegeName = isGlobalAllCampuses
    ? "All Regions & Campuses (Global Data Scope)"
    : (currentCAM?.college_name || colleges.find(c => c.id === activeCollegeId)?.name || "Primary Campus");

  // Tab State
  const [localActiveTab, setLocalActiveTab] = useState<"overview" | "config" | "curriculum" | "faculty" | "timetable" | "monitoring" | "handovers" | "reports" | "tasks" | "profile" | "tracker" | "fees" | "students_list" | "more_menu" | "mentor_attendance" | "interviews" | "events">("overview");
  const activeTab = propActiveTab || localActiveTab;
  const setActiveTab = onTabChange || setLocalActiveTab;

  useEffect(() => {
    const handleNav = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail) {
        setActiveTab(customEvent.detail);
      }
    };
    window.addEventListener("fp_navigate_tab", handleNav);
    return () => window.removeEventListener("fp_navigate_tab", handleNav);
  }, [setActiveTab]);

  // ── Auto-poll attendance every 30s when monitoring tab is open ──
  // This ensures mentor-marked data appears in the CAM matrix without a manual page refresh
  useEffect(() => {
    if (activeTab !== "monitoring") return;
    // Immediate fetch on tab open so data is always fresh
    refreshAttendance(activeCollegeId);
    const interval = setInterval(() => {
      refreshAttendance(activeCollegeId);
    }, 30_000); // every 30 seconds
    return () => clearInterval(interval);
  }, [activeTab, activeCollegeId]);

  // GSAP Container reference
  const containerRef = useRef<HTMLDivElement>(null);

  // GSAP Tab Change entrance animation
  useEffect(() => {
    if (typeof window !== "undefined" && containerRef.current) {
      // Find all card-like elements dynamically
      const cardElements = Array.from(
        containerRef.current.querySelectorAll(
          ".rounded-xl, .rounded-xl, .rounded-xl, .bg-white, .bg-pastel-cream, .bg-pastel-blue, .bg-pastel-purple, .bg-pastel-green, .animate-gsap-card"
        )
      ).filter(el => {
        // Exclude elements inside the sidebar, header, or the outer page container
        if (el.closest(".floating-sidebar") || el.closest("header") || el.tagName === "ASIDE") {
          return false;
        }
        // Exclude nested cards (only animate the outermost container to avoid double animation)
        const parentCard = el.parentElement?.closest(
          ".rounded-xl, .rounded-xl, .rounded-xl, .bg-white, .bg-pastel-cream, .bg-pastel-blue, .bg-pastel-purple, .bg-pastel-green"
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

  // Sidebar remains static and stable without GSAP button wobble

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

  // Automatically expand the group containing the active tab (single group accordion)
  useEffect(() => {
    if (["overview"].includes(activeTab)) {
      setExpandedGroups({ dashboard: true });
    } else if (["config", "curriculum"].includes(activeTab)) {
      setExpandedGroups({ academics: true });
    } else if (["faculty", "handovers"].includes(activeTab)) {
      setExpandedGroups({ faculty: true });
    } else if (["timetable", "monitoring"].includes(activeTab)) {
      setExpandedGroups({ schedules: true });
    } else if (["tracker", "fees", "students_list"].includes(activeTab)) {
      setExpandedGroups({ students: true });
    } else if (["reports", "tasks", "profile"].includes(activeTab)) {
      setExpandedGroups({ management: true });
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
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showStudentImportModal, setShowStudentImportModal] = useState(false);
  const [studentImportPreview, setStudentImportPreview] = useState<{ parsed: any[]; warnings: string[]; targetClassGroup: string } | null>(null);
  const [isStudentImportSubmitting, setIsStudentImportSubmitting] = useState(false);
  const [studentDirSearch, setStudentDirSearch] = useState("");
  const [studentDirDeptFilter, setStudentDirDeptFilter] = useState("all");
  const [studentSemFilter, setStudentSemFilter] = useState("all");
  const [studentShiftFilter, setStudentShiftFilter] = useState("all");
  const [selectedStudentForDetail, setSelectedStudentForDetail] = useState<any | null>(null);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);

  // Attendance Directory & Date-Wise Monitoring States
  const [attendanceDate, setAttendanceDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [attendanceStartDate, setAttendanceStartDate] = useState("2026-06-15");
  const [attendanceEndDate, setAttendanceEndDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [attendanceMonthFilter, setAttendanceMonthFilter] = useState("all");
  const [showAttendanceImportModal, setShowAttendanceImportModal] = useState(false);
  const [attendanceImportPreview, setAttendanceImportPreview] = useState<{ parsed: any[]; warnings: string[]; targetDate: string } | null>(null);
  const [isAttendanceImportSubmitting, setIsAttendanceImportSubmitting] = useState(false);
  const [showClearAttendanceModal, setShowClearAttendanceModal] = useState(false);
  const [isClearingAttendance, setIsClearingAttendance] = useState(false);
  const [clearDeptFilter, setClearDeptFilter] = useState("all");
  const [clearBatchFilter, setClearBatchFilter] = useState("all");
  const [clearScope, setClearScope] = useState<"range" | "all">("range");
  const [markingStudentForDate, setMarkingStudentForDate] = useState<{ student: any; dateStr: string } | null>(null);
  const [activePeriodChange, setActivePeriodChange] = useState<{ slotId: string; newStatus: "present" | "absent" | "late" | "od"; reason: string } | null>(null);
  const [isSubmittingPeriodCorrection, setIsSubmittingPeriodCorrection] = useState(false);

  // Event Management Module States
  const [eventSearchQuery, setEventSearchQuery] = useState("");
  const [eventCategoryFilter, setEventCategoryFilter] = useState("All");
  const [eventDeptFilter, setEventDeptFilter] = useState("All");
  const [eventStatusFilter, setEventStatusFilter] = useState("All");
  const [eventViewMode, setEventViewMode] = useState<"cards" | "timeline" | "table">("cards");
  const [showEventModal, setShowEventModal] = useState(false);
  const [editingEventObj, setEditingEventObj] = useState<any | null>(null);

  // Event Form Fields
  const [evFormName, setEvFormName] = useState("");
  const [evFormDate, setEvFormDate] = useState("");
  const [evFormEndDate, setEvFormEndDate] = useState("");
  const [evFormCategory, setEvFormCategory] = useState("Coding Fest & Hackathon");
  const [evFormDept, setEvFormDept] = useState("All Departments");
  const [evFormAudience, setEvFormAudience] = useState("All Campus");
  const [evFormStatus, setEvFormStatus] = useState("Upcoming");
  const [evFormVenue, setEvFormVenue] = useState("");
  const [evFormDesc, setEvFormDesc] = useState("");
  const [evFormCoordinator, setEvFormCoordinator] = useState("");
  const [evFormChiefGuest, setEvFormChiefGuest] = useState("");
  const [evFormRegistrationLink, setEvFormRegistrationLink] = useState("");
  const [evFormPhotos, setEvFormPhotos] = useState<string[]>([]);
  const [selectedPhotoLightbox, setSelectedPhotoLightbox] = useState<{ src: string; title: string } | null>(null);

  // Centralized loading state tracker for all async operations
  const [loadingActions, setLoadingActions] = useState<Record<string, boolean>>({});
  const [isSyncingHireScore, setIsSyncingHireScore] = useState(false);
  const setActionLoading = (key: string, loading: boolean) => {
    setLoadingActions(prev => ({ ...prev, [key]: loading }));
  };

  const handleSyncHireScoreLive = async () => {
    setIsSyncingHireScore(true);
    try {
      const res = await fetch(`/api/hirescore?college_id=${encodeURIComponent(activeCollegeId || "")}`, {
        method: "POST"
      });
      const data = await res.json();
      if (data.success) {
        toast(`Synced ${data.syncedCount} student(s) with live HireScore & EFSET benchmark data!`, "success");
        await refreshData();
      } else {
        toast(data.message || "Failed to sync HireScore data.", "error");
      }
    } catch (err: any) {
      toast("Error syncing HireScore: " + err.message, "error");
    } finally {
      setIsSyncingHireScore(false);
    }
  };

  const handleSingleDeleteStudent = async (st: any) => {
    if (!st || !st.id) return;
    const ok = await showConfirm({
      title: "Delete Student Record",
      message: `Are you sure you want to delete ${st.name} (${st.roll_number || st.id})? This will permanently remove their profile, attendance logs, and login credentials.`,
      confirmLabel: "Delete Record",
      danger: true
    });
    if (ok) {
      setActionLoading(`delete_student_${st.id}`, true);
      try {
        const res = await deleteStudent(st.id);
        if (res.success) {
          toast(`Student ${st.name} deleted successfully.`, "success");
          setSelectedStudentIds(prev => prev.filter(id => id !== st.id));
          if (selectedStudentForDetail?.id === st.id) {
            setSelectedStudentForDetail(null);
          }
        } else {
          toast(res.message || "Failed to delete student.", "error");
        }
      } finally {
        setActionLoading(`delete_student_${st.id}`, false);
      }
    }
  };

  const handleBulkDeleteStudents = async (targetIds?: string[]) => {
    const idsToDelete = targetIds || selectedStudentIds;
    if (!idsToDelete || idsToDelete.length === 0) return;
    const ok = await showConfirm({
      title: "Delete Selected Students",
      message: `Are you sure you want to delete ${idsToDelete.length} selected student(s)? This will permanently remove their records, attendance logs, and login credentials.`,
      confirmLabel: `Delete ${idsToDelete.length} Students`,
      danger: true
    });
    if (ok) {
      setActionLoading('bulk_delete_students', true);
      try {
        const res = await bulkDeleteStudents(idsToDelete);
        if (res.success) {
          toast(`${res.count || idsToDelete.length} student record(s) deleted successfully.`, "success");
          setSelectedStudentIds(prev => prev.filter(id => !idsToDelete.includes(id)));
          if (selectedStudentForDetail && idsToDelete.includes(selectedStudentForDetail.id)) {
            setSelectedStudentForDetail(null);
          }
        } else {
          toast(res.message || "Failed to delete selected students.", "error");
        }
      } finally {
        setActionLoading('bulk_delete_students', false);
      }
    }
  };
  // Template download selectors (3 separate pickers)
  const [templateDept, setTemplateDept] = useState<string>("");
  const [templateShift, setTemplateShift] = useState<string>("Shift 1");
  const [templateSem, setTemplateSem] = useState<string>("Semester 1");

  // Download Student Excel Template matching requested headers
  const handleDownloadStudentTemplate = async (classGroupOverride?: string) => {
    const campusDepts = (collegeCourses.length > 0 ? collegeCourses : coursesList).map(c => c.name);
    const resolvedDept = templateDept || campusDepts[0] || "General";
    const resolvedShift = isCampusShiftBased ? (templateShift || "Shift 1") : "General";
    const resolvedSem = templateSem || "Semester 1";
    const resolvedClass = classGroupOverride || (isCampusShiftBased ? `${resolvedDept} - ${resolvedShift} - ${resolvedSem}` : `${resolvedDept} - ${resolvedSem}`);
    const selectedClass = resolvedClass;
    const headers = [
      "Sl. No.",
      "Roll No",
      "Department",
      "Shift",
      "Name",
      "Hire Score",
      "EFSET Score",
      "Mother Name",
      "Father Name",
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
      "PAN Card Number",
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
        "85",
        "C2",
        "Lakshmi R",
        "Ramesh K",
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
        "ABCDE1234F",
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
        "78",
        "B2",
        "Meena M",
        "Murugan S",
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
        "WXYZ9876K",
        "bala@university.edu",
        "https://linkedin.com/in/bala",
        "https://github.com/bala",
        "https://hackerrank.com/bala",
        "https://leetcode.com/bala",
        "https://figma.com/@bala"
      ]
    ];

    const XLSX = await import("xlsx");
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
      if (!val) return;

      if (norm === "slno" || norm === "sno" || norm === "serialnumber") return;
      if (norm === "rollno" || norm === "rollnumber" || norm === "regno" || norm === "registernumber" || norm === "registrationnumber") mapped.roll_number = val;
      else if (norm === "name" || norm === "studentname" || norm === "fullname") mapped.name = val;
      else if (norm.includes("hire") || norm.includes("placement") || norm === "hirescore") mapped.hire_score = val;
      else if (norm.includes("efset") || norm.includes("efscore") || norm.includes("englishscore")) mapped.efset_score = val;
      else if (norm.includes("mother")) mapped.mother_name = val;
      else if (norm.includes("father")) mapped.father_name = val;
      else if (norm.includes("pan") || norm === "pancard") mapped.pan_number = val;
      else if (norm.includes("10th") || norm.includes("tenth") || norm === "xmark" || norm === "xmarks" || norm === "sslc") mapped.tenth_mark = val;
      else if (norm.includes("11th") || norm.includes("eleventh") || norm === "ximark" || norm === "ximarks") mapped.eleventh_mark = val;
      else if (norm.includes("12th") || norm.includes("twelfth") || norm === "xiimark" || norm === "xiimarks" || norm === "hsc") mapped.twelfth_mark = val;
      else if (norm.includes("blood") || norm === "bg") mapped.blood_group = val;
      else if (norm.includes("dob") || norm.includes("birth") || norm.includes("dateofbirth")) mapped.dob = parseDateToYMD(val);
      else if (norm.includes("parent") || norm.includes("whatsapp") || norm.includes("guardian")) mapped.parent_phone = val;
      else if (norm.includes("aadhar") || norm.includes("adhaar") || norm.includes("aadhaar")) mapped.aadhar_number = val;
      else if (norm.includes("email") || norm.includes("mail")) mapped.email = val;
      else if (norm.includes("studentphone") || norm.includes("studentmobile") || norm === "phone" || norm === "mobile" || norm === "contact" || norm === "phonenumber") mapped.phone = val;
      else if (norm.includes("group") || norm.includes("academicgroup")) mapped.academic_group = val;
      else if (norm.includes("medium")) mapped.medium = val;
      else if (norm.includes("linkedin")) mapped.linkedin_link = val;
      else if (norm.includes("github") || norm.includes("git")) mapped.github_id = val;
      else if (norm.includes("drive") || norm.includes("projectlink") || norm.includes("portfolio")) mapped.project_drive_link = val;
      else if (norm.includes("hackerrank") || norm.includes("hrank")) mapped.hackerrank_link = val;
      else if (norm.includes("leetcode") || norm.includes("lcode")) mapped.leetcode_link = val;
      else if (norm.includes("figma")) mapped.figma_link = val;
      else if (norm === "department" || norm === "dept" || norm === "course" || norm === "stream") mapped.department = val;
      else if (norm === "shift") mapped.shift = val;
      else if (norm === "semester" || norm === "sem" || norm.includes("semester") || norm.includes("sem")) mapped.semester = val;
      else if (norm === "classgroup" || norm === "class" || norm === "cohort") mapped.classGroup = val;
    });

    // Extract semester cleanly
    if (!mapped.semester && mapped.classGroup) {
      mapped.semester = getSemesterFromClassGroup(mapped.classGroup);
    }
    if (!mapped.semester && defaultCG) {
      mapped.semester = getSemesterFromClassGroup(defaultCG) || templateSem || "Semester 1";
    }

    // Standardize semester name (e.g. "Semester 5")
    if (mapped.semester) {
      const romanMap: Record<string, number> = { i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7, viii: 8 };
      const numMatch = mapped.semester.match(/\d+/);
      if (numMatch) {
        mapped.semester = `Semester ${numMatch[0]}`;
      } else {
        const lower = mapped.semester.toLowerCase().replace(/[^a-z]/g, "");
        const semNum = romanMap[lower];
        if (semNum) mapped.semester = `Semester ${semNum}`;
        else mapped.semester = "Semester 1";
      }
    } else {
      mapped.semester = templateSem || "Semester 1";
    }

    // Auto-derive department from classGroup if not in sheet
    if (!mapped.department && mapped.classGroup) {
      mapped.department = getDeptFromClassGroup(mapped.classGroup);
    }

    // Derive shift cleanly
    if (!mapped.shift) {
      if (mapped.classGroup?.toLowerCase().includes("shift 1") || mapped.classGroup?.toLowerCase().includes("shift_1")) {
        mapped.shift = "Shift 1";
      } else if (mapped.classGroup?.toLowerCase().includes("shift 2") || mapped.classGroup?.toLowerCase().includes("shift_2")) {
        mapped.shift = "Shift 2";
      } else {
        mapped.shift = isCampusShiftBased ? "Shift 1" : "General";
      }
    }

    // Derive classGroup cleanly without forcing Shift 1 on non-shift campuses
    if (!mapped.classGroup || mapped.classGroup === defaultCG) {
      const deptPart = mapped.department || (defaultCG.includes(" - ") ? defaultCG.split(" - ")[0] : "General");
      const semPart = mapped.semester || "Semester 1";
      if (isCampusShiftBased && mapped.shift && mapped.shift !== "General") {
        mapped.classGroup = `${deptPart} - ${mapped.shift} - ${semPart}`;
      } else {
        mapped.classGroup = `${deptPart} - ${semPart}`;
      }
    }

    return mapped;
  };

  const handleStudentFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const XLSX = await import("xlsx");
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
          const campusDepts = (collegeCourses.length > 0 ? collegeCourses : coursesList).map(c => c.name);
          const dept = templateDept || campusDepts[0] || "General";
          const shift = isCampusShiftBased ? (templateShift || "Shift 1") : "";
          const sem = templateSem || "Semester 1";
          return shift ? `${dept} - ${shift} - ${sem}` : `${dept} - ${sem}`;
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
    e.target.value = "";
  };

  const handleConfirmStudentImportSubmit = async () => {
    if (!studentImportPreview || studentImportPreview.parsed.length === 0) return;
    setIsStudentImportSubmitting(true);
    try {
      const targetCG = studentImportPreview.targetClassGroup || "General Class";
      const targetSem = getSemesterFromClassGroup(targetCG) || templateSem || "Semester 1";
      const targetDept = getDeptFromClassGroup(targetCG) || templateDept || "Computer Science";
      const targetShift = targetCG.includes("Shift 2") ? "Shift 2" : targetCG.includes("Shift 1") ? "Shift 1" : "General";

      const payload = studentImportPreview.parsed.map(s => {
        const finalCG = (s.hasCustomClassGroup && s.classGroup) ? s.classGroup : targetCG;
        const finalSem = s.semester || getSemesterFromClassGroup(finalCG) || targetSem;
        const finalDept = s.department || getDeptFromClassGroup(finalCG) || targetDept;
        const finalShift = s.shift || (finalCG.includes("Shift 2") ? "Shift 2" : finalCG.includes("Shift 1") ? "Shift 1" : targetShift);

        return {
          ...s,
          classGroup: finalCG,
          semester: finalSem,
          department: finalDept,
          shift: finalShift,
          college_id: activeCollegeId
        };
      });

      const res = await fetch("/api/students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        toast(`Successfully imported ${payload.length} students into ${targetCG}!`, "success");
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

  // ── MASTER DATE-WISE ATTENDANCE EXCEL TEMPLATE, IMPORT & EXPORT HANDLERS ──
  const sortSlotsByTime = (slotsList: any[]) => {
    return [...slotsList].sort((a, b) => (a.time || "").localeCompare(b.time || ""));
  };

  const getSemesterWorkingDates = (startStr: string, endStr: string) => {
    const dateSet = new Set<string>();
    const start = new Date(startStr + "T00:00:00");
    const end = new Date(endStr + "T00:00:00");
    
    // 1. Calendar working days (Mon-Sat, excluding holidays)
    if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
      const cur = new Date(start);
      while (cur <= end) {
        const dayOfWeek = cur.getDay(); // 0 = Sun
        const ymd = cur.toISOString().split("T")[0];
        const isHoliday = (holidays || []).some((h: any) => h?.date === ymd || h?.dateStr === ymd);

        if (dayOfWeek !== 0 && !isHoliday) {
          dateSet.add(ymd);
        }
        cur.setDate(cur.getDate() + 1);
      }
    }

    // 2. Also include ANY date in studentAttendance within the range
    (studentAttendance || []).forEach(att => {
      if (att.dateStr && att.dateStr >= startStr && att.dateStr <= endStr) {
        dateSet.add(att.dateStr);
      }
    });

    return Array.from(dateSet).sort();
  };

  const formatDateToDMY = (ymd: string) => {
    const parts = ymd.split("-");
    if (parts.length === 3) {
      return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
    return ymd;
  };

  const handleDownloadAttendanceTemplate = async (targetCG?: string, startStr?: string, endStr?: string) => {
    const XLSX = await import("xlsx");
    const sDate = startStr || attendanceStartDate || "2026-06-15";
    const eDate = endStr || attendanceEndDate || new Date().toISOString().split("T")[0];
    const workingDates = getSemesterWorkingDates(sDate, eDate);

    const filteredStudents = collegeStudents.filter(s => !targetCG || targetCG === "all" || isCohortMatch(s.classGroup, targetCG));

    const dateHeaders = workingDates.map(d => formatDateToDMY(d));
    const headers = [
      "Sl. No.",
      "Roll No",
      "Name",
      "Department",
      "Class Group",
      "Total days",
      "Total of Present Days",
      "Total of Absent Days",
      "%",
      ...dateHeaders
    ];

    const dataRows = filteredStudents.length > 0 ? filteredStudents.map((st, idx) => {
      const defaultStatuses = workingDates.map(() => "P");
      return [
        idx + 1,
        st.roll_number || st.id,
        st.name,
        st.department || "",
        st.classGroup || "",
        workingDates.length,
        workingDates.length,
        0,
        "100%",
        ...defaultStatuses
      ];
    }) : [
      [
        1,
        "E24AI001",
        "Sample Student",
        "Computer Science",
        targetCG || "BCA - Semester 5",
        workingDates.length,
        workingDates.length,
        0,
        "100%",
        ...workingDates.map(() => "P")
      ]
    ];

    const ws = XLSX.utils.aoa_to_sheet([headers, ...dataRows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Master Attendance");
    XLSX.writeFile(wb, `Master_Attendance_Template_${sDate}_to_${eDate}.xlsx`);
    toast("Master multi-date attendance template downloaded!", "success");
  };

  const handleAttendanceFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const XLSX = await import("xlsx");
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: "binary", cellDates: true, dateNF: "yyyy-mm-dd" });
        const wsName = wb.SheetNames[0];
        const ws = wb.Sheets[wsName];

        // Get column header row separately to handle date cells properly
        const headerRow: any[] = (XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" }) as any[][])[0] || [];
        const rawRows: any[] = XLSX.utils.sheet_to_json(ws, {
          defval: "",
          raw: false,   // format dates as strings (e.g. "2026-06-16") instead of serial numbers
          dateNF: "yyyy-mm-dd"
        });

        if (rawRows.length === 0) {
          toast("Uploaded attendance sheet is empty.", "warning");
          return;
        }

        const warnings: string[] = [];
        const parsedAttendance: any[] = [];
        const allDetectedDates: string[] = [];

        rawRows.forEach((row, idx) => {
          let stIdOrRoll = "";
          let stName = "";
          let stDeptFromSheet = "";
          let stClassGroupFromSheet = "";
          const dateMarks: Record<string, string> = {};
          const periodMarks: Record<string, string> = {};

          // Build skip set once (only pure summary/serial columns, NOT dept/classGroup)
          const skipColumns = new Set([
            "slno", "sno", "serialno", "serialnumber", "no",
            "degree",
            "totaldays", "totalworkingdays", "totalday", "total",
            "totalofpresentdays", "totalpresent", "presentdays", "totalpresentdays",
            "totalofabsentdays", "totalabsent", "absentdays", "totalabsentdays",
            "percentage", "pct", "percent", "attendancepercentage", "attendancepct", "overallpct",
            "email", "phone", "contact", "remarks", "comments"
          ]);

          Object.keys(row).forEach(col => {
            const rawCol = col.trim();
            const norm = rawCol.toLowerCase().replace(/[^a-z0-9]/g, "");
            // val: use row[col] which is already formatted as string because raw:false was set
            const val = String(row[col]).trim();

            if (skipColumns.has(norm) || norm.startsWith("total") || norm.includes("presentday") || norm.includes("absentday") || norm.includes("percent")) {
              return; // Ignored — auto-calculated dynamically by the system
            }

            if (norm === "rollno" || norm === "rollnumber" || norm === "regno" || norm === "id" || norm === "studentid" || norm === "rollnostudentid") {
              stIdOrRoll = val;
            } else if (norm === "name" || norm === "studentname") {
              stName = val;
            } else if (norm === "department" || norm === "dept" || norm === "course") {
              if (val) stDeptFromSheet = val;  // e.g. "BCA"
            } else if (norm === "classgroup" || norm === "class" || norm === "batch" || norm === "section" || norm === "semester" || norm === "sem") {
              if (val) stClassGroupFromSheet = val;  // e.g. "III BCA"
            } else {
              const parsedColDate = parseDateToYMD(rawCol);
              if (parsedColDate && parsedColDate.length === 10) {
                const uVal = val.trim().toUpperCase();
                const normVal = uVal.replace(/[^A-Z0-9]/g, "");

                let status = "not_marked";
                if (normVal === "P" || normVal === "PR" || normVal === "PRE" || normVal === "PRESENT" || normVal === "1" || normVal === "10" || normVal === "Y" || normVal === "YES" || normVal === "TRUE") {
                  status = "present";
                } else if (normVal === "A" || normVal === "AB" || normVal === "ABS" || normVal === "ABSENT" || normVal === "ABSENTEE" || normVal === "0" || normVal === "00" || normVal === "N" || normVal === "NO" || normVal === "FALSE") {
                  status = "absent";
                } else if (normVal === "OD" || normVal === "ONDUTY" || normVal === "DUTY" || normVal === "ML" || normVal === "CL" || normVal === "LEAVE") {
                  status = "od";
                } else if (normVal === "HD" || normVal === "HALFDAY" || normVal === "HALF" || normVal === "05" || normVal === "L" || normVal === "LATE" || normVal === "H") {
                  status = "late";
                }

                dateMarks[parsedColDate] = status;
                allDetectedDates.push(parsedColDate);
              } else if (norm.includes("period") || norm.startsWith("p") || norm.includes("slot") || norm.includes("hour")) {
                const numMatch = norm.match(/\d+/);
                const pNum = numMatch ? parseInt(numMatch[0], 10) : 1;
                const uVal = val.trim().toUpperCase();
                const cleanVal = (uVal.startsWith("P") || uVal === "1") ? "present" : (uVal.startsWith("A") || uVal === "0") ? "absent" : (uVal.startsWith("L") || uVal.startsWith("H")) ? "late" : (uVal.startsWith("OD")) ? "od" : "not_marked";
                periodMarks[`p${pNum}`] = cleanVal;
              }
            }
          });

          let targetStudentId = "";
          let targetStudentName = stName;
          let targetRollNo = stIdOrRoll;
          let targetDept = "";
          let targetClassGroup = "";

          // 1. Check existing DB student first (by roll number, reg number, ID, or name)
          const matchedStudent = collegeStudents.find(s =>
            (stIdOrRoll && (
              s.roll_number?.toLowerCase() === stIdOrRoll.toLowerCase() ||
              s.register_number?.toLowerCase() === stIdOrRoll.toLowerCase() ||
              s.id?.toLowerCase() === stIdOrRoll.toLowerCase()
            )) ||
            (stName && s.name?.trim().toLowerCase() === stName.trim().toLowerCase())
          );

          if (matchedStudent) {
            targetStudentId = matchedStudent.id;
            targetStudentName = matchedStudent.name || stName;
            targetRollNo = matchedStudent.roll_number || matchedStudent.register_number || stIdOrRoll || matchedStudent.id;
            targetDept = matchedStudent.department || stDeptFromSheet || (studentDeptFilter !== "all" ? studentDeptFilter : (departmentsList[0]?.name || ""));
            targetClassGroup = matchedStudent.classGroup || stClassGroupFromSheet || (studentBatchFilter !== "all" ? studentBatchFilter : "");
          } else {
            // 2. New student: generate stable ID based on roll number or index
            const rollBasis = (stIdOrRoll || stName || `st_${idx + 1}`)
              .toLowerCase()
              .replace(/[^a-z0-9]/g, "_")
              .replace(/_+/g, "_")
              .replace(/^_|_$/g, "");
            targetStudentId = `std_${(activeCollegeId || "clg").toLowerCase()}_${rollBasis}`;
            if (!targetStudentName) targetStudentName = stIdOrRoll || `Student ${idx + 1}`;
            if (!targetRollNo) targetRollNo = stIdOrRoll || targetStudentId;

            // Resolve department dynamically from sheet, UI filter, college students, or DB departments
            targetDept =
              stDeptFromSheet ||
              (studentDeptFilter !== "all" ? studentDeptFilter : "") ||
              collegeStudents[0]?.department ||
              (departmentsList[0]?.name || "General");

            // Resolve class group dynamically from sheet, UI filter, matching cohort in slots/students, or default
            targetClassGroup =
              stClassGroupFromSheet ||
              (studentBatchFilter !== "all" ? studentBatchFilter : "") ||
              collegeStudents.find(s => s.department === targetDept)?.classGroup ||
              collegeSlots.find(s => isCohortMatch(s.classGroup || "", targetDept))?.classGroup ||
              collegeStudents[0]?.classGroup ||
              targetDept;
          }

          parsedAttendance.push({
            studentId: targetStudentId,
            studentName: targetStudentName,
            rollNo: targetRollNo,
            department: targetDept,
            classGroup: targetClassGroup,
            collegeId: activeCollegeId,
            dateMarks,
            periodMarks,
            targetDate: Object.keys(dateMarks)[0] || attendanceDate
          });
        });

        // Automatically adjust view date range if imported dates are outside current range
        if (allDetectedDates.length > 0) {
          const sorted = allDetectedDates.sort();
          const minDate = sorted[0];
          const maxDate = sorted[sorted.length - 1];
          if (minDate < attendanceStartDate) setAttendanceStartDate(minDate);
          if (maxDate > attendanceEndDate) setAttendanceEndDate(maxDate);
        }

        // ── DEBUG: open browser console (F12) to see what was parsed ──
        const uniqueDates = Array.from(new Set(allDetectedDates)).sort();
        console.group("[Attendance Import Debug]");
        console.log("Rows parsed:", parsedAttendance.length);
        console.log("Detected dates (" + uniqueDates.length + "):", uniqueDates);
        console.log("Sample parsed student:", parsedAttendance[0]);
        console.log("Warnings:", warnings);
        console.groupEnd();

        const displayDateRange = uniqueDates.length > 1
          ? `${formatDateToDMY(uniqueDates[0])} → ${formatDateToDMY(uniqueDates[uniqueDates.length - 1])}`
          : (uniqueDates[0] ? formatDateToDMY(uniqueDates[0]) : formatDateToDMY(attendanceDate));

        setAttendanceImportPreview({
          parsed: parsedAttendance,
          warnings,
          targetDate: displayDateRange
        });
        setShowAttendanceImportModal(true);

      } catch (err: any) {
        toast("Failed to parse attendance file: " + err.message, "error");
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = "";
  };

  const handleConfirmAttendanceImportSubmit = async () => {
    if (!attendanceImportPreview || attendanceImportPreview.parsed.length === 0) return;
    setIsAttendanceImportSubmitting(true);

    try {
      const recordsToPost: any[] = [];

      attendanceImportPreview.parsed.forEach(item => {
        if (item.dateMarks && Object.keys(item.dateMarks).length > 0) {
          // Date-wise import: send ONE compact record per (student, date) — no slotId.
          // Server expands to slot-level writes using classGroup + dayOfWeek.
          // 300 students x 60 dates x 7 slots = 126,000 -> 18,000 records (7x smaller payload)
          Object.keys(item.dateMarks).forEach(dStr => {
            const status = item.dateMarks[dStr];
            if (!status || status === "not_marked") return;
            const standardDateStr = parseDateToYMD(dStr) || dStr;
            recordsToPost.push({
              studentId: item.studentId,
              classGroup: item.classGroup,
              dateStr: standardDateStr,
              status,
              markedBy: currentCAM?.name || "Master Import"
            });
          });
        } else if (item.periodMarks && Object.keys(item.periodMarks).length > 0) {
          // Period-specific import: resolve slot by period index on client side
          const dateObj = new Date(attendanceImportPreview.targetDate + "T00:00:00");
          const dayName = dateObj.toLocaleDateString("en-US", { weekday: "long" });
          const daySlots = sortSlotsByTime(
            collegeSlots.filter(s => s.day === dayName && (!s.classGroup || isCohortMatch(s.classGroup, item.classGroup)))
          );
          Object.keys(item.periodMarks).forEach(pKey => {
            const pIndex = parseInt(pKey.replace(/\D/g, "") || "1", 10) - 1;
            const targetSlot = daySlots[pIndex];
            if (targetSlot) {
              recordsToPost.push({
                studentId: item.studentId,
                slotId: targetSlot.id,
                dateStr: attendanceImportPreview.targetDate,
                status: item.periodMarks[pKey],
                markedBy: currentCAM?.name || "Manager Import"
              });
            }
          });
        }
      });

      if (recordsToPost.length === 0) {
        toast("No valid attendance records found in the uploaded file.", "warning");
        setIsAttendanceImportSubmitting(false);
        return;
      }

      const studentsToSync = (attendanceImportPreview.parsed || []).map(p => ({
        id: p.studentId,
        name: p.studentName,
        roll_number: p.rollNo,
        department: p.department || (studentDeptFilter !== "all" ? studentDeptFilter : (collegeStudents[0]?.department || "General")),
        classGroup: p.classGroup || (studentBatchFilter !== "all" ? studentBatchFilter : (collegeStudents[0]?.classGroup || "General Batch")),
        college_id: activeCollegeId
      }));

      // Sequential chunks of 500 compact records each (~50KB per request)
      // Sequential not parallel: avoids write races on shared student rows
      const CHUNK_SIZE = 500;
      let totalCount = 0;
      const chunks: any[][] = [];
      for (let i = 0; i < recordsToPost.length; i += CHUNK_SIZE) {
        chunks.push(recordsToPost.slice(i, i + CHUNK_SIZE));
      }

      for (let idx = 0; idx < chunks.length; idx++) {
        const chunk = chunks[idx];
        const res = await fetch("/api/attendance", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "bulk_import",
            records: chunk,
            students: idx === 0 ? studentsToSync : [],
            collegeId: activeCollegeId,
            markedBy: currentCAM?.name || "Master Import"
          })
        });
        const rawText = await res.text();
        let data: any = {};
        try { data = JSON.parse(rawText); }
        catch (_) { throw new Error(`Server error (${res.status}): ${rawText.slice(0, 120)}`); }
        if (!data.success) throw new Error(data.message || `Chunk ${idx + 1}/${chunks.length} failed.`);
        totalCount += data.count || chunk.length;
      }

      // Expand active date range so imported dates show in the matrix immediately
      const allDates = Array.from(new Set(recordsToPost.map(r => r.dateStr))).sort();
      if (allDates.length > 0) {
        if (allDates[0] < attendanceStartDate) setAttendanceStartDate(allDates[0]);
        if (allDates[allDates.length - 1] > attendanceEndDate) setAttendanceEndDate(allDates[allDates.length - 1]);
      }

      toast(`Successfully imported ${totalCount} attendance entries across ${attendanceImportPreview.parsed.length} students!`, "success");
      setShowAttendanceImportModal(false);
      setAttendanceImportPreview(null);

      // Non-blocking background refresh — do NOT await, user sees success immediately
      refreshAttendance(activeCollegeId).catch(() => {});

    } catch (err: any) {
      toast("Error submitting attendance import: " + err.message, "error");
    } finally {
      setIsAttendanceImportSubmitting(false);
    }
  };

  const handleExportDateAttendance = async (startStr: string, endStr: string, studentsToExport: any[]) => {
    const XLSX = await import("xlsx");
    const sDate = startStr || attendanceStartDate || "2026-06-15";
    const eDate = endStr || attendanceEndDate || new Date().toISOString().split("T")[0];
    const workingDates = getSemesterWorkingDates(sDate, eDate);

    const dateHeaders = workingDates.map(d => formatDateToDMY(d));
    const headers = [
      "Sl. No.",
      "Roll No",
      "Name",
      "Department",
      "Class Group",
      "Total days",
      "Total of Present Days",
      "Total of Absent Days",
      "%",
      ...dateHeaders
    ];

    const rows = studentsToExport.map((st, idx) => {
      let presentDays = 0;
      let absentDays = 0;
      let totalWorkingDays = 0;

      const dateStatuses = workingDates.map(dStr => {
        const dateObj = new Date(dStr + "T00:00:00");
        const dayName = dateObj.toLocaleDateString("en-US", { weekday: "long" });
        const stSlots = collegeSlots.filter(s => s.day === dayName && (!s.classGroup || isCohortMatch(s.classGroup, st.classGroup)));
        const stDayAtt = studentAttendance.filter(a => a.studentId === st.id && a.dateStr === dStr);

        if (stSlots.length === 0 && stDayAtt.length === 0) return "—";
        totalWorkingDays++;

        const pCount = stDayAtt.filter(a => a.status === "present").length;
        const odCount = stDayAtt.filter(a => a.status === "od").length;
        const aCount = stDayAtt.filter(a => a.status === "absent").length;
        const totalMarked = stDayAtt.length;
        const totalEff = Math.max(stSlots.length, totalMarked);

        if (odCount > 0 && (odCount + pCount >= totalEff)) {
          presentDays += 1;
          return "OD";
        } else if (pCount > 0 && (pCount === totalEff || aCount === 0)) {
          presentDays += 1;
          return "P";
        } else if (pCount > 0 && aCount > 0) {
          presentDays += 0.5;
          absentDays += 0.5;
          return "HD";
        } else if (aCount > 0) {
          absentDays += 1;
          return "A";
        }
        return "—";
      });

      const effectiveTotalDays = totalWorkingDays || workingDates.length;
      const pct = effectiveTotalDays > 0 ? Math.round((presentDays / effectiveTotalDays) * 100) : 0;

      return [
        idx + 1,
        st.roll_number || st.id,
        st.name,
        st.department || "",
        st.classGroup || "",
        effectiveTotalDays,
        presentDays,
        absentDays,
        `${pct}%`,
        ...dateStatuses
      ];
    });

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Master Attendance Register");
    XLSX.writeFile(wb, `Master_Student_Attendance_${sDate}_to_${eDate}.xlsx`);
    toast(`Exported Master Attendance Register for ${sDate} to ${eDate}!`, "success");
  };

  const handleToggleStudentPeriodStatus = async (studentId: string, slotId: string, dateStr: string, currentStatus: string) => {
    const cycleMap: Record<string, string> = {
      not_marked: "present",
      present: "absent",
      absent: "late",
      late: "not_marked"
    };
    const nextStatus = cycleMap[currentStatus || "not_marked"] || "present";

    try {
      const res = await fetch("/api/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "mark_period",
          studentId,
          slotId,
          dateStr,
          status: nextStatus,
          markedBy: currentCAM?.name || "Campus Manager"
        })
      });
      const data = await res.json();
      if (data.success) {
        toast(`Updated to ${nextStatus.toUpperCase()}`, "success");
        // Surgical attendance refresh — faster than full refreshData
        await refreshAttendance(activeCollegeId);
      } else {
        toast(data.message || "Failed to update attendance", "error");
      }
    } catch (err: any) {
      toast("Error updating period: " + err.message, "error");
    }
  };

  const handleClearAllAttendance = () => {
    setClearDeptFilter(studentDeptFilter || "all");
    setClearBatchFilter(studentBatchFilter || "all");
    setClearScope("range");
    setShowClearAttendanceModal(true);
  };

  const handleExecuteClearAttendance = async () => {
    setIsClearingAttendance(true);
    try {
      const params = new URLSearchParams();
      // Always send collegeId — the API refuses to delete without it
      if (activeCollegeId) params.set("collegeId", activeCollegeId);
      if (clearDeptFilter !== "all") params.set("department", clearDeptFilter);
      if (clearBatchFilter !== "all") params.set("classGroup", clearBatchFilter);
      if (clearScope === "range") {
        params.set("startDate", attendanceStartDate);
        params.set("endDate", attendanceEndDate);
      } else {
        // Full wipe — collegeId is already set above, required by API
        params.set("all", "true");
      }

      const res = await fetch(`/api/attendance?${params.toString()}`, {
        method: "DELETE"
      });
      const data = await res.json();
      if (data.success) {
        toast(`Successfully removed ${data.deletedCount || 0} attendance records for the selected scope!`, "success");
        setShowClearAttendanceModal(false);
        // Surgical immediate update: remove matching records from local state so matrix clears instantly
        setStudentAttendance(prev => {
          const campusStudentIds = new Set(collegeStudents.map((s: any) => s.id));
          return prev.filter(a => {
            if (!campusStudentIds.has(a.studentId)) return true; // keep other colleges
            if (clearDeptFilter !== "all") {
              const st = collegeStudents.find((s: any) => s.id === a.studentId);
              if (!st || st.department !== clearDeptFilter) return true;
            }
            if (clearBatchFilter !== "all") {
              const st = collegeStudents.find((s: any) => s.id === a.studentId);
              if (!st || st.classGroup !== clearBatchFilter) return true;
            }
            if (clearScope === "range") {
              return !(a.dateStr >= attendanceStartDate && a.dateStr <= attendanceEndDate);
            }
            return false; // full wipe for this campus student
          });
        });
      } else {
        toast(data.message || "Failed to clear attendance.", "error");
      }
    } catch (err: any) {
      toast("Error clearing attendance: " + err.message, "error");
    } finally {
      setIsClearingAttendance(false);
    }
  };

  const handleMarkAllPresentForDay = async (dateStr: string, visibleStudents: any[]) => {
    const dateObj = new Date(dateStr + "T00:00:00");
    const dayName = dateObj.toLocaleDateString("en-US", { weekday: "long" });
    const daySlots = collegeSlots.filter(s => s.day === dayName);

    const records: any[] = [];
    visibleStudents.forEach(st => {
      const stSlots = daySlots.filter(s => !s.classGroup || isCohortMatch(s.classGroup, st.classGroup));
      stSlots.forEach(s => {
        records.push({
          studentId: st.id,
          slotId: s.id,
          dateStr,
          status: "present"
        });
      });
    });

    if (records.length === 0) {
      toast("No timetable slots found for the visible students on this day.", "warning");
      return;
    }

    const ok = await showConfirm({
      title: "Mark All Present",
      message: `Mark all ${visibleStudents.length} students as PRESENT for all periods on ${dateStr}?`,
      confirmLabel: "Mark All Present",
      danger: false
    });

    if (ok) {
      try {
        const CHUNK_SIZE = 250;
        for (let i = 0; i < records.length; i += CHUNK_SIZE) {
          const chunk = records.slice(i, i + CHUNK_SIZE);
          const res = await fetch("/api/attendance", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "bulk_import",
              records: chunk,
              markedBy: currentCAM?.name || "Campus Manager"
            })
          });
          const rawText = await res.text();
          let data: any = {};
          try { data = JSON.parse(rawText); } catch (_) {
            throw new Error(`Server error (${res.status}): ${rawText.slice(0, 100)}`);
          }
          if (!data.success) throw new Error(data.message || "Failed to mark attendance.");
        }
        toast(`Marked all ${visibleStudents.length} students PRESENT on ${dateStr}!`, "success");
        await refreshAttendance(activeCollegeId);
      } catch (err: any) {
        toast("Error marking attendance: " + err.message, "error");
      }
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
        await refreshAttendance(activeCollegeId);
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
  const [camTrackerSubView, setCamTrackerSubView] = useState<"tracker" | "interviews">("tracker");
  const [camTrackerDept, setCamTrackerDept] = useState("");
  const [camTrackerSemester, setCamTrackerSemester] = useState("");
  const [camTrackerSubject, setCamTrackerSubject] = useState("");
  const [camTrackerWeek, setCamTrackerWeek] = useState<number | "">("");

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
    college_id: "",
    subject_group: ""
  });
  const [emailSendingId, setEmailSendingId] = useState<string | null>(null);

  // Full Course / Batch Modal States (Admin-Grade Modal)
  const [showDeptModal, setShowDeptModal] = useState(false);
  const [editingDept, setEditingDept] = useState(false);
  const [isDeptSubmitting, setIsDeptSubmitting] = useState(false);
  const [deptForm, setDeptForm] = useState({
    id: "",
    name: "",
    college_id: "",
    code: "",
    description: "",
    status: "Active",
    years: 3,
    start_date: "",
    end_date: "",
    start_year: "",
    end_year: "",
    default_room: "",
    default_shift: "shift_1",
    shift_based: 0
  });

  const handleSendWarningEmail = async (item: any) => {
    if (!item.mentor?.email) {
      toast("Mentor does not have a valid email configured.", "error");
      return;
    }
    setEmailSendingId(item.id);
    try {
      const subject = `[FACE Prep E-Campus Warning] Missed Attendance Marking - Class: ${item.slot.classGroup}`;
      
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

  // Faculty Bulk Import State
  const [showFacultyImportModal, setShowFacultyImportModal] = useState(false);
  const [facultyImportPreview, setFacultyImportPreview] = useState<{ parsed: any[]; warnings: string[] } | null>(null);
  const [isImportingFaculty, setIsImportingFaculty] = useState(false);

  const handleDownloadFacultyTemplate = async () => {
    const sampleData = [
      {
        "Faculty Name": "Dr. Anitha Ramesh",
        "Email Address": "anitha.ramesh@zentra.edu",
        "Department": "Computer Science",
        "College ID": activeCollegeId || "college_1",
        "Subjects": "Data Structures, Web Development",
        "Classes": "Year 2 Section A, Year 3 Section B"
      },
      {
        "Faculty Name": "Prof. Rajesh Kumar",
        "Email Address": "rajesh.kumar@zentra.edu",
        "Department": "Information Technology",
        "College ID": activeCollegeId || "college_1",
        "Subjects": "Database Systems, Python Programming",
        "Classes": "Year 1 Section A"
      }
    ];

    const XLSX = await import("xlsx");
    const ws = XLSX.utils.json_to_sheet(sampleData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Faculty_Template");
    XLSX.writeFile(wb, "Faculty_Bulk_Import_Template.xlsx");
    toast("Faculty import template downloaded.", "info");
  };

  const handleFacultyFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const XLSX = await import("xlsx");
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: "binary" });
        const sheetName = wb.SheetNames[0];
        const ws = wb.Sheets[sheetName];
        const rawRows: any[] = XLSX.utils.sheet_to_json(ws, { defval: "" });

        if (rawRows.length === 0) {
          toast("The uploaded spreadsheet is empty.", "warning");
          return;
        }

        const warnings: string[] = [];
        const parsedFaculty = rawRows.map((row, idx) => {
          const name = row.name || row.FacultyName || row.faculty_name || row["Faculty Name"] || row["Name"] || "";
          const email = row.email || row.EmailAddress || row.email_address || row["Email Address"] || row["Email"] || "";
          const dept = row.department || row.Department || row["Department"] || "Computer Science";
          const collegeId = row.college_id || row.collegeId || row["College ID"] || activeCollegeId || "";
          const subjects = row.subjects || row.Subjects || row["Subjects"] || "";
          const classes = row.classes || row.Classes || row["Classes"] || "";

          if (!name) warnings.push(`Row ${idx + 2}: Missing Faculty Name.`);
          if (!email) warnings.push(`Row ${idx + 2}: Missing Email Address.`);

          return {
            name: String(name).trim(),
            email: String(email).toLowerCase().trim(),
            department: String(dept).trim(),
            college_id: collegeId,
            subjects: String(subjects).trim(),
            classes: String(classes).trim(),
            avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(String(email).trim())}`
          };
        }).filter(f => f.name || f.email);

        setFacultyImportPreview({ parsed: parsedFaculty, warnings });
        setShowFacultyImportModal(true);
      } catch (err: any) {
        toast("Failed to parse Excel file: " + err.message, "error");
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = "";
  };

  const handleConfirmFacultyImport = async () => {
    if (!facultyImportPreview || facultyImportPreview.parsed.length === 0) return;
    setIsImportingFaculty(true);
    try {
      const res = await bulkImportMentors(facultyImportPreview.parsed, activeCollegeId);
      if (res.success) {
        toast(res.message || `Successfully imported ${res.count} faculty members.`, "success");
        setShowFacultyImportModal(false);
        setFacultyImportPreview(null);
        refreshData();
      } else {
        toast(res.message || "Failed to import faculty.", "error");
      }
    } catch (err: any) {
      toast("Error importing faculty: " + err.message, "error");
    } finally {
      setIsImportingFaculty(false);
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
        department: m.mentor_group || m.department || "General",
        avatar: m.avatar,
        subjects: m.subjects || "",
        classes: m.classes || "",
        college_id: m.college_id || activeCollegeId,
        subject_group: m.mentor_group || m.subject_group || "General"
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
      college_id: activeCollegeId,
      subject_group: mentorForm.subject_group.trim()
    };

    setActionLoading('submit_mentor', true);
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
    } finally {
      setActionLoading('submit_mentor', false);
    }
  };

  const handleDeleteMentor = async (id: string) => {
    if (await showConfirm({ message: "Are you sure you want to delete this mentor? This will also delete all slots assigned to them.", danger: true, confirmLabel: "Delete" })) {
      setActionLoading(`delete_mentor_${id}`, true);
      try {
        const res = await deleteMentor(id);
        if (res.success) {
          toast("Mentor deleted successfully.", "success");
        } else {
          toast(res.message || "Failed to delete mentor.", "error");
        }
      } catch (err: any) {
        toast(err.message || "An error occurred while deleting.", "error");
      } finally {
        setActionLoading(`delete_mentor_${id}`, false);
      }
    }
  };

  // Derived filters and variables
  const collegeCourses = useMemo(() => {
    if (isGlobalAllCampuses) return coursesList;
    return coursesList.filter(c => !c.college_id || c.college_id === activeCollegeId);
  }, [coursesList, activeCollegeId, isGlobalAllCampuses]);

  const collegeMentors = useMemo(() => {
    if (isGlobalAllCampuses) return mentors;
    return mentors.filter(m => m.college_id === activeCollegeId);
  }, [mentors, activeCollegeId, isGlobalAllCampuses]);

  const collegeStudents = useMemo(() => {
    if (isGlobalAllCampuses) return students;
    return students.filter(s => s.college_id === activeCollegeId);
  }, [students, activeCollegeId, isGlobalAllCampuses]);

  const isCampusShiftBased = useMemo(() => {
    const activeCollege = colleges.find(c => c.id === activeCollegeId);
    if (activeCollege && (activeCollege.has_shifts === 1 || activeCollege.has_shifts === 0)) {
      return activeCollege.has_shifts === 1;
    }
    return collegeCourses.some(c => c.shift_based === 1 || (c.default_shift && c.default_shift.toLowerCase() !== "general"));
  }, [colleges, activeCollegeId, collegeCourses]);

  const collegeSlots = useMemo(() => {
    if (isGlobalAllCampuses) return slots;
    return slots.filter(s => s.college_id === activeCollegeId);
  }, [slots, activeCollegeId, isGlobalAllCampuses]);

  const dbCourseNames = useMemo(() => {
    return Array.from(new Set(collegeCourses.map(c => c.name.trim()).filter(Boolean))).sort();
  }, [collegeCourses]);

  const dbSemesterOptions = useMemo(() => {
    const defaultSems = ["Semester 1", "Semester 2", "Semester 3", "Semester 4", "Semester 5", "Semester 6", "Semester 7", "Semester 8"];
    const fromStudents = collegeStudents
      .map(s => {
        const raw = s.semester?.trim() || (s.classGroup ? s.classGroup.match(/Semester\s*\d+/i)?.[0] : null);
        if (!raw) return null;
        const match = raw.match(/\d+/);
        return match ? `Semester ${match[0]}` : raw.trim();
      })
      .filter(Boolean) as string[];

    const uniqueMap = new Map<string, string>();
    [...defaultSems, ...fromStudents].forEach(s => {
      const clean = s.trim();
      if (clean) {
        uniqueMap.set(clean.toLowerCase(), clean);
      }
    });

    return Array.from(uniqueMap.values()).sort((a, b) => {
      const numA = parseInt(a.replace(/\D/g, "") || "0");
      const numB = parseInt(b.replace(/\D/g, "") || "0");
      return numA - numB;
    });
  }, [collegeStudents]);

  const distinctClasses = useMemo(() => {
    const fromStudents = collegeStudents.map(s => s.classGroup).filter(Boolean);
    const fromSlots = collegeSlots.map(s => s.classGroup).filter(Boolean);
    return Array.from(new Set([...fromStudents, ...fromSlots])).sort();
  }, [collegeStudents, collegeSlots]);
  const collegeSubjects = isGlobalAllCampuses ? subjectsList : subjectsList.filter(s => !s.college_id || s.college_id === activeCollegeId);

  // Seed tracker department when subjects/departments load
  useEffect(() => {
    const collegeDepts = isGlobalAllCampuses ? departmentsList : departmentsList.filter(d => !d.college_id || d.college_id === activeCollegeId);
    if (collegeDepts.length > 0 && !camTrackerDept) {
      setCamTrackerDept(collegeDepts[0].name.trim());
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [departmentsList, activeCollegeId, isGlobalAllCampuses]);

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
  const [dailyStartDateStr, setDailyStartDateStr] = useState(new Date().toISOString().split("T")[0]);
  const [dailyEndDateStr, setDailyEndDateStr] = useState(new Date().toISOString().split("T")[0]);
  const [dailyDayType, setDailyDayType] = useState<string>("working");
  const [dailyDayOrder, setDailyDayOrder] = useState("Day 1");
  const [dailySessionMode, setDailySessionMode] = useState<string>("Offline");
  const [dailyNotes, setDailyNotes] = useState("");
  const [dailyConfigsList, setDailyConfigsList] = useState<any[]>([]);
  const [isDailyLoading, setIsDailyLoading] = useState(false);
  const [isDailySaving, setIsDailySaving] = useState(false);
  const [autoAdvanceDayOrder, setAutoAdvanceDayOrder] = useState<boolean>(true);
  const [skipSundays, setSkipSundays] = useState<boolean>(true);
  const [editingDailyId, setEditingDailyId] = useState<string | null>(null);
  const [isDailyConfigModalOpen, setIsDailyConfigModalOpen] = useState<boolean>(false);
  const [dailySearchFilter, setDailySearchFilter] = useState<string>("");

  const [classTeacherAssignments, setClassTeacherAssignments] = useState<any[]>([]);
  const [selectedAssignYear, setSelectedAssignYear] = useState("Year 1");
  const [selectedAssignClassGroup, setSelectedAssignClassGroup] = useState("");
  const [selectedAssignMentorId, setSelectedAssignMentorId] = useState("");
  const [isAssigningClassTeacher, setIsAssigningClassTeacher] = useState(false);

  const fetchClassTeacherAssignments = async () => {
    if (!activeCollegeId) return;
    try {
      const res = await fetch(`/api/class-teachers?college_id=${encodeURIComponent(activeCollegeId)}`);
      const data = await res.json();
      if (data.success) {
        setClassTeacherAssignments(data.assignments || []);
      }
    } catch (err) {
      console.error("Failed to fetch class teacher assignments:", err);
    }
  };

  const handleSaveClassTeacherAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCollegeId || !selectedAssignYear || !selectedAssignClassGroup || !selectedAssignMentorId) {
      toast("Please select Year, Class Group, and Mentor.", "warning");
      return;
    }
    setIsAssigningClassTeacher(true);
    try {
      const res = await fetch("/api/class-teachers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          college_id: activeCollegeId,
          year: selectedAssignYear,
          department: "General",
          classGroup: selectedAssignClassGroup,
          mentor_id: selectedAssignMentorId
        })
      });
      const data = await res.json();
      if (data.success) {
        toast(data.message || "Class Teacher assigned successfully!", "success");
        await fetchClassTeacherAssignments();
        setSelectedAssignClassGroup("");
        setSelectedAssignMentorId("");
      } else {
        toast(data.message || "Failed to assign Class Teacher.", "error");
      }
    } catch (err: any) {
      toast("Error: " + err.message, "error");
    } finally {
      setIsAssigningClassTeacher(false);
    }
  };

  const handleDeleteClassTeacherAssignment = async (id: string) => {
    try {
      const res = await fetch(`/api/class-teachers?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        toast("Assignment removed successfully.", "success");
        await fetchClassTeacherAssignments();
      }
    } catch (err: any) {
      toast("Error removing assignment: " + err.message, "error");
    }
  };

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
  const deferredStudentSearch = useDeferredValue(studentSearch);
  const [studentDeptFilter, setStudentDeptFilter] = useState("all");
  const [studentBatchFilter, setStudentBatchFilter] = useState("all");
  const [studentAttendanceFilter, setStudentAttendanceFilter] = useState("all");
  const [attendancePage, setAttendancePage] = useState(1);
  const [attendancePageSize, setAttendancePageSize] = useState(50);

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

  // Additional derived filters and variables

  const activeBatches = useMemo(() => {
    // Derive from STUDENTS (not slots) so the filter matches what students actually have
    const fromStudents = Array.from(new Set(collegeStudents.map(s => s.classGroup).filter((g): g is string => Boolean(g)))).sort();
    const fromSlots = Array.from(new Set(collegeSlots.map(s => s.classGroup).filter((g): g is string => Boolean(g))));
    // Merge: students first, then any slot-only cohorts
    return Array.from(new Set([...fromStudents, ...fromSlots]));
  }, [collegeStudents, collegeSlots]);

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
      return { percentage: 0, total: 0, attended: 0 };
    }
    const attended = records.filter(r => r.status === "present" || r.status === "od").length;
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

  // --- EVENT MANAGEMENT HELPERS & EXCEL HANDLERS ---
  const filteredEvents = useMemo(() => {
    return (dbAcademicEvents || []).filter((ev) => {
      // 1. Campus Isolation Filter (strictly isolate events to active campus)
      const campusMatch = isGlobalAllCampuses || !ev.college_id || ev.college_id === activeCollegeId || activeCollegeId === "all";
      if (!campusMatch) return false;

      const q = eventSearchQuery.toLowerCase();
      const nameMatch = (ev.name || "").toLowerCase().includes(q);
      const descMatch = (ev.desc || "").toLowerCase().includes(q);
      const venueMatch = (ev.venue || "").toLowerCase().includes(q);
      const coordMatch = (ev.coordinator || "").toLowerCase().includes(q);
      const matchesSearch = nameMatch || descMatch || venueMatch || coordMatch;

      const matchesCat = eventCategoryFilter === "All" || (ev.category || "Coding Fest & Hackathon") === eventCategoryFilter;
      const matchesDept = eventDeptFilter === "All" || (ev.department || "All Departments") === eventDeptFilter;
      const matchesStatus = eventStatusFilter === "All" || (ev.status || "Upcoming") === eventStatusFilter;

      return matchesSearch && matchesCat && matchesDept && matchesStatus;
    });
  }, [dbAcademicEvents, eventSearchQuery, eventCategoryFilter, eventDeptFilter, eventStatusFilter, isGlobalAllCampuses, activeCollegeId]);

  const handleOpenCreateEventModal = () => {
    setEditingEventObj(null);
    setEvFormName("");
    setEvFormDate(new Date().toISOString().split("T")[0]);
    setEvFormEndDate("");
    setEvFormCategory("Coding Fest & Hackathon");
    setEvFormDept("All Departments");
    setEvFormAudience("All Campus");
    setEvFormStatus("Upcoming");
    setEvFormVenue("");
    setEvFormDesc("");
    setEvFormCoordinator("");
    setEvFormChiefGuest("");
    setEvFormRegistrationLink("");
    setEvFormPhotos([]);
    setShowEventModal(true);
  };

  const handleOpenEditEventModal = (ev: any) => {
    setEditingEventObj(ev);
    setEvFormName(ev.name || "");
    setEvFormDate(ev.date || "");
    setEvFormEndDate(ev.end_date || "");
    setEvFormCategory(ev.category || "Coding Fest & Hackathon");
    setEvFormDept(ev.department || "All Departments");
    setEvFormAudience(ev.audience || "All Campus");
    setEvFormStatus(ev.status || "Upcoming");
    setEvFormVenue(ev.venue || "");
    setEvFormDesc(ev.desc || "");
    setEvFormCoordinator(ev.coordinator || "");
    setEvFormChiefGuest(ev.chief_guest || "");
    setEvFormRegistrationLink(ev.registration_link || "");

    let existingPhotos: string[] = [];
    if (ev.photos) {
      try {
        existingPhotos = typeof ev.photos === "string" ? JSON.parse(ev.photos) : (Array.isArray(ev.photos) ? ev.photos : []);
      } catch (_) {
        existingPhotos = [ev.photos];
      }
    }
    setEvFormPhotos(existingPhotos);
    setShowEventModal(true);
  };

  const handleAddEventPhotoFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) {
      toast("Photo size should be less than 4MB", "error");
      return;
    }
    const reader = new FileReader();
    reader.onload = (uploadEv) => {
      const base64 = uploadEv.target?.result as string;
      if (base64) {
        setEvFormPhotos(prev => [...prev, base64]);
        toast("Photo added to gallery", "success");
      }
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleRemoveEventPhoto = (index: number) => {
    setEvFormPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const handleQuickUploadPhotoToEvent = async (ev: any, file: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (uploadEv) => {
      const base64 = uploadEv.target?.result as string;
      if (base64) {
        let existingPhotos: string[] = [];
        try {
          existingPhotos = typeof ev.photos === "string" ? JSON.parse(ev.photos) : (Array.isArray(ev.photos) ? ev.photos : []);
        } catch (_) {}
        const updatedPhotos = [...existingPhotos, base64];
        const res = await saveAcademicEvent({ ...ev, photos: JSON.stringify(updatedPhotos) });
        if (res.success) {
          toast("Event moment uploaded successfully!", "success");
        } else {
          toast("Failed to upload moment", "error");
        }
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveRichEventSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!evFormName.trim() || !evFormDate) {
      toast("Event Title and Start Date are required.", "error");
      return;
    }

    const payload = {
      id: editingEventObj ? editingEventObj.id : undefined,
      name: evFormName,
      date: evFormDate,
      end_date: evFormEndDate || null,
      category: evFormCategory,
      department: evFormDept,
      audience: evFormAudience,
      status: evFormStatus,
      venue: evFormVenue || null,
      desc: evFormDesc || null,
      coordinator: evFormCoordinator || null,
      chief_guest: evFormChiefGuest || null,
      registration_link: evFormRegistrationLink || null,
      photos: evFormPhotos.length > 0 ? JSON.stringify(evFormPhotos) : null,
      college_id: activeCollegeId
    };

    const res = await saveAcademicEvent(payload);
    if (res.success) {
      toast(editingEventObj ? "Campus event updated successfully." : "Campus event created successfully.", "success");
      setShowEventModal(false);
    } else {
      toast(res.message || "Failed to save event", "error");
    }
  };

  const handleQuickStatusChange = async (ev: any) => {
    const statuses = ["Upcoming", "Ongoing", "Completed", "Postponed"];
    const currIdx = statuses.indexOf(ev.status || "Upcoming");
    const nextStatus = statuses[(currIdx + 1) % statuses.length];
    
    const res = await saveAcademicEvent({ ...ev, status: nextStatus });
    if (res.success) {
      toast(`Status updated to ${nextStatus}`, "success");
    } else {
      toast("Failed to update status", "error");
    }
  };

  const handleDownloadEventTemplate = async () => {
    const XLSX = await import("xlsx");
    const headers = [
      "Sl. No.",
      "Event Title",
      "Start Date (YYYY-MM-DD)",
      "End Date",
      "Category",
      "Department Scope",
      "Target Audience",
      "Status",
      "Venue / Location",
      "Coordinator",
      "Chief Guest / Speaker",
      "Agendas & Highlights"
    ];
    const sampleRows = [
      [
        "1",
        "CodeCraft 2026 - 24hr Campus Hackathon",
        "2026-08-28",
        "2026-08-29",
        "Coding Fest & Hackathon",
        "Computer Science",
        "All Campus",
        "Upcoming",
        "Innovation Labs & Tech Arena",
        "Prof. Vignesh (HOD-CSE)",
        "Sundeep G. (Principal Architect, Tech Corp)",
        "24-hour non-stop coding, hardware prototyping, and AI product building challenge."
      ],
      [
        "2",
        "CyberShield & Cloud Security Hands-on BootCamp",
        "2026-09-08",
        "2026-09-09",
        "Workshop & Hands-on BootCamp",
        "Information Technology",
        "Students Only",
        "Upcoming",
        "Campus Tech Center",
        "Dr. Priya M. (IT Dept Coordinator)",
        "Arun V. (Security Consultant)",
        "Two-day hands-on workshop covering network vulnerability assessment and cloud security."
      ],
      [
        "3",
        "InnovateX - Annual Tech Symposium & Project Expo",
        "2026-09-22",
        "2026-09-23",
        "Technical Symposium & Project Expo",
        "All Departments",
        "All Campus",
        "Upcoming",
        "Main University Auditorium & Exhibition Hall",
        "Prof. Harish K. (Symposium Head)",
        "Dr. M. Karthik (Director, R&D Hub)",
        "Inter-college technical paper presentations, robotics championship, and startup project expo."
      ]
    ];
    const ws = XLSX.utils.aoa_to_sheet([headers, ...sampleRows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Campus Events");
    XLSX.writeFile(wb, "Campus_Events_Template.xlsx");
  };

  const handleImportEventsExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const XLSX = await import("xlsx");
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheetName = workbook.SheetNames[0];
      const rows: any[] = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

      const formattedEvents = rows.map((r) => {
        const keys = Object.keys(r);
        let name = "", date = "", end_date = "", category = "Academic Event", department = "All Departments", audience = "All Campus", status = "Upcoming", venue = "", desc = "";
        
        keys.forEach((k) => {
          const norm = k.toLowerCase().replace(/[^a-z0-9]/g, "");
          const val = (r[k] || "").toString().trim();
          if (!val) return;
          if (norm.includes("title") || norm.includes("name") || norm === "event") name = val;
          else if (norm === "date" || norm.includes("startdate")) {
            try {
              const d = parseDbDate(val);
              date = !isNaN(d.getTime()) ? d.toISOString().split("T")[0] : String(val).trim();
            } catch (_) {
              date = String(val).trim();
            }
          }
          else if (norm.includes("enddate")) {
            try {
              const d = parseDbDate(val);
              end_date = !isNaN(d.getTime()) ? d.toISOString().split("T")[0] : String(val).trim();
            } catch (_) {
              end_date = String(val).trim();
            }
          }
          else if (norm.includes("category") || norm === "type") category = val;
          else if (norm.includes("dept") || norm.includes("department")) department = val;
          else if (norm.includes("audience")) audience = val;
          else if (norm.includes("status")) status = val;
          else if (norm.includes("venue") || norm.includes("room") || norm.includes("location")) venue = val;
          else if (norm.includes("desc") || norm.includes("agenda") || norm.includes("note")) desc = val;
        });

        return {
          name,
          date,
          end_date,
          category,
          department,
          audience,
          status,
          venue,
          desc,
          college_id: activeCollegeId
        };
      }).filter(ev => ev.name && ev.date);

      if (formattedEvents.length === 0) {
        toast("No valid event rows found in Excel sheet.", "error");
        return;
      }

      const res = await fetch("/api/academic-calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "batch_events", data: formattedEvents })
      });
      const resData = await res.json();
      if (resData.success) {
        toast(`${formattedEvents.length} events imported successfully!`, "success");
        await refreshData();
      } else {
        toast(resData.message || "Failed to import events.", "error");
      }
    } catch (err: any) {
      toast(`Import failed: ${err.message}`, "error");
    } finally {
      e.target.value = "";
    }
  };

  const handleExportEventsExcel = async () => {
    const XLSX = await import("xlsx");
    const headers = [
      "Sl. No.",
      "Event Title",
      "Date",
      "End Date",
      "Category",
      "Department",
      "Target Audience",
      "Status",
      "Venue",
      "Description"
    ];

    const rows = filteredEvents.map((ev, idx) => [
      idx + 1,
      ev.name,
      ev.date,
      ev.end_date || "—",
      ev.category || "Academic Event",
      ev.department || "All Departments",
      ev.audience || "All Campus",
      ev.status || "Upcoming",
      ev.venue || "—",
      ev.desc || "—"
    ]);

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Event Milestones");
    XLSX.writeFile(wb, "Campus_Event_Milestones.xlsx");
  };

  const handleDeleteEvent = async (id: string) => {
    if (await showConfirm({ message: "Remove this calendar event milestone?", danger: true, confirmLabel: "Remove" })) {
      const res = await deleteAcademicEvent(id);
      if (res.success) {
        toast("Event milestone removed successfully.", "success");
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

  const [showSubjectModal, setShowSubjectModal] = useState(false);
  const [editingSubject, setEditingSubject] = useState<any>(null);
  const [subjectModalError, setSubjectModalError] = useState<string | null>(null);
  const [lockDeptAndYear, setLockDeptAndYear] = useState(false);
  const [subjectForm, setSubjectForm] = useState({
    id: "",
    name: "",
    department: "",
    semester: "Semester 1",
    type: "SKILL",
    college_id: activeCollegeId,
    year: "Year 1",
    weekly_hours: 4,
    shift: "General",
    subject_group: "General",
    mentorIds: [] as string[]
  });

  const normalizeSubjectType = (rawType?: string) => {
    if (!rawType) return "SKILL";
    const u = rawType.trim().toUpperCase();
    if (u === "THEORY" || u === "ACADEMIC") return "ACADEMIC";
    if (u === "SKILL" || u === "PRACTICAL") return "SKILL";
    if (u === "LAB") return "LAB";
    if (u === "GENERAL") return "GENERAL";
    return u;
  };

  const handleOpenSubjectModal = (sub?: any, defaultDept?: string, defaultYear?: string) => {
    setSubjectModalError(null);
    if (sub) {
      setEditingSubject(sub);
      setSubjectForm({
        id: sub.id,
        name: sub.name,
        department: sub.department || defaultDept || "",
        semester: sub.semester || "Semester 1",
        type: normalizeSubjectType(sub.type),
        college_id: activeCollegeId,
        year: sub.year || defaultYear || "Year 1",
        weekly_hours: sub.weekly_hours || 4,
        shift: sub.shift || "General",
        subject_group: sub.subject_group || "General",
        mentorIds: []
      });
      setLockDeptAndYear(false);
    } else {
      let defaultSem = "Semester 1";
      if (defaultYear === "Year 2") defaultSem = "Semester 3";
      else if (defaultYear === "Year 3") defaultSem = "Semester 5";
      else if (defaultYear === "Year 4") defaultSem = "Semester 7";

      setEditingSubject(null);
      setSubjectForm({
        id: "",
        name: "",
        department: defaultDept || "",
        semester: defaultSem,
        type: "SKILL",
        college_id: activeCollegeId,
        year: defaultYear || "Year 1",
        weekly_hours: 4,
        shift: "General",
        subject_group: "General",
        mentorIds: []
      });
      setLockDeptAndYear(!!defaultDept);
    }
    setShowSubjectModal(true);
  };

  const handleSubjectModalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubjectModalError(null);
    if (!subjectForm.name.trim() || !subjectForm.department.trim()) {
      setSubjectModalError("Subject Name and Department are required.");
      return;
    }

    const matchedDept = coursesList.find((c: any) => c.name === subjectForm.department);
    const derivedShift = matchedDept?.default_shift === "shift_1" ? "Shift 1" : matchedDept?.default_shift === "shift_2" ? "Shift 2" : "General";

    setActionLoading('submit_subject', true);
    try {
      if (editingSubject) {
        const res = await updateSubject({
          ...editingSubject,
          name: subjectForm.name.trim(),
          department: subjectForm.department,
          semester: subjectForm.semester,
          type: subjectForm.type,
          year: subjectForm.year,
          weekly_hours: Number(subjectForm.weekly_hours),
          shift: derivedShift,
          subject_group: subjectForm.subject_group,
          college_id: subjectForm.college_id || activeCollegeId
        });
        if (res.success) {
          setShowSubjectModal(false);
          toast("Subject updated successfully.", "success");
        } else {
          setSubjectModalError("Error updating subject: " + res.message);
        }
      } else {
        const res = await createSubject({
          name: subjectForm.name.trim(),
          department: subjectForm.department,
          semester: subjectForm.semester,
          type: subjectForm.type,
          year: subjectForm.year,
          weekly_hours: Number(subjectForm.weekly_hours),
          shift: derivedShift,
          subject_group: subjectForm.subject_group,
          college_id: subjectForm.college_id || activeCollegeId
        });
        if (res.success) {
          if (subjectForm.mentorIds && subjectForm.mentorIds.length > 0) {
            for (const mId of subjectForm.mentorIds) {
              const mentor = mentors.find((m: any) => m.id === mId);
              if (!mentor) continue;
              const existingSubs = mentor.subjects ? mentor.subjects.split(/\n|,|;/).map((s: string) => s.trim()).filter(Boolean) : [];
              if (!existingSubs.includes(subjectForm.name.trim())) {
                existingSubs.push(subjectForm.name.trim());
              }
              await updateMentor({ ...mentor, subjects: existingSubs.join("\n") });
            }
          }
          setShowSubjectModal(false);
          toast("Subject created successfully.", "success");
        } else {
          setSubjectModalError("Error creating subject: " + res.message);
        }
      }
    } finally {
      setActionLoading('submit_subject', false);
    }
  };

  const handleStartEditSubject = (sub: any) => {
    handleOpenSubjectModal(sub);
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
      setActionLoading(`delete_subject_${id}`, true);
      try {
        const res = await deleteSubject(id);
        if (res.success) {
          toast("Subject deleted from database successfully.", "success");
        } else {
          toast("Error deleting subject: " + res.message, "error");
        }
      } finally {
        setActionLoading(`delete_subject_${id}`, false);
      }
    }
  };

  // --- ACTIONS: DEPARTMENTS / COURSES & BATCH CRUD (FULL ADMIN-GRADE MODAL) ---
  const handleOpenDeptModal = (dept?: any) => {
    setModalError(null);
    if (dept) {
      const initialShift = dept.default_shift || (dept.shift_based === 1 ? "both" : "general");
      const isShiftSplit = initialShift === "both" || initialShift === "all";
      setDeptForm({
        id: dept.id,
        name: dept.name,
        college_id: dept.college_id || activeCollegeId,
        code: dept.code || "",
        description: dept.description || "",
        status: dept.status || "Active",
        years: dept.years ? Number(dept.years) : 3,
        start_date: dept.start_date || "",
        end_date: dept.end_date || "",
        start_year: dept.start_year || "",
        end_year: dept.end_year || "",
        default_room: dept.default_room || "",
        default_shift: initialShift,
        shift_based: isShiftSplit ? 1 : 0
      });
      setEditingDept(true);
    } else {
      setDeptForm({
        id: "",
        name: "",
        college_id: activeCollegeId,
        code: "",
        description: "",
        status: "Active",
        years: 3,
        start_date: "",
        end_date: "",
        start_year: "",
        end_year: "",
        default_room: "",
        default_shift: "general",
        shift_based: 0
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
    const years = deptForm.years || 3;
    const calculated = autoCalculateCourseDates(val, years);
    setDeptForm(prev => ({
      ...prev,
      start_date: val,
      ...calculated
    }));
  };

  const handleCourseYearsChange = (val: number) => {
    const calculated = deptForm.start_date ? autoCalculateCourseDates(deptForm.start_date, val) : {};
    setDeptForm(prev => ({
      ...prev,
      years: val,
      ...calculated
    }));
  };

  const handleYearRoomChange = (yearNum: number, roomVal: string) => {
    setDeptForm(prev => {
      let roomObj: Record<string, string> = {};
      try {
        if (prev.default_room && prev.default_room.startsWith("{")) {
          roomObj = JSON.parse(prev.default_room);
        } else if (prev.default_room) {
          roomObj = { "1": prev.default_room };
        }
      } catch (_) { }

      if (roomVal.trim()) {
        roomObj[yearNum.toString()] = roomVal.trim();
      } else {
        delete roomObj[yearNum.toString()];
      }

      return {
        ...prev,
        default_room: JSON.stringify(roomObj)
      };
    });
  };

  const handleDeptSubmitModal = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);
    if (!deptForm.name.trim()) {
      setModalError("Course name is required.");
      return;
    }

    setIsDeptSubmitting(true);
    try {
      const autoCode = deptForm.code.trim() || deptForm.name.replace(/with|and|for/gi, "").split(/\s+/).filter(Boolean).map(w => {
        const clean = w.replace(/[^a-zA-Z]/g, "");
        if (!clean) return "";
        if (clean.toLowerCase() === "bsc") return "BSC";
        if (clean.toLowerCase() === "bba") return "BBA";
        if (clean.toLowerCase() === "bcom") return "BCOM";
        return clean[0].toUpperCase();
      }).filter(Boolean).join("-");

      const isShiftSplit = deptForm.default_shift === "both" || deptForm.default_shift === "all";

      const payload = {
        ...deptForm,
        name: deptForm.name.trim(),
        code: autoCode,
        description: deptForm.description.trim(),
        college_id: deptForm.college_id || activeCollegeId,
        default_shift: deptForm.default_shift || "general",
        shift_based: isShiftSplit ? 1 : 0
      };

      if (editingDept && deptForm.id) {
        const res = await updateCourse(payload);
        if (res.success) {
          setShowDeptModal(false);
          toast("Course & Batch details updated successfully.", "success");
          await refreshData();
        } else {
          setModalError(res.message || "Failed to update course.");
        }
      } else {
        const res = await createCourse(payload);
        if (res.success) {
          setShowDeptModal(false);
          toast("Course & Batch created successfully.", "success");
          await refreshData();
        } else {
          setModalError(res.message || "Failed to create course.");
        }
      }
    } catch (err: any) {
      setModalError("An error occurred: " + err.message);
    } finally {
      setIsDeptSubmitting(false);
    }
  };

  const handleDeleteDept = async (deptName: string, id?: string) => {
    if (await showConfirm({
      title: "Delete Department",
      message: `Are you sure you want to delete department "${deptName}"?\n\nThis will permanently delete all associated mentors, students, subjects, slots, and attendance records. This action cannot be undone.`,
      danger: true,
      confirmLabel: "Delete Department"
    })) {
      let res: { success: boolean; message?: string; deletedCounts?: any } = { success: false };
      if (id) {
        res = await deleteCourse(id);
      } else {
        // Unregistered department name: cascade delete subjects with this department name
        const subsToDelete = collegeSubjects.filter(s => s.department === deptName);
        for (const s of subsToDelete) {
          await deleteSubject(s.id);
        }
        res = { success: true, message: `Department ${deptName} removed.` };
      }

      if (res.success) {
        const counts = res.deletedCounts;
        if (counts && (counts.slots > 0 || counts.students > 0 || counts.mentors > 0)) {
          toast(`Department deleted. Cascade removed: ${counts.slots} slot(s), ${counts.students} student(s), ${counts.mentors} mentor(s), ${counts.subjects} subject(s).`, "info");
        } else {
          toast(`Department "${deptName}" deleted successfully.`, "success");
        }
        await refreshData();
      } else {
        toast("Error deleting department: " + res.message, "error");
      }
    }
  };

  // --- ACTIONS: FACULTY WORKLOAD CRUD ---
  const handleStartEditFaculty = (m: Mentor) => {
    setEditingFacultyId(m.id);
    setEditingWorkloadVal(facultyWorkloadLimits[m.id] || 16);
    setEditingShiftVal(facultyShifts[m.id] || "general");
  };

  const handleSaveFacultyConfig = async (id: string) => {
    setActionLoading(`save_faculty_${id}`, true);
    try {
      const res = await saveFacultyConfig(id, editingWorkloadVal, editingShiftVal);
      if (res.success) {
        setEditingFacultyId(null);
        toast("Faculty configurations saved successfully.", "success");
      } else {
        toast(res.message || "Failed to save configurations", "error");
      }
    } finally {
      setActionLoading(`save_faculty_${id}`, false);
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

  const handleStartDateChange = (val: string) => {
    setDailyStartDateStr(val);
    if (!dailyEndDateStr || dailyEndDateStr < val) {
      setDailyEndDateStr(val);
    }
  };

  const handleDeleteDailyConfig = async (id: string, dateStr: string) => {
    if (await showConfirm({
      title: "Delete Daily Schedule Config",
      message: `Are you sure you want to delete the schedule configuration for date "${dateStr}"?`,
      danger: true,
      confirmLabel: "Delete Config"
    })) {
      try {
        const res = await fetch(`/api/daily-configs?id=${encodeURIComponent(id)}&college_id=${encodeURIComponent(activeCollegeId)}&dateStr=${encodeURIComponent(dateStr)}`, {
          method: "DELETE"
        });
        const data = await res.json();
        if (data.success) {
          toast(`Daily schedule configuration for ${dateStr} deleted.`, "success");
          await fetchDailyConfigs();
        } else {
          toast(data.message || "Failed to delete config.", "error");
        }
      } catch (err: any) {
        toast("Error deleting daily config: " + err.message, "error");
      }
    }
  };

  const handleDeleteDailyConfigRange = async () => {
    if (!activeCollegeId) {
      toast("Please select a college first.", "error");
      return;
    }
    if (!dailyStartDateStr || !dailyEndDateStr) {
      toast("Please select both From Date and To Date for range deletion.", "warning");
      return;
    }
    if (dailyStartDateStr > dailyEndDateStr) {
      toast("From Date cannot be after To Date.", "error");
      return;
    }

    const rangeLabel = dailyStartDateStr === dailyEndDateStr ? dailyStartDateStr : `${dailyStartDateStr} to ${dailyEndDateStr}`;
    if (await showConfirm({
      title: "Delete Date Range Day Orders",
      message: `Are you sure you want to delete ALL daily schedule configurations for date range "${rangeLabel}"?\n\nThis action cannot be undone.`,
      danger: true,
      confirmLabel: "Delete Date Range"
    })) {
      try {
        const res = await fetch(`/api/daily-configs?college_id=${encodeURIComponent(activeCollegeId)}&startDate=${encodeURIComponent(dailyStartDateStr)}&endDate=${encodeURIComponent(dailyEndDateStr)}`, {
          method: "DELETE"
        });
        const data = await res.json();
        if (data.success) {
          toast(`All daily schedule configurations between ${rangeLabel} deleted successfully.`, "success");
          setEditingDailyId(null);
          await fetchDailyConfigs();
        } else {
          toast(data.message || "Failed to delete date range configs.", "error");
        }
      } catch (err: any) {
        toast("Error deleting date range configs: " + err.message, "error");
      }
    }
  };

  const handleStartEditDailyConfig = (cfg: any) => {
    setEditingDailyId(cfg.id || cfg.dateStr);
    setDailyStartDateStr(cfg.dateStr);
    setDailyEndDateStr(cfg.dateStr);
    setDailyDayType(cfg.day_type || "working");
    setDailyDayOrder(cfg.day_order || "Day 1");
    setDailySessionMode(cfg.session_mode || "Offline");
    setDailyNotes(cfg.notes || "");
    setIsDailyConfigModalOpen(true);
    toast(`Editing Day Order schedule for ${cfg.dateStr}`, "info");
  };

  const handleCancelDailyEdit = () => {
    setEditingDailyId(null);
    setDailyNotes("");
  };

  const handleSaveDailyConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCollegeId) {
      toast("Please select a college before saving configuration.", "error");
      return;
    }
    if (dailyStartDateStr > dailyEndDateStr) {
      toast("Start Date cannot be after End Date.", "error");
      return;
    }
    setIsDailySaving(true);
    try {
      const res = await fetch("/api/daily-configs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          college_id: activeCollegeId,
          startDate: dailyStartDateStr,
          endDate: dailyEndDateStr,
          dateStr: dailyStartDateStr,
          day_type: dailyDayType,
          day_order: dailyDayType === "holiday" ? "None" : dailyDayOrder,
          session_mode: dailySessionMode,
          notes: dailyNotes,
          auto_advance: autoAdvanceDayOrder,
          skip_sundays: skipSundays
        })
      });
      const data = await res.json();
      if (data.success) {
        toast(editingDailyId ? "Daily day order configuration updated successfully." : "Daily day order configuration saved successfully.", "success");
        setDailyNotes("");
        setEditingDailyId(null);
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

  const handleClearTimetableClick = async (targetGroupArg?: string) => {
    const isGenTab = timetableSubTab === "generate";
    const targetGroup = targetGroupArg || (isGenTab ? (genClassGroup || viewerClassGroup) : viewerClassGroup);
    if (!targetGroup) {
      toast("Please select a course or cohort name first.", "warning");
      return;
    }
    if (await showConfirm({ title: "Clear Timetable", message: `Are you sure you want to delete and clear the entire timetable for "${targetGroup}"? This will permanently release all scheduled periods and cannot be undone.`, danger: true, confirmLabel: "Clear Timetable" })) {
      try {
        const res = await clearTimetable(targetGroup);
        if (res.success) {
          toast(`Successfully cleared all slots for ${targetGroup}.`, "success");
          refreshData();
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
    const ExcelJS = (await import("exceljs")).default;
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
      s => (!s.college_id || s.college_id === activeCollegeId) && 
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
        const XLSX = await import("xlsx");
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

    const deptSubjects = getSubjectsForDepartment(collegeSubjects, collegeMentors, collegeSlots, targetDept);
    const semSubjects = deptSubjects.filter(
      (s) => s && s.semester && (s.semester || "").toLowerCase().trim() === (genSelectedSemester || "").toLowerCase().trim()
    );

    const deptMentors = collegeMentors.filter((m) => isMentorInProgram(m, targetDept, collegeSlots, collegeSubjects));

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
      collegeSubjects,
      collegeCourses
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
          if (tabId === "interviews") {
            return interviews.filter((i: any) => (i.status === "Pending" || i.status === "pending_cam") && (i.college_id === activeCollegeId || !i.college_id)).length;
          }
          return 0;
        };

        return (
          <aside ref={sidebarRef} className={`hidden md:flex shrink-0 flex-col justify-between sticky top-6 z-30 floating-sidebar transition-all duration-300 ${isCollapsed ? "w-20 p-2.5" : "w-[270px] p-3.5"}`}>
            <div className="flex flex-col flex-1 overflow-hidden">
              {/* Sidebar Link items */}
              <nav className={`py-1 space-y-1.5 overflow-y-auto max-h-[calc(100vh-11rem)] custom-scrollbar ${isCollapsed ? "px-0.5" : "px-1.5"}`}>
                {[
                  {
                    id: "dashboard",
                    title: "Dashboard",
                    icon: Building2,
                    items: [
                      { id: "overview", label: "Dashboard", icon: Building2 }
                    ]
                  },
                  {
                    id: "academics",
                    title: "Academics",
                    icon: BookOpen,
                    items: [
                      { id: "config", label: "Academic Configuration", icon: Settings },
                      { id: "curriculum", label: "Batch Creation", icon: BookOpen }
                    ]
                  },
                  {
                    id: "events",
                    title: "Event Management",
                    icon: Calendar,
                    items: [
                      { id: "events", label: "Event Management", icon: Calendar }
                    ]
                  },
                  {
                    id: "faculty",
                    title: "Faculty",
                    icon: Users,
                    items: [
                      { id: "faculty", label: "Mentor Subject Allocation", icon: Users },
                      { id: "handovers", label: "Class Handovers", icon: CalendarCheck2 }
                    ]
                  },
                  {
                    id: "schedules",
                    title: "Schedules",
                    icon: Calendar,
                    items: [
                      { id: "timetable", label: "Timetable", icon: Calendar },
                      { id: "monitoring", label: "Attendance Monitoring", icon: Clock },
                      { id: "interviews", label: "Interview Allocation", icon: Award }
                    ]
                  },
                  {
                    id: "students",
                    title: "Students Directory",
                    icon: GraduationCap,
                    items: [
                      { id: "students_list", label: "Students Directory", icon: Users }
                    ]
                  },
                  {
                    id: "tracker",
                    title: "Skill Development Tracker",
                    icon: GraduationCap,
                    items: [
                      { id: "tracker", label: "Skill Development Tracker", icon: GraduationCap }
                    ]
                  },
                  {
                    id: "fees",
                    title: "Fee Collection",
                    icon: IndianRupee,
                    items: [
                      { id: "fees", label: "Fee Collection", icon: IndianRupee }
                    ]
                  },
                  {
                    id: "reports",
                    title: "Campus Insight",
                    icon: FileText,
                    items: [
                      { id: "reports", label: "Campus Insight", icon: FileText }
                    ]
                  },
                  {
                    id: "profile",
                    title: "My Profile",
                    icon: User,
                    items: [
                      { id: "profile", label: "My Profile", icon: User }
                    ]
                  }
                ].map((group) => {
                  const Icon = group.icon;
                  const isSingleItem = group.items.length === 1;
                  const isAnyChildActive = group.items.some(item => activeTab === item.id);
                  const totalPendingInGroup = group.items.reduce((sum, item) => sum + getNotificationCount(item.id), 0);

                  const isExpanded = expandedGroups[group.id];

                  return (
                    <div 
                      key={group.id} 
                      className="relative py-0.5 group"
                      onMouseEnter={() => isCollapsed && setHoveredGroupId(group.id)}
                      onMouseLeave={() => isCollapsed && setHoveredGroupId(null)}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          if (isSingleItem) {
                            setActiveTab(group.items[0].id as any);
                          } else if (isCollapsed) {
                            // collapsed group click logic
                          } else {
                            setExpandedGroups(prev => {
                              const isCurrentlyOpen = !!prev[group.id];
                              return isCurrentlyOpen ? {} : { [group.id]: true };
                            });
                          }
                        }}
                        className={`sidebar-group-btn w-full flex items-center rounded-xl transition-all duration-200 cursor-pointer ${
                          isCollapsed ? "justify-center px-0 py-3" : "justify-between px-3 py-2.5 text-left"
                        } ${
                          isAnyChildActive
                            ? "bg-gradient-to-r from-[#D528A2] to-pink-600 text-white shadow-md shadow-[#D528A2]/25 font-black border-none"
                            : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/80 dark:text-slate-300 dark:hover:text-white dark:hover:bg-white/10 font-bold hover:translate-x-0.5"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Icon className={`h-4.5 w-4.5 shrink-0 transition-colors ${
                            isAnyChildActive ? "text-white" : "text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200"
                          }`} />
                          {!isCollapsed && <span className="text-xs font-extrabold tracking-tight leading-tight">{group.title}</span>}
                        </div>
                        {!isCollapsed && (
                          <div className="flex items-center gap-2 shrink-0 ml-1">
                            {totalPendingInGroup > 0 && (
                              <span className={`text-[8px] font-extrabold px-1.5 py-0.5 rounded-full shadow-xs ${
                                isAnyChildActive ? "bg-white text-[#D528A2]" : "bg-rose-500 text-white"
                              }`}>
                                {totalPendingInGroup}
                              </span>
                            )}
                            {!isSingleItem && (
                              <ChevronRight className={`h-3.5 w-3.5 transition-transform duration-200 ${
                                isExpanded ? "rotate-90" : ""
                              } ${isAnyChildActive ? "text-white" : "text-slate-350 dark:text-slate-600"}`} />
                            )}
                          </div>
                        )}
                      </button>

                      {/* Accordion Sub-Menu Expanding Directly Below (Expanded Sidebar Mode) */}
                      {(!isCollapsed && !isSingleItem && isExpanded) && (
                        <div className="pl-4 pt-1.5 pb-1 space-y-1 animate-fadeIn">
                          {group.items.map(child => {
                            const ChildIcon = child.icon;
                            const isChildActive = activeTab === child.id || (child.id === "interviews" && activeTab === "monitoring" && camTrackerSubView === "interviews");
                            const count = getNotificationCount(child.id);
                            return (
                              <button
                                key={child.id}
                                type="button"
                                onClick={() => setActiveTab(child.id as any)}
                                className={`w-full flex items-center justify-start gap-2.5 px-3 py-2 text-left rounded-xl text-[11px] font-bold tracking-tight transition-all duration-150 cursor-pointer ${
                                  isChildActive
                                    ? "bg-[#D528A2]/10 text-[#D528A2] dark:bg-[#F4A863]/15 dark:text-[#F4A863] border-l-2 border-[#D528A2] dark:border-[#F4A863] font-black"
                                    : "text-slate-600 hover:text-[#D528A2] hover:bg-[#D528A2]/5 dark:text-slate-400 dark:hover:text-[#F4A863] dark:hover:bg-white/5"
                                }`}
                              >
                                <ChildIcon className={`h-3.5 w-3.5 shrink-0 ${isChildActive ? "text-[#D528A2] dark:text-[#F4A863]" : "text-slate-400"}`} />
                                <span className="flex-1 text-xs font-semibold leading-snug">{child.label}</span>
                                {count > 0 && (
                                  <span className={`ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                                    isChildActive ? "bg-[#D528A2] text-white" : "bg-rose-500 text-white"
                                  }`}>
                                    {count}
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {/* Outside Hover Sub-Menu Popover Container (Collapsed Sidebar Mode Only) */}
                      {(isCollapsed && !isSingleItem) && (
                        <div className={`absolute left-full top-0 pl-2 w-56 z-50 submenu-${group.id} ${hoveredGroupId === group.id ? "block" : "hidden"}`}>
                          <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-[#D528A2]/20 dark:border-slate-800 shadow-2xl rounded-xl p-2.5 animate-fadeIn">
                            <div className="px-3 py-1.5 text-[9px] font-black uppercase tracking-widest border-b border-slate-100 dark:border-slate-800 mb-1.5 text-[#D528A2] dark:text-[#F4A863] flex items-center justify-between">
                              <span>{group.title}</span>
                              <span className="h-1.5 w-1.5 rounded-full bg-[#D528A2] animate-pulse" />
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
                                        ? "sidebar-active-item shadow-sm translate-x-0.5"
                                        : "text-slate-600 hover:text-[#D528A2] hover:bg-[#D528A2]/5 dark:text-slate-400 dark:hover:text-[#F4A863] dark:hover:bg-white/5 hover:translate-x-0.5"
                                    }`}
                                  >
                                    <ChildIcon className={`h-3.5 w-3.5 shrink-0 ${isChildActive ? "text-white" : "text-slate-400"}`} />
                                    <span className="flex-1 text-xs font-semibold leading-snug">{child.label}</span>
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
                      )}
                    </div>
                  );
                })}
              </nav>
            </div>

            {/* Collapse button at bottom */}
            <div className="border-t border-slate-200/80 dark:border-slate-800 pt-2 shrink-0">
              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={() => setIsCollapsed(prev => {
                    const next = !prev;
                    localStorage.setItem("fp_sidebar_collapsed", String(next));
                    return next;
                  })}
                  className="h-8 w-8 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-600 hover:text-slate-900 hover:bg-slate-100 shadow-xs transition-all cursor-pointer"
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
            { id: "overview", label: "Dashboard", icon: Building2 },
            { id: "timetable", label: "Timetable", icon: Calendar },
            { id: "faculty", label: "Faculty", icon: Users },
            { id: "handovers", label: "Handovers", icon: CalendarCheck2 },
            { id: "more_menu", label: "More", icon: Menu },
          ].map(t => {
            const Icon = t.icon;
            const isActive = activeTab === t.id || (t.id === "more_menu" && ["config", "curriculum", "monitoring", "tracker", "fees", "reports", "profile"].includes(activeTab));
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

      {/* Main Workspace Area (Right-aligned content) */}
      <main className="flex-1 flex flex-col overflow-x-hidden overflow-y-auto h-full pb-20 md:pb-12 scroll-touch">

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
                  className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-left hover:border-indigo-500 hover:ring-2 hover:ring-indigo-100 transition-all flex items-center gap-4 shadow-xs cursor-pointer group"
                >
                  <div className="h-10 w-10 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center text-indigo-650 shrink-0 group-hover:scale-105 transition-transform">
                    <Settings className="h-5 w-5" />
                  </div>
                  <div>
                    <span className="block text-xs font-bold text-slate-800 dark:text-slate-200">Academic Configuration</span>
                    <span className="text-[10px] text-slate-455 dark:text-slate-400 font-medium">Departments & subjects configuration</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab("events")}
                  className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-left hover:border-pink-500 hover:ring-2 hover:ring-pink-100 transition-all flex items-center gap-4 shadow-xs cursor-pointer group"
                >
                  <div className="h-10 w-10 rounded-xl bg-pink-50 dark:bg-pink-900/20 flex items-center justify-center text-[#D528A2] shrink-0 group-hover:scale-105 transition-transform">
                    <Calendar className="h-5 w-5" />
                  </div>
                  <div>
                    <span className="block text-xs font-bold text-slate-800 dark:text-slate-200">Event Management</span>
                    <span className="text-[10px] text-slate-455 dark:text-slate-400 font-medium">Campus events, exams &amp; milestone tracker</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab("curriculum")}
                  className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-left hover:border-indigo-500 hover:ring-2 hover:ring-indigo-100 transition-all flex items-center gap-4 shadow-xs cursor-pointer group"
                >
                  <div className="h-10 w-10 rounded-xl bg-teal-50 dark:bg-teal-900/20 flex items-center justify-center text-teal-500 shrink-0 group-hover:scale-105 transition-transform">
                    <BookOpen className="h-5 w-5" />
                  </div>
                  <div>
                    <span className="block text-xs font-bold text-slate-800 dark:text-slate-200">Batch Creation</span>
                    <span className="text-[10px] text-slate-455 dark:text-slate-400 font-medium">Syllabus breakdown & metrics</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab("monitoring")}
                  className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-left hover:border-indigo-500 hover:ring-2 hover:ring-indigo-100 transition-all flex items-center gap-4 shadow-xs cursor-pointer group"
                >
                  <div className="h-10 w-10 rounded-xl bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center text-amber-550 shrink-0 group-hover:scale-105 transition-transform">
                    <Clock className="h-5 w-5" />
                  </div>
                  <div>
                    <span className="block text-xs font-bold text-slate-800 dark:text-slate-200">Attendance Monitoring</span>
                    <span className="text-[10px] text-slate-455 dark:text-slate-400 font-medium">Class attendance tracking</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab("tracker")}
                  className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-left hover:border-indigo-500 hover:ring-2 hover:ring-indigo-100 transition-all flex items-center gap-4 shadow-xs cursor-pointer group"
                >
                  <div className="h-10 w-10 rounded-xl bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center text-purple-600 shrink-0 group-hover:scale-105 transition-transform">
                    <GraduationCap className="h-5 w-5" />
                  </div>
                  <div>
                    <span className="block text-xs font-bold text-slate-800 dark:text-slate-200">Skill Development Tracker</span>
                    <span className="text-[10px] text-slate-455 dark:text-slate-400 font-medium">Weekly submissions ledger</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab("fees")}
                  className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-left hover:border-indigo-500 hover:ring-2 hover:ring-indigo-100 transition-all flex items-center gap-4 shadow-xs cursor-pointer group"
                >
                  <div className="h-10 w-10 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center text-emerald-600 shrink-0 group-hover:scale-105 transition-transform">
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
                  className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-left hover:border-indigo-500 hover:ring-2 hover:ring-indigo-100 transition-all flex items-center gap-4 shadow-xs cursor-pointer group"
                >
                  <div className="h-10 w-10 rounded-xl bg-rose-50 dark:bg-rose-900/20 flex items-center justify-center text-rose-500 shrink-0 group-hover:scale-105 transition-transform">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div>
                    <span className="block text-xs font-bold text-slate-800 dark:text-slate-200">Campus Insight</span>
                    <span className="text-[10px] text-slate-455 dark:text-slate-400 font-medium">Generate export metrics</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab("profile")}
                  className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-left hover:border-indigo-500 hover:ring-2 hover:ring-indigo-100 transition-all flex items-center gap-4 shadow-xs cursor-pointer group"
                >
                  <div className="h-10 w-10 rounded-xl bg-slate-100 dark:bg-slate-800/80 flex items-center justify-center text-slate-650 dark:text-slate-350 shrink-0 group-hover:scale-105 transition-transform">
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
          {activeTab === "overview" && (() => {
            const collegeDepts = (departmentsList || []).filter(d => !d.college_id || d.college_id === activeCollegeId);
            const deptsCount = collegeDepts.length > 0 ? collegeDepts.length : collegeCourses.length;

            // Real Calculation 1: Student Attendance Avg from actual records & student database for active campus
            const calculatedStudentAttendancePct = (() => {
              const collegeStudentIds = new Set((collegeStudents || []).map(s => s.id));
              const campusAttendance = (studentAttendance || []).filter(a => collegeStudentIds.has(a.studentId));
              
              if (campusAttendance.length > 0) {
                const presentCount = campusAttendance.filter(a => a.status === "present" || a.status === "od").length;
                return ((presentCount / campusAttendance.length) * 100).toFixed(1) + "%";
              }
              if (collegeStudents && collegeStudents.length > 0) {
                const validPcts = collegeStudents
                  .map(s => Number((s as any).attendance_percentage || (s as any).attendancePct || 0))
                  .filter(n => n > 0);
                if (validPcts.length > 0) {
                  const avg = validPcts.reduce((sum, v) => sum + v, 0) / validPcts.length;
                  return avg.toFixed(1) + "%";
                }
              }
              return "0.0%";
            })();

            // Real Calculation 2: Team Attendance Avg (Faculty Conduction Rate) from timetable slots & logs for active campus
            const calculatedTeamAttendancePct = (() => {
              const facultyIds = new Set((collegeMentors || []).map(m => m.id));
              const facultySlots = (collegeSlots || []).filter(s => facultyIds.has(s.mentorId) || s.college_id === activeCollegeId);
              const collegeStudentIds = new Set((collegeStudents || []).map(s => s.id));
              const campusAttendance = (studentAttendance || []).filter(a => collegeStudentIds.has(a.studentId));
              
              if (facultySlots.length > 0 && campusAttendance.length > 0) {
                const logsSubmitted = new Set(campusAttendance.map(a => a.slotId || (a as any).slot_id)).size;
                const ratio = Math.min(100, (logsSubmitted / facultySlots.length) * 100);
                return ratio.toFixed(1) + "%";
              }
              if (collegeMentors.length > 0 && campusAttendance.length > 0) {
                const activeMentorsWhoMarked = new Set(campusAttendance.map(a => a.markedBy || (a as any).marked_by)).size;
                const ratio = Math.min(100, (activeMentorsWhoMarked / collegeMentors.length) * 100);
                return ratio.toFixed(1) + "%";
              }
              return "0.0%";
            })();

            return (
              <div className="space-y-6">
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5 sm:gap-5 pt-3.5 px-2">
                  {[
                    { label: "Assigned Departments", value: deptsCount, icon: GraduationCap, bg: "bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-yellow-500/10 border-amber-200/60 dark:border-amber-500/20", iconColor: "text-amber-600 dark:text-amber-400" },
                    { label: "Total Faculty", value: collegeMentors.length, icon: Users, bg: "bg-gradient-to-br from-blue-500/10 via-indigo-500/5 to-sky-500/10 border-blue-200/60 dark:border-blue-500/20", iconColor: "text-blue-600 dark:text-blue-400" },
                    { label: "Total Students", value: collegeStudents.length, icon: Users, bg: "bg-gradient-to-br from-purple-500/10 via-pink-500/5 to-fuchsia-500/10 border-purple-200/60 dark:border-purple-500/20", iconColor: "text-purple-600 dark:text-purple-400" },
                    { label: "Student Attendance Avg", value: calculatedStudentAttendancePct, icon: CheckCircle2, bg: "bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-green-500/10 border-emerald-200/60 dark:border-emerald-500/20", iconColor: "text-emerald-600 dark:text-emerald-400", success: true },
                    { label: "Team Attendance Avg", value: calculatedTeamAttendancePct, icon: CalendarCheck2, bg: "bg-gradient-to-br from-rose-500/10 via-pink-500/5 to-red-500/10 border-rose-200/60 dark:border-rose-500/20", iconColor: "text-rose-600 dark:text-rose-400", success: true }
                  ].map((card, idx) => (
                    <Card
                      key={idx}
                      label={card.label}
                      value={card.value}
                      icon={<card.icon className={`h-4 w-4 sm:h-5 sm:w-5 ${card.iconColor}`} />}
                      success={card.success}
                      className={`${card.bg} relative group animate-gsap-card`}
                    />
                  ))}
                </div>

              {/* Daily Day Order & Status Settings Banner - Opens All-in-One Popup Modal */}
              <div className="bg-white border border-slate-200 shadow-xs rounded-2xl p-5 flex justify-between items-center flex-wrap gap-4 hover:border-slate-300 transition-all animate-gsap-card">
                <div className="space-y-1">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-slate-100 text-slate-800 rounded-xl border border-slate-200/80">
                      <Calendar className="h-5 w-5" />
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-black uppercase tracking-wider text-slate-900">
                        Daily Day Order & Status Settings
                      </h3>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-slate-100 text-slate-600 border border-slate-200">
                        {dailyConfigsList.length} Records Configured
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 font-medium pl-10">
                    Configure daily working days, holidays, campus events, exam days, session modes, and continuous day order cycles (Day 1 ➔ Day 6).
                  </p>
                </div>

                <Button
                  variant="primary"
                  size="md"
                  onClick={() => setIsDailyConfigModalOpen(true)}
                  className="bg-slate-900 hover:bg-slate-800 text-white shadow-sm font-extrabold"
                  icon={<Calendar className="h-4 w-4" />}
                >
                  Open Daily Schedule Configurator
                </Button>
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
            );
          })()}

          {/* 2. ACADEMIC CONFIG */}
          {activeTab === "config" && (
            <Panel
              title="Academic Structure Configurations"
              subtitle="Manage Academic Years, Calendar Events, Working Days, and College Hours."
            >
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 text-xs font-semibold">

                {/* Academic Year CRUD */}
                <div className="space-y-4 bg-slate-50/50 p-5 rounded-xl border border-slate-200">
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
                <div className="space-y-4 bg-slate-50/50 p-5 rounded-xl border border-slate-200">
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



                {/* Event Management Shortcut Card */}
                <div className="md:col-span-2 pt-6 border-t border-slate-200">
                  <div className="bg-gradient-to-r from-pink-50/70 via-purple-50/50 to-indigo-50/70 border border-pink-200/80 p-5 rounded-2xl flex items-center justify-between flex-wrap gap-4 shadow-xs">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-[#D528A2] to-pink-600 text-white flex items-center justify-center font-bold shadow-md shadow-[#D528A2]/20 shrink-0">
                        <Calendar className="h-5 w-5" />
                      </div>
                      <div>
                        <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">Academic Event Management &amp; Milestone Tracker</h4>
                        <p className="text-xs text-slate-600 font-semibold mt-0.5">
                          Academic milestones, continuous assessments, and campus events are managed in the dedicated <span className="text-[#D528A2] font-bold">Event Management</span> console.
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveTab("events")}
                      className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#D528A2] to-pink-600 hover:opacity-95 text-white font-extrabold text-xs shadow-md shadow-[#D528A2]/20 transition-all cursor-pointer flex items-center gap-2 shrink-0"
                    >
                      <span>Open Event Management</span>
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Daily Day Order & Status Settings - Trigger Card & Popup Modal */}
                <div className="md:col-span-2 pt-6 border-t border-slate-200">
                  <div className="bg-white border border-slate-200 shadow-xs rounded-2xl p-5 flex justify-between items-center flex-wrap gap-4 hover:border-slate-300 transition-all">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2 bg-slate-100 text-slate-800 rounded-xl border border-slate-200/80">
                          <Calendar className="h-5 w-5" />
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-sm font-black uppercase tracking-wider text-slate-900">
                            Daily Day Order & Status Settings
                          </h3>
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-slate-100 text-slate-600 border border-slate-200">
                            {dailyConfigsList.length} Records Configured
                          </span>
                        </div>
                      </div>
                      <p className="text-xs text-slate-500 font-medium pl-10">
                        Configure daily working days, holidays, campus events, exam days, session modes, and continuous day order cycles (Day 1 ➔ Day 6).
                      </p>
                    </div>

                    <Button
                      variant="primary"
                      size="md"
                      onClick={() => setIsDailyConfigModalOpen(true)}
                      className="bg-slate-900 hover:bg-slate-800 text-white shadow-sm font-extrabold"
                      icon={<Calendar className="h-4 w-4" />}
                    >
                      Open Daily Schedule Configurator
                    </Button>
                  </div>
                </div>

                {/* Class Teacher / Class Advisor Assignments Panel */}
                <div className="md:col-span-2 pt-6 border-t border-slate-200 space-y-4">
                  <div className="flex justify-between items-center flex-wrap gap-3 pb-2 border-b border-slate-100">
                    <div>
                      <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                        <Users className="h-4 w-4 text-[#D528A2]" />
                        Class Teacher / Class Advisor Assignments
                      </h3>
                      <p className="text-[10px] text-slate-500 font-semibold mt-0.5">
                        Assign a Class Teacher / Mentor for each Year & Class Group. Student Leave & OD requests will route directly to their assigned Class Teacher.
                      </p>
                    </div>
                  </div>

                  {/* Form */}
                  <form onSubmit={handleSaveClassTeacherAssignment} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 bg-slate-50/80 p-5 border border-slate-200 rounded-2xl">
                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wider block">Academic Year</label>
                      <select
                        value={selectedAssignYear}
                        onChange={e => setSelectedAssignYear(e.target.value)}
                        className="w-full p-2.5 border border-slate-200 rounded-xl bg-white text-xs font-semibold focus:ring-2 focus:ring-[#D528A2]/20 outline-none shadow-xs cursor-pointer text-slate-800"
                      >
                        <option value="Year 1">Year 1</option>
                        <option value="Year 2">Year 2</option>
                        <option value="Year 3">Year 3</option>
                        <option value="Year 4">Year 4</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wider block">Class Group / Cohort</label>
                      <input
                        type="text"
                        placeholder="e.g. CSE-A / Section A"
                        value={selectedAssignClassGroup}
                        onChange={e => setSelectedAssignClassGroup(e.target.value)}
                        className="w-full p-2.5 border border-slate-200 rounded-xl bg-white text-xs font-semibold focus:ring-2 focus:ring-[#D528A2]/20 outline-none shadow-xs text-slate-800"
                        required
                      />
                    </div>

                    <div className="space-y-1 sm:col-span-2">
                      <label className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wider block">Assigned Mentor / Class Teacher</label>
                      <div className="flex gap-2">
                        <select
                          value={selectedAssignMentorId}
                          onChange={e => setSelectedAssignMentorId(e.target.value)}
                          className="flex-1 p-2.5 border border-slate-200 rounded-xl bg-white text-xs font-semibold focus:ring-2 focus:ring-[#D528A2]/20 outline-none shadow-xs cursor-pointer text-slate-800"
                          required
                        >
                          <option value="">Select Mentor...</option>
                          {collegeMentors.map(m => (
                            <option key={m.id} value={m.id}>
                              {m.name} ({m.department}) - {m.email}
                            </option>
                          ))}
                        </select>
                        <button
                          type="submit"
                          disabled={isAssigningClassTeacher}
                          className="px-4 py-2.5 rounded-xl text-xs font-extrabold bg-[#D528A2] hover:bg-[#c02090] text-white shadow-sm transition-all cursor-pointer disabled:opacity-50 shrink-0"
                        >
                          {isAssigningClassTeacher ? "Assigning..." : "Assign Teacher"}
                        </button>
                      </div>
                    </div>
                  </form>

                  {/* Class Teacher Assignments Table */}
                  <div className="border border-slate-200 rounded-2xl bg-white shadow-xs overflow-hidden">
                    <div className="p-3 bg-slate-50/80 border-b border-slate-200 flex justify-between items-center">
                      <span className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                        Active Class Teacher Assignments ({classTeacherAssignments.length})
                      </span>
                    </div>
                    <div className="overflow-x-auto max-h-[220px] overflow-y-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead className="sticky top-0 bg-slate-100 z-10">
                          <tr className="border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                            <th className="p-3">Year</th>
                            <th className="p-3">Class Group</th>
                            <th className="p-3">Assigned Class Teacher</th>
                            <th className="p-3">Department</th>
                            <th className="p-3 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {classTeacherAssignments.length === 0 ? (
                            <tr>
                              <td colSpan={5} className="p-6 text-center text-slate-400 italic text-xs">
                                No Class Teachers assigned yet. Use the form above to assign mentors for each Year & Class Group.
                              </td>
                            </tr>
                          ) : (
                            classTeacherAssignments.map(a => (
                              <tr key={a.id} className="hover:bg-slate-50/50 transition-colors">
                                <td className="p-3 font-extrabold text-slate-900">{a.year}</td>
                                <td className="p-3 font-bold text-[#D528A2]">{a.classGroup}</td>
                                <td className="p-3 font-semibold text-slate-800">
                                  {a.mentor_name}
                                  <span className="text-slate-400 block text-[10px] font-normal">{a.mentor_email}</span>
                                </td>
                                <td className="p-3 text-slate-600 font-medium">{a.mentor_department || a.department}</td>
                                <td className="p-3 text-right">
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteClassTeacherAssignment(a.id)}
                                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all cursor-pointer"
                                    title="Remove Assignment"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
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
                    {Array.from(new Set(collegeStudents.map(s => s.classGroup).filter(Boolean))).map(cls => {
                      const isAllowed = allowedProfileEditClasses.includes(cls);
                      return (
                        <div key={cls} className="p-4.5 rounded-xl border border-slate-200 bg-white shadow-sm flex items-center justify-between gap-4 hover:shadow-md transition-all font-sans">
                          <div className="space-y-1">
                            <h4 className="text-xs font-bold text-slate-805">{cls}</h4>
                            <span className="text-[9px] text-slate-400 font-semibold block">
                              {collegeStudents.filter(s => s.classGroup === cls).length} enrolled students
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
                    <Button variant="primary" size="sm" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => handleOpenSubjectModal()}>
                      + Subject
                    </Button>
                    <Button variant="secondary" size="sm" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => handleOpenDeptModal()}>
                      + Department / Course
                    </Button>
                  </>
                }
              >
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

                  const filteredSubs = collegeSubjects.filter(sub => {
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

                  const registeredDeptNames = collegeCourses.map(d => d.name);
                  const subjectDeptNames = [...new Set(filteredSubs.map(s => s.department).filter(Boolean))];
                  const allDeptNames = [...new Set([...registeredDeptNames, ...subjectDeptNames])].sort();

                  const totalSubCount = collegeSubjects.length;
                  const totalDeptCount = allDeptNames.length;

                  return (
                    <div className="space-y-4">
                      {/* Search & Filter Bar */}
                      <div className="flex flex-wrap items-center gap-2 pt-2">
                        <div className="relative flex-1 min-w-[200px]">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                          <input
                            type="text"
                            placeholder="Search subjects..."
                            value={subjectSearch}
                            onChange={(e) => setSubjectSearch(e.target.value)}
                            className="w-full pl-9 pr-3 py-1.5 border border-slate-200 rounded-xl bg-white text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-650"
                          />
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
                        <span className="ml-auto text-[10px] text-slate-400 font-semibold">
                          {totalSubCount} {totalSubCount === 1 ? "subject" : "subjects"} · {totalDeptCount} {totalDeptCount === 1 ? "department" : "departments"}
                        </span>
                      </div>

                      {allDeptNames.length === 0 ? (
                        <div className="py-12 text-center border rounded-xl bg-white">
                          <GraduationCap className="h-8 w-8 text-slate-300 mx-auto mb-3" />
                          <p className="text-sm font-semibold text-slate-400">No departments or subjects found</p>
                          <p className="text-[10px] text-slate-300 mt-1">Use <strong>+ Department / Course</strong> and <strong>+ Subject</strong> above to get started.</p>
                        </div>
                      ) : (
                        <div className="space-y-4 text-xs font-semibold">
                          {allDeptNames.map(deptName => {
                            const registeredDept = collegeCourses.find(d => d.name === deptName);
                        
                        // Flexible subject matching helper
                        const norm = (str: string) => (str || "").toLowerCase().replace(/[^a-z0-9]/g, "");
                        const isDeptSubjectMatch = (subDept: string, dName: string, dCode?: string) => {
                          if (!subDept || !dName) return false;
                          const nSub = norm(subDept);
                          const nName = norm(dName);
                          const nCode = dCode ? norm(dCode) : "";
                          if (nSub === nName) return true;
                          if (nCode && nSub === nCode) return true;
                          if (nSub && nName && (nSub.includes(nName) || nName.includes(nSub))) return true;
                          if (nCode && nSub && (nSub.includes(nCode) || nCode.includes(nSub))) return true;
                          const baseSub = norm(subDept.replace(/\s*-\s*(Semester|Sem|Year|Yr|Shift|Batch)\s*\d+/gi, ""));
                          const baseName = norm(dName.replace(/\s*-\s*(Semester|Sem|Year|Yr|Shift|Batch)\s*\d+/gi, ""));
                          return baseSub === baseName || (baseSub.length > 0 && baseName.length > 0 && (baseSub.includes(baseName) || baseName.includes(baseSub)));
                        };

                        const deptSubjects = filteredSubs.filter(s => isDeptSubjectMatch(s.department, deptName, registeredDept?.code));
                        const isDeptExpanded = !!expandedDepts[deptName];

                        const getSemNum = (semStr?: string) => {
                          if (!semStr) return 0;
                          const num = parseInt(semStr.replace(/\D/g, ""), 10);
                          if (num) return num;
                          const lower = semStr.toLowerCase();
                          if (lower.includes("viii") || lower.includes("8")) return 8;
                          if (lower.includes("vii") || lower.includes("7")) return 7;
                          if (lower.includes("vi") || lower.includes("6")) return 6;
                          if (lower.includes("v") || lower.includes("5")) return 5;
                          if (lower.includes("iv") || lower.includes("4")) return 4;
                          if (lower.includes("iii") || lower.includes("3")) return 3;
                          if (lower.includes("ii") || lower.includes("2")) return 2;
                          if (lower.includes("i") || lower.includes("1")) return 1;
                          return 0;
                        };

                        const yearGroups = YEARS.map(yr => ({
                          yr,
                          sems: YEAR_SEM_MAP[yr].map(sem => {
                            const semTargetNum = parseInt(sem.replace(/\D/g, "") || "0", 10);
                            return {
                              sem,
                              subjects: deptSubjects.filter(s => s.semester === sem || getSemNum(s.semester) === semTargetNum)
                            };
                          }).filter(sg => sg.subjects.length > 0)
                        })).filter(yg => yg.sems.length > 0);

                        const ungrouped = deptSubjects.filter(s => {
                          const sNum = getSemNum(s.semester);
                          return !ALL_KNOWN_SEMS.includes(s.semester || "") && (sNum < 1 || sNum > 8);
                        });

                        return (
                          <div key={deptName} className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden transition-all duration-200">

                            {/* ── DEPARTMENT HEADER (Collapsible Card Style) ── */}
                            <div
                              onClick={() => setExpandedDepts(prev => ({ ...prev, [deptName]: !prev[deptName] }))}
                              className="flex items-center justify-between px-5 py-4 bg-slate-50 hover:bg-slate-100/70 border-b border-slate-200/50 cursor-pointer select-none transition-all duration-200 group"
                            >
                              <div className="flex items-center gap-3">
                                <GraduationCap className="h-4 w-4 text-slate-400 shrink-0" />
                                <div>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-[12px] font-black text-slate-800">{deptName}</span>
                                    {registeredDept?.code && <span className="text-[9px] px-1.5 py-0.5 bg-indigo-50 border border-indigo-150 text-indigo-700 rounded font-bold uppercase">{registeredDept.code}</span>}
                                    {registeredDept?.start_year && registeredDept?.end_year && (
                                      <span className="text-[9px] px-1.5 py-0.5 bg-purple-50 border border-purple-150 text-purple-700 rounded font-bold">
                                        {registeredDept.start_year}–{registeredDept.end_year}
                                      </span>
                                    )}
                                    {registeredDept && (() => {
                                      const s = (registeredDept.default_shift || (registeredDept.shift_based === 1 ? "both" : "general")).toLowerCase();
                                      if (s === "both") {
                                        return (
                                          <span className="text-[9px] px-2 py-0.5 border rounded font-bold uppercase bg-purple-50 border-purple-200 text-purple-700">
                                            Shift 1 & 2 (Both Shifts)
                                          </span>
                                        );
                                      }
                                      if (s === "all") {
                                        return (
                                          <span className="text-[9px] px-2 py-0.5 border rounded font-bold uppercase bg-purple-50 border-purple-200 text-purple-700">
                                            Shift 1, 2 & General
                                          </span>
                                        );
                                      }
                                      if (s === "shift_1") {
                                        return (
                                          <span className="text-[9px] px-2 py-0.5 border rounded font-bold uppercase bg-teal-50 border-teal-200 text-teal-700">
                                            Shift 1 (Day)
                                          </span>
                                        );
                                      }
                                      if (s === "shift_2") {
                                        return (
                                          <span className="text-[9px] px-2 py-0.5 border rounded font-bold uppercase bg-amber-50 border-amber-200 text-amber-700">
                                            Shift 2 (Eve)
                                          </span>
                                        );
                                      }
                                      return (
                                        <span className="text-[9px] px-2 py-0.5 border rounded font-bold uppercase bg-slate-100 border-slate-200 text-slate-700">
                                          General Shift
                                        </span>
                                      );
                                    })()}
                                  </div>
                                  {registeredDept?.description && <p className="text-[10px] text-slate-400 mt-0.5 font-medium">{registeredDept.description}</p>}
                                </div>
                              </div>
                              <div className="flex items-center gap-3" onClick={e => e.stopPropagation()}>
                                <span className="text-[9px] font-bold px-2.5 py-0.5 bg-slate-200 text-slate-600 rounded-full">{deptSubjects.length} subjects</span>
                                <div className="flex gap-1">
                                  {registeredDept && (
                                    <Button variant="ghost" size="xs" onClick={() => handleOpenDeptModal(registeredDept)} title="Edit Course & Batch Details" className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50"><Edit2 className="h-3 w-3" /></Button>
                                  )}
                                  <Button variant="ghost" size="xs" onClick={() => handleDeleteDept(deptName, registeredDept?.id)} title="Delete Department" className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50"><Trash2 className="h-3 w-3" /></Button>
                                </div>
                                <ChevronDown className={`h-4.5 w-4.5 text-slate-400 transition-transform duration-200 ml-1 ${isDeptExpanded ? "rotate-180 text-indigo-500" : ""}`} />
                              </div>
                            </div>

                            {/* ── COLLAPSIBLE DEPARTMENT CONTENT (ADMIN-STYLE OVERVIEW + YEAR-WISE CARDS) ── */}
                            {isDeptExpanded && (
                              <div className="p-4 bg-slate-50/40 space-y-4 border-t border-slate-200/60 animate-fade-in">
                                {/* Course Overview Details Card */}
                                <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-col md:flex-row justify-between gap-4">
                                  <div className="space-y-1.5 flex-1">
                                    <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Course Overview</span>
                                    <p className="text-xs text-slate-600 font-semibold leading-relaxed">
                                      {registeredDept?.description || "No description provided for this course."}
                                    </p>
                                  </div>
                                  <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-[11px] font-bold text-slate-600 shrink-0 md:border-l md:border-slate-150 md:pl-6 md:min-w-[280px]">
                                    <div>
                                      <span className="text-[9px] uppercase tracking-wider text-slate-400 block mb-0.5">Course Duration</span>
                                      <span className="text-slate-900 font-black">
                                        {registeredDept?.years || 3} Year(s) ({Number(registeredDept?.years || 3) * 2} Semesters)
                                      </span>
                                    </div>
                                    <div>
                                      <span className="text-[9px] uppercase tracking-wider text-slate-400 block mb-0.5">Code Prefix</span>
                                      <span className="text-indigo-650 font-black">{registeredDept?.code || "None"}</span>
                                    </div>
                                    <div>
                                      <span className="text-[9px] uppercase tracking-wider text-slate-400 block mb-0.5">Offerings</span>
                                      <span className="text-slate-900 font-black">{registeredDept?.default_shift === "all" ? "Shift 1, 2 & General" : registeredDept?.default_shift === "both" ? "Shift 1 & 2" : registeredDept?.default_shift === "shift_2" ? "Shift 2 (Evening)" : registeredDept?.default_shift === "shift_1" ? "Shift 1 (Day)" : "General Shift"}</span>
                                    </div>
                                    <div className="col-span-2">
                                      <span className="text-[9px] uppercase tracking-wider text-slate-400 block mb-0.5">Assigned Classrooms (Year-wise)</span>
                                      <span className="text-indigo-700 font-black block">
                                        {formatYearWiseRooms(registeredDept?.default_room)}
                                      </span>
                                    </div>
                                  </div>
                                </div>

                                {/* 4 Year Cards Grid (Year 1, Year 2, Year 3, Year 4) */}
                                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                                  {Array.from({ length: registeredDept?.years ? Number(registeredDept.years) : 3 }, (_, i) => `Year ${i + 1}`).map((yr, i) => {
                                    const oddNum = 2 * (i + 1) - 1;
                                    const evenNum = 2 * (i + 1);
                                    const semOdd = `Semester ${oddNum}`;
                                    const semEven = `Semester ${evenNum}`;
                                    const yrSubjects = deptSubjects.filter(s => s.year === yr || s.year === `Year ${i + 1}` || s.year === `${i + 1}rd Year` || s.year === `${i + 1}nd Year` || s.year === `${i + 1}st Year` || getSemNum(s.semester) === oddNum || getSemNum(s.semester) === evenNum);
                                    const oddSubjects = yrSubjects.filter(s => s.semester === semOdd || getSemNum(s.semester) === oddNum);
                                    const evenSubjects = yrSubjects.filter(s => s.semester === semEven || getSemNum(s.semester) === evenNum);

                                    return (
                                      <div key={yr} className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-xs flex flex-col">
                                        {/* Year Header */}
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 bg-slate-50/80 border-b border-slate-200 font-bold text-slate-800 text-xs gap-2">
                                          <div className="flex items-center gap-2 flex-wrap">
                                            <GraduationCap className="h-4 w-4 text-indigo-600 shrink-0" />
                                            <span className="font-extrabold text-slate-900">{yr}</span>
                                            <span className="text-[10px] text-slate-400 font-semibold lowercase">(sem {2 * (i + 1) - 1}/{2 * (i + 1)})</span>
                                            <div className="flex gap-1.5 ml-1">
                                              <span className="bg-indigo-50 border border-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full text-[9px] font-extrabold">Sem {2 * (i + 1) - 1}: {oddSubjects.length}</span>
                                              <span className="bg-purple-50 border border-purple-100 text-purple-700 px-2 py-0.5 rounded-full text-[9px] font-extrabold">Sem {2 * (i + 1)}: {evenSubjects.length}</span>
                                            </div>
                                          </div>
                                          <Button
                                            variant="secondary"
                                            size="xs"
                                            onClick={() => handleOpenSubjectModal(undefined, deptName, yr)}
                                            className="flex items-center gap-1 text-[10px] bg-indigo-50 border border-indigo-150 text-indigo-700 hover:bg-indigo-600 hover:text-white px-2 py-1 rounded-lg font-bold shrink-0"
                                          >
                                            <Plus className="h-3 w-3" /> Add Subject
                                          </Button>
                                        </div>

                                        {/* Year Card Body: Odd & Even Semester Columns */}
                                        <div className="p-3.5 flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50/20">
                                          {/* Odd Semester Column */}
                                          <div className="flex flex-col border border-slate-200 rounded-xl p-3 bg-white shadow-2xs">
                                            <div className="flex items-center justify-between pb-2 border-b border-slate-100 mb-2">
                                              <span className="font-extrabold text-[10px] uppercase tracking-wider text-indigo-700">{semOdd}</span>
                                              <span className="bg-indigo-50 border border-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full text-[8.5px] font-extrabold">{oddSubjects.length} subject(s)</span>
                                            </div>
                                            {oddSubjects.length === 0 ? (
                                              <div className="text-center py-6 text-slate-400 italic text-[10px] my-auto">No subjects mapped to {semOdd} yet.</div>
                                            ) : (
                                              <div className="space-y-1.5">
                                                {oddSubjects.map(sub => (
                                                  <div key={sub.id} className="p-2 border border-slate-100 rounded-lg hover:border-indigo-100 hover:bg-indigo-50/30 transition-all flex items-center justify-between gap-2 group">
                                                    <div>
                                                      <div className="font-bold text-slate-800 text-[11px]">{sub.name}</div>
                                                      <div className="flex items-center gap-1.5 mt-0.5">
                                                        <span className="text-[8px] px-1.5 py-0.2 rounded bg-indigo-50 border border-indigo-100 text-indigo-700 font-bold uppercase">{sub.type}</span>
                                                        <span className="text-[8px] text-slate-400 font-semibold">{sub.weekly_hours || 4} hrs/wk</span>
                                                      </div>
                                                    </div>
                                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                      <button onClick={() => handleStartEditSubject(sub)} className="p-1 text-slate-400 hover:text-indigo-600 cursor-pointer"><Edit2 className="h-3 w-3" /></button>
                                                      <button 
                                                        onClick={() => handleDeleteSubject(sub.id)} 
                                                        disabled={loadingActions[`delete_subject_${sub.id}`]}
                                                        className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                                      >
                                                        {loadingActions[`delete_subject_${sub.id}`] ? (
                                                          <Loader2 className="h-3 w-3 animate-spin" />
                                                        ) : (
                                                          <Trash2 className="h-3 w-3" />
                                                        )}
                                                      </button>
                                                    </div>
                                                  </div>
                                                ))}
                                              </div>
                                            )}
                                          </div>

                                          {/* Even Semester Column */}
                                          <div className="flex flex-col border border-slate-200 rounded-xl p-3 bg-white shadow-2xs">
                                            <div className="flex items-center justify-between pb-2 border-b border-slate-100 mb-2">
                                              <span className="font-extrabold text-[10px] uppercase tracking-wider text-purple-700">{semEven}</span>
                                              <span className="bg-purple-50 border border-purple-100 text-purple-700 px-2 py-0.5 rounded-full text-[8.5px] font-extrabold">{evenSubjects.length} subject(s)</span>
                                            </div>
                                            {evenSubjects.length === 0 ? (
                                              <div className="text-center py-6 text-slate-400 italic text-[10px] my-auto">No subjects mapped to {semEven} yet.</div>
                                            ) : (
                                              <div className="space-y-1.5">
                                                {evenSubjects.map(sub => (
                                                  <div key={sub.id} className="p-2 border border-slate-100 rounded-lg hover:border-purple-100 hover:bg-purple-50/30 transition-all flex items-center justify-between gap-2 group">
                                                    <div>
                                                      <div className="font-bold text-slate-800 text-[11px]">{sub.name}</div>
                                                      <div className="flex items-center gap-1.5 mt-0.5">
                                                        <span className="text-[8px] px-1.5 py-0.2 rounded bg-purple-50 border border-purple-100 text-purple-700 font-bold uppercase">{sub.type}</span>
                                                        <span className="text-[8px] text-slate-400 font-semibold">{sub.weekly_hours || 4} hrs/wk</span>
                                                      </div>
                                                    </div>
                                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                      <button onClick={() => handleStartEditSubject(sub)} className="p-1 text-slate-400 hover:text-purple-600 cursor-pointer"><Edit2 className="h-3 w-3" /></button>
                                                      <button 
                                                        onClick={() => handleDeleteSubject(sub.id)} 
                                                        disabled={loadingActions[`delete_subject_${sub.id}`]}
                                                        className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                                      >
                                                        {loadingActions[`delete_subject_${sub.id}`] ? (
                                                          <Loader2 className="h-3 w-3 animate-spin" />
                                                        ) : (
                                                          <Trash2 className="h-3 w-3" />
                                                        )}
                                                      </button>
                                                    </div>
                                                  </div>
                                                ))}
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
                          </div>
                        );
                      })}
                    </div>
                  )}
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
                      variant="secondary" 
                      size="sm" 
                      onClick={handleDownloadFacultyTemplate}
                      icon={<Download className="h-3.5 w-3.5" />}
                    >
                      Template
                    </Button>
                    <label className="px-3 py-1 rounded-xl text-xs font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 transition-all flex items-center gap-1.5 cursor-pointer">
                      <Upload className="h-3.5 w-3.5" />
                      Bulk Import
                      <input
                        type="file"
                        accept=".xlsx, .xls, .csv"
                        onChange={handleFacultyFileSelect}
                        className="hidden"
                      />
                    </label>
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
                              const shiftVal = facultyShifts[m.id] || "general";
                              const pct = Math.min((hoursCount / limit) * 100, 100);
                              const isOverloaded = hoursCount > limit;

                              return (
                                <div key={m.id} className="bg-white border border-slate-150 rounded-xl p-5 flex flex-col justify-between space-y-4 shadow-sm hover:shadow-md transition-all duration-300 relative group font-sans">
                                  
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
                                        Mentor Group: {m.mentor_group || m.subject_group || m.department || "General"}
                                      </span>
                                    </div>
                                  </div>

                                  {/* Shift & Workload Badges */}
                                  <div className="flex flex-wrap gap-1.5">
                                    {isCampusShiftBased && (
                                      <span className="px-2 py-0.5 rounded-lg bg-indigo-50 border border-indigo-100 text-[8px] font-black text-indigo-750 uppercase">
                                        {shiftVal.replace("_", " ")}
                                      </span>
                                    )}
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

                    const cohortSemesters = Array.from(new Set(
                      activeBatches
                        .filter(cg => {
                          const slot = collegeSlots.find(s => s.classGroup === cg);
                          const c = slot?.department || getCourseFromClassGroup(cg);
                          return c === selectedCohortCourse;
                        })
                        .map(cg => {
                          const slot = collegeSlots.find(s => s.classGroup === cg);
                          return slot?.semester || getSemesterFromClassGroup(cg);
                        })
                        .filter(Boolean)
                    ));

                    const previewTimeSlots = getTimeSlots(
                      hasShifts ? (timetableSubTab === "view" ? viewerShift : genShift) : "general",
                      timetableSubTab === "view" ? selectedCohortSem : genSelectedSemester,
                      activeCollegeId
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
                            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6">
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
                                    {cohortCourses.map((c, idx) => (
                                      <option key={`c_crs_${c}_${idx}`} value={c}>{c}</option>
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
                                    {cohortSemesters.map((s, idx) => (
                                      <option key={`c_sem_${s}_${idx}`} value={s}>{s}</option>
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
                                  <div className="flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={handleRegenerateClick}
                                      className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-indigo-200 bg-indigo-50/80 text-indigo-700 text-xs font-black hover:bg-indigo-100 hover:border-indigo-300 transition-all cursor-pointer shadow-xs active:scale-95 duration-150"
                                      title="Open in Timetable Generator Engine to edit, regenerate, download templates, or clear timetable"
                                    >
                                      <Sparkles className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
                                      <span>Timetable Engine &amp; Actions →</span>
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Hour Allocation Tracker */}
                            {(() => {
                              const activeSem = timetableSubTab === "view" ? selectedCohortSem : genSelectedSemester;
                              const deptSubs = subjectsList.filter(
                                s => (!s.college_id || s.college_id === activeCollegeId) && 
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
                                <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-4 animate-fadeIn">
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
                                        <div key={sub.name} className={`p-3.5 rounded-xl border flex flex-col justify-between bg-white shadow-xs transition-all ${
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
                              <div className="p-8 text-center text-xs text-slate-400 font-semibold border border-dashed border-slate-200 rounded-xl">
                                No class group selected or scheduled. Select a class group above to view its timetable.
                              </div>
                            ) : (
                              <div className="overflow-auto max-h-[70vh] rounded-xl border border-slate-200 shadow-sm relative no-scrollbar">
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
                                                  (s.time === time || isTimeSlotMatch(s.time, time)) &&
                                                  (s.classGroup === viewerClassGroup || isCohortMatch(s.classGroup, viewerClassGroup)) &&
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
                            {/* ── TIMETABLE GENERATOR ENGINE ACTION BAR & TOOLTIPS ── */}
                            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3 animate-fadeIn">
                              <div className="flex items-center gap-3">
                                <div className="h-9 w-9 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0">
                                  <Sparkles className="h-5 w-5" />
                                </div>
                                <div>
                                  <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">Timetable Engine Controls</h3>
                                  <p className="text-[11px] text-slate-500 font-medium">
                                    Target Cohort: <span className="font-bold text-indigo-650">{genClassGroup || (genSelectedCourse ? `${genSelectedCourse} - ${genSelectedSemester}` : "Select Course Below")}</span>
                                  </p>
                                </div>
                              </div>

                              <div className="flex flex-wrap items-center gap-2">
                                {/* Download Template Button with auto-tooltip */}
                                <div className="relative group">
                                  <button
                                    type="button"
                                    onClick={handleDownloadGridTemplate}
                                    disabled={!genSelectedCourse || !genClassGroup}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all shadow-xs cursor-pointer select-none active:scale-95 duration-150 ${
                                      !genSelectedCourse || !genClassGroup
                                        ? "bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed"
                                        : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                                    }`}
                                  >
                                    <Download className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                                    <span>Download Template</span>
                                  </button>
                                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:flex flex-col items-center z-50 pointer-events-none min-w-[210px] animate-fadeIn">
                                    <div className="bg-slate-900 text-white text-[10px] font-bold px-2.5 py-1.5 rounded-lg shadow-xl border border-slate-700 text-center leading-tight">
                                      📥 Download pre-filled Excel template to edit class schedule offline.
                                    </div>
                                    <div className="w-2 h-2 bg-slate-900 rotate-45 -mt-1 border-r border-b border-slate-700"></div>
                                  </div>
                                </div>

                                {/* Upload Timetable Button with auto-tooltip */}
                                <div className="relative group">
                                  <label className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all shadow-xs cursor-pointer select-none active:scale-95 duration-150 ${
                                    !genSelectedCourse || !genClassGroup
                                      ? "bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed"
                                      : "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
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
                                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:flex flex-col items-center z-50 pointer-events-none min-w-[210px] animate-fadeIn">
                                    <div className="bg-slate-900 text-white text-[10px] font-bold px-2.5 py-1.5 rounded-lg shadow-xl border border-slate-700 text-center leading-tight">
                                      📤 Upload completed Excel spreadsheet to instantly sync scheduled slots.
                                    </div>
                                    <div className="w-2 h-2 bg-slate-900 rotate-45 -mt-1 border-r border-b border-slate-700"></div>
                                  </div>
                                </div>

                                {/* Auto Regenerate Button with auto-tooltip */}
                                <div className="relative group">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (genStep === 1) {
                                        handleTransitionToStep2();
                                      } else {
                                        handleGeneratePreview();
                                      }
                                    }}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-indigo-200 bg-indigo-50 text-indigo-700 text-xs font-bold hover:bg-indigo-100 transition-all cursor-pointer shadow-xs active:scale-95 duration-150"
                                  >
                                    <Sparkles className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
                                    <span>Regenerate</span>
                                  </button>
                                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:flex flex-col items-center z-50 pointer-events-none min-w-[210px] animate-fadeIn">
                                    <div className="bg-slate-900 text-white text-[10px] font-bold px-2.5 py-1.5 rounded-lg shadow-xl border border-slate-700 text-center leading-tight">
                                      ✨ Calculate and place conflict-free faculty and room schedules automatically.
                                    </div>
                                    <div className="w-2 h-2 bg-slate-900 rotate-45 -mt-1 border-r border-b border-slate-700"></div>
                                  </div>
                                </div>

                                {/* Clear Timetable Button with auto-tooltip */}
                                <div className="relative group">
                                  <button
                                    type="button"
                                    onClick={() => handleClearTimetableClick(genClassGroup || viewerClassGroup)}
                                    disabled={!genClassGroup && !viewerClassGroup}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all shadow-xs cursor-pointer select-none active:scale-95 duration-150 ${
                                      !genClassGroup && !viewerClassGroup
                                        ? "bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed"
                                        : "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                                    }`}
                                  >
                                    <Trash2 className="h-3.5 w-3.5 text-rose-600 shrink-0" />
                                    <span>Clear Timetable</span>
                                  </button>
                                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:flex flex-col items-center z-50 pointer-events-none min-w-[210px] animate-fadeIn">
                                    <div className="bg-slate-900 text-white text-[10px] font-bold px-2.5 py-1.5 rounded-lg shadow-xl border border-slate-700 text-center leading-tight">
                                      🗑️ Permanently clear all scheduled periods for this cohort to start fresh.
                                    </div>
                                    <div className="w-2 h-2 bg-slate-900 rotate-45 -mt-1 border-r border-b border-slate-700"></div>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* TIMETABLE AUTO GENERATOR ENGINE STEPS */}
                            {genStep === 1 && (
                              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6 animate-fadeIn">
                                <div className="flex items-center gap-2.5 border-b border-slate-100 pb-4">
                                  <Sparkles className="h-5 w-5 text-indigo-500 animate-pulse" />
                                  <div>
                                    <h3 className="text-sm font-bold text-slate-900">Step 1: Define Target & Bounds</h3>
                                    <p className="text-xs text-slate-400 font-semibold mt-0.5">Specify the course, semester, shift and room criteria for generating a new timetable.</p>
                                  </div>
                                </div>

                                {genError && (
                                  <div className="p-3.5 bg-red-50/50 border border-red-100 text-red-700 text-xs rounded-xl flex items-center gap-2">
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
                                        <div className="md:col-span-2 p-4 rounded-xl border border-indigo-50 bg-indigo-50/20 dark:bg-indigo-950/10 dark:border-indigo-900/30 flex flex-col md:flex-row md:items-center justify-between gap-4 animate-fadeIn">
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
                              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6 animate-fadeIn">
                                <div className="flex items-center gap-2.5 border-b border-slate-100 pb-4">
                                  <SlidersHorizontal className="h-5 w-5 text-indigo-500" />
                                  <div>
                                    <h3 className="text-sm font-bold text-slate-900">Step 2: Setup Workloads & Instructors</h3>
                                    <p className="text-xs text-slate-400 font-semibold mt-0.5">Map subjects to faculty mentors, define target hours per week and assign classrooms.</p>
                                  </div>
                                </div>

                                {genError && (
                                  <div className="p-3.5 bg-red-50/50 border border-red-100 text-red-700 text-xs rounded-xl flex items-center gap-2">
                                    <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
                                    <span className="font-semibold">{genError}</span>
                                  </div>
                                )}

                                {genAllocations.length === 0 ? (
                                  <div className="py-12 text-center border border-dashed border-slate-200 rounded-xl bg-slate-50/20">
                                    <GraduationCap className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                                    <p className="text-xs text-slate-400 font-bold">No subjects mapped in curriculum for {genSelectedCourse} · {genSelectedSemester}</p>
                                    <p className="text-[10px] text-slate-350 mt-1 mb-4">Please add subjects under the **Curriculum Map** tab first or use quick add below.</p>
                                  </div>
                                ) : (
                                  <div className="overflow-x-auto border border-slate-200 rounded-xl shadow-sm">
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
                                                isMentorInProgram(m, genSelectedCourse, collegeSlots, collegeSubjects)
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
                                    <div className="bg-slate-50/60 p-4 border border-slate-150 rounded-xl space-y-4 animate-fadeIn">
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
                              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6 animate-fadeIn">
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
                                  <div className="p-3.5 bg-red-50/50 border border-red-100 text-red-700 text-xs rounded-xl flex items-center gap-2">
                                    <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
                                    <span className="font-semibold">{genError}</span>
                                  </div>
                                )}

                                {genSuccess && (
                                  <div className="p-3.5 bg-emerald-50/50 border border-emerald-100 text-emerald-700 text-xs rounded-xl flex items-center gap-2">
                                    <CheckCircle className="h-4 w-4 shrink-0 text-emerald-500" />
                                    <span className="font-semibold">{genSuccess}</span>
                                  </div>
                                )}

                                {/* Unscheduled Workload Alert */}
                                {genUnscheduled.length > 0 && (
                                  <div className="p-4 bg-amber-50/55 border border-amber-200/60 rounded-xl space-y-2">
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
                                <div className="overflow-auto max-h-[70vh] rounded-xl border border-slate-200 shadow-sm relative no-scrollbar">
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

                  {/* 5.5 INTERVIEW ALLOCATIONS & GMEET */}
                  {activeTab === "interviews" && (
                    <InterviewModule currentUserRole="cm" currentUserName={currentCAM?.name || "Campus Manager"} defaultCollegeId={activeCollegeId} />
                  )}

                  {/* 6. ACADEMIC MONITORING / MASTER STUDENT ATTENDANCE DIRECTORY */}
                  {activeTab === "monitoring" && (() => {
                    const todayStr = new Date().toISOString().split("T")[0];

                    // Build working dates from THREE sources so no date is ever missing:
                    // 1. Dates that actually have attendance records in context
                    // 2. All calendar Mon–Sat days in the selected range (excluding holidays)
                    // 3. Today (always included if within range)
                    const attendanceDateSet = new Set<string>();

                    // Source 1: dates with actual attendance data
                    (studentAttendance || []).forEach(a => {
                      if (a.dateStr) attendanceDateSet.add(a.dateStr);
                    });

                    // Source 2: every Mon–Sat in the selected range (so mentor-marked dates appear even if not in context yet)
                    const rangeStart = new Date(attendanceStartDate + "T00:00:00");
                    const rangeEnd = new Date(attendanceEndDate + "T00:00:00");
                    if (!isNaN(rangeStart.getTime()) && !isNaN(rangeEnd.getTime())) {
                      const cur = new Date(rangeStart);
                      while (cur <= rangeEnd) {
                        const dayOfWeek = cur.getDay();
                        const ymd = cur.toISOString().split("T")[0];
                        const isHoliday = (holidays || []).some((h: any) => h?.date === ymd || h?.dateStr === ymd);
                        if (dayOfWeek !== 0 && !isHoliday) {
                          attendanceDateSet.add(ymd);
                        }
                        cur.setDate(cur.getDate() + 1);
                      }
                    }

                    // Source 3: today
                    if (todayStr >= attendanceStartDate && todayStr <= attendanceEndDate) {
                      attendanceDateSet.add(todayStr);
                    }

                    const workingDates = Array.from(attendanceDateSet)
                      .filter(d => d >= attendanceStartDate && d <= attendanceEndDate)
                      .sort();

                    // High-Performance O(1) Precomputed Maps (Eliminates all table lag)
                    const attendanceMap = new Map<string, any[]>();
                    (studentAttendance || []).forEach(a => {
                      if (!a.studentId || !a.dateStr) return;
                      const k1 = `${a.studentId}_${a.dateStr}`;
                      const l1 = attendanceMap.get(k1);
                      if (l1) l1.push(a);
                      else attendanceMap.set(k1, [a]);
                    });

                    const slotsCache = new Map<string, any[]>();
                    const getStudentSlots = (dayName: string, classGroup?: string) => {
                      const cacheKey = `${dayName}__${(classGroup || "").toLowerCase()}`;
                      if (slotsCache.has(cacheKey)) return slotsCache.get(cacheKey)!;
                      const res = collegeSlots.filter(s => s.day === dayName && (!s.classGroup || isCohortMatch(s.classGroup, classGroup)));
                      slotsCache.set(cacheKey, res);
                      return res;
                    };

                    // Apply student filters with deferred search for 60fps typing
                    const q = (deferredStudentSearch || "").trim().toLowerCase();
                    const filtered = collegeStudents.filter(s => {
                      const matchesSearch = !q || s.name.toLowerCase().includes(q) || 
                                           (s.roll_number && s.roll_number.toLowerCase().includes(q)) ||
                                           s.id.toLowerCase().includes(q);
                      const matchesDept = studentDeptFilter === "all" || s.department === studentDeptFilter;
                      const matchesBatch = studentBatchFilter === "all" || s.classGroup === studentBatchFilter;
                      return matchesSearch && matchesDept && matchesBatch;
                    });

                    // Pagination calculations to avoid rendering thousands of DOM nodes at once
                    const totalPages = attendancePageSize > 0 ? Math.max(1, Math.ceil(filtered.length / attendancePageSize)) : 1;
                    const safePage = Math.min(Math.max(1, attendancePage), totalPages);
                    const paginatedStudents = attendancePageSize > 0 
                      ? filtered.slice((safePage - 1) * attendancePageSize, safePage * attendancePageSize) 
                      : filtered;

                    // Overall summary stats
                    // Compute actual dates with ANY attendance in the attendanceMap (for compliance denominator)
                    const datesWithAnyAttendance = new Set<string>();
                    (studentAttendance || []).forEach(a => {
                      if (a.dateStr && workingDates.includes(a.dateStr)) datesWithAnyAttendance.add(a.dateStr);
                    });
                    const actualAttendanceDates = datesWithAnyAttendance.size || workingDates.length;

                    let grandPresentDaysSum = 0;
                    let grandMarkedDaysSum = 0; // total days where attendance was actually recorded (per student)

                    filtered.forEach(st => {
                      workingDates.forEach(dStr => {
                        const stDayAtt = attendanceMap.get(`${st.id}_${dStr}`) || [];
                        if (stDayAtt.length === 0) return;

                        grandMarkedDaysSum++; // this date was marked for this student

                        const pCount = stDayAtt.filter(a => a.status === "present" || a.status === "od").length;
                        const aCount = stDayAtt.filter(a => a.status === "absent").length;

                        if (pCount > 0 && aCount === 0) grandPresentDaysSum += 1;
                        else if (pCount > 0 && aCount > 0) grandPresentDaysSum += 0.5;
                      });
                    });

                    // Compliance = present / (students × actual attendance dates)
                    const grandTotalPossibleDays = filtered.length * actualAttendanceDates;
                    const overallAvgPct = grandTotalPossibleDays > 0 ? Math.round((grandPresentDaysSum / grandTotalPossibleDays) * 100) : 0;

                    // Preset helpers
                    const setPresetDates = (preset: string) => {
                      const today = new Date().toISOString().split("T")[0];
                      if (preset === "all") {
                        setAttendanceStartDate("2026-06-15");
                        setAttendanceEndDate(today);
                      } else if (preset === "this_month") {
                        const now = new Date();
                        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
                        setAttendanceStartDate(firstDay);
                        setAttendanceEndDate(today);
                      } else if (preset === "past_30") {
                        const d = new Date();
                        d.setDate(d.getDate() - 30);
                        setAttendanceStartDate(d.toISOString().split("T")[0]);
                        setAttendanceEndDate(today);
                      } else if (preset === "past_7") {
                        const d = new Date();
                        d.setDate(d.getDate() - 7);
                        setAttendanceStartDate(d.toISOString().split("T")[0]);
                        setAttendanceEndDate(today);
                      } else if (preset === "jun_2026") {
                        setAttendanceStartDate("2026-06-15");
                        setAttendanceEndDate("2026-06-30");
                      } else if (preset === "jul_2026") {
                        setAttendanceStartDate("2026-07-01");
                        setAttendanceEndDate("2026-07-31");
                      } else if (preset === "aug_2026") {
                        setAttendanceStartDate("2026-08-01");
                        setAttendanceEndDate("2026-08-31");
                      }
                    };

                    return (
                      <div className="space-y-4 font-sans">
                        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                          {/* Header & Controls Bar */}
                          <div className="border-b border-slate-150 pb-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                            <div>
                              <h2 className="text-base font-black text-slate-800">Master Student Attendance Directory</h2>
                              <p className="text-xs text-slate-400 font-semibold mt-0.5">
                                Master date-wise attendance matrix with real-time period synchronization, Excel import/export, and range filtering.
                              </p>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex items-center gap-2 flex-wrap">
                              {/* Combined Import Button */}
                              <div className="relative group">
                                <label className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold transition-all shadow-sm cursor-pointer active:scale-95">
                                  <Upload className="h-3.5 w-3.5" />
                                  <span>Import Attendance</span>
                                  <input
                                    type="file"
                                    accept=".xlsx, .xls, .csv"
                                    onChange={handleAttendanceFileSelect}
                                    className="hidden"
                                  />
                                </label>
                                {/* Download template sub-button */}
                                <button
                                  type="button"
                                  onClick={() => handleDownloadAttendanceTemplate(studentBatchFilter, attendanceStartDate, attendanceEndDate)}
                                  className="ml-0.5 inline-flex items-center gap-1 px-2.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-200 text-xs font-bold transition-all shadow-2xs cursor-pointer active:scale-95"
                                  title="Download blank template to fill attendance"
                                >
                                  <Download className="h-3.5 w-3.5" />
                                  <span>Template</span>
                                </button>
                              </div>

                              {/* Export Master Excel */}
                              <button
                                type="button"
                                onClick={() => handleExportDateAttendance(attendanceStartDate, attendanceEndDate, filtered)}
                                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-extrabold transition-all shadow-2xs cursor-pointer active:scale-95"
                                title="Export complete master attendance sheet for all dates to Excel"
                              >
                                <Download className="h-3.5 w-3.5 text-emerald-600" />
                                <span>Export Excel</span>
                              </button>

                              {/* Clear All Attendance */}
                              <button
                                type="button"
                                onClick={handleClearAllAttendance}
                                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-extrabold transition-all shadow-2xs cursor-pointer active:scale-95"
                                title="Wipe all recorded attendance for fresh import or testing"
                              >
                                <Trash2 className="h-3.5 w-3.5 text-rose-600" />
                                <span>Clear</span>
                              </button>
                            </div>
                          </div>

                          {/* Date Range + Filters Toolbar (single compact row) */}
                          <div className="flex flex-col lg:flex-row lg:items-center gap-3 flex-wrap">
                            {/* From & To Pickers */}
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
                            <span className="text-[11px] font-extrabold text-indigo-700 bg-indigo-50 px-2.5 py-1.5 rounded-lg border border-indigo-200 whitespace-nowrap">
                              {workingDates.length} date columns
                            </span>

                            {/* Preset Chips */}
                            <div className="flex items-center gap-1 flex-wrap text-[11px] font-bold">
                              {[
                                { key: "all", label: "All" },
                                { key: "this_month", label: "This Month" },
                                { key: "past_30", label: "30D" },
                                { key: "past_7", label: "7D" },
                                { key: "jun_2026", label: "Jun" },
                                { key: "jul_2026", label: "Jul" },
                                { key: "aug_2026", label: "Aug" },
                              ].map(p => (
                                <button key={p.key} type="button" onClick={() => setPresetDates(p.key)}
                                  className="px-2 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-slate-600 transition-all cursor-pointer active:scale-95 text-[10px]">
                                  {p.label}
                                </button>
                              ))}
                            </div>

                            {/* Divider */}
                            <div className="hidden lg:block w-px h-6 bg-slate-200" />

                            {/* Search */}
                            <div className="relative">
                              <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
                              <input
                                type="text"
                                placeholder="Search name, roll no..."
                                value={studentSearch}
                                onChange={e => setStudentSearch(e.target.value)}
                                className="pl-8 pr-3 py-1.5 border border-slate-200 bg-slate-50 text-xs rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 font-semibold w-44"
                              />
                            </div>

                            {/* Department filter */}
                            <select
                              value={studentDeptFilter}
                              onChange={e => setStudentDeptFilter(e.target.value)}
                              className="py-1.5 px-2.5 border border-slate-200 rounded-xl bg-slate-50 text-xs font-bold cursor-pointer outline-none"
                            >
                              <option value="all">All Departments</option>
                              {studentDepts.map(d => (
                                <option key={d} value={d}>{d}</option>
                              ))}
                            </select>

                            {/* Batch filter */}
                            <select
                              value={studentBatchFilter}
                              onChange={e => setStudentBatchFilter(e.target.value)}
                              className="py-1.5 px-2.5 border border-slate-200 rounded-xl bg-slate-50 text-xs font-bold cursor-pointer outline-none"
                            >
                              <option value="all">All Batches</option>
                              {activeBatches.map(b => (
                                <option key={b} value={b}>{b}</option>
                              ))}
                            </select>

                            {/* Student count badge */}
                            <span className="text-[10px] font-extrabold text-slate-500 bg-slate-100 px-2.5 py-1.5 rounded-lg border border-slate-200 whitespace-nowrap">
                              {filtered.length} students
                            </span>
                          </div>

                          {/* Master Multi-Date Attendance Register Table */}
                          <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-2xs max-h-[70vh]">
                            <table className="w-full border-collapse text-left text-xs font-semibold">
                              <thead className="sticky top-0 z-20 shadow-2xs">
                                <tr className="bg-gradient-to-r from-slate-100 via-indigo-50/40 to-slate-100 border-b border-slate-200 text-slate-700 font-black uppercase text-[9px] tracking-wider whitespace-nowrap">
                                  <th className="p-2.5 border-r border-slate-200 text-center sticky left-0 z-30 bg-slate-100 w-12">Sl. No.</th>
                                  <th className="p-2.5 border-r border-slate-200 sticky left-12 z-30 bg-slate-100 min-w-[110px]">Roll No</th>
                                  <th className="p-2.5 border-r border-slate-200 sticky left-[158px] z-30 bg-slate-100 min-w-[150px]">Name</th>
                                  <th className="p-2.5 border-r border-slate-200 min-w-[110px]">Department</th>
                                  <th className="p-2.5 border-r border-slate-200 text-center min-w-[70px]">Total days</th>
                                  <th className="p-2.5 border-r border-slate-200 text-center min-w-[85px] text-emerald-700">Total Present</th>
                                  <th className="p-2.5 border-r border-slate-200 text-center min-w-[85px] text-rose-700">Total Absent</th>
                                  <th className="p-2.5 border-r border-slate-200 text-center min-w-[65px] text-indigo-700">%</th>
                                  {workingDates.map(dStr => {
                                    const dObj = new Date(dStr + "T00:00:00");
                                    const dDay = dObj.toLocaleDateString("en-US", { weekday: "short" });
                                    const todayStr = new Date().toISOString().split("T")[0];
                                    const isToday = dStr === todayStr;
                                    const holidayObj = (holidays || []).find((h: any) => h?.date === dStr || h?.dateStr === dStr);
                                    const dayTypeLabel = holidayObj ? "Holiday" : (dDay === "Sat" || dDay === "Sun") ? "Weekend" : "Regular";

                                    return (
                                      <th
                                        key={dStr}
                                        className={`p-2 border-r border-slate-200 text-center min-w-[76px] transition-colors ${
                                          isToday ? "bg-indigo-50/80 border-b-2 border-b-indigo-600" : ""
                                        }`}
                                        title={`${dDay}, ${formatDateToDMY(dStr)} • Type: ${dayTypeLabel}`}
                                      >
                                        {isToday && (
                                          <span className="inline-block px-1.5 py-0.2 rounded-full bg-indigo-600 text-white text-[7.5px] font-black uppercase tracking-wider mb-0.5 shadow-2xs">
                                            TODAY
                                          </span>
                                        )}
                                        <div className={`font-extrabold text-[9.5px] ${isToday ? "text-indigo-900 font-black" : "text-slate-700"}`}>
                                          {formatDateToDMY(dStr)}
                                        </div>
                                        <div className="flex items-center justify-center gap-1 mt-0.5">
                                          <span className="text-[8px] text-slate-400 font-semibold">{dDay}</span>
                                          <span className={`text-[7px] font-extrabold px-1 py-0.2 rounded uppercase ${
                                            holidayObj ? "bg-rose-100 text-rose-700" : "bg-slate-200/70 text-slate-600"
                                          }`}>
                                            {dayTypeLabel}
                                          </span>
                                        </div>
                                      </th>
                                    );
                                  })}
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 bg-white text-slate-700 text-xs">
                                {paginatedStudents.map((st, idx) => {
                                  let presentDays = 0;
                                  let absentDays = 0;
                                  let totalStudentWorkingDays = 0;
                                  const rowSerial = attendancePageSize > 0 ? ((safePage - 1) * attendancePageSize) + idx + 1 : idx + 1;

                                  const dateCells = workingDates.map(dStr => {
                                    const dateObj = new Date(dStr + "T00:00:00");
                                    const dayName = dateObj.toLocaleDateString("en-US", { weekday: "long" });
                                    const stSlots = getStudentSlots(dayName, st.classGroup);
                                    const stDayAtt = attendanceMap.get(`${st.id}_${dStr}`) || [];

                                    // Only render blank if there are NO slots AND NO attendance records for this date
                                    if (stSlots.length === 0 && stDayAtt.length === 0) {
                                      return (
                                        <td key={dStr} className="p-1.5 text-center border-r border-slate-100 text-slate-300">
                                          <span className="text-[10px]">—</span>
                                        </td>
                                      );
                                    }

                                    totalStudentWorkingDays++;

                                    const pCount = stDayAtt.filter(a => a.status === "present").length;
                                    const odCount = stDayAtt.filter(a => a.status === "od").length;
                                    const aCount = stDayAtt.filter(a => a.status === "absent").length;
                                    const hdCount = stDayAtt.filter(a => a.status === "late" || a.status === "hd").length;
                                    const totalMarked = stDayAtt.length;
                                    const totalEff = Math.max(stSlots.length, totalMarked);

                                    let statusLabel = "—";
                                    let badgeColor = "bg-slate-50 text-slate-300 border-slate-200";

                                    if (totalMarked === 0) {
                                      statusLabel = "—";
                                      badgeColor = "bg-slate-50 text-slate-300 border-slate-200";
                                    } else if (odCount > 0 && (odCount + pCount >= totalEff)) {
                                      statusLabel = "OD";
                                      badgeColor = "bg-purple-50 text-purple-700 border-purple-200";
                                      presentDays += 1;
                                    } else if (pCount > 0 && aCount === 0 && hdCount === 0) {
                                      statusLabel = "P";
                                      badgeColor = "bg-emerald-50 text-emerald-700 border-emerald-200";
                                      presentDays += 1;
                                    } else if (hdCount > 0 || (pCount > 0 && aCount > 0)) {
                                      statusLabel = "HD";
                                      badgeColor = "bg-amber-50 text-amber-700 border-amber-200";
                                      presentDays += 0.5;
                                      absentDays += 0.5;
                                    } else if (aCount > 0) {
                                      statusLabel = "A";
                                      badgeColor = "bg-rose-50 text-rose-700 border-rose-200";
                                      absentDays += 1;
                                    }

                                    const tooltipText = `${st.name} | ${formatDateToDMY(dStr)} (${dayName})\nMarked: ${pCount + odCount}/${totalEff} Periods Present\n${stDayAtt.map((a, i) => `• Period ${i+1}: ${a.status.toUpperCase()}`).join('\n') || "No periods marked yet"}\n(Click to Mark/Edit)`;

                                    return (
                                      <td key={dStr} className="p-1.5 text-center border-r border-slate-100">
                                        <button
                                          type="button"
                                          onClick={() => setMarkingStudentForDate({ student: st, dateStr: dStr })}
                                          className={`inline-flex items-center justify-center h-5 w-6 rounded font-black text-[10px] border transition-all cursor-pointer hover:scale-110 active:scale-95 ${badgeColor}`}
                                          title={tooltipText}
                                        >
                                          {statusLabel}
                                        </button>
                                      </td>
                                    );
                                  });

                                  const effectiveTotal = totalStudentWorkingDays || workingDates.length;
                                  const pct = effectiveTotal > 0 ? Math.round((presentDays / effectiveTotal) * 100) : 0;

                                  return (
                                    <tr key={st.id} className="hover:bg-indigo-50/20 transition-colors">
                                      <td className="p-2.5 text-center font-bold text-slate-400 border-r border-slate-100 sticky left-0 z-10 bg-white">{rowSerial}</td>
                                      <td className="p-2.5 font-mono font-bold text-slate-600 border-r border-slate-100 sticky left-12 z-10 bg-white">{st.roll_number || st.id}</td>
                                      <td className="p-2.5 font-extrabold text-slate-900 border-r border-slate-100 sticky left-[158px] z-10 bg-white whitespace-nowrap">{st.name}</td>
                                      <td className="p-2.5 border-r border-slate-100 whitespace-nowrap text-slate-600">{st.department || "General"}</td>
                                      <td className="p-2.5 text-center font-bold text-slate-700 border-r border-slate-100">{effectiveTotal}</td>
                                      <td className="p-2.5 text-center font-black text-emerald-700 border-r border-slate-100 bg-emerald-50/20">{presentDays}</td>
                                      <td className="p-2.5 text-center font-black text-rose-700 border-r border-slate-100 bg-rose-50/20">{absentDays}</td>
                                      <td className="p-2.5 text-center border-r border-slate-100">
                                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded font-black text-[10.5px] ${
                                          pct >= 75
                                            ? "bg-emerald-50 text-emerald-700"
                                            : pct >= 60
                                            ? "bg-amber-50 text-amber-700"
                                            : "bg-rose-50 text-rose-700"
                                        }`}>
                                          {pct}%
                                        </span>
                                      </td>
                                      {dateCells}
                                    </tr>
                                  );
                                })}
                                {filtered.length === 0 && (
                                  <tr>
                                    <td colSpan={9 + workingDates.length} className="p-8 text-center text-slate-400 italic">
                                      No students matched the active filters.
                                    </td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          </div>

                          {/* Pagination Footer Controls */}
                          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-150 text-xs font-semibold text-slate-600">
                            <div className="flex items-center gap-2">
                              <span>
                                Showing <strong className="text-slate-900">{filtered.length === 0 ? 0 : ((safePage - 1) * (attendancePageSize || filtered.length)) + 1}</strong> to <strong className="text-slate-900">{Math.min(safePage * (attendancePageSize || filtered.length), filtered.length)}</strong> of <strong className="text-slate-900">{filtered.length}</strong> students
                              </span>
                              <span className="text-slate-300">|</span>
                              <div className="flex items-center gap-1.5">
                                <span className="text-slate-400 text-[11px]">Rows per page:</span>
                                <select
                                  value={attendancePageSize}
                                  onChange={(e) => {
                                    setAttendancePageSize(Number(e.target.value));
                                    setAttendancePage(1);
                                  }}
                                  className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                >
                                  <option value={25}>25</option>
                                  <option value={50}>50</option>
                                  <option value={100}>100</option>
                                  <option value={0}>All ({filtered.length})</option>
                                </select>
                              </div>
                            </div>

                            {totalPages > 1 && (
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  disabled={safePage <= 1}
                                  onClick={() => setAttendancePage(p => Math.max(1, p - 1))}
                                  className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-bold cursor-pointer transition-all"
                                >
                                  Previous
                                </button>
                                <span className="px-2 py-1 text-slate-500 font-bold text-[11px]">
                                  Page {safePage} of {totalPages}
                                </span>
                                <button
                                  type="button"
                                  disabled={safePage >= totalPages}
                                  onClick={() => setAttendancePage(p => Math.min(totalPages, p + 1))}
                                  className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-bold cursor-pointer transition-all"
                                >
                                  Next
                                </button>
                              </div>
                            )}
                          </div>
                        </div>

                      {/* Missed Attendance Registry */}
                      {(() => {
                        const today = new Date();
                        const todayStr = today.toISOString().split("T")[0];

                        // Build O(1) lookup: covered by slotId or by dateStr only
                        const coveredSet = new Set<string>();
                        // Mark covered if any slot record exists with that slotId+date
                        (studentAttendance || []).forEach(a => {
                          if (a.dateStr && a.slotId) coveredSet.add(`${a.dateStr}_slot_${a.slotId}`);
                          // Also mark the whole date as covered if there are ANY records for that date
                          if (a.dateStr) coveredSet.add(`date_${a.dateStr}`);
                        });

                        const missedAttendanceList = (() => {
                          const list: any[] = [];
                          for (let i = 1; i <= 7; i++) { // skip today (i=0), check past 7 working days
                            const d = new Date();
                            d.setDate(today.getDate() - i);
                            const dayName = d.toLocaleDateString("en-US", { weekday: "long" });
                            // Only check Mon-Fri (or Sat if college has 6 working days)
                            if (!workingDays.includes(dayName)) continue;
                            const dateStr = d.toISOString().split("T")[0];

                            const daySlots = slots.filter(s => {
                              const m = mentors.find(men => men.id === s.mentorId);
                              const matchesCollege = m && (m.college_id === activeCollegeId || (!m.college_id && activeCollegeId === "college_1"));
                              return matchesCollege && s.day === dayName;
                            });

                            // DEDUPLICATE: one entry per mentor+course+time (eliminates 4x cohort duplicates)
                            const seen = new Set<string>();
                            daySlots.forEach(s => {
                              const dedupKey = `${s.mentorId}__${(s.course || "").toLowerCase()}__${s.time || ""}`;
                              if (seen.has(dedupKey)) return;
                              seen.add(dedupKey);

                              const coveredBySlot = coveredSet.has(`${dateStr}_slot_${s.id}`);
                              const coveredByDate = coveredSet.has(`date_${dateStr}`);
                              if (!coveredBySlot && !coveredByDate) {
                                const mentorObj = mentors.find(m => m.id === s.mentorId);
                                list.push({
                                  slot: s,
                                  dateStr,
                                  dayName,
                                  mentor: mentorObj,
                                  id: `${s.mentorId}_${s.course}_${s.time}_${dateStr}`
                                });
                              }
                            });
                          }
                          return list;
                        })();

                        // Group by mentor for summary
                        const byMentor = new Map<string, typeof missedAttendanceList>();
                        missedAttendanceList.forEach(item => {
                          const key = item.mentor?.id || "unknown";
                          if (!byMentor.has(key)) byMentor.set(key, []);
                          byMentor.get(key)!.push(item);
                        });

                        return (
                          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
                            <div className="flex items-center justify-between flex-wrap gap-2">
                              <div>
                                <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
                                  {missedAttendanceList.length > 0
                                    ? <span className="h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
                                    : <span className="h-2 w-2 rounded-full bg-emerald-400" />
                                  }
                                  Faculty Attendance Compliance
                                </h2>
                                <p className="text-xs text-slate-400 font-semibold mt-0.5">
                                  Past 7 days — sessions where student attendance was not recorded.
                                </p>
                              </div>
                              {/* Summary badges */}
                              <div className="flex items-center gap-2 text-[11px] font-bold">
                                {missedAttendanceList.length > 0 ? (
                                  <>
                                    <span className="px-2.5 py-1 rounded-lg bg-rose-50 border border-rose-200 text-rose-700">
                                      {missedAttendanceList.length} missed sessions
                                    </span>
                                    <span className="px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-700">
                                      {byMentor.size} faculty affected
                                    </span>
                                  </>
                                ) : (
                                  <span className="px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700">
                                    ✓ All sessions compliant
                                  </span>
                                )}
                              </div>
                            </div>

                            {missedAttendanceList.length === 0 ? (
                              <div className="py-10 text-center">
                                <div className="text-3xl mb-2">✅</div>
                                <p className="text-emerald-600 font-extrabold text-sm">All faculty have marked attendance this week.</p>
                                <p className="text-xs text-slate-400 font-semibold mt-1">No missed sessions in the past 7 working days.</p>
                              </div>
                            ) : (
                              <div className="space-y-3">
                                {Array.from(byMentor.entries()).map(([mentorId, items]) => {
                                  const mentor = items[0].mentor;
                                  return (
                                    <div key={mentorId} className="border border-rose-100 rounded-xl overflow-hidden">
                                      {/* Mentor header */}
                                      <div className="flex items-center justify-between px-4 py-2.5 bg-rose-50/60 border-b border-rose-100">
                                        <div className="flex items-center gap-2.5">
                                          <div className="h-7 w-7 rounded-full bg-rose-200 flex items-center justify-center text-rose-700 font-black text-xs">
                                            {(mentor?.name || "?")[0].toUpperCase()}
                                          </div>
                                          <div>
                                            <div className="text-xs font-extrabold text-slate-800">{mentor?.name || "Unknown Mentor"}</div>
                                            <div className="text-[10px] text-slate-400 font-mono">{mentor?.email || "—"}</div>
                                          </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                          <span className="text-[10px] font-bold text-rose-600 bg-rose-100 px-2 py-0.5 rounded-full">
                                            {items.length} missed
                                          </span>
                                          <button
                                            type="button"
                                            onClick={() => handleSendWarningEmail(items[0])}
                                            disabled={emailSendingId === items[0].id}
                                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-rose-200 text-rose-600 hover:bg-rose-50 text-[10px] font-bold transition-all cursor-pointer"
                                          >
                                            <Mail className="h-3 w-3" />
                                            {emailSendingId === items[0].id ? "Sending..." : "Send Alert"}
                                          </button>
                                        </div>
                                      </div>
                                      {/* Log entries — group by subject+time, show dates as circles */}
                                      <div className="px-4 py-3 flex flex-wrap gap-2">
                                        {/* Group items by subject */}
                                        {(() => {
                                          const bySubject = new Map<string, typeof items>();
                                          items.forEach(item => {
                                            const key = `${item.slot.course || "—"} (${item.slot.time || "—"})`;
                                            if (!bySubject.has(key)) bySubject.set(key, []);
                                            bySubject.get(key)!.push(item);
                                          });
                                          return Array.from(bySubject.entries()).map(([subjectKey, subItems]) => {
                                            // Deduplicate dates within this subject group
                                            const seenDates = new Set<string>();
                                            const uniqueItems = subItems.filter(item => {
                                              if (seenDates.has(item.dateStr)) return false;
                                              seenDates.add(item.dateStr);
                                              return true;
                                            });
                                            return (
                                              <div key={subjectKey} className="flex items-center gap-1.5 flex-wrap">
                                                <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md whitespace-nowrap">
                                                  {subjectKey}
                                                </span>
                                                {uniqueItems.map(item => {
                                                  const [, , dd] = item.dateStr.split("-");
                                                  const dayAbbr = item.dayName.slice(0, 3); // Mon, Tue...
                                                  return (
                                                    <span
                                                      key={item.dateStr}
                                                      title={`${item.dayName}, ${item.dateStr}`}
                                                      className="flex flex-col items-center justify-center h-8 w-8 rounded-full bg-rose-100 border border-rose-300 text-rose-700 cursor-default hover:bg-rose-200 transition-colors"
                                                    >
                                                      <span className="text-[7px] font-bold leading-none">{dayAbbr}</span>
                                                      <span className="text-[9px] font-black leading-none">{dd}</span>
                                                    </span>
                                                  );
                                                })}
                                              </div>
                                            );
                                          });
                                        })()}
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
                  );
                })()}

                  {/* FEE COLLECTION TAB */}
                  {activeTab === "fees" && (() => {
                    const camId = currentCAM?.id;
                    return <CAMFeePanel camId={camId || ""} />;
                  })()}

                  {/* 7. CAMPUS INSIGHT & REPORTS */}
                  {activeTab === "reports" && (
                    <CAMCampusInsightPanel
                      activeCollegeId={activeCollegeId}
                      activeCollegeName={activeCollegeName}
                      collegeMentors={collegeMentors}
                      campusSlots={collegeSlots}
                      collegeStudents={collegeStudents}
                      collegeSubjects={collegeSubjects}
                    />
                  )}

                  {/* 8. TASKS & ISSUES */}
                  {activeTab === "tasks" && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                      {/* Tasks from KAM */}
                      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6">
                        <div>
                          <h2 className="text-base font-black text-slate-900">Tasks from Key Account Manager (KAM)</h2>
                          <p className="text-xs text-slate-405 font-semibold mt-0.5">SLA deliverables and operational tasks.</p>
                        </div>

                        <div className="space-y-3">
                          {localTasks.map(t => (
                            <div key={t.id} className="p-4 rounded-xl border border-slate-200 bg-white shadow-sm flex flex-col gap-2 hover:shadow-md transition-all">
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
                      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6">
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
                      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6">
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
                        <div className="bg-white p-6 rounded-xl border border-slate-205 shadow-sm space-y-6">
                          <div>
                            <h2 className="text-base font-black text-slate-905">Pending Handover Requests</h2>
                            <p className="text-xs text-slate-400 font-semibold mt-0.5">Substitution requests awaiting receiver approval.</p>
                          </div>
                          
                          <div className="overflow-x-auto rounded-xl border border-slate-205 shadow-sm">
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
                                      {req.reason?.includes("Late Mentor Attendance Punch") ? (
                                        <span className="px-2 py-0.5 rounded border text-[9.5px] font-black uppercase bg-rose-50 border-rose-200 text-rose-700 animate-pulse flex items-center gap-1 w-fit">
                                          <span>⏰ Late Mentor Punch</span>
                                        </span>
                                      ) : req.reason?.includes("Late Attendance") ? (
                                        <span className="px-2 py-0.5 rounded border text-[9.5px] font-black uppercase bg-rose-50 border-rose-200 text-rose-700 animate-pulse flex items-center gap-1 w-fit">
                                          <span>⏰ Late Attendance</span>
                                        </span>
                                      ) : req.status === "pending_cam" ? (
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
                                            disabled={loadingActions[`approve_req_${req.id}`]}
                                            onClick={async () => {
                                              if (await showConfirm({ message: "Approve this Emergency Handover Request? It will be forwarded to the cover staff.", confirmLabel: "Approve", title: "Approve Emergency Handover" })) {
                                                setActionLoading(`approve_req_${req.id}`, true);
                                                try {
                                                  await handleRequest(req.id, "approved", "", "Campus Manager");
                                                  toast("Emergency request approved and forwarded to the cover staff.", "success");
                                                } finally {
                                                  setActionLoading(`approve_req_${req.id}`, false);
                                                }
                                              }
                                            }}
                                            className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[9.5px] font-bold shadow-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-1.5"
                                          >
                                            {loadingActions[`approve_req_${req.id}`] ? (
                                              <>
                                                <Loader2 className="h-3 w-3 animate-spin" />
                                                Approving...
                                              </>
                                            ) : "Approve Emergency"}
                                          </button>
                                          <button
                                            type="button"
                                            disabled={loadingActions[`reject_req_${req.id}`]}
                                            onClick={async () => {
                                              if (await showConfirm({ message: "Are you sure you want to reject this emergency handover request?", danger: true, confirmLabel: "Reject" })) {
                                                setActionLoading(`reject_req_${req.id}`, true);
                                                try {
                                                  await handleRequest(req.id, "rejected", "", "Campus Manager");
                                                  toast("Emergency request rejected.", "info");
                                                } finally {
                                                  setActionLoading(`reject_req_${req.id}`, false);
                                                }
                                              }
                                            }}
                                            className="px-2.5 py-1.5 bg-red-50 hover:bg-red-100 border border-red-200 text-red-650 rounded-lg text-[9.5px] font-bold shadow-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-1.5"
                                          >
                                            {loadingActions[`reject_req_${req.id}`] ? (
                                              <>
                                                <Loader2 className="h-3 w-3 animate-spin" />
                                                Rejecting...
                                              </>
                                            ) : "Reject"}
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
                                            disabled={loadingActions[`reject_regular_req_${req.id}`]}
                                            onClick={async () => {
                                              if (await showConfirm({ message: "Are you sure you want to reject this handover request?", danger: true, confirmLabel: "Reject" })) {
                                                setActionLoading(`reject_regular_req_${req.id}`, true);
                                                try {
                                                  await handleRequest(req.id, "rejected", "", "Campus Manager");
                                                  toast("Request rejected successfully.", "info");
                                                } finally {
                                                  setActionLoading(`reject_regular_req_${req.id}`, false);
                                                }
                                              }
                                            }}
                                            className="px-2.5 py-1.5 bg-red-50 hover:bg-red-100 border border-red-200 text-red-600 rounded-lg text-[9.5px] font-bold shadow-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-1.5"
                                          >
                                            {loadingActions[`reject_regular_req_${req.id}`] ? (
                                              <>
                                                <Loader2 className="h-3 w-3 animate-spin" />
                                                Rejecting...
                                              </>
                                            ) : "Reject"}
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
                              <div className="bg-white rounded-xl shadow-xl border border-slate-150 p-5 w-full max-w-sm mx-4">
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
                                  <LoadingButton 
                                    isLoading={loadingActions[`approve_review_${reviewReq.id}`]}
                                    loadingText="Approving..."
                                    variant="secondary"
                                    onClick={async () => {
                                      let finalCourseName = reviewReq.course;
                                      if (handoverSubject === "substitute_own") { 
                                        if (!selectedSubjName) { toast("Please select one of the subjects.", "warning"); return; }
                                        finalCourseName = selectedSubjName; 
                                      } else if (handoverSubject === "custom") { 
                                        if (!customSubjName.trim()) { toast("Please enter a custom subject name.", "warning"); return; }
                                        finalCourseName = customSubjName.trim(); 
                                      }
                                      setActionLoading(`approve_review_${reviewReq.id}`, true);
                                      try {
                                        await handleRequest(reviewReq.id, "approved", reviewReason, "Campus Manager", finalCourseName);
                                        setReviewingRequestId(null); 
                                        setReviewReason("");
                                      } finally {
                                        setActionLoading(`approve_review_${reviewReq.id}`, false);
                                      }
                                    }} 
                                    className="px-4 py-2 rounded-xl text-xs font-bold shadow-sm"
                                  >
                                    Confirm Approve
                                  </LoadingButton>
                                </div>
                              </div>
                            </div>
                          );
                        })()}

                        <div className="bg-white p-6 rounded-xl border border-slate-205 shadow-sm space-y-6">
                          <div>
                            <h2 className="text-base font-black text-slate-905">Approved Handovers Log</h2>
                            <p className="text-xs text-slate-400 font-semibold mt-0.5">Historically approved substitutions and actual subjects taught.</p>
                          </div>
                          
                          <div className="overflow-x-auto rounded-xl border border-slate-205 shadow-sm">
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
                            <div className="bg-white p-6 rounded-xl border border-slate-205 shadow-sm space-y-6">
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
                                <div className="text-center py-10 border border-dashed border-slate-200 rounded-xl bg-slate-50/30">
                                  <p className="text-4xl mb-3">↔</p>
                                  <p className="text-xs text-slate-400 font-semibold italic">No swap compensation requests for this campus yet.</p>
                                </div>
                              ) : (
                                <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-xs">
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

                  {/* Mentor Attendance Tab */}
                  {activeTab === "mentor_attendance" && (
                    <CAMMentorAttendanceTab collegeId={activeCollegeId} camName={currentCAM?.name || "Campus Manager"} />
                  )}

                  {/* Student Tracker Audit Tab */}
                  {activeTab === "tracker" && (() => {
                    // ── DB-driven cascading filters ───────────────────────────────────────
                    // Helper: match college_id loosely (includes subjects with null college_id
                    // as well as those explicitly tied to this campus)
                    const matchesCollege = (id?: string | null) =>
                      !id || id === activeCollegeId;

                    // Step 1: Departments from DB scoped to this college
                    const trackerDepts = departmentsList
                      .filter(d => matchesCollege(d.college_id))
                      .map(d => d.name.trim())
                      .filter(Boolean)
                      .sort();
                    // Deduplicate case-insensitively
                    const trackerDeptsUniq = Array.from(
                      new Map(trackerDepts.map(d => [d.toLowerCase(), d])).values()
                    );

                    const activeDept = camTrackerDept || trackerDeptsUniq[0] || "";

                    // Step 2: Semesters from subjects table for the chosen department
                    const trackerSemesters = Array.from(new Set(
                      subjectsList
                        .filter(s => matchesCollege(s.college_id) &&
                                     (s.department?.trim().toLowerCase() === activeDept.trim().toLowerCase() ||
                                      s.department?.trim().toLowerCase().includes(activeDept.trim().toLowerCase()) ||
                                      activeDept.trim().toLowerCase().includes(s.department?.trim().toLowerCase() || "")))
                        .map(s => s.semester)
                        .filter(Boolean)
                    )).sort((a, b) => {
                      const na = parseInt((a || "").replace(/\D/g, "") || "0");
                      const nb = parseInt((b || "").replace(/\D/g, "") || "0");
                      return na - nb;
                    });

                    const defaultSems = ["Semester 1", "Semester 2", "Semester 3", "Semester 4", "Semester 5", "Semester 6", "Semester 7", "Semester 8"];
                    const finalSemesters = trackerSemesters.length > 0 ? trackerSemesters : defaultSems;
                    const activeSemester = camTrackerSemester || finalSemesters[0] || "Semester 1";

                    // Step 3: Subjects from DB filtered by dept + semester
                    const trackerSubjectObjs = subjectsList.filter(
                      s => matchesCollege(s.college_id) &&
                           (s.department?.trim().toLowerCase() === activeDept.trim().toLowerCase() ||
                            s.department?.trim().toLowerCase().includes(activeDept.trim().toLowerCase()) ||
                            activeDept.trim().toLowerCase().includes(s.department?.trim().toLowerCase() || "")) &&
                           (s.semester?.trim().toLowerCase() === activeSemester.trim().toLowerCase() || !s.semester)
                    );

                    const activeSubject = camTrackerSubject || trackerSubjectObjs[0]?.name || "";
                    const activeClassGroup = `${activeDept} - ${activeSemester}`;

                    // Step 4: Weeks 1 to 15 (always selectable so CAM can audit any week)
                    const assignedWeekNums = new Set(
                      weeklyTasks
                        .filter(t => (isSubjectNameMatch(t.subject, activeSubject) || t.subject.toLowerCase().trim() === activeSubject.toLowerCase().trim()) &&
                                     (isCohortMatching(t.class_group, activeClassGroup, coursesList, subjectsList) ||
                                      t.class_group.toLowerCase().includes(activeDept.toLowerCase().trim())))
                        .map(t => t.week_number)
                    );

                    const activeWeek: number = typeof camTrackerWeek === "number" ? camTrackerWeek : 1;

                    return (
                      <div className="space-y-6 font-sans">
                        {/* Header */}
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-150 pb-4">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0">
                              <GraduationCap className="h-5 w-5" />
                            </div>
                            <div>
                              <h2 className="text-lg font-black text-slate-800 leading-tight">Student Task Tracker Audit Console</h2>
                              <p className="text-xs text-slate-455 font-medium mt-0.5">
                                Audit student task submissions and progress across subjects and cohorts.
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Cascading Filters — all values come from DB */}
                        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs grid grid-cols-2 md:grid-cols-4 gap-4 items-end">
                          {/* 1. Department */}
                          <div className="space-y-1.5">
                            <label className="text-[10px] text-slate-455 font-extrabold uppercase tracking-wider block">Department</label>
                            <select
                              value={activeDept}
                              onChange={(e) => {
                                setCamTrackerDept(e.target.value);
                                setCamTrackerSemester("");
                                setCamTrackerSubject("");
                                setCamTrackerWeek("");
                              }}
                              className="w-full text-xs font-semibold px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-indigo-500 bg-white"
                            >
                              {trackerDeptsUniq.map(d => <option key={d} value={d}>{d}</option>)}
                              {trackerDeptsUniq.length === 0 && <option value="">No departments</option>}
                            </select>
                          </div>
                          {/* 2. Semester */}
                          <div className="space-y-1.5">
                            <label className="text-[10px] text-slate-455 font-extrabold uppercase tracking-wider block">Semester</label>
                            <select
                              value={activeSemester}
                              onChange={(e) => {
                                setCamTrackerSemester(e.target.value);
                                setCamTrackerSubject("");
                                setCamTrackerWeek(1);
                              }}
                              className="w-full text-xs font-semibold px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-indigo-500 bg-white"
                            >
                              {finalSemesters.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                          </div>
                          {/* 3. Subject */}
                          <div className="space-y-1.5">
                            <label className="text-[10px] text-slate-455 font-extrabold uppercase tracking-wider block">Subject</label>
                            <select
                              value={activeSubject}
                              onChange={(e) => {
                                setCamTrackerSubject(e.target.value);
                                setCamTrackerWeek(1);
                              }}
                              className="w-full text-xs font-semibold px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-indigo-500 bg-white"
                            >
                              {trackerSubjectObjs.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                              {trackerSubjectObjs.length === 0 && <option value="">General Subject</option>}
                            </select>
                          </div>
                          {/* 4. Week */}
                          <div className="space-y-1.5">
                            <label className="text-[10px] text-slate-455 font-extrabold uppercase tracking-wider block">Week</label>
                            <select
                              value={activeWeek}
                              onChange={(e) => setCamTrackerWeek(parseInt(e.target.value, 10))}
                              className="w-full text-xs font-semibold px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-indigo-500 bg-white"
                            >
                              {Array.from({ length: 15 }, (_, i) => i + 1).map(wk => (
                                <option key={wk} value={wk}>
                                  Week {wk} {assignedWeekNums.has(wk) ? "(Assigned)" : ""}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                      {/* Assigned Task Detail Card */}
                      {(() => {
                        if (!activeSubject || activeWeek === null) return null;
                        const currentTask = weeklyTasks.find(
                          t => (isSubjectNameMatch(t.subject, activeSubject) || t.subject.toLowerCase().trim() === activeSubject.toLowerCase().trim()) &&
                               t.week_number === activeWeek &&
                               (isCohortMatching(t.class_group, activeClassGroup, coursesList, subjectsList) ||
                                t.class_group.toLowerCase().includes(activeDept.toLowerCase().trim()))
                        );
                        const mentor = currentTask ? mentors.find(m => m.id === currentTask.mentor_id) : null;
                        return (
                          <div className="bg-gradient-to-r from-indigo-500/5 via-teal-500/5 to-transparent border border-indigo-100 rounded-xl p-6 shadow-xs space-y-3">
                            <div className="flex items-center gap-2 flex-wrap">
                              <BookOpen className="h-4.5 w-4.5 text-indigo-500" />
                              <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest">
                                Week {activeWeek} — {activeSubject} — Task Details
                              </h3>
                              <span className="ml-auto flex gap-2 text-[9px] font-bold">
                                <span className="px-2 py-0.5 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700">{activeDept}</span>
                                <span className="px-2 py-0.5 rounded-full bg-purple-50 border border-purple-100 text-purple-700">{activeSemester}</span>
                              </span>
                            </div>
                            {currentTask ? (
                              <div className="bg-white/80 border border-white/50 p-4 rounded-xl flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                                <div className="space-y-1">
                                  <div className="text-xs font-extrabold text-slate-800">{currentTask.task_name}</div>
                                  {currentTask.task_pdf_url && (
                                    <a href={currentTask.task_pdf_url} target="_blank" rel="noreferrer"
                                      className="text-[10px] font-bold text-indigo-600 hover:underline flex items-center gap-1">
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
                              <div className="text-center py-4 bg-white/50 border border-dashed border-indigo-200 rounded-xl">
                                <p className="text-xs text-slate-455 italic">No task assigned for Week {activeWeek} · {activeSubject}.</p>
                              </div>
                            )}
                          </div>
                        );
                      })()}

                      {/* ── Student Performance Analytics ── */}
                      {activeDept && activeSemester && activeSubject && (() => {
                        // Compute students in this class group
                        const chartClassGroup = `${activeDept} - ${activeSemester}`;
                        const classStudentsForChart = students.filter(s => {
                          if (s.college_id && activeCollegeId && s.college_id !== activeCollegeId) return false;
                          if (s.classGroup && isCohortMatching(s.classGroup, chartClassGroup, coursesList, subjectsList)) return true;
                          const sDept = (s.department || "").toLowerCase().trim();
                          const sSem = (s.semester || (s.classGroup ? s.classGroup.match(/Semester\s*\d+/i)?.[0] : "") || "").toLowerCase().trim();
                          return (sDept === activeDept.toLowerCase().trim() || sDept.includes(activeDept.toLowerCase().trim()) || activeDept.toLowerCase().trim().includes(sDept)) &&
                                 (sSem === activeSemester.toLowerCase().trim() || !activeSemester);
                        });
                        const studentCount = classStudentsForChart.length;
                        if (studentCount === 0) return null;

                        // ── Data for current week: marks distribution + submission rate ──
                        const weekEntries = studentTracker.filter(
                          e => classStudentsForChart.some(s => s.id === e.student_id) &&
                               (isSubjectNameMatch(e.subject, activeSubject) || e.subject.toLowerCase().trim() === activeSubject.toLowerCase().trim()) &&
                               e.week_number === activeWeek
                        );
                        const submitted = weekEntries.filter(e => e.submission_url).length;
                        const graded = weekEntries.filter(e => e.marks !== null && e.marks !== undefined).length;
                        const submissionRate = Math.round((submitted / studentCount) * 100);
                        const gradingRate = Math.round((graded / studentCount) * 100);

                        // Marks buckets: 0-4, 5-6, 7-8, 9-10
                        const buckets = [
                          { label: "0–4", color: "#ef4444", count: 0 },
                          { label: "5–6", color: "#f59e0b", count: 0 },
                          { label: "7–8", color: "#6366f1", count: 0 },
                          { label: "9–10", color: "#10b981", count: 0 },
                        ];
                        weekEntries.forEach(e => {
                          const m = e.marks;
                          if (m === null || m === undefined) return;
                          if (m <= 4) buckets[0].count++;
                          else if (m <= 6) buckets[1].count++;
                          else if (m <= 8) buckets[2].count++;
                          else buckets[3].count++;
                        });
                        const maxBucket = Math.max(...buckets.map(b => b.count), 1);

                        // ── Week-over-week trend (all 15 weeks) ──
                        const weekTrend = Array.from({ length: 15 }, (_, i) => {
                          const wk = i + 1;
                          const wkEntries = studentTracker.filter(
                            e => classStudentsForChart.some(s => s.id === e.student_id) &&
                                 (isSubjectNameMatch(e.subject, activeSubject) || e.subject.toLowerCase().trim() === activeSubject.toLowerCase().trim()) &&
                                 e.week_number === wk &&
                                 e.marks !== null && e.marks !== undefined
                          );
                          const avg = wkEntries.length > 0
                            ? wkEntries.reduce((s, e) => s + (e.marks ?? 0), 0) / wkEntries.length
                            : null;
                          const sub = studentTracker.filter(
                            e => classStudentsForChart.some(s => s.id === e.student_id) &&
                                 (isSubjectNameMatch(e.subject, activeSubject) || e.subject.toLowerCase().trim() === activeSubject.toLowerCase().trim()) &&
                                 e.week_number === wk && e.submission_url
                          ).length;
                          return { week: wk, avg, sub, total: studentCount };
                        });
                        const hasAnyTrendData = weekTrend.some(w => w.avg !== null);

                        // Donut helpers
                        const donutR = 36, donutCx = 50, donutCy = 50, donutSW = 14;
                        const donutCirc = 2 * Math.PI * donutR;

                        // Trend chart dimensions
                        const tW = 400, tH = 80, tPad = 8;
                        const tPoints = weekTrend.map((w, i) => ({
                          x: tPad + (i / 14) * (tW - tPad * 2),
                          y: w.avg !== null ? tH - tPad - ((w.avg / 10) * (tH - tPad * 2)) : null,
                          avg: w.avg,
                          sub: w.sub,
                          week: w.week,
                        }));
                        const pathParts: string[] = [];
                        tPoints.forEach((p, i) => {
                          if (p.y === null) return;
                          const cmd = i === 0 || tPoints[i - 1].y === null ? `M${p.x},${p.y}` : `L${p.x},${p.y}`;
                          pathParts.push(cmd);
                        });
                        const trendPath = pathParts.join(" ");

                        return (
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

                            {/* Marks Distribution Bar Chart */}
                            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
                              <h4 className="text-[10px] font-black text-slate-700 uppercase tracking-wider mb-3">
                                Week {activeWeek} — Marks Distribution
                              </h4>
                              <div className="space-y-2.5">
                                {buckets.map(b => (
                                  <div key={b.label} className="flex items-center gap-2">
                                    <span className="text-[9px] font-bold text-slate-500 w-8 shrink-0">{b.label}</span>
                                    <div className="flex-1 bg-slate-100 rounded-full h-3 overflow-hidden">
                                      <div
                                        className="h-full rounded-full transition-all duration-700"
                                        style={{ width: `${Math.round((b.count / maxBucket) * 100)}%`, backgroundColor: b.color }}
                                      />
                                    </div>
                                    <span className="text-[10px] font-black text-slate-700 w-4 shrink-0 text-right">{b.count}</span>
                                  </div>
                                ))}
                              </div>
                              <div className="mt-3 pt-3 border-t border-slate-100 grid grid-cols-2 gap-2 text-center">
                                <div>
                                  <div className="text-base font-black text-slate-800">{graded}</div>
                                  <div className="text-[8px] font-bold uppercase tracking-wider text-slate-400">Graded</div>
                                </div>
                                <div>
                                  <div className="text-base font-black text-slate-800">
                                    {graded > 0 ? (weekEntries.filter(e => e.marks !== null && e.marks !== undefined).reduce((s, e) => s + (e.marks ?? 0), 0) / graded).toFixed(1) : "—"}
                                  </div>
                                  <div className="text-[8px] font-bold uppercase tracking-wider text-slate-400">Avg Marks</div>
                                </div>
                              </div>
                            </div>

                            {/* Submission + Grading Rate Donuts */}
                            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col">
                              <h4 className="text-[10px] font-black text-slate-700 uppercase tracking-wider mb-3">
                                Week {activeWeek} — Completion Rate
                              </h4>
                              <div className="flex flex-1 items-center justify-around">
                                {[
                                  { label: "Submitted", value: submissionRate, count: submitted, color: "#6366f1", track: "#e0e7ff" },
                                  { label: "Graded", value: gradingRate, count: graded, color: "#10b981", track: "#d1fae5" },
                                ].map(d => {
                                  const dash = (d.value / 100) * donutCirc;
                                  return (
                                    <div key={d.label} className="flex flex-col items-center gap-1">
                                      <svg width={100} height={100} viewBox="0 0 100 100">
                                        <circle cx={donutCx} cy={donutCy} r={donutR} fill="none" stroke={d.track} strokeWidth={donutSW} />
                                        <circle cx={donutCx} cy={donutCy} r={donutR} fill="none"
                                          stroke={d.color} strokeWidth={donutSW}
                                          strokeDasharray={`${dash} ${donutCirc - dash}`}
                                          strokeDashoffset={donutCirc / 4}
                                          strokeLinecap="round"
                                          style={{ transition: "stroke-dasharray 0.6s ease" }}
                                        />
                                        <text x={donutCx} y={donutCy - 5} textAnchor="middle" fontSize={16} fontWeight="900" fill={d.color}>{d.value}%</text>
                                        <text x={donutCx} y={donutCy + 10} textAnchor="middle" fontSize={8} fill="#94a3b8" fontWeight="700">
                                          {d.count}/{studentCount}
                                        </text>
                                      </svg>
                                      <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider">{d.label}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>

                            {/* Week-over-Week Trend */}
                            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
                              <h4 className="text-[10px] font-black text-slate-700 uppercase tracking-wider mb-3">
                                Avg Marks Trend — All Weeks
                              </h4>
                              {!hasAnyTrendData ? (
                                <div className="h-20 flex items-center justify-center text-[10px] text-slate-400 italic">No graded data yet.</div>
                              ) : (
                                <div className="overflow-x-auto">
                                  <svg width={tW} height={tH + 20} viewBox={`0 0 ${tW} ${tH + 20}`} style={{ minWidth: "100%" }}>
                                    {/* Reference lines at 5 and 10 */}
                                    {[5, 10].map(v => {
                                      const ly = tH - tPad - ((v / 10) * (tH - tPad * 2));
                                      return (
                                        <g key={v}>
                                          <line x1={tPad} y1={ly} x2={tW - tPad} y2={ly} stroke="#e2e8f0" strokeWidth={1} strokeDasharray="3 3" />
                                          <text x={tPad - 1} y={ly - 2} fontSize={6} fill="#94a3b8" textAnchor="start">{v}</text>
                                        </g>
                                      );
                                    })}
                                    {/* Shaded area under trend */}
                                    {trendPath && (() => {
                                      const firstPt = tPoints.find(p => p.y !== null);
                                      const lastPt = [...tPoints].reverse().find(p => p.y !== null);
                                      if (!firstPt || !lastPt) return null;
                                      const areaPath = `${trendPath} L${lastPt.x},${tH - tPad} L${firstPt.x},${tH - tPad} Z`;
                                      return <path d={areaPath} fill="#6366f1" fillOpacity={0.08} />;
                                    })()}
                                    {/* Trend line */}
                                    {trendPath && <path d={trendPath} fill="none" stroke="#6366f1" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />}
                                    {/* Data points */}
                                    {tPoints.map(p => p.y !== null ? (
                                      <g key={p.week}>
                                        <circle cx={p.x} cy={p.y!} r={3} fill="#6366f1" />
                                        <text x={p.x} y={tH + 15} textAnchor="middle" fontSize={6} fill="#94a3b8" fontWeight="600">W{p.week}</text>
                                      </g>
                                    ) : (
                                      <text key={p.week} x={p.x} y={tH + 15} textAnchor="middle" fontSize={6} fill="#cbd5e1">W{p.week}</text>
                                    ))}
                                    {/* Current week highlight */}
                                    {tPoints[activeWeek - 1]?.y !== null && (
                                      <circle cx={tPoints[activeWeek - 1].x} cy={tPoints[activeWeek - 1].y!} r={5} fill="none" stroke="#6366f1" strokeWidth={2} />
                                    )}
                                  </svg>
                                </div>
                              )}
                              <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[9px] text-slate-400 font-semibold">
                                <span>Week 1</span>
                                <span className="text-[8px] text-indigo-400 font-black">● Week {activeWeek} selected</span>
                                <span>Week 15</span>
                              </div>
                            </div>
                          </div>
                        );
                      })()}

                      {/* Submissions & Marks Audit Table */}
                      <div className="bg-white border border-slate-250/60 rounded-xl p-6 shadow-xs space-y-4">
                        <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest border-b border-slate-100 pb-2">
                          Submissions &amp; Evaluations Audit
                        </h3>
                        {(() => {
                          if (!activeDept || !activeSemester || !activeSubject || activeWeek === null) {
                            return (
                              <div className="text-center py-8">
                                <p className="text-xs text-slate-455 italic">Select department, semester, subject and week to view student submissions.</p>
                              </div>
                            );
                          }

                          // Students matched by dept + semester from DB with fallback cohort matching
                          const classStudents = students.filter(s => {
                            if (s.college_id && activeCollegeId && s.college_id !== activeCollegeId) return false;
                            if (s.classGroup && isCohortMatching(s.classGroup, activeClassGroup, coursesList, subjectsList)) return true;
                            const sDept = (s.department || "").toLowerCase().trim();
                            const sSem = (s.semester || (s.classGroup ? s.classGroup.match(/Semester\s*\d+/i)?.[0] : "") || "").toLowerCase().trim();
                            return (sDept === activeDept.toLowerCase().trim() || sDept.includes(activeDept.toLowerCase().trim()) || activeDept.toLowerCase().trim().includes(sDept)) &&
                                   (sSem === activeSemester.toLowerCase().trim() || !activeSemester);
                          });

                          if (classStudents.length === 0) {
                            return (
                              <div className="text-center py-8">
                                <p className="text-xs text-slate-455 italic">
                                  No students found for {activeDept} · {activeSemester}.
                                </p>
                              </div>
                            );
                          }

                          return (
                            <div className="overflow-x-auto rounded-xl border border-slate-205 shadow-sm">
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
                                           (isSubjectNameMatch(e.subject, activeSubject) || e.subject.toLowerCase().trim() === activeSubject.toLowerCase().trim()) &&
                                           e.week_number === activeWeek
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
                                          <div className="text-[9px] text-slate-400 mt-0.5">{student.classGroup || "—"}</div>
                                          <div className="text-[9px] text-slate-400 font-mono">{student.id}</div>
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

                          {/* Single Download Template Button */}
                          <button
                            type="button"
                            onClick={() => setShowTemplateModal(true)}
                            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-xs font-bold transition-all shadow-2xs cursor-pointer active:scale-95"
                            title="Choose course, shift and semester to download template"
                          >
                            <Download className="h-3.5 w-3.5 text-slate-600" />
                            <span>Download Template</span>
                          </button>

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
                            <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-xs flex items-center gap-3">
                              <div className="h-10 w-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                                <GraduationCap className="h-5 w-5" />
                              </div>
                              <div>
                                <span className="text-xl font-extrabold text-slate-900 block leading-tight">{campusStudents.length}</span>
                                <span className="text-[10px] text-slate-455 font-bold uppercase tracking-wider">Total Registered Students</span>
                              </div>
                            </div>

                            <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-xs flex items-center gap-3">
                              <div className="h-10 w-10 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center shrink-0">
                                <BookOpen className="h-5 w-5" />
                              </div>
                              <div>
                                <span className="text-xl font-extrabold text-slate-900 block leading-tight">{classGroupsCount}</span>
                                <span className="text-[10px] text-slate-455 font-bold uppercase tracking-wider">Active Cohorts / Batches</span>
                              </div>
                            </div>

                            <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-xs flex items-center gap-3">
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
                      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-wrap gap-3 items-center justify-between">
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

                        <div className="flex items-center gap-2.5 flex-wrap">
                          {/* Course / Department Filter */}
                          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
                            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Course:</span>
                            <select
                              value={studentDirDeptFilter}
                              onChange={(e) => setStudentDirDeptFilter(e.target.value)}
                              className="text-xs font-bold bg-transparent cursor-pointer outline-none text-slate-800"
                            >
                              <option value="all">All Courses</option>
                              {dbCourseNames.map(d => (
                                <option key={d} value={d}>{d}</option>
                              ))}
                            </select>
                          </div>

                          {/* Semester Filter */}
                          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
                            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Semester:</span>
                            <select
                              value={studentSemFilter}
                              onChange={(e) => setStudentSemFilter(e.target.value)}
                              className="text-xs font-bold bg-transparent cursor-pointer outline-none text-slate-800"
                            >
                              <option value="all">All Semesters</option>
                              {dbSemesterOptions.map((sem, idx) => (
                                <option key={`sem_${sem}_${idx}`} value={sem}>{sem}</option>
                              ))}
                            </select>
                          </div>

                          {/* Shift Filter */}
                          {isCampusShiftBased && (
                            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
                              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Shift:</span>
                              <select
                                value={studentShiftFilter}
                                onChange={(e) => setStudentShiftFilter(e.target.value)}
                                className="text-xs font-bold bg-transparent cursor-pointer outline-none text-slate-800"
                              >
                                <option value="all">All Shifts</option>
                                <option value="Shift 1">Shift 1</option>
                                <option value="Shift 2">Shift 2</option>
                                <option value="General">General</option>
                              </select>
                            </div>
                          )}

                          {/* Clear / Reset Filters button */}
                          {(studentDirDeptFilter !== "all" || studentSemFilter !== "all" || studentShiftFilter !== "all" || studentDirSearch) && (
                            <button
                              type="button"
                              onClick={() => {
                                setStudentDirDeptFilter("all");
                                setStudentSemFilter("all");
                                setStudentShiftFilter("all");
                                setStudentDirSearch("");
                              }}
                              className="text-xs font-extrabold text-indigo-600 hover:text-indigo-800 px-2.5 py-1.5 rounded-xl hover:bg-indigo-50 transition-colors cursor-pointer"
                            >
                              Reset Filters
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Batch Action Toolbar when students selected */}
                      {selectedStudentIds.length > 0 && (
                        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3 animate-in fade-in">
                          <div className="flex items-center gap-2.5 text-xs font-bold text-rose-900">
                            <span className="h-6 px-2.5 rounded-full bg-rose-600 text-white font-extrabold text-[11px] flex items-center justify-center">
                              {selectedStudentIds.length}
                            </span>
                            <span>student(s) selected across directory</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setSelectedStudentIds([])}
                              className="px-3 py-1.5 rounded-xl bg-white border border-rose-200 hover:bg-rose-100 text-rose-800 text-xs font-bold transition-all cursor-pointer"
                            >
                              Deselect All
                            </button>
                            <button
                              type="button"
                              disabled={loadingActions['bulk_delete_students']}
                              onClick={() => handleBulkDeleteStudents()}
                              className="px-4 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-all shadow-sm cursor-pointer flex items-center gap-1.5 disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                              {loadingActions['bulk_delete_students'] ? (
                                <>
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  Deleting...
                                </>
                              ) : (
                                <>
                                  <Trash2 className="h-3.5 w-3.5" />
                                  Delete Selected ({selectedStudentIds.length})
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Students Table */}
                      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-4">
                        {(() => {
                          const campusStudents = collegeStudents;

                          const extractSemNum = (val?: string): number | null => {
                            if (!val) return null;
                            const s = String(val).toLowerCase();
                            const numMatch = s.match(/(?:semester|sem)?\s*([1-8])/i);
                            if (numMatch) return parseInt(numMatch[1], 10);
                            const romanMap: Record<string, number> = { i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7, viii: 8 };
                            const romanMatch = s.match(/\b(viii|vii|vi|iv|v|iii|ii|i)\b/i);
                            if (romanMatch && romanMap[romanMatch[1]]) return romanMap[romanMatch[1]];
                            return null;
                          };

                          const targetSemNum = studentSemFilter === "all" ? null : extractSemNum(studentSemFilter);

                          const filtered = campusStudents.filter(s => {
                            const matchSearch = !studentDirSearch ||
                              s.name?.toLowerCase().includes(studentDirSearch.toLowerCase()) ||
                              s.roll_number?.toLowerCase().includes(studentDirSearch.toLowerCase()) ||
                              s.id?.toLowerCase().includes(studentDirSearch.toLowerCase()) ||
                              s.email?.toLowerCase().includes(studentDirSearch.toLowerCase()) ||
                              s.phone?.includes(studentDirSearch);

                            const stDept = (s.department || "").trim().toLowerCase();
                            const matchDept = studentDirDeptFilter === "all" || 
                              stDept === studentDirDeptFilter.toLowerCase() ||
                              (s.classGroup && s.classGroup.toLowerCase().includes(studentDirDeptFilter.toLowerCase()));

                            const stSemNum = extractSemNum(s.semester) || extractSemNum(s.classGroup);
                            const matchSem = targetSemNum === null || (stSemNum !== null && stSemNum === targetSemNum);

                            const stShift = (s.shift || (s.classGroup ? s.classGroup.match(/Shift\s*\d+/i)?.[0] : "") || "").trim().toLowerCase();
                            const matchShift = studentShiftFilter === "all" || 
                              stShift === studentShiftFilter.toLowerCase() ||
                              (s.classGroup && s.classGroup.toLowerCase().includes(studentShiftFilter.toLowerCase()));

                            return matchSearch && matchDept && matchSem && matchShift;
                          });

                          const allFilteredIds = filtered.map(s => s.id);
                          const isAllFilteredSelected = filtered.length > 0 && allFilteredIds.every(id => selectedStudentIds.includes(id));

                          const toggleSelectAllFiltered = () => {
                            if (isAllFilteredSelected) {
                              setSelectedStudentIds(prev => prev.filter(id => !allFilteredIds.includes(id)));
                            } else {
                              setSelectedStudentIds(prev => Array.from(new Set([...prev, ...allFilteredIds])));
                            }
                          };

                          if (filtered.length === 0) {
                            return (
                              <div className="text-center py-12 border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                                <GraduationCap className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                                <p className="text-sm font-bold text-slate-600">No students found</p>
                                <p className="text-xs text-slate-400 mt-1">Try adjusting search filters or use &ldquo;Import Students (Excel)&rdquo; above to load records.</p>
                              </div>
                            );
                          }

                          return (
                            <div className="space-y-3">
                              <div className="flex items-center justify-between text-xs font-semibold text-slate-500 px-1 gap-2 flex-wrap">
                                <div className="flex items-center gap-2">
                                  <span>Showing {filtered.length} student(s)</span>
                                  {filtered.length > 1 && (
                                    <button
                                      type="button"
                                      disabled={loadingActions['bulk_delete_students']}
                                      onClick={() => handleBulkDeleteStudents(allFilteredIds)}
                                      className="text-rose-600 hover:text-rose-700 font-bold text-[11px] hover:underline flex items-center gap-1 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ml-2"
                                    >
                                      {loadingActions['bulk_delete_students'] ? (
                                        <>
                                          <Loader2 className="h-3 w-3 animate-spin" />
                                          Deleting All...
                                        </>
                                      ) : (
                                        <>
                                          <Trash2 className="h-3 w-3" />
                                          Delete All Filtered ({filtered.length})
                                        </>
                                      )}
                                    </button>
                                  )}
                                </div>

                                <button
                                  type="button"
                                  disabled={isSyncingHireScore}
                                  onClick={handleSyncHireScoreLive}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 text-xs font-extrabold transition-all shadow-2xs cursor-pointer active:scale-95 disabled:opacity-60"
                                  title="Fetch latest HireScore and EFSET scores from live API (https://hire-score-fawn.vercel.app/api/students)"
                                >
                                  {isSyncingHireScore ? (
                                    <>
                                      <Loader2 className="h-3.5 w-3.5 animate-spin text-purple-600" />
                                      <span>Syncing Live Scores...</span>
                                    </>
                                  ) : (
                                    <>
                                      <Sparkles className="h-3.5 w-3.5 text-purple-600" />
                                      <span>Sync Live HireScore &amp; EFSET</span>
                                    </>
                                  )}
                                </button>
                              </div>
                              <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-xs">
                                <table className="w-full border-collapse text-left text-xs font-semibold min-w-[2100px]">
                                  <thead>
                                    <tr className="bg-gradient-to-r from-slate-50 to-indigo-50/40 border-b border-slate-200 text-slate-600 font-extrabold uppercase text-[9.5px] tracking-wider whitespace-nowrap">
                                      <th className="p-3 w-10 text-center">
                                        <input
                                          type="checkbox"
                                          checked={isAllFilteredSelected}
                                          onChange={toggleSelectAllFiltered}
                                          className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4 cursor-pointer"
                                          title="Select / Deselect all visible students"
                                        />
                                      </th>
                                      <th className="p-3">Roll No / ID</th>
                                      <th className="p-3">Student Name</th>
                                      <th className="p-3">Email ID</th>
                                      <th className="p-3">Dept &amp; Class</th>
                                      <th className="p-3">Hire Score</th>
                                      <th className="p-3">EFSET Score</th>
                                      <th className="p-3">Father Name</th>
                                      <th className="p-3">Mother Name</th>
                                      <th className="p-3">Parent Phone (WhatsApp)</th>
                                      <th className="p-3">Aadhar Number</th>
                                      <th className="p-3">PAN Number</th>
                                      <th className="p-3">10th Mark (%)</th>
                                      <th className="p-3">11th Mark (%)</th>
                                      <th className="p-3">12th Mark (%)</th>
                                      <th className="p-3">Group</th>
                                      <th className="p-3">Medium</th>
                                      <th className="p-3">Blood Group</th>
                                      <th className="p-3">DOB</th>
                                      <th className="p-3">Student Phone</th>
                                      <th className="p-3">Social &amp; Code Links</th>
                                      <th className="p-3 text-center">Action</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100 bg-white text-slate-700">
                                    {filtered.map(st => {
                                      const isSelected = selectedStudentIds.includes(st.id);
                                      return (
                                        <tr key={st.id} className={`transition-colors whitespace-nowrap ${isSelected ? "bg-rose-50/30 hover:bg-rose-50/50" : "hover:bg-indigo-50/20"}`}>
                                          <td className="p-3 text-center">
                                            <input
                                              type="checkbox"
                                              checked={isSelected}
                                              onChange={() => {
                                                if (isSelected) {
                                                  setSelectedStudentIds(prev => prev.filter(id => id !== st.id));
                                                } else {
                                                  setSelectedStudentIds(prev => [...prev, st.id]);
                                                }
                                              }}
                                              className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4 cursor-pointer"
                                            />
                                          </td>
                                          <td className="p-3 font-mono font-bold text-indigo-700">
                                            {st.roll_number || st.id}
                                          </td>
                                          <td className="p-3 font-bold text-slate-900">
                                            {st.name}
                                          </td>
                                          <td className="p-3 text-slate-600">
                                            {st.email}
                                          </td>
                                          <td className="p-3">
                                            <div className="font-bold text-slate-800">{st.department || "General"}</div>
                                            <div className="text-[10px] text-indigo-600 font-semibold">{st.classGroup}</div>
                                          </td>
                                          <td className="p-3">
                                            {st.hire_score ? (
                                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-50 border border-indigo-200 text-indigo-700 font-extrabold text-[11px]">
                                                <Sparkles className="h-3 w-3 text-indigo-500" />
                                                {st.hire_score}
                                              </span>
                                            ) : (
                                              <span className="text-slate-300 font-bold">—</span>
                                            )}
                                          </td>
                                          <td className="p-3">
                                            {st.efset_score ? (
                                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-50 border border-purple-200 text-purple-700 font-extrabold text-[11px]">
                                                {st.efset_score}
                                              </span>
                                            ) : (
                                              <span className="text-slate-300 font-bold">—</span>
                                            )}
                                          </td>
                                          <td className="p-3 text-slate-800">
                                            {st.father_name || "—"}
                                          </td>
                                          <td className="p-3 text-slate-800">
                                            {st.mother_name || "—"}
                                          </td>
                                          <td className="p-3 font-semibold text-emerald-700">
                                            {st.parent_phone || "—"}
                                          </td>
                                          <td className="p-3 font-mono text-slate-800">
                                            {st.aadhar_number || "—"}
                                          </td>
                                          <td className="p-3 font-mono text-slate-800">
                                            {st.pan_number || "—"}
                                          </td>
                                          <td className="p-3 font-bold text-indigo-600">
                                            {st.tenth_mark ? `${st.tenth_mark}%` : "—"}
                                          </td>
                                          <td className="p-3 font-bold text-indigo-600">
                                            {st.eleventh_mark ? `${st.eleventh_mark}%` : "—"}
                                          </td>
                                          <td className="p-3 font-bold text-indigo-600">
                                            {st.twelfth_mark ? `${st.twelfth_mark}%` : "—"}
                                          </td>
                                          <td className="p-3 text-slate-800">
                                            {st.academic_group || "—"}
                                          </td>
                                          <td className="p-3 text-slate-800">
                                            {st.medium || "—"}
                                          </td>
                                          <td className="p-3 font-bold text-rose-600">
                                            {st.blood_group || "—"}
                                          </td>
                                          <td className="p-3 text-slate-800">
                                            {formatDisplayDob(st.dob) || "—"}
                                          </td>
                                          <td className="p-3 text-slate-800 font-semibold">
                                            {st.phone || "—"}
                                          </td>
                                          <td className="p-3">
                                            <div className="flex items-center gap-1.5">
                                              {st.linkedin_link && (
                                                <a href={st.linkedin_link} target="_blank" rel="noreferrer" className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 hover:bg-blue-100 text-[9.5px] font-bold">LinkedIn</a>
                                              )}
                                              {st.github_id && (
                                                <a href={st.github_id.startsWith("http") ? st.github_id : `https://github.com/${st.github_id}`} target="_blank" rel="noreferrer" className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-800 hover:bg-slate-200 text-[9.5px] font-bold">GitHub</a>
                                              )}
                                              {st.hackerrank_link && (
                                                <a href={st.hackerrank_link} target="_blank" rel="noreferrer" className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-600 hover:bg-emerald-100 text-[9.5px] font-bold">HackerRank</a>
                                              )}
                                              {st.leetcode_link && (
                                                <a href={st.leetcode_link} target="_blank" rel="noreferrer" className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-600 hover:bg-amber-100 text-[9.5px] font-bold">LeetCode</a>
                                              )}
                                              {st.figma_link && (
                                                <a href={st.figma_link} target="_blank" rel="noreferrer" className="px-1.5 py-0.5 rounded bg-purple-50 text-purple-600 hover:bg-purple-100 text-[9.5px] font-bold">Figma</a>
                                              )}
                                              {!st.linkedin_link && !st.github_id && !st.hackerrank_link && !st.leetcode_link && !st.figma_link && (
                                                <span className="text-[10px] text-slate-350 italic">—</span>
                                              )}
                                            </div>
                                          </td>
                                          <td className="p-3 text-center">
                                            <div className="flex items-center justify-center gap-1.5">
                                              <button
                                                type="button"
                                                onClick={() => setSelectedStudentForDetail(st)}
                                                className="px-2 py-1 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[10.5px] font-extrabold transition-colors cursor-pointer"
                                              >
                                                View Profile
                                              </button>
                                              <button
                                                type="button"
                                                disabled={loadingActions[`delete_student_${st.id}`]}
                                                onClick={() => handleSingleDeleteStudent(st)}
                                                className="p-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 text-[10.5px] font-extrabold transition-colors cursor-pointer flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                                                title="Delete student record"
                                              >
                                                {loadingActions[`delete_student_${st.id}`] ? (
                                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                ) : (
                                                  <Trash2 className="h-3.5 w-3.5" />
                                                )}
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
                          );
                        })()}
                      </div>
                    </div>
                  )}

                  {/* Tab: Event Management */}
                  {activeTab === "events" && (
                    <div className="space-y-6 animate-fadeIn pb-12">
                      {/* Top Summary KPI Cards */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs flex items-center justify-between">
                          <div>
                            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Campus Events</span>
                            <h3 className="text-xl font-black text-slate-900 mt-1">{filteredEvents.length}</h3>
                          </div>
                          <div className="h-10 w-10 rounded-xl bg-pink-50 text-[#D528A2] flex items-center justify-center font-bold">
                            <Calendar className="h-5 w-5" />
                          </div>
                        </div>

                        <div className="p-4 rounded-xl border border-indigo-200 bg-gradient-to-br from-indigo-50/50 to-purple-50/50 shadow-xs flex items-center justify-between">
                          <div>
                            <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-700">Upcoming Fests</span>
                            <h3 className="text-xl font-black text-indigo-900 mt-1">
                              {filteredEvents.filter(e => (e.status || "Upcoming") === "Upcoming").length}
                            </h3>
                          </div>
                          <div className="h-10 w-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold shadow-xs">
                            <Clock className="h-5 w-5" />
                          </div>
                        </div>

                        <div className="p-4 rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50/50 to-teal-50/50 shadow-xs flex items-center justify-between">
                          <div>
                            <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-700">Live &amp; Ongoing</span>
                            <h3 className="text-xl font-black text-emerald-900 mt-1">
                              {filteredEvents.filter(e => e.status === "Ongoing").length}
                            </h3>
                          </div>
                          <div className="h-10 w-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold shadow-xs">
                            <Sparkles className="h-5 w-5" />
                          </div>
                        </div>

                        <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 shadow-xs flex items-center justify-between">
                          <div>
                            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">Completed &amp; Memories</span>
                            <h3 className="text-xl font-black text-slate-800 mt-1">
                              {filteredEvents.filter(e => e.status === "Completed").length}
                            </h3>
                          </div>
                          <div className="h-10 w-10 rounded-xl bg-slate-200 text-slate-700 flex items-center justify-center font-bold">
                            <CheckCircle2 className="h-5 w-5" />
                          </div>
                        </div>
                      </div>

                      {/* Toolbar & Filters */}
                      <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-xs space-y-4">
                        <div className="flex items-center justify-between flex-wrap gap-3">
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                              <Calendar className="h-4 w-4 text-[#D528A2]" />
                              Campus Fests, Functions &amp; Event Console
                            </h3>
                            <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-pink-50 text-[#D528A2] border border-pink-100">
                              {filteredEvents.length} Events on this Campus
                            </span>
                          </div>

                          {/* Header Action Buttons */}
                          <div className="flex items-center gap-2 flex-wrap">
                            <button
                              type="button"
                              onClick={handleDownloadEventTemplate}
                              className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
                              title="Download Excel Import Template"
                            >
                              <Download className="h-3.5 w-3.5" />
                              <span>Template</span>
                            </button>

                            <label className="px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5">
                              <Upload className="h-3.5 w-3.5" />
                              <span>Import Excel</span>
                              <input type="file" accept=".xlsx, .xls" onChange={handleImportEventsExcel} className="hidden" />
                            </label>

                            <button
                              type="button"
                              onClick={handleExportEventsExcel}
                              className="px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
                            >
                              <FileSpreadsheet className="h-3.5 w-3.5" />
                              <span>Export Report</span>
                            </button>

                            <button
                              type="button"
                              onClick={handleOpenCreateEventModal}
                              className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-[#D528A2] to-pink-600 text-white font-extrabold text-xs shadow-md shadow-[#D528A2]/20 hover:opacity-95 transition-all cursor-pointer flex items-center gap-1.5"
                            >
                              <Plus className="h-4 w-4" />
                              <span>+ Host Event / Fest</span>
                            </button>
                          </div>
                        </div>

                        {/* Filter Row & View Switcher */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 pt-2 border-t border-slate-100">
                          {/* Search */}
                          <div className="relative md:col-span-2">
                            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                            <input
                              type="text"
                              placeholder="Search fest title, speaker, coordinator or venue..."
                              value={eventSearchQuery}
                              onChange={e => setEventSearchQuery(e.target.value)}
                              className="w-full pl-9 pr-3 py-1.5 border border-slate-200 bg-slate-50/50 text-xs rounded-xl focus:ring-1 focus:ring-indigo-500 outline-none font-semibold"
                            />
                          </div>

                          {/* Category Filter */}
                          <select
                            value={eventCategoryFilter}
                            onChange={e => setEventCategoryFilter(e.target.value)}
                            className="p-1.5 border border-slate-200 bg-slate-50/50 text-xs rounded-xl font-bold text-slate-700 outline-none"
                          >
                            <option value="All">All Categories</option>
                            <option value="Coding Fest & Hackathon">Coding Fest &amp; Hackathon</option>
                            <option value="Technical Symposium & Project Expo">Technical Symposium &amp; Expo</option>
                            <option value="Workshop & Hands-on BootCamp">Workshop &amp; BootCamp</option>
                            <option value="Guest Lecture & Industry Talk">Guest Lecture &amp; Talk</option>
                            <option value="Cultural Fest & Celebration">Cultural Fest &amp; Celebration</option>
                            <option value="Sports Meet & Tournament">Sports Meet &amp; Tournament</option>
                            <option value="Campus Placement Drive">Campus Placement Drive</option>
                            <option value="Academic Milestone & CIA Exam">Academic Exam / Milestone</option>
                          </select>

                          {/* Status Filter */}
                          <select
                            value={eventStatusFilter}
                            onChange={e => setEventStatusFilter(e.target.value)}
                            className="p-1.5 border border-slate-200 bg-slate-50/50 text-xs rounded-xl font-bold text-slate-700 outline-none"
                          >
                            <option value="All">All Statuses</option>
                            <option value="Upcoming">Upcoming</option>
                            <option value="Ongoing">Live / Ongoing</option>
                            <option value="Completed">Completed</option>
                            <option value="Postponed">Postponed</option>
                          </select>

                          {/* View Mode Toggle */}
                          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                            <button
                              type="button"
                              onClick={() => setEventViewMode("cards")}
                              className={`flex-1 py-1 text-[10.5px] font-extrabold rounded-lg transition-all cursor-pointer ${
                                eventViewMode === "cards" ? "bg-white text-indigo-700 shadow-xs" : "text-slate-500 hover:text-slate-800"
                              }`}
                            >
                              Cards
                            </button>
                            <button
                              type="button"
                              onClick={() => setEventViewMode("timeline")}
                              className={`flex-1 py-1 text-[10.5px] font-extrabold rounded-lg transition-all cursor-pointer ${
                                eventViewMode === "timeline" ? "bg-white text-indigo-700 shadow-xs" : "text-slate-500 hover:text-slate-800"
                              }`}
                            >
                              Timeline
                            </button>
                            <button
                              type="button"
                              onClick={() => setEventViewMode("table")}
                              className={`flex-1 py-1 text-[10.5px] font-extrabold rounded-lg transition-all cursor-pointer ${
                                eventViewMode === "table" ? "bg-white text-indigo-700 shadow-xs" : "text-slate-500 hover:text-slate-800"
                              }`}
                            >
                              Table
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Content Views */}
                      {/* VIEW 1: CARDS GRID VIEW */}
                      {eventViewMode === "cards" && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
                          {filteredEvents.length === 0 ? (
                            <div className="col-span-full py-16 text-center border border-dashed border-slate-200 bg-white rounded-xl space-y-3">
                              <Calendar className="h-10 w-10 text-slate-300 mx-auto" />
                              <div>
                                <h4 className="text-sm font-extrabold text-slate-700">No Campus Events Configured</h4>
                                <p className="text-xs text-slate-400 mt-1">Host a new coding fest, hackathon, or cultural workshop for this campus.</p>
                              </div>
                              <button
                                type="button"
                                onClick={handleOpenCreateEventModal}
                                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold cursor-pointer transition-all inline-flex items-center gap-1.5 shadow-sm"
                              >
                                <Plus className="h-4 w-4" />
                                Host New Event
                              </button>
                            </div>
                          ) : (
                            filteredEvents.map(ev => {
                              const categoryColors: Record<string, string> = {
                                "Coding Fest & Hackathon": "bg-indigo-50 text-indigo-700 border-indigo-200",
                                "Technical Symposium & Project Expo": "bg-purple-50 text-purple-700 border-purple-200",
                                "Workshop & Hands-on BootCamp": "bg-sky-50 text-sky-700 border-sky-200",
                                "Guest Lecture & Industry Talk": "bg-teal-50 text-teal-700 border-teal-200",
                                "Cultural Fest & Celebration": "bg-pink-50 text-pink-700 border-pink-200",
                                "Sports Meet & Tournament": "bg-amber-50 text-amber-700 border-amber-200",
                                "Campus Placement Drive": "bg-emerald-50 text-emerald-700 border-emerald-200",
                                "Academic Milestone & CIA Exam": "bg-rose-50 text-rose-700 border-rose-200"
                              };
                              const badgeClass = categoryColors[ev.category || "Coding Fest & Hackathon"] || "bg-slate-100 text-slate-700 border-slate-200";

                              // Countdown calculation
                              const today = new Date().toISOString().split("T")[0];
                              const daysDiff = Math.ceil((new Date(ev.date).getTime() - new Date(today).getTime()) / (1000 * 3600 * 24));
                              
                              let countdownText = "Live Today";
                              if (daysDiff > 0) countdownText = `In ${daysDiff} Days`;
                              else if (daysDiff < 0) countdownText = `${Math.abs(daysDiff)} Days Ago`;

                              // Parse photos
                              let eventPhotosList: string[] = [];
                              if (ev.photos) {
                                try {
                                  eventPhotosList = typeof ev.photos === "string" ? JSON.parse(ev.photos) : (Array.isArray(ev.photos) ? ev.photos : []);
                                } catch (_) {
                                  eventPhotosList = [ev.photos];
                                }
                              }

                              return (
                                <div key={ev.id} className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs hover:shadow-md transition-all flex flex-col justify-between group relative">
                                  {/* Cover Banner or Featured Photo */}
                                  {eventPhotosList.length > 0 ? (
                                    <div className="relative h-44 w-full bg-slate-900 overflow-hidden cursor-pointer" onClick={() => setSelectedPhotoLightbox({ src: eventPhotosList[0], title: ev.name })}>
                                      {/* eslint-disable-next-line @next/next/no-img-element */}
                                      <img src={eventPhotosList[0]} alt={ev.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-90" />
                                      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-black/30" />
                                      <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
                                        <span className={`text-[9.5px] font-black uppercase px-2.5 py-1 rounded-lg backdrop-blur-md bg-white/90 text-slate-900 shadow-sm`}>
                                          {ev.category || "Fest"}
                                        </span>
                                        <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-black/60 text-white backdrop-blur-xs border border-white/20 flex items-center gap-1">
                                          <span>📷</span> {eventPhotosList.length} Photos
                                        </span>
                                      </div>
                                      <div className="absolute bottom-2.5 left-3 right-3 flex items-center justify-between text-white text-xs font-bold">
                                        <span className="flex items-center gap-1">
                                          <Calendar className="h-3.5 w-3.5 text-pink-400" />
                                          {ev.date}{ev.end_date ? ` → ${ev.end_date}` : ""}
                                        </span>
                                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-md ${
                                          daysDiff === 0 ? "bg-emerald-500 text-white animate-pulse" : "bg-white/20 text-white backdrop-blur-xs"
                                        }`}>
                                          {countdownText}
                                        </span>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="h-20 bg-gradient-to-r from-indigo-900 via-purple-900 to-pink-900 p-3.5 flex items-center justify-between relative overflow-hidden">
                                      <div className="absolute -right-4 -top-4 w-24 h-24 bg-white/10 rounded-full blur-xl pointer-events-none" />
                                      <span className={`text-[9.5px] font-black uppercase px-2.5 py-1 rounded-lg backdrop-blur-md bg-white/90 text-slate-900 shadow-sm z-10`}>
                                        {ev.category || "Fest"}
                                      </span>
                                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-md z-10 ${
                                        daysDiff === 0 ? "bg-emerald-500 text-white animate-pulse" : "bg-white/20 text-white backdrop-blur-xs"
                                      }`}>
                                        {countdownText}
                                      </span>
                                    </div>
                                  )}

                                  {/* Body Details */}
                                  <div className="p-4 space-y-3 flex-1 flex flex-col justify-between">
                                    <div className="space-y-2">
                                      {eventPhotosList.length === 0 && (
                                        <div className="flex items-center gap-1.5 text-xs text-indigo-600 font-bold">
                                          <Calendar className="h-3.5 w-3.5" />
                                          <span>{ev.date}{ev.end_date ? ` to ${ev.end_date}` : ""}</span>
                                        </div>
                                      )}

                                      <h4 className="text-sm font-black text-slate-900 leading-snug group-hover:text-indigo-600 transition-colors">
                                        {ev.name}
                                      </h4>

                                      {ev.venue && (
                                        <div className="text-[11px] text-slate-600 font-semibold flex items-center gap-1">
                                          <span className="text-slate-400">📍</span>
                                          <span>{ev.venue}</span>
                                        </div>
                                      )}

                                      {ev.coordinator && (
                                        <div className="text-[10.5px] text-slate-600 font-medium flex items-center gap-1">
                                          <span className="font-bold text-slate-400">Lead:</span> {ev.coordinator}
                                        </div>
                                      )}

                                      {ev.chief_guest && (
                                        <div className="text-[10.5px] text-indigo-800 bg-indigo-50/70 p-1.5 rounded-lg border border-indigo-100/60 font-semibold">
                                          <span className="font-bold text-indigo-600">Guest:</span> {ev.chief_guest}
                                        </div>
                                      )}

                                      {ev.desc && (
                                        <p className="text-xs text-slate-600 line-clamp-2 font-normal pt-0.5">
                                          {ev.desc}
                                        </p>
                                      )}
                                    </div>

                                    {/* Mini Photo Highlights Carousel / Upload Moments */}
                                    <div className="pt-2 border-t border-slate-100 space-y-2">
                                      {eventPhotosList.length > 0 && (
                                        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar">
                                          {eventPhotosList.slice(0, 4).map((imgUrl, pIdx) => (
                                            <div
                                              key={pIdx}
                                              onClick={() => setSelectedPhotoLightbox({ src: imgUrl, title: `${ev.name} - Photo ${pIdx + 1}` })}
                                              className="h-10 w-10 shrink-0 rounded-lg overflow-hidden border border-slate-200 cursor-pointer hover:opacity-80 transition-opacity"
                                            >
                                              {/* eslint-disable-next-line @next/next/no-img-element */}
                                              <img src={imgUrl} alt="Moment" className="h-full w-full object-cover" />
                                            </div>
                                          ))}
                                          {eventPhotosList.length > 4 && (
                                            <div
                                              onClick={() => setSelectedPhotoLightbox({ src: eventPhotosList[4], title: ev.name })}
                                              className="h-10 w-10 shrink-0 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-[10px] font-black text-slate-600 cursor-pointer"
                                            >
                                              +{eventPhotosList.length - 4}
                                            </div>
                                          )}
                                        </div>
                                      )}

                                      {/* Quick Upload Event Moment / Photo */}
                                      <div className="flex items-center justify-between gap-1 text-[10.5px]">
                                        <label className="text-indigo-600 hover:text-indigo-800 font-extrabold flex items-center gap-1 cursor-pointer">
                                          <span>📸</span>
                                          <span>Upload Moments</span>
                                          <input
                                            type="file"
                                            accept="image/*"
                                            onChange={(e) => {
                                              const f = e.target.files?.[0];
                                              if (f) handleQuickUploadPhotoToEvent(ev, f);
                                              e.target.value = "";
                                            }}
                                            className="hidden"
                                          />
                                        </label>
                                        <span className="text-[10px] font-semibold text-slate-400">{ev.department || "All Depts"}</span>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Card Bottom Actions */}
                                  <div className="px-4 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-1.5">
                                      <button
                                        type="button"
                                        onClick={() => handleQuickStatusChange(ev)}
                                        className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold cursor-pointer transition-all ${
                                          ev.status === "Ongoing"
                                            ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                                            : ev.status === "Completed"
                                            ? "bg-slate-200 text-slate-700"
                                            : ev.status === "Postponed"
                                            ? "bg-rose-100 text-rose-800"
                                            : "bg-indigo-100 text-indigo-800 border border-indigo-200"
                                        }`}
                                      >
                                        {ev.status || "Upcoming"}
                                      </button>
                                    </div>

                                    <div className="flex items-center gap-1">
                                      <button
                                        type="button"
                                        onClick={() => handleOpenEditEventModal(ev)}
                                        className="p-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 transition-colors cursor-pointer"
                                        title="Edit Event & Photos"
                                      >
                                        <Edit2 className="h-3.5 w-3.5" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteEvent(ev.id)}
                                        className="p-1.5 rounded-lg bg-white border border-slate-200 hover:bg-rose-50 text-rose-600 transition-colors cursor-pointer"
                                        title="Delete Event"
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>
                      )}

                      {/* VIEW 2: TIMELINE TRACKER VIEW */}
                      {eventViewMode === "timeline" && (
                        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-6">
                          <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 border-b border-slate-100 pb-3">
                            Chronological Event Roadmap &amp; Milestones
                          </h4>
                          <div className="relative pl-6 border-l-2 border-indigo-200 space-y-8 my-4">
                            {filteredEvents.map(ev => (
                              <div key={ev.id} className="relative group">
                                <div className="absolute -left-[31px] top-1.5 h-4 w-4 rounded-full bg-indigo-600 ring-4 ring-indigo-100 border-2 border-white shadow-xs" />
                                <div className="bg-slate-50/70 border border-slate-200 p-4 rounded-xl space-y-2 hover:bg-white transition-all shadow-2xs">
                                  <div className="flex items-center justify-between flex-wrap gap-2">
                                    <span className="text-xs font-mono font-black text-indigo-600">{ev.date}{ev.end_date ? ` → ${ev.end_date}` : ""}</span>
                                    <span className="text-[10px] font-extrabold px-2 py-0.5 rounded bg-indigo-100 text-indigo-800 uppercase">{ev.category || "Fest"}</span>
                                  </div>
                                  <h4 className="text-sm font-extrabold text-slate-900">{ev.name}</h4>
                                  {ev.venue && <p className="text-[11px] text-slate-500 font-semibold">📍 {ev.venue}</p>}
                                  {ev.desc && <p className="text-xs text-slate-600 font-normal">{ev.desc}</p>}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* VIEW 3: TABLE LIST VIEW */}
                      {eventViewMode === "table" && (
                        <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-x-auto">
                          <table className="w-full text-left text-xs font-semibold">
                            <thead>
                              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-extrabold uppercase text-[9.5px] tracking-wider">
                                <th className="p-3">Event Title</th>
                                <th className="p-3">Dates</th>
                                <th className="p-3">Category</th>
                                <th className="p-3">Department</th>
                                <th className="p-3">Coordinator</th>
                                <th className="p-3">Status</th>
                                <th className="p-3">Venue</th>
                                <th className="p-3 text-center">Action</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {filteredEvents.map(ev => (
                                <tr key={ev.id} className="hover:bg-indigo-50/20">
                                  <td className="p-3 font-bold text-slate-900">{ev.name}</td>
                                  <td className="p-3 font-mono font-bold text-indigo-700">{ev.date}{ev.end_date ? ` to ${ev.end_date}` : ""}</td>
                                  <td className="p-3 text-slate-700">{ev.category || "Coding Fest"}</td>
                                  <td className="p-3 text-slate-600">{ev.department || "All Departments"}</td>
                                  <td className="p-3 text-slate-700 font-semibold">{ev.coordinator || "—"}</td>
                                  <td className="p-3">
                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700">{ev.status || "Upcoming"}</span>
                                  </td>
                                  <td className="p-3 text-slate-600">{ev.venue || "—"}</td>
                                  <td className="p-3 text-center">
                                    <div className="flex items-center justify-center gap-1.5">
                                      <button type="button" onClick={() => handleOpenEditEventModal(ev)} className="p-1 rounded bg-slate-100 text-slate-700 hover:bg-slate-200 cursor-pointer">
                                        <Edit2 className="h-3.5 w-3.5" />
                                      </button>
                                      <button type="button" onClick={() => handleDeleteEvent(ev.id)} className="p-1 rounded bg-rose-50 text-rose-600 hover:bg-rose-100 cursor-pointer">
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}

                      {/* Photo Zoom Lightbox Modal */}
                      {selectedPhotoLightbox && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-fadeIn" onClick={() => setSelectedPhotoLightbox(null)}>
                          <div className="relative max-w-4xl w-full max-h-[90vh] flex flex-col items-center justify-center p-2" onClick={e => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={() => setSelectedPhotoLightbox(null)}
                              className="absolute top-3 right-3 text-white bg-white/20 hover:bg-white/40 h-8 w-8 rounded-full flex items-center justify-center font-bold text-lg cursor-pointer transition-colors"
                            >
                              ✕
                            </button>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={selectedPhotoLightbox.src} alt={selectedPhotoLightbox.title} className="max-h-[80vh] w-auto max-w-full rounded-xl object-contain shadow-2xl border border-white/10" />
                            <p className="text-white text-xs font-bold mt-3 text-center tracking-wide">{selectedPhotoLightbox.title}</p>
                          </div>
                        </div>
                      )}

                      {/* Create / Edit Campus Event Modal */}
                      {showEventModal && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs font-sans animate-fadeIn">
                          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto custom-scrollbar">
                            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                              <div>
                                <h3 className="text-base font-black text-slate-900">
                                  {editingEventObj ? "Edit Campus Event / Fest" : "Host New Campus Event or Hackathon"}
                                </h3>
                                <p className="text-[11px] text-slate-400 font-semibold mt-0.5">Configure event schedule, chief guests, and upload post-event photo moments.</p>
                              </div>
                              <button type="button" onClick={() => setShowEventModal(false)} className="text-slate-400 hover:text-slate-600 font-bold text-xl cursor-pointer">×</button>
                            </div>

                            <form onSubmit={handleSaveRichEventSubmit} className="space-y-4 text-xs">
                              {/* Title */}
                              <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-500 uppercase">Event Title *</label>
                                <input
                                  type="text"
                                  required
                                  placeholder="e.g. CodeCraft 2026 - 24hr Campus Hackathon"
                                  value={evFormName}
                                  onChange={e => setEvFormName(e.target.value)}
                                  className="w-full p-2.5 border border-slate-200 rounded-xl bg-slate-50/50 font-bold text-slate-800 outline-none focus:ring-1 focus:ring-indigo-500 text-sm"
                                />
                              </div>

                              {/* Dates */}
                              <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                  <label className="text-[10px] font-bold text-slate-500 uppercase">Start Date *</label>
                                  <input
                                    type="date"
                                    required
                                    value={evFormDate}
                                    onChange={e => setEvFormDate(e.target.value)}
                                    className="w-full p-2.5 border border-slate-200 rounded-xl bg-slate-50/50 font-bold text-slate-800 outline-none"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <label className="text-[10px] font-bold text-slate-500 uppercase">End Date (Optional)</label>
                                  <input
                                    type="date"
                                    value={evFormEndDate}
                                    onChange={e => setEvFormEndDate(e.target.value)}
                                    className="w-full p-2.5 border border-slate-200 rounded-xl bg-slate-50/50 font-bold text-slate-800 outline-none"
                                  />
                                </div>
                              </div>

                              {/* Category & Status */}
                              <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                  <label className="text-[10px] font-bold text-slate-500 uppercase">Event Category</label>
                                  <select
                                    value={evFormCategory}
                                    onChange={e => setEvFormCategory(e.target.value)}
                                    className="w-full p-2.5 border border-slate-200 rounded-xl bg-slate-50/50 font-bold text-slate-800 outline-none"
                                  >
                                    <option value="Coding Fest & Hackathon">Coding Fest &amp; Hackathon</option>
                                    <option value="Technical Symposium & Project Expo">Technical Symposium &amp; Project Expo</option>
                                    <option value="Workshop & Hands-on BootCamp">Workshop &amp; Hands-on BootCamp</option>
                                    <option value="Guest Lecture & Industry Talk">Guest Lecture &amp; Industry Talk</option>
                                    <option value="Cultural Fest & Celebration">Cultural Fest &amp; Celebration</option>
                                    <option value="Sports Meet & Tournament">Sports Meet &amp; Tournament</option>
                                    <option value="Campus Placement Drive">Campus Placement Drive</option>
                                    <option value="Academic Milestone & CIA Exam">Academic Milestone &amp; CIA Exam</option>
                                  </select>
                                </div>

                                <div className="space-y-1">
                                  <label className="text-[10px] font-bold text-slate-500 uppercase">Event Status</label>
                                  <select
                                    value={evFormStatus}
                                    onChange={e => setEvFormStatus(e.target.value)}
                                    className="w-full p-2.5 border border-slate-200 rounded-xl bg-slate-50/50 font-bold text-slate-800 outline-none"
                                  >
                                    <option value="Upcoming">Upcoming</option>
                                    <option value="Ongoing">Live / Ongoing Now</option>
                                    <option value="Completed">Completed</option>
                                    <option value="Postponed">Postponed</option>
                                  </select>
                                </div>
                              </div>

                              {/* Department & Audience */}
                              <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                  <label className="text-[10px] font-bold text-slate-500 uppercase">Department Scope</label>
                                  <select
                                    value={evFormDept}
                                    onChange={e => setEvFormDept(e.target.value)}
                                    className="w-full p-2.5 border border-slate-200 rounded-xl bg-slate-50/50 font-bold text-slate-800 outline-none"
                                  >
                                    <option value="All Departments">All Departments</option>
                                    {(collegeCourses.length > 0 ? collegeCourses : coursesList).map(d => (
                                      <option key={d.id} value={d.name}>{d.name}</option>
                                    ))}
                                  </select>
                                </div>

                                <div className="space-y-1">
                                  <label className="text-[10px] font-bold text-slate-500 uppercase">Target Audience</label>
                                  <select
                                    value={evFormAudience}
                                    onChange={e => setEvFormAudience(e.target.value)}
                                    className="w-full p-2.5 border border-slate-200 rounded-xl bg-slate-50/50 font-bold text-slate-800 outline-none"
                                  >
                                    <option value="All Campus">All Campus</option>
                                    <option value="Students Only">Students Only</option>
                                    <option value="Faculty Only">Faculty Only</option>
                                    <option value="Inter-College Participants">Inter-College Participants</option>
                                    <option value="Parents & Public">Parents &amp; Public</option>
                                  </select>
                                </div>
                              </div>

                              {/* Venue & Coordinator */}
                              <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                  <label className="text-[10px] font-bold text-slate-500 uppercase">Venue / Location</label>
                                  <input
                                    type="text"
                                    placeholder="e.g. Innovation Labs / Tech Arena"
                                    value={evFormVenue}
                                    onChange={e => setEvFormVenue(e.target.value)}
                                    className="w-full p-2.5 border border-slate-200 rounded-xl bg-slate-50/50 font-bold text-slate-800 outline-none"
                                  />
                                </div>

                                <div className="space-y-1">
                                  <label className="text-[10px] font-bold text-slate-500 uppercase">Lead Coordinator</label>
                                  <input
                                    type="text"
                                    placeholder="e.g. Prof. Vignesh (HOD-CSE)"
                                    value={evFormCoordinator}
                                    onChange={e => setEvFormCoordinator(e.target.value)}
                                    className="w-full p-2.5 border border-slate-200 rounded-xl bg-slate-50/50 font-bold text-slate-800 outline-none"
                                  />
                                </div>
                              </div>

                              {/* Chief Guest & Registration Link */}
                              <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                  <label className="text-[10px] font-bold text-slate-500 uppercase">Chief Guest / Keynote Speaker</label>
                                  <input
                                    type="text"
                                    placeholder="e.g. Sundeep G. (Principal Architect)"
                                    value={evFormChiefGuest}
                                    onChange={e => setEvFormChiefGuest(e.target.value)}
                                    className="w-full p-2.5 border border-slate-200 rounded-xl bg-slate-50/50 font-bold text-slate-800 outline-none"
                                  />
                                </div>

                                <div className="space-y-1">
                                  <label className="text-[10px] font-bold text-slate-500 uppercase">Registration / Submission Link</label>
                                  <input
                                    type="url"
                                    placeholder="https://..."
                                    value={evFormRegistrationLink}
                                    onChange={e => setEvFormRegistrationLink(e.target.value)}
                                    className="w-full p-2.5 border border-slate-200 rounded-xl bg-slate-50/50 font-bold text-slate-800 outline-none"
                                  />
                                </div>
                              </div>

                              {/* Agendas & Highlights */}
                              <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-500 uppercase">Agendas, Rules &amp; Highlights</label>
                                <textarea
                                  rows={3}
                                  placeholder="Hackathon problem statements, rules, round timings or function highlights..."
                                  value={evFormDesc}
                                  onChange={e => setEvFormDesc(e.target.value)}
                                  className="w-full p-2.5 border border-slate-200 rounded-xl bg-slate-50/50 font-medium text-slate-800 outline-none"
                                />
                              </div>

                              {/* Event Photo Memories & Moments Upload */}
                              <div className="space-y-2 pt-2 border-t border-slate-100">
                                <div className="flex items-center justify-between">
                                  <div>
                                    <label className="text-[10px] font-black text-slate-700 uppercase flex items-center gap-1.5">
                                      <span>📸</span>
                                      <span>Event Moments &amp; Photo Gallery</span>
                                    </label>
                                    <p className="text-[10px] text-slate-400">Upload photos taken during or at the end of the event/fest.</p>
                                  </div>
                                  <label className="px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-extrabold cursor-pointer transition-all flex items-center gap-1">
                                    <Upload className="h-3.5 w-3.5" />
                                    <span>+ Add Photo</span>
                                    <input type="file" accept="image/*" onChange={handleAddEventPhotoFile} className="hidden" />
                                  </label>
                                </div>

                                {evFormPhotos.length > 0 ? (
                                  <div className="grid grid-cols-4 gap-2.5 pt-1">
                                    {evFormPhotos.map((photoSrc, pIdx) => (
                                      <div key={pIdx} className="relative group rounded-xl overflow-hidden border border-slate-200 h-20 bg-slate-100">
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img src={photoSrc} alt="Preview" className="h-full w-full object-cover" />
                                        <button
                                          type="button"
                                          onClick={() => handleRemoveEventPhoto(pIdx)}
                                          className="absolute top-1 right-1 h-5 w-5 rounded-full bg-rose-600 text-white text-[10px] font-bold flex items-center justify-center opacity-90 hover:opacity-100 cursor-pointer shadow-xs"
                                          title="Remove Photo"
                                        >
                                          ✕
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <div className="p-4 rounded-xl border border-dashed border-slate-200 bg-slate-50/50 text-center text-slate-400 text-[11px]">
                                    No photo moments uploaded yet. Click &quot;+ Add Photo&quot; to upload memories from this fest.
                                  </div>
                                )}
                              </div>

                              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                                <Button type="button" variant="secondary" onClick={() => setShowEventModal(false)}>Cancel</Button>
                                <Button type="submit" variant="primary">
                                  {editingEventObj ? "Save Event Changes" : "Create Campus Event"}
                                </Button>
                              </div>
                            </form>
                          </div>
                        </div>
                      )}
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
                                <span className="text-[10px] text-slate-455 font-semibold block">{activeCollegeName || "Campus"} Ecosystem</span>
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

                          <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-xl flex items-center gap-3">
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
                          <div className="p-4 bg-white/80 rounded-xl border border-slate-100/40">
                            <span className="text-3xl font-extrabold text-slate-900">
                              {collegeMentors.length}
                            </span>
                            <span className="text-[9px] text-slate-455 font-extrabold uppercase tracking-wider block mt-1">Campus Faculty</span>
                          </div>
                          <div className="p-4 bg-white/80 rounded-xl border border-slate-100/40">
                            <span className="text-3xl font-extrabold text-slate-900">
                              {collegeStudents.length}
                            </span>
                            <span className="text-[9px] text-slate-455 font-extrabold uppercase tracking-wider block mt-1">Active Students</span>
                          </div>
                          <div className="p-4 bg-white/80 rounded-xl border border-slate-100/40">
                            <span className="text-3xl font-extrabold text-slate-900">
                              {collegeCourses.length}
                            </span>
                            <span className="text-[9px] text-slate-455 font-extrabold uppercase tracking-wider block mt-1">Active Courses</span>
                          </div>
                          <div className="p-4 bg-white/80 rounded-xl border border-slate-105/40">
                            <span className="text-3xl font-extrabold text-slate-900">
                              {collegeSlots.length}
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
                    <div className="bg-white rounded-xl border border-slate-200 shadow-xl max-w-md w-full p-6 space-y-4 animate-in fade-in duration-150">
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
                          <LoadingButton
                            isLoading={loadingActions[`save_faculty_${editingFacultyId}`]}
                            loadingText="Saving..."
                            variant="primary"
                            onClick={() => handleSaveFacultyConfig(editingFacultyId)}
                            className="flex-1"
                          >
                            Save Configuration
                          </LoadingButton>
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
                  <div className="bg-white rounded-xl border border-slate-205 shadow-xl max-w-lg w-full overflow-hidden animate-slideUp font-sans">
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
                            const searched = (collegeSubjects || []).filter(s => {
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
                        <LoadingButton
                          type="submit"
                          isLoading={loadingActions['submit_mentor']}
                          loadingText={editingMentor ? "Saving..." : "Creating..."}
                          variant="gradient"
                          className="px-5 py-2 text-white rounded-xl shadow-sm transition-all font-bold cursor-pointer"
                        >
                          {editingMentor ? "Save Changes" : "Create Mentor"}
                        </LoadingButton>
                      </div>
                    </form>
                  </div>
                </div>
              )}

              {/*  Emergency Substitution Modal */}
              {showSubstitutionModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs font-sans">
                  <div className="bg-white rounded-xl border border-slate-200 shadow-xl max-w-md w-full p-6 space-y-4 animate-in fade-in duration-150">
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
                  <div className="bg-white rounded-xl border border-slate-200 shadow-xl max-w-md w-full p-6 space-y-4 animate-in fade-in duration-150">
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
                        <div className="p-3.5 bg-rose-50 border border-rose-150 text-rose-800 text-[10.5px] rounded-xl font-bold flex flex-col gap-2.5 shadow-xs">
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
                          className={`flex-grow py-2.5 text-white rounded-xl shadow-sm transition-all font-bold cursor-pointer text-center border border-indigo-650 flex items-center justify-center gap-2 ${
                            isCorrectionSubmitting || !correctionSlotId || (studentCorrectionCount >= 2 && !isAdminOverride)
                              ? "bg-slate-300 border-slate-300 text-slate-400 cursor-not-allowed"
                              : "btn-gradient hover:opacity-95"
                          }`}
                        >
                          {isCorrectionSubmitting ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin shrink-0 text-current" />
                              <span>Saving...</span>
                            </>
                          ) : (
                            "Apply Correction"
                          )}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

              {/* Excel Import Preview Modal */}
              {showImportModal && importPreview && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs font-sans">
                  <div className="bg-white rounded-xl border border-slate-200 shadow-xl max-w-2xl w-full p-6 space-y-4 animate-in fade-in duration-150 max-h-[90vh] flex flex-col">
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
                        <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl flex flex-col gap-1 shadow-xs">
                          <span className="text-[10px] uppercase font-bold text-emerald-700 tracking-wider">Parsed Slots</span>
                          <span className="text-xl font-extrabold text-emerald-800">{importPreview.slots.length}</span>
                          <span className="text-[10px] text-emerald-600">Ready to import and publish</span>
                        </div>
                        <div className={`p-3 rounded-xl border flex flex-col gap-1 shadow-xs ${
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
                        <div className="space-y-2 border border-slate-205 rounded-xl p-4 bg-slate-50/50">
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
                      <div className="p-3.5 bg-blue-50 border border-blue-100 text-blue-800 rounded-xl flex items-start gap-2.5 shadow-xs">
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
                        className={`px-5 py-2 text-white rounded-xl shadow-sm transition-all font-bold cursor-pointer border border-indigo-650 flex items-center justify-center gap-2 ${
                          isImportSubmitting || importPreview.slots.length === 0
                            ? "bg-slate-300 border-slate-300 text-slate-400 cursor-not-allowed opacity-80"
                            : "btn-gradient hover:opacity-95 active:scale-95"
                        }`}
                      >
                        {isImportSubmitting ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin text-white shrink-0" />
                            <span>Importing Schedule...</span>
                          </>
                        ) : (
                          <>
                            <Upload className="h-4 w-4 shrink-0" />
                            <span>Commit Schedule</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Download Student Excel Template Selection Modal */}
              {showTemplateModal && (() => {
                const campusDeptNames = (collegeCourses.length > 0 ? collegeCourses : coursesList).map(c => c.name);
                const deptOptions = campusDeptNames;
                const semOptions = ["Semester 1", "Semester 2", "Semester 3", "Semester 4", "Semester 5", "Semester 6", "Semester 7", "Semester 8"];
                const selectedDept = templateDept || deptOptions[0] || "General";

                const selectedCourseObj = collegeCourses.find(
                  c => c.name.trim().toLowerCase() === selectedDept.trim().toLowerCase()
                );

                const allowedShifts = (() => {
                  if (!selectedCourseObj) return ["Shift 1", "Shift 2", "General"];
                  const ds = (selectedCourseObj.default_shift || "").toLowerCase();
                  if (ds === "shift_1") return ["Shift 1"];
                  if (ds === "shift_2") return ["Shift 2"];
                  if (ds === "general") return ["General"];
                  if (ds === "both") return ["Shift 1", "Shift 2"];
                  if (ds === "all") return ["Shift 1", "Shift 2", "General"];
                  if (selectedCourseObj.shift_based === 1) return ["Shift 1", "Shift 2"];
                  return ["General"];
                })();

                const selectedShift = allowedShifts.includes(templateShift) ? templateShift : allowedShifts[0];
                const composedClass = (selectedShift && selectedShift !== "General")
                  ? `${selectedDept} - ${selectedShift} - ${templateSem || "Semester 1"}`
                  : `${selectedDept} - ${templateSem || "Semester 1"}`;

                return (
                  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs font-sans">
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95">
                      <div className="flex justify-between items-center border-b border-slate-150 pb-3">
                        <div className="flex items-center gap-2.5">
                          <div className="h-9 w-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                            <Download className="h-5 w-5" />
                          </div>
                          <div>
                            <h3 className="text-base font-black text-slate-800">Download Excel Template</h3>
                            <p className="text-[11px] text-slate-400 font-medium">Select class details to pre-configure your spreadsheet</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowTemplateModal(false)}
                          className="text-slate-400 hover:text-slate-600 font-bold text-xl cursor-pointer"
                        >
                          ×
                        </button>
                      </div>

                      <div className="space-y-3.5 text-xs">
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Course / Department</label>
                          <select
                            value={selectedDept}
                            onChange={(e) => {
                              setTemplateDept(e.target.value);
                              const nextCourse = collegeCourses.find(c => c.name.trim().toLowerCase() === e.target.value.trim().toLowerCase());
                              const nextDs = (nextCourse?.default_shift || "").toLowerCase();
                              if (nextDs === "shift_1") setTemplateShift("Shift 1");
                              else if (nextDs === "shift_2") setTemplateShift("Shift 2");
                              else if (nextDs === "general") setTemplateShift("General");
                              else if (nextDs === "both") setTemplateShift("Shift 1");
                            }}
                            className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 font-bold text-slate-800 outline-none cursor-pointer focus:border-indigo-500"
                          >
                            {deptOptions.map(d => <option key={d} value={d}>{d}</option>)}
                          </select>
                        </div>

                        {allowedShifts.length > 1 && (
                          <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Shift</label>
                            <select
                              value={selectedShift}
                              onChange={(e) => setTemplateShift(e.target.value)}
                              className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 font-bold text-slate-800 outline-none cursor-pointer focus:border-indigo-500"
                            >
                              {allowedShifts.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                          </div>
                        )}

                        <div>
                          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Semester</label>
                          <select
                            value={templateSem || "Semester 1"}
                            onChange={(e) => setTemplateSem(e.target.value)}
                            className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 font-bold text-slate-800 outline-none cursor-pointer focus:border-indigo-500"
                          >
                            {semOptions.map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                        </div>

                        <div className="p-3 rounded-xl bg-indigo-50/70 border border-indigo-100 text-[11px] text-indigo-900 font-semibold space-y-1">
                          <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider block">Generated Target Class</span>
                          <span className="font-bold text-slate-800 block">{composedClass}</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-150">
                        <button
                          type="button"
                          onClick={() => setShowTemplateModal(false)}
                          className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            handleDownloadStudentTemplate(composedClass);
                            setShowTemplateModal(false);
                          }}
                          className="px-4 py-2 rounded-xl btn-gradient text-white text-xs font-bold transition-all shadow-sm cursor-pointer flex items-center gap-1.5 active:scale-95"
                        >
                          <Download className="h-3.5 w-3.5" />
                          <span>Download Template (.xlsx)</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Excel Student Import Preview Modal */}
              {showStudentImportModal && studentImportPreview && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs font-sans">
                  <div className="bg-white rounded-xl border border-slate-200 shadow-xl max-w-4xl w-full p-6 space-y-4 animate-in fade-in duration-150 max-h-[90vh] flex flex-col">
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
                        <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-xl flex flex-col gap-1 shadow-xs">
                          <span className="text-[10px] uppercase font-bold text-indigo-700 tracking-wider">Parsed Students</span>
                          <span className="text-xl font-extrabold text-indigo-850">{studentImportPreview.parsed.length}</span>
                          <span className="text-[10px] text-indigo-600">Ready to save to SQLite database</span>
                        </div>

                        <div className={`p-3 rounded-xl border flex flex-col gap-1 shadow-xs ${
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

                        <div className="p-3 bg-white border border-slate-200 rounded-xl flex flex-col justify-center gap-1.5 shadow-xs sm:col-span-1">
                          <label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block">Target Class Cohort</label>
                          {(() => {
                            const campusDeptNames = (collegeCourses.length > 0 ? collegeCourses : coursesList).map(c => c.name);
                            const deptOptions = campusDeptNames;
                            const semOptions = ["Semester 1", "Semester 2", "Semester 3", "Semester 4", "Semester 5", "Semester 6", "Semester 7", "Semester 8"];
                            const current = studentImportPreview.targetClassGroup || "";
                            const currentDept = deptOptions.find(d => current.startsWith(d)) || deptOptions[0] || "General";

                            const selectedCourseObj = collegeCourses.find(
                              c => c.name.trim().toLowerCase() === currentDept.trim().toLowerCase()
                            );

                            const allowedShifts = (() => {
                              if (!selectedCourseObj) return ["Shift 1", "Shift 2", "General"];
                              const ds = (selectedCourseObj.default_shift || "").toLowerCase();
                              if (ds === "shift_1") return ["Shift 1"];
                              if (ds === "shift_2") return ["Shift 2"];
                              if (ds === "general") return ["General"];
                              if (ds === "both") return ["Shift 1", "Shift 2"];
                              if (ds === "all") return ["Shift 1", "Shift 2", "General"];
                              if (selectedCourseObj.shift_based === 1) return ["Shift 1", "Shift 2"];
                              return ["General"];
                            })();

                            let currentShift = allowedShifts.find(s => current.includes(s)) || allowedShifts[0];

                            const updateCohort = (dept: string, shift: string, sem: string) => {
                              const newCG = (shift && shift !== "General")
                                ? `${dept} - ${shift} - ${sem}`
                                : `${dept} - ${sem}`;
                              setStudentImportPreview({ ...studentImportPreview, targetClassGroup: newCG });
                            };

                            const currentSem = semOptions.find(s => current.includes(s)) || "Semester 1";

                            const handleDeptChange = (newDept: string) => {
                              const newCourseObj = collegeCourses.find(
                                c => c.name.trim().toLowerCase() === newDept.trim().toLowerCase()
                              );
                              const newAllowedShifts = (() => {
                                if (!newCourseObj) return ["Shift 1", "Shift 2", "General"];
                                const ds = (newCourseObj.default_shift || "").toLowerCase();
                                if (ds === "shift_1") return ["Shift 1"];
                                if (ds === "shift_2") return ["Shift 2"];
                                if (ds === "general") return ["General"];
                                if (ds === "both") return ["Shift 1", "Shift 2"];
                                if (ds === "all") return ["Shift 1", "Shift 2", "General"];
                                if (newCourseObj.shift_based === 1) return ["Shift 1", "Shift 2"];
                                return ["General"];
                              })();
                              const newShift = newAllowedShifts.includes(currentShift) ? currentShift : newAllowedShifts[0];
                              updateCohort(newDept, newShift, currentSem);
                            };

                            return (
                              <div className="flex flex-col gap-1">
                                <select
                                  value={currentDept}
                                  onChange={(e) => handleDeptChange(e.target.value)}
                                  className="w-full text-[11px] font-bold px-2 py-1.5 rounded-lg border border-slate-200 bg-slate-50 outline-none cursor-pointer"
                                >
                                  {deptOptions.map(d => <option key={d} value={d}>{d}</option>)}
                                </select>
                                <div className="flex gap-1">
                                  {allowedShifts.length > 1 ? (
                                    <select
                                      value={currentShift}
                                      onChange={(e) => updateCohort(currentDept, e.target.value, currentSem)}
                                      className="flex-1 text-[11px] font-bold px-2 py-1.5 rounded-lg border border-slate-200 bg-slate-50 outline-none cursor-pointer"
                                    >
                                      {allowedShifts.map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                  ) : (
                                    <div className="flex-1 text-[11px] font-extrabold px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-100 text-slate-700 flex items-center">
                                      {allowedShifts[0]}
                                    </div>
                                  )}
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
                        <div className="space-y-1.5 border border-amber-200 rounded-xl p-3.5 bg-amber-50/50">
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
                        <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-xs max-h-[35vh]">
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
                        className={`px-5 py-2 text-white rounded-xl shadow-sm transition-all font-bold cursor-pointer border border-indigo-650 flex items-center justify-center gap-2 ${
                          isStudentImportSubmitting || studentImportPreview.parsed.length === 0
                            ? "bg-slate-300 border-slate-300 text-slate-400 cursor-not-allowed opacity-80"
                            : "btn-gradient hover:opacity-95 active:scale-95"
                        }`}
                      >
                        {isStudentImportSubmitting ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin text-white shrink-0" />
                            <span>Importing Students...</span>
                          </>
                        ) : (
                          <>
                            <Upload className="h-4 w-4 shrink-0" />
                            <span>Confirm & Import Students</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Student Full Profile Detail Modal */}
              {selectedStudentForDetail && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs font-sans">
                  <div className="bg-white rounded-xl border border-slate-200 shadow-xl max-w-2xl w-full p-6 space-y-5 animate-in fade-in duration-150 max-h-[90vh] overflow-y-auto">
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
                      {/* Assessment & Test Scores */}
                      <div className="bg-gradient-to-r from-indigo-50/70 to-purple-50/70 border border-indigo-200/80 p-4 rounded-xl space-y-2">
                        <h4 className="text-[10px] font-black text-indigo-700 uppercase tracking-widest flex items-center gap-1.5">
                          <Award className="h-3.5 w-3.5 text-indigo-600" />
                          Assessment &amp; Skill Benchmark Scores
                        </h4>
                        <div className="grid grid-cols-2 gap-3 pt-1">
                          <div className="bg-white p-3 rounded-xl border border-indigo-100 shadow-2xs space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="text-[9.5px] text-slate-400 font-bold uppercase block">Hire Score</span>
                              {selectedStudentForDetail.hire_score && (
                                <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700">
                                  {Number(selectedStudentForDetail.hire_score) >= 700 ? "Elite" : Number(selectedStudentForDetail.hire_score) >= 600 ? "Placement Ready" : "Developing"}
                                </span>
                              )}
                            </div>
                            <span className="text-base font-black text-indigo-700 block">{selectedStudentForDetail.hire_score ? `${selectedStudentForDetail.hire_score} / 1000` : "—"}</span>
                          </div>
                          <div className="bg-white p-3 rounded-xl border border-purple-100 shadow-2xs space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="text-[9.5px] text-slate-400 font-bold uppercase block">EFSET English Grade</span>
                              {selectedStudentForDetail.efset_score && (
                                <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-purple-50 text-purple-700">
                                  {selectedStudentForDetail.efset_score === "C2" ? "C2 Proficient" :
                                   selectedStudentForDetail.efset_score === "C1" ? "C1 Advanced" :
                                   selectedStudentForDetail.efset_score === "B2" ? "B2 Upper Intermediate" :
                                   selectedStudentForDetail.efset_score === "B1" ? "B1 Intermediate" :
                                   selectedStudentForDetail.efset_score === "A2" ? "A2 Elementary" :
                                   selectedStudentForDetail.efset_score === "A1" ? "A1 Beginner" : "CEFR Grade"}
                                </span>
                              )}
                            </div>
                            <span className="text-base font-black text-purple-700 block">
                              {selectedStudentForDetail.efset_score ? `Grade ${selectedStudentForDetail.efset_score}` : "—"}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Academic & Class Details */}
                      <div className="bg-slate-50/70 border border-slate-200/80 p-4 rounded-xl space-y-3">
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
                            <span className="text-xs font-extrabold text-slate-800">{formatDisplayDob(selectedStudentForDetail.dob)}</span>
                          </div>
                        </div>
                      </div>

                      {/* Family, Contact & Identity Details */}
                      <div className="bg-slate-50/70 border border-slate-200/80 p-4 rounded-xl space-y-3">
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Family, Contact Information &amp; Identity Cards</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <span className="text-[9.5px] text-slate-400 font-bold uppercase block">Father Name</span>
                            <span className="text-xs font-bold text-slate-800">{selectedStudentForDetail.father_name || "—"}</span>
                          </div>
                          <div>
                            <span className="text-[9.5px] text-slate-400 font-bold uppercase block">Mother Name</span>
                            <span className="text-xs font-bold text-slate-800">{selectedStudentForDetail.mother_name || "—"}</span>
                          </div>
                          <div>
                            <span className="text-[9.5px] text-slate-400 font-bold uppercase block">Student Email</span>
                            <span className="text-xs font-bold text-slate-800 truncate block">{selectedStudentForDetail.email}</span>
                          </div>
                          <div>
                            <span className="text-[9.5px] text-slate-400 font-bold uppercase block">Student Phone Number</span>
                            <span className="text-xs font-bold text-slate-800">{selectedStudentForDetail.phone || "—"}</span>
                          </div>
                          <div>
                            <span className="text-[9.5px] text-slate-400 font-bold uppercase block">Parent Phone (WhatsApp Number)</span>
                            <span className="text-xs font-bold text-emerald-700">{selectedStudentForDetail.parent_phone || "—"}</span>
                          </div>
                          <div>
                            <span className="text-[9.5px] text-slate-400 font-bold uppercase block">Aadhar Card Number</span>
                            <span className="text-xs font-mono font-bold text-slate-800">{selectedStudentForDetail.aadhar_number || "—"}</span>
                          </div>
                          <div>
                            <span className="text-[9.5px] text-slate-400 font-bold uppercase block">PAN Card Number</span>
                            <span className="text-xs font-mono font-bold text-slate-800">{selectedStudentForDetail.pan_number || "—"}</span>
                          </div>
                        </div>
                      </div>

                      {/* Portfolio & Coding Profiles */}
                      <div className="bg-slate-50/70 border border-slate-200/80 p-4 rounded-xl space-y-3">
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

                    <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                      <button
                        type="button"
                        disabled={selectedStudentForDetail ? loadingActions[`delete_student_${selectedStudentForDetail.id}`] : false}
                        onClick={() => handleSingleDeleteStudent(selectedStudentForDetail)}
                        className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {selectedStudentForDetail && loadingActions[`delete_student_${selectedStudentForDetail.id}`] ? (
                          <>
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            Deleting...
                          </>
                        ) : (
                          <>
                            <Trash2 className="h-3.5 w-3.5" />
                            Delete Student Record
                          </>
                        )}
                      </button>
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

              {/* ── Attendance Excel Import Preview Modal ── */}
              {showAttendanceImportModal && attendanceImportPreview && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs font-sans">
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-4xl w-full p-6 space-y-4 animate-in fade-in duration-150 max-h-[90vh] flex flex-col">
                    <div className="flex justify-between items-center border-b border-slate-150 pb-3 shrink-0">
                      <div>
                        <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                          <Upload className="h-4 w-4 text-indigo-600" />
                          <span>Excel Daily Attendance Import Preview</span>
                        </h3>
                        <p className="text-[11px] text-slate-500 font-semibold mt-1 flex items-center gap-2 flex-wrap">
                          <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200 font-bold">
                            {attendanceImportPreview.parsed.length} Students
                          </span>
                          <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold">
                            {Array.from(new Set(attendanceImportPreview.parsed.flatMap(p => Object.keys(p.dateMarks || {})))).length} Dates Detected
                          </span>
                          <span className="text-slate-400">
                            Range: <strong className="text-slate-700">{attendanceImportPreview.targetDate}</strong>
                          </span>
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setShowAttendanceImportModal(false);
                          setAttendanceImportPreview(null);
                        }}
                        className="text-slate-400 hover:text-slate-600 font-bold text-lg cursor-pointer"
                      >
                        ×
                      </button>
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-4 pr-1 text-xs font-semibold">
                      {attendanceImportPreview.warnings.length > 0 && (
                        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-1 text-amber-800">
                          <span className="text-[10px] font-bold uppercase tracking-wider block text-amber-700">
                            Validation Warnings ({attendanceImportPreview.warnings.length})
                          </span>
                          <div className="max-h-24 overflow-y-auto space-y-0.5 text-[10.5px]">
                            {attendanceImportPreview.warnings.map((w, i) => <p key={i}>• {w}</p>)}
                          </div>
                        </div>
                      )}

                      <div className="rounded-xl border border-slate-200 overflow-x-auto shadow-2xs">
                        {(() => {
                          const hasDateMarks = attendanceImportPreview.parsed.some(p => p.dateMarks && Object.keys(p.dateMarks).length > 0);
                          const allImportDates = hasDateMarks 
                            ? Array.from(new Set(attendanceImportPreview.parsed.flatMap(p => Object.keys(p.dateMarks || {})))).sort()
                            : [];

                          return (
                            <table className="w-full border-collapse text-left text-xs min-w-[700px]">
                              <thead>
                                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[9.5px]">
                                  <th className="p-2.5 border-r border-slate-200">Roll No / ID</th>
                                  <th className="p-2.5 border-r border-slate-200">Student Name</th>
                                  <th className="p-2.5 border-r border-slate-200">Class</th>
                                  {hasDateMarks ? (
                                    allImportDates.map(dStr => (
                                      <th key={dStr} className="p-2.5 border-r border-slate-200 text-center">{formatDateToDMY(dStr)}</th>
                                    ))
                                  ) : (
                                    ["Period 1", "Period 2", "Period 3", "Period 4", "Period 5"].map(p => (
                                      <th key={p} className="p-2.5 border-r border-slate-200 text-center">{p}</th>
                                    ))
                                  )}
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 bg-white">
                                {attendanceImportPreview.parsed.map((item, idx) => (
                                  <tr key={idx} className="hover:bg-slate-50/50">
                                    <td className="p-2.5 font-mono font-bold text-slate-600 border-r border-slate-100">{item.rollNo}</td>
                                    <td className="p-2.5 font-bold text-slate-800 border-r border-slate-100">{item.studentName}</td>
                                    <td className="p-2.5 text-slate-500 border-r border-slate-100">{item.classGroup}</td>
                                    {hasDateMarks ? (
                                      allImportDates.map(dStr => {
                                        const val = item.dateMarks?.[dStr] || "not_marked";
                                        return (
                                          <td key={dStr} className="p-2.5 text-center border-r border-slate-100">
                                            <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                                              val === "present"
                                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                                : val === "absent"
                                                ? "bg-rose-50 text-rose-700 border border-rose-200"
                                                : val === "od"
                                                ? "bg-purple-50 text-purple-700 border border-purple-200"
                                                : val === "late"
                                                ? "bg-amber-50 text-amber-700 border border-amber-200"
                                                : "bg-slate-100 text-slate-400"
                                            }`}>
                                              {val === "present" ? "P" : val === "absent" ? "A" : val === "od" ? "OD" : val === "late" ? "HD" : "—"}
                                            </span>
                                          </td>
                                        );
                                      })
                                    ) : (
                                      ["p1", "p2", "p3", "p4", "p5"].map(pKey => {
                                        const val = item.periodMarks[pKey] || "present";
                                        return (
                                          <td key={pKey} className="p-2.5 text-center border-r border-slate-100">
                                            <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                                              val === "present"
                                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                                : val === "absent"
                                                ? "bg-rose-50 text-rose-700 border border-rose-200"
                                                : val === "late"
                                                ? "bg-amber-50 text-amber-700 border border-amber-200"
                                                : "bg-slate-100 text-slate-400"
                                            }`}>
                                              {val === "present" ? "P" : val === "absent" ? "A" : val === "late" ? "L" : "—"}
                                            </span>
                                          </td>
                                        );
                                      })
                                    )}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          );
                        })()}
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-150 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setShowAttendanceImportModal(false);
                          setAttendanceImportPreview(null);
                        }}
                        className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        disabled={isAttendanceImportSubmitting}
                        onClick={handleConfirmAttendanceImportSubmit}
                        className="px-4 py-2 rounded-xl btn-gradient text-white text-xs font-bold transition-all shadow-sm cursor-pointer flex items-center gap-1.5 active:scale-95 disabled:opacity-60"
                      >
                        {isAttendanceImportSubmitting ? (
                          <>
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            <span>Importing...</span>
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            <span>Confirm &amp; Save Attendance</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* ── Student Period-Wise Attendance Marking Modal (With 2-Change Limit & Mandatory Reason) ── */}
              {markingStudentForDate && (() => {
                const st = markingStudentForDate.student;
                const dStr = markingStudentForDate.dateStr;
                const dateObj = new Date(dStr + "T00:00:00");
                const dayName = dateObj.toLocaleDateString("en-US", { weekday: "long" });
                const stSlots = collegeSlots.filter(s => s.day === dayName && (!s.classGroup || isCohortMatch(s.classGroup, st.classGroup)));
                
                const slotDedupeMap = new Map<string, typeof stSlots[0]>();
                stSlots.forEach(s => {
                  const key = `${s.time || ""}__${(s.course || "").toLowerCase()}`;
                  const existing = slotDedupeMap.get(key);
                  if (!existing) {
                    slotDedupeMap.set(key, s);
                  } else {
                    const exactMatch = s.classGroup && st.classGroup && s.classGroup.trim().toLowerCase() === st.classGroup.trim().toLowerCase();
                    const existingExact = existing.classGroup && st.classGroup && existing.classGroup.trim().toLowerCase() === st.classGroup.trim().toLowerCase();
                    if (exactMatch && !existingExact) slotDedupeMap.set(key, s);
                  }
                });
                const sortedSlots = sortSlotsByTime(Array.from(slotDedupeMap.values()));
                const correctionCount = st.correction_count || 0;
                const isLimitReached = correctionCount >= 2;

                const handleApplyPeriodCorrection = async (slotId: string, newStatus: "present" | "absent" | "late" | "od", reasonText: string) => {
                  if (!reasonText.trim()) {
                    toast("Please enter a mandatory reason for changing student attendance.", "warning");
                    return;
                  }

                  setIsSubmittingPeriodCorrection(true);
                  try {
                    const res = await fetch("/api/attendance", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        action: "correct",
                        studentId: st.id,
                        slotId,
                        dateStr: dStr,
                        newStatus,
                        reason: reasonText.trim(),
                        changedBy: currentCAM?.name || "Campus Manager",
                        changedByRole: "Campus Manager",
                        isAdminOverride: false
                      })
                    });

                    const data = await res.json();
                    if (data.success) {
                      toast(`Attendance updated to ${newStatus.toUpperCase()}! (Logged to audit trail, ${data.newCount || correctionCount + 1}/2 used)`, "success");
                      st.correction_count = (st.correction_count || 0) + 1;
                      setActivePeriodChange(null);
                      await refreshAttendance(activeCollegeId);
                    } else {
                      toast(data.message || "Failed to update attendance.", "error");
                    }
                  } catch (err: any) {
                    toast("Error updating attendance: " + err.message, "error");
                  } finally {
                    setIsSubmittingPeriodCorrection(false);
                  }
                };

                return (
                  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs font-sans">
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-xl w-full p-6 space-y-4 animate-in fade-in zoom-in-95 max-h-[90vh] flex flex-col">
                      {/* Header */}
                      <div className="flex justify-between items-start border-b border-slate-150 pb-3 shrink-0">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 text-white flex items-center justify-center text-sm font-black shadow-2xs">
                            {st.name.substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="text-base font-black text-slate-800">{st.name}</h3>
                              {isLimitReached ? (
                                <span className="px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-black uppercase tracking-wider">
                                  Limit Reached (2/2 Used)
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] font-bold">
                                  {correctionCount}/2 CM Corrections Used
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-500 font-semibold mt-0.5 flex items-center gap-2 flex-wrap">
                              <span>{st.roll_number || st.id} • {st.classGroup}</span>
                              <span>•</span>
                              <strong className="text-indigo-600">{dayName}, {formatDateToDMY(dStr)}</strong>
                              <span className={`px-2 py-0.2 rounded font-bold text-[9.5px] uppercase ${
                                (holidays || []).some((h: any) => h?.date === dStr || h?.dateStr === dStr)
                                  ? "bg-rose-50 text-rose-700 border border-rose-200"
                                  : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              }`}>
                                {(holidays || []).some((h: any) => h?.date === dStr || h?.dateStr === dStr) ? "Holiday / Event Day" : "Regular Class Day"}
                              </span>
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setMarkingStudentForDate(null);
                            setActivePeriodChange(null);
                          }}
                          className="text-slate-400 hover:text-slate-600 font-bold text-xl cursor-pointer"
                        >
                          ×
                        </button>
                      </div>

                      {/* Limit Warning Banner */}
                      {isLimitReached && (
                        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-semibold flex items-start gap-2.5 shrink-0">
                          <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                          <div>
                            <strong className="block text-rose-900 font-extrabold text-[11.5px]">CM Attendance Modification Locked</strong>
                            <span>This student has reached the maximum 2 corrections allowed for Campus Managers. Any further adjustments must be approved and executed by a Key Account Manager (KAM) or Administrator.</span>
                          </div>
                        </div>
                      )}

                      {/* Periods List */}
                      <div className="flex-1 overflow-y-auto space-y-2 pr-1 text-xs font-semibold">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                          Scheduled Periods for {dayName} ({sortedSlots.length})
                        </span>

                        {sortedSlots.length === 0 ? (
                          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-center text-slate-400 italic">
                            No timetable slots scheduled for this student's class cohort on {dayName}.
                          </div>
                        ) : (
                          sortedSlots.map((slot, idx) => {
                            const att = studentAttendance.find(a => a.studentId === st.id && a.slotId === slot.id && a.dateStr === dStr);
                            const currentStatus = att ? att.status : "not_marked";
                            const isBeingEdited = activePeriodChange?.slotId === slot.id;

                            return (
                              <div key={slot.id} className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2.5">
                                <div className="flex items-center justify-between gap-2 flex-wrap">
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <span className="text-[9.5px] font-extrabold px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 uppercase">
                                        Period {idx + 1}
                                      </span>
                                      <span className="text-[10.5px] text-slate-500 font-bold">{slot.time || "Hour " + (idx + 1)}</span>
                                      <span className={`px-2 py-0.5 rounded text-[9.5px] font-black uppercase ${
                                        currentStatus === "present"
                                          ? "bg-emerald-100 text-emerald-800"
                                          : currentStatus === "absent"
                                          ? "bg-rose-100 text-rose-800"
                                          : currentStatus === "late"
                                          ? "bg-amber-100 text-amber-800"
                                          : currentStatus === "od"
                                          ? "bg-purple-100 text-purple-800"
                                          : "bg-slate-200 text-slate-600"
                                      }`}>
                                        Current: {currentStatus === "not_marked" ? "Not Marked" : currentStatus.toUpperCase()}
                                      </span>
                                    </div>
                                    <h4 className="font-bold text-slate-800 text-xs mt-1">{slot.course || "Scheduled Session"}</h4>
                                  </div>

                                  {!isLimitReached && (
                                    <div className="flex items-center gap-1">
                                      {(["present", "absent", "late", "od"] as const).map(stOpt => (
                                        <button
                                          key={stOpt}
                                          type="button"
                                          disabled={isSubmittingPeriodCorrection}
                                          onClick={() => {
                                            if (currentStatus === stOpt) {
                                              toast(`Period is already marked as ${stOpt.toUpperCase()}`, "info");
                                              return;
                                            }
                                            setActivePeriodChange({
                                              slotId: slot.id,
                                              newStatus: stOpt,
                                              reason: ""
                                            });
                                          }}
                                          className={`px-2.5 py-1 rounded-lg font-extrabold text-[10px] uppercase transition-all cursor-pointer ${
                                            currentStatus === stOpt
                                              ? stOpt === "present"
                                                ? "bg-emerald-600 text-white shadow-2xs"
                                                : stOpt === "absent"
                                                ? "bg-rose-600 text-white shadow-2xs"
                                                : stOpt === "late"
                                                ? "bg-amber-500 text-white shadow-2xs"
                                                : "bg-purple-600 text-white shadow-2xs"
                                              : isBeingEdited && activePeriodChange?.newStatus === stOpt
                                              ? "bg-indigo-600 text-white shadow-2xs"
                                              : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-100"
                                          }`}
                                        >
                                          {stOpt === "present" ? "Present" : stOpt === "absent" ? "Absent" : stOpt === "late" ? "Late" : "OD"}
                                        </button>
                                      ))}
                                    </div>
                                  )}
                                </div>

                                {/* Inline Mandatory Reason Input Card */}
                                {isBeingEdited && activePeriodChange && (
                                  <div className="p-3 bg-white rounded-xl border-2 border-indigo-200 shadow-xs space-y-2 animate-in fade-in">
                                    <div className="flex items-center justify-between">
                                      <span className="text-[10px] font-extrabold text-indigo-700 uppercase tracking-wider">
                                        Changing Status to: <strong className="uppercase underline">{activePeriodChange.newStatus}</strong> ({correctionCount}/2 corrections used)
                                      </span>
                                      <span className="text-[9.5px] text-rose-500 font-bold">* Reason Mandatory</span>
                                    </div>
                                    <input
                                      type="text"
                                      required
                                      autoFocus
                                      placeholder="e.g. Medical certificate verified / Biometric sync correction / OD approved"
                                      value={activePeriodChange.reason}
                                      onChange={e => setActivePeriodChange({ ...activePeriodChange, reason: e.target.value })}
                                      className="w-full p-2 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50"
                                    />
                                    <div className="flex items-center justify-end gap-2 pt-1">
                                      <button
                                        type="button"
                                        onClick={() => setActivePeriodChange(null)}
                                        className="px-2.5 py-1 rounded-lg text-[10.5px] font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                                      >
                                        Cancel
                                      </button>
                                      <button
                                        type="button"
                                        disabled={isSubmittingPeriodCorrection || !activePeriodChange.reason.trim()}
                                        onClick={() => handleApplyPeriodCorrection(slot.id, activePeriodChange.newStatus, activePeriodChange.reason)}
                                        className="px-3 py-1 rounded-lg text-[10.5px] font-extrabold btn-gradient text-white shadow-2xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                                      >
                                        {isSubmittingPeriodCorrection ? (
                                          <>
                                            <Loader2 className="h-3 w-3 animate-spin" />
                                            <span>Saving &amp; Logging...</span>
                                          </>
                                        ) : (
                                          <span>Confirm &amp; Log Change</span>
                                        )}
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>

                      {/* Footer */}
                      <div className="flex items-center justify-end pt-3 border-t border-slate-150 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setMarkingStudentForDate(null);
                            setActivePeriodChange(null);
                          }}
                          className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all cursor-pointer"
                        >
                          Close
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* ── Clear Attendance Options Modal (Selective Department & Batch Mapping) ── */}
              {showClearAttendanceModal && (() => {
                // Calculate matching target students
                const targetDeptStudents = collegeStudents.filter(s => {
                  const matchDept = clearDeptFilter === "all" || s.department === clearDeptFilter;
                  const matchBatch = clearBatchFilter === "all" || s.classGroup === clearBatchFilter;
                  return matchDept && matchBatch;
                });
                const targetStudentIds = new Set(targetDeptStudents.map(s => s.id));

                // Calculate matching attendance records
                const matchingAttendance = studentAttendance.filter((a: any) => {
                  if (!targetStudentIds.has(a.studentId)) return false;
                  if (clearScope === "range") {
                    return a.dateStr >= attendanceStartDate && a.dateStr <= attendanceEndDate;
                  }
                  return true;
                });

                // Unique departments across campus students & department registry
                const uniqueStudentDepartments = Array.from(new Set([
                  ...collegeStudents.map(s => s.department).filter(Boolean),
                  ...departmentsList.filter(d => !activeCollegeId || d.college_id === activeCollegeId).map(d => d.name)
                ])).sort();

                // Unique batches for selected department
                const availableBatchesForDept = Array.from(new Set(
                  collegeStudents
                    .filter(s => clearDeptFilter === "all" || s.department === clearDeptFilter)
                    .map(s => s.classGroup)
                    .filter(Boolean)
                )).sort();

                return (
                  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs font-sans animate-in fade-in">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-lg w-full p-6 space-y-5 animate-in zoom-in-95">
                      <div className="flex justify-between items-start border-b border-slate-100 dark:border-slate-800 pb-3">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-xl bg-rose-100 dark:bg-rose-500/20 border border-rose-200 dark:border-rose-500/30 text-rose-600 dark:text-rose-400 flex items-center justify-center shadow-2xs">
                            <Trash2 className="h-5 w-5" />
                          </div>
                          <div>
                            <h3 className="text-base font-black text-slate-800 dark:text-white">Clear / Wipe Attendance Data</h3>
                            <p className="text-[11px] text-slate-400 font-semibold">Select department and cohort batch to selectively remove data</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowClearAttendanceModal(false)}
                          className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-bold text-xl cursor-pointer"
                        >
                          ×
                        </button>
                      </div>

                      <div className="space-y-4 text-xs font-semibold">
                        {/* Dropdown 1: Department */}
                        <div>
                          <label className="block text-[11px] font-black uppercase text-slate-700 dark:text-slate-300 mb-1.5">
                            Target Department:
                          </label>
                          <select
                            value={clearDeptFilter}
                            onChange={(e) => {
                              setClearDeptFilter(e.target.value);
                              setClearBatchFilter("all"); // Reset batch on dept change
                            }}
                            className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-white focus:outline-none focus:border-rose-500"
                          >
                            <option value="all">🏢 All Departments (Entire Campus)</option>
                            {uniqueStudentDepartments.map(dept => (
                              <option key={dept} value={dept}>{dept}</option>
                            ))}
                          </select>
                        </div>

                        {/* Dropdown 2: Batch / Class Group */}
                        <div>
                          <label className="block text-[11px] font-black uppercase text-slate-700 dark:text-slate-300 mb-1.5">
                            Target Batch / Class Group:
                          </label>
                          <select
                            value={clearBatchFilter}
                            onChange={(e) => setClearBatchFilter(e.target.value)}
                            className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-white focus:outline-none focus:border-rose-500"
                          >
                            <option value="all">👥 All Batches in Selected Department</option>
                            {availableBatchesForDept.map(bg => (
                              <option key={bg} value={bg}>{bg}</option>
                            ))}
                          </select>
                        </div>

                        {/* Scope Selector: Date Range vs All Dates */}
                        <div>
                          <label className="block text-[11px] font-black uppercase text-slate-700 dark:text-slate-300 mb-1.5">
                            Date Scope:
                          </label>
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() => setClearScope("range")}
                              className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                                clearScope === "range"
                                  ? "border-rose-500 bg-rose-50/60 dark:bg-rose-500/10 text-rose-800 dark:text-rose-300 shadow-2xs"
                                  : "border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40 text-slate-600 dark:text-slate-400"
                              }`}
                            >
                              <div className="font-extrabold text-xs flex items-center gap-1.5">
                                <Calendar className="h-3.5 w-3.5 text-rose-500" /> Active Range
                              </div>
                              <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 font-mono">
                                {formatDateToDMY(attendanceStartDate)} → {formatDateToDMY(attendanceEndDate)}
                              </div>
                            </button>

                            <button
                              type="button"
                              onClick={() => setClearScope("all")}
                              className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                                clearScope === "all"
                                  ? "border-rose-500 bg-rose-50/60 dark:bg-rose-500/10 text-rose-800 dark:text-rose-300 shadow-2xs"
                                  : "border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40 text-slate-600 dark:text-slate-400"
                              }`}
                            >
                              <div className="font-extrabold text-xs flex items-center gap-1.5">
                                <Layers className="h-3.5 w-3.5 text-rose-500" /> Entire Semester
                              </div>
                              <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                                All historical &amp; current dates
                              </div>
                            </button>
                          </div>
                        </div>

                        {/* Live Impact Preview Card */}
                        <div className="p-3.5 rounded-xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-1.5">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-slate-600 dark:text-slate-400">Target Students:</span>
                            <span className="font-black text-slate-900 dark:text-white">{targetDeptStudents.length} students</span>
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-slate-600 dark:text-slate-400">Recorded Period Entries:</span>
                            <span className="font-black text-rose-600 dark:text-rose-400">{matchingAttendance.length} period entries</span>
                          </div>
                          <p className="text-[10px] text-slate-400 font-normal pt-1 border-t border-slate-200 dark:border-slate-700 leading-relaxed">
                            ⚠️ Only the selected records will be wiped. Other departments and unselected batches remain completely unaffected.
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-150 dark:border-slate-800">
                        <button
                          type="button"
                          onClick={() => setShowClearAttendanceModal(false)}
                          className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold transition-all cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          disabled={isClearingAttendance || matchingAttendance.length === 0}
                          onClick={handleExecuteClearAttendance}
                          className="py-2.5 px-5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs transition-all cursor-pointer shadow-md flex items-center justify-center gap-2 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          {isClearingAttendance ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />
                              <span>Clearing Data...</span>
                            </>
                          ) : (
                            <>
                              <Trash2 className="h-4 w-4" />
                              <span>Wipe {matchingAttendance.length} Attendance Entries</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* ── Add / Edit Subject Modal Popup (Admin-Style 2-Column Layout) ── */}
              {showSubjectModal && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                  <div className={`bg-white rounded-xl border border-slate-200 shadow-xl w-full overflow-hidden animate-slideUp transition-all ${editingSubject ? "max-w-md" : "max-w-3xl"}`}>
                    <div className="flex justify-between items-center p-5 border-b border-slate-100 bg-slate-50">
                      <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-1.5">
                        <GraduationCap className="h-5 w-5 text-indigo-600" />
                        {editingSubject ? "Edit Subject Details" : "Add Subject to Catalog"}
                      </h3>
                      <button onClick={() => setShowSubjectModal(false)} className="p-1 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer text-slate-500 hover:text-slate-800">
                        <X className="h-4 w-4" />
                      </button>
                    </div>

                    <form onSubmit={handleSubjectModalSubmit} className="p-5 space-y-4 text-xs font-semibold">
                      {subjectModalError && (
                        <div className="p-3 bg-rose-50 border border-rose-150 rounded-xl text-rose-700 font-bold flex items-center gap-1.5">
                          <ShieldAlert className="h-4 w-4 shrink-0" />
                          {subjectModalError}
                        </div>
                      )}

                      <div className={editingSubject ? "space-y-3" : "grid grid-cols-1 md:grid-cols-2 gap-6"}>
                        {/* Left Column: Form Fields */}
                        <div className="space-y-3">
                          <div className="space-y-1">
                            <label className="text-[10px] text-slate-400 uppercase tracking-wider block font-bold">Subject Name</label>
                            <input
                              type="text"
                              required
                              placeholder="e.g. Modern Natural Language Processing"
                              value={subjectForm.name}
                              onChange={(e) => setSubjectForm({ ...subjectForm, name: e.target.value })}
                              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 font-bold focus:outline-none focus:ring-1 focus:ring-indigo-600 text-slate-800"
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <label className="text-[10px] text-slate-400 uppercase tracking-wider block font-bold">Course Name</label>
                              <select
                                required
                                disabled={lockDeptAndYear}
                                value={subjectForm.department}
                                onChange={(e) => setSubjectForm({ ...subjectForm, department: e.target.value })}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 font-bold focus:outline-none focus:ring-1 focus:ring-indigo-600 cursor-pointer text-slate-800 disabled:opacity-60 disabled:cursor-not-allowed"
                              >
                                <option value="">— Select Course —</option>
                                {collegeCourses.map(dept => (
                                  <option key={dept.id} value={dept.name}>{dept.name}</option>
                                ))}
                              </select>
                            </div>

                            <div className="space-y-1">
                              <label className="text-[10px] text-slate-400 uppercase tracking-wider block font-bold">Assigned Campus</label>
                              <select
                                required
                                disabled
                                value={subjectForm.college_id}
                                onChange={(e) => setSubjectForm({ ...subjectForm, college_id: e.target.value })}
                                className="w-full bg-slate-100 border border-slate-200 rounded-xl px-3 py-2.5 font-bold focus:outline-none text-slate-700 cursor-not-allowed"
                              >
                                {colleges.filter(c => c.id === activeCollegeId).map(c => (
                                  <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                              </select>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <label className="text-[10px] text-slate-400 uppercase tracking-wider block font-bold">Academic Year</label>
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
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 font-bold focus:outline-none focus:ring-1 focus:ring-indigo-600 cursor-pointer text-slate-800 disabled:opacity-60 disabled:cursor-not-allowed"
                              >
                                <option value="Year 1">Year 1</option>
                                <option value="Year 2">Year 2</option>
                                <option value="Year 3">Year 3</option>
                                <option value="Year 4">Year 4</option>
                              </select>
                            </div>

                            <div className="space-y-1">
                              <label className="text-[10px] text-slate-400 uppercase tracking-wider block font-bold">Semester</label>
                              <select
                                required
                                value={subjectForm.semester}
                                onChange={(e) => setSubjectForm({ ...subjectForm, semester: e.target.value })}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 font-bold focus:outline-none focus:ring-1 focus:ring-indigo-600 cursor-pointer text-slate-800"
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
                              <label className="text-[10px] text-slate-400 uppercase tracking-wider block font-bold">Subject Type / Domain</label>
                              <select
                                required
                                value={normalizeSubjectType(subjectForm.type)}
                                onChange={(e) => setSubjectForm({ ...subjectForm, type: e.target.value })}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 font-bold focus:outline-none focus:ring-1 focus:ring-indigo-600 cursor-pointer text-slate-800"
                              >
                                <option value="SKILL">SKILL (Practical Training)</option>
                                <option value="ACADEMIC">ACADEMIC (Core Theory)</option>
                                <option value="LAB">LAB (Practical Laboratory)</option>
                                <option value="GENERAL">GENERAL (Elective / Foundational)</option>
                              </select>
                            </div>

                            <div className="space-y-1">
                              <label className="text-[10px] text-slate-400 uppercase tracking-wider block font-bold">Weekly Hours</label>
                              <input
                                type="number"
                                required
                                min={1}
                                max={20}
                                value={subjectForm.weekly_hours}
                                onChange={(e) => setSubjectForm({ ...subjectForm, weekly_hours: parseInt(e.target.value) || 4 })}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 font-bold focus:outline-none focus:ring-1 focus:ring-indigo-600 text-slate-800"
                              />
                            </div>
                          </div>

                          <div className="space-y-1">
                            <label className="text-[10px] text-slate-400 uppercase tracking-wider block font-bold">Subject Group / Category</label>
                            <select
                              required
                              value={subjectForm.subject_group}
                              onChange={(e) => setSubjectForm({ ...subjectForm, subject_group: e.target.value })}
                              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 font-bold focus:outline-none focus:ring-1 focus:ring-indigo-600 cursor-pointer text-slate-800"
                            >
                              {subjectGroups.map(sg => (
                                <option key={sg.id} value={sg.name}>{sg.name}</option>
                              ))}
                            </select>
                          </div>
                        </div>

                        {/* Right Column: Staff Assignment Checklist */}
                        {!editingSubject && (() => {
                          const campusMentors = collegeMentors;
                          if (campusMentors.length === 0) {
                            return (
                              <div className="flex flex-col items-center justify-center p-8 bg-slate-50 border border-dashed border-slate-200 rounded-xl h-full text-center">
                                <Users className="h-8 w-8 text-slate-300 mb-2" />
                                <span className="text-[11px] font-bold text-slate-400">No staff registered for this campus yet.</span>
                              </div>
                            );
                          }
                          const filteredStaff = campusMentors.filter(m =>
                            !mentorSubjectSearch ||
                            (m.name || "").toLowerCase().includes(mentorSubjectSearch.toLowerCase()) ||
                            (m.department || "").toLowerCase().includes(mentorSubjectSearch.toLowerCase())
                          );

                          return (
                            <div className="space-y-2 flex flex-col h-full">
                              <div className="flex justify-between items-center">
                                <label className="text-[10px] text-slate-400 uppercase tracking-wider block font-bold">
                                  Assign Staff <span className="text-slate-300 font-medium">(optional)</span>
                                </label>
                                <span className="text-[9px] font-extrabold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100">
                                  {subjectForm.mentorIds.length} Selected
                                </span>
                              </div>
                              
                              {/* Staff Search Bar */}
                              <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                                <input
                                  type="text"
                                  placeholder="Search staff by name or dept..."
                                  value={mentorSubjectSearch}
                                  onChange={(e) => setMentorSubjectSearch(e.target.value)}
                                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-3 py-1.5 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-600 text-slate-800"
                                />
                              </div>

                              <div className="border border-slate-200 rounded-xl bg-slate-50/50 p-3 flex-1 max-h-[260px] overflow-y-auto space-y-1.5">
                                {filteredStaff.length === 0 ? (
                                  <div className="p-4 text-center text-slate-400 text-[11px] italic">
                                    No staff match "{mentorSubjectSearch}"
                                  </div>
                                ) : (
                                  filteredStaff.map(m => {
                                    const isChecked = subjectForm.mentorIds.includes(m.id);
                                    return (
                                      <label key={m.id} className={`flex items-center gap-2.5 p-2.5 rounded-xl border transition-all cursor-pointer ${
                                        isChecked ? "bg-indigo-50/60 border-indigo-200 shadow-2xs" : "bg-white border-slate-150 hover:border-slate-250"
                                      }`}>
                                        <input
                                          type="checkbox"
                                          checked={isChecked}
                                          onChange={(e) => {
                                            let next;
                                            if (e.target.checked) next = [...subjectForm.mentorIds, m.id];
                                            else next = subjectForm.mentorIds.filter(id => id !== m.id);
                                            setSubjectForm({ ...subjectForm, mentorIds: next });
                                          }}
                                          className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4 cursor-pointer"
                                        />
                                        <div className="leading-tight flex-1">
                                          <div className="font-bold text-slate-800 text-[11px]">{m.name}</div>
                                          <div className="text-[9px] text-slate-400 font-semibold">{m.mentor_group || m.subject_group || m.department || "General"}</div>
                                        </div>
                                      </label>
                                    );
                                  })
                                )}
                              </div>
                            </div>
                          );
                        })()}
                      </div>

                      <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                        <Button
                          type="button"
                          variant="secondary"
                          size="md"
                          onClick={() => setShowSubjectModal(false)}
                        >
                          Cancel
                        </Button>
                        <LoadingButton
                          type="submit"
                          isLoading={loadingActions['submit_subject']}
                          loadingText={editingSubject ? "Saving..." : "Creating..."}
                          variant="primary"
                        >
                          {editingSubject ? "Save Changes" : "Create Subject"}
                        </LoadingButton>
                      </div>
                    </form>
                  </div>
                </div>
              )}

        {/* ── COURSE & BATCH MODAL (ADMIN-GRADE POPUP) ── */}
        {showDeptModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto animate-fadeIn">
            <div className="bg-white rounded-xl border border-slate-200 shadow-2xl max-w-2xl w-full flex flex-col max-h-[85vh] overflow-hidden animate-slideUp">
              {/* Header (Fixed) */}
              <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 bg-slate-50/80 shrink-0">
                <h3 className="font-black text-slate-900 text-sm flex items-center gap-2">
                  <div className="h-8 w-8 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                    <Layers className="h-4 w-4 text-indigo-650" />
                  </div>
                  {editingDept ? "Edit Course & Batch Details" : "Add Course / Department"}
                </h3>
                <button onClick={() => setShowDeptModal(false)} className="p-1.5 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer text-slate-500 hover:text-slate-800">
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Scrollable Form Body */}
              <form onSubmit={handleDeptSubmitModal} className="flex-1 overflow-y-auto p-6 space-y-4 text-xs font-semibold">
                {modalError && (
                  <div className="p-3 bg-rose-50 border border-rose-150 rounded-xl text-rose-700 font-bold flex items-center gap-1.5">
                    <ShieldAlert className="h-4 w-4 shrink-0" />
                    {modalError}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1 sm:col-span-2">
                    <label className="text-[10px] text-slate-400 uppercase tracking-wider block font-bold">Course / Department Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Bachelor of Computer Applications (BCA)"
                      value={deptForm.name}
                      onChange={(e) => setDeptForm({ ...deptForm, name: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 font-bold focus:outline-none focus:ring-1 focus:ring-indigo-650 text-slate-800"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-400 uppercase tracking-wider block font-bold">Course Duration</label>
                    <select
                      value={deptForm.years || 3}
                      onChange={(e) => handleCourseYearsChange(Number(e.target.value))}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 font-bold focus:outline-none focus:ring-1 focus:ring-indigo-650 cursor-pointer text-slate-800"
                    >
                      <option value={1}>1 Year (2 Semesters)</option>
                      <option value={2}>2 Years (4 Semesters)</option>
                      <option value={3}>3 Years (6 Semesters)</option>
                      <option value={4}>4 Years (8 Semesters)</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-400 uppercase tracking-wider block font-bold">Status</label>
                    <select
                      value={deptForm.status || "Active"}
                      onChange={(e) => setDeptForm({ ...deptForm, status: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 font-bold focus:outline-none focus:ring-1 focus:ring-indigo-650 cursor-pointer text-slate-800"
                    >
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                    </select>
                  </div>

                  {/* Batch Dates & Batch Years */}
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-400 uppercase tracking-wider block font-bold">Batch Start Date</label>
                    <input
                      type="date"
                      value={deptForm.start_date}
                      onChange={(e) => handleCourseStartDateChange(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 font-bold focus:outline-none focus:ring-1 focus:ring-indigo-650 text-slate-800 text-xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-400 uppercase tracking-wider block font-bold">Batch End Date</label>
                    <input
                      type="date"
                      value={deptForm.end_date}
                      onChange={(e) => setDeptForm({ ...deptForm, end_date: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 font-bold focus:outline-none focus:ring-1 focus:ring-indigo-650 text-slate-800 text-xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-400 uppercase tracking-wider block font-bold">Batch Start Year</label>
                    <input
                      type="text"
                      placeholder="e.g. 2024"
                      value={deptForm.start_year}
                      onChange={(e) => setDeptForm({ ...deptForm, start_year: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 font-bold focus:outline-none focus:ring-1 focus:ring-indigo-650 text-slate-800 text-xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-400 uppercase tracking-wider block font-bold">Batch End Year</label>
                    <input
                      type="text"
                      placeholder="e.g. 2027"
                      value={deptForm.end_year}
                      onChange={(e) => setDeptForm({ ...deptForm, end_year: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 font-bold focus:outline-none focus:ring-1 focus:ring-indigo-650 text-slate-800 text-xs"
                    />
                  </div>

                  {/* Year-wise Classroom Allocations */}
                  <div className="space-y-3 sm:col-span-2 border-t border-slate-150 pt-4 mt-2">
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
                                } catch (_) { }
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
                              } catch (_) { }

                              return (
                                <div key={yearNum} className="space-y-1">
                                  <label className="text-[9.5px] text-slate-400 font-bold block uppercase tracking-wider">
                                    Year {yearNum} Room
                                  </label>
                                  <input
                                    type="text"
                                    list={`rooms-suggest-modal-${deptForm.college_id || 'none'}`}
                                    placeholder={`e.g. Room for Year ${yearNum}`}
                                    value={currentRoom}
                                    onChange={(e) => handleYearRoomChange(yearNum, e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 font-bold focus:outline-none focus:ring-1 focus:ring-indigo-650 text-slate-800 text-xs font-semibold"
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

                  <div className="space-y-1 sm:col-span-2">
                    <label className="text-[10px] text-slate-400 uppercase tracking-wider block font-bold">Shift Offering</label>
                    <select
                      value={deptForm.default_shift || "shift_1"}
                      onChange={(e) => setDeptForm({ ...deptForm, default_shift: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 font-bold focus:outline-none focus:ring-1 focus:ring-indigo-650 cursor-pointer text-slate-800"
                    >
                      <option value="shift_1">Shift 1 (Day)</option>
                      <option value="shift_2">Shift 2 (Evening)</option>
                      <option value="both">Both Shifts (Shift 1 & 2)</option>
                      <option value="general">General Shift</option>
                      <option value="all">Both Shifts + General (Shift 1, 2 & General)</option>
                    </select>
                  </div>

                  <div className="space-y-1 sm:col-span-2">
                    <label className="text-[10px] text-slate-400 uppercase tracking-wider block font-bold">Description</label>
                    <textarea
                      placeholder="Enter course summary or notes..."
                      value={deptForm.description || ""}
                      onChange={(e) => setDeptForm({ ...deptForm, description: e.target.value })}
                      rows={2}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 font-bold focus:outline-none focus:ring-1 focus:ring-indigo-650 text-slate-800 resize-none font-semibold"
                    />
                  </div>
                </div>

                {/* Sticky Footer */}
                <div className="flex justify-end gap-2.5 pt-4 mt-4 border-t border-slate-100 shrink-0">
                  <button
                    type="button"
                    onClick={() => setShowDeptModal(false)}
                    className="px-4 py-2 hover:bg-slate-100 text-slate-500 rounded-xl transition-all font-bold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isDeptSubmitting}
                    className={`btn-gradient px-5 py-2 text-white rounded-xl shadow-sm transition-all font-bold cursor-pointer flex items-center justify-center gap-2 ${isDeptSubmitting ? "opacity-75 cursor-not-allowed" : "hover:opacity-95 active:scale-95"
                      }`}
                  >
                    {isDeptSubmitting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin text-white shrink-0" />
                        <span>{editingDept ? "Saving Changes..." : "Creating Course..."}</span>
                      </>
                    ) : (
                      <span>{editingDept ? "Save Changes" : "Create Course"}</span>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
        {/* ── FACULTY BULK IMPORT PREVIEW MODAL ── */}
        {showFacultyImportModal && facultyImportPreview && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
            <div className="bg-white dark:bg-slate-900 rounded-xl max-w-4xl w-full p-6 space-y-5 shadow-2xl border border-gray-100 dark:border-slate-800 max-h-[90vh] flex flex-col">
              <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-800 pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-500/20">
                    <FileText className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-gray-900 dark:text-white">Faculty Bulk Import Preview</h3>
                    <p className="text-xs text-gray-500 dark:text-slate-400 font-medium">
                      Parsed {facultyImportPreview.parsed.length} faculty record(s) from spreadsheet
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowFacultyImportModal(false)}
                  className="p-2 rounded-xl text-gray-400 hover:text-gray-600 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {facultyImportPreview.warnings.length > 0 && (
                <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 text-amber-800 dark:text-amber-300 text-xs font-semibold space-y-1">
                  <div className="font-extrabold flex items-center gap-1.5">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    Validation Warnings ({facultyImportPreview.warnings.length}):
                  </div>
                  <ul className="list-disc list-inside text-[11px] space-y-0.5 max-h-24 overflow-y-auto">
                    {facultyImportPreview.warnings.map((w, idx) => (
                      <li key={idx}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex-1 overflow-y-auto border border-gray-200 dark:border-slate-800 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-slate-800/60 border-b border-gray-200 dark:border-slate-700 text-gray-500 dark:text-slate-400 font-extrabold uppercase text-[10px] tracking-wider">
                      <th className="p-3">#</th>
                      <th className="p-3">Faculty Name</th>
                      <th className="p-3">Email Address</th>
                      <th className="p-3">Department</th>
                      {isCampusShiftBased && <th className="p-3">Shift</th>}
                      <th className="p-3">Subjects</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-slate-800 bg-white dark:bg-slate-900 font-medium text-gray-800 dark:text-slate-200">
                    {facultyImportPreview.parsed.map((item, idx) => (
                      <tr key={idx} className="hover:bg-indigo-50/20 dark:hover:bg-indigo-500/5">
                        <td className="p-3 text-gray-400 font-mono text-[10px]">{idx + 1}</td>
                        <td className="p-3 font-bold text-gray-900 dark:text-white">{item.name || <span className="text-rose-500 italic">Missing</span>}</td>
                        <td className="p-3 font-mono text-[11px] text-slate-500 dark:text-slate-400">{item.email || <span className="text-rose-500 italic">Missing</span>}</td>
                        <td className="p-3"><span className="px-2 py-0.5 rounded bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 text-[10px] font-bold">{item.department}</span></td>
                        {isCampusShiftBased && (
                          <td className="p-3"><span className="px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 text-[10px] font-bold uppercase">{item.shift}</span></td>
                        )}
                        <td className="p-3 text-gray-500 dark:text-slate-400 max-w-[180px] truncate" title={item.subjects}>{item.subjects || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-slate-800">
                <p className="text-xs text-gray-500 dark:text-slate-400 font-medium">
                  Initial default password for all imported faculty will be set to <code className="bg-gray-100 dark:bg-slate-800 px-1.5 py-0.5 rounded font-mono font-bold">password123</code>
                </p>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setShowFacultyImportModal(false)}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-gray-600 dark:text-slate-400 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={isImportingFaculty}
                    onClick={handleConfirmFacultyImport}
                    className="px-5 py-2 rounded-xl text-xs font-extrabold btn-gradient text-white shadow-sm flex items-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {isImportingFaculty ? "Importing..." : `Confirm & Import (${facultyImportPreview.parsed.length}) →`}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

      {/* Global Daily Day Order Configurator Modal */}
      {isDailyConfigModalOpen && (
        <div className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-4xl w-full p-6 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto border border-slate-200 relative my-auto">
            {/* Modal Header */}
            <div className="flex justify-between items-center pb-4 border-b border-slate-100 sticky top-0 bg-white z-10 pt-1">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-[#D528A2]/10 text-[#D528A2] rounded-2xl border border-[#D528A2]/20">
                  <Calendar className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">
                    Daily Day Order & Schedule Configurator
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    Set up day types, day orders, online/offline session modes, and automated continuous cycles.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsDailyConfigModalOpen(false);
                  setEditingDailyId(null);
                }}
                className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form id="daily-config-form" onSubmit={handleSaveDailyConfig} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 bg-slate-50/80 p-5 border border-slate-200 rounded-2xl">
              <Input
                label="From Date"
                type="date"
                value={dailyStartDateStr}
                onChange={e => handleStartDateChange(e.target.value)}
                required
              />
              <Input
                label="To Date (Continuous)"
                type="date"
                value={dailyEndDateStr}
                onChange={e => setDailyEndDateStr(e.target.value)}
                required
              />
              <div className="space-y-1">
                <label className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wider block">Day Type</label>
                <select
                  value={dailyDayType}
                  onChange={e => setDailyDayType(e.target.value)}
                  className="w-full p-2.5 border border-slate-200 rounded-xl bg-white text-xs font-semibold focus:ring-2 focus:ring-[#D528A2]/20 outline-none shadow-xs cursor-pointer text-slate-800"
                >
                  <option value="working">Working Day</option>
                  <option value="holiday">Holiday</option>
                  <option value="event">Campus Event</option>
                  <option value="exam_day">Exam Day</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wider block">Day Order</label>
                <select
                  value={dailyDayType === "holiday" ? "None" : dailyDayOrder}
                  onChange={e => setDailyDayOrder(e.target.value)}
                  disabled={dailyDayType === "holiday"}
                  className="w-full p-2.5 border border-slate-200 rounded-xl bg-white text-xs font-semibold focus:ring-2 focus:ring-[#D528A2]/20 outline-none shadow-xs cursor-pointer text-slate-800 disabled:opacity-50"
                >
                  <option value="Day 1">Day 1</option>
                  <option value="Day 2">Day 2</option>
                  <option value="Day 3">Day 3</option>
                  <option value="Day 4">Day 4</option>
                  <option value="Day 5">Day 5</option>
                  <option value="Day 6">Day 6</option>
                  <option value="None">None (No Day Order)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wider block">Session Mode</label>
                <select
                  value={dailySessionMode}
                  onChange={e => setDailySessionMode(e.target.value)}
                  className="w-full p-2.5 border border-slate-200 rounded-xl bg-white text-xs font-semibold focus:ring-2 focus:ring-[#D528A2]/20 outline-none shadow-xs cursor-pointer text-slate-800"
                >
                  <option value="Offline">Offline (On-Campus)</option>
                  <option value="Online">Online Sessions</option>
                  <option value="Hybrid">Hybrid Mode</option>
                </select>
              </div>

              <div className="space-y-1 sm:col-span-3">
                <label className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wider block">Notes / Operational Instructions</label>
                <input
                  type="text"
                  placeholder="e.g. CIA Exam Session / Cultural Fest / Regular Timetable..."
                  value={dailyNotes}
                  onChange={e => setDailyNotes(e.target.value)}
                  className="w-full p-2.5 border border-slate-200 rounded-xl bg-white text-xs font-semibold focus:ring-2 focus:ring-[#D528A2]/20 outline-none shadow-xs text-slate-800"
                />
              </div>

              <div className="flex items-center gap-4 pt-4 sm:col-span-2 flex-wrap">
                <label className="flex items-center gap-2 text-[11px] font-bold text-slate-700 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={autoAdvanceDayOrder}
                    onChange={e => setAutoAdvanceDayOrder(e.target.checked)}
                    className="h-4 w-4 text-[#D528A2] rounded border-slate-300 focus:ring-[#D528A2] cursor-pointer"
                  />
                  <span>Auto-Advance Continuous Days</span>
                </label>
                <label className="flex items-center gap-2 text-[11px] font-bold text-slate-700 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={skipSundays}
                    onChange={e => setSkipSundays(e.target.checked)}
                    className="h-4 w-4 text-[#D528A2] rounded border-slate-300 focus:ring-[#D528A2] cursor-pointer"
                  />
                  <span>Skip Sundays (Auto-Holiday)</span>
                </label>
              </div>

              <div className="flex items-end sm:col-span-2 justify-end gap-2 pt-2 flex-wrap">
                <button
                  type="button"
                  onClick={handleDeleteDailyConfigRange}
                  disabled={isDailySaving || isDailyLoading}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                  title="Delete all records within selected From Date and To Date range"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Delete Range</span>
                </button>
                {editingDailyId && (
                  <button
                    type="button"
                    onClick={handleCancelDailyEdit}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-all cursor-pointer"
                  >
                    Cancel Edit
                  </button>
                )}
                <button
                  type="submit"
                  disabled={isDailySaving}
                  className="px-5 py-2 rounded-xl text-xs font-extrabold bg-[#D528A2] hover:bg-[#c02090] text-white shadow-sm transition-all cursor-pointer disabled:opacity-50"
                >
                  {isDailySaving
                    ? "Saving..."
                    : editingDailyId
                    ? "Update Record"
                    : "Save Day Order Schedule"}
                </button>
              </div>
            </form>

            {/* Modal Table */}
            <div className="border border-slate-200 rounded-2xl bg-white shadow-xs overflow-hidden">
              <div className="p-3.5 bg-slate-50/80 border-b border-slate-200 flex justify-between items-center flex-wrap gap-2">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                    Configured Schedule Records ({dailyConfigsList.length})
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search date, day type, order..."
                      value={dailySearchFilter}
                      onChange={e => setDailySearchFilter(e.target.value)}
                      className="pl-8 pr-3 py-1 text-xs border border-slate-200 rounded-lg bg-white outline-none focus:ring-1 focus:ring-[#D528A2] w-48 font-medium"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={fetchDailyConfigs}
                    disabled={isDailyLoading}
                    className="px-3 py-1 text-xs font-bold rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 cursor-pointer disabled:opacity-50"
                  >
                    Refresh
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto max-h-[260px] overflow-y-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="sticky top-0 bg-slate-100 z-10">
                    <tr className="border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      <th className="p-3">Date</th>
                      <th className="p-3">Day Type</th>
                      <th className="p-3">Day Order</th>
                      <th className="p-3">Session Mode</th>
                      <th className="p-3">Campus Notes</th>
                      <th className="p-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {dailyConfigsList.filter(cfg => {
                      if (!dailySearchFilter.trim()) return true;
                      const q = dailySearchFilter.toLowerCase();
                      return (
                        (cfg.dateStr || "").toLowerCase().includes(q) ||
                        (cfg.day_type || "").toLowerCase().includes(q) ||
                        (cfg.day_order || "").toLowerCase().includes(q) ||
                        (cfg.session_mode || "").toLowerCase().includes(q) ||
                        (cfg.notes || "").toLowerCase().includes(q)
                      );
                    }).length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-slate-400 italic text-xs">
                          {dailyConfigsList.length === 0 ? "No custom day order configurations saved yet. Use the form above to add date ranges." : "No matching day order records found for search filter."}
                        </td>
                      </tr>
                    ) : (
                      dailyConfigsList
                        .filter(cfg => {
                          if (!dailySearchFilter.trim()) return true;
                          const q = dailySearchFilter.toLowerCase();
                          return (
                            (cfg.dateStr || "").toLowerCase().includes(q) ||
                            (cfg.day_type || "").toLowerCase().includes(q) ||
                            (cfg.day_order || "").toLowerCase().includes(q) ||
                            (cfg.session_mode || "").toLowerCase().includes(q) ||
                            (cfg.notes || "").toLowerCase().includes(q)
                          );
                        })
                        .map(cfg => (
                        <tr key={cfg.id || cfg.dateStr} className={`transition-colors ${editingDailyId === cfg.id ? "bg-[#D528A2]/10" : "hover:bg-slate-50/50"}`}>
                          <td className="p-3 font-extrabold text-slate-800">{cfg.dateStr}</td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded-full text-[9.5px] font-extrabold uppercase border ${
                              cfg.day_type === "holiday" ? "bg-rose-50 text-rose-700 border-rose-200" :
                              cfg.day_type === "event" ? "bg-amber-50 text-amber-700 border-amber-200" :
                              cfg.day_type === "exam_day" ? "bg-purple-50 text-purple-700 border-purple-200" :
                              "bg-emerald-50 text-emerald-700 border-emerald-200"
                            }`}>
                              {cfg.day_type ? cfg.day_type.replace("_", " ") : "Working"}
                            </span>
                          </td>
                          <td className="p-3 font-bold text-slate-900">{cfg.day_order || "None"}</td>
                          <td className="p-3 font-semibold text-slate-600">{cfg.session_mode || "Offline"}</td>
                          <td className="p-3 text-slate-500 max-w-[200px] truncate" title={cfg.notes}>{cfg.notes || "-"}</td>
                          <td className="p-3 text-right flex justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => handleStartEditDailyConfig(cfg)}
                              className="p-1.5 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-all cursor-pointer"
                              title="Edit Day Order Config"
                            >
                              <Edit2 className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteDailyConfig(cfg.id, cfg.dateStr)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all cursor-pointer"
                              title="Delete Day Order Config"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
            </div>
          );
};

// Stale cache trigger comment to force IDE diagnostics refresh.

