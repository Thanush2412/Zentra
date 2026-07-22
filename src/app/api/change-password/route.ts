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
    try {
      // Try with the must_change_password column
      await db.run(
        "UPDATE users SET password_hash = ?, must_change_password = 0, updated_at = ? WHERE id = ?",
        [trimmedNewPass, nowStr, user.id]
      );
    } catch (error: any) {
      if (error.message?.includes('no such column: must_change_password')) {
        // Fallback: Update without the must_change_password column
        console.log("Column must_change_password doesn't exist, updating without it");
        await db.run(
          "UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?",
          [trimmedNewPass, nowStr, user.id]
        );
        
        // Try to add the column now
        try {
          await db.exec("ALTER TABLE users ADD COLUMN must_change_password BOOLEAN DEFAULT 0;");
          await db.exec("ALTER TABLE users ADD COLUMN last_login TEXT DEFAULT NULL;");
          console.log("Successfully added missing columns to users table");
        } catch (migrationError: any) {
          console.log("Migration attempt failed:", migrationError.message);
        }
      } else {
        throw error; // Re-throw if it's a different error
      }
    }

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
