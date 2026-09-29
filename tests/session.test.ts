import { describe, it, expect, beforeEach } from "vitest";
import {
  createUserSession,
  validateSession,
  revokeSession,
  revokeAllUserSessions,
  buildSessionCookie,
  buildCsrfCookie,
  buildClearSessionCookies,
  SESSION_COOKIE_NAME,
  UserSessionRecord
} from "../src/lib/session";
import { generateCsrfToken, verifyCsrfToken, CSRF_COOKIE_NAME } from "../src/lib/csrf";

// In-memory mock DB adapter for testing session storage
function createMockDb() {
  const sessions = new Map<string, UserSessionRecord>();

  const unwrap = (params: any[]): any[] => {
    if (params.length === 1 && Array.isArray(params[0])) {
      return params[0];
    }
    return params;
  };

  return {
    sessions,
    async exec(_sql: string) {},
    async run(sql: string, ...rawParams: any[]) {
      const params = unwrap(rawParams);
      if (sql.includes("INSERT INTO user_sessions")) {
        const [
          session_id_hash,
          user_id,
          created_at,
          last_activity_at,
          expires_at,
          csrf_secret,
          ip_address,
          user_agent
        ] = params;

        sessions.set(session_id_hash, {
          session_id_hash,
          user_id,
          created_at,
          last_activity_at,
          expires_at,
          is_revoked: 0,
          csrf_secret,
          ip_address,
          user_agent
        });
      } else if (sql.includes("UPDATE user_sessions SET last_activity_at")) {
        const [last_activity_at, session_id_hash] = params;
        const s = sessions.get(session_id_hash);
        if (s) {
          s.last_activity_at = last_activity_at;
        }
      } else if (sql.includes("UPDATE user_sessions SET is_revoked = 1")) {
        if (sql.includes("WHERE session_id_hash = ?")) {
          // Can be called with [now, hash] or [hash]
          const hash = params[params.length - 1];
          const s = sessions.get(hash);
          if (s) {
            s.is_revoked = 1;
            s.revoked_reason = params.length > 1 ? params[0] : "revoked";
          }
        } else if (sql.includes("WHERE user_id = ?")) {
          const userId = params[params.length - 1];
          for (const s of sessions.values()) {
            if (s.user_id === userId) {
              s.is_revoked = 1;
              s.revoked_reason = params.length > 1 ? params[0] : "revoked";
            }
          }
        }
      }
      return { changes: 1 };
    },
    async get(sql: string, ...rawParams: any[]) {
      const params = unwrap(rawParams);
      if (sql.includes("FROM user_sessions WHERE session_id_hash = ?")) {
        const hash = params[0];
        const s = sessions.get(hash);
        return s ? { ...s } : undefined;
      }
      return undefined;
    },
    async all(sql: string, ...rawParams: any[]) {
      const params = unwrap(rawParams);
      if (sql.includes("FROM user_sessions WHERE user_id = ?")) {
        const userId = params[0];
        return Array.from(sessions.values()).filter(s => s.user_id === userId);
      }
      return [];
    }
  } as any;
}

describe("Masked CSRF Protection", () => {
  it("generates and verifies masked CSRF tokens for the same secret", () => {
    const secret = "test-secret-value-12345678901234567890";
    const token = generateCsrfToken(secret);
    expect(token).toBeDefined();
    expect(token).toContain(".");
    expect(verifyCsrfToken(token, secret)).toBe(true);
  });

  it("produces different tokens on each call (random salt masking) but both verify", () => {
    const secret = "test-secret-value-12345678901234567890";
    const token1 = generateCsrfToken(secret);
    const token2 = generateCsrfToken(secret);
    expect(token1).not.toBe(token2);
    expect(verifyCsrfToken(token1, secret)).toBe(true);
    expect(verifyCsrfToken(token2, secret)).toBe(true);
  });

  it("rejects token verified against a different secret", () => {
    const secret1 = "secret-one-11111111111111111111";
    const secret2 = "secret-two-22222222222222222222";
    const token = generateCsrfToken(secret1);
    expect(verifyCsrfToken(token, secret2)).toBe(false);
  });

  it("rejects malformed or empty CSRF tokens", () => {
    const secret = "test-secret";
    expect(verifyCsrfToken(null, secret)).toBe(false);
    expect(verifyCsrfToken("", secret)).toBe(false);
    expect(verifyCsrfToken("randomgarbage", secret)).toBe(false);
    expect(verifyCsrfToken("bad.format.too.many", secret)).toBe(false);
  });
});

