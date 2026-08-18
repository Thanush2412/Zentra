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
      let affectedClasses: any[] = [];
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

        // Automatic identification of affected demo sessions for this mentor
        const affectedDemos = await db.all(
          `SELECT * FROM demo_sessions 
           WHERE mentorId = ? AND status NOT IN ('completed', 'not_conducted')
           AND dateStr >= ? AND dateStr <= ?`,
          [reqRecord.mentor_id, reqRecord.start_date, reqRecord.end_date]
        );

        if (affectedDemos && affectedDemos.length > 0) {
          for (const demo of affectedDemos) {
            const leaveReason = `Mentor ${reqRecord.mentorName} approved leave (${reqRecord.start_date} to ${reqRecord.end_date}). CAM Reason: ${reqRecord.reason || 'Leave Approved'}`;
            
            // Prioritize Head SME assigned to the Subject Group, then eligible domain SMEs
            const candidateSmes = await db.all(
              `SELECT * FROM sme_users 
               ORDER BY CASE 
                 WHEN (is_head_sme = 1 OR head_subject_group = ?) AND (subject LIKE ? OR ? LIKE '%' || subject || '%') THEN 0 
                 WHEN subject LIKE ? OR ? LIKE '%' || subject || '%' THEN 1 
                 ELSE 2 
               END`,
              [demo.subject, `%${demo.subject}%`, demo.subject, `%${demo.subject}%`, demo.subject]
            );

            let candidateSme: any = null;
            for (const sme of candidateSmes) {
              if (sme.id === demo.smeId) continue; // Try finding alternative or check current SME availability

              // Check if SME is on leave on this date
              const smeOnLeave = await db.get(
                `SELECT id FROM faculty_leave_requests WHERE mentor_id = ? AND start_date <= ? AND end_date >= ? AND status = 'approved'`,
                [sme.id, demo.dateStr, demo.dateStr]
              );
              if (smeOnLeave) continue;

              // Check if SME has another demo session at dateStr and timeSlot
              const smeDemoClash = await db.get(
                `SELECT id FROM demo_sessions WHERE smeId = ? AND dateStr = ? AND timeSlot = ? AND status IN ('scheduled', 'confirmed')`,
                [sme.id, demo.dateStr, demo.timeSlot]
              );
              if (smeDemoClash) continue;

              candidateSme = sme;
              break;
            }

            if (candidateSme) {
              // Create a pending reallocation request for the candidate Head/Domain SME
              const reqId = "dsr_" + Date.now() + "_" + Math.random().toString(36).substring(2, 9);
              await db.run(
                `INSERT INTO demo_swap_requests (
                  id, sessionId, mentorId, mentorName, smeId, smeName, dateStr, timeSlot, subject, stream, reason, remarks, swapType,
                  proposedMentorId, proposedMentorName, proposedSmeId, proposedSmeName, proposedDateStr, proposedTimeSlot, status, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'reallocation', ?, ?, ?, ?, ?, ?, 'pending', ?)`,
                [
                  reqId, demo.id, demo.mentorId, demo.mentorName, demo.smeId, demo.smeName, demo.dateStr, demo.timeSlot, demo.subject, demo.stream,
                  leaveReason, "Auto-generated reallocation request sent to Head/Eligible SME due to approved mentor leave",
                  demo.mentorId, demo.mentorName, candidateSme.id, candidateSme.name, demo.dateStr, demo.timeSlot,
                  new Date().toISOString()
                ]
              );

              // Update session to reallocation_required (does not lock as confirmed until SME accepts!)
              await db.run(
                `UPDATE demo_sessions SET status = 'reallocation_required', comments = ? WHERE id = ?`,
                [leaveReason, demo.id]
              );

              // Audit log for Demo Allocator real-time progress update
              const auditId = "audit_" + Date.now() + "_" + Math.random().toString(36).substring(2, 9);
              await db.run(
                `INSERT INTO audit_logs (id, type, description, actorName, actorRole, timestamp)
                 VALUES (?, 'demo_reallocation_initiated', ?, ?, 'Campus Manager', ?)`,
                [
                  auditId,
                  `CAM approved leave for Mentor ${reqRecord.mentorName}. Demo session for ${demo.subject} on ${demo.dateStr} (${demo.timeSlot}) flagged as Reallocation Required. Reallocation proposal sent to ${candidateSme.name}.`,
                  approvedBy || "Campus Manager",
                  new Date().toISOString()
                ]
              );
            } else {
              // No free SME or slot available; mark demo as not_conducted with clear reason
              await db.run(
                `UPDATE demo_sessions SET status = 'not_conducted', comments = ? WHERE id = ?`,
                [`No available SME or free slot found during approved mentor leave (${reqRecord.start_date} to ${reqRecord.end_date})`, demo.id]
              );

              const auditId = "audit_" + Date.now() + "_" + Math.random().toString(36).substring(2, 9);
              await db.run(
                `INSERT INTO audit_logs (id, type, description, actorName, actorRole, timestamp)
                 VALUES (?, 'demo_reallocation_failed', ?, ?, 'Campus Manager', ?)`,
                [
                  auditId,
                  `CAM approved leave for Mentor ${reqRecord.mentorName}. No free SME available for ${demo.subject} on ${demo.dateStr} (${demo.timeSlot}). Demo marked as Not Conducted.`,
                  approvedBy || "Campus Manager",
                  new Date().toISOString()
                ]
              );
            }
          }
        }

        // Automatic identification of affected regular teaching classes for this mentor
        const mentorSlots = await db.all("SELECT * FROM slots WHERE mentorId = ?", [reqRecord.mentor_id]);
        let curSlotCheck = new Date(startDate);
        while (curSlotCheck <= endDate) {
          const dStr = curSlotCheck.toISOString().split("T")[0];
          const dName = curSlotCheck.toLocaleDateString("en-US", { weekday: "long" });
          const daySlots = mentorSlots.filter((s: any) => s.day.toLowerCase() === dName.toLowerCase());
          for (const s of daySlots) {
            const existingHandover = await db.get(
              "SELECT id, coverStaffId FROM approved_handovers WHERE slotId = ? AND dateStr = ?",
              [s.id, dStr]
            );
            affectedClasses.push({
              slotId: s.id,
              course: s.course,
              classGroup: s.classGroup,
              day: s.day,
              time: s.time,
              dateStr: dStr,
              isHandedOver: !!existingHandover,
              coverStaffId: existingHandover?.coverStaffId || null
            });
          }
          curSlotCheck.setDate(curSlotCheck.getDate() + 1);
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
        message: `Faculty leave request ${newStatus} successfully and notification email sent.`,
        affectedClasses
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
    let camUser = null;
    try {
      camUser = await db.get(
        `SELECT email, name FROM campus_managers WHERE college_id = ? LIMIT 1`,
        [effectiveCollegeId]
      );
    } catch (_) {
      try {
        camUser = await db.get(
          `SELECT email, name FROM cams WHERE college_id = ? LIMIT 1`,
          [effectiveCollegeId]
        );
      } catch (_) {}
    }

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
