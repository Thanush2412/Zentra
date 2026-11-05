import { describe, it, expect, vi } from "vitest";

/**
 * The activity stamp used to be an awaited UPDATE inside validateSession, which
 * put a database round trip in front of every authenticated request. These tests
 * pin the new shape: the read answers without writing, and the write is handed to
 * after() exactly once per burst.
 */
const h = vi.hoisted(() => ({
  afters: [] as (() => Promise<void> | void)[],
  writes: [] as string[],
  failNextRun: false,
  sessionRow: null as any
}));

vi.mock("next/server", () => ({
  NextResponse: { json: (body: any, init: any) => ({ body, init }) },
  after: (cb: () => Promise<void> | void) => { h.afters.push(cb); }
}));

vi.mock("@/lib/db", () => ({
  getDb: async () => ({
    exec: async () => {},
    get: async () => (h.sessionRow ? { ...h.sessionRow } : undefined),
    run: async (sql: string) => {
      if (h.failNextRun) throw new Error("connection terminated unexpectedly");
      h.writes.push(sql);
      return { changes: 1 };
    }
  })
}));

import { loadSession } from "../src/lib/authGuard";

function seedSession(overrides: Record<string, unknown> = {}) {
  const now = Date.now();
  h.afters.length = 0;
  h.writes.length = 0;
  h.failNextRun = false;
  h.sessionRow = {
    session_id_hash: `hash-${now}-${Math.random()}`,
    user_id: "user_mentor_1",
    created_at: new Date(now - 60 * 1000).toISOString(),
    last_activity_at: new Date(now - 5 * 60 * 1000).toISOString(), // past the 30s stamp window, well inside the 60min idle limit
    expires_at: new Date(now + 6 * 24 * 60 * 60 * 1000).toISOString(),
    is_revoked: false,
    csrf_secret: "secret-value",
    ...overrides
  };
  return h.sessionRow;
}

describe("deferred session activity stamp", () => {
  it("answers the validation read without writing first", async () => {
    seedSession();
    const res = await loadSession("raw-token-1");

    expect(res.isValid).toBe(true);
    expect(res.userId).toBe("user_mentor_1");
    expect(h.writes).toHaveLength(0);
    expect(h.afters).toHaveLength(1);
  });

  it("writes the stamp only once the response is on its way", async () => {
    seedSession();
    await loadSession("raw-token-2");
    await h.afters[0]();

    expect(h.writes.filter(sql => sql.includes("UPDATE user_sessions SET last_activity_at"))).toHaveLength(1);
  });

  it("collapses a concurrent burst onto a single stamp", async () => {
    seedSession();
    const results = await Promise.all([
      loadSession("raw-token-3"),
      loadSession("raw-token-3"),
      loadSession("raw-token-3")
    ]);

    expect(results.every(r => r.isValid)).toBe(true);
    expect(h.afters).toHaveLength(1);
  });

  it("leaves a recently active session alone", async () => {
    seedSession({ last_activity_at: new Date().toISOString() });
    await loadSession("raw-token-4");

    expect(h.afters).toHaveLength(0);
    expect(h.writes).toHaveLength(0);
  });

  it("still revokes on the 60-minute idle limit and does not stamp", async () => {
    seedSession({ last_activity_at: new Date(Date.now() - 61 * 60 * 1000).toISOString() });
    const res = await loadSession("raw-token-5");

    expect(res.isValid).toBe(false);
    expect(res.reason).toBe("idle_timeout");
    expect(h.afters).toHaveLength(0);
  });

  it("keeps a failed stamp away from the caller and retries it on the next request", async () => {
    seedSession();
    h.failNextRun = true;

    const res = await loadSession("raw-token-6");
    expect(res.isValid).toBe(true);
    await expect(h.afters[0]!()).resolves.toBeUndefined();
    expect(h.writes).toHaveLength(0);

    // The failure must not be remembered, otherwise the session silently stops
    // ageing and every user is logged out at the 60-minute idle line.
    h.failNextRun = false;
    h.afters.length = 0;
    await loadSession("raw-token-6");
    expect(h.afters).toHaveLength(1);

    await h.afters[0]!();
    expect(h.writes).toHaveLength(1);
  });
});
