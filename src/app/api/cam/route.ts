import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

// GET /api/cam?id=cam_1  — returns CAM profile + their college's data
export async function GET(request: Request) {
  try {
    const db = await getDb();
    const { searchParams } = new URL(request.url);
    const camId = searchParams.get("id");

    if (!camId) {
      return NextResponse.json({ success: false, message: "CAM id required" }, { status: 400 });
    }

    const cam = await db.get(`
      SELECT cm.*, c.name as college_name, c.address as college_address, k.name as kam_name
      FROM campus_managers cm
      JOIN colleges c ON cm.college_id = c.id
      JOIN kam_users k ON cm.kam_id = k.id
      WHERE cm.id = ?
    `, camId);
    if (!cam) {
      return NextResponse.json({ success: false, message: "Campus Manager not found" }, { status: 404 });
    }

    const collegeId = cam.college_id;

    // All departments in this college
    const departments = await db.all(
      "SELECT * FROM departments WHERE college_id = ? ORDER BY name",
      collegeId
    );

    // All mentors in this college, reporting directly to CAM (setting CAM name as headerName)
    const mentors = await db.all(`
      SELECT m.*, ? as headerName FROM mentors m
      WHERE m.college_id = ?
      ORDER BY m.department, m.name
    `, cam.name, collegeId);

    // All slots for this college
    const slots = await db.all(
      "SELECT * FROM slots WHERE college_id = ?",
      collegeId
    );

    // All subjects for departments in this college
    const subjects = await db.all(`
      SELECT sub.* FROM subjects sub
      WHERE sub.college_id = ?
    `, collegeId);

    // Stats
    const stats = {
      totalDepts: departments.length,
      totalMentors: mentors.length,
      totalSlots: slots.length,
      totalSubjects: subjects.length
    };

    return NextResponse.json({
      success: true,
      cam: { ...cam, role: "cam" },
      college: {
        id: collegeId,
        name: cam.college_name,
        address: cam.college_address
      },
      departments,
      mentors: mentors.map((m: any) => ({ ...m, role: "mentor", shift: m.shift || "general" })),
      slots,
      subjects,
      stats
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const db = await getDb();
    const body = await request.json();
    const { id, name, email, college_id, kam_id } = body;
    if (!id || !name || !email || !college_id || !kam_id) {
      return NextResponse.json({ success: false, message: "Missing required fields" }, { status: 400 });
    }
    const cleanId = id.trim();
    const cleanEmail = email.trim().toLowerCase();
    
    await db.run(
      "INSERT INTO campus_managers (id, name, email, college_id, kam_id) VALUES (?, ?, ?, ?, ?)",
      cleanId, name.trim(), cleanEmail, college_id.trim(), kam_id.trim()
    );
    
    // Clean old credentials associated with this email
    await db.run("DELETE FROM users WHERE LOWER(email) = ?", cleanEmail);

    // Create corresponding entry in centralized users table
    const now = new Date().toISOString();
    await db.run(
      `INSERT INTO users (id, email, password_hash, role, reference_id, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [cleanId, cleanEmail, "password123", "cam", cleanId, "Active", now, now]
    );

    return NextResponse.json({ success: true, message: "Campus Manager created successfully" });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const db = await getDb();
    const body = await request.json();
    const { id, name, email, college_id, kam_id } = body;
    if (!id || !name || !email || !college_id || !kam_id) {
      return NextResponse.json({ success: false, message: "Missing required fields" }, { status: 400 });
    }
    const cleanEmail = email.trim().toLowerCase();

    await db.run(
      "UPDATE campus_managers SET name = ?, email = ?, college_id = ?, kam_id = ? WHERE id = ?",
      name.trim(), cleanEmail, college_id.trim(), kam_id.trim(), id
    );

    // Clean old credentials associated with this email (excluding the current CAM ID)
    await db.run("DELETE FROM users WHERE LOWER(email) = ? AND reference_id != ?", [cleanEmail, id]);

    // Create or update centralized users table entry
    const now = new Date().toISOString();
    await db.run(
      `INSERT OR REPLACE INTO users (id, email, password_hash, role, reference_id, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, cleanEmail, "password123", "cam", id, "Active", now, now]
    );

    return NextResponse.json({ success: true, message: "Campus Manager updated successfully" });
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
      return NextResponse.json({ success: false, message: "Campus Manager id required" }, { status: 400 });
    }
    
    // Delete from both users and campus_managers
    await db.run("DELETE FROM users WHERE role = 'cam' AND reference_id = ?", id);
    await db.run("DELETE FROM campus_managers WHERE id = ?", id);
    
    return NextResponse.json({ success: true, message: "Campus Manager deleted successfully" });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
