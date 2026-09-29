// Pin to Mumbai (bom1) — co-located with Turso/Postgres DB
export const preferredRegion = "bom1";
export const maxDuration = 60;
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { deriveSubjectType } from "@/lib/skillTracker";
import { requireAuth } from "@/lib/authGuard";

const noCacheHeaders = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
  "Pragma": "no-cache",
  "Expires": "0",
};

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
        start_date VARCHAR(50),
        end_date VARCHAR(50),
        unit VARCHAR(255),
        topics_planned TEXT,
        session_plan TEXT,
        learning_objectives TEXT,
        teaching_mode VARCHAR(50) DEFAULT 'Offline',
        material_url TEXT,
        status VARCHAR(50) DEFAULT 'Submitted',
        cam_feedback TEXT,
        sme_remarks TEXT,
        verified_by VARCHAR(255),
        verified_at VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Safe column migrations for pre-existing tables
    const migrations = [
      "ALTER TABLE mentor_weekly_plans ADD COLUMN start_date VARCHAR(50)",
      "ALTER TABLE mentor_weekly_plans ADD COLUMN end_date VARCHAR(50)",
      "ALTER TABLE mentor_weekly_plans ADD COLUMN sme_remarks TEXT"
    ];
    for (const sql of migrations) {
      await db.exec(sql).catch(() => {});
    }
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
    const includeAudit = searchParams.get("includeAudit") === "true";

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

    const rows: any[] = await db.all(query, ...params).catch(() => []);

    // Fetch related conducted topics from academic_tracker and demos if requested or relevant
    let conductedTrackerRows: any[] = [];
    let demoRows: any[] = [];

    if (includeAudit || mentorId || collegeId) {
      let trackerQuery = "SELECT id, date, period_slot, class_group, subject, unit, topic, comments, status, mentor_id FROM academic_tracker WHERE 1=1";
      const trackerParams: any[] = [];
      if (mentorId && mentorId !== "all") {
        trackerQuery += " AND mentor_id = ?";
        trackerParams.push(mentorId);
      }
      if (collegeId && collegeId !== "all") {
        trackerQuery += " AND college_id = ?";
        trackerParams.push(collegeId);
      }
      if (subject && subject !== "all") {
        trackerQuery += " AND LOWER(TRIM(subject)) = LOWER(TRIM(?))";
        trackerParams.push(subject);
      }
      trackerQuery += " ORDER BY date DESC LIMIT 300";
      conductedTrackerRows = await db.all(trackerQuery, ...trackerParams).catch(() => []);

      let demoQuery = "SELECT id, mentorId, mentorName, smeId, smeName, dateStr, timeSlot, subject, stream, week, status, marks, comments FROM demo_sessions WHERE 1=1";
      const demoParams: any[] = [];
      if (mentorId && mentorId !== "all") {
        demoQuery += " AND mentorId = ?";
        demoParams.push(mentorId);
      }
      demoQuery += " ORDER BY dateStr DESC LIMIT 100";
      demoRows = await db.all(demoQuery, ...demoParams).catch(() => []);
    }

    // ── Skill tracker enrichment (Mentor Skill Development Tracker) ──
    // Attach subject_type (Skill/Academic) and the latest SME skill verdict
    // per plan so the WeeklyPlanViewer table and mentor plan studio can render
    // them without extra requests.
    let subjectTypeMap = new Map<string, string>();
    let clearanceRows: any[] = [];
    try {
      const subjectRows: any[] = await db.all("SELECT name, type FROM subjects").catch(() => []);
      subjectRows.forEach((s: any) => {
        if (s?.name) subjectTypeMap.set(String(s.name).toLowerCase().trim(), s.type || "");
      });
      clearanceRows = await db.all("SELECT mentor_id, subject, week_number, scope, status, score, remarks, verified_by, verified_at FROM mentor_skill_clearances").catch(() => []);
    } catch (_) { /* enrichment is best-effort */ }

    const verdictForPlan = (plan: any) => {
      const subjKey = String(plan.subject || "").toLowerCase().trim();
      const wk = parseInt(String(plan.week_number ?? ""), 10);
      const matches = clearanceRows.filter((c: any) =>
        String(c.subject || "").toLowerCase().trim() === subjKey &&
        parseInt(String(c.week_number ?? ""), 10) === wk &&
        (!plan.mentor_id || !c.mentor_id || c.mentor_id === plan.mentor_id)
      );
      const weekRow = matches.find((m: any) => m.scope === "week" && m.status === "cleared")
        || matches.find((m: any) => m.scope === "week" && m.status === "not_cleared")
        || matches.find((m: any) => m.scope === "week" && m.status === "needs_revision")
        || matches.find((m: any) => m.scope === "demo" && m.status === "cleared")
        || matches.find((m: any) => m.scope === "demo" && m.status === "not_cleared");
      if (!weekRow) return { verdict: "pending", score: null, remarks: null, verified_by: null, verified_at: null };
      return {
        verdict: weekRow.status,
        score: weekRow.score ?? null,
        remarks: weekRow.remarks || null,
        verified_by: weekRow.verified_by || null,
        verified_at: weekRow.verified_at || null
      };
    };

    // Build comparison metrics & audit summary
    const conductedTopicSet = new Set(
      conductedTrackerRows
        .filter(r => r.topic && r.topic.trim())
        .map(r => r.topic.toLowerCase().trim())
    );

    let totalPlannedTopics = 0;
    let completedPlannedTopics = 0;
    let pendingPlannedTopics = 0;

    const enrichedPlans = rows.map(plan => {
      let tasks: any[] = [];
      try {
        tasks = typeof plan.session_plan === "string" ? JSON.parse(plan.session_plan) : (plan.session_plan || []);
      } catch {
        tasks = [];
      }

      const tasksWithAudit = tasks.map((task: any) => {
        const topicNorm = (task.topic || "").toLowerCase().trim();
        const isCompletedInTracker = topicNorm && conductedTopicSet.has(topicNorm);
        const isConducted = isCompletedInTracker || task.status === "Completed";

        if (task.topic && task.topic.trim()) {
          totalPlannedTopics += 1;
          if (isConducted) {
            completedPlannedTopics += 1;
          } else {
            pendingPlannedTopics += 1;
          }
        }

        return {
          ...task,
          conductedStatus: isConducted ? "Completed" : "Pending",
          matchedTracker: conductedTrackerRows.find(
            ct => ct.topic && ct.topic.toLowerCase().trim() === topicNorm
          ) || null
        };
      });

      const explicitType = subjectTypeMap.get(String(plan.subject || "").toLowerCase().trim()) || "";
      const subjectType = deriveSubjectType(plan.subject, explicitType);
      return {
        ...plan,
        sme_remarks: plan.sme_remarks || plan.cam_feedback || "",
        subject_type: subjectType,
        skill_verdict: verdictForPlan(plan),
        session_plan: tasksWithAudit
      };
    });

    const completionPercentage = totalPlannedTopics > 0
      ? Math.round((completedPlannedTopics / totalPlannedTopics) * 100)
      : 0;

    const auditSummary = {
      totalPlans: rows.length,
      totalPlannedTopics,
      completedPlannedTopics,
      pendingPlannedTopics,
      completionPercentage,
      smeStatusBreakdown: {
        verified: rows.filter(r => r.status === "Verified").length,
        submitted: rows.filter(r => r.status === "Submitted").length,
        needsRevision: rows.filter(r => r.status === "Needs Revision").length,
        draft: rows.filter(r => r.status === "Draft").length
      },
      demos: {
        total: demoRows.length,
        completed: demoRows.filter(d => d.status === "completed").length,
        pending: demoRows.filter(d => d.status !== "completed").length,
        list: demoRows
      },
      conductedTrackerCount: conductedTrackerRows.length
    };

    return NextResponse.json({
      success: true,
      plans: enrichedPlans,
      audit: auditSummary
    }, { headers: noCacheHeaders });
  } catch (err: any) {
    console.error("GET /api/weekly-plan error:", err);
    return NextResponse.json(
      { success: false, message: err?.message || "Failed to fetch weekly plans" },
      { status: 500, headers: noCacheHeaders }
    );
  }
}

