import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { hashPassword } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    const db = await getDb();
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const search = (searchParams.get("search") || "").toLowerCase().trim();
    const role = (searchParams.get("role") || "").toLowerCase().trim();

    const offset = (page - 1) * limit;
    let query = "SELECT id, email, role, reference_id, status, last_login, created_at, updated_at FROM users WHERE 1=1";
    let countQuery = "SELECT COUNT(*) as count FROM users WHERE 1=1";
    const params: any[] = [];
    const countParams: any[] = [];

    if (role && role !== "all") {
      query += " AND role = ?";
      countQuery += " AND role = ?";
      params.push(role);
      countParams.push(role);
    }

    if (search) {
      query += " AND (LOWER(email) LIKE ? OR LOWER(reference_id) LIKE ?)";
      countQuery += " AND (LOWER(email) LIKE ? OR LOWER(reference_id) LIKE ?)";
      const term = `%${search}%`;
      params.push(term, term);
      countParams.push(term, term);
    }

    query += " ORDER BY created_at DESC LIMIT ? OFFSET ?";
    params.push(limit, offset);

    const users = await db.all(query, params);
    const totalRow = await db.get(countQuery, countParams);
    const total = totalRow?.count || 0;

    return NextResponse.json({
      success: true,
      users,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const db = await getDb();
    const body = await request.json();
    const { userId, action } = body;

    if (!userId || !action) {
      return NextResponse.json({ success: false, message: "Missing userId or action" }, { status: 400 });
    }

    const user = await db.get("SELECT * FROM users WHERE id = ? OR reference_id = ?", [userId, userId]);
    if (!user) {
      return NextResponse.json({ success: false, message: "User not found" }, { status: 404 });
    }

    if (action === "toggle_status") {
      const newStatus = user.status === "Active" ? "Inactive" : "Active";
      const nowStr = new Date().toISOString();

      await db.run("UPDATE users SET status = ?, updated_at = ? WHERE id = ?", [newStatus, nowStr, user.id]);
      
      // Sync status to role specific tables
      if (user.role === "student") {
        await db.run("UPDATE students SET status = ?, updated_at = ? WHERE id = ?", [newStatus, nowStr, user.reference_id]);
      } else if (user.role === "mentor") {
        await db.run("UPDATE mentors SET status = ?, updated_at = ? WHERE id = ?", [newStatus, nowStr, user.reference_id]);
      }

      return NextResponse.json({ success: true, message: `User status changed to ${newStatus}` });
    }

    if (action === "reset_password") {
      const defaultPasswordHash = hashPassword("password123");
      const nowStr = new Date().toISOString();

      await db.run("UPDATE users SET password_hash = ?, must_change_password = 1, updated_at = ? WHERE id = ?", [defaultPasswordHash, nowStr, user.id]);

      // Sync password to role specific tables
      if (user.role === "student") {
        await db.run("UPDATE students SET password_hash = ?, updated_at = ? WHERE id = ?", [defaultPasswordHash, nowStr, user.reference_id]);
      } else if (user.role === "mentor") {
        await db.run("UPDATE mentors SET password_hash = ?, updated_at = ? WHERE id = ?", [defaultPasswordHash, nowStr, user.reference_id]);
      }

      return NextResponse.json({ success: true, message: "User password reset successfully to 'password123'." });
    }

    return NextResponse.json({ success: false, message: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    console.error("API POST Users error:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
