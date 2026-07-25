import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET() {
  try {
    const db = await getDb();
    const row = await db.get("SELECT * FROM campus_drafts WHERE id = 'active_draft'");
    if (!row || !row.data) {
      return NextResponse.json({ success: true, draft: null });
    }
    let parsedData = null;
    try {
      parsedData = JSON.parse(row.data);
    } catch (_) {
      parsedData = null;
    }
    return NextResponse.json({
      success: true,
      draft: parsedData,
      savedAt: row.saved_at
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const db = await getDb();
    const body = await request.json();
    const { data, savedAt } = body;
    if (!data) {
      return NextResponse.json({ success: false, message: "Draft data required" }, { status: 400 });
    }
    const dataStr = typeof data === "string" ? data : JSON.stringify(data);
    const timeStr = savedAt || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    await db.run(
      `INSERT INTO campus_drafts (id, data, saved_at, updated_at)
       VALUES ('active_draft', ?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(id) DO UPDATE SET data = excluded.data, saved_at = excluded.saved_at, updated_at = CURRENT_TIMESTAMP`,
      dataStr, timeStr
    );
    return NextResponse.json({ success: true, message: "Draft saved to database", savedAt: timeStr });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const db = await getDb();
    await db.run("DELETE FROM campus_drafts WHERE id = 'active_draft'");
    return NextResponse.json({ success: true, message: "Draft cleared from database" });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
