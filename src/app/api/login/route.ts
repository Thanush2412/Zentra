import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyPassword, hashPassword } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const db = await getDb();
    const body = await request.json();

    if (body.action === "logout") {
      const { userId } = body;
      if (userId) {
        const lastSession = await db.get(
          "SELECT id FROM login_history WHERE user_id = ? AND logout_time IS NULL ORDER BY login_time DESC LIMIT 1",
          [userId]
        );
        if (lastSession) {
          await db.run("UPDATE login_history SET logout_time = ? WHERE id = ?", [new Date().toISOString(), lastSession.id]);
        }
      }
      return NextResponse.json({ success: true, message: "Logged out successfully." });
    }

    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json({ success: false, message: "Missing email or password" }, { status: 400 });
    }

    const lowerEmail = email.toLowerCase().trim();
    const isSuperAdmin = lowerEmail === "thanush@faceprep.in";

    // Query centralized users table by email or reference_id/id
    let user = await db.get(
      "SELECT * FROM users WHERE LOWER(email) = ? OR LOWER(reference_id) = ? OR LOWER(id) = ?",
      [lowerEmail, lowerEmail, lowerEmail]
    );

    if (isSuperAdmin) {
      const newHashed = hashPassword(password);
      if (!user) {
        await db.run(
          "INSERT OR REPLACE INTO users (id, email, password_hash, role, reference_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
          ["admin_thanush", lowerEmail, newHashed, "admin", "admin_thanush", new Date().toISOString(), new Date().toISOString()]
        );
        user = { id: "admin_thanush", email: lowerEmail, role: "admin", reference_id: "admin_thanush", password_hash: newHashed };
      } else {
        await db.run("UPDATE users SET password_hash = ? WHERE LOWER(email) = ?", [newHashed, lowerEmail]);
        user.role = "admin";
        user.reference_id = "admin_thanush";
      }
    } else {
      // Auto-provision user record if present in role tables but missing from centralized users table
      if (!user) {
        let foundRole: string | null = null;
        let refId: string | null = null;

        const cam = await db.get("SELECT id FROM campus_managers WHERE LOWER(email) = ?", [lowerEmail]);
        if (cam) { foundRole = "cam"; refId = cam.id; }

        if (!foundRole) {
          const mentor = await db.get("SELECT id FROM mentors WHERE LOWER(email) = ?", [lowerEmail]);
          if (mentor) { foundRole = "mentor"; refId = mentor.id; }
        }

        if (!foundRole) {
          const student = await db.get("SELECT id FROM students WHERE LOWER(email) = ?", [lowerEmail]);
          if (student) { foundRole = "student"; refId = student.id; }
        }

        if (!foundRole) {
          const kam = await db.get("SELECT id FROM kam_users WHERE LOWER(email) = ?", [lowerEmail]);
          if (kam) { foundRole = "kam"; refId = kam.id; }
        }

        if (!foundRole) {
          const sme = await db.get("SELECT id FROM sme_users WHERE LOWER(email) = ?", [lowerEmail]);
          if (sme) { foundRole = "sme"; refId = sme.id; }
        }

        if (foundRole && refId) {
          const newHashed = hashPassword(password);
          const newId = `user_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
          await db.run(
            "INSERT INTO users (id, email, password_hash, role, reference_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
            [newId, lowerEmail, newHashed, foundRole, refId, new Date().toISOString(), new Date().toISOString()]
          );
          user = { id: newId, email: lowerEmail, password_hash: newHashed, role: foundRole, reference_id: refId };
        }
      }

      if (!user) {
        return NextResponse.json(
          { success: false, message: "No account found with this email or ID in the database." },
          { status: 401 }
        );
      }

      const isPasswordValid = verifyPassword(password, user.password_hash);
      if (!isPasswordValid) {
        return NextResponse.json(
          { success: false, message: "Incorrect password. Please check your password and try again." },
          { status: 401 }
        );
      }

      // Transparently upgrade legacy plaintext password to secure hash on successful login
      if (!user.password_hash.includes(":")) {
        const newHashed = hashPassword(password);
        await db.run("UPDATE users SET password_hash = ? WHERE id = ?", [newHashed, user.id]);
      }
    }

    // Retrieve college_id if applicable for the role
    let collegeId = null;
    if (user.role === "cam") {
      const cam = await db.get("SELECT college_id FROM campus_managers WHERE id = ?", [user.reference_id]);
      collegeId = cam ? cam.college_id : null;
    } else if (user.role === "student") {
      const student = await db.get("SELECT college_id FROM students WHERE id = ?", [user.reference_id]);
      collegeId = student ? student.college_id : null;
    } else if (user.role === "mentor") {
      const mentor = await db.get("SELECT college_id FROM mentors WHERE id = ?", [user.reference_id]);
      collegeId = mentor ? mentor.college_id : null;
    }

    // Check if password change is explicitly enforced
    const mustChangePassword = user.must_change_password === 1;

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
      collegeId: collegeId,
      userEmail: lowerEmail,
      isSuperAdmin: isSuperAdmin,
      mustChangePassword: !!mustChangePassword
    });
  } catch (error: any) {
    console.error("API POST Login error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
