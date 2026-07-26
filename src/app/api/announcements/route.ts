import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET(request: Request) {
  try {
    const db = await getDb();
    const { searchParams } = new URL(request.url);
    const collegeId = searchParams.get("college_id");
    const targetRole = searchParams.get("target_role");

    let query = "SELECT * FROM announcements WHERE 1=1";
    const params: any[] = [];

    if (collegeId) {
      query += " AND (college_id = ? OR college_id IS NULL)";
      params.push(collegeId);
    }

    if (targetRole) {
      query += " AND (target_role = ? OR target_role = 'All' OR target_role IS NULL)";
      params.push(targetRole);
    }

    query += " ORDER BY created_at DESC";

    const announcements = await db.all(query, params);
    return NextResponse.json({ success: true, announcements });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const db = await getDb();
    const body = await request.json();
    const { title, description, created_by, target_role, college_id } = body;

    if (!title) {
      return NextResponse.json({ success: false, message: "Title is required" }, { status: 400 });
    }

    const newId = `ann_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const nowStr = new Date().toISOString();

    await db.run(
      `INSERT INTO announcements (id, title, description, created_by, target_role, college_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [newId, title, description || null, created_by || "Admin", target_role || "All", college_id || null, nowStr]
    );

    return NextResponse.json({ success: true, message: "Announcement created successfully." });
  } catch (error: any) {
    console.error("API POST Announcements error:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const db = await getDb();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ success: false, message: "ID is required" }, { status: 400 });
    }

    await db.run("DELETE FROM announcements WHERE id = ?", [id]);

    return NextResponse.json({ success: true, message: "Announcement deleted successfully." });
  } catch (error: any) {
    console.error("API DELETE Announcements error:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
