import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { sendMail, renderEmailShell } from "@/lib/mail";

export async function POST(request: Request) {
  try {
    const db = await getDb();
    const body = await request.json();

    const {
      interview_id,
      mapped_mentor_ids = [],
      student_count,
      cm_name = "Campus Manager",
      gmeet_link = ""
    } = body;

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
       SET assigned_mentor_ids = ?, student_count = ?, status = 'assigned', 
           gmeet_link = ?, updated_at = ?
       WHERE id = ?`,
      [assignedIdsStr, updatedCount, gmeet_link || interview.gmeet_link || null, now, interview_id]
    );

    // Fetch mapped mentor details for email
    let mentorEmails: string[] = [];
    let mentorNames: string[] = [];
    try {
      if (mapped_mentor_ids.length > 0) {
        const mentors = await db.all(
          `SELECT email, name FROM mentors WHERE id IN (${mapped_mentor_ids.map(() => "?").join(",")})`,
          mapped_mentor_ids
        );
        mentorEmails = mentors.map((m: any) => m.email).filter(Boolean);
        mentorNames = mentors.map((m: any) => m.name).filter(Boolean);
      }
    } catch (_) {}

    // Send branded email to mapped mentors
    if (mentorEmails.length > 0) {
      try {
        await sendMail({
          to: mentorEmails.join(", "),
          subject: `[Interview Assignment] You have been assigned — ${interview.subject} on ${interview.target_date}`,
          htmlBody: renderEmailShell({
            title: "You Have Been Assigned to Conduct an Interview",
            badgeText: interview.type === "external" ? "External Interview" : "Internal Interview",
            badgeColor: interview.type === "external" ? "purple" : "emerald",
            description: `Dear Mentor, Campus Manager <strong>${cm_name}</strong> has assigned you to conduct a student interview session for <strong>${interview.subject}</strong>. Please prepare accordingly.`,
            details: [
              { label: "Subject", value: interview.subject, highlight: true },
              { label: "Class Group", value: interview.class_group || "All Classes" },
              { label: "Target Date", value: interview.target_date || "" },
              { label: "Interview Type", value: (interview.type || "internal").toUpperCase() },
              { label: "Student Count", value: String(updatedCount) },
              { label: "Topics", value: interview.topics || "General Review" },
              ...(gmeet_link ? [{ label: "Google Meet Link", value: gmeet_link, highlight: true }] : []),
              { label: "Assigned By", value: cm_name },
            ],
            ctaText: "Open Mentor Dashboard to Evaluate →",
          }),
        });
      } catch (mailErr) {
        console.warn("Mentor assignment email failed:", mailErr);
      }
    }

    // Notify KAM
    try {
      const kamRows = await db.all(`
        SELECT k.email, k.name FROM kam_users k
        INNER JOIN colleges c ON c.kam_id = k.id
        WHERE c.id = ?
      `, [interview.college_id || interview.origin_college_id]);

      if (kamRows && kamRows.length > 0) {
        const kamEmail = kamRows[0].email;
        const kamName = kamRows[0].name;
        if (kamEmail) {
          await sendMail({
            to: kamEmail,
            subject: `[Interview Assigned] ${interview.subject} — ${interview.college_id || interview.origin_college_id}`,
            htmlBody: renderEmailShell({
              title: "Interview Session Assigned & Scheduled",
              badgeText: "KAM Notification",
              badgeColor: "indigo",
              description: `Dear <strong>${kamName}</strong>, Campus Manager <strong>${cm_name}</strong> has allocated mentors for a ${interview.type} interview session.`,
              details: [
                { label: "Subject", value: interview.subject, highlight: true },
                { label: "Target Date", value: interview.target_date || "" },
                { label: "Student Count", value: String(updatedCount) },
                { label: "Mentors Assigned", value: mentorNames.join(", ") || "N/A" },
                { label: "Campus Manager", value: cm_name },
              ],
              ctaText: "View Interview Dashboard →",
            }),
          });
        }
      }
    } catch (kamMailErr) {
      console.warn("KAM notification email failed:", kamMailErr);
    }

    return NextResponse.json({
      success: true,
      message: `Successfully assigned ${updatedCount} students & mapped ${mapped_mentor_ids.length} mentor(s). Notification emails dispatched.`
    });
  } catch (error: any) {
    console.error("POST /api/interviews/assign error:", error);
    return NextResponse.json({ success: false, message: error.message || "Failed to assign interview" }, { status: 500 });
  }
}
