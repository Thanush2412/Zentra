import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET(request: Request) {
  try {
    const db = await getDb();
    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get("studentId");
    const classGroup = searchParams.get("classGroup");
    const subject = searchParams.get("subject");
    const type = searchParams.get("type");

    let query = "SELECT * FROM student_interviews WHERE 1=1";
    const params: any[] = [];

    if (studentId) {
      query += " AND student_id = ?";
      params.push(studentId);
    }
    if (classGroup) {
      query += " AND class_group = ?";
      params.push(classGroup);
    }
    if (subject) {
      query += " AND subject = ?";
      params.push(subject);
    }
    if (type) {
      query += " AND type = ?";
      params.push(type);
    }

    query += " ORDER BY created_at DESC";

    const interviews = await db.all(query, params);
    return NextResponse.json({ success: true, interviews });
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
      class_group,
      subject,
      type = "internal",
      marks = 0,
      total_marks = 100,
      technical_marks = 0,
      communication_marks = 0,
      status = "Cleared",
      evaluator_name,
      evaluator_role = "mentor",
      notes = ""
    } = body;

    if (!student_id || !class_group || !subject || !evaluator_name) {
      return NextResponse.json(
        { success: false, message: "Missing required fields (student_id, class_group, subject, evaluator_name)" },
        { status: 400 }
      );
    }

    let resolvedStudentName = student_name;
    if (!resolvedStudentName) {
      const studentRow = await db.get("SELECT name FROM students WHERE id = ?", [student_id]);
      resolvedStudentName = studentRow?.name || "Student";
    }

    const interviewId = id || `int_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();

    await db.run(
      `INSERT INTO student_interviews (
        id, student_id, student_name, class_group, subject, type,
        marks, total_marks, technical_marks, communication_marks,
        status, evaluator_name, evaluator_role, notes, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        student_name = excluded.student_name,
        class_group = excluded.class_group,
        subject = excluded.subject,
        type = excluded.type,
        marks = excluded.marks,
        total_marks = excluded.total_marks,
        technical_marks = excluded.technical_marks,
        communication_marks = excluded.communication_marks,
        status = excluded.status,
        evaluator_name = excluded.evaluator_name,
        evaluator_role = excluded.evaluator_role,
        notes = excluded.notes,
        updated_at = excluded.updated_at`,
      [
        interviewId,
        student_id,
        resolvedStudentName,
        class_group,
        subject,
        type,
        Number(marks) || 0,
        Number(total_marks) || 100,
        Number(technical_marks) || 0,
        Number(communication_marks) || 0,
        status,
        evaluator_name,
        evaluator_role,
        notes,
        now,
        now
      ]
    );

    const createdRecord = await db.get("SELECT * FROM student_interviews WHERE id = ?", [interviewId]);

    return NextResponse.json({
      success: true,
      message: "Interview record saved successfully",
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
    return NextResponse.json({ success: true, message: "Interview deleted successfully" });
  } catch (error: any) {
    console.error("DELETE /api/interviews error:", error);
    return NextResponse.json({ success: false, message: error.message || "Failed to delete interview" }, { status: 500 });
  }
}
