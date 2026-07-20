import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { sendMail, formatZentraEmail } from "@/lib/mail";

export async function POST(request: Request) {
  try {
    const db = await getDb();
    const body = await request.json();
    const {
      requestorId,
      offerSlotId,
      offerDateStr,
      offerDateFormatted,
      targetStaffId,
      compensatesHandoverId,
      reason,
      originalSubject,
      originalMonth
    } = body;

    if (!requestorId || !offerSlotId || !offerDateStr || !offerDateFormatted || !targetStaffId) {
      return NextResponse.json({ success: false, message: "Missing required fields" }, { status: 400 });
    }

    const [requestor, offerSlot, targetStaff] = await Promise.all([
      db.get("SELECT * FROM mentors WHERE id = ?", requestorId),
      db.get("SELECT * FROM slots WHERE id = ?", offerSlotId),
      db.get("SELECT * FROM mentors WHERE id = ?", targetStaffId)
    ]);

    if (!requestor || !offerSlot || !targetStaff) {
      return NextResponse.json({ success: false, message: "Mentor, Slot, or Target Staff not found." }, { status: 404 });
    }

    if (offerSlot.mentorId !== targetStaffId) {
      return NextResponse.json({ success: false, message: "You can only select a slot that belongs to the target faculty." }, { status: 400 });
    }

    const todayStr = new Date().toISOString().slice(0, 10);
    if (offerDateStr < todayStr) {
      return NextResponse.json({ success: false, message: "You can only offer to cover future slots as compensation." }, { status: 400 });
    }

    // Clash checks for requestor (since requestor is covering the class)
    const slotClash = await db.get(
      "SELECT id FROM slots WHERE mentorId = ? AND day = ? AND time = ? AND shift = ?",
      requestorId, offerSlot.day, offerSlot.time, offerSlot.shift
    );
    const coverClash = await db.get(
      `SELECT ah.id FROM approved_handovers ah JOIN slots s ON s.id = ah.slotId WHERE ah.coverStaffId = ? AND ah.dateStr = ? AND s.day = ? AND s.time = ? AND s.shift = ?`,
      requestorId, offerDateStr, offerSlot.day, offerSlot.time, offerSlot.shift
    );
    const absentClash = await db.get(
      `SELECT ah.id FROM approved_handovers ah JOIN slots s ON s.id = ah.slotId WHERE ah.originalMentorId = ? AND ah.dateStr = ? AND s.day = ? AND s.time = ? AND s.shift = ?`,
      requestorId, offerDateStr, offerSlot.day, offerSlot.time, offerSlot.shift
    );

    if (slotClash || coverClash || absentClash) {
      return NextResponse.json({
        success: false,
        message: `You are already occupied or unavailable to cover at this time on ${offerDateFormatted}.`
      }, { status: 400 });
    }

    const duplicateCheck = await db.get(
      `SELECT id FROM handover_requests WHERE requestorId = ? AND slotId = ? AND dateStr = ? AND targetStaffId = ? AND request_type = 'swap_compensate' AND status IN ('pending', 'pending_cam')`,
      requestorId, offerSlotId, offerDateStr, targetStaffId
    );
    if (duplicateCheck) {
      return NextResponse.json({ success: false, message: "A swap offer for this slot/date is already pending." }, { status: 400 });
    }

    const newId = "swap_" + Date.now();
    const swapReason = reason || `Offering class as compensation for previous handover.`;

    await db.run(
      `INSERT INTO handover_requests (
         id, requestorId, requestorName, slotId, course, day, time,
         dateStr, dateFormatted, targetStaffId, targetStaffName,
         reason, status, timestamp, classGroup, request_type, compensates_handover_id,
         original_subject, original_month
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, 'swap_compensate', ?, ?, ?)`,
      newId, requestorId, requestor.name, offerSlotId, offerSlot.course,
      offerSlot.day, offerSlot.time, offerDateStr, offerDateFormatted,
      targetStaffId, targetStaff.name, swapReason, new Date().toISOString(),
      offerSlot.classGroup || "General", compensatesHandoverId || null,
      originalSubject || null, originalMonth || null
    );

    const logId = "l_" + Date.now();
    await db.run(
      "INSERT INTO audit_logs (id, type, description, actorName, actorRole, timestamp) VALUES (?, 'handover_request', ?, ?, 'Mentor', ?)",
      logId,
      `${requestor.name} offered "${offerSlot.course}" on ${offerDateFormatted} to ${targetStaff.name} as a swap compensation.`,
      requestor.name,
      new Date().toISOString()
    );

    // Asynchronously trigger email notification
    try {
      const subject = `[Zentra] New Swap Compensation Offer - ${offerSlot.course}`;
      const htmlBody = formatZentraEmail({
        title: "New Swap Compensation Offer",
        badgeText: "Action Required: Swap Offer",
        badgeColor: "amber",
        description: `<strong>${requestor.name}</strong> has offered the course <strong>${offerSlot.course}</strong> as a swap compensation for a past handover request.`,
        details: [
          { label: "Offered Date", value: offerDateFormatted },
          { label: "Time Slot/Hour", value: `${offerSlot.time} (${offerSlot.day})` },
          { label: "Student Group", value: offerSlot.classGroup || "General" },
          { label: "Target Faculty", value: targetStaff.name, highlight: true },
          { label: "Reason", value: swapReason }
        ]
      });
      await sendMail({
        to: targetStaff.email,
        subject,
        htmlBody
      });
    } catch (mailErr) {
      console.error("Failed to send swap request email:", mailErr);
    }

    return NextResponse.json({
      success: true,
      message: "Swap offer sent successfully.",
      request: {
        id: newId, requestorId, requestorName: requestor.name,
        slotId: offerSlotId, course: offerSlot.course, dateStr: offerDateStr,
        dateFormatted: offerDateFormatted, targetStaffId, targetStaffName: targetStaff.name,
        status: "pending", request_type: "swap_compensate"
      }
    });
  } catch (error: any) {
    console.error("API POST Swap Compensate error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
