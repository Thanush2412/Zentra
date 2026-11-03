export const maxDuration = 60;

import { NextResponse } from "next/server";
import { getDb, resolveClassGroupDetails, syncMentorSubjectsAndClasses } from "@/lib/db";
import { requireAuth } from "@/lib/authGuard";
import { generateId } from "@/lib/id";

const INSERT_CHUNK = 200;

function chunkBy<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export async function POST(request: Request) {
  // Same gate as the sibling /api/slots writes; without it any anonymous POST could
  // inject timetable slots into any college.
  const { errorResponse } = await requireAuth(request, {
    allowedRoles: ["admin", "cm", "kam", "mentor"],
    checkCsrf: true
  });
  if (errorResponse) return errorResponse;

  try {
    const db = await getDb();
    const body = await request.json();
    const { slots, actorName } = body;

    if (!slots || !Array.isArray(slots) || slots.length === 0) {
      return NextResponse.json({ success: false, message: "No slots provided" }, { status: 400 });
    }

    // A 200-row sheet used to cost ~4 queries per row (≈800 round trips, 3+ minutes
    // at measured cross-region latency) and died halfway through maxDuration. Mentor
    // colleges and the existing day slots are read once up front and the collision
    // checks run in memory; each accepted row is folded back into the same index so a
    // duplicate inside one upload is caught exactly like a duplicate already in the DB.
    const mentorIds = Array.from(new Set(slots.map((s: any) => s.mentorId).filter(Boolean)));
    const refFailures: any[] = [];
    const refs = await db.multiQuery(
      [
        {
          sql: `SELECT id, college_id FROM mentors WHERE ${mentorIds.length ? `id IN (${mentorIds.map(() => "?").join(",")})` : "1 = 0"}`,
          params: mentorIds,
        },
        { sql: "SELECT id FROM colleges ORDER BY id ASC LIMIT 1", params: [] },
      ],
      refFailures
    );
    if (refFailures.length > 0) {
      // A partial read here would import slots into the wrong college, so fail loudly.
      return NextResponse.json(
        { success: false, message: `Slot import aborted: reference data unavailable (${refFailures.length} query slice(s) failed)` },
        { status: 500 }
      );
    }

    const mentorCollege = new Map<string, any>();
    for (const m of refs[0]) mentorCollege.set(m.id, m);
    const firstCol = refs[1][0] || null;

    const days = Array.from(new Set(slots.map((s: any) => s.day).filter(Boolean)));
    const slotFailures: any[] = [];
    const existingSlices = await db.multiQuery(
      [
        {
          sql: `SELECT id, mentorId, day, time, shift, location, classGroup, college_id FROM slots WHERE ${days.length ? `day IN (${days.map(() => "?").join(",")})` : "1 = 0"}`,
          params: days,
        },
      ],
      slotFailures
    );
    if (slotFailures.length > 0) {
      return NextResponse.json(
        { success: false, message: `Slot import aborted: existing timetable could not be read (${slotFailures.length} query slice(s) failed)` },
        { status: 500 }
      );
    }

    // Room and class collisions are per shift, but a mentor cannot be in two rooms at
    // the same clock time regardless of shift label — the single-slot POST enforces
    // exactly that "across any shift" rule, so bulk matches it here.
    const byStamp = new Map<string, any[]>();
    const byDayTime = new Map<string, any[]>();
    const stampKey = (day: any, time: any, shift: any) => `${day}|${time}|${shift}`;
    const dayTimeKey = (day: any, time: any) => `${day}|${time}`;
    const indexSlot = (row: any) => {
      const k = stampKey(row.day, row.time, row.shift);
      const list = byStamp.get(k);
      if (list) list.push(row);
      else byStamp.set(k, [row]);
      const dt = dayTimeKey(row.day, row.time);
      const dtList = byDayTime.get(dt);
      if (dtList) dtList.push(row);
      else byDayTime.set(dt, [row]);
    };
    for (const s of existingSlices[0]) indexSlot(s);

    let addedCount = 0;
    const validSlotsToInsert: any[] = [];

    for (const slot of slots) {
      const { mentorId, day, time, course, location, shift, classGroup, college_id, collegeId: slotColId } = slot;
      const cleanLocation = location?.trim() || "";
      const activeShift = shift || "general";
      const cleanClassGroup = classGroup ? classGroup.trim() : "General Class";

      const mentorObj = mentorCollege.get(mentorId);
      const targetCollegeId = college_id || slotColId || mentorObj?.college_id || firstCol?.id || null;

      const sameStamp = byStamp.get(stampKey(day, time, activeShift)) || [];
      // Mentor collisions are not college-scoped, and they ignore the shift label.
      const sameCollege = targetCollegeId
        ? sameStamp.filter((s) => (s.college_id ?? null) === targetCollegeId)
        : sameStamp;

      if ((byDayTime.get(dayTimeKey(day, time)) || []).some((s) => s.mentorId === mentorId)) continue;

      const locLower = cleanLocation.toLowerCase();
      const roomCollision = sameCollege.find(
        (s) => s.location && String(s.location).toLowerCase() === locLower
      );
      if (roomCollision) continue;

      const cgLower = cleanClassGroup.toLowerCase();
      const classCollision = sameCollege.find((s) => {
        const cg = s.classGroup || s.classgroup;
        return cg && String(cg).toLowerCase() === cgLower;
      });
      if (classCollision) continue;

      const { department, semester, year } = await resolveClassGroupDetails(db, cleanClassGroup);

      const newId = generateId("s_csv");
      validSlotsToInsert.push({
        newId,
        mentorId,
        day,
        time,
        course,
        cleanLocation,
        activeShift,
        cleanClassGroup,
        semester,
        year,
        department,
        collegeId: targetCollegeId
      });

      indexSlot({
        id: newId,
        mentorId,
        day,
        time,
        shift: activeShift,
        location: cleanLocation,
        classGroup: cleanClassGroup,
        college_id: targetCollegeId
      });
    }

    if (validSlotsToInsert.length > 0) {
      await db.transaction(async (tx) => {
        for (const chunk of chunkBy(validSlotsToInsert, INSERT_CHUNK)) {
          const values = chunk.map(() => "(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").join(", ");
          const params = chunk.flatMap((s) => [
            s.newId, s.mentorId, s.day, s.time, s.course, s.cleanLocation,
            s.activeShift, s.cleanClassGroup, s.semester, s.year, s.department, s.collegeId
          ]);
          await tx.run(
            `INSERT INTO slots (id, mentorId, day, time, course, location, shift, classGroup, semester, year, department, college_id)
             VALUES ${values}`,
            params
          );
        }

        const logId = generateId("l");
        await tx.run(
          "INSERT INTO audit_logs (id, type, description, actorName, actorRole, timestamp) VALUES (?, 'csv_upload', ?, ?, 'Mentor Header', ?)",
          logId,
          `Bulk imported ${validSlotsToInsert.length} timetable slots from template CSV file`,
          actorName || "Mentor Header",
          new Date().toISOString()
        );
      });

      const synced = new Set<string>();
      for (const s of validSlotsToInsert) {
        const key = `${s.mentorId}|${s.course}|${s.cleanClassGroup}`;
        if (synced.has(key)) continue;
        synced.add(key);
        await syncMentorSubjectsAndClasses(db, s.mentorId, s.course, s.cleanClassGroup);
      }

      addedCount = validSlotsToInsert.length;

      return NextResponse.json({
        success: true,
        message: `Successfully imported ${addedCount} timetable slots!`,
        count: addedCount
      });
    }

    return NextResponse.json({
      success: false,
      message: "No slots were imported due to scheduling conflicts or invalid mappings."
    });
  } catch (error: any) {
    console.error("API POST Slots Bulk error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
