import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => {
  const reads: string[] = [];
  const writes: { sql: string; params: any[] }[] = [];

  const state = {
    nameMatches: [] as any[],
    raceMatches: [] as any[],
    slugMatches: [] as any[],
    deptRow: null as any,
    insertError: null as string | null,
    nameProbeCalls: 0
  };

  const makeDb = () => ({
    all: async (sql: string) => {
      reads.push(sql);
      return [];
    },
    get: async (sql: string) => {
      reads.push(sql);
      if (sql.includes("FROM departments")) return state.deptRow;
      return null;
    },
    run: async (sql: string, ...args: any[]) => {
      writes.push({ sql, params: args.length === 1 && Array.isArray(args[0]) ? args[0] : args });
      if (sql.includes("INSERT INTO courses") && state.insertError) {
        throw new Error(state.insertError);
      }
      return { changes: 1 };
    },
    multiQuery: async (queries: { sql: string; params?: any[] }[]) =>
      queries.map(q => {
        reads.push(q.sql);
        if (q.sql.includes("SELECT * FROM courses WHERE LOWER(TRIM(name))")) {
          const isPreflight = state.nameProbeCalls++ === 0;
          return isPreflight ? state.nameMatches : state.raceMatches;
        }
        if (q.sql.includes("SELECT id FROM courses WHERE id")) return state.slugMatches;
        return [];
      })
  });

  return { reads, writes, state, makeDb };
});

vi.mock("@/lib/db", () => ({ getDb: async () => h.makeDb() }));
vi.mock("@/lib/authGuard", () => ({ requireAuth: async () => ({}), Role: {} }));

const { POST } = await import("@/app/api/courses/route");

const COURSE = {
  name: "B.Sc Computer Science",
  college_id: "c2",
  code: "BSCS",
  years: 3
};

const post = (body: any = COURSE) =>
  POST(new Request("http://localhost/api/courses", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  }) as any);

beforeEach(() => {
  h.reads.length = 0;
  h.writes.length = 0;
  Object.assign(h.state, {
    nameMatches: [],
    raceMatches: [],
    slugMatches: [],
    deptRow: null,
    insertError: null,
    nameProbeCalls: 0
  });
});

describe("POST /api/courses across campuses", () => {
  it("creates the same course name for a second campus", async () => {
    const res = await post();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.course.college_id).toBe("c2");

    const courseInsert = h.writes.find(w => w.sql.includes("INSERT INTO courses"));
    expect(courseInsert?.params[2]).toBe("c2");
    expect(h.writes.some(w => w.sql.includes("UPDATE courses"))).toBe(false);
  });

  it("refuses a name held by another campus instead of moving that course", async () => {
    // Simulates a database that still carries the old global UNIQUE on courses.name.
    h.state.insertError = 'duplicate key value violates unique constraint "courses_name_key"';
    h.state.raceMatches = [];

    const res = await post();
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.message).toContain("another campus");
    expect(h.writes.some(w => w.sql.includes("UPDATE courses"))).toBe(false);
  });

  it("rejects a duplicate name inside the same campus before inserting", async () => {
    h.state.nameMatches = [{ id: "dept_c2_b_sc", name: COURSE.name, college_id: "c2" }];

    const res = await post();
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.message).toContain("in this campus");
    expect(h.writes).toHaveLength(0);
  });

  it("updates the same-campus row when a concurrent create wins the insert race", async () => {
    h.state.insertError = 'duplicate key value violates unique constraint "courses_college_name_uniq"';
    h.state.raceMatches = [{ id: "dept_c2_b_sc", name: COURSE.name, college_id: "c2" }];

    const res = await post();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    const update = h.writes.find(w => w.sql.includes("UPDATE courses"));
    expect(update?.params[0]).toBe("c2");
    expect(update?.params[update.params.length - 1]).toBe("dept_c2_b_sc");
  });
});
