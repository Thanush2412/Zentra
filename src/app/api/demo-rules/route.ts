import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET() {
  try {
    const db = await getDb();
    const rules = await db.all("SELECT * FROM demo_rules ORDER BY created_at DESC");
    return NextResponse.json({ success: true, rules });
  } catch (error: any) {
    console.error("API GET Demo Rules error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const db = await getDb();
    const body = await request.json();
    const { action } = body;

    if (action === "create") {
      const { subject, week, target } = body;
      if (!subject || week === undefined || target === undefined) {
        return NextResponse.json({ success: false, message: "Missing required fields" }, { status: 400 });
      }

      // Check if duplicate rule exists
      const existing = await db.get("SELECT id FROM demo_rules WHERE subject = ? AND week = ?", [subject, week]);
      if (existing) {
        return NextResponse.json({ success: false, message: "A rule for this subject group and week already exists." });
      }

      const id = "rule_" + Date.now() + "_" + Math.random().toString(36).substring(2, 9);
      await db.run(
        "INSERT INTO demo_rules (id, subject, week, target, created_at) VALUES (?, ?, ?, ?, ?)",
        [id, subject, week, target, new Date().toISOString()]
      );

      return NextResponse.json({ success: true, message: "Rule added successfully!" });

    } else if (action === "delete") {
      const { id } = body;
      if (!id) {
        return NextResponse.json({ success: false, message: "Missing rule ID" }, { status: 400 });
      }

      await db.run("DELETE FROM demo_rules WHERE id = ?", [id]);
      return NextResponse.json({ success: true, message: "Rule deleted successfully." });
    }

    return NextResponse.json({ success: false, message: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    console.error("API POST Demo Rules error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
