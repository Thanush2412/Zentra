// Pin to Mumbai (bom1) — co-located with Turso DB (aws-ap-south-1)
export const preferredRegion = "bom1";
export const maxDuration = 60;

import { NextResponse } from "next/server";
import { getDb, resolveClassGroupDetails, syncMentorSubjectsAndClasses } from "@/lib/db";

export async function POST(request: Request) {
  try {
    const db = await getDb();
    const body = await request.json();
    const { mentorId, day, time, course, location, actorName, actorRole, shift, classGroup, college_id } = body;

    if (!mentorId || !day || !time || !course || !location) {
      return NextResponse.json({ success: false, message: "Missing required fields" }, { status: 400 });
    }

    // Resolve college_id from mentor if not passed
    let resolvedCollegeId = college_id;
    if (!resolvedCollegeId) {
      const mentorObj = await db.get("SELECT college_id FROM mentors WHERE id = ?", mentorId);
      resolvedCollegeId = mentorObj?.college_id || "college_1";
    }

    const cleanLocation = location.trim();
    const activeShift = shift || "general";

    // 1. Check Collision: Is this mentor already booked at this day and time across any shift?
    const mentorCollision = await db.get(
      "SELECT * FROM slots WHERE mentorId = ? AND day = ? AND time = ?",
      mentorId,
      day,
      time
    );
    if (mentorCollision) {
      return NextResponse.json({
        success: false,
        message: `Conflict: Mentor already has class "${mentorCollision.course}" scheduled at [${day}, ${time}] in shift "${mentorCollision.shift.replace("_", " ")}".`
      });
    }

    // 2. Check Collision: Is this class group already scheduled for another class at this time?
    if (classGroup) {
      const cleanClassGroup = classGroup.trim();
      const classCollision = await db.get(
        "SELECT s.*, m.name as mentorName FROM slots s JOIN mentors m ON s.mentorId = m.id WHERE LOWER(s.classGroup) = ? AND s.day = ? AND s.time = ? AND s.shift = ?",
        cleanClassGroup.toLowerCase(),
        day,
        time,
        activeShift
      );
      if (classCollision) {
        return NextResponse.json({
          success: false,
          message: `Conflict: Class group "${cleanClassGroup}" is already scheduled for "${classCollision.course}" with ${classCollision.mentorName} at [${day}, ${time}] in ${activeShift.replace("_", " ")}.`
        });
      }
    }

    // 3. Check Collision: Is this room already in use by anyone at this day and time?
    const roomCollision = await db.get(
      "SELECT s.*, m.name as mentorName FROM slots s LEFT JOIN mentors m ON s.mentorId = m.id WHERE LOWER(s.location) = LOWER(?) AND s.day = ? AND s.time = ? AND s.shift = ? LIMIT 1",
      cleanLocation,
      day,
      time,
      activeShift
    );
    if (roomCollision) {
      return NextResponse.json({
        success: false,
        message: `Conflict: Room "${cleanLocation}" is already booked by ${roomCollision.mentorName || "another mentor"} for "${roomCollision.course}" at [${day}, ${time}] in ${activeShift.replace("_", " ")}.`
      });
    }

    // 4. Create Slot in database
    const newId = "s_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5);
    
    const cleanClassGroup = classGroup ? classGroup.trim() : "General";
    const { department, semester, year } = await resolveClassGroupDetails(db, cleanClassGroup);

    await db.run(
      "INSERT INTO slots (id, mentorId, day, time, course, location, shift, classGroup, semester, year, department, college_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
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
      resolvedCollegeId
    );
    await syncMentorSubjectsAndClasses(db, mentorId, course, cleanClassGroup);

    // 4. Log Audit Event
    const mentor = await db.get("SELECT name FROM mentors WHERE id = ?", mentorId);
    const logDesc = actorRole === "Mentor Header"
      ? `Assigned new slot [${day}, ${time}] for ${course} to ${mentor?.name || "Instructor"}`
      : `${mentor?.name || "Instructor"} self-booked empty slot [${day}, ${time}] for ${course} at ${cleanLocation}`;

    const logId = "l_" + Date.now();
    await db.run(
      "INSERT INTO audit_logs (id, type, description, actorName, actorRole, timestamp) VALUES (?, ?, ?, ?, ?, ?)",
      logId,
      actorRole === "Mentor Header" ? "assignment" : "booking",
      logDesc,
      actorName || "System",
      actorRole || "User",
      new Date().toISOString()
    );

    return NextResponse.json({
      success: true,
      slot: { id: newId, mentorId, day, time, course, location: cleanLocation }
    });
  } catch (error: any) {
    console.error("API POST Slot error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const db = await getDb();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const classGroup = searchParams.get("classGroup");
    const actorName = searchParams.get("actorName") || "System";
    const actorRole = searchParams.get("actorRole") || "User";

    if (!id && !classGroup) {
      return NextResponse.json({ success: false, message: "Missing slot id or classGroup parameter" }, { status: 400 });
    }

    if (classGroup) {
      const cleanCG = classGroup.toLowerCase().trim();
      const normCG = cleanCG.replace(/[^a-z0-9]/g, "");
      const baseCG = cleanCG.replace(/\s*\([^)]*\)/g, "").trim();
      const normBaseCG = baseCG.replace(/[^a-z0-9]/g, "");

      const allSlots = await db.all("SELECT id, classGroup, course FROM slots");
      const matchedSlotIds = allSlots.filter(s => {
        if (!s.classGroup) return false;
        const sCG = s.classGroup.toLowerCase().trim();
        const sNorm = sCG.replace(/[^a-z0-9]/g, "");
        const sBase = sCG.replace(/\s*\([^)]*\)/g, "").trim();
        const sNormBase = sBase.replace(/[^a-z0-9]/g, "");

        return (
          sCG === cleanCG ||
          sNorm === normCG ||
          sBase === baseCG ||
          sNormBase === normBaseCG ||
          (normBaseCG.length > 3 && sNorm.includes(normBaseCG)) ||
          (sNormBase.length > 3 && normCG.includes(sNormBase))
        );
      }).map(s => s.id);

      if (matchedSlotIds.length > 0) {
        const placeholders = matchedSlotIds.map(() => "?").join(",");
        await db.run(`DELETE FROM slots WHERE id IN (${placeholders})`, matchedSlotIds);
      }

      if (matchedSlotIds.length > 0) {
        const logDesc = `Cleared timetable for class group "${classGroup}" (${matchedSlotIds.length} slots)`;
        const logId = "l_" + Date.now();
        await db.run(
          "INSERT INTO audit_logs (id, type, description, actorName, actorRole, timestamp) VALUES (?, 'release', ?, ?, ?, ?)",
          logId,
          logDesc,
          actorName,
          actorRole,
          new Date().toISOString()
        );
      }
      return NextResponse.json({ success: true, count: matchedSlotIds.length });
    }

    const slotToDelete = await db.get("SELECT * FROM slots WHERE id = ?", id);
    if (!slotToDelete) {
      return NextResponse.json({ success: false, message: "Slot not found" }, { status: 404 });
    }

    const mentor = await db.get("SELECT name FROM mentors WHERE id = ?", slotToDelete.mentorId);

    await db.run("DELETE FROM slots WHERE id = ?", id);

    // Log release
    const logDesc = `Removed assignment [${slotToDelete.day}, ${slotToDelete.time}] for ${slotToDelete.course} previously assigned to ${mentor?.name || "Instructor"}`;
    const logId = "l_" + Date.now();
    await db.run(
      "INSERT INTO audit_logs (id, type, description, actorName, actorRole, timestamp) VALUES (?, 'release', ?, ?, ?, ?)",
      logId,
      logDesc,
      actorName,
      actorRole,
      new Date().toISOString()
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("API DELETE Slot error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const db = await getDb();
    const body = await request.json();
    const { id, mentorId, day, time, course, location, actorName, actorRole, shift, classGroup, college_id } = body;

    if (!id || !mentorId || !day || !time || !course || !location) {
      return NextResponse.json({ success: false, message: "Missing required fields" }, { status: 400 });
    }

    // Resolve college_id
    let resolvedCollegeId = college_id;
    if (!resolvedCollegeId) {
      const mentorObj = await db.get("SELECT college_id FROM mentors WHERE id = ?", mentorId);
      resolvedCollegeId = mentorObj?.college_id || "college_1";
    }

    const cleanLocation = location.trim();
    const activeShift = shift || "general";

    // Check if slot exists
    const slotToUpdate = await db.get("SELECT * FROM slots WHERE id = ?", id);
    if (!slotToUpdate) {
      return NextResponse.json({ success: false, message: "Slot not found" }, { status: 404 });
    }

    // 1. Check Collision: Is this mentor already booked at this day and time across any shift? (excluding current slot)
    const mentorCollision = await db.get(
      "SELECT * FROM slots WHERE mentorId = ? AND day = ? AND time = ? AND id != ?",
      mentorId,
      day,
      time,
      id
    );
    if (mentorCollision) {
      return NextResponse.json({
        success: false,
        message: `Conflict: Mentor already has class "${mentorCollision.course}" scheduled at [${day}, ${time}] in shift "${mentorCollision.shift.replace("_", " ")}".`
      });
    }

    // 2. Check Collision: Is this class group already scheduled for another class at this time? (excluding this slot)
    if (classGroup) {
      const cleanClassGroup = classGroup.trim();
      const classCollision = await db.get(
        "SELECT s.*, m.name as mentorName FROM slots s JOIN mentors m ON s.mentorId = m.id WHERE LOWER(s.classGroup) = ? AND s.day = ? AND s.time = ? AND s.shift = ? AND s.id != ?",
        cleanClassGroup.toLowerCase(),
        day,
        time,
        activeShift,
        id
      );
      if (classCollision) {
        return NextResponse.json({
          success: false,
          message: `Conflict: Class group "${cleanClassGroup}" is already scheduled for "${classCollision.course}" with ${classCollision.mentorName} at [${day}, ${time}] in ${activeShift.replace("_", " ")}.`
        });
      }
    }

    // 3. Check Collision: Is this room already in use by anyone at this day and time? (excluding the current slot itself)
    const roomCollision = await db.get(
      "SELECT s.*, m.name as mentorName FROM slots s LEFT JOIN mentors m ON s.mentorId = m.id WHERE LOWER(s.location) = LOWER(?) AND s.day = ? AND s.time = ? AND s.shift = ? AND s.id != ? LIMIT 1",
      cleanLocation,
      day,
      time,
      activeShift,
      id
    );
    if (roomCollision) {
      return NextResponse.json({
        success: false,
        message: `Conflict: Room "${cleanLocation}" is already booked by ${roomCollision.mentorName || "another mentor"} for "${roomCollision.course}" at [${day}, ${time}] in ${activeShift.replace("_", " ")}.`
      });
    }

    // 4. Update Slot in database
    const cleanClassGroup = classGroup ? classGroup.trim() : "General";
    const { department, semester, year } = await resolveClassGroupDetails(db, cleanClassGroup);

    await db.run(
      "UPDATE slots SET mentorId = ?, day = ?, time = ?, course = ?, location = ?, shift = ?, classGroup = ?, semester = ?, year = ?, department = ?, college_id = ? WHERE id = ?",
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
      resolvedCollegeId,
      id
    );
    await syncMentorSubjectsAndClasses(db, mentorId, course, cleanClassGroup);

    // 4. Log Audit Event
    const oldMentor = await db.get("SELECT name FROM mentors WHERE id = ?", slotToUpdate.mentorId);
    const newMentor = await db.get("SELECT name FROM mentors WHERE id = ?", mentorId);
    
    let changeDesc = `Updated slot [${day}, ${time}]: `;
    const changes: string[] = [];
    if (slotToUpdate.course !== course) changes.push(`course from "${slotToUpdate.course}" to "${course}"`);
    if (slotToUpdate.location !== cleanLocation) changes.push(`room from "${slotToUpdate.location}" to "${cleanLocation}"`);
    if (slotToUpdate.mentorId !== mentorId) changes.push(`mentor from "${oldMentor?.name || "Unknown"}" to "${newMentor?.name || "Unknown"}"`);
    if (slotToUpdate.day !== day) changes.push(`day from "${slotToUpdate.day}" to "${day}"`);
    if (slotToUpdate.time !== time) changes.push(`time from "${slotToUpdate.time}" to "${time}"`);
    if (slotToUpdate.shift !== activeShift) changes.push(`shift from "${slotToUpdate.shift}" to "${activeShift}"`);

    if (changes.length > 0) {
      changeDesc += changes.join(", ");
    } else {
      changeDesc += "no changes made.";
    }

    const logId = "l_" + Date.now();
    await db.run(
      "INSERT INTO audit_logs (id, type, description, actorName, actorRole, timestamp) VALUES (?, 'assignment', ?, ?, ?, ?)",
      logId,
      changeDesc,
      actorName || "System",
      actorRole || "Mentor Header",
      new Date().toISOString()
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("API PUT Slot error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

