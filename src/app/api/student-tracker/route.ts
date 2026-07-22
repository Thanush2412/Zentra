import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { sendMail, formatZentraEmail } from "@/lib/mail";

export async function POST(request: Request) {
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

      const id = `task_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      
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

      // Asynchronously trigger email notification to all students
      try {
        const mentor = await db.get("SELECT name, email FROM mentors WHERE id = ?", mentorId);
        const mentorName = mentor?.name || "Faculty Mentor";
        
        const studentsInClass = await db.all("SELECT email FROM students WHERE LOWER(TRIM(classGroup)) = LOWER(TRIM(?))", [classGroup]);
        const studentEmails = studentsInClass.map((s: any) => s.email).filter(Boolean);
        const recipientList = studentEmails.length > 0 ? studentEmails.join(",") : "thanush@faceprep.in";

        const mailSubject = `[Zentra] New Task Assigned: Week ${weekNumber} - ${subject}`;
        const htmlBody = formatZentraEmail({
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
          footerText: "Please log in to submit your weekly task entry."
        });

        await sendMail({
          to: recipientList,
          subject: mailSubject,
          htmlBody
        });
      } catch (mailErr) {
        console.error("Failed to send weekly task assignment email:", mailErr);
      }

      return NextResponse.json({ success: true, task: updatedTask });
    }

    return NextResponse.json({ success: false, message: "Invalid action." }, { status: 400 });
  } catch (error: any) {
    console.error("API POST student-tracker error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const db = await getDb();
    const body = await request.json();
    const { action, studentId, classGroup, subject, weekNumber, submissionUrl, vivaAssessment, marks, gradedBy } = body;

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

      const id = `track_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

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
