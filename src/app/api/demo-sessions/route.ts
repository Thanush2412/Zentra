export const maxDuration = 60;

import { NextResponse, after } from "next/server";
import { getDb, chunkList, inPlaceholders, type QueryFailure } from "@/lib/db";
import { deriveSubjectType } from "@/lib/skillTracker";
import { requireRole, requireSession, apiAuthErrorResponse, normalizeRole } from "@/lib/api-auth";
import { generateId } from "@/lib/id";
import { ensureMigration } from "@/lib/migrations";

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

/**
 * Phase A (Demo Workflow Redesign): validate that a (SME, date, time) booking falls
 * inside one of the SME's ACTIVE demo-type availability windows (sme_availability,
 * slot_type = 'demo'), so a booking cannot land outside the hours the SME declared.
 * `book` fetches this as one slice of its preflight batch; `bulk-book` fetches every
 * SME/day pair in the upload with one set-based read instead.
 */
/** Column list must stay in sync with evaluateSmeDemoWindows below. */
const SME_WINDOWS_SQL =
  "SELECT start_time, end_time FROM sme_availability WHERE sme_id = ? AND UPPER(TRIM(day_of_week)) = UPPER(TRIM(?)) AND is_active != 0";

function weekdayOf(dateStr: string): string {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", { weekday: "long" });
}

/** One slice of the booking batch, so the window gate costs no extra round trip. */
function smeWindowsSlice(smeId: string, dateStr: string) {
  return { sql: SME_WINDOWS_SQL, params: [smeId, weekdayOf(dateStr)] };
}

/**
 * Pure gate over rows the booking batch already fetched, so no round trip is spent
 * re-reading availability. An unparsable slot is let through — the clash checks stay
 * the authority on those.
 */
function evaluateSmeDemoWindows(
  windows: any[],
  dayName: string,
  dateStr: string,
  timeSlot: string
): { ok: boolean; reason?: string } {
  if (!windows || windows.length === 0) {
    return { ok: false, reason: `SME has no demo availability configured on ${dayName} (${dateStr}).` };
  }
  const demoWindows = windows.filter((w: any) => (w.slot_type || "demo") === "demo");
  const usable = demoWindows.length > 0 ? demoWindows : windows;
  const target = parseTimeToMinutes(timeSlot);
  if (target < 0) return { ok: true };
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
}

/**
 * A booking/reschedule gate is only as good as the read behind it: when a slice of the
 * preflight batch fails the slot cannot be claimed, so refuse loudly instead of letting
 * the INSERT through on an unchecked clash.
 */
function preflightFailureResponse(failed: QueryFailure[], verb: string) {
  console.error(
    `POST /api/demo-sessions ${verb} preflight failed:`,
    failed.map(f => `${String(f.sql).slice(0, 90)} → ${f.error}`).join(" | ")
  );
  return NextResponse.json(
    { success: false, message: `Cannot ${verb}: the booking checks could not be completed. Please retry.` },
    { status: 500 }
  );
}


/**
 * GET /api/demo-sessions?college_id=…  (or ?college_id=all)
 * Read-only listing for dashboards that only need to display demo data
 * (e.g. the CM's Mentor Demo & Evaluation ledger). Role-gated to staff.
 *
 * `all` is the institution-wide read the L&D allocator needs after resolving one
 * reallocation: previously it fired one request per campus and merged the pages,
 * which multiplied the round trips without changing the rows.
 */
const INSTITUTION_WIDE_DEMO_ROLES = ["admin", "L and D", "head_sme"];

