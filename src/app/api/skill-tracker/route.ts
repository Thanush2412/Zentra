// Pin to Mumbai (bom1) — co-located with Turso/Postgres DB
export const preferredRegion = "bom1";
export const maxDuration = 60;

import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { ensureMigration } from "@/lib/migrations";
import {
  buildWeekRollup,
  deriveSubjectType,
  normalizeTopic
} from "@/lib/skillTracker";

const VERDICTS = new Set(["pending", "cleared", "not_cleared", "needs_revision"]);

async function ensureTable(db: any) {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS mentor_skill_clearances (
      id TEXT PRIMARY KEY,
      college_id TEXT,
      mentor_id TEXT NOT NULL,
      mentor_name TEXT,
      subject TEXT NOT NULL,
      subject_type TEXT DEFAULT 'Skill',
      week_number INTEGER NOT NULL,
      scope TEXT NOT NULL DEFAULT 'week',
      topic TEXT,
      demo_session_id TEXT,
      weekly_plan_id TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      score INTEGER,
      remarks TEXT,
      verified_by TEXT,
      verified_at TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT
    );
  `).catch(() => {});
  const cols = [
    "ALTER TABLE mentor_skill_clearances ADD COLUMN mentor_name TEXT",
    "ALTER TABLE mentor_skill_clearances ADD COLUMN subject_type TEXT DEFAULT 'Skill'",
    "ALTER TABLE mentor_skill_clearances ADD COLUMN weekly_plan_id TEXT",
    "ALTER TABLE mentor_skill_clearances ADD COLUMN updated_at TEXT"
  ];
  for (const sql of cols) {
    await db.exec(sql).catch(() => {});
  }
  await db.exec("CREATE INDEX IF NOT EXISTS idx_skill_clearances_mentor ON mentor_skill_clearances(mentor_id, subject, week_number)").catch(() => {});
  await db.exec("CREATE INDEX IF NOT EXISTS idx_skill_clearances_college ON mentor_skill_clearances(college_id)").catch(() => {});
}

/** Pick the best weekly plan per (subject, week): Verified > Submitted > latest updated. */
function pickBestPlan(plans: any[]): any | null {
  if (!plans || plans.length === 0) return null;
  const rank = (p: any) => (p.status === "Verified" ? 3 : p.status === "Submitted" ? 2 : p.status === "Needs Revision" ? 1 : 0);
  return [...plans].sort((a, b) => rank(b) - rank(a) || String(b.updated_at || "").localeCompare(String(a.updated_at || "")))[0];
}

export async function GET(request: Request) {
  try {
    const db = await getDb();
    await ensureMigration("mentor_skill_clearances");
    await ensureTable(db);

    const { searchParams } = new URL(request.url);
    const mentorId = searchParams.get("mentorId");
    const collegeId = searchParams.get("collegeId");
    const subject = searchParams.get("subject");
    const weekNumber = searchParams.get("weekNumber");

    // ── 1. Clearance rows ──────────────────────────────────────────────
    let clearanceQuery = "SELECT * FROM mentor_skill_clearances WHERE 1=1";
    const clearanceParams: any[] = [];
    if (mentorId) {
      clearanceQuery += " AND mentor_id = ?";
      clearanceParams.push(mentorId);
    }
    if (collegeId) {
      clearanceQuery += " AND college_id = ?";
      clearanceParams.push(collegeId);
    }
    if (subject && subject !== "all") {
      clearanceQuery += " AND LOWER(TRIM(subject)) = LOWER(TRIM(?))";
      clearanceParams.push(subject);
    }
    const clearances: any[] = await db.all(clearanceQuery, ...clearanceParams).catch(() => []);

    // ── 2. Weekly plans (skill subjects feed the roll-up) ──────────────
    let planQuery = "SELECT * FROM mentor_weekly_plans WHERE 1=1";
    const planParams: any[] = [];
    if (mentorId) {
      planQuery += " AND mentor_id = ?";
      planParams.push(mentorId);
    }
    if (collegeId && collegeId !== "all") {
      planQuery += " AND college_id = ?";
      planParams.push(collegeId);
    }
    if (subject && subject !== "all") {
      planQuery += " AND LOWER(TRIM(subject)) = LOWER(TRIM(?))";
      planParams.push(subject);
    }
    planQuery += " ORDER BY week_number ASC, updated_at DESC LIMIT 1000";
    const plans: any[] = await db.all(planQuery, ...planParams).catch(() => []);

    // ── 3. Demo sessions ───────────────────────────────────────────────
    let demoQuery = "SELECT id, mentorId, mentorName, smeId, smeName, dateStr, timeSlot, subject, stream, week, status, marks, comments FROM demo_sessions WHERE 1=1";
    const demoParams: any[] = [];
    if (mentorId) {
      demoQuery += " AND mentorId = ?";
      demoParams.push(mentorId);
    }
    demoQuery += " ORDER BY dateStr DESC LIMIT 200";
    const demos: any[] = await db.all(demoQuery, ...demoParams).catch(() => []);

    // ── 4. Conducted topics (academic_tracker) ─────────────────────────
    let trackerQuery = "SELECT id, date, period_slot, class_group, subject, unit, topic, comments, status, mentor_id, week_number, weekly_plan_week FROM academic_tracker WHERE 1=1";
    const trackerParams: any[] = [];
    if (mentorId) {
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
    trackerQuery += " ORDER BY date DESC LIMIT 600";
    const trackerRows: any[] = await db.all(trackerQuery, ...trackerParams).catch(() => []);

    // ── 5. Subject type map (subjects table) ───────────────────────────
    const subjectRows: any[] = await db.all("SELECT name, type FROM subjects").catch(() => []);
    const subjectTypeMap = new Map<string, string>();
    subjectRows.forEach((s: any) => {
      if (s?.name) subjectTypeMap.set(normalizeTopic(s.name), s.type || "");
    });

    const resolveType = (subjectName: string): "Skill" | "Academic" =>
      deriveSubjectType(subjectName, subjectTypeMap.get(normalizeTopic(subjectName)));

    // SKILL-ONLY gate: the Skill Development Tracker tracks Skill subjects exclusively.
    // Academic subject plans/demos/clearances must never surface here.
    const isSkillSubjectName = (subjectName: string): boolean => resolveType(subjectName) === "Skill";
    const skillDemos = demos.filter(d => isSkillSubjectName(d.subject || ""));
    const skillClearances = clearances.filter(c => isSkillSubjectName(c.subject));

    // ── 6. Build per mentor × subject × week roll-up ───────────────────
    // Group plans by (subject, week)
    const plansByKey = new Map<string, any[]>();
    plans.forEach(p => {
      const key = `${normalizeTopic(p.subject)}__${p.week_number}`;
      if (!plansByKey.has(key)) plansByKey.set(key, []);
      plansByKey.get(key)!.push(p);
    });

    const clearancesBySubjectWeek = new Map<string, any[]>();
    skillClearances.forEach(c => {
      const key = `${normalizeTopic(c.subject)}__${c.week_number}`;
      if (!clearancesBySubjectWeek.has(key)) clearancesBySubjectWeek.set(key, []);
      clearancesBySubjectWeek.get(key)!.push(c);
    });

    const mentorSubjects = new Set<string>();
    plans.forEach(p => mentorSubjects.add(p.subject));
    clearances.forEach(c => mentorSubjects.add(c.subject));

    const weeksFilter = weekNumber && weekNumber !== "all" ? [parseInt(weekNumber, 10)] : Array.from({ length: 16 }, (_, i) => i + 1);

    const mentors: any[] = [];
    if (mentorId) {
      const m = await db.get("SELECT id, name, college_id FROM mentors WHERE id = ?", mentorId).catch(() => null);
      if (m) mentors.push(m);
    } else if (collegeId && collegeId !== "all") {
      const rows = await db.all("SELECT id, name, college_id FROM mentors WHERE college_id = ? ORDER BY name ASC", collegeId).catch(() => []);
      mentors.push(...rows);
    }

    const mentorRows: any[] = [];
    const mentorIds = mentorId ? [mentorId] : mentors.map(m => m.id);
    const mentorNames = new Map<string, string>(mentors.map((m: any) => [m.id, m.name]));

    for (const mId of mentorIds) {
      // Mentors with neither plans nor clearances are skipped in campus scope
      const subjForMentor = new Set<string>(
        plans.filter(p => p.mentor_id === mId).map(p => p.subject)
      );
      skillClearances.filter(c => c.mentor_id === mId).forEach(c => subjForMentor.add(c.subject));

      for (const subj of subjForMentor) {
        const subjKey = normalizeTopic(subj);
        const subjectType = resolveType(subj);
        if (subjectType !== "Skill") continue; // SKILL-ONLY gate
        const weeks: any[] = [];

        for (const wk of weeksFilter) {
          const key = `${subjKey}__${wk}`;
          const wkPlans = (plansByKey.get(key) || []).filter(p => p.mentor_id === mId);
          if (wkPlans.length === 0 && !(clearancesBySubjectWeek.get(key) || []).some(c => c.mentor_id === mId)) {
            continue; // nothing planned and no verdict for this week → omit
          }
          const bestPlan = pickBestPlan(wkPlans);
          const wkDemos = skillDemos.filter(d =>
            d.mentorId === mId &&
            normalizeTopic(d.subject || "") === subjKey &&
            parseInt(String(d.week ?? ""), 10) === wk
          );
          const wkTracker = trackerRows.filter(r =>
            r.mentor_id === mId &&
            normalizeTopic(r.subject || "") === subjKey
          );
          const rollup = buildWeekRollup(
            bestPlan,
            (clearancesBySubjectWeek.get(key) || []).filter(c => c.mentor_id === mId),
            wkDemos,
            wkTracker,
            wk
          );
          weeks.push({
            ...rollup,
            weekly_plan_id: bestPlan?.id || null,
            plan_status: bestPlan?.status || null
          });
        }

        if (weeks.length === 0) continue;

        mentorRows.push({
          mentor_id: mId,
          mentor_name: mentorNames.get(mId) || null,
          college_id: (mentors.find(m => m.id === mId) as any)?.college_id || null,
          subject: subj,
          subject_type: subjectType,
          weeks
        });
      }
    }

    // ── 7. Summary counts (for panel KPI cards) ────────────────────────
    const allWeeks = mentorRows.flatMap(r => r.weeks);
    const summary = {
      mentors: mentorRows.length,
      total_weeks: allWeeks.length,
      cleared: allWeeks.filter(w => w.verdict === "cleared").length,
      not_cleared: allWeeks.filter(w => w.verdict === "not_cleared").length,
      pending: allWeeks.filter(w => w.verdict === "pending").length,
      needs_revision: allWeeks.filter(w => w.verdict === "needs_revision").length,
      completion_pct: allWeeks.length > 0
        ? Math.round((allWeeks.filter(w => w.verdict === "cleared").length / allWeeks.length) * 100)
        : 0
    };

    return NextResponse.json({
      success: true,
      summary,
      mentors: mentorRows,
      clearances: skillClearances
    });
  } catch (err: any) {
    console.error("GET /api/skill-tracker error:", err);
    return NextResponse.json(
      { success: false, message: err?.message || "Failed to fetch skill tracker" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const db = await getDb();
    await ensureMigration("mentor_skill_clearances");
    await ensureTable(db);

    const body = await request.json();
    const {
      mentorId,
      mentorName,
      collegeId,
      subject,
      subjectType,
      weekNumber,
      scope = "week",
      topic,
      demoSessionId,
      weeklyPlanId,
      status,
      score,
      remarks,
      verifiedBy
    } = body;

    if (!mentorId || !subject || !weekNumber || !status || !VERDICTS.has(status)) {
      return NextResponse.json(
        { success: false, message: "Missing or invalid fields: mentorId, subject, weekNumber, status." },
        { status: 400 }
      );
    }
    if (scope === "topic" && !topic) {
      return NextResponse.json(
        { success: false, message: "scope='topic' requires a topic." },
        { status: 400 }
      );
    }
    // Anti-rubber-stamp: clearing without demo backing requires remarks
    if (status === "cleared" && scope !== "demo" && !remarks?.trim()) {
      return NextResponse.json(
        { success: false, message: "Remarks are required when clearing a week/topic without a demo-backed evaluation." },
        { status: 400 }
      );
    }

    const nowStr = new Date().toISOString();
    const resolvedType = deriveSubjectType(subject, subjectType);
    if (resolvedType !== "Skill") {
      return NextResponse.json(
        { success: false, message: "Skill verdicts can only be recorded for Skill subjects." },
        { status: 400 }
      );
    }

    // Upsert key: scope-aware. Demo scope keys on demo_session_id; topic on topic; week on week.
    let existing: any = null;
    if (scope === "demo" && demoSessionId) {
      existing = await db.get(
        "SELECT id FROM mentor_skill_clearances WHERE mentor_id = ? AND subject = ? AND week_number = ? AND scope = 'demo' AND demo_session_id = ?",
        mentorId, subject, weekNumber, demoSessionId
      ).catch(() => null);
    } else if (scope === "topic") {
      existing = await db.get(
        "SELECT id FROM mentor_skill_clearances WHERE mentor_id = ? AND subject = ? AND week_number = ? AND scope = 'topic' AND LOWER(TRIM(COALESCE(topic, ''))) = LOWER(TRIM(?))",
        mentorId, subject, weekNumber, topic
      ).catch(() => null);
    } else {
      existing = await db.get(
        "SELECT id FROM mentor_skill_clearances WHERE mentor_id = ? AND subject = ? AND week_number = ? AND scope = 'week'",
        mentorId, subject, weekNumber
      ).catch(() => null);
    }

    if (existing?.id) {
      await db.run(
        `UPDATE mentor_skill_clearances SET
          status = ?, score = ?, remarks = ?, verified_by = ?, verified_at = ?, updated_at = ?
         WHERE id = ?`,
        status,
        score ?? null,
        remarks || "",
        verifiedBy || "Subject Matter Expert",
        nowStr,
        nowStr,
        existing.id
      );
    } else {
      const id = `MSC_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      await db.run(
        `INSERT INTO mentor_skill_clearances (
          id, college_id, mentor_id, mentor_name, subject, subject_type,
          week_number, scope, topic, demo_session_id, weekly_plan_id,
          status, score, remarks, verified_by, verified_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        id, collegeId || null, mentorId, mentorName || null, subject, resolvedType,
        weekNumber, scope, topic || null, demoSessionId || null, weeklyPlanId || null,
        status, score ?? null, remarks || "", verifiedBy || "Subject Matter Expert", nowStr, nowStr
      );
    }

    const row = existing?.id
      ? await db.get("SELECT * FROM mentor_skill_clearances WHERE id = ?", existing.id)
      : await db.get("SELECT * FROM mentor_skill_clearances WHERE mentor_id = ? AND subject = ? AND week_number = ? AND scope = ? ORDER BY updated_at DESC LIMIT 1", mentorId, subject, weekNumber, scope);

    return NextResponse.json({
      success: true,
      message: `Skill verdict recorded: ${status}.`,
      clearance: row
    });
  } catch (err: any) {
    console.error("POST /api/skill-tracker error:", err);
    return NextResponse.json(
      { success: false, message: err?.message || "Failed to record skill verdict" },
      { status: 500 }
    );
  }
}
