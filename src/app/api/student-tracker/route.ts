export const maxDuration = 60;

import { NextResponse, after } from "next/server";
import { getDb, type QueryFailure } from "@/lib/db";
import { normalizeRole, requireAuth, Role } from "@/lib/authGuard";
import { renderEmailShell, BRAND } from "@/lib/mail";
import { dispatchMail } from "@/lib/mailAsync";
import { generateId } from "@/lib/id";

const TASK_ASSIGN_ROLES: Role[] = ["mentor", "admin"];

// Assigning a weekly task emails every student in the class group.
export async function POST(request: Request) {
  const { errorResponse } = await requireAuth(request, { allowedRoles: TASK_ASSIGN_ROLES });
  if (errorResponse) return errorResponse;

  try {
    const db = await getDb();
    const body = await request.json();
    const { action, classGroup, subject, weekNumber, taskName, taskPdfUrl, mentorId } = body;

    if (action === "assign_task") {
      if (!classGroup || !subject || weekNumber === undefined || !mentorId || !taskName) {
        return NextResponse.json(
          { success: false, message: "Missing required fields: classGroup, subject, weekNumber, mentorId, or taskName." },
          { status: 400 }
        );
      }

      const id = generateId("task");
      
      const now = new Date().toISOString();
      // INSERT OR REPLACE in weekly_tasks
      await db.run(
        `INSERT INTO weekly_tasks (id, class_group, subject, week_number, mentor_id, task_name, task_pdf_url, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(class_group, subject, week_number) DO UPDATE SET
           task_name = excluded.task_name,
           task_pdf_url = excluded.task_pdf_url,
           mentor_id = excluded.mentor_id,
           updated_at = excluded.updated_at`,
        [id, classGroup, subject, weekNumber, mentorId, taskName, taskPdfUrl || null, now]
      );

      // Fetch the updated task
      const updatedTask = await db.get(
        "SELECT * FROM weekly_tasks WHERE class_group = ? AND subject = ? AND week_number = ?",
        [classGroup, subject, weekNumber]
      );

      // Notify the class after the response: two roster reads plus a relay leg is
      // not what the mentor saved the task for.
      after(async () => {
        try {
          const mailFailures: QueryFailure[] = [];
          const [mentorRows, studentsInClass] = await db.multiQuery(
            [
              { sql: "SELECT name, email FROM mentors WHERE id = ?", params: [mentorId] },
              { sql: "SELECT email FROM students WHERE LOWER(TRIM(classGroup)) = LOWER(TRIM(?))", params: [classGroup] },
            ],
            mailFailures
          );
          if (mailFailures.length > 0) {
            console.warn("[student-tracker] recipient read failed, task mail may be incomplete:", mailFailures[0].error);
          }
          const mentorName = mentorRows[0]?.name || "Faculty Mentor";
          const studentEmails = studentsInClass.map((s: any) => s.email).filter(Boolean);

          const mailSubject = `${BRAND.emailPrefix} New Task Assigned: Week ${weekNumber} - ${subject}`;
          const htmlBody = renderEmailShell({
            title: `Weekly Task Assigned: Week ${weekNumber}`,
            badgeText: `New Task Assignment`,
            badgeColor: "indigo",
            description: `Dear Student, a new weekly task has been assigned for the course <strong>${subject}</strong>.`,
            details: [
              { label: "Subject", value: subject },
              { label: "Week", value: `Week ${weekNumber}` },
              { label: "Task Title", value: taskName, highlight: true },
              { label: "Assigned By", value: mentorName },
              { label: "Reference PDF", value: taskPdfUrl ? `<a href="${taskPdfUrl}" target="_blank" style="color: #4f46e5; font-weight: 700; text-decoration: none;">Download PDF Resource</a>` : "No attachments" }
            ],
            ctaUrl: `${BRAND.portalUrl}/student`,
            footerText: "Please log in to submit your weekly task entry."
          });

          // Every address goes in BCC; a class roster in To exposes each student to the others.
          await dispatchMail({
            bcc: studentEmails,
            subject: mailSubject,
            htmlBody,
            context: "weekly-task-assigned"
          });
        } catch (mailErr) {
          console.error("Failed to send weekly task assignment email:", mailErr);
        }
      });

      return NextResponse.json({ success: true, task: updatedTask });
    }

    return NextResponse.json({ success: false, message: "Invalid action." }, { status: 400 });
  } catch (error: any) {
    console.error("API POST student-tracker error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const { auth, errorResponse } = await requireAuth(request, {
    allowedRoles: ["student", ...TASK_ASSIGN_ROLES, "cm", "kam"]
  });
  if (errorResponse || !auth) {
    return errorResponse || NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }

  try {
    const db = await getDb();
    const body = await request.json();
    const { action, studentId, classGroup, subject, weekNumber, submissionUrl, vivaAssessment, marks, gradedBy } = body;

    // One handler serves both sides: students file their own submission, staff
    // record the grade. Without this split, a student session could write its
    // own marks (and, before this guard, any anonymous caller could).
    if (normalizeRole(auth.user.role) === "student") {
      const selfId = auth.user.reference_id || auth.user.id;
      if (!selfId || studentId !== selfId) {
        return NextResponse.json(
          { success: false, message: "Forbidden: students may only update their own tracker entry." },
          { status: 403 }
        );
      }
      if (marks !== undefined || vivaAssessment !== undefined || gradedBy !== undefined) {
        return NextResponse.json(
          { success: false, message: "Forbidden: marks and viva are recorded by faculty." },
          { status: 403 }
        );
      }
    }

    if (action === "grade_entry") {
      if (!studentId || !classGroup || !subject || weekNumber === undefined) {
        return NextResponse.json(
          { success: false, message: "Missing required fields: studentId, classGroup, subject, or weekNumber." },
          { status: 400 }
        );
      }

      // Check marks boundaries
      if (marks !== undefined && marks !== null) {
        const numericMarks = parseFloat(marks);
        if (isNaN(numericMarks) || numericMarks < 0 || numericMarks > 10) {
          return NextResponse.json(
            { success: false, message: "Marks must be a number between 0 and 10." },
            { status: 400 }
          );
        }
      }

      const id = generateId("track");

      const now = new Date().toISOString();
      // INSERT OR REPLACE in student_tracker
      await db.run(
        `INSERT INTO student_tracker (id, student_id, class_group, subject, week_number, submission_url, viva_assessment, marks, graded_by, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(student_id, class_group, subject, week_number) DO UPDATE SET
           submission_url = CASE WHEN excluded.submission_url IS NOT NULL THEN excluded.submission_url ELSE student_tracker.submission_url END,
           viva_assessment = CASE WHEN excluded.viva_assessment IS NOT NULL THEN excluded.viva_assessment ELSE student_tracker.viva_assessment END,
           marks = CASE WHEN excluded.marks IS NOT NULL THEN excluded.marks ELSE student_tracker.marks END,
           graded_by = CASE WHEN excluded.graded_by IS NOT NULL THEN excluded.graded_by ELSE student_tracker.graded_by END,
           updated_at = excluded.updated_at`,
        [
          id,
          studentId,
          classGroup,
          subject,
          weekNumber,
          submissionUrl !== undefined ? submissionUrl : null,
          vivaAssessment !== undefined ? vivaAssessment : null,
          marks !== undefined && marks !== null ? parseFloat(marks) : null,
          gradedBy !== undefined ? gradedBy : null,
          now
        ]
      );

      // Fetch the updated entry
      const updatedEntry = await db.get(
        "SELECT * FROM student_tracker WHERE student_id = ? AND class_group = ? AND subject = ? AND week_number = ?",
        [studentId, classGroup, subject, weekNumber]
      );

      return NextResponse.json({ success: true, entry: updatedEntry });
    }

    return NextResponse.json({ success: false, message: "Invalid action." }, { status: 400 });
  } catch (error: any) {
    console.error("API PUT student-tracker error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const { errorResponse } = await requireAuth(request, { allowedRoles: TASK_ASSIGN_ROLES });
  if (errorResponse) return errorResponse;

  try {
    const db = await getDb();
    const { searchParams } = new URL(request.url);
    const classGroup = searchParams.get("classGroup");
    const subject = searchParams.get("subject");
    const weekNumber = searchParams.get("weekNumber");

    if (!classGroup || !subject || !weekNumber) {
      return NextResponse.json(
        { success: false, message: "Missing classGroup, subject, or weekNumber" },
        { status: 400 }
      );
    }

    const wk = parseInt(weekNumber, 10);

    // Delete task from weekly_tasks
    await db.run(
      `DELETE FROM weekly_tasks 
       WHERE LOWER(TRIM(class_group)) = LOWER(TRIM(?)) 
         AND LOWER(TRIM(subject)) = LOWER(TRIM(?)) 
         AND week_number = ?`,
      [classGroup, subject, wk]
    );

    // Delete associated tracker entries
    await db.run(
      `DELETE FROM student_tracker 
       WHERE LOWER(TRIM(class_group)) = LOWER(TRIM(?)) 
         AND LOWER(TRIM(subject)) = LOWER(TRIM(?)) 
         AND week_number = ?`,
      [classGroup, subject, wk]
    );

    return NextResponse.json({ success: true, message: "Task deleted successfully." });
  } catch (error: any) {
    console.error("API DELETE student-tracker error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
