// Pin to Mumbai (bom1) — co-located with Turso DB (aws-ap-south-1)
export const preferredRegion = "bom1";
export const maxDuration = 60;

import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { deriveSubjectType } from "@/lib/skillTracker";
import { requireRole, requireSession, apiAuthErrorResponse } from "@/lib/api-auth";

/**
 * Phase A (Demo Workflow Redesign): validate that a (SME, date, time) booking falls
 * inside one of the SME's ACTIVE demo-type availability windows (sme_availability,
 * slot_type = 'demo'). Shared by book / bulk-book so Excel uploads cannot overbook
 * or book outside declared demo hours.
 */
function parseTimeToMinutes(t: string): number {
  if (!t) return -1;
  const m = String(t).trim().match(/^(\d{1,2})(?:[:.](\d{2}))?\s*(AM|PM)?/i);
  if (!m) return -1;
  let hr = parseInt(m[1], 10);
  const min = m[2] ? parseInt(m[2], 10) : 0;
  const ampm = m[3] ? m[3].toUpperCase() : null;
  if (ampm === "PM" && hr < 12) hr += 12;
  if (ampm === "AM" && hr === 12) hr = 0;
  return hr * 60 + min;
}

async function smeDemoWindowAllows(
  db: any,
  smeId: string,
  dateStr: string,
  timeSlot: string
): Promise<{ ok: boolean; reason?: string }> {
  try {
    const dayName = new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", { weekday: "long" });
    const windows: any[] = await db.all(
      "SELECT start_time, end_time FROM sme_availability WHERE sme_id = ? AND UPPER(TRIM(day_of_week)) = UPPER(TRIM(?)) AND is_active != 0",
      [smeId, dayName]
    ).catch(() => []);
    if (!windows || windows.length === 0) {
      return { ok: false, reason: `SME has no demo availability configured on ${dayName} (${dateStr}).` };
    }
    const demoWindows = windows.filter((w: any) => (w.slot_type || "demo") === "demo");
    const usable = demoWindows.length > 0 ? demoWindows : windows;
    const target = parseTimeToMinutes(timeSlot);
    if (target < 0) return { ok: true }; // unparsable slot — let clash checks handle it
    const within = usable.some((w: any) => {
      const s = parseTimeToMinutes(w.start_time);
      const e = parseTimeToMinutes(w.end_time);
      return target >= s && target < Math.max(e, s + 1);
    });
    if (!within) {
      const cover = usable.map((w: any) => `${w.start_time}-${w.end_time}`).join(", ");
      return { ok: false, reason: `SME demo windows on ${dayName} (${cover}) do not cover ${timeSlot}.` };
    }
    return { ok: true };
  } catch (_) {
    return { ok: true }; // never hard-block booking on validation infrastructure errors
  }
}

/**
 * GET /api/demo-sessions?college_id=…
 * Read-only listing for dashboards that only need to display demo data
 * (e.g. the CM's Mentor Demo & Evaluation ledger). Role-gated to staff.
 */
