"use client";

import React, { useState, useEffect } from "react";
import { UserCheck, Clock, Calendar, AlertTriangle, CheckCircle2, XCircle, Award, User, Search, ArrowUpRight } from "lucide-react";

export const KAMFacultyGovernance: React.FC<{
  initialSubTab?: "punch" | "leaves" | "demos";
  selectedCollegeId?: string;
  kamId?: string;
  onOpenMentor360?: (mentorId: string) => void;
}> = ({ initialSubTab = "punch", selectedCollegeId = "all", kamId, onOpenMentor360 }) => {
  const [subTab, setSubTab] = useState<"punch" | "leaves" | "demos">(initialSubTab);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    setSubTab(initialSubTab);
  }, [initialSubTab]);

  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (selectedCollegeId !== "all") params.set("collegeId", selectedCollegeId);
        if (kamId) params.set("kamId", kamId);
        const query = params.toString() ? `?${params.toString()}` : "";
        const res = await fetch(`/api/kam/faculty-governance${query}`);
        const json = await res.json();
        if (json.success && isMounted) {
          setData(json);
        }
      } catch (err) {
        console.error("Failed to load faculty governance data:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    loadData();
    return () => { isMounted = false; };
  }, [selectedCollegeId, kamId]);

  const punchSummary = data?.punchSummary || {
    totalFaculty: 0,
    presentToday: 0,
    odToday: 0,
    leaveToday: 0,
    latePunchesToday: 0,
    missingPunchesToday: 0,
    punchRatePct: 0
  };

  const mentorPunchRoster: any[] = data?.mentorPunchRoster || [];
  const upcomingLeaves: any[] = data?.upcomingLeaves || [];
  const demoSummary = data?.demoSummary || { totalDemos: 0, completedDemos: 0, avgDemoScore: 0 };
  const demoRoster: any[] = data?.demoRoster || [];

  const filteredPunchRoster = mentorPunchRoster.filter(m =>
    !search || m.name.toLowerCase().includes(search.toLowerCase()) || m.department.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Sub-tab Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
        {[
          { key: "punch", label: "Faculty Daily Punch & Biometrics", icon: UserCheck },
          { key: "leaves", label: "14-Day Leave & Coverage Radar", icon: Calendar },
          { key: "demos", label: "SME Demo Teaching Quality", icon: Award }
        ].map(t => {
          const Icon = t.icon;
          const isActive = subTab === t.key;
          return (
            <button
              key={t.key}
              type="button"
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

      {/* ── SUB-TAB 1: FACULTY PUNCH IN & BIOMETRICS ── */}
      {subTab === "punch" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-[10px] font-black uppercase text-slate-400">Faculty Presence Today</span>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-black text-slate-900">{punchSummary.punchRatePct}%</span>
                <span className="text-xs font-bold text-emerald-600">On Campus</span>
              </div>
              <p className="text-[10px] font-bold text-slate-400 mt-1">{punchSummary.presentToday + punchSummary.odToday} / {punchSummary.totalFaculty} Active Mentors</p>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-[10px] font-black uppercase text-slate-400">Late Punches Today</span>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-black text-amber-700">{punchSummary.latePunchesToday}</span>
                <span className="text-xs font-bold text-amber-600">&gt;30m Window</span>
              </div>
              <p className="text-[10px] font-bold text-slate-400 mt-1">Requires CAM late justification</p>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-[10px] font-black uppercase text-slate-400">Faculty On Leave / OD</span>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-black text-indigo-700">{punchSummary.leaveToday + punchSummary.odToday}</span>
                <span className="text-xs font-bold text-indigo-600">Instructors</span>
              </div>
              <p className="text-[10px] font-bold text-slate-400 mt-1">{punchSummary.odToday} OD • {punchSummary.leaveToday} Approved Leave</p>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-[10px] font-black uppercase text-slate-400">Missing / Unmarked</span>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-black text-rose-700">{punchSummary.missingPunchesToday}</span>
                <span className="text-xs font-bold text-rose-500">Unpunched</span>
              </div>
              <p className="text-[10px] font-bold text-slate-400 mt-1">Unaccounted session absence</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-black text-slate-900">Faculty Daily Punch Log & Punctuality</h3>
                <p className="text-xs text-slate-400 font-medium">Real-time daily check-in timestamps and punctuality status across institutions</p>
              </div>
              <div className="relative">
                <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search faculty name..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none w-56"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50/80 text-[10px] font-black uppercase text-slate-400 border-b border-slate-200">
                    <th className="py-3 px-3">Faculty Name</th>
                    <th className="py-3 px-3">Department & Campus</th>
                    <th className="py-3 px-3 text-center">Status</th>
                    <th className="py-3 px-3 text-center">Punch In Time</th>
                    <th className="py-3 px-3 text-center">Punctuality</th>
                    <th className="py-3 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                  {filteredPunchRoster.map(m => (
                    <tr key={m.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-3">
                        <p className="font-black text-slate-900">{m.name}</p>
                        <p className="text-[10px] text-slate-400 font-medium">{m.email}</p>
                      </td>
                      <td className="py-3 px-3">
                        <p className="font-bold text-slate-700">{m.department}</p>
                        <p className="text-[10px] text-slate-400">{m.collegeName}</p>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                          m.status.toLowerCase() === "present"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : m.status.toLowerCase() === "od"
                            ? "bg-indigo-50 text-indigo-700 border border-indigo-200"
                            : m.status.toLowerCase() === "leave"
                            ? "bg-amber-50 text-amber-700 border border-amber-200"
                            : "bg-rose-50 text-rose-700 border border-rose-200"
                        }`}>
                          {m.status}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center font-bold text-slate-800">
                        {m.punchTime}
                      </td>
                      <td className="py-3 px-3 text-center">
                        {m.isLate ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-50 text-amber-700 border border-amber-200">
                            ⚠️ Late Punch
                          </span>
                        ) : m.status.toLowerCase() === "present" ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200">
                            🟢 On Time
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[10px]">—</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <button
                          type="button"
                          onClick={() => onOpenMentor360 && onOpenMentor360(m.id)}
                          className="px-2 py-1 rounded-lg bg-indigo-50 text-indigo-700 font-bold hover:bg-indigo-100 transition-colors text-[10px] cursor-pointer"
                        >
                          Mentor 360°
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── SUB-TAB 2: 14-DAY UPCOMING LEAVE & COVERAGE RADAR ── */}
      {subTab === "leaves" && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-sm font-black text-slate-900">Upcoming 14-Day Faculty Leave Schedule & Substitution Coverage</h3>
            <p className="text-xs text-slate-400 font-medium">Preventing unstaffed classroom blackouts by tracking coverage assignments</p>
          </div>

          {upcomingLeaves.length === 0 ? (
            <div className="py-12 text-center text-xs font-bold text-slate-400">No scheduled upcoming leaves for the next 14 days.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50/80 text-[10px] font-black uppercase text-slate-400 border-b border-slate-200">
                    <th className="py-3 px-3">Faculty Member</th>
                    <th className="py-3 px-3">Campus & Dept</th>
                    <th className="py-3 px-3">Leave Dates</th>
                    <th className="py-3 px-3">Category</th>
                    <th className="py-3 px-3">Reason</th>
                    <th className="py-3 px-3 text-center">Coverage Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                  {upcomingLeaves.map(lr => (
                    <tr key={lr.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-3 font-black text-slate-900">{lr.mentorName}</td>
                      <td className="py-3 px-3">
                        <p className="font-bold text-slate-700">{lr.department}</p>
                        <p className="text-[10px] text-slate-400">{lr.collegeName}</p>
                      </td>
                      <td className="py-3 px-3 font-bold text-indigo-600">
                        {lr.startDate} → {lr.endDate}
                      </td>
                      <td className="py-3 px-3 font-bold text-slate-700">{lr.leaveCategory}</td>
                      <td className="py-3 px-3 text-slate-500 text-[11px] max-w-xs truncate">{lr.reason}</td>
                      <td className="py-3 px-3 text-center">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black ${
                          lr.coverageStatus.includes("Covered")
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : "bg-rose-50 text-rose-700 border border-rose-200"
                        }`}>
                          {lr.coverageStatus}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── SUB-TAB 3: SME DEMO TEACHING QUALITY ── */}
      {subTab === "demos" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-[10px] font-black uppercase text-slate-400">Total Demo Sessions</span>
              <p className="text-2xl font-black text-slate-900 mt-2">{demoSummary.totalDemos}</p>
              <p className="text-[10px] font-bold text-indigo-600 mt-1">Conducted by Subject Matter Experts</p>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-[10px] font-black uppercase text-slate-400">Completed Evaluations</span>
              <p className="text-2xl font-black text-emerald-700 mt-2">{demoSummary.completedDemos}</p>
              <p className="text-[10px] font-bold text-emerald-600 mt-1">Evaluated with structured rubrics</p>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-[10px] font-black uppercase text-slate-400">Average Quality Benchmark</span>
              <p className="text-2xl font-black text-indigo-700 mt-2">{demoSummary.avgDemoScore} / 100</p>
              <p className="text-[10px] font-bold text-slate-400 mt-1">Regional faculty quality index</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="text-sm font-black text-slate-900">SME Teaching Evaluation Feed</h3>
              <p className="text-xs text-slate-400 font-medium">Recent instructor teaching demonstrations and SME assessment feedback</p>
            </div>

            <div className="space-y-3">
              {demoRoster.map(d => (
                <div key={d.id} className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200 flex items-start justify-between gap-3 text-xs">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-black text-slate-900">{d.mentorName}</span>
                      <span className="text-[10px] text-slate-400">• Subject: {d.subject}</span>
                    </div>
                    <p className="text-[11px] text-slate-600 mt-1 italic">"{d.comments}"</p>
                    <p className="text-[10px] text-slate-400 font-bold mt-1">Evaluator: {d.smeName} • {d.dateStr} {d.timeSlot}</p>
                  </div>
                  <span className="px-2.5 py-1 rounded-xl text-xs font-black bg-indigo-50 text-indigo-700 border border-indigo-200 shrink-0">
                    {d.marks} / 100
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
