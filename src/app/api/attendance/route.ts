import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET(request: Request) {
  try {
    const db = await getDb();
    const { searchParams } = new URL(request.url);
    const slotId = searchParams.get("slotId");
    const dateStr = searchParams.get("dateStr");
    const studentId = searchParams.get("studentId");

    // 1. Fetch student historical logs (for CAM correction modal)
    if (studentId && !slotId && !dateStr) {
      const records = await db.all(
        `SELECT sa.*, s.time as timeSlot, s.course as subject, s.classGroup
         FROM student_attendance sa
         JOIN slots s ON sa.slotId = s.id
         WHERE sa.studentId = ?
         ORDER BY sa.dateStr DESC, s.time ASC`,
        [studentId]
      );
      const student = await db.get("SELECT correction_count FROM students WHERE id = ?", [studentId]);
      return NextResponse.json({
        success: true,
        records,
        correctionCount: student ? (student.correction_count || 0) : 0
      });
    }

    if (!slotId || !dateStr) {
      return NextResponse.json({ success: false, message: "Missing slotId or dateStr" }, { status: 400 });
    }

    let records;
    if (studentId) {
      records = await db.all(
        "SELECT * FROM student_attendance WHERE slotId = ? AND dateStr = ? AND studentId = ?",
        [slotId, dateStr, studentId]
      );
    } else {
      records = await db.all(
        "SELECT * FROM student_attendance WHERE slotId = ? AND dateStr = ?",
        [slotId, dateStr]
      );
    }

    const isMarked = records.length > 0;
    return NextResponse.json({
      success: true,
      isMarked,
      count: records.length,
      records
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const db = await getDb();
    const body = await request.json();
    const { action } = body;

    // ── ATTENDANCE CORRECTION BY CAM ───────────────────────────────
    if (action === "correct") {
      const {
        studentId,
        slotId,
        dateStr,
        newStatus,
        reason,
        changedBy,
        changedByRole,
        isAdminOverride
      } = body;

      if (!studentId || !slotId || !dateStr || !newStatus || !reason || !changedBy) {
        return NextResponse.json({ success: false, message: "Missing required fields for correction" }, { status: 400 });
      }

      // Check current student status & correction count
      const student = await db.get("SELECT name, correction_count FROM students WHERE id = ?", [studentId]);
      if (!student) {
        return NextResponse.json({ success: false, message: "Student not found" }, { status: 404 });
      }

      const currentCount = student.correction_count || 0;
      if (currentCount >= 2 && !isAdminOverride) {
        return NextResponse.json({
          success: false,
          message: `Correction blocked: ${student.name} has already utilized all 2 attendance corrections. Requires Admin override.`
        });
      }

      // Check old status
      const existing = await db.get(
        "SELECT status FROM student_attendance WHERE studentId = ? AND slotId = ? AND dateStr = ?",
        [studentId, slotId, dateStr]
      );
      const oldStatus = existing ? existing.status : "not_marked";

      if (oldStatus === newStatus) {
        return NextResponse.json({ success: false, message: `Status is already ${newStatus}.` });
      }

      await db.run("BEGIN TRANSACTION;");
      try {
        if (existing) {
          // Update existing
          await db.run(
            "UPDATE student_attendance SET status = ?, markedBy = ?, timestamp = ? WHERE studentId = ? AND slotId = ? AND dateStr = ?",
            [newStatus, changedBy, new Date().toISOString(), studentId, slotId, dateStr]
          );
        } else {
          // Insert new
          const recordId = `att_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
          await db.run(
            "INSERT INTO student_attendance (id, studentId, slotId, dateStr, status, markedBy, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?)",
            [recordId, studentId, slotId, dateStr, newStatus, changedBy, new Date().toISOString()]
          );
        }

        // Increment student correction counter
        await db.run(
          "UPDATE students SET correction_count = COALESCE(correction_count, 0) + 1 WHERE id = ?",
          [studentId]
        );

        // Log into audit trail
        const logId = `l_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        const description = `Attendance corrected for ${student.name} (${studentId}) on ${dateStr} in slot ${slotId}. Status changed from ${oldStatus.toUpperCase()} to ${newStatus.toUpperCase()}. Reason: "${reason}"`;
        
        await db.run(
          `INSERT INTO audit_logs (id, type, description, actorName, actorRole, timestamp, old_status, new_status, reason, changed_by)
           VALUES (?, 'attendance_correction', ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            logId,
            description,
            changedBy,
            changedByRole || "Campus Manager",
            new Date().toISOString(),
            oldStatus,
            newStatus,
            reason,
            changedBy
          ]
        );

        await db.run("COMMIT;");
        return NextResponse.json({
          success: true,
          message: "Attendance corrected successfully.",
          newCount: currentCount + 1
        });
      } catch (txError) {
        await db.run("ROLLBACK;");
        throw txError;
      }
    }

    // ── FACULTY ATTENDANCE SUBMISSION ───────────────────────────────
    const {
      slotId,
      dateStr,
      attendance,
      markedBy,
      actorName,
      actorRole,
      coveredSubject,
      type, // 'Regular' | 'Non-Regular'
      mode, // 'Online' | 'Offline'
      attendanceTypeSub // e.g., 'Event', 'Exam', 'Activity', 'Others'
    } = body;

    if (!slotId || !dateStr || !attendance || !Array.isArray(attendance)) {
      return NextResponse.json({ success: false, message: "Missing slotId, dateStr, or attendance data." }, { status: 400 });
    }

    const slot = await db.get("SELECT * FROM slots WHERE id = ?", slotId);
    if (!slot) {
      return NextResponse.json({ success: false, message: "Slot not found." }, { status: 404 });
    }

    await db.run("BEGIN TRANSACTION;");
    try {
      // Delete existing
      await db.run("DELETE FROM student_attendance WHERE slotId = ? AND dateStr = ?", [slotId, dateStr]);

      if (coveredSubject) {
        await db.run(
          "UPDATE approved_handovers SET course = ? WHERE slotId = ? AND dateStr = ?",
          [coveredSubject, slotId, dateStr]
        );
      }

      // Insert new records
      const timestamp = new Date().toISOString();
      let insertedCount = 0;
      for (const item of attendance) {
        const { studentId, status } = item;
        if (status === "not_marked") {
          continue;
        }
        const recordId = `att_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        await db.run(
          `INSERT INTO student_attendance (id, studentId, slotId, dateStr, status, markedBy, timestamp, type, mode, attendanceTypeSub)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            recordId,
            studentId,
            slotId,
            dateStr,
            status,
            markedBy || "System",
            timestamp,
            type || "Regular",
            mode || "Offline",
            attendanceTypeSub || null
          ]
        );
        insertedCount++;
      }

      const presentCount = attendance.filter((a: any) => a.status === "present").length;
      const absentCount = attendance.filter((a: any) => a.status === "absent").length;

      const logId = `l_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      const description = `Marked ${type || "Regular"} attendance (${mode || "Offline"}) for class ${slot.classGroup || "General"} in course "${slot.course}" on date ${dateStr} (${presentCount} present, ${absentCount} absent).`;
      
      await db.run(
        "INSERT INTO audit_logs (id, type, description, actorName, actorRole, timestamp) VALUES (?, ?, ?, ?, ?, ?)",
        [logId, "booking", description, actorName || "Faculty", actorRole || "Mentor", timestamp]
      );

      await db.run("COMMIT;");
      return NextResponse.json({ success: true, message: "Attendance marked successfully.", insertedCount });
    } catch (err) {
      await db.run("ROLLBACK;");
      throw err;
    }
  } catch (error: any) {
    console.error("API POST Attendance error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
