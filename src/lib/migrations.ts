import { getDb, PostgresDbAdapter } from "@/lib/db";

/**
 * Centralized runtime migration runner (API_OPTIMIZATION_PLAN item 11).
 *
 * Each migration runs AT MOST ONCE per process (module-level promise cache) —
 * replacing the old pattern of running CREATE TABLE / ALTER TABLE on every
 * request, which wasted latency and risked racing cold-start deadlocks.
 *
 * Migrations are idempotent (`IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS`) so
 * the first request on any deployment converges the schema safely.
 */

type Migration = {
  name: string;
  run: (db: PostgresDbAdapter) => Promise<void>;
};

const migrations: Migration[] = [
  {
    name: "audit_logs_extended_columns",
    run: async (db) => {
      const isPg = (db as any).isPostgres;
      if (isPg) {
        await db.exec(`
          ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS old_status TEXT;
          ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS new_status TEXT;
          ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS reason TEXT;
          ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS changed_by TEXT;
        `).catch(() => {});
      } else {
        for (const col of ["old_status", "new_status", "reason", "changed_by"]) {
          await db.exec(`ALTER TABLE audit_logs ADD COLUMN ${col} TEXT;`).catch(() => {});
        }
      }
    }
  },
  {
    name: "mentor_nps_monthly_cache",
    run: async (db) => {
      await db.exec(`
        CREATE TABLE IF NOT EXISTS mentor_nps_monthly (
          id SERIAL PRIMARY KEY,
          college_name TEXT NOT NULL,
          month_key TEXT NOT NULL,
          nps_index INTEGER,
          promoters INTEGER DEFAULT 0,
          passives INTEGER DEFAULT 0,
          detractors INTEGER DEFAULT 0,
          total_responses INTEGER DEFAULT 0,
          avg_rating NUMERIC,
          mentor_count INTEGER DEFAULT 0,
          payload TEXT,
          synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE (college_name, month_key)
        );
      `);
    }
  },
  {
    name: "student_interview_slots_table",
    run: async (db) => {
      await db.exec(`
        CREATE TABLE IF NOT EXISTS student_interview_slots (
          id VARCHAR(255) PRIMARY KEY,
          interview_id VARCHAR(255) NOT NULL,
          allocation_id VARCHAR(255) NOT NULL,
          student_id VARCHAR(255),
          student_name VARCHAR(255),
          mentor_id VARCHAR(255) NOT NULL,
          mentor_name VARCHAR(255) NOT NULL,
          college_id VARCHAR(255) NOT NULL,
          slot_start_time VARCHAR(100) NOT NULL,
          slot_end_time VARCHAR(100) NOT NULL,
          status VARCHAR(100) DEFAULT 'scheduled',
          subject VARCHAR(255),
          target_date VARCHAR(50),
          gmeet_link TEXT,
          gcal_link TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
    }
  },
  {
    name: "student_interviews_columns",
    run: async (db) => {
      const stmts = [
        "ALTER TABLE student_interviews ADD COLUMN IF NOT EXISTS assigned_mentor_ids TEXT",
        "ALTER TABLE student_interviews ADD COLUMN IF NOT EXISTS accepted_capacity INTEGER DEFAULT 0",
        "ALTER TABLE student_interviews ADD COLUMN IF NOT EXISTS allocated_students INTEGER DEFAULT 0",
        "ALTER TABLE student_interviews ADD COLUMN IF NOT EXISTS remaining_students INTEGER DEFAULT 0",
        "ALTER TABLE student_interviews ADD COLUMN IF NOT EXISTS preferred_start_time VARCHAR(100) DEFAULT '09:00 AM'",
        "ALTER TABLE student_interviews ADD COLUMN IF NOT EXISTS gmeet_link TEXT",
        "ALTER TABLE student_interview_slots ADD COLUMN IF NOT EXISTS gmeet_link TEXT",
        "ALTER TABLE student_interview_slots ADD COLUMN IF NOT EXISTS gcal_link TEXT",
        "ALTER TABLE student_interview_slots ADD COLUMN IF NOT EXISTS subject VARCHAR(255)",
        "ALTER TABLE student_interview_slots ADD COLUMN IF NOT EXISTS target_date VARCHAR(50)",
      ];
      for (const sql of stmts) {
        await db.exec(sql).catch((err) => {
          console.warn(`[migrations] ${sql.slice(0, 60)}... failed:`, err?.message);
        });
      }
    }
  },
  {
    name: "sme_availability_table",
    run: async (db) => {
      await db.exec(`
        CREATE TABLE IF NOT EXISTS sme_availability (
          id TEXT PRIMARY KEY,
          sme_id TEXT NOT NULL,
          day_of_week TEXT NOT NULL,
          start_time TEXT NOT NULL,
          end_time TEXT NOT NULL,
          slot_type TEXT DEFAULT 'demo',
          is_active INTEGER DEFAULT 1,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
      `);
      await db.exec("ALTER TABLE sme_availability ADD COLUMN IF NOT EXISTS slot_type TEXT DEFAULT 'demo';").catch(() => {});
    }
  },
  {
    name: "sme_availability_seed",
    run: async (db) => {
      const countRes = await db.get("SELECT COUNT(*) as count FROM sme_availability");
      if (!countRes || Number(countRes.count) !== 0) return;
      const smes = await db.all("SELECT id FROM sme_users");
      for (const s of smes) {
        for (const d of ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]) {
          await db.run(
            "INSERT INTO sme_availability (id, sme_id, day_of_week, start_time, end_time, slot_type, is_active) VALUES (?, ?, ?, ?, ?, 'demo', 1)",
            [`sme_avail_${s.id}_${d.toLowerCase()}_1`, s.id, d, "09:00 AM", "05:30 PM"]
          ).catch(() => {});
        }
      }
    }
  },
  {
    name: "users_columns",
    run: async (db) => {
      const stmts = [
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT 0",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login TEXT DEFAULT NULL",
      ];
      for (const sql of stmts) {
        await db.exec(sql).catch((err) => {
          console.warn(`[migrations] ${sql.slice(0, 60)}... failed:`, err?.message);
        });
      }
    }
  },
  {
    // ROLE_UI_AUDIT T2: stable request-type marker so late-punch CAM approvals can
    // be matched without string-matching the free-text reason field.
    name: "feedback_reports_table",
    run: async (db) => {
      // Feedback submitted from the global "Send Feedback" modal in DashboardLayout.
      // Viewed/resolved in the Admin → Feedback tab.
      await db.exec(`
        CREATE TABLE IF NOT EXISTS feedback_reports (
          id VARCHAR(255) PRIMARY KEY,
          user_id VARCHAR(255),
          user_role VARCHAR(100),
          type VARCHAR(100),
          title TEXT,
          description TEXT,
          status VARCHAR(50) DEFAULT 'pending',
          admin_notes TEXT,
          resolved_by VARCHAR(255),
          resolved_at TEXT,
          created_at TEXT
        );
      `);
      const cols = [
        "ALTER TABLE feedback_reports ADD COLUMN IF NOT EXISTS admin_notes TEXT",
        "ALTER TABLE feedback_reports ADD COLUMN IF NOT EXISTS resolved_by VARCHAR(255)",
        "ALTER TABLE feedback_reports ADD COLUMN IF NOT EXISTS resolved_at TEXT",
        "ALTER TABLE feedback_reports ADD COLUMN IF NOT EXISTS user_name VARCHAR(255)",
        "ALTER TABLE feedback_reports ADD COLUMN IF NOT EXISTS college_id VARCHAR(255)",
        "ALTER TABLE feedback_reports ADD COLUMN IF NOT EXISTS college_name VARCHAR(255)",
        "ALTER TABLE feedback_reports ADD COLUMN IF NOT EXISTS department VARCHAR(255)",
        "ALTER TABLE feedback_reports ADD COLUMN IF NOT EXISTS register_number VARCHAR(255)",
        "ALTER TABLE feedback_reports ADD COLUMN IF NOT EXISTS contact_info VARCHAR(255)",
      ];
      for (const sql of cols) {
        await db.exec(sql).catch(() => {});
      }
      await db.exec("CREATE INDEX IF NOT EXISTS idx_feedback_reports_created ON feedback_reports(created_at DESC)").catch(() => {});
    }
  },
  {
    name: "handover_requests_request_type",
    run: async (db) => {
      await db.exec("ALTER TABLE handover_requests ADD COLUMN IF NOT EXISTS request_type TEXT DEFAULT NULL");
    }
  },
  {
    // Hot-path indexes (plan item 18) — verified against the role-scoped
    // queries in /api/data and the attendance routes.
    name: "hot_path_indexes",
    run: async (db) => {
      const stmts = [
        "CREATE INDEX IF NOT EXISTS idx_student_attendance_studentid ON student_attendance(studentId)",
        "CREATE INDEX IF NOT EXISTS idx_student_attendance_slotid ON student_attendance(slotId)",
        "CREATE INDEX IF NOT EXISTS idx_student_attendance_datestr ON student_attendance(dateStr)",
        "CREATE INDEX IF NOT EXISTS idx_student_attendance_student_date ON student_attendance(studentId, dateStr)",
        "CREATE INDEX IF NOT EXISTS idx_slots_mentorid ON slots(mentorId)",
        "CREATE INDEX IF NOT EXISTS idx_slots_college_id ON slots(college_id)",
        "CREATE INDEX IF NOT EXISTS idx_students_college_id ON students(college_id)",
        "CREATE INDEX IF NOT EXISTS idx_mentors_college_id ON mentors(college_id)",
        "CREATE INDEX IF NOT EXISTS idx_leave_requests_studentid ON leave_requests(studentId)",
        "CREATE INDEX IF NOT EXISTS idx_login_history_user_id ON login_history(user_id)",
      ];
      for (const sql of stmts) {
        await db.exec(sql).catch((err: any) => {
          console.warn(`[migrations] index failed: ${sql.slice(0, 70)}... (${err?.message})`);
        });
      }
    }
  }
];

const completed = new Set<string>();
const inFlight = new Map<string, Promise<void>>();

/** Runs one named migration once per process; safe to call on every request. */
export async function ensureMigration(name: string): Promise<void> {
  const migration = migrations.find(m => m.name === name);
  if (!migration) throw new Error(`Unknown migration: ${name}`);
  if (completed.has(name)) return;
  const existing = inFlight.get(name);
  if (existing) return existing;

  const p = (async () => {
    const db = await getDb();
    await migration.run(db);
    completed.add(name);
    inFlight.delete(name);
  })().catch(err => {
    inFlight.delete(name); // allow retry on next request
    throw err;
  });
  inFlight.set(name, p);
  return p;
}

/** Runs every migration once per process (used by high-traffic entry points). */
export async function runAllMigrations(): Promise<void> {
  for (const m of migrations) {
    try {
      await ensureMigration(m.name);
    } catch (err: any) {
      console.warn(`[migrations] ${m.name} failed:`, err?.message || err);
    }
  }
}
