import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => {
  const state = {
    scopeKamId: null as string | null,
    profiles: [] as any[],
    credentials: [] as any[],
    profile: null as any,
    credential: null as any,
    college: null as any,
    runs: [] as { sql: string; params: any[] }[]
  };

  const tx = {
    run: async (sql: string, params: any[] = []) => {
      state.runs.push({ sql, params });
      return { changes: 1 };
    },
    get: async (sql: string) => {
      if (sql.includes("FROM users")) return state.credential;
      if (sql.includes("FROM kam_users")) return state.profile;
      return null;
    }
  };

  const db = {
    get: async (sql: string) => {
      if (sql.includes("FROM users")) return state.credential;
      if (sql.includes("FROM kam_users")) return state.profile;
      if (sql.includes("FROM colleges")) return state.college;
      return null;
    },
    all: async () => [],
    multiQuery: async (queries: { sql: string; params?: any[] }[]) =>
      queries.map(q => {
        if (q.sql.includes("FROM kam_users")) return state.profiles;
        if (q.sql.includes("FROM users WHERE id = ?")) return state.credentials.filter(c => c.id === q.params?.[0]);
        if (q.sql.includes("FROM users")) return state.credentials;
        return [];
      }),
    transaction: async (fn: (t: typeof tx) => Promise<void>) => fn(tx)
  };

  return { state, db };
});

vi.mock("@/lib/db", () => ({ getDb: async () => h.db }));
vi.mock("@/lib/authGuard", () => ({ requireAuth: async () => ({}) }));
vi.mock("@/lib/kamScope", () => ({
  requireKamScope: async () => ({ scope: { kamId: h.state.scopeKamId, allowedCollegeIds: null, auth: { role: "admin" } } })
}));

const { GET, POST, DELETE } = await import("@/app/api/kam/route");

const jsonRequest = (method: string, body?: any) =>
  new Request("http://localhost/api/kam", {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined
  }) as any;

beforeEach(() => {
  h.state.scopeKamId = null;
  h.state.profiles = [];
  h.state.credentials = [];
  h.state.profile = null;
  h.state.credential = null;
  h.state.college = null;
  h.state.runs.length = 0;
});

describe("GET /api/kam?all=1", () => {
  it("returns profiles plus credential-only KAMs so no login is invisible", async () => {
    h.state.profiles = [{ id: "kam_1", name: "Rajesh Kumar", email: "rajesh@x.edu", title: "KAM" }];
    h.state.credentials = [{ id: "user_9", email: "solo@x.edu", reference_id: null }];

    const res = await GET(new Request("http://localhost/api/kam?all=1") as any);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.kamUsers).toEqual([
      { id: "kam_1", name: "Rajesh Kumar", email: "rajesh@x.edu", title: "KAM" },
      { id: "user_9", name: "solo", email: "solo@x.edu", title: "Key Account Manager" }
    ]);
  });

  it("does not list a legacy credential twice when its profile is already present", async () => {
    h.state.profiles = [{ id: "kam_1", name: "Rajesh Kumar", email: "rajesh@x.edu", title: "KAM" }];
    h.state.credentials = [{ id: "user_42", email: "RAJESH@x.edu", reference_id: null }];

    const res = await GET(new Request("http://localhost/api/kam?all=1") as any);
    const body = await res.json();

    expect(body.kamUsers).toHaveLength(1);
    expect(body.kamUsers[0].id).toBe("kam_1");
  });

  it("does not let a KAM session enumerate every profile", async () => {
    h.state.scopeKamId = "kam_1";

    const res = await GET(new Request("http://localhost/api/kam?all=1") as any);

    expect(res.status).toBe(403);
  });
});

describe("POST /api/kam", () => {
  it("creates the profile and its login credential in one transaction", async () => {
    const res = await POST(jsonRequest("POST", {
      id: "kam_2",
      name: "New KAM",
      email: "New.KAM@X.edu",
      title: "Region Head"
    }));

    expect(res.status).toBe(200);
    const profileInsert = h.state.runs.find(r => r.sql.includes("INSERT INTO kam_users"));
    const credentialInsert = h.state.runs.find(r => r.sql.includes("INSERT INTO users"));
    expect(profileInsert?.params).toEqual(["kam_2", "New KAM", "new.kam@x.edu", "Region Head"]);
    expect(credentialInsert?.params.slice(0, 2)).toEqual(["kam_2", "new.kam@x.edu"]);
    expect(credentialInsert?.params[3]).toBe("kam_2");
    expect(credentialInsert?.sql).toContain("'kam'");
    expect(credentialInsert?.sql).toContain("must_change_password");
  });

  it("rejects an email that already has a credential", async () => {
    h.state.credentials = [{ id: "user_1", email: "taken@x.edu", reference_id: "someone" }];

    const res = await POST(jsonRequest("POST", { id: "kam_3", name: "Dup", email: "taken@x.edu" }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.message).toMatch(/already exists/i);
    expect(h.state.runs).toHaveLength(0);
  });
});

describe("DELETE /api/kam", () => {
  it("removes the credential together with the profile", async () => {
    h.state.profile = { id: "kam_2", email: "new.kam@x.edu" };

    const res = await DELETE(new Request("http://localhost/api/kam?id=kam_2", { method: "DELETE" }) as any);

    expect(res.status).toBe(200);
    expect(h.state.runs.some(r => r.sql.includes("DELETE FROM users"))).toBe(true);
    expect(h.state.runs.some(r => r.sql.includes("DELETE FROM kam_users"))).toBe(true);
  });

  it("refuses to delete a KAM still assigned to campuses", async () => {
    h.state.profile = { id: "kam_2", email: "new.kam@x.edu" };
    h.state.college = { id: "college_1", kam_id: "kam_2" };

    const res = await DELETE(new Request("http://localhost/api/kam?id=kam_2", { method: "DELETE" }) as any);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(h.state.runs).toHaveLength(0);
  });
});
