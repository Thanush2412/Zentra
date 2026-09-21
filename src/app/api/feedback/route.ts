// Pin to Mumbai (bom1) — co-located with Turso DB (aws-ap-south-1)
export const preferredRegion = "bom1";
export const maxDuration = 60;

import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getSessionFromRequest, normalizeRole, apiAuthErrorResponse } from "@/lib/api-auth";
import { ensureMigration } from "@/lib/migrations";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const filterUserId = searchParams.get("userId");

    const session = getSessionFromRequest(request);
    if (!filterUserId && session && !["admin", "kam", "superadmin"].includes(normalizeRole(session.role))) {
      return NextResponse.json({ success: false, message: "Forbidden: admin or kam role required" }, { status: 403 });
    }

    await ensureMigration("feedback_reports_table");
    const db = await getDb();

    let reports: any[] = [];
    if (filterUserId) {
      reports = await db.all(
        "SELECT * FROM feedback_reports WHERE user_id = ? OR LOWER(TRIM(user_id)) = LOWER(TRIM(?)) ORDER BY created_at DESC LIMIT 100",
        [filterUserId, filterUserId]
      ).catch(() => []);
    } else {
      reports = await db.all("SELECT * FROM feedback_reports ORDER BY created_at DESC LIMIT 300").catch(() => []);
    }

    // Enrich reports with full user and college details from students, mentors, and colleges
    const colleges: any[] = await db.all("SELECT id, name FROM colleges").catch(() => []);
    const collegeMap = new Map(colleges.map((c: any) => [c.id, c.name]));

    const enriched = await Promise.all(
      reports.map(async (r: any) => {
        let name = (r.user_name || "").trim();
        let collegeName = (r.college_name || "").trim();
        let department = (r.department || "").trim();
        let registerNumber = (r.register_number || "").trim();
        let contactInfo = (r.contact_info || "").trim();
        const role = (r.user_role || "").toLowerCase().trim();
        const userKey = (r.user_id || "").trim();

        if (userKey) {
          // 1. Check in students table (by email, id, or case-insensitive email)
          if (!name || !collegeName || !registerNumber) {
            let student = await db.get(
              `SELECT name, register_number, roll_number, college_id, department, classGroup, phone, email 
               FROM students 
               WHERE LOWER(TRIM(email)) = LOWER(TRIM(?)) OR id = ? OR LOWER(TRIM(id)) = LOWER(TRIM(?)) LIMIT 1`,
              [userKey, userKey, userKey]
            ).catch(() => null);

            // Also check users table reference_id if not found directly
            if (!student) {
              const u = await db.get(
                `SELECT reference_id, role FROM users WHERE LOWER(TRIM(email)) = LOWER(TRIM(?)) OR id = ? LIMIT 1`,
                [userKey, userKey]
              ).catch(() => null);
              if (u?.reference_id) {
                student = await db.get(
                  `SELECT name, register_number, roll_number, college_id, department, classGroup, phone, email 
                   FROM students WHERE id = ? LIMIT 1`,
                  [u.reference_id]
                ).catch(() => null);
              }
            }

            if (student) {
              name = name || student.name || "";
              department = department || student.department || student.classGroup || "";
              registerNumber = registerNumber || student.register_number || student.roll_number || "";
              contactInfo = contactInfo || student.phone || "";
              if (student.college_id && (!collegeName || collegeName === "—")) {
                collegeName = collegeMap.get(student.college_id) || student.college_id;
              }
            }
          }

          // 2. Check in mentors table
          if (!name || !collegeName) {
            let mentor = await db.get(
              `SELECT name, college_id, department, phone, email, employee_id 
               FROM mentors 
               WHERE LOWER(TRIM(email)) = LOWER(TRIM(?)) OR id = ? OR LOWER(TRIM(id)) = LOWER(TRIM(?)) LIMIT 1`,
              [userKey, userKey, userKey]
            ).catch(() => null);

            if (!mentor) {
              const u = await db.get(
                `SELECT reference_id, role FROM users WHERE LOWER(TRIM(email)) = LOWER(TRIM(?)) OR id = ? LIMIT 1`,
                [userKey, userKey]
              ).catch(() => null);
              if (u?.reference_id) {
                mentor = await db.get(
                  `SELECT name, college_id, department, phone, email, employee_id 
                   FROM mentors WHERE id = ? LIMIT 1`,
                  [u.reference_id]
                ).catch(() => null);
              }
            }

            if (mentor) {
              name = name || mentor.name || "";
              department = department || mentor.department || "";
              registerNumber = registerNumber || mentor.employee_id || "";
              contactInfo = contactInfo || mentor.phone || "";
              if (mentor.college_id && (!collegeName || collegeName === "—")) {
                collegeName = collegeMap.get(mentor.college_id) || mentor.college_id;
              }
            }
          }

          // 3. Check in campus_managers table
          if (!name || !collegeName) {
            const cam = await db.get(
              `SELECT name, college_id, phone, email FROM campus_managers 
               WHERE LOWER(TRIM(email)) = LOWER(TRIM(?)) OR id = ? LIMIT 1`,
              [userKey, userKey]
            ).catch(() => null);
            if (cam) {
              name = name || cam.name || "";
              contactInfo = contactInfo || cam.phone || "";
              if (cam.college_id && (!collegeName || collegeName === "—")) {
                collegeName = collegeMap.get(cam.college_id) || cam.college_id;
              }
            }
          }

          // 4. Human-formatted name from email if still not resolved
          if (!name && userKey.includes("@")) {
            const clean = userKey.split("@")[0].replace(/[._0-9-]/g, " ").trim();
            if (clean) {
              name = clean.split(/\s+/).map((w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");
            }
          }
        }

        return {
          ...r,
          user_name: name || r.user_id || "User",
          college_name: collegeName || (r.college_id ? (collegeMap.get(r.college_id) || r.college_id) : ""),
          department: department || "",
          register_number: registerNumber || "",
          contact_info: contactInfo || ""
        };
      })
    );

    return NextResponse.json({ success: true, reports: enriched });
  } catch (error: any) {
    const authRes = apiAuthErrorResponse(error);
    if (authRes) return authRes;
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = getSessionFromRequest(request);
    await ensureMigration("feedback_reports_table");
    const db = await getDb();
    const body = await request.json();
    const {
      userId,
      userName,
      userRole,
      collegeId,
      collegeName,
      department,
      registerNumber,
      contactInfo,
      type,
      title,
      description
    } = body;

    if (!type || !title || !description) {
      return NextResponse.json({ success: false, message: "Type, title, and description are required." }, { status: 400 });
    }

    const reportId = "fb_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7);
    const nowStr = new Date().toISOString();

    await db.run(
      `INSERT INTO feedback_reports (
        id, user_id, user_name, user_role, college_id, college_name,
        department, register_number, contact_info, type, title, description, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
      [
        reportId,
        userId || session?.userId || "anonymous",
        userName || "",
        userRole || session?.role || "user",
        collegeId || "",
        collegeName || "",
        department || "",
        registerNumber || "",
        contactInfo || "",
        type,
        title,
        description,
        nowStr
      ]
    );

    return NextResponse.json({ success: true, message: "Feedback submitted successfully!", reportId });
  } catch (error: any) {
    const authRes = apiAuthErrorResponse(error);
    if (authRes) return authRes;
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const session = getSessionFromRequest(request);
    if (session && !["admin", "kam", "superadmin"].includes(normalizeRole(session.role))) {
      return NextResponse.json({ success: false, message: "Forbidden: admin or kam role required" }, { status: 403 });
    }
    await ensureMigration("feedback_reports_table");
    const db = await getDb();
    const body = await request.json();
    const { id, status, adminNotes, resolvedBy } = body;

    if (!id || !status) {
      return NextResponse.json({ success: false, message: "Report id and status required" }, { status: 400 });
    }

    const existing: any = await db.get("SELECT * FROM feedback_reports WHERE id = ?", [id]).catch(() => null);
    if (!existing) {
      return NextResponse.json({ success: false, message: "Feedback report not found" }, { status: 404 });
    }

    const nowStr = new Date().toISOString();
    await db.run(
      `UPDATE feedback_reports SET
        status = ?,
        admin_notes = COALESCE(?, admin_notes),
        resolved_by = COALESCE(?, resolved_by),
        resolved_at = CASE WHEN ? IN ('resolved', 'closed') THEN ? ELSE resolved_at END
       WHERE id = ?`,
      [status, adminNotes || null, resolvedBy || null, status, nowStr, id]
    );

    // Notify the user who raised the issue
    if (existing.user_id && (status === "resolved" || status === "closed")) {
      const notifId = "notif_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6);
      const notifTitle = status === "resolved" ? "Issue / Feedback Resolved" : "Feedback Report Closed";
      const notifMsg = adminNotes
        ? `Your report "${existing.title}" was marked ${status} by ${resolvedBy || "Admin"}: "${adminNotes}"`
        : `Your report "${existing.title}" was marked ${status} by ${resolvedBy || "Admin"}.`;

      await db.run(
        `INSERT INTO notifications (id, user_id, title, message, type, is_read, created_at)
         VALUES (?, ?, ?, ?, 'info', 0, ?)`,
        [notifId, existing.user_id, notifTitle, notifMsg, nowStr]
      ).catch(() => {});
    }

    return NextResponse.json({ success: true, message: "Feedback status updated successfully" });
  } catch (error: any) {
    const authRes = apiAuthErrorResponse(error);
    if (authRes) return authRes;
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
