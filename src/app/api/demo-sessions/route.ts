// Pin to Mumbai (bom1) — co-located with Turso DB (aws-ap-south-1)
export const preferredRegion = "bom1";
export const maxDuration = 60;

import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function POST(request: Request) {
  try {
    const db = await getDb();
    const body = await request.json();
    const { action } = body;

    if (action === "book") {
      const {
        mentorId,
        mentorName,
        smeId,
        smeName,
        dateStr,
        timeSlot,
        subject,
        stream,
        week
      } = body;

      if (!mentorId || !smeId || !dateStr || !timeSlot || !subject || !stream || !week) {
        return NextResponse.json({ success: false, message: "Missing required fields for booking" }, { status: 400 });
      }

      // Check if mentor is on approved leave on this date
      const mentorLeave = await db.get(
        `SELECT id, request_type FROM faculty_leave_requests 
         WHERE mentor_id = ? AND status = 'approved' AND start_date <= ? AND end_date >= ?`,
        [mentorId, dateStr, dateStr]
      );
      if (mentorLeave) {
        return NextResponse.json({ success: false, message: `Cannot allocate demo: Mentor is on approved ${mentorLeave.request_type || 'leave'} on ${dateStr}.` });
      }

      // Check if slot is already booked for a demo
      const existingDemo = await db.get(
        "SELECT id FROM demo_sessions WHERE mentorId = ? AND dateStr = ? AND timeSlot = ?",
        [mentorId, dateStr, timeSlot]
      );
      if (existingDemo) {
        return NextResponse.json({ success: false, message: "A demo session is already booked for this mentor at this date/time." });
      }

      // Generate ID
      const sessionId = "ds_" + Date.now() + "_" + Math.random().toString(36).substring(2, 9);
      
      await db.run(
        `INSERT INTO demo_sessions (id, mentorId, mentorName, smeId, smeName, dateStr, timeSlot, subject, stream, week, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'scheduled', ?)`,
        [sessionId, mentorId, mentorName, smeId, smeName, dateStr, timeSlot, subject, stream, week, new Date().toISOString()]
      );

      // Audit Log
      const auditId = "audit_" + Date.now() + "_" + Math.random().toString(36).substring(2, 9);
      await db.run(
        `INSERT INTO audit_logs (id, type, description, actorName, actorRole, timestamp)
         VALUES (?, 'booking', ?, 'System', 'Demo Allocator', ?)`,
        [auditId, `Demo allocated for ${mentorName} with SME ${smeName} on ${dateStr} at ${timeSlot}`, new Date().toISOString()]
      );

      return NextResponse.json({ success: true, message: "Demo allocated successfully!" });

    } else if (action === "bulk-book") {
      const sessions = body.sessions;
      if (!Array.isArray(sessions)) {
        return NextResponse.json({ success: false, message: "Invalid sessions format" }, { status: 400 });
      }

      for (const sess of sessions) {
        const { mentorId, mentorName, smeId, smeName, dateStr, timeSlot, subject, stream, week } = sess;

        // Skip if mentor is on approved leave
        const mentorLeave = await db.get(
          `SELECT id FROM faculty_leave_requests 
           WHERE mentor_id = ? AND status = 'approved' AND start_date <= ? AND end_date >= ?`,
          [mentorId, dateStr, dateStr]
        );
        if (mentorLeave) continue;

        // Skip if a session for this mentor, date, and time slot already exists
        const existingDemo = await db.get(
          "SELECT id FROM demo_sessions WHERE mentorId = ? AND dateStr = ? AND timeSlot = ?",
          [mentorId, dateStr, timeSlot]
        );
        if (existingDemo) continue;

        const sessionId = "ds_" + Date.now() + "_" + Math.random().toString(36).substring(2, 9);
        await db.run(
          `INSERT INTO demo_sessions (id, mentorId, mentorName, smeId, smeName, dateStr, timeSlot, subject, stream, week, status, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'scheduled', ?)`,
          [sessionId, mentorId, mentorName, smeId, smeName, dateStr, timeSlot, subject, stream, week, new Date().toISOString()]
        );
      }
      return NextResponse.json({ success: true, message: "Bulk demos allocated successfully!" });

    } else if (action === "update") {
      const {
        sessionId,
        dateStr,
        timeSlot,
        smeId,
        smeName,
        mentorId,
        mentorName,
        subject,
        stream,
        week
      } = body;

      if (!sessionId || !dateStr || !timeSlot || !smeId || !smeName) {
        return NextResponse.json({ success: false, message: "Missing required fields for update" }, { status: 400 });
      }

      if (mentorId && mentorName) {
        await db.run(
          `UPDATE demo_sessions 
           SET dateStr = ?, timeSlot = ?, smeId = ?, smeName = ?, mentorId = ?, mentorName = ?, subject = ?, stream = ?, week = COALESCE(?, week)
           WHERE id = ?`,
          [dateStr, timeSlot, smeId, smeName, mentorId, mentorName, subject || "", stream || "", week, sessionId]
        );
      } else {
        await db.run(
          `UPDATE demo_sessions 
           SET dateStr = ?, timeSlot = ?, smeId = ?, smeName = ?
           WHERE id = ?`,
          [dateStr, timeSlot, smeId, smeName, sessionId]
        );
      }
      return NextResponse.json({ success: true, message: "Demo session updated successfully." });

    } else if (action === "swap") {
      const { session1Id, session2Id } = body;
      if (!session1Id || !session2Id) {
        return NextResponse.json({ success: false, message: "Missing session IDs for swap" }, { status: 400 });
      }

      const s1 = await db.get("SELECT * FROM demo_sessions WHERE id = ?", [session1Id]);
      const s2 = await db.get("SELECT * FROM demo_sessions WHERE id = ?", [session2Id]);

      if (!s1 || !s2) {
        return NextResponse.json({ success: false, message: "One or both sessions not found" }, { status: 404 });
      }

      await db.run("UPDATE demo_sessions SET dateStr = ?, timeSlot = ? WHERE id = ?", [s2.dateStr, s2.timeSlot, s1.id]);
      await db.run("UPDATE demo_sessions SET dateStr = ?, timeSlot = ? WHERE id = ?", [s1.dateStr, s1.timeSlot, s2.id]);
      return NextResponse.json({ success: true, message: "Demo sessions swapped successfully." });

    } else if (action === "evaluate") {
      const { sessionId, marks, comments } = body;

      if (!sessionId || marks === undefined || comments === undefined) {
        return NextResponse.json({ success: false, message: "Missing evaluation details" }, { status: 400 });
      }

      const session = await db.get("SELECT * FROM demo_sessions WHERE id = ?", [sessionId]);
      if (!session) {
        return NextResponse.json({ success: false, message: "Demo session not found." }, { status: 404 });
      }

      await db.run(
        `UPDATE demo_sessions SET status = 'completed', marks = ?, comments = ? WHERE id = ?`,
        [marks, comments, sessionId]
      );

      // Audit Log
      const auditId = "audit_" + Date.now() + "_" + Math.random().toString(36).substring(2, 9);
      await db.run(
        `INSERT INTO audit_logs (id, type, description, actorName, actorRole, timestamp)
         VALUES (?, 'booking', ?, ?, 'SME', ?)`,
        [auditId, `Evaluated demo for ${session.mentorName}: Scored ${marks}/100. Comments: ${comments}`, session.smeName, new Date().toISOString()]
      );

      return NextResponse.json({ success: true, message: "Evaluation saved successfully!" });

    } else if (action === "reschedule") {
      const { sessionId, mentorId, newDateStr, newTimeSlot } = body;
      if (!sessionId || !mentorId || !newDateStr || !newTimeSlot) {
        return NextResponse.json({ success: false, message: "Missing required fields for rescheduling" }, { status: 400 });
      }

      const session = await db.get("SELECT * FROM demo_sessions WHERE id = ?", [sessionId]);
      if (!session) {
        return NextResponse.json({ success: false, message: "Demo session not found." }, { status: 404 });
      }

      if (session.mentorId !== mentorId) {
        return NextResponse.json({ success: false, message: "Unauthorized: You can only reschedule your own demo session." }, { status: 403 });
      }

      // 1. Verify mentor is not on approved leave on newDateStr
      const mentorLeave = await db.get(
        `SELECT id, request_type FROM faculty_leave_requests 
         WHERE mentor_id = ? AND status = 'approved' AND start_date <= ? AND end_date >= ?`,
        [mentorId, newDateStr, newDateStr]
      );
      if (mentorLeave) {
        return NextResponse.json({ success: false, message: `Cannot reschedule: You have an approved ${mentorLeave.request_type || 'leave'} on ${newDateStr}.` }, { status: 400 });
      }

      // 2. Check Mentor Existing Demo Clash
      const mentorDemoClash = await db.get(
        "SELECT id FROM demo_sessions WHERE mentorId = ? AND dateStr = ? AND timeSlot = ? AND id != ? AND status NOT IN ('not_conducted')",
        [mentorId, newDateStr, newTimeSlot, sessionId]
      );
      if (mentorDemoClash) {
        return NextResponse.json({ success: false, message: "You already have another demo session scheduled at this date/time." }, { status: 400 });
      }

      // 3. Check SME Existing Demo Clash
      const smeDemoClash = await db.get(
        "SELECT id FROM demo_sessions WHERE smeId = ? AND dateStr = ? AND timeSlot = ? AND id != ? AND status NOT IN ('not_conducted')",
        [session.smeId, newDateStr, newTimeSlot, sessionId]
      );
      if (smeDemoClash) {
        return NextResponse.json({ success: false, message: `Assigned SME ${session.smeName} already has another demo session at this date/time.` }, { status: 400 });
      }

      // Update demo session to confirmed with the new date & slot
      await db.run(
        `UPDATE demo_sessions 
         SET dateStr = ?, timeSlot = ?, status = 'confirmed', comments = ?
         WHERE id = ?`,
        [`Rescheduled by mentor from ${session.dateStr} (${session.timeSlot}) to ${newDateStr} (${newTimeSlot})`, sessionId]
      );

      // In-app notification to SME
      if (session.smeId) {
        const smeNotifId = "notif_" + Date.now() + "_" + Math.random().toString(36).substring(2, 9);
        await db.run(
          `INSERT INTO notifications (id, user_id, title, message, is_read, link, type, created_at)
           VALUES (?, ?, ?, ?, 0, ?, 'demo_rescheduled', ?)`,
          [
            smeNotifId,
            session.smeId,
            "Demo Session Rescheduled by Mentor",
            `Demo session for ${session.subject} with ${session.mentorName} has been rescheduled to ${newDateStr} at ${newTimeSlot}.`,
            "/sme/demo_list",
            new Date().toISOString()
          ]
        );
      }

      // Audit Log
      const auditId = "audit_" + Date.now() + "_" + Math.random().toString(36).substring(2, 9);
      await db.run(
        `INSERT INTO audit_logs (id, type, description, actorName, actorRole, timestamp)
         VALUES (?, 'demo_rescheduled', ?, ?, 'Mentor', ?)`,
        [
          auditId,
          `Mentor ${session.mentorName} rescheduled demo for ${session.subject} with SME ${session.smeName} from ${session.dateStr} (${session.timeSlot}) to ${newDateStr} (${newTimeSlot}).`,
          session.mentorName,
          new Date().toISOString()
        ]
      );

      return NextResponse.json({
        success: true,
        message: `Demo successfully rescheduled to ${newDateStr} (${newTimeSlot})! SME has been notified.`
      });
    }

    return NextResponse.json({ success: false, message: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    console.error("API demo-sessions error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const db = await getDb();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ success: false, message: "Missing session id" }, { status: 400 });
    }

    await db.run("DELETE FROM demo_sessions WHERE id = ?", [id]);
    return NextResponse.json({ success: true, message: "Demo session deleted successfully." });
  } catch (error: any) {
    console.error("API DELETE demo-sessions error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
