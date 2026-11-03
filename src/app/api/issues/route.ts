export const maxDuration = 60;

import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { requireAuth } from "@/lib/authGuard";
import { generateId } from "@/lib/id";
import { ensureMigration } from "@/lib/migrations";
import { sendMailAsync } from "@/lib/mailAsync";
import { renderEmailShell, BRAND } from "@/lib/mail";

export async function GET(request: Request) {
  try {
    const { errorResponse } = await requireAuth(request);
    if (errorResponse) return errorResponse;
    const db = await getDb();
    await ensureMigration("schema_alignment_2026_10");
    const rows = await db.all("SELECT * FROM campus_issues ORDER BY escalatedAt DESC");
    const issues = rows.map((row: any) => ({ ...row, desc: row.desc_text ?? row.desc ?? "" }));
    return NextResponse.json({ success: true, issues });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { errorResponse } = await requireAuth(request, { allowedRoles: ["cm", "kam", "admin"] });
    if (errorResponse) return errorResponse;
    const db = await getDb();
    await ensureMigration("schema_alignment_2026_10");
    const body = await request.json();
    const { id, title, type, priority, desc, status, collegeId, collegeName, escalated, escalatedAt, notes } = body;

    if (!title || !type || !priority || !collegeId) {
      return NextResponse.json({ success: false, message: "Missing required fields" }, { status: 400 });
    }

    const issueId = id || generateId("i");
    await db.run(
      `INSERT INTO campus_issues 
       (id, title, type, priority, desc_text, status, collegeId, collegeName, escalated, escalatedAt, resolvedAt, notes) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (id) DO UPDATE SET
         title = EXCLUDED.title,
         type = EXCLUDED.type,
         priority = EXCLUDED.priority,
         desc_text = EXCLUDED.desc_text,
         status = EXCLUDED.status,
         collegeId = EXCLUDED.collegeId,
         collegeName = EXCLUDED.collegeName,
         escalated = EXCLUDED.escalated,
         escalatedAt = EXCLUDED.escalatedAt,
         resolvedAt = EXCLUDED.resolvedAt,
         notes = EXCLUDED.notes`,
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
        body.resolvedAt || null,
        notes || null
      ]
    );

    // Email KAM when a new issue is high/critical — fire-and-forget
    if (priority === "high" || priority === "critical") {
      try {
        const kamRow = await db.get(
          `SELECT k.email, k.name
           FROM kam_users k
           INNER JOIN colleges c ON c.kam_id = k.id
           WHERE c.id = ?
           LIMIT 1`,
          [collegeId]
        );
        if (kamRow?.email) {
          sendMailAsync({
            to: kamRow.email,
            subject: `${BRAND.emailPrefix} [${priority.toUpperCase()} Issue] ${title} — ${collegeName || collegeId}`,
            htmlBody: renderEmailShell({
              title: "High Priority Campus Issue Raised",
              badgeText: `${priority.toUpperCase()} — ACTION NEEDED`,
              badgeColor: "rose",
              description: `A <strong>${priority}</strong> priority issue has been logged for your campus cluster and requires your attention.`,
              details: [
                { label: "Issue Title",  value: title,                   highlight: true },
                { label: "Campus",       value: collegeName || collegeId },
                { label: "Type",         value: type },
                { label: "Priority",     value: priority.toUpperCase(),  highlight: true },
                { label: "Description",  value: desc || "No description provided." },
                { label: "Status",       value: status || "pending" },
              ],
              ctaText:  "View Campus Issues →",
              ctaUrl:   `${BRAND.portalUrl}/kam/faculty-governance`,
              footerText: "This alert was triggered automatically for high-priority campus issues.",
            }),
            context: "high-priority-issue",
          });
        }
      } catch (_) {}
    }

    return NextResponse.json({ success: true, issue: { id: issueId, ...body, status: status || "pending" } });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const { errorResponse } = await requireAuth(request, { allowedRoles: ["cm", "kam", "admin"] });
    if (errorResponse) return errorResponse;
    const db = await getDb();
    await ensureMigration("schema_alignment_2026_10");
    const body = await request.json();
    const { id, status, resolvedAt, escalated, escalatedAt, notes } = body;

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

    if (notes !== undefined) {
      await db.run(
        "UPDATE campus_issues SET notes = ? WHERE id = ?",
        [notes, id]
      );
    }

    return NextResponse.json({ success: true, message: "Issue updated successfully" });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { errorResponse } = await requireAuth(request, { allowedRoles: ["cm", "kam", "admin"] });
    if (errorResponse) return errorResponse;
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
