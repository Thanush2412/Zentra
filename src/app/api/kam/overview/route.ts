export const maxDuration = 30;

import { NextResponse } from "next/server";
import { getDb, type QueryFailure } from "@/lib/db";
import { requireKamScope, resolveScopeParams } from "@/lib/kamScope";
import { getInstitutionDateStrOffset } from "@/lib/localDate";

export async function GET(request: Request) {
  try {
    const db = await getDb();
    const { scope, errorResponse } = await requireKamScope(request, db);
    if (errorResponse) return errorResponse;

    const { searchParams } = new URL(request.url);
    const scoped = resolveScopeParams(scope!, searchParams.get("kamId"), null);
    if (scoped.errorResponse) return scoped.errorResponse;
    const kamId = scoped.kamId;

    // Fetch colleges assigned to this KAM, or all colleges if kamId not specified
    const colleges = kamId
      ? await db.all("SELECT * FROM colleges WHERE kam_id = ? ORDER BY name ASC", kamId)
      : await db.all("SELECT * FROM colleges ORDER BY name ASC");

    const collegeIds = colleges.map((c: any) => c.id);

    if (collegeIds.length === 0) {
      return NextResponse.json({
        success: true,
        kpis: { totalStudents: 0, avgAttendance: 0, activeFaculty: 0, atRiskCount: 0, criticalCount: 0, campusHealth: 100 },
        campuses: [],
        campusComparison: []
      });
    }

    // The window is computed in JS: SQLite's date('now') does not exist in Postgres,
    // where these queries previously failed and silently zeroed every attendance KPI.
    const sinceDate = getInstitutionDateStrOffset(-30);

    // Parallel aggregate queries for portfolio performance
    const overviewFailures: QueryFailure[] = [];
    const [cams, studentsSummary, facultySummary, todayAttendance, issues] = await db.multiQuery(
      [
        { sql: "SELECT * FROM campus_managers" },
        {
          sql: `SELECT college_id, COUNT(id) as total_students
                FROM students
                GROUP BY college_id`
        },
        {
          sql: `SELECT college_id, COUNT(id) as total_faculty,
                       SUM(CASE WHEN is_active = 1 OR is_active IS NULL THEN 1 ELSE 0 END) as active_faculty
                FROM mentors
                GROUP BY college_id`
        },
        {
          sql: `SELECT st.college_id,
                       COUNT(sa.id) as total_marks,
                       SUM(CASE WHEN LOWER(sa.status) = 'present' THEN 1 ELSE 0 END) as present_marks,
                       SUM(CASE WHEN LOWER(sa.status) = 'absent' THEN 1 ELSE 0 END) as absent_marks
                FROM student_attendance sa
                JOIN students st ON sa.studentId = st.id
                WHERE sa.dateStr >= ?
                GROUP BY st.college_id`,
          params: [sinceDate]
        },
        {
          sql: `SELECT college_id, COUNT(id) as total_issues,
                       SUM(CASE WHEN status != 'resolved' AND status != 'closed' THEN 1 ELSE 0 END) as open_issues
                FROM campus_issues
                GROUP BY college_id`
        }
      ],
      overviewFailures
    );
    if (overviewFailures.length > 0) {
      return NextResponse.json(
        { success: false, error: `KAM overview inputs could not be read: ${overviewFailures[0].error}` },
        { status: 500 }
      );
    }

    // Build per-campus health cards
    let totalPortfolioStudents = 0;
    let totalPortfolioFaculty = 0;
    let totalPortfolioPresent = 0;
    let totalPortfolioMarks = 0;

    const campusCards = colleges.map((col: any) => {
      const cam = cams.find((m: any) => m.college_id === col.id) || null;
      const stRow = studentsSummary.find((s: any) => s.college_id === col.id) || { total_students: 0 };
      const facRow = facultySummary.find((f: any) => f.college_id === col.id) || { total_faculty: 0, active_faculty: 0 };
      const attRow = todayAttendance.find((a: any) => a.college_id === col.id) || { total_marks: 0, present_marks: 0 };
      const issRow = (issues as any[]).find((i: any) => i.college_id === col.id) || { open_issues: 0 };

      const attPct = attRow.total_marks > 0
        ? Math.round((attRow.present_marks / attRow.total_marks) * 1000) / 10
        : 0;

      totalPortfolioStudents += Number(stRow.total_students || 0);
      totalPortfolioFaculty += Number(facRow.active_faculty || facRow.total_faculty || 0);
      totalPortfolioPresent += Number(attRow.present_marks || 0);
      totalPortfolioMarks += Number(attRow.total_marks || 0);

      // Campus operational health score (attendance minus open-issue penalty).
      // A campus with no attendance marks yet must not be scored as if it had 85%.
      const healthScore = Math.max(0, Math.min(100, Math.round(attPct - ((issRow.open_issues || 0) * 2))));

      return {
        id: col.id,
        name: col.name,
        code: col.code || col.id,
        location: col.location || "Campus",
        workingDays: col.working_days || 5,
        totalStudents: Number(stRow.total_students || 0),
        totalFaculty: Number(facRow.total_faculty || 0),
        activeFaculty: Number(facRow.active_faculty || facRow.total_faculty || 0),
        attendancePct: attPct,
        openIssues: Number(issRow.open_issues || 0),
        healthScore,
        cam: cam ? {
          id: cam.id,
          name: cam.name,
          email: cam.email,
          phone: cam.phone || "—",
          status: "Active"
        } : null
      };
    });

    const portfolioAvgAttendance = totalPortfolioMarks > 0
      ? Math.round((totalPortfolioPresent / totalPortfolioMarks) * 1000) / 10
      : 0;

    return NextResponse.json({
      success: true,
      kpis: {
        totalStudents: totalPortfolioStudents,
        avgAttendance: portfolioAvgAttendance,
        activeFaculty: totalPortfolioFaculty,
        totalCampuses: colleges.length,
        campusHealth: Math.round(campusCards.reduce((acc, c) => acc + c.healthScore, 0) / (campusCards.length || 1))
      },
      campuses: campusCards,
      campusComparison: campusCards.map(c => ({
        name: c.name,
        code: c.code,
        attendance: c.attendancePct,
        students: c.totalStudents,
        faculty: c.activeFaculty,
        health: c.healthScore
      }))
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