export async function GET(request: Request) {
  try {
    await requireRole(request, "admin", "allocator", "head_sme", "sme", "cam", "kam");
    const db = await getDb();
    const collegeId = new URL(request.url).searchParams.get("college_id");
    if (!collegeId) {
      return NextResponse.json({ success: false, message: "Missing college_id" }, { status: 400 });
    }
    const records = await db.all(
      `SELECT ds.* FROM demo_sessions ds
       JOIN mentors m ON m.id = ds.mentorId
       WHERE m.college_id = ?
       ORDER BY ds.dateStr DESC, ds.created_at DESC`,
      [collegeId]
    );
    return NextResponse.json({ success: true, records });
  } catch (error: any) {
    const authRes = apiAuthErrorResponse(error);
    if (authRes) return authRes;
    console.error("API GET demo-sessions error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const db = await getDb();
    const body = await request.json();
    const { action } = body;

    // Role-based authorization
    if (action === "book" || action === "bulk-book" || action === "update" || action === "swap") {
      await requireRole(request, "admin", "allocator", "head_sme");
    } else if (action === "evaluate") {
      await requireRole(request, "sme", "head_sme", "admin", "allocator");
    } else if (action === "reschedule") {
      await requireSession(request);
    }

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

      // Phase A: booking must fall inside the SME's declared demo-availability window
      const windowCheck = await smeDemoWindowAllows(db, smeId, dateStr, timeSlot);
      if (!windowCheck.ok) {
        return NextResponse.json({ success: false, message: `Cannot allocate demo: ${windowCheck.reason}` });
      }

      // Leave-driven reallocation reservations: a pending/approved reservation
      // blocks booking another demo into the same (SME, date, slot) — the period
      // is temporarily held for the reallocated demo until L&D decides.
      try {
        const reservationClash = await db.get(
          `SELECT id FROM demo_reallocation_requests
           WHERE status IN ('pending', 'approved') AND smeId = ? AND proposed_date_str = ?
             AND (proposed_time_slot = ? OR ? LIKE ('%' || proposed_time_slot || '%') OR proposed_time_slot LIKE ('%' || ? || '%'))`,
          [smeId, dateStr, timeSlot, timeSlot, timeSlot]
        ).catch(() => null);
        if (reservationClash) {
          return NextResponse.json({ success: false, message: "This period is reserved for a pending demo reallocation (awaiting L&D approval)." });
        }
      } catch (_) {}

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
         VALUES (?, 'booking', ?, 'System', 'Learning and Development', ?)`,
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

        // Phase A: silently skip rows outside the SME's declared demo-availability window
        const bulkWindowCheck = await smeDemoWindowAllows(db, smeId, dateStr, timeSlot);
        if (!bulkWindowCheck.ok) continue;

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
      const { sessionId, marks, comments, checklist } = body;

      if (!sessionId || marks === undefined || comments === undefined) {
        return NextResponse.json({ success: false, message: "Missing evaluation details" }, { status: 400 });
      }

      const session = await db.get("SELECT * FROM demo_sessions WHERE id = ?", [sessionId]);
      if (!session) {
        return NextResponse.json({ success: false, message: "Demo session not found." }, { status: 404 });
      }

      // Phase C: store the department criteria snapshot with the evaluation.
      // checklist = [{ criterionId, label, type, met }] — a snapshot of the
      // department's criteria as they were at eval time.
      let checklistJson: string | null = null;
      let unmetItems: string[] = [];
      try {
        if (Array.isArray(checklist) && checklist.length > 0) {
          checklistJson = JSON.stringify(checklist);
          unmetItems = checklist
            .filter((c: any) => c && c.met === false && c.label)
            .map((c: any) => String(c.label));
        }
      } catch (_) {}

      await db.exec("ALTER TABLE demo_sessions ADD COLUMN checklist TEXT").catch(() => {});
      await db.run(
        `UPDATE demo_sessions SET status = 'completed', marks = ?, comments = ?, checklist = COALESCE(?, checklist) WHERE id = ?`,
        [marks, comments, checklistJson, sessionId]
      );

      // ── Skill Tracker auto-verdict (Mentor Skill Development Tracker) ──
      // Record a demo-scope clearance derived from the SME's marks so the
      // mentor/CM skill tracker reflects "cleared demo" without manual re-entry.
      // SKILL-ONLY: academic-subject demos are skipped — the tracker tracks Skill
      // subjects exclusively (resolve demo subject via the subjects table first).
      try {
        const demoSubjectType = deriveSubjectType(session.subject, String((await db.get("SELECT type FROM subjects WHERE LOWER(TRIM(name)) = LOWER(TRIM(?))", [session.subject]).catch(() => null))?.type || ""));
        if (demoSubjectType === "Skill") {
        const passMark = 50;
        const autoVerdict = marks >= passMark ? "cleared" : "not_cleared";
        const clearanceTableReady = await db.exec(`
          CREATE TABLE IF NOT EXISTS mentor_skill_clearances (
            id TEXT PRIMARY KEY,
            college_id TEXT,
            mentor_id TEXT NOT NULL,
            mentor_name TEXT,
            subject TEXT NOT NULL,
            subject_type TEXT DEFAULT 'Skill',
            week_number INTEGER NOT NULL,
            scope TEXT NOT NULL DEFAULT 'week',
            topic TEXT,
            demo_session_id TEXT,
            weekly_plan_id TEXT,
            status TEXT NOT NULL DEFAULT 'pending',
            score INTEGER,
            remarks TEXT,
            verified_by TEXT,
            verified_at TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT
          );
        `).then(() => true).catch(() => false);
        if (clearanceTableReady) {
          const mentorRow: any = await db.get("SELECT id, name, college_id FROM mentors WHERE id = ?", [session.mentorId]).catch(() => null);
          const existingClearance: any = await db.get(
            "SELECT id FROM mentor_skill_clearances WHERE mentor_id = ? AND scope = 'demo' AND demo_session_id = ?",
            [session.mentorId, sessionId]
          ).catch(() => null);
          if (existingClearance?.id) {
            await db.run(
              `UPDATE mentor_skill_clearances SET status = ?, score = ?, remarks = ?, verified_by = ?, verified_at = ?, updated_at = ? WHERE id = ?`,
              [autoVerdict, marks, comments || "", session.smeName || "Subject Matter Expert", new Date().toISOString(), new Date().toISOString(), existingClearance.id]
            );
          } else {
            const clearanceId = "MSC_" + Date.now() + "_" + Math.random().toString(36).substring(2, 8);
            await db.run(
              `INSERT INTO mentor_skill_clearances (
                id, college_id, mentor_id, mentor_name, subject, subject_type,
                week_number, scope, topic, demo_session_id, weekly_plan_id,
                status, score, remarks, verified_by, verified_at, updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, 'demo', NULL, ?, NULL, ?, ?, ?, ?, ?, ?)`,
              [
                clearanceId,
                mentorRow?.college_id || null,
                session.mentorId,
                session.mentorName || null,
                session.subject || "General",
                demoSubjectType,
                parseInt(String(session.week ?? "0"), 10) || 0,
                sessionId,
                autoVerdict,
                marks,
                comments || "",
                session.smeName || "Subject Matter Expert",
                new Date().toISOString(),
                new Date().toISOString()
              ]
            );
          }
        }
      }
      } catch (clearanceErr: any) {
        // Never block demo evaluation on tracker bookkeeping
        console.warn("[demo-sessions] skill clearance sync failed:", clearanceErr?.message);
      }

      // ── Phase C: compliance-gap escalation mail (KAM + CM, SME CC'd) ──
      // Any unmet criterion (unticked checkbox or final mark below threshold)
      // triggers one email; the evaluation itself is NEVER blocked.
      if (unmetItems.length > 0) {
        try {
          const { sendMail, renderDemoComplianceEmail } = await import("@/lib/mail");

          // Resolve mentor department + college for CM targeting
          const mentorRow: any = await db.get("SELECT id, name, department, mentor_group, college_id FROM mentors WHERE id = ?", [session.mentorId]).catch(() => null);
          const department = mentorRow?.department || mentorRow?.mentor_group || session.stream || "General";
          const collegeId = mentorRow?.college_id || null;

          const toEmails: string[] = [];
          const ccEmails: string[] = [];

          // KAM: all kam_users
          const kams: any[] = await db.all("SELECT name, email FROM kam_users WHERE email IS NOT NULL").catch(() => []);
          kams.forEach((k: any) => { if (k.email) toEmails.push(k.email); });

          // CM: campus_managers for the mentor's college (fall back to all CMs)
          const cms: any[] = collegeId
            ? await db.all("SELECT name, email FROM campus_managers WHERE college_id = ? AND email IS NOT NULL", [collegeId]).catch(() => [])
            : await db.all("SELECT name, email FROM campus_managers WHERE email IS NOT NULL").catch(() => []);
          if (cms.length === 0 && collegeId) {
            // Fallback: college row may hold a contact email
            const collegeRow: any = await db.get("SELECT name FROM colleges WHERE id = ?", [collegeId]).catch(() => null);
            if (!cms.length && collegeRow) { /* no contact email on colleges table — skip */ }
          }
          cms.forEach((c: any) => { if (c.email) toEmails.push(c.email); });

          // SME evaluator CC'd on the thread
          const smes: any[] = await db.all("SELECT name, email FROM sme_users WHERE id = ? AND email IS NOT NULL", [session.smeId]).catch(() => []);
          smes.forEach((s: any) => { if (s.email) ccEmails.push(s.email); });

          const dedupTo = Array.from(new Set(toEmails.map((e: string) => e.toLowerCase().trim())));
          const dedupCc = Array.from(new Set(ccEmails.map((e: string) => e.toLowerCase().trim()))).filter((e) => !dedupTo.includes(e));

          if (dedupTo.length > 0) {
            const scaleMax = 100;
            const html = renderDemoComplianceEmail({
              recipientName: "Key Account Manager / Campus Manager",
              mentorName: session.mentorName || mentorRow?.name || "Mentor",
              department,
              subject: session.subject || "General",
              dateStr: session.dateStr,
              timeSlot: session.timeSlot,
              smeName: session.smeName || "Subject Matter Expert",
              finalMark: `${marks} / ${scaleMax}`,
              unmetItems
            });
            await sendMail({
              to: dedupTo.join(","),
              subject: `[Demo Compliance Gap] ${session.mentorName} — ${session.subject} (${session.dateStr})`,
              htmlBody: html
            });
            // Note: sendMail does not support CC; include SME in the To list instead.
            if (dedupCc.length > 0) {
              await sendMail({
                to: dedupCc.join(","),
                subject: `[Demo Compliance Gap] ${session.mentorName} — ${session.subject} (${session.dateStr})`,
                htmlBody: renderDemoComplianceEmail({
                  recipientName: session.smeName || "Subject Matter Expert",
                  mentorName: session.mentorName || mentorRow?.name || "Mentor",
                  department,
                  subject: session.subject || "General",
                  dateStr: session.dateStr,
                  timeSlot: session.timeSlot,
                  smeName: session.smeName || "Subject Matter Expert",
                  finalMark: `${marks} / ${scaleMax}`,
                  unmetItems
                })
              });
            }
          }
        } catch (mailErr: any) {
          console.warn("[demo-sessions] compliance escalation mail failed:", mailErr?.message);
        }

        // Audit log the gap
        const gapAuditId = "audit_" + Date.now() + "_" + Math.random().toString(36).substring(2, 9);
        await db.run(
          `INSERT INTO audit_logs (id, type, description, actorName, actorRole, timestamp)
           VALUES (?, 'demo_compliance_gap', ?, ?, 'SME', ?)`,
          [gapAuditId, `Compliance gap on demo for ${session.mentorName} (${session.subject}): unmet criteria — ${unmetItems.join("; ")}. Escalation mail sent to KAM/CM.`, session.smeName, new Date().toISOString()]
        ).catch(() => {});
      }

      // Audit Log
      const auditId = "audit_" + Date.now() + "_" + Math.random().toString(36).substring(2, 9);
      await db.run(
        `INSERT INTO audit_logs (id, type, description, actorName, actorRole, timestamp)
         VALUES (?, 'booking', ?, ?, 'SME', ?)`,
        [auditId, `Evaluated demo for ${session.mentorName}: Scored ${marks}/100. Comments: ${comments}`, session.smeName, new Date().toISOString()]
      );

      return NextResponse.json({ success: true, message: unmetItems.length > 0 ? "Evaluation saved. Compliance gap escalated to KAM/CM." : "Evaluation saved successfully!" });

    } else if (action === "reschedule") {
      const { sessionId, mentorId, newDateStr, newTimeSlot, comments: rescheduleComments } = body;
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

      // 4. Leave-driven reallocation reservation clash (SME perspective)
      try {
        const reservationClash = await db.get(
          `SELECT id FROM demo_reallocation_requests
           WHERE status IN ('pending', 'approved') AND id != (SELECT id FROM demo_reallocation_requests WHERE demo_session_id = ? AND status = 'pending' LIMIT 1)
             AND smeId = ? AND proposed_date_str = ?
             AND (proposed_time_slot = ? OR ? LIKE ('%' || proposed_time_slot || '%') OR proposed_time_slot LIKE ('%' || ? || '%'))`,
          [sessionId, session.smeId, newDateStr, newTimeSlot, newTimeSlot, newTimeSlot]
        ).catch(() => null);
        if (reservationClash) {
          return NextResponse.json({ success: false, message: "Target period is reserved for a pending demo reallocation (awaiting L&D approval)." }, { status: 400 });
        }
      } catch (_) {}

      // ── Phase B (Demo Workflow Redesign): reschedules no longer auto-confirm ──
      // Create a PENDING reallocation request that L&D must approve.
      // The slot is NOT changed here; /api/demo-reallocations action=resolve does it.
      try {
        await db.exec(
          "ALTER TABLE demo_reallocation_requests ADD COLUMN request_kind TEXT DEFAULT 'leave'"
        ).catch(() => {});
      } catch (_) {}

      // Replace any stale pending reschedule request for this demo
      await db.run(
        "DELETE FROM demo_reallocation_requests WHERE demo_session_id = ? AND status = 'pending' AND request_kind = 'reschedule'",
        [sessionId]
      ).catch(() => {});

      const reallocId = "drr_" + Date.now() + "_" + Math.random().toString(36).substring(2, 8);
      await db.run(
        `INSERT INTO demo_reallocation_requests (
          id, demo_session_id, mentor_id, mentor_name, sme_id, sme_name,
          subject, stream, week, original_date_str, original_time_slot,
          proposed_date_str, proposed_time_slot, reason, status, proposed_by, request_kind
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, 'reschedule')`,
        [
          reallocId,
          sessionId,
          session.mentorId,
          session.mentorName,
          session.smeId,
          session.smeName,
          session.subject,
          session.stream,
          (session as any).week ?? null,
          session.dateStr,
          session.timeSlot,
          newDateStr,
          newTimeSlot,
          rescheduleComments || null,
          session.mentorName
        ]
      );

      // Notify allocator-view users (campus_managers) and write an audit log
      try {
        const allocators: any[] = await db.all("SELECT id FROM campus_managers").catch(() => []);
        for (const alloc of allocators) {
          const nId = "notif_" + Date.now() + "_" + Math.random().toString(36).substring(2, 9);
          await db.run(
            `INSERT INTO notifications (id, user_id, title, message, is_read, link, type, created_at)
             VALUES (?, ?, ?, ?, 0, '/allocator', 'demo_reschedule_requested', ?)`,
            [
              nId,
              alloc.id,
              "Demo Reschedule Awaiting Approval",
              `${session.mentorName} requested moving the ${session.subject} demo from ${session.dateStr} (${session.timeSlot}) to ${newDateStr} (${newTimeSlot}).`,
              new Date().toISOString()
            ]
          ).catch(() => {});
        }
      } catch (_) {}

      // Audit Log
      const auditId = "audit_" + Date.now() + "_" + Math.random().toString(36).substring(2, 9);
      await db.run(
        `INSERT INTO audit_logs (id, type, description, actorName, actorRole, timestamp)
         VALUES (?, 'demo_reschedule_requested', ?, ?, 'Mentor', ?)`,
        [
          auditId,
          `Mentor ${session.mentorName} requested rescheduling demo for ${session.subject} with SME ${session.smeName} from ${session.dateStr} (${session.timeSlot}) to ${newDateStr} (${newTimeSlot}). Awaiting Learning and Development approval.`,
          session.mentorName,
          new Date().toISOString()
        ]
      );

      return NextResponse.json({
        success: true,
        message: `Reschedule request sent to Learning and Development for approval (${newDateStr}, ${newTimeSlot}). The slot is reserved until they decide.`
      });
    }

    return NextResponse.json({ success: false, message: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    const authRes = apiAuthErrorResponse(error);
    if (authRes) return authRes;
    console.error("API demo-sessions error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    await requireRole(request, "admin", "allocator", "head_sme");
    const db = await getDb();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ success: false, message: "Missing session id" }, { status: 400 });
    }

    await db.run("DELETE FROM demo_sessions WHERE id = ?", [id]);
    return NextResponse.json({ success: true, message: "Demo session deleted successfully." });
  } catch (error: any) {
    const authRes = apiAuthErrorResponse(error);
    if (authRes) return authRes;
    console.error("API DELETE demo-sessions error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
