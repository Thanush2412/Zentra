import { getDb, parseClassGroupDetails } from "./db";
import path from "path";
import fs from "fs";
import * as XLSX from "xlsx";

// Helper to generate slugs for IDs and emails
function getSlug(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]/g, "_").replace(/_+/g, "_").replace(/(^_+|_+$)/g, "");
}

function getEmailSlug(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]/g, ".").replace(/\.+/g, ".").replace(/(^\.+|\.+$)/g, "");
}

function getSubjectType(name: string): string {
  const n = name.toLowerCase();
  if (n.includes("lab") || n.includes("practical") || n.includes("project") || n.includes("viva") || n.includes("internship") || n.includes("training")) {
    return "practical";
  }
  if (
    n.includes("aptitude") || n.includes("soft skills") || n.includes("communication") ||
    n.includes("evs") || n.includes("environmental") || n.includes("value") ||
    n.includes("values") || n.includes("yoga") || n.includes("wellness") ||
    n.includes("nptel") || n.includes("swayam") || n.includes("sports") ||
    n.includes("online certification") || n.includes("add on") || n.includes("extension") ||
    n.includes("heritage of tamil") || n.includes("iks") || n.includes("progression") ||
    n.includes("nmc") || n.includes("sec") || n.includes("skill") || n.includes("nan mudhalvan") ||
    n.includes("website designing") || n.includes("office automation")
  ) {
    return "skill";
  }
  return "theory";
}

function getYearForSemester(sem: string): string {
  if (sem.includes("1") || sem.includes("2")) return "Year 1";
  if (sem.includes("3") || sem.includes("4")) return "Year 2";
  if (sem.includes("5") || sem.includes("6")) return "Year 3";
  return "Year 1";
}

