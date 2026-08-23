export const preferredRegion = "bom1";
export const maxDuration = 30;

import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET(request: Request) {
  try {
    const db = await getDb();
    const { searchParams } = new URL(request.url);
    const collegeId = searchParams.get("collegeId");
    const kamId = searchParams.get("kamId");
    const department = searchParams.get("department");
    const classGroup = searchParams.get("classGroup");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    let query = `
      SELECT sa.dateStr,
             COUNT(sa.id) as total_marks,
             SUM(CASE WHEN LOWER(sa.status) = 'present' THEN 1 ELSE 0 END) as present_marks,
             SUM(CASE WHEN LOWER(sa.status) = 'absent' THEN 1 ELSE 0 END) as absent_marks,
             SUM(CASE WHEN LOWER(sa.status) = 'od' THEN 1 ELSE 0 END) as od_marks
      FROM student_attendance sa
      JOIN students st ON sa.studentId = st.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (collegeId && collegeId !== "all") {
      query += " AND st.college_id = ?";
      params.push(collegeId);
    } else if (kamId) {
      const kamColleges = await db.all("SELECT id FROM colleges WHERE kam_id = ?", kamId);
      const kamCollegeIds = kamColleges.map((c: any) => c.id);
      if (kamCollegeIds.length === 0) {
        return NextResponse.json({ success: true, trendData: [], summary: { overallAvgPct: 0, highestDate: null, lowestDate: null } });
      }
      const inClause = `(${kamCollegeIds.map(() => "?").join(",")})`;
      query += ` AND st.college_id IN ${inClause}`;
      params.push(...kamCollegeIds);
    }
    if (department && department !== "all") {
      query += " AND (st.department = ? OR st.department LIKE ?)";
      params.push(department, `%${department}%`);
    }
    if (classGroup && classGroup !== "all") {
      query += " AND (st.classGroup = ? OR st.classGroup LIKE ?)";
      params.push(classGroup, `%${classGroup}%`);
    }
    if (startDate) {
      query += " AND sa.dateStr >= ?";
      params.push(startDate);
    } else {
      query += " AND sa.dateStr >= date('now', '-60 days')";
    }
    if (endDate) {
      query += " AND sa.dateStr <= ?";
      params.push(endDate);
    }

    query += " GROUP BY sa.dateStr ORDER BY sa.dateStr ASC";

    const rows = await db.all(query, ...params);

    // Compute trend points with moving average
    const trendData = rows.map((r: any) => {
      const total = Number(r.total_marks || 0);
      const present = Number(r.present_marks || 0);
      const pct = total > 0 ? Math.round((present / total) * 1000) / 10 : 0;
      return {
        dateStr: r.dateStr,
        totalMarks: total,
        presentMarks: present,
        absentMarks: Number(r.absent_marks || 0),
        odMarks: Number(r.od_marks || 0),
        attendancePct: pct
      };
    });

    // Summary statistics
    const totalMarks = trendData.reduce((a, b) => a + b.totalMarks, 0);
    const presentMarks = trendData.reduce((a, b) => a + b.presentMarks, 0);
    const avgPct = totalMarks > 0 ? Math.round((presentMarks / totalMarks) * 1000) / 10 : 0;

    return NextResponse.json({
      success: true,
      summary: {
        totalDays: trendData.length,
        avgAttendance: avgPct,
        highestDay: trendData.reduce((max, cur) => cur.attendancePct > (max?.attendancePct || 0) ? cur : max, trendData[0] || null),
        lowestDay: trendData.reduce((min, cur) => cur.attendancePct < (min?.attendancePct || 100) ? cur : min, trendData[0] || null)
      },
      trend: trendData
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
