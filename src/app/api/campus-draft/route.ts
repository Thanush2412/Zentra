export const maxDuration = 60;

import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { requireAuth } from "@/lib/authGuard";
import { normalizeRoleValue } from "@/lib/utils";

/**
 * The draft key is derived from the verified session only. It used to accept
 * `userId` / `role` from the request, which let any signed-in user read, overwrite
 * or delete anyone else's draft. The extra arguments are ignored on purpose so old
 * callers keep working.
 */
function resolveDraftId(user: any, _searchParamUserId?: string | null, _searchParamRole?: string | null): string {
  const role = user?.role ? normalizeRoleValue(user.role) : "user";
  const id = user?.id || user?.email || "default";
  return `${role}_${id}`;
}

/** The shared pre-scoping "active_draft" row is only readable/clearable by admins. */
function canUseLegacyDraft(user: any): boolean {
  return String(user?.role || "").toLowerCase() === "admin";
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
    if (!row && canUseLegacyDraft(user)) {
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
    if (canUseLegacyDraft(user)) {
      await db.run("DELETE FROM campus_drafts WHERE id = ? OR id = 'active_draft'", draftId);
    } else {
      await db.run("DELETE FROM campus_drafts WHERE id = ?", draftId);
    }
    return NextResponse.json({ success: true, message: "Draft cleared from database" });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
