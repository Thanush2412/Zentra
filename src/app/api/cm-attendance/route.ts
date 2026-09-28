// Pin to Mumbai (bom1) — co-located with Turso DB (aws-ap-south-1)
export const preferredRegion = "bom1";
export const maxDuration = 60;
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { ensureMigration } from "@/lib/migrations";

export async function GET(request: Request) {
  try {
    await ensureMigration("cm_attendance_and_leave_tables");
    const db = await getDb();
    const { searchParams } = new URL(request.url);

    const camId = searchParams.get("camId");
    const collegeId = searchParams.get("collegeId");
    const kamId = searchParams.get("kamId");
    const dateStr = searchParams.get("dateStr") || new Date().toISOString().split("T")[0];
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    // 1. Fetch attendance history for a single Campus Manager
    if (camId) {
      const records = await db.all(
        `SELECT ca.*, cm.name as cam_name, cm.email as cam_email, c.name as college_name
         FROM cm_attendance ca
         JOIN campus_managers cm ON ca.cam_id = cm.id
         LEFT JOIN colleges c ON ca.college_id = c.id
         WHERE ca.cam_id = ?
         ORDER BY ca.date_str DESC LIMIT 100`,
        [camId]
      );
      return NextResponse.json({ success: true, records, dateStr });
    }

    // 2. Fetch attendance roster for a KAM or specific college
    let cmQuery = `
      SELECT cm.id, cm.name, cm.email, cm.college_id, cm.kam_id, c.name as college_name
      FROM campus_managers cm
      LEFT JOIN colleges c ON cm.college_id = c.id
      WHERE 1=1
    `;
    const cmParams: any[] = [];

    if (kamId) {
      cmQuery += ` AND (cm.kam_id = ? OR c.kam_id = ?)`;
      cmParams.push(kamId, kamId);
    }
    if (collegeId && collegeId !== "all") {
      cmQuery += ` AND cm.college_id = ?`;
      cmParams.push(collegeId);
    }

    cmQuery += ` ORDER BY cm.name ASC`;
    const cmList = await db.all(cmQuery, cmParams);

    // Fetch attendance for the roster
    if (startDate && endDate) {
      const records = await db.all(
        `SELECT ca.*, cm.name as cam_name, cm.email as cam_email, c.name as college_name
         FROM cm_attendance ca
         JOIN campus_managers cm ON ca.cam_id = cm.id
         LEFT JOIN colleges c ON ca.college_id = c.id
         WHERE ca.date_str >= ? AND ca.date_str <= ?
         ORDER BY ca.date_str DESC`,
        [startDate, endDate]
      );
      return NextResponse.json({ success: true, records, cms: cmList });
    }

    // Fetch attendance for specific single date (defaults to today)
    const attRecords = await db.all(
      `SELECT * FROM cm_attendance WHERE date_str = ?`,
      [dateStr]
    );
    const attMap = new Map<string, any>();
    attRecords.forEach((r: any) => attMap.set(r.cam_id, r));

    const roster = cmList.map((cm: any) => {
      const att = attMap.get(cm.id);
      return {
        camId: cm.id,
        name: cm.name,
        email: cm.email,
        collegeId: cm.college_id,
        collegeName: cm.college_name || "Assigned Campus",
        kamId: cm.kam_id,
        dateStr,
        status: att?.status || "Not Punched",
        punchInTime: att?.punch_in_time || null,
        punchOutTime: att?.punch_out_time || null,
        reason: att?.reason || null,
        approvedBy: att?.approved_by || null,
        approvalStatus: att?.approval_status || "pending",
        approvalNotes: att?.approval_notes || null,
        attendanceId: att?.id || null
      };
    });

    return NextResponse.json({ success: true, roster, dateStr });
  } catch (error: any) {
    console.error("API GET /api/cm-attendance error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await ensureMigration("cm_attendance_and_leave_tables");
    const db = await getDb();
    const body = await request.json();

    const {
      camId,
      collegeId,
      dateStr = new Date().toISOString().split("T")[0],
      status = "Present",
      punchInTime,
      punchOutTime,
      reason
    } = body;

    if (!camId) {
      return NextResponse.json({ success: false, message: "Missing required field: camId" }, { status: 400 });
    }

    // Resolve college ID if not provided
    let effectiveCollegeId = collegeId;
    if (!effectiveCollegeId) {
      const cm = await db.get("SELECT college_id FROM campus_managers WHERE id = ?", [camId]);
      effectiveCollegeId = cm?.college_id || "general";
    }

    const recId = `cm_att_${camId}_${dateStr}`;
    const nowTime = new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
    const finalPunchIn = punchInTime || nowTime;

    const isPg = (db as any).isPostgres;
    const nowTimestamp = new Date().toISOString();

    if (isPg) {
      await db.run(
        `INSERT INTO cm_attendance (id, cam_id, college_id, date_str, status, punch_in_time, punch_out_time, reason, approval_status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', NOW(), NOW())
         ON CONFLICT (cam_id, date_str) DO UPDATE SET
           status = EXCLUDED.status,
           punch_in_time = COALESCE(EXCLUDED.punch_in_time, cm_attendance.punch_in_time),
           punch_out_time = COALESCE(EXCLUDED.punch_out_time, cm_attendance.punch_out_time),
           reason = COALESCE(EXCLUDED.reason, cm_attendance.reason),
           updated_at = NOW()`,
        [recId, camId, effectiveCollegeId, dateStr, status, finalPunchIn, punchOutTime || null, reason || null]
      );
    } else {
      await db.run(
        `INSERT INTO cm_attendance (id, cam_id, college_id, date_str, status, punch_in_time, punch_out_time, reason, approval_status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)
         ON CONFLICT (cam_id, date_str) DO UPDATE SET
           status = excluded.status,
           punch_in_time = COALESCE(excluded.punch_in_time, cm_attendance.punch_in_time),
           punch_out_time = COALESCE(excluded.punch_out_time, cm_attendance.punch_out_time),
           reason = COALESCE(excluded.reason, cm_attendance.reason),
           updated_at = ?`,
        [recId, camId, effectiveCollegeId, dateStr, status, finalPunchIn, punchOutTime || null, reason || null, nowTimestamp, nowTimestamp, nowTimestamp]
      );
    }

    return NextResponse.json({
      success: true,
      message: `Campus Manager attendance marked as ${status} successfully.`,
      record: {
        id: recId,
        camId,
        collegeId: effectiveCollegeId,
        dateStr,
        status,
        punchInTime: finalPunchIn,
        punchOutTime: punchOutTime || null,
        reason: reason || null,
        approvalStatus: "pending"
      }
    });
  } catch (error: any) {
    console.error("API POST /api/cm-attendance error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    await ensureMigration("cm_attendance_and_leave_tables");
    const db = await getDb();
    const body = await request.json();

    const {
      id,
      camId,
      dateStr,
      status,
      approvalStatus = "approved",
      approvedBy = "KAM Administrator",
      approvalNotes
    } = body;

    const isPg = (db as any).isPostgres;
    const nowTimestamp = new Date().toISOString();

    if (id) {
      if (isPg) {
        await db.run(
          `UPDATE cm_attendance
           SET approval_status = ?, approved_by = ?, approval_notes = ?, status = COALESCE(?, status), updated_at = NOW()
           WHERE id = ?`,
          [approvalStatus, approvedBy, approvalNotes || null, status || null, id]
        );
      } else {
        await db.run(
          `UPDATE cm_attendance
           SET approval_status = ?, approved_by = ?, approval_notes = ?, status = COALESCE(?, status), updated_at = ?
           WHERE id = ?`,
          [approvalStatus, approvedBy, approvalNotes || null, status || null, nowTimestamp, id]
        );
      }
    } else if (camId && dateStr) {
      if (isPg) {
        await db.run(
          `UPDATE cm_attendance
           SET approval_status = ?, approved_by = ?, approval_notes = ?, status = COALESCE(?, status), updated_at = NOW()
           WHERE cam_id = ? AND date_str = ?`,
          [approvalStatus, approvedBy, approvalNotes || null, status || null, camId, dateStr]
        );
      } else {
        await db.run(
          `UPDATE cm_attendance
           SET approval_status = ?, approved_by = ?, approval_notes = ?, status = COALESCE(?, status), updated_at = ?
           WHERE cam_id = ? AND date_str = ?`,
          [approvalStatus, approvedBy, approvalNotes || null, status || null, nowTimestamp, camId, dateStr]
        );
      }
    } else {
      return NextResponse.json({ success: false, message: "Missing identifier (id or camId + dateStr)" }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: `Campus Manager attendance ${approvalStatus} successfully.`
    });
  } catch (error: any) {
    console.error("API PATCH /api/cm-attendance error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
