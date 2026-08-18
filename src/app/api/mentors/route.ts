// Pin to Mumbai (bom1) — co-located with Turso DB (aws-ap-south-1)
export const preferredRegion = "bom1";
export const maxDuration = 60;

import { NextResponse } from "next/server";
import { getDb, syncMentorSubjectGroups } from "@/lib/db";
import { hashPassword } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    const db = await getDb();
    const { searchParams } = new URL(request.url);
    const group = searchParams.get("group");
    const collegeId = searchParams.get("collegeId");

    if (group) {
      const cleanGroup = group.toLowerCase().trim();
      const countRes = await db.get(
        `SELECT COUNT(*) as count FROM mentors 
         WHERE LOWER(COALESCE(mentor_group, subject_group, department, '')) LIKE ?`,
        [`%${cleanGroup}%`]
      );
      const mentorsInGroup = await db.all(
        `SELECT * FROM mentors 
         WHERE LOWER(COALESCE(mentor_group, subject_group, department, '')) LIKE ?`,
        [`%${cleanGroup}%`]
      );
      return NextResponse.json({ success: true, group, count: countRes?.count || 0, mentors: mentorsInGroup });
    }

    const mentorSql = collegeId ? "SELECT * FROM mentors WHERE college_id = ?" : "SELECT * FROM mentors";
    const mentorParams = collegeId ? [collegeId] : [];
    const mentors = await db.all(mentorSql, ...mentorParams);

    return NextResponse.json({ success: true, mentors });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const db = await getDb();
    const body = await request.json();
    const { id, name, email, department, avatar, subjects, classes, college_id, subject_group, mentor_group } = body;
    const unifiedGroup = (mentor_group || subject_group || department || "").trim() || null;

    if (!id || !name || !email || !avatar) {
      return NextResponse.json({ success: false, message: "Missing required fields" }, { status: 400 });
    }

    const cleanEmail = email.toLowerCase().trim();

    await db.run(
      `INSERT INTO mentors (id, name, email, department, avatar, subjects, classes, college_id, subject_group, mentor_group) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id, name, cleanEmail, unifiedGroup, avatar, subjects || "", classes || "", college_id || null, unifiedGroup, unifiedGroup
    );

    // Clean old credentials associated with this email
    await db.run("DELETE FROM users WHERE LOWER(email) = ?", cleanEmail);

    // Create corresponding entry in centralized users table with hashed default password
    const now = new Date().toISOString();
    const defaultHashed = hashPassword("password123");
    await db.run(
      `INSERT INTO users (id, email, password_hash, role, reference_id, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, cleanEmail, defaultHashed, "mentor", id, "Active", now, now]
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
    const { id, name, email, department, avatar, subjects, classes, college_id, subject_group, mentor_group } = body;
    const unifiedGroup = (mentor_group || subject_group || department || "").trim() || null;

    if (!id || !name || !email || !avatar) {
      return NextResponse.json({ success: false, message: "Missing required fields" }, { status: 400 });
    }

    const cleanEmail = email.toLowerCase().trim();

    await db.run(
      `UPDATE mentors SET name = ?, email = ?, department = ?, avatar = ?, subjects = ?, classes = ?, college_id = ?, subject_group = ?, mentor_group = ? WHERE id = ?`,
      name, cleanEmail, unifiedGroup, avatar, subjects || "", classes || "", college_id || null, unifiedGroup, unifiedGroup, id
    );

    // Clean old credentials associated with this email (excluding current Mentor ID)
    await db.run("DELETE FROM users WHERE LOWER(email) = ? AND reference_id != ?", [cleanEmail, id]);

    // Check existing user to preserve password_hash
    const existingUser = await db.get("SELECT password_hash FROM users WHERE role = 'mentor' AND reference_id = ?", id);
    const passHashToKeep = existingUser?.password_hash || hashPassword("password123");

    // Create or update centralized users table entry
    const now = new Date().toISOString();
    await db.run(
      `INSERT OR REPLACE INTO users (id, email, password_hash, role, reference_id, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, cleanEmail, passHashToKeep, "mentor", id, "Active", now, now]
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
