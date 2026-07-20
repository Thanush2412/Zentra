import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

// POST to create a new leave/OD request
export async function POST(request: Request) {
  try {
    const db = await getDb();
    const body = await request.json();
    const { studentId, studentName, classGroup, type, dateStr, reason } = body;

    if (!studentId || !studentName || !classGroup || !type || !dateStr || !reason) {
      return NextResponse.json({ success: false, message: "Missing required fields" }, { status: 400 });
    }

    const newId = "lr_" + Date.now();
    await db.run(
      `INSERT INTO leave_requests (
        id, studentId, studentName, classGroup, type, dateStr, reason, status, approvedBy, timestamp
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', NULL, ?)`,
      newId,
      studentId,
      studentName,
      classGroup,
      type,
      dateStr,
      reason,
      new Date().toISOString()
    );

    // Add to audit logs
    const logId = "l_" + Date.now();
    const logDesc = `Student ${studentName} (${classGroup}) submitted a ${type.toUpperCase()} request for ${dateStr}`;
    await db.run(
      "INSERT INTO audit_logs (id, type, description, actorName, actorRole, timestamp) VALUES (?, 'leave_request', ?, ?, 'Student', ?)",
      logId,
      logDesc,
      studentName,
      new Date().toISOString()
    );

    return NextResponse.json({ success: true, message: "Leave request submitted successfully." });
  } catch (error: any) {
    console.error("API POST Leave error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// PUT to approve/reject a leave request
export async function PUT(request: Request) {
  try {
    const db = await getDb();
    const body = await request.json();
    const { requestId, status, approvedBy } = body;

    if (!requestId || !status) {
      return NextResponse.json({ success: false, message: "Missing requestId or status" }, { status: 400 });
    }

    const leaveReq = await db.get("SELECT * FROM leave_requests WHERE id = ?", requestId);
    if (!leaveReq) {
      return NextResponse.json({ success: false, message: "Leave request not found" }, { status: 404 });
    }

    await db.run(
      "UPDATE leave_requests SET status = ?, approvedBy = ? WHERE id = ?",
      status,
      approvedBy || "Campus Manager",
      requestId
    );

    // If approved, update student attendance records for that day to 'present' (excused) for all classes of their classGroup
    if (status === "approved") {
      // Find all slots scheduled for this student's classGroup on the day of the week matching dateStr
      const reqDate = new Date(leaveReq.dateStr);
      const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
      const dayOfWeek = days[reqDate.getDay()];

      const slots = await db.all("SELECT id FROM slots WHERE LOWER(classGroup) = LOWER(?) AND day = ?", leaveReq.classGroup, dayOfWeek);

      for (const slot of slots) {
        // Only insert if attendance is not already marked for this slot
        const existingAtt = await db.get(
          "SELECT id FROM student_attendance WHERE studentId = ? AND slotId = ? AND dateStr = ?",
          leaveReq.studentId,
          slot.id,
          leaveReq.dateStr
        );
        
        if (!existingAtt) {
          const attId = `att_${leaveReq.studentId}_${slot.id}_${leaveReq.dateStr}`;
          await db.run(
            `INSERT INTO student_attendance (id, studentId, slotId, dateStr, status, markedBy, timestamp)
             VALUES (?, ?, ?, ?, 'present', ?, ?)`,
            attId,
            leaveReq.studentId,
            slot.id,
            leaveReq.dateStr,
            `CAM ${leaveReq.type.toUpperCase()} Approval`,
            new Date().toISOString()
          );
        }
      }
    }

    // Add to audit logs
    const logId = "l_" + Date.now();
    const logDesc = `CAM resolved ${leaveReq.studentName}'s ${leaveReq.type.toUpperCase()} request as ${status.toUpperCase()}`;
    await db.run(
      "INSERT INTO audit_logs (id, type, description, actorName, actorRole, timestamp) VALUES (?, 'leave_resolution', ?, ?, 'Mentor Header', ?)",
      logId,
      logDesc,
      approvedBy || "Campus Manager",
      new Date().toISOString()
    );

    return NextResponse.json({ success: true, message: `Leave request status updated to ${status}.` });
  } catch (error: any) {
    console.error("API PUT Leave error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
