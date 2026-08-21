"use client";

import React, { useState } from "react";
import { Building2, Percent, Users, GraduationCap, ArrowUpRight, BarChart3, TrendingUp } from "lucide-react";

interface KAMAnalyticsProps {
  campuses: Array<{
    id: string;
    name: string;
    code: string;
    totalStudents: number;
    activeFaculty: number;
    attendancePct: number;
    healthScore: number;
    openIssues: number;
  }>;
  trendData: Array<{ dateStr: string; attendancePct: number; totalMarks: number }>;
}

export const KAMAnalytics: React.FC<KAMAnalyticsProps> = ({ campuses, trendData }) => {
  const [subTab, setSubTab] = useState<"comparison" | "trend" | "faculty">("comparison");

  return (
    <div className="space-y-6">
      {/* Sub-tab navigation */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
        {[
          { key: "comparison", label: "Campus Benchmark Comparison", icon: BarChart3 },
          { key: "trend", label: "Portfolio Attendance Trends", icon: TrendingUp },
          { key: "faculty", label: "Faculty Utilization & Staffing", icon: GraduationCap }
        ].map(t => {
          const Icon = t.icon;
          const isActive = subTab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setSubTab(t.key as any)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                isActive
                  ? "bg-indigo-600 text-white shadow-sm shadow-indigo-200"
                  : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* 1. Comparison Matrix */}
      {subTab === "comparison" && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-4">
            <div>
              <h3 className="text-sm font-black text-slate-900">Cross-Campus Attendance Benchmark</h3>
              <p className="text-xs text-slate-400 font-medium">Comparative attendance rates across all supervised partner colleges</p>
            </div>

            <div className="space-y-4 pt-2">
              {campuses.map(c => (
                <div key={c.id} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="text-slate-800 flex items-center gap-2">
                      <Building2 className="h-3.5 w-3.5 text-indigo-600" />
                      {c.name} ({c.code})
                    </span>
                    <span className="text-indigo-600 font-black">{c.attendancePct}%</span>
                  </div>
                  <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden flex">
                    <div
                      className="h-full bg-indigo-600 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, Math.max(0, c.attendancePct))}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-slate-400 font-medium">
                    <span>{c.totalStudents} Enrolled Students</span>
                    <span>{c.activeFaculty} Active Faculty</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Comparative Data Grid */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-400 font-black uppercase text-[10px]">
                  <th className="py-3 px-4">Campus Name</th>
                  <th className="py-3 px-3 text-center">Total Students</th>
                  <th className="py-3 px-3 text-center">Active Faculty</th>
                  <th className="py-3 px-3 text-center">Avg Attendance</th>
                  <th className="py-3 px-3 text-center">Open Issues</th>
                  <th className="py-3 px-4 text-right">Health Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                {campuses.map(c => (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-bold text-slate-900">{c.name}</td>
                    <td className="py-3 px-3 text-center">{c.totalStudents}</td>
                    <td className="py-3 px-3 text-center">{c.activeFaculty}</td>
                    <td className="py-3 px-3 text-center font-extrabold text-indigo-600">{c.attendancePct}%</td>
                    <td className="py-3 px-3 text-center">{c.openIssues}</td>
                    <td className="py-3 px-4 text-right">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {c.healthScore}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 2. Trends View */}
      {subTab === "trend" && (
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-4">
          <div>
            <h3 className="text-sm font-black text-slate-900">Daily Attendance Trends & Volatility</h3>
            <p className="text-xs text-slate-400 font-medium">Daily student presence logs across selected date range</p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2 pt-2">
            {trendData.map(d => (
              <div key={d.dateStr} className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/80 text-center">
                <span className="text-[10px] font-bold text-slate-400 block">{d.dateStr}</span>
                <span className="text-sm font-black text-indigo-600 block mt-0.5">{d.attendancePct}%</span>
                <span className="text-[9px] text-slate-500 font-medium">{d.totalMarks} marks</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. Faculty Utilization */}
      {subTab === "faculty" && (
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-4">
          <div>
            <h3 className="text-sm font-black text-slate-900">Faculty Staffing & Allocation Ratios</h3>
            <p className="text-xs text-slate-400 font-medium">Mentor to student ratios and coverage across partner colleges</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            {campuses.map(c => {
              const ratio = c.activeFaculty > 0 ? Math.round(c.totalStudents / c.activeFaculty) : 0;
              return (
                <div key={c.id} className="bg-slate-50 rounded-xl p-4 border border-slate-200 flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-black text-slate-800">{c.name}</h4>
                    <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                      {c.activeFaculty} Active Faculty • {c.totalStudents} Students
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-black text-indigo-600">1 : {ratio}</span>
                    <span className="text-[9px] text-slate-400 font-bold block">Faculty/Student</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
