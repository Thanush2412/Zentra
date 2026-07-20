"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useApp } from "../context/AppContext";
import {
  DollarSign, TrendingUp, TrendingDown, Users, Building2, Search, Filter,
  Download, CheckCircle2, Clock, AlertCircle, ChevronDown, ChevronRight,
  Receipt, CreditCard, Wallet, PieChart, BarChart2, ArrowUpRight,
  X, Check, RefreshCw, FileText, Printer, Eye, IndianRupee, BadgePercent,
  School, CircleDollarSign, Activity, Target, Layers, ListFilter, Upload
} from "lucide-react";
import * as XLSX from "xlsx";

interface StudentFee {
  id: string;
  student_id: string;
  college_id: string;
  term_name: string;
  amount: number;
  paid_amount: number;
  due_date: string;
  status: "paid" | "partial" | "unpaid";
  created_at: string;
}

interface FeePayment {
  id: string;
  fee_id: string;
  student_id: string;
  college_id: string;
  amount: number;
  payment_method: string;
  reference_no: string;
  receipt_no: string;
  payment_date: string;
}

interface StudentRecord {
  id: string;
  name: string;
  email: string;
  classGroup: string;
  department: string;
  college_id: string;
  register_number?: string;
  phone?: string;
}

interface CollegeRecord {
  id: string;
  name: string;
}

interface CamRecord {
  id: string;
  name: string;
  email: string;
  college_id: string;
  college_name: string;
}

interface FeeStats {
  totalFees: number;
  totalPaid: number;
  totalOutstanding: number;
  paidCount: number;
  partialCount: number;
  unpaidCount: number;
  totalStudents: number;
}

type TabType = "overview" | "students" | "transactions" | "colleges";

const fmt = (n: number) =>
  "₹" + n.toLocaleString("en-IN", { maximumFractionDigits: 0 });

const StatusBadge = ({ status }: { status: string }) => {
  if (status === "paid")
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#D528A2]/10 text-[#D528A2] text-[10px] font-bold uppercase tracking-wider">
        <CheckCircle2 className="h-3 w-3" /> Paid
      </span>
    );
  if (status === "partial")
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#F4A863]/10 text-[#F4A863] text-[10px] font-bold uppercase tracking-wider">
        <Clock className="h-3 w-3" /> Partial
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-500 text-[10px] font-bold uppercase tracking-wider">
      <AlertCircle className="h-3 w-3" /> Unpaid
    </span>
  );
};

