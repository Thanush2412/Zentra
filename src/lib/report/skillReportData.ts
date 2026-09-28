/**
 * Skill Development Monthly Report — metrics computation layer.
 *
 * Computes every metric the PPTX report needs from portal data:
 *  - Attendance buckets (Excellent 90–100 / Good 80–89 / Average 75–79 / Poor <75)
 *  - Technical evaluation (LeetCode problems solved vs assigned, class average %)
 *  - Communication levels (CEFR distribution from students.efset_score)
 *  - Academic performance (Aptitude & Verbal brackets from students.hire_score)
 * All functions are pure so they can be unit-tested and shared by the preview
 * endpoint and the PPTX assembly route.
 */

export interface AttendanceRow {
  studentId?: string;
  status?: string;
  dateStr?: string;
}

export interface StudentRow {
  id?: string;
  studentId?: string;
  name?: string;
  classGroup?: string;
  classgroup?: string;
  department?: string;
  efset_score?: string | null;
  hire_score?: number | string | null;
  leetcodeLink?: string;
  leetcode_link?: string;
}

export interface LcRow {
  name?: string;
  registerNumber?: string;
  email?: string;
  solvedTotal?: number;
}

export interface BatchMetrics {
  batchLabel: string;
  batchTitle: string;
  academicYears: string;
  totalStudents: number;
  attendance: {
    excellent: number;
    good: number;
    average: number;
    poor: number;
    total: number;
    classAveragePct: number;
    narrative: string;
  };
  technical: {
    problemsAssigned: number;
    problemsSolvedAvg: number;
    classAveragePct: number;
    narrative1: string;
    narrative2: string;
  };
  communication: {
    a1: number;
    a2: number;
    b1: number;
    b2: number;
    c1: number;
    absent: number;
    total: number;
    narrative: string;
  };
  academic: {
    below40: number;
    between40and60: number;
    above60: number;
    total: number;
    narrative: string;
  };
}

const PCT = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 10000) / 100 : 0);

/** Group students by their classGroup (batch). */
export function groupStudentsByBatch(students: StudentRow[]): Map<string, StudentRow[]> {
  const map = new Map<string, StudentRow[]>();
  students.forEach(s => {
    const batch = (s.classGroup || s.classgroup || "General").toString().trim();
    if (!map.has(batch)) map.set(batch, []);
    map.get(batch)!.push(s);
  });
  return map;
}

/** Attendance % per student from raw attendance rows, optionally month-filtered (YYYY-MM). */
export function computeAttendancePctPerStudent(
  attendance: AttendanceRow[],
  monthPrefix?: string
): Map<string, number> {
  const stats = new Map<string, { present: number; total: number }>();
  attendance.forEach(a => {
    if (!a.studentId) return;
    if (monthPrefix && a.dateStr && !a.dateStr.startsWith(monthPrefix)) return;
    const st = (a.status || "").toLowerCase();
    if (st !== "present" && st !== "absent" && st !== "od") return; // ignore unmarked
    let entry = stats.get(a.studentId);
    if (!entry) {
      entry = { present: 0, total: 0 };
      stats.set(a.studentId, entry);
    }
    entry.total += 1;
    if (st === "present" || st === "od") entry.present += 1;
  });
  const out = new Map<string, number>();
  stats.forEach((v, k) => out.set(k, v.total > 0 ? (v.present / v.total) * 100 : 0));
  return out;
}

export function computeAttendanceBuckets(
  students: StudentRow[],
  attendance: AttendanceRow[],
  monthPrefix?: string
): BatchMetrics["attendance"] {
  const pct = computeAttendancePctPerStudent(attendance, monthPrefix);
  const buckets = { excellent: 0, good: 0, average: 0, poor: 0 };
  let sum = 0;
  let counted = 0;
  students.forEach(s => {
    const id = s.id || s.studentId || "";
    const p = pct.get(id);
    if (p === undefined) return; // student with no attendance records this period
    counted++;
    sum += p;
    if (p >= 90) buckets.excellent++;
    else if (p >= 80) buckets.good++;
    else if (p >= 75) buckets.average++;
    else buckets.poor++;
  });
  const total = students.length;
  const classAveragePct = counted > 0 ? Math.round((sum / counted) * 100) / 100 : 0;
  return {
    ...buckets,
    total,
    classAveragePct,
    narrative: buildAttendanceNarrative(buckets, total, classAveragePct)
  };
}

