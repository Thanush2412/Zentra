import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function POST(request: Request) {
  try {
    const db = await getDb();
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json({ success: false, message: "Missing email or password" }, { status: 400 });
    }

    const lowerEmail = email.toLowerCase().trim();

    // Query centralized users table by email or reference_id/id
    const user = await db.get(
      "SELECT * FROM users WHERE LOWER(email) = ? OR LOWER(reference_id) = ? OR LOWER(id) = ?",
      [lowerEmail, lowerEmail, lowerEmail]
    );

    if (!user) {
      return NextResponse.json({ success: false, message: "No account found with this email or ID in the database." });
    }

    if (password !== user.password_hash) {
      return NextResponse.json({ success: false, message: "Incorrect password. Please try again." });
    }

    // Retrieve college_id if applicable for the role
    let collegeId = null;
    if (user.role === "cam") {
      const cam = await db.get("SELECT college_id FROM campus_managers WHERE id = ?", user.reference_id);
      collegeId = cam ? cam.college_id : null;
    } else if (user.role === "student") {
      const student = await db.get("SELECT college_id FROM students WHERE id = ?", user.reference_id);
      collegeId = student ? student.college_id : null;
    } else if (user.role === "mentor") {
      const mentor = await db.get("SELECT college_id FROM mentors WHERE id = ?", user.reference_id);
      collegeId = mentor ? mentor.college_id : null;
    }

    // Record login history
    const logId = "log_" + Date.now() + "_" + Math.random().toString(36).substring(2, 9);
    await db.run(
      "INSERT INTO login_history (id, user_id, login_time, ip, device) VALUES (?, ?, ?, ?, ?)",
      [logId, user.id, new Date().toISOString(), "127.0.0.1", "Web Browser"]
    );

    // Update last login timestamp
    const nowStr = new Date().toISOString();
    await db.run("UPDATE users SET last_login = ?, updated_at = ? WHERE id = ?", [nowStr, nowStr, user.id]);
    if (user.role === 'student') {
      await db.run("UPDATE students SET last_login = ?, updated_at = ? WHERE id = ?", [nowStr, nowStr, user.reference_id]);
    } else if (user.role === 'mentor') {
      await db.run("UPDATE mentors SET last_login = ?, updated_at = ? WHERE id = ?", [nowStr, nowStr, user.reference_id]);
    }

    return NextResponse.json({
      success: true,
      role: user.role,
      userId: user.reference_id,
      collegeId: collegeId
    });
  } catch (error: any) {
    console.error("API POST Login error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
