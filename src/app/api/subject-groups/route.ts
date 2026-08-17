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
    const { name, description, lead_sme_id, lead_sme_name, subjectIds, mentorIds } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ success: false, message: "Group name is required." }, { status: 400 });
    }

    const cleanName = name.trim();
    const id = "g_" + cleanName.toLowerCase().replace(/[^a-z0-9]/g, "_").replace(/_+/g, "_") + "_" + Math.random().toString(36).substring(2, 6);

    let smeId = lead_sme_id || null;
    let smeName = lead_sme_name || null;

    if (smeId && !smeName) {
      const sme = await db.get("SELECT name FROM sme_users WHERE id = ?", [smeId]);
      if (sme) smeName = sme.name;
    }

    await db.run(
      "INSERT INTO subject_groups (id, name, description, lead_sme_id, lead_sme_name) VALUES (?, ?, ?, ?, ?)",
      [id, cleanName, description || "", smeId, smeName]
    );

    // Sync Head SME status in sme_users table
    try {
      if (smeId) {
        // Clear previous Head SME status for this group name
        await db.run(
          "UPDATE sme_users SET is_head_sme = 0 WHERE head_subject_group = ?",
          [cleanName]
        );
        // Set new Head SME
        await db.run(
          "UPDATE sme_users SET is_head_sme = 1, head_subject_group = ? WHERE id = ?",
          [cleanName, smeId]
        );
      }
    } catch (smeErr) {
      console.warn("sme_users head SME sync notice:", smeErr);
    }

    // Map selected Mentors to this Mentor Group
    if (Array.isArray(mentorIds) && mentorIds.length > 0) {
      const placeholders = mentorIds.map(() => "?").join(",");
      await db.run(
        `UPDATE mentors SET mentor_group = ?, subject_group = ? WHERE id IN (${placeholders})`,
        [cleanName, cleanName, ...mentorIds]
      );
    }

    // Map selected Subjects to this Group
    if (Array.isArray(subjectIds) && subjectIds.length > 0) {
      const placeholders = subjectIds.map(() => "?").join(",");
      await db.run(
        `UPDATE subjects SET mentor_group = ?, subject_group = ? WHERE id IN (${placeholders})`,
        [cleanName, cleanName, ...subjectIds]
      );
    }

    await syncMentorSubjectGroups(db);

    return NextResponse.json({ success: true, message: "Subject group created successfully.", id });
  } catch (error: any) {
    if (error.message?.includes("UNIQUE constraint failed")) {
      return NextResponse.json({ success: false, message: "A subject group with this name already exists." }, { status: 400 });
    }
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const db = await getDb();
    const body = await request.json();
    const { id, name, description, lead_sme_id, lead_sme_name, subjectIds, mentorIds } = body;

    if (!id || !name || !name.trim()) {
      return NextResponse.json({ success: false, message: "ID and name are required." }, { status: 400 });
    }

    const cleanName = name.trim();

    // Get original name to update references
    const original = await db.get("SELECT name, lead_sme_id FROM subject_groups WHERE id = ?", id);
    if (!original) {
      return NextResponse.json({ success: false, message: "Subject group not found." }, { status: 404 });
    }

    let smeId = lead_sme_id || null;
    let smeName = lead_sme_name || null;

    if (smeId && !smeName) {
      const sme = await db.get("SELECT name FROM sme_users WHERE id = ?", [smeId]);
      if (sme) smeName = sme.name;
    }

    await db.run(
      "UPDATE subject_groups SET name = ?, description = ?, lead_sme_id = ?, lead_sme_name = ? WHERE id = ?",
      [cleanName, description || "", smeId, smeName, id]
    );

    // Sync Head SME status in sme_users table
    try {
      // Reset previous Head SME for this group
      await db.run(
        "UPDATE sme_users SET is_head_sme = 0 WHERE head_subject_group = ? OR head_subject_group = ?",
        [original.name, cleanName]
      );

      if (smeId) {
        await db.run(
          "UPDATE sme_users SET is_head_sme = 1, head_subject_group = ? WHERE id = ?",
          [cleanName, smeId]
        );
      }
    } catch (smeErr) {
      console.warn("sme_users head SME sync notice:", smeErr);
    }

    // Reset mentors currently in original group name to NULL
    await db.run("UPDATE mentors SET mentor_group = NULL, subject_group = NULL WHERE mentor_group = ? OR subject_group = ?", [original.name, original.name]);

    // Reset subjects currently in original group name to NULL
    await db.run("UPDATE subjects SET mentor_group = NULL, subject_group = NULL WHERE mentor_group = ? OR subject_group = ?", [original.name, original.name]);

    // Set selected Mentors to cleanName
    if (Array.isArray(mentorIds) && mentorIds.length > 0) {
      const placeholders = mentorIds.map(() => "?").join(",");
      await db.run(
        `UPDATE mentors SET mentor_group = ?, subject_group = ? WHERE id IN (${placeholders})`,
        [cleanName, cleanName, ...mentorIds]
      );
    }

    // Set selected Subjects to cleanName
    if (Array.isArray(subjectIds) && subjectIds.length > 0) {
      const placeholders = subjectIds.map(() => "?").join(",");
      await db.run(
        `UPDATE subjects SET mentor_group = ?, subject_group = ? WHERE id IN (${placeholders})`,
        [cleanName, cleanName, ...subjectIds]
      );
    }

    await syncMentorSubjectGroups(db);

    return NextResponse.json({ success: true, message: "Subject group updated successfully." });
  } catch (error: any) {
    if (error.message?.includes("UNIQUE constraint failed")) {
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

    const original = await db.get("SELECT name, lead_sme_id FROM subject_groups WHERE id = ?", id);
    if (!original) {
      return NextResponse.json({ success: false, message: "Subject group not found." }, { status: 404 });
    }

    // Delete group
    await db.run("DELETE FROM subject_groups WHERE id = ?", id);

    // Reset Lead SME status in sme_users
    if (original.lead_sme_id) {
      await db.run("UPDATE sme_users SET is_head_sme = 0, head_subject_group = NULL WHERE id = ?", [original.lead_sme_id]);
    }

    // Reset references to NULL
    await db.run("UPDATE mentors SET mentor_group = NULL, subject_group = NULL WHERE mentor_group = ? OR subject_group = ?", [original.name, original.name]);
    await db.run("UPDATE subjects SET mentor_group = NULL, subject_group = NULL WHERE mentor_group = ? OR subject_group = ?", [original.name, original.name]);

    await syncMentorSubjectGroups(db);

    return NextResponse.json({ success: true, message: "Subject group deleted successfully." });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
