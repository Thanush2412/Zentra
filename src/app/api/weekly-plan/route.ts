// Pin to Mumbai (bom1) — co-located with Turso/Postgres DB
export const preferredRegion = "bom1";
export const maxDuration = 60;

import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

async function ensureTable(db: any) {
  try {
    await db.exec(`
      CREATE TABLE IF NOT EXISTS mentor_weekly_plans (
        id VARCHAR(255) PRIMARY KEY,
        college_id VARCHAR(255) NOT NULL,
        mentor_id VARCHAR(255) NOT NULL,
        mentor_name VARCHAR(255),
        department VARCHAR(255),
        subject VARCHAR(255) NOT NULL,
        class_group VARCHAR(255) NOT NULL,
        week_number INTEGER NOT NULL,
        unit VARCHAR(255),
        topics_planned TEXT,
        session_plan TEXT,
        learning_objectives TEXT,
        teaching_mode VARCHAR(50) DEFAULT 'Offline',
        material_url TEXT,
        status VARCHAR(50) DEFAULT 'Submitted',
        cam_feedback TEXT,
        verified_by VARCHAR(255),
        verified_at VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
  } catch (e) {
    console.warn("Table ensure warning:", e);
  }
}

export async function GET(request: Request) {
  try {
    const db = await getDb();
    await ensureTable(db);
    const { searchParams } = new URL(request.url);

    const collegeId = searchParams.get("collegeId");
    const mentorId = searchParams.get("mentorId");
    const weekNumber = searchParams.get("weekNumber");
    const classGroup = searchParams.get("classGroup");
    const subject = searchParams.get("subject");

    let query = "SELECT * FROM mentor_weekly_plans WHERE 1=1";
    const params: any[] = [];

    if (collegeId && collegeId !== "all") {
      query += " AND college_id = ?";
      params.push(collegeId);
    }
    if (mentorId && mentorId !== "all") {
      query += " AND mentor_id = ?";
      params.push(mentorId);
    }
    if (weekNumber && weekNumber !== "all") {
      query += " AND week_number = ?";
      params.push(parseInt(weekNumber, 10));
    }
    if (classGroup && classGroup !== "all") {
      query += " AND LOWER(TRIM(class_group)) = LOWER(TRIM(?))";
      params.push(classGroup);
    }
    if (subject && subject !== "all") {
      query += " AND LOWER(TRIM(subject)) = LOWER(TRIM(?))";
      params.push(subject);
    }

    query += " ORDER BY week_number ASC, updated_at DESC";

    const rows = await db.all(query, ...params).catch(() => []);

    return NextResponse.json({
      success: true,
      plans: rows || []
    });
  } catch (err: any) {
    console.error("GET /api/weekly-plan error:", err);
    return NextResponse.json(
      { success: false, message: err?.message || "Failed to fetch weekly plans" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const db = await getDb();
    await ensureTable(db);
    const body = await request.json();

    const {
      id,
      collegeId,
      mentorId,
      mentorName,
      department,
      subject,
      classGroup,
      weekNumber,
      unit,
      topicsPlanned,
      sessionPlan,
      learningObjectives,
      teachingMode = "Offline",
      materialUrl = "",
      status = "Submitted"
    } = body;

    if (!collegeId || !mentorId || !subject || !classGroup || !weekNumber) {
      return NextResponse.json(
        { success: false, message: "Missing required weekly plan fields." },
        { status: 400 }
      );
    }

    const planId = id || `WP_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const nowStr = new Date().toISOString();

    // Check if plan exists
    const existing = await db.get("SELECT id FROM mentor_weekly_plans WHERE id = ?", planId).catch(() => null);

    if (existing) {
      await db.run(
        `UPDATE mentor_weekly_plans SET
          college_id = ?, mentor_id = ?, mentor_name = ?, department = ?,
          subject = ?, class_group = ?, week_number = ?, unit = ?,
          topics_planned = ?, session_plan = ?, learning_objectives = ?,
          teaching_mode = ?, material_url = ?, status = ?, updated_at = ?
         WHERE id = ?`,
        collegeId, mentorId, mentorName || "", department || "",
        subject, classGroup, parseInt(String(weekNumber), 10), unit || "",
        topicsPlanned || "", typeof sessionPlan === "string" ? sessionPlan : JSON.stringify(sessionPlan || {}),
        learningObjectives || "", teachingMode, materialUrl, status, nowStr, planId
      );
    } else {
      await db.run(
        `INSERT INTO mentor_weekly_plans (
          id, college_id, mentor_id, mentor_name, department,
          subject, class_group, week_number, unit,
          topics_planned, session_plan, learning_objectives,
          teaching_mode, material_url, status, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        planId, collegeId, mentorId, mentorName || "", department || "",
        subject, classGroup, parseInt(String(weekNumber), 10), unit || "",
        topicsPlanned || "", typeof sessionPlan === "string" ? sessionPlan : JSON.stringify(sessionPlan || {}),
        learningObjectives || "", teachingMode, materialUrl, status, nowStr
      );
    }

    const savedPlan = await db.get("SELECT * FROM mentor_weekly_plans WHERE id = ?", planId);

    return NextResponse.json({
      success: true,
      message: "Weekly plan saved successfully.",
      plan: savedPlan
    });
  } catch (err: any) {
    console.error("POST /api/weekly-plan error:", err);
    return NextResponse.json(
      { success: false, message: err?.message || "Failed to save weekly plan" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const db = await getDb();
    await ensureTable(db);
    const body = await request.json();

    const { id, status, camFeedback, verifiedBy } = body;

    if (!id || !status) {
      return NextResponse.json(
        { success: false, message: "Missing plan ID or status." },
        { status: 400 }
      );
    }

    const nowStr = new Date().toLocaleString();

    await db.run(
      `UPDATE mentor_weekly_plans SET
        status = ?, cam_feedback = ?, verified_by = ?, verified_at = ?, updated_at = ?
       WHERE id = ?`,
      status, camFeedback || "", verifiedBy || "Campus Manager", nowStr, new Date().toISOString(), id
    );

    const updated = await db.get("SELECT * FROM mentor_weekly_plans WHERE id = ?", id);

    return NextResponse.json({
      success: true,
      message: `Weekly plan marked as ${status}.`,
      plan: updated
    });
  } catch (err: any) {
    console.error("PATCH /api/weekly-plan error:", err);
    return NextResponse.json(
      { success: false, message: err?.message || "Failed to update weekly plan review status" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const db = await getDb();
    await ensureTable(db);
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { success: false, message: "Missing plan id" },
        { status: 400 }
      );
    }

    await db.run("DELETE FROM mentor_weekly_plans WHERE id = ?", id);

    return NextResponse.json({
      success: true,
      message: "Weekly plan deleted successfully."
    });
  } catch (err: any) {
    console.error("DELETE /api/weekly-plan error:", err);
    return NextResponse.json(
      { success: false, message: err?.message || "Failed to delete weekly plan" },
      { status: 500 }
    );
  }
}

