import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function POST(request: Request) {
  try {
    const db = await getDb();
    const body = await request.json();

    const {
      interview_id,
      student_id,
      student_name,
      class_group = "",
      mentor_id,
      mentor_name = "Mentor",
      attendance = "present",
      communication_score = 0,
      content_score = 0,
      technical_score = 0,
      confidence_score = 0,
      questions_asked = "",
      remarks = "",
      status = "Cleared"
    } = body;

    if (!interview_id || !student_id || !mentor_id) {
      return NextResponse.json(
        { success: false, message: "Missing required fields (interview_id, student_id, mentor_id)" },
        { status: 400 }
      );
    }

    const evalId = `eval_${interview_id}_${student_id}`;
    const totalScore = Math.round(
      (Number(communication_score) + Number(content_score) + Number(technical_score) + Number(confidence_score)) / 4
    );
    const now = new Date().toISOString();

    await db.run(
      `INSERT INTO interview_evaluations (
        id, interview_id, student_id, student_name, class_group, mentor_id, mentor_name,
        attendance, communication_score, content_score, technical_score, confidence_score,
        total_score, questions_asked, remarks, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        attendance = excluded.attendance,
        communication_score = excluded.communication_score,
        content_score = excluded.content_score,
        technical_score = excluded.technical_score,
        confidence_score = excluded.confidence_score,
        total_score = excluded.total_score,
        questions_asked = excluded.questions_asked,
        remarks = excluded.remarks,
        status = excluded.status,
        updated_at = excluded.updated_at`,
      [
        evalId,
        interview_id,
        student_id,
        student_name || "Student",
        class_group,
        mentor_id,
        mentor_name,
        attendance,
        Number(communication_score) || 0,
        Number(content_score) || 0,
        Number(technical_score) || 0,
        Number(confidence_score) || 0,
        totalScore,
        questions_asked,
        remarks,
        status,
        now,
        now
      ]
    );

    // Check if all students in interview are evaluated, and if so, update interview status to 'completed'
    const evalCount = await db.get("SELECT COUNT(*) as count FROM interview_evaluations WHERE interview_id = ?", [interview_id]);
    if (evalCount && evalCount.count > 0) {
      await db.run("UPDATE student_interviews SET status = 'completed', updated_at = ? WHERE id = ?", [now, interview_id]);
    }

    const savedEval = await db.get("SELECT * FROM interview_evaluations WHERE id = ?", [evalId]);

    return NextResponse.json({
      success: true,
      message: "Student interview evaluation & multi-criteria marks saved successfully!",
      evaluation: savedEval
    });
  } catch (error: any) {
    console.error("POST /api/interviews/evaluate error:", error);
    return NextResponse.json({ success: false, message: error.message || "Failed to save evaluation" }, { status: 500 });
  }
}
