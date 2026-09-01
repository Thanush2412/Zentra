import { createClient, type Client } from "@libsql/client";
import pg from "pg";

const { Pool } = pg;

export interface TursoDbAdapter {
  get: (sql: string, ...params: any[]) => Promise<any>;
  all: (sql: string, ...params: any[]) => Promise<any[]>;
  run: (sql: string, ...params: any[]) => Promise<{ lastID?: number; changes: number }>;
  exec: (sql: string) => Promise<void>;
  client: any;
}

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

function adaptQueryForPostgres(sql: string, params: any[]): { sql: string; params: any[] } {
  let pIdx = 0;
  let convertedSql = sql.replace(/\?/g, () => {
    pIdx++;
    return `$${pIdx}`;
  });

  // Handle INSERT OR IGNORE INTO with standard INSERT INTO ON CONFLICT DO NOTHING
  if (/INSERT\s+OR\s+IGNORE\s+INTO/i.test(convertedSql)) {
    convertedSql = convertedSql.replace(/INSERT\s+OR\s+IGNORE\s+INTO/gi, "INSERT INTO");
    if (!/ON\s+CONFLICT/i.test(convertedSql)) {
      convertedSql += " ON CONFLICT DO NOTHING";
    }
  }

  // Replace INSERT OR REPLACE INTO with standard INSERT INTO ON CONFLICT
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
        console.warn(`[DB Retry] Network timeout/reset on DB call (attempt ${attempt}/${retries}). Retrying in ${delay * attempt}ms...`);
        await new Promise(res => setTimeout(res, delay * attempt));
      } else {
        throw err;
      }
    }
  }
  throw new Error("DB operation failed after maximum retries");
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

