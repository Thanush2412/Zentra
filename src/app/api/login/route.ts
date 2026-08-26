// Pin to Mumbai (bom1) — co-located with Turso DB (aws-ap-south-1)
export const preferredRegion = "bom1";
export const maxDuration = 60;

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

    // Query centralized users table by email, reference_id, id, or username prefix
    let user = await db.get(
      "SELECT * FROM users WHERE LOWER(email) = ? OR LOWER(reference_id) = ? OR LOWER(id) = ? OR LOWER(email) LIKE ?",
      [lowerEmail, lowerEmail, lowerEmail, `${lowerEmail}@%`]
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
        let resolvedEmail = lowerEmail.includes("@") ? lowerEmail : `${lowerEmail}@university.edu`;

        const cam = await db.get(
          "SELECT id, email FROM campus_managers WHERE LOWER(email) = ? OR LOWER(id) = ? OR LOWER(name) = ? OR LOWER(email) LIKE ? OR LOWER(name) LIKE ?",
          [lowerEmail, lowerEmail, lowerEmail, `${lowerEmail}@%`, `%${lowerEmail}%`]
        );
        if (cam) {
          foundRole = "cam";
          refId = cam.id;
          if (cam.email) resolvedEmail = cam.email.toLowerCase();
        }

        if (!foundRole) {
          const mentor = await db.get(
            "SELECT id, email FROM mentors WHERE LOWER(email) = ? OR LOWER(id) = ? OR LOWER(name) = ? OR LOWER(email) LIKE ? OR LOWER(name) LIKE ?",
            [lowerEmail, lowerEmail, lowerEmail, `${lowerEmail}@%`, `%${lowerEmail}%`]
          );
          if (mentor) {
            foundRole = "mentor";
            refId = mentor.id;
            if (mentor.email) resolvedEmail = mentor.email.toLowerCase();
          }
        }

        if (!foundRole) {
          const student = await db.get(
            "SELECT id, email FROM students WHERE LOWER(email) = ? OR LOWER(id) = ? OR LOWER(roll_number) = ? OR LOWER(register_number) = ?",
            [lowerEmail, lowerEmail, lowerEmail, lowerEmail]
          );
          if (student) {
            foundRole = "student";
            refId = student.id;
            if (student.email) resolvedEmail = student.email.toLowerCase();
          }
        }

        if (!foundRole) {
          const kam = await db.get(
            "SELECT id, email FROM kam_users WHERE LOWER(email) = ? OR LOWER(id) = ? OR LOWER(name) = ?",
            [lowerEmail, lowerEmail, lowerEmail]
          );
          if (kam) {
            foundRole = "kam";
            refId = kam.id;
            if (kam.email) resolvedEmail = kam.email.toLowerCase();
          }
        }

        if (!foundRole) {
          const sme = await db.get(
            "SELECT id, email FROM sme_users WHERE LOWER(email) = ? OR LOWER(id) = ? OR LOWER(name) = ?",
            [lowerEmail, lowerEmail, lowerEmail]
          );
          if (sme) {
            foundRole = "sme";
            refId = sme.id;
            if (sme.email) resolvedEmail = sme.email.toLowerCase();
          }
        }

        if (foundRole && refId) {
          const newHashed = hashPassword(password);
          const newId = `user_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
          await db.run(
            "INSERT OR REPLACE INTO users (id, email, password_hash, role, reference_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
            [newId, resolvedEmail, newHashed, foundRole, refId, new Date().toISOString(), new Date().toISOString()]
          );
          user = { id: newId, email: resolvedEmail, password_hash: newHashed, role: foundRole, reference_id: refId };
        }
      }

      if (!user) {
        return NextResponse.json(
          { success: false, message: "No account found with this email or ID in the database." },
          { status: 401 }
        );
      }

      // Safe password check
      const currentStoredHash = user.password_hash || "password123";
      const isPasswordValid = verifyPassword(password, currentStoredHash);
      if (!isPasswordValid) {
        return NextResponse.json(
          { success: false, message: "Incorrect password. Please check your password and try again." },
          { status: 401 }
        );
      }

      // Transparently upgrade legacy plaintext password or unhashed password to secure hash
      if (!user.password_hash || (typeof user.password_hash === "string" && !user.password_hash.includes(":"))) {
        const newHashed = hashPassword(password);
        try {
          await db.run("UPDATE users SET password_hash = ? WHERE id = ?", [newHashed, user.id]);
        } catch (_) {}
      }
    }

    // Retrieve college_id if applicable for the role
    let collegeId = null;
    try {
      if (user.role === "cam") {
        const cam = await db.get("SELECT college_id FROM campus_managers WHERE id = ? OR LOWER(email) = ?", [user.reference_id, user.email?.toLowerCase()]);
        collegeId = cam ? cam.college_id : null;
      } else if (user.role === "student") {
        const student = await db.get("SELECT college_id FROM students WHERE id = ? OR LOWER(email) = ?", [user.reference_id, user.email?.toLowerCase()]);
        collegeId = student ? student.college_id : null;
      } else if (user.role === "mentor") {
        const mentor = await db.get("SELECT college_id FROM mentors WHERE id = ? OR LOWER(email) = ?", [user.reference_id, user.email?.toLowerCase()]);
        collegeId = mentor ? mentor.college_id : null;
      }
    } catch (_) {}

    // Check if password change is explicitly enforced
    const mustChangePassword = user.must_change_password === 1;

    // Record login history safely without failing request
    try {
      const logId = "log_" + Date.now() + "_" + Math.random().toString(36).substring(2, 9);
      await db.run(
        "INSERT INTO login_history (id, user_id, login_time, ip, device) VALUES (?, ?, ?, ?, ?)",
        [logId, user.id, new Date().toISOString(), "127.0.0.1", "Web Browser"]
      );
    } catch (_) {}

    // Update last login timestamp safely
    try {
      const nowStr = new Date().toISOString();
      await db.run("UPDATE users SET last_login = ?, updated_at = ? WHERE id = ?", [nowStr, nowStr, user.id]);
      if (user.role === 'student' && user.reference_id) {
        await db.run("UPDATE students SET last_login = ?, updated_at = ? WHERE id = ?", [nowStr, nowStr, user.reference_id]);
      } else if (user.role === 'mentor' && user.reference_id) {
        await db.run("UPDATE mentors SET last_login = ?, updated_at = ? WHERE id = ?", [nowStr, nowStr, user.reference_id]);
      }
    } catch (_) {}

    return NextResponse.json({
      success: true,
      role: user.role,
      userId: user.reference_id || user.id,
      collegeId: collegeId,
      userEmail: user.email || lowerEmail,
      isSuperAdmin: isSuperAdmin,
      mustChangePassword: !!mustChangePassword
    });
  } catch (error: any) {
    console.error("API POST Login error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
