// Pin to Mumbai (bom1) — co-located with Turso DB (aws-ap-south-1)
export const preferredRegion = "bom1";
export const maxDuration = 60;

import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { sendMail, renderHandoverApprovalEmail, renderHandoverRejectionEmail } from "@/lib/mail";

export async function POST(request: Request) {
  try {
    const db = await getDb();
    const body = await request.json();
    const { requestId, status, headerReason, approverName, actorRole, course, action, targetStaffId: newTargetStaffId } = body;

    if (!requestId) {
      return NextResponse.json({ success: false, message: "Missing required requestId" }, { status: 400 });
    }

    const handoverRequest = await db.get(
      "SELECT * FROM handover_requests WHERE id = ?",
      requestId
    );

    if (!handoverRequest) {
      return NextResponse.json({ success: false, message: "Handover request not found" }, { status: 404 });
    }

    const cleanApproverName = approverName || "System User";
    const cleanActorRole = actorRole || (action === "cam_reassign" ? "Campus Manager" : "Mentor");

    // 1. CAM Direct Reassignment / Allocation of a Free Mentor
    if (action === "cam_reassign" && newTargetStaffId) {
      const newCoverStaff = await db.get("SELECT * FROM mentors WHERE id = ?", newTargetStaffId);
      if (!newCoverStaff) {
        return NextResponse.json({ success: false, message: "Selected cover faculty not found" }, { status: 404 });
      }

      await db.run(
        `UPDATE handover_requests 
         SET targetStaffId = ?, targetStaffName = ?, status = 'approved', approvedBy = ?, headerReason = ?
         WHERE id = ?`,
        [newCoverStaff.id, newCoverStaff.name, cleanApproverName, `Assigned by CAM ${cleanApproverName}`, requestId]
      );

      // Create Approved Handover mapping directly
      const handoverId = "h_" + Date.now();
      await db.run(
        `INSERT INTO approved_handovers (id, requestId, slotId, dateStr, originalMentorId, coverStaffId, coverStaffName, course, ledger_month) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        handoverId,
        requestId,
        handoverRequest.slotId,
        handoverRequest.dateStr,
        handoverRequest.requestorId,
        newCoverStaff.id,
        newCoverStaff.name,
        course || handoverRequest.course,
        handoverRequest.dateStr.slice(0, 7)
      );

      // Log Audit Event
      const logId = "l_" + Date.now();
      await db.run(
        "INSERT INTO audit_logs (id, type, description, actorName, actorRole, timestamp) VALUES (?, ?, ?, ?, ?, ?)",
        logId,
        "handover_approval",
        `CAM Assigned Cover: ${cleanApproverName} mapped "${handoverRequest.course}" on ${handoverRequest.dateFormatted} to ${newCoverStaff.name}`,
        cleanApproverName,
        cleanActorRole,
        new Date().toISOString()
      );

      // Email newly assigned cover faculty
      if (newCoverStaff.email) {
        try {
          await sendMail({
            to: newCoverStaff.email,
            subject: `[Assigned by CAM] Class Cover: ${handoverRequest.course} on ${handoverRequest.dateFormatted}`,
            htmlBody: renderHandoverApprovalEmail({
              requestorName: handoverRequest.requestorName,
              coverStaffName: newCoverStaff.name,
              dateStr: handoverRequest.dateFormatted,
              time: `${handoverRequest.time} (${handoverRequest.day})`,
              course: handoverRequest.course,
              classGroup: handoverRequest.classGroup || "General",
              reviewerName: `${cleanApproverName} (Campus Manager)`
            })
          });
        } catch (mErr) {
          console.error("Failed to email assigned cover mentor:", mErr);
        }
      }

      return NextResponse.json({ success: true, message: `Class successfully assigned to ${newCoverStaff.name}!` });
    }

    if (handoverRequest.status !== "pending" && handoverRequest.status !== "pending_cam" && handoverRequest.status !== "needs_cam_allocation") {
      return NextResponse.json({ success: false, message: "Request has already been processed" });
    }

    if (handoverRequest.request_type === "exam_marks_edit") {
      const targetStatus = status === "approved" ? "approved" : "rejected";
      await db.run(
        "UPDATE handover_requests SET status = ?, headerReason = ?, approvedBy = ? WHERE id = ?",
        targetStatus,
        headerReason || null,
        cleanApproverName,
        requestId
      );

      if (status === "approved") {
        // Parse proposed mark from reason (e.g. "Proposed Mark: 45")
        const proposedMatch = (handoverRequest.reason || "").match(/Proposed Mark:\s*([\d.]+)/i);
        const proposedMark = proposedMatch ? parseFloat(proposedMatch[1]) : null;
        if (proposedMark !== null && !isNaN(proposedMark)) {
          const exam = await db.get("SELECT * FROM exam_schedules WHERE id = ?", [handoverRequest.slotId]);
          const maxMarks = exam?.max_marks || 50;
          const passingMarks = exam?.passing_marks || (maxMarks * 0.4);
          let grade = "F";
          const pct = (proposedMark / maxMarks) * 100;
          if (pct >= 90) grade = "O";
          else if (pct >= 80) grade = "A+";
          else if (pct >= 70) grade = "A";
          else if (pct >= 60) grade = "B+";
          else if (pct >= 50) grade = "B";
          else if (proposedMark >= passingMarks) grade = "C";
          else grade = "RA / F";

          await db.run(
            `UPDATE student_exam_marks 
             SET marks_obtained = ?, is_absent = 0, grade = ?, updated_at = CURRENT_TIMESTAMP, remarks = ?
             WHERE exam_id = ? AND student_id = ?`,
            [proposedMark, grade, `CAM Approved (${cleanApproverName}): ${headerReason || 'Mark Updated'}`, handoverRequest.slotId, handoverRequest.targetStaffId]
          );
        }
      }

      return NextResponse.json({ success: true, message: `Exam mark modification request ${status} successfully!` });
    }

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
      const subject = `[FACE Prep E-Campus] Handover Request ${status === "approved" ? "Approved" : "Rejected"} - ${handoverRequest.course}`;
      
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

      const htmlBody = status === "approved"
        ? renderHandoverApprovalEmail({
            requestorName: handoverRequest.requestorName,
            coverStaffName: handoverRequest.targetStaffName,
            dateStr: handoverRequest.dateFormatted,
            time: `${handoverRequest.time} (${handoverRequest.day})`,
            course: handoverRequest.course,
            classGroup: "General",
            reviewerName: `${cleanApproverName} (${cleanActorRole})`
          })
        : renderHandoverRejectionEmail({
            requestorName: handoverRequest.requestorName,
            coverStaffName: handoverRequest.targetStaffName,
            dateStr: handoverRequest.dateFormatted,
            time: `${handoverRequest.time} (${handoverRequest.day})`,
            course: handoverRequest.course,
            classGroup: "General",
            reviewerName: `${cleanApproverName} (${cleanActorRole})`,
            rejectionReason: headerReason || "Scheduling conflict"
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
