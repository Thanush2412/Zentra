import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

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
      const defaultPassword = "password123";
      const nowStr = new Date().toISOString();

      await db.run("UPDATE users SET password_hash = ?, must_change_password = 1, updated_at = ? WHERE id = ?", [defaultPassword, nowStr, user.id]);

      // Sync password to role specific tables
      if (user.role === "student") {
        await db.run("UPDATE students SET password_hash = ?, updated_at = ? WHERE id = ?", [defaultPassword, nowStr, user.reference_id]);
      } else if (user.role === "mentor") {
        await db.run("UPDATE mentors SET password_hash = ?, updated_at = ? WHERE id = ?", [defaultPassword, nowStr, user.reference_id]);
      }

      return NextResponse.json({ success: true, message: "User password reset successfully to 'password123'." });
    }

    return NextResponse.json({ success: false, message: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    console.error("API POST Users error:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