function normalize(str: string): string {
  if (!str) return "";
  return str.toLowerCase()
    .replace(/^(core major|core practical|allied|elective|nme|sec|generic specific elective|core|major|practical)\s*\w*\s*-\s*/gi, '')
    .replace(/\b&\b/g, 'and')
    .replace(/\bmnlp\b/g, 'modern natural language processing')
    .replace(/\bfllm pe\b/g, 'foundations of llms prompt engineering')
    .replace(/\bdep\b/g, 'data ethics and privacy')
    .replace(/\bfsd\b/g, 'full stack web development')
    .replace(/\bfda\b/g, 'fundamentals of data analytics')
    .replace(/\bnme\b/g, 'office automation')
    .replace(/\bai\s*-\s*ml\b/g, 'ai foundations and machine learning')
    .replace(/\badvanced generative ai\b/g, 'advanced generative artificial intelligence')
    .replace(/\bpython ai\b/g, 'python programming artificial intelligence')
    .replace(/\bpython\s*-\s*ds\b/g, 'python programming data science')
    .replace(/\blanguage\s*-\s*i\b/g, 'tamil i')
    .replace(/\blanguage\s*-\s*iii\b/g, 'tamil iii')
    .replace(/\blanguage\s*-\s*ii\b/g, 'tamil ii')
    .replace(/\bgeneral\s+english\s*-?\s*i\b/g, 'english i')
    .replace(/\bgeneral\s+english\s*-?\s*iii\b/g, 'english iii')
    .replace(/\bgeneral\s+english\s*-?\s*ii\b/g, 'english ii')
    .replace(/\beffective communication\b/g, 'soft skills and communication practice')
    .replace(/\bintroduction to\b/g, 'intro to')
    .replace(/\bmgmt\b/g, 'management')
    .replace(/\bmktg\b/g, 'marketing')
    .replace(/\bprog\b/g, 'programming')
    .replace(/\bfund\b/g, 'fundamentals')
    .replace(/\bdcj\b/g, 'digital customer journey')
    .replace(/\s+/g, ' ')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

const SUBJECT_TRANSLATIONS: Record<string, string[]> = {
  'tamil': ['language', 'tamil'],
  'english': ['english'],
  'communication': ['communication', 'soft skills'],
  'aptitude': ['aptitude', 'analytical reasoning'],
  'd statistics': ['descriptive statistics', 'statistics'],
  'dbms': ['database management', 'dbms'],
  'dep': ['data ethics', 'privacy'],
  'python ai': ['python programming'],
  'maths ai': ['mathematical foundations'],
  'ai - ml': ['principles of artificial intelligence', 'machine learning'],
  'ai ml': ['principles of artificial intelligence', 'machine learning'],
  'fda': ['data analytics'],
  'adv computing lab': ['data analytics lab', 'python and data analytics lab'],
  'nme': ['nme', 'office automation'],
  'evs': ['evs', 'environmental'],
  'fllm pe': ['generative artificial intelligence', 'prompt engineering', 'foundations of llms'],
  'dsa': ['data structures'],
  'sec 4 - frta': ['recruitment', 'talent acquisition'],
  'sec 5 - nan mudhalvan': ['nan mudhalvan'],
  'website designing': ['website designing'],
  'visual branding': ['visual branding'],
  'intro air transport': ['air transport', 'aviation'],
  'aviation business fund': ['aviation business', 'airport'],
  'principles of mgmt': ['principles of management'],
  'intro fashion industry': ['fashion industry', 'fashion terminology'],
  'business stats / fashion history': ['fashion history', 'cultural studies'],
  'supply chain mgmt': ['supply chain'],
  'financial accounting': ['financial accounting'],
  'business strategy': ['business strategy', 'competitive advantage'],
  'internal marketing': ['internal marketing', 'nme'],
  'supply chain': ['supply chain'],
  'logistics mgmt': ['logistics management'],
  'business intelligence': ['business statistics'],
  'consumer behaviour & dcj': ['consumer behaviour', 'nme'],
  'global e-commerce / monetization': ['monetization', 'e-commerce'],
  'corporate accounting': ['corporate accounting'],
  'company law': ['company law'],
  'stock market trading': ['securities market', 'trading strategies'],
  'gov & ethics / sec mkt': ['governance and ethics', 'securities market'],
  'power bi': ['data visualization', 'power bi'],
  'computer apps (tally)': ['computer applications', 'tally', 'tally prime'],
  'modern nlp': ['natural language processing', 'nlp'],
  'mnlp lab': ['ai and nlp lab', 'nlp lab'],
  'advanced gen ai': ['explainable artificial intelligence', 'generative artificial intelligence'],
  'fsd': ['full stack web dev', 'full stack web development'],
  'time series analysis': ['time series'],
  'fundamentals of r&ta': ['recruitment', 'talent acquisition'],
  'social media analytics': ['social media analytics'],
  'python - ds': ['python programming for data science'],
  'gse - mathematics - i': ['mathematical foundations for ai'],
  'python prog hands on': ['python programming lab'],
  'analytical reasoning - i': ['analytical reasoning'],
  'principles & practice of banking': ['principles and practice of banking'],
  'business econ / intl banking': ['business economics', 'intl banking'],
  'international marketing': ['internal marketing'],
  'intro digital mktg': ['introduction to digital marketing']
};

function matchSubject(rawCourse: string, subjects: any[]): string | null {
  const normRaw = normalize(rawCourse);

  // 1. Try exact normalized match
  for (const sub of subjects) {
    if (normalize(sub.name) === normRaw) return sub.name;
  }

  // 2. Try translations
  const rawLower = rawCourse.toLowerCase();
  for (const [key, searchVals] of Object.entries(SUBJECT_TRANSLATIONS)) {
    if (rawLower.includes(key)) {
      for (const val of searchVals) {
        for (const sub of subjects) {
          const normSubName = normalize(sub.name);
          const normVal = normalize(val);
          if (normSubName.includes(normVal) || normVal.includes(normSubName)) {
            return sub.name;
          }
        }
      }
    }
  }

  // 3. Substring match
  for (const sub of subjects) {
    const normSubName = normalize(sub.name);
    if (normSubName.includes(normRaw) || normRaw.includes(normSubName)) {
      return sub.name;
    }
  }

  // 4. Word overlap fallback
  let bestMatch = null;
  let maxOverlap = 0;
  const rawWords = normRaw.split(' ').filter(w => w.length > 2);
  for (const sub of subjects) {
    const subWords = normalize(sub.name).split(' ').filter(w => w.length > 2);
    const overlap = rawWords.filter(w => subWords.includes(w)).length;
    if (overlap > maxOverlap) {
      maxOverlap = overlap;
      bestMatch = sub.name;
    }
  }

  if (maxOverlap > 0) return bestMatch;

  return null;
}

function isSubjectMatch(course: string, subjectsStr: string): boolean {
  const normCourse = normalize(course);
  const list = subjectsStr.split(/\n|\/|,/).map(s => s.trim()).filter(Boolean);
  
  const getAbbr = (phrase: string) => {
    const cleanPhrase = phrase.toLowerCase()
      .replace(/^(core major|core practical|allied|elective|nme|sec|generic specific elective|core|major|practical)\s*\w*\s*-\s*/gi, '')
      .replace(/[^a-z0-9\s]/g, '');
    const words = cleanPhrase.split(/\s+/).filter(Boolean);
    if (words.length <= 1) return "";
    return words.map(w => w[0]).join("");
  };
  
  const courseAbbr = getAbbr(course);
  
  for (const s of list) {
    const normSub = normalize(s);
    if (normSub === normCourse || normSub.includes(normCourse) || normCourse.includes(normSub)) {
      return true;
    }
    
    const subAbbr = getAbbr(s);
    const normSubNoPunct = normSub.replace(/[^a-z0-9]/g, '');
    const normCourseNoPunct = normCourse.replace(/[^a-z0-9]/g, '');
    
    if (courseAbbr && courseAbbr === normSubNoPunct) return true;
    if (subAbbr && subAbbr === normCourseNoPunct) return true;
  }
  return false;
}

interface Mentor {
  id: string;
  name: string;
  department: string;
  subjects: string;
  classes: string;
  shift: string;
  college_id?: string;
}

function isClassMatch(classLabel: string, classesStr: string): boolean {
  const cNorm = classLabel.toLowerCase().replace(/[^a-z0-9]/g, "");
  const cList = classesStr.split(/\n|,/).map(s => s.trim().toLowerCase().replace(/[^a-z0-9]/g, "")).filter(Boolean);

  const getCourseGroup = (s: string) => {
    if (s.includes("cs") && (s.includes("ai") || s.includes("artificial"))) return "cs_ai";
    if (s.includes("ds") || s.includes("data")) return "ds_ai";
    if (s.includes("cc") || s.includes("cloud")) return "cs_cc";
    if (s.includes("com")) return "com";
    if (s.includes("ba") || s.includes("airline") || s.includes("airport") || s.includes("fashion") || s.includes("fa") || s.includes("fm") || s.includes("dm")) return "bba";
    return null;
  };

  const getYear = (s: string) => {
    if (s.includes("1st") || s.includes("1nd") || s.includes("sem1") || s.includes("semi") || s.includes("20262029")) return 1;
    if (s.includes("2nd") || s.includes("sem3") || s.includes("semiii") || s.includes("20252028")) return 2;
    if (s.includes("3rd") || s.includes("3d") || s.includes("sem5") || s.includes("semv") || s.includes("20242027")) return 3;
    return null;
  };

  const targetGroup = getCourseGroup(cNorm);
  const targetYear = getYear(cNorm);

  if (!targetGroup) return false;

  for (const c of cList) {
    const mentorGroup = getCourseGroup(c);
    const mentorYear = getYear(c);

    const matchDept = targetGroup === mentorGroup;
    const matchYear = mentorYear === null || targetYear === mentorYear;

    if (matchDept && matchYear) return true;
  }

  return false;
}

function findMentor(course: string, label: string, shift: string, dbMentors: Mentor[]): Mentor | null {
  const shiftLower = shift.toLowerCase();

  // Find candidates based on subject match
  let candidates = dbMentors.filter(m => isSubjectMatch(course, m.subjects));

  // Filter candidates by class match
  let classCandidates = candidates.filter(m => isClassMatch(label, m.classes));
  if (classCandidates.length > 0) candidates = classCandidates;

  // Filter by shift
  let shiftMatches = candidates.filter(m => {
    const mShift = m.shift.toLowerCase();
    if (shiftLower === 'shift_1' && (mShift === 'shift_1' || mShift === 'i' || mShift === '1')) return true;
    if (shiftLower === 'shift_2' && (mShift === 'shift_2' || mShift === 'ii' || mShift === '2')) return true;
    if (shiftLower === 'general' || mShift === 'general') return true;
    return false;
  });
  if (shiftMatches.length > 0) return shiftMatches[0];

  if (candidates.length > 0) return candidates[0];

  // Fallback to department level matching
  let dept = "Computer Science";
  const c = course.toLowerCase();
  if (c.includes("tamil") || c.includes("language")) dept = "Tamil";
  else if (c.includes("english") || c.includes("communication")) dept = "English";
  else if (c.includes("math") || c.includes("stat") || c.includes("aptitude") || c.includes("reasoning")) dept = "Maths / Aptitude";
  else if (c.includes("account") || c.includes("banking") || c.includes("fintech") || c.includes("tally") || c.includes("law") || c.includes("securities")) dept = "Commerce";
  else if (c.includes("fashion") || c.includes("history")) dept = "Management - Fashion";
  else if (c.includes("aviation") || c.includes("airport") || c.includes("air transport")) dept = "Management - Airline and Airport";
  else if (c.includes("marketing") || c.includes("management") || c.includes("business") || c.includes("strategy") || c.includes("recruitment") || c.includes("talent")) dept = "Management";

  const deptMentors = dbMentors.filter(m => {
    const mDept = m.department.toLowerCase().trim();
    const targetDept = dept.toLowerCase().trim();
    return mDept === targetDept || mDept.includes(targetDept.split(' ')[0]);
  });
  
  if (deptMentors.length > 0) {
    const shiftMatches = deptMentors.filter(m => {
      const mShift = m.shift.toLowerCase();
      if (shiftLower === 'shift_1' && (mShift === 'shift_1' || mShift === 'i' || mShift === '1')) return true;
      if (shiftLower === 'shift_2' && (mShift === 'shift_2' || mShift === 'ii' || mShift === '2')) return true;
      return false;
    });
    if (shiftMatches.length > 0) return shiftMatches[0];
    return deptMentors[0];
  }

  // Final fallback: return the first mentor of the department matching the class group
  const clLower = label.toLowerCase();
  let fallbackDept = "computer science";
  if (clLower.includes("com")) fallbackDept = "commerce";
  else if (clLower.includes("dm") || clLower.includes("ba")) fallbackDept = "management";
  else if (clLower.includes("fashion")) fallbackDept = "fashion";
  else if (clLower.includes("airport") || clLower.includes("airline")) fallbackDept = "airline";
  
  const classDeptMentors = dbMentors.filter(m => m.department.toLowerCase().includes(fallbackDept));
  if (classDeptMentors.length > 0) return classDeptMentors[0];

  return null;
}

function translateTime(timeStr: string): string {
  if (!timeStr) return '';
  
  // 1. Normalize separators and periods
  let clean = timeStr.replace(/–/g, '-').replace(/\s*to\s*/gi, '-');
  
  // Replace dots with colons in time (e.g. 9.00 -> 9:00, 10.20 -> 10:20)
  clean = clean.replace(/(\d+)\.(\d+)/g, '$1:$2');
  
  // Remove A.M, P.M, AM, PM (case-insensitive) and spaces
  let key = clean.replace(/a\.?m\.?/gi, '').replace(/p\.?m\.?/gi, '').replace(/\s+/g, '');
  
  const exactMap: Record<string, string> = {
    // Shift 1
    '8:20-9:10': '8.20 AM - 9.10 AM',
    '9:10-10:00': '9.10 AM - 10.00 AM',
    '10:20-11:10': '10.20 AM - 11.10 AM',
    '11:10-12:00': '11.10 AM - 12.00 PM',
    '12:00-12:50': '12.00 PM - 12.50 PM',
    // General shift
    '9:00-10:00': '9.00 AM - 10.00 AM',
    '10:00-11:00': '10.00 AM - 11.00 AM',
    '11:15-12:15': '11.15 AM - 12.15 PM',
    '12:50-1:45': '12.50 PM - 1.45 PM',
    '1:45-2:45': '1.45 PM - 2.45 PM',
    '3:00-4:00': '3.00 PM - 4.00 PM',
    // Shift 2
    '1:00-1:50': '1.00 PM - 1.50 PM',
    '1:50-2:40': '1.50 PM - 2.40 PM',
    '3:00-3:50': '3.00 PM - 3.50 PM',
    '3:50-4:40': '3.50 PM - 4.40 PM',
    '4:40-5:30': '4.40 PM - 5.30 PM'
  };

  if (exactMap[key]) {
    return exactMap[key];
  }

  // Fallback split logic if not in exactMap
  const [start, end] = clean.split('-');
  if (!start || !end) return timeStr;

  function parsePart(part: string): string {
    const timeOnly = part.replace(/[^0-9:]/g, '');
    const [hStr, mStr] = timeOnly.split(':');
    const h = parseInt(hStr, 10);
    const m = mStr || '00';

    let period = 'AM';
    if (h === 12) {
      period = 'PM';
    } else if (h > 12) {
      period = 'PM';
    } else if (h >= 1 && h <= 5) {
      period = 'PM';
    }

    return `${h}.${m} ${period}`;
  }

  try {
    return `${parsePart(start)} - ${parsePart(end)}`;
  } catch (e) {
    return timeStr;
  }
}

function getCanonicalDept(dept: string): string {
  if (!dept) return "";
  const d = dept.trim().toLowerCase().replace(/\s+/g, ' ');
  if (d.includes("data science") || d.includes("datascience")) {
    return "B.Sc. Data Science and Artificial Intelligence";
  }
  if (d.includes("digital marketing") || d.includes("dm&ba") || d.includes("dm & ba") || d.includes("dmba")) {
    return "BBA Digital Marketing and Business Analytics";
  }
  if (d.includes("fintech and") || d.includes("fintech with") || d.includes("fintech &")) {
    return "B.Com. FinTech and Artificial Intelligence";
  }
  if (d.includes("fintech")) {
    return "B. Com(Fintech)";
  }
  if (d.includes("computer science with artificial") || d.includes("cs with ai") || d.includes("cs and ai") || d.includes("cs & ai")) {
    return "B.Sc. Computer Science with Artificial Intelligence";
  }
  if (d.includes("fashion")) {
    return "BBA Fashion Management";
  }
  if (d.includes("airport") || d.includes("airline")) {
    return "BBA Airline and Airport Management";
  }
  if (d.includes("banking")) {
    return "B.Com. Banking and FinTech";
  }
  if (d.includes("cloud") || d.includes("cs with cc") || d.includes("cs with cloud")) {
    return "B.Sc. Computer Science with Cloud Computing";
  }
  return dept;
}

function parseExcelData() {
  const excelPath = path.resolve('TIME TABLE & MENTORS MAPPING _ODD SEM 2026.xlsx');
  const workbook = XLSX.readFile(excelPath);
  
  // 1. Parse Mentors
  const mentors: any[] = [];
  const mentorsSheet = workbook.Sheets['MENTORS MAPPING'];
  if (mentorsSheet) {
    const mentorsRows = XLSX.utils.sheet_to_json(mentorsSheet, { header: 1 }) as any[][];
    for (let idx = 1; idx < mentorsRows.length; idx++) {
      const row = mentorsRows[idx];
      if (row && row[2]) {
        mentors.push({
          name: String(row[2]).trim(),
          dept: row[1] ? getCanonicalDept(String(row[1])) : '',
          subjects: row[3] ? String(row[3]).trim() : '',
          classes: row[4] ? String(row[4]).trim() : '',
          shift: row[5] !== undefined ? String(row[5]).trim() : 'general'
        });
      }
    }
  }
  
  // 2. Parse Curricula (Subjects)
  const curriculaMap: Record<string, any> = {};
  const subjectsSheet = workbook.Sheets['subjects'] || workbook.Sheets['Subjects'];
  if (subjectsSheet) {
    const subjectsRows = XLSX.utils.sheet_to_json(subjectsSheet, { header: 1 }) as any[][];
    for (let idx = 1; idx < subjectsRows.length; idx++) {
      const row = subjectsRows[idx];
      if (!row || row.length < 3) continue;

      const deptName = row[0] ? getCanonicalDept(String(row[0]).trim()) : '';
      const semester = row[1] ? String(row[1]).trim() : '';
      const subName = row[2] ? String(row[2]).trim() : '';
      const weeklyHoursVal = row[3] !== undefined ? String(row[3]).trim() : '4';
      const type = row[4] ? String(row[4]).trim() : 'theory';
      const year = row[5] ? String(row[5]).trim() : 'Year 1';
      
      if (!deptName || !semester || !subName) continue;

      const deptSlug = deptName.toLowerCase().replace(/[^a-z0-9]/g, "_").replace(/_+/g, "_");
      if (!curriculaMap[deptSlug]) {
        curriculaMap[deptSlug] = {
          id: deptSlug,
          label: deptName,
          sems: {}
        };
      }

      if (!curriculaMap[deptSlug].sems[semester]) {
        curriculaMap[deptSlug].sems[semester] = [];
      }

      const semCourses = curriculaMap[deptSlug].sems[semester];
      semCourses.push([
        String(semCourses.length + 1),
        subName,
        `${weeklyHoursVal}cr`,
        type,
        year
      ]);
    }
  }

  // Convert sems map to array of objects
  const curricula = Object.values(curriculaMap).map((c: any) => {
    return {
      id: c.id,
      label: c.label,
      sems: Object.entries(c.sems).map(([semName, courses]) => ({ sem: semName, courses: courses as any[] }))
    };
  });

  // 3. Parse Timetables
  const timetables: any[] = [];
  
  function parseTimetableSheet(sheetName: string) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) return;
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
    
    let idx = 0;
    while (idx < rows.length) {
      const row = rows[idx];
      if (!row || row.length === 0 || !row[0]) {
        idx++;
        continue;
      }
      
      const val = String(row[0]).trim();
      if (val && 
          !val.toLowerCase().includes("time/day") && 
          !val.toLowerCase().includes("hour") && 
          !["monday", "tuesday", "wednesday", "thursday", "friday", "break", "lunch"].includes(val.toLowerCase()) && 
          (val.toLowerCase().includes("sem") || val.toLowerCase().includes("year") || val.toLowerCase().includes("yr"))) {
        
        const classTitle = val;
        const timesRow = rows[idx + 1];
        const hourRow = rows[idx + 2];
        
        const times: string[] = [];
        if (timesRow) {
          for (let cIdx = 1; cIdx < timesRow.length; cIdx++) {
            const timeCell = timesRow[cIdx];
            times.push(timeCell ? String(timeCell).trim() : '');
          }
        }
        
        const days: any[] = [];
        for (let offset = 3; offset <= 7; offset++) {
          const dayRow = rows[idx + offset];
          if (dayRow) {
            const dayName = String(dayRow[0]).trim();
            const dayShort = dayName.slice(0, 3);
            const dayCourses = [dayShort];
            for (let cIdx = 1; cIdx < dayRow.length; cIdx++) {
              dayCourses.push(dayRow[cIdx] ? String(dayRow[cIdx]).trim() : '');
            }
            days.push(dayCourses);
          }
        }
        
        let timetableId = "";
        for (const [key, mapVal] of Object.entries(CLASS_GROUP_MAP)) {
          if (mapVal.toLowerCase() === classTitle.toLowerCase()) {
            timetableId = key;
            break;
          }
        }
        if (!timetableId) {
          timetableId = classTitle.toLowerCase().replace(/[^a-z0-9]/g, "_");
        }

        timetables.push({
          id: timetableId,
          label: classTitle,
          times: times,
          days: days
        });
        
        idx += 8;
      } else {
        idx++;
      }
    }
  }
  
  parseTimetableSheet('SHIFT 1_ODD SEM 2026');
  parseTimetableSheet('SHIFT 2 _ODD SEM 2026');

  return { curricula, mentors, timetables };
}

