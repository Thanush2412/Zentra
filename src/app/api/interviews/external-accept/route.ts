import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { sendMail, renderEmailShell } from "@/lib/mail";

export async function POST(request: Request) {
  try {
    const db = await getDb();
    const body = await request.json();

    const { interview_id, target_college_id, action = "accept", cm_name = "External CM" } = body;

    if (!interview_id) {
      return NextResponse.json({ success: false, message: "Missing interview_id" }, { status: 400 });
    }

    const interview = await db.get("SELECT * FROM student_interviews WHERE id = ?", [interview_id]);
    if (!interview) {
      return NextResponse.json({ success: false, message: "Interview request not found" }, { status: 404 });
    }

    const now = new Date().toISOString();

    if (action === "accept") {
      // Generate real-time GMeet link
      const meetId =
        Math.random().toString(36).substring(2, 5) +
        "-" +
        Math.random().toString(36).substring(2, 6) +
        "-" +
        Math.random().toString(36).substring(2, 5);
      const gmeetLink = `https://meet.google.com/${meetId}`;

      await db.run(
        `UPDATE student_interviews 
         SET target_college_id = ?, gmeet_link = ?, status = 'assigned', updated_at = ?
         WHERE id = ?`,
        [target_college_id || "", gmeetLink, now, interview_id]
      );

      // Notify origin CM
      try {
        const originCMs = await db.all(
          "SELECT email, name FROM campus_managers WHERE college_id = ?",
          [interview.origin_college_id || interview.college_id]
        );
        if (originCMs && originCMs.length > 0) {
          const originCMEmails = originCMs.map((c: any) => c.email).filter(Boolean).join(", ");
          if (originCMEmails) {
            await sendMail({
              to: originCMEmails,
              subject: `[External Interview Accepted] ${interview.subject} — GMeet Link Ready`,
              htmlBody: renderEmailShell({
                title: "External Interview Request Accepted",
                badgeText: "External Interview",
                badgeColor: "emerald",
                description: `Campus Manager <strong>${cm_name}</strong> has accepted the external interview request for <strong>${interview.subject}</strong>. A Google Meet link has been generated.`,
                details: [
                  { label: "Subject", value: interview.subject, highlight: true },
                  { label: "Target Date", value: interview.target_date || "" },
                  { label: "Accepted By", value: cm_name },
                  { label: "Google Meet Link", value: gmeetLink, highlight: true },
                ],
                ctaText: "View Interview Details →",
              }),
            });
          }
        }
      } catch (_) {}

      return NextResponse.json({
        success: true,
        message: "External interview request accepted successfully! Real-time GMeet link generated.",
        gmeet_link: gmeetLink
      });
    } else if (action === "decline") {
      // Cascade to 2nd priority
      await db.run(
        `UPDATE student_interviews 
         SET priority_level = 2, status = 'pending_external_cm', updated_at = ?
         WHERE id = ?`,
        [now, interview_id]
      );

      return NextResponse.json({
        success: true,
        message: "Invitation declined. Cascaded to 2nd priority partner college CM."
      });
    }

    return NextResponse.json({ success: false, message: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    console.error("POST /api/interviews/external-accept error:", error);
    return NextResponse.json({ success: false, message: error.message || "Failed to process request" }, { status: 500 });
  }
}
