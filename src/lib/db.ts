import { createClient, Client } from "@libsql/client";

export interface TursoDbAdapter {
  get: (sql: string, ...params: any[]) => Promise<any>;
  all: (sql: string, ...params: any[]) => Promise<any[]>;
  run: (sql: string, ...params: any[]) => Promise<{ lastID?: number; changes: number }>;
  exec: (sql: string) => Promise<void>;
  client: Client;
}

function normalizeParams(params: any[]): any[] {
  let args = params;
  if (params.length === 1 && Array.isArray(params[0])) {
    args = params[0];
  }
  return args.map(arg => (arg === undefined ? null : arg));
}

function createDbAdapter(client: Client): TursoDbAdapter {
  return {
    client,
    async get(sql: string, ...params: any[]) {
      const args = normalizeParams(params);
      const res = await client.execute({ sql, args });
      return res.rows[0] ? { ...res.rows[0] } : undefined;
    },
    async all(sql: string, ...params: any[]) {
      const args = normalizeParams(params);
      const res = await client.execute({ sql, args });
      return res.rows.map(row => ({ ...row }));
    },
    async run(sql: string, ...params: any[]) {
      const args = normalizeParams(params);
      const res = await client.execute({ sql, args });
      return {
        lastID: res.lastInsertRowid !== undefined ? Number(res.lastInsertRowid) : undefined,
        changes: res.rowsAffected
      };
    },
    async exec(sql: string) {
      await client.executeMultiple(sql);
    }
  };
}

let dbInstance: TursoDbAdapter | null = null;
let dbPromise: Promise<TursoDbAdapter> | null = null;

