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

    // Ensure actual duration tracking columns exist in DB
    try {
      await db.run("ALTER TABLE interview_evaluations ADD COLUMN IF NOT EXISTS actual_start_time TEXT");
      await db.run("ALTER TABLE interview_evaluations ADD COLUMN IF NOT EXISTS actual_end_time TEXT");
      await db.run("ALTER TABLE interview_evaluations ADD COLUMN IF NOT EXISTS actual_duration_minutes INTEGER");
      await db.run("ALTER TABLE student_interview_slots ADD COLUMN IF NOT EXISTS actual_start_time TEXT");
      await db.run("ALTER TABLE student_interview_slots ADD COLUMN IF NOT EXISTS actual_end_time TEXT");
      await db.run("ALTER TABLE student_interview_slots ADD COLUMN IF NOT EXISTS actual_duration_minutes INTEGER");
    } catch (_) {}

    const isAbsent = body.is_absent === true || attendance === "absent";
    const finalAttendance = isAbsent ? "absent" : "present";
    const finalStatus = isAbsent ? "Absent" : (status || "Cleared");

    const actualStartTime = isAbsent ? null : (body.actual_start_time || null);
    const actualEndTime = isAbsent ? null : (body.actual_end_time || null);
    const actualDurationMinutes = isAbsent ? 0 : (Number(body.actual_duration_minutes) || (actualStartTime && actualEndTime ? 15 : null));

    const evalId = `eval_${interview_id}_${student_id}`;
    const commScore = isAbsent ? 0 : (Number(communication_score) || 0);
    const contScore = isAbsent ? 0 : (Number(content_score) || 0);
    const techScore = isAbsent ? 0 : (Number(technical_score) || 0);
    const confScore = isAbsent ? 0 : (Number(confidence_score) || 0);

    let qAvg = 0;
    let hasQuestions = false;
    try {
      const parsedQ = typeof questions_asked === "string" ? JSON.parse(questions_asked) : questions_asked;
      if (Array.isArray(parsedQ) && parsedQ.length > 0) {
        hasQuestions = true;
        const validScores = parsedQ.map((q: any) => Number(q.score) || 0);
        qAvg = validScores.reduce((a: number, b: number) => a + b, 0) / validScores.length;
      }
    } catch (_) {}

    const metricsAvg = (commScore + contScore + techScore + confScore) / 4;
    const computedTotalScore = isAbsent 
      ? 0 
      : hasQuestions 
        ? Math.round(((qAvg + metricsAvg) / 2) * 10) / 10 
        : Math.round(metricsAvg * 10) / 10;
    const totalScore = body.total_score !== undefined && body.total_score !== null && !isNaN(Number(body.total_score))
      ? Number(body.total_score)
      : computedTotalScore;
    const now = new Date().toISOString();

    await db.run(
      `INSERT INTO interview_evaluations (
        id, interview_id, student_id, student_name, class_group, mentor_id, mentor_name,
        attendance, communication_score, content_score, technical_score, confidence_score,
        total_score, questions_asked, remarks, status, actual_start_time, actual_end_time, actual_duration_minutes, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        actual_start_time = excluded.actual_start_time,
        actual_end_time = excluded.actual_end_time,
        actual_duration_minutes = excluded.actual_duration_minutes,
        updated_at = excluded.updated_at`,
      [
        evalId,
        interview_id,
        student_id,
        student_name || "Student",
        class_group,
        mentor_id,
        mentor_name,
        finalAttendance,
        commScore,
        contScore,
        techScore,
        confScore,
        totalScore,
        questions_asked,
        remarks,
        finalStatus,
        actualStartTime,
        actualEndTime,
        actualDurationMinutes,
        now,
        now
      ]
    );

    // Update individual student interview slot status and actual timing
    await db.run(
      `UPDATE student_interview_slots 
       SET status = ?, actual_start_time = ?, actual_end_time = ?, actual_duration_minutes = ?
       WHERE interview_id = ? AND (student_id = ? OR LOWER(student_name) = LOWER(?))`,
      [
        finalAttendance === "absent" ? "absent" : "completed",
        actualStartTime,
        actualEndTime,
        actualDurationMinutes,
        interview_id,
        student_id,
        student_name || ""
      ]
    );

    const interview = await db.get("SELECT * FROM student_interviews WHERE id = ?", [interview_id]);

    // ── Asynchronous Resilient Period Attendance Sync & Student-Level Execution Logging ──
    (async () => {
      try {
        const targetDate = interview?.target_date || now.slice(0, 10);
        const d = new Date(targetDate);
        const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
        const dayOfWeek = dayNames[d.getDay()];

        // 1. Resolve student record
        const student = await db.get(
          `SELECT id, name, classgroup as "classGroup", department, college_id FROM students WHERE id = $1 OR LOWER(name) = LOWER($2)`,
          [student_id, student_name || ""]
        );
        const resolvedClassGroup = student?.classGroup || class_group || interview?.class_group || "";

        // 2. Resolve matching class period slot in slots table for this cohort
        let matchingSlot = null;
        if (resolvedClassGroup) {
          const cleanCG = resolvedClassGroup.replace(/^[\["'\s]+|[\]"'\s]+$/g, "").trim();
          const daySlots = await db.all(
            `SELECT * FROM slots 
             WHERE day = ? AND (LOWER(classGroup) = LOWER(?) OR LOWER(department) = LOWER(?) OR classGroup LIKE ? OR department LIKE ?)`,
            [dayOfWeek, cleanCG, cleanCG, `%${cleanCG}%`, `%${cleanCG}%`]
          );

          if (daySlots.length > 0) {
            const matchTime = (interview?.preferred_start_time || interview?.time_slot || "").toLowerCase();
            matchingSlot = daySlots.find((s: any) => s.time && s.time.toLowerCase().includes(matchTime)) || daySlots[0];
          }
        }

        if (matchingSlot) {
          const attStatus = finalAttendance === "absent" ? "absent" : "present";
          const attTypeSub = finalAttendance === "absent" ? "interview_absent" : "interview_present";
          const attId = `att_iv_${interview_id}_${student_id}_${matchingSlot.id}`;

          // Check previous status for audit trail
          const existingAtt = await db.get(
            "SELECT status FROM student_attendance WHERE studentId = ? AND slotId = ? AND dateStr = ?",
            [student_id, matchingSlot.id, targetDate]
          );
          const oldStatus = existingAtt ? existingAtt.status : "not_marked";

          // Upsert period attendance record
          await db.run(
            `INSERT INTO student_attendance (
              id, studentId, slotId, dateStr, status, type, mode, markedBy, timestamp, attendanceTypeSub
            ) VALUES (?, ?, ?, ?, ?, 'interview', 'interview_evaluation', ?, ?, ?)
            ON CONFLICT(studentId, slotId, dateStr) DO UPDATE SET
              status = excluded.status,
              type = excluded.type,
              mode = excluded.mode,
              markedBy = excluded.markedBy,
              timestamp = excluded.timestamp,
              attendanceTypeSub = excluded.attendanceTypeSub`,
            [
              attId,
              student_id,
              matchingSlot.id,
              targetDate,
              attStatus,
              mentor_name || "Evaluator Mentor",
              now,
              attTypeSub
            ]
          );

          // Write student-level interview execution log
          const logId = `l_iv_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
          const durationStr = actualDurationMinutes
            ? ` Duration: ${actualDurationMinutes} mins (${actualStartTime || '—'} – ${actualEndTime || '—'}).`
            : " Duration: 0 mins (Absent).";
          const description = `Interview execution logged: ${student?.name || student_name} (${student_id}) marked ${attStatus.toUpperCase()} for Period ${matchingSlot.time} (${matchingSlot.course || interview?.subject || 'Class'}).${durationStr} Rubric: ${totalScore}/10. Evaluator: ${mentor_name}`;

          await db.run(
            `INSERT INTO audit_logs (id, type, description, actorName, actorRole, timestamp, old_status, new_status, reason, changed_by)
             VALUES (?, 'interview_attendance', ?, ?, 'Evaluator Mentor', ?, ?, ?, ?, ?)`,
            [
              logId,
              description,
              mentor_name || "Mentor",
              now,
              oldStatus,
              attStatus,
              `Structured ${interview?.type || 'technical'} interview evaluation for ${interview?.subject || 'Interview'}`,
              mentor_id
            ]
          );
        }
      } catch (attErr) {
        console.error("Asynchronous interview period attendance sync error:", attErr);
      }
    })();

    // Auto-complete if all students are now evaluated or marked absent
    if (interview) {
      const evalCount = await db.get(
        "SELECT COUNT(*) as count FROM interview_evaluations WHERE interview_id = ?",
        [interview_id]
      );
      const expectedCount = Number(interview.student_count) || Number(interview.requested_students) || 0;
      const actualCount = Number(evalCount?.count) || 0;

      // Transition to pending_verification when all students processed
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
      message: isAbsent
        ? "Student marked absent for interview and corresponding timetable period."
        : "Student interview evaluation & multi-criteria marks saved successfully!",
      evaluation: savedEval
    });
  } catch (error: any) {
    console.error("POST /api/interviews/evaluate error:", error);
    return NextResponse.json({ success: false, message: error.message || "Failed to save evaluation" }, { status: 500 });
  }
}
