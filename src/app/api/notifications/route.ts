// Pin to Mumbai (bom1) — co-located with Turso DB (aws-ap-south-1)
export const preferredRegion = "bom1";
export const maxDuration = 60;

import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { sendMail, renderEmailShell } from "@/lib/mail";
import crypto from "crypto";

function genId(prefix = "notif") {
  return `${prefix}_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`;
}

export async function POST(request: Request) {
  try {
    const db = await getDb();
    const body = await request.json();
    const {
      user_id,
      title,
      message,
      link,
      type,
      college_id,
      remind_cam_for_date,
      remind_by_name,
      remind_by_email,
    } = body;

    if (college_id && remind_cam_for_date) {
      const cams = await db.all(
        "SELECT * FROM campus_managers WHERE college_id = ?",
        [college_id]
      );

      if (!cams || cams.length === 0) {
        return NextResponse.json(
          { success: false, message: "No Campus Manager found for this college." },
          { status: 404 }
        );
      }

      const dateStr = remind_cam_for_date;
      const dateObj = new Date(dateStr + "T00:00:00");
      const dateFormatted = dateObj.toLocaleDateString("en-US", {
        weekday: "short",
        year: "numeric",
        month: "short",
        day: "numeric",
      });

      const created_at = new Date().toISOString();
      let notifCount = 0;
      let emailCount = 0;

      for (const cam of cams) {
        const notifId = genId();
        const notifTitle = title || `Day Order Not Configured — ${dateFormatted}`;
        const notifMessage =
          message ||
          `${remind_by_name || "A Mentor"} (${
            remind_by_email || ""
          }) is requesting you to configure the Day Order / Day Type for ${dateFormatted} so that attendance can be saved.`;
        const notifLink = link || `/cam/daily-configs?date=${dateStr}`;
        const notifType = type || "reminder";

        await db.run(
          `INSERT INTO notifications (id, user_id, title, message, is_read, link, type, created_at)
           VALUES (?, ?, ?, ?, 0, ?, ?, ?)`,
          [notifId, cam.id, notifTitle, notifMessage, notifLink, notifType, created_at]
        );
        notifCount++;

        try {
          if (cam.email) {
            const emailHtml = renderEmailShell({
              title: `Reminder: Day Order Not Configured for ${dateFormatted}`,
              badgeText: "Action Required",
              badgeColor: "amber",
              description: `Hi ${cam.name}, you have a new pending action for your campus.`,
              details: [
                { label: "Requesting Mentor", value: remind_by_name || "Faculty Member" },
                { label: "Mentor Email", value: remind_by_email || "—" },
                { label: "Date", value: dateFormatted },
                { label: "Action Required", value: "Configure Day Order / Day Type in the Daily Schedule." },
              ],
              ctaText: "Open Daily Schedule",
              ctaUrl:
                (process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000") +
                `/cam/daily-configs?date=${dateStr}`,
            });
            await sendMail({
              to: cam.email,
              subject: `[Reminder] Day Order Not Configured — ${dateFormatted}`,
              htmlBody: emailHtml,
            });
            emailCount++;
          }
        } catch (emailErr: any) {
          console.warn("Failed to send reminder email to CAM", cam.email, emailErr?.message);
        }
      }

      return NextResponse.json({
        success: true,
        message: `Reminder sent to ${notifCount} CAM(s) (${emailCount} email${
          emailCount === 1 ? "" : "s"
        }).`,
        notifications_created: notifCount,
        emails_sent: emailCount,
      });
    }

    if (!user_id || !title || !message) {
      return NextResponse.json(
        { success: false, message: "Missing user_id, title, or message" },
        { status: 400 }
      );
    }

    const id = genId();
    const created_at = new Date().toISOString();
    const notifType = type || "info";

    await db.run(
      `INSERT INTO notifications (id, user_id, title, message, is_read, link, type, created_at)
       VALUES (?, ?, ?, ?, 0, ?, ?, ?)`,
      [id, user_id, title, message, link || null, notifType, created_at]
    );

    return NextResponse.json({ success: true, id });
  } catch (error: any) {
    console.error("API POST notifications error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const db = await getDb();
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId") || searchParams.get("user_id");

    if (!userId) {
      return NextResponse.json({ success: false, message: "userId or user_id is required" }, { status: 400 });
    }

    const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 100);
    const notifications = await db.all(
      "SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT ?",
      [userId, limit]
    );

    const unreadCount = notifications.filter((n: any) => n.is_read === 0).length;

    return NextResponse.json({ success: true, notifications, unreadCount });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const db = await getDb();
    const body = await request.json();
    const id = body.id || body.notification_id;
    const userId = body.userId || body.user_id;
    const markAllRead = body.markAllRead || body.action === "mark_all_read";
    const singleMark = !markAllRead && id && (body.action === "mark_read" || !body.action);

    if (markAllRead && userId) {
      await db.run("UPDATE notifications SET is_read = 1 WHERE user_id = ?", [userId]);
      return NextResponse.json({ success: true, message: "All notifications marked as read" });
    }

    if (singleMark) {
      await db.run("UPDATE notifications SET is_read = 1 WHERE id = ?", [id]);
      return NextResponse.json({ success: true, message: "Notification marked as read" });
    }

    return NextResponse.json({ success: false, message: "Missing id or markAllRead+userId" }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
