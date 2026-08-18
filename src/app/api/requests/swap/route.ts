// Pin to Mumbai (bom1) — co-located with Turso DB (aws-ap-south-1)
export const preferredRegion = "bom1";
export const maxDuration = 60;

import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { sendMail, renderDemoSwapEmail } from "@/lib/mail";
import { checkMentorAvailability } from "@/lib/availability";

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

    // Unified Availability check for the requestor (they must be free to cover)
    const requestorAvailability = await checkMentorAvailability(db, {
      mentorId: requestorId,
      dateStr: offerDateStr,
      timeSlot: offerSlot.time,
      shift: offerSlot.shift
    });

    if (!requestorAvailability.available) {
      return NextResponse.json({
        success: false,
        message: `You are unavailable to cover at this time on ${offerDateFormatted}: ${requestorAvailability.reason}`
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
      const subject = `[FACE Prep E-Campus] New Swap Compensation Offer - ${offerSlot.course}`;
      const htmlBody = renderDemoSwapEmail({
        requestorName: requestor.name,
        targetMentorName: targetStaff.name,
        dateStr: offerDateFormatted,
        time: `${offerSlot.time} (${offerSlot.day})`,
        course: offerSlot.course,
        classGroup: offerSlot.classGroup || "General"
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
