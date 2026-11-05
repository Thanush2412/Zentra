import { describe, it, expect, vi } from "vitest";

/**
 * `gate` blocks the fake lookups until released, so the tests can observe how
 * many round trips a set of concurrent calls actually produced.
 */
const h = vi.hoisted(() => {
  const state: any = { sessionCalls: 0, userSelects: 0, tokens: [] as string[] };
  state.gate = new Promise<void>((resolve) => { state.release = resolve; });
  return state;
});

vi.mock("@/lib/db", () => ({
  getDb: async () => ({
    // The combined identity read returns users + profile rows in one statement.
    all: async () => {
      h.userSelects++;
      await h.gate;
      return [
        {
          id: "u-1",
          reference_id: "r-1",
          role: "mentor",
          email: "mentor@example.com",
          status: "Active",
          must_change_password: 0,
          table_key: "mentors",
          profile_id: "r-1",
          profile_name: "Mentor One",
          profile_college_id: "col-1"
        }
      ];
    },
    get: async () => {
      h.userSelects++;
      await h.gate;
      return {
        id: "u-1",
        reference_id: "r-1",
        role: "mentor",
        email: "mentor@example.com",
        name: "Mentor One",
        must_change_password: 0
      };
    }
  })
}));

vi.mock("@/lib/session", async (importOriginal) => {
  const real = await importOriginal<any>();
  return {
    ...real,
    SESSION_COOKIE_NAME: "ecampus_session",
    validateSession: async (_db: any, token: string) => {
      h.sessionCalls++;
      h.tokens.push(token);
      await h.gate;
      return {
        isValid: true,
        userId: "u-1",
        csrfSecret: "secret",
        session: { id: "s-1", token_hash: "hash", user_id: "u-1" }
      };
    }
  };
});

import { loadSession, loadUser } from "../src/lib/authGuard";

describe("identity lookup coalescing", () => {
  it("shares one session round trip across concurrent identical tokens", async () => {
    const before = h.sessionCalls;
    const p1 = loadSession("tok-abc");
    const p2 = loadSession("tok-abc");
    h.release();
    const [a, b] = await Promise.all([p1, p2]);

    expect(h.sessionCalls - before).toBe(1);
    expect(a.userId).toBe("u-1");
    expect(b.userId).toBe("u-1");
  });

  it("does not cache across requests once settled", async () => {
    const before = h.sessionCalls;
    await loadSession("tok-abc");
    await loadSession("tok-abc");
    expect(h.sessionCalls - before).toBe(2);
  });

  it("keeps distinct in-flight entries per token", async () => {
    const before = h.sessionCalls;
    await Promise.all([loadSession("tok-x"), loadSession("tok-y")]);
    expect(h.sessionCalls - before).toBe(2);
    expect(h.tokens.slice(-2)).toEqual(["tok-x", "tok-y"]);
  });

  it("hands waiters separate copies so a route cannot mutate shared state", async () => {
    const [a, b] = await Promise.all([loadUser("u-1"), loadUser("u-1")]);
    expect(a).not.toBe(b);
    (a as any).name = "Tampered";
    expect((b as any).name).not.toBe("Tampered");
  });

  it("costs one read when concurrent and two when sequential", async () => {
    // Identity is users + role profile in a single statement, so one coalesced
    // call is exactly 1 round trip and an uncoalesced pair is 2.
    const before = h.userSelects;
    await Promise.all([loadUser("u-9"), loadUser("u-9")]);
    const concurrent = h.userSelects - before;

    const middle = h.userSelects;
    await loadUser("u-10");
    await loadUser("u-10");
    const sequential = h.userSelects - middle;

    expect(concurrent).toBe(1);
    expect(sequential).toBe(2);
  });
});
