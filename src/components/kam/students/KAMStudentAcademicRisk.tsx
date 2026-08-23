"use client";

import React, { useState, useEffect } from "react";
import { AlertTriangle, TrendingUp, Search, Filter, ArrowUpRight, GraduationCap, ShieldAlert, Award } from "lucide-react";

interface StudentAcademicRecord {
  id: string;
  name: string;
  rollNumber: string;
  registerNumber: string;
  department: string;
  classGroup: string;
  collegeName: string;
  attendancePct: number;
  examAvgPct: number;
  labTasksSubmitted: number;
  labTaskAvgScore: number;
  interviewScore: number;
  hireScore: number;
  efsetScore: string;
  compositeScore: number;
  riskTier: "HIGH" | "MEDIUM" | "LOW";
}

export const KAMStudentAcademicRisk: React.FC<{
  selectedCollegeId?: string;
  kamId?: string;
  onOpenStudent360?: (studentId: string) => void;
}> = ({ selectedCollegeId = "all", kamId, onOpenStudent360 }) => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [search, setSearch] = useState("");
  const [riskFilter, setRiskFilter] = useState("all");
  const [deptFilter, setDeptFilter] = useState("all");

  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (selectedCollegeId !== "all") params.set("collegeId", selectedCollegeId);
        if (kamId) params.set("kamId", kamId);
        const query = params.toString() ? `?${params.toString()}` : "";
        const res = await fetch(`/api/kam/student-performance${query}`);
        const json = await res.json();
        if (json.success && isMounted) {
          setData(json);
        }
      } catch (err) {
        console.error("Failed to load academic risk data:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    loadData();
    return () => { isMounted = false; };
  }, [selectedCollegeId, kamId]);

  const summary = data?.summary || {
    totalStudents: 0,
    highRiskCount: 0,
    mediumRiskCount: 0,
    lowRiskCount: 0,
    avgAcademicScore: 0
  };

  const students: StudentAcademicRecord[] = data?.students || [];

  const filteredStudents = students.filter(s => {
    const matchesSearch = !search || s.name.toLowerCase().includes(search.toLowerCase()) || s.rollNumber.toLowerCase().includes(search.toLowerCase());
    const matchesRisk = riskFilter === "all" || s.riskTier.toLowerCase() === riskFilter.toLowerCase();
    const matchesDept = deptFilter === "all" || s.department === deptFilter;
    return matchesSearch && matchesRisk && matchesDept;
  });

  const distinctDepts = Array.from(new Set(students.map(s => s.department).filter(Boolean))).sort();

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* ── 1. Top Metric Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase text-slate-400">Total Evaluated Pool</span>
            <GraduationCap className="h-4 w-4 text-indigo-600" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900">{summary.totalStudents}</span>
            <span className="text-xs font-bold text-slate-400">Students</span>
          </div>
          <p className="text-[10px] font-bold text-indigo-600 mt-1">Portfolio Academic Benchmark: {summary.avgAcademicScore}/100</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase text-slate-400">Critical Academic Risk</span>
            <ShieldAlert className="h-4 w-4 text-rose-600" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-rose-700">{summary.highRiskCount}</span>
            <span className="text-xs font-bold text-rose-500">Immediate SLA</span>
          </div>
          <p className="text-[10px] font-bold text-slate-400 mt-1">Failing in exams, labs or attendance</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase text-slate-400">Moderate Risk</span>
            <AlertTriangle className="h-4 w-4 text-amber-600" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-amber-700">{summary.mediumRiskCount}</span>
            <span className="text-xs font-bold text-amber-600">Needs Followup</span>
          </div>
          <p className="text-[10px] font-bold text-slate-400 mt-1">Cautionary composite score</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase text-slate-400">Healthy & On Track</span>
            <Award className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-emerald-700">{summary.lowRiskCount}</span>
            <span className="text-xs font-bold text-emerald-600">Top Quartile</span>
          </div>
          <p className="text-[10px] font-bold text-slate-400 mt-1">Optimal across all vectors</p>
        </div>
      </div>

      {/* ── 2. Composite Academic Risk Matrix Table ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden space-y-4 p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-black text-slate-900">Holistic Student Academic Risk Matrix</h3>
            <p className="text-xs text-slate-400 font-medium">Cross-referencing Attendance + Exam Marks + Lab Tasks + Interview Score + HireScore</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search student or roll no..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none w-48"
              />
            </div>
            <select
              value={riskFilter}
              onChange={e => setRiskFilter(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none"
            >
              <option value="all">All Risk Levels</option>
              <option value="high">🔴 High Risk</option>
              <option value="medium">🟡 Medium Risk</option>
              <option value="low">🟢 Low Risk</option>
            </select>
            <select
              value={deptFilter}
              onChange={e => setDeptFilter(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none"
            >
              <option value="all">All Departments</option>
              {distinctDepts.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
        </div>

        {loading ? (
          <div className="py-12 text-center text-xs font-bold text-slate-400">Loading student academic risk matrix...</div>
        ) : filteredStudents.length === 0 ? (
          <div className="py-12 text-center text-xs font-bold text-slate-400">No students found matching criteria.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50/80 text-[10px] font-black uppercase text-slate-400 border-b border-slate-200">
                  <th className="py-3 px-3">Student Name</th>
                  <th className="py-3 px-3">Department & Batch</th>
                  <th className="py-3 px-3 text-center">Attendance</th>
                  <th className="py-3 px-3 text-center">CIA / Exams</th>
                  <th className="py-3 px-3 text-center">Lab Tasks</th>
                  <th className="py-3 px-3 text-center">Mock Interview</th>
                  <th className="py-3 px-3 text-center">HireScore</th>
                  <th className="py-3 px-3 text-center">Composite Score</th>
                  <th className="py-3 px-3 text-center">Risk Tier</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                {filteredStudents.map(s => (
                  <tr key={s.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-3">
                      <button
                        type="button"
                        onClick={() => onOpenStudent360 && onOpenStudent360(s.id)}
                        className="text-left font-black text-slate-900 hover:text-indigo-600 flex items-center gap-1 cursor-pointer"
                      >
                        <span>{s.name}</span>
                        <ArrowUpRight className="h-3 w-3 text-slate-400" />
                      </button>
                      <p className="text-[10px] text-slate-400 font-medium">{s.rollNumber} • {s.collegeName}</p>
                    </td>
                    <td className="py-3 px-3 font-bold text-slate-700">
                      <p>{s.department}</p>
                      <p className="text-[10px] text-slate-400">{s.classGroup}</p>
                    </td>
                    <td className="py-3 px-3 text-center font-black">
                      <span className={s.attendancePct >= 75 ? "text-emerald-600" : s.attendancePct >= 65 ? "text-amber-600" : "text-rose-600"}>
                        {s.attendancePct}%
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center font-black">
                      <span className={s.examAvgPct >= 60 ? "text-slate-800" : "text-rose-600"}>
                        {s.examAvgPct}%
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center font-bold">
                      <span className="text-indigo-600 font-black">{s.labTaskAvgScore}</span> / 100
                    </td>
                    <td className="py-3 px-3 text-center font-bold">
                      <span className="text-indigo-600 font-black">{s.interviewScore}</span> / 100
                    </td>
                    <td className="py-3 px-3 text-center font-black text-slate-800">
                      {s.hireScore}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className="font-black text-slate-900 text-xs px-2 py-0.5 rounded-lg bg-slate-100">
                        {s.compositeScore} / 100
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                        s.riskTier === "HIGH"
                          ? "bg-rose-50 text-rose-700 border border-rose-200"
                          : s.riskTier === "MEDIUM"
                          ? "bg-amber-50 text-amber-700 border border-amber-200"
                          : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                      }`}>
                        {s.riskTier} RISK
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
