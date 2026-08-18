// Pin to Mumbai (bom1) — co-located with Turso DB (aws-ap-south-1)
export const preferredRegion = "bom1";
export const maxDuration = 60;

import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET() {
  try {
    const db = await getDb();
    const reports = await db.all("SELECT * FROM feedback_reports ORDER BY created_at DESC");
    return NextResponse.json({ success: true, reports });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const db = await getDb();
    const body = await request.json();
    const { userId, userRole, type, title, description } = body;

    if (!type || !title || !description) {
      return NextResponse.json({ success: false, message: "Type, title, and description are required." }, { status: 400 });
    }

    const reportId = "fb_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7);
    const nowStr = new Date().toISOString();

    await db.run(
      `INSERT INTO feedback_reports (id, user_id, user_role, type, title, description, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)`,
      [reportId, userId || "anonymous", userRole || "user", type, title, description, nowStr]
    );

    return NextResponse.json({ success: true, message: "Feedback submitted successfully!", reportId });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const db = await getDb();
    const body = await request.json();
    const { id, status } = body;

    if (!id || !status) {
      return NextResponse.json({ success: false, message: "Report id and status required" }, { status: 400 });
    }

    await db.run("UPDATE feedback_reports SET status = ? WHERE id = ?", [status, id]);
    return NextResponse.json({ success: true, message: "Feedback status updated" });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
