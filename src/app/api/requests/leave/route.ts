// Pin to Mumbai (bom1) — co-located with Turso DB (aws-ap-south-1)
export const preferredRegion = "bom1";
export const maxDuration = 60;

import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { sendMail, renderEmailShell } from "@/lib/mail";

// GET /api/requests/leave?college_id=...
export async function GET(request: Request) {
  try {
    const db = await getDb();
    const { searchParams } = new URL(request.url);
    const collegeId = searchParams.get("college_id");

    let query = `
      SELECT lr.*, s.email as studentEmail
      FROM leave_requests lr
      LEFT JOIN students s ON lr.studentId = s.id
    `;
    let params: any[] = [];

    if (collegeId) {
      query += " WHERE s.college_id = ? OR lr.classGroup IN (SELECT classGroup FROM class_mentor_assignments WHERE college_id = ?)";
      params.push(collegeId, collegeId);
    }

    query += " ORDER BY lr.timestamp DESC LIMIT 100";

    const requests = await db.all(query, ...params);
    return NextResponse.json({ success: true, requests });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST to create a new leave/OD request by student
export async function POST(request: Request) {
  try {
    const db = await getDb();
    const body = await request.json();
    const { studentId, studentName, classGroup, type, dateStr, reason } = body;

    if (!studentId || !studentName || !classGroup || !type || !dateStr || !reason) {
      return NextResponse.json({ success: false, message: "Missing required fields" }, { status: 400 });
    }

    const newId = "lr_" + Date.now();
    const nowIso = new Date().toISOString();

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
      nowIso
    );

    // Add to audit logs
    const logId = "l_" + Date.now();
    const logDesc = `Student ${studentName} (${classGroup}) submitted a ${type.toUpperCase()} request for ${dateStr}`;
    await db.run(
      "INSERT INTO audit_logs (id, type, description, actorName, actorRole, timestamp) VALUES (?, 'leave_request', ?, ?, 'Student', ?)",
      logId,
      logDesc,
      studentName,
      nowIso
    );

    // Send email notification to Class Teacher / Mentor(s) and Campus Manager(s)
    try {
      const student = await db.get("SELECT college_id, email FROM students WHERE id = ?", [studentId]);
      const collegeId = student?.college_id || "";

      if (collegeId) {
        // Fetch CMs of this college
        const cms = await db.all("SELECT email, name FROM campus_managers WHERE college_id = ?", [collegeId]);
        const cmEmails = cms.map((cm: any) => cm.email).filter(Boolean);

        // Fetch assigned Class Teacher for this classGroup
        const assignedClassTeacher = await db.get(
          `SELECT m.email, m.name
           FROM class_mentor_assignments cma
           JOIN mentors m ON cma.mentor_id = m.id
           WHERE cma.college_id = ? AND LOWER(cma.classGroup) = LOWER(?)`,
          [collegeId, classGroup]
        );

        let targetEmails: string[] = [];
        if (assignedClassTeacher?.email) {
          targetEmails.push(assignedClassTeacher.email);
        } else {
          // Fallback to all mentors of college
          const mentors = await db.all("SELECT email FROM mentors WHERE college_id = ?", [collegeId]);
          targetEmails.push(...mentors.map((m: any) => m.email).filter(Boolean));
        }

        // Combine unique email addresses (Class Teacher / Mentors + CMs)
        const allRecipientEmails = Array.from(new Set([...targetEmails, ...cmEmails].filter(Boolean)));

        if (allRecipientEmails.length > 0) {
          await sendMail({
            to: allRecipientEmails.join(", "),
            subject: `[Student ${type.toUpperCase()} Request] ${studentName} (${classGroup}) — ${dateStr}`,
            htmlBody: renderEmailShell({
              title: `New Student ${type.toUpperCase()} Application`,
              badgeText: `${type.toUpperCase()} Pending Class Teacher Review`,
              badgeColor: "amber",
              description: `Student <strong>${studentName}</strong> from cohort <strong>${classGroup}</strong> has submitted a new ${type.toUpperCase()} request for <strong>${dateStr}</strong>. ${assignedClassTeacher?.name ? `Class Teacher: <strong>${assignedClassTeacher.name}</strong>` : ""}`,
              details: [
                { label: "Student Name", value: studentName, highlight: true },
                { label: "Class Group", value: classGroup },
                { label: "Class Teacher", value: assignedClassTeacher?.name || "Unassigned (All Mentors)" },
                { label: "Request Type", value: type.toUpperCase() },
                { label: "Leave Date", value: dateStr, highlight: true },
                { label: "Reason", value: reason },
                { label: "Submitted At", value: new Date(nowIso).toLocaleString() },
              ],
              ctaText: "Open Portal Console to Review & Approve →",
            }),
          });
        }
      }
    } catch (mailErr) {
      console.warn("Failed to send student leave request email to Mentor/CM:", mailErr);
    }

    return NextResponse.json({ success: true, message: "Leave request submitted successfully & Class Teacher / CM notified via email." });
  } catch (error: any) {
    console.error("API POST Leave error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// PUT to approve/reject a leave request by CM / Mentor
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

    const resolverName = approvedBy || "Class Teacher / CAM";

    await db.run(
      "UPDATE leave_requests SET status = ?, approvedBy = ? WHERE id = ?",
      status,
      resolverName,
      requestId
    );

    // If approved, update student attendance records for that day to 'OD' or 'Leave' so they don't show as Absent
    if (status === "approved") {
      const attendanceStatus = leaveReq.type.toLowerCase() === "od" ? "OD" : "Leave";
      const dateString = leaveReq.dateStr.includes("T") ? leaveReq.dateStr : leaveReq.dateStr + "T00:00:00";
      const reqDate = new Date(dateString);
      const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
      const dayOfWeek = days[reqDate.getDay()];

      const slots = await db.all("SELECT id FROM slots WHERE LOWER(classGroup) = LOWER(?) AND day = ?", leaveReq.classGroup, dayOfWeek);

      for (const slot of slots) {
        const existingAtt = await db.get(
          "SELECT id FROM student_attendance WHERE studentId = ? AND slotId = ? AND dateStr = ?",
          leaveReq.studentId,
          slot.id,
          leaveReq.dateStr
        );
        
        if (existingAtt) {
          await db.run(
            `UPDATE student_attendance SET status = ?, markedBy = ?, timestamp = ? WHERE id = ?`,
            attendanceStatus,
            `Approved by ${resolverName}`,
            new Date().toISOString(),
            existingAtt.id
          );
        } else {
          const attId = `att_${leaveReq.studentId}_${slot.id}_${leaveReq.dateStr}`;
          await db.run(
            `INSERT INTO student_attendance (id, studentId, slotId, dateStr, status, markedBy, timestamp)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            attId,
            leaveReq.studentId,
            slot.id,
            leaveReq.dateStr,
            attendanceStatus,
            `Approved by ${resolverName}`,
            new Date().toISOString()
          );
        }
      }
    }

    // Add to audit logs
    const logId = "l_" + Date.now();
    const logDesc = `CAM resolved ${leaveReq.studentName}'s ${leaveReq.type.toUpperCase()} request as ${status.toUpperCase()}`;
    await db.run(
      "INSERT INTO audit_logs (id, type, description, actorName, actorRole, timestamp) VALUES (?, 'leave_resolution', ?, ?, 'Campus Manager', ?)",
      logId,
      logDesc,
      resolverName,
      new Date().toISOString()
    );

    // Send decision notification email to Student
    try {
      const student = await db.get("SELECT email FROM students WHERE id = ?", [leaveReq.studentId]);
      const studentEmail = student?.email;

      if (studentEmail) {
        const isApproved = status === "approved";
        await sendMail({
          to: studentEmail,
          subject: `[Leave Request ${status.toUpperCase()}] Your ${leaveReq.type.toUpperCase()} for ${leaveReq.dateStr}`,
          htmlBody: renderEmailShell({
            title: `Your ${leaveReq.type.toUpperCase()} Request Has Been ${isApproved ? "Approved" : "Rejected"}`,
            badgeText: `Status: ${status.toUpperCase()}`,
            badgeColor: isApproved ? "emerald" : "rose",
            description: `Dear <strong>${leaveReq.studentName}</strong>, your ${leaveReq.type.toUpperCase()} request for <strong>${leaveReq.dateStr}</strong> has been reviewed and <strong>${status.toUpperCase()}</strong> by <strong>${resolverName}</strong>.`,
            details: [
              { label: "Student Name", value: leaveReq.studentName },
              { label: "Class Group", value: leaveReq.classGroup },
              { label: "Request Type", value: leaveReq.type.toUpperCase() },
              { label: "Leave Date", value: leaveReq.dateStr, highlight: true },
              { label: "Status Decision", value: status.toUpperCase(), highlight: true },
              { label: "Reviewed By", value: resolverName },
              ...(isApproved ? [{ label: "Attendance Action", value: "Class periods on this date automatically excused as Present." }] : []),
            ],
            ctaText: "Open Student Dashboard →",
          }),
        });
      }
    } catch (mailErr) {
      console.warn("Failed to send leave decision email to student:", mailErr);
    }

    return NextResponse.json({
      success: true,
      message: `Leave request status updated to ${status}. Notification email dispatched.`
    });
  } catch (error: any) {
    console.error("API PUT Leave error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
