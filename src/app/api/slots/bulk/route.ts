import { NextResponse } from "next/server";
import { getDb, resolveClassGroupDetails } from "@/lib/db";

export async function POST(request: Request) {
  try {
    const db = await getDb();
    const body = await request.json();
    const { slots, actorName } = body;

    if (!slots || !Array.isArray(slots) || slots.length === 0) {
      return NextResponse.json({ success: false, message: "No slots provided" }, { status: 400 });
    }

    let addedCount = 0;

    for (const slot of slots) {
      const { mentorId, day, time, course, location, shift, classGroup } = slot;
      const cleanLocation = location.trim();
      const activeShift = shift || "general";
      const cleanClassGroup = classGroup ? classGroup.trim() : "General Class";

      // Check mentor collision
      const mentorCollision = await db.get(
        "SELECT * FROM slots WHERE mentorId = ? AND day = ? AND time = ? AND shift = ?",
        mentorId,
        day,
        time,
        activeShift
      );
      if (mentorCollision) continue;

      // Check room collision
      const allSlots = await db.all("SELECT * FROM slots WHERE day = ? AND time = ? AND shift = ?", day, time, activeShift);
      const roomCollision = allSlots.find(
        (s) => s.location.toLowerCase() === cleanLocation.toLowerCase()
      );
      if (roomCollision) continue;

      // Check class group collision
      const classCollision = allSlots.find(
        (s) => s.classGroup && s.classGroup.toLowerCase() === cleanClassGroup.toLowerCase()
      );
      if (classCollision) continue;

      const { department, semester, year } = await resolveClassGroupDetails(db, cleanClassGroup);

      const mentorObj = await db.get("SELECT college_id FROM mentors WHERE id = ?", mentorId);
      const collegeId = mentorObj?.college_id || "college_1";

      const newId = "s_csv_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5);
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
        collegeId
      );
      addedCount++;
    }

    if (addedCount > 0) {
      // Log upload
      const logId = "l_" + Date.now();
      await db.run(
        "INSERT INTO audit_logs (id, type, description, actorName, actorRole, timestamp) VALUES (?, 'csv_upload', ?, ?, 'Mentor Header', ?)",
        logId,
        `Bulk imported ${addedCount} timetable slots from template CSV file`,
        actorName || "Mentor Header",
        new Date().toISOString()
      );

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