/** Template-style narrative sentences with computed numbers injected. */
export function buildAttendanceNarrative(
  b: { excellent: number; good: number; average: number; poor: number },
  total: number,
  classAvg: number
): string {
  const above75 = b.excellent + b.good + b.average;
  let s = `Based on the attendance records, out of a total of ${total} students, ${above75} students have maintained attendance above 75%`;
  if (above75 > 0) {
    const parts: string[] = [];
    if (b.excellent > 0) parts.push(`${b.excellent} student${b.excellent !== 1 ? "s" : ""} ${b.excellent !== 1 ? "are" : "is"} in the Excellent category (90-100%)`);
    if (b.good > 0) parts.push(`${b.good} student${b.good !== 1 ? "s" : ""} in the Good category (80-89%)`);
    if (b.average > 0) parts.push(`${b.average} student${b.average !== 1 ? "s" : ""} in the Average category (75-79%)`);
    if (parts.length > 0) s += `, which is commendable. Among them, ${parts.join(", ")}`;
    s += ". ";
  } else {
    s += ". ";
  }
  s += `However, ${b.poor} student${b.poor !== 1 ? "s have" : " has"} recorded attendance below 75% in the Poor category and will require focused monitoring, additional guidance, and appropriate corrective measures to improve their attendance and overall academic participation. `;
  s += `The class average attendance for the month stands at ${classAvg}%.`;
  return s;
}

export interface TechnicalInput {
  problemsAssigned: number;
  /** LeetCode solved totals per student id (from lc_students) */
  solvedByStudent: Map<string, number>;
  students: StudentRow[];
}

export function computeTechnical(
  input: TechnicalInput
): BatchMetrics["technical"] {
  const { problemsAssigned, solvedByStudent, students } = input;
  const solvedList: number[] = [];
  students.forEach(s => {
    const id = s.id || s.studentId || "";
    const solved = solvedByStudent.get(id);
    if (solved !== undefined) solvedList.push(solved);
  });
  const avgSolved = solvedList.length > 0
    ? Math.round((solvedList.reduce((a, b) => a + b, 0) / solvedList.length) * 100) / 100
    : 0;
  const classAveragePct = problemsAssigned > 0
    ? PCT(avgSolved, problemsAssigned)
    : 0;

  const n = solvedList.length;
  const narrative1 = `Students underwent rigorous training in coding skills, focusing on solving practical programming problems on the Leet Code platform. A total of ${problemsAssigned} homework problem${problemsAssigned !== 1 ? "s were" : " was"} assigned to enhance their technical proficiency and problem-solving abilities. On average, students successfully solved ${avgSolved} out of ${problemsAssigned} problems, indicating ${classAveragePct >= 60 ? "a good" : classAveragePct >= 40 ? "a moderate" : "a developing"} level of performance. While several students demonstrated strong coding skills by achieving high scores, a few students showed potential and can perform well with additional guidance and support.`;
  const narrative2 = `Each student's performance was assessed based on the number of problems solved and the depth of understanding demonstrated. Scores were then converted into percentages to ensure accurate and detailed progress tracking. The class achieved an average score of ${classAveragePct}%, reflecting a developing level of coding capability with opportunities for further growth.`;

  return { problemsAssigned, problemsSolvedAvg: avgSolved, classAveragePct, narrative1, narrative2 };
}

const CEFR_ORDER = ["A1", "A2", "B1", "B2", "C1", "C2"];

export function computeCommunication(students: StudentRow[], periodLabel?: string): BatchMetrics["communication"] {
  const counts = { a1: 0, a2: 0, b1: 0, b2: 0, c1: 0, absent: 0 };
  students.forEach(s => {
    const raw = (s.efset_score || "").toString().trim().toUpperCase();
    if (!raw) { counts.absent++; return; }
    const m = raw.match(/\b(A1|A2|B1|B2|C1|C2)\b/);
    if (!m) { counts.absent++; return; }
    switch (m[1]) {
      case "A1": counts.a1++; break;
      case "A2": counts.a2++; break;
      case "B1": counts.b1++; break;
      case "B2": counts.b2++; break;
      default: counts.c1++; break;
    }
  });
  const total = students.length;
  const levelSentence = CEFR_ORDER
    .map(l => {
      const key = l.toLowerCase() as keyof typeof counts;
      const n = counts[key];
      return n > 0 ? `${n} student${n !== 1 ? "s" : ""} ${["A1"].includes(l) ? "are at" : "have achieved"} ${l} level` : null;
    })
    .filter(Boolean)
    .join(", ");
  const narrative = `Students underwent focused training in communication skills, emphasizing clarity, confidence, and effectiveness in expression. Various activities and tasks were conducted to strengthen their Writing, Listening, Speaking, Reading, and Presentation abilities. In the Communication Skills assessment based on CEFR levels${periodLabel ? ` conducted in ${periodLabel}` : ""}, out of ${total} students, ${levelSentence || "no levels recorded"}.${counts.absent > 0 ? ` ${counts.absent} student${counts.absent !== 1 ? "s were" : " was"} absent or unassessed.` : ""}`;
  return { ...counts, total, narrative };
}

