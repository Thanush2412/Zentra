// Pin to Mumbai (bom1) — co-located with Turso DB (aws-ap-south-1)
export const preferredRegion = "bom1";
export const maxDuration = 60;

import crypto from "crypto";
import { NextResponse } from "next/server";
import { getDb, PostgresDbAdapter } from "@/lib/db";
import { verifyPassword, hashPassword } from "@/lib/auth";
import { SUPER_ADMIN_ROLE, roleGrantsSuperAdmin } from "@/lib/superadmin";

/** Profile tables that hold a display name for each role (whitelisted — never user input). */
const ROLE_PROFILE_TABLES: Record<string, string> = {
  admin: "admin_users",
  cam: "campus_managers",
  mentor: "mentors",
  student: "students",
  kam: "kam_users",
  sme: "sme_users",
};

/** Constant-time string comparison that never throws on length mismatch. */
function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  try {
    return crypto.timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

/**
 * Opt-in break-glass owner account.
 * Only active when SUPER_ADMIN_EMAIL + SUPER_ADMIN_PASSWORD are configured in the
 * environment and the submitted credentials match exactly — no identity is hardcoded here.
 */
function matchesConfiguredSuperAdmin(email: string, password: string): boolean {
  const configuredEmail = (process.env.SUPER_ADMIN_EMAIL || "").toLowerCase().trim();
  const configuredPassword = process.env.SUPER_ADMIN_PASSWORD || "";
  if (!configuredEmail || !configuredPassword) return false;
  return safeEqual(email, configuredEmail) && safeEqual(password, configuredPassword);
}

/** Creates (or repairs) the super-admin account plus its admin_users profile row. */
async function provisionSuperAdmin(db: PostgresDbAdapter, email: string, password: string) {
  const now = new Date().toISOString();
  const hashed = hashPassword(password);
  const name = (process.env.SUPER_ADMIN_NAME || "Super Admin").trim();

  const existingProfile = await db.get("SELECT id, name FROM admin_users WHERE LOWER(email) = ?", [email]);
  const profileId = existingProfile?.id || `admin_${crypto.randomUUID().slice(0, 8)}`;

  if (!existingProfile) {
    await db.run("INSERT INTO admin_users (id, name, email) VALUES (?, ?, ?)", [profileId, name, email]);
  }

  const existingUser = await db.get("SELECT id FROM users WHERE LOWER(email) = ?", [email]);
  if (existingUser) {
    await db.run(
      "UPDATE users SET password_hash = ?, role = ?, reference_id = ?, updated_at = ? WHERE id = ?",
      [hashed, SUPER_ADMIN_ROLE, profileId, now, existingUser.id]
    );
    return { id: existingUser.id, email, password_hash: hashed, role: SUPER_ADMIN_ROLE, reference_id: profileId };
  }

  const userId = `user_admin_${crypto.randomUUID().slice(0, 8)}`;
  await db.run(
    "INSERT INTO users (id, email, password_hash, role, reference_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [userId, email, hashed, SUPER_ADMIN_ROLE, profileId, now, now]
  );
  return { id: userId, email, password_hash: hashed, role: SUPER_ADMIN_ROLE, reference_id: profileId };
}

/** Best-effort display name for the header/profile chip. */
interface LoginUser {
  id?: string;
  role?: string | null;
  reference_id?: string | null;
  email?: string | null;
}

async function resolveDisplayName(db: PostgresDbAdapter, user: LoginUser): Promise<string | null> {
  try {
    const table = ROLE_PROFILE_TABLES[String(user.role || "").toLowerCase()];
    if (!table) return null;
    const row = await db.get(
      `SELECT name FROM ${table} WHERE id = ? OR LOWER(email) = ?`,
      [user.reference_id || user.id, String(user.email || "").toLowerCase()]
    );
    return row?.name || null;
  } catch {
    return null;
  }
}

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

    // Query centralized users table by email, reference_id, id, or username prefix
    let user = await db.get(
      "SELECT * FROM users WHERE LOWER(email) = ? OR LOWER(reference_id) = ? OR LOWER(id) = ? OR LOWER(email) LIKE ?",
      [lowerEmail, lowerEmail, lowerEmail, `${lowerEmail}@%`]
    );

    // Opt-in break-glass path — repairs the owner account when env credentials match exactly
    if (!user && matchesConfiguredSuperAdmin(lowerEmail, password)) {
      user = await provisionSuperAdmin(db, lowerEmail, password);
    }

    // Auto-provision user record if present in role tables but missing from centralized users table
    if (!user) {
      let resolvedEmail = lowerEmail.includes("@") ? lowerEmail : `${lowerEmail}@university.edu`;

      // ── Parallel role lookup — all 5 tables queried in one round-trip ──
      const [cam, mentor, student, kam, sme] = await Promise.all([
        db.get(
          "SELECT id, email FROM campus_managers WHERE LOWER(email) = ? OR LOWER(id) = ? OR LOWER(name) = ? OR LOWER(email) LIKE ? OR LOWER(name) LIKE ?",
          [lowerEmail, lowerEmail, lowerEmail, `${lowerEmail}@%`, `%${lowerEmail}%`]
        ),
        db.get(
          "SELECT id, email FROM mentors WHERE LOWER(email) = ? OR LOWER(id) = ? OR LOWER(name) = ? OR LOWER(email) LIKE ? OR LOWER(name) LIKE ?",
          [lowerEmail, lowerEmail, lowerEmail, `${lowerEmail}@%`, `%${lowerEmail}%`]
        ),
        db.get(
          "SELECT id, email FROM students WHERE LOWER(email) = ? OR LOWER(id) = ? OR LOWER(roll_number) = ? OR LOWER(register_number) = ?",
          [lowerEmail, lowerEmail, lowerEmail, lowerEmail]
        ),
        db.get(
          "SELECT id, email FROM kam_users WHERE LOWER(email) = ? OR LOWER(id) = ? OR LOWER(name) = ?",
          [lowerEmail, lowerEmail, lowerEmail]
        ),
        db.get(
          "SELECT id, email FROM sme_users WHERE LOWER(email) = ? OR LOWER(id) = ? OR LOWER(name) = ?",
          [lowerEmail, lowerEmail, lowerEmail]
        )
      ]);

      // Priority: CAM > Mentor > Student > KAM > SME
      const resolved = cam     ? { role: "cam",     record: cam }
                     : mentor  ? { role: "mentor",  record: mentor }
                     : student ? { role: "student", record: student }
                     : kam     ? { role: "kam",     record: kam }
                     : sme     ? { role: "sme",     record: sme }
                     : null;

      let foundRole: string | null = null;
      let refId: string | null = null;
      if (resolved) {
        foundRole = resolved.role;
        refId = resolved.record.id;
        if (resolved.record.email) resolvedEmail = resolved.record.email.toLowerCase();
      }

      if (foundRole && refId) {
        const newHashed = hashPassword(password);
        const newId = `user_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        await db.run(
          `INSERT INTO users (id, email, password_hash, role, reference_id, created_at, updated_at) 
           VALUES (?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT (id) DO UPDATE SET
             email = EXCLUDED.email,
             password_hash = EXCLUDED.password_hash,
             role = EXCLUDED.role,
             reference_id = EXCLUDED.reference_id,
             updated_at = EXCLUDED.updated_at`,
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

    // Every account — including the owner account — verifies its stored hash. No bypass.
    if (!user.password_hash) {
      return NextResponse.json(
        { success: false, message: "No password is set for this account. Please ask an administrator to reset it." },
        { status: 401 }
      );
    }

    if (!verifyPassword(password, user.password_hash)) {
      return NextResponse.json(
        { success: false, message: "Incorrect password. Please check your password and try again." },
        { status: 401 }
      );
    }

    // Transparently upgrade legacy plaintext password or unhashed password to secure hash
    if (!String(user.password_hash).includes(":")) {
      const newHashed = hashPassword(password);
      try {
        await db.run("UPDATE users SET password_hash = ? WHERE id = ?", [newHashed, user.id]);
      } catch (_) {}
    }

    // Super admin is derived purely from the stored role — never from the email address
    const isSuperAdmin = roleGrantsSuperAdmin(user.role);

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

    const userName = await resolveDisplayName(db, user);

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
      userName: userName,
      isSuperAdmin: isSuperAdmin,
      mustChangePassword: !!mustChangePassword
    });
  } catch (error: any) {
    console.error("API POST Login error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
