import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/app/api/daily-configs/route.ts"), "utf8");

describe("daily-config writes are batched", () => {
  it("inserts one notification statement per chunk, not one per campus member", () => {
    expect(source).toContain("async function bulkInsertNotifications");
    expect(source).toContain("await bulkInsertNotifications(db, notifRows, nowStr)");
    // The fan-out this replaces: an INSERT issued from inside the per-user loop.
    expect(source).not.toMatch(/for \(const u of users\)[\s\S]{0,600}?await db\.run\(/);
  });

  it("upserts the whole configured range in chunks", () => {
    expect(source).toContain("async function bulkUpsertDailyConfigs");
    expect((source.match(/await bulkUpsertDailyConfigs\(db, configRows\)/g) || []).length).toBe(2);
    expect(source).not.toMatch(/for \(const [a-z]+ of (users|nextDates|datesToProcess)\)[\s\S]{0,400}?INSERT INTO campus_daily_configs/);
  });

  it("reads the campus audience once per request instead of once per date", () => {
    expect((source.match(/await loadCampusAudience\(db, college_id\)/g) || []).length).toBe(2);
    // The roster SELECT exists once, inside the helper, never inlined at a call site.
    expect((source.match(/db\.all\(\s*`\s*SELECT id, role FROM users/g) || []).length).toBe(1);
  });

  it("bounds the date range so one request cannot queue tens of thousands of rows", () => {
    expect(source).toContain("MAX_CONFIG_DATES");
    expect(source).toMatch(/while \(cur <= end && datesToProcess\.length <= MAX_CONFIG_DATES\)/);
    expect(source).toContain("Date range too large");
  });

  it("stamps notifications with an ISO timestamp instead of NOW()::text", () => {
    expect(source).not.toContain("NOW()::text");
    expect(source).toContain("const nowStr = new Date().toISOString()");
  });
});
