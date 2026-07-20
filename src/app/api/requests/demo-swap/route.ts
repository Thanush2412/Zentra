import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET() {
  try {
    const db = await getDb();
    const requests = await db.all("SELECT * FROM demo_swap_requests ORDER BY created_at DESC");
    return NextResponse.json({ success: true, requests });
  } catch (error: any) {
    console.error("API GET demo-swap error:", error);
    return NextResponse.json({ success: false, message: error.message || "Failed to fetch swap requests" }, { status: 500 });
  }
}

export async function POST(request: Request) {
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

      // Check if there is already a pending swap request for this session
      const existingPending = await db.get(
        "SELECT id FROM demo_swap_requests WHERE sessionId = ? AND status IN ('pending', 'pending_peer', 'pending_sme')",
        [sessionId]
      );
      if (existingPending) {
        return NextResponse.json({ success: false, message: "A swap request for this demo is already pending review." });
      }

      const reqId = "dsr_" + Date.now() + "_" + Math.random().toString(36).substring(2, 9);
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
      const auditId = "audit_" + Date.now() + "_" + Math.random().toString(36).substring(2, 9);
      const desc = swapType === "internal"
        ? `Internal swap proposal sent by Mentor ${mentorName} proposing replacement peer ${proposedMentorName}`
        : `Demo swap requested by SME ${smeName} for mentor ${mentorName} (Reason: ${reason})`;
      
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
        await db.run("UPDATE demo_swap_requests SET status = 'rejected' WHERE id = ?", [requestId]);

        // Audit Log
        const auditId = "audit_" + Date.now() + "_" + Math.random().toString(36).substring(2, 9);
        await db.run(
          `INSERT INTO audit_logs (id, type, description, actorName, actorRole, timestamp)
           VALUES (?, 'swap_resolve', ?, 'System', 'Demo Ecosystem', ?)`,
          [auditId, `Demo swap request ${requestId} rejected`, resolvedAt]
        );

        return NextResponse.json({ success: true, message: "Swap request rejected successfully." });
      }

      if (status === "pending_sme") {
        // Peer mentor accepted the proposal, now wait for SME approval
        await db.run("UPDATE demo_swap_requests SET status = 'pending_sme' WHERE id = ?", [requestId]);

        // Audit Log
        const auditId = "audit_" + Date.now() + "_" + Math.random().toString(36).substring(2, 9);
        await db.run(
          `INSERT INTO audit_logs (id, type, description, actorName, actorRole, timestamp)
           VALUES (?, 'swap_resolve', ?, ?, 'Mentor', ?)`,
          [auditId, `Peer mentor ${req.proposedMentorName} accepted internal swap. Awaiting SME approval.`, req.proposedMentorName, resolvedAt]
        );

        return NextResponse.json({ success: true, message: "Proposal accepted. Awaiting SME approval." });
      }

      if (status === "approved") {
        await db.run("BEGIN TRANSACTION;");
        try {
          // Update the main demo session with proposed values
          await db.run(
            `UPDATE demo_sessions 
             SET mentorId = COALESCE(?, mentorId),
                 mentorName = COALESCE(?, mentorName),
                 smeId = COALESCE(?, smeId),
                 smeName = COALESCE(?, smeName),
                 dateStr = COALESCE(?, dateStr),
                 timeSlot = COALESCE(?, timeSlot)
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

          // Update the request status
          await db.run("UPDATE demo_swap_requests SET status = 'approved' WHERE id = ?", [requestId]);
          await db.run("COMMIT;");
        } catch (txError) {
          await db.run("ROLLBACK;");
          throw txError;
        }

        // Audit Log
        const auditId = "audit_" + Date.now() + "_" + Math.random().toString(36).substring(2, 9);
        await db.run(
          `INSERT INTO audit_logs (id, type, description, actorName, actorRole, timestamp)
           VALUES (?, 'swap_resolve', ?, 'System', 'Demo System', ?)`,
          [
            auditId,
            `Demo swap request approved. Session ${req.sessionId} updated (Mentor: ${req.proposedMentorName || req.mentorName}, SME: ${req.proposedSmeName || req.smeName}, Date: ${req.proposedDateStr || req.dateStr}, Slot: ${req.proposedTimeSlot || req.timeSlot})`,
            resolvedAt
          ]
        );

        return NextResponse.json({ success: true, message: "Swap request approved and schedule updated!" });
      }

      return NextResponse.json({ success: false, message: "Invalid resolution status" }, { status: 400 });
    }

    return NextResponse.json({ success: false, message: "Invalid action type" }, { status: 400 });
  } catch (error: any) {
    console.error("API POST demo-swap error:", error);
    return NextResponse.json({ success: false, message: error.message || "Failed to resolve swap request" }, { status: 500 });
  }
}
