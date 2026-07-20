import { NextResponse } from "next/server";
import { getDb, syncMentorSubjectGroups } from "@/lib/db";

export async function POST(request: Request) {
  try {
    const db = await getDb();
    const body = await request.json();
    const { id, name, email, department, avatar, subjects, classes, shift, college_id, subject_group } = body;

    if (!id || !name || !email || !department || !avatar) {
      return NextResponse.json({ success: false, message: "Missing required fields" }, { status: 400 });
    }

    const cleanEmail = email.toLowerCase().trim();

    await db.run(
      `INSERT INTO mentors (id, name, email, department, avatar, subjects, classes, shift, college_id, subject_group) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id, name, cleanEmail, department, avatar, subjects || "", classes || "", shift || "general", college_id || null, subject_group || null
    );

    // Clean old credentials associated with this email
    await db.run("DELETE FROM users WHERE LOWER(email) = ?", cleanEmail);

    // Create corresponding entry in centralized users table
    const now = new Date().toISOString();
    await db.run(
      `INSERT INTO users (id, email, password_hash, role, reference_id, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, cleanEmail, "password123", "mentor", id, "Active", now, now]
    );

    await syncMentorSubjectGroups(db);

    return NextResponse.json({ success: true, message: "Mentor created successfully." });
  } catch (error: any) {
    console.error("API POST Mentors error:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const db = await getDb();
    const body = await request.json();
    const { id, name, email, department, avatar, subjects, classes, shift, college_id, subject_group } = body;

    if (!id || !name || !email || !department || !avatar) {
      return NextResponse.json({ success: false, message: "Missing required fields" }, { status: 400 });
    }

    const cleanEmail = email.toLowerCase().trim();

    await db.run(
      `UPDATE mentors SET name = ?, email = ?, department = ?, avatar = ?, subjects = ?, classes = ?, shift = ?, college_id = ?, subject_group = ? WHERE id = ?`,
      name, cleanEmail, department, avatar, subjects || "", classes || "", shift || "general", college_id || null, subject_group || null, id
    );

    // Clean old credentials associated with this email (excluding current Mentor ID)
    await db.run("DELETE FROM users WHERE LOWER(email) = ? AND reference_id != ?", [cleanEmail, id]);

    // Create or update centralized users table entry
    const now = new Date().toISOString();
    await db.run(
      `INSERT OR REPLACE INTO users (id, email, password_hash, role, reference_id, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, cleanEmail, "password123", "mentor", id, "Active", now, now]
    );

    await syncMentorSubjectGroups(db);

    return NextResponse.json({ success: true, message: "Mentor updated successfully." });
  } catch (error: any) {
    console.error("API PUT Mentors error:", error);
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

    // Delete from both users and mentors
    await db.run(`DELETE FROM users WHERE role = 'mentor' AND reference_id = ?`, id);
    await db.run(`DELETE FROM mentors WHERE id = ?`, id);

    return NextResponse.json({ success: true, message: "Mentor deleted successfully." });
  } catch (error: any) {
    console.error("API DELETE Mentors error:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
