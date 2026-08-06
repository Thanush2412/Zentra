import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET(request: Request) {
  try {
    const db = await getDb();
    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get("studentId");
    const mentorId = searchParams.get("mentorId");
    const collegeId = searchParams.get("collegeId");
    const role = searchParams.get("role") || "mentor";
    const type = searchParams.get("type");

    let query = "SELECT * FROM student_interviews WHERE 1=1";
    const params: any[] = [];

    if (studentId) {
      query += " AND student_id = ?";
      params.push(studentId);
    }
    if (type) {
      query += " AND type = ?";
      params.push(type);
    }
    if (role === "mentor" && mentorId) {
      query += " AND (mentor_id = ? OR assigned_mentor_ids LIKE ?)";
      params.push(mentorId, `%${mentorId}%`);
    } else if ((role === "cam" || role === "cm") && collegeId) {
      query += " AND (origin_college_id = ? OR target_college_id = ? OR college_id = ? OR origin_college_id IS NULL OR origin_college_id = '')";
      params.push(collegeId, collegeId, collegeId);
    }

    query += " ORDER BY created_at DESC";

    const interviews = await db.all(query, params);

    // Fetch evaluations as well
    const evaluations = await db.all("SELECT * FROM interview_evaluations ORDER BY created_at DESC");

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
      student_count = 1,
      mentor_id,
      mentor_name,
      origin_college_id,
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
    minAllowedDate.setDate(minAllowedDate.getDate() + 2); // 2 days in future

    if (isNaN(reqDate.getTime()) || reqDate < minAllowedDate) {
      const minStr = minAllowedDate.toISOString().split("T")[0];
      return NextResponse.json(
        { success: false, message: `Interview target date must be at least 2 days in advance (on or after ${minStr}).` },
        { status: 400 }
      );
    }

    const interviewId = id || `int_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();

    await db.run(
      `INSERT INTO student_interviews (
        id, student_id, student_name, class_group, subject, type,
        target_date, topics, student_count, mentor_id, mentor_name,
        origin_college_id, status, notes, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        Number(student_count) || 1,
        mentor_id,
        mentor_name || "Mentor",
        origin_college_id || "",
        type === "external" ? "pending_external_cm" : "pending_cm",
        notes,
        now,
        now
      ]
    );

    const createdRecord = await db.get("SELECT * FROM student_interviews WHERE id = ?", [interviewId]);

    return NextResponse.json({
      success: true,
      message: "Interview request raised successfully and sent to CM.",
      interview: createdRecord
    });
  } catch (error: any) {
    console.error("POST /api/interviews error:", error);
    return NextResponse.json({ success: false, message: error.message || "Failed to save interview" }, { status: 500 });
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
