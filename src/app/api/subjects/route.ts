export const maxDuration = 60;

import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { requireAuth, Role } from "@/lib/authGuard";
import { ensureMigration } from "@/lib/migrations";
import { generateId } from "@/lib/id";

// Subjects and courses are campus configuration — read and written only by
// admin / CM / KAM dashboards. Mentors and students receive them through the
// role-scoped /api/data payload, never from these routes.
const ACADEMIC_CONFIG_ROLES: Role[] = ["admin", "cm", "kam"];

async function requireAcademicConfigAccess(request: Request) {
  return requireAuth(request, { allowedRoles: ACADEMIC_CONFIG_ROLES });
}

export async function GET(request: Request) {
  try {
    const { errorResponse } = await requireAcademicConfigAccess(request);
    if (errorResponse) return errorResponse;

    const db = await getDb();
    const { searchParams } = new URL(request.url);
    const collegeId = searchParams.get("collegeId") || searchParams.get("college_id");

    const sql = collegeId 
      ? "SELECT * FROM subjects WHERE college_id = ? OR college_id IS NULL ORDER BY department, name LIMIT 5000" 
      : "SELECT * FROM subjects ORDER BY department, name LIMIT 5000";
    const args = collegeId ? [collegeId] : [];

    const subjects = await db.all(sql, ...args);

    return NextResponse.json({ success: true, count: subjects.length, subjects });
  } catch (error: any) {
    console.error("API GET Subjects error:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { errorResponse } = await requireAcademicConfigAccess(request);
    if (errorResponse) return errorResponse;

    const db = await getDb();
    await ensureMigration("schema_alignment_2026_10");
    const body = await request.json();

    // Check if bulk array is provided
    const rawList = Array.isArray(body) ? body : Array.isArray(body.subjects) ? body.subjects : null;

    if (rawList && rawList.length > 0) {
      const countRow = await db.get("SELECT COUNT(*) as count FROM subjects");
      let currentCount = countRow?.count || 0;

      const rows = rawList.map((item: any, i: number) => {
        const { department, semester, name, type, college_id, year, weekly_hours, subject_group, shift } = item;
        if (!department || !semester || !name) return null;

        let calculatedYear = year;
        if (!calculatedYear) {
          calculatedYear = "Year 1";
          if (semester.includes("3") || semester.includes("4")) calculatedYear = "Year 2";
          else if (semester.includes("5") || semester.includes("6")) calculatedYear = "Year 3";
          else if (semester.includes("7") || semester.includes("8")) calculatedYear = "Year 4";
        }

        currentCount++;
        const newId = generateId("sub");
        const weeklyHoursVal = parseInt(weekly_hours, 10) || 4;
        const shiftVal = shift || "general";
        const subjectType = type || "SKILL";

        return {
          id: newId,
          department,
          semester,
          name: name.trim(),
          type: subjectType,
          college_id: college_id || null,
          year: calculatedYear,
          weekly_hours: weeklyHoursVal,
          subject_group: subject_group || "General",
          shift: shiftVal
        };
      }).filter(Boolean) as any[];

      // One transaction: a row that violates a constraint partway through used to
      // leave the earlier rows committed and the rest skipped — a silently
      // half-imported subject list.
      await db.transaction(async (tx) => {
        for (const s of rows) {
          await tx.run(
            `INSERT INTO subjects (id, department, semester, name, type, college_id, year, weekly_hours, subject_group, shift) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            s.id, s.department, s.semester, s.name, s.type, s.college_id, s.year, s.weekly_hours, s.subject_group, s.shift
          );
        }
      });

      return NextResponse.json({
        success: true,
        count: rows.length,
        subjects: rows,
        message: `Successfully created ${rows.length} subjects.`
      });
    }

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
    const newId = generateId("sub");

    const weeklyHoursVal = parseInt(weekly_hours, 10) || 4;
    const shiftVal = shift || "general";

    await db.run(
      `INSERT INTO subjects (id, department, semester, name, type, college_id, year, weekly_hours, subject_group, shift) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      newId, department, semester, name.trim(), type, college_id || null, calculatedYear, weeklyHoursVal, subject_group || "General", shiftVal
    );

    return NextResponse.json({
      success: true,
      message: "Subject created successfully.",
      subject: {
        id: newId,
        department,
        semester,
        name: name.trim(),
        type,
        college_id: college_id || null,
        year: calculatedYear,
        weekly_hours: weeklyHoursVal,
        subject_group: subject_group || "General",
        shift: shiftVal
      }
    });
  } catch (error: any) {
    console.error("API POST Subjects error:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const { errorResponse } = await requireAcademicConfigAccess(request);
    if (errorResponse) return errorResponse;

    const db = await getDb();
    await ensureMigration("schema_alignment_2026_10");
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
    const { errorResponse } = await requireAcademicConfigAccess(request);
    if (errorResponse) return errorResponse;

    const db = await getDb();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ success: false, message: "Missing id" }, { status: 400 });
    }

    // Look up the subject so the slot cascade can be expressed as a subquery.
    // One transaction, and the attendance detach is no longer swallowed: the
    // detach used to fail silently and the following DELETE then died on the
    // foreign key, reporting a mysterious failure with attendance still referencing
    // slots that were about to disappear.
    const subject = await db.get("SELECT name, department FROM subjects WHERE id = ?", id);
    const subjectSlotIds =
      `SELECT s.id FROM slots s WHERE LOWER(s.course) = LOWER(?) AND (LOWER(s.department) = LOWER(?) OR s.department IS NULL OR s.department = '')`;

    await db.transaction(async (tx) => {
      if (subject) {
        await tx.run(`UPDATE student_attendance SET slotId = NULL WHERE slotId IN (${subjectSlotIds})`, subject.name, subject.department);
        await tx.run(`DELETE FROM handover_requests WHERE slotId IN (${subjectSlotIds})`, subject.name, subject.department);
        await tx.run(`DELETE FROM approved_handovers WHERE slotId IN (${subjectSlotIds})`, subject.name, subject.department);
        await tx.run(`DELETE FROM slots WHERE id IN (${subjectSlotIds})`, subject.name, subject.department);
      }
      await tx.run(`DELETE FROM subjects WHERE id = ?`, id);
    });

    return NextResponse.json({ success: true, message: "Subject and all associated slots deleted successfully." });
  } catch (error: any) {
    console.error("API DELETE Subjects error:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
