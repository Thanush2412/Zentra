import { readFileSync } from "fs";
import { join } from "path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => {
  const state = { role: "L and D", reads: [] as { sql: string; params: any[] }[] };
  return {
    state,
    makeDb: () => ({
      all: async (sql: string, ...params: any[]) => {
        state.reads.push({ sql, params: params.flat() });
        return [{ id: "ds1" }, { id: "ds2" }];
      },
      get: async (sql: string) => {
        state.reads.push({ sql, params: [] });
        return null;
      },
      run: async () => ({ changes: 0 })
    })
  };
});

vi.mock("@/lib/db", async () => {
  const actual = await vi.importActual<typeof import("@/lib/db")>("@/lib/db");
  return { ...actual, getDb: async () => h.makeDb() };
});
vi.mock("@/lib/migrations", () => ({ ensureMigration: async () => {} }));
vi.mock("@/lib/api-auth", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api-auth")>("@/lib/api-auth");
  return {
    ...actual,
    requireRole: async () => ({ role: h.state.role } as any),
    requireSession: async () => ({ role: h.state.role } as any),
    apiAuthErrorResponse: () => null
  };
});

const { GET } = await import("@/app/api/demo-sessions/route");

const get = (query: string) =>
  GET(new Request(`http://localhost/api/demo-sessions${query}`, { method: "GET" }) as any);

const json = async (res: Response) => res.json();

beforeEach(() => {
  h.state.role = "L and D";
  h.state.reads = [];
});

describe("GET /api/demo-sessions college_id=all", () => {
  it("answers the L&D institution-wide read with one unscoped query", async () => {
    const res = await get("?college_id=all");
    expect(res.status).toBe(200);
    expect(h.state.reads).toHaveLength(1);
    const [read] = h.state.reads;
    expect(read.sql).toContain("FROM demo_sessions");
    expect(read.sql).not.toContain("JOIN mentors");
    expect(read.params).toEqual([]);
  });

  it("maps a legacy allocator token onto the same allowed read", async () => {
    h.state.role = "allocator";
    const res = await get("?college_id=all");
    expect(res.status).toBe(200);
    expect(h.state.reads).toHaveLength(1);
  });

  it("lets admin and head SME through the institution-wide read", async () => {
    for (const role of ["admin", "head_sme"]) {
      h.state.role = role;
      h.state.reads = [];
      expect((await get("?college_id=all")).status).toBe(200);
      expect(h.state.reads).toHaveLength(1);
    }
  });

  it("refuses college_id=all for campus-scoped staff before touching the database", async () => {
    for (const role of ["cm", "sme", "kam"]) {
      h.state.role = role;
      h.state.reads = [];
      const res = await get("?college_id=all");
      expect(res.status).toBe(403);
      expect(await json(res)).toMatchObject({ success: false });
      expect(h.state.reads).toHaveLength(0);
    }
  });

  it("keeps the per-college read scoped through the mentors join", async () => {
    h.state.role = "cm";
    const res = await get("?college_id=col_1");
    expect(res.status).toBe(200);
    expect(h.state.reads).toHaveLength(1);
    expect(h.state.reads[0].sql).toContain("JOIN mentors m ON m.id = ds.mentorId");
    expect(h.state.reads[0].sql).toContain("m.college_id = ?");
    expect(h.state.reads[0].params).toEqual(["col_1"]);
  });

  it("still rejects a request with no college at all", async () => {
    const res = await get("");
    expect(res.status).toBe(400);
    expect(h.state.reads).toHaveLength(0);
  });
});

describe("L&D demo-session fan-out is collapsed", () => {
  const root = process.cwd();
  const read = (rel: string) => readFileSync(join(root, rel), "utf8");
  const PER_COLLEGE = /\/api\/demo-sessions\?college_id=\$\{encodeURIComponent\(/;

  it("resolves a reallocation with one college_id=all request, not one per campus", () => {
    const src = read("src/components/LndAllocationDashboard.tsx");
    expect(src).toContain('apiFetch<any>("/api/demo-sessions?college_id=all")');
    expect(src).not.toMatch(PER_COLLEGE);
  });

  it("drops the unscoped demo reads that the endpoint could only answer with 400", () => {
    const src = read("src/context/AppContext.tsx");
    expect(src).not.toMatch(PER_COLLEGE);
    expect(src).not.toMatch(/colleges\.map\([^)]*demo-sessions/s);
    const workspace = src.slice(
      src.indexOf("const loadRoleWorkspace"),
      src.indexOf("const initApp")
    );
    expect(workspace.length).toBeGreaterThan(0);
    // SME and L&D demo rows come from the role-scoped /api/data slice instead.
    expect(workspace).not.toContain("/api/demo-sessions");
    expect(workspace).toContain("/api/sme-availability");
  });
});