const DEPT_MAP: Record<string, string> = {
  // Timetable keys / getDeptKeyFromLabel keys
  'bsc_csai': 'B.Sc. Computer Science with Artificial Intelligence',
  'bsc_cscc': 'B.Sc. Computer Science with Cloud Computing',
  'bsc_dsai': 'B.Sc. Data Science and Artificial Intelligence',
  'bcom_finai': 'B.Com. FinTech and Artificial Intelligence',
  'bcom_bft': 'B.Com. Banking and FinTech',
  'bcom_fintech': 'B. Com(Fintech)',
  'bba_dmba': 'BBA Digital Marketing and Business Analytics',
  'bba_fm': 'BBA Fashion Management',
  'bba_aa': 'BBA Airline and Airport Management',

  // Curriculum IDs
  'csai': 'B.Sc. Computer Science with Artificial Intelligence',
  'cscc': 'B.Sc. Computer Science with Cloud Computing',
  'dsai': 'B.Sc. Data Science and Artificial Intelligence',
  'bcomfinai': 'B.Com. FinTech and Artificial Intelligence',
  'bcombank': 'B.Com. Banking and FinTech',
  'bbadmba': 'BBA Digital Marketing and Business Analytics',
  'bbafm': 'BBA Fashion Management',
  'bbaaa': 'BBA Airline and Airport Management',

  // Curriculum / Timetable Labels in HTML
  'B.Sc CS with AI': 'B.Sc. Computer Science with Artificial Intelligence',
  'B.Sc CS with Cloud Computing': 'B.Sc. Computer Science with Cloud Computing',
  'B.Sc DS & AI': 'B.Sc. Data Science and Artificial Intelligence',
  'B.Com FinTech & AI': 'B.Com. FinTech and Artificial Intelligence',
  'B.Com Banking & FinTech': 'B.Com. Banking and FinTech',
  'BBA DM & BA': 'BBA Digital Marketing and Business Analytics',
  'BBA Fashion Management': 'BBA Fashion Management',
  'BBA Airport & Airline Mgmt': 'BBA Airline and Airport Management'
};

