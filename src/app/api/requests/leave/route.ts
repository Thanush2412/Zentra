export const maxDuration = 60;

import { NextResponse, after } from "next/server";
import { getDb, type QueryFailure } from "@/lib/db";
import { requireAuth, Role } from "@/lib/authGuard";
import { renderEmailShell } from "@/lib/mail";
import { dispatchMail } from "@/lib/mailAsync";
import { generateId } from "@/lib/id";

// No screen calls this route today, but it writes student leave rows and mails
// parents-style notices, so it is guarded rather than left anonymous.
const STUDENT_LEAVE_ROLES: Role[] = ["student", "mentor", "cm", "kam", "admin"];

// GET /api/requests/leave?college_id=...&mentor_id=...&class_group=...
export async function GET(request: Request) {
  const { errorResponse } = await requireAuth(request, {
    allowedRoles: STUDENT_LEAVE_ROLES,
    checkCsrf: false
  });
  if (errorResponse) return errorResponse;

  try {
    const db = await getDb();
    const { searchParams } = new URL(request.url);
    const collegeId = searchParams.get("college_id") || searchParams.get("collegeId");
    const classGroup = searchParams.get("class_group") || searchParams.get("classGroup");

    let query = `
      SELECT lr.*, s.email as studentEmail, s.name as studentDbName, s.id as studentRollNo, s.college_id as studentCollegeId
      FROM leave_requests lr
      LEFT JOIN students s ON (lr.studentId = s.id OR LOWER(TRIM(lr.studentName)) = LOWER(TRIM(s.name)))
    `;
    let conditions: string[] = [];
    let params: any[] = [];

    if (collegeId && collegeId !== "all") {
      conditions.push(`(
        LOWER(TRIM(COALESCE(s.college_id, ''))) = LOWER(TRIM(?))
        OR LOWER(TRIM(lr.classGroup)) IN (
          SELECT LOWER(TRIM(cma.classGroup)) FROM class_mentor_assignments cma WHERE LOWER(TRIM(cma.college_id)) = LOWER(TRIM(?))
        )
        OR LOWER(TRIM(lr.classGroup)) IN (
          SELECT LOWER(TRIM(m.mentor_group)) FROM mentors m WHERE LOWER(TRIM(m.college_id)) = LOWER(TRIM(?))
        )
        OR lr.studentId IN (
          SELECT st.id FROM students st WHERE LOWER(TRIM(st.college_id)) = LOWER(TRIM(?))
        )
        OR s.college_id IS NULL
      )`);
      params.push(collegeId, collegeId, collegeId, collegeId);
    }

    if (classGroup) {
      conditions.push("LOWER(TRIM(lr.classGroup)) = LOWER(TRIM(?))");
      params.push(classGroup);
    }

    if (conditions.length > 0) {
      query += " WHERE " + conditions.join(" AND ");
    }

    query += " ORDER BY lr.timestamp DESC LIMIT 200";

    const requests = await db.all(query, ...params);

    const normalizedRequests = (requests || []).map((r: any) => ({
      ...r,
      studentId: r.studentId || r.studentid,
      studentName: r.studentName || r.studentname,
      classGroup: r.classGroup || r.classgroup,
      dateStr: r.dateStr || r.datestr,
      approvedBy: r.approvedBy || r.approvedby,
      studentEmail: r.studentEmail || r.studentemail,
      studentRollNo: r.studentRollNo || r.studentrollno || r.studentId || r.studentid
    }));

    return NextResponse.json({ success: true, requests: normalizedRequests });
  } catch (error: any) {
    console.error("API GET Leave error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST to create a new leave/OD request by student
export async function POST(request: Request) {
  const { errorResponse } = await requireAuth(request, { allowedRoles: STUDENT_LEAVE_ROLES });
  if (errorResponse) return errorResponse;

  try {
    const db = await getDb();
    const body = await request.json();
    const { studentId, studentName, classGroup, type, dateStr, reason } = body;

    if (!studentId || !studentName || !classGroup || !type || !dateStr || !reason) {
      return NextResponse.json({ success: false, message: "Missing required fields" }, { status: 400 });
    }

    const newId = generateId("lr");
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
    const logId = generateId("l");
    const logDesc = `Student ${studentName} (${classGroup}) submitted a ${type.toUpperCase()} request for ${dateStr}`;
    await db.run(
      "INSERT INTO audit_logs (id, type, description, actorName, actorRole, timestamp) VALUES (?, 'leave_request', ?, ?, 'Student', ?)",
      logId,
      logDesc,
      studentName,
      nowIso
    );

    // Notification moves behind the response: three lookups plus a relay leg that
    // can burn 12s must not stretch the students submission into a timeout.
    after(async () => {
      try {
        let collegeId = body.college_id || body.collegeId;
        if (!collegeId) {
          const student = await db.get("SELECT college_id FROM students WHERE id = ? OR LOWER(TRIM(name)) = LOWER(TRIM(?))", [studentId, studentName]);
          collegeId = student?.college_id;
        }
  
        if (collegeId) {
          // The campus managers and the assigned class teacher both key off
          // collegeId/classGroup, so they leave as one group. Mail-only inputs, so a
          // failed slice degrades to "no recipient" instead of failing the response.
          const audienceFailures: QueryFailure[] = [];
          const [cms, classTeacherRows] = await db.multiQuery([
            { sql: "SELECT email, name FROM campus_managers WHERE college_id = ?", params: [collegeId] },
            {
              sql: `SELECT m.email, m.name
             FROM class_mentor_assignments cma
             JOIN mentors m ON cma.mentor_id = m.id
             WHERE cma.college_id = ? AND LOWER(cma.classGroup) = LOWER(?)`,
              params: [collegeId, classGroup],
            },
          ], audienceFailures);
          if (audienceFailures.length > 0) {
            console.warn("[requests/leave] recipient lookup incomplete:", audienceFailures.map(f => f.error).join("; "));
          }
          const cmEmails = cms.map((cm: any) => cm.email).filter(Boolean);
  
          // Assigned Class Teacher for this classGroup
          const assignedClassTeacher = classTeacherRows[0];
  
          let targetEmails: string[] = [];
          if (assignedClassTeacher?.email) {
            targetEmails.push(assignedClassTeacher.email);
          }
          // No class teacher assigned: escalate to the campus managers only. Broadcasting to
          // every mentor on a campus mailed leave requests for students they never teach.
          const hasClassTeacher = Boolean(assignedClassTeacher?.email);
  
          // Combine unique email addresses (Class Teacher + CMs)
          const allRecipientEmails = Array.from(new Set([...targetEmails, ...cmEmails].filter(Boolean)));
  
          if (allRecipientEmails.length > 0) {
            await dispatchMail({
              to: allRecipientEmails,
              subject: `[Student ${type.toUpperCase()} Request] ${studentName} (${classGroup}) — ${dateStr}`,
              htmlBody: renderEmailShell({
                title: `New Student ${type.toUpperCase()} Application`,
                badgeText: `${type.toUpperCase()} Pending Class Teacher Review`,
                badgeColor: "amber",
                description: `Student <strong>${studentName}</strong> from cohort <strong>${classGroup}</strong> has submitted a new ${type.toUpperCase()} request for <strong>${dateStr}</strong>. ${assignedClassTeacher?.name ? `Class Teacher: <strong>${assignedClassTeacher.name}</strong>` : "No class teacher is assigned to this cohort, so the campus managers are reviewing it."}`,
                details: [
                  { label: "Student Name", value: studentName, highlight: true },
                  { label: "Class Group", value: classGroup },
                  { label: "Class Teacher", value: hasClassTeacher ? assignedClassTeacher.name : "Unassigned (Campus Manager to review)" },
                  { label: "Request Type", value: type.toUpperCase() },
                  { label: "Leave Date", value: dateStr, highlight: true },
                  { label: "Reason", value: reason },
                  { label: "Submitted At", value: new Date(nowIso).toLocaleString() },
                ],
                ctaText: "Open Portal Console to Review & Approve →",
              }),
              context: "student-leave-created",
            });
          }
        }
      } catch (mailErr) {
        console.warn("Failed to send student leave request email to Mentor/CM:", mailErr);
      }
    });

    return NextResponse.json({ 
      success: true, 
      requestId: newId,
      message: "Leave request submitted successfully. The Class Teacher / CM are being notified by email."
    });
  } catch (error: any) {
    console.error("API POST Leave error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// PUT to approve/reject a leave request by CM / Mentor
export async function PUT(request: Request) {
  const { auth, errorResponse } = await requireAuth(request, { allowedRoles: STUDENT_LEAVE_ROLES });
  if (errorResponse) return errorResponse;

  try {
    const db = await getDb();
    const body = await request.json();
    const { requestId, status } = body;

    if (!requestId || !status) {
      return NextResponse.json({ success: false, message: "Missing requestId or status" }, { status: 400 });
    }

    const leaveReq = await db.get("SELECT * FROM leave_requests WHERE id = ?", requestId);
    if (!leaveReq) {
      return NextResponse.json({ success: false, message: "Leave request not found" }, { status: 404 });
    }

    // Body-supplied "approvedBy" was persisted verbatim, so any caller could sign a
    // resolution as "Principal". Record whoever the session actually belongs to.
    const resolverName = auth?.user?.name || "Class Teacher / CM";

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

      if (slots.length > 0) {
        const slotIds = slots.map((s: any) => s.id);
        const slotPlaceholders = slotIds.map(() => "?").join(",");

        // Single pass: fetch all existing attendance rows for this student/date
        // at once, then batch the missing inserts (was 2 queries per slot).
        const existingRows = await db.all(
          `SELECT id, slotId FROM student_attendance WHERE studentId = ? AND dateStr = ? AND slotId IN (${slotPlaceholders})`,
          leaveReq.studentId,
          leaveReq.dateStr,
          ...slotIds
        );
        const existingBySlot = new Map<string, string>();
        for (const row of existingRows) {
          existingBySlot.set(row.slotId, row.id);
        }

        const markedBy = `Approved by ${resolverName}`;
        const nowIso = new Date().toISOString();
        const toInsert: any[] = [];
        for (const slotId of slotIds) {
          const existingId = existingBySlot.get(slotId);
          if (existingId) {
            await db.run(
              `UPDATE student_attendance SET status = ?, markedBy = ?, timestamp = ? WHERE id = ?`,
              attendanceStatus,
              markedBy,
              nowIso,
              existingId
            );
          } else {
            toInsert.push([`att_${leaveReq.studentId}_${slotId}_${leaveReq.dateStr}`, leaveReq.studentId, slotId, leaveReq.dateStr, attendanceStatus, markedBy, nowIso]);
          }
        }
        if (toInsert.length > 0) {
          const valueRows = toInsert.map(() => "(?, ?, ?, ?, ?, ?, ?)").join(", ");
          await db.run(
            `INSERT INTO student_attendance (id, studentId, slotId, dateStr, status, markedBy, timestamp)
             VALUES ${valueRows}`,
            ...toInsert.flat()
          );
        }
      }
    }

    // Add to audit logs
    const logId = generateId("l");
    const logDesc = `CAM/Mentor resolved ${leaveReq.studentName}'s ${leaveReq.type.toUpperCase()} request as ${status.toUpperCase()}`;
    await db.run(
      "INSERT INTO audit_logs (id, type, description, actorName, actorRole, timestamp) VALUES (?, 'leave_resolution', ?, ?, 'Class Teacher / CM', ?)",
      logId,
      logDesc,
      resolverName,
      new Date().toISOString()
    );

    // Deferred for the same reason: the decision is recorded, the student is told
    // once the response is already on the wire.
    after(async () => {
      try {
        const student = await db.get("SELECT email FROM students WHERE id = ?", [leaveReq.studentId]);
        const studentEmail = student?.email;
  
        if (studentEmail) {
          const isApproved = status === "approved";
          await dispatchMail({
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
                ...(isApproved ? [{ label: "Attendance Action", value: "Class periods on this date automatically excused as Present / OD." }] : []),
              ],
              ctaText: "Open Student Dashboard →",
            }),
            context: "student-leave-resolved",
          });
        }
      } catch (mailErr) {
        console.warn("Failed to send leave decision email to student:", mailErr);
      }
    });

    return NextResponse.json({
      success: true,
      message: `Leave request status updated to ${status}. The student is being notified by email.`
    });
  } catch (error: any) {
    console.error("API PUT Leave error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
