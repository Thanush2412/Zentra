export const preferredRegion = "bom1";
export const maxDuration = 60;

import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET(request: Request) {
  try {
    const db = await getDb();
    const { searchParams } = new URL(request.url);
    const subject = searchParams.get("subject");
    const unit = searchParams.get("unit");
    const classGroup = searchParams.get("classGroup");

    let query = "SELECT * FROM subject_materials WHERE 1=1";
    const params: any[] = [];

    if (subject) {
      query += " AND (LOWER(subject) = LOWER(?) OR LOWER(subject) LIKE LOWER(?))";
      params.push(subject.trim(), `%${subject.trim()}%`);
    }

    if (unit && unit !== "all") {
      const unitNum = parseInt(unit, 10);
      if (!isNaN(unitNum)) {
        query += " AND unit_number = ?";
        params.push(unitNum);
      }
    }

    if (classGroup) {
      query += " AND (class_group IS NULL OR class_group = ? OR class_group = '')";
      params.push(classGroup);
    }

    query += " ORDER BY unit_number ASC, created_at DESC";

    const materials = await db.all(query, ...params);
    return NextResponse.json({ success: true, materials });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const db = await getDb();
    const body = await request.json();
    const {
      id,
      subject,
      unit_number,
      title,
      description,
      material_type,
      file_url,
      external_url,
      file_size,
      uploaded_by,
      mentor_id,
      class_group,
      college_id
    } = body;

    if (!subject || !title || !unit_number) {
      return NextResponse.json(
        { success: false, message: "Subject, title, and unit number are required" },
        { status: 400 }
      );
    }

    const materialId = id || `mat_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    await db.run(
      `INSERT OR REPLACE INTO subject_materials (
        id, subject, unit_number, title, description, material_type, file_url, external_url, file_size, uploaded_by, mentor_id, class_group, college_id, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      [
        materialId,
        subject,
        parseInt(unit_number, 10) || 1,
        title,
        description || null,
        material_type || "notes",
        file_url || null,
        external_url || null,
        file_size || "2.0 MB",
        uploaded_by || "Faculty Mentor",
        mentor_id || null,
        class_group || null,
        college_id || null
      ]
    );

    const saved = await db.get("SELECT * FROM subject_materials WHERE id = ?", [materialId]);
    return NextResponse.json({ success: true, material: saved });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const db = await getDb();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ success: false, message: "Material ID is required" }, { status: 400 });
    }

    await db.run("DELETE FROM subject_materials WHERE id = ?", [id]);
    return NextResponse.json({ success: true, message: "Material deleted successfully" });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
