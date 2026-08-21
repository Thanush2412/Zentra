export const preferredRegion = "bom1";
export const maxDuration = 30;

import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const db = await getDb();
    const { id } = await params;

    // 1. Fetch Mentor Details with College Name
    const mentor = await db.get(`
      SELECT m.*, c.name as college_name
      FROM mentors m
      LEFT JOIN colleges c ON m.college_id = c.id
      WHERE m.id = ? OR m.email = ?
    `, id, id);

    if (!mentor) {
      return NextResponse.json({ success: false, message: "Faculty member not found" }, { status: 404 });
    }

    const mentorId = mentor.id;
    const mentorName = mentor.name;

    // 2. Fetch Weekly Assigned Slots & Schedule
    const slots = await db.all(`
      SELECT s.*, c.name as college_name
      FROM slots s
      LEFT JOIN colleges c ON s.college_id = c.id
      WHERE s.mentorId = ?
      ORDER BY 
        CASE s.day
          WHEN 'Monday' THEN 1
          WHEN 'Tuesday' THEN 2
          WHEN 'Wednesday' THEN 3
          WHEN 'Thursday' THEN 4
          WHEN 'Friday' THEN 5
          WHEN 'Saturday' THEN 6
          ELSE 7
        END, s.time ASC
    `, mentorId);

    // 3. Fetch SME Demo Evaluation Records
    const demoSessions = await db.all(`
      SELECT ds.*, su.name as sme_name
      FROM demo_sessions ds
      LEFT JOIN sme_users su ON ds.sme_id = su.id
      WHERE ds.mentor_id = ?
      ORDER BY ds.dateStr DESC, ds.created_at DESC
    `, mentorId).catch(() => []);

    // 4. Fetch Handover & Substitution Requests (Sent & Received)
    const [handoversSent, handoversReceived] = await Promise.all([
      db.all(`
        SELECT hr.*, tm.name as target_mentor_name, c.name as college_name
        FROM handover_requests hr
        LEFT JOIN mentors tm ON hr.targetMentorId = tm.id
        LEFT JOIN colleges c ON hr.college_id = c.id
        WHERE hr.requestorId = ?
        ORDER BY hr.dateStr DESC LIMIT 15
      `, mentorId).catch(() => []),
      db.all(`
        SELECT hr.*, rm.name as requestor_mentor_name, c.name as college_name
        FROM handover_requests hr
        LEFT JOIN mentors rm ON hr.requestorId = rm.id
        LEFT JOIN colleges c ON hr.college_id = c.id
        WHERE hr.targetMentorId = ?
        ORDER BY hr.dateStr DESC LIMIT 15
      `, mentorId).catch(() => [])
    ]);

    // 5. Fetch Total Marked Attendance Sessions by this Mentor
    const attendanceMarked = await db.all(`
      SELECT dateStr, slotId, COUNT(id) as students_marked,
             SUM(CASE WHEN LOWER(status) = 'present' OR LOWER(status) = 'od' THEN 1 ELSE 0 END) as present_count
      FROM student_attendance
      WHERE markedBy = ? OR markedBy = ?
      GROUP BY dateStr, slotId
      ORDER BY dateStr DESC LIMIT 50
    `, mentorName, mentorId).catch(() => []);

    // 6. Calculate Workload Metrics
    const totalWeeklyHours = slots.length;
    const targetCapacity = 20; // 20 hours standard full-time capacity
    const capacityPct = Math.round((totalWeeklyHours / targetCapacity) * 100);
    
    let workloadStatus: "Optimal" | "Underload" | "Overload" = "Optimal";
    if (totalWeeklyHours > 22) workloadStatus = "Overload";
    else if (totalWeeklyHours < 14) workloadStatus = "Underload";

    // Group slots by course
    const courseMap: Record<string, { totalSlots: number; classGroups: Set<string>; days: Set<string> }> = {};
    slots.forEach((s: any) => {
      const cName = s.course || "General Subject";
      if (!courseMap[cName]) {
        courseMap[cName] = { totalSlots: 0, classGroups: new Set(), days: new Set() };
      }
      courseMap[cName].totalSlots++;
      if (s.classGroup) courseMap[cName].classGroups.add(s.classGroup);
      if (s.day) courseMap[cName].days.add(s.day);
    });

    const coursesHandled = Object.entries(courseMap).map(([course, data]) => ({
      course,
      weeklyHours: data.totalSlots,
      classGroups: Array.from(data.classGroups),
      days: Array.from(data.days)
    }));

    return NextResponse.json({
      success: true,
      mentor: {
        id: mentor.id,
        name: mentor.name,
        email: mentor.email,
        department: mentor.department || "General",
        subjects: mentor.subjects || "",
        classes: mentor.classes || "",
        mentorGroup: mentor.mentor_group || "General Faculty",
        collegeId: mentor.college_id,
        collegeName: mentor.college_name || "Institution",
        stats: {
          totalWeeklyHours,
          targetCapacity,
          capacityPct,
          workloadStatus,
          uniqueCoursesCount: coursesHandled.length,
          totalMarkedSessions: attendanceMarked.length,
          demoCertificationsCount: demoSessions.filter((d: any) => d.status === "completed" || d.status === "approved").length,
          totalHandoversSent: handoversSent.length,
          totalHandoversReceived: handoversReceived.length
        }
      },
      slots,
      coursesHandled,
      demoSessions,
      handoversSent,
      handoversReceived,
      recentMarkedSessions: attendanceMarked.slice(0, 20)
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
