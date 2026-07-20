import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { sendMail, formatZentraEmail } from "@/lib/mail";

export async function GET(request: Request) {
  try {
    const db = await getDb();
    const { searchParams } = new URL(request.url);
    const collegeId = searchParams.get("college_id");

    if (!collegeId) {
      return NextResponse.json({ success: false, message: "college_id is required" }, { status: 400 });
    }

    const configs = await db.all(
      "SELECT * FROM campus_daily_configs WHERE college_id = ? ORDER BY dateStr DESC LIMIT 30",
      collegeId
    );

    return NextResponse.json({ success: true, configs });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const db = await getDb();
    const body = await request.json();
    const { college_id, dateStr, day_type, day_order, notes, session_mode } = body;

    if (!college_id || !dateStr || !day_type || !day_order) {
      return NextResponse.json({ success: false, message: "Missing required fields" }, { status: 400 });
    }

    const id = `${college_id}_${dateStr}`;
    
    await db.run(
      `INSERT OR REPLACE INTO campus_daily_configs (id, college_id, dateStr, day_type, day_order, session_mode, notes, updated_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      id, college_id, dateStr, day_type, day_order, session_mode || "Offline", notes || ""
    );

    // 1. Insert Database Notifications for all Students & Mentors of this college
    try {
      const users = await db.all(
        `SELECT id FROM users WHERE reference_id IN (SELECT id FROM mentors WHERE college_id = ?)
         UNION
         SELECT id FROM users WHERE reference_id IN (SELECT id FROM students WHERE college_id = ?)`,
        college_id
      );

      for (const u of users) {
        const notifId = "n_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5);
        const displayType = day_type === "holiday" ? "Holiday" : day_type === "event" ? "Event" : day_type === "exam_day" ? "Exam Day" : "Working Day";
        await db.run(
          `INSERT INTO notifications (id, user_id, title, message, type, is_read, created_at)
           VALUES (?, ?, ?, ?, ?, 0, datetime('now'))`,
          notifId,
          u.id,
          `Campus Schedule Update: ${dateStr}`,
          `The calendar schedule for ${dateStr} has been configured as a ${displayType} (${day_order === "None" ? "No Day Order" : day_order}) operating in ${session_mode || "Offline"} mode. Notes: ${notes || "None"}`,
          day_type === "holiday" ? "warning" : "info"
        );
      }
    } catch (errNotif) {
      console.error("Failed to write daily-config db notifications:", errNotif);
    }

    // 2. Dispatch Email Notifications to all Mentors of this college
    try {
      const collegeMentors = await db.all("SELECT id, name, email FROM mentors WHERE college_id = ?", college_id);
      
      for (const m of collegeMentors) {
        if (m.email) {
          const emailHtml = formatZentraEmail({
            title: "Campus Schedule Update",
            badgeText: day_type.replace("_", " ").toUpperCase(),
            badgeColor: day_type === "holiday" ? "rose" : day_type === "event" ? "amber" : "indigo",
            description: `Dear ${m.name}, this is an official campus update regarding the daily schedule configuration for ${dateStr}.`,
            details: [
              { label: "Date", value: dateStr },
              { label: "Day Type", value: day_type.replace("_", " ").toUpperCase() },
              { label: "Day Order", value: day_order },
              { label: "Session Mode", value: session_mode || "Offline" },
              { label: "Campus Notes", value: notes || "No operational notes provided." }
            ]
          });

          await sendMail({
            to: m.email,
            subject: `[Zentra] Campus Schedule Update - ${dateStr}`,
            htmlBody: emailHtml
          });
        }
      }
    } catch (errEmail) {
      console.error("Failed to send daily-config email notifications:", errEmail);
    }

    return NextResponse.json({ success: true, message: "Daily configuration saved successfully" });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
