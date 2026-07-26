import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET() {
  try {
    const db = await getDb();
    const issues = await db.all("SELECT * FROM campus_issues ORDER BY escalatedAt DESC");
    return NextResponse.json({ success: true, issues });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const db = await getDb();
    const body = await request.json();
    const { id, title, type, priority, desc, status, collegeId, collegeName, escalated, escalatedAt } = body;

    if (!title || !type || !priority || !collegeId) {
      return NextResponse.json({ success: false, message: "Missing required fields" }, { status: 400 });
    }

    const issueId = id || "i_" + Date.now();
    await db.run(
      `INSERT OR REPLACE INTO campus_issues 
       (id, title, type, priority, desc, status, collegeId, collegeName, escalated, escalatedAt, resolvedAt) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        issueId,
        title,
        type,
        priority,
        desc || null,
        status || "pending",
        collegeId,
        collegeName || null,
        escalated === undefined ? 0 : (escalated ? 1 : 0),
        escalatedAt || null,
        body.resolvedAt || null
      ]
    );

    return NextResponse.json({ success: true, issue: { id: issueId, ...body, status: status || "pending" } });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const db = await getDb();
    const body = await request.json();
    const { id, status, resolvedAt, escalated, escalatedAt } = body;

    if (!id) {
      return NextResponse.json({ success: false, message: "Missing id" }, { status: 400 });
    }

    if (status !== undefined) {
      await db.run(
        "UPDATE campus_issues SET status = ?, resolvedAt = ? WHERE id = ?",
        [status, resolvedAt || null, id]
      );
    }

    if (escalated !== undefined) {
      await db.run(
        "UPDATE campus_issues SET escalated = ?, escalatedAt = ? WHERE id = ?",
        [escalated ? 1 : 0, escalatedAt || null, id]
      );
    }

    return NextResponse.json({ success: true, message: "Issue updated successfully" });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const db = await getDb();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ success: false, message: "ID parameter is required" }, { status: 400 });
    }

    await db.run("DELETE FROM campus_issues WHERE id = ?", [id]);
    return NextResponse.json({ success: true, message: "Issue deleted successfully" });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
