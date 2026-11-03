export const maxDuration = 60;

import { NextResponse } from "next/server";
import { getDb, type QueryFailure } from "@/lib/db";
import { requireAuth, Role } from "@/lib/authGuard";
import { checkMentorAvailability, checkSmeAvailability } from "@/lib/availability";
import { generateId } from "@/lib/id";
import { sendMailAsync } from "@/lib/mailAsync";
import { renderEmailShell, renderSwapOfferEmail, BRAND } from "@/lib/mail";

const DEMO_SWAP_ROLES: Role[] = ["mentor", "sme", "cm", "kam", "admin", "L and D"];

export async function GET(request: Request) {
  const { auth, errorResponse } = await requireAuth(request, {
    allowedRoles: DEMO_SWAP_ROLES,
    checkCsrf: false
  });
  if (errorResponse) return errorResponse;

  try {
    const db = await getDb();
    const role = auth?.user?.role;
    const selfIds = Array.from(
      new Set([auth?.user?.reference_id, auth?.user?.id].filter(Boolean) as string[])
    );

    // demo_swap_requests carries no college_id, so the L&D/CM/KAM/admin queue stays global.
    // Mentors and SMEs only ever see proposals that name them — previously they read every
    // swap request on the platform, including other campuses' reasons and remarks.
    if (role === "mentor" || role === "sme") {
      if (selfIds.length === 0) {
        return NextResponse.json({ success: true, requests: [] });
      }
      const ph = selfIds.map(() => "?").join(",");
      const [ownerCol, proposedCol] =
        role === "mentor" ? ["mentorId", "proposedMentorId"] : ["smeId", "proposedSmeId"];
      const requests = await db.all(
        `SELECT * FROM demo_swap_requests WHERE ${ownerCol} IN (${ph}) OR ${proposedCol} IN (${ph}) ORDER BY created_at DESC`,
        [...selfIds, ...selfIds]
      );
      return NextResponse.json({ success: true, requests });
    }

    const requests = await db.all("SELECT * FROM demo_swap_requests ORDER BY created_at DESC");
    return NextResponse.json({ success: true, requests });
  } catch (error: any) {
    console.error("API GET demo-swap error:", error);
    return NextResponse.json({ success: false, message: error.message || "Failed to fetch swap requests" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const { errorResponse } = await requireAuth(request, { allowedRoles: DEMO_SWAP_ROLES });
  if (errorResponse) return errorResponse;

  try {
    const db = await getDb();
    const body = await request.json();
    const { action } = body;

    if (action === "request") {
      const {
        sessionId,
        mentorId,
        mentorName,
        smeId,
        smeName,
        dateStr,
        timeSlot,
        subject,
        stream,
        reason,
        remarks,
        swapType,
        proposedMentorId,
        proposedMentorName,
        proposedSmeId,
        proposedSmeName,
        proposedDateStr,
        proposedTimeSlot
      } = body;

      if (!sessionId || !mentorId || !smeId || !dateStr || !timeSlot || !subject || !stream || !reason || !swapType) {
        return NextResponse.json({ success: false, message: "Missing required fields for swap request" }, { status: 400 });
      }

      // The dual availability gates and the pending-duplicate probe all key off the
      // body and share no inputs, so they run together instead of one after another.
      // The checks still report in the same order: mentor, SME, duplicate.
      const targetDate = proposedDateStr || dateStr;
      const targetTime = proposedTimeSlot || timeSlot;
      const [mentorAvail, smeAvail, existingPending] = await Promise.all([
        proposedMentorId
          ? checkMentorAvailability(db, { mentorId: proposedMentorId, dateStr: targetDate, timeSlot: targetTime })
          : Promise.resolve(null),
        proposedSmeId
          ? checkSmeAvailability(db, { smeId: proposedSmeId, dateStr: targetDate, timeSlot: targetTime })
          : Promise.resolve(null),
        db.get(
          "SELECT id FROM demo_swap_requests WHERE sessionId = ? AND status IN ('pending', 'pending_peer', 'pending_sme')",
          [sessionId]
        ),
      ]);

      if (mentorAvail && !mentorAvail.available) {
        return NextResponse.json({
          success: false,
          message: `Proposed mentor ${proposedMentorName || proposedMentorId} is unavailable: ${mentorAvail.reason}`
        }, { status: 400 });
      }

      if (smeAvail && !smeAvail.available) {
        return NextResponse.json({
          success: false,
          message: `Proposed SME ${proposedSmeName || proposedSmeId} is unavailable: ${smeAvail.reason}`
        }, { status: 400 });
      }

      if (existingPending) {
        return NextResponse.json({ success: false, message: "A swap request for this L&D session is already pending review." });
      }

      const reqId = generateId("dsr");
      const createdAt = new Date().toISOString();
      const initialStatus = swapType === "internal" ? "pending_peer" : "pending";

      await db.run(
        `INSERT INTO demo_swap_requests (
          id, sessionId, mentorId, mentorName, smeId, smeName, dateStr, timeSlot, subject, stream, reason, remarks, swapType,
          proposedMentorId, proposedMentorName, proposedSmeId, proposedSmeName, proposedDateStr, proposedTimeSlot, status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          reqId, sessionId, mentorId, mentorName, smeId, smeName, dateStr, timeSlot, subject, stream, reason, remarks || "", swapType,
          proposedMentorId || null, proposedMentorName || null, proposedSmeId || null, proposedSmeName || null, proposedDateStr || null, proposedTimeSlot || null,
          initialStatus, createdAt
        ]
      );

      // Audit Log
      const auditId = generateId("audit");
      const desc = swapType === "internal"
        ? `Internal swap proposal sent by Mentor ${mentorName} proposing replacement peer ${proposedMentorName}`
        : `L&D swap requested by SME ${smeName} for mentor ${mentorName} (Reason: ${reason})`;
      
      await db.run(
        `INSERT INTO audit_logs (id, type, description, actorName, actorRole, timestamp)
         VALUES (?, 'swap_request', ?, ?, ?, ?)`,
        [
          auditId,
          desc,
          swapType === "internal" ? mentorName : smeName,
          swapType === "internal" ? "Mentor" : "SME",
          createdAt
        ]
      );

      // Notify the proposed replacement mentor / SME by email
      try {
        if (swapType === "internal" && proposedMentorId) {
          const proposedMentor = await db.get(
            "SELECT email, name FROM mentors WHERE id = ? LIMIT 1",
            [proposedMentorId]
          );
          if (proposedMentor?.email) {
            const swapDate = proposedDateStr || dateStr;
            const swapTime = proposedTimeSlot || timeSlot;
            const [dY, dM, dD] = swapDate.split("-").map(Number);
            const dateFormatted = new Date(dY, dM - 1, dD, 12, 0, 0).toLocaleDateString("en-IN", {
              weekday: "long", day: "2-digit", month: "short", year: "numeric"
            });
            sendMailAsync({
              to: proposedMentor.email,
              subject: `${BRAND.emailPrefix} Demo Swap Proposal — ${subject}`,
              htmlBody: renderSwapOfferEmail({
                requestorName:    mentorName,
                targetMentorName: proposedMentor.name || proposedMentorName || "Mentor",
                dateStr:          dateFormatted,
                time:             swapTime,
                course:           subject,
                classGroup:       stream || "General",
              }),
              context: "demo-swap-request",
            });
          }
        } else if (swapType !== "internal" && proposedSmeId) {
          // External swap: notify proposed SME replacement
          const proposedSme = await db.get(
            "SELECT email, name FROM sme_users WHERE id = ? LIMIT 1",
            [proposedSmeId]
          );
          if (proposedSme?.email) {
            sendMailAsync({
              to: proposedSme.email,
              subject: `${BRAND.emailPrefix} L&D Swap Proposal — ${subject}`,
              htmlBody: renderEmailShell({
                title: "L&D Session Swap Proposed",
                badgeText: "SWAP PROPOSAL",
                badgeColor: "amber",
                description: `SME <strong>${smeName}</strong> has proposed you as a replacement evaluator for an L&D session.`,
                details: [
                  { label: "Subject",         value: subject,                          highlight: true },
                  { label: "Original Date",   value: dateStr },
                  { label: "Proposed Date",   value: proposedDateStr || dateStr },
                  { label: "Time Slot",        value: proposedTimeSlot || timeSlot },
                  { label: "Stream",           value: stream },
                  { label: "Requested By",    value: smeName },
                  { label: "Reason",           value: reason },
                ],
                ctaText: "View L&D Dashboard →",
                ctaUrl: `${BRAND.portalUrl}/sme/demo_list`,
              }),
              context: "demo-swap-sme-proposal",
            });
          }
        }
      } catch (_) {}

      return NextResponse.json({ success: true, message: "Swap request submitted successfully!" });

    } else if (action === "resolve") {
      const { requestId, status } = body;

      if (!requestId || !status) {
        return NextResponse.json({ success: false, message: "Missing required fields for resolving request" }, { status: 400 });
      }

      const req = await db.get("SELECT * FROM demo_swap_requests WHERE id = ?", [requestId]);
      if (!req) {
        return NextResponse.json({ success: false, message: "Swap request not found" }, { status: 404 });
      }

      if (req.status === "approved" || req.status === "rejected") {
        return NextResponse.json({ success: false, message: "Swap request has already been resolved" });
      }

      const resolvedAt = new Date().toISOString();

      if (status === "rejected") {
        // The session row and the requestor's address both key off the request, so
        // they leave as one group. Only the session slice feeds a write; the address
        // slice only feeds mail, so a mail read failure must not block the rejection.
        const rejectFailures: QueryFailure[] = [];
        const [sessionRows, requestorRows] = await db.multiQuery([
          { sql: "SELECT * FROM demo_sessions WHERE id = ?", params: [req.sessionId] },
          req.swapType === "internal"
            ? { sql: "SELECT email FROM mentors WHERE id = ? LIMIT 1", params: [req.mentorId] }
            : { sql: "SELECT email FROM sme_users WHERE id = ? LIMIT 1", params: [req.smeId] },
        ], rejectFailures);
        if (rejectFailures.some(f => f.sql.includes("FROM demo_sessions"))) {
          return NextResponse.json({ success: false, message: "Could not verify the L&D session before rejecting. Please try again." }, { status: 500 });
        }
        const session = sessionRows[0];
        const requestorEmail = requestorRows[0]?.email || null;

        await db.run("UPDATE demo_swap_requests SET status = 'rejected' WHERE id = ?", [requestId]);

        if (session && session.status !== "completed") {
          await db.run(
            "UPDATE demo_sessions SET status = 'reallocation_required' WHERE id = ?",
            [req.sessionId]
          );
        }

        const auditId = generateId("audit");
        await db.run(
          `INSERT INTO audit_logs (id, type, description, actorName, actorRole, timestamp)
           VALUES (?, 'swap_resolve', ?, 'System', 'L&D', ?)`,
          [auditId, `L&D reallocation request ${requestId} rejected by SME. Session remains in reallocation_required.`, resolvedAt]
        );

        // Notify the original requestor (mentor or SME who raised the swap)
        try {
          if (requestorEmail) {
            sendMailAsync({
              to: requestorEmail,
              subject: `${BRAND.emailPrefix} Demo Swap Declined — ${req.subject}`,
              htmlBody: renderEmailShell({
                title: "Demo Swap Request Declined",
                badgeText: "SWAP DECLINED",
                badgeColor: "rose",
                description: `Your swap proposal for the L&D session could not be approved at this time. The session has been placed back in reallocation queue.`,
                details: [
                  { label: "Subject",         value: req.subject,                     highlight: true },
                  { label: "Original Date",   value: req.dateStr },
                  { label: "Proposed Mentor", value: req.proposedMentorName || req.proposedSmeName || "N/A" },
                  { label: "Status",          value: "Declined — reallocation required", highlight: true },
                ],
                ctaText: "View Demo Sessions →",
                ctaUrl: `${BRAND.portalUrl}/mentor/demo_evaluations`,
              }),
              context: "demo-swap-rejected",
            });
          }
        } catch (_) {}

        return NextResponse.json({ success: true, message: "Reallocation request rejected. Session remains in reallocation_required." });
      }

      if (status === "pending_sme") {
        // Peer mentor accepted the proposal, now wait for SME approval
        await db.run("UPDATE demo_swap_requests SET status = 'pending_sme' WHERE id = ?", [requestId]);

        // Audit Log
        const auditId = generateId("audit");
        await db.run(
          `INSERT INTO audit_logs (id, type, description, actorName, actorRole, timestamp)
           VALUES (?, 'swap_resolve', ?, ?, 'Mentor', ?)`,
          [auditId, `Peer mentor ${req.proposedMentorName} accepted internal swap. Awaiting SME approval.`, req.proposedMentorName, resolvedAt]
        );

        return NextResponse.json({ success: true, message: "Proposal accepted. Awaiting SME approval." });
      }

      if (status === "approved") {
        await db.run(
          `UPDATE demo_sessions 
           SET mentorId = COALESCE(?, mentorId),
               mentorName = COALESCE(?, mentorName),
               smeId = COALESCE(?, smeId),
               smeName = COALESCE(?, smeName),
               dateStr = COALESCE(?, dateStr),
               timeSlot = COALESCE(?, timeSlot),
               status = 'confirmed'
           WHERE id = ?`,
          [
            req.proposedMentorId,
            req.proposedMentorName,
            req.proposedSmeId,
            req.proposedSmeName,
            req.proposedDateStr,
            req.proposedTimeSlot,
            req.sessionId
          ]
        );

        await db.run("UPDATE demo_swap_requests SET status = 'approved' WHERE id = ?", [requestId]);

        const auditId = generateId("audit");
        await db.run(
          `INSERT INTO audit_logs (id, type, description, actorName, actorRole, timestamp)
           VALUES (?, 'swap_resolve', ?, 'System', 'L&D', ?)`,
          [
            auditId,
            `L&D swap request approved. Session ${req.sessionId} updated to confirmed (Mentor: ${req.proposedMentorName || req.mentorName}, SME: ${req.proposedSmeName || req.smeName}, Date: ${req.proposedDateStr || req.dateStr}, Slot: ${req.proposedTimeSlot || req.timeSlot})`,
            resolvedAt
          ]
        );

        // Notify BOTH parties — original mentor + proposed replacement
        try {
          const finalDate  = req.proposedDateStr  || req.dateStr;
          const finalTime  = req.proposedTimeSlot || req.timeSlot;
          const finalMentor = req.proposedMentorName || req.mentorName;
          const finalSme    = req.proposedSmeName    || req.smeName;

          const [origMentorRow, newMentorRow] = await Promise.all([
            db.get("SELECT email FROM mentors WHERE id = ? LIMIT 1",   [req.mentorId]),
            req.proposedMentorId
              ? db.get("SELECT email FROM mentors WHERE id = ? LIMIT 1", [req.proposedMentorId])
              : Promise.resolve(null),
          ]);

          const emailTargets = [origMentorRow?.email, newMentorRow?.email]
            .filter((e): e is string => Boolean(e) && e.includes("@"));

          const uniqueTargets = Array.from(new Set(emailTargets));

          if (uniqueTargets.length > 0) {
            sendMailAsync({
              to: uniqueTargets.join(","),
              subject: `${BRAND.emailPrefix} Demo Swap Approved — ${req.subject} on ${finalDate}`,
              htmlBody: renderEmailShell({
                title: "Demo Swap Approved — Session Confirmed",
                badgeText: "SWAP APPROVED",
                badgeColor: "emerald",
                description: `The L&D session swap has been approved. The session is now confirmed with the updated details below.`,
                details: [
                  { label: "Subject",        value: req.subject,    highlight: true },
                  { label: "Confirmed Date", value: finalDate,      highlight: true },
                  { label: "Time Slot",      value: finalTime },
                  { label: "Mentor",         value: finalMentor },
                  { label: "SME Evaluator",  value: finalSme },
                  { label: "Status",         value: "Confirmed" },
                ],
                ctaText: "View L&D Session →",
                ctaUrl: `${BRAND.portalUrl}/mentor/demo_evaluations`,
              }),
              context: "demo-swap-approved",
            });
          }
        } catch (_) {}

        return NextResponse.json({ success: true, message: "Swap request approved and L&D session confirmed!" });
      }

      return NextResponse.json({ success: false, message: "Invalid resolution status" }, { status: 400 });
    }

    return NextResponse.json({ success: false, message: "Invalid action type" }, { status: 400 });
  } catch (error: any) {
    console.error("API POST demo-swap error:", error);
    return NextResponse.json({ success: false, message: error.message || "Failed to resolve swap request" }, { status: 500 });
  }
}
