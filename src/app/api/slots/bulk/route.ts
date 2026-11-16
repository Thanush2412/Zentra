export const maxDuration = 60;

import { NextResponse } from "next/server";
import { getDb, resolveClassGroupDetails, syncMentorSubjectsAndClasses } from "@/lib/db";
import { requireAuth } from "@/lib/authGuard";
import { generateId } from "@/lib/id";
import { canActOnCollege, isUnscopedRole, actorRoleLabel } from "@/lib/requestScope";

const INSERT_CHUNK = 200;

function chunkBy<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/**
 * POST /api/slots/bulk
 *
 * body.slots    rows to import
 * body.replace  optional { classGroup, college_id } — atomically REPLACES that class's
 *               timetable (used by the CM timetable generator). Existing slots at the
 *               same (day, time, shift) are UPDATED IN PLACE so their ids — and every
 *               attendance row pointing at them — survive regeneration. Previously the
 *               client deleted the class (attendance.slotId was SET NULL by the FK) and
 *               then re-inserted with new ids in a second request; a failure in between
 *               left the class with no timetable at all.
 */
export async function POST(request: Request) {
  // Same gate as the sibling /api/slots writes; without it any anonymous POST could
  // inject timetable slots into any college.
  const { auth, errorResponse } = await requireAuth(request, {
    allowedRoles: ["admin", "cm", "kam", "mentor"],
    checkCsrf: true
  });
  if (errorResponse) return errorResponse;
  const actor = auth!.user;

  try {
    const db = await getDb();
    const body = await request.json();
    const { slots } = body;
    const actorName = actor.name || body.actorName || "Unknown";

    if (!slots || !Array.isArray(slots) || slots.length === 0) {
      return NextResponse.json({ success: false, message: "No slots provided" }, { status: 400 });
    }

    // Campus pinning: CM and mentor sessions can only write to their own campus.
    const pinnedCollegeId: string | null = isUnscopedRole(actor.role) || actor.role === "kam"
      ? null
      : (actor.college_id || null);
    if ((actor.role === "cm" || actor.role === "mentor") && !pinnedCollegeId) {
      return NextResponse.json({ success: false, message: "No campus is assigned to this account." }, { status: 403 });
    }

    const replace = body.replace && body.replace.classGroup
      ? {
          classGroup: String(body.replace.classGroup).trim(),
          collegeId: pinnedCollegeId || String(body.replace.college_id || body.replace.collegeId || "").trim() || null
        }
      : null;
    if (replace && !replace.collegeId) {
      return NextResponse.json({ success: false, message: "Campus is required to regenerate a timetable." }, { status: 400 });
    }
    if (replace && !(await canActOnCollege(db, actor, replace.collegeId))) {
      return NextResponse.json({ success: false, message: "Unauthorized: campus outside your scope." }, { status: 403 });
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

    const days = Array.from(new Set(slots.map((s: any) => s.day).filter(Boolean)));
    const slotFailures: any[] = [];
    const existingSlices = await db.multiQuery(
      [
        {
          sql: `SELECT id, mentorId, day, time, shift, location, classGroup, college_id FROM slots WHERE ${days.length ? `day IN (${days.map(() => "?").join(",")})` : "1 = 0"}`,
          params: days,
        },
        replace
          ? {
              sql: "SELECT id, day, time, shift FROM slots WHERE college_id = ? AND LOWER(TRIM(classGroup)) = ?",
              params: [replace.collegeId, replace.classGroup.toLowerCase()],
            }
          : { sql: "SELECT 1 WHERE 1=0", params: [] },
      ],
      slotFailures
    );
    if (slotFailures.length > 0) {
      return NextResponse.json(
        { success: false, message: `Slot import aborted: existing timetable could not be read (${slotFailures.length} query slice(s) failed)` },
        { status: 500 }
      );
    }

    // In replace mode the class's own current slots are about to be rewritten, so they
    // must not count as collisions; they are matched by (day, time, shift) instead.
    const ownSlotIds = new Set<string>((replace ? existingSlices[1] : []).map((r: any) => String(r.id)));
    const slotKey = (day: any, time: any, shift: any) => `${day}|${time}|${shift || "general"}`;
    const ownByKey = new Map<string, string>();
    for (const r of replace ? existingSlices[1] : []) ownByKey.set(slotKey(r.day, r.time, r.shift), String(r.id));

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
    for (const s of existingSlices[0]) {
      if (!ownSlotIds.has(String(s.id))) indexSlot(s);
    }

    const validSlotsToInsert: any[] = [];
    const skipped: { day: string; time: string; course?: string; reason: string }[] = [];
    // resolveClassGroupDetails hits the DB; an upload usually has a handful of classes,
    // so resolve each class once instead of once per row.
    const classDetailsCache = new Map<string, Promise<{ department: any; semester: any; year: any }>>();
    const kamAllowed = new Map<string, boolean>();

    for (const slot of slots) {
      const { mentorId, day, time, course, location, shift, classGroup, college_id, collegeId: slotColId } = slot;
      const cleanLocation = location?.trim() || "";
      const activeShift = shift || "general";
      const cleanClassGroup = replace ? replace.classGroup : (classGroup ? classGroup.trim() : "General Class");

      const mentorObj = mentorCollege.get(mentorId);
      // No more "first college in the table" fallback: a slot whose campus cannot be
      // resolved is reported back instead of landing on an unrelated campus.
      const targetCollegeId = pinnedCollegeId || (replace ? replace.collegeId : null) || college_id || slotColId || mentorObj?.college_id || null;
      if (!targetCollegeId) {
        skipped.push({ day, time, course, reason: "campus could not be determined" });
        continue;
      }
      if (actor.role === "kam") {
        if (!kamAllowed.has(targetCollegeId)) kamAllowed.set(targetCollegeId, await canActOnCollege(db, actor, targetCollegeId));
        if (!kamAllowed.get(targetCollegeId)) {
          skipped.push({ day, time, course, reason: "campus outside your portfolio" });
          continue;
        }
      }

      const sameStamp = byStamp.get(stampKey(day, time, activeShift)) || [];
      // Mentor collisions are not college-scoped, and they ignore the shift label.
      const sameCollege = sameStamp.filter((s) => (s.college_id ?? null) === targetCollegeId);

      if ((byDayTime.get(dayTimeKey(day, time)) || []).some((s) => s.mentorId === mentorId)) {
        skipped.push({ day, time, course, reason: "mentor already teaching at this time" });
        continue;
      }

      const locLower = cleanLocation.toLowerCase();
      const roomCollision = locLower
        ? sameCollege.find((s) => s.location && String(s.location).toLowerCase() === locLower)
        : null;
      if (roomCollision) {
        skipped.push({ day, time, course, reason: `room ${cleanLocation} already booked` });
        continue;
      }

      const cgLower = cleanClassGroup.toLowerCase();
      const classCollision = sameCollege.find((s) => {
        const cg = s.classGroup || s.classgroup;
        return cg && String(cg).toLowerCase() === cgLower;
      });
      if (classCollision) {
        skipped.push({ day, time, course, reason: "class already has a period at this time" });
        continue;
      }

      if (!classDetailsCache.has(cgLower)) classDetailsCache.set(cgLower, resolveClassGroupDetails(db, cleanClassGroup));
      const { department, semester, year } = await classDetailsCache.get(cgLower)!;

      const reuseId = replace ? ownByKey.get(slotKey(day, time, activeShift)) : undefined;
      if (reuseId) ownByKey.delete(slotKey(day, time, activeShift));
      const newId = reuseId || generateId("s_csv");
      validSlotsToInsert.push({
        newId,
        reuse: Boolean(reuseId),
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

    // Replace mode is all-or-nothing: a partially generated timetable is never saved.
    if (replace && (skipped.length > 0 || validSlotsToInsert.length === 0)) {
      return NextResponse.json({
        success: false,
        message: skipped.length > 0
          ? `Timetable not saved: ${skipped.length} period(s) clash with the current schedule. Regenerate and try again.`
          : "Timetable not saved: no valid periods were generated.",
        skipped
      }, { status: 409 });
    }

    if (validSlotsToInsert.length > 0) {
      const toUpdate = validSlotsToInsert.filter((s) => s.reuse);
      const toInsert = validSlotsToInsert.filter((s) => !s.reuse);
      const toDelete = replace ? Array.from(ownByKey.values()) : [];

      await db.transaction(async (tx) => {
        // Delete first so a freed room/mentor stamp can be reused by the inserts below.
        for (const chunk of chunkBy(toDelete, INSERT_CHUNK)) {
          await tx.run(`DELETE FROM slots WHERE id IN (${chunk.map(() => "?").join(",")})`, chunk);
        }
        for (const s of toUpdate) {
          await tx.run(
            `UPDATE slots SET mentorId = ?, course = ?, location = ?, semester = ?, year = ?, department = ? WHERE id = ?`,
            [s.mentorId, s.course, s.cleanLocation, s.semester, s.year, s.department, s.newId]
          );
        }
        for (const chunk of chunkBy(toInsert, INSERT_CHUNK)) {
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
          "INSERT INTO audit_logs (id, type, description, actorName, actorRole, timestamp) VALUES (?, 'csv_upload', ?, ?, ?, ?)",
          logId,
          replace
            ? `Regenerated timetable for ${replace.classGroup}: ${toUpdate.length} updated in place, ${toInsert.length} added, ${toDelete.length} removed`
            : `Bulk imported ${validSlotsToInsert.length} timetable slots from template CSV file`,
          actorName,
          actorRoleLabel(actor.role),
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

      const addedCount = validSlotsToInsert.length;
      // Authoritative rows for the client (replace mode), so the UI never shows
      // slots that were not saved or ids that do not exist.
      const savedSlots = replace
        ? await db.all("SELECT * FROM slots WHERE college_id = ? AND LOWER(TRIM(classGroup)) = ?", [replace.collegeId, replace.classGroup.toLowerCase()])
        : undefined;

      return NextResponse.json({
        success: true,
        message: replace
          ? `Timetable saved: ${addedCount} periods (${toUpdate.length} kept their history).`
          : `Successfully imported ${addedCount} timetable slots!${skipped.length ? ` ${skipped.length} skipped.` : ""}`,
        count: addedCount,
        skipped,
        slots: savedSlots
      });
    }

    return NextResponse.json({
      success: false,
      message: "No slots were imported due to scheduling conflicts or invalid mappings.",
      skipped
    });
  } catch (error: any) {
    console.error("API POST Slots Bulk error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
