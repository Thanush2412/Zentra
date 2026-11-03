export const maxDuration = 60;

import { NextResponse } from "next/server";
import { getDb, type QueryFailure } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { DEFAULT_PASSWORD } from "@/lib/authConfig";
import { requireAuth } from "@/lib/authGuard";
import { requireKamScope } from "@/lib/kamScope";

// GET /api/kam?id=kam_1  — returns KAM profile + all colleges + campus managers under them
export async function GET(request: Request) {
  try {
    const db = await getDb();
    const { scope, errorResponse } = await requireKamScope(request, db);
    if (errorResponse) return errorResponse;

    const { searchParams } = new URL(request.url);

    // Admin directory view. The KAM tab lists KAM profiles, which live in
    // kam_users, not in the users credential table. A KAM session is pinned to
    // its own portfolio and must not enumerate peers.
    if (searchParams.get("all") === "1") {
      if (scope!.kamId) {
        return NextResponse.json({ success: false, message: "You can only view your own portfolio." }, { status: 403 });
      }
      // Union profile rows with credential-only KAMs: legacy data can contain a
      // role=kam login whose kam_users row was never written, and hiding it here
      // would make the account unmanageable from the admin panel.
      const failures: QueryFailure[] = [];
      const [kamProfiles, kamCredentials] = await db.multiQuery(
        [
          { sql: "SELECT id, name, email, title FROM kam_users ORDER BY name" },
          { sql: "SELECT id, email, reference_id FROM users WHERE LOWER(role) = 'kam' ORDER BY email" },
        ],
        failures
      );
      if (failures.length > 0) {
        return NextResponse.json({ success: false, message: "The KAM directory could not be loaded. Please retry." }, { status: 500 });
      }

      const byId = new Map<string, { id: string; name: string; email: string; title: string }>();
      const seenEmails = new Set<string>();
      for (const k of kamProfiles) {
        const email = String(k.email || "");
        byId.set(String(k.id), {
          id: String(k.id),
          name: k.name || (email ? email.split("@")[0] : "—"),
          email,
          title: k.title || "Key Account Manager",
        });
        if (email) seenEmails.add(email.toLowerCase());
      }
      for (const c of kamCredentials) {
        const email = String(c.email || "");
        const key = String(c.reference_id || c.id);
        // A legacy credential may point at its profile only by email (reference_id
        // never recorded), so match on both or the same KAM appears twice.
        if (byId.has(key) || (email && seenEmails.has(email.toLowerCase()))) continue;
        byId.set(key, {
          id: key,
          name: email ? email.split("@")[0] : "—",
          email,
          title: "Key Account Manager",
        });
        if (email) seenEmails.add(email.toLowerCase());
      }
      const kamUsers = Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name));
      return NextResponse.json({ success: true, kamUsers });
    }

    const requestedKamId = searchParams.get("id");
    if (scope!.kamId && requestedKamId && requestedKamId !== scope!.kamId) {
      return NextResponse.json({ success: false, message: "You can only view your own portfolio." }, { status: 403 });
    }
    const kamId = scope!.kamId || requestedKamId;

    if (!kamId) {
      return NextResponse.json({ success: false, message: "KAM id required" }, { status: 400 });
    }

    const kam = await db.get(
      "SELECT * FROM kam_users WHERE id = ? OR email = ? OR id IN (SELECT reference_id FROM users WHERE id = ? OR email = ?)",
      [kamId, kamId, kamId, kamId]
    );
    if (!kam) {
      return NextResponse.json({ success: false, message: "KAM not found" }, { status: 404 });
    }

    const resolvedKamId = kam.id;

    // Everything below keys on resolvedKamId only, so the five reads are independent of
    // each other and go out as one batched group (six sequential round trips used to make
    // this dashboard the slowest KAM screen).
    const failedSlices: QueryFailure[] = [];
    const [colleges, campusManagers, departments, totalMentorsRow, totalSlotsRow] = await db.multiQuery([
      // All colleges under this KAM
      {
        sql: `
      SELECT 
        c.id, c.name, c.address,
        (SELECT COUNT(*) FROM departments d WHERE d.college_id = c.id) as dept_count,
        (SELECT COUNT(*) FROM mentors m WHERE m.college_id = c.id) as mentor_count,
        (SELECT COUNT(*) FROM slots s JOIN mentors m ON s.mentorId = m.id WHERE m.college_id = c.id) as slot_count
      FROM colleges c WHERE c.kam_id = ?
      ORDER BY c.name
    `,
        params: [resolvedKamId]
      },
      // All campus managers under this KAM
      {
        sql: `
      SELECT cm.*, co.name as college_name
      FROM campus_managers cm
      JOIN colleges co ON cm.college_id = co.id
      WHERE cm.kam_id = ?
      ORDER BY cm.name
    `,
        params: [resolvedKamId]
      },
      // All departments across all colleges under KAM
      {
        sql: `
      SELECT d.*, c.name as college_name
      FROM departments d
      JOIN colleges c ON d.college_id = c.id
      WHERE c.kam_id = ?
      ORDER BY c.name, d.name
    `,
        params: [resolvedKamId]
      },
      // Aggregate stats
      {
        sql: `
      SELECT COUNT(*) as count FROM mentors m
      JOIN colleges c ON m.college_id = c.id
      WHERE c.kam_id = ?
    `,
        params: [resolvedKamId]
      },
      {
        sql: `
      SELECT COUNT(*) as count FROM slots s
      JOIN mentors m ON s.mentorId = m.id
      JOIN colleges c ON m.college_id = c.id
      WHERE c.kam_id = ?
    `,
        params: [resolvedKamId]
      }
    ], failedSlices);

    if (failedSlices.length > 0) {
      console.error("GET /api/kam partial read:", failedSlices.map(f => `${f.sql.trim().slice(0, 60)} → ${f.error}`).join(" | "));
      return NextResponse.json(
        { success: false, message: "KAM portfolio could not be loaded. Please retry." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      kam: { ...kam, role: "kam" },
      colleges,
      campusManagers,
      departments,
      stats: {
        totalColleges: colleges.length,
        totalDepts: departments.length,
        totalMentors: totalMentorsRow?.[0]?.count || 0,
        totalSlots: totalSlotsRow?.[0]?.count || 0
      }
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { errorResponse } = await requireAuth(request, { allowedRoles: ["admin"] });
    if (errorResponse) return errorResponse;

    const db = await getDb();
    const body = await request.json();
    const { id, name, email, title } = body;
    if (!id || !name || !email) {
      return NextResponse.json({ success: false, message: "Missing required fields" }, { status: 400 });
    }

    const cleanId = id.trim();
    const cleanEmail = email.trim().toLowerCase();
    const cleanTitle = title ? title.trim() : "Key Account Manager";

    const failures: QueryFailure[] = [];
    const [idRows, kamEmailRows, credentialRows, credentialIdRows] = await db.multiQuery(
      [
        { sql: "SELECT id FROM kam_users WHERE id = ?", params: [cleanId] },
        { sql: "SELECT id FROM kam_users WHERE LOWER(email) = ?", params: [cleanEmail] },
        { sql: "SELECT id FROM users WHERE LOWER(email) = ?", params: [cleanEmail] },
        { sql: "SELECT id FROM users WHERE id = ?", params: [cleanId] },
      ],
      failures
    );
    if (failures.length > 0) {
      return NextResponse.json(
        { success: false, message: "Could not verify this KAM against the directory. Please try again." },
        { status: 500 }
      );
    }
    if (idRows.length > 0 || credentialIdRows.length > 0) {
      return NextResponse.json({ success: false, message: `A KAM or login with ID "${cleanId}" already exists.` }, { status: 400 });
    }
    if (kamEmailRows.length > 0 || credentialRows.length > 0) {
      return NextResponse.json(
        { success: false, message: "A KAM or user credential with this email already exists." },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();
    // Profile and login land together: a KAM row without a credential can never
    // sign in and is invisible to the Users directory.
    await db.transaction(async (tx) => {
      await tx.run(
        "INSERT INTO kam_users (id, name, email, title) VALUES (?, ?, ?, ?)",
        [cleanId, name.trim(), cleanEmail, cleanTitle]
      );
      await tx.run(
        `INSERT INTO users (id, email, password_hash, role, reference_id, status, must_change_password, created_at, updated_at)
         VALUES (?, ?, ?, 'kam', ?, 'Active', 1, ?, ?)`,
        [cleanId, cleanEmail, hashPassword(DEFAULT_PASSWORD), cleanId, now, now]
      );
    });

    return NextResponse.json({ success: true, message: "KAM created successfully" });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const { errorResponse } = await requireAuth(request, { allowedRoles: ["admin"] });
    if (errorResponse) return errorResponse;

    const db = await getDb();
    const body = await request.json();
    const { id, name, email, title } = body;
    if (!id || !name || !email) {
      return NextResponse.json({ success: false, message: "Missing required fields" }, { status: 400 });
    }

    const cleanId = id.trim();
    const cleanEmail = email.trim().toLowerCase();
    const cleanTitle = title ? title.trim() : "Key Account Manager";

    const kam = await db.get("SELECT id FROM kam_users WHERE id = ?", cleanId);
    if (!kam) {
      // A credential-only KAM is editable: saving writes the missing profile.
      const credentialOnly = await db.get(
        "SELECT id FROM users WHERE LOWER(role) = 'kam' AND (id = ? OR reference_id = ?) LIMIT 1",
        [cleanId, cleanId]
      );
      if (!credentialOnly) {
        return NextResponse.json({ success: false, message: "KAM not found" }, { status: 404 });
      }
    }

    const conflict = await db.get(
      "SELECT id FROM users WHERE LOWER(email) = ? AND COALESCE(reference_id, '') <> ? AND id <> ? LIMIT 1",
      [cleanEmail, cleanId, cleanId]
    );
    if (conflict) {
      return NextResponse.json(
        { success: false, message: "Another user credential already uses this email." },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();
    await db.transaction(async (tx) => {
      if (kam) {
        await tx.run(
          "UPDATE kam_users SET name = ?, email = ?, title = ? WHERE id = ?",
          [name.trim(), cleanEmail, cleanTitle, cleanId]
        );
      } else {
        await tx.run(
          "INSERT INTO kam_users (id, name, email, title) VALUES (?, ?, ?, ?)",
          [cleanId, name.trim(), cleanEmail, cleanTitle]
        );
      }
      // Keep the login identity aligned with the profile.
      const credential = await tx.get(
        "SELECT id FROM users WHERE id = ? OR reference_id = ? OR (role = 'kam' AND LOWER(email) = ?) LIMIT 1",
        [cleanId, cleanId, cleanEmail]
      );
      if (credential) {
        await tx.run(
          "UPDATE users SET email = ?, role = 'kam', reference_id = ?, updated_at = ? WHERE id = ?",
          [cleanEmail, cleanId, now, credential.id]
        );
      } else {
        await tx.run(
          `INSERT INTO users (id, email, password_hash, role, reference_id, status, must_change_password, created_at, updated_at)
           VALUES (?, ?, ?, 'kam', ?, 'Active', 1, ?, ?)`,
          [cleanId, cleanEmail, hashPassword(DEFAULT_PASSWORD), cleanId, now, now]
        );
      }
    });

    return NextResponse.json({ success: true, message: "KAM updated successfully" });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { errorResponse } = await requireAuth(request, { allowedRoles: ["admin"] });
    if (errorResponse) return errorResponse;

    const db = await getDb();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ success: false, message: "KAM id required" }, { status: 400 });
    }
    const kam = await db.get("SELECT id, email FROM kam_users WHERE id = ?", id);
    const credentialOnly = kam
      ? null
      : await db.get(
        "SELECT id, email FROM users WHERE LOWER(role) = 'kam' AND (id = ? OR reference_id = ?) LIMIT 1",
        [id, id]
      );
    if (!kam && !credentialOnly) {
      return NextResponse.json({ success: false, message: "KAM not found" }, { status: 404 });
    }
    const college = await db.get("SELECT * FROM colleges WHERE kam_id = ?", id);
    if (college) {
      return NextResponse.json({ success: false, message: "Cannot delete KAM: they are assigned to one or more campuses. Reassign the campuses first." });
    }
    // Credential and profile go together: a deleted KAM must not keep a working
    // login, and a profile left behind would resurrect them in the directory.
    await db.transaction(async (tx) => {
      await tx.run(
        "DELETE FROM users WHERE id = ? OR reference_id = ? OR (role = 'kam' AND LOWER(email) = ?)",
        [id, id, String(kam?.email || credentialOnly?.email || "").toLowerCase()]
      );
      await tx.run("DELETE FROM kam_users WHERE id = ?", [id]);
    });
    return NextResponse.json({ success: true, message: "KAM deleted successfully" });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