function normalizePgRow(row: any): any {
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

function createPostgresAdapter(pool: pg.Pool): TursoDbAdapter {
  return {
    client: {
      async batch(statements: { sql: string; args?: any[] }[], mode?: string) {
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
    }
  };
}

function createDbAdapter(client: Client): TursoDbAdapter {
  return {
    client,
    async get(sql: string, ...params: any[]) {
      const args = normalizeParams(params);
      const res = await executeWithRetry(() => client.execute({ sql, args }));
      return res.rows[0] ? { ...res.rows[0] } : undefined;
    },
    async all(sql: string, ...params: any[]) {
      const args = normalizeParams(params);
      const res = await executeWithRetry(() => client.execute({ sql, args }));
      return res.rows.map(row => ({ ...row }));
    },
    async run(sql: string, ...params: any[]) {
      const args = normalizeParams(params);
      const res = await executeWithRetry(() => client.execute({ sql, args }));
      return {
        lastID: res.lastInsertRowid !== undefined ? Number(res.lastInsertRowid) : undefined,
        changes: res.rowsAffected
      };
    },
    async exec(sql: string) {
      await executeWithRetry(() => client.executeMultiple(sql));
    }
  };
}

let dbInstance: TursoDbAdapter | null = null;
let dbPromise: Promise<TursoDbAdapter> | null = null;

export function getDb(): Promise<TursoDbAdapter> {
  if (dbInstance) return Promise.resolve(dbInstance);
  if (!dbPromise) {
    dbPromise = (async () => {
      const postgresUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;
      const isPostgres =
        Boolean(postgresUrl) &&
        (postgresUrl!.startsWith("postgres://") || postgresUrl!.startsWith("postgresql://")) &&
        process.env.USE_LOCAL_DB !== "true" &&
        process.env.USE_LOCAL_DB !== "1";

      if (isPostgres && postgresUrl) {
        let finalConnectionString = postgresUrl;
        try {
          const parsed = new URL(postgresUrl);
          const supabaseMatch = parsed.hostname.match(/^db\.([a-z0-9_-]+)\.supabase\.co$/i);
          if (supabaseMatch) {
            const projectRef = supabaseMatch[1];
            // If user is just 'postgres', pooler requires 'postgres.<projectRef>'
            if (parsed.username === "postgres") {
              parsed.username = `postgres.${projectRef}`;
            }
            // Switch to Supabase's official IPv4-enabled AWS pooler
            parsed.hostname = "aws-0-ap-south-1.pooler.supabase.com";
            // Default to transaction/session pooler port if direct 5432 was given
            parsed.port = parsed.port === "5432" || !parsed.port ? "6543" : parsed.port;
            finalConnectionString = parsed.toString();
            console.log(`🐘 [Database] Auto-routed direct Supabase IPv6 host (${supabaseMatch[0]}) to IPv4 Pooler (${parsed.hostname}:${parsed.port})`);
          }
        } catch (urlErr) {
          // If URL parsing fails, continue with original postgresUrl
        }

        const isLocalHost = finalConnectionString.includes("localhost") || finalConnectionString.includes("127.0.0.1");
        console.log(`🐘 [Database] Connecting to PostgreSQL (${isLocalHost ? "Localhost" : "Cloud/Supabase/Neon"})...`);
        const pool = new Pool({
          connectionString: finalConnectionString,
          ssl: !isLocalHost ? { rejectUnauthorized: false } : undefined,
          max: 20,
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 10000,
          statement_timeout: 60000
        });

        try {
          // Verify live connectivity before assigning adapter
          await pool.query("SELECT 1");

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
          } catch (_) {}

          // Ensure core tables exist in PostgreSQL if connected to a fresh database
          try {
            const tableCheck = await pool.query(
              "SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users'"
            );
            if (tableCheck.rowCount === 0) {
              console.log("🐘 [Database] PostgreSQL tables not found. Initializing schema...");
              const fs = await import("fs");
              const path = await import("path");
              const schemaPath = path.resolve(process.cwd(), "postgres_schema.sql");
              if (fs.existsSync(schemaPath)) {
                const schemaSql = fs.readFileSync(schemaPath, "utf8");
                await pool.query(schemaSql);
                console.log("🐘 [Database] PostgreSQL schema initialized successfully.");
              }
            }
          } catch (schemaErr: any) {
            console.warn("🐘 [Database] Schema check/bootstrap warning:", schemaErr?.message);
          }

          dbInstance = createPostgresAdapter(pool);
          return dbInstance;
        } catch (pgConnErr: any) {
          console.warn(`\n⚠️  [Database Warning] PostgreSQL connection failed (${pgConnErr?.message || pgConnErr}).`);
          console.warn(`💡 Note: If using Supabase free tier, your project (scuvqabxqqtvibjutoyj) may be paused. Visit https://supabase.com/dashboard to unpause it.`);
          console.warn(`🔄 Falling back to local SQLite database (database.sqlite) to keep the application running smoothly.\n`);
          try { await pool.end(); } catch (_) {}
        }
      }

      const useLocal = process.env.USE_LOCAL_DB === "true" || process.env.USE_LOCAL_DB === "1";
      const url = useLocal ? "file:database.sqlite" : (process.env.TURSO_DATABASE_URL || "file:database.sqlite");
      const authToken = useLocal ? undefined : process.env.TURSO_AUTH_TOKEN;

      let client: Client;
      try {
        if (useLocal) {
          console.log("⚡ [Database] Using local SQLite database (database.sqlite).");
        }
        client = createClient({
          url,
          authToken,
        });
      } catch (err) {
        console.warn("[DB Warning] Failed to initialize Turso Cloud client. Falling back to local SQLite database.");
        client = createClient({ url: "file:database.sqlite" });
      }

      dbInstance = createDbAdapter(client);

      // Enable foreign keys for references
      try {
        await dbInstance.exec("PRAGMA foreign_keys = ON;");
      } catch (err: any) {
        console.warn("[DB Warning] Remote database connection failed during init. Initializing local SQLite fallback.", err?.message);
        client = createClient({ url: "file:database.sqlite" });
        dbInstance = createDbAdapter(client);
        try { await dbInstance.exec("PRAGMA foreign_keys = ON;"); } catch (_) { }
      }

      // Check for legacy schema and drop to trigger rebuild of corrected schemas
      try {
        const hasLegacyTask = await dbInstance.get("SELECT 1 FROM sqlite_master WHERE type='table' AND name='kam_tasks' AND sql LIKE '%mentor_id%'");
        if (hasLegacyTask) {
          await dbInstance.exec("DROP TABLE IF EXISTS kam_tasks;");
        }
      } catch (_) { }

      try {
        const hasLegacyIssue = await dbInstance.get("SELECT 1 FROM sqlite_master WHERE type='table' AND name='campus_issues' AND sql LIKE '%reported_by%'");
        if (hasLegacyIssue) {
          await dbInstance.exec("DROP TABLE IF EXISTS campus_issues;");
        }
      } catch (_) { }

      // Create tables using raw SQL
      await dbInstance.exec(`
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
      original_subject TEXT,
      original_month TEXT,
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
      course TEXT,
      ledger_month TEXT
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
      weekly_hours INTEGER DEFAULT 4
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
      default_room TEXT,
      default_shift TEXT,
      shift_based INTEGER DEFAULT 0,
      sections TEXT
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

    CREATE TABLE IF NOT EXISTS campus_drafts (
      id TEXT PRIMARY KEY DEFAULT 'active_draft',
      data TEXT NOT NULL,
      saved_at TEXT NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS class_mentor_assignments (
      id TEXT PRIMARY KEY,
      college_id TEXT NOT NULL,
      year TEXT NOT NULL,
      department TEXT NOT NULL,
      classGroup TEXT NOT NULL,
      mentor_id TEXT NOT NULL,
      mentor_name TEXT,
      created_at TEXT,
      updated_at TEXT,
      FOREIGN KEY (college_id) REFERENCES colleges(id),
      FOREIGN KEY (mentor_id) REFERENCES mentors(id)
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
      plain_password TEXT DEFAULT 'password123',
      role TEXT NOT NULL,
      reference_id TEXT,
      status TEXT DEFAULT 'Active',
      must_change_password INTEGER DEFAULT 0,
      last_login TEXT,
      created_at TEXT,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      is_read INTEGER DEFAULT 0,
      link TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS approvals (
      id TEXT PRIMARY KEY,
      module_type TEXT NOT NULL,
      request_id TEXT NOT NULL,
      requester_id TEXT NOT NULL,
      requester_name TEXT NOT NULL,
      approver_id TEXT,
      approver_name TEXT,
      current_status TEXT NOT NULL DEFAULT 'pending',
      remarks TEXT,
      rejection_reason TEXT,
      college_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      approved_at TEXT
    );

    CREATE TABLE IF NOT EXISTS leave_balances (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL UNIQUE,
      role TEXT NOT NULL,
      casual_leave INTEGER DEFAULT 12,
      sick_leave INTEGER DEFAULT 12,
      earned_leave INTEGER DEFAULT 10,
      od_allowance INTEGER DEFAULT 15,
      academic_year TEXT DEFAULT '2025-2026',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
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

    CREATE TABLE IF NOT EXISTS leave_requests (
      id TEXT PRIMARY KEY,
      studentId TEXT NOT NULL,
      studentName TEXT NOT NULL,
      classGroup TEXT NOT NULL,
      type TEXT NOT NULL,
      dateStr TEXT NOT NULL,
      reason TEXT NOT NULL,
      status TEXT NOT NULL,
      approvedBy TEXT,
      timestamp TEXT NOT NULL,
      FOREIGN KEY (studentId) REFERENCES students(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS weekly_tasks (
      id TEXT PRIMARY KEY,
      class_group TEXT NOT NULL,
      subject TEXT NOT NULL,
      week_number INTEGER NOT NULL,
      mentor_id TEXT NOT NULL,
      task_name TEXT NOT NULL,
      task_pdf_url TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(class_group, subject, week_number)
    );

    CREATE TABLE IF NOT EXISTS student_tracker (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL,
      class_group TEXT NOT NULL,
      subject TEXT NOT NULL,
      week_number INTEGER NOT NULL,
      submission_url TEXT,
      viva_assessment TEXT,
      marks REAL,
      graded_by TEXT,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(student_id, class_group, subject, week_number),
      FOREIGN KEY(student_id) REFERENCES students(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS academic_tracker (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      period_slot TEXT NOT NULL,
      class_group TEXT NOT NULL,
      subject TEXT NOT NULL,
      unit TEXT NOT NULL,
      topic TEXT NOT NULL,
      comments TEXT,
      status TEXT DEFAULT 'Conducted',
      mentor_id TEXT NOT NULL,
      mentor_name TEXT,
      college_id TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(mentor_id, date, period_slot, subject, class_group)
    );

    CREATE TABLE IF NOT EXISTS subject_materials (
      id TEXT PRIMARY KEY,
      subject TEXT NOT NULL,
      unit_number INTEGER NOT NULL DEFAULT 1,
      title TEXT NOT NULL,
      description TEXT,
      material_type TEXT NOT NULL DEFAULT 'notes',
      file_url TEXT,
      external_url TEXT,
      file_size TEXT,
      uploaded_by TEXT,
      mentor_id TEXT,
      class_group TEXT,
      college_id TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS weekly_academic_tasks (
      id TEXT PRIMARY KEY,
      class_group TEXT NOT NULL,
      subject TEXT NOT NULL,
      week_number INTEGER NOT NULL,
      task_name TEXT NOT NULL,
      task_pdf_url TEXT,
      task_date TEXT,
      quiz_topic TEXT,
      assessment_topic TEXT,
      assignment_topic TEXT,
      mentor_id TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(class_group, subject, week_number)
    );

    CREATE TABLE IF NOT EXISTS student_academic_tracker (
      id TEXT PRIMARY KEY,
      student_email TEXT NOT NULL,
      student_id TEXT,
      class_group TEXT NOT NULL,
      subject TEXT NOT NULL,
      week_number INTEGER NOT NULL,
      attendance_status TEXT DEFAULT 'Present',
      submission_url TEXT,
      quiz_marks REAL,
      assessment_marks REAL,
      assignment_marks REAL,
      total_marks REAL,
      feedback TEXT,
      graded_by TEXT,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(student_email, class_group, subject, week_number)
    );

    CREATE TABLE IF NOT EXISTS student_interviews (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL DEFAULT 'batch_all',
      student_name TEXT DEFAULT 'Assigned Students',
      class_group TEXT DEFAULT '',
      subject TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'internal',
      marks REAL DEFAULT 0,
      total_marks REAL DEFAULT 100,
      technical_marks REAL DEFAULT 0,
      communication_marks REAL DEFAULT 0,
      status TEXT DEFAULT 'pending_cm',
      evaluator_name TEXT DEFAULT '',
      evaluator_role TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      mentor_id TEXT,
      mentor_name TEXT,
      target_date TEXT,
      topics TEXT,
      student_count INTEGER DEFAULT 0,
      origin_college_id TEXT DEFAULT '',
      target_college_id TEXT,
      priority_level INTEGER DEFAULT 1,
      assigned_mentor_ids TEXT,
      college_id TEXT,
      preferred_start_time TEXT DEFAULT '09:00 AM',
      total_duration_minutes INTEGER DEFAULT 0,
      requested_students INTEGER DEFAULT 0,
      accepted_capacity INTEGER DEFAULT 0,
      allocated_students INTEGER DEFAULT 0,
      remaining_students INTEGER DEFAULT 0,
      unallocated_students INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS interview_allocations (
      id TEXT PRIMARY KEY,
      interview_id TEXT NOT NULL,
      origin_college_id TEXT NOT NULL,
      target_college_id TEXT NOT NULL,
      mentor_id TEXT NOT NULL,
      mentor_name TEXT NOT NULL,
      allocated_student_count INTEGER NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      duration_minutes INTEGER NOT NULL,
      status TEXT DEFAULT 'pending_acceptance',
      gmeet_link TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(interview_id) REFERENCES student_interviews(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS cam_capacity_responses (
      id TEXT PRIMARY KEY,
      interview_id TEXT NOT NULL,
      college_id TEXT NOT NULL,
      college_name TEXT NOT NULL,
      cam_id TEXT NOT NULL,
      cam_name TEXT NOT NULL,
      accepted_student_capacity INTEGER NOT NULL DEFAULT 0,
      actual_available_capacity INTEGER NOT NULL DEFAULT 0,
      unfulfilled_capacity INTEGER NOT NULL DEFAULT 0,
      status TEXT DEFAULT 'pending',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(interview_id) REFERENCES student_interviews(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS student_interview_slots (
      id TEXT PRIMARY KEY,
      interview_id TEXT NOT NULL,
      allocation_id TEXT NOT NULL,
      student_id TEXT,
      student_name TEXT,
      mentor_id TEXT NOT NULL,
      mentor_name TEXT NOT NULL,
      college_id TEXT NOT NULL,
      slot_start_time TEXT NOT NULL,
      slot_end_time TEXT NOT NULL,
      status TEXT DEFAULT 'scheduled',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(interview_id) REFERENCES student_interviews(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS student_fees (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL,
      college_id TEXT NOT NULL,
      term_name TEXT NOT NULL,
      amount REAL NOT NULL,
      paid_amount REAL DEFAULT 0,
      fpc_amount REAL DEFAULT 0,
      fpc_pending REAL DEFAULT 0,
      academic_year TEXT,
      due_date TEXT,
      status TEXT DEFAULT 'unpaid',
      pay_link TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(student_id) REFERENCES students(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS fee_payments (
      id TEXT PRIMARY KEY,
      fee_id TEXT NOT NULL,
      student_id TEXT NOT NULL,
      college_id TEXT NOT NULL,
      amount REAL NOT NULL,
      payment_method TEXT NOT NULL,
      reference_no TEXT,
      receipt_no TEXT UNIQUE NOT NULL,
      payment_date TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(fee_id) REFERENCES student_fees(id),
      FOREIGN KEY(student_id) REFERENCES students(id)
    );

    CREATE TABLE IF NOT EXISTS feedback_reports (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      user_role TEXT,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sme_users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL DEFAULT 'password123',
      subject TEXT,
      is_head_sme INTEGER DEFAULT 0,
      head_subject_group TEXT
    );

    CREATE TABLE IF NOT EXISTS sme_availability (
      id TEXT PRIMARY KEY,
      sme_id TEXT NOT NULL,
      day_of_week TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      slot_type TEXT DEFAULT 'demo',
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (sme_id) REFERENCES sme_users(id) ON DELETE CASCADE
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

    CREATE TABLE IF NOT EXISTS mentor_groups (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      color TEXT DEFAULT '#4f46e5',
      is_active INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS subject_groups (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      lead_sme_id TEXT,
      lead_sme_name TEXT
    );

    CREATE TABLE IF NOT EXISTS demo_rules (
      id TEXT PRIMARY KEY,
      subject TEXT NOT NULL,
      week INTEGER NOT NULL,
      target INTEGER NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS campus_daily_configs (
      id TEXT PRIMARY KEY,
      college_id TEXT NOT NULL,
      dateStr TEXT NOT NULL,
      day_type TEXT NOT NULL,
      day_order TEXT NOT NULL,
      session_mode TEXT DEFAULT 'Offline',
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(college_id, dateStr)
    );

    CREATE TABLE IF NOT EXISTS academic_years (
      year_name TEXT PRIMARY KEY
    );

    CREATE TABLE IF NOT EXISTS academic_events (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      date TEXT NOT NULL,
      desc TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS faculty_configs (
      mentor_id TEXT PRIMARY KEY,
      max_hours INTEGER NOT NULL DEFAULT 16,
      shift TEXT NOT NULL DEFAULT 'general',
      FOREIGN KEY (mentor_id) REFERENCES mentors(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS kam_tasks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      collegeId TEXT,
      priority TEXT NOT NULL DEFAULT 'medium',
      status TEXT NOT NULL DEFAULT 'pending',
      dueDate TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS campus_issues (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      type TEXT NOT NULL,
      priority TEXT NOT NULL,
      desc TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      collegeId TEXT NOT NULL,
      collegeName TEXT,
      escalated INTEGER DEFAULT 0,
      escalatedAt TEXT,
      resolvedAt TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS signup_requests (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      requested_role TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      college_id TEXT,
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS mentor_attendance (
      id TEXT PRIMARY KEY,
      mentor_id TEXT NOT NULL,
      college_id TEXT NOT NULL,
      date_str TEXT NOT NULL,
      status TEXT NOT NULL,
      punch_in_time TEXT,
      punch_out_time TEXT,
      reason TEXT,
      marked_by TEXT NOT NULL DEFAULT 'self',
      marked_by_id TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (mentor_id) REFERENCES mentors(id) ON DELETE CASCADE,
      FOREIGN KEY (college_id) REFERENCES colleges(id) ON DELETE CASCADE,
      UNIQUE(mentor_id, date_str)
    );

    CREATE TABLE IF NOT EXISTS faculty_leave_requests (
      id TEXT PRIMARY KEY,
      mentor_id TEXT NOT NULL,
      college_id TEXT NOT NULL,
      request_type TEXT NOT NULL,
      leave_category TEXT NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      reason TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      approved_by TEXT,
      rejection_reason TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (mentor_id) REFERENCES mentors(id) ON DELETE CASCADE,
      FOREIGN KEY (college_id) REFERENCES colleges(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS interview_evaluations (
      id TEXT PRIMARY KEY,
      interview_id TEXT NOT NULL,
      student_id TEXT NOT NULL,
      student_name TEXT,
      class_group TEXT,
      mentor_id TEXT NOT NULL,
      mentor_name TEXT,
      attendance TEXT DEFAULT 'present',
      communication_score INTEGER DEFAULT 0,
      content_score INTEGER DEFAULT 0,
      technical_score INTEGER DEFAULT 0,
      confidence_score INTEGER DEFAULT 0,
      total_score INTEGER DEFAULT 0,
      questions_asked TEXT,
      remarks TEXT,
      status TEXT DEFAULT 'Cleared',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(student_id) REFERENCES students(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS system_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_by TEXT
    );

    CREATE TABLE IF NOT EXISTS exam_schedules (
      id TEXT PRIMARY KEY,
      college_id TEXT NOT NULL,
      department TEXT NOT NULL,
      semester TEXT NOT NULL,
      exam_type TEXT NOT NULL,
      subject_name TEXT NOT NULL,
      subject_code TEXT,
      exam_date TEXT NOT NULL,
      session_time TEXT NOT NULL,
      start_time TEXT,
      end_time TEXT,
      day_order TEXT,
      hall_room TEXT,
      max_marks REAL DEFAULT 50,
      passing_marks REAL DEFAULT 20,
      created_by TEXT,
      status TEXT DEFAULT 'Scheduled',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS student_exam_marks (
      id TEXT PRIMARY KEY,
      exam_id TEXT NOT NULL,
      student_id TEXT NOT NULL,
      college_id TEXT NOT NULL,
      marks_obtained REAL,
      max_marks REAL DEFAULT 50,
      is_absent INTEGER DEFAULT 0,
      grade TEXT,
      remarks TEXT,
      evaluated_by TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(exam_id, student_id),
      FOREIGN KEY (exam_id) REFERENCES exam_schedules(id) ON DELETE CASCADE,
      FOREIGN KEY (student_id) REFERENCES students(id)
    );
    INSERT OR IGNORE INTO system_settings (key, value) VALUES ('mailing_enabled', 'true');

    CREATE INDEX IF NOT EXISTS idx_slots_mentorId ON slots(mentorId);
      CREATE INDEX IF NOT EXISTS idx_slots_collegeId ON slots(college_id);
      CREATE INDEX IF NOT EXISTS idx_slots_day_time_shift ON slots(day, time, shift);
      CREATE INDEX IF NOT EXISTS idx_slots_classGroup ON slots(classGroup);
      CREATE INDEX IF NOT EXISTS idx_student_attendance_lookup ON student_attendance(slotId, dateStr);
      CREATE INDEX IF NOT EXISTS idx_student_attendance_student ON student_attendance(studentId, dateStr);
      CREATE INDEX IF NOT EXISTS idx_students_collegeId ON students(college_id);
      CREATE INDEX IF NOT EXISTS idx_students_classGroup ON students(classGroup);
      CREATE INDEX IF NOT EXISTS idx_mentors_collegeId ON mentors(college_id);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_login_history_user ON login_history(user_id, login_time DESC);
      CREATE INDEX IF NOT EXISTS idx_handover_req_users ON handover_requests(requestorId, targetStaffId);
      CREATE INDEX IF NOT EXISTS idx_student_interviews_college ON student_interviews(origin_college_id, target_college_id);
      CREATE INDEX IF NOT EXISTS idx_leave_requests_student ON leave_requests(studentId);
      CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_student_fees_student ON student_fees(student_id);
      CREATE INDEX IF NOT EXISTS idx_fee_payments_student ON fee_payments(student_id);
      CREATE INDEX IF NOT EXISTS idx_fee_payments_fee ON fee_payments(fee_id);
      CREATE INDEX IF NOT EXISTS idx_mentor_attendance_college_date ON mentor_attendance(college_id, date_str);
      CREATE INDEX IF NOT EXISTS idx_slots_location ON slots(location);
      CREATE INDEX IF NOT EXISTS idx_faculty_leave_college ON faculty_leave_requests(college_id);
      CREATE INDEX IF NOT EXISTS idx_student_interviews_college_status ON student_interviews(college_id, status);
      CREATE INDEX IF NOT EXISTS idx_handover_requests_status ON handover_requests(status);
      CREATE INDEX IF NOT EXISTS idx_approved_handovers_slot_date ON approved_handovers(slotId, dateStr);
      CREATE INDEX IF NOT EXISTS idx_student_attendance_dateStr ON student_attendance(dateStr);
      CREATE INDEX IF NOT EXISTS idx_student_attendance_dateStr_student ON student_attendance(dateStr, studentId);
      CREATE INDEX IF NOT EXISTS idx_student_attendance_dateStr_slot ON student_attendance(dateStr, slotId);
      CREATE INDEX IF NOT EXISTS idx_student_attendance_student_status ON student_attendance(studentId, status);
      CREATE INDEX IF NOT EXISTS idx_slots_college_day ON slots(college_id, day);
      CREATE INDEX IF NOT EXISTS idx_subjects_college ON subjects(college_id);
      CREATE INDEX IF NOT EXISTS idx_academic_tracker_lookup ON academic_tracker(college_id, mentor_id, subject, date);
    `);

      await dbInstance.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY
      );
    `);

    // Safe column additions for courses (unconditional)
    try { await dbInstance.exec(`ALTER TABLE courses ADD COLUMN sections TEXT;`); } catch (_) { }
    try { await dbInstance.exec(`ALTER TABLE courses ADD COLUMN shift_based INTEGER DEFAULT 0;`); } catch (_) { }
    try { await dbInstance.exec(`ALTER TABLE courses ADD COLUMN default_shift TEXT;`); } catch (_) { }
    try { await dbInstance.exec(`ALTER TABLE courses ADD COLUMN default_room TEXT;`); } catch (_) { }
    try { await dbInstance.exec(`ALTER TABLE courses ADD COLUMN start_date TEXT;`); } catch (_) { }
    try { await dbInstance.exec(`ALTER TABLE courses ADD COLUMN end_date TEXT;`); } catch (_) { }
    try { await dbInstance.exec(`ALTER TABLE courses ADD COLUMN start_year TEXT;`); } catch (_) { }
    try { await dbInstance.exec(`ALTER TABLE courses ADD COLUMN end_year TEXT;`); } catch (_) { }
    try { await dbInstance.exec(`ALTER TABLE courses ADD COLUMN years INTEGER DEFAULT 4;`); } catch (_) { }
    try { await dbInstance.exec(`ALTER TABLE courses ADD COLUMN status TEXT DEFAULT 'Active';`); } catch (_) { }
    try { await dbInstance.exec(`ALTER TABLE courses ADD COLUMN established_year TEXT;`); } catch (_) { }
    try { await dbInstance.exec(`ALTER TABLE courses ADD COLUMN hod_name TEXT;`); } catch (_) { }
    try { await dbInstance.exec(`ALTER TABLE courses ADD COLUMN code TEXT;`); } catch (_) { }
    try { await dbInstance.exec(`ALTER TABLE courses ADD COLUMN description TEXT;`); } catch (_) { }

    // Safe column additions for departments (unconditional)
    try { await dbInstance.exec(`ALTER TABLE departments ADD COLUMN shift_based INTEGER DEFAULT 0;`); } catch (_) { }

    // Safe column additions for exam_schedules (unconditional)
    try { await dbInstance.exec(`ALTER TABLE exam_schedules ADD COLUMN day_order TEXT;`); } catch (_) { }

    const versionRow = await dbInstance.get("SELECT version FROM schema_migrations LIMIT 1");
      const currentVersion = versionRow ? versionRow.version : 0;

      if (currentVersion < 5) {
        // 1. Column additions for student_interviews
        try { await dbInstance.exec(`ALTER TABLE student_interviews ADD COLUMN mentor_id TEXT;`); } catch (_) { }
        try { await dbInstance.exec(`ALTER TABLE student_interviews ADD COLUMN mentor_name TEXT;`); } catch (_) { }
        try { await dbInstance.exec(`ALTER TABLE student_interviews ADD COLUMN target_date TEXT;`); } catch (_) { }
        try { await dbInstance.exec(`ALTER TABLE student_interviews ADD COLUMN topics TEXT;`); } catch (_) { }
        try { await dbInstance.exec(`ALTER TABLE student_interviews ADD COLUMN student_count INTEGER;`); } catch (_) { }
        try { await dbInstance.exec(`ALTER TABLE student_interviews ADD COLUMN origin_college_id TEXT;`); } catch (_) { }
        try { await dbInstance.exec(`ALTER TABLE student_interviews ADD COLUMN target_college_id TEXT;`); } catch (_) { }
        try { await dbInstance.exec(`ALTER TABLE student_interviews ADD COLUMN gmeet_link TEXT;`); } catch (_) { }
        try { await dbInstance.exec(`ALTER TABLE student_interviews ADD COLUMN gcal_link TEXT;`); } catch (_) { }
        try { await dbInstance.exec(`ALTER TABLE student_interviews ADD COLUMN priority_level INTEGER DEFAULT 1;`); } catch (_) { }
        try { await dbInstance.exec(`ALTER TABLE student_interviews ADD COLUMN assigned_mentor_ids TEXT;`); } catch (_) { }
        try { await dbInstance.exec(`ALTER TABLE student_interviews ADD COLUMN preferred_start_time TEXT DEFAULT '09:00 AM';`); } catch (_) { }
        try { await dbInstance.exec(`ALTER TABLE student_interviews ADD COLUMN total_duration_minutes INTEGER DEFAULT 0;`); } catch (_) { }
        try { await dbInstance.exec(`ALTER TABLE student_interviews ADD COLUMN requested_students INTEGER DEFAULT 0;`); } catch (_) { }
        try { await dbInstance.exec(`ALTER TABLE student_interviews ADD COLUMN accepted_capacity INTEGER DEFAULT 0;`); } catch (_) { }
        try { await dbInstance.exec(`ALTER TABLE student_interviews ADD COLUMN allocated_students INTEGER DEFAULT 0;`); } catch (_) { }
        try { await dbInstance.exec(`ALTER TABLE student_interviews ADD COLUMN remaining_students INTEGER DEFAULT 0;`); } catch (_) { }
        try { await dbInstance.exec(`ALTER TABLE student_interviews ADD COLUMN unallocated_students INTEGER DEFAULT 0;`); } catch (_) { }
        try { await dbInstance.exec(`ALTER TABLE student_interview_slots ADD COLUMN gmeet_link TEXT;`); } catch (_) { }
        try { await dbInstance.exec(`ALTER TABLE student_interview_slots ADD COLUMN gcal_link TEXT;`); } catch (_) { }
        try { await dbInstance.exec(`ALTER TABLE student_interview_slots ADD COLUMN subject TEXT;`); } catch (_) { }
        try { await dbInstance.exec(`ALTER TABLE student_interview_slots ADD COLUMN target_date TEXT;`); } catch (_) { }
        try { await dbInstance.exec(`ALTER TABLE notifications ADD COLUMN link TEXT;`); } catch (_) { }
        try { await dbInstance.exec(`ALTER TABLE notifications ADD COLUMN type TEXT DEFAULT 'info';`); } catch (_) { }

        // Backfill evaluator_name / evaluator_role
        try { await dbInstance.exec(`UPDATE student_interviews SET evaluator_name = '' WHERE evaluator_name IS NULL;`); } catch (_) { }
        try { await dbInstance.exec(`UPDATE student_interviews SET evaluator_role = '' WHERE evaluator_role IS NULL;`); } catch (_) { }

        try { await dbInstance.exec(`ALTER TABLE subjects ADD COLUMN subject_group TEXT;`); } catch (_) { }
        try { await dbInstance.exec(`ALTER TABLE subjects ADD COLUMN mentor_group TEXT;`); } catch (_) { }
        try { await dbInstance.exec(`ALTER TABLE mentors ADD COLUMN subject_group TEXT;`); } catch (_) { }
        try { await dbInstance.exec(`ALTER TABLE mentors ADD COLUMN mentor_group TEXT;`); } catch (_) { }
        try { await dbInstance.exec(`ALTER TABLE sme_users ADD COLUMN mentor_group TEXT;`); } catch (_) { }
        try { await dbInstance.exec(`ALTER TABLE sme_users ADD COLUMN is_head_sme INTEGER DEFAULT 0;`); } catch (_) { }
        try { await dbInstance.exec(`ALTER TABLE sme_users ADD COLUMN head_subject_group TEXT;`); } catch (_) { }
        try { await dbInstance.exec(`ALTER TABLE subject_groups ADD COLUMN lead_sme_id TEXT;`); } catch (_) { }
        try { await dbInstance.exec(`ALTER TABLE subject_groups ADD COLUMN lead_sme_name TEXT;`); } catch (_) { }

        // Safe column additions for courses
        try { await dbInstance.exec(`ALTER TABLE courses ADD COLUMN sections TEXT;`); } catch (_) { }
        try { await dbInstance.exec(`ALTER TABLE courses ADD COLUMN shift_based INTEGER DEFAULT 0;`); } catch (_) { }
        try { await dbInstance.exec(`ALTER TABLE courses ADD COLUMN default_shift TEXT;`); } catch (_) { }
        try { await dbInstance.exec(`ALTER TABLE courses ADD COLUMN default_room TEXT;`); } catch (_) { }
        try { await dbInstance.exec(`ALTER TABLE courses ADD COLUMN start_date TEXT;`); } catch (_) { }
        try { await dbInstance.exec(`ALTER TABLE courses ADD COLUMN end_date TEXT;`); } catch (_) { }
        try { await dbInstance.exec(`ALTER TABLE courses ADD COLUMN start_year TEXT;`); } catch (_) { }
        try { await dbInstance.exec(`ALTER TABLE courses ADD COLUMN end_year TEXT;`); } catch (_) { }
        try { await dbInstance.exec(`ALTER TABLE courses ADD COLUMN years INTEGER DEFAULT 4;`); } catch (_) { }
        try { await dbInstance.exec(`ALTER TABLE courses ADD COLUMN status TEXT DEFAULT 'Active';`); } catch (_) { }
        try { await dbInstance.exec(`ALTER TABLE courses ADD COLUMN established_year TEXT;`); } catch (_) { }
        try { await dbInstance.exec(`ALTER TABLE courses ADD COLUMN hod_name TEXT;`); } catch (_) { }
        try { await dbInstance.exec(`ALTER TABLE courses ADD COLUMN code TEXT;`); } catch (_) { }
        try { await dbInstance.exec(`ALTER TABLE courses ADD COLUMN description TEXT;`); } catch (_) { }

        // Safe column additions for departments
        try { await dbInstance.exec(`ALTER TABLE departments ADD COLUMN shift_based INTEGER DEFAULT 0;`); } catch (_) { }

        // Populate mentor_groups table from subject_groups if empty
        try {
          const mgCount = await dbInstance.get("SELECT COUNT(*) as count FROM mentor_groups");
          if (!mgCount || mgCount.count === 0) {
            const existingSubGroups = await dbInstance.all("SELECT * FROM subject_groups");
            for (const sg of existingSubGroups) {
              await dbInstance.run(
                "INSERT OR IGNORE INTO mentor_groups (id, name, description) VALUES (?, ?, ?)",
                [sg.id || `mg_${sg.name.toLowerCase().replace(/[^a-z0-9]/g, '')}`, sg.name, sg.description || `${sg.name} Mentor Group`]
              );
            }
          }
        } catch (_) { }

        const adminCount = await dbInstance.get("SELECT COUNT(*) as count FROM admin_users");
        if (!adminCount || adminCount.count === 0) {
          await dbInstance.run(
            "INSERT OR IGNORE INTO admin_users (id, name, email) VALUES ('admin_thanush', 'Thanush', 'Thanush@faceprep.in')"
          );
          await dbInstance.run(
            "INSERT OR IGNORE INTO users (id, email, password_hash, role, reference_id, created_at, updated_at) VALUES ('admin_thanush', 'thanush@faceprep.in', 'Thanush@24', 'admin', 'admin_thanush', datetime('now'), datetime('now'))"
          );
        }

        try { await dbInstance.exec(`ALTER TABLE subjects ADD COLUMN college_id TEXT;`); } catch (_) { }
        try { await dbInstance.exec(`ALTER TABLE colleges ADD COLUMN rooms TEXT;`); } catch (_) { }
        try { await dbInstance.exec(`ALTER TABLE colleges ADD COLUMN code TEXT;`); } catch (_) { }
        try { await dbInstance.exec(`ALTER TABLE colleges ADD COLUMN academic_year TEXT;`); } catch (_) { }
        try { await dbInstance.exec(`ALTER TABLE colleges ADD COLUMN manager TEXT;`); } catch (_) { }
        try { await dbInstance.exec(`ALTER TABLE courses ADD COLUMN default_room TEXT;`); } catch (_) { }
        try { await dbInstance.exec(`ALTER TABLE courses ADD COLUMN default_shift TEXT;`); } catch (_) { }
        try { await dbInstance.exec(`ALTER TABLE subjects ADD COLUMN year TEXT;`); } catch (_) { }
        try { await dbInstance.exec(`ALTER TABLE departments ADD COLUMN college_id TEXT;`); } catch (_) { }
        try { await dbInstance.exec(`ALTER TABLE departments ADD COLUMN code TEXT;`); } catch (_) { }
        try { await dbInstance.exec(`ALTER TABLE approved_handovers ADD COLUMN course TEXT;`); } catch (_) { }
        try { await dbInstance.exec(`ALTER TABLE departments ADD COLUMN description TEXT;`); } catch (_) { }
        try { await dbInstance.exec(`ALTER TABLE departments ADD COLUMN hod_name TEXT;`); } catch (_) { }
        try { await dbInstance.exec(`ALTER TABLE departments ADD COLUMN established_year TEXT;`); } catch (_) { }
        try { await dbInstance.exec(`ALTER TABLE departments ADD COLUMN status TEXT DEFAULT 'Active';`); } catch (_) { }
        try { await dbInstance.exec(`ALTER TABLE departments ADD COLUMN years INTEGER DEFAULT 4;`); } catch (_) { }
        try { await dbInstance.exec(`ALTER TABLE departments ADD COLUMN start_year TEXT;`); } catch (_) { }
        try { await dbInstance.exec(`ALTER TABLE departments ADD COLUMN end_year TEXT;`); } catch (_) { }
        try { await dbInstance.exec(`ALTER TABLE subjects ADD COLUMN weekly_hours INTEGER DEFAULT 4;`); } catch (_) { }

        // Slots table migrations
        try { await dbInstance.exec(`ALTER TABLE slots ADD COLUMN semester TEXT;`); } catch (_) { }
        try { await dbInstance.exec(`ALTER TABLE slots ADD COLUMN year TEXT;`); } catch (_) { }
        try { await dbInstance.exec(`ALTER TABLE slots ADD COLUMN department TEXT;`); } catch (_) { }
        try { await dbInstance.exec(`ALTER TABLE handover_requests ADD COLUMN original_subject TEXT;`); } catch (_) { }
        try { await dbInstance.exec(`ALTER TABLE handover_requests ADD COLUMN original_month TEXT;`); } catch (_) { }
        try { await dbInstance.exec(`ALTER TABLE approved_handovers ADD COLUMN ledger_month TEXT;`); } catch (_) { }

        // Year values backfill
        try {
          await dbInstance.run(`UPDATE subjects SET year = 'Year 1' WHERE (year IS NULL OR year = '') AND semester IN ('Semester 1', 'Semester 2')`);
          await dbInstance.run(`UPDATE subjects SET year = 'Year 2' WHERE (year IS NULL OR year = '') AND semester IN ('Semester 3', 'Semester 4')`);
          await dbInstance.run(`UPDATE subjects SET year = 'Year 3' WHERE (year IS NULL OR year = '') AND semester IN ('Semester 5', 'Semester 6')`);
          await dbInstance.run(`UPDATE subjects SET year = 'Year 4' WHERE (year IS NULL OR year = '') AND semester IN ('Semester 7', 'Semester 8')`);
        } catch (_) { }

        try { await dbInstance.exec(`ALTER TABLE colleges ADD COLUMN working_days INTEGER DEFAULT 5;`); } catch (_) { }
        try { await dbInstance.exec(`ALTER TABLE campus_daily_configs ADD COLUMN session_mode TEXT DEFAULT 'Offline';`); } catch (_) { }
        try { await dbInstance.exec(`ALTER TABLE students ADD COLUMN correction_count INTEGER DEFAULT 0;`); } catch (_) { }
        try { await dbInstance.exec(`ALTER TABLE students ADD COLUMN section TEXT;`); } catch (_) { }
        try { await dbInstance.exec(`ALTER TABLE students ADD COLUMN hire_score TEXT;`); } catch (_) { }
        try { await dbInstance.exec(`ALTER TABLE students ADD COLUMN efset_score TEXT;`); } catch (_) { }
        try { await dbInstance.exec(`ALTER TABLE students ADD COLUMN mother_name TEXT;`); } catch (_) { }
        try { await dbInstance.exec(`ALTER TABLE students ADD COLUMN father_name TEXT;`); } catch (_) { }
        try { await dbInstance.exec(`ALTER TABLE students ADD COLUMN pan_number TEXT;`); } catch (_) { }
        try { await dbInstance.exec(`ALTER TABLE academic_events ADD COLUMN end_date TEXT;`); } catch (_) { }
        try { await dbInstance.exec(`ALTER TABLE academic_events ADD COLUMN category TEXT DEFAULT 'Coding Fest & Hackathon';`); } catch (_) { }
        try { await dbInstance.exec(`ALTER TABLE academic_events ADD COLUMN department TEXT DEFAULT 'All Departments';`); } catch (_) { }
        try { await dbInstance.exec(`ALTER TABLE academic_events ADD COLUMN audience TEXT DEFAULT 'All Campus';`); } catch (_) { }
        try { await dbInstance.exec(`ALTER TABLE academic_events ADD COLUMN status TEXT DEFAULT 'Upcoming';`); } catch (_) { }
        try { await dbInstance.exec(`ALTER TABLE academic_events ADD COLUMN venue TEXT;`); } catch (_) { }
        try { await dbInstance.exec(`ALTER TABLE academic_events ADD COLUMN college_id TEXT;`); } catch (_) { }
        try { await dbInstance.exec(`ALTER TABLE academic_events ADD COLUMN photos TEXT;`); } catch (_) { }
        try { await dbInstance.exec(`ALTER TABLE academic_events ADD COLUMN coordinator TEXT;`); } catch (_) { }
        try { await dbInstance.exec(`ALTER TABLE academic_events ADD COLUMN chief_guest TEXT;`); } catch (_) { }
        try { await dbInstance.exec(`ALTER TABLE academic_events ADD COLUMN registration_link TEXT;`); } catch (_) { }
        try { await dbInstance.exec(`ALTER TABLE student_attendance ADD COLUMN type TEXT DEFAULT 'Regular';`); } catch (_) { }
        try { await dbInstance.exec(`ALTER TABLE student_attendance ADD COLUMN mode TEXT DEFAULT 'Offline';`); } catch (_) { }
        try { await dbInstance.exec(`ALTER TABLE student_attendance ADD COLUMN attendanceTypeSub TEXT;`); } catch (_) { }
        try { await dbInstance.exec(`ALTER TABLE audit_logs ADD COLUMN old_status TEXT;`); } catch (_) { }
        try { await dbInstance.exec(`ALTER TABLE audit_logs ADD COLUMN new_status TEXT;`); } catch (_) { }
        try { await dbInstance.exec(`ALTER TABLE audit_logs ADD COLUMN reason TEXT;`); } catch (_) { }
        try { await dbInstance.exec(`ALTER TABLE audit_logs ADD COLUMN changed_by TEXT;`); } catch (_) { }

        try { await dbInstance.exec(`ALTER TABLE users ADD COLUMN must_change_password BOOLEAN DEFAULT 0;`); } catch (_) { }
        try { await dbInstance.exec(`ALTER TABLE users ADD COLUMN last_login TEXT DEFAULT NULL;`); } catch (_) { }
        try { await dbInstance.exec(`ALTER TABLE users ADD COLUMN plain_password TEXT DEFAULT 'password123';`); } catch (_) { }
        try { await dbInstance.exec(`UPDATE users SET plain_password = 'password123' WHERE plain_password IS NULL OR plain_password = '';`); } catch (_) { }
        try { await dbInstance.exec(`UPDATE users SET plain_password = 'Thanush@24' WHERE id = 'admin_thanush' OR LOWER(email) = 'thanush@faceprep.in';`); } catch (_) { }

        try { await dbInstance.exec(`ALTER TABLE slots ADD COLUMN batch_start_year INTEGER;`); } catch (_) { }
        try { await dbInstance.exec(`ALTER TABLE slots ADD COLUMN batch_end_year INTEGER;`); } catch (_) { }
        try { await dbInstance.exec(`ALTER TABLE students ADD COLUMN batch_start_year INTEGER;`); } catch (_) { }
        try { await dbInstance.exec(`ALTER TABLE students ADD COLUMN batch_end_year INTEGER;`); } catch (_) { }
        try { await dbInstance.exec(`ALTER TABLE students ADD COLUMN semester TEXT;`); } catch (_) { }
        try { await dbInstance.exec(`ALTER TABLE students ADD COLUMN shift TEXT;`); } catch (_) { }

        try { await dbInstance.exec(`ALTER TABLE mentors ADD COLUMN employee_id TEXT;`); } catch (_) { }
        try { await dbInstance.exec(`ALTER TABLE mentors ADD COLUMN phone TEXT;`); } catch (_) { }
        try { await dbInstance.exec(`ALTER TABLE mentors ADD COLUMN qualification TEXT;`); } catch (_) { }
        try { await dbInstance.exec(`ALTER TABLE mentors ADD COLUMN experience TEXT;`); } catch (_) { }
        try { await dbInstance.exec(`ALTER TABLE mentors ADD COLUMN specialization TEXT;`); } catch (_) { }
        try { await dbInstance.exec(`ALTER TABLE mentors ADD COLUMN designation TEXT;`); } catch (_) { }
        try { await dbInstance.exec(`ALTER TABLE mentors ADD COLUMN joining_date TEXT;`); } catch (_) { }
        try { await dbInstance.exec(`ALTER TABLE mentors ADD COLUMN status TEXT DEFAULT 'Active';`); } catch (_) { }
        try { await dbInstance.exec(`ALTER TABLE mentors ADD COLUMN password_hash TEXT;`); } catch (_) { }
        try { await dbInstance.exec(`ALTER TABLE mentors ADD COLUMN last_login TEXT;`); } catch (_) { }
        try { await dbInstance.exec(`ALTER TABLE mentors ADD COLUMN created_at TEXT;`); } catch (_) { }
        try { await dbInstance.exec(`ALTER TABLE mentors ADD COLUMN updated_at TEXT;`); } catch (_) { }

        try { await dbInstance.exec(`ALTER TABLE students ADD COLUMN register_number TEXT;`); } catch (_) { }
        try { await dbInstance.exec(`ALTER TABLE students ADD COLUMN roll_number TEXT;`); } catch (_) { }
        try { await dbInstance.exec(`ALTER TABLE students ADD COLUMN avatar TEXT;`); } catch (_) { }
        try { await dbInstance.exec(`ALTER TABLE students ADD COLUMN phone TEXT;`); } catch (_) { }
        try { await dbInstance.exec(`ALTER TABLE students ADD COLUMN gender TEXT;`); } catch (_) { }
        try { await dbInstance.exec(`ALTER TABLE students ADD COLUMN dob TEXT;`); } catch (_) { }
        try { await dbInstance.exec(`ALTER TABLE students ADD COLUMN address TEXT;`); } catch (_) { }
        try { await dbInstance.exec(`ALTER TABLE students ADD COLUMN guardian_name TEXT;`); } catch (_) { }
        try { await dbInstance.exec(`ALTER TABLE students ADD COLUMN guardian_phone TEXT;`); } catch (_) { }
        try { await dbInstance.exec(`ALTER TABLE students ADD COLUMN admission_date TEXT;`); } catch (_) { }
        try { await dbInstance.exec(`ALTER TABLE students ADD COLUMN password_hash TEXT;`); } catch (_) { }
        try { await dbInstance.exec(`ALTER TABLE students ADD COLUMN status TEXT DEFAULT 'Active';`); } catch (_) { }
        try { await dbInstance.exec(`ALTER TABLE students ADD COLUMN last_login TEXT;`); } catch (_) { }
        try { await dbInstance.exec(`ALTER TABLE students ADD COLUMN created_at TEXT;`); } catch (_) { }
        try { await dbInstance.exec(`ALTER TABLE students ADD COLUMN updated_at TEXT;`); } catch (_) { }
        try { await dbInstance.exec(`ALTER TABLE students ADD COLUMN tenth_mark TEXT;`); } catch (_) { }
        try { await dbInstance.exec(`ALTER TABLE students ADD COLUMN eleventh_mark TEXT;`); } catch (_) { }
        try { await dbInstance.exec(`ALTER TABLE students ADD COLUMN twelfth_mark TEXT;`); } catch (_) { }
        try { await dbInstance.exec(`ALTER TABLE students ADD COLUMN academic_group TEXT;`); } catch (_) { }
        try { await dbInstance.exec(`ALTER TABLE students ADD COLUMN medium TEXT;`); } catch (_) { }
        try { await dbInstance.exec(`ALTER TABLE students ADD COLUMN blood_group TEXT;`); } catch (_) { }
        try { await dbInstance.exec(`ALTER TABLE students ADD COLUMN parent_phone TEXT;`); } catch (_) { }
        try { await dbInstance.exec(`ALTER TABLE students ADD COLUMN aadhar_number TEXT;`); } catch (_) { }
        try { await dbInstance.exec(`ALTER TABLE students ADD COLUMN linkedin_link TEXT;`); } catch (_) { }
        try { await dbInstance.exec(`ALTER TABLE students ADD COLUMN github_id TEXT;`); } catch (_) { }
        try { await dbInstance.exec(`ALTER TABLE students ADD COLUMN project_drive_link TEXT;`); } catch (_) { }
        try { await dbInstance.exec(`ALTER TABLE students ADD COLUMN hackerrank_link TEXT;`); } catch (_) { }
        try { await dbInstance.exec(`ALTER TABLE students ADD COLUMN leetcode_link TEXT;`); } catch (_) { }
        try { await dbInstance.exec(`ALTER TABLE students ADD COLUMN figma_link TEXT;`); } catch (_) { }

        try { await dbInstance.exec(`ALTER TABLE handover_requests ADD COLUMN request_type TEXT DEFAULT 'handover';`); } catch (_) { }
        try { await dbInstance.exec(`ALTER TABLE handover_requests ADD COLUMN compensates_handover_id TEXT;`); } catch (_) { }
        try { await dbInstance.exec(`ALTER TABLE student_fees ADD COLUMN fpc_amount REAL DEFAULT 0;`); } catch (_) { }
        try { await dbInstance.exec(`ALTER TABLE student_fees ADD COLUMN fpc_pending REAL DEFAULT 0;`); } catch (_) { }
        try { await dbInstance.exec(`ALTER TABLE student_fees ADD COLUMN academic_year TEXT;`); } catch (_) { }
        try { await dbInstance.exec(`ALTER TABLE courses ADD COLUMN shift_based INTEGER DEFAULT 0;`); } catch (_) { }
        try { await dbInstance.exec(`ALTER TABLE departments ADD COLUMN shift_based INTEGER DEFAULT 0;`); } catch (_) { }
        try { await dbInstance.exec(`ALTER TABLE slots ADD COLUMN college_id TEXT;`); } catch (_) { }

        try {
          await dbInstance.exec(`
            UPDATE slots
            SET college_id = (SELECT college_id FROM mentors WHERE mentors.id = slots.mentorId)
            WHERE college_id IS NULL;
          `);
          await dbInstance.exec(`UPDATE slots SET college_id = 'college_1' WHERE college_id IS NULL;`);
        } catch (_) { }

        try { await dbInstance.exec(`ALTER TABLE demo_sessions ADD COLUMN start_time TEXT;`); } catch (_) { }
        try { await dbInstance.exec(`ALTER TABLE demo_sessions ADD COLUMN end_time TEXT;`); } catch (_) { }
        try { await dbInstance.exec(`ALTER TABLE demo_sessions ADD COLUMN college_id TEXT;`); } catch (_) { }
        try { await dbInstance.exec(`ALTER TABLE demo_swap_requests ADD COLUMN requestType TEXT DEFAULT 'reschedule';`); } catch (_) { }
        try { await dbInstance.exec(`ALTER TABLE demo_swap_requests ADD COLUMN requestorRole TEXT DEFAULT 'sme';`); } catch (_) { }
        try { await dbInstance.exec(`ALTER TABLE demo_swap_requests ADD COLUMN requestorId TEXT;`); } catch (_) { }
        try { await dbInstance.exec(`ALTER TABLE demo_swap_requests ADD COLUMN proposedStartTime TEXT;`); } catch (_) { }
        try { await dbInstance.exec(`ALTER TABLE demo_swap_requests ADD COLUMN proposedEndTime TEXT;`); } catch (_) { }
        try { await dbInstance.exec(`ALTER TABLE demo_swap_requests ADD COLUMN reviewedBy TEXT;`); } catch (_) { }
        try { await dbInstance.exec(`ALTER TABLE demo_swap_requests ADD COLUMN reviewedAt TEXT;`); } catch (_) { }
        try { await dbInstance.exec(`ALTER TABLE sme_availability ADD COLUMN slot_type TEXT DEFAULT 'demo';`); } catch (_) { }

        try {
          // Clean any invalid Sunday attendance records from DB
          await dbInstance.exec(`DELETE FROM student_attendance WHERE strftime('%w', dateStr) = '0';`);
        } catch (_) { }



        try {
          await syncMentorSubjectGroups(dbInstance);
        } catch (syncErr) {
          console.error("Error during syncMentorSubjectGroups:", syncErr);
        }

        await dbInstance.run("INSERT OR REPLACE INTO schema_migrations (version) VALUES (6);");
      }

      // ── Performance Indexes (safe to re-run — CREATE IF NOT EXISTS) ───────
      try {
        await dbInstance.exec(`
          CREATE INDEX IF NOT EXISTS idx_sa_student      ON student_attendance (studentId);
          CREATE INDEX IF NOT EXISTS idx_sa_slot_date    ON student_attendance (slotId, dateStr);
          CREATE INDEX IF NOT EXISTS idx_sa_date         ON student_attendance (dateStr);
          CREATE INDEX IF NOT EXISTS idx_sa_student_date ON student_attendance (studentId, dateStr);

          CREATE INDEX IF NOT EXISTS idx_slots_mentor    ON slots (mentorId, day, time);
          CREATE INDEX IF NOT EXISTS idx_slots_college   ON slots (college_id);
          CREATE INDEX IF NOT EXISTS idx_slots_class     ON slots (classGroup, day, time);
          CREATE INDEX IF NOT EXISTS idx_slots_location  ON slots (location, day, time, shift);

          CREATE INDEX IF NOT EXISTS idx_stu_college     ON students (college_id);
          CREATE INDEX IF NOT EXISTS idx_stu_class       ON students (classGroup, college_id);
          CREATE INDEX IF NOT EXISTS idx_stu_roll        ON students (roll_number);
          CREATE INDEX IF NOT EXISTS idx_stu_reg         ON students (register_number);
          CREATE INDEX IF NOT EXISTS idx_stu_email       ON students (email);

          CREATE INDEX IF NOT EXISTS idx_users_email     ON users (email);
          CREATE INDEX IF NOT EXISTS idx_users_ref       ON users (reference_id);
          CREATE INDEX IF NOT EXISTS idx_users_role      ON users (role);

          CREATE INDEX IF NOT EXISTS idx_notifs_user     ON notifications (user_id, is_read);
          CREATE INDEX IF NOT EXISTS idx_audit_ts        ON audit_logs (timestamp);

          CREATE INDEX IF NOT EXISTS idx_at_mentor_date  ON academic_tracker (mentor_id, date);
          CREATE INDEX IF NOT EXISTS idx_at_class        ON academic_tracker (class_group, subject);

          CREATE INDEX IF NOT EXISTS idx_fees_student    ON student_fees (student_id, college_id);
          CREATE INDEX IF NOT EXISTS idx_fees_college    ON student_fees (college_id, status);

          CREATE INDEX IF NOT EXISTS idx_interviews_col  ON student_interviews (college_id, status);
          CREATE INDEX IF NOT EXISTS idx_allocs          ON interview_allocations (interview_id);

          CREATE INDEX IF NOT EXISTS idx_dconfig         ON campus_daily_configs (college_id, dateStr);
          CREATE INDEX IF NOT EXISTS idx_handover_slot   ON approved_handovers (slotId, dateStr);
          CREATE INDEX IF NOT EXISTS idx_handover_req    ON handover_requests (requestorId, status);
        `);
        console.log("[DB] Performance indexes ensured.");
      } catch (idxErr: any) {
        console.warn("[DB] Index creation warning (non-fatal):", idxErr?.message);
      }

      return dbInstance;
    })();
  }
  return dbPromise;
}


export async function resolveClassGroupDetails(db: any, classGroup: string) {
  if (!classGroup) {
    return { department: "General", semester: "Semester 1", year: "Year 1" };
  }

  // 1. Get all courses/departments from database
  const courses = await db.all("SELECT name, code FROM courses");
  const depts = await db.all("SELECT name, code FROM departments");
  const allCourseNames = Array.from(new Set([
    ...courses.map((c: any) => c.name),
    ...depts.map((d: any) => d.name)
  ])).filter(Boolean);

  // 2. Get distinct semesters and years from subjects
  const subjectMetadata = await db.all("SELECT DISTINCT semester, year FROM subjects WHERE semester IS NOT NULL AND semester != ''");

  const cleanCG = classGroup.trim();
  const cgLower = cleanCG.toLowerCase();

  // A. Determine Department/Course
  let resolvedDept = "";
  let bestDeptMatchScore = 0;

  // Normalize text for matching
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  // Strip leading Roman numerals / year prefixes (e.g. "III BCA" -> "BCA", "I BBA DM" -> "BBA DM")
  const strippedCG = cleanCG.replace(/^(?:[ivxldc]+|\d+(?:st|nd|rd|th)?)\s+(?:year\s+)?/i, "").trim();
  const cgNorm = normalize(cgLower);
  const strippedNorm = normalize(strippedCG);

  // Try to match with exact name
  for (const deptName of allCourseNames) {
    const deptNorm = normalize(deptName);
    if (cgNorm.includes(deptNorm) || strippedNorm.includes(deptNorm) || deptNorm.includes(strippedNorm)) {
      if (deptNorm.length > bestDeptMatchScore) {
        resolvedDept = deptName;
        bestDeptMatchScore = deptNorm.length;
      }
    }
  }

  // If no match found yet, try code mapping
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

  // If still not resolved, try abbreviation matching
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

  // Fallback to cleaned prefix
  if (!resolvedDept) {
    resolvedDept = strippedCG.split("-")[0].split("(")[0].trim() || cleanCG.split("-")[0].split("(")[0].trim();
  }

  // B. Determine Semester
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

  // C. Determine Year
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

  let course = classGroup.split('-')[0].split('(')[0].trim();

  return { course, shift, semester, startYear, endYear };
}

export async function syncMentorSubjectGroups(db: any) {
  // 1. Fetch all configured subject groups
  const groupRows = await db.all("SELECT * FROM subject_groups");
  if (!groupRows || groupRows.length === 0) return;
  const groupNames = groupRows.map((g: any) => g.name);

  // 2. Fetch all subjects
  const allSubjects = await db.all("SELECT id, name, subject_group, mentor_group FROM subjects");

  for (const sub of allSubjects) {
    let matchedGroup: string | null = sub.subject_group || sub.mentor_group || null;

    if (!matchedGroup || matchedGroup.toLowerCase() === "general") {
      const subNameLower = (sub.name || "").toLowerCase();

      // Check direct group name match against EXPLICIT configured group names
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

  // 3. Fetch all mentors and map to updated subject groups
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
      await db.run("UPDATE mentors SET mentor_group = ?, subject_group = ? WHERE id = ? AND (mentor_group IS NULL OR mentor_group = '' OR mentor_group = 'General')", [matchedGroup, matchedGroup, mentor.id]);
    }
  }
}

export async function consolidateSubjectGroups(db: any) {
  // Merge duplicate/fragmented groups into canonical definitions:
  // 1. English (g1) -> English / Communication
  await db.run("UPDATE mentors SET mentor_group = 'English / Communication', subject_group = 'English / Communication' WHERE mentor_group = 'English' OR subject_group = 'English'");
  await db.run("UPDATE subjects SET mentor_group = 'English / Communication', subject_group = 'English / Communication' WHERE mentor_group = 'English' OR subject_group = 'English'");
  await db.run("DELETE FROM subject_groups WHERE id = 'g1'");

  // 2. Aptitude (g2) & Mathematics (sg_math) -> Maths / Aptitude
  await db.run("UPDATE mentors SET mentor_group = 'Maths / Aptitude', subject_group = 'Maths / Aptitude' WHERE mentor_group IN ('Aptitude', 'Mathematics') OR subject_group IN ('Aptitude', 'Mathematics')");
  await db.run("UPDATE subjects SET mentor_group = 'Maths / Aptitude', subject_group = 'Maths / Aptitude' WHERE mentor_group IN ('Aptitude', 'Mathematics') OR subject_group IN ('Aptitude', 'Mathematics')");
  await db.run("DELETE FROM subject_groups WHERE id IN ('g2', 'sg_math')");

  // 3. Technical & Computer Applications -> Computer Science
  await db.run("UPDATE mentors SET mentor_group = 'Computer Science', subject_group = 'Computer Science' WHERE mentor_group IN ('Technical', 'Computer Applications') OR subject_group IN ('Technical', 'Computer Applications')");
  await db.run("UPDATE subjects SET mentor_group = 'Computer Science', subject_group = 'Computer Science' WHERE mentor_group IN ('Technical', 'Computer Applications') OR subject_group IN ('Technical', 'Computer Applications')");
  await db.run("DELETE FROM subject_groups WHERE id = 'g4'");

  // 4. Clean up phantom General group if not needed, or normalize id
  await db.run("DELETE FROM subject_groups WHERE id = 'g5' AND NOT EXISTS (SELECT 1 FROM mentors WHERE mentor_group = 'General' OR subject_group = 'General')");

  // Re-sync mappings strictly
  await syncMentorSubjectGroups(db);
}

export async function syncMentorSubjectsAndClasses(db: TursoDbAdapter, mentorId: string, course?: string, classGroup?: string) {
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

