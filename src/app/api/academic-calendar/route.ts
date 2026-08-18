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

    if (academicEvents.length === 0) {
      // Auto-seed default events tagged to default college
      await db.run(
        `INSERT INTO academic_events (id, name, date, end_date, category, department, audience, status, venue, desc, college_id, coordinator, chief_guest) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          "e1", 
          "HackSphere 2026 - 24hr Campus Hackathon", 
          "2026-08-28", 
          "2026-08-29", 
          "Coding Fest & Hackathon", 
          "Computer Science", 
          "All Campus", 
          "Upcoming", 
          "Innovation & AI Labs", 
          "Flagship 24-hour inter-departmental coding marathon and product building hackathon with mentorship from alumni and tech leaders.",
          collegeId || "college_1",
          "Prof. Vignesh (HOD-CSE)",
          "Sundeep G. (Principal Architect, Tech Corp)"
        ]
      );
      await db.run(
        `INSERT INTO academic_events (id, name, date, end_date, category, department, audience, status, venue, desc, college_id, coordinator) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          "e2", 
          "CyberShield & Cloud Security Hands-on BootCamp", 
          "2026-09-08", 
          "2026-09-09", 
          "Workshop & Hands-on BootCamp", 
          "Information Technology", 
          "Students Only", 
          "Upcoming", 
          "Campus Tech Center", 
          "Two-day hands-on cybersecurity workshop focusing on network penetration testing, Docker security, and cloud threat mitigation.",
          collegeId || "college_1",
          "Dr. Priya M. (IT Dept Coordinator)"
        ]
      );
      await db.run(
        `INSERT INTO academic_events (id, name, date, end_date, category, department, audience, status, venue, desc, college_id, coordinator) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          "e3", 
          "InnovateX - Annual Tech Symposium & Project Expo", 
          "2026-09-22", 
          "2026-09-23", 
          "Technical Symposium & Project Expo", 
          "All Departments", 
          "All Campus", 
          "Upcoming", 
          "Main University Auditorium & Exhibition Hall", 
          "Annual student tech project demonstration, robotics showcase, circuit debugging challenges, and paper presentation.",
          collegeId || "college_1",
          "Prof. Harish K. (Symposium Head)"
        ]
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
