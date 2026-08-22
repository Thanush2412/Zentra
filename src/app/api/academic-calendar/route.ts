// Pin to Mumbai (bom1) — co-located with Turso DB (aws-ap-south-1)
export const preferredRegion = "bom1";
export const maxDuration = 60;

import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET(request: Request) {
  try {
    const db = await getDb();
    const { searchParams } = new URL(request.url);
    const collegeId = searchParams.get("college_id");
    
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

    // Fetch campus-scoped academic events
    let academicEvents = [];
    if (collegeId && collegeId !== "all") {
      academicEvents = await db.all("SELECT * FROM academic_events WHERE college_id = ? OR college_id IS NULL ORDER BY date ASC", [collegeId]);
    } else {
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
      const { 
        id, name, date, end_date, desc, category, department, audience, 
        status, venue, college_id, photos, coordinator, chief_guest, registration_link 
      } = data;

      if (!name || !date) {
        return NextResponse.json({ success: false, message: "Missing name or date" }, { status: 400 });
      }
      const eventId = id || "e_" + Date.now();
      const photosStr = typeof photos === "string" ? photos : (Array.isArray(photos) ? JSON.stringify(photos) : null);

      await db.run(
        `INSERT OR REPLACE INTO academic_events (
          id, name, date, end_date, desc, category, department, audience, 
          status, venue, college_id, photos, coordinator, chief_guest, registration_link
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          eventId,
          name,
          date,
          end_date || null,
          desc || null,
          category || "Coding Fest & Hackathon",
          department || "All Departments",
          audience || "All Campus",
          status || "Upcoming",
          venue || null,
          college_id || null,
          photosStr,
          coordinator || null,
          chief_guest || null,
          registration_link || null
        ]
      );
      return NextResponse.json({ 
        success: true, 
        event: { 
          id: eventId, name, date, end_date, desc, category, department, audience, 
          status, venue, college_id, photos: photosStr, coordinator, chief_guest, registration_link 
        } 
      });
    } else if (type === "batch_events") {
      const events = Array.isArray(data) ? data : [];
      let count = 0;
      for (const ev of events) {
        if (!ev.name || !ev.date) continue;
        const eventId = ev.id || "e_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7);
        const photosStr = typeof ev.photos === "string" ? ev.photos : (Array.isArray(ev.photos) ? JSON.stringify(ev.photos) : null);

        await db.run(
          `INSERT OR REPLACE INTO academic_events (
            id, name, date, end_date, desc, category, department, audience, 
            status, venue, college_id, photos, coordinator, chief_guest, registration_link
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            eventId,
            ev.name,
            ev.date,
            ev.end_date || null,
            ev.desc || null,
            ev.category || "Coding Fest & Hackathon",
            ev.department || "All Departments",
            ev.audience || "All Campus",
            ev.status || "Upcoming",
            ev.venue || null,
            ev.college_id || null,
            photosStr,
            ev.coordinator || null,
            ev.chief_guest || null,
            ev.registration_link || null
          ]
        );
        count++;
      }
      return NextResponse.json({ success: true, count, message: `${count} events imported successfully` });
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