const CLASS_GROUP_MAP: Record<string, string> = {
  'bsc_csai_s5': 'B.SC CS with AI - SEM V (2024-2027)',
  'bsc_csai1_s3_s1': 'B.Sc CS with AI (Shift 1)- SEM III(2025-2028)',
  'bsc_csai1_s1_s1': 'B.Sc CS with AI (Shift 1)- SEM I(2026-2029)',
  'bsc_dsai_s1_s1': 'B.Sc DS and AI (Shift 1)- SEM I(2026-2029)',
  'bsc_dsai_s3_s1': 'B.Sc DS and AI (Shift 1)- SEM III(2025-2028)',
  'bcom_finai_s1_s1': 'B.COM and AI (Shift 1)- SEM I(2026-2029)',
  'bcom_finai_s3_s1': 'B.COM and AI (Shift 1)- SEM III(2026-2029)',
  'bba_dmba_s1_s1': 'BBA DM & BA (Shift 1)- SEM I(2025-2028)',
  'bba_dmba_s3_s1': 'BBA DM & BA (Shift 1)- SEM III (2026-2029)',
  'bsc_csai_s3_s2': 'B.Sc CS with AI (Shift 2)- SEM III(2025-2028)',
  'bsc_csai_s1_s2': 'B.Sc CS with AI (Shift 2)- SEM I(2026-2029)',
  'bsc_cscc_s1_s2': 'B.Sc CS With CC (Shift 2)- SEM I(2026-2029)',
  'bcom_bft_s1_s2': 'B.COM Banking and Fintech  (Shift 2)- SEM I(2026-2029)',
  'bba_aa_s1_s2': 'BBA AA  (Shift 2)- SEM I(2026-2029)',
  'bba_fm_s1_s2': 'BBA FM  (Shift 2)- SEM I(2026-2029)'
};

const ROOM_MAP: Record<string, string> = {
  'bsc_csai_s5': 'D1',
  'bsc_csai1_s3_s1': 'C4',
  'bsc_csai_s3_s2': 'C4',
  'bsc_csai1_s1_s1': 'B4',
  'bsc_csai_s1_s2': 'B4',
  'bsc_dsai_s1_s1': 'B3',
  'bsc_dsai_s3_s1': 'C3',
  'bsc_cscc_s1_s2': 'C3',
  'bcom_finai_s1_s1': 'B1',
  'bcom_finai_s3_s1': 'C1',
  'bcom_bft_s1_s2': 'C1',
  'bba_dmba_s1_s1': 'B2',
  'bba_dmba_s3_s1': 'C2',
  'bba_fm_s1_s2': 'C2',
  'bba_aa_s1_s2': 'B1'
};

function getDeptKeyFromLabel(label: string): string {
  const l = label.toLowerCase();
  if (l.includes("b. com(fintech)") || l.includes("b.com(fintech)") || l.includes("b. com (fintech)")) return "bcom_fintech";
  if (l.includes("csai") || (l.includes("cs") && l.includes("ai"))) return "bsc_csai";
  if (l.includes("cscc") || (l.includes("cs") && l.includes("cc")) || l.includes("cloud")) return "bsc_cscc";
  if (l.includes("dsai") || (l.includes("ds") && l.includes("ai")) || l.includes("data science")) return "bsc_dsai";
  if (l.includes("finai") || (l.includes("fintech") && l.includes("ai"))) return "bcom_finai";
  if (l.includes("bft") || l.includes("banking") || l.includes("fintech")) {
    if (l.includes("bft") || l.includes("banking")) return "bcom_bft";
    return "bcom_finai";
  }
  if (l.includes("dmba") || (l.includes("dm") && l.includes("ba")) || l.includes("digital marketing")) return "bba_dmba";
  if (l.includes("fm") || l.includes("fashion")) return "bba_fm";
  if (l.includes("aa") || l.includes("airport") || l.includes("airline")) return "bba_aa";
  return "";
}

function getSemesterFromLabel(label: string): string {
  const l = label.toLowerCase();
  if (l.includes("sem 5") || l.includes("sem v") || l.includes("_s5") || l.includes(" s5")) return "Semester 5";
  if (l.includes("sem 3") || l.includes("sem iii") || l.includes("_s3") || l.includes(" s3")) return "Semester 3";
  if (l.includes("sem 1") || l.includes("sem i") || l.includes("_s1") || l.includes(" s1")) return "Semester 1";
  return "Semester 1";
}

