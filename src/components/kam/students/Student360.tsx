"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  User,
  GraduationCap,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  Clock,
  BookOpen,
  Award,
  Layers,
  Sparkles,
  TrendingUp,
  Download,
  FileSpreadsheet
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid
} from "recharts";

interface Student360Props {
  studentId: string;
  onClose: () => void;
}

export const Student360: React.FC<Student360Props> = ({ studentId, onClose }) => {
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "subjects" | "timeline" | "attendance">("overview");

  useEffect(() => {
    let isMounted = true;
    async function fetchStudent360() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/kam/students/${encodeURIComponent(studentId)}/progress`);
        const json = await res.json();
        if (json.success && isMounted) {
          setData(json);
        } else if (isMounted) {
          setError(json.message || "Failed to load student progress data");
        }
      } catch (err: any) {
        if (isMounted) setError(err.message);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    fetchStudent360();
    return () => { isMounted = false; };
  }, [studentId]);

  // Close on Escape Key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // Export 360° Comprehensive Dossier to Excel
  const handleExportExcel = async () => {
    if (!data) return;
    try {
      const XLSX = await import("xlsx");
      const { student, subjectAnalytics, timeline, dailyAttendance } = data;
      const stats = student.stats;

      const wb = XLSX.utils.book_new();

      // Sheet 1: Student Overview & Metrics
      const overviewHeaders = ["Field", "Value"];
      const overviewRows = [
        ["Student Name", student.name],
        ["Roll Number", student.rollNumber],
        ["Register Number", student.registerNumber],
        ["Email", student.email || "—"],
        ["Phone", student.phone || "—"],
        ["Department", student.department || "General"],
        ["Batch / Cohort", student.classGroup || "General Batch"],
        ["Semester", student.semester || "—"],
        ["Institution", student.collegeName || "—"],
        ["Compliance Risk Tier", stats.risk],
        ["Overall Attendance %", `${stats.overallAttendancePct}%`],
        ["Total Conducted Periods", stats.totalPeriods],
        ["Present Periods (incl. OD)", stats.presentPeriods],
        ["Absent Periods", stats.absentPeriods],
        ["On Duty (OD) Periods", stats.odPeriods],
        ["Evaluated Interviews", stats.interviewsCount]
      ];
      const wsOverview = XLSX.utils.aoa_to_sheet([overviewHeaders, ...overviewRows]);
      wsOverview["!cols"] = [{ wch: 25 }, { wch: 45 }];
      XLSX.utils.book_append_sheet(wb, wsOverview, "Student Profile");

      // Sheet 2: Subject-Wise Breakdown
      const subjectHeaders = ["Subject Name", "Total Periods", "Present", "Absent", "OD", "Attendance %"];
      const subjectRows = (subjectAnalytics || []).map((s: any) => [
        s.subject,
        s.totalPeriods,
        s.presentPeriods,
        s.absentPeriods,
        s.odPeriods,
        `${s.attendancePct}%`
      ]);
      const wsSubjects = XLSX.utils.aoa_to_sheet([subjectHeaders, ...subjectRows]);
      wsSubjects["!cols"] = [{ wch: 35 }, { wch: 15 }, { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 15 }];
      XLSX.utils.book_append_sheet(wb, wsSubjects, "Subject Breakdown");

      // Sheet 3: Recent Attendance Logs
      const attHeaders = ["Date", "Day", "Time Slot", "Subject", "Status", "Room", "Marked By"];
      const attRows = (dailyAttendance || []).map((r: any) => [
        r.dateStr,
        r.day || "—",
        r.time || "—",
        r.subject || "Class",
        (r.status || "").toUpperCase(),
        r.location || "—",
        r.markedBy || "Faculty"
      ]);
      const wsAtt = XLSX.utils.aoa_to_sheet([attHeaders, ...attRows]);
      wsAtt["!cols"] = [{ wch: 14 }, { wch: 12 }, { wch: 16 }, { wch: 30 }, { wch: 12 }, { wch: 14 }, { wch: 18 }];
      XLSX.utils.book_append_sheet(wb, wsAtt, "Attendance Logs");

      // Sheet 4: Activity Timeline
      if (timeline && timeline.length > 0) {
        const timelineHeaders = ["Date", "Activity Type", "Title", "Status", "Details"];
        const timelineRows = timeline.map((t: any) => [
          t.date,
          t.type,
          t.title,
          t.status || "—",
          t.desc
        ]);
        const wsTimeline = XLSX.utils.aoa_to_sheet([timelineHeaders, ...timelineRows]);
        wsTimeline["!cols"] = [{ wch: 14 }, { wch: 16 }, { wch: 30 }, { wch: 14 }, { wch: 45 }];
        XLSX.utils.book_append_sheet(wb, wsTimeline, "Activity Timeline");
      }

      const safeName = student.name.replace(/[^a-zA-Z0-9]/g, "_");
      XLSX.writeFile(wb, `${safeName}_360_Progress_Report.xlsx`);
    } catch (err: any) {
      console.error("Export failed:", err);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in">
        <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl text-center space-y-3 border border-slate-100">
          <div className="h-10 w-10 border-3 border-[#D528A2] border-t-transparent rounded-full animate-spin mx-auto" />
          <h3 className="text-sm font-black text-slate-900">Loading Student 360° Profile</h3>
          <p className="text-[11px] font-bold text-slate-400">Fetching attendance logs and trajectory…</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
        <div className="bg-white rounded-2xl p-5 max-w-sm w-full shadow-2xl text-center space-y-3 border border-slate-100">
          <AlertTriangle className="h-8 w-8 text-rose-500 mx-auto" />
          <h3 className="text-sm font-black text-slate-900">Error Loading Student Profile</h3>
          <p className="text-xs font-medium text-slate-500">{error || "Student not found"}</p>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  const { student, subjectAnalytics, progressTrend, timeline, dailyAttendance } = data;
  const stats = student.stats;

  // Clean deduplicated subtitle
  const subtitleParts = [
    student.department,
    student.classGroup && student.classGroup !== student.department ? student.classGroup : null,
    student.semester,
    student.collegeName
  ].filter(Boolean);

  const cleanSubtitle = subtitleParts.join(" • ");

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 animate-in fade-in duration-150 overflow-y-auto"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl max-w-3xl w-full shadow-2xl border border-slate-200 overflow-hidden my-auto max-h-[92vh] flex flex-col animate-in zoom-in-95 duration-150"
      >
        {/* Compact Header Card with FacePrep Brand Gradient */}
        <div className="bg-gradient-to-r from-[#D528A2] via-pink-600 to-indigo-700 p-4 text-white relative shrink-0">
          <div className="absolute top-3.5 right-3.5 flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleExportExcel}
              title="Export 360° Excel Report"
              className="h-7 px-2.5 rounded-lg bg-white/20 hover:bg-white/30 text-white flex items-center gap-1 text-[10px] font-extrabold transition-all cursor-pointer shadow-2xs"
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
              <span>Export</span>
            </button>
            <button
              onClick={onClose}
              className="h-7 w-7 rounded-lg bg-white/20 hover:bg-white/30 text-white flex items-center justify-center transition-all cursor-pointer shadow-2xs"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="flex items-center gap-3 pr-24">
            <div className="h-11 w-11 rounded-xl bg-white/20 border border-white/30 backdrop-blur-md flex items-center justify-center text-white font-black text-lg shrink-0 shadow-inner">
              <User className="h-5.5 w-5.5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-black tracking-tight truncate">{student.name}</h2>
                <span className={`px-2 py-0.2 rounded-full text-[9px] font-black uppercase tracking-wider backdrop-blur-md ${
                  stats.risk === "HEALTHY"
                    ? "bg-emerald-500/30 text-emerald-100 border border-emerald-400/40"
                    : stats.risk === "AT RISK"
                    ? "bg-amber-500/30 text-amber-100 border border-amber-400/40"
                    : "bg-rose-500/30 text-rose-100 border border-rose-400/40"
                }`}>
                  {stats.risk}
                </span>
              </div>
              <p className="text-[11px] font-bold text-pink-100">
                Roll: <span className="font-black text-white">{student.rollNumber}</span> • Reg: {student.registerNumber}
              </p>
              <p className="text-[10px] text-white/80 font-medium truncate mt-0.5 max-w-lg">
                {cleanSubtitle}
              </p>
            </div>
          </div>

          {/* Compact 4-Card KPI Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3 pt-3 border-t border-white/20 text-center">
            <div className="bg-white/15 backdrop-blur-md rounded-xl p-1.5 border border-white/20">
              <span className="text-[9px] font-black text-pink-100 uppercase tracking-wider block">Attendance</span>
              <p className="text-sm font-black text-emerald-300">{stats.overallAttendancePct}%</p>
            </div>
            <div className="bg-white/15 backdrop-blur-md rounded-xl p-1.5 border border-white/20">
              <span className="text-[9px] font-black text-pink-100 uppercase tracking-wider block">Present / Total</span>
              <p className="text-sm font-black text-white">{stats.presentPeriods} / {stats.totalPeriods}</p>
            </div>
            <div className="bg-white/15 backdrop-blur-md rounded-xl p-1.5 border border-white/20">
              <span className="text-[9px] font-black text-pink-100 uppercase tracking-wider block">Interviews</span>
              <p className="text-sm font-black text-white">{stats.interviewsCount} Evaluated</p>
            </div>
            <div className="bg-white/15 backdrop-blur-md rounded-xl p-1.5 border border-white/20">
              <span className="text-[9px] font-black text-pink-100 uppercase tracking-wider block">Absences</span>
              <p className="text-sm font-black text-rose-200">{stats.absentPeriods}</p>
            </div>
          </div>
        </div>

        {/* Compact Navigation Tabs */}
        <div className="flex border-b border-slate-200 bg-slate-50/90 px-4 gap-1 shrink-0">
          {[
            { key: "overview", label: "Progress & Analytics", icon: Award },
            { key: "subjects", label: "Subject Breakdown", icon: BookOpen },
            { key: "timeline", label: "Timeline", icon: Clock },
            { key: "attendance", label: "Attendance Logs", icon: Calendar }
          ].map(t => {
            const Icon = t.icon;
            const isActive = activeTab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key as any)}
                className={`flex items-center gap-1.5 py-2 px-2.5 text-[11px] font-extrabold border-b-2 transition-all cursor-pointer ${
                  isActive
                    ? "border-[#D528A2] text-[#D528A2] bg-white font-black"
                    : "border-transparent text-slate-500 hover:text-slate-900"
                }`}
              >
                <Icon className={`h-3 w-3 ${isActive ? "text-[#D528A2]" : "text-slate-400"}`} />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Contents - Scrollable with Controlled Height */}
        <div className="p-4 overflow-y-auto space-y-4 flex-1">
          {/* 1. Overview Tab */}
          {activeTab === "overview" && (
            <div className="space-y-4">
              <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-[10px] font-black text-slate-800 uppercase tracking-wider">
                    Monthly Attendance Trajectory (%)
                  </h4>
                  <span className="text-[10px] font-black text-[#D528A2] bg-[#D528A2]/10 px-2 py-0.5 rounded">
                    Overall: {stats.overallAttendancePct}%
                  </span>
                </div>

                <div className="h-32 w-full">
                  {progressTrend && progressTrend.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={progressTrend} margin={{ top: 5, right: 10, left: -25, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorStudentAtt" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#D528A2" stopOpacity={0.35}/>
                            <stop offset="95%" stopColor="#D528A2" stopOpacity={0.0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis dataKey="month" tick={{ fontSize: 8, fontWeight: 700 }} tickLine={false} />
                        <YAxis domain={[0, 100]} tick={{ fontSize: 8 }} tickLine={false} tickFormatter={v => `${v}%`} />
                        <Tooltip formatter={(v: any) => [`${v}%`, "Attendance"]} />
                        <Area type="monotone" dataKey="attendancePct" stroke="#D528A2" strokeWidth={2.5} fillOpacity={1} fill="url(#colorStudentAtt)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-xs text-slate-400 font-bold text-center py-8">No historical attendance logs</p>
                  )}
                </div>
              </div>

              {/* Subject quick preview */}
              <div>
                <h4 className="text-[10px] font-black text-slate-800 uppercase tracking-wider mb-2">
                  Subject-Wise Performance Snapshot
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {subjectAnalytics.map((s: any) => (
                    <div key={s.subject} className="bg-slate-50 hover:bg-white rounded-xl p-2.5 border border-slate-200 shadow-2xs flex items-center justify-between transition-all">
                      <div className="min-w-0 pr-2">
                        <p className="text-[11px] font-black text-slate-900 truncate">{s.subject}</p>
                        <p className="text-[9px] text-slate-400 font-bold">
                          {s.presentPeriods} of {s.totalPeriods} periods marked
                        </p>
                      </div>
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-lg border shrink-0 ${
                        s.attendancePct >= 75
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : s.attendancePct >= 60
                          ? "bg-amber-50 text-amber-700 border-amber-200"
                          : "bg-rose-50 text-rose-700 border-rose-200"
                      }`}>
                        {s.attendancePct}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 2. Subject Breakdown Tab */}
          {activeTab === "subjects" && (
            <div className="space-y-3">
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-black uppercase text-[9px] tracking-wider">
                      <th className="py-2 px-3">Subject</th>
                      <th className="py-2 px-2 text-center">Total</th>
                      <th className="py-2 px-2 text-center text-emerald-700">Present</th>
                      <th className="py-2 px-2 text-center text-rose-700">Absent</th>
                      <th className="py-2 px-2 text-center text-purple-700">OD</th>
                      <th className="py-2 px-3 text-right text-[#D528A2]">%</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-semibold text-slate-700 bg-white text-[11px]">
                    {subjectAnalytics.map((s: any) => (
                      <tr key={s.subject} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-2 px-3 font-bold text-slate-900">{s.subject}</td>
                        <td className="py-2 px-2 text-center font-bold">{s.totalPeriods}</td>
                        <td className="py-2 px-2 text-center text-emerald-600 font-black">{s.presentPeriods}</td>
                        <td className="py-2 px-2 text-center text-rose-500 font-bold">{s.absentPeriods}</td>
                        <td className="py-2 px-2 text-center text-purple-600 font-bold">{s.odPeriods}</td>
                        <td className="py-2 px-3 text-right font-black text-[#D528A2]">{s.attendancePct}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 3. Activity Timeline Tab */}
          {activeTab === "timeline" && (
            <div className="space-y-3">
              {timeline.length === 0 ? (
                <div className="text-center py-8 text-xs font-bold text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                  No logged student activities or evaluations
                </div>
              ) : (
                <div className="relative pl-5 space-y-3.5 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                  {timeline.map((item: any) => (
                    <div key={item.id} className="relative">
                      <div className="absolute -left-5 top-1 h-4 w-4 rounded-full bg-white border-2 border-[#D528A2] flex items-center justify-center text-[7px] font-black text-[#D528A2]">
                        •
                      </div>
                      <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 shadow-2xs space-y-0.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-black text-slate-900">{item.title}</span>
                          <span className="text-[9px] font-bold text-slate-400">{item.date}</span>
                        </div>
                        <p className="text-[11px] font-medium text-slate-600">{item.desc}</p>
                        {item.status && (
                          <span className="inline-block mt-1 text-[8.5px] font-black uppercase px-1.5 py-0.2 rounded bg-[#D528A2]/10 text-[#D528A2] border border-[#D528A2]/20">
                            Status: {item.status}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 4. Recent Attendance Logs */}
          {activeTab === "attendance" && (
            <div className="space-y-2">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {dailyAttendance.map((rec: any) => (
                  <div key={rec.id} className="bg-slate-50 p-2 rounded-lg border border-slate-200 text-[10px] flex justify-between items-center shadow-2xs">
                    <div>
                      <p className="font-bold text-slate-800">{rec.dateStr}</p>
                      <p className="text-[8.5px] text-slate-400 truncate max-w-[90px]">{rec.subject || "Class"}</p>
                    </div>
                    <span className={`px-1.5 py-0.2 rounded text-[9px] font-black ${
                      rec.status === "present"
                        ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                        : rec.status === "absent"
                        ? "bg-rose-100 text-rose-800 border border-rose-200"
                        : "bg-purple-100 text-purple-800 border border-purple-200"
                    }`}>
                      {rec.status?.toUpperCase()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Compact Footer with Actions */}
        <div className="bg-slate-50 p-3 px-4 border-t border-slate-200 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={handleExportExcel}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold rounded-xl shadow-2xs transition-all cursor-pointer"
          >
            <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
            <span>Export Dossier (.xlsx)</span>
          </button>

          <button
            onClick={onClose}
            className="px-5 py-1.5 bg-gradient-to-r from-[#D528A2] to-pink-600 hover:opacity-95 text-white text-xs font-black rounded-xl transition-all shadow-sm shadow-[#D528A2]/25 cursor-pointer active:scale-95"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
