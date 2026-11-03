import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { requireAuth } from "@/lib/authGuard";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const POLICY_KEY = "profile_edit_allowed_classes";

async function readPolicy(): Promise<string[]> {
  const db = await getDb();
  const row = await db.get("SELECT value FROM system_settings WHERE key = ?", [POLICY_KEY]);
  if (!row?.value) return [];
  try {
    const parsed = JSON.parse(row.value);
    return Array.isArray(parsed) ? parsed.filter((v: unknown): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

export async function GET(request: Request) {
  try {
    const { errorResponse } = await requireAuth(request);
    if (errorResponse) return errorResponse;

    return NextResponse.json({ success: true, classes: await readPolicy() });
  } catch (error: any) {
    console.error("GET profile-edit-policy error:", error);
    return NextResponse.json({ success: false, message: error.message || "Failed to load policy" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { auth, errorResponse } = await requireAuth(request, {
      allowedRoles: ["cm", "admin"],
      checkCsrf: true
    });
    if (errorResponse) return errorResponse;

    const body = await request.json();
    const classes = Array.isArray(body?.classes)
      ? body.classes.filter((v: unknown): v is string => typeof v === "string" && v.trim().length > 0)
      : null;
    if (!classes) {
      return NextResponse.json({ success: false, message: "classes must be an array of class group names." }, { status: 400 });
    }

    const db = await getDb();
    await db.run(
      `INSERT INTO system_settings (key, value, updated_at, updated_by)
       VALUES (?, ?, CURRENT_TIMESTAMP, ?)
       ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=CURRENT_TIMESTAMP, updated_by=excluded.updated_by`,
      [POLICY_KEY, JSON.stringify(classes), auth?.user.name || "Campus Manager"]
    );

    return NextResponse.json({ success: true, classes });
  } catch (error: any) {
    console.error("POST profile-edit-policy error:", error);
    return NextResponse.json({ success: false, message: error.message || "Failed to save policy" }, { status: 500 });
  }
}
