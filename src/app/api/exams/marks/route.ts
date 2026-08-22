import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const examId = searchParams.get("exam_id");
    const studentId = searchParams.get("student_id");
    const collegeId = searchParams.get("college_id");

    const db = await getDb();

    if (examId) {
      // Fetch exam details first
      const exam = await db.get("SELECT * FROM exam_schedules WHERE id = ?", [examId]);
      if (!exam) {
        return NextResponse.json({ success: false, message: "Exam not found" }, { status: 404 });
      }

      // Fetch students belonging to the exam's department & college
      const students = await db.all(
        `SELECT id, name, roll_number, register_number, email, classGroup, department 
         FROM students 
         WHERE (LOWER(college_id) = LOWER(?) OR college_id IS NULL)
           AND (LOWER(department) LIKE LOWER(?) OR LOWER(classGroup) LIKE LOWER(?))
         ORDER BY name ASC`,
        [exam.college_id, `%${exam.department}%`, `%${exam.department}%`]
      );

      // Fetch existing marks
      const marksRows = await db.all("SELECT * FROM student_exam_marks WHERE exam_id = ?", [examId]);
      const marksMap = new Map();
      marksRows.forEach((m: any) => marksMap.set(m.student_id, m));

      const roster = students.map((st: any) => {
        const mark = marksMap.get(st.id);
        return {
          student_id: st.id,
          student_name: st.name,
          roll_number: st.roll_number || st.register_number || st.id,
          classGroup: st.classGroup,
          marks_obtained: mark ? mark.marks_obtained : null,
          max_marks: exam.max_marks || 50,
          is_absent: mark ? Boolean(mark.is_absent) : false,
          grade: mark ? mark.grade : null,
          remarks: mark ? mark.remarks : "",
        };
      });

      return NextResponse.json({ success: true, exam, roster });
    }

    if (studentId) {
      // Fetch student's marks with exam details
      const studentMarks = await db.all(
        `SELECT sem.*, es.exam_type, es.subject_name, es.subject_code, es.exam_date, es.session_time, es.max_marks, es.passing_marks, es.hall_room, es.department, es.semester
         FROM student_exam_marks sem
         JOIN exam_schedules es ON sem.exam_id = es.id
         WHERE sem.student_id = ?
         ORDER BY es.exam_date DESC`,
        [studentId]
      );
      return NextResponse.json({ success: true, marks: studentMarks || [] });
    }

    // General list
    const allMarks = await db.all("SELECT * FROM student_exam_marks LIMIT 200");
    return NextResponse.json({ success: true, marks: allMarks });
  } catch (error: any) {
    console.error("Error fetching marks:", error);
    return NextResponse.json({ success: false, message: error.message || "Failed to fetch marks" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { exam_id, marks, evaluated_by } = body;

    if (!exam_id || !marks || !Array.isArray(marks)) {
      return NextResponse.json({ success: false, message: "Invalid payload. exam_id and marks array required" }, { status: 400 });
    }

    const db = await getDb();
    const exam = await db.get("SELECT * FROM exam_schedules WHERE id = ?", [exam_id]);
    if (!exam) {
      return NextResponse.json({ success: false, message: "Exam not found" }, { status: 404 });
    }

    const maxMarks = exam.max_marks || 50;
    const passingMarks = exam.passing_marks || (maxMarks * 0.4);

    for (const entry of marks) {
      const student_id = entry.student_id;
      const is_absent = entry.is_absent ? 1 : 0;
      const marks_obtained = is_absent ? null : (entry.marks_obtained !== null && entry.marks_obtained !== undefined ? parseFloat(entry.marks_obtained) : null);
      const remarks = entry.remarks || "";

      // Auto-compute grade
      let grade = "F";
      if (!is_absent && marks_obtained !== null) {
        const pct = (marks_obtained / maxMarks) * 100;
        if (pct >= 90) grade = "O";
        else if (pct >= 80) grade = "A+";
        else if (pct >= 70) grade = "A";
        else if (pct >= 60) grade = "B+";
        else if (pct >= 50) grade = "B";
        else if (marks_obtained >= passingMarks) grade = "C";
        else grade = "RA / F";
      } else if (is_absent) {
        grade = "AB";
      }

      const id = `mark_${exam_id}_${student_id}`;

      await db.run(
        `INSERT INTO student_exam_marks (
          id, exam_id, student_id, college_id, marks_obtained, max_marks, is_absent, grade, remarks, evaluated_by, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(exam_id, student_id) DO UPDATE SET
          marks_obtained = excluded.marks_obtained,
          max_marks = excluded.max_marks,
          is_absent = excluded.is_absent,
          grade = excluded.grade,
          remarks = excluded.remarks,
          evaluated_by = excluded.evaluated_by,
          updated_at = CURRENT_TIMESTAMP`,
        [id, exam_id, student_id, exam.college_id, marks_obtained, maxMarks, is_absent, grade, remarks, evaluated_by || "Campus Manager"]
      );
    }

    return NextResponse.json({ success: true, message: `Successfully recorded marks for ${marks.length} students` });
  } catch (error: any) {
    console.error("Error recording marks:", error);
    return NextResponse.json({ success: false, message: error.message || "Failed to record marks" }, { status: 500 });
  }
}
