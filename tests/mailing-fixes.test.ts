import { describe, it, expect, vi } from "vitest";
import { readFileSync, readdirSync, statSync } from "fs";
import { resolve, join } from "path";

// mail.ts reads the mailing_enabled toggle from the DB; keep the pool out of the test run.
vi.mock("@/lib/db", () => ({
  getDb: async () => ({
    get: async () => null,
    all: async () => [],
    run: async () => ({})
  })
}));

import {
  BRAND,
  renderSwapOfferEmail,
  renderHandoverRequestEmail,
  renderAccountWelcomeEmail,
} from "@/lib/mail";
import { DEFAULT_PASSWORD } from "@/lib/authConfig";

/**
 * Covers the open items in docs/ISSUES_MAILING.md that are fixed by template
 * behaviour (M03, M10, L09, M15) plus static gates for the fixes that live in
 * route code only (M11, M12, M16, M17, L06, L08).
 */

function source(file: string): string {
  return readFileSync(resolve(process.cwd(), file), "utf8");
}

function handlerBlock(file: string, name: string): string {
  const src = source(file);
  const start = src.indexOf(`export async function ${name}(`);
  expect(start, `${name} missing in ${file}`).toBeGreaterThan(-1);
  const next = src.indexOf("export async function ", start + 10);
  return src.slice(start, next === -1 ? src.length : next);
}

function tsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...tsFiles(full));
    else if (/\.tsx?$/.test(full)) out.push(full);
  }
  return out;
}

describe("swap offer template (MAIL-L09)", () => {
  it("labels a lecture cover compensation as a Class swap, not a Demo swap", () => {
    const cls = renderSwapOfferEmail({
      requestorName: "Asha",
      targetMentorName: "Ravi",
      dateStr: "Monday, 05 Oct 2026",
      time: "09:00 AM (Monday)",
      course: "Verbal Ability",
      classGroup: "VA-Batch-3",
      kind: "class",
    });
    expect(cls).toContain("Class Swap Request Received");
    expect(cls).toContain("Class Swap Proposal");
    expect(cls).not.toContain("Demo Swap");
  });

  it("keeps the demo wording when no kind is passed", () => {
    const demo = renderSwapOfferEmail({
      requestorName: "Asha",
      targetMentorName: "Ravi",
      dateStr: "Monday, 05 Oct 2026",
      time: "09:00 AM (Monday)",
      course: "Verbal Ability",
      classGroup: "VA-Batch-3",
    });
    expect(demo).toContain("Demo Swap Request Received");
  });

  it("points the CTA at the supplied deep link instead of the homepage", () => {
    const html = renderSwapOfferEmail({
      requestorName: "Asha",
      targetMentorName: "Ravi",
      dateStr: "Monday, 05 Oct 2026",
      time: "09:00 AM (Monday)",
      course: "Verbal Ability",
      classGroup: "VA-Batch-3",
      kind: "class",
      ctaUrl: `${BRAND.portalUrl}/mentor/handovers`,
    });
    expect(html).toContain(`href="${BRAND.portalUrl}/mentor/handovers"`);
  });
});

describe("handover request CTA (MAIL-M03)", () => {
  const base = {
    requestorName: "Asha",
    coverStaffName: "Ravi",
    dateStr: "Monday, 05 Oct 2026",
    time: "09:00 AM (Monday)",
    course: "Verbal Ability",
    classGroup: "VA-Batch-3",
  };

  it("deep-links to the recipient's handover tab when the caller supplies one", () => {
    const html = renderHandoverRequestEmail({ ...base, ctaUrl: `${BRAND.portalUrl}/mentor/handovers` });
    expect(html).toContain(`href="${BRAND.portalUrl}/mentor/handovers"`);
  });

  it("still falls back to the portal homepage when it does not", () => {
    const html = renderHandoverRequestEmail(base);
    expect(html).toContain(`href="${BRAND.portalUrl}"`);
  });

  it("the creating route passes the deep link", () => {
    expect(source("src/app/api/requests/route.ts")).toContain(
      'ctaUrl: `${BRAND.portalUrl}/mentor/handovers`'
    );
  });
});

describe("subject prefix sourcing (MAIL-M10)", () => {
  it("is only ever written in the BRAND constant", () => {
    const offenders = tsFiles(join(process.cwd(), "src"))
      .filter((f) => !f.endsWith(join("src", "lib", "mail.ts")))
      .filter((f) => readFileSync(f, "utf8").includes("[FACE Prep E-Campus]"))
      .map((f) => f.replace(process.cwd() + "\\", ""));
    expect(offenders).toEqual([]);
  });
});

