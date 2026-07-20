import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET() {
  try {
    const db = await getDb();
    
    // Fetch all academic years
    let yearsRows = await db.all("SELECT year_name FROM academic_years");
    
    if (yearsRows.length === 0) {
      // Auto-seed default years
      await db.run("INSERT INTO academic_years (year_name) VALUES ('2025-2026')");
      await db.run("INSERT INTO academic_years (year_name) VALUES ('2026-2027')");
      await db.run("INSERT INTO academic_years (year_name) VALUES ('2027-2028')");
      yearsRows = await db.all("SELECT year_name FROM academic_years");
    }
    const academicYears = yearsRows.map(r => r.year_name);

    // Fetch all academic events
    let academicEvents = await db.all("SELECT * FROM academic_events ORDER BY date ASC");

    if (academicEvents.length === 0) {
      // Auto-seed default events
      await db.run(
        "INSERT INTO academic_events (id, name, date, desc) VALUES (?, ?, ?, ?)",
        ["e1", "Internal Test 2 Commencement", "2026-07-06", "Continuous internal assessment test for all semesters."]
      );
      await db.run(
        "INSERT INTO academic_events (id, name, date, desc) VALUES (?, ?, ?, ?)",
        ["e2", "Board of Studies Curriculum Review Meeting", "2026-07-15", "Curriculum review session with advisory board."]
      );
      await db.run(
        "INSERT INTO academic_events (id, name, date, desc) VALUES (?, ?, ?, ?)",
        ["e3", "College Sports Day Games", "2026-07-22", "Annual inter-department athletic championship."]
      );
      academicEvents = await db.all("SELECT * FROM academic_events ORDER BY date ASC");
    }

    return NextResponse.json({ success: true, academicYears, academicEvents });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const db = await getDb();
    const body = await request.json();
    const { type, data } = body;

    if (!type || !data) {
      return NextResponse.json({ success: false, message: "Missing type or data" }, { status: 400 });
    }

    if (type === "year") {
      const { year_name } = data;
      if (!year_name) {
        return NextResponse.json({ success: false, message: "Missing year name" }, { status: 400 });
      }
      await db.run("INSERT OR IGNORE INTO academic_years (year_name) VALUES (?)", [year_name.trim()]);
      return NextResponse.json({ success: true, message: "Academic year added successfully" });
    } else if (type === "event") {
      const { id, name, date, desc } = data;
      if (!name || !date) {
        return NextResponse.json({ success: false, message: "Missing name or date" }, { status: 400 });
      }
      const eventId = id || "e_" + Date.now();
      await db.run(
        "INSERT OR REPLACE INTO academic_events (id, name, date, desc) VALUES (?, ?, ?, ?)",
        [eventId, name, date, desc || null]
      );
      return NextResponse.json({ success: true, event: { id: eventId, name, date, desc } });
    }

    return NextResponse.json({ success: false, message: "Invalid type" }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const db = await getDb();
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");
    const value = searchParams.get("value"); // year name or event id

    if (!type || !value) {
      return NextResponse.json({ success: false, message: "Type and value parameters are required" }, { status: 400 });
    }

    if (type === "year") {
      await db.run("DELETE FROM academic_years WHERE year_name = ?", [value]);
      return NextResponse.json({ success: true, message: "Academic year deleted" });
    } else if (type === "event") {
      await db.run("DELETE FROM academic_events WHERE id = ?", [value]);
      return NextResponse.json({ success: true, message: "Academic event deleted" });
    }

    return NextResponse.json({ success: false, message: "Invalid type" }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
