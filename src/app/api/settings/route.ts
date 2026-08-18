// Pin to Mumbai (bom1) — co-located with Turso DB (aws-ap-south-1)
export const preferredRegion = "bom1";
export const maxDuration = 60;

import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET() {
  try {
    const db = await getDb();
    const rows = await db.all("SELECT key, value, updated_at, updated_by FROM system_settings");
    
    // Map settings array to an object
    const settings: Record<string, any> = {
      mailing_enabled: true, // default
    };

    rows.forEach((row: any) => {
      if (row.key === "mailing_enabled") {
        settings.mailing_enabled = row.value === "true" || row.value === "1";
      } else {
        settings[row.key] = row.value;
      }
    });

    return NextResponse.json({ success: true, settings });
  } catch (error: any) {
    console.error("API GET settings error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { key, value, updatedBy } = body;

    if (!key || value === undefined) {
      return NextResponse.json({ success: false, message: "Missing key or value" }, { status: 400 });
    }

    const db = await getDb();
    const strValue = typeof value === "boolean" ? (value ? "true" : "false") : String(value);
    const actorName = updatedBy || "System Admin";

    // Upsert into system_settings
    await db.run(
      `INSERT INTO system_settings (key, value, updated_at, updated_by)
       VALUES (?, ?, datetime('now'), ?)
       ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=datetime('now'), updated_by=excluded.updated_by`,
      [key, strValue, actorName]
    );

    // Write audit log entry
    const auditId = `audit_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const description = key === "mailing_enabled"
      ? `Global Email Delivery toggled ${strValue === "true" ? "ON (Active)" : "OFF (Disabled)"}`
      : `System setting '${key}' updated to '${strValue}'`;

    await db.run(
      `INSERT INTO audit_logs (id, type, description, actorName, actorRole, timestamp)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [auditId, "SYSTEM_SETTING", description, actorName, "admin", new Date().toISOString()]
    );

    return NextResponse.json({
      success: true,
      message: `Setting '${key}' updated successfully.`,
      key,
      value: strValue === "true" ? true : strValue === "false" ? false : strValue
    });
  } catch (error: any) {
    console.error("API POST settings error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
