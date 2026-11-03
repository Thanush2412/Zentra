import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import { applyHandoverDateCorrection, correctStaleHandoverDate, formatHandoverDate } from "@/lib/handoverDates";

/**
 * BE-M05 follow-up: the leave-cover date heal used to run inside GET /api/requests
 * and GET /api/requests/faculty-leave, so every dashboard poll wrote rows. Reads
 * now correct the payload in memory and POST /api/requests/review persists the fix.
 */
function handlerBlock(file: string, name: string): string {
  const source = readFileSync(resolve(process.cwd(), file), "utf8");
  const start = source.indexOf(`export async function ${name}(`);
  expect(start, `${name} missing in ${file}`).toBeGreaterThan(-1);
  const next = source.indexOf("export async function ", start + 10);
  return source.slice(start, next === -1 ? source.length : next);
}

describe("leave-cover date heal", () => {
  it("labels a corrected date the way the app writes dateformatted", () => {
    expect(formatHandoverDate("2026-10-05")).toBe("Monday, 05 Oct 2026");
  });

  it("returns a correction only when the stored handover day precedes the leave", () => {
    expect(correctStaleHandoverDate("2026-10-04", "2026-10-05")).toEqual({
      datestr: "2026-10-05",
      dateformatted: "Monday, 05 Oct 2026"
    });
    expect(correctStaleHandoverDate("2026-10-05", "2026-10-05")).toBeNull();
    expect(correctStaleHandoverDate("2026-10-06", "2026-10-05")).toBeNull();
    expect(correctStaleHandoverDate(null, "2026-10-05")).toBeNull();
    expect(correctStaleHandoverDate("2026-10-04", null)).toBeNull();
  });

  it("writes both key aliases so camelCase and folded readers agree", () => {
    const row: Record<string, any> = { datestr: "2026-10-04", dateformatted: "Sunday, 04 Oct 2026" };
    applyHandoverDateCorrection(row, correctStaleHandoverDate("2026-10-04", "2026-10-05")!);
    expect(row.datestr).toBe("2026-10-05");
    expect(row.dateStr).toBe("2026-10-05");
    expect(row.dateformatted).toBe("Monday, 05 Oct 2026");
    expect(row.dateFormatted).toBe("Monday, 05 Oct 2026");
  });
});

describe("request reads no longer mutate rows", () => {
  for (const file of ["src/app/api/requests/route.ts", "src/app/api/requests/faculty-leave/route.ts"]) {
    it(`${file} GET performs no writes`, () => {
      const block = handlerBlock(file, "GET");
      expect(block).not.toMatch(/db\.run\(/);
      expect(block).not.toMatch(/UPDATE |INSERT INTO |DELETE FROM /);
    });
  }

  it("keeps the cover-approval cascade on the write path", () => {
    const block = handlerBlock("src/app/api/requests/review/route.ts", "POST");
    expect(block).toMatch(/correctStaleHandoverDate\(/);
    expect(block).toMatch(/UPDATE handover_requests SET datestr = \?, dateformatted = \? WHERE id = \?/);
    expect(block).toMatch(/UPDATE approved_handovers SET datestr = \? WHERE requestid = \?/);
  });

  it("still enriches faculty leave reads with their covers", () => {
    const block = handlerBlock("src/app/api/requests/faculty-leave/route.ts", "GET");
    expect(block).toMatch(/coversByLeave\.get\(rec\.id\)/);
    expect(block).toMatch(/rec\.covers = covers/);
  });

  it("ships the one-time SQL repair that replaces the read-path writes", () => {
    const sql = readFileSync(resolve(process.cwd(), "scripts/backfill-handover-dates.sql"), "utf8");
    expect(sql).toMatch(/UPDATE handover_requests/);
    expect(sql).toMatch(/UPDATE approved_handovers/);
    expect(sql).toMatch(/ON CONFLICT \(mentor_id, date_str\) DO NOTHING/);
  });
});