const MethodBadge = ({ method }: { method: string }) => {
  const colors: Record<string, string> = {
    online: "bg-[#D528A2]/10 text-[#D528A2]",
    cash: "bg-[#D528A2]/10 text-[#D528A2]",
    cheque: "bg-[#F4A863]/10 text-[#F4A863]",
    card: "bg-[#F4A863]/10 text-[#F4A863]",
  };
  return (
    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${colors[method] || "bg-slate-100 text-slate-500"}`}>
      {method}
    </span>
  );
};

const toTitleCase = (str: string) => {
  if (!str) return "";
  return str
    .toLowerCase()
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};

export interface FeeManagerDashboardProps {
  activeTab?: TabType;
  onTabChange?: (tab: TabType) => void;
}

export const FeeManagerDashboard: React.FC<FeeManagerDashboardProps> = ({
  activeTab: propActiveTab,
  onTabChange
}) => {
  const { colleges: ctxColleges, coursesList: ctxCourses, slots: ctxSlots, subjectsList: ctxSubjects } = useApp();

  const [localActiveTab, setLocalActiveTab] = useState<TabType>("overview");
  const activeTab = propActiveTab || localActiveTab;
  const setActiveTab = onTabChange || setLocalActiveTab;
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<{
    colleges: CollegeRecord[];
    students: StudentRecord[];
    fees: StudentFee[];
    payments: FeePayment[];
    cams: CamRecord[];
    stats: FeeStats;
  } | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [filterCollege, setFilterCollege] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterDept, setFilterDept] = useState("all");
  const [filterYear, setFilterYear] = useState("all");
  const [filterSemester, setFilterSemester] = useState("all");
  const [filterFeeStatus, setFilterFeeStatus] = useState("all");
  const [filterFromDate, setFilterFromDate] = useState("");
  const [filterToDate, setFilterToDate] = useState("");
  const [selectedStudent, setSelectedStudent] = useState<StudentRecord | null>(null);
  const [expandedStudentId, setExpandedStudentId] = useState<string | null>(null);
  const [selectedReportYear, setSelectedReportYear] = useState("2025-2027");

  // Individual Fee Editing States
  const [editingFeeId, setEditingFeeId] = useState<string | null>(null);
  const [editPaidAmount, setEditPaidAmount] = useState<string>("");
  const [editStatus, setEditStatus] = useState<string>("unpaid");
  const [savingFeeId, setSavingFeeId] = useState<string | null>(null);

  // Excel Bulk Upload States
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadStep, setUploadStep] = useState<1 | 2>(1);
  const [termName, setTermName] = useState("Semester I Tuition Fee");
  const [dueDate, setDueDate] = useState("2025-07-31");
  const [sheetHeaders, setSheetHeaders] = useState<string[]>([]);
  const [sheetRows, setSheetRows] = useState<any[][]>([]);
  const [colIndices, setColIndices] = useState<Record<string, number>>({});
  const [parsedData, setParsedData] = useState<any[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<any | null>(null);

  // Template Generation States
  const [selectedTemplateCollege, setSelectedTemplateCollege] = useState("");
  const [selectedTemplateDept, setSelectedTemplateDept] = useState("");
  const [selectedTemplateSem, setSelectedTemplateSem] = useState("");
  const [selectedTemplateYear, setSelectedTemplateYear] = useState("");

  // Dynamically extract unique departments STRICTLY from DB data (students + courses)
  const availableDepartments = useMemo(() => {
    const list = new Set<string>();
    
    // 1. From database students
    if (data?.students) {
      data.students.forEach(s => {
        if (s.department) {
          const clean = s.department.trim();
          const lower = clean.toLowerCase();
          // Filter out values representing years instead of departments
          if (!lower.includes("year") && !lower.includes("yr") && !/^\d+$/.test(lower)) {
            list.add(clean);
          }
        }
      });
    }
    
    // 2. From database courses list
    if (ctxCourses) {
      ctxCourses.forEach(c => {
        if (c.name) {
          const clean = c.name.trim();
          const lower = clean.toLowerCase();
          if (!lower.includes("year") && !lower.includes("yr")) {
            list.add(clean);
          }
        }
      });
    }

    return Array.from(list).filter(Boolean).sort();
  }, [data?.students, ctxCourses]);

  // Dynamically extract unique semesters STRICTLY from DB data (students + fees + slots + subjects)
  const availableSemesters = useMemo(() => {
    const list = new Set<string>();
    
    // 1. From student records
    if (data?.students) {
      data.students.forEach(s => {
        const sem = (s as any).semester;
        if (sem) list.add(sem.trim());
      });
    }

    // 2. From student fee terms
    if (data?.fees) {
      data.fees.forEach(f => {
        const term = f.term_name || "";
        if (term.toLowerCase().includes("tuition")) {
          const sem = term.split(/tuition/i)[0].trim();
          if (sem) list.add(sem);
        } else {
          list.add(term.trim());
        }
      });
    }

    // 3. From slots table
    if (ctxSlots) {
      ctxSlots.forEach(s => {
        if (s.semester) list.add(s.semester.trim());
      });
    }

    // 4. From subjects table
    if (ctxSubjects) {
      ctxSubjects.forEach(s => {
        if (s.semester) list.add(s.semester.trim());
      });
    }

    return Array.from(list).filter(Boolean).sort((a, b) => {
      const getOrder = (val: string) => {
        const lower = val.toLowerCase();
        if (lower.includes("viii")) return 8;
        if (lower.includes("vii")) return 7;
        if (lower.includes("vi")) return 6;
        if (lower.includes("iv")) return 4;
        if (lower.includes("v")) return 5;
        if (lower.includes("iii")) return 3;
        if (lower.includes("ii")) return 2;
        if (lower.includes("i")) return 1;
        // Parse digits: e.g. "Semester 3" -> 3
        const numMatch = val.match(/\d+/);
        if (numMatch) return Number(numMatch[0]);
        return 99;
      };
      return getOrder(a) - getOrder(b);
    });
  }, [data?.students, data?.fees, ctxSlots, ctxSubjects]);

  // Dynamically extract unique years/batches STRICTLY from DB data (students + fees + slots + subjects)
  const availableYears = useMemo(() => {
    const list = new Set<string>();
    
    // 1. From database students classGroup/year
    if (data?.students) {
      data.students.forEach(s => {
        if (s.classGroup) {
          // Extract "2024-2025" etc.
          const batchMatch = s.classGroup.match(/\d{4}-\d{4}/);
          if (batchMatch) {
            list.add(batchMatch[0].trim());
          }
          // Extract single 4-digit year like "2024"
          const yearMatch = s.classGroup.match(/\b\d{4}\b/);
          if (yearMatch) {
            list.add(yearMatch[0].trim());
          }
        }
        if ((s as any).batch_start_year && (s as any).batch_end_year) {
          list.add(`${(s as any).batch_start_year}-${(s as any).batch_end_year}`);
        } else if ((s as any).batch_start_year) {
          list.add(String((s as any).batch_start_year));
        }
      });
    }

    // 2. From fee invoice terms
    if (data?.fees) {
      data.fees.forEach(f => {
        if (f.term_name) {
          const batchMatch = f.term_name.match(/\d{4}-\d{4}/);
          if (batchMatch) {
            list.add(batchMatch[0]);
          } else {
            const yearMatch = f.term_name.match(/\b\d{4}\b/);
            if (yearMatch) list.add(yearMatch[0]);
          }
        }
      });
    }

    // 3. From database slots
    if (ctxSlots) {
      ctxSlots.forEach(s => {
        if (s.year) {
          const batchMatch = s.year.match(/\d{4}-\d{4}/);
          if (batchMatch) {
            list.add(batchMatch[0].trim());
          } else {
            const yearMatch = s.year.match(/\b\d{4}\b/);
            if (yearMatch) list.add(yearMatch[0].trim());
          }
        }
        if ((s as any).batch_start_year && (s as any).batch_end_year) {
          list.add(`${(s as any).batch_start_year}-${(s as any).batch_end_year}`);
        }
      });
    }

    // 4. From database subjects
    if (ctxSubjects) {
      ctxSubjects.forEach(s => {
        if ((s as any).year) {
          const str = String((s as any).year).trim();
          const batchMatch = str.match(/\d{4}-\d{4}/);
          if (batchMatch) {
            list.add(batchMatch[0]);
          } else {
            const yearMatch = str.match(/\b\d{4}\b/);
            if (yearMatch) list.add(yearMatch[0]);
          }
        }
      });
    }

    // If no years/batches are found in the database, add a fallback standard default batch
    if (list.size === 0) {
      list.add("2024-2025");
      list.add("2023-2024");
      list.add("2025-2026");
    }

    return Array.from(list).filter(Boolean).sort();
  }, [data?.students, data?.fees, ctxSlots, ctxSubjects]);

  const reportYears = useMemo(() => {
    const set = new Set(availableYears);
    set.add("2026-2027");
    set.add("2025-2027");
    set.add("2025-2026");
    return Array.from(set).sort();
  }, [availableYears]);

  const reportsData = useMemo(() => {
    if (!data) return null;

    let maxStudentCount = 10;
    let maxFeeAmount = 10000;

    const collegesList = data.colleges.map((col) => {
      const colStudents = data.students.filter((s) => s.college_id === col.id);
      
      const matchesYear = (student: StudentRecord, fee: any) => {
        if (fee.academic_year) {
          return fee.academic_year === selectedReportYear;
        }

        const studentGroup = (student.classGroup || "").toLowerCase();
        const targetYear = selectedReportYear.toLowerCase();
        
        if (studentGroup.includes(targetYear)) return true;
        
        const start = (student as any).batch_start_year;
        const end = (student as any).batch_end_year;
        if (start && end && `${start}-${end}` === selectedReportYear) return true;
        
        const term = (fee.term_name || "").toLowerCase();
        if (term.includes(targetYear)) return true;
        
        if (!studentGroup && !start) return true;

        return false;
      };

      const colFees = data.fees.filter((f) => {
        if (f.college_id !== col.id) return false;
        const student = data.students.find((s) => s.id === f.student_id);
        if (!student) return false;
        return matchesYear(student, f);
      });

      const collegeFeesTarget = colFees.reduce((s, f) => s + (f.amount || 0), 0);
      const fpcFeesTarget = colFees.reduce((s, f) => {
        const fpcTarget = (f as any).fpc_amount || (f as any).paid_amount || f.amount || 0;
        return s + fpcTarget;
      }, 0);
      const fpcFeesAchieved = colFees.reduce((s, f) => s + ((f as any).paid_amount || 0), 0);
      const collegeFeesAchieved = colFees.reduce((s, f) => {
        const fpcTarget = (f as any).fpc_amount || (f as any).paid_amount || f.amount || 0;
        if (f.status === "paid") {
          return s + (f.amount || 0);
        } else if (f.status === "partial" && fpcTarget > 0) {
          const ratio = ((f as any).paid_amount || 0) / fpcTarget;
          return s + Math.round((f.amount || 0) * ratio);
        }
        return s;
      }, 0);

      const paidCount = colFees.filter((f) => f.status === "paid").length;
      const pendingCount = colFees.filter((f) => f.status === "unpaid" || f.status === "partial").length;

      if (paidCount > maxStudentCount) maxStudentCount = paidCount;
      if (pendingCount > maxStudentCount) maxStudentCount = pendingCount;
      
      if (collegeFeesTarget > maxFeeAmount) maxFeeAmount = collegeFeesTarget;
      if (fpcFeesTarget > maxFeeAmount) maxFeeAmount = fpcFeesTarget;

      return {
        id: col.id,
        name: col.name,
        collegeFeesTarget,
        fpcFeesTarget,
        collegeFeesAchieved,
        fpcFeesAchieved,
        paidCount,
        pendingCount,
      };
    });

    const totalCollegeFeesTarget = collegesList.reduce((s, c) => s + c.collegeFeesTarget, 0);
    const totalFpcFeesTarget = collegesList.reduce((s, c) => s + c.fpcFeesTarget, 0);
    const totalCollegeFeesAchieved = collegesList.reduce((s, c) => s + c.collegeFeesAchieved, 0);
    const totalFpcFeesAchieved = collegesList.reduce((s, c) => s + c.fpcFeesAchieved, 0);

    const totalAchievedPercent = totalFpcFeesTarget > 0 ? (totalFpcFeesAchieved / totalFpcFeesTarget) * 100 : 0;

    // Today's revenue
    const todayStr = new Date().toISOString().split("T")[0];
    const todayRevenue = data.payments
      .filter((p) => {
        if (!p.payment_date) return false;
        return p.payment_date.startsWith(todayStr);
      })
      .reduce((s, p) => s + (p.amount || 0), 0);

    const totalPaidOverall = totalFpcFeesAchieved + totalCollegeFeesAchieved;
    const totalTargetOverall = totalFpcFeesTarget + totalCollegeFeesTarget;
    const totalPendingOverall = Math.max(totalTargetOverall - totalPaidOverall, 0);

    // Line chart SVG coordinates computation
    const collegesListSorted = [...collegesList].sort((a, b) => a.name.localeCompare(b.name));
    const N = collegesListSorted.length;
    const maxCount = Math.max(maxStudentCount, 10);

    const paidPoints = collegesListSorted.map((c, idx) => {
      const x = N > 1 ? 40 + idx * (420 / (N - 1)) : 250;
      const y = 170 - (c.paidCount / maxCount) * 120;
      return { x, y, val: c.paidCount };
    });

    const pendingPoints = collegesListSorted.map((c, idx) => {
      const x = N > 1 ? 40 + idx * (420 / (N - 1)) : 250;
      const y = 170 - (c.pendingCount / maxCount) * 120;
      return { x, y, val: c.pendingCount };
    });

    const buildPath = (points: { x: number; y: number }[]) => {
      if (points.length === 0) return "";
      if (points.length === 1) {
        return `M 40 ${points[0].y} L 480 ${points[0].y}`;
      }
      let d = `M ${points[0].x} ${points[0].y}`;
      for (let i = 1; i < points.length; i++) {
        const prev = points[i - 1];
        const curr = points[i];
        const cp1x = prev.x + (curr.x - prev.x) / 3;
        const cp1y = prev.y;
        const cp2x = prev.x + 2 * (curr.x - prev.x) / 3;
        const cp2y = curr.y;
        d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${curr.x} ${curr.y}`;
      }
      return d;
    };

    const paidLinePath = buildPath(paidPoints);
    const pendingLinePath = buildPath(pendingPoints);

    return {
      collegesList: collegesListSorted,
      totalCollegeFeesTarget,
      totalFpcFeesTarget,
      totalCollegeFeesAchieved,
      totalFpcFeesAchieved,
      totalAchievedPercent,
      totalPaidOverall,
      totalTargetOverall,
      totalPendingOverall,
      todayRevenue,
      maxStudentCount: maxCount,
      maxFeeAmount,
      paidPoints,
      pendingPoints,
      paidLinePath,
      pendingLinePath,
    };
  }, [data, selectedReportYear]);

  // Dynamically extract colleges from DB data or AppContext
  const availableColleges = useMemo(() => {
    const list = new Map<string, string>(); // name -> id
    
    if (data?.colleges) {
      data.colleges.forEach(c => list.set(c.name.trim(), c.id));
    }
    
    if (ctxColleges) {
      ctxColleges.forEach(c => list.set(c.name.trim(), c.id));
    }
    
    return Array.from(list.keys()).sort();
  }, [data?.colleges, ctxColleges]);

  const handleDownloadTemplate = () => {
    try {
      const headers = [
        "Registration Number",
        "College Name",
        "Student Name",
        "Year",
        "Email",
        "Mobile Number",
        "Department",
        "Semester",
        "FPC FEES PAID",
        "FPC FEES PENDING",
        "Amount",
        "Payment Link"
      ];
      
      const targetCollege = data?.colleges.find(
        c => c.name.trim().toLowerCase() === selectedTemplateCollege.trim().toLowerCase()
      );

      const matchingStudents = (data?.students || []).filter(s => {
        // 1. College Match
        if (targetCollege && s.college_id !== targetCollege.id) return false;
        
        // 2. Department Match
        if (s.department && s.department.trim().toLowerCase() !== selectedTemplateDept.trim().toLowerCase()) return false;

        return true;
      });

      const rows = matchingStudents.map(s => ({
        "Registration Number": s.register_number || "",
        "College Name": selectedTemplateCollege,
        "Student Name": s.name || "",
        "Year": selectedTemplateYear,
        "Email": s.email || "",
        "Mobile Number": s.phone || "",
        "Department": s.department || selectedTemplateDept,
        "Semester": selectedTemplateSem,
        "FPC FEES PAID": "",
        "FPC FEES PENDING": "",
        "Amount": "",
        "Payment Link": ""
      }));

      if (rows.length === 0) {
        rows.push({
          "Registration Number": "",
          "College Name": selectedTemplateCollege,
          "Student Name": "",
          "Year": selectedTemplateYear,
          "Email": "",
          "Mobile Number": "",
          "Department": selectedTemplateDept,
          "Semester": selectedTemplateSem,
          "FPC FEES PAID": "",
          "FPC FEES PENDING": "",
          "Amount": "",
          "Payment Link": ""
        });
      }

      const worksheet = XLSX.utils.json_to_sheet(rows, { header: headers });
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Fee Template");
      
      XLSX.writeFile(workbook, `Fee_Template_${selectedTemplateDept.replace(/[^a-zA-Z0-9]/g, "_")}_${selectedTemplateSem.replace(/\s+/g, "_")}.xlsx`);
    } catch (e: any) {
      setUploadError("Failed to generate template: " + e.message);
    }
  };

  const parseRowsWithIndices = (rows: any[][], indices: Record<string, number>) => {
    const parsed: any[] = [];
    for (let r = 0; r < rows.length; r++) {
      const row = rows[r];
      if (!row || row.length === 0) continue;

      const studentName = indices.student !== undefined && indices.student !== -1 ? String(row[indices.student] || "").trim() : "";
      const email = indices.email !== undefined && indices.email !== -1 ? String(row[indices.email] || "").trim() : "";
      const registerNumber = indices.register_number !== undefined && indices.register_number !== -1 ? String(row[indices.register_number] || "").trim() : "";
      
      if (!studentName && !email && !registerNumber) continue;

      // Clean amount numbers (remove currency symbols, commas)
      const cleanNum = (val: any) => {
        if (val === undefined || val === null || String(val).trim() === "") return 0;
        return Number(String(val).replace(/[^\d.-]/g, "")) || 0;
      };

      const collegeName = indices.college !== undefined && indices.college !== -1 ? String(row[indices.college] || "").trim() : "";
      const phone = indices.phone !== undefined && indices.phone !== -1 ? String(row[indices.phone] || "").trim() : "";
      const amount = indices.amount !== undefined && indices.amount !== -1 ? cleanNum(row[indices.amount]) : 0;
      const paid = indices.paid !== undefined && indices.paid !== -1 ? cleanNum(row[indices.paid]) : 0;
      const pending = indices.pending !== undefined && indices.pending !== -1 ? cleanNum(row[indices.pending]) : amount - paid;
      const year = indices.year !== undefined && indices.year !== -1 ? String(row[indices.year] || "").trim() : "";
      const t = indices.t !== undefined && indices.t !== -1 ? String(row[indices.t] || "").trim() : "";
      const semester = indices.semester !== undefined && indices.semester !== -1 ? String(row[indices.semester] || "").trim() : "";
      const payLink = indices.pay_link !== undefined && indices.pay_link !== -1 ? String(row[indices.pay_link] || "").trim() : "";

      parsed.push({
        registerNumber,
        collegeName,
        studentName,
        year,
        email,
        phone,
        t,
        semester,
        paid,
        pending,
        amount,
        payLink
      });
    }
    return parsed;
  };

  const handleMappingChange = (fieldKey: string, headerIdx: number) => {
    const nextIndices = { ...colIndices, [fieldKey]: headerIdx };
    setColIndices(nextIndices);
    const parsed = parseRowsWithIndices(sheetRows, nextIndices);
    setParsedData(parsed);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadResult(null);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: "binary" });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const rawJson: any[] = XLSX.utils.sheet_to_json(ws, { header: 1 });

        if (rawJson.length < 2) {
          setUploadError("The uploaded sheet is empty or contains no headers.");
          return;
        }

        const headers = rawJson[0].map((h: any) => String(h || "").trim());
        setSheetHeaders(headers);
        
        // Save the raw rows starting from index 1
        const rowsOnly = rawJson.slice(1);
        setSheetRows(rowsOnly);
        
        // Autodetect column headers
        const autoIndices = {
          register_number: headers.findIndex((h: string) => h.toLowerCase() === "registration number" || h.toLowerCase().includes("registration")),
          college: headers.findIndex((h: string) => h.toLowerCase() === "college name" || h.toLowerCase().includes("college")),
          student: headers.findIndex((h: string) => h.toLowerCase() === "student name" || h.toLowerCase().includes("student") || h.toLowerCase() === "name"),
          year: headers.findIndex((h: string) => h.toLowerCase() === "year" || h.toLowerCase() === "batch"),
          email: headers.findIndex((h: string) => h.toLowerCase() === "email"),
          phone: headers.findIndex((h: string) => h.toLowerCase() === "mobile number" || h.toLowerCase().includes("phone") || h.toLowerCase() === "number"),
          t: headers.findIndex((h: string) => h.toLowerCase() === "department" || h.toLowerCase() === "course" || h.toLowerCase() === "dept"),
          semester: headers.findIndex((h: string) => h.toLowerCase() === "semester" || h.toLowerCase() === "sem"),
          paid: headers.findIndex((h: string) => h.toLowerCase() === "fpc fees paid" || h.toLowerCase().includes("paid")),
          pending: headers.findIndex((h: string) => h.toLowerCase() === "fpc fees pending" || h.toLowerCase().includes("pending")),
          amount: headers.findIndex((h: string) => h.toLowerCase() === "amount" || h.toLowerCase().includes("total")),
          pay_link: headers.findIndex((h: string) => h.toLowerCase() === "payment link" || h.toLowerCase().includes("link")),
        };
        setColIndices(autoIndices);

        const parsed = parseRowsWithIndices(rowsOnly, autoIndices);
        if (parsed.length === 0) {
          setUploadError("Could not find any valid student rows to import.");
        } else {
          setParsedData(parsed);
          setUploadError(null);
          setUploadStep(2); // advance to step 2 wizard mapping
        }
      } catch (err: any) {
        setUploadError("Failed to parse file: " + err.message);
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleBulkUpload = async () => {
    if (parsedData.length === 0) return;
    setUploading(true);
    setUploadError(null);

    try {
      const res = await fetch("/api/fees/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rows: parsedData
        })
      });

      const json = await res.json();
      if (json.success) {
        setUploadResult({
          message: json.message,
          processedCount: json.processedCount,
          skippedCount: json.skippedCount,
          skippedRows: json.skippedRows
        });
        setParsedData([]);
        fetchData(); // reload dashboard stats & records
      } else {
        setUploadError(json.message || "Failed to upload fee data.");
      }
    } catch (err: any) {
      setUploadError("Network error: " + err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleUpdateFeeStatus = async (feeId: string, studentId: string) => {
    if (savingFeeId) return;
    setSavingFeeId(feeId);
    try {
      const res = await fetch("/api/fees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          feeId,
          studentId,
          isDirectUpdate: true,
          paidAmount: Number(editPaidAmount) || 0,
          status: editStatus
        })
      });
      const json = await res.json();
      if (json.success) {
        setEditingFeeId(null);
        await fetchData();
      } else {
        alert(json.message || "Failed to update fee record.");
      }
    } catch (err: any) {
      alert("Error saving payment: " + err.message);
    } finally {
      setSavingFeeId(null);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      let url = "/api/fees?role=fee_manager";
      if (filterFromDate) url += `&from=${filterFromDate}`;
      if (filterToDate) url += `&to=${filterToDate}`;
      const res = await fetch(url);
      const json = await res.json();
      if (json.success) setData(json);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterFromDate, filterToDate]);

  useEffect(() => {
    if (data) {
      if (data.colleges?.length > 0 && !selectedTemplateCollege) {
        setSelectedTemplateCollege(data.colleges[0].name);
      }
      if (availableDepartments.length > 0 && !selectedTemplateDept) {
        setSelectedTemplateDept(availableDepartments[0]);
      }
      if (availableSemesters.length > 0 && !selectedTemplateSem) {
        setSelectedTemplateSem(availableSemesters[0]);
      }
      if (availableYears.length > 0 && !selectedTemplateYear) {
        setSelectedTemplateYear(availableYears[0]);
      }
    }
  }, [data, availableDepartments, availableSemesters, availableYears, selectedTemplateCollege, selectedTemplateDept, selectedTemplateSem, selectedTemplateYear]);

  // Compute per-college stats
  const collegeStats = useMemo(() => {
    if (!data) return [];
    return data.colleges.map((col) => {
      const colFees = data.fees.filter((f) => f.college_id === col.id);
      const colStudents = data.students.filter((s) => s.college_id === col.id);
      const total = colFees.reduce((s, f) => s + f.amount, 0);
      const paid = colFees.reduce((s, f) => s + f.paid_amount, 0);
      return {
        ...col,
        totalStudents: colStudents.length,
        totalFees: total,
        totalPaid: paid,
        outstanding: total - paid,
        collectionRate: total > 0 ? Math.round((paid / total) * 100) : 0,
        paidCount: colFees.filter((f) => f.status === "paid").length,
        unpaidCount: colFees.filter((f) => f.status === "unpaid").length,
      };
    });
  }, [data]);

  // Extract unique departments from students
  const uniqueDepartments = useMemo(() => {
    if (!data?.students) return [];
    const depts = new Set<string>();
    data.students.forEach((s) => {
      if (s.department) depts.add(s.department.trim());
    });
    return Array.from(depts).sort();
  }, [data?.students]);

  // Extract unique years from student classGroups or batch years
  const uniqueYears = useMemo(() => {
    if (!data?.students) return [];
    const yrs = new Set<string>();
    data.students.forEach((s: any) => {
      if (s.batch_start_year && s.batch_end_year) {
        yrs.add(`${s.batch_start_year}-${s.batch_end_year}`);
      } else if (s.classGroup) {
        const match = s.classGroup.match(/Year\s+(VIII|VII|III|II|IV|VI|V|I|1|2|3|4|5|6|7|8)\b/i);
        if (match) {
          yrs.add(match[0].trim());
        } else {
          yrs.add(s.classGroup.trim());
        }
      }
    });
    return Array.from(yrs).sort();
  }, [data?.students]);

  // Extract unique semesters from student fee term names
  const uniqueSemesters = useMemo(() => {
    if (!data?.fees) return [];
    const sems = new Set<string>();
    data.fees.forEach((f) => {
      if (f.term_name) {
        const match = f.term_name.match(/Semester\s+(I|II|III|IV|V|VI|VII|VIII|1|2|3|4|5|6|7|8)/i);
        if (match) {
          sems.add(match[0].trim());
        } else {
          const parts = f.term_name.split(" ");
          if (parts[0] && parts[0].toLowerCase().startsWith("sem")) {
            sems.add(parts.slice(0, 2).join(" "));
          }
        }
      }
    });
    return Array.from(sems).sort();
  }, [data?.fees]);

  // Filtered students
  const filteredStudents = useMemo(() => {
    if (!data) return [];
    return data.students.filter((s) => {
      const matchSearch =
        !searchQuery ||
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.register_number && s.register_number.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (s.phone && s.phone.includes(searchQuery));

      const matchCollege = filterCollege === "all" || s.college_id === filterCollege;
      const matchDept = filterDept === "all" || s.department === filterDept;
      const sBatchYearStr = (s as any).batch_start_year && (s as any).batch_end_year ? `${(s as any).batch_start_year}-${(s as any).batch_end_year}` : null;
      const classYearMatch = s.classGroup ? s.classGroup.match(/Year\s+(VIII|VII|III|II|IV|VI|V|I|1|2|3|4|5|6|7|8)\b/i) : null;
      const extractedClassYear = classYearMatch ? classYearMatch[0].trim().toLowerCase() : (s.classGroup ? s.classGroup.trim().toLowerCase() : "");
      const matchYear = filterYear === "all" || (sBatchYearStr === filterYear) || (extractedClassYear === filterYear.toLowerCase());
      
      let matchSem = true;
      if (filterSemester !== "all") {
        const studentFees = data.fees.filter((f) => f.student_id === s.id);
        matchSem = studentFees.some((f) => f.term_name.toLowerCase().includes(filterSemester.toLowerCase()));
      }

      let matchStatus = true;
      if (filterFeeStatus !== "all") {
        const studentFees = data.fees.filter((f) => f.student_id === s.id);
        const totalFees = studentFees.reduce((sum, f) => sum + f.amount, 0);
        const totalPaid = studentFees.reduce((sum, f) => sum + f.paid_amount, 0);
        const overallStatus =
          totalPaid >= totalFees && totalFees > 0 ? "paid"
          : totalPaid > 0 ? "partial"
          : "unpaid";
        matchStatus = overallStatus === filterFeeStatus;
      }

      return matchSearch && matchCollege && matchDept && matchYear && matchSem && matchStatus;
    });
  }, [data, searchQuery, filterCollege, filterDept, filterYear, filterSemester, filterFeeStatus]);

  // Filtered transactions
  const filteredPayments = useMemo(() => {
    if (!data) return [];
    let pays = [...data.payments].sort(
      (a, b) => new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime()
    );
    if (filterCollege !== "all") {
      pays = pays.filter((p) => p.college_id === filterCollege);
    }
    if (searchQuery) {
      pays = pays.filter(
        (p) =>
          p.receipt_no.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.student_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.reference_no.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    return pays;
  }, [data, searchQuery, filterCollege]);

  const getStudentFees = (studentId: string) =>
    data?.fees.filter((f) => f.student_id === studentId) || [];

  const getStudentName = (studentId: string) =>
    data?.students.find((s) => s.id === studentId)?.name || studentId;

  const getCollegeName = (collegeId: string) => {
    if (!collegeId) return "—";
    const col = data?.colleges.find((c) => c.id === collegeId);
    const name = col ? col.name : collegeId;
    return name.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-4">
          <div className="h-14 w-14 rounded-full border-2 border-t-amber-500 border-amber-100 animate-spin" />
          <p className="text-sm font-semibold text-gray-500">Loading Fee Data…</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex-1 flex items-center justify-center h-full">
        <div className="text-center">
          <AlertCircle className="h-10 w-10 text-rose-400 mx-auto mb-2" />
          <p className="text-sm text-gray-500">Failed to load fee data.</p>
          <button onClick={fetchData} className="mt-3 px-5 py-2 rounded-xl btn-gradient text-white text-xs font-bold cursor-pointer">
            Retry
          </button>
        </div>
      </div>
    );
  }

  const { stats } = data;

  const tabs: { id: TabType; label: string; icon: React.FC<any> }[] = [
    { id: "overview", label: "Overview", icon: Activity },
    { id: "colleges", label: "Colleges", icon: School },
    { id: "students", label: "Students", icon: Users },
    { id: "transactions", label: "Transactions", icon: Receipt },
  ];

  return (
    <div className="flex flex-col md:flex-row h-full overflow-hidden bg-warm-canvas">
      {/* Sidebar */}
      <aside className="hidden md:flex shrink-0 flex-col justify-between sticky top-6 z-30 floating-sidebar transition-all duration-300 w-64 p-5">
        <div className="flex flex-col flex-1 overflow-y-auto">
          {/* Logo area */}
          <div className="px-3 py-4 border-b border-slate-100/80 dark:border-slate-800/80 mb-6">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl btn-gradient flex items-center justify-center shadow-md">
                <IndianRupee className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-sm font-extrabold text-slate-800 dark:text-slate-200 leading-tight">Fee Collections</p>
                <p className="text-[10px] text-[#D528A2] font-semibold uppercase tracking-wider">Manager Portal</p>
              </div>
            </div>
          </div>

          {/* Nav */}
          <nav className="space-y-1.5">
            {tabs.map(({ id, label, icon: Icon }) => {
              const isActive = activeTab === id;
              return (
                <button
                  key={id}
                  onClick={() => setActiveTab(id)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-2xl text-xs font-bold tracking-tight transition-all duration-200 cursor-pointer text-left ${
                    isActive
                      ? "sidebar-active-item"
                      : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-55 hover:bg-slate-50/50"
                  }`}
                >
                  <Icon className={`h-4.5 w-4.5 shrink-0 ${isActive ? "text-white" : "text-slate-400 group-hover:text-slate-600"}`} />
                  <span>{label}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </aside>

      {/* Mobile Bottom Navigation — visible only on small screens */}
      <nav className="flex md:hidden fixed bottom-0 inset-x-0 z-50 mobile-bottom-nav">
        <div className="flex w-full justify-around items-center py-2 px-1">
          {tabs.map(({ id, label, icon: Icon }) => {
            const isActive = activeTab === id;
            return (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`relative flex flex-col items-center justify-center gap-0.5 flex-1 py-1.5 rounded-xl transition-all cursor-pointer ${
                  isActive ? "text-indigo-600" : "text-slate-400"
                }`}
              >
                <Icon className={`h-5 w-5 transition-transform ${isActive ? "scale-110" : ""}`} />
                <span className={`text-[9px] font-semibold tracking-wide leading-none ${isActive ? "text-indigo-600" : "text-slate-400"}`}>
                  {label}
                </span>
                {isActive && <span className="absolute top-0 inset-x-2 h-0.5 bg-indigo-500 rounded-full" />}
              </button>
            );
          })}
        </div>
      </nav>

      {/* Main */}
      <main className="flex-1 flex flex-col overflow-hidden pb-20 md:pb-0 scroll-touch">
        {/* Top bar (Floating Panel style) */}
        <div className="mx-3 md:mx-8 mt-4 md:mt-6 mb-2 px-4 md:px-6 py-4 rounded-2xl border border-slate-200/60 dark:border-slate-800/80 bg-white/75 dark:bg-[#131317]/75 backdrop-blur-md flex items-center justify-between shrink-0 shadow-xs flex-wrap gap-3">
          <div>
            <h1 className="text-sm font-extrabold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
              {activeTab === "overview" && `Fees Collection Reports for ${selectedReportYear}`}
              {activeTab === "colleges" && "College-wise Breakdown"}
              {activeTab === "students" && "Student Fee Directory"}
              {activeTab === "transactions" && "Payment Transactions"}
            </h1>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold mt-0.5">
              {data.colleges.length} college{data.colleges.length !== 1 ? "s" : ""} · {stats.totalStudents} students · {data.payments.length} payments
            </p>
          </div>
          <div className="flex items-center gap-3 flex-wrap justify-end">
            <div className="flex items-center gap-2 border border-slate-200 dark:border-slate-800 rounded-xl px-2 bg-white/50 dark:bg-black/20 text-xs text-slate-600 dark:text-slate-400 font-bold overflow-hidden">
              <span className="px-1 py-1.5 uppercase text-[9px] tracking-wider">Date Range:</span>
              <input
                type="date"
                value={filterFromDate}
                onChange={(e) => setFilterFromDate(e.target.value)}
                className="bg-transparent border-none outline-none cursor-pointer py-1.5"
                title="From Date"
              />
              <span className="text-slate-300 dark:text-slate-700">-</span>
              <input
                type="date"
                value={filterToDate}
                onChange={(e) => setFilterToDate(e.target.value)}
                className="bg-transparent border-none outline-none cursor-pointer py-1.5"
                title="To Date"
              />
              {(filterFromDate || filterToDate) && (
                <button 
                  onClick={() => { setFilterFromDate(""); setFilterToDate(""); }}
                  className="px-2 py-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-md transition-colors text-[9px] uppercase tracking-wider text-red-500 ml-1"
                >
                  Clear
                </button>
              )}
            </div>

            {activeTab === "overview" && reportsData && (
              <>
                <div className="flex items-center gap-1.5 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-1.5 bg-white/50 dark:bg-black/20">
                  <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider">Batch:</span>
                  <select
                    value={selectedReportYear}
                    onChange={(e) => setSelectedReportYear(e.target.value)}
                    className="bg-transparent text-xs font-bold text-slate-700 dark:text-slate-300 focus:outline-none cursor-pointer"
                  >
                    {reportYears.map((yr) => (
                      <option key={yr} value={yr}>{yr}</option>
                    ))}
                  </select>
                </div>
                <div className="bg-slate-900 border border-slate-700/50 rounded-xl px-3 py-1 text-right shrink-0">
                  <span className="text-[8px] font-bold text-slate-400 block tracking-wider uppercase leading-none">Achieved</span>
                  <span className="text-xs font-black text-white">{reportsData.totalAchievedPercent.toFixed(2)}%</span>
                </div>
              </>
            )}
            {activeTab === "transactions" && (
              <>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
                  <input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search transactions…"
                    className="pl-8 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-850 bg-white dark:bg-[#131317] text-xs font-medium text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#D528A2]/50 w-52"
                  />
                </div>
                <select
                  value={filterCollege}
                  onChange={(e) => setFilterCollege(e.target.value)}
                  className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-850 bg-white dark:bg-[#131317] text-xs font-medium text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#D528A2]/50 cursor-pointer"
                >
                  <option value="all">All Colleges</option>
                  {data.colleges.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </>
            )}
            <button
              onClick={() => {
                setShowUploadModal(true);
                setParsedData([]);
                setUploadError(null);
                setUploadResult(null);
              }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl btn-gradient text-white text-xs font-bold shadow-xs cursor-pointer hover:opacity-90 transition-opacity"
            >
              <Upload className="h-3.5 w-3.5" />
              <span>Upload Excel</span>
            </button>
            <button
              onClick={fetchData}
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-850 bg-white dark:bg-[#131317] text-slate-500 dark:text-slate-400 hover:text-[#D528A2] hover:border-[#D528A2]/50 transition-colors cursor-pointer"
              title="Refresh"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto">

          {/* ─── OVERVIEW TAB ─── */}
          {activeTab === "overview" && reportsData && (
            <div className="p-4 md:p-8 space-y-8">
              {/* Row of 4 High-Fidelity Stat Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                
                {/* 1. TODAY'S REVENUE */}
                <div className="bg-white dark:bg-[#131317] rounded-3xl border border-slate-200/60 dark:border-slate-800/80 p-5 shadow-xs flex items-center justify-between transition-all duration-300 hover:shadow-md">
                  <div>
                    <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Today's Revenue</span>
                    <h3 className="text-xl font-black text-slate-850 dark:text-slate-100 mt-1">
                      ₹{reportsData.todayRevenue.toLocaleString()}
                    </h3>
                    <p className="text-[9px] text-[#22c55e] font-bold mt-1 flex items-center gap-0.5">
                      <span>Live collection speed</span>
                    </p>
                  </div>
                  <div className="h-11 w-11 rounded-2xl bg-emerald-500/10 dark:bg-emerald-500/5 flex items-center justify-center text-emerald-500 shadow-inner">
                    <Activity className="h-5 w-5" />
                  </div>
                </div>

                {/* 2. TOTAL COLLECTIONS (PAID) */}
                <div className="bg-white dark:bg-[#131317] rounded-3xl border border-slate-200/60 dark:border-slate-800/80 p-5 shadow-xs flex items-center justify-between transition-all duration-300 hover:shadow-md">
                  <div>
                    <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Total Paid Collections</span>
                    <h3 className="text-xl font-black text-slate-850 dark:text-slate-100 mt-1">
                      ₹{reportsData.totalPaidOverall.toLocaleString()}
                    </h3>
                    <div className="w-24 bg-slate-105 dark:bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden bg-slate-100">
                      <div 
                        className="bg-gradient-to-r from-[#D528A2] to-[#FF6B6B] h-full rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(reportsData.totalAchievedPercent, 100)}%` }}
                      />
                    </div>
                  </div>
                  <div className="h-11 w-11 rounded-2xl bg-[#D528A2]/10 dark:bg-[#D528A2]/5 flex items-center justify-center text-[#D528A2] shadow-inner">
                    <Receipt className="h-5 w-5" />
                  </div>
                </div>

                {/* 3. TOTAL PENDING FEES */}
                <div className="bg-white dark:bg-[#131317] rounded-3xl border border-slate-200/60 dark:border-slate-800/80 p-5 shadow-xs flex items-center justify-between transition-all duration-300 hover:shadow-md">
                  <div>
                    <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Total Pending Fees</span>
                    <h3 className="text-xl font-black text-slate-850 dark:text-slate-100 mt-1">
                      ₹{reportsData.totalPendingOverall.toLocaleString()}
                    </h3>
                    <p className="text-[9px] text-[#3b82f6] font-bold mt-1">
                      Outstanding collections
                    </p>
                  </div>
                  <div className="h-11 w-11 rounded-2xl bg-[#3b82f6]/10 dark:bg-[#3b82f6]/5 flex items-center justify-center text-[#3b82f6] shadow-inner">
                    <IndianRupee className="h-5 w-5" />
                  </div>
                </div>

                {/* 4. TOTAL REVENUE TARGET */}
                <div className="bg-white dark:bg-[#131317] rounded-3xl border border-slate-200/60 dark:border-slate-800/80 p-5 shadow-xs flex items-center justify-between transition-all duration-300 hover:shadow-md">
                  <div>
                    <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Target Revenue</span>
                    <h3 className="text-xl font-black text-slate-850 dark:text-slate-100 mt-1">
                      ₹{reportsData.totalTargetOverall.toLocaleString()}
                    </h3>
                    <p className="text-[9px] text-purple-500 font-bold mt-1">
                      FPC + College tuition target
                    </p>
                  </div>
                  <div className="h-11 w-11 rounded-2xl bg-purple-500/10 dark:bg-purple-500/5 flex items-center justify-center text-purple-500 shadow-inner">
                    <Users className="h-5 w-5" />
                  </div>
                </div>

              </div>

              {/* Reports Dashboard Grid */}
              <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-stretch">
                
                {/* Column 1: Payment Status Line Graph */}
                <div className="xl:col-span-5 bg-[#0f172a] rounded-3xl border border-slate-800 p-6 shadow-xl flex flex-col justify-between min-h-[380px]">
                  <div className="text-center">
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">Payment status</h3>
                    <div className="flex items-center justify-center gap-4 mt-2 text-[10px] font-bold uppercase tracking-wider">
                      <div className="flex items-center gap-1.5">
                        <span className="inline-block w-2.5 h-2.5 rotate-45 bg-[#10b981] border border-slate-900" />
                        <span className="text-slate-300">Paid</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="inline-block w-2.5 h-2.5 rounded-full bg-[#3b82f6]" />
                        <span className="text-slate-300">Pending</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="relative w-full overflow-visible my-auto">
                    <svg viewBox="0 0 500 240" className="w-full h-auto overflow-visible">
                      {/* Grid Lines */}
                      <line x1="40" y1="30" x2="480" y2="30" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
                      <line x1="40" y1="100" x2="480" y2="100" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
                      <line x1="40" y1="170" x2="480" y2="170" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" />

                      {/* Y Axis Labels */}
                      <text x="30" y="34" textAnchor="end" className="text-[9px] fill-slate-550 font-bold fill-slate-500">
                        {reportsData.maxStudentCount}
                      </text>
                      <text x="30" y="104" textAnchor="end" className="text-[9px] fill-slate-550 font-bold fill-slate-500">
                        {Math.round(reportsData.maxStudentCount / 2)}
                      </text>
                      <text x="30" y="174" textAnchor="end" className="text-[9px] fill-slate-550 font-bold fill-slate-500">0</text>

                      {/* Glow Filters for Neon Lines */}
                      <defs>
                        <filter id="glow-green" x="0" y="0" width="500" height="240" filterUnits="userSpaceOnUse">
                          <feGaussianBlur stdDeviation="3" result="blur" />
                          <feComposite in="SourceGraphic" in2="blur" operator="over" />
                        </filter>
                        <filter id="glow-blue" x="0" y="0" width="500" height="240" filterUnits="userSpaceOnUse">
                          <feGaussianBlur stdDeviation="3" result="blur" />
                          <feComposite in="SourceGraphic" in2="blur" operator="over" />
                        </filter>
                      </defs>

                      {/* Lines path */}
                      {reportsData.paidLinePath && (
                        <path d={reportsData.paidLinePath} fill="none" stroke="#10b981" strokeWidth="3" filter="url(#glow-green)" strokeLinecap="round" />
                      )}
                      {reportsData.pendingLinePath && (
                        <path d={reportsData.pendingLinePath} fill="none" stroke="#3b82f6" strokeWidth="3" filter="url(#glow-blue)" strokeLinecap="round" />
                      )}

                      {/* Paid (Green Diamond Nodes) */}
                      {reportsData.paidPoints.map((pt, idx) => (
                        <g key={idx}>
                          <polygon
                            points={`${pt.x},${pt.y - 4} ${pt.x + 4},${pt.y} ${pt.x},${pt.y + 4} ${pt.x - 4},${pt.y}`}
                            fill="#10b981"
                            stroke="#0f172a"
                            strokeWidth="1.5"
                          />
                          <text x={pt.x} y={pt.y - 8} textAnchor="middle" className="text-[9px] font-black fill-white">{pt.val}</text>
                        </g>
                      ))}

                      {/* Pending (Blue Circle Nodes) */}
                      {reportsData.pendingPoints.map((pt, idx) => (
                        <g key={idx}>
                          <circle cx={pt.x} cy={pt.y} r="4" fill="#3b82f6" stroke="#0f172a" strokeWidth="1.5" />
                          <text x={pt.x} y={pt.y - 8} textAnchor="middle" className="text-[9px] font-black fill-white">{pt.val}</text>
                        </g>
                      ))}

                      {/* Rotated X Axis labels directly matched to SVG coords */}
                      {reportsData.collegesList.map((col, idx) => {
                        const N = reportsData.collegesList.length;
                        const x = N > 1 ? 40 + idx * (420 / (N - 1)) : 250;
                        const y = 190;
                        
                        const getAbbrName = (name: string) => {
                          const clean = name.toLowerCase().trim();
                          if (clean.includes("bharathidasan")) return "Bharathidasan...";
                          if (clean.includes("kamaraj womens") || clean.includes("kamaraj women")) return "Kamaraj Wom...";
                          if (clean.includes("kamaraj")) return "Kamaraj College";
                          if (clean.includes("nagarathinam")) return "Nagarathinam...";
                          if (clean.includes("amaraavathi") || clean.includes("amravati")) return "Sri Amaraavat...";
                          if (clean.includes("terfs")) return "Terfs Academ...";
                          if (clean.includes("tjs")) return "TJS College of...";
                          return name.slice(0, 12) + "...";
                        };

                        return (
                          <text
                            key={col.id}
                            x={x}
                            y={y}
                            transform={`rotate(35, ${x}, ${y})`}
                            textAnchor="start"
                            className="text-[8px] fill-slate-400 font-bold"
                          >
                            {getAbbrName(col.name)}
                          </text>
                        );
                      })}
                    </svg>
                  </div>
                </div>

                {/* Column 2: Target & Achieved Cards */}
                <div className="xl:col-span-3 flex flex-col justify-between gap-6 min-h-[380px]">
                  {/* TARGET CARD */}
                  <div className="flex-1 bg-white dark:bg-[#131317] rounded-3xl border border-slate-200/60 dark:border-slate-800/80 p-5 shadow-sm flex flex-col justify-between">
                    <div className="border-t border-b border-slate-200 dark:border-slate-800 py-1.5 text-center">
                      <h4 className="text-xs font-black italic tracking-widest text-slate-800 dark:text-slate-200 uppercase">TARGET</h4>
                    </div>
                    
                    {/* College Fees Target */}
                    <div className="text-center space-y-1">
                      <div className="inline-block bg-[#22c55e] text-white text-[9px] font-black px-4 py-1 rounded-sm uppercase tracking-wider">
                        Total College Fees
                      </div>
                      <p className="text-lg font-black text-slate-800 dark:text-slate-100">
                        ₹{reportsData.totalCollegeFeesTarget.toLocaleString()}
                      </p>
                    </div>

                    {/* FPC Fees Target */}
                    <div className="text-center space-y-1">
                      <div className="inline-block bg-[#3b82f6] text-white text-[9px] font-black px-4 py-1 rounded-sm uppercase tracking-wider">
                        Total FPC Fees
                      </div>
                      <p className="text-lg font-black text-slate-800 dark:text-slate-100">
                        ₹{reportsData.totalFpcFeesTarget.toLocaleString()}
                      </p>
                    </div>
                  </div>

                  {/* ACHIEVED CARD */}
                  <div className="flex-1 bg-white dark:bg-[#131317] rounded-3xl border border-slate-200/60 dark:border-slate-800/80 p-5 shadow-sm flex flex-col justify-between">
                    <div className="border-t border-b border-slate-200 dark:border-slate-800 py-1.5 text-center">
                      <h4 className="text-xs font-black italic tracking-widest text-slate-800 dark:text-slate-200 uppercase">ACHIEVED</h4>
                    </div>
                    
                    {/* College Fees Achieved */}
                    <div className="text-center space-y-1">
                      <div className="inline-block bg-[#22c55e] text-white text-[9px] font-black px-4 py-1 rounded-sm uppercase tracking-wider">
                        Total College Fees
                      </div>
                      <p className="text-lg font-black text-slate-800 dark:text-slate-100">
                        ₹{reportsData.totalCollegeFeesAchieved.toLocaleString()}
                      </p>
                    </div>

                    {/* FPC Fees Achieved */}
                    <div className="text-center space-y-1">
                      <div className="inline-block bg-[#3b82f6] text-white text-[9px] font-black px-4 py-1 rounded-sm uppercase tracking-wider">
                        Total FPC Fees
                      </div>
                      <p className="text-lg font-black text-slate-800 dark:text-slate-100">
                        ₹{reportsData.totalFpcFeesAchieved.toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Column 3: Total Fees Horizontal Bar Chart */}
                <div className="xl:col-span-4 bg-white dark:bg-[#131317] rounded-3xl border border-slate-200/60 dark:border-slate-800/80 p-6 shadow-sm flex flex-col justify-between min-h-[380px]">
                  <div className="text-center mb-4">
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-650 dark:text-slate-400">Total Fees</h3>
                    <div className="flex items-center justify-center gap-4 mt-2 text-[10px] font-bold uppercase tracking-wider">
                      <div className="flex items-center gap-1.5">
                        <span className="inline-block w-3 h-3 bg-[#22c55e]" />
                        <span className="text-slate-500">College fees</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="inline-block w-3 h-3 bg-[#3b82f6]" />
                        <span className="text-slate-500">Fpc Fees</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4 flex-1 flex flex-col justify-center">
                    {reportsData.collegesList.map((col) => {
                      const collegeWidth = reportsData.maxFeeAmount > 0 
                        ? Math.max((col.collegeFeesTarget / reportsData.maxFeeAmount) * 100, 3) 
                        : 3;
                      const fpcWidth = reportsData.maxFeeAmount > 0 
                        ? Math.max((col.fpcFeesTarget / reportsData.maxFeeAmount) * 100, 3) 
                        : 3;

                      return (
                        <div key={col.id} className="space-y-1 border-b border-slate-100/50 dark:border-slate-800/50 pb-2 last:border-0 last:pb-0">
                          <p className="text-[9px] font-black text-slate-700 dark:text-slate-300 leading-tight uppercase truncate" title={col.name}>
                            {col.name}
                          </p>
                          <div className="space-y-1 pl-2">
                            {/* College fees bar */}
                            <div className="flex items-center gap-2">
                              <div 
                                className="h-3.5 bg-gradient-to-r from-emerald-400 to-green-500 rounded-xs transition-all duration-500 shadow-xs" 
                                style={{ width: `${collegeWidth * 0.7}%` }} 
                              />
                              <span className="text-[9px] font-bold text-green-600 dark:text-green-400">
                                ₹{col.collegeFeesTarget.toLocaleString()}
                              </span>
                            </div>
                            {/* Fpc fees bar */}
                            <div className="flex items-center gap-2">
                              <div 
                                className="h-3.5 bg-gradient-to-r from-blue-400 to-indigo-600 rounded-xs transition-all duration-500 shadow-xs" 
                                style={{ width: `${fpcWidth * 0.7}%` }} 
                              />
                              <span className="text-[9px] font-bold text-blue-600 dark:text-blue-400">
                                ₹{col.fpcFeesTarget.toLocaleString()}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* ─── COLLEGES TAB ─── */}
          {activeTab === "colleges" && (
            <div className="p-4 md:p-8 space-y-5">
              {collegeStats.map((col) => (
                <div key={col.id} className="bg-white dark:bg-[#131317] rounded-2xl border border-slate-200 dark:border-slate-800/80 shadow-sm overflow-hidden">
                  <div className="px-6 py-5 bg-gradient-to-r from-slate-800 to-slate-900 flex items-center justify-between text-white border-b border-slate-100 dark:border-slate-800/80">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-xl bg-white/10 flex items-center justify-center">
                        <School className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <p className="text-sm font-extrabold text-white capitalize">{col.name}</p>
                        <p className="text-[10px] text-slate-400 font-semibold">{col.id}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-black text-white">{col.collectionRate}%</p>
                      <p className="text-[10px] text-slate-400 font-semibold">collection rate</p>
                    </div>
                  </div>
                  <div className="px-6 py-5 grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                      { label: "Students", value: col.totalStudents, color: "text-slate-700 dark:text-slate-200" },
                      { label: "Total Fees", value: fmt(col.totalFees), color: "text-slate-700 dark:text-slate-200" },
                      { label: "Collected", value: fmt(col.totalPaid), color: "text-[#D528A2]" },
                      { label: "Outstanding", value: fmt(col.outstanding), color: "text-slate-500 dark:text-slate-400" },
                    ].map(({ label, value, color }) => (
                      <div key={label} className="text-center p-3 rounded-xl bg-slate-50 dark:bg-[#1f1f27] border border-slate-100 dark:border-slate-800/40">
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold uppercase tracking-wider mb-1">{label}</p>
                        <p className={`text-base font-extrabold ${color}`}>{value}</p>
                      </div>
                    ))}
                  </div>
                  <div className="px-6 pb-5">
                    <div className="h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-[#D528A2] to-[#F4A863] transition-all duration-700"
                        style={{ width: `${col.collectionRate}%` }}
                      />
                    </div>
                    <div className="flex justify-between mt-1.5">
                      <span className="text-[9px] text-slate-400 dark:text-slate-500 font-semibold">0%</span>
                      <span className="text-[9px] text-slate-400 dark:text-slate-500 font-semibold">100%</span>
                    </div>
                  </div>
                </div>
              ))}
              {collegeStats.length === 0 && (
                <div className="text-center py-16 text-slate-400 text-sm">No college data found.</div>
              )}
            </div>
          )}

          {/* ─── STUDENTS TAB ─── */}
          {activeTab === "students" && (
            <div className="p-8">
              {/* Premium Advanced Filters Board */}
              <div className="bg-white dark:bg-[#131317] rounded-3xl border border-slate-200 dark:border-slate-800/80 p-6 shadow-sm mb-6 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/50 pb-3">
                  <div className="flex items-center gap-2">
                    <ListFilter className="h-4 w-4 text-[#D528A2]" />
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                      Student Fee Directory Filters
                    </h3>
                  </div>
                  <button
                    onClick={() => {
                      setSearchQuery("");
                      setFilterCollege("all");
                      setFilterDept("all");
                      setFilterYear("all");
                      setFilterSemester("all");
                      setFilterFeeStatus("all");
                    }}
                    className="text-[10px] font-extrabold text-slate-400 hover:text-[#D528A2] uppercase tracking-wider cursor-pointer transition-colors"
                  >
                    Clear All Filters
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                  {/* Search Input */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
                    <input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search name, register no..."
                      className="pl-8 pr-4 py-2 w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-black/10 text-xs font-medium text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#D528A2]/50"
                    />
                  </div>

                  {/* College Select */}
                  <select
                    value={filterCollege}
                    onChange={(e) => setFilterCollege(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-black/10 text-xs font-semibold text-slate-650 dark:text-slate-350 focus:outline-none focus:ring-2 focus:ring-[#D528A2]/50 cursor-pointer"
                  >
                    <option value="all">All Colleges</option>
                    {data.colleges.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>

                  {/* Department Select */}
                  <select
                    value={filterDept}
                    onChange={(e) => setFilterDept(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-black/10 text-xs font-semibold text-slate-650 dark:text-slate-350 focus:outline-none focus:ring-2 focus:ring-[#D528A2]/50 cursor-pointer"
                  >
                    <option value="all">All Departments</option>
                    {uniqueDepartments.map((dept) => (
                      <option key={dept} value={dept}>{dept}</option>
                    ))}
                  </select>

                  {/* Year Select */}
                  <select
                    value={filterYear}
                    onChange={(e) => setFilterYear(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-black/10 text-xs font-semibold text-slate-650 dark:text-slate-350 focus:outline-none focus:ring-2 focus:ring-[#D528A2]/50 cursor-pointer"
                  >
                    <option value="all">All Years</option>
                    {uniqueYears.map((yr) => (
                      <option key={yr} value={yr}>{yr}</option>
                    ))}
                  </select>

                  {/* Semester Select */}
                  <select
                    value={filterSemester}
                    onChange={(e) => setFilterSemester(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-black/10 text-xs font-semibold text-slate-650 dark:text-slate-350 focus:outline-none focus:ring-2 focus:ring-[#D528A2]/50 cursor-pointer"
                  >
                    <option value="all">All Semesters</option>
                    {uniqueSemesters.map((sem) => (
                      <option key={sem} value={sem}>{sem}</option>
                    ))}
                  </select>

                  {/* Status Select */}
                  <select
                    value={filterFeeStatus}
                    onChange={(e) => setFilterFeeStatus(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-black/10 text-xs font-semibold text-slate-650 dark:text-slate-350 focus:outline-none focus:ring-2 focus:ring-[#D528A2]/50 cursor-pointer"
                  >
                    <option value="all">All Payment Statuses</option>
                    <option value="paid">Paid</option>
                    <option value="partial">Partial</option>
                    <option value="unpaid">Unpaid</option>
                  </select>
                </div>

                <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold tracking-wide uppercase pt-1">
                  <span>Showing {filteredStudents.length} of {data.students.length} students</span>
                  {filteredStudents.length === 0 && <span className="text-rose-450 text-[10px]">No results match filters</span>}
                </div>
              </div>

              {/* Student Directory Grid */}
              <div className="space-y-4">
                {filteredStudents.length === 0 ? (
                  <div className="text-center py-16 text-slate-450 dark:text-slate-550 text-xs font-bold uppercase tracking-wider bg-white dark:bg-[#131317] rounded-3xl border border-slate-200 dark:border-slate-800/80 p-8 shadow-sm">
                    No students match the current filters.
                  </div>
                ) : (
                  filteredStudents.map((student) => {
                    const studentFees = getStudentFees(student.id);
                    const totalFees = studentFees.reduce((s, f) => s + f.amount, 0);
                    const totalPaid = studentFees.reduce((s, f) => s + f.paid_amount, 0);
                    const isExpanded = expandedStudentId === student.id;
                    const overallStatus =
                      totalPaid >= totalFees && totalFees > 0 ? "paid"
                      : totalPaid > 0 ? "partial"
                      : "unpaid";
                    return (
                      <div key={student.id} className="bg-white dark:bg-[#131317] rounded-3xl border border-slate-200 dark:border-slate-800/80 shadow-xs overflow-hidden transition-all hover:border-slate-300 dark:hover:border-slate-700/80">
                        <button
                          onClick={() => setExpandedStudentId(isExpanded ? null : student.id)}
                          className="w-full flex flex-col lg:flex-row lg:items-center justify-between gap-4 px-6 py-5 hover:bg-slate-50/50 dark:hover:bg-[#18181f]/30 transition-colors text-left cursor-pointer"
                        >
                          {/* Student Info Card Column 1 */}
                          <div className="flex items-center gap-4 min-w-[280px]">
                            <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-[#D528A2] to-[#F4A863] flex items-center justify-center font-black text-white text-sm shadow-md shrink-0">
                              {student.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-extrabold text-slate-850 dark:text-slate-100 flex items-center gap-2">
                                <span>{student.name}</span>
                                {student.register_number && (
                                  <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 text-[9px] font-black tracking-wider uppercase">
                                    {student.register_number}
                                  </span>
                                )}
                              </p>
                              <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1 text-[10px] text-slate-400 font-semibold">
                                <span className="flex items-center gap-1">
                                  <FileText className="h-3 w-3" /> {student.id}
                                </span>
                                {student.phone && <span>· {student.phone}</span>}
                              </div>
                            </div>
                          </div>

                          {/* Student College Column 2 */}
                          <div className="flex-1 min-w-[200px] lg:pl-4">
                            <p className="text-xs font-bold text-slate-700 dark:text-slate-205 flex items-center gap-1.5 uppercase tracking-wider">
                              <School className="h-3.5 w-3.5 text-slate-450" />
                              <span className="truncate">{student.department || "General"}</span>
                            </p>
                            <p className="text-[10px] text-slate-400 font-semibold mt-1 truncate">
                              {getCollegeName(student.college_id)}
                            </p>
                          </div>

                          {/* Student Money Column 3 */}
                          <div className="flex items-center gap-6 shrink-0 justify-between lg:justify-end lg:w-72">
                            <div className="text-right">
                              <p className="text-[9px] text-slate-400 uppercase tracking-widest font-black">Fees Target</p>
                              <p className="text-sm font-black text-slate-750 dark:text-slate-200 mt-0.5">{fmt(totalFees)}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-[9px] text-slate-400 uppercase tracking-widest font-black">Collected</p>
                              <p className="text-sm font-black text-[#D528A2] mt-0.5">{fmt(totalPaid)}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-[9px] text-slate-400 uppercase tracking-widest font-black">Remaining</p>
                              <p className={`text-sm font-black mt-0.5 ${totalFees - totalPaid > 0 ? "text-rose-500" : "text-emerald-500"}`}>
                                {fmt(totalFees - totalPaid)}
                              </p>
                            </div>
                          </div>

                          {/* Badge + Arrow Trigger Column 4 */}
                          <div className="flex items-center gap-3 shrink-0 self-end lg:self-auto justify-end">
                            <StatusBadge status={overallStatus} />
                            <div className="h-7 w-7 rounded-lg border border-slate-150 dark:border-slate-800 flex items-center justify-center text-slate-400 bg-slate-50/50 dark:bg-black/10">
                              <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`} />
                            </div>
                          </div>
                        </button>

                        {/* Expanded details section */}
                        {isExpanded && (
                          <div className="border-t border-slate-100 dark:border-slate-800/80 px-6 pb-6 pt-5 bg-slate-50/30 dark:bg-black/5">
                            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
                              {/* Left profile/metadata column */}
                              <div className="xl:col-span-4 bg-white dark:bg-[#131317] rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 space-y-4 shadow-xs">
                                <h4 className="text-[10px] font-black uppercase tracking-widest text-[#D528A2]">
                                  Student Metadata
                                </h4>
                                <div className="space-y-3 text-xs">
                                  <div className="flex justify-between py-1.5 border-b border-slate-50 dark:border-slate-900">
                                    <span className="text-slate-450 font-semibold">Class/Batch</span>
                                    <span className="text-slate-700 dark:text-slate-300 font-bold">{student.classGroup || "N/A"}</span>
                                  </div>
                                  <div className="flex justify-between py-1.5 border-b border-slate-50 dark:border-slate-900">
                                    <span className="text-slate-455 font-semibold">Department</span>
                                    <span className="text-slate-700 dark:text-slate-300 font-bold">{student.department || "N/A"}</span>
                                  </div>
                                  <div className="flex justify-between py-1.5 border-b border-slate-50 dark:border-slate-900">
                                    <span className="text-slate-450 font-semibold">Roll No / ID</span>
                                    <span className="text-slate-700 dark:text-slate-300 font-bold">{student.id}</span>
                                  </div>
                                  <div className="flex justify-between py-1.5 border-b border-slate-50 dark:border-slate-900">
                                    <span className="text-slate-450 font-semibold">Reg No</span>
                                    <span className="text-slate-700 dark:text-slate-300 font-bold">{student.register_number || "N/A"}</span>
                                  </div>
                                  <div className="flex justify-between py-1.5 border-b border-slate-50 dark:border-slate-900">
                                    <span className="text-slate-450 font-semibold">Email</span>
                                    <span className="text-slate-700 dark:text-slate-300 font-bold truncate max-w-[180px]">{student.email}</span>
                                  </div>
                                  <div className="flex justify-between py-1.5">
                                    <span className="text-slate-455 font-semibold">Phone</span>
                                    <span className="text-slate-700 dark:text-slate-300 font-bold">{student.phone || "N/A"}</span>
                                  </div>
                                </div>
                              </div>

                              {/* Right Fees list column */}
                              <div className="xl:col-span-8 space-y-4">
                                <h4 className="text-[10px] font-black uppercase tracking-widest text-[#D528A2] flex items-center justify-between">
                                  <span>Tuition Terms & Statuses</span>
                                  <span className="text-slate-400 font-bold text-[9px] normal-case font-mono">{studentFees.length} terms</span>
                                </h4>

                                <div className="space-y-3">
                                  {studentFees.length === 0 ? (
                                    <p className="text-xs text-slate-400">No fee terms configured for this student.</p>
                                  ) : (
                                    studentFees.map((fee) => {
                                      const isEditing = editingFeeId === fee.id;
                                      return (
                                        <div key={fee.id} className="flex flex-col md:flex-row md:items-center justify-between gap-3 py-3 px-4 rounded-xl bg-white dark:bg-[#131317] border border-slate-150 dark:border-slate-800 shadow-xs">
                                          <div className="flex-1">
                                            <p className="text-xs font-bold text-slate-700 dark:text-slate-300">{fee.term_name}</p>
                                            <p className="text-[10px] text-slate-400 mt-0.5 font-medium">Due Date: {fee.due_date || "—"}</p>
                                          </div>
                                          
                                          {isEditing ? (
                                            <div className="flex flex-wrap items-center gap-3 bg-slate-50 dark:bg-black/10 p-2.5 rounded-xl border border-slate-200 dark:border-slate-850">
                                              <div className="flex items-center gap-1.5">
                                                <span className="text-[10px] font-bold text-slate-400">Paid:</span>
                                                <input
                                                  type="number"
                                                  value={editPaidAmount}
                                                  onChange={(e) => setEditPaidAmount(e.target.value)}
                                                  className="w-20 px-2 py-1 text-xs border border-slate-200 dark:border-slate-800 rounded bg-white dark:bg-[#131317] focus:outline-none text-slate-700 dark:text-slate-200 font-bold"
                                                  placeholder="Amount"
                                                  max={fee.amount}
                                                />
                                                <span className="text-[10px] text-slate-400">of {fmt(fee.amount)}</span>
                                              </div>
                                              <div className="flex items-center gap-1.5">
                                                <span className="text-[10px] font-bold text-slate-400">Status:</span>
                                                <select
                                                  value={editStatus}
                                                  onChange={(e) => setEditStatus(e.target.value)}
                                                  className="px-2 py-1 text-xs border border-slate-200 dark:border-slate-800 rounded bg-white dark:bg-[#131317] focus:outline-none text-slate-750 dark:text-slate-250 font-bold"
                                                >
                                                  <option value="unpaid">Unpaid</option>
                                                  <option value="partial">Partial</option>
                                                  <option value="paid">Paid</option>
                                                </select>
                                              </div>
                                              <div className="flex items-center gap-1.5 ml-auto">
                                                <button
                                                  type="button"
                                                  onClick={() => handleUpdateFeeStatus(fee.id, student.id)}
                                                  disabled={savingFeeId === fee.id}
                                                  className="px-2.5 py-1 rounded bg-[#D528A2] text-white text-[10px] font-bold hover:bg-[#D528A2]/90 disabled:opacity-50 cursor-pointer"
                                                >
                                                  {savingFeeId === fee.id ? "Saving…" : "Save"}
                                                </button>
                                                <button
                                                  type="button"
                                                  onClick={() => setEditingFeeId(null)}
                                                  className="px-2.5 py-1 rounded border border-slate-200 dark:border-slate-800 text-slate-500 text-[10px] font-bold hover:bg-white dark:hover:bg-[#131317] cursor-pointer"
                                                >
                                                  Cancel
                                                </button>
                                              </div>
                                            </div>
                                          ) : (
                                            <div className="flex items-center gap-4 shrink-0 justify-between md:justify-end">
                                              <div className="text-right">
                                                <p className="text-xs font-bold text-[#D528A2]">{fmt(fee.paid_amount)}</p>
                                                <p className="text-[10px] text-slate-400 font-medium">of {fmt(fee.amount)}</p>
                                              </div>
                                              <div className="flex items-center gap-2">
                                                <StatusBadge status={fee.status} />
                                                <button
                                                  type="button"
                                                  onClick={() => {
                                                    setEditingFeeId(fee.id);
                                                    setEditPaidAmount(String(fee.paid_amount));
                                                    setEditStatus(fee.status);
                                                  }}
                                                  className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-800 hover:border-[#D528A2] hover:text-[#D528A2] text-slate-400 dark:text-slate-500 cursor-pointer transition-colors text-[10px] font-extrabold"
                                                >
                                                  Collect
                                                </button>
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })
                                  )}
                                </div>

                                {/* Transaction Ledger section for this student */}
                                <div className="space-y-2 pt-2">
                                  <h5 className="text-[9px] font-black uppercase tracking-wider text-slate-455">
                                    Payment Transaction Log
                                  </h5>
                                  {data.payments.filter((p) => p.student_id === student.id).length === 0 ? (
                                    <p className="text-[10px] text-slate-400 italic">No payments logged yet.</p>
                                  ) : (
                                    <div className="bg-slate-50 dark:bg-black/10 rounded-2xl border border-slate-100 dark:border-slate-800/80 divide-y divide-slate-100 dark:divide-slate-800/60 overflow-hidden">
                                      {data.payments
                                        .filter((p) => p.student_id === student.id)
                                        .map((payment) => (
                                          <div key={payment.id} className="flex justify-between items-center py-2.5 px-4 text-[10px] hover:bg-slate-100/50 dark:hover:bg-[#18181f]/40 transition-colors">
                                            <div>
                                              <p className="font-extrabold text-slate-700 dark:text-slate-300">
                                                {payment.receipt_no} <span className="text-[9px] font-semibold text-slate-400">({payment.payment_method})</span>
                                              </p>
                                              <p className="text-[9px] text-slate-400">{new Date(payment.payment_date).toLocaleString()}</p>
                                            </div>
                                            <div className="text-right">
                                              <span className="font-black text-[#D528A2]">{fmt(payment.amount)}</span>
                                              <p className="text-[8px] text-slate-450 font-mono tracking-wider truncate max-w-[120px]">{payment.reference_no}</p>
                                            </div>
                                          </div>
                                        ))}
                                    </div>
                                  )}
                                </div>

                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* ─── TRANSACTIONS TAB ─── */}
          {activeTab === "transactions" && (
            <div className="p-8">
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs min-w-[680px]">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50">
                        <th className="text-left px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-wider">Receipt No.</th>
                        <th className="text-left px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-wider">Student</th>
                        <th className="text-left px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-wider">College</th>
                        <th className="text-left px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-wider">Amount</th>
                        <th className="text-left px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-wider">Method</th>
                        <th className="text-left px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-wider">Reference</th>
                        <th className="text-left px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-wider">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {filteredPayments.map((p) => (
                        <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="px-6 py-3.5 font-mono text-[10px] text-[#D528A2] font-bold">{p.receipt_no}</td>
                          <td className="px-4 py-3.5">
                            <p className="font-semibold text-slate-700">{getStudentName(p.student_id)}</p>
                            <p className="text-[9px] text-slate-400 font-mono">{p.student_id}</p>
                          </td>
                          <td className="px-4 py-3.5 text-slate-500 font-medium text-[10px]">
                            {(() => {
                              const student = data?.students.find(s => s.id === p.student_id);
                              const colId = p.college_id || student?.college_id || "";
                              return getCollegeName(colId).slice(0, 25);
                            })()}
                          </td>
                          <td className="px-4 py-3.5 font-extrabold text-slate-800">{fmt(p.amount)}</td>
                          <td className="px-4 py-3.5"><MethodBadge method={p.payment_method} /></td>
                          <td className="px-4 py-3.5 font-mono text-[9px] text-slate-400">{p.reference_no}</td>
                          <td className="px-4 py-3.5 text-slate-500 font-medium">{new Date(p.payment_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {filteredPayments.length === 0 && (
                    <div className="px-6 py-16 text-center text-sm text-slate-400">No transactions found{searchQuery ? ` for "${searchQuery}"` : ""}.</div>
                  )}
                </div>
                {filteredPayments.length > 0 && (
                  <div className="px-6 py-3 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
                    <p className="text-[10px] text-slate-400 font-semibold">{filteredPayments.length} transaction{filteredPayments.length !== 1 ? "s" : ""}</p>
                    <p className="text-xs font-extrabold text-[#D528A2]">
                      Total: {fmt(filteredPayments.reduce((s, p) => s + p.amount, 0))}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Excel Upload Modal */}
        {showUploadModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs font-sans">
            <div className="bg-white dark:bg-[#131317] rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl max-w-2xl w-full p-6 space-y-4 animate-in fade-in duration-150 text-slate-800 dark:text-slate-200">
              <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-805 pb-3">
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                    Bulk Upload Student Fees (Excel)
                  </h3>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold mt-0.5">
                    Upload an Excel file with student fee details to map and record them.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="text-slate-400 hover:text-slate-600 font-bold text-lg cursor-pointer transition-colors"
                >
                  &times;
                </button>
              </div>

              {uploadError && (
                <div className="p-3.5 bg-rose-50 dark:bg-rose-955/20 border border-rose-100 dark:border-rose-900/30 rounded-2xl flex items-center gap-3 text-xs text-rose-600 dark:text-rose-400">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <p className="font-semibold">{uploadError}</p>
                </div>
              )}

              {uploadResult ? (
                <div className="space-y-4">
                  <div className="p-4 bg-emerald-50 dark:bg-emerald-955/20 border border-emerald-100 dark:border-emerald-900/30 rounded-2xl space-y-2">
                    <p className="text-xs font-bold text-emerald-800 dark:text-emerald-400">{uploadResult.message}</p>
                    <div className="grid grid-cols-2 gap-4 text-center mt-2">
                      <div className="p-2.5 bg-white dark:bg-[#1f1f27] rounded-xl border border-emerald-100 dark:border-emerald-900/20">
                        <span className="text-xl font-black text-emerald-700 dark:text-emerald-450">{uploadResult.processedCount}</span>
                        <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block mt-1">Processed Successfully</span>
                      </div>
                      <div className="p-2.5 bg-white dark:bg-[#1f1f27] rounded-xl border border-emerald-100 dark:border-emerald-900/20">
                        <span className="text-xl font-black text-amber-600 dark:text-amber-500">{uploadResult.skippedCount}</span>
                        <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block mt-1">Students Skipped / Not Found</span>
                      </div>
                    </div>
                  </div>

                  {uploadResult.skippedCount > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider">Skipped Rows Details</p>
                      <div className="max-h-40 overflow-y-auto border border-slate-100 dark:border-slate-800 rounded-2xl divide-y divide-slate-50 dark:divide-slate-800 text-[10px]">
                        {uploadResult.skippedRows.map((r: any, idx: number) => (
                          <div key={idx} className="p-2.5 flex justify-between gap-4 hover:bg-slate-50/50 dark:hover:bg-slate-800/10">
                            <div>
                              <span className="font-extrabold text-slate-700 dark:text-slate-300">{r.studentName || "Unknown Name"}</span>
                              <span className="text-slate-400 dark:text-slate-500 block font-mono">{r.email || "No Email"}</span>
                            </div>
                            <span className="text-rose-500 dark:text-rose-450 font-bold self-center">{r.reason}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex justify-end pt-2">
                    <button
                      onClick={() => {
                        setShowUploadModal(false);
                        setUploadResult(null);
                        setUploadStep(1);
                        setColIndices({});
                        setSheetHeaders([]);
                        setSheetRows([]);
                      }}
                      className="px-5 py-2.5 rounded-2xl btn-gradient text-white text-xs font-bold shadow-sm cursor-pointer"
                    >
                      Close & Refresh
                    </button>
                  </div>
                </div>
              ) : uploadStep === 1 ? (
                /* ─── STEP 1: UPLOAD FILE ONLY ─── */
                <div className="space-y-5 text-xs font-semibold">
                  {/* Generate & Download Template */}
                  <div className="p-4 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-[#131317]/25 space-y-3">
                    <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-2">
                      <span className="text-[10px] font-black text-[#D528A2] uppercase tracking-wider">Download Pre-filled Excel Template</span>
                      <span className="text-[9px] text-slate-400 dark:text-slate-500 font-bold">Avoid spelling & mapping mistakes</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 text-[10px]">
                      <div>
                        <label className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block mb-1">Select College</label>
                        <select
                          value={selectedTemplateCollege}
                          onChange={(e) => setSelectedTemplateCollege(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl border border-slate-205 dark:border-slate-800 bg-white dark:bg-[#1f1f27] text-slate-700 dark:text-slate-200 outline-none focus:ring-1 focus:ring-[#D528A2] cursor-pointer font-bold"
                        >
                          {availableColleges.map((colName) => (
                            <option key={colName} value={colName}>{toTitleCase(colName)}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block mb-1">Department</label>
                        <select
                          value={selectedTemplateDept}
                          onChange={(e) => setSelectedTemplateDept(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl border border-slate-205 dark:border-slate-800 bg-white dark:bg-[#1f1f27] text-slate-700 dark:text-slate-200 outline-none focus:ring-1 focus:ring-[#D528A2] cursor-pointer font-bold"
                        >
                          {availableDepartments.map((dept) => (
                            <option key={dept} value={dept}>{toTitleCase(dept)}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block mb-1">Semester</label>
                        <select
                          value={selectedTemplateSem}
                          onChange={(e) => setSelectedTemplateSem(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl border border-slate-205 dark:border-slate-800 bg-white dark:bg-[#1f1f27] text-slate-700 dark:text-slate-200 outline-none focus:ring-1 focus:ring-[#D528A2] cursor-pointer font-bold"
                        >
                          {availableSemesters.map((sem) => (
                            <option key={sem} value={sem}>{toTitleCase(sem)}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block mb-1">Academic Year Batch</label>
                        <select
                          value={selectedTemplateYear}
                          onChange={(e) => setSelectedTemplateYear(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl border border-slate-205 dark:border-slate-800 bg-white dark:bg-[#1f1f27] text-slate-700 dark:text-slate-200 outline-none focus:ring-1 focus:ring-[#D528A2] cursor-pointer font-bold"
                        >
                          {availableYears.map((yr) => (
                            <option key={yr} value={yr}>{toTitleCase(yr)}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="flex justify-end pt-1">
                      <button
                        type="button"
                        onClick={handleDownloadTemplate}
                        className="px-4 py-2 rounded-xl bg-white hover:bg-slate-50 dark:bg-[#1f1f27] dark:hover:bg-[#252530] border border-slate-200 dark:border-slate-800 text-[#D528A2] font-black tracking-wide flex items-center gap-1.5 cursor-pointer shadow-xs transition-all text-[10px]"
                      >
                        <Download className="h-3.5 w-3.5" /> Download Template (.xlsx)
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Excel File Selector</label>
                    <div className="border-2 border-dashed border-slate-200 dark:border-slate-800 hover:border-[#D528A2] dark:hover:border-[#D528A2] rounded-3xl p-10 text-center bg-slate-50 dark:bg-[#1f1f27] transition-colors relative cursor-pointer group">
                      <input
                        type="file"
                        accept=".xlsx, .xls, .csv"
                        onChange={handleFileChange}
                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                      />
                      <Upload className="h-9 w-9 mx-auto text-slate-400 group-hover:text-[#D528A2] transition-colors mb-3" />
                      <p className="text-slate-600 dark:text-slate-300 font-extrabold text-xs">Drag & Drop file here or click to browse</p>
                      <p className="text-slate-400 dark:text-slate-500 font-medium text-[9px] mt-1 font-mono">Supported formats: .xlsx, .xls, .csv</p>
                    </div>
                  </div>

                  <div className="flex gap-3 pt-1">
                    <button
                      type="button"
                      onClick={() => setShowUploadModal(false)}
                      className="flex-1 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-805 text-slate-550 dark:text-slate-400 font-bold hover:bg-slate-50 dark:hover:bg-slate-800/30 cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled
                      className="flex-1 py-2.5 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 font-bold cursor-not-allowed opacity-60"
                    >
                      Upload & Process (Choose File)
                    </button>
                  </div>
                </div>
              ) : (
                /* ─── STEP 2: HEADERS MAPPING & PREVIEW ─── */
                <div className="space-y-4 text-xs font-semibold">
                  <div className="p-4 rounded-2xl border border-[#D528A2]/10 bg-[#D528A2]/5 dark:bg-[#D528A2]/5/20 space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-black text-[#D528A2] uppercase tracking-wider">Excel Column Header Mappings</span>
                      <span className="text-[9px] text-slate-455 font-bold">Autodetected columns matching registration structure</span>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3 text-[10px]">
                      {[
                        { key: "register_number", label: "Registration Number" },
                        { key: "college", label: "College Name" },
                        { key: "student", label: "Student Name" },
                        { key: "year", label: "Year" },
                        { key: "email", label: "Email" },
                        { key: "phone", label: "Mobile Number" },
                        { key: "t", label: "Department" },
                        { key: "semester", label: "Semester" },
                        { key: "paid", label: "FPC FEES PAID" },
                        { key: "pending", label: "FPC FEES PENDING" },
                        { key: "amount", label: "Amount" },
                      ].map(({ key, label }) => {
                        const selectedIdx = colIndices[key] !== undefined ? colIndices[key] : -1;
                        return (
                          <div key={key} className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-slate-800/50 gap-4">
                            <span className="text-slate-500 dark:text-slate-400 font-bold shrink-0">{label}</span>
                            <select
                              value={selectedIdx}
                              onChange={(e) => handleMappingChange(key, Number(e.target.value))}
                              className="px-2 py-1 rounded bg-white dark:bg-[#131317] border border-slate-200 dark:border-slate-800 text-[10px] text-slate-700 dark:text-slate-200 outline-none focus:ring-1 focus:ring-[#D528A2] cursor-pointer font-bold max-w-[150px] truncate"
                            >
                              <option value={-1}>— Skip / Do Not Map —</option>
                              {sheetHeaders.map((h, idx) => (
                                <option key={idx} value={idx}>{h}</option>
                              ))}
                            </select>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-black text-slate-400 dark:text-slate-550 uppercase tracking-wider">Matched Student Rows Preview ({parsedData.length} records)</span>
                      <span className="text-[9px] text-slate-455 font-semibold">First 5 records preview</span>
                    </div>

                    <div className="max-h-40 overflow-y-auto border border-slate-100 dark:border-slate-800 rounded-2xl divide-y divide-slate-50 dark:divide-slate-800 text-[10px]">
                      {parsedData.slice(0, 5).map((row, idx) => (
                        <div key={idx} className="p-2.5 flex justify-between gap-4 hover:bg-slate-50/50 dark:hover:bg-slate-800/10">
                          <div>
                            <span className="font-extrabold text-slate-700 dark:text-slate-200">{row.studentName}</span>
                            <span className="text-slate-400 dark:text-slate-500 block font-mono text-[9px]">
                              Reg: {row.registerNumber || "—"} • {row.email || "No Email"} • {row.phone || "No Mobile"}
                            </span>
                            {row.t && <span className="text-[8px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-bold mt-1 inline-block uppercase">{row.t}</span>}
                          </div>
                          <div className="text-right font-mono self-center">
                            <span className="font-black text-slate-800 dark:text-slate-200">Amount: ₹{row.amount.toLocaleString()}</span>
                            <span className="text-slate-400 dark:text-slate-500 block text-[9px]">Paid: ₹{row.paid.toLocaleString()} • Pending: ₹{row.pending.toLocaleString()}</span>
                          </div>
                        </div>
                      ))}
                      {parsedData.length > 5 && (
                        <div className="p-2.5 text-center text-slate-400 font-medium text-[9px] italic bg-slate-50/20 dark:bg-slate-800/5">
                          And {parsedData.length - 5} more records…
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setUploadStep(1);
                        setParsedData([]);
                        setColIndices({});
                        setSheetHeaders([]);
                        setSheetRows([]);
                        setUploadError(null);
                      }}
                      className="flex-1 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 text-slate-550 dark:text-slate-400 font-bold hover:bg-slate-50 dark:hover:bg-slate-800/30 cursor-pointer"
                    >
                      Back / Reset File
                    </button>
                    <button
                      type="button"
                      disabled={uploading}
                      onClick={handleBulkUpload}
                      className="flex-1 py-2.5 rounded-2xl btn-gradient text-white font-bold shadow-sm cursor-pointer disabled:opacity-50"
                    >
                      {uploading ? "Uploading & Processing…" : `Upload & Process ${parsedData.length} Records`}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
