"use client";

import React, { useState, useMemo } from "react";
import { useApp } from "@/context/AppContext";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate, formatRoleLabel } from "@/lib/utils";
import {
  LayoutDashboard,
  Building2,
  Users,
  Grid,
  Layers,
  Network,
  ChevronRight,
  ChevronDown,
  History,
  TrendingUp
} from "lucide-react";
import type { AdminTab } from "@/components/admin/types";

export interface AdminOverviewTabProps {
  onNavigateTab: (tab: AdminTab) => void;
  kamList?: any[];
}

export const AdminOverviewTab: React.FC<AdminOverviewTabProps> = ({
  onNavigateTab,
  kamList = []
}) => {
  const {
    currentAdmin,
    colleges,
    mentors,
    slots,
    coursesList,
    auditLogs
  } = useApp();

  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({
    admin: true
  });

  const toggleNode = (nodeId: string) => {
    setExpandedNodes(prev => ({ ...prev, [nodeId]: !prev[nodeId] }));
  };

  // Compute live day-by-day distribution of scheduled slots across weekdays (fixing MD-H05)
  const dayDistribution = useMemo(() => {
    const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const counts = days.map(day => {
      const daySlots = slots.filter(s => (s.day || "").toLowerCase() === day.toLowerCase());
      return {
        day: day.slice(0, 3),
        fullDay: day,
        slots: daySlots.length
      };
    });

    const maxSlots = Math.max(...counts.map(c => c.slots), 1);
    // Generate SVG path points dynamically
    const width = 360;
    const height = 90;
    const step = width / (days.length - 1);
    const points = counts.map((c, i) => {
      const x = Math.round(i * step);
      // Invert y: 0 is top, height is bottom
      const y = Math.round(height - (c.slots / maxSlots) * (height - 20) - 10);
      return { x, y, count: c.slots, day: c.day };
    });

    // Create smooth SVG cubic bezier path
    let pathD = `M ${points[0].x} ${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const current = points[i];
      const next = points[i + 1];
      const controlX = (current.x + next.x) / 2;
      pathD += ` C ${controlX} ${current.y}, ${controlX} ${next.y}, ${next.x} ${next.y}`;
    }

    const areaD = `${pathD} L ${width} ${height} L 0 ${height} Z`;

    return { counts, maxSlots, points, pathD, areaD, total: slots.length };
  }, [slots]);

  const recentLogs = useMemo(() => {
    return (auditLogs || []).slice(0, 6);
  }, [auditLogs]);

  return (
    <div className="space-y-4 animate-fadeIn font-sans text-xs">
      <PageHeader
        icon={LayoutDashboard}
        title="Admin Control Console"
        subtitle="Global executive overview of university campuses, scheduling, and infrastructure."
        meta={
          <div className="text-right">
            <span className="text-sm font-bold text-slate-900 block leading-tight">Campuses Directory</span>
            <span className="text-xs text-slate-400">{colleges.length} active campuses</span>
          </div>
        }
      />

      {/* KPI Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Card 1: Campuses */}
        <div
          onClick={() => onNavigateTab("campuses")}
          className="bg-white border border-slate-200/80 rounded-xl p-4 shadow-sm flex flex-col justify-between hover:border-indigo-300 hover:shadow-md transition-all cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
              <Building2 className="h-4 w-4 text-indigo-500" />
            </div>
            <span className="text-[11px] md:text-[13px] font-semibold tracking-[0.8px] text-gray-500 uppercase">
              Total Campuses
            </span>
          </div>
          <span className="text-[36px] md:text-[48px] font-bold text-gray-900 mt-3 block leading-none admin-kpi-value">
            {colleges.length}
          </span>
          <span className="text-xs md:text-[14px] font-normal text-gray-400 mt-2 block">
            Active partner campuses
          </span>
        </div>

        {/* Card 2: Faculty Mentors */}
        <div
          onClick={() => onNavigateTab("mentors")}
          className="bg-white border border-slate-200/80 rounded-xl p-4 shadow-sm flex flex-col justify-between hover:border-teal-300 hover:shadow-md transition-all cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-xl bg-teal-50 flex items-center justify-center shrink-0">
              <Users className="h-4 w-4 text-teal-600" />
            </div>
            <span className="text-[11px] md:text-[13px] font-semibold tracking-[0.8px] text-gray-500 uppercase">
              Total Mentors
            </span>
          </div>
          <span className="text-[36px] md:text-[48px] font-bold text-gray-900 mt-3 block leading-none admin-kpi-value">
            {mentors.length}
          </span>
          <span className="text-xs md:text-[14px] font-normal text-gray-400 mt-2 block">
            Across all institutions
          </span>
        </div>

        {/* Card 3: Active Slots */}
        <div
          onClick={() => onNavigateTab("schedules")}
          className="bg-white border border-slate-200/80 rounded-xl p-4 shadow-sm flex flex-col justify-between hover:border-amber-300 hover:shadow-md transition-all cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
              <Grid className="h-4 w-4 text-amber-500" />
            </div>
            <span className="text-[11px] md:text-[13px] font-semibold tracking-[0.8px] text-gray-500 uppercase">
              Active Slots
            </span>
          </div>
          <div>
            <span className="text-[36px] md:text-[48px] font-bold text-gray-900 mt-3 block leading-none admin-kpi-value">
              {slots.length}
            </span>
            <div className="mt-3 h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${Math.min(100, Math.round((slots.length / 500) * 100))}%`,
                  background: "linear-gradient(to right, #D528A2, #F4A863)"
                }}
              />
            </div>
            <span className="text-xs md:text-[14px] font-normal text-gray-400 mt-2 block">
              Out of 500 capacity ({Math.round((slots.length / 500) * 100)}%)
            </span>
          </div>
        </div>

        {/* Card 4: Total Courses */}
        <div
          onClick={() => onNavigateTab("courses")}
          className="bg-white border border-slate-200/80 rounded-xl p-4 shadow-sm flex flex-col justify-between hover:border-rose-300 hover:shadow-md transition-all cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-xl bg-rose-50 flex items-center justify-center shrink-0">
              <Layers className="h-4 w-4 text-rose-500" />
            </div>
            <span className="text-[11px] md:text-[13px] font-semibold tracking-[0.8px] text-gray-500 uppercase">
              Total Courses
            </span>
          </div>
          <span className="text-[36px] md:text-[48px] font-bold text-gray-900 mt-3 block leading-none admin-kpi-value">
            {coursesList.length}
          </span>
          <span className="text-xs md:text-[14px] font-normal text-gray-400 mt-2 block">
            Academic programs
          </span>
        </div>
      </div>

      {/* Dynamic Schedule Hours Trend Section (Fixing MD-H05) */}
      <Card className="shadow-sm overflow-hidden">
        <CardHeader className="p-4 pb-2 border-b border-slate-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
                <TrendingUp className="h-4 w-4" />
              </div>
              <div>
                <CardTitle className="text-sm font-extrabold text-gray-900">Weekly Scheduled Hours Distribution</CardTitle>
                <p className="text-[10px] text-gray-500 font-semibold mt-0.5">Real-time slot load calculated dynamically across weekday timetables.</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs font-black text-indigo-700 bg-indigo-50 border border-indigo-200/80 px-2.5 py-1 rounded-full">
                {dayDistribution.total} Total Slots Scheduled
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4 pt-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
            {/* SVG Wave Chart */}
            <div className="md:col-span-3">
              <div className="w-full h-28 relative">
                <svg viewBox="0 0 360 90" className="w-full h-full overflow-visible" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#6366f1" stopOpacity="0.3" />
                      <stop offset="100%" stopColor="#6366f1" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>
                  <path d={dayDistribution.areaD} fill="url(#trendGradient)" />
                  <path d={dayDistribution.pathD} fill="none" stroke="#6366f1" strokeWidth="2.5" strokeLinecap="round" />
                  {dayDistribution.points.map((pt, i) => (
                    <g key={i}>
                      <circle cx={pt.x} cy={pt.y} r="3.5" fill="#ffffff" stroke="#4f46e5" strokeWidth="2" />
                    </g>
                  ))}
                </svg>
              </div>
              <div className="flex justify-between items-center px-1 text-[10px] font-bold text-gray-400 mt-2">
                {dayDistribution.points.map((pt, i) => (
                  <span key={i} className="text-center">
                    {pt.day}
                    <span className="block text-[9px] text-gray-700 font-extrabold">{pt.count}</span>
                  </span>
                ))}
              </div>
            </div>

            {/* Quick Summary Pill */}
            <div className="space-y-3 bg-slate-50/70 p-4 rounded-xl border border-slate-200/80">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block">Peak Load Day</span>
              {(() => {
                const peak = [...dayDistribution.counts].sort((a, b) => b.slots - a.slots)[0];
                return (
                  <div>
                    <span className="text-xl font-black text-gray-900 block">{peak ? peak.fullDay : "—"}</span>
                    <span className="text-xs text-indigo-600 font-extrabold">{peak ? peak.slots : 0} scheduled sessions</span>
                  </div>
                );
              })()}
              <Button
                variant="outline"
                size="sm"
                onClick={() => onNavigateTab("schedules")}
                className="w-full text-xs font-bold"
              >
                Inspect Timetables →
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Split Screen: Campuses Breakdown & Hierarchy */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* Campuses Overview Card */}
        <div className="bg-white border border-slate-200/80 rounded-xl p-4 shadow-xs flex flex-col">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-indigo-600" />
              <h3 className="text-sm font-bold text-gray-900">Campus Breakdown</h3>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onNavigateTab("campuses")}
              className="text-xs text-indigo-600 font-bold"
            >
              All Campuses →
            </Button>
          </div>
          <div className="space-y-3 flex-grow overflow-y-auto max-h-[300px] pr-1">
            {colleges.map(col => {
              const colMentors = mentors.filter(m => m.college_id === col.id);
              const colSlots = slots.filter(s => colMentors.some(m => m.id === s.mentorId));
              return (
                <div
                  key={col.id}
                  className="flex items-center justify-between p-3 bg-gray-50/50 hover:bg-gray-50 transition-all rounded-xl border border-gray-200/60"
                >
                  <div>
                    <span className="font-extrabold text-gray-900 block">{col.name}</span>
                    <span className="text-[10px] text-gray-400 font-semibold">{col.address || "No address"}</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="bg-teal-50 border border-teal-100 text-teal-700 px-2 py-0.5 rounded-full text-[9px] font-bold whitespace-nowrap">
                      {colMentors.length} Mentors
                    </span>
                    <span className="bg-indigo-50 border border-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full text-[9px] font-bold whitespace-nowrap">
                      {colSlots.length} Slots
                    </span>
                  </div>
                </div>
              );
            })}
            {colleges.length === 0 && (
              <p className="text-gray-500 italic text-center py-8">No colleges registered yet.</p>
            )}
          </div>
        </div>

        {/* Hierarchy Quick Tree */}
        <div className="bg-white border border-slate-200/80 rounded-xl p-4 shadow-xs flex flex-col">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <Network className="h-5 w-5 text-indigo-600" />
              <h3 className="text-sm font-bold text-gray-900">System Hierarchy</h3>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onNavigateTab("hierarchy")}
              className="text-xs text-indigo-600 font-bold"
            >
              Full Tree →
            </Button>
          </div>
          <p className="text-[10px] text-gray-500 font-semibold mb-3 leading-relaxed">
            Reporting Chain of Command (Super Admin → Key Account Managers → Campuses)
          </p>
          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 shadow-inner space-y-3 max-h-[300px] overflow-y-auto text-xs">
            {/* Super Admin Level */}
            <div className="space-y-2">
              <div
                onClick={() => toggleNode("admin")}
                className="flex items-center gap-2 p-2.5 bg-white border border-indigo-200 rounded-xl shadow-xs cursor-pointer hover:border-indigo-300 transition-all"
              >
                {expandedNodes["admin"] ? (
                  <ChevronDown className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
                )}
                <div className="h-6 w-6 rounded-full bg-indigo-600 text-white flex items-center justify-center font-black text-[9px] shrink-0">
                  SU
                </div>
                <div className="min-w-0">
                  <div className="font-bold text-gray-900 text-xs truncate">Super Admin</div>
                  <div className="text-[9px] text-gray-500 truncate">{currentAdmin?.name || "System Admin"}</div>
                </div>
              </div>

              {expandedNodes["admin"] && (
                <div className="pl-6 border-l border-dashed border-gray-300 ml-4 space-y-2 pt-1">
                  {kamList.map((kam: any) => {
                    const kamNodeId = `kam-${kam.id}`;
                    const kamColleges = colleges.filter(c => c.kam_id === kam.id);
                    return (
                      <div key={kam.id} className="space-y-1">
                        <div
                          onClick={() => toggleNode(kamNodeId)}
                          className="flex items-center gap-2 p-2 bg-white border border-gray-200 rounded-xl shadow-xs cursor-pointer hover:border-indigo-200 transition-all"
                        >
                          {expandedNodes[kamNodeId] ? (
                            <ChevronDown className="h-3 w-3 text-gray-500 shrink-0" />
                          ) : (
                            <ChevronRight className="h-3 w-3 text-gray-500 shrink-0" />
                          )}
                          <div className="h-5 w-5 rounded-full bg-amber-500 text-white flex items-center justify-center font-black text-[8px] shrink-0">
                            KAM
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-gray-900 text-[10.5px] truncate">{kam.name}</div>
                            <div className="text-[8.5px] text-gray-400 truncate">{kamColleges.length} Campus(es)</div>
                          </div>
                        </div>
                        {expandedNodes[kamNodeId] && (
                          <div className="pl-6 border-l border-dashed border-gray-300 ml-3 space-y-1 pt-1">
                            {kamColleges.map(col => (
                              <div
                                key={col.id}
                                className="flex items-center gap-1.5 p-1.5 bg-white border border-gray-200 rounded-lg text-[9.5px] text-gray-700"
                              >
                                <Building2 className="h-3 w-3 text-gray-500 shrink-0" />
                                <span className="font-extrabold truncate">{col.name}</span>
                              </div>
                            ))}
                            {kamColleges.length === 0 && (
                              <span className="text-[9px] text-gray-500 italic pl-2 block">No campuses assigned</span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {kamList.length === 0 && (
                    <span className="text-[9.5px] text-gray-500 italic pl-2 block">
                      No Key Account Managers registered
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Recent Audit Logs Summary */}
      <Card className="shadow-sm">
        <CardHeader className="p-4 pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <History className="h-5 w-5 text-indigo-600" />
              <CardTitle className="text-sm font-extrabold text-gray-900">Recent Audit Logs</CardTitle>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onNavigateTab("logs")}
              className="text-xs text-indigo-600 font-bold"
            >
              View All Logs →
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <div className="overflow-x-auto rounded-xl border border-slate-200/80">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>Actor</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Description</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentLogs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="h-32 text-center">
                      <div className="flex flex-col items-center gap-2 text-gray-400">
                        <History className="h-8 w-8" />
                        <p className="text-sm font-semibold">No logs recorded yet.</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  recentLogs.map((log: any) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-gray-500 whitespace-nowrap">{formatDate(log.timestamp)}</TableCell>
                      <TableCell className="font-bold text-gray-900">{log.actorName || log.actor_name || "System"}</TableCell>
                      <TableCell>
                        <Badge variant="default" className="text-[9px]">
                          {formatRoleLabel(log.actorRole || log.actor_role)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-gray-600">{log.description}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
