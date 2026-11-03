import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => {
  const batches: { sql: string; params: any[] }[][] = [];
  const singleReads: string[] = [];
  const writes: string[] = [];

  const state = {
    role: "student",
    referenceId: "st1",
    student: null as any,
    cam: null as any,
    fees: [] as any[],
    payments: [] as any[],
    students: [] as any[],
    failOn: null as string | null
  };

  const rowsFor = (sql: string): any[] => {
    if (sql.includes("FROM students WHERE id = ?")) return state.student ? [state.student] : [];
    if (sql.includes("FROM campus_managers")) return state.cam ? [state.cam] : [];
    if (sql.includes("FROM student_fees")) return state.fees;
    if (sql.includes("FROM fee_payments")) return state.payments;
    if (sql.includes("FROM students")) return state.students;
    return [];
  };

  const makeDb = () => ({
    multiQuery: async (queries: { sql: string; params?: any[] }[], failures?: any[]) => {
      const norm = queries.map(q => ({ sql: q.sql, params: [...(q.params || [])] }));
      batches.push(norm);
      return norm.map(q => {
        if (failures && state.failOn && q.sql.includes(state.failOn)) {
          failures.push({ sql: q.sql, error: "connection timeout" });
          return [];
        }
        return rowsFor(q.sql);
      });
    },
    get: async (sql: string) => {
      singleReads.push(sql);
      if (sql.includes("FROM campus_managers")) return state.cam;
      if (sql.includes("FROM students WHERE id = ?")) return state.student;
      return null;
    },
    all: async (sql: string) => {
      singleReads.push(sql);
      return rowsFor(sql);
    },
    run: async (sql: string) => {
      writes.push(sql);
      return { changes: 1 };
    },
    exec: async () => {}
  });

  return { batches, singleReads, writes, state, makeDb };
});

vi.mock("@/lib/db", () => ({ getDb: async () => h.makeDb() }));
vi.mock("@/lib/authGuard", () => ({
  requireAuth: async () => ({
    auth: { user: { role: h.state.role, reference_id: h.state.referenceId, email: "u@example.com" } },
    errorResponse: null
  })
}));

const { GET } = await import("@/app/api/fees/route");

const get = (query = "") => GET(new Request(`http://localhost/api/fees${query ? `?${query}` : ""}`) as any);

beforeEach(() => {
  h.batches.length = 0;
  h.singleReads.length = 0;
  h.writes.length = 0;
  Object.assign(h.state, {
    role: "student",
    referenceId: "st1",
    student: { id: "st1", name: "Farhan", email: "f@example.com", classGroup: "CSE-3A", department: "CSE" },
    cam: null,
    fees: [{ id: "f1", student_id: "st1", amount: 5000, paid_amount: 2000, status: "partial" }],
    payments: [{ id: "p1", student_id: "st1", amount: 2000, payment_date: "2026-10-01" }],
    students: [{ id: "st1", name: "Farhan" }],
    failOn: null
  });
});

describe("GET /api/fees (student)", () => {
  it("reads the profile and both ledgers in one batched group", async () => {
    const res = await get();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(h.batches).toHaveLength(1);
    expect(h.batches[0]).toHaveLength(3);
    expect(h.batches[0][0].params).toEqual(["st1"]);
    expect(h.singleReads).toHaveLength(0);
    expect(body.student.id).toBe("st1");
    expect(body.stats).toMatchObject({ totalFees: 5000, totalPaid: 2000, totalOutstanding: 3000, partialCount: 1 });
  });

  it("applies the date filter as bound parameters inside the same group", async () => {
    const res = await get("from=2026-10-01&to=2026-10-31");
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(h.batches[0][1].sql).toContain("AND created_at >= ?");
    expect(h.batches[0][1].params).toEqual(["st1", "2026-10-01", "2026-10-31T23:59:59.999Z"]);
  });

  it("returns 404 only when the profile row is genuinely absent", async () => {
    h.state.student = null;

    const res = await get();
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.message).toContain("Student not found");
  });

  it("fails loudly when a ledger slice errors instead of showing zero dues", async () => {
    h.state.failOn = "FROM student_fees";

    const res = await get();
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.success).toBe(false);
  });

  it("still treats a failed profile slice as an error, not a missing student", async () => {
    h.state.failOn = "FROM students WHERE id = ?";

    const res = await get();

    expect(res.status).toBe(500);
  });
});

describe("GET /api/fees (cm)", () => {
  beforeEach(() => {
    h.state.role = "cm";
    h.state.referenceId = "cm1";
    h.state.cam = { id: "cm1", name: "Kala", college_id: "c1" };
  });

  it("resolves the campus once, then batches the roster and both ledgers", async () => {
    const res = await get();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(h.singleReads).toHaveLength(1);
    expect(h.batches).toHaveLength(1);
    expect(h.batches[0]).toHaveLength(3);
    expect(h.batches[0][1].sql).toContain("student_id IN (SELECT id FROM students WHERE college_id = ?)");
    expect(h.batches[0][1].params).toEqual(["c1"]);
    expect(body.stats.totalStudents).toBe(1);
  });

  it("fails loudly when the campus roster slice errors", async () => {
    h.state.failOn = "FROM students WHERE college_id";

    const res = await get();

    expect(res.status).toBe(500);
  });
});
