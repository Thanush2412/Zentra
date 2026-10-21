// Pin to Mumbai (bom1) — co-located with Turso DB (aws-ap-south-1)
export const preferredRegion = "bom1";
export const maxDuration = 60;
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { ensureMigration } from "@/lib/migrations";

const DAY_ORDER_CYCLE = ["Day 1", "Day 2", "Day 3", "Day 4", "Day 5", "Day 6"];

function toYMD(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function eventDatesInRange(startDate: string, endDate?: string | null): string[] {
  const [sY, sM, sD] = String(startDate).split("-").map(Number);
  if (!sY || !sM || !sD) return [];
  const [eY, eM, eD] = String(endDate || startDate).split("-").map(Number);
  let cur = new Date(sY, sM - 1, sD);
  const end = new Date(eY || sY, (eM || sM) - 1, eD || sD);
  const dates: string[] = [];
  while (cur <= end && dates.length < 60) {
    dates.push(toYMD(cur));
    cur = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate() + 1);
  }
  return dates;
}

// An event owns its dates in the timetable only through campus_daily_configs, so writing
// academic_events alone leaves Day Order unchanged. Mirrors the exam auto-sync.
async function syncEventDayOrder(
  db: any,
  collegeId: string,
  startDate: string,
  endDate: string | null | undefined,
  eventName: string
) {
  const synced: { dateStr: string; day_order: string }[] = [];
  const protectedDates: string[] = [];

  for (const dStr of eventDatesInRange(startDate, endDate)) {
    const existing: any = await db.get(
      `SELECT day_type, day_order, session_mode FROM campus_daily_configs WHERE college_id = ? AND dateStr = ?`,
      [collegeId, dStr]
    );

    // A CM-declared holiday or an exam schedule owns this date; an event must not erase it.
    if (existing && (existing.day_type === "holiday" || existing.day_type === "exam_day")) {
      protectedDates.push(dStr);
      continue;
    }

    let dayOrder = existing?.day_order && existing.day_order !== "None" ? existing.day_order : "";
    if (!dayOrder) {
      const prev: any = await db.get(
        `SELECT day_order FROM campus_daily_configs
         WHERE college_id = ? AND dateStr < ? AND day_order IS NOT NULL AND day_order != 'None'
         ORDER BY dateStr DESC LIMIT 1`,
        [collegeId, dStr]
      );
      const match = String(prev?.day_order || "").match(/Day\s+(\d+)/i);
      dayOrder = match ? DAY_ORDER_CYCLE[parseInt(match[1], 10) % DAY_ORDER_CYCLE.length] : "Day 1";
    }

    await db.run(
      `INSERT INTO campus_daily_configs (id, college_id, dateStr, day_type, day_order, session_mode, notes, updated_at)
       VALUES (?, ?, ?, 'event', ?, ?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT (id) DO UPDATE SET
         day_type = 'event',
         day_order = EXCLUDED.day_order,
         notes = EXCLUDED.notes,
         updated_at = CURRENT_TIMESTAMP`,
      [
        `${collegeId}_${dStr}`,
        collegeId,
        dStr,
        dayOrder,
        existing?.session_mode || "Offline",
        `Event: ${eventName}`
      ]
    );
    synced.push({ dateStr: dStr, day_order: dayOrder });
  }

  return { synced, protectedDates };
}

// Reverts dates this sync stamped as 'event' once no event covers them any more.
async function clearEventDayOrder(db: any, collegeId: string, dates: string[]) {
  for (const dStr of dates) {
    const cfg: any = await db.get(
      `SELECT day_type FROM campus_daily_configs WHERE college_id = ? AND dateStr = ?`,
      [collegeId, dStr]
    );
    if (!cfg || cfg.day_type !== "event") continue;

    const covering: any = await db.get(
      `SELECT id FROM academic_events
       WHERE college_id = ? AND date <= ? AND COALESCE(end_date, date) >= ?`,
      [collegeId, dStr, dStr]
    );
    if (covering) continue;

    await db.run(
      `UPDATE campus_daily_configs SET day_type = 'working', notes = '', updated_at = CURRENT_TIMESTAMP
       WHERE college_id = ? AND dateStr = ?`,
      [collegeId, dStr]
    );
  }
}

