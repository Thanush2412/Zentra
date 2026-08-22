// Pin to Mumbai (bom1) — co-located with Turso DB (aws-ap-south-1)
export const preferredRegion = "bom1";
export const maxDuration = 60;

import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { sendMail, formatZentraEmail } from "@/lib/mail";

export async function GET(request: Request) {
  try {
    const db = await getDb();
    const { searchParams } = new URL(request.url);
    const collegeId = searchParams.get("college_id");
    const limit = searchParams.get("limit") ? parseInt(searchParams.get("limit")!) : 200;
    const search = searchParams.get("search");

    if (!collegeId) {
      return NextResponse.json({ success: false, message: "college_id is required" }, { status: 400 });
    }

    let query = "SELECT * FROM campus_daily_configs WHERE college_id = ?";
    let params: any[] = [collegeId];

    if (search) {
      query += " AND (dateStr LIKE ? OR day_type LIKE ? OR day_order LIKE ? OR notes LIKE ?)";
      const pattern = `%${search}%`;
      params.push(pattern, pattern, pattern, pattern);
    }

    query += " ORDER BY dateStr DESC LIMIT ?";
    params.push(limit);

    const configs = await db.all(query, ...params);

    return NextResponse.json({ success: true, configs });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const db = await getDb();
    const body = await request.json();
    const { college_id, dateStr, startDate, endDate, day_type, day_order, notes, session_mode, auto_advance } = body;

    const effectiveDayOrder = day_type === "holiday" ? "None" : (day_order || "None");

    if (!college_id || (!dateStr && (!startDate || !endDate)) || !day_type) {
      return NextResponse.json({ success: false, message: "Missing required fields" }, { status: 400 });
    }

    // Build array of dates to process
    const datesToProcess: string[] = [];
    if (startDate && endDate) {
      let cur = new Date(startDate);
      const end = new Date(endDate);
      while (cur <= end) {
        datesToProcess.push(cur.toISOString().split("T")[0]);
        cur.setDate(cur.getDate() + 1);
      }
    } else if (dateStr) {
      datesToProcess.push(dateStr);
    }

    // Day order sequence cycle: Day 1 -> Day 2 -> Day 3 -> Day 4 -> Day 5 -> Day 6
    const dayOrders = ["Day 1", "Day 2", "Day 3", "Day 4", "Day 5", "Day 6"];
    let initialIndex = dayOrders.indexOf(effectiveDayOrder);

    let dayOrderCounter = initialIndex !== -1 ? initialIndex : 0;

    for (let i = 0; i < datesToProcess.length; i++) {
      const dStr = datesToProcess[i];
      const id = `${college_id}_${dStr}`;
      const dateObj = new Date(dStr + "T00:00:00");
      const isSunday = dateObj.getDay() === 0;

      let currentDayType = day_type;
      let currentDayOrder = effectiveDayOrder;

      if (effectiveDayOrder === "None" || effectiveDayOrder === "none") {
        // If explicitly set to None, force None for all dates in range without cycling
        currentDayOrder = "None";
      } else if (day_type === "holiday" || day_type === "event" || (body.skip_sundays !== false && isSunday)) {
        // Holidays, events, or auto-skipped Sundays get None and DO NOT advance the working day order counter!
        if (isSunday && day_type === "working") {
          currentDayType = "holiday";
        }
        currentDayOrder = "None";
      } else if (auto_advance !== false && initialIndex !== -1) {
        // Continuous next day sequence starting from chosen Day Order (e.g. Day 3 -> Day 4 -> Day 5 -> Day 6 -> Day 1 -> Day 2)
        currentDayOrder = dayOrders[dayOrderCounter % 6];
        dayOrderCounter++;
      }

      await db.run(
        `INSERT OR REPLACE INTO campus_daily_configs (id, college_id, dateStr, day_type, day_order, session_mode, notes, updated_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
        id, college_id, dStr, currentDayType, currentDayOrder, session_mode || "Offline", notes || ""
      );

      // 1. Insert Database Notifications for all Students & Mentors of this college
      try {
        const users = await db.all(
          `SELECT id, role FROM users WHERE reference_id IN (SELECT id FROM mentors WHERE college_id = ?)
           UNION
           SELECT id, role FROM users WHERE reference_id IN (SELECT id FROM students WHERE college_id = ?)`,
          college_id, college_id
        );

        for (const u of users) {
          const notifId = "n_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5);
          const displayType = currentDayType === "holiday" ? "Holiday" : currentDayType === "event" ? "Event" : currentDayType === "exam_day" ? "Exam Day" : "Working Day";
          const link = u.role === "mentor" ? `/mentor/schedule?date=${dStr}` : `/student/schedule?date=${dStr}`;
          await db.run(
            `INSERT INTO notifications (id, user_id, title, message, type, link, is_read, created_at)
             VALUES (?, ?, ?, ?, ?, ?, 0, datetime('now'))`,
            notifId,
            u.id,
            `Campus Schedule Update: ${dStr}`,
            `The calendar schedule for ${dStr} has been configured as a ${displayType} (${currentDayOrder === "None" ? "No Day Order" : currentDayOrder}) operating in ${session_mode || "Offline"} mode. Notes: ${notes || "None"}`,
            currentDayType === "holiday" ? "warning" : "info",
            link
          );
        }
      } catch (errNotif) {
        console.error("Failed to write daily-config db notifications:", errNotif);
      }
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
            description: `Dear ${m.name}, this is an official campus update regarding the daily schedule configuration.`,
            details: [
              { label: "Date Range", value: datesToProcess.length > 1 ? `${startDate} to ${endDate}` : (dateStr || startDate) },
              { label: "Day Type", value: day_type.replace("_", " ").toUpperCase() },
              { label: "Day Order", value: effectiveDayOrder },
              { label: "Session Mode", value: session_mode || "Offline" },
              { label: "Campus Notes", value: notes || "No operational notes provided." }
            ]
          });

          await sendMail({
            to: m.email,
            subject: `[FACE Prep E-Campus] Campus Schedule Update - ${startDate || dateStr}`,
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

export async function DELETE(request: Request) {
  try {
    const db = await getDb();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const collegeId = searchParams.get("college_id") || searchParams.get("collegeId");
    const dateStr = searchParams.get("dateStr");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    if (id) {
      await db.run("DELETE FROM campus_daily_configs WHERE id = ?", id);
      if (collegeId && dateStr) {
        await db.run("DELETE FROM campus_daily_configs WHERE college_id = ? AND dateStr = ?", collegeId, dateStr);
      }
    } else if (collegeId && startDate && endDate) {
      await db.run(
        "DELETE FROM campus_daily_configs WHERE college_id = ? AND dateStr >= ? AND dateStr <= ?",
        collegeId, startDate, endDate
      );
    } else if (collegeId && dateStr) {
      await db.run("DELETE FROM campus_daily_configs WHERE college_id = ? AND dateStr = ?", collegeId, dateStr);
    } else {
      return NextResponse.json({ success: false, message: "Missing id, dateStr, or (startDate and endDate)" }, { status: 400 });
    }

    return NextResponse.json({ success: true, message: "Daily configuration deleted successfully" });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
