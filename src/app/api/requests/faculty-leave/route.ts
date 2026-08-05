import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { sendMail, renderEmailShell } from "@/lib/mail";

export async function GET(request: Request) {
  try {
    const db = await getDb();
    const { searchParams } = new URL(request.url);

    const collegeId = searchParams.get("collegeId");
    const mentorId = searchParams.get("mentorId");
    const status = searchParams.get("status");

    let query = `
      SELECT flr.*, m.name as mentorName, m.email as mentorEmail, m.department as mentorDepartment, c.name as collegeName
      FROM faculty_leave_requests flr
      JOIN mentors m ON flr.mentor_id = m.id
      LEFT JOIN colleges c ON flr.college_id = c.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (collegeId) {
      query += ` AND flr.college_id = ?`;
      params.push(collegeId);
    }
    if (mentorId) {
      query += ` AND flr.mentor_id = ?`;
      params.push(mentorId);
    }
    if (status) {
      query += ` AND flr.status = ?`;
      params.push(status);
    }

    query += ` ORDER BY flr.created_at DESC`;

    const records = await db.all(query, params);
    return NextResponse.json({ success: true, records });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const db = await getDb();
    const body = await request.json();
    const { action } = body;

    // 1. Approval or Rejection by Campus Manager (CM)
    if (action === "approve" || action === "reject") {
      const { requestId, approvedBy, rejectionReason } = body;

      if (!requestId) {
        return NextResponse.json({ success: false, message: "Missing requestId" }, { status: 400 });
      }

      const reqRecord = await db.get(
        `SELECT flr.*, m.name as mentorName, m.email as mentorEmail, c.name as collegeName
         FROM faculty_leave_requests flr
         JOIN mentors m ON flr.mentor_id = m.id
         LEFT JOIN colleges c ON flr.college_id = c.id
         WHERE flr.id = ?`,
        [requestId]
      );
      if (!reqRecord) {
        return NextResponse.json({ success: false, message: "Request not found" }, { status: 404 });
      }

      const newStatus = action === "approve" ? "approved" : "rejected";

      await db.run(
        `UPDATE faculty_leave_requests
         SET status = ?, approved_by = ?, rejection_reason = ?, updated_at = datetime('now')
         WHERE id = ?`,
        [newStatus, approvedBy || "Campus Manager", rejectionReason || null, requestId]
      );

      // Automatic Sync to mentor_attendance if approved
      if (action === "approve") {
        const startDate = new Date(reqRecord.start_date);
        const endDate = new Date(reqRecord.end_date);
        const attStatus = reqRecord.request_type === "OD" ? "OD" : "Leave";

        let cur = new Date(startDate);
        while (cur <= endDate) {
          const dateStr = cur.toISOString().split("T")[0];
          const attId = `att_${reqRecord.mentor_id}_${dateStr}`;
          
          await db.run(
            `INSERT INTO mentor_attendance (id, mentor_id, college_id, date_str, status, reason, marked_by, marked_by_id, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, 'cam_approval', ?, datetime('now'))
             ON CONFLICT(mentor_id, date_str) DO UPDATE SET
             status = excluded.status,
             reason = excluded.reason,
             marked_by = excluded.marked_by,
             marked_by_id = excluded.marked_by_id,
             updated_at = datetime('now')`,
            [
              attId,
              reqRecord.mentor_id,
              reqRecord.college_id,
              dateStr,
              attStatus,
              `${reqRecord.request_type}: ${reqRecord.reason}`,
              approvedBy || "Campus Manager"
            ]
          );

          cur.setDate(cur.getDate() + 1);
        }
      }

      // Trigger Email Notification to Mentor (End 2)
      if (reqRecord.mentorEmail) {
        try {
          const emailSubject = `[Update] Your ${reqRecord.request_type} Request Has Been ${newStatus.toUpperCase()}`;
          const emailHtml = renderEmailShell({
            title: `Application ${newStatus.toUpperCase()}`,
            badgeText: newStatus === "approved" ? "APPROVED BY CM" : "REJECTED BY CM",
            badgeColor: newStatus === "approved" ? "emerald" : "rose",
            description: `Hello ${reqRecord.mentorName}, your ${reqRecord.request_type} application has been ${newStatus} by your Campus Manager.`,
            details: [
              { label: "Request Type", value: reqRecord.request_type, highlight: true },
              { label: "Date Schedule", value: `${reqRecord.start_date} to ${reqRecord.end_date}` },
              { label: "Status", value: newStatus.toUpperCase(), highlight: true },
              { label: "Processed By", value: approvedBy || "Campus Manager" },
              ...(rejectionReason ? [{ label: "CM Remarks", value: rejectionReason }] : [])
            ],
            footerText: "Official notification from FACE Prep E-Campus Operations."
          });

          await sendMail({
            to: reqRecord.mentorEmail,
            subject: emailSubject,
            htmlBody: emailHtml
          });
        } catch (mailErr) {
          console.error("Failed to send leave decision email to mentor:", mailErr);
        }
      }

      return NextResponse.json({
        success: true,
        message: `Faculty leave request ${newStatus} successfully and notification email sent.`
      });
    }

    // 2. Submit new Leave / Permission / OD request (By Mentor)
    const {
      mentorId,
      collegeId,
      requestType,
      startDate,
      endDate,
      startTime,
      endTime,
      reason
    } = body;

    if (!mentorId || !requestType || !startDate || !reason || !reason.trim()) {
      return NextResponse.json({ success: false, message: "Missing required fields: Request Type, Dates, and Mandatory Reason are required." }, { status: 400 });
    }

    const effectiveEndDate = endDate || startDate;
    const reqId = `f_leave_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

    let effectiveCollegeId = collegeId;
    const mentor = await db.get(`SELECT * FROM mentors WHERE id = ?`, [mentorId]);
    if (!effectiveCollegeId) {
      effectiveCollegeId = mentor?.college_id || "general";
    }

    const finalReason = requestType === "Permission" && startTime && endTime
      ? `[Time: ${startTime} - ${endTime}] ${reason.trim()}`
      : reason.trim();

    await db.run(
      `INSERT INTO faculty_leave_requests (id, mentor_id, college_id, request_type, leave_category, start_date, end_date, reason, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', datetime('now'), datetime('now'))`,
      [
        reqId,
        mentorId,
        effectiveCollegeId,
        requestType,
        requestType,
        startDate,
        effectiveEndDate,
        finalReason
      ]
    );

    // Trigger Email Notification to Campus Manager (CM) (End 1)
    const camUser = await db.get(
      `SELECT email, name FROM cams WHERE college_id = ? LIMIT 1`,
      [effectiveCollegeId]
    );

    const cmEmail = camUser?.email || "cam@zentra.edu";
    if (cmEmail) {
      try {
        const emailSubject = `[Action Required] New ${requestType} Request - ${mentor?.name || "Faculty"}`;
        const emailHtml = renderEmailShell({
          title: `New ${requestType} Application Pending Review`,
          badgeText: "ACTION REQUIRED",
          badgeColor: "amber",
          description: `Faculty member ${mentor?.name || "A Mentor"} has submitted a new ${requestType} application requiring your review and approval.`,
          details: [
            { label: "Faculty Name", value: mentor?.name || "Faculty", highlight: true },
            { label: "Department", value: mentor?.department || "General" },
            { label: "Request Type", value: requestType, highlight: true },
            { label: "Schedule", value: requestType === "Permission" && startTime ? `${startDate} (${startTime} - ${endTime})` : `${startDate} to ${effectiveEndDate}` },
            { label: "Mandatory Reason", value: finalReason }
          ],
          ctaText: "Open CM Dashboard to Approve/Reject →",
          footerText: "Official operational notification from FACE Prep E-Campus System."
        });

        await sendMail({
          to: cmEmail,
          subject: emailSubject,
          htmlBody: emailHtml
        });
      } catch (mailErr) {
        console.error("Failed to send leave request email to CM:", mailErr);
      }
    }

    return NextResponse.json({
      success: true,
      message: `${requestType} request submitted successfully! Email notification sent to CM.`,
      requestId: reqId
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
