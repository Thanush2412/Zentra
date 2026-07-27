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

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { to, subject, htmlBody, template, data } = body;

    if (!to || !subject) {
      return NextResponse.json({ success: false, message: "Missing to or subject" }, { status: 400 });
    }

    let finalHtml = htmlBody;

    if (template && data) {
      switch (template) {
        case "missed_attendance":
          finalHtml = renderMissedAttendanceEmail(data);
          break;
        case "handover_request":
          finalHtml = renderHandoverRequestEmail(data);
          break;
        case "handover_approval":
          finalHtml = renderHandoverApprovalEmail(data);
          break;
        case "handover_rejection":
          finalHtml = renderHandoverRejectionEmail(data);
          break;
        case "demo_swap":
          finalHtml = renderDemoSwapEmail(data);
          break;
        case "sme_evaluation":
          finalHtml = renderSmeEvaluationEmail(data);
          break;
        case "timetable_update":
          finalHtml = renderTimetableUpdateEmail(data);
          break;
        case "announcement":
          finalHtml = renderAnnouncementEmail(data);
          break;
        case "custom":
          finalHtml = renderEmailShell({
            title: data.title || subject,
            badgeText: data.badgeText || "Operational Notice",
            badgeColor: data.badgeColor || "indigo",
            description: data.description || "",
            details: data.details || [],
            ctaText: data.ctaText,
            ctaUrl: data.ctaUrl,
          });
          break;
      }
    }

    if (!finalHtml) {
      return NextResponse.json({ success: false, message: "Missing htmlBody or template details" }, { status: 400 });
    }

    const res = await sendMail({ to, subject, htmlBody: finalHtml });
    return NextResponse.json(res);
  } catch (error: any) {
    console.error("API POST send-mail error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
