// Pin to Mumbai (bom1) — co-located with Turso DB (aws-ap-south-1)
export const preferredRegion = "bom1";
export const maxDuration = 60;
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { sendMail, formatZentraEmail } from "@/lib/mail";

const noCacheHeaders = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
  "Pragma": "no-cache",
  "Expires": "0",
};

async function handleAutoAdaptNextWeek(db: any, body: any) {
  const { college_id, reference_date, skip_sundays = false } = body;
  
  if (!college_id) {
    return NextResponse.json({ success: false, message: "college_id is required" }, { status: 400, headers: noCacheHeaders });
  }

  // Determine reference week (default: current week)
  const refDate = reference_date ? new Date(reference_date) : new Date();
  const refDayOfWeek = refDate.getDay(); // 0=Sun, 1=Mon, ...
  const refMonday = new Date(refDate);
  refMonday.setDate(refDate.getDate() - (refDayOfWeek === 0 ? 6 : refDayOfWeek - 1));
  
  // Next week starts 7 days after reference Monday
  const nextMonday = new Date(refMonday);
  nextMonday.setDate(refMonday.getDate() + 7);

  // Fetch reference week configs
  const refDates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(refMonday);
    d.setDate(refMonday.getDate() + i);
    refDates.push(d.toISOString().split("T")[0]);
  }

  const refConfigs = await db.all(
    "SELECT * FROM campus_daily_configs WHERE college_id = ? AND dateStr IN (?, ?, ?, ?, ?, ?, ?)",
    [college_id, ...refDates]
  );

  if (refConfigs.length === 0) {
    return NextResponse.json({ 
      success: false, 
      message: "No configuration found for reference week. Please configure the current week first." 
    }, { status: 400, headers: noCacheHeaders });
  }

  // Map reference configs by date
  const refConfigMap = new Map<string, any>();
  refConfigs.forEach((c: any) => refConfigMap.set(c.dateStr, c));

  // Find the last day order of reference week to continue the sequence
  const dayOrders = ["Day 1", "Day 2", "Day 3", "Day 4", "Day 5", "Day 6"];
  let lastDayOrderIndex = -1;
  for (let i = 6; i >= 0; i--) {
    const refConfig = refConfigMap.get(refDates[i]);
    if (refConfig && refConfig.day_order && refConfig.day_order !== "None") {
      const match = refConfig.day_order.match(/^Day (\d+)$/);
      if (match) {
        lastDayOrderIndex = parseInt(match[1], 10) - 1;
        break;
      }
    }
  }

  // Generate next week configs
  const nextDates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(nextMonday);
    d.setDate(nextMonday.getDate() + i);
    nextDates.push(d.toISOString().split("T")[0]);
  }

  let dayOrderCounter = lastDayOrderIndex + 1;
  const insertedConfigs: any[] = [];

  for (let i = 0; i < nextDates.length; i++) {
    const nextDateStr = nextDates[i];
    const refDateStr = refDates[i];
    const refConfig = refConfigMap.get(refDateStr);
    const dateObj = new Date(nextDateStr + "T00:00:00");
    const isSunday = dateObj.getDay() === 0;
    const id = `${college_id}_${nextDateStr}`;

    let dayType = refConfig?.day_type || "working";
    let dayOrder = refConfig?.day_order || "None";
    const sessionMode = refConfig?.session_mode || "Offline";
    const notesVal = refConfig?.notes || "";

    // Handle Sunday skipping
    if (skip_sundays && isSunday) {
      dayType = "holiday";
      dayOrder = "None";
    } else if (dayType === "working" && dayOrder !== "None") {
      // Continue day order sequence
      dayOrder = dayOrders[dayOrderCounter % 6];
      dayOrderCounter++;
    }

    await db.run(
      `INSERT INTO campus_daily_configs (id, college_id, dateStr, day_type, day_order, session_mode, notes, updated_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
       ON CONFLICT (id) DO UPDATE SET
         day_type = EXCLUDED.day_type,
         day_order = EXCLUDED.day_order,
         session_mode = EXCLUDED.session_mode,
         notes = EXCLUDED.notes,
         updated_at = NOW()`,
      id, college_id, nextDateStr, dayType, dayOrder, sessionMode, notesVal
    );

    insertedConfigs.push({ dateStr: nextDateStr, dayType, dayOrder });
  }

  // Insert notifications for all students & mentors
  try {
    const users = await db.all(
      `SELECT id, role FROM users WHERE reference_id IN (SELECT id FROM mentors WHERE college_id = ?)
       UNION
       SELECT id, role FROM users WHERE reference_id IN (SELECT id FROM students WHERE college_id = ?)`,
      college_id, college_id
    );

    for (const u of users) {
      const notifId = "n_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5);
      const link = u.role === "mentor" ? `/mentor/schedule?week=${nextDates[0]}` : `/student/schedule?week=${nextDates[0]}`;
      await db.run(
        `INSERT INTO notifications (id, user_id, title, message, type, link, is_read, created_at)
         VALUES (?, ?, ?, ?, ?, ?, 0, NOW()::text)`,
        notifId,
        u.id,
        `Next Week Schedule Auto-Configured`,
        `The campus schedule for next week (${nextDates[0]} to ${nextDates[6]}) has been automatically configured based on the current week's pattern. Please review your timetable.`,
        "info",
        link
      );
    }
  } catch (errNotif) {
    console.error("Failed to write auto-adapt notifications:", errNotif);
  }

  // Send email notifications to mentors
  try {
    const collegeMentors = await db.all("SELECT id, name, email FROM mentors WHERE college_id = ?", college_id);
    
    for (const m of collegeMentors) {
      if (m.email) {
        const emailHtml = formatZentraEmail({
          title: "Next Week Schedule Auto-Configured",
          badgeText: "AUTO-ADAPT",
          badgeColor: "indigo",
          description: `Dear ${m.name}, the campus schedule for next week has been automatically configured based on the current week's pattern.`,
          details: [
            { label: "Week Start", value: nextDates[0] },
            { label: "Week End", value: nextDates[6] },
            { label: "Total Days", value: insertedConfigs.length.toString() },
            { label: "Configuration", value: "Auto-adapted from reference week" }
          ]
        });

        await sendMail({
          to: m.email,
          subject: `[FACE Prep E-Campus] Next Week Schedule Auto-Configured`,
          htmlBody: emailHtml
        });
      }
    }
  } catch (errEmail) {
    console.error("Failed to send auto-adapt email notifications:", errEmail);
  }

  return NextResponse.json({ 
    success: true, 
    message: `Next week schedule auto-configured successfully (${insertedConfigs.length} days)`,
    configs: insertedConfigs,
    week_start: nextDates[0],
    week_end: nextDates[6]
  }, { headers: noCacheHeaders });
}

