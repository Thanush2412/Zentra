import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

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