export async function seedDatabase() {
  const db = await getDb();

  let existingColleges: any[] = [];
  try {
    existingColleges = await db.all("SELECT * FROM colleges");
  } catch (_) { }

  const isCustomSeed = existingColleges.length > 0;

  // 1. Drop existing tables to ensure a clean schema migration
  await db.exec("DROP TABLE IF EXISTS student_attendance;");
  await db.exec("DROP TABLE IF EXISTS students;");
  await db.exec("DROP TABLE IF EXISTS audit_logs;");
  await db.exec("DROP TABLE IF EXISTS approved_handovers;");
  await db.exec("DROP TABLE IF EXISTS handover_requests;");
  await db.exec("DROP TABLE IF EXISTS slots;");
  await db.exec("DROP TABLE IF EXISTS mentors;");
  await db.exec("DROP TABLE IF EXISTS hr;");
  await db.exec("DROP TABLE IF EXISTS subjects;");
  await db.exec("DROP TABLE IF EXISTS departments;");
  await db.exec("DROP TABLE IF EXISTS courses;");
  await db.exec("DROP TABLE IF EXISTS users;");
  await db.exec("DROP TABLE IF EXISTS notifications;");
  await db.exec("DROP TABLE IF EXISTS announcements;");
  await db.exec("DROP TABLE IF EXISTS holidays;");
  await db.exec("DROP TABLE IF EXISTS login_history;");
  await db.exec("DROP TABLE IF EXISTS sme_users;");
  await db.exec("DROP TABLE IF EXISTS demo_sessions;");
  await db.exec("DROP TABLE IF EXISTS subject_groups;");
  await db.exec("DROP TABLE IF EXISTS demo_rules;");

  if (!isCustomSeed) {
    await db.exec("DROP TABLE IF EXISTS campus_managers;");
    await db.exec("DROP TABLE IF EXISTS colleges;");
    await db.exec("DROP TABLE IF EXISTS kam_users;");
    await db.exec("DROP TABLE IF EXISTS admin_users;");
  }

  // 2. Recreate the tables
  await db.exec(`
    CREATE TABLE IF NOT EXISTS admin_users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL
    );

    CREATE TABLE IF NOT EXISTS kam_users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL DEFAULT 'Key Account Manager'
    );

    CREATE TABLE IF NOT EXISTS colleges (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      address TEXT,
      kam_id TEXT NOT NULL,
      has_shifts INTEGER NOT NULL DEFAULT 1,
      FOREIGN KEY (kam_id) REFERENCES kam_users(id)
    );

    CREATE TABLE IF NOT EXISTS campus_managers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      college_id TEXT NOT NULL,
      kam_id TEXT NOT NULL,
      FOREIGN KEY (college_id) REFERENCES colleges(id),
      FOREIGN KEY (kam_id) REFERENCES kam_users(id)
    );

    CREATE TABLE IF NOT EXISTS mentors (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      department TEXT NOT NULL,
      avatar TEXT NOT NULL,
      subjects TEXT,
      classes TEXT,
      shift TEXT,
      college_id TEXT,
      employee_id TEXT,
      phone TEXT,
      qualification TEXT,
      experience TEXT,
      specialization TEXT,
      designation TEXT,
      joining_date TEXT,
      status TEXT DEFAULT 'Active',
      password_hash TEXT,
      last_login TEXT,
      created_at TEXT,
      updated_at TEXT,
      subject_group TEXT,
      FOREIGN KEY (college_id) REFERENCES colleges(id)
    );

    CREATE TABLE IF NOT EXISTS slots (
      id TEXT PRIMARY KEY,
      mentorId TEXT NOT NULL,
      day TEXT NOT NULL,
      time TEXT NOT NULL,
      course TEXT NOT NULL,
      location TEXT NOT NULL,
      shift TEXT NOT NULL DEFAULT 'general',
      classGroup TEXT,
      semester TEXT,
      year TEXT,
      department TEXT,
      batch_start_year INTEGER,
      batch_end_year INTEGER,
      college_id TEXT,
      FOREIGN KEY (mentorId) REFERENCES mentors(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS handover_requests (
      id TEXT PRIMARY KEY,
      requestorId TEXT NOT NULL,
      requestorName TEXT NOT NULL,
      slotId TEXT NOT NULL,
      course TEXT NOT NULL,
      day TEXT NOT NULL,
      time TEXT NOT NULL,
      dateStr TEXT NOT NULL,
      dateFormatted TEXT NOT NULL,
      targetStaffId TEXT NOT NULL,
      targetStaffName TEXT NOT NULL,
      reason TEXT NOT NULL,
      status TEXT NOT NULL,
      headerReason TEXT,
      approvedBy TEXT,
      timestamp TEXT NOT NULL,
      classGroup TEXT,
      FOREIGN KEY (requestorId) REFERENCES mentors(id) ON DELETE CASCADE,
      FOREIGN KEY (targetStaffId) REFERENCES mentors(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS approved_handovers (
      id TEXT PRIMARY KEY,
      requestId TEXT UNIQUE NOT NULL,
      slotId TEXT NOT NULL,
      dateStr TEXT NOT NULL,
      originalMentorId TEXT NOT NULL,
      coverStaffId TEXT NOT NULL,
      coverStaffName TEXT NOT NULL,
      course TEXT
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      description TEXT NOT NULL,
      actorName TEXT NOT NULL,
      actorRole TEXT NOT NULL,
      timestamp TEXT NOT NULL
    );

     CREATE TABLE IF NOT EXISTS subjects (
       id TEXT PRIMARY KEY,
       department TEXT NOT NULL,
       semester TEXT NOT NULL,
       name TEXT NOT NULL,
       type TEXT NOT NULL,
       college_id TEXT,
       year TEXT,
       weekly_hours INTEGER DEFAULT 4,
       subject_group TEXT
     );

      CREATE TABLE IF NOT EXISTS subject_groups (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        description TEXT
      );

      CREATE TABLE IF NOT EXISTS demo_rules (
        id TEXT PRIMARY KEY,
        subject TEXT NOT NULL,
        week INTEGER NOT NULL,
        target INTEGER NOT NULL,
        created_at TEXT NOT NULL
      );

    CREATE TABLE IF NOT EXISTS courses (
      id TEXT PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      college_id TEXT,
      code TEXT,
      description TEXT,
      hod_name TEXT,
      established_year TEXT,
      status TEXT DEFAULT 'Active',
      years INTEGER DEFAULT 4,
      start_date TEXT,
      end_date TEXT,
      start_year TEXT,
      end_year TEXT,
      shift_based INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS departments (
      id TEXT PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      college_id TEXT,
      code TEXT,
      description TEXT,
      hod_name TEXT,
      established_year TEXT,
      status TEXT DEFAULT 'Active',
      years INTEGER DEFAULT 4,
      start_year TEXT,
      end_year TEXT,
      shift_based INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS students (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      classGroup TEXT NOT NULL,
      department TEXT,
      college_id TEXT,
      batch_start_year INTEGER,
      batch_end_year INTEGER,
      semester TEXT,
      shift TEXT,
      register_number TEXT,
      roll_number TEXT,
      avatar TEXT,
      phone TEXT,
      gender TEXT,
      dob TEXT,
      address TEXT,
      guardian_name TEXT,
      guardian_phone TEXT,
      admission_date TEXT,
      password_hash TEXT,
      status TEXT DEFAULT 'Active',
      last_login TEXT,
      created_at TEXT,
      updated_at TEXT,
      FOREIGN KEY (college_id) REFERENCES colleges(id)
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL,
      reference_id TEXT,
      status TEXT DEFAULT 'Active',
      last_login TEXT,
      created_at TEXT,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      type TEXT NOT NULL,
      is_read INTEGER DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS announcements (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      created_by TEXT NOT NULL,
      target_role TEXT,
      college_id TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS holidays (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      date TEXT NOT NULL,
      type TEXT NOT NULL,
      college_id TEXT
    );

    CREATE TABLE IF NOT EXISTS login_history (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      login_time TEXT NOT NULL,
      logout_time TEXT,
      ip TEXT,
      device TEXT
    );

    CREATE TABLE IF NOT EXISTS student_attendance (
      id TEXT PRIMARY KEY,
      studentId TEXT NOT NULL,
      slotId TEXT NOT NULL,
      dateStr TEXT NOT NULL,
      status TEXT NOT NULL,
      markedBy TEXT,
      timestamp TEXT NOT NULL,
      FOREIGN KEY (studentId) REFERENCES students(id) ON DELETE CASCADE,
      FOREIGN KEY (slotId) REFERENCES slots(id) ON DELETE CASCADE,
      UNIQUE(studentId, slotId, dateStr)
    );

    CREATE TABLE IF NOT EXISTS sme_users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL DEFAULT 'password123',
      subject TEXT
    );

    CREATE TABLE IF NOT EXISTS demo_sessions (
      id TEXT PRIMARY KEY,
      mentorId TEXT NOT NULL,
      mentorName TEXT NOT NULL,
      smeId TEXT NOT NULL,
      smeName TEXT NOT NULL,
      dateStr TEXT NOT NULL,
      timeSlot TEXT NOT NULL,
      subject TEXT NOT NULL,
      stream TEXT NOT NULL,
      week INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'scheduled',
      marks INTEGER,
      comments TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS demo_swap_requests (
      id TEXT PRIMARY KEY,
      sessionId TEXT NOT NULL,
      mentorId TEXT NOT NULL,
      mentorName TEXT NOT NULL,
      smeId TEXT NOT NULL,
      smeName TEXT NOT NULL,
      dateStr TEXT NOT NULL,
      timeSlot TEXT NOT NULL,
      subject TEXT NOT NULL,
      stream TEXT NOT NULL,
      reason TEXT NOT NULL,
      remarks TEXT,
      swapType TEXT NOT NULL,
      proposedMentorId TEXT,
      proposedMentorName TEXT,
      proposedSmeId TEXT,
      proposedSmeName TEXT,
      proposedDateStr TEXT,
      proposedTimeSlot TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL
    );
  `);

  let targetCollege1 = "college_1";
  let targetCollege2 = "college_2";

  if (isCustomSeed) {
    targetCollege1 = existingColleges[0].id;
    targetCollege2 = existingColleges[1]?.id || existingColleges[0].id;
  }

  // 3. Seed Admin, KAM, Colleges, Campus Managers (Only if not a custom seed)
  if (!isCustomSeed) {
    await db.run(
      `INSERT INTO admin_users (id, name, email) VALUES (?, ?, ?)`,
      "admin_1", "System Admin", "admin@university.edu"
    );

    await db.run(
      `INSERT INTO kam_users (id, name, email, title) VALUES (?, ?, ?, ?)`,
      "kam_1", "Rajesh Kumar", "rajesh.kam@university.edu", "Key Account Manager"
    );

    await db.run(
      `INSERT INTO colleges (id, name, address, kam_id, has_shifts) VALUES (?, ?, ?, ?, ?)`,
      "college_1", "FP City Campus", "123, Anna Salai, Chennai - 600002", "kam_1", 1
    );
    await db.run(
      `INSERT INTO colleges (id, name, address, kam_id, has_shifts) VALUES (?, ?, ?, ?, ?)`,
      "college_2", "FP North Campus", "45, Poonamallee High Road, Chennai - 600056", "kam_1", 0
    );

    await db.run(
      `INSERT INTO campus_managers (id, name, email, college_id, kam_id) VALUES (?, ?, ?, ?, ?)`,
      "cam_1", "Priya Venkatesh", "priya.cam@university.edu", "college_1", "kam_1"
    );
    await db.run(
      `INSERT INTO campus_managers (id, name, email, college_id, kam_id) VALUES (?, ?, ?, ?, ?)`,
      "cam_2", "Arjun Sharma", "arjun.cam@university.edu", "college_2", "kam_1"
    );
    await db.run(
      `INSERT OR IGNORE INTO admin_users (id, name, email) VALUES (?, ?, ?)`,
      "admin_1", "System Admin", "admin@university.edu"
    );
  }

  // Seed default Subject Matter Experts (SMEs)
  await db.run(
    "INSERT OR IGNORE INTO sme_users (id, name, email, subject) VALUES (?, ?, ?, ?)",
    ["sme_1", "Dr. Ramesh Kumar", "ramesh.sme@zentra.edu", "Aptitude"]
  );
  await db.run(
    "INSERT OR IGNORE INTO sme_users (id, name, email, subject) VALUES (?, ?, ?, ?)",
    ["sme_2", "Prof. Sneha Iyer", "sneha.sme@zentra.edu", "Soft Skills"]
  );
  await db.run(
    "INSERT OR IGNORE INTO sme_users (id, name, email, subject) VALUES (?, ?, ?, ?)",
    ["sme_3", "Mr. Tharun Balaji", "tharun.sme@zentra.edu", "Technical"]
  );

  // Seed default Subject Groups
  await db.run("INSERT OR IGNORE INTO subject_groups (id, name, description) VALUES ('g1', 'English', 'English communication and vocabulary training.')");
  await db.run("INSERT OR IGNORE INTO subject_groups (id, name, description) VALUES ('g2', 'Aptitude', 'Quantitative Aptitude, logical reasoning, and puzzle solving.')");
  await db.run("INSERT OR IGNORE INTO subject_groups (id, name, description) VALUES ('g3', 'Soft Skills', 'Presentation skills, resume building, and interview prep.')");
  await db.run("INSERT OR IGNORE INTO subject_groups (id, name, description) VALUES ('g4', 'Technical', 'Programming, data structures, and computer science courses.')");



  // 5. Parse data from Excel
  const { curricula: htmlCurricula, mentors: htmlMentors, timetables: htmlTimetables } = parseExcelData();
  console.log(`Parsed Excel Data: ${htmlCurricula.length} curricula, ${htmlMentors.length} mentors, ${htmlTimetables.length} timetables.`);

  // 6. Seed Mentors
  const seenEmails: Record<string, number> = {};
  const dbMentors: Mentor[] = [];
  for (let i = 0; i < htmlMentors.length; i++) {
    const m = htmlMentors[i];
    const cleanName = m.name.trim();
    const cleanDept = m.dept ? m.dept.trim() : "General";

    let emailName = cleanName.toLowerCase().replace(/\./g, " ").trim();
    emailName = emailName.replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, ".");
    let email = "";
    if (seenEmails[emailName]) {
      seenEmails[emailName]++;
      email = `${emailName}${seenEmails[emailName]}@university.edu`;
    } else {
      seenEmails[emailName] = 1;
      email = `${emailName}@university.edu`;
    }

    let initials = cleanName.split(" ").filter(Boolean).map((part: string) => part[0]).join("").toUpperCase();
    initials = initials.slice(0, 2);
    if (!initials) initials = "M";

    let mShift = "general";
    const shiftStr = String(m.shift).trim().toLowerCase();
    if (shiftStr.includes("1") || shiftStr === "i" || shiftStr === "shift_1") {
      mShift = "shift_1";
    } else if (shiftStr.includes("2") || shiftStr === "ii" || shiftStr === "shift_2") {
      mShift = "shift_2";
    }

    const collegeId = (cleanDept.toLowerCase().includes("management") || cleanDept.toLowerCase().includes("fashion"))
      ? targetCollege2
      : targetCollege1;

    const mentorId = `m${i + 1}`;

    let subjectGroup = null;
    if ((m.subjects || "").toLowerCase().includes("english") || cleanDept.toLowerCase().includes("english")) {
      subjectGroup = "English";
    } else if ((m.subjects || "").toLowerCase().includes("aptitude") || cleanDept.toLowerCase().includes("aptitude")) {
      subjectGroup = "Aptitude";
    } else if ((m.subjects || "").toLowerCase().includes("soft skills") || cleanDept.toLowerCase().includes("soft skills")) {
      subjectGroup = "Soft Skills";
    }

    await db.run(
      `INSERT INTO mentors (id, name, email, department, avatar, subjects, classes, shift, college_id, subject_group) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      mentorId, cleanName, email, cleanDept, initials, m.subjects || "", m.classes || "", mShift, collegeId, subjectGroup
    );

    dbMentors.push({
      id: mentorId,
      name: cleanName,
      department: cleanDept,
      subjects: m.subjects || "",
      classes: m.classes || "",
      shift: mShift
    });
  }

  // 7. Seed Subjects
  let subIdx = 0;
  for (const c of htmlCurricula) {
    const deptName = DEPT_MAP[c.id] || DEPT_MAP[c.label] || c.label;
    for (const semObj of c.sems) {
      const htmlSem = semObj.sem;
      const semMap: Record<string, string> = {
        'Sem I': 'Semester 1',
        'Sem II': 'Semester 2',
        'Sem III': 'Semester 3',
        'Sem IV': 'Semester 4',
        'Sem V': 'Semester 5',
        'Sem VI': 'Semester 6'
      };
      const semesterName = semMap[htmlSem] || htmlSem;

      for (const courseArr of semObj.courses) {
        subIdx++;
        let subName = courseArr[1];

        // Map language variants to canonical Tamil names
        if (subName === "Language - I" || subName === "Tamil / Hindi / Sanskrit / French - I") subName = "Tamil - I";
        else if (subName === "Language - II" || subName === "Tamil / Hindi / Sanskrit / French - II") subName = "Tamil - II";
        else if (subName === "Language - III" || subName === "Tamil / Hindi / Sanskrit / French - III") subName = "Tamil - III";
        else if (subName === "Language - IV" || subName === "Tamil / Hindi / Sanskrit / French - IV") subName = "Tamil - IV";

        const calculatedType = courseArr[3] || getSubjectType(subName);
        const creditStr = courseArr[2] || "4cr";
        const weeklyHours = parseInt(creditStr.replace(/\D/g, ""), 10) || (calculatedType === "skill" ? 2 : 4);
        const yearName = courseArr[4] || getYearForSemester(semesterName);

        const collegeId = (deptName.toLowerCase().includes("management") || deptName.toLowerCase().includes("fashion"))
          ? targetCollege2
          : targetCollege1;

        await db.run(
          `INSERT INTO subjects (id, department, semester, name, type, college_id, year, weekly_hours) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          `sub_${subIdx}`, deptName, semesterName, subName, calculatedType, collegeId, yearName, weeklyHours
        );
      }
    }
  }

  // Manually add BBA Airline and Airport Management Sem 1 subjects since they are missing from HTML const curricula but in HTML subjects tab
  const airlineSubjects = [
    { name: "Tamil - I", hours: 4 },
    { name: "General English - I", hours: 4 },
    { name: "Principles of Management", hours: 4 },
    { name: "Introduction to Air Transport System", hours: 4 },
    { name: "Business Statistics / Aviation Business Fundamentals", hours: 4 },
    { name: "Problem Solving through Aptitude", hours: 2 },
    { name: "Soft Skills and Communication Practice", hours: 2 }
  ];
  for (const sObj of airlineSubjects) {
    subIdx++;
    const calculatedType = getSubjectType(sObj.name);
    await db.run(
      `INSERT INTO subjects (id, department, semester, name, type, college_id, year, weekly_hours) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      `sub_${subIdx}`, "BBA Airline and Airport Management", "Semester 1", sObj.name, calculatedType, targetCollege2, "Year 1", sObj.hours
    );
  }

  // 8. Seed Departments & Courses dynamically
  const uniqueDepts = new Set<string>();
  for (const c of htmlCurricula) {
    const deptName = DEPT_MAP[c.id] || DEPT_MAP[c.label] || c.label;
    uniqueDepts.add(deptName);
  }
  // Ensure "BBA Airline and Airport Management" is seeded since it lacks a curriculum in HTML but exists in timetables
  uniqueDepts.add("BBA Airline and Airport Management");
  for (const dept of uniqueDepts) {
    const deptId = "dept_" + dept.toLowerCase().replace(/[^a-z0-9]/g, "_").replace(/_+/g, "_");
    const collegeId = (dept.toLowerCase().includes("management") || dept.toLowerCase().includes("fashion"))
      ? targetCollege2
      : targetCollege1;

    const words = dept.replace(/with|and|for/gi, "").split(/\s+/).filter(Boolean);
    let deptCode = words.map(w => {
      const cleanWord = w.replace(/[^a-zA-Z]/g, "");
      if (!cleanWord) return "";
      if (cleanWord.toLowerCase() === "bsc") return "BSC";
      if (cleanWord.toLowerCase() === "bba") return "BBA";
      if (cleanWord.toLowerCase() === "bcom") return "BCOM";
      return cleanWord[0].toUpperCase();
    }).filter(Boolean).join("-");
    if (!deptCode) deptCode = dept.substring(0, 3).toUpperCase();

    const hodName = "Dr. " + (collegeId === targetCollege2 ? "Arjun Sharma" : "Priya Venkatesh");
    const description = `Department focusing on ${dept} curriculum.`;

    let years = 3;
    const lowerName = dept.toLowerCase();
    if (lowerName.includes("m.sc") || lowerName.includes("mba")) {
      years = 2;
    }

    await db.run(
      "INSERT OR IGNORE INTO courses (id, name, college_id, code, description, hod_name, established_year, status, years, start_date, end_date, start_year, end_year) VALUES (?, ?, ?, ?, ?, ?, '2024', 'Active', ?, '2026-06-01', ?, '2026', ?)",
      deptId, dept, collegeId, deptCode, description, hodName, years, `${2026 + years}-05-31`, (2026 + years).toString()
    );

    await db.run(
      "INSERT OR IGNORE INTO departments (id, name, college_id, code, description, hod_name, established_year, status, years, start_year, end_year) VALUES (?, ?, ?, ?, ?, ?, '2024', 'Active', ?, '2026', ?)",
      deptId, dept, collegeId, deptCode, description, hodName, years, (2026 + years).toString()
    );
  }

  // 9. Seed Timetable Slots
  let slotIdx = 0;
  for (const tt of htmlTimetables) {
    const label = tt.label;
    const dbClassGroup = CLASS_GROUP_MAP[tt.id] || label;
    const shift = tt.id.includes('_s2') || tt.id.endsWith('_s2') ? 'shift_2' : (tt.id.includes('_s1') || tt.id.endsWith('_s1') ? 'shift_1' : 'general');

    const deptKey = getDeptKeyFromLabel(tt.id || label);
    const deptName = DEPT_MAP[deptKey] || dbClassGroup;
    const semester = getSemesterFromLabel(tt.id || label);
    const year = getYearForSemester(semester);
    const room = ROOM_MAP[tt.id] || 'Room 201';

    // Load subjects for matching
    const deptSubjects = await db.all("SELECT * FROM subjects WHERE department = ?", [deptName]);
    const semSubjects = deptSubjects.filter(s => s.semester === semester);

    for (const dayRow of tt.days) {
      const dayShort = dayRow[0];
      const dayMap: Record<string, string> = {
        'Mon': 'Monday',
        'Tue': 'Tuesday',
        'Wed': 'Wednesday',
        'Thu': 'Thursday',
        'Fri': 'Friday'
      };
      const dayName = dayMap[dayShort] || dayShort;
      const courses = dayRow.slice(1);

      for (let timeIdx = 0; timeIdx < courses.length; timeIdx++) {
        const courseName = courses[timeIdx];
        if (!courseName || courseName.toLowerCase() === 'break' || courseName.trim() === '') continue;

        const timeStr = tt.times[timeIdx];
        if (!timeStr) continue;
        const translatedTime = translateTime(timeStr);

        // Try to match the course name against the curriculum subjects
        let canonicalCourseName = courseName;
        let matchedName = matchSubject(courseName, semSubjects);
        if (matchedName) {
          canonicalCourseName = matchedName;
        }

        const mentor = findMentor(canonicalCourseName, label, shift, dbMentors);
        const mentorId = mentor ? mentor.id : 'm1';
        const collegeId = mentor ? (mentor.college_id || 'college_1') : 'college_1';

        slotIdx++;
        const { startYear, endYear } = parseClassGroupDetails(dbClassGroup);
        await db.run(
          `INSERT INTO slots (id, mentorId, day, time, course, location, shift, classGroup, semester, year, department, batch_start_year, batch_end_year, college_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          `s_${slotIdx}`, mentorId, dayName, translatedTime, canonicalCourseName, room, shift, dbClassGroup, semester, year, deptName, startYear, endYear, collegeId
        );
      }
    }
  }

  // 9.5. Align subject weekly_hours with actual timetable schedules
  const seededSubjects = await db.all("SELECT * FROM subjects");
  const seededSlots = await db.all("SELECT * FROM slots");
  for (const sub of seededSubjects) {
    const subSlots = seededSlots.filter(s => 
      s.course === sub.name && 
      s.department === sub.department && 
      s.semester === sub.semester
    );
    if (subSlots.length > 0) {
      const cohortCounts: Record<string, number> = {};
      subSlots.forEach(s => {
        if (s.classGroup) {
          cohortCounts[s.classGroup] = (cohortCounts[s.classGroup] || 0) + 1;
        }
      });
      const maxHours = Math.max(...Object.values(cohortCounts), 0);
      if (maxHours > 0 && maxHours !== sub.weekly_hours) {
        await db.run("UPDATE subjects SET weekly_hours = ? WHERE id = ?", [maxHours, sub.id]);
      }
    }
  }

  // 10. Audit log entry
  await db.run(
    `INSERT INTO audit_logs (id, type, description, actorName, actorRole, timestamp) VALUES (?, ?, ?, ?, ?, ?)`,
    "l1", "assignment", `Database successfully seeded from Excel files. Seeded ${dbMentors.length} mentors, ${subIdx} subjects, and ${slotIdx} slots.`, "System", "Manager", new Date().toISOString()
  );

  // 11. Seed Students
  await seedStudents(db, targetCollege1, targetCollege2);

  // 12. Seed Centralized Users Auth
  await seedCentralizedUsers(db);

  console.log(`Database successfully seeded from Excel files: ${dbMentors.length} mentors, ${subIdx} subjects, ${slotIdx} slots.`);
}

