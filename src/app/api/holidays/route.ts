import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function POST(request: Request) {
  try {
    const db = await getDb();
    const body = await request.json();
    const { title, date, type, college_id } = body;

    if (!title || !date || !type) {
      return NextResponse.json({ success: false, message: "Missing required fields" }, { status: 400 });
    }

    const newId = `hol_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    await db.run(
      `INSERT INTO holidays (id, title, date, type, college_id)
       VALUES (?, ?, ?, ?, ?)`,
      [newId, title, date, type, college_id || null]
    );

    return NextResponse.json({ success: true, message: "Holiday added successfully." });
  } catch (error: any) {
    console.error("API POST Holidays error:", error);
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

    await db.run("DELETE FROM holidays WHERE id = ?", [id]);

    return NextResponse.json({ success: true, message: "Holiday deleted successfully." });
  } catch (error: any) {
    console.error("API DELETE Holidays error:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
