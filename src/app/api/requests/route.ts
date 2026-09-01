// Pin to Mumbai (bom1) — co-located with Turso DB (aws-ap-south-1)
export const preferredRegion = "bom1";
export const maxDuration = 60;

import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { sendMail, renderHandoverRequestEmail } from "@/lib/mail";
import { checkMentorAvailability } from "@/lib/availability";

export async function GET(request: Request) {
  try {
    const db = await getDb();
    const { searchParams } = new URL(request.url);
    const targetStaffId = searchParams.get("targetStaffId");
    const requestorId = searchParams.get("requestorId");
    const status = searchParams.get("status");

    let query = "SELECT * FROM handover_requests WHERE 1=1";
    const params: any[] = [];
    if (targetStaffId) {
      query += " AND targetStaffId = ?";
      params.push(targetStaffId);
    }
    if (requestorId) {
      query += " AND requestorId = ?";
      params.push(requestorId);
    }
    if (status) {
      query += " AND status = ?";
      params.push(status);
    }
    query += " ORDER BY timestamp DESC";

    const records = await db.all(query, params);
    return NextResponse.json({ success: true, requests: records });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const db = await getDb();
    const body = await request.json();
    const { mentorId, slotId, dateStr, dateFormatted, targetStaffId, reason, subjectName, course, classGroup, targetStaffName } = body;

    if (!mentorId || !slotId || !dateStr || !dateFormatted || !targetStaffId || !reason) {
      return NextResponse.json({ success: false, message: "Missing required fields" }, { status: 400 });
    }

    // ─── Meta-Request Fast Path ───────────────────────────────────────────────
    // Handles synthetic slot IDs (mentor_daily_punch_, acad_log_edit_) with
    // targetStaffId="cam_approval". These bypass the normal slot/coverStaff
    // lookup and are stored directly as pending_cam requests for CAM review.
    const isMetaRequest =
      targetStaffId === "cam_approval" ||
      slotId.startsWith("mentor_daily_punch_") ||
      slotId.startsWith("acad_log_edit_");

    if (isMetaRequest) {
      const requestor = await db.get("SELECT * FROM mentors WHERE id = ?", mentorId);
      if (!requestor) {
        return NextResponse.json({ success: false, message: "Mentor not found." }, { status: 404 });
      }

      const newId = "r_" + Date.now();
      const metaCourse = course || subjectName || slotId;
      const metaClassGroup = classGroup || requestor.department || "Faculty";
      const metaTargetStaffName = targetStaffName || "CAM Approval";

      await db.run(
        `INSERT INTO handover_requests (
           id, requestorId, requestorName, slotId, course, day, time,
           dateStr, dateFormatted, targetStaffId, targetStaffName, reason, status, timestamp, classGroup
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending_cam', ?, ?)`,
        newId,
        mentorId,
        requestor.name,
        slotId,
        metaCourse,
        "",
        "",
        dateStr,
        dateFormatted,
        targetStaffId,
        metaTargetStaffName,
        reason,
        new Date().toISOString(),
        metaClassGroup
      );

      // Audit log
      await db.run(
        "INSERT INTO audit_logs (id, type, description, actorName, actorRole, timestamp) VALUES (?, 'meta_request', ?, ?, 'Mentor', ?)",
        "l_" + Date.now(),
        `${requestor.name} submitted meta-request: ${reason.slice(0, 100)}`,
        requestor.name,
        new Date().toISOString()
      );

      return NextResponse.json({
        success: true,
        request: {
          id: newId,
          requestorId: mentorId,
          requestorName: requestor.name,
          slotId,
          course: metaCourse,
          day: "",
          time: "",
          dateStr,
          dateFormatted,
          targetStaffId,
          targetStaffName: metaTargetStaffName,
          reason,
          status: "pending_cam",
          timestamp: new Date().toISOString(),
          classGroup: metaClassGroup
        }
      });
    }
    // ─────────────────────────────────────────────────────────────────────────

    const [requestor, slot, coverStaff] = await Promise.all([
      db.get("SELECT * FROM mentors WHERE id = ?", mentorId),
      db.get("SELECT * FROM slots WHERE id = ?", slotId),
      db.get("SELECT * FROM mentors WHERE id = ?", targetStaffId)
    ]);

    if (!requestor || !slot || !coverStaff) {
      return NextResponse.json({ success: false, message: "Invalid parameters. Mentor, Slot or Cover Staff not found." }, { status: 404 });
    }

    // A. Check if the slot/date is in the past to classify as an Emergency Handover Request
    const todayStr = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).format(new Date()); // "YYYY-MM-DD" in Asia/Kolkata
    let isEmergency = false;
    if (dateStr < todayStr) {
      isEmergency = true;
    } else if (dateStr === todayStr) {
      // Check if the slot time has passed
      try {
        const parts = slot.time.split("-");
        if (parts.length === 2) {
          const endTimeStr = parts[1].trim(); // e.g. "10.00 AM" or "4.30 PM"
          const [timePart, ampm] = endTimeStr.split(" ");
          let [hours, minutes] = timePart.split(".").map(Number);
          if (ampm.toLowerCase() === "pm" && hours < 12) hours += 12;
          if (ampm.toLowerCase() === "am" && hours === 12) hours = 0;
          
          const now = new Date();
          const slotEndTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes);
          if (now > slotEndTime) {
            isEmergency = true;
          }
        }
      } catch (err) {
        console.error("Error parsing slot time:", err);
      }
    }

    const initialStatus = isEmergency ? "pending_cam" : "pending";



    // Unified Availability Validation for covering faculty
    const availability = await checkMentorAvailability(db, {
      mentorId: targetStaffId,
      dateStr,
      timeSlot: slot.time,
      shift: slot.shift
    });

    if (!availability.available) {
      return NextResponse.json({
        success: false,
        message: `${coverStaff.name} is unavailable: ${availability.reason}`
      }, { status: 400 });
    }

    const newId = "r_" + Date.now();
    await db.run(
      `INSERT INTO handover_requests (
         id, requestorId, requestorName, slotId, course, day, time, 
         dateStr, dateFormatted, targetStaffId, targetStaffName, reason, status, timestamp, classGroup
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      newId,
      mentorId,
      requestor.name,
      slotId,
      subjectName || slot.course,
      slot.day,
      slot.time,
      dateStr,
      dateFormatted,
      targetStaffId,
      coverStaff.name,
      reason,
      initialStatus,
      new Date().toISOString(),
      slot.classGroup || "General"
    );

    // Audit Log request
    const logId = "l_" + Date.now();
    const logDesc = `${requestor.name} requested to hand over class "${subjectName || slot.course}" on ${dateFormatted} to ${coverStaff.name} (Emergency: ${isEmergency})`;
    await db.run(
      "INSERT INTO audit_logs (id, type, description, actorName, actorRole, timestamp) VALUES (?, 'handover_request', ?, ?, 'Mentor', ?)",
      logId,
      logDesc,
      requestor.name,
      new Date().toISOString()
    );

    // Asynchronously trigger email notification
    try {
      const subject = `[FACE Prep E-Campus] New Class Handover Request - ${subjectName || slot.course}`;
      const htmlBody = renderHandoverRequestEmail({
        requestorName: requestor.name,
        coverStaffName: coverStaff.name,
        dateStr: dateFormatted,
        time: `${slot.time} (${slot.day})`,
        course: subjectName || slot.course,
        classGroup: slot.classGroup || "General",
        reason
      });
      await sendMail({
        to: coverStaff.email,
        subject,
        htmlBody
      });
    } catch (mailErr) {
      console.error("Failed to send handover request email:", mailErr);
    }

    return NextResponse.json({
      success: true,
      request: {
        id: newId,
        requestorId: mentorId,
        requestorName: requestor.name,
        slotId,
        course: slot.course,
        day: slot.day,
        time: slot.time,
        dateStr,
        dateFormatted,
        targetStaffId,
        targetStaffName: coverStaff.name,
        reason,
        status: initialStatus,
        timestamp: new Date().toISOString(),
        classGroup: slot.classGroup || "General"
      }
    });
  } catch (error: any) {
    console.error("API POST Request error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
