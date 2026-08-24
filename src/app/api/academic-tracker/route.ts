// Pin to Mumbai (bom1) — co-located with Turso DB (aws-ap-south-1)
export const preferredRegion = "bom1";
export const maxDuration = 60;

import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET(request: Request) {
  try {
    const db = await getDb();
    const { searchParams } = new URL(request.url);
    const collegeId = searchParams.get("collegeId");
    const mentorId = searchParams.get("mentorId");
    const subject = searchParams.get("subject");
    const classGroup = searchParams.get("classGroup");
    const weekNumber = searchParams.get("weekNumber");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const type = searchParams.get("type");

    // If requesting weekly academic tasks and student marks
    if (type === "weekly" || searchParams.get("action") === "weekly") {
      let taskQuery = "SELECT * FROM weekly_academic_tasks WHERE 1=1";
      const taskParams: any[] = [];
      if (subject && subject !== "all") {
        taskQuery += " AND LOWER(TRIM(subject)) = LOWER(TRIM(?))";
        taskParams.push(subject);
      }
      if (classGroup && classGroup !== "all") {
        taskQuery += " AND LOWER(TRIM(class_group)) = LOWER(TRIM(?))";
        taskParams.push(classGroup);
      }
      if (weekNumber) {
        taskQuery += " AND week_number = ?";
        taskParams.push(parseInt(weekNumber, 10));
      }

      const tasks = await db.all(taskQuery, ...taskParams).catch(() => []);

      let marksQuery = "SELECT * FROM student_academic_tracker WHERE 1=1";
      const marksParams: any[] = [];
      if (subject && subject !== "all") {
        marksQuery += " AND LOWER(TRIM(subject)) = LOWER(TRIM(?))";
        marksParams.push(subject);
      }
      if (classGroup && classGroup !== "all") {
        marksQuery += " AND LOWER(TRIM(class_group)) = LOWER(TRIM(?))";
        marksParams.push(classGroup);
      }
      if (weekNumber) {
        marksQuery += " AND week_number = ?";
        marksParams.push(parseInt(weekNumber, 10));
      }

      const tracker = await db.all(marksQuery, ...marksParams).catch(() => []);

      return NextResponse.json({
        success: true,
        weeklyTasks: tasks,
        studentTracker: tracker
      });
    }

    // Default: Fetch Conduction Entries + All Weekly Academic Data
    let query = "SELECT * FROM academic_tracker WHERE 1=1";
    const params: any[] = [];

    if (collegeId && collegeId !== "all") {
      query += " AND (college_id = ? OR mentor_id IN (SELECT id FROM mentors WHERE college_id = ?))";
      params.push(collegeId, collegeId);
    }
    if (mentorId && mentorId !== "all") {
      query += " AND mentor_id = ?";
      params.push(mentorId);
    }
    if (subject && subject !== "all") {
      query += " AND LOWER(TRIM(subject)) = LOWER(TRIM(?))";
      params.push(subject);
    }
    if (classGroup && classGroup !== "all") {
      query += " AND LOWER(TRIM(class_group)) = LOWER(TRIM(?))";
      params.push(classGroup);
    }
    if (startDate) {
      query += " AND date >= ?";
      params.push(startDate);
    }
    if (endDate) {
      query += " AND date <= ?";
      params.push(endDate);
    }

    query += " ORDER BY date DESC, period_slot ASC LIMIT 500";

    const [entries, weeklyTasks, studentTracker] = await Promise.all([
      db.all(query, ...params).catch(() => []),
      db.all("SELECT * FROM weekly_academic_tasks").catch(() => []),
      db.all("SELECT * FROM student_academic_tracker").catch(() => [])
    ]);

    return NextResponse.json({
      success: true,
      entries,
      weeklyTasks,
      studentTracker
    });
  } catch (err: any) {
    console.error("GET /api/academic-tracker error:", err);
    return NextResponse.json({ success: false, message: err?.message || "Failed to fetch academic tracker entries." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const db = await getDb();
    const body = await request.json();

    // ─────────────────────────────────────────────────────────────
    // 1. ACTION: ASSIGN WEEKLY ACADEMIC TASK
    // ─────────────────────────────────────────────────────────────
    if (body.action === "assign_weekly_task") {
      const {
        classGroup,
        subject,
        weekNumber,
        taskName,
        taskPdfUrl,
        quizTopic,
        assessmentTopic,
        assignmentTopic,
        mentorId,
        taskDate
      } = body;

      if (!classGroup || !subject || weekNumber === undefined || !mentorId || !taskName) {
        return NextResponse.json(
          { success: false, message: "Missing required fields: classGroup, subject, weekNumber, mentorId, or taskName." },
          { status: 400 }
        );
      }

      // Ensure task_date column exists
      try {
        await db.run("ALTER TABLE weekly_academic_tasks ADD COLUMN task_date TEXT");
      } catch (_) {}

      const id = `acad_task_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      const now = new Date().toISOString();
      const effectiveTaskDate = (taskDate && String(taskDate).trim()) || now.slice(0, 10);

      await db.run(
        `INSERT INTO weekly_academic_tasks (
          id, class_group, subject, week_number, task_name, task_pdf_url, task_date, quiz_topic, assessment_topic, assignment_topic, mentor_id, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(class_group, subject, week_number) DO UPDATE SET
          task_name = excluded.task_name,
          task_pdf_url = excluded.task_pdf_url,
          task_date = excluded.task_date,
          quiz_topic = excluded.quiz_topic,
          assessment_topic = excluded.assessment_topic,
          assignment_topic = excluded.assignment_topic,
          mentor_id = excluded.mentor_id,
          updated_at = excluded.updated_at`,
        [
          id,
          classGroup.trim(),
          subject.trim(),
          parseInt(weekNumber, 10),
          taskName.trim(),
          taskPdfUrl || null,
          effectiveTaskDate,
          quizTopic || null,
          assessmentTopic || null,
          assignmentTopic || null,
          mentorId.trim(),
          now
        ]
      );

      const savedTask = await db.get(
        "SELECT * FROM weekly_academic_tasks WHERE LOWER(TRIM(class_group)) = LOWER(TRIM(?)) AND LOWER(TRIM(subject)) = LOWER(TRIM(?)) AND week_number = ?",
        [classGroup.trim(), subject.trim(), parseInt(weekNumber, 10)]
      );

      return NextResponse.json({ success: true, task: savedTask });
    }

    // ─────────────────────────────────────────────────────────────
    // 2. ACTION: BULK UPLOAD ACADEMIC MARKS (MAPPED BY EMAIL)
    // ─────────────────────────────────────────────────────────────
    if (body.action === "bulk_upload_marks") {
      const { records, classGroup, subject, weekNumber, gradedBy } = body;
      if (!Array.isArray(records) || records.length === 0) {
        return NextResponse.json({ success: false, message: "No student records provided for upload." }, { status: 400 });
      }

      const now = new Date().toISOString();
      let updatedCount = 0;

      for (const rec of records) {
        const studentEmail = (rec.studentEmail || rec.email || "").trim().toLowerCase();
        if (!studentEmail) continue;

        const studentId = rec.studentId || rec.id || null;
        const cGroup = (rec.classGroup || classGroup || "").trim();
        const subj = (rec.subject || subject || "").trim();
        const wk = parseInt(rec.weekNumber || weekNumber, 10) || 1;

        const qMarks = rec.quizMarks !== undefined && rec.quizMarks !== null && rec.quizMarks !== "" ? parseFloat(rec.quizMarks) : null;
        const asMarks = rec.assessmentMarks !== undefined && rec.assessmentMarks !== null && rec.assessmentMarks !== "" ? parseFloat(rec.assessmentMarks) : null;
        const agMarks = rec.assignmentMarks !== undefined && rec.assignmentMarks !== null && rec.assignmentMarks !== "" ? parseFloat(rec.assignmentMarks) : null;

        let totMarks: number | null = null;
        if (qMarks !== null || asMarks !== null || agMarks !== null) {
          totMarks = (qMarks || 0) + (asMarks || 0) + (agMarks || 0);
        }

        const attendanceStatus = rec.attendanceStatus || rec.attendance || "Present";
        const feedback = rec.feedback || rec.remarks || null;
        const gBy = rec.gradedBy || gradedBy || null;
        const id = `st_acad_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

        await db.run(
          `INSERT INTO student_academic_tracker (
            id, student_email, student_id, class_group, subject, week_number, attendance_status, quiz_marks, assessment_marks, assignment_marks, total_marks, feedback, graded_by, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(student_email, class_group, subject, week_number) DO UPDATE SET
            student_id = COALESCE(excluded.student_id, student_academic_tracker.student_id),
            attendance_status = excluded.attendance_status,
            quiz_marks = excluded.quiz_marks,
            assessment_marks = excluded.assessment_marks,
            assignment_marks = excluded.assignment_marks,
            total_marks = excluded.total_marks,
            feedback = excluded.feedback,
            graded_by = excluded.graded_by,
            updated_at = excluded.updated_at`,
          [
            id,
            studentEmail,
            studentId,
            cGroup,
            subj,
            wk,
            attendanceStatus,
            qMarks,
            asMarks,
            agMarks,
            totMarks,
            feedback,
            gBy,
            now
          ]
        );
        updatedCount++;
      }

      // Fetch all updated entries for this classGroup and subject/week
      const updatedTracker = await db.all(
        "SELECT * FROM student_academic_tracker WHERE LOWER(TRIM(class_group)) = LOWER(TRIM(?)) AND LOWER(TRIM(subject)) = LOWER(TRIM(?)) AND week_number = ?",
        [classGroup.trim(), subject.trim(), parseInt(weekNumber, 10)]
      );

      return NextResponse.json({
        success: true,
        message: `Successfully updated academic marks for ${updatedCount} students!`,
        updatedCount,
        studentTracker: updatedTracker
      });
    }

    // ─────────────────────────────────────────────────────────────
    // 3. ACTION: SINGLE GRADE / SUBMISSION ENTRY (BY EMAIL)
    // ─────────────────────────────────────────────────────────────
    if (body.action === "grade_student" || body.action === "grade_entry") {
      const {
        studentEmail,
        studentId,
        classGroup,
        subject,
        weekNumber,
        quizMarks,
        assessmentMarks,
        assignmentMarks,
        attendanceStatus,
        submissionUrl,
        feedback,
        gradedBy
      } = body;

      const email = (studentEmail || "").trim().toLowerCase();
      if (!email || !classGroup || !subject || weekNumber === undefined) {
        return NextResponse.json(
          { success: false, message: "Missing required fields: studentEmail, classGroup, subject, or weekNumber." },
          { status: 400 }
        );
      }

      const qMarks = quizMarks !== undefined && quizMarks !== null && quizMarks !== "" ? parseFloat(quizMarks) : null;
      const asMarks = assessmentMarks !== undefined && assessmentMarks !== null && assessmentMarks !== "" ? parseFloat(assessmentMarks) : null;
      const agMarks = assignmentMarks !== undefined && assignmentMarks !== null && assignmentMarks !== "" ? parseFloat(assignmentMarks) : null;

      let totMarks: number | null = null;
      if (qMarks !== null || asMarks !== null || agMarks !== null) {
        totMarks = (qMarks || 0) + (asMarks || 0) + (agMarks || 0);
      }

      const id = `st_acad_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      const now = new Date().toISOString();

      await db.run(
        `INSERT INTO student_academic_tracker (
          id, student_email, student_id, class_group, subject, week_number, attendance_status, submission_url, quiz_marks, assessment_marks, assignment_marks, total_marks, feedback, graded_by, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(student_email, class_group, subject, week_number) DO UPDATE SET
          student_id = COALESCE(excluded.student_id, student_academic_tracker.student_id),
          attendance_status = COALESCE(excluded.attendance_status, student_academic_tracker.attendance_status),
          submission_url = CASE WHEN excluded.submission_url IS NOT NULL THEN excluded.submission_url ELSE student_academic_tracker.submission_url END,
          quiz_marks = CASE WHEN excluded.quiz_marks IS NOT NULL THEN excluded.quiz_marks ELSE student_academic_tracker.quiz_marks END,
          assessment_marks = CASE WHEN excluded.assessment_marks IS NOT NULL THEN excluded.assessment_marks ELSE student_academic_tracker.assessment_marks END,
          assignment_marks = CASE WHEN excluded.assignment_marks IS NOT NULL THEN excluded.assignment_marks ELSE student_academic_tracker.assignment_marks END,
          total_marks = CASE WHEN excluded.total_marks IS NOT NULL THEN excluded.total_marks ELSE student_academic_tracker.total_marks END,
          feedback = CASE WHEN excluded.feedback IS NOT NULL THEN excluded.feedback ELSE student_academic_tracker.feedback END,
          graded_by = CASE WHEN excluded.graded_by IS NOT NULL THEN excluded.graded_by ELSE student_academic_tracker.graded_by END,
          updated_at = excluded.updated_at`,
        [
          id,
          email,
          studentId || null,
          classGroup.trim(),
          subject.trim(),
          parseInt(weekNumber, 10),
          attendanceStatus || "Present",
          submissionUrl || null,
          qMarks,
          asMarks,
          agMarks,
          totMarks,
          feedback || null,
          gradedBy || null,
          now
        ]
      );

      const updatedEntry = await db.get(
        "SELECT * FROM student_academic_tracker WHERE LOWER(TRIM(student_email)) = LOWER(TRIM(?)) AND LOWER(TRIM(class_group)) = LOWER(TRIM(?)) AND LOWER(TRIM(subject)) = LOWER(TRIM(?)) AND week_number = ?",
        [email, classGroup.trim(), subject.trim(), parseInt(weekNumber, 10)]
      );

      return NextResponse.json({ success: true, entry: updatedEntry });
    }

    // ─────────────────────────────────────────────────────────────
    // 4. ACTION: STANDARD PERIOD CONDUCTION LOG
    // ─────────────────────────────────────────────────────────────
    const {
      id: existingId,
      date,
      periodSlot,
      classGroup,
      subject,
      unit,
      topic,
      comments,
      status,
      mentorId,
      mentorName,
      collegeId
    } = body;

    if (!date || !periodSlot || !classGroup || !subject || !unit || !topic || !mentorId) {
      return NextResponse.json(
        { success: false, message: "Missing required fields: date, periodSlot, classGroup, subject, unit, topic, or mentorId." },
        { status: 400 }
      );
    }

    const todayStr = new Date().toISOString().split("T")[0];
    if (date.trim() > todayStr) {
      return NextResponse.json(
        { success: false, message: "Future period conduction cannot be logged in advance." },
        { status: 400 }
      );
    }

    const id = existingId || `acad_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const now = new Date().toISOString();

    let resolvedMentorName = mentorName;
    let resolvedCollegeId = collegeId;
    if (!resolvedMentorName || !resolvedCollegeId) {
      const mentorRow = await db.get("SELECT name, college_id FROM mentors WHERE id = ?", mentorId);
      if (mentorRow) {
        resolvedMentorName = resolvedMentorName || mentorRow.name;
        resolvedCollegeId = resolvedCollegeId || mentorRow.college_id;
      }
    }

    await db.run(
      `INSERT INTO academic_tracker (
        id, date, period_slot, class_group, subject, unit, topic, comments, status, mentor_id, mentor_name, college_id, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(mentor_id, date, period_slot, subject, class_group) DO UPDATE SET
        unit = excluded.unit,
        topic = excluded.topic,
        comments = excluded.comments,
        status = excluded.status,
        mentor_name = excluded.mentor_name,
        college_id = excluded.college_id,
        updated_at = excluded.updated_at`,
      [
        id,
        date.trim(),
        periodSlot.trim(),
        classGroup.trim(),
        subject.trim(),
        unit.trim(),
        topic.trim(),
        comments ? comments.trim() : "",
        status ? status.trim() : "Conducted",
        mentorId.trim(),
        resolvedMentorName || "",
        resolvedCollegeId || "",
        now
      ]
    );

    const savedEntry = await db.get(
      "SELECT * FROM academic_tracker WHERE mentor_id = ? AND date = ? AND period_slot = ? AND subject = ? AND class_group = ?",
      [mentorId.trim(), date.trim(), periodSlot.trim(), subject.trim(), classGroup.trim()]
    );

    return NextResponse.json({
      success: true,
      message: "Academic log recorded successfully.",
      entry: savedEntry
    });
  } catch (err: any) {
    console.error("POST /api/academic-tracker error:", err);
    return NextResponse.json({ success: false, message: err?.message || "Failed to save academic tracker entry." }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const db = await getDb();
    const body = await request.json();
    return POST(new Request(request.url, { method: "POST", headers: request.headers, body: JSON.stringify(body) }));
  } catch (err: any) {
    console.error("PUT /api/academic-tracker error:", err);
    return NextResponse.json({ success: false, message: err?.message || "Failed to update academic entry." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const db = await getDb();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const action = searchParams.get("action");
    const classGroup = searchParams.get("classGroup");
    const subject = searchParams.get("subject");
    const weekNumber = searchParams.get("weekNumber");

    if (action === "delete_weekly_task" || (classGroup && subject && weekNumber)) {
      const wk = parseInt(weekNumber!, 10);
      await db.run(
        `DELETE FROM weekly_academic_tasks 
         WHERE LOWER(TRIM(class_group)) = LOWER(TRIM(?)) 
           AND LOWER(TRIM(subject)) = LOWER(TRIM(?)) 
           AND week_number = ?`,
        [classGroup!, subject!, wk]
      );

      await db.run(
        `DELETE FROM student_academic_tracker 
         WHERE LOWER(TRIM(class_group)) = LOWER(TRIM(?)) 
           AND LOWER(TRIM(subject)) = LOWER(TRIM(?)) 
           AND week_number = ?`,
        [classGroup!, subject!, wk]
      );

      return NextResponse.json({ success: true, message: "Weekly academic task and associated records deleted." });
    }

    if (!id) {
      return NextResponse.json({ success: false, message: "Missing id parameter." }, { status: 400 });
    }

    await db.run("DELETE FROM academic_tracker WHERE id = ?", id);
    return NextResponse.json({ success: true, message: "Academic log deleted successfully." });
  } catch (err: any) {
    console.error("DELETE /api/academic-tracker error:", err);
    return NextResponse.json({ success: false, message: err?.message || "Failed to delete academic tracker entry." }, { status: 500 });
  }
}