describe("Persistent Database Sessions", () => {
  let db: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    db = createMockDb();
  });

  it("creates an opaque session and validates it via SHA-256 hash lookup", async () => {
    const { rawToken, csrfToken, expiresAt } = await createUserSession(db, "user_101", {
      ip: "192.168.1.1",
      userAgent: "Mozilla/5.0"
    });

    expect(rawToken.length).toBeGreaterThanOrEqual(32);
    expect(csrfToken).toBeDefined();
    expect(expiresAt).toBeDefined();

    const validation = await validateSession(db, rawToken);
    expect(validation.isValid).toBe(true);
    expect(validation.userId).toBe("user_101");
    expect(validation.session).toBeDefined();
    expect(validation.csrfSecret).toBeDefined();
  });

  it("rejects invalid or non-existent raw tokens", async () => {
    const validation = await validateSession(db, "non_existent_raw_token_value");
    expect(validation.isValid).toBe(false);
    expect(validation.reason).toBe("invalid");
  });

  it("enforces 60-minute idle inactivity timeout", async () => {
    const { rawToken } = await createUserSession(db, "user_102");

    // Artificially simulate 61 minutes of inactivity
    const sixtyOneMinsAgo = new Date(Date.now() - 61 * 60 * 1000).toISOString();
    const hash = Array.from(db.sessions.keys())[0];
    db.sessions.get(hash)!.last_activity_at = sixtyOneMinsAgo;

    const validation = await validateSession(db, rawToken);
    expect(validation.isValid).toBe(false);
    expect(validation.reason).toBe("idle_timeout");
  });

  it("enforces 7-day hard maximum ceiling", async () => {
    const { rawToken } = await createUserSession(db, "user_103");

    // Artificially set expires_at in the past
    const past = new Date(Date.now() - 1000).toISOString();
    const hash = Array.from(db.sessions.keys())[0];
    db.sessions.get(hash)!.expires_at = past;

    const validation = await validateSession(db, rawToken);
    expect(validation.isValid).toBe(false);
    expect(validation.reason).toBe("expired");
  });

  it("revokes a single device session cleanly", async () => {
    const { rawToken } = await createUserSession(db, "user_104");
    await revokeSession(db, rawToken, "logout");

    const validation = await validateSession(db, rawToken);
    expect(validation.isValid).toBe(false);
    expect(validation.reason).toBe("revoked");
  });

  it("revokes all sessions globally for a user on password change", async () => {
    const session1 = await createUserSession(db, "user_105");
    const session2 = await createUserSession(db, "user_105");

    await revokeAllUserSessions(db, "user_105", "password_reset");

    const val1 = await validateSession(db, session1.rawToken);
    const val2 = await validateSession(db, session2.rawToken);

    expect(val1.isValid).toBe(false);
    expect(val1.reason).toBe("revoked");
    expect(val2.isValid).toBe(false);
    expect(val2.reason).toBe("revoked");
  });
});

describe("Cookie Headers", () => {
  it("builds secure HttpOnly session cookie", () => {
    const cookie = buildSessionCookie("sample_raw_token");
    expect(cookie).toContain(`${SESSION_COOKIE_NAME}=sample_raw_token`);
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain("Path=/");
  });

  it("builds CSRF cookie for client request transmission", () => {
    const cookie = buildCsrfCookie("sample_csrf_token");
    expect(cookie).toContain(`${CSRF_COOKIE_NAME}=sample_csrf_token`);
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain("Path=/");
  });

  it("builds clear cookies on logout", () => {
    const clearCookies = buildClearSessionCookies();
    expect(clearCookies).toHaveLength(2);
    expect(clearCookies[0]).toContain("Max-Age=0");
    expect(clearCookies[1]).toContain("Max-Age=0");
  });
});
