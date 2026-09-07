import pg from "pg";

const { Pool } = pg;

export interface DbTransactionContext {
  get: (sql: string, ...params: any[]) => Promise<any>;
  all: (sql: string, ...params: any[]) => Promise<any[]>;
  run: (sql: string, ...params: any[]) => Promise<{ lastID?: number; changes: number }>;
  exec: (sql: string) => Promise<void>;
}

export interface PostgresDbAdapter {
  get: (sql: string, ...params: any[]) => Promise<any>;
  all: (sql: string, ...params: any[]) => Promise<any[]>;
  run: (sql: string, ...params: any[]) => Promise<{ lastID?: number; changes: number }>;
  exec: (sql: string) => Promise<void>;
  multiQuery: (queries: { sql: string; params?: any[] }[]) => Promise<any[][]>;
  transaction: <T>(callback: (tx: DbTransactionContext) => Promise<T>) => Promise<T>;
  client: any;
  pool: pg.Pool;
}

export type DatabaseAdapter = PostgresDbAdapter;
export type TursoDbAdapter = PostgresDbAdapter;

function normalizeParams(params: any[]): any[] {
  let args = params;
  if (params.length === 1 && Array.isArray(params[0])) {
    args = params[0];
  }
  return args.map(arg => (arg === undefined ? null : arg));
}

const TABLE_PK_MAP: Record<string, string> = {
  system_settings: "key",
  academic_years: "year_name",
  faculty_configs: "mentor_id",
  schema_migrations: "version"
};

