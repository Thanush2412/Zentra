import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * GET /api/audit/placement returns a whole campus roster pulled from the
 * placement project with a key that bypasses RLS. It used to have that key in
 * source, no session check, and `campuses[0]` as the default campus — so any
 * anonymous caller could read any (or the first) college's students, offers and
 * CTC. These tests pin the identity check and the campus scoping.
 */
const h = vi.hoisted(() => {
  const state = {
    user: null as any,
    authError: null as any,
    cmCollege: null as any,
    kamPortfolio: [] as any[]
  };
  return { state, calls: [] as string[] };
});

vi.mock("@/lib/authGuard", () => ({
  requireAuth: async () => (h.state.authError ? { errorResponse: h.state.authError } : { auth: { user: h.state.user } })
}));

vi.mock("@/lib/db", async (importOriginal) => {
  // chunkList is the real helper; only the database handle is stubbed.
  const actual = await (importOriginal as any)();
  return {
    ...actual,
    getDb: async () => ({
      get: async () => h.state.cmCollege,
      all: async () => h.state.kamPortfolio
    })
  };
});

const { GET } = await import("@/app/api/audit/placement/route");

const CAMPUSES = [
  { id: "beta-1", name: "Beta Institute", code: "BIT" },
  { id: "alpha-1", name: "Alpha Institute", code: "AIT" }
];

const json = (body: any) => ({ ok: true, json: async () => body }) as any;

function mockUpstream(campuses: any[]) {
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    h.calls.push(String(url));
    if (String(url).includes("/rest/v1/campuses")) return json(campuses);
    if (String(url).includes("/rest/v1/students")) return json([]);
    if (String(url).includes("/rest/v1/offers")) return json([]);
    if (String(url).includes("/rest/v1/student_semesters")) return json([]);
    return json([]);
  }));
}

const get = (query = "") =>
  GET(new Request(`http://localhost/api/audit/placement${query}`, { method: "GET" }) as any);

beforeEach(() => {
  h.calls.length = 0;
  Object.assign(h.state, {
    user: { id: "u1", reference_id: "cam1", role: "cm", email: "cm@x.com", name: "CM", college_id: null, isSuperAdmin: false },
    authError: null,
    cmCollege: { name: "Alpha Institute" },
    kamPortfolio: []
  });
  process.env.PLACEMENT_SUPABASE_URL = "https://placement.example.supabase.co";
  process.env.PLACEMENT_SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
  delete process.env.PLACEMENT_SUPABASE_ANON_KEY;
  mockUpstream(CAMPUSES);
});

describe("GET /api/audit/placement configuration", () => {
  it("refuses to run without an upstream configured instead of using an embedded key", async () => {
    process.env.PLACEMENT_SUPABASE_URL = "";

    const res = await get();
    const body = await res.json();

    expect(res.status).toBe(503);
    expect(body.message).toContain("not configured");
    expect(h.calls).toHaveLength(0);
  });

  it("rejects a caller with no verified session", async () => {
    const { NextResponse } = await import("next/server");
    h.state.authError = NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

    const res = await get();

    expect(res.status).toBe(401);
    expect(h.calls).toHaveLength(0);
  });
});

describe("GET /api/audit/placement campus scope", () => {
  it("pins a CM with no ?college= to their own campus, not the first row", async () => {
    const res = await get();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.campus.id).toBe("alpha-1");
    expect(h.calls.find(u => u.includes("/rest/v1/students"))).toContain("campus_id=eq.alpha-1");
  });

  it("refuses a CM who asks for another college before reading any students", async () => {
    const res = await get("?college=Beta%20Institute");

    expect(res.status).toBe(403);
    expect(h.calls.filter(u => u.includes("/rest/v1/students"))).toHaveLength(0);
  });

  it("only lists campuses the caller may open in the picker", async () => {
    const body = await (await get()).json();

    expect(body.availableCampuses.map((c: any) => c.id)).toEqual(["alpha-1"]);
  });

  it("sends a CM with no campus on the record away with 403", async () => {
    h.state.cmCollege = null;

    const res = await get();
    expect(res.status).toBe(403);
    expect(h.calls).toHaveLength(0);
  });

  it("rejects a KAM whose portfolio has no colleges", async () => {
    h.state.user = { ...h.state.user, role: "kam", reference_id: "kam1" };
    h.state.kamPortfolio = [];

    const res = await get();
    expect(res.status).toBe(403);
  });

  it("lets a KAM read any college inside their portfolio", async () => {
    h.state.user = { ...h.state.user, role: "kam", reference_id: "kam1" };
    h.state.kamPortfolio = [{ name: "Alpha Institute" }, { name: "Beta Institute" }];

    const body = await (await get("?college=Beta%20Institute")).json();

    expect(body.campus.id).toBe("beta-1");
    expect(h.calls.find(u => u.includes("/rest/v1/students"))).toContain("campus_id=eq.beta-1");
    expect(body.availableCampuses).toHaveLength(2);
  });

  it("keeps admins institution-wide", async () => {
    h.state.user = { ...h.state.user, role: "admin", reference_id: "adm1" };

    const body = await (await get()).json();

    // No scoping read for an admin, and the whole campus picker is returned.
    expect(body.availableCampuses).toHaveLength(2);
    expect(body.campus.id).toBe("beta-1");
  });
});

describe("GET /api/audit/placement payload scope", () => {
  const STUDENT = {
    id: "11111111-1111-4111-8111-111111111111",
    full_name: "Asha",
    roll_number: "1",
    campus_id: "beta-1",
    passing_year: 2026,
    participation_status: "active",
    overall_cgpa: 8,
    current_arrears: 0
  };

  it("reads offers and semester rows for the campus roster, never the whole table", async () => {
    h.state.user = { ...h.state.user, role: "admin", reference_id: "adm1" };
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      h.calls.push(String(url));
      if (String(url).includes("/rest/v1/campuses")) return json(CAMPUSES);
      if (String(url).includes("/rest/v1/students")) return json([STUDENT]);
      return json([]);
    }));

    await get();

    for (const resource of ["offers", "student_semesters"]) {
      const url = h.calls.find(u => u.includes(`/rest/v1/${resource}`));
      expect(url, `${resource} read`).toContain(`student_id=in.(${STUDENT.id})`);
    }
  });

  it("fails the report when a scoped chunk errors instead of reporting zero offers", async () => {
    h.state.user = { ...h.state.user, role: "admin", reference_id: "adm1" };
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (String(url).includes("/rest/v1/campuses")) return json(CAMPUSES);
      if (String(url).includes("/rest/v1/students")) return json([STUDENT]);
      return { ok: false, status: 502, json: async () => ({ error: "upstream down" }) } as any;
    }));

    const res = await get();

    expect(res.status).toBe(500);
    expect((await res.json()).message).toContain("Placement offers read failed");
  });
});
