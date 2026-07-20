import { NextResponse } from "next/server";
import { getDb, syncMentorSubjectGroups } from "@/lib/db";

export async function GET() {
  try {
    const db = await getDb();
    const groups = await db.all("SELECT * FROM subject_groups ORDER BY name ASC");
    return NextResponse.json({ success: true, groups });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const db = await getDb();
    const body = await request.json();
    const { name, description, subjectIds } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ success: false, message: "Group name is required." }, { status: 400 });
    }

    const cleanName = name.trim();
    const id = "g_" + cleanName.toLowerCase().replace(/[^a-z0-9]/g, "_").replace(/_+/g, "_") + "_" + Math.random().toString(36).substring(2, 6);

    await db.run(
      "INSERT INTO subject_groups (id, name, description) VALUES (?, ?, ?)",
      [id, cleanName, description || ""]
    );

    if (Array.isArray(subjectIds) && subjectIds.length > 0) {
      const placeholders = subjectIds.map(() => "?").join(",");
      await db.run(
        `UPDATE subjects SET subject_group = ? WHERE id IN (${placeholders})`,
        [cleanName, ...subjectIds]
      );
    }

    await syncMentorSubjectGroups(db);

    return NextResponse.json({ success: true, message: "Subject group created successfully.", id });
  } catch (error: any) {
    if (error.message.includes("UNIQUE constraint failed")) {
      return NextResponse.json({ success: false, message: "A subject group with this name already exists." }, { status: 400 });
    }
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const db = await getDb();
    const body = await request.json();
    const { id, name, description, subjectIds } = body;

    if (!id || !name || !name.trim()) {
      return NextResponse.json({ success: false, message: "ID and name are required." }, { status: 400 });
    }

    const cleanName = name.trim();

    // Get original name to update references
    const original = await db.get("SELECT name FROM subject_groups WHERE id = ?", id);
    if (!original) {
      return NextResponse.json({ success: false, message: "Subject group not found." }, { status: 404 });
    }

    await db.run(
      "UPDATE subject_groups SET name = ?, description = ? WHERE id = ?",
      [cleanName, description || "", id]
    );

    // Reset subjects currently in original group name to NULL
    await db.run("UPDATE subjects SET subject_group = NULL WHERE subject_group = ?", original.name);

    // Set selected ones to the new name
    if (Array.isArray(subjectIds) && subjectIds.length > 0) {
      const placeholders = subjectIds.map(() => "?").join(",");
      await db.run(
        `UPDATE subjects SET subject_group = ? WHERE id IN (${placeholders})`,
        [cleanName, ...subjectIds]
      );
    }

    if (original.name !== cleanName) {
      // Update mentor references
      await db.run("UPDATE mentors SET subject_group = ? WHERE subject_group = ?", [cleanName, original.name]);
    }

    await syncMentorSubjectGroups(db);

    return NextResponse.json({ success: true, message: "Subject group updated successfully." });
  } catch (error: any) {
    if (error.message.includes("UNIQUE constraint failed")) {
      return NextResponse.json({ success: false, message: "A subject group with this name already exists." }, { status: 400 });
    }
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const db = await getDb();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ success: false, message: "Group ID is required." }, { status: 400 });
    }

    const original = await db.get("SELECT name FROM subject_groups WHERE id = ?", id);
    if (!original) {
      return NextResponse.json({ success: false, message: "Subject group not found." }, { status: 404 });
    }

    // Delete group
    await db.run("DELETE FROM subject_groups WHERE id = ?", id);

    // Reset references to NULL
    await db.run("UPDATE mentors SET subject_group = NULL WHERE subject_group = ?", original.name);
    await db.run("UPDATE subjects SET subject_group = NULL WHERE subject_group = ?", original.name);

    await syncMentorSubjectGroups(db);

    return NextResponse.json({ success: true, message: "Subject group deleted successfully." });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