export function getDb(): Promise<TursoDbAdapter> {
  if (dbInstance) return Promise.resolve(dbInstance);
  if (!dbPromise) {
    dbPromise = (async () => {
      const url = process.env.TURSO_DATABASE_URL || "file:database.sqlite";
      const authToken = process.env.TURSO_AUTH_TOKEN;

      const client = createClient({
        url,
        authToken,
      });

      dbInstance = createDbAdapter(client);

      // Enable foreign keys for references
      try {
        await dbInstance.exec("PRAGMA foreign_keys = ON;");
      } catch (_) {}

      // Check for legacy schema and drop to trigger rebuild of corrected schemas
      try {
        const hasLegacyTask = await dbInstance.get("SELECT 1 FROM sqlite_master WHERE type='table' AND name='kam_tasks' AND sql LIKE '%mentor_id%'");
        if (hasLegacyTask) {
          await dbInstance.exec("DROP TABLE IF EXISTS kam_tasks;");
        }
      } catch (_) {}

      try {
        const hasLegacyIssue = await dbInstance.get("SELECT 1 FROM sqlite_master WHERE type='table' AND name='campus_issues' AND sql LIKE '%reported_by%'");
        if (hasLegacyIssue) {
          await dbInstance.exec("DROP TABLE IF EXISTS campus_issues;");
        }
      } catch (_) {}

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
      end_year TEXT
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

    CREATE TABLE IF NOT EXISTS student_fees (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL,
      college_id TEXT NOT NULL,
      term_name TEXT NOT NULL,
      amount REAL NOT NULL,
      paid_amount REAL DEFAULT 0,
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
  `);

  try {
    await dbInstance.exec(`ALTER TABLE subjects ADD COLUMN subject_group TEXT;`);
  } catch (_) {}

  try {
    await dbInstance.exec(`ALTER TABLE mentors ADD COLUMN subject_group TEXT;`);
  } catch (_) {}

  // Migrations for kam_tasks table
  try {
    await dbInstance.exec(`ALTER TABLE kam_tasks ADD COLUMN collegeId TEXT;`);
  } catch (_) {}
  try {
    await dbInstance.exec(`ALTER TABLE kam_tasks ADD COLUMN priority TEXT NOT NULL DEFAULT 'medium';`);
  } catch (_) {}
  try {
    await dbInstance.exec(`ALTER TABLE kam_tasks ADD COLUMN status TEXT NOT NULL DEFAULT 'pending';`);
  } catch (_) {}
  try {
    await dbInstance.exec(`ALTER TABLE kam_tasks ADD COLUMN dueDate TEXT NOT NULL DEFAULT '';`);
  } catch (_) {}
  try {
    await dbInstance.exec(`ALTER TABLE kam_tasks ADD COLUMN created_at TEXT DEFAULT CURRENT_TIMESTAMP;`);
  } catch (_) {}

  // Migrations for campus_issues table
  try {
    await dbInstance.exec(`ALTER TABLE campus_issues ADD COLUMN collegeId TEXT;`);
  } catch (_) {}
  try {
    await dbInstance.exec(`ALTER TABLE campus_issues ADD COLUMN collegeName TEXT;`);
  } catch (_) {}
  try {
    await dbInstance.exec(`ALTER TABLE campus_issues ADD COLUMN escalated INTEGER DEFAULT 0;`);
  } catch (_) {}
  try {
    await dbInstance.exec(`ALTER TABLE campus_issues ADD COLUMN escalatedAt TEXT;`);
  } catch (_) {}
  try {
    await dbInstance.exec(`ALTER TABLE campus_issues ADD COLUMN resolvedAt TEXT;`);
  } catch (_) {}
  try {
    await dbInstance.exec(`ALTER TABLE campus_issues ADD COLUMN type TEXT;`);
  } catch (_) {}
  try {
    await dbInstance.exec(`ALTER TABLE campus_issues ADD COLUMN priority TEXT;`);
  } catch (_) {}
  try {
    await dbInstance.exec(`ALTER TABLE campus_issues ADD COLUMN desc TEXT;`);
  } catch (_) {}
  try {
    await dbInstance.exec(`ALTER TABLE campus_issues ADD COLUMN status TEXT DEFAULT 'pending';`);
  } catch (_) {}
  try {
    await dbInstance.exec(`ALTER TABLE campus_issues ADD COLUMN created_at TEXT DEFAULT CURRENT_TIMESTAMP;`);
  } catch (_) {}

  const groupCount = await dbInstance.get("SELECT COUNT(*) as count FROM subject_groups");
  if (!groupCount || groupCount.count === 0) {
    await dbInstance.run("INSERT OR IGNORE INTO subject_groups (id, name, description) VALUES ('g1', 'English', 'English communication and vocabulary training.')");
    await dbInstance.run("INSERT OR IGNORE INTO subject_groups (id, name, description) VALUES ('g2', 'Aptitude', 'Quantitative Aptitude, logical reasoning, and puzzle solving.')");
    await dbInstance.run("INSERT OR IGNORE INTO subject_groups (id, name, description) VALUES ('g3', 'Soft Skills', 'Presentation skills, resume building, and interview prep.')");
    await dbInstance.run("INSERT OR IGNORE INTO subject_groups (id, name, description) VALUES ('g4', 'Technical', 'Programming, data structures, and computer science courses.')");
    await dbInstance.run("INSERT OR IGNORE INTO subject_groups (id, name, description) VALUES ('g5', 'General', 'Miscellaneous or general stream curriculum.')");
  }

    const adminCount = await dbInstance.get("SELECT COUNT(*) as count FROM admin_users");
    if (!adminCount || adminCount.count === 0) {
      await dbInstance.run(
        "INSERT OR IGNORE INTO admin_users (id, name, email) VALUES ('admin_thanush', 'Thanush', 'Thanush@faceprep.in')"
      );
      await dbInstance.run(
        "INSERT OR IGNORE INTO users (id, email, password_hash, role, reference_id, created_at, updated_at) VALUES ('admin_thanush', 'thanush@faceprep.in', 'Thanush@24', 'admin', 'admin_thanush', datetime('now'), datetime('now'))"
      );
    }

    await dbInstance.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY
      );
    `);

    const versionRow = await dbInstance.get("SELECT version FROM schema_migrations LIMIT 1");
    const currentVersion = versionRow ? versionRow.version : 0;

    if (currentVersion < 1) {
      try {
        await dbInstance.exec(`ALTER TABLE subjects ADD COLUMN college_id TEXT;`);
      } catch (_) {
        // Column already exists — safe to ignore
      }

  try {
    await dbInstance.exec(`ALTER TABLE colleges ADD COLUMN rooms TEXT;`);
  } catch (_) {}
  try {
    await dbInstance.exec(`ALTER TABLE colleges ADD COLUMN code TEXT;`);
  } catch (_) {}
  try {
    await dbInstance.exec(`ALTER TABLE colleges ADD COLUMN academic_year TEXT;`);
  } catch (_) {}
  try {
    await dbInstance.exec(`ALTER TABLE colleges ADD COLUMN manager TEXT;`);
  } catch (_) {}


  try {
    await dbInstance.exec(`ALTER TABLE courses ADD COLUMN default_room TEXT;`);
  } catch (_) {
    // Column already exists
  }

  try {
    await dbInstance.exec(`ALTER TABLE courses ADD COLUMN default_shift TEXT;`);
  } catch (_) {
    // Column already exists
  }

  try {
    await dbInstance.exec(`ALTER TABLE subjects ADD COLUMN year TEXT;`);
  } catch (_) {
    // Column already exists — safe to ignore
  }

  try {
    await dbInstance.exec(`ALTER TABLE departments ADD COLUMN college_id TEXT;`);
  } catch (_) {
    // Column already exists — safe to ignore
  }

  try {
    await dbInstance.exec(`ALTER TABLE departments ADD COLUMN code TEXT;`);
  } catch (_) {
    // Column already exists — safe to ignore
  }

  try {
    await dbInstance.exec(`ALTER TABLE approved_handovers ADD COLUMN course TEXT;`);
  } catch (_) {
    // Column already exists — safe to ignore
  }

  try {
    await dbInstance.exec(`ALTER TABLE departments ADD COLUMN description TEXT;`);
  } catch (_) {
    // Column already exists — safe to ignore
  }

  try {
    await dbInstance.exec(`ALTER TABLE departments ADD COLUMN hod_name TEXT;`);
  } catch (_) {
    // Column already exists — safe to ignore
  }

  try {
    await dbInstance.exec(`ALTER TABLE departments ADD COLUMN established_year TEXT;`);
  } catch (_) {
    // Column already exists — safe to ignore
  }

  try {
    await dbInstance.exec(`ALTER TABLE departments ADD COLUMN status TEXT DEFAULT 'Active';`);
  } catch (_) {
    // Column already exists — safe to ignore
  }

  try {
    await dbInstance.exec(`ALTER TABLE departments ADD COLUMN years INTEGER DEFAULT 4;`);
  } catch (_) {
    // Column already exists — safe to ignore
  }

  try {
    await dbInstance.exec(`ALTER TABLE departments ADD COLUMN start_year TEXT;`);
  } catch (_) {
    // Column already exists — safe to ignore
  }

  try {
    await dbInstance.exec(`ALTER TABLE departments ADD COLUMN end_year TEXT;`);
  } catch (_) {
    // Column already exists — safe to ignore
  }

  try {
    await dbInstance.exec(`ALTER TABLE subjects ADD COLUMN weekly_hours INTEGER DEFAULT 4;`);
  } catch (_) {
    // Column already exists — safe to ignore
  }

  // Slots table migrations for new columns
  try {
    await dbInstance.exec(`ALTER TABLE slots ADD COLUMN semester TEXT;`);
  } catch (_) {
    // Column already exists
  }
  try {
    await dbInstance.exec(`ALTER TABLE slots ADD COLUMN year TEXT;`);
  } catch (_) {
    // Column already exists
  }
  try {
    await dbInstance.exec(`ALTER TABLE slots ADD COLUMN department TEXT;`);
  } catch (_) {
    // Column already exists
  }

  // Handover requests and approved handovers migrations
  try {
    await dbInstance.exec(`ALTER TABLE handover_requests ADD COLUMN original_subject TEXT;`);
  } catch (_) {}
  try {
    await dbInstance.exec(`ALTER TABLE handover_requests ADD COLUMN original_month TEXT;`);
  } catch (_) {}
  try {
    await dbInstance.exec(`ALTER TABLE approved_handovers ADD COLUMN ledger_month TEXT;`);
  } catch (_) {}

  // Populate year field if empty based on semester values
  try {
    await dbInstance.run(`
      UPDATE subjects 
      SET year = 'Year 1' 
      WHERE (year IS NULL OR year = '') AND semester IN ('Semester 1', 'Semester 2')
    `);
    await dbInstance.run(`
      UPDATE subjects 
      SET year = 'Year 2' 
      WHERE (year IS NULL OR year = '') AND semester IN ('Semester 3', 'Semester 4')
    `);
    await dbInstance.run(`
      UPDATE subjects 
      SET year = 'Year 3' 
      WHERE (year IS NULL OR year = '') AND semester IN ('Semester 5', 'Semester 6')
    `);
    await dbInstance.run(`
      UPDATE subjects 
      SET year = 'Year 4' 
      WHERE (year IS NULL OR year = '') AND semester IN ('Semester 7', 'Semester 8')
    `);
  } catch (err) {
    console.error("Migration error populating year values:", err);
  }

  // Attendance management and correction migrations
  try {
    await dbInstance.exec(`ALTER TABLE colleges ADD COLUMN working_days INTEGER DEFAULT 5;`);
  } catch (_) {}
  try {
    await dbInstance.exec(`ALTER TABLE campus_daily_configs ADD COLUMN session_mode TEXT DEFAULT 'Offline';`);
  } catch (_) {}
  try {
    await dbInstance.exec(`ALTER TABLE students ADD COLUMN correction_count INTEGER DEFAULT 0;`);
  } catch (_) {}
  try {
    await dbInstance.exec(`ALTER TABLE student_attendance ADD COLUMN type TEXT DEFAULT 'Regular';`);
  } catch (_) {}
  try {
    await dbInstance.exec(`ALTER TABLE student_attendance ADD COLUMN mode TEXT DEFAULT 'Offline';`);
  } catch (_) {}
  try {
    await dbInstance.exec(`ALTER TABLE student_attendance ADD COLUMN attendanceTypeSub TEXT;`);
  } catch (_) {}
  try {
    await dbInstance.exec(`ALTER TABLE audit_logs ADD COLUMN old_status TEXT;`);
  } catch (_) {}
  try {
    await dbInstance.exec(`ALTER TABLE audit_logs ADD COLUMN new_status TEXT;`);
  } catch (_) {}
  try {
    await dbInstance.exec(`ALTER TABLE audit_logs ADD COLUMN reason TEXT;`);
  } catch (_) {}
  try {
    await dbInstance.exec(`ALTER TABLE audit_logs ADD COLUMN changed_by TEXT;`);
  } catch (_) {}

  // Populate college_id in departments based on name
  try {
    await dbInstance.run(`
      UPDATE departments 
      SET college_id = 'college_2' 
      WHERE (college_id IS NULL OR college_id = '') 
        AND (LOWER(name) LIKE '%management%' OR LOWER(name) LIKE '%fashion%')
    `);
    await dbInstance.run(`
      UPDATE departments 
      SET college_id = 'college_1' 
      WHERE (college_id IS NULL OR college_id = '')
    `);
  } catch (err) {
    console.error("Migration error populating departments college_id:", err);
  }

  // Populate slots table columns if empty
  try {
    const emptySlots = await dbInstance.all(
      "SELECT id, classGroup, shift FROM slots WHERE semester IS NULL OR semester = '' OR year IS NULL OR year = '' OR department IS NULL OR department = ''"
    );
    if (emptySlots.length > 0) {
      console.log(`Backfilling ${emptySlots.length} slots...`);
      for (const slot of emptySlots) {
        if (slot.classGroup) {
          const { department: dept, semester: sem, year: yr } = await resolveClassGroupDetails(dbInstance, slot.classGroup);
          
          let mShift = slot.shift;
          if (slot.classGroup.toLowerCase().includes("shift 1") || slot.classGroup.toLowerCase().includes("shift_1")) {
            mShift = "shift_1";
          } else if (slot.classGroup.toLowerCase().includes("shift 2") || slot.classGroup.toLowerCase().includes("shift_2")) {
            mShift = "shift_2";
          }

          await dbInstance.run(
            "UPDATE slots SET semester = ?, year = ?, department = ?, shift = ? WHERE id = ?",
            [sem, yr, dept, mShift, slot.id]
          );
        }
      }
      console.log("Backfill complete.");
    }
  } catch (err) {
    console.error("Migration error populating slots columns:", err);
  }

  // Migrations for students and slots batch fields expansion
  try {
    await dbInstance.exec(`ALTER TABLE slots ADD COLUMN batch_start_year INTEGER;`);
  } catch (_) {}
  try {
    await dbInstance.exec(`ALTER TABLE slots ADD COLUMN batch_end_year INTEGER;`);
  } catch (_) {}

  try {
    await dbInstance.exec(`ALTER TABLE students ADD COLUMN batch_start_year INTEGER;`);
  } catch (_) {}
  try {
    await dbInstance.exec(`ALTER TABLE students ADD COLUMN batch_end_year INTEGER;`);
  } catch (_) {}
  try {
    await dbInstance.exec(`ALTER TABLE students ADD COLUMN semester TEXT;`);
  } catch (_) {}
  try {
    await dbInstance.exec(`ALTER TABLE students ADD COLUMN shift TEXT;`);
  } catch (_) {}

  // Backfill students table batch columns if empty
  try {
    const emptyStudents = await dbInstance.all(
      "SELECT id, classGroup FROM students WHERE batch_start_year IS NULL OR semester IS NULL"
    );
    if (emptyStudents.length > 0) {
      console.log(`Backfilling ${emptyStudents.length} students...`);
      for (const st of emptyStudents) {
        if (st.classGroup) {
          const { startYear, endYear, semester, shift } = parseClassGroupDetails(st.classGroup);
          await dbInstance.run(
            "UPDATE students SET batch_start_year = ?, batch_end_year = ?, semester = ?, shift = ? WHERE id = ?",
            [startYear, endYear, semester, shift, st.id]
          );
        }
      }
    }
  } catch (err) {
    console.error("Migration error populating students columns:", err);
  }

  // Backfill slots table batch columns if empty
  try {
    const emptySlotsBatch = await dbInstance.all(
      "SELECT id, classGroup FROM slots WHERE batch_start_year IS NULL"
    );
    if (emptySlotsBatch.length > 0) {
      console.log(`Backfilling batch years for ${emptySlotsBatch.length} slots...`);
      for (const slot of emptySlotsBatch) {
        if (slot.classGroup) {
          const { startYear, endYear } = parseClassGroupDetails(slot.classGroup);
          await dbInstance.run(
            "UPDATE slots SET batch_start_year = ?, batch_end_year = ? WHERE id = ?",
            [startYear, endYear, slot.id]
          );
        }
      }
    }
  } catch (err) {
    console.error("Migration error populating slots batch years:", err);
  }

  // 13. Migration: Add extended fields to mentors
  try {
    await dbInstance.exec(`ALTER TABLE mentors ADD COLUMN employee_id TEXT;`);
  } catch (_) {}
  try {
    await dbInstance.exec(`ALTER TABLE mentors ADD COLUMN phone TEXT;`);
  } catch (_) {}
  try {
    await dbInstance.exec(`ALTER TABLE mentors ADD COLUMN qualification TEXT;`);
  } catch (_) {}
  try {
    await dbInstance.exec(`ALTER TABLE mentors ADD COLUMN experience TEXT;`);
  } catch (_) {}
  try {
    await dbInstance.exec(`ALTER TABLE mentors ADD COLUMN specialization TEXT;`);
  } catch (_) {}
  try {
    await dbInstance.exec(`ALTER TABLE mentors ADD COLUMN designation TEXT;`);
  } catch (_) {}
  try {
    await dbInstance.exec(`ALTER TABLE mentors ADD COLUMN joining_date TEXT;`);
  } catch (_) {}
  try {
    await dbInstance.exec(`ALTER TABLE mentors ADD COLUMN status TEXT DEFAULT 'Active';`);
  } catch (_) {}
  try {
    await dbInstance.exec(`ALTER TABLE mentors ADD COLUMN password_hash TEXT;`);
  } catch (_) {}
  try {
    await dbInstance.exec(`ALTER TABLE mentors ADD COLUMN last_login TEXT;`);
  } catch (_) {}
  try {
    await dbInstance.exec(`ALTER TABLE mentors ADD COLUMN created_at TEXT;`);
  } catch (_) {}
  try {
    await dbInstance.exec(`ALTER TABLE mentors ADD COLUMN updated_at TEXT;`);
  } catch (_) {}

  // 14. Migration: Add extended fields to students
  try {
    await dbInstance.exec(`ALTER TABLE students ADD COLUMN register_number TEXT;`);
  } catch (_) {}
  try {
    await dbInstance.exec(`ALTER TABLE students ADD COLUMN roll_number TEXT;`);
  } catch (_) {}
  try {
    await dbInstance.exec(`ALTER TABLE students ADD COLUMN avatar TEXT;`);
  } catch (_) {}
  try {
    await dbInstance.exec(`ALTER TABLE students ADD COLUMN phone TEXT;`);
  } catch (_) {}
  try {
    await dbInstance.exec(`ALTER TABLE students ADD COLUMN gender TEXT;`);
  } catch (_) {}
  try {
    await dbInstance.exec(`ALTER TABLE students ADD COLUMN dob TEXT;`);
  } catch (_) {}
  try {
    await dbInstance.exec(`ALTER TABLE students ADD COLUMN address TEXT;`);
  } catch (_) {}
  try {
    await dbInstance.exec(`ALTER TABLE students ADD COLUMN guardian_name TEXT;`);
  } catch (_) {}
  try {
    await dbInstance.exec(`ALTER TABLE students ADD COLUMN guardian_phone TEXT;`);
  } catch (_) {}
  try {
    await dbInstance.exec(`ALTER TABLE students ADD COLUMN admission_date TEXT;`);
  } catch (_) {}
  try {
    await dbInstance.exec(`ALTER TABLE students ADD COLUMN password_hash TEXT;`);
  } catch (_) {}
  try {
    await dbInstance.exec(`ALTER TABLE students ADD COLUMN status TEXT DEFAULT 'Active';`);
  } catch (_) {}
  try {
    await dbInstance.exec(`ALTER TABLE students ADD COLUMN last_login TEXT;`);
  } catch (_) {}
  try {
    await dbInstance.exec(`ALTER TABLE students ADD COLUMN created_at TEXT;`);
  } catch (_) {}
  try {
    await dbInstance.exec(`ALTER TABLE students ADD COLUMN updated_at TEXT;`);
  } catch (_) {}
  try {
    await dbInstance.exec(`ALTER TABLE students ADD COLUMN tenth_mark TEXT;`);
  } catch (_) {}
  try {
    await dbInstance.exec(`ALTER TABLE students ADD COLUMN eleventh_mark TEXT;`);
  } catch (_) {}
  try {
    await dbInstance.exec(`ALTER TABLE students ADD COLUMN twelfth_mark TEXT;`);
  } catch (_) {}
  try {
    await dbInstance.exec(`ALTER TABLE students ADD COLUMN academic_group TEXT;`);
  } catch (_) {}
  try {
    await dbInstance.exec(`ALTER TABLE students ADD COLUMN medium TEXT;`);
  } catch (_) {}
  try {
    await dbInstance.exec(`ALTER TABLE students ADD COLUMN blood_group TEXT;`);
  } catch (_) {}
  try {
    await dbInstance.exec(`ALTER TABLE students ADD COLUMN parent_phone TEXT;`);
  } catch (_) {}
  try {
    await dbInstance.exec(`ALTER TABLE students ADD COLUMN aadhar_number TEXT;`);
  } catch (_) {}
  try {
    await dbInstance.exec(`ALTER TABLE students ADD COLUMN linkedin_link TEXT;`);
  } catch (_) {}
  try {
    await dbInstance.exec(`ALTER TABLE students ADD COLUMN github_id TEXT;`);
  } catch (_) {}
  try {
    await dbInstance.exec(`ALTER TABLE students ADD COLUMN project_drive_link TEXT;`);
  } catch (_) {}
  try {
    await dbInstance.exec(`ALTER TABLE students ADD COLUMN hackerrank_link TEXT;`);
  } catch (_) {}
  try {
    await dbInstance.exec(`ALTER TABLE students ADD COLUMN leetcode_link TEXT;`);
  } catch (_) {}
  try {
    await dbInstance.exec(`ALTER TABLE students ADD COLUMN figma_link TEXT;`);
  } catch (_) {}

  // 15. Centralized users table backfill migration
  try {
    // 1. Insert Admins
    const admins = await dbInstance.all("SELECT id, name, email FROM admin_users");
    for (const admin of admins) {
      await dbInstance.run(
        "INSERT OR IGNORE INTO users (id, email, password_hash, role, reference_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [admin.id, admin.email, 'password123', 'admin', admin.id, new Date().toISOString(), new Date().toISOString()]
      );
    }

    // 2. Insert KAMs
    const kams = await dbInstance.all("SELECT id, name, email FROM kam_users");
    for (const kam of kams) {
      await dbInstance.run(
        "INSERT OR IGNORE INTO users (id, email, password_hash, role, reference_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [kam.id, kam.email, 'password123', 'kam', kam.id, new Date().toISOString(), new Date().toISOString()]
      );
    }

    // 3. Insert CAMs
    const cams = await dbInstance.all("SELECT id, name, email FROM campus_managers");
    for (const cam of cams) {
      await dbInstance.run(
        "INSERT OR IGNORE INTO users (id, email, password_hash, role, reference_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [cam.id, cam.email, 'password123', 'cam', cam.id, new Date().toISOString(), new Date().toISOString()]
      );
    }

    // 5. Insert Mentors
    const mentors = await dbInstance.all("SELECT id, name, email FROM mentors");
    for (const m of mentors) {
      await dbInstance.run(
        "INSERT OR IGNORE INTO users (id, email, password_hash, role, reference_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [m.id, m.email, 'password123', 'mentor', m.id, new Date().toISOString(), new Date().toISOString()]
      );
    }

    // 6. Insert Students
    const students = await dbInstance.all("SELECT id, name, email FROM students");
    for (const st of students) {
      await dbInstance.run(
        "INSERT OR IGNORE INTO users (id, email, password_hash, role, reference_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [st.id, st.email, 'password123', 'student', st.id, new Date().toISOString(), new Date().toISOString()]
      );
    }
  } catch (err) {
    console.error("Migration error populating users table:", err);
  }

  // Migrate existing departments from subjects if empty
  try {
    const row = await dbInstance.get("SELECT COUNT(*) as count FROM departments");
    if (row && row.count === 0) {
      const existingDepts = await dbInstance.all(`
        SELECT DISTINCT department FROM subjects WHERE department IS NOT NULL AND department != ''
      `);
      for (const d of existingDepts) {
        if (d.department) {
          const cleanName = d.department.trim();
          const deptId = "dept_" + cleanName.toLowerCase().replace(/[^a-z0-9]/g, "_").replace(/_+/g, "_");
          const cleanDeptLower = cleanName.toLowerCase();
          const collegeId = (cleanDeptLower.includes("management") || cleanDeptLower.includes("fashion"))
            ? "college_2"
            : "college_1";

          await dbInstance.run(
            "INSERT OR IGNORE INTO departments (id, name, college_id) VALUES (?, ?, ?)",
            deptId,
            cleanName,
            collegeId
          );
        }
      }
    }
  } catch (err) {
    console.error("Migration error for departments:", err);
  }

  // 16. Migration: Swap-to-Compensate columns on handover_requests
  try {
    await dbInstance.exec(`ALTER TABLE handover_requests ADD COLUMN request_type TEXT DEFAULT 'handover';`);
  } catch (_) {
    // Column already exists — safe to ignore
  }
  try {
    await dbInstance.exec(`ALTER TABLE handover_requests ADD COLUMN compensates_handover_id TEXT;`);
  } catch (_) {
    // Column already exists — safe to ignore
  }

      await dbInstance.run("INSERT OR REPLACE INTO schema_migrations (version) VALUES (1);");
    }

    try {
      await dbInstance.exec(`ALTER TABLE student_fees ADD COLUMN fpc_amount REAL DEFAULT 0;`);
    } catch (_) {}
    try {
      await dbInstance.exec(`ALTER TABLE student_fees ADD COLUMN fpc_pending REAL DEFAULT 0;`);
    } catch (_) {}
    try {
      await dbInstance.exec(`ALTER TABLE student_fees ADD COLUMN academic_year TEXT;`);
    } catch (_) {}

    if (currentVersion < 2) {
      try {
        await dbInstance.exec(`ALTER TABLE courses ADD COLUMN shift_based INTEGER DEFAULT 0;`);
      } catch (_) {}
      try {
        await dbInstance.exec(`ALTER TABLE departments ADD COLUMN shift_based INTEGER DEFAULT 0;`);
      } catch (_) {}
      await dbInstance.run("INSERT OR REPLACE INTO schema_migrations (version) VALUES (2);");
    }

    if (currentVersion < 3) {
      try {
        await dbInstance.exec(`ALTER TABLE slots ADD COLUMN college_id TEXT;`);
      } catch (_) {}
      try {
        await dbInstance.exec(`
          UPDATE slots
          SET college_id = (
            SELECT college_id FROM mentors WHERE mentors.id = slots.mentorId
          )
          WHERE college_id IS NULL;
        `);
        await dbInstance.exec(`
          UPDATE slots SET college_id = 'college_1' WHERE college_id IS NULL;
        `);
      } catch (err) {
        console.error("Migration error populating slots college_id:", err);
      }
      await dbInstance.run("INSERT OR REPLACE INTO schema_migrations (version) VALUES (3);");
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
  const cgNorm = normalize(cgLower);

  // Try to match with exact name
  for (const deptName of allCourseNames) {
    const deptNorm = normalize(deptName);
    if (cgNorm.includes(deptNorm)) {
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
      if (cgNorm.includes(codeNorm)) {
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

      if (abbreviation && cgNorm.includes(abbreviation)) {
        resolvedDept = deptName;
        break;
      }
    }
  }

  // Fallback to splitting
  if (!resolvedDept) {
    resolvedDept = cleanCG.split("-")[0].split("(")[0].trim();
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
  // Fetch all mentors
  const mentors = await db.all("SELECT id, subjects, department FROM mentors");
  // Fetch all subjects that are mapped to a subject_group
  const subjects = await db.all("SELECT name, subject_group FROM subjects WHERE subject_group IS NOT NULL AND subject_group != ''");

  for (const mentor of mentors) {
    const mentorSubjects = (mentor.subjects || "")
      .split(/[\n,\r]/)
      .map((s: string) => s.trim().toLowerCase())
      .filter((s: string) => s.length > 0);

    let matchedGroup = null;
    for (const sub of subjects) {
      if (
        mentorSubjects.some(
          (ms: string) =>
            ms === sub.name.toLowerCase() ||
            sub.name.toLowerCase().includes(ms) ||
            ms.includes(sub.name.toLowerCase())
        )
      ) {
        matchedGroup = sub.subject_group;
        break;
      }
    }

    // Fallback: If no match from subjects, determine by department
    if (!matchedGroup && mentor.department) {
      const deptLower = mentor.department.toLowerCase();
      if (deptLower.includes("tamil")) {
        matchedGroup = "Tamil";
      } else if (deptLower.includes("english")) {
        matchedGroup = "English";
      } else if (deptLower.includes("computer") || deptLower.includes("data") || deptLower.includes("cs") || deptLower.includes("science")) {
        matchedGroup = "Technical";
      } else if (deptLower.includes("math") || deptLower.includes("aptitude")) {
        matchedGroup = "Aptitude";
      } else if (deptLower.includes("management") || deptLower.includes("commerce") || deptLower.includes("business")) {
        matchedGroup = "General";
      }
    }

    if (matchedGroup) {
      // Ensure the subject group exists in the subject_groups table
      const groupExists = await db.get("SELECT name FROM subject_groups WHERE LOWER(name) = ?", matchedGroup.toLowerCase());
      if (!groupExists) {
        const newGroupId = "g_" + matchedGroup.toLowerCase().replace(/[^a-z]/g, "");
        await db.run("INSERT OR IGNORE INTO subject_groups (id, name, description) VALUES (?, ?, ?)", [newGroupId, matchedGroup, `${matchedGroup} Group`]);
      }

      await db.run("UPDATE mentors SET subject_group = ? WHERE id = ?", [matchedGroup, mentor.id]);
    } else {
      await db.run("UPDATE mentors SET subject_group = NULL WHERE id = ?", [mentor.id]);
    }
  }
}

