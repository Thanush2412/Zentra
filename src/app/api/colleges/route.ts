import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET() {
  try {
    const db = await getDb();

    const colleges = await db.all(`
      SELECT 
        c.id, c.name, c.address, c.kam_id, c.has_shifts, c.shift_configs, c.rooms,
        c.code, c.academic_year, c.manager, c.working_days,
        k.name as kam_name, k.email as kam_email,
        (SELECT COUNT(*) FROM campus_managers cm WHERE cm.college_id = c.id) as cam_count,
        (SELECT COUNT(*) FROM departments d WHERE d.college_id = c.id) as dept_count,
        (SELECT COUNT(*) FROM mentors m WHERE m.college_id = c.id) as mentor_count,
        (SELECT COUNT(*) FROM slots s JOIN mentors m ON s.mentorId = m.id WHERE m.college_id = c.id) as slot_count
      FROM colleges c
      JOIN kam_users k ON c.kam_id = k.id
      ORDER BY c.name
    `);

    const campusManagers = await db.all(`
      SELECT cm.*, c.name as college_name
      FROM campus_managers cm
      JOIN colleges c ON cm.college_id = c.id
      ORDER BY cm.name
    `);

    const kamUsers = await db.all("SELECT * FROM kam_users ORDER BY name");

    return NextResponse.json({ success: true, colleges, campusManagers, kamUsers });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const db = await getDb();
    const body = await request.json();
    const { id: providedId, name, address, kam_id, has_shifts, shift_configs, rooms, code, academic_year, manager, working_days } = body;
    if (!name || !kam_id) {
      return NextResponse.json({ success: false, message: "Missing required fields (name, kam_id)" }, { status: 400 });
    }
    const cleanName = name.trim();

    // Auto-generate ID if not provided (Bug #25 fix)
    const generatedId = providedId
      ? providedId.trim()
      : "college_" + cleanName.toLowerCase().replace(/[^a-z0-9]/g, "_").replace(/_+/g, "_").replace(/(^_|_$)/g, "") + "_" + Date.now().toString(36);

    // Check for duplicate ID
    const existingId = await db.get("SELECT id FROM colleges WHERE id = ?", generatedId);
    if (existingId) {
      return NextResponse.json({ success: false, message: `A campus with ID "${generatedId}" already exists.` }, { status: 400 });
    }
    // Check for duplicate name (case-insensitive)
    const existingName = await db.get("SELECT id FROM colleges WHERE LOWER(name) = LOWER(?)", cleanName);
    if (existingName) {
      return NextResponse.json({ success: false, message: `A campus named "${cleanName}" already exists.` }, { status: 400 });
    }

    await db.run(
      "INSERT INTO colleges (id, name, address, kam_id, has_shifts, shift_configs, rooms, code, academic_year, manager, working_days) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      generatedId, cleanName, address ? address.trim() : "", kam_id.trim(), has_shifts === undefined ? 1 : Number(has_shifts), shift_configs || null, rooms || null, code || null, academic_year || null, manager || null, working_days === undefined ? 5 : Number(working_days)
    );
    return NextResponse.json({ success: true, message: "Campus created successfully", id: generatedId });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const db = await getDb();
    const body = await request.json();
    const { id, name, address, kam_id, has_shifts, shift_configs, rooms, code, academic_year, manager, working_days } = body;
    if (!id || !name || !kam_id) {
      return NextResponse.json({ success: false, message: "Missing required fields" }, { status: 400 });
    }
    await db.run(
      "UPDATE colleges SET name = ?, address = ?, kam_id = ?, has_shifts = ?, shift_configs = ?, rooms = ?, code = ?, academic_year = ?, manager = ?, working_days = ? WHERE id = ?",
      name.trim(), address ? address.trim() : "", kam_id.trim(), has_shifts === undefined ? 1 : Number(has_shifts), shift_configs || null, rooms || null, code || null, academic_year || null, manager || null, working_days === undefined ? 5 : Number(working_days), id
    );
    return NextResponse.json({ success: true, message: "Campus updated successfully" });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const db = await getDb();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ success: false, message: "Campus id required" }, { status: 400 });
    }

    // --- Bug #20+#21 fix: full cascade delete ---

    // 1. Get all mentors in this college
    const collegeMentors = await db.all("SELECT id FROM mentors WHERE college_id = ?", id);
    const mentorIds = collegeMentors.map((m: any) => m.id);

    if (mentorIds.length > 0) {
      const mp = mentorIds.map(() => "?").join(",");
      // Delete all slots for those mentors (cascade to student_attendance, handovers)
      const mentorSlots = await db.all(`SELECT id FROM slots WHERE mentorId IN (${mp})`, mentorIds);
      const slotIds = mentorSlots.map((s: any) => s.id);
      if (slotIds.length > 0) {
        const sp = slotIds.map(() => "?").join(",");
        await db.run(`DELETE FROM student_attendance WHERE slotId IN (${sp})`, slotIds);
        await db.run(`DELETE FROM handover_requests WHERE slotId IN (${sp})`, slotIds);
        await db.run(`DELETE FROM approved_handovers WHERE slotId IN (${sp})`, slotIds);
        await db.run(`DELETE FROM slots WHERE id IN (${sp})`, slotIds);
      }
      // Delete the mentors and their users
      await db.run(`DELETE FROM users WHERE role = 'mentor' AND reference_id IN (${mp})`, mentorIds);
      await db.run(`DELETE FROM mentors WHERE id IN (${mp})`, mentorIds);
    }

    // 2. Get all students in this college
    const collegeStudents = await db.all("SELECT id FROM students WHERE college_id = ?", id);
    const studentIds = collegeStudents.map((s: any) => s.id);
    if (studentIds.length > 0) {
      const sp = studentIds.map(() => "?").join(",");
      await db.run(`DELETE FROM student_attendance WHERE studentId IN (${sp})`, studentIds);
      await db.run(`DELETE FROM leave_requests WHERE studentId IN (${sp})`, studentIds);
      await db.run(`DELETE FROM students WHERE id IN (${sp})`, studentIds);
      await db.run(`DELETE FROM users WHERE role = 'student' AND reference_id IN (${sp})`, studentIds);
    }

    // 3. Delete campus managers and their users
    const collegeCams = await db.all("SELECT id FROM campus_managers WHERE college_id = ?", id);
    const camIds = collegeCams.map((c: any) => c.id);
    if (camIds.length > 0) {
      const cp = camIds.map(() => "?").join(",");
      await db.run(`DELETE FROM users WHERE role = 'cam' AND reference_id IN (${cp})`, camIds);
    }
    await db.run("DELETE FROM campus_managers WHERE college_id = ?", id);

    // 4. Remove college references from subjects (set to null)
    await db.run("UPDATE subjects SET college_id = NULL WHERE college_id = ?", id);

    // 5. Delete courses and departments for this college
    await db.run("DELETE FROM courses WHERE college_id = ?", id);
    await db.run("DELETE FROM departments WHERE college_id = ?", id);
    
    // 6. Finally delete the college itself
    await db.run("DELETE FROM colleges WHERE id = ?", id);

    const deletedCounts = {
      mentors: mentorIds.length,
      students: studentIds.length,
      cams: camIds.length,
    };

    return NextResponse.json({
      success: true,
      message: `Campus deleted successfully. Removed ${deletedCounts.mentors} mentor(s), ${deletedCounts.students} student(s), ${deletedCounts.cams} CAM(s) and all associated data.`,
      deletedCounts
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
