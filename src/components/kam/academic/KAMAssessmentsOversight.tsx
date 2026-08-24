"use client";

import React, { useState, useEffect } from "react";
import { Award, TrendingUp, CheckCircle2, AlertTriangle, BookOpen, Search, Download, ArrowUpRight, BarChart3 } from "lucide-react";

interface DepartmentAverage {
  department: string;
  collegeName: string;
  totalStudents: number;
  avgCiaScore: number;
  avgLabScore: number;
  passRate: number;
  status: "Optimal" | "Moderate" | "Critical";
}

interface AssessmentBreakdown {
  assessmentType: string;
  weightage: string;
  targetAvg: number;
  actualAvg: number;
  compliance: string;
}

export const KAMAssessmentsOversight: React.FC<{
  selectedCollegeId?: string;
  kamId?: string;
}> = ({ selectedCollegeId = "all", kamId }) => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (selectedCollegeId !== "all") params.set("collegeId", selectedCollegeId);
        if (kamId) params.set("kamId", kamId);
        const query = params.toString() ? `?${params.toString()}` : "";
        const res = await fetch(`/api/kam/assessments${query}`);
        const json = await res.json();
        if (json.success && isMounted) {
          setData(json);
        }
      } catch (err) {
        console.error("Failed to load assessments data:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    loadData();
    return () => { isMounted = false; };
  }, [selectedCollegeId, kamId]);

  const summary = data?.summary || {
    totalStudents: 0,
    avgCiaScore: 0,
    overallPassRate: 0,
    topDepartment: "—",
    totalExamsRecorded: 0
  };

  const departments: DepartmentAverage[] = (data?.departmentAverages || []).filter((d: DepartmentAverage) =>
    search ? d.department.toLowerCase().includes(search.toLowerCase()) || d.collegeName.toLowerCase().includes(search.toLowerCase()) : true
  );

  const breakdowns: AssessmentBreakdown[] = data?.assessmentBreakdown || [];

  return (
    <div className="space-y-6 font-sans">
      {/* Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-black text-slate-900">Regional Assessment & CIA Exam Benchmark</h2>
          <p className="text-xs text-slate-400 font-semibold mt-0.5">
            Internal assessments, CIA scores, and departmental pass performance across supervised partner institutions.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-black text-indigo-700 bg-indigo-50 border border-indigo-200 px-3 py-1.5 rounded-xl">
            Pass Benchmark: ≥50% CIA
          </span>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Overall Pass Rate", value: `${summary.overallPassRate}%`, icon: Award, color: "text-emerald-600", bg: "bg-emerald-500/10 border-emerald-200/60" },
          { label: "Average CIA Score", value: `${summary.avgCiaScore} / 100`, icon: TrendingUp, color: "text-indigo-600", bg: "bg-indigo-500/10 border-indigo-200/60" },
          { label: "Top Performing Dept", value: summary.topDepartment, icon: CheckCircle2, color: "text-purple-600", bg: "bg-purple-500/10 border-purple-200/60" },
          { label: "Assessed Students", value: summary.totalStudents, icon: BookOpen, color: "text-amber-600", bg: "bg-amber-500/10 border-amber-200/60" }
        ].map((card, idx) => {
          const Icon = card.icon;
          return (
            <div key={idx} className={`p-4 rounded-2xl border ${card.bg} space-y-1.5 transition-all shadow-2xs`}>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase text-slate-500">{card.label}</span>
                <Icon className={`h-4 w-4 ${card.color}`} />
              </div>
              <p className="text-xl font-black text-slate-900 truncate">{card.value}</p>
            </div>
          );
        })}
      </div>

      {/* Assessment Cycle Milestone Breakdown */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
        <div>
          <h3 className="text-sm font-black text-slate-900">Regional Assessment Cycle Milestones</h3>
          <p className="text-xs font-semibold text-slate-400">Target vs achieved class score averages across internal evaluation phases</p>
        </div>

        {breakdowns.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {breakdowns.map((b, idx) => (
              <div key={idx} className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                <div className="flex justify-between items-start">
                  <span className="text-[9px] font-black uppercase text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
                    Weight: {b.weightage}
                  </span>
                  <span className="text-[10px] font-bold text-slate-500">{b.compliance}</span>
                </div>
                <h4 className="text-xs font-black text-slate-900 leading-snug">{b.assessmentType}</h4>
                <div className="flex justify-between text-[11px] font-extrabold pt-2 border-t border-slate-200">
                  <span className="text-slate-500">Achieved: <span className="text-slate-900">{b.actualAvg}%</span></span>
                  <span className="text-slate-400">Target: {b.targetAvg}%</span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-1.5">
                  <div
                    className={`h-1.5 rounded-full ${b.actualAvg >= b.targetAvg ? "bg-emerald-500" : "bg-amber-500"}`}
                    style={{ width: `${Math.min(100, (b.actualAvg / b.targetAvg) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-8 text-center bg-slate-50 rounded-xl border border-slate-200/60 text-slate-400 text-xs font-semibold">
            No formal internal assessment / CIA exam schedules logged yet for this campus selection.
          </div>
        )}
      </div>

      {/* Department Scores Benchmark Table */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-sm font-black text-slate-900">Departmental Exam & CIA Score Matrix</h3>
            <p className="text-xs font-semibold text-slate-400">Benchmarked performance per department across your institutions</p>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search department..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-8 pr-3 py-1.5 border border-slate-200 bg-slate-50 text-xs rounded-xl focus:outline-none focus:ring-1 focus:ring-[#D528A2] font-semibold w-48"
            />
          </div>
        </div>

        <div className="border border-slate-200 rounded-xl overflow-x-auto shadow-2xs">
          <table className="w-full text-xs text-left border-collapse">
            <thead className="bg-slate-50 border-b border-slate-200 font-extrabold text-[9px] uppercase tracking-wider text-slate-600">
              <tr>
                <th className="p-3">Department</th>
                <th className="p-3">Campus</th>
                <th className="p-3 text-center">Assessed Batch</th>
                <th className="p-3 text-center">Avg CIA Marks</th>
                <th className="p-3 text-center">Avg Lab Score</th>
                <th className="p-3 text-center">Pass Rate</th>
                <th className="p-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {departments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400 font-bold">
                    {loading ? "Loading assessment score matrix..." : "No department exam records match the active scope."}
                  </td>
                </tr>
              ) : (
                departments.map((dept, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                    <td className="p-3 font-black text-slate-900">{dept.department}</td>
                    <td className="p-3 font-semibold text-slate-500">{dept.collegeName}</td>
                    <td className="p-3 text-center font-black text-slate-700">{dept.totalStudents} Students</td>
                    <td className="p-3 text-center font-black text-indigo-700">{dept.avgCiaScore} / 100</td>
                    <td className="p-3 text-center font-black text-purple-700">{dept.avgLabScore} / 100</td>
                    <td className="p-3 text-center font-black">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] ${
                        dept.passRate >= 80 ? "bg-emerald-50 text-emerald-700 border border-emerald-200" :
                        dept.passRate >= 65 ? "bg-amber-50 text-amber-700 border border-amber-200" :
                        "bg-rose-50 text-rose-700 border border-rose-200"
                      }`}>
                        {dept.passRate}%
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase ${
                        dept.status === "Optimal" ? "bg-emerald-100 text-emerald-800" :
                        dept.status === "Moderate" ? "bg-amber-100 text-amber-800" :
                        "bg-rose-100 text-rose-800"
                      }`}>
                        {dept.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
