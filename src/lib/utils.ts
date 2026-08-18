import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function isTimeSlotMatch(t1?: string, t2?: string): boolean {
  if (!t1 || !t2) return false;
  if (t1 === t2) return true;

  const norm = (s: string) => {
    return s
      .toLowerCase()
      .replace(/p\.m/g, "pm")
      .replace(/a\.m/g, "am")
      .replace(/to/g, "-")
      .replace(/\./g, ":")
      .replace(/\s+/g, "")
      .replace(/(\D)0(\d)/g, "$1$2")
      .replace(/^0(\d)/, "$1");
  };

  return norm(t1) === norm(t2);
}

export function isCohortMatch(c1?: string, c2?: string): boolean {
  if (!c1 || !c2) return false;
  if (c1 === c2) return true;
  const norm1 = c1.toLowerCase().replace(/[^a-z0-9]/g, "");
  const norm2 = c2.toLowerCase().replace(/[^a-z0-9]/g, "");
  return norm1 === norm2 || norm1.includes(norm2) || norm2.includes(norm1);
}

export function isDeptSubjectMatch(subDept?: string, dName?: string, dCode?: string): boolean {
  if (!subDept || !dName) return false;
  const norm = (str: string) => (str || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const nSub = norm(subDept);
  const nName = norm(dName);
  if (nSub === nName) return true;
  if (dCode && nSub === norm(dCode)) return true;
  const baseSub = norm(subDept.replace(/\s*-\s*(Semester|Sem|Year|Yr|Shift|Batch)\s*\d+/gi, ""));
  const baseName = norm(dName.replace(/\s*-\s*(Semester|Sem|Year|Yr|Shift|Batch)\s*\d+/gi, ""));
  return baseSub === baseName || (nSub.length > 3 && nName.length > 3 && (nSub.includes(nName) || nName.includes(nSub)));
}

export function isSameYear(sYear?: string | number, targetYrStr?: string, sSem?: string): boolean {
  const targetYrNum = targetYrStr ? parseInt(String(targetYrStr).replace(/\D/g, ""), 10) : 0;

  if (sYear !== undefined && sYear !== null && sYear !== "") {
    const s = String(sYear).toLowerCase().trim();
    const t = (targetYrStr || "").toLowerCase().trim();
    if (s === t) return true;
    const sNum = parseInt(s.replace(/\D/g, ""), 10);
    if (sNum && targetYrNum && sNum === targetYrNum) return true;
    if (targetYrNum === 1 && (s === "year i" || s === "1" || s === "year 1" || s === "i")) return true;
    if (targetYrNum === 2 && (s === "year ii" || s === "2" || s === "year 2" || s === "ii")) return true;
    if (targetYrNum === 3 && (s === "year iii" || s === "3" || s === "year 3" || s === "iii")) return true;
    if (targetYrNum === 4 && (s === "year iv" || s === "4" || s === "year 4" || s === "iv")) return true;
  }

  // Fallback: Infer year from semester if sYear is missing or not matching
  if (sSem && targetYrNum) {
    const semNum = parseInt(String(sSem).replace(/\D/g, ""), 10);
    if (semNum) {
      const inferredYr = Math.ceil(semNum / 2);
      if (inferredYr === targetYrNum) return true;
    }
  }

  return false;
}

export function isSameSemester(sSem?: string, targetSemStr?: string): boolean {
  if (!sSem || !targetSemStr) return false;
  const s = String(sSem).toLowerCase().replace(/[^a-z0-9]/g, "");
  const t = String(targetSemStr).toLowerCase().replace(/[^a-z0-9]/g, "");
  if (s === t) return true;
  const sNum = s.match(/\d+/)?.[0];
  const tNum = t.match(/\d+/)?.[0];
  return !!(sNum && tNum && sNum === tNum);
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function parseRoomsList(roomsStr?: string | null): string[] {
  if (!roomsStr || !roomsStr.trim()) return [];
  const raw = roomsStr.trim();
  if (raw.startsWith("[")) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.map(r => String(r).replace(/[\[\]"]/g, "").trim()).filter(Boolean);
      }
    } catch (_) {}
  }
  if (raw.startsWith("{")) {
    try {
      const parsed = JSON.parse(raw);
      return Object.values(parsed).map(r => String(r).replace(/[\[\]"]/g, "").trim()).filter(Boolean);
    } catch (_) {}
  }
  return raw
    .split(",")
    .map(r => r.replace(/[\[\]"]/g, "").trim())
    .filter(Boolean);
}

export function formatDate(dateString: string): string {
  try {
    const d = parseDbDate(dateString);
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    });
  } catch (e) {
    return dateString;
  }
}

export function parseDateToYMD(val?: any): string {
  if (!val) return "";
  if (val instanceof Date) {
    if (!isNaN(val.getTime())) {
      return val.toISOString().split("T")[0];
    }
    return "";
  }
  const str = String(val).trim();
  if (!str) return "";

  // If it's a numeric Excel serial (e.g. 38456 or 39164 or 44560)
  if (/^\d{4,6}$/.test(str)) {
    const serial = Number(str);
    if (serial > 10000 && serial < 100000) {
      // Excel epoch starts at 1899-12-30 (25569 days to 1970-01-01)
      const date = new Date(Math.round((serial - 25569) * 86400 * 1000));
      if (!isNaN(date.getTime())) {
        return date.toISOString().split("T")[0];
      }
    }
  }

  // If it's an ISO string containing Excel serial (e.g., +039164-01-01...)
  const isoSerialMatch = str.match(/\+0*(\d{5})/);
  if (isoSerialMatch) {
    const serial = parseInt(isoSerialMatch[1], 10);
    if (serial > 10000 && serial < 100000) {
      const date = new Date(Math.round((serial - 25569) * 86400 * 1000));
      if (!isNaN(date.getTime())) {
        return date.toISOString().split("T")[0];
      }
    }
  }

  // Handle malformed Excel CSV dates like "2/726" or "3/726"
  // These are D/MMYY where the slash between M and YY is missing
  // e.g. "2/726" = day=2, month=7, year=26 = 2026-07-02
  const malformedMatch = str.match(/^(\d{1,2})\/(\d)(\d{2})$/);
  if (malformedMatch) {
    const day = malformedMatch[1].padStart(2, "0");
    const month = malformedMatch[2].padStart(2, "0");
    const yr = parseInt(malformedMatch[3], 10);
    const year = yr > 40 ? `19${malformedMatch[3]}` : `20${malformedMatch[3]}`;
    return `${year}-${month}-${day}`;
  }

  // Handle DD-MM-YYYY, DD/MM/YYYY, DD.MM.YYYY
  const dmyMatch = str.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/);
  if (dmyMatch) {
    const day = dmyMatch[1].padStart(2, "0");
    const month = dmyMatch[2].padStart(2, "0");
    let year = dmyMatch[3];
    if (year.length === 2) {
      year = parseInt(year, 10) > 40 ? `19${year}` : `20${year}`;
    }
    return `${year}-${month}-${day}`;
  }

  // Handle YYYY-MM-DD
  const ymdMatch = str.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (ymdMatch) {
    const year = ymdMatch[1];
    const month = ymdMatch[2].padStart(2, "0");
    const day = ymdMatch[3].padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  // Fallback to standard JS Date
  try {
    const d = new Date(str);
    if (!isNaN(d.getTime()) && d.getFullYear() > 1900 && d.getFullYear() < 2100) {
      return d.toISOString().split("T")[0];
    }
  } catch (_) {}

  return str;
}

export function formatDisplayDob(val?: string): string {
  if (!val) return "—";
  const ymd = parseDateToYMD(val);
  if (/^\d{4}-\d{2}-\d{2}$/.test(ymd)) {
    const [y, m, d] = ymd.split("-");
    return `${d}/${m}/${y}`;
  }
  return ymd || "—";
}

export function parseDbDate(dStr?: string): Date {
  if (!dStr) return new Date();
  const trimmed = dStr.trim();
  // If raw SQLite timestamp (no 'Z', '+', or 'T')
  if (!trimmed.includes("Z") && !trimmed.includes("+") && !trimmed.includes("T")) {
    return new Date(trimmed.replace(" ", "T") + "Z");
  }
  return new Date(trimmed);
}

export function formatTimeLabel(timeStr: string): string {
  if (!timeStr) return "";
  const parts = timeStr.split(/\s*(?:-|to|TO)\s*/);
  if (parts.length > 0) {
    let start = parts[0].trim();
    // Normalize A.M / P.M to AM / PM
    start = start.replace(/A\.M\.?/i, "AM").replace(/P\.M\.?/i, "PM");
    return start;
  }
  return timeStr;
}

export function getSubjectsForDepartment(
  subjectsList: any[],
  mentors: any[],
  slots: any[],
  targetDept: string
): any[] {
  if (!subjectsList || !Array.isArray(subjectsList)) return [];
  const safeMentors = Array.isArray(mentors) ? mentors : [];
  const safeSlots = Array.isArray(slots) ? slots : [];
  const deptLower = (targetDept || "").toLowerCase().trim();

  if (!deptLower) return subjectsList;

  // 1. Find all mentors belonging to this department
  const deptMentors = safeMentors.filter(m => m && m.department && (m.department || "").toLowerCase().trim() === deptLower);
  const deptMentorIds = new Set(deptMentors.map(m => m.id));

  // 2. Gather all subjects mapped to these mentors in their profile
  const mappedSubjectNames = new Set<string>();
  deptMentors.forEach(m => {
    if (m && m.subjects) {
      String(m.subjects).split(/\n|\/|,|;/).forEach((s: string) => {
        const cleaned = (s || "").trim().replace(/[,;/]+$/, "").trim().toLowerCase();
        if (cleaned) mappedSubjectNames.add(cleaned);
      });
    }
  });

  // 3. Gather all courses (subjects) actually taught by these mentors in the timetable
  safeSlots.forEach(s => {
    if (s && deptMentorIds.has(s.mentorId) && s.course) {
      const cleaned = String(s.course).trim().replace(/[,;/]+$/, "").trim().toLowerCase();
      mappedSubjectNames.add(cleaned);
    }
  });

  // 4. Gather all class groups (programs) taught by these mentors
  const mappedClassGroups = new Set<string>();
  deptMentors.forEach(m => {
    if (m && m.classes) {
      String(m.classes).split("\n").forEach((c: string) => {
        const cleaned = (c || "").trim().toLowerCase();
        if (cleaned) mappedClassGroups.add(cleaned);
      });
    }
  });
  safeSlots.forEach(s => {
    if (s && deptMentorIds.has(s.mentorId) && s.classGroup) {
      mappedClassGroups.add(String(s.classGroup).toLowerCase());
    }
  });

  // Helper to extract program keywords
  const getProgramKeywords = (prog: string) => {
    const p = (prog || "").toLowerCase();
    if (p.includes("cs") || p.includes("computer science")) return ["cs", "computer"];
    if (p.includes("datascience") || p.includes("data science") || p.includes("ds")) return ["ds", "data"];
    if (p.includes("cloud") || p.includes("cc")) return ["cloud", "cc"];
    if (p.includes("fintech") || p.includes("finance")) return ["fintech", "finance"];
    if (p.includes("banking")) return ["banking"];
    if (p.includes("fashion") || p.includes("tech")) return ["fashion"];
    if (p.includes("aviation") || p.includes("airport") || p.includes("airline")) return ["aviation", "airport", "airline"];
    if (p.includes("commerce") || p.includes("bcom") || p.includes("b.com")) return ["commerce", "bcom", "b.com"];
    return [p];
  };

  const deptKeywords = getProgramKeywords(deptLower);

  // 5. Filter subjectsList
  return subjectsList.filter(s => {
    if (!s) return false;
    const sNameClean = (s.name || "").trim().replace(/[,;/]+$/, "").trim().toLowerCase();
    const sDeptClean = (s.department || "").toLowerCase();

    // Check A: Is this subject name explicitly mapped or taught by a mentor of this department?
    const hasExplicitMatch = Array.from(mappedSubjectNames).some(mappedName => 
      isSubjectNameMatch(s.name || "", mappedName)
    );
    if (hasExplicitMatch) return true;

    // Check B: Does the subject program name match the department keywords?
    const sDeptKeywords = getProgramKeywords(sDeptClean);
    const hasKeywordMatch = deptKeywords.some(dk => sDeptKeywords.includes(dk));
    if (hasKeywordMatch) return true;

    // Check C: Does the subject program name match any of the class groups mapped/taught by this department's mentors?
    for (const cg of mappedClassGroups) {
      if (sDeptClean.includes(cg) || cg.includes(sDeptClean)) return true;
    }

    return false;
  });
}

export function isMentorInProgram(
  mentor: any,
  programName: string,
  slots: any[],
  subjectsList: any[]
): boolean {
  if (!mentor || !programName) return false;
  const pName = (programName || "").toLowerCase().trim();
  const mDept = (mentor.department || "").toLowerCase().trim();

  // A. Exact department match
  if (mDept === pName) return true;

  // B. Check if this mentor teaches any slot in this program's department or classGroup
  const hasSlotInProgram = (slots || []).some(s => 
    s && s.mentorId === mentor.id && 
    ((s.department || "").toLowerCase().trim() === pName ||
     (s.classGroup || "").toLowerCase().includes(pName))
  );
  if (hasSlotInProgram) return true;

  return false;
}

export function getDeptFromClassGroup(classGroup?: string): string {
  if (!classGroup) return "";
  const lower = classGroup.toLowerCase().trim();
  if (lower.includes("b. com(fintech)") || lower.includes("b.com(fintech)") || lower.includes("b. com (fintech)")) {
    return "B. Com(Fintech)";
  }
  if (lower.includes("cs") && (lower.includes("ai") || lower.includes("artificial"))) {
    return "B.Sc. Computer Science with Artificial Intelligence";
  }
  if (lower.includes("ds") || lower.includes("data science")) {
    return "B.Sc. Data Science and Artificial Intelligence";
  }
  if (lower.includes("cc") || lower.includes("cloud")) {
    return "B.Sc. Computer Science with Cloud Computing";
  }
  if (lower.includes("dm") || lower.includes("digital marketing")) {
    return "BBA Digital Marketing and Business Analytics";
  }
  if (lower.includes("com") && lower.includes("banking")) {
    return "B.Com. Banking and FinTech";
  }
  if (lower.includes("com") && (lower.includes("ai") || lower.includes("fintech"))) {
    return "B.Com. FinTech and Artificial Intelligence";
  }
  if (lower.includes("banking") || lower.includes("fintech")) {
    if (lower.includes("banking")) {
      return "B.Com. Banking and FinTech";
    }
    return "B.Com. FinTech and Artificial Intelligence";
  }
  if (lower.includes("airline") || lower.includes("airport") || lower.includes("aa")) {
    return "BBA Airline and Airport Management";
  }
  if (lower.includes("fashion") || lower.includes("fm")) {
    return "BBA Fashion Management";
  }
  return classGroup;
}

export function isSubjectNameMatch(name1: string, name2: string): boolean {
  if (!name1 || !name2) return false;
  
  const norm1 = name1.toLowerCase().trim().replace(/[^a-z0-9]/g, "");
  const norm2 = name2.toLowerCase().trim().replace(/[^a-z0-9]/g, "");
  
  if (norm1 === norm2) return true;
  
  // Helper to extract Roman numeral or number from the end/middle of normalized string
  const getNum = (n: string) => {
    if (n.endsWith("iv") || n.includes("sem4") || n.includes("semiv") || n.endsWith("4") || n.includes("l4") || n.includes("lang4") || n.includes("language4") || n.includes("tamil4")) return 4;
    if (n.endsWith("iii") || n.includes("sem3") || n.includes("semiii") || n.endsWith("3") || n.includes("l3") || n.includes("lang3") || n.includes("language3") || n.includes("tamil3")) return 3;
    if (n.endsWith("ii") || n.includes("sem2") || n.includes("semii") || n.endsWith("2") || n.includes("l2") || n.includes("lang2") || n.includes("language2") || n.includes("tamil2")) return 2;
    if (n.endsWith("i") || n.includes("sem1") || n.includes("semi") || n.endsWith("1") || n.includes("l1") || n.includes("lang1") || n.includes("language1") || n.includes("tamil1")) return 1;
    return null;
  };
  
  const num1 = getNum(norm1);
  const num2 = getNum(norm2);
  
  // If one has a suffix number and the other has a different suffix number, they cannot match
  if (num1 !== null && num2 !== null && num1 !== num2) {
    return false;
  }
  
  // Check if both are languages
  const isLang = (n: string) => 
    n.includes("tamil") || 
    n.includes("language") || 
    n.includes("french") || 
    n.includes("hindi") || 
    n.includes("sanskrit");
    
  if (isLang(norm1) && isLang(norm2)) {
    return true; // Languages with no conflicting semester numbers match
  }

  // Refined checks to prevent false positive substring matches
  const isLab1 = norm1.includes("lab") || norm1.includes("practical") || norm1.includes("pract") || norm1.includes("simulation");
  const isLab2 = norm2.includes("lab") || norm2.includes("practical") || norm2.includes("pract") || norm2.includes("simulation");
  if (isLab1 !== isLab2) return false;
  
  const isModern1 = norm1.includes("modern");
  const isModern2 = norm2.includes("modern");
  if (isModern1 !== isModern2) return false;

  const isAdvanced1 = norm1.includes("advanced");
  const isAdvanced2 = norm2.includes("advanced");
  if (isAdvanced1 !== isAdvanced2) return false;

  const isFoundations1 = norm1.includes("foundations") || norm1.includes("foundation");
  const isFoundations2 = norm2.includes("foundations") || norm2.includes("foundation");
  if (isFoundations1 !== isFoundations2) return false;

  const isPrinciples1 = norm1.includes("principles") || norm1.includes("principle");
  const isPrinciples2 = norm2.includes("principles") || norm2.includes("principle");
  if (isPrinciples1 !== isPrinciples2) return false;
  
  return norm1.includes(norm2) || norm2.includes(norm1);
}

export interface ScheduleItem {
  type: "period" | "break";
  index?: number;
  name: string;
  startTimeStr: string;
  endTimeStr: string;
  startMinutes: number;
  endMinutes: number;
  durationMinutes?: number;
}

export interface ShiftBreak {
  id: string;
  name: string;
  duration: number;
  afterPeriod: number;
}

export interface ShiftParams {
  label: string;
  startTime: string;
  periodDuration: number;
  periodsCount: number;
  mode: "duration" | "fixed";
  endTime?: string;
  breaks: ShiftBreak[];
  customPeriodDurations?: Record<number, number>;
}

export const parseTimeToMinutes = (timeStr: string): number => {
  if (!timeStr) return 0;
  const cleanStr = timeStr.trim().replace(/\./g, ":");
  const match = cleanStr.match(/^(\d+):(\d+)\s*(AM|PM)?$/i);
  if (!match) return 0;
  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const ampm = match[3];
  
  if (ampm) {
    const isPM = ampm.toUpperCase() === "PM";
    if (isPM && hours < 12) hours += 12;
    if (!isPM && hours === 12) hours = 0;
  }
  return hours * 60 + minutes;
};

export const formatMinutesToTime = (totalMinutes: number): string => {
  let hours = Math.floor(totalMinutes / 60) % 24;
  const minutes = totalMinutes % 60;
  const ampm = hours >= 12 ? "PM" : "AM";
  
  let displayHours = hours % 12;
  if (displayHours === 0) displayHours = 12;
  
  const displayMinutes = minutes < 10 ? "0" + minutes : minutes;
  return `${displayHours}.${displayMinutes} ${ampm}`;
};

export const calculateShiftSchedule = (params: ShiftParams): {
  items: ScheduleItem[];
  overallEndTime: string;
  totalPeriods: number;
  error?: string;
} => {
  const { startTime, periodDuration, periodsCount, mode, endTime, breaks, customPeriodDurations } = params;
  let currentMinutes = parseTimeToMinutes(startTime);
  const items: ScheduleItem[] = [];
  
  const sortedBreaks = [...breaks].sort((a, b) => a.afterPeriod - b.afterPeriod);
  
  const hasDuplicateBreakPeriods = sortedBreaks.some((b, i) => i > 0 && b.afterPeriod === sortedBreaks[i-1].afterPeriod);
  if (hasDuplicateBreakPeriods) {
    return { items: [], overallEndTime: "", totalPeriods: 0, error: "Validation Warning: Multiple breaks are configured after the same period." };
  }

  if (mode === "duration") {
    for (let p = 1; p <= periodsCount; p++) {
      const thisPeriodDur = (customPeriodDurations && customPeriodDurations[p]) 
        ? customPeriodDurations[p] 
        : periodDuration;
      const pStart = currentMinutes;
      const pEnd = currentMinutes + thisPeriodDur;
      items.push({
        type: "period",
        index: p,
        name: `Period ${p}`,
        startTimeStr: formatMinutesToTime(pStart),
        endTimeStr: formatMinutesToTime(pEnd),
        startMinutes: pStart,
        endMinutes: pEnd,
        durationMinutes: thisPeriodDur
      });
      currentMinutes = pEnd;
      
      const pBreak = sortedBreaks.find(b => b.afterPeriod === p);
      if (pBreak) {
        const bStart = currentMinutes;
        const bEnd = currentMinutes + pBreak.duration;
        items.push({
          type: "break",
          name: pBreak.name,
          startTimeStr: formatMinutesToTime(bStart),
          endTimeStr: formatMinutesToTime(bEnd),
          startMinutes: bStart,
          endMinutes: bEnd,
          durationMinutes: pBreak.duration
        });
        currentMinutes = bEnd;
      }
    }
    return {
      items,
      overallEndTime: formatMinutesToTime(currentMinutes),
      totalPeriods: periodsCount
    };
  } else {
    const limitMinutes = parseTimeToMinutes(endTime || "");
    if (limitMinutes <= currentMinutes) {
      return { items: [], overallEndTime: "", totalPeriods: 0, error: "Validation Warning: Shift end time must be after start time." };
    }
    
    let periodIndex = 1;
    let iterations = 0;
    const maxIterations = 50;
    
    while (iterations < maxIterations) {
      const thisPeriodDur = (customPeriodDurations && customPeriodDurations[periodIndex]) 
        ? customPeriodDurations[periodIndex] 
        : periodDuration;
      if (currentMinutes + thisPeriodDur > limitMinutes) break;
      
      iterations++;
      const pStart = currentMinutes;
      const pEnd = currentMinutes + thisPeriodDur;
      items.push({
        type: "period",
        index: periodIndex,
        name: `Period ${periodIndex}`,
        startTimeStr: formatMinutesToTime(pStart),
        endTimeStr: formatMinutesToTime(pEnd),
        startMinutes: pStart,
        endMinutes: pEnd,
        durationMinutes: thisPeriodDur
      });
      currentMinutes = pEnd;
      
      const pBreak = sortedBreaks.find(b => b.afterPeriod === periodIndex);
      if (pBreak) {
        const bStart = currentMinutes;
        const bEnd = currentMinutes + pBreak.duration;
        if (bEnd > limitMinutes) {
          items.pop();
          break;
        }
        items.push({
          type: "break",
          name: pBreak.name,
          startTimeStr: formatMinutesToTime(bStart),
          endTimeStr: formatMinutesToTime(bEnd),
          startMinutes: bStart,
          endMinutes: bEnd,
          durationMinutes: pBreak.duration
        });
        currentMinutes = bEnd;
      }
      periodIndex++;
    }
    return {
      items,
      overallEndTime: formatMinutesToTime(currentMinutes),
      totalPeriods: items.filter(i => i.type === "period").length
    };
  }
};

export function resolveClassGroupDetailsFromState(
  classGroup: string,
  subjectsList: any[],
  coursesList: any[]
) {
  if (!classGroup) {
    return { department: "General", semester: "Semester 1", year: "Year 1" };
  }

  const cleanCG = classGroup.trim();
  const cgLower = cleanCG.toLowerCase();
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const cgNorm = normalize(cgLower);

  // 1. Resolve Department
  let resolvedDept = "";
  let bestDeptMatchScore = 0;

  // Unique course/dept names and codes from coursesList
  const allCourseNames = Array.from(new Set(coursesList.map(c => c.name).filter(Boolean)));
  for (const deptName of allCourseNames) {
    const deptNorm = normalize(deptName);
    if (cgNorm.includes(deptNorm)) {
      if (deptNorm.length > bestDeptMatchScore) {
        resolvedDept = deptName;
        bestDeptMatchScore = deptNorm.length;
      }
    }
  }

  if (!resolvedDept) {
    const codes = Array.from(new Set(coursesList.map((c: any) => c.code).filter(Boolean)));
    for (const code of codes) {
      const codeNorm = normalize(code);
      if (cgNorm.includes(codeNorm)) {
        const matched = coursesList.find((c: any) => c.code === code);
        if (matched) {
          resolvedDept = matched.name;
          break;
        }
      }
    }
  }

  if (!resolvedDept) {
    for (const deptName of allCourseNames) {
      const abbreviation = deptName
        .replace(/with|and|for/gi, "")
        .split(/\s+/)
        .map((w: string) => w.replace(/[^a-zA-Z]/g, "")[0])
        .filter(Boolean)
        .join("")
        .toLowerCase();

      if (abbreviation && cgNorm.includes(abbreviation)) {
        resolvedDept = deptName;
        break;
      }
    }
  }

  if (!resolvedDept) {
    resolvedDept = cleanCG.split("-")[0].split("(")[0].trim();
  }

  // 2. Resolve Semester
  let resolvedSemester = "";
  const uniqueSemesters = Array.from(new Set(subjectsList.map((s: any) => s.semester).filter(Boolean)));
  
  const romanMap: Record<string, number> = { i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7, viii: 8 };
  const semMatch = cgLower.match(/sem(?:ester)?[\s\-_]*([ivxldc\d]+)/i);
  if (semMatch) {
    const semVal = semMatch[1].toLowerCase();
    const semNum = parseInt(semVal, 10) || romanMap[semVal];
    if (semNum) {
      const matchedSem = uniqueSemesters.find((s: any) => s.toLowerCase().includes(String(semNum)));
      if (matchedSem) {
        resolvedSemester = matchedSem;
      } else {
        resolvedSemester = `Semester ${semNum}`;
      }
    }
  }

  if (!resolvedSemester) {
    for (const sem of uniqueSemesters) {
      const semNorm = normalize(sem);
      if (cgNorm.includes(semNorm)) {
        resolvedSemester = sem;
        break;
      }
    }
  }

  // If no semester found in classGroup, check for a Year indicator (e.g. "Year II", "Year 2", "2nd Year", "III BCA", "III Year")
  let resolvedYear = "";
  if (!resolvedSemester) {
    const yearMatch =
      cgLower.match(/year[\s\-_]*([ivxldc\d]+)/i) ||
      cgLower.match(/([1234])(?:st|nd|rd|th)?[\s\-_]*year/i) ||
      cgLower.match(/^([ivx]+)[\s\-_]+[a-z0-9]/i) ||
      cgLower.match(/[\s\-_]+([ivx]+)[\s\-_]*(?:year|yr|bca|bsc|bcom|ba|be|btech)/i);

    if (yearMatch) {
      const yrVal = yearMatch[1].toLowerCase();
      const yrNum = parseInt(yrVal, 10) || romanMap[yrVal];
      if (yrNum) {
        resolvedYear = `Year ${yrNum}`;
        const defaultSemNum = yrNum * 2 - 1; // Year 1 -> Sem 1, Year 2 -> Sem 3, Year 3 -> Sem 5, Year 4 -> Sem 7
        const matchedSem = uniqueSemesters.find((s: any) => {
          const sNum = parseInt(String(s).replace(/\D/g, ""), 10);
          return sNum === defaultSemNum;
        });
        if (matchedSem) {
          resolvedSemester = matchedSem;
        } else {
          resolvedSemester = `Semester ${defaultSemNum}`;
        }
      }
    }
  }

  if (!resolvedSemester) {
    resolvedSemester = "Semester 5";
  }

  // 3. Resolve Year
  if (!resolvedYear) {
    const matchedSubject = subjectsList.find((s: any) => s.semester && s.semester.toLowerCase() === resolvedSemester.toLowerCase());
    if (matchedSubject && matchedSubject.year) {
      resolvedYear = matchedSubject.year;
    } else {
      const numMatch = resolvedSemester.match(/\d+/);
      if (numMatch) {
        const semNum = parseInt(numMatch[0], 10);
        const yrNum = Math.ceil(semNum / 2);
        resolvedYear = `Year ${yrNum}`;
      } else {
        resolvedYear = "Year 1";
      }
    }
  }

  return {
    department: resolvedDept,
    semester: resolvedSemester,
    year: resolvedYear
  };
}

export function getWeekDates(offset: number = 0, baseDateStr?: string, workingDaysCount: number = 5): { day: string; dateStr: string; formatted: string }[] {
  const dayOrder = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const dates: { day: string; dateStr: string; formatted: string }[] = [];
  
  const baseDate = baseDateStr ? new Date(baseDateStr + "T00:00:00") : new Date();
  baseDate.setDate(baseDate.getDate() + offset * 7);
  
  const dow = baseDate.getDay();
  const monday = new Date(baseDate);
  // If Sunday (0), go back 6 days. Otherwise, go back (dow - 1) days to get to Monday
  monday.setDate(baseDate.getDate() - (dow === 0 ? 6 : dow - 1));
  
  const count = workingDaysCount === 6 ? 6 : 5;
  for (let i = 0; i < count; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    
    // Format YYYY-MM-DD
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    
    dates.push({
      day: dayOrder[i],
      dateStr: `${yyyy}-${mm}-${dd}`,
      formatted: d.toLocaleDateString("en-IN", { day: "numeric", month: "short" })
    });
  }
  
  return dates;
}

export function isCohortMatching(cg1?: string, cg2?: string, coursesList: any[] = [], subjectsList: any[] = []): boolean {
  if (!cg1 || !cg2) return false;
  const clean1 = cg1.trim().toLowerCase();
  const clean2 = cg2.trim().toLowerCase();
  if (clean1 === clean2) return true;

  const norm1 = clean1.replace(/[^a-z0-9]/g, "");
  const norm2 = clean2.replace(/[^a-z0-9]/g, "");
  if (norm1 === norm2) return true;

  const d1 = resolveClassGroupDetailsFromState(cg1, coursesList, subjectsList);
  const d2 = resolveClassGroupDetailsFromState(cg2, coursesList, subjectsList);

  if (d1.department && d2.department && d1.department.toLowerCase().trim() === d2.department.toLowerCase().trim()) {
    if (d1.semester && d2.semester && d1.semester.toLowerCase().trim() === d2.semester.toLowerCase().trim()) {
      return true;
    }
  }
  return false;
}

/**
 * Dynamically resolves all timetable period time slot ranges for a specific college
 * from its actual database timetable slots and configured shift parameters.
 */
export function getCollegePeriodTimeSlots(
  collegeId?: string,
  colleges: any[] = [],
  slots: any[] = []
): string[] {
  const resultSlots = new Set<string>();

  // 1. Fetch from actual timetable slots recorded for this college
  if (collegeId && slots && slots.length > 0) {
    slots
      .filter(s => s.college_id === collegeId && s.time)
      .forEach(s => {
        const t = (s.time || "").trim();
        if (t) resultSlots.add(t);
      });
  }

  // 2. Parse shift_configs if configured for this college
  if (collegeId && colleges && colleges.length > 0) {
    const college = colleges.find(c => c.id === collegeId);
    if (college?.shift_configs) {
      try {
        const parsed = JSON.parse(college.shift_configs);
        const allParams: any[] = [];
        if (parsed.semesters) {
          Object.values(parsed.semesters).forEach((semObj: any) => {
            Object.values(semObj).forEach((shiftObj: any) => {
              if (shiftObj?.custom_shift_params) allParams.push(shiftObj.custom_shift_params);
            });
          });
        }
        if (parsed.custom_shift_params) {
          Object.values(parsed.custom_shift_params).forEach((param: any) => {
            allParams.push(param);
          });
        }

        allParams.forEach(param => {
          const res = calculateShiftSchedule(param);
          if (res && res.items) {
            res.items
              .filter(item => item.type === "period")
              .forEach(item => {
                resultSlots.add(`${item.startTimeStr} - ${item.endTimeStr}`);
              });
          }
        });
      } catch (_) {}
    }
  }

  // 3. Fallback: gather from any other college slots in workspace
  if (resultSlots.size === 0 && slots && slots.length > 0) {
    slots.forEach(s => {
      const t = (s.time || "").trim();
      if (t) resultSlots.add(t);
    });
  }

  // 4. Default standard fallback if completely unconfigured
  if (resultSlots.size === 0) {
    return [
      "8.20 AM - 9.10 AM",
      "9.10 AM - 10.00 AM",
      "10.20 AM - 11.10 AM",
      "11.10 AM - 12.00 PM",
      "12.00 PM - 12.50 PM",
      "02:00 PM - 03:00 PM",
      "03:00 PM - 04:00 PM"
    ];
  }

  return Array.from(resultSlots);
}