async function seedStudents(db: any, targetCollege1: string, targetCollege2: string) {
  console.log("Seeding students and attendance from SDNB__Attendance__2025-2026.xlsx...");
  const excelPath = path.resolve(process.cwd(), "SDNB__Attendance__2025-2026.xlsx");
  
  // Cache all slots in memory to avoid querying the DB in nested loops (huge speedup)
  const allSlots = await db.all("SELECT * FROM slots");
  
  // Sheet-to-classGroup mapping
  const sheetToClassMap: Record<string, string> = {
    "II B.Sc. CS with AI": "B.SC CS with AI - SEM V (2024-2027)",
    "I B.Sc. CS with AI (Shift 1)": "B.Sc CS with AI (Shift 1)- SEM III(2025-2028)",
    "I B.Sc. CS with AI (Shift 2)": "B.Sc CS with AI (Shift 2)- SEM III(2025-2028)",
    "I B.Sc. DS & AI": "B.Sc DS and AI (Shift 1)- SEM III(2025-2028)",
    "I B.Com FinTech with AI": "B.COM and AI (Shift 1)- SEM III(2026-2029)",
    "I BBA DM & BA": "BBA DM & BA (Shift 1)- SEM III (2026-2029)"
  };

  const MONTHS_MAP: Record<string, string> = {
    jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
    jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12'
  };

  function parseHeaderDateString(str: string): string | null {
    if (!str) return null;
    const cleaned = str.trim().replace(/\s+/g, ' ');
    
    // Pattern A: DD/MM/YYYY or DD-MM-YYYY (only digits)
    const matchA = cleaned.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})/);
    if (matchA) {
      let [_, d, m, y] = matchA;
      d = d.padStart(2, '0');
      m = m.padStart(2, '0');
      if (y.length === 2) {
        y = '20' + y;
      }
      if (y === '2025' || y === '2026') {
        return `${y}-${m}-${d}`;
      }
    }
    
    // Pattern B: D-MMM-YYYY or DD-MMM-YYYY (with month name)
    const matchB = cleaned.match(/^(\d{1,2})[-/]([A-Za-z]{3,})[-/](\d{2,4})/);
    if (matchB) {
      let [_, d, monthStr, y] = matchB;
      d = d.padStart(2, '0');
      const m = MONTHS_MAP[monthStr.toLowerCase().slice(0, 3)];
      if (!m) return null;
      if (y.length === 2) {
        y = '20' + y;
      }
      if (y === '2025' || y === '2026') {
        return `${y}-${m}-${d}`;
      }
    }
    
    return null;
  }

  function isDateOutOfRange(y: number, m: number, d: number): boolean {
    const dateObj = new Date(y, m - 1, d);
    const start = new Date(2025, 11, 3); // Dec 3, 2025
    const end = new Date(2026, 5, 15);   // June 15, 2026
    return dateObj < start || dateObj > end;
  }

  function parseHeaderDate(cell: any): string | null {
    if (!cell) return null;
    const wVal = cell.w;
    const vVal = cell.v;
    
    if (wVal) {
      const parsed = parseHeaderDateString(wVal);
      if (parsed) return parsed;
    }
    
    if (vVal !== undefined && vVal !== null) {
      if (typeof vVal === 'string') {
        const parsed = parseHeaderDateString(vVal);
        if (parsed) return parsed;
      } else if (typeof vVal === 'number') {
        // Excel serial number
        const utc_days = Math.floor(vVal - 25569);
        const utc_value = utc_days * 86400;
        const dateObj = new Date(utc_value * 1000);
        let y = String(dateObj.getUTCFullYear());
        let m = dateObj.getUTCMonth() + 1;
        let d = dateObj.getUTCDate();
        
        if (y === '2025' || y === '2026') {
          const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
          if (isDateOutOfRange(Number(y), m, d)) {
            const newM = d;
            const newD = m;
            if (newM >= 1 && newM <= 12 && newD >= 1 && newD <= 31) {
              if (!isDateOutOfRange(Number(y), newM, newD)) {
                return `${y}-${String(newM).padStart(2, '0')}-${String(newD).padStart(2, '0')}`;
              }
            }
          }
          return dateStr;
        }
      }
    }
    return null;
  }

  let totalStudents = 0;
  let totalAttendance = 0;

  if (fs.existsSync(excelPath)) {
    try {
      const workbook = XLSX.readFile(excelPath);
      
      // Wrap everything in a single SQLite transaction
      await db.run("BEGIN TRANSACTION;");
      
      for (const sheetName of workbook.SheetNames) {
        const classGroup = sheetToClassMap[sheetName];
        if (!classGroup) {
          console.log(`Skipping sheet "${sheetName}" (no mapping defined).`);
          continue;
        }

        const sheet = workbook.Sheets[sheetName];
        const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        
        let rollIndex = 1;
        let nameIndex = 2;
        let deptIndex = 3;

        // Custom column detection for swapped columns
        if (sheetName === "I B.Sc. CS with AI (Shift 1)" || 
            sheetName === "I B.Sc. DS & AI" || 
            sheetName === "I B.Com FinTech with AI" || 
            sheetName === "I BBA DM & BA") {
          nameIndex = 3;
          deptIndex = 2;
        }

        // Detect date columns
        const dateCols: Array<{ colIdx: number; dateStr: string }> = [];
        const headerRow = rows[0] || [];
        for (let cIdx = 0; cIdx < headerRow.length; cIdx++) {
          const cellRef = XLSX.utils.encode_cell({ r: 0, c: cIdx });
          const cell = sheet[cellRef];
          if (cell) {
            const dateStr = parseHeaderDate(cell);
            if (dateStr) {
              dateCols.push({ colIdx: cIdx, dateStr });
            }
          }
        }

        console.log(`Sheet "${sheetName}": Detected date columns:`, dateCols.map(d => `${d.dateStr} (col ${d.colIdx})`));

        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          if (!row || !row[rollIndex]) continue;
          
          const roll = String(row[rollIndex]).trim();
          if (!roll.match(/^E\d+/i)) continue; // Not a student roll number row

          const name = String(row[nameIndex]).trim();
          const dept = row[deptIndex] ? getCanonicalDept(String(row[deptIndex])) : "";
          const email = `${roll.toLowerCase()}@university.edu`;
          const collegeId = (classGroup.toLowerCase().includes("management") || classGroup.toLowerCase().includes("fashion") || classGroup.toLowerCase().includes("airline") || classGroup.toLowerCase().includes("airport") || classGroup.toLowerCase().includes("bba") || classGroup.toLowerCase().includes("bcom"))
            ? targetCollege2
            : targetCollege1;

          const { startYear, endYear, semester: stSem, shift: stShift } = parseClassGroupDetails(classGroup);
          await db.run(
            "INSERT OR REPLACE INTO students (id, name, email, classGroup, department, college_id, batch_start_year, batch_end_year, semester, shift) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            [roll, name, email, classGroup, dept, collegeId, startYear, endYear, stSem, stShift]
          );
          totalStudents++;

          // Seed student attendance for this student
          for (const dCol of dateCols) {
            const statusVal = row[dCol.colIdx];
            if (statusVal !== undefined && statusVal !== null) {
              const statusStr = String(statusVal).trim().toUpperCase();
              if (statusStr === 'P' || statusStr === 'PRESENT' || statusStr === 'AB' || statusStr === 'A' || statusStr === 'ABSENT') {
                const status = (statusStr === 'P' || statusStr === 'PRESENT') ? 'present' : 'absent';
                
                // Determine day of the week
                const [y, m, d] = dCol.dateStr.split('-').map(Number);
                const dateObj = new Date(y, m - 1, d);
                const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
                const dayName = days[dateObj.getDay()];

                // Filter slots in memory
                const slotsForDay = allSlots.filter((slot: any) => 
                  slot.classGroup && slot.classGroup.toLowerCase() === classGroup.toLowerCase() && 
                  slot.day && slot.day.toLowerCase() === dayName.toLowerCase()
                );

                for (const slot of slotsForDay) {
                  const attId = `${roll}_${slot.id}_${dCol.dateStr}`;
                  await db.run(
                    `INSERT OR REPLACE INTO student_attendance (id, studentId, slotId, dateStr, status, markedBy, timestamp)
                     VALUES (?, ?, ?, ?, ?, ?, ?)`,
                    [attId, roll, slot.id, dCol.dateStr, status, slot.mentorId, new Date().toISOString()]
                  );
                  totalAttendance++;
                }
              }
            }
          }
        }
        console.log(`Seeded students for class group "${classGroup}" from sheet "${sheetName}".`);
      }
      await db.run("COMMIT;");
      console.log(`Successfully seeded ${totalStudents} students and ${totalAttendance} attendance records from Excel.`);
    } catch (err) {
      await db.run("ROLLBACK;");
      console.error("Error reading SDNB__Attendance__2025-2026.xlsx:", err);
    }
  }
}

