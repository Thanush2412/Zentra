"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Briefcase,
  Search,
  RefreshCw,
  Download,
  AlertTriangle,
  CheckCircle2,
  Building2,
  ExternalLink,
  GraduationCap,
  Award,
  Users,
  TrendingUp,
  FileSpreadsheet,
  X,
  FileText,
  User,
  MessageSquare
} from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid
} from "recharts";
import { useToast } from "@/context/ToastContext";

export interface CAMPlacementPanelProps {
  activeCollegeName?: string;
}

export const CAMPlacementPanel: React.FC<CAMPlacementPanelProps> = ({
  activeCollegeName
}) => {
  const { toast } = useToast();

  const [placementData, setPlacementData] = useState<any | null>(null);
  const [placementLoading, setPlacementLoading] = useState<boolean>(false);
  const [placementError, setPlacementError] = useState<string>("");

  // Filters matching Attendance tab pattern
  const [selectedPassingYear, setSelectedPassingYear] = useState<string>("all");
  const [selectedDegree, setSelectedDegree] = useState<string>("all");
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Student details modal matching Attendance pattern (selectedStudentForModal)
  const [selectedStudentForModal, setSelectedStudentForModal] = useState<any | null>(null);

  const fetchPlacementData = async (
    college = activeCollegeName,
    year = selectedPassingYear,
    degree = selectedDegree
  ) => {
    if (!college) return;
    setPlacementLoading(true);
    setPlacementError("");
    try {
      const q = `/api/audit/placement?college=${encodeURIComponent(college)}&passingYear=${encodeURIComponent(year)}&degree=${encodeURIComponent(degree)}`;
      const res = await fetch(q);
      const data = await res.json();
      if (data.success) {
        setPlacementData(data);
      } else {
        setPlacementError(data.message || "Failed to load placement data");
      }
    } catch (e: any) {
      setPlacementError("Network error while loading placement data: " + e.message);
    } finally {
      setPlacementLoading(false);
    }
  };

  useEffect(() => {
    fetchPlacementData();
  }, [activeCollegeName]);

  const summary = placementData?.summary || {
    totalStudents: 0,
    activeParticipants: 0,
    uniquePlacedCount: 0,
    unplacedCount: 0,
    optedOutCount: 0,
    placementRate: 0,
    totalOffersCount: 0,
    highestCtcLpa: 0,
    avgCtcLpa: 0,
    medianCtcLpa: 0,
    zeroArrearsCount: 0,
    withArrearsCount: 0,
    packageTiers: {
      superDream: 0,
      dream: 0,
      regular: 0
    }
  };

  const rawStudents = (placementData?.students || []) as any[];
  const availableYears = (placementData?.availablePassingYears || []) as number[];
  const availableDegrees = (placementData?.availableDegrees || []) as string[];
  const companyHighlights = (placementData?.companyHighlights || []) as any[];

  // Filtered roster
  const filteredRoster = useMemo(() => {
    return rawStudents.filter((s: any) => {
      const hasOffers = s.offers && s.offers.length > 0;
      const hasArrears = Number(s.current_arrears || 0) > 0;

      if (selectedPassingYear !== "all" && String(s.passing_year) !== selectedPassingYear) return false;
      if (selectedDegree !== "all" && s.degrees?.name !== selectedDegree) return false;

      if (selectedStatusFilter === "placed" && !hasOffers) return false;
      if (selectedStatusFilter === "unplaced" && hasOffers) return false;
      if (selectedStatusFilter === "zero" && hasArrears) return false;
      if (selectedStatusFilter === "arrears" && !hasArrears) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = (s.full_name || "").toLowerCase().includes(q);
        const matchRoll = (s.roll_number || "").toLowerCase().includes(q);
        const matchEmail = (s.email || "").toLowerCase().includes(q);
        const matchDeg = (s.degrees?.name || "").toLowerCase().includes(q);
        if (!matchName && !matchRoll && !matchEmail && !matchDeg) return false;
      }
      return true;
    });
  }, [rawStudents, selectedPassingYear, selectedDegree, selectedStatusFilter, searchQuery]);

  // Export handlers matching Attendance tab
  const exportPlacementData = async (format: "csv" | "excel" | "pdf") => {
    if (filteredRoster.length === 0) {
      toast("No placement records available to export", "error");
      return;
    }

    if (format === "csv") {
      const headers = ["S.No", "Student Name", "Register No", "Degree", "Branch", "Batch", "CGPA", "Current Arrears", "Offers Count", "Company Packages"];
      const rows = filteredRoster.map((s, idx) => [
        idx + 1,
        `"${s.full_name || ""}"`,
        `"${s.roll_number || ""}"`,
        `"${s.degrees?.name || ""}"`,
        `"${s.branches?.name || ""}"`,
        s.passing_year || "",
        s.overall_cgpa != null ? s.overall_cgpa : "",
        s.current_arrears ?? 0,
        s.offers?.length || 0,
        `"${(s.offers || []).map((o: any) => `${o.company_name} (${o.ctc_lpa || 0} LPA)`).join(", ")}"`
      ]);

      const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `Placement_Report_${(activeCollegeName || "Campus").replace(/[^a-zA-Z0-9]/g, "_")}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast("Placement report exported as CSV", "success");
      return;
    }

    if (format === "excel") {
      try {
        const XLSX = await import("xlsx");
        const rows = filteredRoster.map((s: any, idx: number) => ({
          "S.No": idx + 1,
          "Student Name": s.full_name || "—",
          "Register No": s.roll_number || "—",
          "Degree": s.degrees?.name || "—",
          "Branch": s.branches?.name || "—",
          "Batch": s.passing_year || "—",
          "CGPA": s.overall_cgpa ?? "—",
          "Current Arrears": s.current_arrears ?? 0,
          "Eligibility Status": Number(s.current_arrears || 0) === 0 ? "Eligible (0 Arrears)" : "At Risk",
          "Drive Participation": s.participation_status || "—",
          "Offers Count": s.offers?.length || 0,
          "Companies & CTC": (s.offers || []).map((o: any) => `${o.company_name} (${o.ctc_lpa || 0} LPA)`).join(", ") || "—"
        }));

        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "PlacementReport");
        const fname = `Placement_Roster_${(activeCollegeName || "Campus").replace(/[^a-zA-Z0-9]/g, "_")}.xlsx`;
        XLSX.writeFile(wb, fname);
        toast(`Placement report exported as ${fname}`, "success");
      } catch (e: any) {
        toast("Failed to export Excel: " + e.message, "error");
      }
      return;
    }

    if (format === "pdf") {
      window.print();
    }
  };

  // Copy candidate alert notice (matching copyParentAlert in Attendance tab)
  const copyCandidateNotice = (s: any) => {
    const text = `*CAMPUS PLACEMENT & RECRUITMENT NOTICE - ${activeCollegeName}*\n\nCandidate: *${s.full_name}* (Reg No: *${s.roll_number || "N/A"}*)\nDepartment: *${s.degrees?.name || ""} ${s.branches?.name || ""}*\nAcademic CGPA: *${s.overall_cgpa ?? "N/A"}* | Standing Arrears: *${s.current_arrears ?? 0}*\nPlacement Status: *${(s.offers && s.offers.length > 0) ? `Placed (${s.offers.length} Offers)` : "In Active Drive Pipeline"}*\nOffers: ${(s.offers || []).map((o: any) => `${o.company_name} (${o.ctc_lpa || 0} LPA)`).join(", ") || "Awaiting Drive Selection"}`;
    navigator.clipboard.writeText(text);
    toast("Candidate placement summary copied to clipboard!", "success");
  };

  // Recharts Data 1: Package Tiers Donut (matching Attendance Risk Tiers Donut)
  const pkgTiers = summary.packageTiers || { superDream: 0, dream: 0, regular: 0 };
  const packageTierDonutData = [
    { name: "Super Dream (≥8 LPA)", value: pkgTiers.superDream || 0, color: "#8b5cf6" },
    { name: "Dream (5–8 LPA)", value: pkgTiers.dream || 0, color: "#3b82f6" },
    { name: "Regular (<5 LPA)", value: pkgTiers.regular || 0, color: "#06b6d4" },
    { name: "Awaiting Offer", value: Math.max(0, summary.totalStudents - summary.uniquePlacedCount), color: "#94a3b8" }
  ].filter(d => d.value > 0);

  // Recharts Data 2: Top Recruiters Bar Chart (matching Shortage by Cohort Bar Chart)
  const topCompaniesBarData = companyHighlights.slice(0, 6).map(c => ({
    company: c.company.length > 12 ? c.company.substring(0, 10) + "…" : c.company,
    offers: c.offersCount,
    maxCtc: c.maxCtc
  }));

  return (
    <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs space-y-5">
      {/* ──────────────────────── HEADER (MATCHING ATTENDANCE TAB EXACTLY) ──────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100 shrink-0">
              <Briefcase className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 leading-tight">
                Campus Placements &amp; Recruitment Roster
              </h3>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Official tracking of student placement readiness, company offers, and recruitment eligibility.
              </p>
            </div>
          </div>
        </div>

        {/* Export Buttons (Matching Attendance Tab) */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => exportPlacementData("csv")}
            className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 text-xs font-bold hover:bg-slate-50 transition-all cursor-pointer flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>CSV</span>
          </button>
          <button
            type="button"
            onClick={() => exportPlacementData("excel")}
            className="px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span>Download Excel (.xlsx)</span>
          </button>
          <button
            type="button"
            onClick={() => exportPlacementData("pdf")}
            className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Official Placement Report (PDF)</span>
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {placementError && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs font-bold text-rose-700">
          {placementError}
        </div>
      )}

      {/* ──────────────────────── 4 KPI SUMMARY CARDS (MATCHING ATTENDANCE TAB EXACTLY) ──────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 rounded-xl bg-slate-50/70 border border-slate-200">
          <span className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">Total Registered</span>
          <p className="text-xl font-black text-slate-900 mt-1">{summary.totalStudents}</p>
          <span className="text-[10px] text-slate-500 font-bold">{summary.activeParticipants} Active in Drives</span>
        </div>
        <div className="p-4 rounded-xl bg-purple-50/60 border border-purple-200">
          <span className="text-[10px] font-extrabold uppercase text-purple-700 tracking-wider">Placed Students</span>
          <p className="text-xl font-black text-purple-700 mt-1">{summary.uniquePlacedCount}</p>
          <span className="text-[10px] text-purple-600 font-bold">{summary.placementRate}% Placement Rate</span>
        </div>
        <div className="p-4 rounded-xl bg-emerald-50/60 border border-emerald-200">
          <span className="text-[10px] font-extrabold uppercase text-emerald-700 tracking-wider">Zero Backlogs (Eligible)</span>
          <p className="text-xl font-black text-emerald-800 mt-1">{summary.zeroArrearsCount}</p>
          <span className="text-[10px] text-emerald-700 font-medium">100% Core &amp; IT Eligible</span>
        </div>
        <div className="p-4 rounded-xl bg-blue-50/50 border border-blue-200">
          <span className="text-[10px] font-extrabold uppercase text-blue-700 tracking-wider">Highest / Avg CTC</span>
          <p className="text-xl font-black text-blue-700 mt-1">
            {summary.highestCtcLpa > 0 ? `${summary.highestCtcLpa} LPA` : "—"}
          </p>
          <span className="text-[10px] text-slate-500 font-medium truncate block">
            {summary.avgCtcLpa > 0 ? `Avg: ${summary.avgCtcLpa} LPA` : "Ongoing Season"}
          </span>
        </div>
      </div>

      {/* ──────────────────────── VISUAL ANALYTICS CHARTS GRID (MATCHING ATTENDANCE TAB EXACTLY) ──────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Chart 1: Placement Salary Tiers Donut */}
        <div className="bg-slate-50/60 p-4 rounded-xl border border-slate-200 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <span>Salary Package Tier Distribution</span>
            </h4>
            <span className="text-[10px] text-slate-400 font-bold">Total Offers: {summary.totalOffersCount}</span>
          </div>
          <div className="h-56 w-full">
            {packageTierDonutData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={packageTierDonutData}
                    cx="50%"
                    cy="50%"
                    innerRadius={48}
                    outerRadius={75}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {packageTierDonutData.map((entry, idx) => (
                      <Cell key={`tier-${idx}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ borderRadius: "8px", fontSize: "11px", fontWeight: "bold", border: "1px solid #e2e8f0" }}
                    formatter={(value: any, name: any) => [`${value} students`, name]}
                  />
                  <Legend
                    iconType="circle"
                    wrapperStyle={{ fontSize: "11px", fontWeight: 600, paddingTop: "8px" }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-400 font-bold">
                No tier data available yet
              </div>
            )}
          </div>
        </div>

        {/* Chart 2: Top Recruiting Companies Bar Chart */}
        <div className="bg-slate-50/60 p-4 rounded-xl border border-slate-200 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">
              <span>Top Recruiting Partners (Offers Released)</span>
            </h4>
            <span className="text-[10px] text-blue-600 font-bold">Company Hires</span>
          </div>
          <div className="h-56 w-full">
            {topCompaniesBarData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topCompaniesBarData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis
                    dataKey="company"
                    tick={{ fontSize: 10, fill: "#64748b", fontWeight: 600 }}
                    interval={0}
                    angle={-20}
                    textAnchor="end"
                  />
                  <YAxis tick={{ fontSize: 10, fill: "#64748b" }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ borderRadius: "8px", fontSize: "11px", fontWeight: "bold", border: "1px solid #e2e8f0" }}
                    formatter={(value: any, _, item: any) => [`${value} offers (Max: ${item.payload.maxCtc} LPA)`, "Offers"]}
                    labelFormatter={(label: any) => `Recruiter: ${label}`}
                  />
                  <Bar dataKey="offers" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-400 font-bold">
                No recruiter data in this selection
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ──────────────────────── FILTER STRIP (MATCHING ATTENDANCE TAB PATTERN) ──────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-1">
        {/* Passing Year */}
        <div>
          <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
            Passing Year / Batch
          </label>
          <select
            value={selectedPassingYear}
            onChange={e => setSelectedPassingYear(e.target.value)}
            className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
          >
            <option value="all">All Passing Years</option>
            {availableYears.map(yr => (
              <option key={yr} value={String(yr)}>
                Batch {yr}
              </option>
            ))}
          </select>
        </div>

        {/* Degree Filter */}
        <div>
          <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
            Degree / Stream
          </label>
          <select
            value={selectedDegree}
            onChange={e => setSelectedDegree(e.target.value)}
            className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
          >
            <option value="all">All Degrees ({availableDegrees.length})</option>
            {availableDegrees.map(deg => (
              <option key={deg} value={deg}>
                {deg}
              </option>
            ))}
          </select>
        </div>

        {/* Status Filter */}
        <div>
          <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
            Placement &amp; Arrear Filter
          </label>
          <select
            value={selectedStatusFilter}
            onChange={e => setSelectedStatusFilter(e.target.value)}
            className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
          >
            <option value="all">All Students</option>
            <option value="placed">Placed Only ({summary.uniquePlacedCount})</option>
            <option value="unplaced">Awaiting Placement ({Math.max(0, summary.totalStudents - summary.uniquePlacedCount)})</option>
            <option value="zero">Zero Backlogs Clean ({summary.zeroArrearsCount})</option>
            <option value="arrears">At-Risk (1+ Arrears) ({summary.withArrearsCount})</option>
          </select>
        </div>

        {/* Search */}
        <div>
          <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
            Search Student
          </label>
          <div className="relative">
            <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Roll no, name, degree..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* ──────────────────────── FULL INTERACTIVE TABLE (MATCHING ATTENDANCE TAB EXACTLY) ──────────────────────── */}
      <div className="overflow-x-auto border border-slate-200 rounded-xl">
        <table className="w-full text-left text-xs border-collapse">
          <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-black text-slate-500 uppercase tracking-wider">
            <tr>
              <th className="p-3 w-12 text-center">S.No</th>
              <th className="p-3">Student Name</th>
              <th className="p-3">Register No</th>
              <th className="p-3">Department</th>
              <th className="p-3 text-center">Batch</th>
              <th className="p-3 text-center">CGPA</th>
              <th className="p-3 text-center">Arrears</th>
              <th className="p-3 text-center">Offers</th>
              <th className="p-3 text-right">Placement Status</th>
              <th className="p-3 text-center">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-medium">
            {placementLoading && filteredRoster.length === 0 ? (
              <tr>
                <td colSpan={10} className="p-8 text-center text-slate-400 animate-pulse">
                  Loading placement data...
                </td>
              </tr>
            ) : filteredRoster.length === 0 ? (
              <tr>
                <td colSpan={10} className="p-8 text-center text-emerald-700 font-bold bg-emerald-50/30">
                  <CheckCircle2 className="w-6 h-6 mx-auto mb-1.5 text-emerald-600" />
                  No students found matching the selected placement criteria.
                </td>
              </tr>
            ) : (
              filteredRoster.map((s: any, idx: number) => {
                const hasArrears = Number(s.current_arrears || 0) > 0;
                const hasOffers = s.offers && s.offers.length > 0;

                return (
                  <tr key={`${s.id}_${idx}`} className="hover:bg-slate-50/60 transition-colors">
                    <td className="p-3 font-mono text-slate-400 text-center">{idx + 1}</td>
                    <td className="p-3">
                      <div className="font-bold text-slate-900">{s.full_name}</div>
                      <div className="text-[10px] text-slate-400 truncate max-w-[200px]">{s.email}</div>
                    </td>
                    <td className="p-3 font-mono text-slate-600 font-semibold">{s.roll_number || "—"}</td>
                    <td className="p-3">
                      <span className="font-bold text-slate-800">{s.degrees?.name || "—"}</span>
                      {s.branches?.name && (
                        <div className="text-[10px] text-slate-400">{s.branches.name}</div>
                      )}
                    </td>
                    <td className="p-3 text-center font-bold text-slate-700">{s.passing_year || "—"}</td>
                    <td className="p-3 text-center font-bold text-slate-800">
                      {s.overall_cgpa != null ? s.overall_cgpa : "—"}
                    </td>
                    <td className="p-3 text-center">
                      <span
                        className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase ${
                          hasArrears ? "bg-rose-100 text-rose-800 border border-rose-200" : "bg-emerald-100 text-emerald-800 border border-emerald-200"
                        }`}
                      >
                        {s.current_arrears ?? 0} {hasArrears ? "Arrears" : "Nil"}
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      {hasOffers ? (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-purple-100 text-purple-800 border border-purple-200">
                          {s.offers.length} Offer{s.offers.length > 1 ? "s" : ""}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-xs">—</span>
                      )}
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex flex-col items-end gap-1">
                        <span
                          className={`px-2.5 py-1 rounded-md text-[10px] font-black uppercase ${
                            hasOffers
                              ? "bg-purple-100 text-purple-800 border border-purple-200"
                              : hasArrears
                              ? "bg-amber-100 text-amber-800 border border-amber-200"
                              : "bg-blue-100 text-blue-800 border border-blue-200"
                          }`}
                        >
                          {hasOffers ? "Placed" : hasArrears ? "At Risk" : "Drive Active"}
                        </span>
                        <span className="text-[9px] text-slate-500 font-medium whitespace-nowrap">
                          {hasOffers
                            ? (s.offers[0]?.company_name || "Placed")
                            : hasArrears
                            ? "Need Remedial Clear"
                            : "Eligible for Drives"}
                        </span>
                      </div>
                    </td>
                    <td className="p-3 text-center">
                      <button
                        type="button"
                        onClick={() => setSelectedStudentForModal(s)}
                        title="View Detailed Student Profile & Placement Record"
                        className="px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[10px] font-bold transition-colors cursor-pointer"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ──────────────────────── MODAL: STUDENT PROFILE & RECORD (MATCHING ATTENDANCE TAB MODAL EXACTLY) ──────────────────────── */}
      {selectedStudentForModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">{selectedStudentForModal.full_name}</h3>
                  <p className="text-xs text-slate-500 font-mono">
                    Reg: {selectedStudentForModal.roll_number || selectedStudentForModal.id}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedStudentForModal(null)}
                className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Metrics */}
            <div className="grid grid-cols-3 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
              <div className="text-center">
                <span className="text-[10px] font-black uppercase text-slate-400">CGPA</span>
                <p className="text-xl font-black text-blue-700 mt-0.5">
                  {selectedStudentForModal.overall_cgpa != null ? selectedStudentForModal.overall_cgpa : "—"}
                </p>
              </div>
              <div className="text-center border-x border-slate-200">
                <span className="text-[10px] font-black uppercase text-slate-400">Arrears</span>
                <p className={`text-xl font-black mt-0.5 ${Number(selectedStudentForModal.current_arrears || 0) === 0 ? "text-emerald-700" : "text-rose-600"}`}>
                  {selectedStudentForModal.current_arrears ?? 0}
                </p>
              </div>
              <div className="text-center">
                <span className="text-[10px] font-black uppercase text-slate-400">Offers</span>
                <p className="text-xl font-black text-purple-700 mt-0.5">
                  {selectedStudentForModal.offers?.length || 0}
                </p>
              </div>
            </div>

            {/* Academic & Department details */}
            <div className="text-xs text-slate-600 space-y-1">
              <div>
                Campus: <strong className="text-slate-800">{activeCollegeName}</strong>
              </div>
              <div>
                Degree &amp; Branch: <strong className="text-slate-800">{selectedStudentForModal.degrees?.name || "—"} {selectedStudentForModal.branches?.name ? `(${selectedStudentForModal.branches.name})` : ""}</strong>
              </div>
              <div>
                Passing Batch: <strong className="text-slate-800">{selectedStudentForModal.passing_year || "—"}</strong>
              </div>
            </div>

            {/* Arrear / Clearance Alert */}
            {Number(selectedStudentForModal.current_arrears || 0) > 0 ? (
              <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="text-xs text-amber-900 leading-relaxed">
                  <strong>Arrear Remedial Notice:</strong> Candidate has <strong>{selectedStudentForModal.current_arrears} active arrear(s)</strong>. Must appear in supplementary examinations to restore full tier-1 placement eligibility.
                </div>
              </div>
            ) : (
              <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div className="text-xs text-emerald-900 leading-relaxed">
                  <strong>Zero Backlog Clearance:</strong> Candidate has cleared all semester examinations and is directly eligible for all on-campus corporate drives.
                </div>
              </div>
            )}

            {/* Semester-Wise Academic Breakdown (from student_semesters) */}
            {selectedStudentForModal.semesters && selectedStudentForModal.semesters.length > 0 && (
              <div className="space-y-2">
                <span className="text-xs font-black text-slate-700 uppercase tracking-wider block">
                  Semester Academic Ledger ({selectedStudentForModal.semesters.length} Semesters Verified)
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {selectedStudentForModal.semesters.map((sm: any, idx: number) => (
                    <div key={idx} className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-center">
                      <span className="text-[10px] font-black uppercase text-slate-400 block">
                        Sem {sm.semester_number}
                      </span>
                      <span className="text-sm font-black text-blue-700 block mt-0.5">
                        {sm.cgpa != null ? `${sm.cgpa} CGPA` : "—"}
                      </span>
                      <span className={`text-[9px] font-bold block ${Number(sm.current_arrears || 0) === 0 ? "text-emerald-700" : "text-rose-600"}`}>
                        {Number(sm.current_arrears || 0) === 0 ? "0 Arrears" : `${sm.current_arrears} Arrear`}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Placement Offers & Record */}
            <div className="space-y-2">
              <span className="text-xs font-black text-slate-700 uppercase tracking-wider block">Placement Record &amp; Offers</span>

              {selectedStudentForModal.offers && selectedStudentForModal.offers.length > 0 ? (
                <div className="space-y-2 max-h-36 overflow-y-auto">
                  {selectedStudentForModal.offers.map((off: any, oIdx: number) => (
                    <div key={oIdx} className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between text-xs">
                      <div>
                        <span className="font-bold text-slate-900 block">{off.company_name}</span>
                        <span className="text-[10px] text-slate-500">{off.role_title || "Campus Recruited"}</span>
                      </div>
                      <span className="font-black font-mono text-emerald-700 text-sm">
                        {off.ctc_lpa || 0} LPA
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600 text-center font-medium">
                  Candidate is currently active in the on-campus interview pipeline with zero finalized offers yet.
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setSelectedStudentForModal(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold cursor-pointer transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
