import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

// GET /api/class-teachers?college_id=...
export async function GET(request: Request) {
  try {
    const db = await getDb();
    const { searchParams } = new URL(request.url);
    const collegeId = searchParams.get("college_id");

    if (!collegeId) {
      return NextResponse.json({ success: false, message: "college_id is required" }, { status: 400 });
    }

    const assignments = await db.all(
      `SELECT cma.*, m.name as mentor_name, m.email as mentor_email, m.department as mentor_department
       FROM class_mentor_assignments cma
       JOIN mentors m ON cma.mentor_id = m.id
       WHERE cma.college_id = ?
       ORDER BY cma.year ASC, cma.classGroup ASC`,
      [collegeId]
    );

    return NextResponse.json({ success: true, assignments });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST /api/class-teachers (Assign or replace a Class Teacher for Year/ClassGroup)
export async function POST(request: Request) {
  try {
    const db = await getDb();
    const body = await request.json();
    const { college_id, year, department, classGroup, mentor_id } = body;

    if (!college_id || !year || !classGroup || !mentor_id) {
      return NextResponse.json({ success: false, message: "Missing required fields" }, { status: 400 });
    }

    const mentor = await db.get("SELECT name, email FROM mentors WHERE id = ?", [mentor_id]);
    if (!mentor) {
      return NextResponse.json({ success: false, message: "Selected mentor not found" }, { status: 404 });
    }

    const id = `cma_${college_id}_${year.replace(/\s+/g, "")}_${classGroup.replace(/\s+/g, "")}`;
    const nowIso = new Date().toISOString();

    await db.run(
      `INSERT OR REPLACE INTO class_mentor_assignments (
        id, college_id, year, department, classGroup, mentor_id, mentor_name, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id,
      college_id,
      year,
      department || "General",
      classGroup,
      mentor_id,
      mentor.name,
      nowIso,
      nowIso
    );

    return NextResponse.json({
      success: true,
      message: `Assigned ${mentor.name} as Class Teacher for ${year} (${classGroup})`
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// DELETE /api/class-teachers?id=...
export async function DELETE(request: Request) {
  try {
    const db = await getDb();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ success: false, message: "Assignment ID is required" }, { status: 400 });
    }

    await db.run("DELETE FROM class_mentor_assignments WHERE id = ?", [id]);

    return NextResponse.json({ success: true, message: "Class Teacher assignment removed successfully" });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
