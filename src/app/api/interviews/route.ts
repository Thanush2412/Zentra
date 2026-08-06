import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { sendMail, renderEmailShell } from "@/lib/mail";

export async function GET(request: Request) {
  try {
    const db = await getDb();
    const { searchParams } = new URL(request.url);
    const mentorId = searchParams.get("mentorId");
    const collegeId = searchParams.get("collegeId");
    const role = searchParams.get("role") || "mentor";
    const type = searchParams.get("type");

    let query = "SELECT * FROM student_interviews WHERE 1=1";
    const params: any[] = [];

    if (type) {
      query += " AND type = ?";
      params.push(type);
    }

    // Role-scoped filtering
    if (role === "mentor" && mentorId) {
      // Mentor only sees their own raised requests OR sessions they're assigned to
      query += " AND (mentor_id = ? OR assigned_mentor_ids LIKE ?)";
      params.push(mentorId, `%${mentorId}%`);
    } else if ((role === "cam" || role === "cm") && collegeId) {
      // CM sees all requests for their campus
      query += " AND (college_id = ? OR origin_college_id = ? OR target_college_id = ?)";
      params.push(collegeId, collegeId, collegeId);
    }
    // KAM/admin: no filter - see all

    query += " ORDER BY created_at DESC";

    const interviews = await db.all(query, params);

    // Fetch evaluations — scoped if mentor
    let evaluations: any[] = [];
    if (role === "mentor" && mentorId) {
      evaluations = await db.all(
        "SELECT * FROM interview_evaluations WHERE mentor_id = ? ORDER BY created_at DESC",
        [mentorId]
      );
    } else {
      evaluations = await db.all("SELECT * FROM interview_evaluations ORDER BY created_at DESC");
    }

    return NextResponse.json({ success: true, interviews, evaluations });
  } catch (error: any) {
    console.error("GET /api/interviews error:", error);
    return NextResponse.json({ success: false, message: error.message || "Failed to fetch interviews" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const db = await getDb();
    const body = await request.json();

    const {
      id,
      student_id,
      student_name,
      class_group = "",
      subject,
      type = "internal",
      target_date,
      topics,
      student_count,
      mentor_id,
      mentor_name,
      mentor_email,
      origin_college_id,
      college_id,
      notes = ""
    } = body;

    if (!subject || !mentor_id || !target_date) {
      return NextResponse.json(
        { success: false, message: "Missing required fields (subject, mentor_id, target_date)" },
        { status: 400 }
      );
    }

    // Rule 1: Exclude Tamil subject
    if (subject.trim().toLowerCase() === "tamil") {
      return NextResponse.json(
        { success: false, message: "Interview Module features are not applicable for Tamil subject." },
        { status: 400 }
      );
    }

    // Rule 2: Date must be at least 2 days after current date
    const reqDate = new Date(target_date);
    const minAllowedDate = new Date();
    minAllowedDate.setHours(0, 0, 0, 0);
    minAllowedDate.setDate(minAllowedDate.getDate() + 2);

    if (isNaN(reqDate.getTime()) || reqDate < minAllowedDate) {
      const minStr = minAllowedDate.toISOString().split("T")[0];
      return NextResponse.json(
        { success: false, message: `Interview target date must be at least 2 days in advance (on or after ${minStr}).` },
        { status: 400 }
      );
    }

    const interviewId = id || `int_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();
    const resolvedCollegeId = college_id || origin_college_id || "";

    await db.run(
      `INSERT INTO student_interviews (
        id, student_id, student_name, class_group, subject, type,
        target_date, topics, student_count, mentor_id, mentor_name,
        origin_college_id, college_id, status, notes, evaluator_name, evaluator_role, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        subject = excluded.subject,
        type = excluded.type,
        target_date = excluded.target_date,
        topics = excluded.topics,
        student_count = excluded.student_count,
        notes = excluded.notes,
        updated_at = excluded.updated_at`,
      [
        interviewId,
        student_id || "batch_all",
        student_name || "Assigned Students",
        class_group,
        subject,
        type,
        target_date,
        topics || "",
        Number(student_count) || 0,
        mentor_id,
        mentor_name || "Mentor",
        origin_college_id || "",
        resolvedCollegeId,
        type === "external" ? "pending_external_cm" : "pending_cm",
        notes,
        mentor_name || "",
        "mentor",
        now,
        now
      ]
    );

    // Notify Campus Manager via email
    try {
      const cms = await db.all(
        "SELECT * FROM campus_managers WHERE college_id = ?",
        [resolvedCollegeId]
      );
      if (cms && cms.length > 0) {
        const cmEmails = cms.map((cm: any) => cm.email).filter(Boolean).join(", ");
        if (cmEmails) {
          await sendMail({
            to: cmEmails,
            subject: `[New Interview Request] ${subject} — ${class_group} by ${mentor_name}`,
            htmlBody: renderEmailShell({
              title: "New Interview Request Raised",
              badgeText: type === "external" ? "External Interview" : "Internal Interview",
              badgeColor: type === "external" ? "purple" : "amber",
              description: `<strong>${mentor_name || "A mentor"}</strong> has raised a new ${type} interview request and it is awaiting your allocation.`,
              details: [
                { label: "Subject", value: subject, highlight: true },
                { label: "Class Group", value: class_group || "All Classes" },
                { label: "Target Date", value: target_date },
                { label: "Type", value: type.toUpperCase() },
                { label: "Topics", value: topics || "General Review" },
                { label: "Requested By", value: mentor_name || "Mentor" },
              ],
              ctaText: "Open Campus Manager Dashboard →",
            }),
          });
        }
      }
    } catch (mailErr) {
      console.warn("CM notification email failed:", mailErr);
    }

    const createdRecord = await db.get("SELECT * FROM student_interviews WHERE id = ?", [interviewId]);

    return NextResponse.json({
      success: true,
      message: "Interview request raised successfully. Campus Manager has been notified.",
      interview: createdRecord
    });
  } catch (error: any) {
    console.error("POST /api/interviews error:", error);
    return NextResponse.json({ success: false, message: error.message || "Failed to save interview" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const db = await getDb();
    const body = await request.json();
    const { interview_id, status, cm_name } = body;

    if (!interview_id || !status) {
      return NextResponse.json({ success: false, message: "Missing interview_id or status" }, { status: 400 });
    }

    const interview = await db.get("SELECT * FROM student_interviews WHERE id = ?", [interview_id]);
    if (!interview) {
      return NextResponse.json({ success: false, message: "Interview not found" }, { status: 404 });
    }

    const now = new Date().toISOString();
    await db.run(
      "UPDATE student_interviews SET status = ?, updated_at = ? WHERE id = ?",
      [status, now, interview_id]
    );

    // If marking as completed, notify students in the class group
    if (status === "completed") {
      try {
        const classGroup = interview.class_group;
        let studentEmails: string[] = [];

        if (classGroup) {
          const studentsInClass = await db.all(
            "SELECT email, name FROM students WHERE class_group = ? AND email IS NOT NULL AND email != ''",
            [classGroup]
          );
          studentEmails = studentsInClass.map((s: any) => s.email).filter(Boolean);
        }

        if (studentEmails.length > 0) {
          // Send in batches to avoid large TO lists
          const batchSize = 10;
          for (let i = 0; i < studentEmails.length; i += batchSize) {
            const batch = studentEmails.slice(i, i + batchSize);
            await sendMail({
              to: batch.join(", "),
              subject: `[Interview Results Ready] ${interview.subject} — ${classGroup}`,
              htmlBody: renderEmailShell({
                title: "Your Interview Evaluation Results Are Ready",
                badgeText: "Interview Completed",
                badgeColor: "emerald",
                description: `Dear Student, your <strong>${interview.subject}</strong> interview evaluation has been reviewed and verified by the Campus Manager. You can now view your scores on the portal.`,
                details: [
                  { label: "Subject", value: interview.subject, highlight: true },
                  { label: "Class Group", value: classGroup || "Your Class" },
                  { label: "Target Date", value: interview.target_date || "" },
                  { label: "Status", value: "Verified & Completed" },
                  { label: "Reviewed By", value: cm_name || "Campus Manager" },
                ],
                ctaText: "View My Interview Performance →",
              }),
            });
          }
        }
      } catch (mailErr) {
        console.warn("Student notification email failed:", mailErr);
      }
    }

    return NextResponse.json({
      success: true,
      message: status === "completed"
        ? "Interview marked as completed. Students have been notified."
        : `Interview status updated to '${status}'.`
    });
  } catch (error: any) {
    console.error("PATCH /api/interviews error:", error);
    return NextResponse.json({ success: false, message: error.message || "Failed to update interview" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const db = await getDb();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ success: false, message: "Missing interview id" }, { status: 400 });
    }

    await db.run("DELETE FROM student_interviews WHERE id = ?", [id]);
    await db.run("DELETE FROM interview_evaluations WHERE interview_id = ?", [id]);
    return NextResponse.json({ success: true, message: "Interview deleted successfully" });
  } catch (error: any) {
    console.error("DELETE /api/interviews error:", error);
    return NextResponse.json({ success: false, message: error.message || "Failed to delete interview" }, { status: 500 });
  }
}
