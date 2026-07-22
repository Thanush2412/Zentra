import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

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
  const deptLower = targetDept.toLowerCase().trim();

  // 1. Find all mentors belonging to this department
  const deptMentors = mentors.filter(m => m.department.toLowerCase().trim() === deptLower);
  const deptMentorIds = new Set(deptMentors.map(m => m.id));

  // 2. Gather all subjects mapped to these mentors in their profile
  const mappedSubjectNames = new Set<string>();
  deptMentors.forEach(m => {
    if (m.subjects) {
      m.subjects.split(/\n|\/|,|;/).forEach((s: string) => {
        const cleaned = s.trim().replace(/[,;/]+$/, "").trim().toLowerCase();
        if (cleaned) mappedSubjectNames.add(cleaned);
      });
    }
  });

  // 3. Gather all courses (subjects) actually taught by these mentors in the timetable
  slots.forEach(s => {
    if (deptMentorIds.has(s.mentorId) && s.course) {
      const cleaned = s.course.trim().replace(/[,;/]+$/, "").trim().toLowerCase();
      mappedSubjectNames.add(cleaned);
    }
  });

  // 4. Gather all class groups (programs) taught by these mentors
  const mappedClassGroups = new Set<string>();
  deptMentors.forEach(m => {
    if (m.classes) {
      m.classes.split("\n").forEach((c: string) => {
        const cleaned = c.trim().toLowerCase();
        if (cleaned) mappedClassGroups.add(cleaned);
      });
    }
  });
  slots.forEach(s => {
    if (deptMentorIds.has(s.mentorId) && s.classGroup) {
      mappedClassGroups.add(s.classGroup.toLowerCase());
    }
  });

  // Helper to extract program keywords
  const getProgramKeywords = (prog: string) => {
    const p = prog.toLowerCase();
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
    const sNameClean = s.name.trim().replace(/[,;/]+$/, "").trim().toLowerCase();
    const sDeptClean = s.department.toLowerCase();

    // Check A: Is this subject name explicitly mapped or taught by a mentor of this department?
    const hasExplicitMatch = Array.from(mappedSubjectNames).some(mappedName => 
      isSubjectNameMatch(s.name, mappedName)
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
  const pName = (programName || "").toLowerCase().trim();
  const mDept = (mentor.department || "").toLowerCase().trim();

  // A. Check if the program name matches the mentor's department keywords
  const getKeywords = (str: string) => {
    const s = str.toLowerCase();
    if (s.includes("cs") || s.includes("computer science")) return ["cs", "computer"];
    if (s.includes("datascience") || s.includes("data science") || s.includes("ds")) return ["ds", "data"];
    if (s.includes("cloud") || s.includes("cc")) return ["cloud", "cc"];
    if (s.includes("fintech") || s.includes("finance")) return ["fintech", "finance"];
    if (s.includes("banking")) return ["banking"];
    if (s.includes("fashion") || s.includes("tech")) return ["fashion"];
    if (s.includes("aviation") || s.includes("airport") || s.includes("airline")) return ["aviation", "airport", "airline"];
    if (s.includes("commerce") || s.includes("bcom") || s.includes("b.com")) return ["commerce", "bcom", "b.com"];
    return [s];
  };

  const pKeywords = getKeywords(pName);
  const mKeywords = getKeywords(mDept);

  const hasKeywordMatch = pKeywords.some(pk => mKeywords.includes(pk));
  if (hasKeywordMatch) return true;

  // B. Check if this mentor teaches any slot in this program's classGroup
  const hasSlotInProgram = slots.some(s => 
    s.mentorId === mentor.id && 
    s.classGroup && 
    (s.classGroup.toLowerCase().includes(pName) || pName.includes(s.classGroup.toLowerCase()))
  );
  if (hasSlotInProgram) return true;

  // C. Check if mentor teaches subjects in this program
  const mentorSlots = slots.filter(s => s.mentorId === mentor.id);
  const hasSubjectInProgram = mentorSlots.some(ms => 
    subjectsList.some(s => 
      s.department.toLowerCase() === pName && 
      isSubjectNameMatch(s.name, ms.course)
    )
  );
  if (hasSubjectInProgram) return true;

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
  const { startTime, periodDuration, periodsCount, mode, endTime, breaks } = params;
  let currentMinutes = parseTimeToMinutes(startTime);
  const items: ScheduleItem[] = [];
  
  const sortedBreaks = [...breaks].sort((a, b) => a.afterPeriod - b.afterPeriod);
  
  const hasDuplicateBreakPeriods = sortedBreaks.some((b, i) => i > 0 && b.afterPeriod === sortedBreaks[i-1].afterPeriod);
  if (hasDuplicateBreakPeriods) {
    return { items: [], overallEndTime: "", totalPeriods: 0, error: "Validation Warning: Multiple breaks are configured after the same period." };
  }

  if (mode === "duration") {
    for (let p = 1; p <= periodsCount; p++) {
      const pStart = currentMinutes;
      const pEnd = currentMinutes + periodDuration;
      items.push({
        type: "period",
        index: p,
        name: `Period ${p}`,
        startTimeStr: formatMinutesToTime(pStart),
        endTimeStr: formatMinutesToTime(pEnd),
        startMinutes: pStart,
        endMinutes: pEnd
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
          endMinutes: bEnd
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
    
    while (currentMinutes + periodDuration <= limitMinutes && iterations < maxIterations) {
      iterations++;
      const pStart = currentMinutes;
      const pEnd = currentMinutes + periodDuration;
      items.push({
        type: "period",
        index: periodIndex,
        name: `Period ${periodIndex}`,
        startTimeStr: formatMinutesToTime(pStart),
        endTimeStr: formatMinutesToTime(pEnd),
        startMinutes: pStart,
        endMinutes: pEnd
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
          endMinutes: bEnd
        });
        currentMinutes = bEnd;
      }
      periodIndex++;
    }
    return {
      items,
      overallEndTime: formatMinutesToTime(currentMinutes),
      totalPeriods: periodIndex - 1
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

  // If no semester found in classGroup, check for a Year indicator (e.g. "Year II", "Year 2", "2nd Year")
  let resolvedYear = "";
  if (!resolvedSemester) {
    const yearMatch = cgLower.match(/year[\s\-_]*([ivxldc\d]+)/i) || cgLower.match(/([1234])(?:st|nd|rd|th)?[\s\-_]*year/i);
    if (yearMatch) {
      const yrVal = yearMatch[1].toLowerCase();
      const yrNum = parseInt(yrVal, 10) || romanMap[yrVal];
      if (yrNum) {
        resolvedYear = `Year ${yrNum}`;
        const defaultSemNum = yrNum * 2 - 1;
        const matchedSem = uniqueSemesters.find((s: any) => s.toLowerCase().includes(String(defaultSemNum)));
        if (matchedSem) {
          resolvedSemester = matchedSem;
        } else {
          resolvedSemester = `Semester ${defaultSemNum}`;
        }
      }
    }
  }

  if (!resolvedSemester) {
    resolvedSemester = "Semester 1";
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
