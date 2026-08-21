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

    // 1. Fetch Student Core Info
    const student = await db.get(`
      SELECT st.*, c.name as college_name
      FROM students st
      LEFT JOIN colleges c ON st.college_id = c.id
      WHERE st.id = ? OR st.roll_number = ? OR st.register_number = ?
    `, id, id, id);

    if (!student) {
      return NextResponse.json({ success: false, message: "Student not found" }, { status: 404 });
    }

    const studentId = student.id;
    const rollNo = student.roll_number || "";
    const regNo = student.register_number || "";

    // 2. Fetch Detailed Attendance Records with Slot & Subject Info (Match by ID, Roll No, or Reg No)
    const validIds = Array.from(new Set([studentId, rollNo, regNo].filter(Boolean)));
    const placeholders = validIds.map(() => "?").join(",");

    const attendanceRecords = await db.all(`
      SELECT sa.id, sa.dateStr, sa.status, sa.markedBy, sa.timestamp,
             s.course as subject, s.time, s.day, s.location, s.shift
      FROM student_attendance sa
      LEFT JOIN slots s ON sa.slotId = s.id
      WHERE sa.studentId IN (${placeholders})
      GROUP BY sa.id
      ORDER BY sa.dateStr ASC, s.time ASC
    `, ...validIds);

    // 3. Subject-Wise Breakdown
    const subjectMap: Record<string, { total: number; present: number; absent: number; od: number }> = {};
    attendanceRecords.forEach((r: any) => {
      const subj = r.subject || "General Class";
      if (!subjectMap[subj]) {
        subjectMap[subj] = { total: 0, present: 0, absent: 0, od: 0 };
      }
      subjectMap[subj].total++;
      const st = (r.status || "").toLowerCase();
      if (st === "present" || st === "od") subjectMap[subj].present++;
      else if (st === "absent") subjectMap[subj].absent++;
      if (st === "od") subjectMap[subj].od++;
    });

    const subjectAnalytics = Object.entries(subjectMap).map(([subject, stats]) => ({
      subject,
      totalPeriods: stats.total,
      presentPeriods: stats.present,
      absentPeriods: stats.absent,
      odPeriods: stats.od,
      attendancePct: stats.total > 0 ? Math.round((stats.present / stats.total) * 100) : 0
    }));

    // 4. Monthly Progression Trend
    const monthMap: Record<string, { total: number; present: number }> = {};
    attendanceRecords.forEach((r: any) => {
      const ym = r.dateStr?.slice(0, 7) || "Unknown";
      if (!monthMap[ym]) monthMap[ym] = { total: 0, present: 0 };
      monthMap[ym].total++;
      if ((r.status || "").toLowerCase() === "present") monthMap[ym].present++;
    });

    const progressTrend = Object.entries(monthMap).sort().map(([month, data]) => ({
      month,
      attendancePct: data.total > 0 ? Math.round((data.present / data.total) * 100) : 0,
      totalMarks: data.total,
      presentMarks: data.present
    }));

    // 5. Activity Timeline (Interviews, Leaves, Tasks, Attendance Highlights)
    const [interviews, leaveRequests, tracker] = await Promise.all([
      db.all("SELECT * FROM student_interviews WHERE student_id = ? ORDER BY created_at DESC LIMIT 10", studentId).catch(() => []),
      db.all("SELECT * FROM leave_requests WHERE studentId = ? ORDER BY timestamp DESC LIMIT 10", studentId).catch(() => []),
      db.all("SELECT * FROM student_tracker WHERE student_id = ? ORDER BY updated_at DESC LIMIT 10", studentId).catch(() => [])
    ]);

    const timeline: Array<{ id: string; date: string; type: string; title: string; desc: string; status?: string }> = [];

    // Add interviews
    (interviews as any[]).forEach(iv => {
      timeline.push({
        id: `iv_${iv.id}`,
        date: iv.created_at?.slice(0, 10) || "2026-08-01",
        type: "interview",
        title: `Interview: ${iv.subject || "Skill Evaluation"}`,
        desc: `Evaluated by ${iv.evaluator_name || "Faculty"}. Score: ${iv.marks || 0}/${iv.total_marks || 100}`,
        status: iv.status || "Cleared"
      });
    });

    // Add leaves
    (leaveRequests as any[]).forEach(lv => {
      timeline.push({
        id: `lv_${lv.id}`,
        date: lv.startDate || lv.timestamp?.slice(0, 10) || "2026-08-01",
        type: "leave",
        title: `Leave Request: ${lv.reason || "Personal"}`,
        desc: `${lv.startDate} to ${lv.endDate || lv.startDate}`,
        status: lv.status || "Approved"
      });
    });

    // Sort timeline descending by date
    timeline.sort((a, b) => b.date.localeCompare(a.date));

    // Summary calculations
    const totalMarks = attendanceRecords.length;
    const presentMarks = attendanceRecords.filter((r: any) => {
      const s = (r.status || "").toLowerCase();
      return s === "present" || s === "od";
    }).length;
    const absentMarks = attendanceRecords.filter((r: any) => (r.status || "").toLowerCase() === "absent").length;
    const odMarks = attendanceRecords.filter((r: any) => (r.status || "").toLowerCase() === "od").length;
    const overallAttendancePct = totalMarks > 0 ? Math.round((presentMarks / totalMarks) * 100) : 0;

    let risk: "HEALTHY" | "AT RISK" | "CRITICAL" = "HEALTHY";
    if (overallAttendancePct < 60) risk = "CRITICAL";
    else if (overallAttendancePct < 75) risk = "AT RISK";

    return NextResponse.json({
      success: true,
      student: {
        id: student.id,
        name: student.name,
        rollNumber: student.roll_number || student.id,
        registerNumber: student.register_number || student.roll_number || student.id,
        email: student.email || "",
        phone: student.phone || "",
        department: student.department || "General",
        classGroup: student.classGroup || "General Batch",
        semester: student.semester || "",
        collegeId: student.college_id,
        collegeName: student.college_name || student.college_id,
        stats: {
          overallAttendancePct,
          totalPeriods: totalMarks,
          presentPeriods: presentMarks,
          absentPeriods: absentMarks,
          odPeriods: odMarks,
          risk,
          interviewsCount: interviews.length,
          tasksCompleted: tracker.length
        }
      },
      subjectAnalytics,
      progressTrend,
      timeline,
      dailyAttendance: attendanceRecords.slice(-60) // recent 60 period marks
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
