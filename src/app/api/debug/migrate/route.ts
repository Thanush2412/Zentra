// Pin to Mumbai (bom1) — co-located with Turso DB (aws-ap-south-1)
export const preferredRegion = "bom1";
export const maxDuration = 60;

import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ success: false, message: "Debug endpoints disabled in production." }, { status: 403 });
  }

  try {
    const db = await getDb();
    
    // Check if the column exists
    const tableInfo = await db.all("PRAGMA table_info(users)").catch(() => []);
    const hasColumn = Array.isArray(tableInfo) && tableInfo.some((col: any) => col.name === 'must_change_password');
    
    if (hasColumn) {
      return NextResponse.json({
        success: true,
        message: "Column already exists",
        columns: tableInfo.map((col: any) => col.name)
      });
    }
    
    // Try to add the column safely
    try { await db.exec("ALTER TABLE users ADD COLUMN must_change_password BOOLEAN DEFAULT 0;"); } catch (_) {}
    try { await db.exec("ALTER TABLE users ADD COLUMN last_login TEXT DEFAULT NULL;"); } catch (_) {}
    
    // Verify it was added
    const newTableInfo = await db.all("PRAGMA table_info(users)").catch(() => []);
    const nowHasColumn = Array.isArray(newTableInfo) && newTableInfo.some((col: any) => col.name === 'must_change_password');
    
    return NextResponse.json({
      success: true,
      message: nowHasColumn ? "Columns added successfully" : "Column addition completed",
      columns: Array.isArray(newTableInfo) ? newTableInfo.map((col: any) => col.name) : []
    });
    
  } catch (error: any) {
    console.error("Migration error:", error);
    return NextResponse.json({ 
      success: false, 
      message: error.message 
    }, { status: 500 });
  }
}