import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { sendMail, formatZentraEmail } from "@/lib/mail";

export async function POST(request: Request) {
  try {
    const db = await getDb();
    const body = await request.json();
    const { requestId, status, headerReason, approverName, actorRole, course } = body;

    if (!requestId || !status) {
      return NextResponse.json({ success: false, message: "Missing required fields" }, { status: 400 });
    }

    const handoverRequest = await db.get(
      "SELECT * FROM handover_requests WHERE id = ?",
      requestId
    );

    if (!handoverRequest) {
      return NextResponse.json({ success: false, message: "Handover request not found" }, { status: 404 });
    }

    if (handoverRequest.status !== "pending" && handoverRequest.status !== "pending_cam") {
      return NextResponse.json({ success: false, message: "Request has already been processed" });
    }

    const cleanApproverName = approverName || "System User";
    const cleanActorRole = actorRole || "Mentor Header";

    let targetStatus = status; // e.g. "approved" or "rejected"
    if (handoverRequest.status === "pending_cam") {
      if (status === "approved") {
        targetStatus = "pending"; // Escalate to receiver
      } else {
        targetStatus = "rejected"; // Reject outright
      }
    }

    // Update Request Status
    await db.run(
      "UPDATE handover_requests SET status = ?, headerReason = ?, approvedBy = ? WHERE id = ?",
      targetStatus,
      headerReason || null,
      cleanApproverName,
      requestId
    );

    // If Approved and it was already at 'pending' stage, create ApprovedHandover mapping
    if (status === "approved" && handoverRequest.status === "pending") {
      const handoverId = "h_" + Date.now();

      if (handoverRequest.request_type === "swap_compensate") {
        // Swap compensate: the requestor is covering FOR the target (reversed roles)
        // originalMentor = targetStaff (they "originally" had it owed), cover = requestor (paying it back)
        await db.run(
          `INSERT INTO approved_handovers (id, requestId, slotId, dateStr, originalMentorId, coverStaffId, coverStaffName, course, ledger_month)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          handoverId,
          requestId,
          handoverRequest.slotId,
          handoverRequest.dateStr,
          handoverRequest.targetStaffId,   // creditor is "original"
          handoverRequest.requestorId,     // debtor is "cover" (paying back)
          handoverRequest.requestorName,
          handoverRequest.original_subject || course || handoverRequest.course,
          handoverRequest.original_month || handoverRequest.dateStr.slice(0, 7)
        );
      } else {
        // Normal handover
        await db.run(
          `INSERT INTO approved_handovers (id, requestId, slotId, dateStr, originalMentorId, coverStaffId, coverStaffName, course, ledger_month) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          handoverId,
          requestId,
          handoverRequest.slotId,
          handoverRequest.dateStr,
          handoverRequest.requestorId,
          handoverRequest.targetStaffId,
          handoverRequest.targetStaffName,
          course || handoverRequest.course,
          handoverRequest.dateStr.slice(0, 7)
        );
      }
    }

    // Log Audit Event
    const actionVerb = cleanActorRole === "Mentor"
      ? (status === "approved" ? "Accepted" : "Rejected")
      : (status === "approved" ? "Approved" : "Rejected");

    const auditDesc = status === "approved"
      ? `${actionVerb} Class Handover: ${handoverRequest.requestorName} handed over "${handoverRequest.course}" on ${handoverRequest.dateFormatted} to ${handoverRequest.targetStaffName}`
      : `${actionVerb} Class Handover: ${handoverRequest.requestorName}'s handover of "${handoverRequest.course}" on ${handoverRequest.dateFormatted} to ${handoverRequest.targetStaffName} - Reason: "${headerReason || 'No reason specified'}"`;

    const logId = "l_" + Date.now();
    await db.run(
      "INSERT INTO audit_logs (id, type, description, actorName, actorRole, timestamp) VALUES (?, ?, ?, ?, ?, ?)",
      logId,
      status === "approved" ? "handover_approval" : "handover_rejection",
      auditDesc,
      cleanApproverName,
      cleanActorRole,
      new Date().toISOString()
    );

    // Asynchronously trigger email notification on approval/rejection
    try {
      const requestor = await db.get("SELECT email FROM mentors WHERE id = ?", handoverRequest.requestorId);
      const requestorEmail = requestor?.email || "thanush@faceprep.in";
      const subject = `[Zentra] Handover Request ${status === "approved" ? "Approved" : "Rejected"} - ${handoverRequest.course}`;
      
      const detailsList = [
        { label: "Course", value: handoverRequest.course },
        { label: "Date", value: handoverRequest.dateFormatted },
        { label: "Time Slot", value: `${handoverRequest.time} (${handoverRequest.day})` },
        { label: "Original Faculty", value: handoverRequest.requestorName },
        { label: "Cover Faculty", value: handoverRequest.targetStaffName, highlight: status === "approved" }
      ];
      if (headerReason) {
        detailsList.push({ label: "Remarks/Reason", value: headerReason, highlight: status !== "approved" });
      }

      const isSwap = handoverRequest.request_type === "swap_compensate";
      const requestTypeLabel = isSwap ? "Swap Compensation" : "Class Handover";

      const htmlBody = formatZentraEmail({
        title: `${requestTypeLabel} Request ${status === "approved" ? "Approved" : "Rejected"}`,
        badgeText: status === "approved" ? "Request Approved" : "Request Rejected",
        badgeColor: status === "approved" ? "emerald" : "rose",
        description: `The ${requestTypeLabel.toLowerCase()} request submitted by <strong>${handoverRequest.requestorName}</strong> has been <strong>${status}</strong> by <strong>${cleanApproverName}</strong> (${cleanActorRole}).`,
        details: detailsList
      });

      await sendMail({
        to: requestorEmail,
        subject,
        htmlBody
      });
    } catch (mailErr) {
      console.error("Failed to send review request status email:", mailErr);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("API POST Review Request error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
