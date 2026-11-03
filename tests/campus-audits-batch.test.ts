import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => {
  const batches: { sql: string; params: any[] }[][] = [];
  const singleReads: string[] = [];

  const state = {
    colleges: [] as any[],
    assigned: [] as any[],
    submitted: [] as any[],
    allAudits: [] as any[],
    failOn: null as string | null
  };

  const rowsFor = (sql: string): any[] => {
    if (sql.includes("FROM colleges c")) return state.colleges;
    if (sql.includes("reviewer_campus = ?")) return state.assigned;
    if (sql.includes("campus = ?")) return state.submitted;
    if (sql.includes("FROM campus_audits")) return state.allAudits;
    return [];
  };

  const makeDb = () => ({
    multiQuery: async (queries: { sql: string; params?: any[] }[], failures?: any[]) => {
      batches.push(queries.map(q => ({ sql: q.sql, params: [...(q.params || [])] })));
      return queries.map(q => {
        if (failures && state.failOn && q.sql.includes(state.failOn)) {
          failures.push({ sql: q.sql, error: "connection timeout" });
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
vi.mock("@/lib/authGuard", () => ({ requireAuth: async () => ({}) }));

const { GET } = await import("@/app/api/audit/campus-audits/route");

const CAMPUS = "Sri Amaraavathi";

const get = (query = "") => GET(new Request(`http://localhost/api/audit/campus-audits${query ? `?${query}` : ""}`) as any);

beforeEach(() => {
  h.batches.length = 0;
  h.singleReads.length = 0;
  Object.assign(h.state, {
    colleges: [
      { id: "c1", name: CAMPUS, kam_id: "k1", kam_name: "Ravi" },
      { id: "c2", name: "Solamalai", kam_id: "k1", kam_name: "Ravi" }
    ],
    assigned: [{ id: "a1", reviewer_campus: CAMPUS, campus: "Other", created_at: "2026-10-01" }],
    submitted: [{ id: "a2", reviewer_campus: "Other", campus: CAMPUS, created_at: "2026-10-02" }],
    allAudits: [{ id: "a1" }, { id: "a2" }],
    failOn: null
  });
});

describe("GET /api/audit/campus-audits", () => {
  it("reads the college list and both audit directions in one batched group", async () => {
    const res = await get(`collegeName=${encodeURIComponent(CAMPUS)}`);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(h.batches).toHaveLength(1);
    expect(h.batches[0]).toHaveLength(3);
    expect(h.batches[0][1].params).toEqual([CAMPUS, ""]);
    expect(h.singleReads).toHaveLength(0);

    expect(body.assignedAudits.map((a: any) => a.id)).toEqual(["a1"]);
    expect(body.submittedAudits.map((a: any) => a.id)).toEqual(["a2"]);
    expect(body.activeKAMInfo.kam).toBe("Ravi");
    expect(body.activeKAMInfo.kamId).toBe("k1");
    expect(body.activeKAMInfo.campuses).toEqual([CAMPUS, "Solamalai"]);
    expect(body.clusters["Ravi"].campuses).toHaveLength(2);
    expect(body.allColleges).toHaveLength(2);
  });

  it("reads one unscoped audit slice plus the colleges when no campus is given", async () => {
    const res = await get();
    const body = await res.json();

    expect(h.batches[0]).toHaveLength(2);
    expect(h.batches[0][1].sql).toContain("LIMIT 100");
    expect(h.batches[0][1].params).toEqual([]);
    expect(body.assignedAudits).toHaveLength(2);
    expect(body.submittedAudits).toEqual([]);
  });

  it("fails loudly instead of returning an empty audit board", async () => {
    h.state.failOn = "FROM colleges c";

    const res = await get();
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.success).toBe(false);
    expect(body.message).toContain("could not be loaded");
  });
});
