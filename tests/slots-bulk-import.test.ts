import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => {
  const reads: string[] = [];
  const writes: { sql: string; params: any }[] = [];
  const synced: string[] = [];

  const existing = () => [
    { id: "e1", mentorId: "m9", day: "Monday", time: "09:00 AM - 10:00 AM", shift: "general", location: "Room A", classGroup: "CSE-3A", college_id: "c1" }
  ];

  function makeDb() {
    return {
      multiQuery: async (queries: { sql: string }[]) => {
        reads.push(...queries.map(q => q.sql));
        return queries.map(q => {
          if (q.sql.includes("FROM mentors")) return [{ id: "m9", college_id: "c1" }];
          if (q.sql.includes("FROM colleges")) return [{ id: "c1" }];
          return existing();
        });
      },
      get: async (sql: string) => { reads.push(sql); return null; },
      all: async (sql: string) => { reads.push(sql); return []; },
      run: async (sql: string, params: any) => { writes.push({ sql, params }); return { changes: 1 }; },
      transaction: async (cb: any) => cb({
        run: async (sql: string, params: any) => { writes.push({ sql, params }); return { changes: 1 }; }
      })
    };
  }

  return { reads, writes, synced, makeDb };
});

vi.mock("@/lib/authGuard", () => ({
  requireAuth: async () => ({ auth: { role: "cm" }, errorResponse: null })
}));

vi.mock("@/lib/db", () => ({
  getDb: async () => h.makeDb(),
  resolveClassGroupDetails: async () => ({ department: "CSE", semester: "Semester 2", year: "Year 2" }),
  syncMentorSubjectsAndClasses: async (_db: any, mentorId: string, course: string, classGroup: string) => {
    h.synced.push(`${mentorId}|${course}|${classGroup}`);
  }
}));

const { POST } = await import("@/app/api/slots/bulk/route");

const payload = [
  // accepted: free room + class on Monday 10:00
  { mentorId: "m1", day: "Monday", time: "10:00 AM - 11:00 AM", course: "DSA", location: "Room B", classGroup: "IT-2A", shift: "general" },
  // rejected: same room in the same period, but only because of the row above it
  { mentorId: "m2", day: "Monday", time: "10:00 AM - 11:00 AM", course: "DBMS", location: "Room B", classGroup: "IT-2B", shift: "general" },
  // rejected: mentor m9 already teaches Monday 09:00 in the database
  { mentorId: "m9", day: "Monday", time: "09:00 AM - 10:00 AM", course: "OS", location: "Room Z", classGroup: "IT-2C", shift: "general" },
  // rejected: CSE-3A already has a class at that period in college c1
  { mentorId: "m3", day: "Monday", time: "09:00 AM - 10:00 AM", course: "CN", location: "Room Q", classGroup: "CSE-3A", shift: "general" },
  // accepted: another college is allowed to reuse room + class group
  { mentorId: "m6", day: "Monday", time: "09:00 AM - 10:00 AM", course: "SE", location: "Room A", classGroup: "CSE-3A", shift: "general", college_id: "c2" },
  // accepted: Tuesday 09:00 is a different stamp
  { mentorId: "m4", day: "Tuesday", time: "09:00 AM - 10:00 AM", course: "ML", location: "Room A", classGroup: "CSE-3A", shift: "general" },
  // rejected: Room A on Tuesday 09:00 was taken by the previous row of this upload
  { mentorId: "m5", day: "Tuesday", time: "09:00 AM - 10:00 AM", course: "AI", location: "Room A", classGroup: "IT-2D", shift: "general" }
];

async function runImport(slots: any[]) {
  const request = new Request("http://localhost/api/slots/bulk", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ slots, actorName: "Campus Manager" })
  });
  const response = await POST(request as any);
  return response.json();
}

describe("bulk slot import round trips", () => {
  beforeEach(() => {
    h.reads.length = 0;
    h.writes.length = 0;
    h.synced.length = 0;
  });

  it("reads mentor colleges and the timetable once, not once per CSV row", async () => {
    const json = await runImport(payload);

    expect(json.success).toBe(true);
    expect(json.count).toBe(3);
    // mentors + colleges + existing slots. The old code issued ~4 reads per row.
    expect(h.reads).toHaveLength(3);
  });

  it("keeps the same collision verdicts the per-row queries produced", async () => {
    const json = await runImport(payload);

    const insert = h.writes.find(w => w.sql.includes("INSERT INTO slots"));
    expect(insert).toBeDefined();
    const insertedMentors: string[] = [];
    const params = insert!.params;
    for (let i = 0; i < params.length; i += 12) insertedMentors.push(params[i + 1]);

    // m2 (room reused in-upload), m3/m4-style collisions and m5 are all dropped.
    expect(insertedMentors).toEqual(["m1", "m6", "m4"]);
    expect(json.count).toBe(3);
    expect(h.synced).toEqual(["m1|DSA|IT-2A", "m6|SE|CSE-3A", "m4|ML|CSE-3A"]);
  });

  it("writes the whole import as one chunked INSERT plus the audit row", async () => {
    await runImport(payload.slice(0, 3));

    const inserts = h.writes.filter(w => w.sql.includes("INSERT INTO slots"));
    expect(inserts).toHaveLength(1);
    expect(inserts[0].sql).toContain("VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
    expect(h.writes.filter(w => w.sql.includes("INSERT INTO audit_logs"))).toHaveLength(1);
  });

  it("refuses an empty payload", async () => {
    const json = await runImport([]);
    expect(json.success).toBe(false);
    expect(h.reads).toHaveLength(0);
  });
});