async function seedCentralizedUsers(db: any) {
  console.log("Seeding centralized users authentication table...");
  // 1. Admins
  const admins = await db.all("SELECT id, name, email FROM admin_users");
  for (const admin of admins) {
    await db.run(
      "INSERT OR IGNORE INTO users (id, email, password_hash, role, reference_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [admin.id, admin.email, 'password123', 'admin', admin.id, new Date().toISOString(), new Date().toISOString()]
    );
  }

  // 2. KAMs
  const kams = await db.all("SELECT id, name, email FROM kam_users");
  for (const kam of kams) {
    await db.run(
      "INSERT OR IGNORE INTO users (id, email, password_hash, role, reference_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [kam.id, kam.email, 'password123', 'kam', kam.id, new Date().toISOString(), new Date().toISOString()]
    );
  }

  // 3. CAMs
  const cams = await db.all("SELECT id, name, email FROM campus_managers");
  for (const cam of cams) {
    await db.run(
      "INSERT OR IGNORE INTO users (id, email, password_hash, role, reference_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [cam.id, cam.email, 'password123', 'cam', cam.id, new Date().toISOString(), new Date().toISOString()]
    );
  }

  // 5. Mentors
  const mentors = await db.all("SELECT id, name, email FROM mentors");
  for (const m of mentors) {
    await db.run(
      "INSERT OR IGNORE INTO users (id, email, password_hash, role, reference_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [m.id, m.email, 'password123', 'mentor', m.id, new Date().toISOString(), new Date().toISOString()]
    );
  }

  // 6. Students
  const students = await db.all("SELECT id, name, email FROM students");
  for (const st of students) {
    await db.run(
      "INSERT OR IGNORE INTO users (id, email, password_hash, role, reference_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [st.id, st.email, 'password123', 'student', st.id, new Date().toISOString(), new Date().toISOString()]
    );
  }

  // 7. SMEs
  const smes = await db.all("SELECT id, name, email FROM sme_users");
  for (const sme of smes) {
    await db.run(
      "INSERT OR IGNORE INTO users (id, email, password_hash, role, reference_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [sme.id, sme.email, 'password123', 'sme', sme.id, new Date().toISOString(), new Date().toISOString()]
    );
  }

  // 8. Demo Allocator
  await db.run(
    "INSERT OR IGNORE INTO users (id, email, password_hash, role, reference_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    ["allocator_1", "allocator@zentra.edu", "password123", "allocator", "allocator_1", new Date().toISOString(), new Date().toISOString()]
  );
}
