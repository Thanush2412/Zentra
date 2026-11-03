import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => {
  const batches: { sql: string; params: any[] }[][] = [];
  const singleReads: string[] = [];

  const state = {
    kam: null as any,
    colleges: [] as any[],
    campusManagers: [] as any[],
    departments: [] as any[],
    mentorCount: [] as any[],
    slotCount: [] as any[],
    failOn: null as string | null
  };

  const rowsFor = (sql: string): any[] => {
    // The colleges slice carries the per-college COUNT() subqueries, so it has to be
    // matched before the tables it counts.
    if (sql.includes("as dept_count")) return state.colleges;
    if (sql.includes("FROM campus_managers")) return state.campusManagers;
    if (sql.includes("FROM departments d")) return state.departments;
    if (sql.includes("FROM slots s")) return state.slotCount;
    if (sql.includes("FROM mentors m")) return state.mentorCount;
    return [];
  };

  const makeDb = () => ({
    get: async (sql: string) => {
      singleReads.push(sql);
      if (sql.includes("FROM kam_users")) return state.kam;
      return null;
    },
    all: async (sql: string) => {
      singleReads.push(sql);
      return rowsFor(sql);
    },
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
    run: async () => ({ changes: 1 }),
    exec: async () => {}
  });

  return { batches, singleReads, state, makeDb };
});

vi.mock("@/lib/db", () => ({ getDb: async () => h.makeDb() }));
vi.mock("@/lib/authGuard", () => ({ requireAuth: async () => ({}) }));
vi.mock("@/lib/kamScope", () => ({
  requireKamScope: async () => ({ scope: { kamId: "kam1", allowedCollegeIds: ["c1", "c2"], auth: { role: "kam" } } })
}));

const { GET } = await import("@/app/api/kam/route");

const get = (query = "id=kam1") => GET(new Request(`http://localhost/api/kam${query ? `?${query}` : ""}`) as any);

beforeEach(() => {
  h.batches.length = 0;
  h.singleReads.length = 0;
  Object.assign(h.state, {
    kam: { id: "kam1", name: "Ravi", email: "ravi@example.com" },
    colleges: [{ id: "c1", name: "Amaraavathi" }, { id: "c2", name: "Solamalai" }],
    campusManagers: [{ id: "cm1", name: "Kala" }],
    departments: [{ id: "d1", name: "CSE" }],
    mentorCount: [{ count: "7" }],
    slotCount: [{ count: "21" }],
    failOn: null
  });
});

describe("GET /api/kam", () => {
  it("resolves the portfolio with one lookup plus one batched read group", async () => {
    const res = await get();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(h.batches).toHaveLength(1);
    expect(h.batches[0]).toHaveLength(5);
    expect(h.batches[0].every(q => q.params.join("") === "kam1")).toBe(true);
    expect(h.singleReads).toHaveLength(1);
    expect(body.colleges).toHaveLength(2);
    expect(body.campusManagers).toHaveLength(1);
    expect(body.stats).toEqual({ totalColleges: 2, totalDepts: 1, totalMentors: "7", totalSlots: "21" });
  });

  it("keeps the not-found check ahead of the batch", async () => {
    h.state.kam = null;

    const res = await get("id=kam1");
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.message).toContain("KAM not found");
    expect(h.batches).toHaveLength(0);
  });

  it("rejects another portfolio before reading anything", async () => {
    const res = await get("id=kam2");

    expect(res.status).toBe(403);
    expect(h.batches).toHaveLength(0);
    expect(h.singleReads).toHaveLength(0);
  });

  it("fails loudly when a slice errors instead of reporting an empty portfolio", async () => {
    h.state.failOn = "FROM colleges c";

    const res = await get();
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.success).toBe(false);
    expect(body.message).toContain("could not be loaded");
  });
});
