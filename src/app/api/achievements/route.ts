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
    await ensureMigration("student_achievements_table");
    const db = await getDb();
    const { searchParams } = new URL(request.url);

    const collegeId = searchParams.get("collegeId") || searchParams.get("college_id");
    const studentId = searchParams.get("studentId") || searchParams.get("student_id");

    if (studentId) {
      // Fetch achievements where studentId is in the student_ids JSON array or string
      const allRows = await db.all("SELECT * FROM student_achievements ORDER BY date_str DESC, created_at DESC");
      const matched = allRows.filter((row: any) => {
        if (!row.student_ids) return false;
        try {
          const ids = typeof row.student_ids === "string" ? JSON.parse(row.student_ids) : row.student_ids;
          if (Array.isArray(ids)) {
            return ids.includes(studentId);
          }
        } catch (_) {
          return row.student_ids.includes(studentId);
        }
        return false;
      });
      return NextResponse.json({ success: true, records: matched });
    }

    if (collegeId && collegeId !== "all") {
      const records = await db.all(
        "SELECT * FROM student_achievements WHERE college_id = ? ORDER BY date_str DESC, created_at DESC",
        [collegeId]
      );
      return NextResponse.json({ success: true, records });
    }

    const records = await db.all("SELECT * FROM student_achievements ORDER BY date_str DESC, created_at DESC");
    return NextResponse.json({ success: true, records });
  } catch (error: any) {
    console.error("GET /api/achievements error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await ensureMigration("student_achievements_table");
    const db = await getDb();
    const body = await request.json();

    const {
      id,
      collegeId,
      title,
      topic = "",
      category = "Hackathon & Competitions",
      description = "",
      dateStr = new Date().toISOString().split("T")[0],
      badge = "Winner",
      rewardPrize = "",
      eventName = "",
      proofLink = "",
      photos = null,
      studentIds = [],
      studentNames = [],
      participationType = "individual",
      teamName = "",
      achievementLevel = "National Level",
      organizer = "",
      addedBy = "Campus Manager"
    } = body;

    if (!title || !title.trim()) {
      return NextResponse.json({ success: false, message: "Achievement title is required" }, { status: 400 });
    }

    const recordId = id || `ach_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const studentIdsStr = typeof studentIds === "string" ? studentIds : JSON.stringify(studentIds || []);
    const studentNamesStr = typeof studentNames === "string" ? studentNames : JSON.stringify(studentNames || []);
    const photosStr = photos ? (typeof photos === "string" ? photos : JSON.stringify(photos)) : null;

    const isPg = (db as any).isPostgres;
    const nowIso = new Date().toISOString();

    if (isPg) {
      await db.run(
        `INSERT INTO student_achievements (
          id, college_id, title, topic, category, description, date_str, badge, reward_prize, 
          event_name, proof_link, photos, student_ids, student_names, participation_type,
          team_name, achievement_level, organizer, added_by, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
        ON CONFLICT (id) DO UPDATE SET
          college_id = EXCLUDED.college_id,
          title = EXCLUDED.title,
          topic = EXCLUDED.topic,
          category = EXCLUDED.category,
          description = EXCLUDED.description,
          date_str = EXCLUDED.date_str,
          badge = EXCLUDED.badge,
          reward_prize = EXCLUDED.reward_prize,
          event_name = EXCLUDED.event_name,
          proof_link = EXCLUDED.proof_link,
          photos = EXCLUDED.photos,
          student_ids = EXCLUDED.student_ids,
          student_names = EXCLUDED.student_names,
          participation_type = EXCLUDED.participation_type,
          team_name = EXCLUDED.team_name,
          achievement_level = EXCLUDED.achievement_level,
          organizer = EXCLUDED.organizer,
          added_by = EXCLUDED.added_by`,
        [
          recordId,
          collegeId || "general",
          title.trim(),
          (topic || "").trim(),
          category,
          description.trim(),
          dateStr,
          badge,
          rewardPrize.trim(),
          eventName.trim(),
          proofLink.trim(),
          photosStr,
          studentIdsStr,
          studentNamesStr,
          participationType,
          teamName.trim(),
          achievementLevel,
          organizer.trim(),
          addedBy
        ]
      );
    } else {
      await db.run(
        `INSERT INTO student_achievements (
          id, college_id, title, topic, category, description, date_str, badge, reward_prize, 
          event_name, proof_link, photos, student_ids, student_names, participation_type,
          team_name, achievement_level, organizer, added_by, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT (id) DO UPDATE SET
          college_id = excluded.college_id,
          title = excluded.title,
          topic = excluded.topic,
          category = excluded.category,
          description = excluded.description,
          date_str = excluded.date_str,
          badge = excluded.badge,
          reward_prize = excluded.reward_prize,
          event_name = excluded.event_name,
          proof_link = excluded.proof_link,
          photos = excluded.photos,
          student_ids = excluded.student_ids,
          student_names = excluded.student_names,
          participation_type = excluded.participation_type,
          team_name = excluded.team_name,
          achievement_level = excluded.achievement_level,
          organizer = excluded.organizer,
          added_by = excluded.added_by`,
        [
          recordId,
          collegeId || "general",
          title.trim(),
          (topic || "").trim(),
          category,
          description.trim(),
          dateStr,
          badge,
          rewardPrize.trim(),
          eventName.trim(),
          proofLink.trim(),
          photosStr,
          studentIdsStr,
          studentNamesStr,
          participationType,
          teamName.trim(),
          achievementLevel,
          organizer.trim(),
          addedBy,
          nowIso
        ]
      );
    }

    // Log to audit_logs for campus e-audit traceability
    const auditId = `audit_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const studentCount = Array.isArray(studentIds) ? studentIds.length : 1;
    const auditDesc = `Student Achievement Recorded: "${title.trim()}" (${badge})${topic ? ` [Topic: ${topic.trim()}]` : ""} for ${studentCount} student(s) by ${addedBy}.`;

    await db.run(
      `INSERT INTO audit_logs (id, type, description, actorName, actorRole, timestamp)
       VALUES (?, 'achievement', ?, ?, 'Campus Manager', ?)`,
      [auditId, auditDesc, addedBy, nowIso]
    ).catch(() => {});

    return NextResponse.json({
      success: true,
      message: "Student achievement recorded successfully.",
      record: {
        id: recordId,
        college_id: collegeId,
        title,
        topic: (topic || "").trim(),
        category,
        description,
        date_str: dateStr,
        badge,
        reward_prize: rewardPrize,
        event_name: eventName,
        proof_link: proofLink,
        photos: photosStr,
        student_ids: studentIdsStr,
        student_names: studentNamesStr,
        participation_type: participationType,
        team_name: teamName.trim(),
        achievement_level: achievementLevel,
        organizer: organizer.trim(),
        added_by: addedBy,
        created_at: nowIso
      }
    });
  } catch (error: any) {
    console.error("POST /api/achievements error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    await ensureMigration("student_achievements_table");
    const db = await getDb();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ success: false, message: "Missing achievement id" }, { status: 400 });
    }

    await db.run("DELETE FROM student_achievements WHERE id = ?", [id]);
    return NextResponse.json({ success: true, message: "Achievement deleted successfully" });
  } catch (error: any) {
    console.error("DELETE /api/achievements error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
