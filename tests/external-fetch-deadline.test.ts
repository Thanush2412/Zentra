import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "fs";
import { resolve } from "path";

/**
 * Every server-side outbound call (Supabase REST, Brevo, Google Apps Script, Google
 * Sheets, HireScore) used to be awaited with no deadline. One stalled third party kept
 * the serverless function open until the platform killed it, so the user stared at a
 * spinner instead of getting an error. Everything must go through fetchWithTimeout.
 */
function tsFiles(dir: string): string[] {
  return readdirSync(resolve(process.cwd(), dir), { recursive: true })
    .filter((p) => typeof p === "string" && /\.tsx?$/.test(p))
    .map((p) => resolve(process.cwd(), dir, p as string));
}

/** `fetch("https://…")` — an absolute URL, i.e. off-box. Same-origin /api/ calls are not. */
const ABSOLUTE_FETCH = /\bfetch\(\s*[`"'](https?:\/\/[^`"']*)/;

describe("server-side outbound fetches have a deadline", () => {
  const files = [...tsFiles("src/app/api"), ...tsFiles("src/lib")];
  // Guard against a vacuous pass: this must actually be scanning the whole API layer.
  expect(files.length).toBeGreaterThan(100);

  const offenders: string[] = [];
  for (const file of files) {
    const source = readFileSync(file, "utf8");
    const lines = source.split(/\r?\n/);
    lines.forEach((line, i) => {
      if (!ABSOLUTE_FETCH.test(line)) return;
      offenders.push(`${file}:${i + 1} ${line.trim().slice(0, 90)}`);
    });
  }

  it("never calls fetch() with an absolute URL outside the shared helper", () => {
    expect(offenders).toEqual([]);
  });

  it("keeps the helper itself deadline-bound and env-tunable", () => {
    const net = readFileSync(resolve(process.cwd(), "src/lib/net.ts"), "utf8");
    expect(net).toMatch(/AbortController/);
    expect(net).toMatch(/signal: controller\.signal/);
    expect(net).toMatch(/clearTimeout\(timer\)/);
    expect(net).toMatch(/EXTERNAL_FETCH_TIMEOUT_MS/);
    expect(net).toMatch(/MAIL_FETCH_TIMEOUT_MS/);
    expect(net).toMatch(/UPLOAD_FETCH_TIMEOUT_MS/);
  });

  it("bounds the mail legs that used to hang a send open", () => {
    const mail = readFileSync(resolve(process.cwd(), "src/lib/mail.ts"), "utf8");
    expect(mail).toMatch(/fetchWithTimeout\("https:\/\/api\.brevo\.com/);
    expect(mail).toMatch(/fetchWithTimeout\(gasUrl/);
    // nodemailer has no fetch to deadline, so its socket timeouts must be set explicitly.
    expect(mail).toMatch(/connectionTimeout:\s*MAIL_FETCH_TIMEOUT_MS/);
    expect(mail).toMatch(/socketTimeout:/);
  });

  it("keeps the audit placement and tickets legs off the hung-request path", () => {
    const placement = readFileSync(resolve(process.cwd(), "src/app/api/audit/placement/route.ts"), "utf8");
    expect(placement).toMatch(/fetchWithTimeout\(\s*`\$\{supabaseUrl\}\/rest\/v1\/campuses/);
    expect(placement).toMatch(/fetchWithTimeout\(studentQuery/);
    const tickets = readFileSync(resolve(process.cwd(), "src/app/api/tickets/route.ts"), "utf8");
    expect(tickets).toMatch(/fetchWithTimeout\(`\$\{SUPABASE_REST_URL\}\/rest\/v1\/tickets\?\$\{query\}`/);
    expect(tickets).toMatch(/did not respond within/);
  });

  it("does not let a third-party timeout take the whole page down", () => {
    // skill-development already degrades per-section; the deadline must not change that.
    const report = readFileSync(resolve(process.cwd(), "src/app/api/reports/skill-development/route.ts"), "utf8");
    const leg = report.split(/\r?\n/).find((l) => l.includes("rest/v1/daily_logs"));
    expect(leg, "daily_logs leg missing").toBeTruthy();
    expect(leg!).toMatch(/fetchWithTimeout\(/);
    expect(leg!).toMatch(/\.catch\(\(\) => null\)/);
    // The observations photo upload must answer 502, not leak an AbortError message.
    // Each stage names itself in the message, so assert the shape + the status it maps to.
    const obs = readFileSync(resolve(process.cwd(), "src/app/api/audit/observations/route.ts"), "utf8");
    expect(obs).toMatch(/UPLOAD_FETCH_TIMEOUT_MS/);
    expect(obs).toMatch(/photo upload timed out[^\n]*,\s*502\)/);
    expect(obs).toMatch(/instanceof PhotoUploadError/);
  });
});
