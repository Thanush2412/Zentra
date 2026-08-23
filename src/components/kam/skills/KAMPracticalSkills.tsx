"use client";

import React, { useState, useEffect } from "react";
import { Code, CheckCircle2, AlertCircle, Clock, Users, ArrowUpRight, Search, TrendingUp } from "lucide-react";

export const KAMPracticalSkills: React.FC<{ selectedCollegeId?: string; kamId?: string }> = ({ selectedCollegeId = "all", kamId }) => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (selectedCollegeId !== "all") params.set("collegeId", selectedCollegeId);
        if (kamId) params.set("kamId", kamId);
        const query = params.toString() ? `?${params.toString()}` : "";
        const res = await fetch(`/api/kam/practical-skills${query}`);
        const json = await res.json();
        if (json.success && isMounted) {
          setData(json);
        }
      } catch (err) {
        console.error("Failed to load practical skills data:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    loadData();
    return () => { isMounted = false; };
  }, [selectedCollegeId, kamId]);


  const summary = data?.summary || {
    totalWeeklyTasks: 0,
    totalSubmissions: 0,
    totalVerified: 0,
    totalRework: 0,
    totalPending: 0,
    completionRate: 0,
    verificationThroughput: 0
  };

  const mentorBacklogs: any[] = data?.mentorBacklogs || [];
  const subjectProgress: any[] = data?.subjectProgress || [];

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* ── 1. Top Summary Metric Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase text-slate-400">Total Code Submissions</span>
            <Code className="h-4 w-4 text-indigo-600" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900">{summary.totalSubmissions.toLocaleString()}</span>
            <span className="text-xs font-bold text-slate-400">Repositories</span>
          </div>
          <p className="text-[10px] font-bold text-emerald-600 mt-1">{summary.completionRate}% Portfolio Submission Rate</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase text-slate-400">Verified & Cleared</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-emerald-700">{summary.totalVerified.toLocaleString()}</span>
            <span className="text-xs font-bold text-emerald-600">Passed</span>
          </div>
          <p className="text-[10px] font-bold text-slate-400 mt-1">{summary.verificationThroughput}% Grading Throughput</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase text-slate-400">Pending Mentor Grading</span>
            <Clock className="h-4 w-4 text-amber-600" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-amber-700">{summary.totalPending}</span>
            <span className="text-xs font-bold text-amber-600">Submissions</span>
          </div>
          <p className="text-[10px] font-bold text-slate-400 mt-1">Awaiting mentor code review</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase text-slate-400">Rework Required</span>
            <AlertCircle className="h-4 w-4 text-rose-600" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-rose-700">{summary.totalRework}</span>
            <span className="text-xs font-bold text-rose-500">Returned</span>
          </div>
          <p className="text-[10px] font-bold text-slate-400 mt-1">Returned for code improvements</p>
        </div>
      </div>

      {/* ── 2. Subject-wise Lab Completion Progress ── */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-black text-slate-900">Technical Skill & Lab Subject Completion</h3>
            <p className="text-xs text-slate-400 font-medium">Progress across core technical domains, practical tasks, and submission rates</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {subjectProgress.map((s, idx) => (
            <div key={idx} className="bg-slate-50/70 p-4 rounded-xl border border-slate-200/80 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-slate-800">{s.subject}</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-indigo-50 text-indigo-700">
                  {s.completionPct}%
                </span>
              </div>
              <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-600 rounded-full transition-all"
                  style={{ width: `${s.completionPct}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 pt-1 border-t border-slate-200/60">
                <span>{s.submissions} Submissions</span>
                <span className="text-emerald-600 font-bold">{s.verified} Verified</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── 3. Mentor Grading Backlog & Turnaround ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden space-y-4 p-5">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-black text-slate-900">Mentor Lab Grading Turnaround & Backlog</h3>
            <p className="text-xs text-slate-400 font-medium">Tracking mentor code review velocity and outstanding unverified submissions</p>
          </div>
        </div>

        {loading ? (
          <div className="py-12 text-center text-xs font-bold text-slate-400">Loading mentor turnaround data...</div>
        ) : mentorBacklogs.length === 0 ? (
          <div className="py-12 text-center text-xs font-bold text-slate-400">No active mentor backlogs recorded.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50/80 text-[10px] font-black uppercase text-slate-400 border-b border-slate-200">
                  <th className="py-3 px-3">Faculty / Mentor</th>
                  <th className="py-3 px-3">Department</th>
                  <th className="py-3 px-3 text-center">Tasks Created</th>
                  <th className="py-3 px-3 text-center">Assigned Submissions</th>
                  <th className="py-3 px-3 text-center">Verified</th>
                  <th className="py-3 px-3 text-center">Pending Backlog</th>
                  <th className="py-3 px-3 text-center">Review Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                {mentorBacklogs.map(m => (
                  <tr key={m.mentorId} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-3 font-black text-slate-900">{m.mentorName}</td>
                    <td className="py-3 px-3 font-bold text-slate-600">{m.department}</td>
                    <td className="py-3 px-3 text-center font-bold">{m.tasksCreated}</td>
                    <td className="py-3 px-3 text-center font-bold">{m.assignedSubmissions}</td>
                    <td className="py-3 px-3 text-center font-black text-emerald-600">{m.verifiedSubmissions}</td>
                    <td className="py-3 px-3 text-center font-black">
                      <span className={m.pendingBacklog > 10 ? "text-rose-600" : m.pendingBacklog > 0 ? "text-amber-600" : "text-emerald-600"}>
                        {m.pendingBacklog}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                        m.turnaroundStatus === "Optimal"
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          : m.turnaroundStatus === "Moderate Delay"
                          ? "bg-amber-50 text-amber-700 border border-amber-200"
                          : "bg-rose-50 text-rose-700 border border-rose-200"
                      }`}>
                        {m.turnaroundStatus}
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
