// Pin to Mumbai (bom1) — co-located with Turso/Postgres DB
export const preferredRegion = "bom1";
export const maxDuration = 60;

import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { ensureMigration } from "@/lib/migrations";
import { checkMentorAvailability, checkSmeAvailability } from "@/lib/availability";
import { requireRole, requireSession, apiAuthErrorResponse } from "@/lib/api-auth";

/**
 * Leave-driven Demo Reallocation flow:
 *  - GET  ?demoSessionId=            → demo details + mentor-free periods × SME availability matrix
 *  - GET  ?leaveRequestId= / ?status=pending → list reallocation requests (Allocator queue)
 *  - POST { action: "propose" }      → mentor picks an alternative period; a PENDING
 *                                      reservation is created that blocks the slot.
 *  - POST { action: "resolve" }      → Allocator approves (demo moved, original slot
 *                                      released) or rejects (reservation released).
 *
 * Pending reservations are respected by /api/demo-sessions (book / reschedule).
 */

const ACTIVE_RESERVATION_STATUSES = ["pending", "approved"];

async function ensureTable(db: any) {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS demo_reallocation_requests (
      id TEXT PRIMARY KEY,
      demo_session_id TEXT NOT NULL,
      leave_request_id TEXT,
      mentor_id TEXT NOT NULL,
      mentor_name TEXT,
      sme_id TEXT,
      sme_name TEXT,
      subject TEXT,
      stream TEXT,
      week INTEGER,
      original_date_str TEXT NOT NULL,
      original_time_slot TEXT NOT NULL,
      proposed_date_str TEXT NOT NULL,
      proposed_time_slot TEXT NOT NULL,
      reason TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      proposed_by TEXT,
      decided_by TEXT,
      decided_at TEXT,
      decision_notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `).catch(() => {});
  await db.exec("CREATE INDEX IF NOT EXISTS idx_demo_realloc_status ON demo_reallocation_requests(status)").catch(() => {});
  await db.exec("CREATE INDEX IF NOT EXISTS idx_demo_realloc_session ON demo_reallocation_requests(demo_session_id)").catch(() => {});
  await db.exec("CREATE INDEX IF NOT EXISTS idx_demo_realloc_leave ON demo_reallocation_requests(leave_request_id)").catch(() => {});
}

export async function GET(request: Request) {
  try {
    const db = await getDb();
    await ensureMigration("demo_reallocation_requests");
    await ensureTable(db);

    const { searchParams } = new URL(request.url);
    const demoSessionId = searchParams.get("demoSessionId");
    const leaveRequestId = searchParams.get("leaveRequestId");
    const status = searchParams.get("status");

    // ── Alternatives discovery for one demo ────────────────────────────
    if (demoSessionId) {
      const demo = await db.get("SELECT * FROM demo_sessions WHERE id = ?", [demoSessionId]);
      if (!demo) {
        return NextResponse.json({ success: false, message: "Demo session not found" }, { status: 404 });
      }

      const collegeId = (demo as any).college_id || null;
      const college = collegeId
        ? await db.get("SELECT * FROM colleges WHERE id = ?", [collegeId]).catch(() => null)
        : null;

      // Period slots: college timetable periods (demo timeSlots use the same strings)
      let periodSlots: string[] = [];
      try {
        const { getCollegePeriodTimeSlots } = await import("@/lib/utils");
        const slots = await db.all("SELECT * FROM slots WHERE college_id = ?", [collegeId]).catch(() => []);
        const colleges = college ? [college] : [];
        periodSlots = getCollegePeriodTimeSlots(collegeId, colleges as any, slots as any) || [];
      } catch (_) {}
      if (!periodSlots || periodSlots.length === 0) {
        periodSlots = [
          "Period 1 (08:30 - 09:25)",
          "Period 2 (09:25 - 10:20)",
          "Period 3 (10:40 - 11:35)",
          "Period 4 (11:35 - 12:30)",
          "Period 5 (01:25 - 02:20)",
          "Period 6 (02:20 - 03:15)"
        ];
      }

      // Candidate dates: next 21 days, skipping Sundays & configured holidays
      const holidays: any[] = await db.all("SELECT date, title FROM holidays").catch(() => []);
      const holidaySet = new Set(holidays.map(h => h.date));
      const candidateDates: { dateStr: string; label: string }[] = [];
      const today = new Date();
      for (let i = 1; i <= 21 && candidateDates.length < 12; i++) {
        const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i, 12, 0, 0);
        const dow = d.getDay();
        if (dow === 0) continue;
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        const dateStr = `${y}-${m}-${day}`;
        if (holidaySet.has(dateStr)) continue;
        const weekday = d.toLocaleDateString("en-US", { weekday: "long" });
        candidateDates.push({ dateStr, label: `${d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" })} (${weekday})` });
      }

      // Pending/approved reservations to exclude
      const reservations = await db.all(
        "SELECT demo_session_id, proposed_date_str, proposed_time_slot, mentor_id, sme_id FROM demo_reallocation_requests WHERE status IN ('pending', 'approved')"
      ).catch(() => []);

      // Compute per-date free-period matrix (mentor × SME)
      const alternatives: any[] = [];
      for (const cd of candidateDates) {
        const weekday = new Date(cd.dateStr + "T00:00:00").toLocaleDateString("en-US", { weekday: "long" });
        const periods: any[] = [];
        for (const period of periodSlots) {
          // Mentor side: pass our demo's own slot via demo_sessions is checked by
          // availability engine through demo_swap_requests; direct demo_sessions check here:
          const mentorSelfDemoClash = await db.get(
            `SELECT id FROM demo_sessions
             WHERE mentorId = ? AND dateStr = ? AND id != ? AND status NOT IN ('completed', 'not_conducted')
               AND (timeSlot = ? OR ? LIKE ('%' || timeSlot || '%') OR timeSlot LIKE ('%' || ? || '%'))`,
            [demo.mentorId, cd.dateStr, demo.id, period, period, period]
          ).catch(() => null);

          const mentorReservationClash = reservations.find(r =>
            r.mentor_id === demo.mentorId &&
            r.demo_session_id !== demo.id &&
            r.proposed_date_str === cd.dateStr &&
            (r.proposed_time_slot === period || period.includes(r.proposed_time_slot) || r.proposed_time_slot.includes(period))
          );

          const mentorAvail = mentorSelfDemoClash || mentorReservationClash
            ? { available: false, reason: mentorSelfDemoClash ? "You have another demo at this period." : "This period is reserved by another reallocation." }
            : await checkMentorAvailability(db, {
              mentorId: demo.mentorId,
              dateStr: cd.dateStr,
              dayOfWeek: weekday,
              timeSlot: period
            });

          const smeReservationClash = reservations.find(r =>
            r.sme_id && r.sme_id === demo.smeId &&
            r.demo_session_id !== demo.id &&
            r.proposed_date_str === cd.dateStr &&
            (r.proposed_time_slot === period || period.includes(r.proposed_time_slot) || r.proposed_time_slot.includes(period))
          );

          const smeAvail = smeReservationClash
            ? { available: false, reason: "SME slot reserved by another reallocation." }
            : await checkSmeAvailability(db, {
              smeId: demo.smeId,
              dateStr: cd.dateStr,
              timeSlot: period
            });

          // SME also blocked by other demo_sessions at same date+slot
          const smeOtherDemo = await db.get(
            `SELECT id FROM demo_sessions
             WHERE smeId = ? AND dateStr = ? AND id != ? AND status NOT IN ('completed', 'not_conducted')
               AND (timeSlot = ? OR ? LIKE ('%' || timeSlot || '%') OR timeSlot LIKE ('%' || ? || '%'))`,
            [demo.smeId, cd.dateStr, demo.id, period, period, period]
          ).catch(() => null);

          const mentorFree = mentorAvail.available;
          const smeFree = smeAvail.available && !smeOtherDemo;

          periods.push({
            period,
            mentorFree,
            mentorReason: mentorFree ? null : (mentorAvail as any).reason || "Mentor busy",
            smeFree,
            smeReason: smeFree ? null : (smeOtherDemo ? "SME has another demo at this period." : (smeAvail as any).reason || "SME busy"),
            mutuallyFree: mentorFree && smeFree
          });
        }

        alternatives.push({ dateStr: cd.dateStr, label: cd.label, weekday, periods });
      }

      return NextResponse.json({
        success: true,
        demo,
        alternatives
      });
    }

    // ── List mode (allocator queue / mentor history) ───────────────────
    let query = "SELECT * FROM demo_reallocation_requests WHERE 1=1";
    const params: any[] = [];
    if (leaveRequestId) {
      query += " AND leave_request_id = ?";
      params.push(leaveRequestId);
    }
    if (status && status !== "all") {
      query += " AND status = ?";
      params.push(status);
    }
    query += " ORDER BY created_at DESC LIMIT 200";
    const requests = await db.all(query, ...params).catch(() => []);

    return NextResponse.json({ success: true, requests });
  } catch (err: any) {
    console.error("GET /api/demo-reallocations error:", err);
    return NextResponse.json({ success: false, message: err?.message || "Failed to fetch reallocation data" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const db = await getDb();
    await ensureMigration("demo_reallocation_requests");
    await ensureTable(db);

    const body = await request.json();
    const { action } = body;

    // Role-based authorization
    if (action === "resolve") {
      await requireRole(request, "admin", "allocator", "head_sme");
    } else if (action === "propose") {
      await requireSession(request);
    }

    // ── PROPOSE: mentor picks an alternative period → pending reservation ──
    if (action === "propose") {
      const { demoSessionId, proposedDateStr, proposedTimeSlot, leaveRequestId, reason, proposedBy } = body;
      if (!demoSessionId || !proposedDateStr || !proposedTimeSlot) {
        return NextResponse.json({ success: false, message: "Missing demoSessionId, proposedDateStr or proposedTimeSlot" }, { status: 400 });
      }

      const demo = await db.get("SELECT * FROM demo_sessions WHERE id = ?", [demoSessionId]);
      if (!demo) {
        return NextResponse.json({ success: false, message: "Demo session not found" }, { status: 404 });
      }
      if ((demo as any).status === "completed" || (demo as any).status === "not_conducted") {
        return NextResponse.json({ success: false, message: "Completed demos cannot be reallocated." }, { status: 400 });
      }

      // Replace any existing pending reservation for this demo
      await db.run(
        "DELETE FROM demo_reallocation_requests WHERE demo_session_id = ? AND status = 'pending'",
        [demoSessionId]
      ).catch(() => {});

      const reqId = "drr_" + Date.now() + "_" + Math.random().toString(36).substring(2, 8);
      await db.run(
        `INSERT INTO demo_reallocation_requests (
          id, demo_session_id, leave_request_id, mentor_id, mentor_name, sme_id, sme_name,
          subject, stream, week, original_date_str, original_time_slot,
          proposed_date_str, proposed_time_slot, reason, status, proposed_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
        [
          reqId,
          demoSessionId,
          leaveRequestId || null,
          demo.mentorId,
          demo.mentorName,
          demo.smeId,
          demo.smeName,
          demo.subject,
          demo.stream,
          (demo as any).week ?? null,
          demo.dateStr,
          demo.timeSlot,
          proposedDateStr,
          proposedTimeSlot,
          reason || "Mentor leave reallocation",
          proposedBy || demo.mentorName
        ]
      );

      // Notify the Allocator (in-app: users with allocator role get a queue view;
      // we notify the SME too since their availability is impacted)
      if (demo.smeId) {
        const notifId = "notif_" + Date.now() + "_" + Math.random().toString(36).substring(2, 8);
        await db.run(
          `INSERT INTO notifications (id, user_id, title, message, is_read, link, type, created_at)
           VALUES (?, ?, ?, ?, 0, '/allocator', 'demo_reallocation_proposed', ?)`,
          [
            notifId,
            demo.smeId,
            "Demo Reallocation Proposed",
            `${demo.mentorName} proposed moving the ${demo.subject} demo from ${demo.dateStr} (${demo.timeSlot}) to ${proposedDateStr} (${proposedTimeSlot}). Awaiting Allocator approval.`,
            new Date().toISOString()
          ]
        ).catch(() => {});
      }

      // Audit log
      const auditId = "audit_" + Date.now() + "_" + Math.random().toString(36).substring(2, 8);
      await db.run(
        `INSERT INTO audit_logs (id, type, description, actorName, actorRole, timestamp)
         VALUES (?, 'demo_reallocation_proposed', ?, ?, 'Mentor', ?)`,
        [
          auditId,
          `Demo ${demoSessionId} (${demo.subject}) reallocation proposed: ${demo.dateStr} (${demo.timeSlot}) → ${proposedDateStr} (${proposedTimeSlot}). Slot reserved pending Allocator approval.`,
          proposedBy || demo.mentorName,
          new Date().toISOString()
        ]
      ).catch(() => {});

      return NextResponse.json({
        success: true,
        message: `Alternative period reserved: ${proposedDateStr} (${proposedTimeSlot}). Sent to Allocator for approval.`,
        requestId: reqId
      });
    }

    // ── RESOLVE: Allocator approves or rejects ─────────────────────────
    if (action === "resolve") {
      const { requestId, decision, decidedBy, decisionNotes } = body;
      if (!requestId || !["approved", "rejected"].includes(decision)) {
        return NextResponse.json({ success: false, message: "Missing requestId or invalid decision" }, { status: 400 });
      }

      const req = await db.get("SELECT * FROM demo_reallocation_requests WHERE id = ?", [requestId]);
      if (!req) {
        return NextResponse.json({ success: false, message: "Reallocation request not found" }, { status: 404 });
      }
      if (req.status !== "pending") {
        return NextResponse.json({ success: false, message: `Request already ${req.status}.` }, { status: 400 });
      }

      if (decision === "rejected") {
        await db.run(
          "UPDATE demo_reallocation_requests SET status = 'rejected', decided_by = ?, decided_at = ?, decision_notes = ? WHERE id = ?",
          [decidedBy || "Allocator", new Date().toISOString(), decisionNotes || null, requestId]
        );

        const auditId = "audit_" + Date.now() + "_" + Math.random().toString(36).substring(2, 8);
        await db.run(
          `INSERT INTO audit_logs (id, type, description, actorName, actorRole, timestamp)
           VALUES (?, 'demo_reallocation_resolved', ?, ?, 'Allocator', ?)`,
          [
            auditId,
            `Demo reallocation ${requestId} REJECTED by ${decidedBy || "Allocator"}. Reservation released; original slot ${req.original_date_str} (${req.original_time_slot}) retained.`,
            decidedBy || "Allocator",
            new Date().toISOString()
          ]
        ).catch(() => {});

        return NextResponse.json({ success: true, message: "Reallocation rejected. Reservation released." });
      }

      // ── APPROVED: move the demo, release the original slot ────────────
      // Re-verify target is still free (another demo may have taken it meanwhile)
      const clash = await db.get(
        `SELECT id FROM demo_sessions
         WHERE dateStr = ? AND id != ? AND status NOT IN ('completed', 'not_conducted')
           AND (mentorId = ? OR smeId = ?)
           AND (timeSlot = ? OR ? LIKE ('%' || timeSlot || '%') OR timeSlot LIKE ('%' || ? || '%'))`,
        [req.proposed_date_str, req.demo_session_id, req.mentor_id, req.sme_id, req.proposed_time_slot, req.proposed_time_slot, req.proposed_time_slot]
      ).catch(() => null);
      if (clash) {
        return NextResponse.json({
          success: false,
          message: `Cannot approve: the proposed period ${req.proposed_date_str} (${req.proposed_time_slot}) is now occupied by another demo (${clash.id}).`
        }, { status: 409 });
      }

      await db.run(
        `UPDATE demo_sessions
         SET dateStr = ?, timeSlot = ?, status = 'confirmed'
         WHERE id = ?`,
        [req.proposed_date_str, req.proposed_time_slot, req.demo_session_id]
      );

      await db.run(
        "UPDATE demo_reallocation_requests SET status = 'approved', decided_by = ?, decided_at = ?, decision_notes = ? WHERE id = ?",
        [decidedBy || "Allocator", new Date().toISOString(), decisionNotes || null, requestId]
      );

      // Notifications: mentor + SME
      const notifId = "notif_" + Date.now() + "_" + Math.random().toString(36).substring(2, 8);
      await db.run(
        `INSERT INTO notifications (id, user_id, title, message, is_read, link, type, created_at)
         VALUES (?, ?, ?, ?, 0, '/mentor/demo_evaluations', 'demo_reallocation_approved', ?)`,
        [
          notifId,
          req.mentor_id,
          "Demo Reallocation Approved",
          `Your ${req.subject} demo has been moved to ${req.proposed_date_str} (${req.proposed_time_slot}). SME: ${req.sme_name}.`,
          new Date().toISOString()
        ]
      ).catch(() => {});

      const auditId = "audit_" + Date.now() + "_" + Math.random().toString(36).substring(2, 8);
      await db.run(
        `INSERT INTO audit_logs (id, type, description, actorName, actorRole, timestamp)
         VALUES (?, 'demo_reallocation_resolved', ?, ?, 'Allocator', ?)`,
        [
          auditId,
          `Demo reallocation ${requestId} APPROVED by ${decidedBy || "Allocator"}. Demo ${req.demo_session_id} (${req.subject}) moved ${req.original_date_str} (${req.original_time_slot}) → ${req.proposed_date_str} (${req.proposed_time_slot}). Original slot released.`,
          decidedBy || "Allocator",
          new Date().toISOString()
        ]
      ).catch(() => {});

      return NextResponse.json({ success: true, message: "Reallocation approved. Demo schedule updated across all views." });
    }

    return NextResponse.json({ success: false, message: "Invalid action" }, { status: 400 });
  } catch (err: any) {
    const authRes = apiAuthErrorResponse(err);
    if (authRes) return authRes;
    console.error("POST /api/demo-reallocations error:", err);
    return NextResponse.json({ success: false, message: err?.message || "Failed to process reallocation" }, { status: 500 });
  }
}
