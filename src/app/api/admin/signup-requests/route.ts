import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET() {
  try {
    const db = await getDb();
    const requests = await db.all("SELECT * FROM signup_requests ORDER BY created_at DESC");
    return NextResponse.json({ success: true, signupRequests: requests });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const db = await getDb();
    const body = await request.json();
    const { id, action, role, mappingType, selectedReferenceId, collegeId, group, classGroup } = body;

    if (!id || !action) {
      return NextResponse.json({ success: false, message: "Missing id or action" }, { status: 400 });
    }

    const req = await db.get("SELECT * FROM signup_requests WHERE id = ?", [id]);
    if (!req) {
      return NextResponse.json({ success: false, message: "Signup request not found" }, { status: 404 });
    }

    if (action === "reject") {
      await db.run("UPDATE signup_requests SET status = 'rejected' WHERE id = ?", [id]);
      return NextResponse.json({ success: true, message: "Request rejected successfully." });
    }

    if (action === "approve") {
      const targetRole = role || req.requested_role;
      let referenceId = null;

      if (mappingType === "link_existing") {
        if (!selectedReferenceId) {
          return NextResponse.json({ success: false, message: "Missing reference ID for existing profile mapping." }, { status: 400 });
        }
        referenceId = selectedReferenceId;
      } else {
        // Create new profile dynamically
        const newId = targetRole + "_" + Date.now();
        referenceId = newId;

        if (targetRole === "mentor") {
          const avatarUrl = `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(req.name)}`;
          await db.run(
            `INSERT INTO mentors (id, name, email, department, avatar, college_id, joining_date, status, password_hash, subject_group)
             VALUES (?, ?, ?, ?, ?, ?, ?, 'Active', ?, ?)`,
            [
              newId,
              req.name,
              req.email,
              "General",
              avatarUrl,
              collegeId || null,
              new Date().toISOString().split("T")[0],
              req.password_hash,
              group || null
            ]
          );
        } else if (targetRole === "student") {
          const avatarUrl = `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(req.name)}`;
          await db.run(
            `INSERT INTO students (id, name, email, classGroup, department, college_id, batch_start_year, batch_end_year, semester, avatar, status, password_hash)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Semester 1', ?, 'Active', ?)`,
            [
              newId,
              req.name,
              req.email,
              classGroup || "General",
              group || "General",
              collegeId || null,
              new Date().getFullYear(),
              new Date().getFullYear() + 1,
              avatarUrl,
              req.password_hash
            ]
          );
        } else if (targetRole === "cam") {
          if (!collegeId) {
            return NextResponse.json({ success: false, message: "A college must be assigned to create a Campus Manager profile." }, { status: 400 });
          }
          // Get a default KAM to link to
          const kam = await db.get("SELECT id FROM kam_users LIMIT 1");
          const kamId = kam ? kam.id : "kam_1";
          
          await db.run(
            `INSERT INTO campus_managers (id, name, email, college_id, kam_id)
             VALUES (?, ?, ?, ?, ?)`,
            [newId, req.name, req.email, collegeId, kamId]
          );

          // Update college manager name
          await db.run("UPDATE colleges SET manager = ? WHERE id = ?", [req.name, collegeId]);
        } else if (targetRole === "sme") {
          await db.run(
            `INSERT INTO sme_users (id, name, email, subject)
             VALUES (?, ?, ?, ?)`,
            [newId, req.name, req.email, "General"]
          );
        }
      }

      // Check if user already exists
      const existingUser = await db.get("SELECT id FROM users WHERE LOWER(email) = ?", [req.email.toLowerCase()]);
      if (existingUser) {
        return NextResponse.json({ success: false, message: "An account with this email is already registered." }, { status: 400 });
      }

      // Insert credentials into users
      const userId = "u_" + Date.now();
      await db.run(
        `INSERT INTO users (id, email, password_hash, role, reference_id, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 'Active', datetime('now'), datetime('now'))`,
        [userId, req.email.toLowerCase(), req.password_hash, targetRole, referenceId]
      );

      // Update signup request status
      await db.run("UPDATE signup_requests SET status = 'approved' WHERE id = ?", [id]);

      return NextResponse.json({ success: true, message: `Request approved and mapped as ${targetRole}!` });
    }

    return NextResponse.json({ success: false, message: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const db = await getDb();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ success: false, message: "ID is required" }, { status: 400 });
    }

    await db.run("DELETE FROM signup_requests WHERE id = ?", [id]);
    return NextResponse.json({ success: true, message: "Request deleted successfully" });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
