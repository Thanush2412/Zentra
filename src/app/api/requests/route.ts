import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { sendMail, formatZentraEmail } from "@/lib/mail";

export async function POST(request: Request) {
  try {
    const db = await getDb();
    const body = await request.json();
    const { mentorId, slotId, dateStr, dateFormatted, targetStaffId, reason, subjectName } = body;

    if (!mentorId || !slotId || !dateStr || !dateFormatted || !targetStaffId || !reason) {
      return NextResponse.json({ success: false, message: "Missing required fields" }, { status: 400 });
    }

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



    // 1. Check if covering teacher has a regular slot clash
    const slotClash = await db.get(
      "SELECT id FROM slots WHERE mentorId = ? AND day = ? AND time = ? AND shift = ?",
      targetStaffId, slot.day, slot.time, slot.shift
    );

    // 2. Check if covering teacher is already covering another class at this time on this date
    const coverClash = await db.get(
      `SELECT ah.id FROM approved_handovers ah
       JOIN slots s ON s.id = ah.slotId
       WHERE ah.coverStaffId = ? AND ah.dateStr = ? AND s.day = ? AND s.time = ? AND s.shift = ?`,
      targetStaffId, dateStr, slot.day, slot.time, slot.shift
    );

    // 3. Check if covering teacher has handed over their own slot at this time on this date (absent)
    const absentClash = await db.get(
      `SELECT ah.id FROM approved_handovers ah
       JOIN slots s ON s.id = ah.slotId
       WHERE ah.originalMentorId = ? AND ah.dateStr = ? AND s.day = ? AND s.time = ? AND s.shift = ?`,
      targetStaffId, dateStr, slot.day, slot.time, slot.shift
    );

    if (slotClash || coverClash || absentClash) {
      return NextResponse.json({ success: false, message: `${coverStaff.name} is occupied or unavailable during this period.` }, { status: 400 });
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
      const subject = `[Zentra] New Class Handover Request - ${subjectName || slot.course}`;
      const htmlBody = formatZentraEmail({
        title: "New Class Handover Request",
        badgeText: isEmergency ? "Emergency Action Required" : "Action Required",
        badgeColor: isEmergency ? "rose" : "indigo",
        description: `<strong>${requestor.name}</strong> has submitted a class handover request for the course <strong>${subjectName || slot.course}</strong>.`,
        details: [
          { label: "Date", value: dateFormatted },
          { label: "Time Slot", value: `${slot.time} (${slot.day})` },
          { label: "Student Group", value: slot.classGroup || "General" },
          { label: "Cover Faculty", value: coverStaff.name, highlight: true },
          { label: "Reason", value: reason },
          { label: "Emergency Request", value: isEmergency ? "Yes (Requires CM Approval)" : "No" }
        ]
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