describe("account welcome mail (MAIL-M15)", () => {
  it("never mails the shared default password", () => {
    const html = renderAccountWelcomeEmail({
      recipientName: "Ravi",
      loginEmail: "ravi@faceprepcampus.com",
      roleLabel: "Faculty Mentor",
    });
    expect(html).toContain("ravi@faceprepcampus.com");
    expect(html).toContain("Faculty Mentor");
    expect(html).not.toContain(DEFAULT_PASSWORD);
  });

  it("is dispatched from both account-creation routes", () => {
    expect(handlerBlock("src/app/api/mentors/route.ts", "POST")).toContain("sendAccountWelcomeEmail");
    expect(handlerBlock("src/app/api/cam/route.ts", "POST")).toContain("sendAccountWelcomeEmail");
  });
});

describe("student leave notifications (MAIL-M11, M16, M17)", () => {
  it("escalates an unassigned cohort to the campus managers, not every mentor on campus", () => {
    const post = handlerBlock("src/app/api/requests/leave/route.ts", "POST");
    expect(post).not.toContain("SELECT email FROM mentors WHERE college_id");
    expect(post).not.toContain("Unassigned (All Mentors)");
  });

  it("stops re-signing a resolution with a caller-supplied name", () => {
    const put = handlerBlock("src/app/api/requests/leave/route.ts", "PUT");
    expect(put).toContain("const { auth, errorResponse } = await requireAuth");
    expect(put).toContain("auth?.user?.name");
    expect(put).not.toContain("const { requestId, status, approvedBy } = body");
  });

  it("returns an empty campus view instead of other campuses' leave rows", () => {
    const get = handlerBlock("src/app/api/requests/leave/route.ts", "GET");
    expect(get).not.toContain("Fallback");
    expect(get.match(/db\.all\(/g) || []).toHaveLength(1);
  });
});

describe("demo-swap queue scoping (MAIL-L06)", () => {
  it("restricts mentors and SMEs to proposals that name them", () => {
    const get = handlerBlock("src/app/api/requests/demo-swap/route.ts", "GET");
    expect(get).toContain('role === "mentor" ? ["mentorId", "proposedMentorId"] : ["smeId", "proposedSmeId"]');
    expect(get).toContain("WHERE ${ownerCol} IN (${ph}) OR ${proposedCol} IN (${ph})");
    expect(get).toContain("const { auth, errorResponse } = await requireAuth");
  });
});

describe("regional interview notifications (MAIL-L08)", () => {
  it("resolves roles and writes notifications in one round-trip each", () => {
    const src = source("src/lib/interview-notifications.ts");
    expect(src).not.toMatch(/for \(const userId of Array\.from\(notificationUserIds\)\)/);
    expect(src).not.toMatch(/SELECT role FROM users WHERE id = \?/);
    // Set-based, and chunked so a regional broadcast cannot outgrow the bind ceiling.
    expect(src).toContain("readInChunks(db, candidates, (chunk, ph) => ({");
    expect(src).toContain("reference_id IN (${ph}) OR email IN (${ph})");
    expect(src).toContain('for (const part of chunkList(notifRows, 500))');
    expect(src).toContain('part.map(() => "(?, ?, ?, ?, 0, ?, ?)").join(", ")');
    expect(src.match(/INSERT INTO notifications/g)).toHaveLength(1);
  });
});

describe("demo compliance escalation (MAIL-M12)", () => {
  it("sends one mail with the SME copied instead of a second mail", () => {
    const src = source("src/app/api/demo-sessions/route.ts");
    expect(src).not.toContain("sendMail does not support CC");
    expect(src).toContain("cc: dedupCc");
    expect(src.match(/renderDemoComplianceEmail\(\{/g) || []).toHaveLength(1);
  });

  it("keeps the allowlisted template names wired in the mail relay", () => {
    const src = source("src/app/api/send-mail/route.ts");
    expect(src).toContain("demo_swap: (data) => renderSwapOfferEmail(data)");
    expect(src).toContain('class_swap: (data) => renderSwapOfferEmail({ ...data, kind: "class" })');
    expect(src).not.toContain("renderDemoSwapEmail");
  });

  it("routes a class swap offer through the class template with a deep link", () => {
    const post = handlerBlock("src/app/api/requests/swap/route.ts", "POST");
    expect(post).toContain("renderSwapOfferEmail({");
    expect(post).toContain('kind: "class"');
    expect(post).toContain("ctaUrl: `${BRAND.portalUrl}/mentor/handovers`");
  });
});
