import { describe, it, expect, vi, afterEach } from "vitest";
import { apiFetch } from "../src/lib/apiFetch";

type Call = { url: string; init: any };

function stubFetch(json: any = { success: true }) {
  const calls: Call[] = [];
  vi.stubGlobal("fetch", async (url: any, init: any) => {
    calls.push({ url: String(url), init });
    return {
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => json,
      text: async () => JSON.stringify(json),
    };
  });
  return calls;
}

afterEach(() => vi.unstubAllGlobals());

describe("apiFetch cache policy", () => {
  it("lets server-cached GETs use normal HTTP caching", async () => {
    const calls = stubFetch();
    await apiFetch("/api/data/reference");

    const { url, init } = calls[0];
    expect(url).not.toContain("_t=");
    expect(init.cache).toBe("default");
    expect(init.headers["Cache-Control"]).toBeUndefined();
    expect(init.headers["Pragma"]).toBeUndefined();
  });

  it("preserves the distinct URL per query param so keys do not collide", async () => {
    const calls = stubFetch();
    await apiFetch("/api/data/reference?college_id=7");
    await apiFetch("/api/data/reference");

    expect(calls.map((c) => c.url)).toEqual([
      "/api/data/reference?college_id=7",
      "/api/data/reference",
    ]);
  });

  it("still busts and no-stores every other GET", async () => {
    const calls = stubFetch();
    await apiFetch("/api/colleges");

    const { url, init } = calls[0];
    expect(url).toContain("_t=");
    expect(init.cache).toBe("no-store");
    expect(init.headers["Cache-Control"]).toContain("no-store");
    expect(init.headers["Pragma"]).toBe("no-cache");
  });

  it("honors an explicit cache option over both defaults", async () => {
    const calls = stubFetch();
    await apiFetch("/api/colleges", { cache: "no-cache" });
    expect(calls[0].init.cache).toBe("no-cache");

    await apiFetch("/api/data/reference", { cache: "reload" });
    expect(calls[1].init.cache).toBe("reload");
  });

  it("does not treat a server-cached path as a mutation", async () => {
    const calls = stubFetch();
    await apiFetch("/api/data/reference", { method: "POST", body: { a: 1 } });

    expect(calls[0].url).toBe("/api/data/reference");
    expect(calls[0].init.cache).toBe("no-store");
  });
});