export async function GET(request: Request) {
  try {
    const db = await getDb();
    const { searchParams } = new URL(request.url);
    const collegeId = searchParams.get("college_id");
    const limit = searchParams.get("limit") ? parseInt(searchParams.get("limit")!) : 200;
    const search = searchParams.get("search");

    if (!collegeId) {
      return NextResponse.json({ success: false, message: "college_id is required" }, { status: 400, headers: noCacheHeaders });
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

    return NextResponse.json({ success: true, configs }, { headers: noCacheHeaders });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500, headers: noCacheHeaders });
  }
}

export async function POST(request: Request) {
  try {
    const db = await getDb();
    const body = await request.json();
    const { college_id, dateStr, startDate, endDate, day_type, day_order, notes, session_mode, auto_advance, action } = body;

    // Handle auto-adapt next week action
    if (action === "auto_adapt_next_week") {
      return await handleAutoAdaptNextWeek(db, body);
    }

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
      } else if (day_type === "holiday" || day_type === "event" || (body.skip_sundays === true && isSunday)) {
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
        `INSERT INTO campus_daily_configs (id, college_id, dateStr, day_type, day_order, session_mode, notes, updated_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
         ON CONFLICT (id) DO UPDATE SET
           college_id = EXCLUDED.college_id,
           dateStr = EXCLUDED.dateStr,
           day_type = EXCLUDED.day_type,
           day_order = EXCLUDED.day_order,
           session_mode = EXCLUDED.session_mode,
           notes = EXCLUDED.notes,
           updated_at = NOW()`,
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
             VALUES (?, ?, ?, ?, ?, ?, 0, NOW()::text)`,
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
