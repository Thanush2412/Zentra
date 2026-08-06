import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { sendMail } from "@/lib/mail";

export async function POST(request: Request) {
  try {
    const db = await getDb();
    const body = await request.json();

    const { interview_id, mapped_mentor_ids = [], student_count, cm_name = "Campus Manager" } = body;

    if (!interview_id) {
      return NextResponse.json({ success: false, message: "Missing interview_id" }, { status: 400 });
    }

    const interview = await db.get("SELECT * FROM student_interviews WHERE id = ?", [interview_id]);
    if (!interview) {
      return NextResponse.json({ success: false, message: "Interview request not found" }, { status: 404 });
    }

    const assignedIdsStr = JSON.stringify(mapped_mentor_ids);
    const updatedCount = Number(student_count) || interview.student_count || 10;
    const now = new Date().toISOString();

    await db.run(
      `UPDATE student_interviews 
       SET assigned_mentor_ids = ?, student_count = ?, status = 'assigned', updated_at = ?
       WHERE id = ?`,
      [assignedIdsStr, updatedCount, now, interview_id]
    );

    // Send notification emails to mapped mentors and KAM
    try {
      const mentors = await db.all(
        `SELECT email, name FROM mentors WHERE id IN (${mapped_mentor_ids.map(() => "?").join(",")})`,
        mapped_mentor_ids
      );

      const recipientEmails = mentors.map((m: any) => m.email).filter(Boolean);

      if (recipientEmails.length > 0) {
        await sendMail({
          to: recipientEmails.join(", "),
          subject: `[Interview Assignment] ${interview.subject} Interview Scheduled for ${interview.target_date}`,
          htmlBody: `
            <div style="font-family: Arial, sans-serif; padding: 20px;">
              <h2>Student Interview Assignment Notification</h2>
              <p>Campus Manager <strong>${cm_name}</strong> has assigned you to conduct student interviews for <strong>${interview.subject}</strong>.</p>
              <ul>
                <li><strong>Target Subject:</strong> ${interview.subject}</li>
                <li><strong>Assigned Student Count:</strong> ${updatedCount}</li>
                <li><strong>Target Date:</strong> ${interview.target_date}</li>
                <li><strong>Interview Type:</strong> ${interview.type.toUpperCase()}</li>
                <li><strong>Topics:</strong> ${interview.topics || "General Review"}</li>
                ${interview.gmeet_link ? `<li><strong>Google Meet Link:</strong> <a href="${interview.gmeet_link}">${interview.gmeet_link}</a></li>` : ""}
              </ul>
              <p>Please log in to your dashboard to mark attendance and evaluate assigned students.</p>
            </div>
          `
        });
      }
    } catch (mailErr) {
      console.warn("Mail notification failed during interview assignment:", mailErr);
    }

    return NextResponse.json({
      success: true,
      message: `Successfully assigned ${updatedCount} students & mapped ${mapped_mentor_ids.length} mentor(s) to this interview.`
    });
  } catch (error: any) {
    console.error("POST /api/interviews/assign error:", error);
    return NextResponse.json({ success: false, message: error.message || "Failed to assign interview" }, { status: 500 });
  }
}
