// Pin to Mumbai (bom1) — co-located with Supabase DB
export const preferredRegion = "bom1";
export const maxDuration = 60;

import { NextResponse } from "next/server";
import {
  sendMail,
  renderEmailShell,
  renderMissedAttendanceEmail,
  renderHandoverRequestEmail,
  renderHandoverApprovalEmail,
  renderHandoverRejectionEmail,
  renderDemoSwapEmail,
  renderSmeEvaluationEmail,
  renderTimetableUpdateEmail,
  renderAnnouncementEmail,
} from "@/lib/mail";
import { requireRole, apiAuthErrorResponse } from "@/lib/api-auth";

/**
 * Server-side allowlist (API_OPTIMIZATION_PLAN item 8): templates are the ONLY
 * way to compose mail — no raw htmlBody, and recipients must already exist in
 * the users/students/mentors tables. Prevents the endpoint being used as an
 * open spam/phishing relay.
 */

const ALLOWED_TEMPLATES: Record<string, (data: any) => string> = {
  missed_attendance: renderMissedAttendanceEmail,
  handover_request: renderHandoverRequestEmail,
  handover_approval: renderHandoverApprovalEmail,
  handover_rejection: renderHandoverRejectionEmail,
  demo_swap: renderDemoSwapEmail,
  sme_evaluation: renderSmeEvaluationEmail,
  timetable_update: renderTimetableUpdateEmail,
  announcement: renderAnnouncementEmail,
  custom: (data) =>
    renderEmailShell({
      title: data.title || "Operational Notice",
      badgeText: data.badgeText || "Operational Notice",
      badgeColor: data.badgeColor || "indigo",
      description: data.description || "",
      details: data.details || [],
      ctaText: data.ctaText,
      ctaUrl: data.ctaUrl,
    }),
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function recipientIsKnownUser(db: any, email: string): Promise<boolean> {
  const clean = email.toLowerCase().trim();
  const checks = [
    db.get("SELECT 1 FROM users WHERE LOWER(email) = ? AND status = 'Active'", [clean]),
    db.get("SELECT 1 FROM mentors WHERE LOWER(email) = ?", [clean]),
    db.get("SELECT 1 FROM students WHERE LOWER(email) = ?", [clean]),
    db.get("SELECT 1 FROM sme_users WHERE LOWER(email) = ?", [clean]),
    db.get("SELECT 1 FROM kam_users WHERE LOWER(email) = ?", [clean]),
    db.get("SELECT 1 FROM campus_managers WHERE LOWER(email) = ?", [clean]),
  ];
  for (const check of checks) {
    if (await check) return true;
  }
  return false;
}

export async function POST(request: Request) {
  try {
    // Only authenticated admins/CAMs may send mail via this endpoint.
    requireRole(request, "admin", "cam");

    const body = await request.json();
    const { to, subject, template, data } = body;

    if (!to || !subject) {
      return NextResponse.json({ success: false, message: "Missing to or subject" }, { status: 400 });
    }

    // Reject raw HTML payloads outright — templates only.
    if (body.htmlBody) {
      return NextResponse.json(
        { success: false, message: "Raw htmlBody is not accepted. Use an allowlisted template." },
        { status: 400 }
      );
    }

    const renderer = template ? ALLOWED_TEMPLATES[template] : null;
    if (!renderer) {
      return NextResponse.json(
        { success: false, message: `Unknown or missing template. Allowed: ${Object.keys(ALLOWED_TEMPLATES).join(", ")}` },
        { status: 400 }
      );
    }

    const finalHtml = renderer(data || {});

    // Recipient allowlist: every address must belong to a known user.
    const requested = String(to).split(",").map((e: string) => e.trim()).filter(Boolean);
    if (requested.length === 0 || requested.length > 10) {
      return NextResponse.json({ success: false, message: "Provide 1–10 recipient addresses." }, { status: 400 });
    }
    for (const email of requested) {
      if (!EMAIL_RE.test(email)) {
        return NextResponse.json({ success: false, message: `Invalid recipient address: ${email}` }, { status: 400 });
      }
      const db = await getDbSafe();
      if (!(await recipientIsKnownUser(db, email))) {
        return NextResponse.json(
          { success: false, message: `Recipient is not a known portal user: ${email}` },
          { status: 403 }
        );
      }
    }

    const res = await sendMail({ to, subject, htmlBody: finalHtml });
    return NextResponse.json(res);
  } catch (error: any) {
    const authRes = apiAuthErrorResponse(error);
    if (authRes) return authRes;
    console.error("API POST send-mail error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

async function getDbSafe() {
  const { getDb } = await import("@/lib/db");
  return getDb();
}
