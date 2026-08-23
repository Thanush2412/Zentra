"use client";

import React, { useState, useEffect } from "react";
import { BookOpen, TrendingUp, AlertTriangle, CheckCircle2, Clock, Building2, Search, Filter, Download, ArrowUpRight } from "lucide-react";

interface SubjectDelivery {
  id: string;
  name: string;
  department: string;
  semester: string;
  collegeName: string;
  weeklyHours: number;
  targetTopics: number;
  completedTopics: number;
  conductedHours: number;
  completionPct: number;
  expectedPct: number;
  gapPct: number;
  status: "On Track" | "Moderate" | "Lagging";
  mentors: string[];
}

interface CampusDelivery {
  id: string;
  name: string;
  code: string;
  totalSubjects: number;
  completedTopicsSum: number;
  targetTopicsSum: number;
  totalConductedHours: number;
  avgCompletionPct: number;
  laggingSubjectsCount: number;
  status: string;
}

export const KAMAcademicDelivery: React.FC<{ selectedCollegeId?: string; kamId?: string }> = ({ selectedCollegeId = "all", kamId }) => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (selectedCollegeId !== "all") params.set("collegeId", selectedCollegeId);
        if (kamId) params.set("kamId", kamId);
        const query = params.toString() ? `?${params.toString()}` : "";
        const res = await fetch(`/api/kam/academic-delivery${query}`);
        const json = await res.json();
        if (json.success && isMounted) {
          setData(json);
        }
      } catch (err) {
        console.error("Failed to load academic delivery:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    loadData();
    return () => { isMounted = false; };
  }, [selectedCollegeId, kamId]);

  const summary = data?.summary || {
    totalSubjects: 0,
    avgCompletionPct: 0,
    expectedBenchmark: 65,
    onTrackCount: 0,
    laggingCount: 0,
    totalTeachingHours: 0
  };

  const campuses: CampusDelivery[] = data?.campusDelivery || [];
  const subjects: SubjectDelivery[] = data?.subjectDelivery || [];

  const filteredSubjects = subjects.filter(s => {
    const matchesSearch = !search || s.name.toLowerCase().includes(search.toLowerCase()) || (s.mentors || []).some(m => m.toLowerCase().includes(search.toLowerCase()));
    const matchesDept = deptFilter === "all" || s.department === deptFilter;
    const matchesStatus = statusFilter === "all" || s.status.toLowerCase() === statusFilter.toLowerCase();
    return matchesSearch && matchesDept && matchesStatus;
  });

  const distinctDepts = Array.from(new Set(subjects.map(s => s.department).filter(Boolean))).sort();

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* ── 1. Top Summary Banner ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase text-slate-400">Portfolio Syllabus Pacing</span>
            <BookOpen className="h-4 w-4 text-indigo-600" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900">{summary.avgCompletionPct}%</span>
            <span className="text-xs font-bold text-slate-400">/ 65% Target</span>
          </div>
          <p className="text-[10px] font-bold text-emerald-600 mt-1">Across {summary.totalSubjects} curriculum subjects</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase text-slate-400">Delivery Status</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-emerald-700">{summary.onTrackCount}</span>
            <span className="text-xs font-bold text-emerald-600">On Track</span>
          </div>
          <p className="text-[10px] font-bold text-slate-400 mt-1">Pacing within calendar schedule</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase text-slate-400">Lagging Subjects</span>
            <AlertTriangle className="h-4 w-4 text-rose-600" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-rose-700">{summary.laggingCount}</span>
            <span className="text-xs font-bold text-rose-500">Need Attention</span>
          </div>
          <p className="text-[10px] font-bold text-slate-400 mt-1">&gt;10% behind expected syllabus</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase text-slate-400">Total Teaching Hours</span>
            <Clock className="h-4 w-4 text-indigo-600" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900">{summary.totalTeachingHours}h</span>
            <span className="text-xs font-bold text-indigo-600">Logged</span>
          </div>
          <p className="text-[10px] font-bold text-slate-400 mt-1">Conducted lecture & lab hours</p>
        </div>
      </div>

      {/* ── 2. Campus Benchmark Breakdown ── */}
      {selectedCollegeId === "all" && campuses.length > 0 && (
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-black text-slate-900">Campus Syllabus Delivery Benchmark</h3>
              <p className="text-xs font-medium text-slate-400">Syllabus coverage progress across partner colleges</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {campuses.map(c => (
              <div key={c.id} className="bg-slate-50/70 p-4 rounded-xl border border-slate-200/80 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-slate-800">{c.name}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${c.avgCompletionPct >= 65 ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                    }`}>
                    {c.avgCompletionPct}%
                  </span>
                </div>
                <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${c.avgCompletionPct >= 65 ? "bg-emerald-500" : "bg-amber-500"
                      }`}
                    style={{ width: `${c.avgCompletionPct}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 pt-1 border-t border-slate-200/60">
                  <span>{c.totalSubjects} Subjects</span>
                  <span>{c.laggingSubjectsCount > 0 ? `⚠️ ${c.laggingSubjectsCount} Lagging` : "🟢 All On Track"}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── 3. Subject-wise Syllabus Delivery Table ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden space-y-4 p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-black text-slate-900">Subject-by-Subject Syllabus Progress</h3>
            <p className="text-xs text-slate-400 font-medium">Topic coverage, assigned mentors, and pace gap against academic calendar</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search subject or faculty..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none w-48"
              />
            </div>
            <select
              value={deptFilter}
              onChange={e => setDeptFilter(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none"
            >
              <option value="all">All Departments</option>
              {distinctDepts.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none"
            >
              <option value="all">All Statuses</option>
              <option value="on track">On Track</option>
              <option value="lagging">Lagging</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="py-12 text-center text-xs font-bold text-slate-400">Loading syllabus delivery data...</div>
        ) : filteredSubjects.length === 0 ? (
          <div className="py-12 text-center text-xs font-bold text-slate-400">No subjects matching filter criteria.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50/80 text-[10px] font-black uppercase text-slate-400 border-b border-slate-200">
                  <th className="py-3 px-3">Subject / Course</th>
                  <th className="py-3 px-3">Department</th>
                  <th className="py-3 px-3">Assigned Faculty</th>
                  <th className="py-3 px-3 text-center">Topics Delivered</th>
                  <th className="py-3 px-3">Completion %</th>
                  <th className="py-3 px-3 text-center">Delivery Gap</th>
                  <th className="py-3 px-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                {filteredSubjects.map(s => (
                  <tr key={s.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-3">
                      <p className="font-black text-slate-900">{s.name}</p>
                      <p className="text-[10px] text-slate-400 font-medium">{s.collegeName} • {s.weeklyHours}h/week</p>
                    </td>
                    <td className="py-3 px-3 font-bold text-slate-700">{s.department}</td>
                    <td className="py-3 px-3 text-xs text-slate-600 font-bold">
                      {s.mentors.length > 0 ? s.mentors.join(", ") : "Faculty Lead"}
                    </td>
                    <td className="py-3 px-3 text-center font-bold">
                      <span className="text-indigo-600 font-black">{s.completedTopics}</span> / {s.targetTopics}
                    </td>
                    <td className="py-3 px-3 w-40">
                      <div className="flex items-center justify-between text-[10px] font-black mb-1">
                        <span>{s.completionPct}%</span>
                        <span className="text-slate-400">Target: {s.expectedPct}%</span>
                      </div>
                      <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${s.completionPct >= 65 ? "bg-emerald-500" : s.completionPct >= 50 ? "bg-amber-500" : "bg-rose-500"
                            }`}
                          style={{ width: `${s.completionPct}%` }}
                        />
                      </div>
                    </td>
                    <td className="py-3 px-3 text-center font-black">
                      <span className={s.gapPct >= 0 ? "text-emerald-600" : "text-rose-600"}>
                        {s.gapPct >= 0 ? `+${s.gapPct}%` : `${s.gapPct}%`}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${s.status === "On Track"
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          : s.status === "Moderate"
                            ? "bg-amber-50 text-amber-700 border border-amber-200"
                            : "bg-rose-50 text-rose-700 border border-rose-200"
                        }`}>
                        {s.status}
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
