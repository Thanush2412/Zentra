import { readFileSync } from "fs";
import { join } from "path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  describeCappedSections,
  describeFailedSections,
  describeLoadFailure
} from "@/lib/dataLoadStatus";

const httpError = (status: number, message: string, code?: string) =>
  Object.assign(new Error(message), { status, code });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("describeLoadFailure", () => {
  it("calls an expired session a session, not a database outage", () => {
    for (const code of ["NO_SESSION", "SESSION_EXPIRED", "SESSION_IDLE"]) {
      const report = describeLoadFailure(httpError(401, "Unauthorized", code));
      expect(report.cause).toBe("session");
      expect(report.message).toMatch(/session expired/i);
    }
  });

  it("reports the status the server actually returned for a failed read", () => {
    const report = describeLoadFailure(httpError(500, "connection terminated"));
    expect(report.cause).toBe("server");
    expect(report.message).toContain("500");
    expect(report.message).not.toMatch(/couldn't reach the database/i);
  });

  it("separates an unreachable server from a rejected response", () => {
    expect(describeLoadFailure(new TypeError("Failed to fetch")).cause).toBe("network");
    expect(describeLoadFailure(Object.assign(new Error("boom"), { name: "AbortError" })).cause).toBe("cancelled");
  });

  it("says offline when the browser reports no connection", () => {
    vi.stubGlobal("navigator", { onLine: false });
    const report = describeLoadFailure(new TypeError("Failed to fetch"));
    expect(report.cause).toBe("offline");
    expect(report.message).toMatch(/offline/i);
  });

  it("falls back to the error's own message instead of inventing a cause", () => {
    const report = describeLoadFailure(httpError(418, "Upstream refused the query"));
    expect(report.cause).toBe("unknown");
    expect(report.message).toBe("Upstream refused the query");
    expect(describeLoadFailure(undefined).message).toMatch(/could not be loaded/i);
  });
});

describe("section naming", () => {
  it("names the lists that failed instead of blaming the database", () => {
    expect(describeFailedSections(["slots", "student_academic_tracker"])).toBe(
      "These lists failed to load: slots, student academic tracker. Their data may be stale."
    );
  });

  it("keeps a long list readable", () => {
    const named = describeFailedSections(["a", "b", "c", "d", "e", "f"]);
    expect(named).toContain("a, b, c, d and 2 more");
  });

  it("still says something useful when the server names nothing", () => {
    expect(describeFailedSections([])).toMatch(/could not be read/i);
  });

  it("describes a capped list as a cap, not a failure", () => {
    const notice = describeCappedSections(["announcements", "audit_logs"]);
    expect(notice).toMatch(/newest rows only/i);
    expect(notice).toContain("announcements, audit logs");
    expect(notice).not.toMatch(/failed/i);
    expect(describeCappedSections([])).toBe("");
  });
});

describe("the banner no longer folds caps into outages", () => {
  const root = process.cwd();
  const read = (rel: string) => readFileSync(join(root, rel), "utf8");

  it("keeps /api/data partial scoped to slices that failed to read", () => {
    const src = read("src/app/api/data/route.ts");
    expect(src).toMatch(/partial:\s*failedSlices\.length > 0,/);
    expect(src).not.toMatch(/partial:\s*failedSlices\.length > 0 \|\| truncatedSections\.length > 0/);
  });

  it("feeds capped sections to its own notice in the client", () => {
    const ctx = read("src/context/AppContext.tsx");
    expect(ctx).toContain("data.truncatedSections");
    expect(ctx).toContain("cappedSections");
    const layout = read("src/components/DashboardLayout.tsx");
    expect(layout).toContain("describeCappedSections(cappedSections)");
    // The outage sentence survives only as a fallback, never as the only message.
    expect(layout).toMatch(/dataLoadMessage \|\| /);
    expect(layout).toContain("Couldn't reach the database");
  });
});
