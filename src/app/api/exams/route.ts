import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const collegeId = searchParams.get("college_id");
    const department = searchParams.get("department");
    const semester = searchParams.get("semester");
    const dateStr = searchParams.get("dateStr");

    const db = await getDb();
    let query = "SELECT * FROM exam_schedules WHERE 1=1";
    const args: any[] = [];

    if (collegeId) {
      query += " AND (LOWER(college_id) = LOWER(?) OR college_id IS NULL)";
      args.push(collegeId);
    }
    if (department && department !== "all") {
      query += " AND (LOWER(department) = LOWER(?) OR LOWER(department) LIKE ?)";
      args.push(department, `%${department.toLowerCase()}%`);
    }
    if (semester && semester !== "all") {
      query += " AND (LOWER(semester) = LOWER(?) OR LOWER(semester) LIKE ?)";
      args.push(semester, `%${semester.toLowerCase()}%`);
    }
    if (dateStr) {
      query += " AND exam_date = ?";
      args.push(dateStr);
    }

    query += " ORDER BY exam_date ASC, start_time ASC";

    const exams = await db.all(query, args);
    return NextResponse.json({ success: true, exams: exams || [] });
  } catch (error: any) {
    console.error("Error fetching exams:", error);
    return NextResponse.json({ success: false, message: error.message || "Failed to fetch exams" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const db = await getDb();

    // Check if bulk array or single object
    const schedules = Array.isArray(body) ? body : (body.schedules ? body.schedules : [body]);

    if (!schedules || schedules.length === 0) {
      return NextResponse.json({ success: false, message: "No exam data provided" }, { status: 400 });
    }

    const inserted: any[] = [];
    for (const item of schedules) {
      const id = item.id || `exam_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const college_id = item.college_id || "Clg_c";
      const department = item.department || "General";
      const semester = item.semester || "Semester 1";
      const exam_type = (item.exam_type || item.exam_name || "CIA 1").trim();
      const subject_name = item.subject_name || "Subject";
      const subject_code = item.subject_code || null;
      const exam_date = item.exam_date || new Date().toISOString().slice(0, 10);
      const session_time = item.session_time || (item.start_time && item.end_time ? `${item.start_time} - ${item.end_time}` : "10:00 AM - 01:00 PM");
      const start_time = item.start_time || session_time.split("-")[0]?.trim() || "10:00 AM";
      const end_time = item.end_time || session_time.split("-")[1]?.trim() || "01:00 PM";
      const day_order = item.day_order || "Day 1";
      const hall_room = item.hall_room || "Main Examination Hall";
      const max_marks = parseFloat(item.max_marks) || 50;
      const passing_marks = parseFloat(item.passing_marks) || (max_marks * 0.4);
      const created_by = item.created_by || "Campus Manager";
      const status = item.status || "Scheduled";

      await db.run(
        `INSERT INTO exam_schedules (
          id, college_id, department, semester, exam_type, subject_name,
          subject_code, exam_date, session_time, start_time, end_time, day_order,
          hall_room, max_marks, passing_marks, created_by, status, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(id) DO UPDATE SET
          department = excluded.department,
          semester = excluded.semester,
          exam_type = excluded.exam_type,
          subject_name = excluded.subject_name,
          subject_code = excluded.subject_code,
          exam_date = excluded.exam_date,
          session_time = excluded.session_time,
          start_time = excluded.start_time,
          end_time = excluded.end_time,
          day_order = excluded.day_order,
          hall_room = excluded.hall_room,
          max_marks = excluded.max_marks,
          passing_marks = excluded.passing_marks,
          status = excluded.status,
          updated_at = CURRENT_TIMESTAMP`,
        [
          id, college_id, department, semester, exam_type, subject_name,
          subject_code, exam_date, session_time, start_time, end_time, day_order,
          hall_room, max_marks, passing_marks, created_by, status
        ]
      );

      // Auto-sync campus_daily_configs to recognize this date as an active exam day with the specified day_order
      try {
        const configId = `${college_id}_${exam_date}`;
        await db.run(
          `INSERT INTO campus_daily_configs (
            id, college_id, dateStr, day_type, day_order, notes, session_mode, updated_at
          ) VALUES (?, ?, ?, 'exam_day', ?, ?, 'Offline', CURRENT_TIMESTAMP)
          ON CONFLICT(id) DO UPDATE SET
            day_type = 'exam_day',
            day_order = CASE WHEN excluded.day_order IS NOT NULL AND excluded.day_order != '' THEN excluded.day_order ELSE campus_daily_configs.day_order END,
            notes = excluded.notes,
            updated_at = CURRENT_TIMESTAMP
          WHERE campus_daily_configs.day_type != 'holiday'`,
          [configId, college_id, exam_date, day_order, `${exam_type} Examination`]
        );
      } catch (cdcErr) {
        console.warn("Could not auto-sync campus_daily_configs for exam date:", cdcErr);
      }

      inserted.push({ id, exam_type, subject_name, exam_date, session_time, start_time, end_time, day_order, department, semester });
    }

    return NextResponse.json({
      success: true,
      message: `Successfully saved ${inserted.length} exam schedule(s)`,
      inserted
    });
  } catch (error: any) {
    console.error("Error saving exam schedule:", error);
    return NextResponse.json({ success: false, message: error.message || "Failed to save exam schedule" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ success: false, message: "Exam ID is required" }, { status: 400 });
    }

    const db = await getDb();
    await db.run("DELETE FROM exam_schedules WHERE id = ?", [id]);
    await db.run("DELETE FROM student_exam_marks WHERE exam_id = ?", [id]);

    return NextResponse.json({ success: true, message: "Exam schedule and associated marks deleted" });
  } catch (error: any) {
    console.error("Error deleting exam:", error);
    return NextResponse.json({ success: false, message: error.message || "Failed to delete exam" }, { status: 500 });
  }
}
