import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

// GET /api/kam?id=kam_1  — returns KAM profile + all colleges + campus managers under them
export async function GET(request: Request) {
  try {
    const db = await getDb();
    const { searchParams } = new URL(request.url);
    const kamId = searchParams.get("id");

    if (!kamId) {
      return NextResponse.json({ success: false, message: "KAM id required" }, { status: 400 });
    }

    const kam = await db.get("SELECT * FROM kam_users WHERE id = ?", kamId);
    if (!kam) {
      return NextResponse.json({ success: false, message: "KAM not found" }, { status: 404 });
    }

    // All colleges under this KAM
    const colleges = await db.all(`
      SELECT 
        c.id, c.name, c.address,
        (SELECT COUNT(*) FROM departments d WHERE d.college_id = c.id) as dept_count,
        (SELECT COUNT(*) FROM mentors m WHERE m.college_id = c.id) as mentor_count,
        (SELECT COUNT(*) FROM slots s JOIN mentors m ON s.mentorId = m.id WHERE m.college_id = c.id) as slot_count
      FROM colleges c WHERE c.kam_id = ?
      ORDER BY c.name
    `, kamId);

    // All campus managers under this KAM
    const campusManagers = await db.all(`
      SELECT cm.*, co.name as college_name
      FROM campus_managers cm
      JOIN colleges co ON cm.college_id = co.id
      WHERE cm.kam_id = ?
      ORDER BY cm.name
    `, kamId);

    // All departments across all colleges under KAM
    const departments = await db.all(`
      SELECT d.*, c.name as college_name
      FROM departments d
      JOIN colleges c ON d.college_id = c.id
      WHERE c.kam_id = ?
      ORDER BY c.name, d.name
    `, kamId);

    // Aggregate stats
    const totalMentors = await db.get(`
      SELECT COUNT(*) as count FROM mentors m
      JOIN colleges c ON m.college_id = c.id
      WHERE c.kam_id = ?
    `, kamId);

    const totalSlots = await db.get(`
      SELECT COUNT(*) as count FROM slots s
      JOIN mentors m ON s.mentorId = m.id
      JOIN colleges c ON m.college_id = c.id
      WHERE c.kam_id = ?
    `, kamId);

    return NextResponse.json({
      success: true,
      kam: { ...kam, role: "kam" },
      colleges,
      campusManagers,
      departments,
      stats: {
        totalColleges: colleges.length,
        totalDepts: departments.length,
        totalMentors: totalMentors?.count || 0,
        totalSlots: totalSlots?.count || 0
      }
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const db = await getDb();
    const body = await request.json();
    const { id, name, email, title } = body;
    if (!id || !name || !email) {
      return NextResponse.json({ success: false, message: "Missing required fields" }, { status: 400 });
    }
    await db.run(
      "INSERT INTO kam_users (id, name, email, title) VALUES (?, ?, ?, ?)",
      id.trim(), name.trim(), email.trim().toLowerCase(), title ? title.trim() : "Key Account Manager"
    );
    return NextResponse.json({ success: true, message: "KAM created successfully" });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const db = await getDb();
    const body = await request.json();
    const { id, name, email, title } = body;
    if (!id || !name || !email) {
      return NextResponse.json({ success: false, message: "Missing required fields" }, { status: 400 });
    }
    await db.run(
      "UPDATE kam_users SET name = ?, email = ?, title = ? WHERE id = ?",
      name.trim(), email.trim().toLowerCase(), title ? title.trim() : "Key Account Manager", id
    );
    return NextResponse.json({ success: true, message: "KAM updated successfully" });
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
      return NextResponse.json({ success: false, message: "KAM id required" }, { status: 400 });
    }
    const college = await db.get("SELECT * FROM colleges WHERE kam_id = ?", id);
    if (college) {
      return NextResponse.json({ success: false, message: "Cannot delete KAM: they are assigned to one or more campuses. Reassign the campuses first." });
    }
    await db.run("DELETE FROM kam_users WHERE id = ?", id);
    return NextResponse.json({ success: true, message: "KAM deleted successfully" });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
