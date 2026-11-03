import pg from "pg";

/**
 * HackerRank / LeetCode analytics live in a second Supabase project, not in this app's
 * database, so `lc_students` must never be read through `getDb()`. That mirror is
 * configured by HACKERRANK_LEETCODE_DB_URL; when it is absent, callers must say so
 * instead of falling back to an empty list — an empty solved-count reads as a measured
 * zero in the Skill Development Report narratives.
 */

export interface LcSolvedRow {
  email: string | null;
  register_number: string | null;
  solved_total: number | null;
}

const LC_DB_URL = process.env.HACKERRANK_LEETCODE_DB_URL || "";

let pool: pg.Pool | null = null;

export function isLeetcodeMirrorConfigured(): boolean {
  return Boolean(LC_DB_URL);
}

export async function readLcSolvedTotals(): Promise<LcSolvedRow[]> {
  if (!LC_DB_URL) throw new Error("HACKERRANK_LEETCODE_DB_URL is not set");
  if (!pool) {
    pool = new pg.Pool({
      connectionString: LC_DB_URL,
      ssl: { rejectUnauthorized: false },
      max: 4,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 8000
    });
  }
  const res = await pool.query("SELECT email, register_number, solved_total FROM lc_students");
  return res.rows as LcSolvedRow[];
}
