import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET() {
  try {
    const db = await getDb();
    
    // Check if the column exists
    const tableInfo = await db.all("PRAGMA table_info(users)");
    const hasColumn = tableInfo.some((col: any) => col.name === 'must_change_password');
    
    if (hasColumn) {
      return NextResponse.json({
        success: true,
        message: "Column already exists",
        columns: tableInfo.map((col: any) => col.name)
      });
    }
    
    // Try to add the column
    await db.exec("ALTER TABLE users ADD COLUMN must_change_password BOOLEAN DEFAULT 0;");
    await db.exec("ALTER TABLE users ADD COLUMN last_login TEXT DEFAULT NULL;");
    
    // Verify it was added
    const newTableInfo = await db.all("PRAGMA table_info(users)");
    const nowHasColumn = newTableInfo.some((col: any) => col.name === 'must_change_password');
    
    return NextResponse.json({
      success: true,
      message: nowHasColumn ? "Columns added successfully" : "Column addition failed",
      columns: newTableInfo.map((col: any) => col.name)
    });
    
  } catch (error: any) {
    console.error("Migration error:", error);
    return NextResponse.json({ 
      success: false, 
      message: error.message 
    }, { status: 500 });
  }
}