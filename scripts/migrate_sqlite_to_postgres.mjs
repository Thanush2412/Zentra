import sqlite3 from "sqlite3";
import { open } from "sqlite";
import pg from "pg";
import fs from "fs";
import path from "path";

const { Pool } = pg;

// Read .env.local if present
let envDbUrl = process.env.DATABASE_URL;
if (!envDbUrl && fs.existsSync(".env.local")) {
  const envContent = fs.readFileSync(".env.local", "utf8");
  const match = envContent.match(/^DATABASE_URL=["']?([^"'\r\n]+)["']?/m);
  if (match) envDbUrl = match[1];
}

const targetUrl = process.argv[2] || envDbUrl;

if (!targetUrl) {
  console.error("❌ Error: No PostgreSQL connection string provided.");
  process.exit(1);
}

const TABLE_ORDER = [
  "admin_users",
  "kam_users",
  "colleges",
  "campus_managers",
  "mentors",
  "departments",
  "courses",
  "subjects",
  "students",
  "users",
  "slots",
  "handover_requests",
  "approved_handovers",
  "student_attendance",
  "mentor_attendance",
  "campus_daily_configs",
  "academic_tracker",
  "weekly_tasks",
  "student_tracker",
  "subject_materials",
  "weekly_academic_tasks",
  "student_academic_tracker",
  "student_interviews",
  "interview_allocations",
  "cam_capacity_responses",
  "student_interview_slots",
  "interview_evaluations",
  "student_fees",
  "fee_payments",
  "audit_logs",
  "notifications",
  "leave_requests",
  "faculty_leave_requests",
  "leave_balances",
  "approvals",
  "announcements",
  "holidays",
  "login_history",
  "sme_users",
  "mentor_groups",
  "subject_groups",
  "demo_sessions",
  "demo_rules",
  "demo_swap_requests",
  "exam_schedules",
  "student_exam_marks",
  "class_mentor_assignments",
  "faculty_configs",
  "kam_tasks",
  "campus_issues",
  "signup_requests",
  "feedback_reports",
  "campus_drafts",
  "system_settings",
  "academic_years",
  "academic_events",
  "schema_migrations"
];

async function main() {
  console.log("🚀 Starting Full SQLite -> PostgreSQL Data Migration...");
  console.log(`📡 Target PostgreSQL: ${targetUrl.replace(/:[^:@]+@/, ":****@")}\n`);

  // Open primary DB and fallback data DB
  const primaryDb = fs.existsSync("database.sqlite")
    ? await open({ filename: "database.sqlite", driver: sqlite3.Database })
    : null;

  const dataDb = fs.existsSync("data/timetable.db")
    ? await open({ filename: "data/timetable.db", driver: sqlite3.Database })
    : null;

  const isLocalHost = targetUrl.includes("localhost") || targetUrl.includes("127.0.0.1");
  const pgPool = new Pool({
    connectionString: targetUrl,
    ssl: !isLocalHost ? { rejectUnauthorized: false } : undefined,
    max: 10
  });

  const pgClient = await pgPool.connect();

  try {
    // 1. Ensure Schema
    console.log("📋 Verifying PostgreSQL Schema...");
    const schemaSql = fs.readFileSync("postgres_schema.sql", "utf8");
    await pgClient.query(schemaSql);
    console.log("✅ Schema ensured.\n");

    let totalMigrated = 0;

    for (const table of TABLE_ORDER) {
      let rows = [];

      // Try primary db
      if (primaryDb) {
        try {
          const tExists = await primaryDb.get("SELECT name FROM sqlite_master WHERE type='table' AND name=?", table);
          if (tExists) {
            rows = await primaryDb.all(`SELECT * FROM "${table}"`);
          }
        } catch (_) {}
      }

      // If primary db has 0 rows, check dataDb (e.g. colleges, mentors, etc.)
      if ((!rows || rows.length === 0) && dataDb) {
        try {
          const tExists = await dataDb.get("SELECT name FROM sqlite_master WHERE type='table' AND name=?", table);
          if (tExists) {
            rows = await dataDb.all(`SELECT * FROM "${table}"`);
          }
        } catch (_) {}
      }

      if (!rows || rows.length === 0) continue;

      // Get target columns in PostgreSQL to only insert valid columns
      const pgColRes = await pgClient.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = $1
      `, [table.toLowerCase()]);
      const validPgCols = new Map(pgColRes.rows.map(r => [r.column_name.toLowerCase(), r.column_name]));

      const rawCols = Object.keys(rows[0]);
      const validPairs = rawCols
        .filter(c => validPgCols.has(c.toLowerCase()))
        .map(c => ({ raw: c, pg: validPgCols.get(c.toLowerCase()) }));

      if (validPairs.length === 0) continue;

      const colNames = validPairs.map(p => `"${p.pg.toLowerCase()}"`).join(", ");
      const rawKeys = validPairs.map(p => p.raw);

      // Fast multi-row bulk insert (chunk by 200 rows)
      const CHUNK = Math.min(250, Math.floor(3000 / validPairs.length));
      let insertedForTable = 0;

      for (let i = 0; i < rows.length; i += CHUNK) {
        const chunk = rows.slice(i, i + CHUNK);
        const placeholders = chunk.map((_, rIdx) => 
          `(${validPairs.map((_, cIdx) => `$${rIdx * validPairs.length + cIdx + 1}`).join(", ")})`
        ).join(", ");

        const values = chunk.flatMap(r => rawKeys.map(k => (r[k] === undefined ? null : r[k])));

        const hasId = validPairs.some(p => p.pg.toLowerCase() === "id");
        const conflictClause = hasId
          ? `ON CONFLICT ("id") DO NOTHING`
          : `ON CONFLICT DO NOTHING`;

        const query = `
          INSERT INTO "${table.toLowerCase()}" (${colNames})
          VALUES ${placeholders}
          ${conflictClause}
        `;

        try {
          await pgClient.query(query, values);
          insertedForTable += chunk.length;
        } catch (err) {
          // Fallback row-by-row for problematic records
          for (const singleRow of chunk) {
            try {
              const singleVals = rawKeys.map(k => (singleRow[k] === undefined ? null : singleRow[k]));
              const singlePh = validPairs.map((_, idx) => `$${idx + 1}`).join(", ");
              await pgClient.query(
                `INSERT INTO "${table.toLowerCase()}" (${colNames}) VALUES (${singlePh}) ${conflictClause}`,
                singleVals
              );
              insertedForTable++;
            } catch (_) {}
          }
        }
      }

      console.log(`  ✓ ${table.padEnd(30)} ${insertedForTable} rows`);
      totalMigrated += insertedForTable;
    }

    console.log(`\n🎉 Full Migration Complete! Total rows seeded: ${totalMigrated}`);
  } catch (error) {
    console.error("❌ Migration error:", error);
  } finally {
    pgClient.release();
    await pgPool.end();
    if (primaryDb) await primaryDb.close();
    if (dataDb) await dataDb.close();
  }
}

main();
