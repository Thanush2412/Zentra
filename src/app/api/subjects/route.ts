import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function POST(request: Request) {
  try {
    const db = await getDb();
    const body = await request.json();
    const { department, semester, name, type, college_id, year, weekly_hours, subject_group, shift } = body;

    if (!department || !semester || !name || !type) {
      return NextResponse.json({ success: false, message: "Missing required fields" }, { status: 400 });
    }

    let calculatedYear = year;

    if (!calculatedYear) {
      calculatedYear = "Year 1";
      if (semester.includes("3") || semester.includes("4")) calculatedYear = "Year 2";
      else if (semester.includes("5") || semester.includes("6")) calculatedYear = "Year 3";
      else if (semester.includes("7") || semester.includes("8")) calculatedYear = "Year 4";
    }

    const countRow = await db.get("SELECT COUNT(*) as count FROM subjects");
    const newId = `sub_${(countRow?.count || 0) + 1}_${Date.now()}`;

    const weeklyHoursVal = parseInt(weekly_hours, 10) || 4;
    const shiftVal = shift || "general";

    await db.run(
      `INSERT INTO subjects (id, department, semester, name, type, college_id, year, weekly_hours, subject_group, shift) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      newId, department, semester, name, type, college_id || null, calculatedYear, weeklyHoursVal, subject_group || "General", shiftVal
    );

    return NextResponse.json({ success: true, message: "Subject created successfully." });
  } catch (error: any) {
    console.error("API POST Subjects error:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const db = await getDb();
    const body = await request.json();
    const { id, department, semester, name, type, college_id, year, weekly_hours, subject_group, shift } = body;

    if (!id || !department || !semester || !name || !type) {
      return NextResponse.json({ success: false, message: "Missing required fields" }, { status: 400 });
    }

    let calculatedYear = year;

    if (!calculatedYear) {
      calculatedYear = "Year 1";
      if (semester.includes("3") || semester.includes("4")) calculatedYear = "Year 2";
      else if (semester.includes("5") || semester.includes("6")) calculatedYear = "Year 3";
      else if (semester.includes("7") || semester.includes("8")) calculatedYear = "Year 4";
    }

    const weeklyHoursVal = parseInt(weekly_hours, 10) || 4;
    const shiftVal = shift || "general";

    await db.run(
      `UPDATE subjects SET department = ?, semester = ?, name = ?, type = ?, college_id = ?, year = ?, weekly_hours = ?, subject_group = ?, shift = ? WHERE id = ?`,
      department, semester, name, type, college_id || null, calculatedYear, weeklyHoursVal, subject_group || "General", shiftVal, id
    );

    return NextResponse.json({ success: true, message: "Subject updated successfully." });
  } catch (error: any) {
    console.error("API PUT Subjects error:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const db = await getDb();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ success: false, message: "Missing id" }, { status: 400 });
    }

    await db.run("BEGIN TRANSACTION;");

    try {
      const subject = await db.get("SELECT name, department FROM subjects WHERE id = ?", id);
      if (subject) {
        const slotsList = await db.all(
          "SELECT id FROM slots WHERE LOWER(course) = LOWER(?) AND (LOWER(department) = LOWER(?) OR department IS NULL OR department = '')",
          subject.name, subject.department
        );
        const slotIds = slotsList.map(s => s.id);

        if (slotIds.length > 0) {
          const placeholders = slotIds.map(() => "?").join(",");
          await db.run(`DELETE FROM student_attendance WHERE slotId IN (${placeholders})`, slotIds);
          await db.run(`DELETE FROM handover_requests WHERE slotId IN (${placeholders})`, slotIds);
          await db.run(`DELETE FROM approved_handovers WHERE slotId IN (${placeholders})`, slotIds);
          await db.run(`DELETE FROM slots WHERE id IN (${placeholders})`, slotIds);
        }
      }

      await db.run(`DELETE FROM subjects WHERE id = ?`, id);

      await db.run("COMMIT;");
      return NextResponse.json({ success: true, message: "Subject and all associated slots deleted successfully." });
    } catch (txError) {
      try { await db.run("ROLLBACK;"); } catch (_) {}
      throw txError;
    }
  } catch (error: any) {
    console.error("API DELETE Subjects error:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
