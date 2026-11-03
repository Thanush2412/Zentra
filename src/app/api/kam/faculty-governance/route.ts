export const maxDuration = 30;

import { NextResponse } from "next/server";
import { getDb, type QueryFailure } from "@/lib/db";
import { requireKamScope, resolveScopeParams } from "@/lib/kamScope";
import { getInstitutionDateStr } from "@/lib/localDate";

export async function GET(request: Request) {
  try {
    const db = await getDb();
    const { scope, errorResponse } = await requireKamScope(request, db);
    if (errorResponse) return errorResponse;

    const { searchParams } = new URL(request.url);
    const scoped = resolveScopeParams(scope!, searchParams.get("kamId"), searchParams.get("collegeId"));
    if (scoped.errorResponse) return scoped.errorResponse;
    const collegeId = scoped.collegeId;
    const kamId = scoped.kamId;
    const todayStr = getInstitutionDateStr();

    // 1. Fetch colleges & mentors — scoped to KAM's assigned colleges
    let colleges: any[];
    if (collegeId && collegeId !== "all") {
      colleges = await db.all("SELECT * FROM colleges WHERE id = ?", collegeId);
    } else if (kamId) {
      colleges = await db.all("SELECT * FROM colleges WHERE kam_id = ? ORDER BY name ASC", kamId);
    } else {
      colleges = await db.all("SELECT * FROM colleges ORDER BY name ASC");
    }
    const collegeIds = colleges.map((c: any) => c.id);
    const inClause = collegeIds.length > 0 ? `(${collegeIds.map(() => "?").join(",")})` : "(NULL)";

    const mentors = collegeIds.length > 0
      ? await db.all(`SELECT * FROM mentors WHERE college_id IN ${inClause} AND (is_active = 1 OR is_active IS NULL)`, ...collegeIds)
      : [];

    // 2. Fetch today's mentor attendance records. These feeds drive the punch and
    // demo KPIs, so a failed read must surface instead of rendering zeros.
    const governanceFailures: QueryFailure[] = [];
    const [punchRows, leaveRequests, demoSessions] = await db.multiQuery(
      [
        { sql: "SELECT * FROM mentor_attendance WHERE date_str = ?", params: [todayStr] },
        {
          sql: `SELECT flr.*, m.name as mentor_name, m.department, c.name as college_name
                FROM faculty_leave_requests flr
                JOIN mentors m ON flr.mentor_id = m.id
                LEFT JOIN colleges c ON flr.college_id = c.id
                WHERE flr.end_date >= ? AND m.college_id IN ${inClause}
                ORDER BY flr.start_date ASC`,
          params: [todayStr, ...collegeIds]
        },
        {
          sql: `SELECT ds.*, m.name as mentor_full_name, m.department as mentor_department
                FROM demo_sessions ds
                JOIN mentors m ON ds.mentorId = m.id
                WHERE m.college_id IN ${inClause}
                ORDER BY ds.dateStr DESC`,
          params: [...collegeIds]
        }
      ],
      governanceFailures
    );
    if (governanceFailures.length > 0) {
      return NextResponse.json(
        { success: false, error: `Faculty governance inputs could not be read: ${governanceFailures[0].error}` },
        { status: 500 }
      );
    }

    // Compute Faculty Daily Attendance Punch Health
    let totalFaculty = mentors.length;
    let presentToday = 0;
    let odToday = 0;
    let leaveToday = 0;
    let latePunchesToday = 0;
    let missingPunchesToday = 0;

    const punchMap = new Map<string, any>();
    (punchRows || []).forEach((p: any) => {
      punchMap.set(p.mentor_id, p);
    });

    const mentorPunchRoster = mentors.map((m: any) => {
      const punch = punchMap.get(m.id);
      let status = punch ? punch.status : "Not Punched";
      let punchTime = punch?.punch_in_time || null;
      let isLate = false;

      if (punchTime) {
        // Late punch check: if after 9:00 AM
        if (punchTime.includes("PM") || (!punchTime.includes("08:") && !punchTime.includes("8:"))) {
          isLate = true;
          latePunchesToday++;
        }
      }

      if (status.toLowerCase() === "present") presentToday++;
      else if (status.toLowerCase() === "od" || status.toLowerCase() === "on-duty") odToday++;
      else if (status.toLowerCase() === "leave") leaveToday++;
      else missingPunchesToday++;

      const col = colleges.find((c: any) => c.id === m.college_id);

      return {
        id: m.id,
        name: m.name,
        email: m.email,
        department: m.department || "General",
        subjectGroup: m.subject_group || "Faculty",
        collegeId: m.college_id,
        collegeName: col?.name || "Institution",
        status,
        punchTime: punchTime || "—",
        isLate,
        reason: punch?.reason || null
      };
    });

    const punchRatePct = totalFaculty > 0
      ? Math.round(((presentToday + odToday) / totalFaculty) * 1000) / 10
      : 0;

    // Upcoming 14-Day Faculty Leave Coverage Radar
    const upcomingLeaves = (leaveRequests || []).map((lr: any) => {
      // In real system, check if approved_handovers covers this slot
      const isCovered = lr.status === "approved" || lr.status === "covered";
      return {
        id: lr.id,
        mentorId: lr.mentor_id,
        mentorName: lr.mentor_name,
        department: lr.department,
        collegeName: lr.college_name || "Campus",
        startDate: lr.start_date,
        endDate: lr.end_date,
        requestType: lr.request_type || "Leave",
        leaveCategory: lr.leave_category || "Casual Leave (CL)",
        reason: lr.reason,
        status: lr.status,
        coverageStatus: isCovered ? "Covered & Substituted" : "Unassigned / Pending Cover"
      };
    });

    // Demo averages are computed only from sessions that actually carry a numeric
    // score. Empty cohorts report zero demos, not a seeded 24/20/81.
    const totalDemos = demoSessions.length;
    const completedDemos = demoSessions.filter(
      (d: any) => d.status === "completed" || (d.marks !== null && d.marks !== undefined && d.marks !== "")
    ).length;
    const scoredDemos = demoSessions.filter(
      (d: any) => d.marks !== null && d.marks !== undefined && d.marks !== "" && !isNaN(Number(d.marks))
    );
    const avgDemoScore = scoredDemos.length > 0
      ? Math.round(scoredDemos.reduce((acc: number, d: any) => acc + Number(d.marks), 0) / scoredDemos.length)
      : 0;

    const demoRoster = demoSessions.slice(0, 10).map((d: any) => ({
      id: d.id,
      mentorName: d.mentorName || d.mentor_full_name,
      smeName: d.smeName || d.sme_name || null,
      subject: d.subject,
      dateStr: d.dateStr,
      timeSlot: d.timeSlot,
      status: d.status,
      marks: d.marks ?? null,
      comments: d.comments ?? null
    }));

    return NextResponse.json({
      success: true,
      punchSummary: {
        totalFaculty,
        presentToday,
        odToday,
        leaveToday,
        latePunchesToday,
        missingPunchesToday,
        punchRatePct
      },
      mentorPunchRoster: collegeId && collegeId !== "all"
        ? mentorPunchRoster.filter(m => m.collegeId === collegeId)
        : mentorPunchRoster,
      upcomingLeaves,
      demoSummary: {
        totalDemos,
        completedDemos,
        pendingDemos: Math.max(0, totalDemos - completedDemos),
        avgDemoScore
      },
      demoRoster
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
