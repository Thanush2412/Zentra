export const maxDuration = 60;

import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { requireAuth } from "@/lib/authGuard";
import { normalizeRoleValue } from "@/lib/utils";

function resolveDraftId(user: any, searchParamUserId?: string | null, searchParamRole?: string | null): string {
  if (searchParamUserId && searchParamUserId !== "active_draft") {
    return searchParamUserId;
  }
  const role = searchParamRole || (user?.role ? normalizeRoleValue(user.role) : "admin");
  const id = user?.id || user?.email || "default";
  return `${role}_${id}`;
}

export async function GET(request: Request) {
  try {
    const { errorResponse, auth } = await requireAuth(request);
    if (errorResponse) return errorResponse;
    const user = auth?.user;
    const db = await getDb();
    const { searchParams } = new URL(request.url);
    const draftId = resolveDraftId(user, searchParams.get("userId"), searchParams.get("role"));
    
    // Check role-scoped draft first, fallback to legacy active_draft
    let row = await db.get("SELECT * FROM campus_drafts WHERE id = ?", draftId);
    if (!row && draftId !== "active_draft") {
      row = await db.get("SELECT * FROM campus_drafts WHERE id = 'active_draft'");
    }

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
      savedAt: row.saved_at,
      draftId: row.id,
      role: user?.role || "admin"
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { errorResponse, auth } = await requireAuth(request);
    if (errorResponse) return errorResponse;
    const user = auth?.user;
    const db = await getDb();
    const body = await request.json();
    const { data, savedAt, userId, role } = body;
    if (!data) {
      return NextResponse.json({ success: false, message: "Draft data required" }, { status: 400 });
    }
    const draftId = resolveDraftId(user, userId, role);
    const dataStr = typeof data === "string" ? data : JSON.stringify(data);
    const timeStr = savedAt || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    await db.run(
      `INSERT INTO campus_drafts (id, data, saved_at, updated_at)
       VALUES (?, ?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(id) DO UPDATE SET data = excluded.data, saved_at = excluded.saved_at, updated_at = CURRENT_TIMESTAMP`,
      draftId, dataStr, timeStr
    );
    return NextResponse.json({
      success: true,
      message: "Draft saved to database",
      savedAt: timeStr,
      draftId,
      role: user?.role || "admin"
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { errorResponse, auth } = await requireAuth(request);
    if (errorResponse) return errorResponse;
    const user = auth?.user;
    const db = await getDb();
    const { searchParams } = new URL(request.url);
    const draftId = resolveDraftId(user, searchParams.get("userId"), searchParams.get("role"));
    await db.run("DELETE FROM campus_drafts WHERE id = ? OR id = 'active_draft'", draftId);
    return NextResponse.json({ success: true, message: "Draft cleared from database" });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