function isConcreteCollege(collegeId: any): collegeId is string {
  return typeof collegeId === "string" && collegeId.trim() !== "" && collegeId !== "all";
}


export async function GET(request: Request) {
  try {
    await ensureMigration("academic_calendar_tables");
    const db = await getDb();
    const { searchParams } = new URL(request.url);
    const collegeId = searchParams.get("college_id");
    
    // Fetch all academic years
    let yearsRows = await db.all("SELECT year_name FROM academic_years");
    
    if (yearsRows.length === 0) {
      // Auto-seed default years
      await db.run("INSERT INTO academic_years (year_name) VALUES ('2025-2026')").catch(() => {});
      await db.run("INSERT INTO academic_years (year_name) VALUES ('2026-2027')").catch(() => {});
      await db.run("INSERT INTO academic_years (year_name) VALUES ('2027-2028')").catch(() => {});
      yearsRows = await db.all("SELECT year_name FROM academic_years");
    }
    const academicYears = yearsRows.map((r: any) => r.year_name);

    // Fetch campus-scoped academic events
    let academicEvents = [];
    if (collegeId && collegeId !== "all") {
      academicEvents = await db.all("SELECT * FROM academic_events WHERE college_id = ? OR college_id IS NULL ORDER BY date ASC", [collegeId]);
    } else {
      academicEvents = await db.all("SELECT * FROM academic_events ORDER BY date ASC");
    }

    return NextResponse.json({ success: true, academicYears, academicEvents });
  } catch (error: any) {
    console.error("GET /api/academic-calendar error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await ensureMigration("academic_calendar_tables");
    const db = await getDb();
    const body = await request.json();
    const { type, data } = body;

    if (!type || !data) {
      return NextResponse.json({ success: false, message: "Missing type or data" }, { status: 400 });
    }

    const isPg = (db as any).isPostgres;

    if (type === "year") {
      const { year_name } = data;
      if (!year_name) {
        return NextResponse.json({ success: false, message: "Missing year name" }, { status: 400 });
      }
      await db.run("INSERT INTO academic_years (year_name) VALUES (?) ON CONFLICT (year_name) DO NOTHING", [year_name.trim()]);
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
      const previousEvent: any = id
        ? await db.get(`SELECT date, end_date, college_id FROM academic_events WHERE id = ?`, [id]).catch(() => null)
        : null;

      if (isPg) {
        await db.run(
          `INSERT INTO academic_events (
            id, name, date, end_date, "desc", category, department, audience, 
            status, venue, college_id, photos, coordinator, chief_guest, registration_link
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            date = EXCLUDED.date,
            end_date = EXCLUDED.end_date,
            "desc" = EXCLUDED."desc",
            category = EXCLUDED.category,
            department = EXCLUDED.department,
            audience = EXCLUDED.audience,
            status = EXCLUDED.status,
            venue = EXCLUDED.venue,
            college_id = EXCLUDED.college_id,
            photos = EXCLUDED.photos,
            coordinator = EXCLUDED.coordinator,
            chief_guest = EXCLUDED.chief_guest,
            registration_link = EXCLUDED.registration_link`,
          [
            eventId,
            name.trim(),
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
      } else {
        await db.run(
          `INSERT INTO academic_events (
            id, name, date, end_date, "desc", category, department, audience, 
            status, venue, college_id, photos, coordinator, chief_guest, registration_link
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT (id) DO UPDATE SET
            name = excluded.name,
            date = excluded.date,
            end_date = excluded.end_date,
            "desc" = excluded."desc",
            category = excluded.category,
            department = excluded.department,
            audience = excluded.audience,
            status = excluded.status,
            venue = excluded.venue,
            college_id = excluded.college_id,
            photos = excluded.photos,
            coordinator = excluded.coordinator,
            chief_guest = excluded.chief_guest,
            registration_link = excluded.registration_link`,
          [
            eventId,
            name.trim(),
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
      }

      // Auto-sync Day Order so the event actually appears on the campus calendar
      let dayOrderSync: { synced: any[]; protectedDates?: string[]; skipped?: string } = { synced: [], skipped: "no_college" };
      try {
        if (isConcreteCollege(college_id)) {
          const result = await syncEventDayOrder(db, college_id, date, end_date, name.trim());
          dayOrderSync = { synced: result.synced, protectedDates: result.protectedDates };
          if (isConcreteCollege(previousEvent?.college_id)) {
            const staleDates = eventDatesInRange(previousEvent.date, previousEvent.end_date)
              .filter((d: string) => !result.synced.some((s) => s.dateStr === d));
            if (staleDates.length > 0) await clearEventDayOrder(db, previousEvent.college_id, staleDates);
          }
        }
      } catch (cdcErr) {
        console.warn("Could not auto-sync campus_daily_configs for event dates:", cdcErr);
      }

      return NextResponse.json({ 
        success: true, 
        dayOrderSync,
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

        if (isPg) {
          await db.run(
            `INSERT INTO academic_events (
              id, name, date, end_date, "desc", category, department, audience, 
              status, venue, college_id, photos, coordinator, chief_guest, registration_link
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT (id) DO UPDATE SET
              name = EXCLUDED.name,
              date = EXCLUDED.date,
              end_date = EXCLUDED.end_date,
              "desc" = EXCLUDED."desc",
              category = EXCLUDED.category,
              department = EXCLUDED.department,
              audience = EXCLUDED.audience,
              status = EXCLUDED.status,
              venue = EXCLUDED.venue,
              college_id = EXCLUDED.college_id,
              photos = EXCLUDED.photos,
              coordinator = EXCLUDED.coordinator,
              chief_guest = EXCLUDED.chief_guest,
              registration_link = EXCLUDED.registration_link`,
            [
              eventId,
              ev.name.trim(),
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
        } else {
          await db.run(
            `INSERT INTO academic_events (
              id, name, date, end_date, "desc", category, department, audience, 
              status, venue, college_id, photos, coordinator, chief_guest, registration_link
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT (id) DO UPDATE SET
              name = excluded.name,
              date = excluded.date,
              end_date = excluded.end_date,
              "desc" = excluded."desc",
              category = excluded.category,
              department = excluded.department,
              audience = excluded.audience,
              status = excluded.status,
              venue = excluded.venue,
              college_id = excluded.college_id,
              photos = excluded.photos,
              coordinator = excluded.coordinator,
              chief_guest = excluded.chief_guest,
              registration_link = excluded.registration_link`,
            [
              eventId,
              ev.name.trim(),
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
        }
        if (isConcreteCollege(ev.college_id)) {
          try {
            await syncEventDayOrder(db, ev.college_id, ev.date, ev.end_date, String(ev.name).trim());
          } catch (cdcErr) {
            console.warn("Could not auto-sync campus_daily_configs for imported event dates:", cdcErr);
          }
        }
        count++;
      }
      return NextResponse.json({ success: true, count, message: `${count} events imported successfully` });
    }

    return NextResponse.json({ success: false, message: "Invalid type" }, { status: 400 });
  } catch (error: any) {
    console.error("POST /api/academic-calendar error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    await ensureMigration("academic_calendar_tables");
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
      const deletedEvent: any = await db.get(
        `SELECT date, end_date, college_id FROM academic_events WHERE id = ?`,
        [value]
      ).catch(() => null);

      await db.run("DELETE FROM academic_events WHERE id = ?", [value]);

      // Release the Day Order rows this event had stamped, if nothing else covers those dates
      if (deletedEvent && isConcreteCollege(deletedEvent.college_id)) {
        try {
          await clearEventDayOrder(
            db,
            deletedEvent.college_id,
            eventDatesInRange(deletedEvent.date, deletedEvent.end_date)
          );
        } catch (cdcErr) {
          console.warn("Could not release campus_daily_configs for deleted event dates:", cdcErr);
        }
      }

      return NextResponse.json({ success: true, message: "Academic event deleted" });
    }

    return NextResponse.json({ success: false, message: "Invalid type" }, { status: 400 });
  } catch (error: any) {
    console.error("DELETE /api/academic-calendar error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
