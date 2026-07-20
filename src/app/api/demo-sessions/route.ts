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
      const { sessions } = body;
      if (!Array.isArray(sessions)) {
        return NextResponse.json({ success: false, message: "Invalid sessions format" }, { status: 400 });
      }

      await db.run("BEGIN TRANSACTION;");
      try {
        for (const sess of sessions) {
          const { mentorId, mentorName, smeId, smeName, dateStr, timeSlot, subject, stream, week } = sess;
          const sessionId = "ds_" + Date.now() + "_" + Math.random().toString(36).substring(2, 9);
          await db.run(
            `INSERT INTO demo_sessions (id, mentorId, mentorName, smeId, smeName, dateStr, timeSlot, subject, stream, week, status, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'scheduled', ?)`,
            [sessionId, mentorId, mentorName, smeId, smeName, dateStr, timeSlot, subject, stream, week, new Date().toISOString()]
          );
        }
        await db.run("COMMIT;");
        return NextResponse.json({ success: true, message: "Bulk demos allocated successfully!" });
      } catch (txError) {
        await db.run("ROLLBACK;");
        throw txError;
      }

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

      await db.run("BEGIN TRANSACTION;");
      try {
        await db.run("UPDATE demo_sessions SET dateStr = ?, timeSlot = ? WHERE id = ?", [s2.dateStr, s2.timeSlot, s1.id]);
        await db.run("UPDATE demo_sessions SET dateStr = ?, timeSlot = ? WHERE id = ?", [s1.dateStr, s1.timeSlot, s2.id]);
        await db.run("COMMIT;");
        return NextResponse.json({ success: true, message: "Demo sessions swapped successfully." });
      } catch (txError) {
        await db.run("ROLLBACK;");
        throw txError;
      }

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
