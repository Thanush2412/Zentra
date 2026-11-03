export const maxDuration = 60;
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";
import { getDb, chunkList } from "@/lib/db";
import { requireAuth } from "@/lib/authGuard";
import { ensureMigration } from "@/lib/migrations";
import { generateId } from "@/lib/id";
import { sendMailAsync } from "@/lib/mailAsync";
import { renderEmailShell, BRAND } from "@/lib/mail";

export async function GET(request: Request) {
  try {
    const { errorResponse } = await requireAuth(request);
    if (errorResponse) return errorResponse;
    await ensureMigration("cm_attendance_and_leave_tables");
    const db = await getDb();
    const { searchParams } = new URL(request.url);

    const camId = searchParams.get("camId");
    const kamId = searchParams.get("kamId");
    const collegeId = searchParams.get("collegeId");
    const status = searchParams.get("status");

    let query = `
      SELECT clr.*, cm.name as cam_name, cm.email as cam_email, c.name as college_name
      FROM cm_leave_requests clr
      JOIN campus_managers cm ON clr.cam_id = cm.id
      LEFT JOIN colleges c ON clr.college_id = c.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (camId) {
      query += ` AND clr.cam_id = ?`;
      params.push(camId);
    }
    if (kamId) {
      query += ` AND (clr.kam_id = ? OR c.kam_id = ?)`;
      params.push(kamId, kamId);
    }
    if (collegeId && collegeId !== "all") {
      query += ` AND clr.college_id = ?`;
      params.push(collegeId);
    }
    if (status && status !== "all") {
      query += ` AND clr.status = ?`;
      params.push(status);
    }

    query += ` ORDER BY clr.created_at DESC LIMIT 200`;

    const records = await db.all(query, params);
    return NextResponse.json({ success: true, records });
  } catch (error: any) {
    console.error("API GET /api/cm-leave error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { errorResponse } = await requireAuth(request, { allowedRoles: ["cm"] });
    if (errorResponse) return errorResponse;
    await ensureMigration("cm_attendance_and_leave_tables");
    const db = await getDb();
    const body = await request.json();

    const {
      camId,
      collegeId,
      kamId,
      requestType,
      startDate,
      endDate,
      startTime,
      endTime,
      reason
    } = body;

    const validTypes = ["Casual Leave", "Emergency", "On Duty", "Permission"];
    if (!camId || !requestType || !startDate || !reason || !reason.trim()) {
      return NextResponse.json(
        { success: false, message: "Missing required fields: Request Type, Start Date, and Reason are mandatory." },
        { status: 400 }
      );
    }

    if (!validTypes.includes(requestType)) {
      return NextResponse.json(
        { success: false, message: `Invalid leave category: ${requestType}. Must be Casual Leave, Emergency, On Duty, or Permission.` },
        { status: 400 }
      );
    }

    // Resolve CM details & assigned KAM
    const cm = await db.get(
      `SELECT cm.*, c.kam_id as college_kam_id FROM campus_managers cm LEFT JOIN colleges c ON cm.college_id = c.id WHERE cm.id = ?`,
      [camId]
    );

    const effectiveCollegeId = collegeId || cm?.college_id || "general";
    const effectiveKamId = kamId || cm?.kam_id || cm?.college_kam_id || "kam_1";
    const effectiveEndDate = endDate || startDate;
    const reqId = generateId("cm_leave");
    const nowTimestamp = new Date().toISOString();

    const isPg = (db as any).isPostgres;

    if (isPg) {
      await db.run(
        `INSERT INTO cm_leave_requests (id, cam_id, college_id, kam_id, request_type, start_date, end_date, start_time, end_time, reason, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', NOW(), NOW())`,
        [reqId, camId, effectiveCollegeId, effectiveKamId, requestType, startDate, effectiveEndDate, startTime || null, endTime || null, reason.trim()]
      );
    } else {
      await db.run(
        `INSERT INTO cm_leave_requests (id, cam_id, college_id, kam_id, request_type, start_date, end_date, start_time, end_time, reason, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
        [reqId, camId, effectiveCollegeId, effectiveKamId, requestType, startDate, effectiveEndDate, startTime || null, endTime || null, reason.trim(), nowTimestamp, nowTimestamp]
      );
    }

    // Dispatch in-app notification to KAM
    try {
      const notifId = generateId("notif");
      const cmName = cm?.name || "Campus Manager";
      await db.run(
        `INSERT INTO notifications (id, user_id, title, message, type, is_read, created_at)
         VALUES (?, ?, ?, ?, 'cm_leave', 0, ?)`,
        [
          notifId,
          effectiveKamId,
          `New CM Leave Request: ${cmName}`,
          `${cmName} applied for ${requestType} from ${startDate} to ${effectiveEndDate}. Reason: ${reason.trim().slice(0, 80)}`,
          nowTimestamp
        ]
      ).catch(() => {});
    } catch (_) {}

    // Email KAM so they're not relying solely on the in-app bell
    try {
      const kamUser = await db.get(
        `SELECT email, name FROM kam_users WHERE id = ? LIMIT 1`,
        [effectiveKamId]
      );
      if (kamUser?.email) {
        const cmName = cm?.name || "Campus Manager";
        const collegeName = cm?.college_name || effectiveCollegeId;
        sendMailAsync({
          to: kamUser.email,
          subject: `${BRAND.emailPrefix} [Action Required] CM Leave Request — ${cmName}`,
          htmlBody: renderEmailShell({
            title: "Campus Manager Leave Application",
            badgeText: requestType === "Emergency" ? "EMERGENCY — REVIEW NOW" : "ACTION REQUIRED",
            badgeColor: requestType === "Emergency" ? "rose" : "amber",
            description: `Campus Manager <strong>${cmName}</strong> has submitted a leave application and is awaiting your review.`,
            details: [
              { label: "CM Name",      value: cmName,                                                       highlight: true },
              { label: "College",      value: collegeName },
              { label: "Leave Type",   value: requestType,                                                  highlight: true },
              { label: "Date Range",   value: startDate === effectiveEndDate ? startDate : `${startDate} to ${effectiveEndDate}` },
              { label: "Reason",       value: reason.trim() },
            ],
            ctaText: "Review in KAM Dashboard →",
            ctaUrl: `${BRAND.portalUrl}/kam/faculty-governance`,
          }),
          context: "cm-leave-request",
        });
      }
    } catch (_) {}

    return NextResponse.json({
      success: true,
      message: `${requestType} application submitted successfully and forwarded to KAM for review.`,
      requestId: reqId
    });
  } catch (error: any) {
    console.error("API POST /api/cm-leave error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const { errorResponse } = await requireAuth(request, { allowedRoles: ["kam", "admin"] });
    if (errorResponse) return errorResponse;
    await ensureMigration("cm_attendance_and_leave_tables");
    const db = await getDb();
    const body = await request.json();

    const {
      requestId,
      status, // 'approved' | 'rejected'
      approvedBy = "KAM Administrator",
      rejectionReason
    } = body;

    if (!requestId || !status) {
      return NextResponse.json({ success: false, message: "Missing requestId or status" }, { status: 400 });
    }

    const leaveReq = await db.get("SELECT * FROM cm_leave_requests WHERE id = ?", [requestId]);
    if (!leaveReq) {
      return NextResponse.json({ success: false, message: "Leave request not found" }, { status: 404 });
    }

    const nowTimestamp = new Date().toISOString();

    // The decision and every attendance row it creates commit together. Previously
    // the approval was written first and a failed per-day sync was only logged, so
    // an approved leave could exist with no attendance rows for its dates.
    const targetStatus = leaveReq.request_type === "On Duty" ? "On Duty" : "Leave";
    const leaveDates: string[] = [];
    if (status === "approved" && leaveReq.start_date) {
      const [sY, sM, sD] = leaveReq.start_date.split("-").map(Number);
      const [eY, eM, eD] = (leaveReq.end_date || leaveReq.start_date).split("-").map(Number);
      const cur = new Date(sY, sM - 1, sD, 12, 0, 0);
      const end = new Date(eY, eM - 1, eD, 12, 0, 0);
      while (cur <= end) {
        const y = cur.getFullYear();
        const m = String(cur.getMonth() + 1).padStart(2, "0");
        const d = String(cur.getDate()).padStart(2, "0");
        leaveDates.push(`${y}-${m}-${d}`);
        cur.setDate(cur.getDate() + 1);
      }
    }

    await db.transaction(async (tx) => {
      await tx.run(
        `UPDATE cm_leave_requests
         SET status = ?, approved_by = ?, rejection_reason = ?, updated_at = ?
         WHERE id = ?`,
        [status, approvedBy, rejectionReason || null, nowTimestamp, requestId]
      );

      for (const chunk of chunkList(leaveDates, 100)) {
        const values = chunk.map(() => "(?, ?, ?, ?, ?, ?, ?, 'approved', ?, ?)").join(", ");
        const args = chunk.flatMap((dateStr) => [
          `cm_att_${leaveReq.cam_id}_${dateStr}`,
          leaveReq.cam_id,
          leaveReq.college_id,
          dateStr,
          targetStatus,
          `Approved Leave: ${leaveReq.reason}`,
          approvedBy,
          nowTimestamp,
          nowTimestamp
        ]);
        await tx.run(
          `INSERT INTO cm_attendance (id, cam_id, college_id, date_str, status, reason, approved_by, approval_status, created_at, updated_at)
           VALUES ${values}
           ON CONFLICT (cam_id, date_str) DO UPDATE SET
             status = excluded.status,
             reason = excluded.reason,
             approved_by = excluded.approved_by,
             approval_status = 'approved',
             updated_at = excluded.updated_at`,
          ...args
        );
      }
    });

    // Notify CM of the decision via in-app bell
    try {
      const notifId = generateId("notif");
      await db.run(
        `INSERT INTO notifications (id, user_id, title, message, type, is_read, created_at)
         VALUES (?, ?, ?, ?, 'cm_leave_decision', 0, ?)`,
        [
          notifId,
          leaveReq.cam_id,
          `Leave Request ${status === "approved" ? "Approved" : "Rejected"}`,
          `Your request for ${leaveReq.request_type} (${leaveReq.start_date}) has been ${status} by ${approvedBy}.${rejectionReason ? ` Remarks: ${rejectionReason}` : ""}`,
          nowTimestamp
        ]
      ).catch(() => {});
    } catch (_) {}

    // Email the CM directly — they shouldn't have to check the portal to find out
    try {
      const camRow = await db.get(
        `SELECT email, name FROM campus_managers WHERE id = ? LIMIT 1`,
        [leaveReq.cam_id]
      );
      if (camRow?.email) {
        const dateRange = leaveReq.end_date && leaveReq.end_date !== leaveReq.start_date
          ? `${leaveReq.start_date} to ${leaveReq.end_date}`
          : leaveReq.start_date;
        sendMailAsync({
          to: camRow.email,
          subject: `${BRAND.emailPrefix} Your ${leaveReq.request_type} Request Has Been ${status === "approved" ? "Approved" : "Rejected"}`,
          htmlBody: renderEmailShell({
            title: `Leave Request ${status === "approved" ? "Approved" : "Rejected"}`,
            badgeText: status === "approved" ? "APPROVED" : "REJECTED",
            badgeColor: status === "approved" ? "emerald" : "rose",
            description: `Dear <strong>${camRow.name || "Campus Manager"}</strong>, your leave application has been reviewed by your KAM.`,
            details: [
              { label: "Leave Type",  value: leaveReq.request_type, highlight: true },
              { label: "Date Range",  value: dateRange },
              { label: "Status",      value: status.toUpperCase(),  highlight: true },
              { label: "Reviewed By", value: approvedBy },
              ...(rejectionReason ? [{ label: "Remarks", value: rejectionReason }] : []),
            ],
            ctaText: "View Leave Status →",
            ctaUrl: `${BRAND.portalUrl}/cm/leaves`,
          }),
          context: "cm-leave-decision",
        });
      }
    } catch (_) {}

    return NextResponse.json({
      success: true,
      message: `CM leave request ${status} successfully.`
    });
  } catch (error: any) {
    console.error("API PATCH /api/cm-leave error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