export async function POST(request: Request) {
  try {
    const { auth, errorResponse } = await requireAuth(request, {
      allowedRoles: ["mentor", "sme", "cam", "kam", "admin"],
      checkCsrf: true
    });
    if (errorResponse) return errorResponse;

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
      startDate = "",
      endDate = "",
      unit,
      topicsPlanned,
      sessionPlan,
      learningObjectives,
      teachingMode = "Offline",
      materialUrl = "",
      status = "Submitted",
      smeRemarks = "",
      camFeedback = ""
    } = body;

    if (!collegeId || !mentorId || !subject || !classGroup || !weekNumber) {
      return NextResponse.json(
        { success: false, message: "Missing required weekly plan fields." },
        { status: 400 }
      );
    }

    const planId = id || `WP_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const nowStr = new Date().toISOString();
    const effectiveRemarks = smeRemarks || camFeedback || "";

    // Check for date range overlap conflict with another week for the same class and subject
    if (startDate && endDate) {
      const conflict = await db.get(
        `SELECT id, week_number, start_date, end_date FROM mentor_weekly_plans
         WHERE college_id = ? AND mentor_id = ? AND LOWER(TRIM(class_group)) = LOWER(TRIM(?)) AND LOWER(TRIM(subject)) = LOWER(TRIM(?))
         AND week_number != ? AND id != ?
         AND start_date <= ? AND end_date >= ?
         LIMIT 1`,
        collegeId, mentorId, classGroup, subject, parseInt(String(weekNumber), 10), planId, endDate, startDate
      ).catch(() => null);

      if (conflict) {
        return NextResponse.json(
          {
            success: false,
            message: `Date range (${startDate} to ${endDate}) overlaps with Week ${conflict.week_number} (${conflict.start_date} to ${conflict.end_date}) for ${classGroup}.`
          },
          { status: 409 }
        );
      }
    }

    // Check if plan exists
    const existing = await db.get("SELECT id FROM mentor_weekly_plans WHERE id = ?", planId).catch(() => null);

    if (existing) {
      await db.run(
        `UPDATE mentor_weekly_plans SET
          college_id = ?, mentor_id = ?, mentor_name = ?, department = ?,
          subject = ?, class_group = ?, week_number = ?, start_date = ?, end_date = ?, unit = ?,
          topics_planned = ?, session_plan = ?, learning_objectives = ?,
          teaching_mode = ?, material_url = ?, status = ?, sme_remarks = ?, cam_feedback = ?, updated_at = ?
         WHERE id = ?`,
        collegeId, mentorId, mentorName || "", department || "",
        subject, classGroup, parseInt(String(weekNumber), 10), startDate, endDate, unit || "",
        topicsPlanned || "", typeof sessionPlan === "string" ? sessionPlan : JSON.stringify(sessionPlan || []),
        learningObjectives || "", teachingMode, materialUrl, status, effectiveRemarks, effectiveRemarks, nowStr, planId
      );
    } else {
      await db.run(
        `INSERT INTO mentor_weekly_plans (
          id, college_id, mentor_id, mentor_name, department,
          subject, class_group, week_number, start_date, end_date, unit,
          topics_planned, session_plan, learning_objectives,
          teaching_mode, material_url, status, sme_remarks, cam_feedback, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        planId, collegeId, mentorId, mentorName || "", department || "",
        subject, classGroup, parseInt(String(weekNumber), 10), startDate, endDate, unit || "",
        topicsPlanned || "", typeof sessionPlan === "string" ? sessionPlan : JSON.stringify(sessionPlan || []),
        learningObjectives || "", teachingMode, materialUrl, status, effectiveRemarks, effectiveRemarks, nowStr
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
    const { auth, errorResponse } = await requireAuth(request, {
      allowedRoles: ["mentor", "sme", "cam", "kam", "admin"],
      checkCsrf: true
    });
    if (errorResponse) return errorResponse;

    const db = await getDb();
    await ensureTable(db);
    const body = await request.json();

    const { id, status, smeRemarks, camFeedback, verifiedBy } = body;

    if (!id || !status) {
      return NextResponse.json(
        { success: false, message: "Missing plan ID or status." },
        { status: 400 }
      );
    }

    const nowStr = new Date().toLocaleString();
    const effectiveRemarks = smeRemarks || camFeedback || "";

    await db.run(
      `UPDATE mentor_weekly_plans SET
        status = ?, sme_remarks = ?, cam_feedback = ?, verified_by = ?, verified_at = ?, updated_at = ?
       WHERE id = ?`,
      status, effectiveRemarks, effectiveRemarks, verifiedBy || "Subject Matter Expert", nowStr, new Date().toISOString(), id
    );

    const updated = await db.get("SELECT * FROM mentor_weekly_plans WHERE id = ?", id);

    if (status === "Verified" && updated && updated.mentor_id) {
      const notifId = "notif_" + Date.now() + "_" + Math.random().toString(36).substr(2, 6);
      const title = "Weekly Plan Approved";
      const message = `Your Weekly Plan for ${updated.subject || 'your subject'} (Week ${updated.week_number || ''}) has been approved by ${verifiedBy || "Subject Matter Expert"}.`;
      await db.run(
        `INSERT INTO notifications (id, user_id, title, message, is_read, link, type, created_at)
         VALUES (?, ?, ?, ?, 0, ?, ?, ?)`,
        notifId,
        updated.mentor_id,
        title,
        message,
        "/mentor/weekly-plan",
        "weekly_plan_approved",
        new Date().toISOString()
      ).catch((e) => console.error("Failed to insert notification:", e));
    }

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
    const { auth, errorResponse } = await requireAuth(request, {
      allowedRoles: ["mentor", "sme", "cam", "kam", "admin"],
      checkCsrf: true
    });
    if (errorResponse) return errorResponse;

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
