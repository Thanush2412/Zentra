import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function POST(request: Request) {
  try {
    const db = await getDb();
    const body = await request.json();
    const { email, currentPassword, newPassword } = body;

    if (!email || !currentPassword || !newPassword) {
      return NextResponse.json(
        { success: false, message: "Missing required fields (email, current password, or new password)." },
        { status: 400 }
      );
    }

    const cleanEmail = email.toLowerCase().trim();

    // Query centralized users table by email or reference_id/id
    const user = await db.get(
      "SELECT * FROM users WHERE LOWER(email) = ? OR LOWER(reference_id) = ? OR LOWER(id) = ?",
      [cleanEmail, cleanEmail, cleanEmail]
    );

    if (!user) {
      return NextResponse.json(
        { success: false, message: "Account not found." },
        { status: 404 }
      );
    }

    // Verify current password
    if (user.password_hash !== currentPassword) {
      return NextResponse.json(
        { success: false, message: "Current password is incorrect." },
        { status: 400 }
      );
    }

    // Validate new password rules
    const trimmedNewPass = newPassword.trim();
    if (trimmedNewPass.length < 6) {
      return NextResponse.json(
        { success: false, message: "New password must be at least 6 characters long." },
        { status: 400 }
      );
    }

    if (currentPassword === trimmedNewPass) {
      return NextResponse.json(
        { success: false, message: "New password cannot be the same as your current password." },
        { status: 400 }
      );
    }

    const nowStr = new Date().toISOString();

    // Update main users table
    await db.run(
      "UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?",
      [trimmedNewPass, nowStr, user.id]
    );

    // Sync to role-specific tables
    if (user.role === "student") {
      await db.run(
        "UPDATE students SET password_hash = ?, updated_at = ? WHERE id = ?",
        [trimmedNewPass, nowStr, user.reference_id]
      );
    } else if (user.role === "mentor") {
      await db.run(
        "UPDATE mentors SET password_hash = ?, updated_at = ? WHERE id = ?",
        [trimmedNewPass, nowStr, user.reference_id]
      );
    } else if (user.role === "sme") {
      await db.run(
        "UPDATE sme_users SET password = ? WHERE id = ?",
        [trimmedNewPass, user.reference_id]
      );
    }

    return NextResponse.json({
      success: true,
      message: "Password updated successfully!"
    });
  } catch (error: any) {
    console.error("API POST Change Password error:", error);
    return NextResponse.json({ success: false, message: error.message || "Server error updating password" }, { status: 500 });
  }
}
