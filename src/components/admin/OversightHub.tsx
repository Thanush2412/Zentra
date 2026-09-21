"use client";

import React, { useMemo, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, CartesianGrid
} from "recharts";
import {
  Clock, Ticket, Award, Users, BookOpen, GraduationCap, Building2, AlertTriangle
} from "lucide-react";
import { useApp } from "@/context/AppContext";

/**
 * Admin Oversight Hub — infographic oversight of cross-campus operations that
 * CAM/KAM manage day-to-day: handovers, help-desk tickets, interview pipeline,
 * faculty workload, syllabus pace, and skill tracker progress.
 * All data comes from AppContext (already loaded for admin) — no new APIs.
 */

const PIE_COLORS = ["#f59e0b", "#10b981", "#6366f1", "#f43f5e", "#8b5cf6", "#14b8a6"];

function ChartCard({ title, subtitle, icon: Icon, children, accent = "bg-indigo-50 text-indigo-600" }: {
  title: string; subtitle: string; icon: any; children: React.ReactNode; accent?: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-xs p-4">
      <div className="flex items-center gap-2.5 mb-3">
        <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${accent}`}>
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <h3 className="text-sm font-black text-gray-900 leading-tight">{title}</h3>
          <p className="text-[10px] text-gray-400 font-semibold">{subtitle}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

export function OversightHub() {
  const { colleges, mentors, slots, requests, approvedHandovers, campusIssues, interviews, subjectsList, academicTracker, studentTracker } = useApp();
  const [campusFilter, setCampusFilter] = useState("all");

  const collegeName = (id?: string | null) => colleges.find(c => c.id === id)?.name || "Unassigned";

  const scoped = <T extends { college_id?: string | null }>(list: T[], campusOf?: (item: T) => string | null | undefined) =>
    campusFilter === "all"
      ? list
      : list.filter(item => campusOf ? campusOf(item) === campusFilter : item.college_id === campusFilter);

  // ── Handovers ────────────────────────────────────────────────────────────
  const handoverData = useMemo(() => {
    const scopedRequests = scoped(requests as any[], r => r.mentorObj?.college_id || mentors.find(m => m.id === r.requestorId)?.college_id);
    const pending = scopedRequests.filter(r => r.status === "pending_cam" || r.status === "pending").length;
    const approved = approvedHandovers.filter(h =>
      campusFilter === "all" || colleges.some(c => c.id === campusFilter && (h as any).college_id === c.id)
    ).length;
    const byCampus = colleges.map(c => ({
      name: c.name.length > 14 ? c.name.slice(0, 14) + "…" : c.name,
      Pending: (requests as any[]).filter(r => (r.status === "pending_cam" || r.status === "pending") && mentors.find(m => m.id === r.requestorId)?.college_id === c.id).length,
      Approved: (approvedHandovers as any[]).filter(h => (h as any).college_id === c.id).length,
    })).filter(d => d.Pending > 0 || d.Approved > 0);
    return { pending, approved, byCampus };
  }, [requests, approvedHandovers, mentors, colleges, campusFilter]);

  // ── Tickets ──────────────────────────────────────────────────────────────
  const ticketData = useMemo(() => {
    const scopedIssues = scoped(campusIssues as any[]);
    const statuses = ["open", "progress", "resolved"];
    const byStatus = statuses.map(s => ({ name: s === "progress" ? "In Progress" : s.charAt(0).toUpperCase() + s.slice(1), value: scopedIssues.filter(t => (t.status || "").toLowerCase().includes(s) || (s === "open" && !t.status)).length }));
    const escalated = scopedIssues.filter(t => t.escalated).length;
    const byCampus = colleges.map(c => ({
      name: c.name.length > 14 ? c.name.slice(0, 14) + "…" : c.name,
      Tickets: (campusIssues as any[]).filter(t => t.collegeId === c.id).length,
    })).filter(d => d.Tickets > 0);
    return { byStatus, escalated, byCampus, total: scopedIssues.length };
  }, [campusIssues, colleges, campusFilter]);

  // ── Interviews ───────────────────────────────────────────────────────────
  const interviewData = useMemo(() => {
    const scopedInts = scoped(interviews as any[]);
    const statusMap: Record<string, number> = {};
    scopedInts.forEach(i => {
      const s = (i.status || "Unknown").toString();
      statusMap[s] = (statusMap[s] || 0) + 1;
    });
    const byStatus = Object.entries(statusMap).map(([name, value]) => ({ name, value }));
    const byCampus = colleges.map(c => ({
      name: c.name.length > 14 ? c.name.slice(0, 14) + "…" : c.name,
      Interviews: (interviews as any[]).filter(i => i.college_id === c.id || i.origin_college_id === c.id || i.target_college_id === c.id).length,
    })).filter(d => d.Interviews > 0);
    return { byStatus, byCampus, total: scopedInts.length };
  }, [interviews, colleges, campusFilter]);

  // ── Faculty Workload ─────────────────────────────────────────────────────
  const workloadData = useMemo(() => {
    const scopedMentors = scoped(mentors as any[]);
    return scopedMentors.map(m => {
      const hours = slots.filter(s => s.mentorId === m.id).length;
      return {
        name: m.name.length > 12 ? m.name.slice(0, 12) + "…" : m.name,
        hours,
        campus: collegeName(m.college_id),
        overloaded: hours > 20,
        underloaded: hours < 5,
      };
    }).sort((a, b) => b.hours - a.hours).slice(0, 15);
  }, [mentors, slots, campusFilter, colleges]);

  // ── Syllabus Pace ────────────────────────────────────────────────────────
  const syllabusData = useMemo(() => {
    const scopedSubjects = scoped(subjectsList as any[]);
    const conductedMap: Record<string, number> = {};
    (academicTracker as any[]).forEach(t => {
      const key = (t.subject || "").trim().toLowerCase();
      if (key) conductedMap[key] = (conductedMap[key] || 0) + 1;
    });
    return scopedSubjects.slice(0, 12).map(sub => {
      const weeklyHrs = Number(sub.weekly_hours) || 4;
      const target = weeklyHrs * 15;
      const conducted = conductedMap[(sub.name || "").trim().toLowerCase()] || 0;
      return {
        name: sub.name.length > 14 ? sub.name.slice(0, 14) + "…" : sub.name,
        pct: target > 0 ? Math.min(100, Math.round((conducted / target) * 100)) : 0,
      };
    }).sort((a, b) => a.pct - b.pct);
  }, [subjectsList, academicTracker, campusFilter]);

  // ── Skill Tracker ────────────────────────────────────────────────────────
  const skillData = useMemo(() => {
    const byCohort: Record<string, { total: number; sum: number }> = {};
    (studentTracker as any[]).forEach(t => {
      const cg = t.classGroup || t.cohort || "General";
      if (!byCohort[cg]) byCohort[cg] = { total: 0, sum: 0 };
      byCohort[cg].total += 1;
      const score = Number(t.score ?? t.rating ?? t.progress ?? 0);
      if (!isNaN(score) && score > 0) byCohort[cg].sum += score;
    });
    return Object.entries(byCohort).map(([name, v]) => ({
      name: name.length > 14 ? name.slice(0, 14) + "…" : name,
      avg: v.total > 0 ? Math.round(v.sum / v.total) : 0,
      entries: v.total,
    })).sort((a, b) => b.entries - a.entries).slice(0, 10);
  }, [studentTracker]);

  const hasNoData = requests.length === 0 && approvedHandovers.length === 0 && campusIssues.length === 0 && interviews.length === 0;

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-150 pb-3">
        <div className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-indigo-655" />
          <div>
            <h2 className="text-lg font-bold text-gray-900">Oversight Hub</h2>
            <p className="text-[10px] text-gray-400 font-semibold mt-0.5">Cross-campus operational oversight — handovers, tickets, interviews, workload &amp; academics</p>
          </div>
        </div>
        <select
          value={campusFilter}
          onChange={e => setCampusFilter(e.target.value)}
          className="bg-white border border-gray-200 rounded-xl px-2.5 py-1.5 text-xs text-gray-705 font-bold focus:outline-none cursor-pointer"
        >
          <option value="all">All Campuses</option>
          {colleges.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {hasNoData && (
        <div className="text-center py-16 border border-gray-200 rounded-xl bg-gray-55/50">
          <Building2 className="h-10 w-10 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-555 font-semibold">No operational data across campuses yet.</p>
        </div>
      )}

      {/* Row 1: Handovers + Tickets */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Class Handovers" subtitle={`${handoverData.pending} pending · ${handoverData.approved} approved`} icon={Clock} accent="bg-amber-50 text-amber-600">
          {handoverData.byCampus.length === 0 ? (
            <p className="text-xs text-gray-400 font-semibold text-center py-8">No handover activity.</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={handoverData.byCampus} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 9, fill: "#94a3b8" }} interval={0} angle={-20} textAnchor="end" height={50} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "#94a3b8" }} />
                <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #e2e8f0" }} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <Bar dataKey="Pending" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Approved" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Campus Help Desk Tickets" subtitle={`${ticketData.total} total · ${ticketData.escalated} escalated`} icon={Ticket} accent="bg-rose-50 text-rose-600">
          {ticketData.total === 0 ? (
            <p className="text-xs text-gray-400 font-semibold text-center py-8">No tickets raised.</p>
          ) : (
            <div className="flex items-center gap-4">
              <ResponsiveContainer width="55%" height={200}>
                <PieChart>
                  <Pie data={ticketData.byStatus} dataKey="value" nameKey="name" innerRadius={45} outerRadius={75} paddingAngle={3}>
                    {ticketData.byStatus.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                </PieChart>
              </ResponsiveContainer>
              <ResponsiveContainer width="45%" height={200}>
                <BarChart data={ticketData.byCampus} layout="vertical" margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
                  <XAxis type="number" allowDecimals={false} hide />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 9, fill: "#94a3b8" }} width={80} />
                  <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                  <Bar dataKey="Tickets" fill="#f43f5e" radius={[0, 4, 4, 0]} barSize={14} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>
      </div>

      {/* Row 2: Interviews + Workload */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Interview Pipeline" subtitle={`${interviewData.total} interviews`} icon={Award} accent="bg-violet-50 text-violet-600">
          {interviewData.byStatus.length === 0 ? (
            <p className="text-xs text-gray-400 font-semibold text-center py-8">No interviews in the pipeline.</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={interviewData.byStatus} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 9, fill: "#94a3b8" }} interval={0} angle={-15} textAnchor="end" height={45} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "#94a3b8" }} />
                <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                <Bar dataKey="value" name="Interviews" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Faculty Workload Distribution" subtitle="Weekly slot-hours per mentor (top 15)" icon={Users} accent="bg-teal-50 text-teal-600">
          {workloadData.length === 0 ? (
            <p className="text-xs text-gray-400 font-semibold text-center py-8">No mentors with assigned slots.</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={workloadData} layout="vertical" margin={{ top: 0, right: 12, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10, fill: "#94a3b8" }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 9, fill: "#94a3b8" }} width={90} />
                <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                <Bar dataKey="hours" name="Slot-hours" radius={[0, 4, 4, 0]} barSize={12}>
                  {workloadData.map((d, i) => (
                    <Cell key={i} fill={d.overloaded ? "#f43f5e" : d.underloaded ? "#f59e0b" : "#14b8a6"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
          <p className="text-[9px] text-gray-400 font-bold mt-2 flex items-center gap-1">
            <AlertTriangle className="h-3 w-3 text-rose-400" /> Red &gt; 20 hrs/wk · Amber &lt; 5 hrs/wk
          </p>
        </ChartCard>
      </div>

      {/* Row 3: Syllabus + Skills */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Syllabus Completion Pace" subtitle="% of 15-week semester target conducted (lowest first)" icon={BookOpen} accent="bg-indigo-50 text-indigo-600">
          {syllabusData.length === 0 ? (
            <p className="text-xs text-gray-400 font-semibold text-center py-8">No academic tracker entries yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={syllabusData} layout="vertical" margin={{ top: 0, right: 20, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10, fill: "#94a3b8" }} unit="%" />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 9, fill: "#94a3b8" }} width={110} />
                <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                <Bar dataKey="pct" name="Completed" radius={[0, 4, 4, 0]} barSize={12}>
                  {syllabusData.map((d, i) => (
                    <Cell key={i} fill={d.pct >= 60 ? "#10b981" : d.pct >= 30 ? "#f59e0b" : "#f43f5e"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Skill Development Progress" subtitle="Average score & entry volume per cohort" icon={GraduationCap} accent="bg-emerald-50 text-emerald-600">
          {skillData.length === 0 ? (
            <p className="text-xs text-gray-400 font-semibold text-center py-8">No skill tracker entries yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={skillData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 9, fill: "#94a3b8" }} interval={0} angle={-20} textAnchor="end" height={50} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "#94a3b8" }} />
                <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <Bar dataKey="avg" name="Avg Score" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="entries" name="Entries" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>
    </div>
  );
}
