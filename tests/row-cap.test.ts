import { describe, expect, it } from "vitest";
import { allCapped, ROW_CAP } from "@/lib/db";

/**
 * A read that silently returns a short list is worse than one that fails: the
 * timetable UI renders "no such record" for anything missing, so a truncated
 * roster reads as deleted data. allCapped has to probe and then complain.
 */
function dbReturning(totalRows: number) {
  const seen: string[] = [];
  return {
    seen,
    all: async (sql: string) => {
      seen.push(sql);
      const limit = Number(/LIMIT (\d+)$/.exec(sql)?.[1] ?? 0);
      return Array.from({ length: Math.min(totalRows, limit) }, (_, i) => ({ id: `r${i}` }));
    }
  };
}

describe("allCapped", () => {
  it("asks the database for one row past the ceiling", async () => {
    const db = dbReturning(1);
    await allCapped(db, "SELECT * FROM mentors WHERE college_id = ?", ["c1"], 5000);

    expect(db.seen[0]).toBe("SELECT * FROM mentors WHERE college_id = ? LIMIT 5001");
  });

  it("returns the rows while the read stays under the ceiling", async () => {
    const db = dbReturning(4);

    expect(await allCapped(db, "SELECT * FROM subject_groups ORDER BY name ASC", [], 10)).toHaveLength(4);
  });

  it("errors instead of handing back a truncated list", async () => {
    const db = dbReturning(11);

    await expect(allCapped(db, "SELECT * FROM mentors", [], 10)).rejects.toThrow(/10-row ceiling/);
  });

  it("keeps the default ceiling on the directory scale", () => {
    expect(ROW_CAP).toBe(5000);
  });
});
