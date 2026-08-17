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
      query += " AND (LOWER(email) LIKE ? OR LOWER(reference_id) LIKE ? OR LOWER(id) LIKE ?)";
      countQuery += " AND (LOWER(email) LIKE ? OR LOWER(reference_id) LIKE ? OR LOWER(id) LIKE ?)";
      const term = `%${search}%`;
      params.push(term, term, term);
      countParams.push(term, term, term);
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
    const { userId, action, email, role, password, reference_id, status } = body;

    // 1. Create New User Credential
    if (action === "create") {
      if (!email || !email.trim()) {
        return NextResponse.json({ success: false, message: "Email is required" }, { status: 400 });
      }
      const cleanEmail = email.toLowerCase().trim();
      const existing = await db.get("SELECT id FROM users WHERE LOWER(email) = ?", cleanEmail);
      if (existing) {
        return NextResponse.json({ success: false, message: "A user credential with this email already exists." }, { status: 400 });
      }

      const userRole = (role || "mentor").toLowerCase().trim();
      const refId = (reference_id || "").trim() || `${userRole}_${Date.now()}`;
      const newId = `user_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const passHash = hashPassword(password ? password.trim() : "password123");
      const userStatus = status || "Active";
      const nowStr = new Date().toISOString();

      await db.run(
        `INSERT INTO users (id, email, password_hash, role, reference_id, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [newId, cleanEmail, passHash, userRole, refId, userStatus, nowStr, nowStr]
      );

      // Auto-sync into role-specific tables so new KAMs, CAMs, Mentors appear in dropdowns instantly
      const rawName = body.name || body.userName || cleanEmail.split("@")[0];
      const displayName = rawName.replace(/[._]/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());

      // Safely resolve valid foreign keys for college_id and kam_id
      let safeColId = body.college_id;
      if (safeColId) {
        const validCol = await db.get("SELECT id FROM colleges WHERE id = ?", safeColId);
        if (!validCol) safeColId = null;
      }
      if (!safeColId) {
        const firstCol = await db.get("SELECT id FROM colleges ORDER BY rowid ASC LIMIT 1");
        safeColId = firstCol ? firstCol.id : null;
      }

      let safeKamId = body.kam_id;
      if (safeKamId) {
        const validKam = await db.get("SELECT id FROM kam_users WHERE id = ?", safeKamId);
        if (!validKam) safeKamId = null;
      }
      if (!safeKamId) {
        const firstKam = await db.get("SELECT id FROM kam_users ORDER BY rowid ASC LIMIT 1");
        if (!firstKam) {
          await db.run(
            "INSERT INTO kam_users (id, name, email, title) VALUES (?, ?, ?, ?)",
            ["kam_default", "Default Key Account Manager", "kam.default@faceprep.in", "Key Account Manager"]
          );
          safeKamId = "kam_default";
        } else {
          safeKamId = firstKam.id;
        }
      }

      if (userRole === "kam") {
        const existingKam = await db.get("SELECT id FROM kam_users WHERE id = ? OR LOWER(email) = ?", [refId, cleanEmail]);
        if (!existingKam) {
          await db.run(
            "INSERT INTO kam_users (id, name, email, title) VALUES (?, ?, ?, ?)",
            [refId, displayName + " (KAM)", cleanEmail, "Key Account Manager"]
          );
        }
      } else if (userRole === "cam") {
        const existingCam = await db.get("SELECT id FROM campus_managers WHERE id = ? OR LOWER(email) = ?", [refId, cleanEmail]);
        if (!existingCam && safeColId && safeKamId) {
          await db.run(
            "INSERT INTO campus_managers (id, name, email, college_id, kam_id) VALUES (?, ?, ?, ?, ?)",
            [refId, displayName + " (CM)", cleanEmail, safeColId, safeKamId]
          );
        }
      } else if (userRole === "mentor") {
        const existingMentor = await db.get("SELECT id FROM mentors WHERE id = ? OR LOWER(email) = ?", [refId, cleanEmail]);
        if (!existingMentor && safeColId) {
          await db.run(
            `INSERT INTO mentors (id, name, email, department, avatar, subjects, classes, college_id, status, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              refId,
              displayName,
              cleanEmail,
              body.department || "Computer Science",
              "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150",
              body.subjects || "General Subjects",
              body.classes || "All Classes",
              safeColId,
              userStatus,
              nowStr,
              nowStr
            ]
          );
        }
      } else if (userRole === "sme") {
        const existingSme = await db.get("SELECT id FROM sme_users WHERE id = ? OR LOWER(email) = ?", [refId, cleanEmail]);
        if (!existingSme) {
          await db.run(
            "INSERT INTO sme_users (id, name, email) VALUES (?, ?, ?)",
            [refId, displayName, cleanEmail]
          );
        }
      } else if (userRole === "student") {
        const existingStudent = await db.get("SELECT id FROM students WHERE id = ? OR LOWER(email) = ?", [refId, cleanEmail]);
        if (!existingStudent && safeColId) {
          await db.run(
            "INSERT INTO students (id, name, email, classGroup, college_id) VALUES (?, ?, ?, ?, ?)",
            [refId, displayName, cleanEmail, body.classGroup || "General", safeColId]
          );
        }
      }

      return NextResponse.json({ success: true, message: "User credential created successfully.", id: newId });
    }

    // Actions targeting an existing user by userId / reference_id
    if (!userId || !action) {
      return NextResponse.json({ success: false, message: "Missing userId or action" }, { status: 400 });
    }

    const user = await db.get("SELECT * FROM users WHERE id = ? OR reference_id = ?", [userId, userId]);
    if (!user) {
      return NextResponse.json({ success: false, message: "User credential not found" }, { status: 404 });
    }

    if (action === "toggle_status") {
      const newStatus = user.status === "Active" ? "Inactive" : "Active";
      const nowStr = new Date().toISOString();

      await db.run("UPDATE users SET status = ?, updated_at = ? WHERE id = ?", [newStatus, nowStr, user.id]);
      
      // Sync status to role specific tables
      if (user.role === "student" && user.reference_id) {
        await db.run("UPDATE students SET status = ?, updated_at = ? WHERE id = ?", [newStatus, nowStr, user.reference_id]);
      } else if (user.role === "mentor" && user.reference_id) {
        await db.run("UPDATE mentors SET status = ?, updated_at = ? WHERE id = ?", [newStatus, nowStr, user.reference_id]);
      }

      return NextResponse.json({ success: true, message: `User status changed to ${newStatus}` });
    }

    if (action === "reset_password") {
      const defaultPasswordHash = hashPassword("password123");
      const nowStr = new Date().toISOString();

      await db.run("UPDATE users SET password_hash = ?, must_change_password = 1, updated_at = ? WHERE id = ?", [defaultPasswordHash, nowStr, user.id]);

      // Sync password to role specific tables
      if (user.role === "student" && user.reference_id) {
        await db.run("UPDATE students SET password_hash = ?, updated_at = ? WHERE id = ?", [defaultPasswordHash, nowStr, user.reference_id]);
      } else if (user.role === "mentor" && user.reference_id) {
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

export async function PUT(request: Request) {
  try {
    const db = await getDb();
    const body = await request.json();
    const { id, email, role, reference_id, status, newPassword } = body;

    if (!id || !email) {
      return NextResponse.json({ success: false, message: "User ID and Email are required." }, { status: 400 });
    }

    const existingUser = await db.get("SELECT * FROM users WHERE id = ?", id);
    if (!existingUser) {
      return NextResponse.json({ success: false, message: "User credential not found." }, { status: 404 });
    }

    const cleanEmail = email.toLowerCase().trim();
    const userRole = (role || existingUser.role).toLowerCase().trim();
    const refId = reference_id !== undefined ? reference_id.trim() : existingUser.reference_id;
    const userStatus = status || existingUser.status || "Active";
    const nowStr = new Date().toISOString();

    let passHash = existingUser.password_hash;
    let mustChange = existingUser.must_change_password || 0;
    if (newPassword && newPassword.trim()) {
      passHash = hashPassword(newPassword.trim());
      mustChange = 0;
    }

    await db.run(
      `UPDATE users
       SET email = ?, role = ?, reference_id = ?, status = ?, password_hash = ?, must_change_password = ?, updated_at = ?
       WHERE id = ?`,
      [cleanEmail, userRole, refId, userStatus, passHash, mustChange, nowStr, id]
    );

    return NextResponse.json({ success: true, message: "User credential updated successfully." });
  } catch (error: any) {
    console.error("API PUT Users error:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const db = await getDb();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ success: false, message: "User ID is required." }, { status: 400 });
    }

    const existing = await db.get("SELECT * FROM users WHERE id = ?", id);
    if (!existing) {
      return NextResponse.json({ success: false, message: "User credential not found." }, { status: 404 });
    }

    await db.run("DELETE FROM users WHERE id = ?", id);

    return NextResponse.json({ success: true, message: "User credential deleted successfully." });
  } catch (error: any) {
    console.error("API DELETE Users error:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
