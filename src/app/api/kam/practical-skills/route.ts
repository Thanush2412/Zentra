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

    let colleges: any[] = [];
    if (collegeId && collegeId !== "all") {
      colleges = await db.all("SELECT * FROM colleges WHERE id = ?", collegeId);
    } else if (kamId) {
      // Strictly scope to this KAM's assigned colleges — no NULL leak
      colleges = await db.all("SELECT * FROM colleges WHERE kam_id = ? ORDER BY name ASC", kamId);
    } else {
      colleges = await db.all("SELECT * FROM colleges ORDER BY name ASC");
    }

    const collegeIds = colleges.map(c => c.id);
    const inClause = collegeIds.length > 0 ? `(${collegeIds.map(() => "?").join(",")})` : "(NULL)";

    const [weeklyTasks, studentTrackerRows, mentorsList, subjectsList] = await Promise.all([
      collegeIds.length > 0
        ? db.all(`SELECT * FROM weekly_tasks WHERE college_id IN ${inClause} ORDER BY week_number ASC`, ...collegeIds).catch(() => [])
        : Promise.resolve([]),
      collegeIds.length > 0
        ? db.all(`
          SELECT st.*, s.name as student_name, s.college_id, s.department, s.roll_number
          FROM student_tracker st
          JOIN students s ON st.student_id = s.id
          WHERE s.college_id IN ${inClause}
          ORDER BY st.updated_at DESC
        `, ...collegeIds).catch(() => [])
        : Promise.resolve([]),
      collegeIds.length > 0
        ? db.all(`SELECT * FROM mentors WHERE college_id IN ${inClause}`, ...collegeIds).catch(() => [])
        : Promise.resolve([]),
      collegeIds.length > 0
        ? db.all(`SELECT * FROM subjects WHERE college_id IN ${inClause}`, ...collegeIds).catch(() => [])
        : Promise.resolve([])
    ]);

    const totalWeeklyTasks = weeklyTasks.length;
    const filteredTracker = (studentTrackerRows || []);

    const totalSubmissions = filteredTracker.length;
    const totalVerified = filteredTracker.filter((r: any) => r.marks !== null && r.marks > 0).length;
    const totalRework = filteredTracker.filter((r: any) => r.viva_assessment?.toLowerCase().includes("rework") || (r.marks !== null && r.marks < 40)).length;
    const totalPending = Math.max(0, totalSubmissions - totalVerified - totalRework);

    const completionRate = totalSubmissions > 0
      ? Math.round((totalVerified / totalSubmissions) * 1000) / 10
      : 0;

    // Mentor Grading Turnaround & Backlog
    const mentorBacklogMap = new Map<string, any>();
    (mentorsList || []).forEach((m: any) => {
      mentorBacklogMap.set(m.id, {
        mentorId: m.id,
        mentorName: m.name,
        department: m.department || "General",
        collegeId: m.college_id,
        tasksCreated: weeklyTasks.filter((t: any) => t.mentor_id === m.id).length,
        assignedSubmissions: 0,
        verifiedSubmissions: 0,
        pendingBacklog: 0,
        avgGradeScore: 0
      });
    });

    filteredTracker.forEach((r: any) => {
      const gradedById = r.graded_by || r.mentor_id;
      if (gradedById && mentorBacklogMap.has(gradedById)) {
        const m = mentorBacklogMap.get(gradedById);
        m.assignedSubmissions += 1;
        if (r.marks !== null) m.verifiedSubmissions += 1;
        else m.pendingBacklog += 1;
      }
    });

    const mentorBacklogs = Array.from(mentorBacklogMap.values())
      .map(m => ({
        ...m,
        turnaroundStatus: m.pendingBacklog > 15 ? "Critical Backlog" : m.pendingBacklog > 5 ? "Moderate Delay" : "Optimal"
      }))
      .sort((a, b) => b.pendingBacklog - a.pendingBacklog);

    // Subject-wise Breakdown dynamically generated from active subjects & submissions
    const subjectMap = new Map<string, { subject: string; totalTasks: number; submissions: number; verified: number }>();
    (subjectsList || []).forEach((sub: any) => {
      const name = sub.name || "Subject";
      if (!subjectMap.has(name)) {
        const tasksCount = weeklyTasks.filter((t: any) => t.subject === name || t.course === name).length;
        const subsCount = filteredTracker.filter((st: any) => st.subject === name || st.course === name).length;
        const verCount = filteredTracker.filter((st: any) => (st.subject === name || st.course === name) && st.marks > 0).length;
        subjectMap.set(name, {
          subject: name,
          totalTasks: tasksCount,
          submissions: subsCount,
          verified: verCount
        });
      }
    });

    const subjectProgress = Array.from(subjectMap.values()).map(s => {
      const pct = s.submissions > 0 ? Math.round((s.verified / s.submissions) * 1000) / 10 : 0;
      return {
        ...s,
        completionPct: pct
      };
    });

    return NextResponse.json({
      success: true,
      summary: {
        totalWeeklyTasks,
        totalSubmissions,
        totalVerified,
        totalRework,
        totalPending,
        completionRate,
        verificationThroughput: totalSubmissions > 0 ? Math.round((totalVerified / totalSubmissions) * 100) : 0
      },
      mentorBacklogs: mentorBacklogs.slice(0, 15),
      subjectProgress
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
