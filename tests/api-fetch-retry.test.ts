import { afterEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "../src/lib/apiFetch";

const okResponse = () => ({
  ok: true,
  status: 200,
  headers: new Headers({ "content-type": "application/json" }),
  json: async () => ({ success: true }),
  text: async () => JSON.stringify({ success: true }),
});

afterEach(() => vi.unstubAllGlobals());

describe("apiFetch network retry", () => {
  it("retries a dropped GET once and succeeds on the second attempt", async () => {
    const calls: string[] = [];
    vi.stubGlobal("fetch", async (url: any) => {
      calls.push(String(url));
      if (calls.length === 1) throw new TypeError("Failed to fetch");
      return okResponse();
    });

    await expect(apiFetch("/api/data?role=admin&userId=admin_1")).resolves.toEqual({ success: true });
    expect(calls).toHaveLength(2);
  });

  it("never retries a mutation, so a dropped POST cannot write twice", async () => {
    let calls = 0;
    vi.stubGlobal("fetch", async () => {
      calls++;
      throw new TypeError("Failed to fetch");
    });

    await expect(apiFetch("/api/colleges", { method: "POST", body: { name: "CSE" } })).rejects.toThrow("Failed to fetch");
    expect(calls).toBe(1);
  });

  it("does not retry a deliberate abort", async () => {
    let calls = 0;
    vi.stubGlobal("fetch", async () => {
      calls++;
      const err: any = new Error("The operation was aborted.");
      err.name = "AbortError";
      throw err;
    });

    await expect(apiFetch("/api/data")).rejects.toThrow("aborted");
    expect(calls).toBe(1);
  });

  it("does not retry an HTTP error response", async () => {
    let calls = 0;
    vi.stubGlobal("fetch", async () => {
      calls++;
      return {
        ok: false,
        status: 500,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => ({ message: "boom" }),
        text: async () => "{}",
      };
    });

    await expect(apiFetch("/api/data")).rejects.toThrow("boom");
    expect(calls).toBe(1);
  });
});
