import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => {
  const batches: { label?: string; sql: string; params: any[] }[][] = [];
  const singleReads: string[] = [];

  const state = {
    plans: [] as any[],
    tracker: [] as any[],
    demos: [] as any[],
    subjects: [] as any[],
    clearances: [] as any[],
    failOn: null as string | null
  };

  const rowsFor = (sql: string): any[] => {
    if (sql.includes("FROM mentor_weekly_plans")) return state.plans;
    if (sql.includes("FROM academic_tracker")) return state.tracker;
    if (sql.includes("FROM demo_sessions")) return state.demos;
    if (sql.includes("FROM subjects")) return state.subjects;
    if (sql.includes("FROM mentor_skill_clearances")) return state.clearances;
    return [];
  };

  const makeDb = () => ({
    multiQuery: async (queries: { sql: string; params?: any[] }[], failures?: any[]) => {
      batches.push(queries.map(q => ({ sql: q.sql, params: [...(q.params || [])] })));
      return queries.map(q => {
        if (failures && state.failOn && q.sql.includes(state.failOn)) {
          failures.push({ sql: q.sql, error: `connection timeout` });
          return [];
        }
        return rowsFor(q.sql);
      });
    },
    get: async (sql: string) => {
      singleReads.push(sql);
      return null;
    },
    all: async (sql: string) => {
      singleReads.push(sql);
      return rowsFor(sql);
    },
    run: async () => ({ changes: 1 }),
    exec: async () => {}
  });

  return { batches, singleReads, state, makeDb };
});

vi.mock("@/lib/db", () => ({ getDb: async () => h.makeDb() }));
vi.mock("@/lib/migrations", () => ({ ensureMigration: async () => {} }));
vi.mock("@/lib/authGuard", () => ({ requireAuth: async () => ({}), requireRole: async () => ({}) }));

const { GET } = await import("@/app/api/weekly-plan/route");

const get = (query = "") =>
  GET(new Request(`http://localhost/api/weekly-plan${query ? `?${query}` : ""}`) as any);

beforeEach(() => {
  h.batches.length = 0;
  h.singleReads.length = 0;
  Object.assign(h.state, {
    plans: [],
    tracker: [],
    demos: [],
    subjects: [{ name: "Communication Skills", type: "Skill" }],
    clearances: [],
    failOn: null
  });
});

describe("GET /api/weekly-plan", () => {
  it("issues one batched read group and never falls back to sequential queries", async () => {
    const res = await get();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(h.batches).toHaveLength(1);
    expect(h.batches[0]).toHaveLength(3);
    expect(h.singleReads).toHaveLength(0);
    expect(body.success).toBe(true);
    expect(body.plans).toEqual([]);
  });

  it("adds the audit slices to the same batch when a scope is requested", async () => {
    h.state.plans = [{
      id: "wp1", mentor_id: "m1", college_id: "c1", subject: "Communication Skills", week_number: 2,
      status: "Submitted", class_group: "CSE-3A", session_plan: JSON.stringify([{ topic: "Active listening" }])
    }];
    h.state.tracker = [{ id: "at1", topic: "Active listening", subject: "Communication Skills", mentor_id: "m1" }];
    h.state.demos = [{ id: "d1", mentorId: "m1", subject: "Communication Skills", week: 2, status: "completed", marks: 8 }];
    h.state.clearances = [{
      mentor_id: "m1", subject: "Communication Skills", week_number: 2, scope: "week",
      status: "cleared", score: 8, remarks: "Cleared", verified_by: "SME", verified_at: "2026-11-05T00:00:00.000Z"
    }];

    const res = await get("mentorId=m1&collegeId=c1");
    const body = await res.json();

    expect(h.batches).toHaveLength(1);
    expect(h.batches[0]).toHaveLength(5);
    expect(h.batches[0][1].params).toEqual(["m1", "c1"]);
    expect(h.batches[0][2].params).toEqual(["m1"]);
    expect(h.singleReads).toHaveLength(0);

    expect(body.plans[0].subject_type).toBe("Skill");
    expect(body.plans[0].skill_verdict.verdict).toBe("cleared");
    expect(body.plans[0].session_plan[0].conductedStatus).toBe("Completed");
    expect(body.audit.completionPercentage).toBe(100);
    expect(body.audit.demos.total).toBe(1);
  });

  it("omits the audit slices without a scope but still reads subjects and clearances", async () => {
    await get("weekNumber=3");

    const sqls = h.batches[0].map(q => q.sql);
    expect(sqls.some(s => s.includes("FROM academic_tracker"))).toBe(false);
    expect(sqls.some(s => s.includes("FROM demo_sessions"))).toBe(false);
    expect(sqls.some(s => s.includes("FROM mentor_skill_clearances"))).toBe(true);
    expect(h.batches[0][0].params).toEqual([3]);
  });

  it("fails loudly instead of rendering every verdict as pending", async () => {
    h.state.failOn = "FROM mentor_skill_clearances";

    const res = await get("mentorId=m1");
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.success).toBe(false);
    expect(body.message).toContain("mentor_skill_clearances");
  });
});
