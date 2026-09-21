import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  createSessionToken,
  verifySessionToken,
  buildSessionCookie,
  buildClearSessionCookie,
  SESSION_COOKIE_NAME,
} from "../src/lib/session";

const ENV_BACKUP = { ...process.env };

describe("session tokens", () => {
  beforeAll(() => {
    process.env.SESSION_SECRET = "test-secret-123";
    process.env.NODE_ENV = "test";
  });
  afterAll(() => {
    process.env = { ...ENV_BACKUP };
  });

  it("round-trips a valid token", () => {
    const token = createSessionToken({ userId: "u1", role: "mentor" });
    const payload = verifySessionToken(token);
    expect(payload).not.toBeNull();
    expect(payload!.userId).toBe("u1");
    expect(payload!.role).toBe("mentor");
    expect(payload!.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
  });

  it("rejects a tampered payload", () => {
    const token = createSessionToken({ userId: "u1", role: "mentor" });
    const [body, sig] = token.split(".");
    const forged = Buffer.from(JSON.stringify({ userId: "u2", role: "admin", exp: 9999999999 })).toString("base64url");
    expect(verifySessionToken(`${forged}.${sig}`)).toBeNull();
    expect(verifySessionToken(`${body}.badsig`)).toBeNull();
  });

  it("rejects expired tokens", () => {
    const token = createSessionToken({ userId: "u1", role: "mentor" }, -10);
    expect(verifySessionToken(token)).toBeNull();
  });

  it("rejects garbage", () => {
    expect(verifySessionToken(null)).toBeNull();
    expect(verifySessionToken("")).toBeNull();
    expect(verifySessionToken("nonsense")).toBeNull();
    expect(verifySessionToken("a.b.c")).toBeNull();
  });

  it("builds HttpOnly cookie headers", () => {
    const cookie = buildSessionCookie("tok");
    expect(cookie).toContain(`${SESSION_COOKIE_NAME}=tok`);
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
    const clear = buildClearSessionCookie();
    expect(clear).toContain("Max-Age=0");
  });
});
