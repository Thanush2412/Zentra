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
    name: "cm_attendance_and_leave_tables",
    run: async (db) => {
      await db.exec(`
        CREATE TABLE IF NOT EXISTS cm_attendance (
          id VARCHAR(255) PRIMARY KEY,
          cam_id VARCHAR(255) NOT NULL,
          college_id VARCHAR(255) NOT NULL,
          date_str VARCHAR(32) NOT NULL,
          status VARCHAR(64) NOT NULL,
          punch_in_time VARCHAR(32),
          punch_out_time VARCHAR(32),
          reason TEXT,
          approved_by VARCHAR(255),
          approval_status VARCHAR(32) DEFAULT 'pending',
          approval_notes TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE (cam_id, date_str)
        );

        CREATE TABLE IF NOT EXISTS cm_leave_requests (
          id VARCHAR(255) PRIMARY KEY,
          cam_id VARCHAR(255) NOT NULL,
          college_id VARCHAR(255) NOT NULL,
          kam_id VARCHAR(255),
          request_type VARCHAR(64) NOT NULL,
          start_date VARCHAR(32) NOT NULL,
          end_date VARCHAR(32) NOT NULL,
          start_time VARCHAR(32),
          end_time VARCHAR(32),
          reason TEXT NOT NULL,
          status VARCHAR(32) DEFAULT 'pending',
          approved_by VARCHAR(255),
          rejection_reason TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX IF NOT EXISTS idx_cm_att_cam_date ON cm_attendance(cam_id, date_str);
        CREATE INDEX IF NOT EXISTS idx_cm_att_college_date ON cm_attendance(college_id, date_str);
        CREATE INDEX IF NOT EXISTS idx_cm_leave_cam ON cm_leave_requests(cam_id);
        CREATE INDEX IF NOT EXISTS idx_cm_leave_kam ON cm_leave_requests(kam_id);
        CREATE INDEX IF NOT EXISTS idx_cm_leave_college ON cm_leave_requests(college_id);
        CREATE INDEX IF NOT EXISTS idx_cm_leave_status ON cm_leave_requests(status);
      `).catch((err: any) => {
        console.warn("[migrations] cm_attendance_and_leave_tables error:", err?.message || err);
      });
    }
  },
  {
    name: "student_achievements_table",
    run: async (db) => {
      const isPg = (db as any).isPostgres;
      await db.exec(`
        CREATE TABLE IF NOT EXISTS student_achievements (
          id VARCHAR(255) PRIMARY KEY,
          college_id VARCHAR(255) NOT NULL,
          title TEXT NOT NULL,
          topic TEXT,
          category VARCHAR(100) DEFAULT 'Hackathon & Competitions',
          description TEXT,
          date_str VARCHAR(50) NOT NULL,
          badge VARCHAR(100) DEFAULT 'Winner',
          reward_prize TEXT,
          event_name TEXT,
          proof_link TEXT,
          photos TEXT,
          student_ids TEXT,
          student_names TEXT,
          added_by VARCHAR(255) DEFAULT 'Campus Manager',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `).catch(() => {});

      if (isPg) {
        await db.exec("ALTER TABLE student_achievements ADD COLUMN IF NOT EXISTS topic TEXT;").catch(() => {});
        await db.exec("ALTER TABLE student_achievements ADD COLUMN IF NOT EXISTS participation_type TEXT DEFAULT 'individual';").catch(() => {});
        await db.exec("ALTER TABLE student_achievements ADD COLUMN IF NOT EXISTS team_name TEXT;").catch(() => {});
        await db.exec("ALTER TABLE student_achievements ADD COLUMN IF NOT EXISTS achievement_level TEXT DEFAULT 'National Level';").catch(() => {});
        await db.exec("ALTER TABLE student_achievements ADD COLUMN IF NOT EXISTS organizer TEXT;").catch(() => {});
      } else {
        await db.exec("ALTER TABLE student_achievements ADD COLUMN topic TEXT;").catch(() => {});
        await db.exec("ALTER TABLE student_achievements ADD COLUMN participation_type TEXT;").catch(() => {});
        await db.exec("ALTER TABLE student_achievements ADD COLUMN team_name TEXT;").catch(() => {});
        await db.exec("ALTER TABLE student_achievements ADD COLUMN achievement_level TEXT;").catch(() => {});
        await db.exec("ALTER TABLE student_achievements ADD COLUMN organizer TEXT;").catch(() => {});
      }

      await db.exec("CREATE INDEX IF NOT EXISTS idx_achieve_college ON student_achievements(college_id)").catch(() => {});
      await db.exec("CREATE INDEX IF NOT EXISTS idx_achieve_datestr ON student_achievements(date_str)").catch(() => {});
    }
  },
  {
    name: "academic_calendar_tables",
    run: async (db) => {
      const isPg = (db as any).isPostgres;
      await db.exec(`
        CREATE TABLE IF NOT EXISTS academic_years (
          year_name VARCHAR(100) PRIMARY KEY
        );
      `).catch(() => {});

      if (isPg) {
        await db.exec(`
          CREATE TABLE IF NOT EXISTS academic_events (
            id VARCHAR(255) PRIMARY KEY,
            name TEXT NOT NULL,
            date VARCHAR(50) NOT NULL,
            end_date VARCHAR(50),
            "desc" TEXT,
            category VARCHAR(100) DEFAULT 'Coding Fest & Hackathon',
            department VARCHAR(100) DEFAULT 'All Departments',
            audience VARCHAR(100) DEFAULT 'All Campus',
            status VARCHAR(50) DEFAULT 'Upcoming',
            venue TEXT,
            college_id VARCHAR(255),
            photos TEXT,
            coordinator TEXT,
            chief_guest TEXT,
            registration_link TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          );
          ALTER TABLE academic_events ADD COLUMN IF NOT EXISTS end_date VARCHAR(50);
          ALTER TABLE academic_events ADD COLUMN IF NOT EXISTS "desc" TEXT;
          ALTER TABLE academic_events ADD COLUMN IF NOT EXISTS category VARCHAR(100) DEFAULT 'Coding Fest & Hackathon';
          ALTER TABLE academic_events ADD COLUMN IF NOT EXISTS department VARCHAR(100) DEFAULT 'All Departments';
          ALTER TABLE academic_events ADD COLUMN IF NOT EXISTS audience VARCHAR(100) DEFAULT 'All Campus';
          ALTER TABLE academic_events ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'Upcoming';
          ALTER TABLE academic_events ADD COLUMN IF NOT EXISTS venue TEXT;
          ALTER TABLE academic_events ADD COLUMN IF NOT EXISTS college_id VARCHAR(255);
          ALTER TABLE academic_events ADD COLUMN IF NOT EXISTS photos TEXT;
          ALTER TABLE academic_events ADD COLUMN IF NOT EXISTS coordinator TEXT;
          ALTER TABLE academic_events ADD COLUMN IF NOT EXISTS chief_guest TEXT;
          ALTER TABLE academic_events ADD COLUMN IF NOT EXISTS registration_link TEXT;
        `).catch(() => {});
      } else {
        await db.exec(`
          CREATE TABLE IF NOT EXISTS academic_events (
            id VARCHAR(255) PRIMARY KEY,
            name TEXT NOT NULL,
            date VARCHAR(50) NOT NULL,
            end_date VARCHAR(50),
            "desc" TEXT,
            category VARCHAR(100) DEFAULT 'Coding Fest & Hackathon',
            department VARCHAR(100) DEFAULT 'All Departments',
            audience VARCHAR(100) DEFAULT 'All Campus',
            status VARCHAR(50) DEFAULT 'Upcoming',
            venue TEXT,
            college_id VARCHAR(255),
            photos TEXT,
            coordinator TEXT,
            chief_guest TEXT,
            registration_link TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          );
        `).catch(() => {});
        const addCols = [
          "ALTER TABLE academic_events ADD COLUMN end_date VARCHAR(50)",
          'ALTER TABLE academic_events ADD COLUMN "desc" TEXT',
          "ALTER TABLE academic_events ADD COLUMN category VARCHAR(100) DEFAULT 'Coding Fest & Hackathon'",
          "ALTER TABLE academic_events ADD COLUMN department VARCHAR(100) DEFAULT 'All Departments'",
          "ALTER TABLE academic_events ADD COLUMN audience VARCHAR(100) DEFAULT 'All Campus'",
          "ALTER TABLE academic_events ADD COLUMN status VARCHAR(50) DEFAULT 'Upcoming'",
          "ALTER TABLE academic_events ADD COLUMN venue TEXT",
          "ALTER TABLE academic_events ADD COLUMN college_id VARCHAR(255)",
          "ALTER TABLE academic_events ADD COLUMN photos TEXT",
          "ALTER TABLE academic_events ADD COLUMN coordinator TEXT",
          "ALTER TABLE academic_events ADD COLUMN chief_guest TEXT",
          "ALTER TABLE academic_events ADD COLUMN registration_link TEXT",
        ];
        for (const sql of addCols) {
          await db.exec(sql).catch(() => {});
        }
      }
      await db.exec("CREATE INDEX IF NOT EXISTS idx_ac_events_college ON academic_events(college_id)").catch(() => {});
      await db.exec("CREATE INDEX IF NOT EXISTS idx_ac_events_date ON academic_events(date)").catch(() => {});
    }
  },
  {
    // Weekly Plan ↔ Academic Tracker linkage: provenance columns on academic_tracker
    // so conduction entries created during attendance marking can be traced back to
    // the approved mentor weekly plan they verify.
    name: "academic_tracker_weekly_plan_link",
    run: async (db) => {
      const isPg = (db as any).isPostgres;
      if (isPg) {
        await db.exec(`
          ALTER TABLE academic_tracker ADD COLUMN IF NOT EXISTS weekly_plan_id TEXT;
          ALTER TABLE academic_tracker ADD COLUMN IF NOT EXISTS weekly_plan_week INTEGER;
        `).catch(() => {});
      } else {
        await db.exec("ALTER TABLE academic_tracker ADD COLUMN weekly_plan_id TEXT;").catch(() => {});
        await db.exec("ALTER TABLE academic_tracker ADD COLUMN weekly_plan_week INTEGER;").catch(() => {});
      }
    }
  },
  {
    // Mentor Skill Development Tracker: SME verdicts per mentor × skill subject
    // × week (scope = week | demo | topic). Demo-scope rows are auto-created when
    // an SME evaluates a demo in /api/demo-sessions ("cleared" when marks pass).
    name: "mentor_skill_clearances",
    run: async (db) => {
      await db.exec(`
        CREATE TABLE IF NOT EXISTS mentor_skill_clearances (
          id TEXT PRIMARY KEY,
          college_id TEXT,
          mentor_id TEXT NOT NULL,
          mentor_name TEXT,
          subject TEXT NOT NULL,
          subject_type TEXT DEFAULT 'Skill',
          week_number INTEGER NOT NULL,
          scope TEXT NOT NULL DEFAULT 'week',
          topic TEXT,
          demo_session_id TEXT,
          weekly_plan_id TEXT,
          status TEXT NOT NULL DEFAULT 'pending',
          score INTEGER,
          remarks TEXT,
          verified_by TEXT,
          verified_at TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT
        );
      `).catch(() => {});
      const cols = [
        "ALTER TABLE mentor_skill_clearances ADD COLUMN mentor_name TEXT",
        "ALTER TABLE mentor_skill_clearances ADD COLUMN subject_type TEXT DEFAULT 'Skill'",
        "ALTER TABLE mentor_skill_clearances ADD COLUMN weekly_plan_id TEXT",
        "ALTER TABLE mentor_skill_clearances ADD COLUMN updated_at TEXT"
      ];
      for (const sql of cols) {
        await db.exec(sql).catch(() => {});
      }
      await db.exec("CREATE INDEX IF NOT EXISTS idx_skill_clearances_mentor ON mentor_skill_clearances(mentor_id, subject, week_number)").catch(() => {});
      await db.exec("CREATE INDEX IF NOT EXISTS idx_skill_clearances_college ON mentor_skill_clearances(college_id)").catch(() => {});
    }
  },
  {
    // Leave-driven Demo Reallocation: when a mentor's leave overlaps a scheduled
    // demo, the mentor proposes a new period which is RESERVED (pending) until the
    // Allocator approves. Pending reservations block booking/reschedule of other
    // demos into the same (mentor, SME, date, slot). On approval, the demo_sessions
    // row is moved and the reservation is consumed.
    name: "demo_reallocation_requests",
    run: async (db) => {
      await db.exec(`
        CREATE TABLE IF NOT EXISTS demo_reallocation_requests (
          id TEXT PRIMARY KEY,
          demo_session_id TEXT NOT NULL,
          leave_request_id TEXT,
          mentor_id TEXT NOT NULL,
          mentor_name TEXT,
          sme_id TEXT,
          sme_name TEXT,
          subject TEXT,
          stream TEXT,
          week INTEGER,
          original_date_str TEXT NOT NULL,
          original_time_slot TEXT NOT NULL,
          proposed_date_str TEXT NOT NULL,
          proposed_time_slot TEXT NOT NULL,
          reason TEXT,
          status TEXT NOT NULL DEFAULT 'pending',
          proposed_by TEXT,
          decided_by TEXT,
          decided_at TEXT,
          decision_notes TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `).catch(() => {});
      await db.exec("CREATE INDEX IF NOT EXISTS idx_demo_realloc_status ON demo_reallocation_requests(status)").catch(() => {});
      await db.exec("CREATE INDEX IF NOT EXISTS idx_demo_realloc_session ON demo_reallocation_requests(demo_session_id)").catch(() => {});
      await db.exec("CREATE INDEX IF NOT EXISTS idx_demo_realloc_leave ON demo_reallocation_requests(leave_request_id)").catch(() => {});
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
  },
  {
    name: "campus_audits_tables",
    run: async (db) => {
      await db.exec(`
        CREATE TABLE IF NOT EXISTS campus_audits (
          id TEXT PRIMARY KEY,
          uid TEXT UNIQUE NOT NULL,
          college_id TEXT,
          campus TEXT NOT NULL,
          mentor_id TEXT,
          mentor_name TEXT NOT NULL,
          department TEXT,
          dept_name TEXT,
          subject TEXT NOT NULL,
          audit_date TEXT NOT NULL,
          auditor_name TEXT,
          auditor_role TEXT,
          
          -- Stage 2: Skill quality
          skill_criteria TEXT,
          skill_score INTEGER DEFAULT 0,
          tasks_assigned INTEGER DEFAULT 0,
          tasks_completed INTEGER DEFAULT 0,
          skill_proof_link TEXT,
          skill_remarks TEXT,
          
          -- Stage 3: Coursework delivery
          coursework_criteria TEXT,
          coursework_score INTEGER DEFAULT 0,
          coursework_remarks TEXT,
          
          -- Stage 4: Attendance integrity
          attendance_criteria TEXT,
          attendance_score INTEGER DEFAULT 0,
          below_75_count INTEGER DEFAULT 0,
          attendance_remarks TEXT,
          
          -- Peer Review Routing
          kam_id TEXT,
          kam_name TEXT,
          reviewer_college_id TEXT,
          reviewer_campus TEXT NOT NULL,
          reviewer_cm_name TEXT,
          peer_status TEXT NOT NULL DEFAULT 'Pending',
          peer_signoff_notes TEXT,
          peer_signed_by TEXT,
          peer_signed_at TEXT,
          
          overall_status TEXT NOT NULL DEFAULT 'In Progress',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

      const indexes = [
        "CREATE INDEX IF NOT EXISTS idx_campus_audits_college ON campus_audits(college_id)",
        "CREATE INDEX IF NOT EXISTS idx_campus_audits_campus ON campus_audits(campus)",
        "CREATE INDEX IF NOT EXISTS idx_campus_audits_reviewer_campus ON campus_audits(reviewer_campus)",
        "CREATE INDEX IF NOT EXISTS idx_campus_audits_peer_status ON campus_audits(peer_status)"
      ];
      for (const idx of indexes) {
        await db.exec(idx).catch(() => {});
      }
    }
  },
  {
    name: "demo_evaluation_criteria",
    run: async (db) => {
      await db.exec(`
        CREATE TABLE IF NOT EXISTS demo_evaluation_criteria (
          id TEXT PRIMARY KEY,
          department TEXT NOT NULL,
          label TEXT NOT NULL,
          type TEXT NOT NULL DEFAULT 'checkbox',
          threshold REAL,
          scale REAL,
          is_active INTEGER DEFAULT 1,
          sort_order INTEGER DEFAULT 0,
          created_by TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT
        );
      `).catch(() => {});
      await db.exec("CREATE INDEX IF NOT EXISTS idx_demo_eval_criteria_dept ON demo_evaluation_criteria(department)").catch(() => {});
    }
  },
  {
    name: "student_mentor_feedback_table",
    run: async (db) => {
      await db.exec(`
        CREATE TABLE IF NOT EXISTS student_mentor_feedback (
          id TEXT PRIMARY KEY,
          register_number TEXT NOT NULL,
          student_name TEXT,
          email TEXT,
          college_id TEXT,
          college_name TEXT,
          department TEXT,
          class_group TEXT,
          ape_q1_assessments TEXT,
          ape_q2_study_materials TEXT,
          ape_q2_missing_papers TEXT,
          ape_q3_hands_on_rating INTEGER,
          ape_q4_confidence_rating INTEGER,
          challenges_selected TEXT,
          challenges_detail TEXT,
          challenges_suggestions TEXT,
          nps_score INTEGER,
          nps_fu1_campus_satisfied TEXT,
          nps_fu2_classroom_satisfied TEXT,
          nps_fu3_skill_dev TEXT,
          nps_fu4_placement TEXT,
          nps_likes TEXT,
          nps_improve TEXT,
          mentor_ratings TEXT,
          full_payload TEXT,
          submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `).catch(() => {});
      await db.exec("CREATE INDEX IF NOT EXISTS idx_mentor_fb_reg ON student_mentor_feedback(register_number)").catch(() => {});
      await db.exec("CREATE INDEX IF NOT EXISTS idx_mentor_fb_clg ON student_mentor_feedback(college_name)").catch(() => {});
      await db.exec("CREATE INDEX IF NOT EXISTS idx_mentor_fb_dept ON student_mentor_feedback(department)").catch(() => {});
      await db.exec("CREATE INDEX IF NOT EXISTS idx_mentor_fb_submitted ON student_mentor_feedback(submitted_at DESC)").catch(() => {});
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
