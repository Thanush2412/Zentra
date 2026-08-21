"use client";

import React, { useState, useEffect } from "react";
import { Search, Filter, User, AlertTriangle, Eye, ArrowUpDown, ChevronRight, Building2, FileSpreadsheet } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { Student360 } from "./Student360";

interface StudentDirectoryProps {
  initialCollegeId?: string;
  initialDepartment?: string;
  initialClassGroup?: string;
  initialRiskFilter?: string;
}

export const StudentDirectory: React.FC<StudentDirectoryProps> = ({
  initialCollegeId,
  initialDepartment,
  initialClassGroup,
  initialRiskFilter
}) => {
  const { colleges } = useApp ? useApp() : { colleges: [] };
  const [selectedCollegeId, setSelectedCollegeId] = useState(initialCollegeId || "all");
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [riskFilter, setRiskFilter] = useState(initialRiskFilter || "all");
  const [distribution, setDistribution] = useState<any>({ healthy: 0, atRisk: 0, critical: 0, total: 0 });
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function fetchStudents() {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (selectedCollegeId && selectedCollegeId !== "all") params.append("collegeId", selectedCollegeId);
        if (initialDepartment && initialDepartment !== "all") params.append("department", initialDepartment);
        if (initialClassGroup && initialClassGroup !== "all") params.append("classGroup", initialClassGroup);
        if (riskFilter !== "all") params.append("risk", riskFilter);
        if (search.trim()) params.append("q", search.trim());
        params.append("limit", "100");

        const res = await fetch(`/api/kam/students?${params.toString()}`);
        const json = await res.json();
        if (json.success && isMounted) {
          setStudents(json.students || []);
          setDistribution(json.distribution || { healthy: 0, atRisk: 0, critical: 0, total: 0 });
        }
      } catch (e) {
        console.error("Failed to load students:", e);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    const timer = setTimeout(fetchStudents, 200);
    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [selectedCollegeId, initialDepartment, initialClassGroup, riskFilter, search]);

  const handleExportStudents = async () => {
    try {
      const XLSX = await import("xlsx");
      const headers = [
        "Sl. No.",
        "Roll No",
        "Register No",
        "Student Name",
        "Email",
        "Phone",
        "Institution",
        "Department",
        "Batch / Cohort",
        "Total Conducted Periods",
        "Present Periods",
        "Absent Periods",
        "OD Periods",
        "Attendance %",
        "Risk Tier"
      ];

      const rows = students.map((st, idx) => [
        idx + 1,
        st.rollNumber || st.id,
        st.registerNumber || "—",
        st.name,
        st.email || "—",
        st.phone || "—",
        st.collegeName || "—",
        st.department || "General",
        st.classGroup || "General Batch",
        st.totalMarks || 0,
        st.presentMarks || 0,
        st.absentMarks || 0,
        st.odMarks || 0,
        st.attendancePct >= 0 ? `${st.attendancePct}%` : "No Data",
        st.risk.toUpperCase()
      ]);

      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Students Directory");
      XLSX.writeFile(wb, `Student_Directory_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (err: any) {
      console.error("Export failed:", err);
    }
  };

  return (
    <div className="space-y-4">
      {/* Risk Filter Chips & College Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Embedded College Selector */}
          <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
            <Building2 className="h-3.5 w-3.5 text-[#D528A2]" />
            <select
              value={selectedCollegeId}
              onChange={e => setSelectedCollegeId(e.target.value)}
              className="text-xs font-bold text-slate-800 bg-transparent outline-none cursor-pointer"
            >
              <option value="all">🏢 All Campuses ({colleges.length})</option>
              {colleges.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="hidden sm:block w-px h-6 bg-slate-200" />

          <span className="text-xs font-black uppercase tracking-wider text-slate-400 mr-1">Risk:</span>
          {[
            { key: "all", label: "All Students", count: distribution.total, color: "bg-slate-100 text-slate-700" },
            { key: "healthy", label: "Healthy (≥75%)", count: distribution.healthy, color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
            { key: "at_risk", label: "At Risk (60-74%)", count: distribution.atRisk, color: "bg-amber-50 text-amber-700 border-amber-200" },
            { key: "critical", label: "Critical (<60%)", count: distribution.critical, color: "bg-rose-50 text-rose-700 border-rose-200" }
          ].map(r => {
            const isActive = riskFilter === r.key;
            return (
              <button
                key={r.key}
                onClick={() => setRiskFilter(r.key)}
                className={`px-3 py-1.5 rounded-xl text-xs font-extrabold border transition-all cursor-pointer ${
                  isActive
                    ? "bg-indigo-600 text-white border-indigo-600 shadow-sm shadow-indigo-100"
                    : `${r.color} hover:opacity-80`
                }`}
              >
                {r.label} ({r.count || 0})
              </button>
            );
          })}
        </div>

        {/* Search & Export Actions */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search name, roll no, reg no…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <button
            type="button"
            onClick={handleExportStudents}
            disabled={students.length === 0}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-extrabold transition-all cursor-pointer shadow-2xs shrink-0 disabled:opacity-50"
          >
            <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
            <span className="hidden sm:inline">Export Excel</span>
          </button>
        </div>
      </div>

      {/* Students Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-black uppercase text-[10px] tracking-wider">
                <th className="py-3 px-4">Student</th>
                <th className="py-3 px-3">Roll / Reg No</th>
                <th className="py-3 px-3">Campus & Dept</th>
                <th className="py-3 px-3">Batch / Cohort</th>
                <th className="py-3 px-3 text-center">Marks Logged</th>
                <th className="py-3 px-3 text-center">Attendance %</th>
                <th className="py-3 px-3 text-center">Risk Status</th>
                <th className="py-3 px-4 text-right">360° Profile</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400 font-bold">
                    <div className="h-6 w-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    Loading student directory…
                  </td>
                </tr>
              ) : students.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400 font-bold">
                    No students match the selected filters or search query.
                  </td>
                </tr>
              ) : (
                students.map(st => (
                  <tr
                    key={st.id}
                    onClick={() => setSelectedStudentId(st.id)}
                    className="hover:bg-indigo-50/40 cursor-pointer transition-colors group"
                  >
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2.5">
                        <div className="h-7 w-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xs">
                          <User className="h-3.5 w-3.5" />
                        </div>
                        <div>
                          <p className="font-extrabold text-slate-900 group-hover:text-indigo-600 transition-colors">
                            {st.name}
                          </p>
                          <p className="text-[10px] text-slate-400 font-medium">{st.email || "No email"}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <span className="font-mono text-[11px] font-bold text-slate-800 bg-slate-100 px-1.5 py-0.5 rounded">
                        {st.rollNumber}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <p className="text-xs font-bold text-slate-800 line-clamp-1">{st.collegeName}</p>
                      <p className="text-[10px] text-slate-400">{st.department}</p>
                    </td>
                    <td className="py-3 px-3 text-slate-600 text-[11px]">
                      {st.classGroup}
                    </td>
                    <td className="py-3 px-3 text-center font-bold text-slate-800">
                      {st.totalMarks}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className={`font-black text-xs ${
                        st.attendancePct >= 75
                          ? "text-emerald-600"
                          : st.attendancePct >= 60
                          ? "text-amber-600"
                          : "text-rose-600"
                      }`}>
                        {st.attendancePct >= 0 ? `${st.attendancePct}%` : "—"}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                        st.risk === "healthy"
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          : st.risk === "at_risk"
                          ? "bg-amber-50 text-amber-700 border border-amber-200"
                          : st.risk === "critical"
                          ? "bg-rose-50 text-rose-700 border border-rose-200"
                          : "bg-slate-100 text-slate-500"
                      }`}>
                        {st.risk.replace("_", " ")}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedStudentId(st.id);
                        }}
                        className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white transition-all cursor-pointer"
                        title="View Student 360"
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Student 360 Modal */}
      {selectedStudentId && (
        <Student360
          studentId={selectedStudentId}
          onClose={() => setSelectedStudentId(null)}
        />
      )}
    </div>
  );
};
