import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";

/**
 * `/api/skill-tracker` returned 500 in production because its academic_tracker read named a
 * `week_number` column that no DDL in this repository ever created, and lc_students was read
 * through the app database although it only exists in the external HackerRank/LeetCode project.
 * Both were silent before: each read ended in `.catch(() => [])`, so the tracker simply showed
 * nothing conducted and the report showed a solved-average of 0.
 */

function read(rel: string): string {
  return readFileSync(`${process.cwd()}/${rel}`, "utf8");
}

function columnsOf(table: string): Set<string> {
  const ddl = read("postgres_schema.sql");
  const block = new RegExp(`CREATE TABLE IF NOT EXISTS ${table} \\(([\\s\\S]*?)\\n\\);`, "m").exec(ddl);
  if (!block) throw new Error(`postgres_schema.sql has no CREATE TABLE for ${table}`);

  const columns = new Set<string>();
  block[1].split("\n").forEach(line => {
    const match = line.trim().match(/^([a-z_][a-z0-9_]*)\s+(?:[A-Za-z]|VARCHAR|TEXT|INTEGER)/i);
    if (!match) return;
    if (["primary", "unique", "foreign", "check", "constraint"].includes(match[1].toLowerCase())) return;
    columns.add(match[1]);
  });

  // Migrations widen tables without postgres_schema.sql being the only writer of DDL.
  const migrations = read("src/lib/migrations.ts");
  for (const added of migrations.matchAll(new RegExp(`ALTER TABLE ${table} ADD COLUMN(?: IF NOT EXISTS)? ([a-z_][a-z0-9_]*)`, "g"))) {
    columns.add(added[1]);
  }
  return columns;
}

describe("academic_tracker column contract", () => {
  it("knows the weekly-plan columns the migration adds", () => {
    const columns = columnsOf("academic_tracker");
    expect(columns.has("weekly_plan_week")).toBe(true);
    expect(columns.has("week_number")).toBe(false);
  });

  it("selects only columns academic_tracker actually has", () => {
    const route = read("src/app/api/skill-tracker/route.ts");
    const select = /SELECT ([^"]+?) FROM academic_tracker/.exec(route)?.[1];
    expect(select).toBeTruthy();

    const columns = columnsOf("academic_tracker");
    const named = select!.split(",").map(c => c.trim()).filter(Boolean);
    expect(named.filter(c => !columns.has(c))).toEqual([]);
  });
});

describe("LeetCode mirror reads", () => {
  it("never reads lc_students through the app database", () => {
    const route = read("src/app/api/reports/skill-development/route.ts");
    expect(route).not.toMatch(/FROM lc_students/);
    expect(route).toContain("readLcSolvedTotals");
  });

  it("fails the report instead of fabricating a zero solved-average", () => {
    const route = read("src/app/api/reports/skill-development/route.ts");
    expect(route).toMatch(/HACKERRANK_LEETCODE_DB_URL/);
    expect(route).toMatch(/httpError\(\s*503/);
  });
});
