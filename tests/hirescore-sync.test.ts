import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => {
  const batches: { sql: string; params: any[] }[][] = [];
  const singleWrites: { sql: string; params: any[] }[] = [];
  const fetchCalls: string[] = [];

  const state = {
    hireStudents: [] as any[],
    localStudents: [] as any[],
    fetchMode: "ok" as "ok" | "throw" | "notok",
    fetchQueue: [] as ("ok" | "throw" | "notok")[],
    multiQueryFails: 0
  };

  const makeDb = () => ({
    multiQuery: async (queries: { sql: string; params?: any[] }[], failures?: any[]) => {
      const norm = queries.map(q => ({ sql: q.sql, params: [...(q.params || [])] }));
      batches.push(norm);
      let failed = 0;
      return norm.map(q => {
        if (failed < state.multiQueryFails) {
          failed++;
          failures?.push({ sql: q.sql, error: "deadlock detected" });
          return [];
        }
        return [{ changes: 1 }];
      });
    },
    get: async () => null,
    all: async () => state.localStudents,
    run: async (sql: string, ...args: any[]) => {
      singleWrites.push({ sql, params: args });
      return { changes: 1 };
    },
    exec: async () => {},
    transaction: async (cb: any) => cb({ get: async () => null, all: async () => [], run: async () => ({ changes: 1 }), exec: async () => {} })
  });

  return { batches, singleWrites, fetchCalls, state, makeDb };
});

vi.mock("@/lib/db", async () => {
  const actual = await vi.importActual<typeof import("@/lib/db")>("@/lib/db");
  return { ...actual, getDb: async () => h.makeDb() };
});

vi.mock("@/lib/api-auth", () => ({
  requireRole: vi.fn(async () => ({ user: { id: "u1", role: "admin" } })),
  apiAuthErrorResponse: () => null
}));

vi.mock("@/lib/net", async () => {
  const actual = await vi.importActual< typeof import("@/lib/net")>("@/lib/net");
  return {
    ...actual,
    fetchWithTimeout: async (url: string) => {
      h.fetchCalls.push(url);
      const mode = h.state.fetchQueue.length ? h.state.fetchQueue.shift()! : h.state.fetchMode;
      if (mode === "throw") throw new Error("This operation was aborted");
      if (mode === "notok") return new Response("{}", { status: 404, statusText: "Not Found" });
      return new Response(JSON.stringify(h.state.hireStudents), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    }
  };
});

vi.mock("@/lib/authGuard", () => ({ requireAuth: async () => ({}) }));

const { GET, POST } = await import("@/app/api/hirescore/route");

const post = (query = "") =>
  POST(new Request(`http://localhost/api/hirescore${query}`, { method: "POST" }) as any);

beforeEach(() => {
  h.batches.length = 0;
  h.singleWrites.length = 0;
  h.fetchCalls.length = 0;
  Object.assign(h.state, {
    hireStudents: [],
    localStudents: [],
    fetchMode: "ok" as const,
    fetchQueue: [] as ("ok" | "throw" | "notok")[],
    multiQueryFails: 0
  });
});

function matchedSet(count: number) {
  h.state.hireStudents = Array.from({ length: count }, (_, i) => ({
    registrationNumber: `REG${i}`,
    hireScore: 600 + i,
    email: `s${i}@x.com`
  }));
  h.state.localStudents = Array.from({ length: count }, (_, i) => ({
    id: `stu_${i}`,
    name: `Student ${i}`,
    roll_number: `REG${i}`,
    email: `s${i}@x.com`,
    phone: ""
  }));
}

describe("POST /api/hirescore", () => {
  it("applies matched students in batched chunks instead of one awaited UPDATE each", async () => {
    matchedSet(450);

    const res = await post();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.syncedCount).toBe(450);
    expect(body.failedCount).toBe(0);
    expect(h.batches.map(b => b.length)).toEqual([200, 200, 50]);
    expect(h.batches.flat().every(q => /UPDATE students SET/.test(q.sql))).toBe(true);
    expect(h.batches.flat().every(q => q.params.length === 8)).toBe(true);
    // No per-row round trips left in the loop.
    expect(h.singleWrites).toHaveLength(0);
  });

  it("keeps the WHERE id param last so a batch cannot retarget rows", async () => {
    matchedSet(3);
    await post();
    const rows = h.batches.flat();
    expect(rows.map(r => r.params[7])).toEqual(["stu_0", "stu_1", "stu_2"]);
    expect(rows[0].params[0]).toBe("600");
    expect(rows[2].params[0]).toBe("602");
  });

  it("reports a partial sync instead of dying half-applied", async () => {
    matchedSet(10);
    h.state.multiQueryFails = 3;

    const res = await post();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.syncedCount).toBe(7);
    expect(body.failedCount).toBe(3);
    expect(body.message).toContain("3 updates failed");
  });

  it("writes nothing when the HireScore master list is unreachable", async () => {
    matchedSet(5);
    h.state.fetchMode = "throw";

    const res = await post();
    const body = await res.json();

    expect(res.status).toBe(504);
    expect(body.message).toContain("did not respond within");
    expect(h.batches).toHaveLength(0);
    expect(h.singleWrites).toHaveLength(0);
  });

  it("refuses a non-ok master list before touching the database", async () => {
    h.state.fetchMode = "notok";
    const res = await post();
    expect(res.status).toBe(502);
    expect(h.batches).toHaveLength(0);
  });

  it("scopes a college_id sync to that campus", async () => {
    matchedSet(2);
    await post("?college_id=c1");
    expect(h.batches.flat()).toHaveLength(2);
  });
});

describe("GET /api/hirescore", () => {
  it("passes through a live score lookup", async () => {
    matchedSet(1);
    const res = await GET(new Request("http://localhost/api/hirescore?regNo=REG0") as any);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(h.fetchCalls).toEqual(["https://hire-score-fawn.vercel.app/api/scores/REG0"]);
    expect(body.success).toBe(true);
  });

  it("answers 504 rather than hanging when the upstream stalls", async () => {
    h.state.fetchMode = "throw";
    const res = await GET(new Request("http://localhost/api/hirescore?regNo=REG0") as any);
    const body = await res.json();
    expect(res.status).toBe(504);
    expect(body.message).toContain("did not respond within");
  });

  it("falls back to the full roster when the single-score route 404s", async () => {
    matchedSet(2);
    h.state.fetchQueue = ["notok", "ok"];
    const res = await GET(new Request("http://localhost/api/hirescore?regNo=REG1") as any);
    const body = await res.json();
    expect(h.fetchCalls).toEqual([
      "https://hire-score-fawn.vercel.app/api/scores/REG1",
      "https://hire-score-fawn.vercel.app/api/students"
    ]);
    expect(res.status).toBe(200);
    expect(body.student.registrationNumber).toBe("REG1");
  });
});
