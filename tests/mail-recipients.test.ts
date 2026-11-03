import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// sendMail reads the mailing_enabled toggle from the database before sending.
vi.mock("@/lib/db", () => ({
  getDb: async () => ({
    get: async () => null,
    all: async () => [],
    run: async () => ({})
  })
}));

import { sendMail } from "@/lib/mail";

let captured: any[] = [];

function lastBrevoBody() {
  const call = captured[captured.length - 1];
  expect(call.url).toBe("https://api.brevo.com/v3/smtp/email");
  return JSON.parse(call.init.body);
}

describe("sendMail recipient handling", () => {
  beforeEach(() => {
    captured = [];
    process.env.BREVO_API_KEY = "test-key";
    process.env.BREVO_SENDER_EMAIL = "no-reply@faceprep.in";
    process.env.ADMIN_AUDIT_EMAIL = "";
    vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
      captured.push({ url, init });
      return { ok: true, json: async () => ({ messageId: "mid-1" }) };
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.BREVO_API_KEY;
  });

  it("delivers an array passed as `to` instead of dropping it silently", async () => {
    const res = await sendMail({
      to: ["cm@faceprep.in", "kam@faceprep.in"],
      subject: "Leave approval needed",
      htmlBody: "<p>hi</p>"
    });
    expect(res.success).toBe(true);
    expect(lastBrevoBody().to.map((r: any) => r.email)).toEqual(["cm@faceprep.in", "kam@faceprep.in"]);
  });

  it("accepts a comma-separated list and dedupes it", async () => {
    await sendMail({
      to: "a@faceprep.in, b@faceprep.in ,a@faceprep.in,not-an-email",
      subject: "s",
      htmlBody: "<p>hi</p>"
    });
    expect(lastBrevoBody().to.map((r: any) => r.email)).toEqual(["a@faceprep.in", "b@faceprep.in"]);
  });

  it("keeps a bcc-only audience hidden behind the institution mailbox", async () => {
    await sendMail({
      bcc: ["s1@student.faceprep.in", "s2@student.faceprep.in"],
      subject: "Weekly task assigned",
      htmlBody: "<p>hi</p>"
    });
    const body = lastBrevoBody();
    expect(body.to.map((r: any) => r.email)).toEqual(["no-reply@faceprep.in"]);
    expect(body.bcc.map((r: any) => r.email)).toEqual(["s1@student.faceprep.in", "s2@student.faceprep.in"]);
  });

  it("puts cc in Cc and merges the audit mailbox into the hidden BCC", async () => {
    process.env.ADMIN_AUDIT_EMAIL = "audit@faceprep.in";
    await sendMail({
      to: "mentor@faceprep.in",
      cc: "cm@faceprep.in",
      bcc: "sme@faceprep.in",
      subject: "s",
      htmlBody: "<p>hi</p>"
    });
    const body = lastBrevoBody();
    expect(body.cc.map((r: any) => r.email)).toEqual(["cm@faceprep.in"]);
    expect(body.bcc.map((r: any) => r.email)).toEqual(["sme@faceprep.in", "audit@faceprep.in"]);
  });

  it("refuses to send when no address survives validation", async () => {
    const res = await sendMail({ to: "garbage", subject: "s", htmlBody: "<p>hi</p>" });
    expect(res.success).toBe(false);
    expect(captured).toHaveLength(0);
  });
});
