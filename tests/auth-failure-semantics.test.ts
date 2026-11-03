import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => {
  const state: any = {};
  state.loadSession = vi.fn();
  state.loadUser = vi.fn();
  return state;
});

vi.mock("@/lib/authGuard", () => ({
  extractSessionToken: (request: any) => request.__token ?? null,
  normalizeRole: (role: string) => role,
  loadSession: (token: string) => h.loadSession(token),
  loadUser: (userId: string) => h.loadUser(userId)
}));

vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() }
}));

import {
  getSessionFromRequest,
  requireSession,
  apiAuthErrorResponse,
  ApiAuthError
} from "../src/lib/api-auth";

const request = (token?: string) => ({ __token: token, headers: new Headers() }) as any;

beforeEach(() => {
  h.loadSession.mockReset();
  h.loadUser.mockReset();
});

describe("auth failure semantics", () => {
  it("treats a session lookup failure as 503, not a logged-out user", async () => {
    h.loadSession.mockRejectedValue(new Error("connection timeout"));

    await expect(getSessionFromRequest(request("tok"))).rejects.toBeInstanceOf(ApiAuthError);
    await expect(getSessionFromRequest(request("tok"))).rejects.toMatchObject({ status: 503 });
  });

  it("treats a user lookup failure as 503", async () => {
    h.loadSession.mockResolvedValue({ isValid: true, userId: "u-1", session: {} });
    h.loadUser.mockRejectedValue(new Error("relation users does not exist"));

    await expect(getSessionFromRequest(request("tok"))).rejects.toMatchObject({ status: 503 });
  });

  it("still returns null for a genuinely invalid session", async () => {
    h.loadSession.mockResolvedValue({ isValid: false, reason: "idle_timeout" });
    expect(await getSessionFromRequest(request("tok"))).toBeNull();

    h.loadSession.mockResolvedValue({ isValid: true, userId: "u-1", session: {} });
    h.loadUser.mockResolvedValue(null);
    expect(await getSessionFromRequest(request("tok"))).toBeNull();
  });

  it("returns the payload on the happy path", async () => {
    h.loadSession.mockResolvedValue({ isValid: true, userId: "u-1", session: {} });
    h.loadUser.mockResolvedValue({
      id: "u-1", reference_id: "r-1", role: "mentor",
      email: "m@example.com", college_id: "c-1", name: "Mentor"
    });

    expect(await getSessionFromRequest(request("tok"))).toEqual({
      userId: "r-1", role: "mentor", email: "m@example.com", collegeId: "c-1", name: "Mentor"
    });
  });

  it("keeps requireSession at 401 for a missing cookie but 503 for an outage", async () => {
    await expect(requireSession(request())).rejects.toMatchObject({ status: 401 });

    const res = apiAuthErrorResponse(new ApiAuthError("Authentication is temporarily unavailable.", 503));
    expect(res?.status).toBe(503);
  });
});