export async function GET(request: Request) {
  try {
    const session = await requireRole(request, "admin", "L and D", "head_sme", "sme", "cm", "kam");
    const db = await getDb();
    const collegeId = new URL(request.url).searchParams.get("college_id");
    if (!collegeId) {
      return NextResponse.json({ success: false, message: "Missing college_id" }, { status: 400 });
    }
    if (collegeId === "all") {
      const role = normalizeRole(session.role);
      if (!INSTITUTION_WIDE_DEMO_ROLES.includes(role)) {
        return NextResponse.json(
          { success: false, message: "Forbidden: college_id=all needs an institution-wide role." },
          { status: 403 }
        );
      }
      const records = await db.all(
        `SELECT * FROM demo_sessions ORDER BY dateStr DESC, created_at DESC`
      );
      return NextResponse.json({ success: true, records });
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
      await requireRole(request, "admin", "L and D", "head_sme");
    } else if (action === "evaluate") {
      await requireRole(request, "sme", "head_sme", "admin", "L and D");
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

      // One round trip holds every booking gate: the mentor's approved leave, an existing
      // demo in the slot, the SME's declared windows and any pending reallocation
      // reservation holding that (SME, date, slot) for another demo.
      await ensureMigration("demo_reallocation_requests");
      const dayName = weekdayOf(dateStr);
      const bookSlices = [
        {
          label: "mentorLeave",
          sql: `SELECT id, request_type FROM faculty_leave_requests 
                WHERE mentor_id = ? AND status = 'approved' AND start_date <= ? AND end_date >= ?`,
          params: [mentorId, dateStr, dateStr],
        },
        {
          label: "existingDemo",
          sql: "SELECT id FROM demo_sessions WHERE mentorId = ? AND dateStr = ? AND timeSlot = ?",
          params: [mentorId, dateStr, timeSlot],
        },
        { label: "smeWindows", ...smeWindowsSlice(smeId, dateStr) },
        {
          label: "reservation",
          sql: `SELECT id FROM demo_reallocation_requests
                WHERE status IN ('pending', 'approved') AND smeId = ? AND proposed_date_str = ?
                  AND (proposed_time_slot = ? OR ? LIKE ('%' || proposed_time_slot || '%') OR proposed_time_slot LIKE ('%' || ? || '%'))`,
          params: [smeId, dateStr, timeSlot, timeSlot, timeSlot],
        },
      ];
      const bookFailed: QueryFailure[] = [];
      const bookReads = await db.multiQuery(bookSlices, bookFailed);
      if (bookFailed.length > 0) return preflightFailureResponse(bookFailed, "allocate demo");
      const [mentorLeaveRows, existingDemoRows, smeWindowRows, reservationRows] = bookReads;

      if (mentorLeaveRows?.[0]) {
        return NextResponse.json({ success: false, message: `Cannot allocate demo: Mentor is on approved ${mentorLeaveRows[0].request_type || 'leave'} on ${dateStr}.` });
      }
      if (existingDemoRows?.length) {
        return NextResponse.json({ success: false, message: "An L&D session is already booked for this mentor at this date/time." });
      }
      // Phase A: booking must fall inside the SME's declared demo-availability window
      const windowCheck = evaluateSmeDemoWindows(smeWindowRows || [], dayName, dateStr, timeSlot);
      if (!windowCheck.ok) {
        return NextResponse.json({ success: false, message: `Cannot allocate demo: ${windowCheck.reason}` });
      }
      // Leave-driven reallocation reservations: a pending/approved reservation
      // blocks booking another demo into the same (SME, date, slot) — the period
      // is temporarily held for the reallocated demo until L&D decides.
      if (reservationRows?.length) {
        return NextResponse.json({ success: false, message: "This period is reserved for a pending demo reallocation (awaiting L&D approval)." });
      }

      // Generate ID
      const sessionId = generateId("ds");
      
      await db.run(
        `INSERT INTO demo_sessions (id, mentorId, mentorName, smeId, smeName, dateStr, timeSlot, subject, stream, week, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'scheduled', ?)`,
        [sessionId, mentorId, mentorName, smeId, smeName, dateStr, timeSlot, subject, stream, week, new Date().toISOString()]
      );

      // Audit Log
      const auditId = generateId("audit");
      await db.run(
        `INSERT INTO audit_logs (id, type, description, actorName, actorRole, timestamp)
         VALUES (?, 'booking', ?, 'System', 'Learning and Development', ?)`,
        [auditId, `L&D session allocated for ${mentorName} with SME ${smeName} on ${dateStr} at ${timeSlot}`, new Date().toISOString()]
      );

      return NextResponse.json({ success: true, message: "L&D session allocated successfully!" });

    } else if (action === "bulk-book") {
      const sessions = body.sessions;
      if (!Array.isArray(sessions)) {
        return NextResponse.json({ success: false, message: "Invalid sessions format" }, { status: 400 });
      }

      const rows = sessions.filter((s: any) => s && s.mentorId && s.smeId && s.dateStr && s.timeSlot);
      const malformed = sessions.length - rows.length;
      if (rows.length === 0) {
        return NextResponse.json({
          success: true,
          allocated: 0,
          skipped: malformed,
          message: malformed > 0 ? `Nothing allocated — ${malformed} row(s) were missing mentor, SME, date or slot.` : "Nothing to allocate."
        });
      }

      const dates = Array.from(new Set(rows.map((r: any) => String(r.dateStr)))).sort();
      const mentorIds = Array.from(new Set(rows.map((r: any) => String(r.mentorId))));
      const smeIds = Array.from(new Set(rows.map((r: any) => String(r.smeId))));
      const days = Array.from(new Set(rows.map((r: any) => weekdayOf(String(r.dateStr)))));

      // Three set-based reads replace three round trips per upload row. A 200-row Excel
      // sheet used to spend 600 reads before it could insert anything.
      const bulkPreflight: QueryFailure[] = [];
      const [leaveRows, bookedRows, windowRows] = await db.multiQuery([
        {
          sql: `SELECT mentor_id, start_date, end_date FROM faculty_leave_requests
                WHERE status = 'approved' AND mentor_id IN (${inPlaceholders(mentorIds.length)}) AND start_date <= ? AND end_date >= ?`,
          params: [...mentorIds, dates[dates.length - 1], dates[0]]
        },
        {
          sql: `SELECT mentorId, dateStr, timeSlot FROM demo_sessions
                WHERE mentorId IN (${inPlaceholders(mentorIds.length)}) AND dateStr IN (${inPlaceholders(dates.length)})`,
          params: [...mentorIds, ...dates]
        },
        {
          sql: `SELECT sme_id, day_of_week, start_time, end_time, slot_type FROM sme_availability
                WHERE sme_id IN (${inPlaceholders(smeIds.length)}) AND UPPER(TRIM(day_of_week)) IN (${inPlaceholders(days.length)}) AND is_active != 0`,
          params: [...smeIds, ...days.map((d) => d.toUpperCase())]
        }
      ], bulkPreflight);
      if (bulkPreflight.length > 0) return preflightFailureResponse(bulkPreflight, "bulk-allocate demos");

      const leaveByMentor = new Map<string, any[]>();
      for (const l of leaveRows || []) {
        const k = String(l.mentor_id);
        leaveByMentor.set(k, [...(leaveByMentor.get(k) || []), l]);
      }
      const windowBySmeDay = new Map<string, any[]>();
      for (const w of windowRows || []) {
        const k = `${String(w.sme_id)}|${String(w.day_of_week || "").trim().toLowerCase()}`;
        windowBySmeDay.set(k, [...(windowBySmeDay.get(k) || []), w]);
      }
      // Holds DB-existing and upload-internal clashes, so a sheet that lists the same
      // mentor/date/slot twice cannot book it twice (the old per-row read caught that).
      const booked = new Set<string>(
        (bookedRows || []).map((r: any) => `${String(r.mentorId)}|${String(r.dateStr)}|${String(r.timeSlot)}`)
      );

      const inserts: any[][] = [];
      let skipped = malformed;
      const now = new Date().toISOString();

      for (const sess of rows) {
        const { mentorId, mentorName, smeId, smeName, dateStr, timeSlot, subject, stream, week } = sess;

        const onLeave = (leaveByMentor.get(String(mentorId)) || []).some((l: any) => {
          const start = String(l.start_date).slice(0, 10);
          const end = String(l.end_date).slice(0, 10);
          return start <= String(dateStr) && end >= String(dateStr);
        });
        if (onLeave) { skipped++; continue; }

        const key = `${String(mentorId)}|${String(dateStr)}|${String(timeSlot)}`;
        if (booked.has(key)) { skipped++; continue; }

        const dayName = weekdayOf(String(dateStr));
        const windows = windowBySmeDay.get(`${String(smeId)}|${dayName.toLowerCase()}`) || [];
        if (!evaluateSmeDemoWindows(windows, dayName, String(dateStr), String(timeSlot)).ok) { skipped++; continue; }

        booked.add(key);
        inserts.push([
          generateId("ds"), mentorId, mentorName, smeId, smeName, dateStr, timeSlot, subject, stream, week, "scheduled", now
        ]);
      }

      let allocated = 0;
      const oneRow = `(${Array.from({ length: 12 }, () => "?").join(", ")})`;
      for (const part of chunkList(inserts, 100)) {
        const res = await db.run(
          `INSERT INTO demo_sessions (id, mentorId, mentorName, smeId, smeName, dateStr, timeSlot, subject, stream, week, status, created_at)
           VALUES ${part.map(() => oneRow).join(", ")}`,
          part.flat()
        );
        allocated += Number(res?.changes ?? part.length);
      }

      return NextResponse.json({
        success: true,
        allocated,
        skipped,
        message: skipped > 0
          ? `Bulk allocation complete: ${allocated} demo(s) scheduled, ${skipped} skipped (already booked, on leave, outside SME demo hours or malformed).`
          : `Bulk demos allocated successfully! (${allocated})`
      });

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
      return NextResponse.json({ success: true, message: "L&D session updated successfully." });

    } else if (action === "swap") {
      const { session1Id, session2Id } = body;
      if (!session1Id || !session2Id) {
        return NextResponse.json({ success: false, message: "Missing session IDs for swap" }, { status: 400 });
      }

      const swapFailed: QueryFailure[] = [];
      const [s1Rows, s2Rows] = await db.multiQuery([
        { sql: "SELECT * FROM demo_sessions WHERE id = ?", params: [session1Id] },
        { sql: "SELECT * FROM demo_sessions WHERE id = ?", params: [session2Id] }
      ], swapFailed);
      if (swapFailed.length > 0) return preflightFailureResponse(swapFailed, "swap demos");
      const s1 = s1Rows?.[0] || null;
      const s2 = s2Rows?.[0] || null;

      if (!s1 || !s2) {
        return NextResponse.json({ success: false, message: "One or both sessions not found" }, { status: 404 });
      }

      // Two separate UPDATEs could leave both sessions on the same slot half-swapped.
      await db.transaction(async (tx) => {
        await tx.run("UPDATE demo_sessions SET dateStr = ?, timeSlot = ? WHERE id = ?", [s2.dateStr, s2.timeSlot, s1.id]);
        await tx.run("UPDATE demo_sessions SET dateStr = ?, timeSlot = ? WHERE id = ?", [s1.dateStr, s1.timeSlot, s2.id]);
      });
      return NextResponse.json({ success: true, message: "L&D sessions swapped successfully." });

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
          // The mentor row and the "already cleared this demo?" probe are independent,
          // so they share one round trip. A failed slice throws into the local catch
          // instead of reading as "no clearance yet" and inserting a duplicate row.
          const clearanceFailures: QueryFailure[] = [];
          const [mentorRows, existingClearanceRows] = await db.multiQuery(
            [
              { sql: "SELECT id, name, college_id FROM mentors WHERE id = ?", params: [session.mentorId] },
              { sql: "SELECT id FROM mentor_skill_clearances WHERE mentor_id = ? AND scope = 'demo' AND demo_session_id = ?", params: [session.mentorId, sessionId] },
            ],
            clearanceFailures
          );
          if (clearanceFailures.length > 0) {
            throw new Error(`clearance inputs unreadable: ${clearanceFailures[0].error}`);
          }
          const mentorRow: any = mentorRows[0] || null;
          const existingClearance: any = existingClearanceRows[0] || null;
          if (existingClearance?.id) {
            await db.run(
              `UPDATE mentor_skill_clearances SET status = ?, score = ?, remarks = ?, verified_by = ?, verified_at = ?, updated_at = ? WHERE id = ?`,
              [autoVerdict, marks, comments || "", session.smeName || "Subject Matter Expert", new Date().toISOString(), new Date().toISOString(), existingClearance.id]
            );
          } else {
            const clearanceId = generateId("MSC");
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

      // ── Mentor score notification email ──
      // Always send the evaluated mentor their score — regardless of pass/fail.
      // The recipient lookup and the send both move behind the response: a slow
      // relay would otherwise add its full 12s deadline to the SME's save click.
      after(async () => {
        try {
          const { dispatchMail } = await import("@/lib/mailAsync");
          const { renderSmeEvaluationEmail, BRAND: brand } = await import("@/lib/mail");
          const mentorEmailRow: any = await db.get(
            "SELECT email, name, department, mentor_group FROM mentors WHERE id = ? LIMIT 1",
            [session.mentorId]
          ).catch(() => null);

          if (mentorEmailRow?.email) {
            const passMark   = 50;
            const passed     = marks >= passMark;
            const groupLabel = mentorEmailRow.mentor_group || mentorEmailRow.department || session.stream || "General";
            await dispatchMail({
              to: mentorEmailRow.email,
              subject: `${brand.emailPrefix} Your L&D Evaluation Score — ${session.subject} (${session.dateStr})`,
              htmlBody: renderSmeEvaluationEmail({
                mentorName:  mentorEmailRow.name || session.mentorName || "Mentor",
                smeName:     session.smeName    || "Subject Matter Expert",
                rating:      `${marks} / 100 — ${passed ? "✅ Cleared" : "❌ Not Cleared"}`,
                feedback:    comments || "Review full scorecard on the portal.",
                mentorGroup: groupLabel,
              }),
              context: "sme-evaluation-score",
            });
          }
        } catch (_) {
          // Never block evaluation on email failure
        }
      });

      // ── Phase C: compliance-gap escalation mail (KAM + CM, SME CC'd) ──
      // Any unmet criterion (unticked checkbox or final mark below threshold)
      // triggers one email; the evaluation itself is NEVER blocked.
      if (unmetItems.length > 0) {
        after(async () => {
          try {
            const { dispatchMail } = await import("@/lib/mailAsync");
            const { renderDemoComplianceEmail } = await import("@/lib/mail");

            // Mentor, KAM roster and SME evaluator all key off the session, so they
            // leave as one group. Mail-only: a failed slice degrades to a missing
            // recipient, and the evaluation result is already recorded.
            const complianceFailures: QueryFailure[] = [];
            const [mentorRows, kams, smes] = await db.multiQuery([
              { sql: "SELECT id, name, department, mentor_group, college_id FROM mentors WHERE id = ?", params: [session.mentorId] },
              { sql: "SELECT name, email FROM kam_users WHERE email IS NOT NULL" },
              { sql: "SELECT name, email FROM sme_users WHERE id = ? AND email IS NOT NULL", params: [session.smeId] },
            ], complianceFailures);
            if (complianceFailures.length > 0) {
              console.warn("[demo-sessions] compliance recipients incomplete:", complianceFailures.map(f => f.error).join("; "));
            }
            const mentorRow: any = mentorRows[0] || null;
            const department = mentorRow?.department || mentorRow?.mentor_group || session.stream || "General";
            const collegeId = mentorRow?.college_id || null;

            const toEmails: string[] = [];
            const ccEmails: string[] = [];

            kams.forEach((k: any) => { if (k.email) toEmails.push(k.email); });

            // CM: campus_managers for the mentor's college (fall back to all CMs)
            const cms: any[] = collegeId
              ? await db.all("SELECT name, email FROM campus_managers WHERE college_id = ? AND email IS NOT NULL", [collegeId]).catch(() => [])
              : await db.all("SELECT name, email FROM campus_managers WHERE email IS NOT NULL").catch(() => []);
            cms.forEach((c: any) => { if (c.email) toEmails.push(c.email); });

            // SME evaluator CC'd on the thread
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
              await dispatchMail({
                to: dedupTo,
                cc: dedupCc,
                subject: `[Demo Compliance Gap] ${session.mentorName} — ${session.subject} (${session.dateStr})`,
                htmlBody: html,
                context: "demo-compliance-gap",
              });
            }
          } catch (mailErr: any) {
            console.warn("[demo-sessions] compliance escalation mail failed:", mailErr?.message);
          }
        });

        // Audit log the gap
        const gapAuditId = generateId("audit");
        await db.run(
          `INSERT INTO audit_logs (id, type, description, actorName, actorRole, timestamp)
           VALUES (?, 'demo_compliance_gap', ?, ?, 'SME', ?)`,
          [gapAuditId, `Compliance gap on demo for ${session.mentorName} (${session.subject}): unmet criteria — ${unmetItems.join("; ")}. Escalation mail being sent to KAM/CM.`, session.smeName, new Date().toISOString()]
        ).catch(() => {});
      }

      // Audit Log
      const auditId = generateId("audit");
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
        return NextResponse.json({ success: false, message: "L&D session not found." }, { status: 404 });
      }

      if (session.mentorId !== mentorId) {
        return NextResponse.json({ success: false, message: "Unauthorized: You can only reschedule your own L&D session." }, { status: 403 });
      }

      // 1-4 in one round trip: approved leave, the mentor's own clash, the SME's clash and
      // any other demo's pending reservation over the target period.
      await ensureMigration("demo_reallocation_requests");
      const reschedSlices = [
        {
          label: "mentorLeave",
          sql: `SELECT id, request_type FROM faculty_leave_requests 
                WHERE mentor_id = ? AND status = 'approved' AND start_date <= ? AND end_date >= ?`,
          params: [mentorId, newDateStr, newDateStr],
        },
        {
          label: "mentorDemoClash",
          sql: "SELECT id FROM demo_sessions WHERE mentorId = ? AND dateStr = ? AND timeSlot = ? AND id != ? AND status NOT IN ('not_conducted')",
          params: [mentorId, newDateStr, newTimeSlot, sessionId],
        },
        {
          label: "smeDemoClash",
          sql: "SELECT id FROM demo_sessions WHERE smeId = ? AND dateStr = ? AND timeSlot = ? AND id != ? AND status NOT IN ('not_conducted')",
          params: [session.smeId, newDateStr, newTimeSlot, sessionId],
        },
        {
          label: "reservation",
          sql: `SELECT id FROM demo_reallocation_requests
                WHERE status IN ('pending', 'approved') AND id != (SELECT id FROM demo_reallocation_requests WHERE demo_session_id = ? AND status = 'pending' LIMIT 1)
                  AND smeId = ? AND proposed_date_str = ?
                  AND (proposed_time_slot = ? OR ? LIKE ('%' || proposed_time_slot || '%') OR proposed_time_slot LIKE ('%' || ? || '%'))`,
          params: [sessionId, session.smeId, newDateStr, newTimeSlot, newTimeSlot, newTimeSlot],
        },
      ];
      const reschedFailed: QueryFailure[] = [];
      const reschedReads = await db.multiQuery(reschedSlices, reschedFailed);
      if (reschedFailed.length > 0) return preflightFailureResponse(reschedFailed, "reschedule");
      const [mentorLeaveRows, mentorDemoClashRows, smeDemoClashRows, reservationRows] = reschedReads;

      if (mentorLeaveRows?.[0]) {
        return NextResponse.json({ success: false, message: `Cannot reschedule: You have an approved ${mentorLeaveRows[0].request_type || 'leave'} on ${newDateStr}.` }, { status: 400 });
      }
      if (mentorDemoClashRows?.length) {
        return NextResponse.json({ success: false, message: "You already have another demo session scheduled at this date/time." }, { status: 400 });
      }
      if (smeDemoClashRows?.length) {
        return NextResponse.json({ success: false, message: `Assigned SME ${session.smeName} already has another demo session at this date/time.` }, { status: 400 });
      }
      if (reservationRows?.length) {
        return NextResponse.json({ success: false, message: "Target period is reserved for a pending demo reallocation (awaiting L&D approval)." }, { status: 400 });
      }

      // ── Phase B (Demo Workflow Redesign): reschedules no longer auto-confirm ──
      // Create a PENDING reallocation request that L&D must approve.
      // The slot is NOT changed here; /api/demo-reallocations action=resolve does it.
      const reallocId = generateId("drr");
      // Replacing the stale request and writing the new one must not half-apply: a
      // surviving duplicate would leave L&D approving a period the mentor moved on from.
      await db.transaction(async (tx) => {
        await tx.run(
          "DELETE FROM demo_reallocation_requests WHERE demo_session_id = ? AND status = 'pending' AND request_kind = 'reschedule'",
          [sessionId]
        );
        await tx.run(
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
      });

      // Notify every L&D viewer with ONE multi-row insert instead of one round trip per
      // campus manager — with ~30 campuses the loop alone was ~6s on this request.
      const lndViewers: any[] = await db.all("SELECT id FROM campus_managers").catch(() => []);
      if (lndViewers.length > 0) {
        const notifiedAt = new Date().toISOString();
        const notifMessage = `${session.mentorName} requested moving the ${session.subject} L&D session from ${session.dateStr} (${session.timeSlot}) to ${newDateStr} (${newTimeSlot}).`;
        const notifRows = lndViewers
          .filter((alloc: any) => alloc?.id)
          .map((alloc: any) => [generateId("notif"), alloc.id, "L&D Reschedule Awaiting Approval", notifMessage, 0, "/l-and-d", "demo_reschedule_requested", notifiedAt]);
        if (notifRows.length > 0) {
          const oneRow = `(${notifRows[0].map(() => "?").join(", ")})`;
          for (let i = 0; i < notifRows.length; i += 100) {
            const part = notifRows.slice(i, i + 100);
            await db.run(
              `INSERT INTO notifications (id, user_id, title, message, is_read, link, type, created_at)
               VALUES ${part.map(() => oneRow).join(", ")}`,
              part.flat()
            ).catch((notifErr: any) => console.warn("[demo-sessions] reschedule notifications failed:", notifErr?.message));
          }
        }
      }

      // Audit Log
      const auditId = generateId("audit");
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
    await requireRole(request, "admin", "L and D", "head_sme");
    const db = await getDb();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ success: false, message: "Missing session id" }, { status: 400 });
    }

    await db.run("DELETE FROM demo_sessions WHERE id = ?", [id]);
    return NextResponse.json({ success: true, message: "L&D session deleted successfully." });
  } catch (error: any) {
    const authRes = apiAuthErrorResponse(error);
    if (authRes) return authRes;
    console.error("API DELETE demo-sessions error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
