import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const preferredRegion = "bom1";
export const maxDuration = 60;

export async function GET() {
  try {
    const dbPath = path.resolve(process.cwd(), "database.sqlite");

    if (!fs.existsSync(dbPath)) {
      return NextResponse.json({ success: false, message: "Local database file not found" }, { status: 404 });
    }

    const fileBuffer = fs.readFileSync(dbPath);
    const dateStr = new Date().toISOString().slice(0, 10);
    const fileName = `zentra_database_backup_${dateStr}.sqlite`;

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/x-sqlite3",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Content-Length": fileBuffer.length.toString(),
      },
    });
  } catch (error: any) {
    console.error("Backup download error:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