export function adaptQueryForPostgres(sql: string, params: any[]): { sql: string; params: any[] } {
  let pIdx = 0;
  let convertedSql = sql.replace(/\?/g, () => {
    pIdx++;
    return `$${pIdx}`;
  });

  // Handle SQLite INSERT OR IGNORE with standard PostgreSQL INSERT INTO ... ON CONFLICT DO NOTHING
  if (/INSERT\s+OR\s+IGNORE\s+INTO/i.test(convertedSql)) {
    convertedSql = convertedSql.replace(/INSERT\s+OR\s+IGNORE\s+INTO/gi, "INSERT INTO");
    if (!/ON\s+CONFLICT/i.test(convertedSql)) {
      convertedSql += " ON CONFLICT DO NOTHING";
    }
  }

  // Handle SQLite INSERT OR REPLACE with standard PostgreSQL INSERT INTO ... ON CONFLICT DO UPDATE
  if (/INSERT\s+OR\s+REPLACE\s+INTO/i.test(convertedSql)) {
    convertedSql = convertedSql.replace(/INSERT\s+OR\s+REPLACE\s+INTO/gi, "INSERT INTO");
    if (!/ON\s+CONFLICT/i.test(convertedSql)) {
      const match = convertedSql.match(/INSERT\s+INTO\s+([^\s(]+)\s*\(([^)]+)\)/i);
      if (match) {
        const rawTableName = match[1].replace(/["`]/g, "").trim().toLowerCase();
        const pkCol = TABLE_PK_MAP[rawTableName] || "id";
        const cols = match[2].split(",").map(c => c.trim().replace(/["`]/g, ""));
        const updateSets = cols
          .filter(c => c.toLowerCase() !== pkCol.toLowerCase())
          .map(c => `"${c.toLowerCase()}" = EXCLUDED."${c.toLowerCase()}"`)
          .join(", ");
        if (updateSets) {
          convertedSql += ` ON CONFLICT ("${pkCol}") DO UPDATE SET ${updateSets}`;
        } else {
          convertedSql += ` ON CONFLICT DO NOTHING`;
        }
      }
    }
  }

  // Replace SQLite datetime('now') with PostgreSQL NOW()::text
  convertedSql = convertedSql.replace(/datetime\(['"]now['"]\)/gi, "NOW()::text");

  // Bypass SQLite specific PRAGMA
  if (/PRAGMA\s+foreign_keys/i.test(convertedSql)) {
    convertedSql = "SELECT 1";
  }

  return { sql: convertedSql, params: normalizeParams(params) };
}

async function executeWithRetry<T>(fn: () => Promise<T>, retries = 3, delay = 250): Promise<T> {
  let attempt = 0;
  while (attempt < retries) {
    try {
      return await fn();
    } catch (err: any) {
      attempt++;
      const isNetErr =
        err?.code === "UND_ERR_CONNECT_TIMEOUT" ||
        err?.code === "ECONNRESET" ||
        err?.message?.includes("fetch failed") ||
        err?.message?.includes("Connect Timeout") ||
        err?.message?.includes("read ECONNRESET");

      if (isNetErr && attempt < retries) {
        console.warn(`[PostgreSQL Retry] Transient network timeout/reset (attempt ${attempt}/${retries}). Retrying in ${delay * attempt}ms...`);
        await new Promise(res => setTimeout(res, delay * attempt));
      } else {
        throw err;
      }
    }
  }
  throw new Error("PostgreSQL operation failed after maximum retries");
}

const POSTGRES_CAMEL_MAP = new Map<string, string>([
  ["slotid", "slotId"],
  ["studentid", "studentId"],
  ["datestr", "dateStr"],
  ["markedby", "markedBy"],
  ["classgroup", "classGroup"],
  ["mentorid", "mentorId"],
  ["requestorid", "requestorId"],
  ["requestorname", "requestorName"],
  ["targetstaffid", "targetStaffId"],
  ["targetstaffname", "targetStaffName"],
  ["coverstaffid", "coverStaffId"],
  ["coverstaffname", "coverStaffName"],
  ["originalmentorid", "originalMentorId"],
  ["requestid", "requestId"],
  ["dateformatted", "dateFormatted"],
  ["headerreason", "headerReason"],
  ["approvedby", "approvedBy"],
  ["attendancetypesub", "attendanceTypeSub"],
  ["sessionid", "sessionId"],
  ["mentorname", "mentorName"],
  ["smeid", "smeId"],
  ["smename", "smeName"],
  ["timeslot", "timeSlot"],
  ["swaptype", "swapType"],
  ["proposedmentorid", "proposedMentorId"],
  ["proposedmentorname", "proposedMentorName"],
  ["proposedsmeid", "proposedSmeId"],
  ["proposedsmename", "proposedSmeName"],
  ["proposeddatestr", "proposedDateStr"],
  ["proposedtimeslot", "proposedTimeSlot"],
  ["isread", "isRead"],
  ["userid", "userId"],
  ["taskname", "taskName"],
  ["taskpdfurl", "taskPdfUrl"],
  ["submissionurl", "submissionUrl"],
  ["vivaassessment", "vivaAssessment"],
  ["collegeid", "collegeId"],
  ["collegename", "collegeName"],
  ["camid", "camId"],
  ["camname", "camName"],
  ["studentname", "studentName"]
]);

export function normalizePgRow(row: any): any {
  if (!row || typeof row !== "object" || Array.isArray(row)) return row;
  const out: any = { ...row };
  for (const key of Object.keys(row)) {
    const camel = POSTGRES_CAMEL_MAP.get(key.toLowerCase());
    if (camel && out[camel] === undefined) {
      out[camel] = row[key];
    }
  }
  return out;
}

function createPostgresAdapter(pool: pg.Pool): PostgresDbAdapter {
  return {
    pool,
    client: {
      async batch(statements: { sql: string; args?: any[] }[]) {
        const client = await pool.connect();
        try {
          await client.query("BEGIN");
          for (const stmt of statements) {
            const adapted = adaptQueryForPostgres(stmt.sql, stmt.args || []);
            await client.query(adapted.sql, adapted.params);
          }
          await client.query("COMMIT");
        } catch (err) {
          await client.query("ROLLBACK");
          throw err;
        } finally {
          client.release();
        }
      },
      async execute(stmt: { sql: string; args?: any[] }) {
        const adapted = adaptQueryForPostgres(stmt.sql, stmt.args || []);
        const res = await pool.query(adapted.sql, adapted.params);
        return { rows: res.rows.map(normalizePgRow), rowsAffected: res.rowCount || 0 };
      }
    },
    async get(sql: string, ...params: any[]) {
      const adapted = adaptQueryForPostgres(sql, params);
      const res = await executeWithRetry(() => pool.query(adapted.sql, adapted.params));
      return res.rows[0] ? normalizePgRow(res.rows[0]) : undefined;
    },
    async all(sql: string, ...params: any[]) {
      const adapted = adaptQueryForPostgres(sql, params);
      const res = await executeWithRetry(() => pool.query(adapted.sql, adapted.params));
      return res.rows.map(normalizePgRow);
    },
    async run(sql: string, ...params: any[]) {
      const adapted = adaptQueryForPostgres(sql, params);
      const res = await executeWithRetry(() => pool.query(adapted.sql, adapted.params));
      return {
        lastID: undefined,
        changes: res.rowCount || 0
      };
    },
    async exec(sql: string) {
      await executeWithRetry(() => pool.query(sql));
    },
    async multiQuery(queries: { sql: string; params?: any[] }[]): Promise<any[][]> {
      if (!queries || queries.length === 0) return [];
      const hasParams = queries.some(q => q.params && q.params.length > 0);
      if (!hasParams) {
        const combinedSql = queries.map(q => adaptQueryForPostgres(q.sql, []).sql.trim().replace(/;+$/, '') + ';').join('\n');
        const res = await executeWithRetry(() => pool.query(combinedSql));
        if (Array.isArray(res)) {
          return res.map(r => (r.rows || []).map(normalizePgRow));
        }
        return [(res.rows || []).map(normalizePgRow)];
      }

      return await Promise.all(queries.map(q => {
        const adapted = adaptQueryForPostgres(q.sql, q.params || []);
        return executeWithRetry(() => pool.query(adapted.sql, adapted.params)).then(r => r.rows.map(normalizePgRow)).catch(() => []);
      }));
    },
    async transaction<T>(callback: (tx: DbTransactionContext) => Promise<T>): Promise<T> {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const txContext: DbTransactionContext = {
          async get(sql: string, ...params: any[]) {
            const adapted = adaptQueryForPostgres(sql, params);
            const res = await client.query(adapted.sql, adapted.params);
            return res.rows[0] ? normalizePgRow(res.rows[0]) : undefined;
          },
          async all(sql: string, ...params: any[]) {
            const adapted = adaptQueryForPostgres(sql, params);
            const res = await client.query(adapted.sql, adapted.params);
            return res.rows.map(normalizePgRow);
          },
          async run(sql: string, ...params: any[]) {
            const adapted = adaptQueryForPostgres(sql, params);
            const res = await client.query(adapted.sql, adapted.params);
            return {
              lastID: undefined,
              changes: res.rowCount || 0
            };
          },
          async exec(sql: string) {
            await client.query(sql);
          }
        };
        const result = await callback(txContext);
        await client.query("COMMIT");
        return result;
      } catch (err) {
        try { await client.query("ROLLBACK"); } catch (_) {}
        throw err;
      } finally {
        client.release();
      }
    }
  };
}

let dbInstance: PostgresDbAdapter | null = null;
let dbPromise: Promise<PostgresDbAdapter> | null = null;

export function getDb(): Promise<PostgresDbAdapter> {
  if (dbInstance) return Promise.resolve(dbInstance);
  if (!dbPromise) {
    dbPromise = (async () => {
      const postgresUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;

      if (!postgresUrl) {
        throw new Error(
          "❌ [PostgreSQL Error] DATABASE_URL or POSTGRES_URL environment variable is missing. PostgreSQL is the sole production database engine."
        );
      }

      let finalConnectionString = postgresUrl;
      try {
        const parsed = new URL(postgresUrl);
        const supabaseMatch = parsed.hostname.match(/^db\.([a-z0-9_-]+)\.supabase\.co$/i);
        if (supabaseMatch) {
          const projectRef = supabaseMatch[1];
          if (parsed.username === "postgres") {
            parsed.username = `postgres.${projectRef}`;
          }
          parsed.hostname = "aws-0-ap-southeast-2.pooler.supabase.com";
          parsed.port = parsed.port === "5432" || !parsed.port ? "6543" : parsed.port;
          finalConnectionString = parsed.toString();
          console.log(`🐘 [Database] Auto-routed Supabase host to IPv4 Pooler (${parsed.hostname}:${parsed.port})`);
        }
      } catch (_) {
        // Continue with original postgresUrl
      }

      const isLocalHost = finalConnectionString.includes("localhost") || finalConnectionString.includes("127.0.0.1");
      console.log(`🐘 [Database] Connecting to PostgreSQL (${isLocalHost ? "Localhost" : "Cloud/Pooler"})...`);

      const pool = new Pool({
        connectionString: finalConnectionString,
        ssl: !isLocalHost ? { rejectUnauthorized: false } : undefined,
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
        statement_timeout: 60000
      });

      // Verify connection directly
      try {
        await pool.query("SELECT 1");
      } catch (connErr: any) {
        console.error("❌ [PostgreSQL Error] Connection failed:", connErr.message);
        throw new Error(`Failed to connect to PostgreSQL: ${connErr.message}`);
      }

      // Ensure compatibility functions exist in PostgreSQL
      try {
        await pool.query(`
          CREATE OR REPLACE FUNCTION strftime(format text, date_val text) 
          RETURNS text AS $$
          BEGIN
            IF format = '%w' THEN
              BEGIN
                RETURN EXTRACT(DOW FROM date_val::date)::text;
              EXCEPTION WHEN OTHERS THEN
                RETURN '1';
              END;
            ELSE
              RETURN date_val;
            END IF;
          END;
          $$ LANGUAGE plpgsql IMMUTABLE;

          CREATE OR REPLACE FUNCTION date(base_val text, offset_val text)
          RETURNS text AS $$
          DECLARE
            clean_offset text;
          BEGIN
            IF offset_val LIKE '-%' THEN
              RETURN (CURRENT_DATE - SUBSTRING(offset_val FROM 2)::interval)::date::text;
            ELSIF offset_val LIKE '+%' THEN
              RETURN (CURRENT_DATE + SUBSTRING(offset_val FROM 2)::interval)::date::text;
            ELSE
              RETURN (CURRENT_DATE + offset_val::interval)::date::text;
            END IF;
          EXCEPTION WHEN OTHERS THEN
            RETURN CURRENT_DATE::text;
          END;
          $$ LANGUAGE plpgsql IMMUTABLE;

          CREATE OR REPLACE FUNCTION date(base_val text)
          RETURNS text AS $$
          BEGIN
            IF base_val = 'now' THEN
              RETURN CURRENT_DATE::text;
            ELSE
              RETURN base_val::date::text;
            END IF;
          EXCEPTION WHEN OTHERS THEN
            RETURN CURRENT_DATE::text;
          END;
          $$ LANGUAGE plpgsql IMMUTABLE;
        `);
      } catch (_) { }

      dbInstance = createPostgresAdapter(pool);
      return dbInstance;
    })();
  }
  return dbPromise;
}

export async function resolveClassGroupDetails(db: any, classGroup: string) {
  if (!classGroup) {
    return { department: "General", semester: "Semester 1", year: "Year 1" };
  }

  const courses = await db.all("SELECT name, code FROM courses");
  const depts = await db.all("SELECT name, code FROM departments");
  const allCourseNames = Array.from(new Set([
    ...courses.map((c: any) => c.name),
    ...depts.map((d: any) => d.name)
  ])).filter(Boolean);

  const subjectMetadata = await db.all("SELECT DISTINCT semester, year FROM subjects WHERE semester IS NOT NULL AND semester != ''");

  const cleanCG = classGroup.trim();
  const cgLower = cleanCG.toLowerCase();

  let resolvedDept = "";
  let bestDeptMatchScore = 0;

  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const strippedCG = cleanCG.replace(/^(?:[ivxldc]+|\d+(?:st|nd|rd|th)?)\s+(?:year\s+)?/i, "").trim();
  const cgNorm = normalize(cgLower);
  const strippedNorm = normalize(strippedCG);

  for (const deptName of allCourseNames) {
    const deptNorm = normalize(deptName);
    if (cgNorm.includes(deptNorm) || strippedNorm.includes(deptNorm) || deptNorm.includes(strippedNorm)) {
      if (deptNorm.length > bestDeptMatchScore) {
        resolvedDept = deptName;
        bestDeptMatchScore = deptNorm.length;
      }
    }
  }

  if (!resolvedDept) {
    const codes = Array.from(new Set([
      ...courses.map((c: any) => c.code),
      ...depts.map((d: any) => d.code)
    ])).filter(Boolean);

    for (const code of codes) {
      const codeNorm = normalize(code);
      if (cgNorm.includes(codeNorm) || strippedNorm.includes(codeNorm)) {
        const matchedCourse = courses.find((c: any) => c.code === code) || depts.find((d: any) => d.code === code);
        if (matchedCourse) {
          resolvedDept = matchedCourse.name;
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

      if (abbreviation && (cgNorm.includes(abbreviation) || strippedNorm.includes(abbreviation))) {
        resolvedDept = deptName;
        break;
      }
    }
  }

  if (!resolvedDept) {
    resolvedDept = strippedCG.split("-")[0].split("(")[0].trim() || cleanCG.split("-")[0].split("(")[0].trim();
  }

  let resolvedSemester = "";
  const romanMap: Record<string, number> = { i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7, viii: 8 };

  const semMatch = cgLower.match(/sem(?:ester)?[\s\-_]*([ivxldc\d]+)/i);
  if (semMatch) {
    const semVal = semMatch[1].toLowerCase();
    const semNum = parseInt(semVal, 10) || romanMap[semVal];
    if (semNum) {
      const dbSem = subjectMetadata.find((s: any) => s.semester && s.semester.toLowerCase().includes(String(semNum)));
      if (dbSem) {
        resolvedSemester = dbSem.semester;
      } else {
        resolvedSemester = `Semester ${semNum}`;
      }
    }
  }

  if (!resolvedSemester) {
    for (const sMeta of subjectMetadata) {
      if (sMeta.semester) {
        const sNorm = normalize(sMeta.semester);
        if (cgNorm.includes(sNorm)) {
          resolvedSemester = sMeta.semester;
          break;
        }
      }
    }
  }

  let resolvedYear = "";
  if (!resolvedSemester) {
    const yearMatch = cgLower.match(/year[\s\-_]*([ivxldc\d]+)/i) || cgLower.match(/([1234])(?:st|nd|rd|th)?[\s\-_]*year/i);
    if (yearMatch) {
      const yrVal = yearMatch[1].toLowerCase();
      const yrNum = parseInt(yrVal, 10) || romanMap[yrVal];
      if (yrNum) {
        resolvedYear = `Year ${yrNum}`;
        const defaultSemNum = yrNum * 2 - 1;
        const dbSem = subjectMetadata.find((s: any) => s.semester && s.semester.toLowerCase().includes(String(defaultSemNum)));
        if (dbSem) {
          resolvedSemester = dbSem.semester;
        } else {
          resolvedSemester = `Semester ${defaultSemNum}`;
        }
      }
    }
  }

  if (!resolvedSemester) {
    resolvedSemester = "Semester 1";
  }

  if (!resolvedYear) {
    const dbMatch = subjectMetadata.find((s: any) => s.semester && s.semester.toLowerCase() === resolvedSemester.toLowerCase());
    if (dbMatch && dbMatch.year) {
      resolvedYear = dbMatch.year;
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

export function parseClassGroupDetails(classGroup: string) {
  const yearMatch = classGroup.match(/\((\d{4})-(\d{4})\)/) || classGroup.match(/(\d{4})-(\d{4})/);
  const startYear = yearMatch ? parseInt(yearMatch[1], 10) : null;
  const endYear = yearMatch ? parseInt(yearMatch[2], 10) : null;

  const semMatch = classGroup.match(/SEM\s+([IVX0-9]+)/i) || classGroup.match(/Semester\s+(\d+)/i);
  let semester = semMatch ? semMatch[0].trim() : null;
  if (semester) {
    const semMap: Record<string, string> = {
      'SEM I': 'Semester 1',
      'SEM II': 'Semester 2',
      'SEM III': 'Semester 3',
      'SEM IV': 'Semester 4',
      'SEM V': 'Semester 5',
      'SEM VI': 'Semester 6',
      'SEMESTER 1': 'Semester 1',
      'SEMESTER 2': 'Semester 2',
      'SEMESTER 3': 'Semester 3',
      'SEMESTER 4': 'Semester 4',
      'SEMESTER 5': 'Semester 5',
      'SEMESTER 6': 'Semester 6'
    };
    semester = semMap[semester.toUpperCase()] || semester;
  }

  const shiftMatch = classGroup.match(/Shift\s+(\d+)/i);
  const shift = shiftMatch ? `Shift ${shiftMatch[1]}` : "General";

  const course = classGroup.split('-')[0].split('(')[0].trim();

  return { course, shift, semester, startYear, endYear };
}

export async function syncMentorSubjectGroups(db: any) {
  const groupRows = await db.all("SELECT * FROM subject_groups");
  if (!groupRows || groupRows.length === 0) return;
  const groupNames = groupRows.map((g: any) => g.name);

  const allSubjects = await db.all("SELECT id, name, subject_group, mentor_group FROM subjects");

  for (const sub of allSubjects) {
    let matchedGroup: string | null = sub.subject_group || sub.mentor_group || null;

    if (!matchedGroup || matchedGroup.toLowerCase() === "general") {
      const subNameLower = (sub.name || "").toLowerCase();

      for (const gName of groupNames) {
        if (subNameLower.includes(gName.toLowerCase())) {
          matchedGroup = gName;
          break;
        }
      }

      if (matchedGroup) {
        await db.run(
          "UPDATE subjects SET subject_group = ?, mentor_group = ? WHERE id = ?",
          [matchedGroup, matchedGroup, sub.id]
        );
      }
    }
  }

  const mentors = await db.all("SELECT id, subjects, department, mentor_group, subject_group FROM mentors");
  const updatedSubjects = await db.all("SELECT name, COALESCE(subject_group, mentor_group) as group_name FROM subjects WHERE subject_group IS NOT NULL AND subject_group != '' AND subject_group != 'General'");

  for (const mentor of mentors) {
    const mentorSubjects = (mentor.subjects || "")
      .split(/[\n,\r]/)
      .map((s: string) => s.trim().toLowerCase())
      .filter((s: string) => s.length > 0);

    let matchedGroup: string | null = null;
    for (const sub of updatedSubjects) {
      if (
        mentorSubjects.some(
          (ms: string) =>
            ms === sub.name.toLowerCase() ||
            sub.name.toLowerCase().includes(ms) ||
            ms.includes(sub.name.toLowerCase())
        )
      ) {
        matchedGroup = sub.group_name;
        break;
      }
    }

    if (matchedGroup) {
      await db.run(
        "UPDATE mentors SET mentor_group = ?, subject_group = ? WHERE id = ? AND (mentor_group IS NULL OR mentor_group = '' OR mentor_group = 'General')",
        [matchedGroup, matchedGroup, mentor.id]
      );
    }
  }
}

export async function consolidateSubjectGroups(db: any) {
  await db.run("UPDATE mentors SET mentor_group = 'English / Communication', subject_group = 'English / Communication' WHERE mentor_group = 'English' OR subject_group = 'English'");
  await db.run("UPDATE subjects SET mentor_group = 'English / Communication', subject_group = 'English / Communication' WHERE mentor_group = 'English' OR subject_group = 'English'");
  await db.run("DELETE FROM subject_groups WHERE id = 'g1'");

  await db.run("UPDATE mentors SET mentor_group = 'Maths / Aptitude', subject_group = 'Maths / Aptitude' WHERE mentor_group IN ('Aptitude', 'Mathematics') OR subject_group IN ('Aptitude', 'Mathematics')");
  await db.run("UPDATE subjects SET mentor_group = 'Maths / Aptitude', subject_group = 'Maths / Aptitude' WHERE mentor_group IN ('Aptitude', 'Mathematics') OR subject_group IN ('Aptitude', 'Mathematics')");
  await db.run("DELETE FROM subject_groups WHERE id IN ('g2', 'sg_math')");

  await db.run("UPDATE mentors SET mentor_group = 'Computer Science', subject_group = 'Computer Science' WHERE mentor_group IN ('Technical', 'Computer Applications') OR subject_group IN ('Technical', 'Computer Applications')");
  await db.run("UPDATE subjects SET mentor_group = 'Computer Science', subject_group = 'Computer Science' WHERE mentor_group IN ('Technical', 'Computer Applications') OR subject_group IN ('Technical', 'Computer Applications')");
  await db.run("DELETE FROM subject_groups WHERE id = 'g4'");

  await db.run("DELETE FROM subject_groups WHERE id = 'g5' AND NOT EXISTS (SELECT 1 FROM mentors WHERE mentor_group = 'General' OR subject_group = 'General')");

  await syncMentorSubjectGroups(db);
}

export async function syncMentorSubjectsAndClasses(db: PostgresDbAdapter, mentorId: string, course?: string, classGroup?: string) {
  if (!mentorId) return;
  const mentorRecord = await db.get("SELECT subjects, classes FROM mentors WHERE id = ?", mentorId);
  if (!mentorRecord) return;

  const existingSubjs = mentorRecord.subjects
    ? mentorRecord.subjects.split(/,|\n/).map((s: string) => s.trim()).filter(Boolean)
    : [];
  const existingClasses = mentorRecord.classes
    ? mentorRecord.classes.split(/,|\n/).map((c: string) => c.trim()).filter(Boolean)
    : [];

  let updated = false;
  if (course && course.trim() && !existingSubjs.includes(course.trim())) {
    existingSubjs.push(course.trim());
    updated = true;
  }
  if (classGroup && classGroup.trim() && !existingClasses.includes(classGroup.trim())) {
    existingClasses.push(classGroup.trim());
    updated = true;
  }

  if (updated) {
    await db.run(
      "UPDATE mentors SET subjects = ?, classes = ? WHERE id = ?",
      existingSubjs.join(", "),
      existingClasses.join(", "),
      mentorId
    );
  }
}
