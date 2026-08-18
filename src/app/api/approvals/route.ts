// Pin to Mumbai (bom1) — co-located with Turso DB (aws-ap-south-1)
export const preferredRegion = "bom1";
export const maxDuration = 60;

import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { sendMail, renderEmailShell } from "@/lib/mail";

export async function GET(request: Request) {
  try {
    const db = await getDb();
    const { searchParams } = new URL(request.url);
    const role = searchParams.get("role");
    const userId = searchParams.get("userId");
    const collegeId = searchParams.get("collegeId");
    const moduleType = searchParams.get("moduleType");
    const status = searchParams.get("status");

    let query = "SELECT * FROM approvals WHERE 1=1";
    const params: any[] = [];

    if (moduleType) {
      query += " AND module_type = ?";
      params.push(moduleType);
    }

    if (status) {
      query += " AND current_status = ?";
      params.push(status);
    }

    if (collegeId) {
      query += " AND (college_id = ? OR college_id IS NULL OR college_id = '')";
      params.push(collegeId);
    }

    if (role === "student" && userId) {
      query += " AND requester_id = ?";
      params.push(userId);
    } else if (role === "mentor" && userId) {
      query += " AND (requester_id = ? OR approver_id = ?)";
      params.push(userId, userId);
    }

    query += " ORDER BY created_at DESC";

    const approvals = await db.all(query, params);
    return NextResponse.json({ success: true, approvals });
  } catch (error: any) {
    console.error("GET /api/approvals error:", error);
    return NextResponse.json({ success: false, message: error.message || "Failed to fetch approvals" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const db = await getDb();
    const body = await request.json();
    const {
      module_type,
      request_id,
      requester_id,
      requester_name,
      college_id,
      remarks = ""
    } = body;

    if (!module_type || !request_id || !requester_id || !requester_name) {
      return NextResponse.json(
        { success: false, message: "Missing required fields (module_type, request_id, requester_id, requester_name)" },
        { status: 400 }
      );
    }

    const id = `appr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();

    await db.run(
      `INSERT INTO approvals (
        id, module_type, request_id, requester_id, requester_name,
        current_status, remarks, college_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, module_type, request_id, requester_id, requester_name, "pending", remarks, college_id || "", now, now]
    );

    // Audit Log Entry
    await db.run(
      `INSERT INTO audit_logs (id, timestamp, action, user_name, details) VALUES (?, ?, ?, ?, ?)`,
      [
        `audit_${Date.now()}`,
        now,
        `Approval Requested: ${module_type}`,
        requester_name,
        `Created pending approval for request ${request_id}`
      ]
    );

    const createdRecord = await db.get("SELECT * FROM approvals WHERE id = ?", [id]);
    return NextResponse.json({ success: true, approval: createdRecord });
  } catch (error: any) {
    console.error("POST /api/approvals error:", error);
    return NextResponse.json({ success: false, message: error.message || "Failed to create approval" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const db = await getDb();
    const body = await request.json();
    const {
      approval_id,
      status,
      approver_id,
      approver_name,
      rejection_reason = "",
      remarks = ""
    } = body;

    if (!approval_id || !status || !approver_id || !approver_name) {
      return NextResponse.json(
        { success: false, message: "Missing required fields (approval_id, status, approver_id, approver_name)" },
        { status: 400 }
      );
    }

    // MANDATORY REJECTION REMARKS RULE
    if (status === "rejected" && !rejection_reason.trim() && !remarks.trim()) {
      return NextResponse.json(
        { success: false, message: "Remarks/rejection reason is mandatory when rejecting a request." },
        { status: 400 }
      );
    }

    const approval = await db.get("SELECT * FROM approvals WHERE id = ?", [approval_id]);
    if (!approval) {
      return NextResponse.json({ success: false, message: "Approval entry not found" }, { status: 404 });
    }

    const now = new Date().toISOString();
    const reasonText = rejection_reason || remarks;

    await db.run(
      `UPDATE approvals SET
        current_status = ?,
        approver_id = ?,
        approver_name = ?,
        remarks = ?,
        rejection_reason = ?,
        approved_at = ?,
        updated_at = ?
      WHERE id = ?`,
      [status, approver_id, approver_name, remarks, reasonText, status === "approved" ? now : null, now, approval_id]
    );

    // Module Side Effects Trigger
    const { module_type, request_id } = approval;

    if (module_type === "student_leave") {
      await db.run(
        "UPDATE leave_requests SET status = ?, approvedBy = ? WHERE id = ?",
        [status, approver_name, request_id]
      );

      const leaveReq = await db.get("SELECT * FROM leave_requests WHERE id = ?", [request_id]);
      if (leaveReq && status === "approved") {
        const student = await db.get("SELECT * FROM students WHERE id = ?", [leaveReq.studentId]);
        if (student) {
          const dayName = new Date(leaveReq.dateStr).toLocaleDateString("en-US", { weekday: "long" });
          const matchingSlots = await db.all(
            "SELECT id FROM slots WHERE classGroup = ? AND day = ?",
            [student.classGroup, dayName]
          );

          for (const s of matchingSlots) {
            const attId = `att_${s.id}_${leaveReq.studentId}_${leaveReq.dateStr}`;
            await db.run(
              `INSERT INTO student_attendance (id, studentId, slotId, dateStr, status, markedBy, timestamp)
               VALUES (?, ?, ?, ?, ?, ?, ?)
               ON CONFLICT(studentId, slotId, dateStr) DO UPDATE SET status = 'present', markedBy = 'CAM Approval'`,
              [attId, leaveReq.studentId, s.id, leaveReq.dateStr, "present", `CAM Approval (${approver_name})`, now]
            );
          }

          if (student.email) {
            await sendMail({
              to: student.email,
              subject: `[Leave Approved] Your ${leaveReq.type?.toUpperCase()} request for ${leaveReq.dateStr} has been APPROVED`,
              htmlBody: renderEmailShell({
                title: "Leave Request Approved",
                badgeText: "Approved",
                badgeColor: "emerald",
                description: `Dear ${student.name}, your ${leaveReq.type?.toUpperCase()} request for <strong>${leaveReq.dateStr}</strong> has been approved. Attendance has been excused as Present.`,
                details: [
                  { label: "Date", value: leaveReq.dateStr, highlight: true },
                  { label: "Approved By", value: approver_name },
                  { label: "Status", value: "Approved & Excused" }
                ],
                ctaText: "Open Student Dashboard →"
              })
            }).catch(console.warn);
          }
        }
      }
    } else if (module_type === "faculty_leave") {
      await db.run(
        "UPDATE faculty_leave_requests SET status = ?, updated_at = ? WHERE id = ?",
        [status === "approved" ? "Approved" : "Rejected", now, request_id]
      );
    } else if (module_type === "interview") {
      await db.run(
        "UPDATE student_interviews SET status = ?, updated_at = ? WHERE id = ?",
        [status === "approved" ? "completed" : "rejected", now, request_id]
      );
    }

    // In-app notification creation
    const notifId = `notif_${Date.now()}`;
    await db.run(
      `INSERT INTO notifications (id, user_id, title, message, type, link, is_read, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 0, ?)`,
      [
        notifId,
        approval.requester_id,
        `Request ${status.toUpperCase()}: ${module_type.replace("_", " ").toUpperCase()}`,
        `Your request has been ${status} by ${approver_name}. ${reasonText ? `Remarks: ${reasonText}` : ""}`,
        status === "approved" ? "result" : "alert",
        `#`,
        now
      ]
    ).catch(console.warn);

    // Audit Log Entry
    await db.run(
      `INSERT INTO audit_logs (id, timestamp, action, user_name, details) VALUES (?, ?, ?, ?, ?)`,
      [
        `audit_${Date.now()}`,
        now,
        `Approval Resolved: ${status.toUpperCase()}`,
        approver_name,
        `Resolved request ${request_id} for ${approval.requester_name}. Remarks: ${reasonText}`
      ]
    );

    const updatedApproval = await db.get("SELECT * FROM approvals WHERE id = ?", [approval_id]);
    return NextResponse.json({
      success: true,
      message: `Request successfully ${status}. Notification and side-effects executed.`,
      approval: updatedApproval
    });
  } catch (error: any) {
    console.error("PUT /api/approvals error:", error);
    return NextResponse.json({ success: false, message: error.message || "Failed to update approval" }, { status: 500 });
  }
}
