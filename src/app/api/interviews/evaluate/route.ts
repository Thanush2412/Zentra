// Pin to Mumbai (bom1) — co-located with Turso DB (aws-ap-south-1)
export const preferredRegion = "bom1";
export const maxDuration = 60;

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

    // Auto-complete ONLY if eval_count >= student_count (not just > 0)
    const interview = await db.get("SELECT * FROM student_interviews WHERE id = ?", [interview_id]);
    if (interview) {
      const evalCount = await db.get(
        "SELECT COUNT(*) as count FROM interview_evaluations WHERE interview_id = ?",
        [interview_id]
      );
      const expectedCount = Number(interview.student_count) || 0;
      const actualCount = Number(evalCount?.count) || 0;

      // Only auto-complete if student_count is set AND all students evaluated
      if (expectedCount > 0 && actualCount >= expectedCount) {
        await db.run(
          "UPDATE student_interviews SET status = 'pending_verification', updated_at = ? WHERE id = ? AND status = 'assigned'",
          [now, interview_id]
        );
      }
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
