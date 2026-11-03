export const maxDuration = 60;

import { NextResponse, after } from "next/server";
import { getDb } from "@/lib/db";
import { requireAuth, Role } from "@/lib/authGuard";
import { generateId } from "@/lib/id";
import { renderAnnouncementEmail, BRAND } from "@/lib/mail";

const ANNOUNCE_READ_ROLES: Role[] = [
  "admin", "cm", "kam", "sme", "mentor", "student", "fee_manager", "L and D", "hr"
];

export async function GET(request: Request) {
  const { errorResponse } = await requireAuth(request, {
    allowedRoles: ANNOUNCE_READ_ROLES,
    checkCsrf: false
  });
  if (errorResponse) return errorResponse;

  try {
    const db = await getDb();
    const { searchParams } = new URL(request.url);
    const collegeId = searchParams.get("college_id");
    const targetRole = searchParams.get("target_role");

    let query = "SELECT * FROM announcements WHERE 1=1";
    const params: any[] = [];

    if (collegeId) {
      query += " AND (college_id = ? OR college_id IS NULL)";
      params.push(collegeId);
    }

    if (targetRole) {
      query += " AND (target_role = ? OR target_role = 'All' OR target_role IS NULL)";
      params.push(targetRole);
    }

    query += " ORDER BY created_at DESC";

    const announcements = await db.all(query, params);
    return NextResponse.json({ success: true, announcements });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const { errorResponse } = await requireAuth(request, { allowedRoles: ["admin"] });
  if (errorResponse) return errorResponse;

  try {
    const db = await getDb();
    const body = await request.json();
    const { title, description, created_by, target_role, college_id } = body;

    if (!title) {
      return NextResponse.json({ success: false, message: "Title is required" }, { status: 400 });
    }

    const newId = generateId("ann");
    const nowStr = new Date().toISOString();

    await db.run(
      `INSERT INTO announcements (id, title, description, created_by, target_role, college_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [newId, title, description || null, created_by || "Admin", target_role || "All", college_id || null, nowStr]
    );

    // Email mentors (and other target roles) for this announcement.
    // Only fire emails when a specific college is targeted — system-wide "All"
    // announcements go to potentially hundreds of colleges; those should use
    // the in-app notification system rather than mass email to avoid spam.
    // The directory reads that build the recipient list only feed mail, so they are
    // deferred with the send instead of holding up the admin's POST.
    if (college_id) {
      after(async () => {
        try {
          const { dispatchMail } = await import("@/lib/mailAsync");
          const wantsMentors = !target_role || target_role === "All" || target_role === "mentor";
          const wantsCms = !target_role || target_role === "All" || target_role === "cm";

          const [mentorRows, cmRows] = await db.multiQuery([
            wantsMentors
              ? { sql: "SELECT email FROM mentors WHERE college_id = ? AND email IS NOT NULL AND email != ''", params: [college_id] }
              : { sql: "SELECT 1 WHERE 1=0" },
            wantsCms
              ? { sql: "SELECT email FROM campus_managers WHERE college_id = ? AND email IS NOT NULL AND email != ''", params: [college_id] }
              : { sql: "SELECT 1 WHERE 1=0" },
          ]);

          const recipientEmails = Array.from(
            new Set(
              [...mentorRows, ...cmRows]
                .map((r: any) => r.email)
                .filter(Boolean)
                .map((e: string) => e.toLowerCase().trim())
            )
          );

          if (recipientEmails.length === 0) return;

          const dateStr = new Date().toLocaleDateString("en-IN", {
            day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata"
          });

          await dispatchMail({
            to: recipientEmails[0],       // proper To for the first address
            bcc: recipientEmails.slice(1), // rest in BCC — no roster leak
            subject: `${BRAND.emailPrefix} ${title}`,
            htmlBody: renderAnnouncementEmail({
              recipientName: "Team",
              title,
              message: description || title,
              category: target_role && target_role !== "All" ? `${target_role} Notice` : "University Notice",
              dateStr,
            }),
            context: "announcement-notify",
          });
        } catch (_) {
          /* Announcement is already stored; mail failure must not undo it. */
        }
      });
    }

    return NextResponse.json({ success: true, message: "Announcement created successfully." });
  } catch (error: any) {
    console.error("API POST Announcements error:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const { errorResponse } = await requireAuth(request, { allowedRoles: ["admin"] });
  if (errorResponse) return errorResponse;

  try {
    const db = await getDb();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ success: false, message: "ID is required" }, { status: 400 });
    }

    await db.run("DELETE FROM announcements WHERE id = ?", [id]);

    return NextResponse.json({ success: true, message: "Announcement deleted successfully." });
  } catch (error: any) {
    console.error("API DELETE Announcements error:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
