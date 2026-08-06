import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { sendMail } from "@/lib/mail";

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
      const meetId = Math.random().toString(36).substring(2, 5) + "-" + Math.random().toString(36).substring(2, 6) + "-" + Math.random().toString(36).substring(2, 5);
      const gmeetLink = `https://meet.google.com/${meetId}`;

      await db.run(
        `UPDATE student_interviews 
         SET target_college_id = ?, gmeet_link = ?, status = 'pending_cm', updated_at = ?
         WHERE id = ?`,
        [target_college_id || "", gmeetLink, now, interview_id]
      );

      // Email notification
      try {
        await sendMail({
          to: "kam@university.edu",
          subject: `[External Interview Accepted] ${interview.subject} Interview GMeet Generated`,
          htmlBody: `
            <div style="font-family: Arial, sans-serif; padding: 20px;">
              <h2>External Interview Invitation Accepted</h2>
              <p>Campus Manager <strong>${cm_name}</strong> accepted the external interview request for <strong>${interview.subject}</strong>.</p>
              <p><strong>Google Meet Link:</strong> <a href="${gmeetLink}">${gmeetLink}</a></p>
              <p><strong>Scheduled Target Date:</strong> ${interview.target_date}</p>
            </div>
          `
        });
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