/** Aptitude & Verbal brackets. hire_score is 0–100. */
export function computeAcademic(students: StudentRow[], periodLabel?: string): BatchMetrics["academic"] {
  const counts = { below40: 0, between40and60: 0, above60: 0 };
  let scored = 0;
  students.forEach(s => {
    const raw = s.hire_score;
    if (raw === null || raw === undefined || raw === "") return;
    const v = parseFloat(String(raw));
    if (isNaN(v)) return;
    scored++;
    if (v >= 60) counts.above60++;
    else if (v >= 40) counts.between40and60++;
    else counts.below40++;
  });
  const total = students.length;
  const narrative = `In Aptitude & Verbal, based on the assessments conducted${periodLabel ? ` in ${periodLabel}` : ""}, out of ${total} students, ${counts.above60} students attained scores above 60%, which is highly commendable. ${counts.below40 + counts.between40and60 > 0 ? `However, ${counts.below40 + counts.between40and60} students obtained scores below 60% and will require focused attention, additional support, and targeted interventions to strengthen their logical reasoning, quantitative aptitude, and verbal ability skills to improve their performance in the forthcoming sessions.` : ""} Performance distribution: 0–40%: ${counts.below40} students, 40–60%: ${counts.between40and60} students, above 60%: ${counts.above60} students (assessed: ${scored}).`;
  return { ...counts, total, narrative };
}

/** Build a pretty batch title from a classGroup like "III BCA" / "II B.Sc AIML". */
export function buildBatchTitle(classGroup: string): { title: string; years: string } {
  const romanYear = classGroup.trim().split(/\s+/)[0] || "I";
  const yearNum: Record<string, number> = { I: 1, II: 2, III: 3, IV: 4 };
  const year = yearNum[romanYear] || 1;
  const deptRaw = classGroup.trim().replace(/^\w+\s+/, "");
  const deptMap: Record<string, string> = {
    "BCA": "Bachelor of Computer Applications",
    "B.SC AIML": "Bachelor of Science (Artificial Intelligence and Machine Learning)",
    "AIML": "Bachelor of Science (Artificial Intelligence and Machine Learning)",
    "B.COM": "Bachelor of Commerce",
    "B.COM (FINTECH)": "Bachelor of Commerce (Fin Tech)",
    "FINTECH": "Bachelor of Commerce (Fin Tech)",
    "BBA": "Bachelor of Business Administration"
  };
  const dept = deptMap[deptRaw.toUpperCase().trim()] || deptRaw;
  const nowYear = new Date().getFullYear();
  const startYear = nowYear - year;
  return { title: `${romanYear} ${dept}`, years: `${startYear} - ${startYear + 3}` };
}

/**
 * Full metrics for every batch, in report order.
 * problemsAssigned: per-batch LeetCode assignment target (portal setting or default 20).
 */
export function computeBatchReport(input: {
  batchName: string;
  students: StudentRow[];
  attendance: AttendanceRow[];
  leetcodeByStudentId: Map<string, number>;
  problemsAssigned?: number;
  monthPrefix?: string;
  /** e.g. "May 2026" — injected into communication/academic narratives. */
  periodLabel?: string;
}): BatchMetrics {
  const { batchName, students, attendance, leetcodeByStudentId, problemsAssigned = 20, monthPrefix, periodLabel } = input;
  const title = buildBatchTitle(batchName);
  return {
    batchLabel: batchName,
    batchTitle: title.title,
    academicYears: title.years,
    totalStudents: students.length,
    attendance: computeAttendanceBuckets(students, attendance, monthPrefix),
    technical: computeTechnical({
      problemsAssigned,
      solvedByStudent: leetcodeByStudentId,
      students
    }),
    communication: computeCommunication(students, periodLabel),
    academic: computeAcademic(students, periodLabel)
  };
}
