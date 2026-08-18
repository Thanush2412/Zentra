// Pin to Mumbai (bom1) — co-located with Turso DB (aws-ap-south-1)
export const preferredRegion = "bom1";
export const maxDuration = 60;

import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { sendMail, renderEmailShell } from "@/lib/mail";
import { dispatchExternalInterviewNotifications } from "@/lib/interview-notifications";
import { checkMentorAvailability } from "@/lib/availability";

export async function POST(request: Request) {
  try {
    const db = await getDb();
    const body = await request.json();

    const {
      interview_id,
      mapped_mentor_ids = [],
      student_count,
      cm_name = "Campus Manager",
      gmeet_link = "",
      time_slot = ""
    } = body;

    if (!interview_id) {
      return NextResponse.json({ success: false, message: "Missing interview_id" }, { status: 400 });
    }

    const interview = await db.get("SELECT * FROM student_interviews WHERE id = ?", [interview_id]);
    if (!interview) {
      return NextResponse.json({ success: false, message: "Interview request not found" }, { status: 404 });
    }

    const assignedTimeSlot = time_slot || interview.preferred_start_time || "09:00 AM";

    // Validate mentor availability on target date and time
    for (const mId of mapped_mentor_ids) {
      const avail = await checkMentorAvailability(db, {
        mentorId: mId,
        dateStr: interview.target_date,
        timeSlot: assignedTimeSlot,
        excludeInterviewId: interview_id
      });
      if (!avail.available) {
        const mInfo = await db.get("SELECT name FROM mentors WHERE id = ?", [mId]);
        const mName = mInfo?.name || mId;
        return NextResponse.json({
          success: false,
          message: `Cannot assign mentor ${mName}: ${avail.reason}`
        }, { status: 400 });
      }
    }

    const now = new Date().toISOString();
    const assigningStudentCount = Number(student_count) || 3;
    const updatedCount = assigningStudentCount;

    let combinedMentorIds = mapped_mentor_ids;
    let finalStatus = "assigned";
    let totalAccepted = assigningStudentCount;
    let totalAllocated = assigningStudentCount;

    if (interview.type === "external") {
      const existingIds = interview.assigned_mentor_ids ? JSON.parse(interview.assigned_mentor_ids) : [];
      combinedMentorIds = Array.from(new Set([...existingIds, ...mapped_mentor_ids]));
      
      const prevAccepted = Number(interview.accepted_capacity) || 0;
      const prevAllocated = Number(interview.allocated_students) || 0;
      totalAccepted = prevAccepted + assigningStudentCount;
      totalAllocated = prevAllocated + assigningStudentCount;
      
      const requestedTotal = Number(interview.student_count) || 10;
      finalStatus = totalAccepted >= requestedTotal ? "assigned" : "capacity_partially_accepted";
    }

    const assignedIdsStr = JSON.stringify(combinedMentorIds);

    await db.run(
      `UPDATE student_interviews 
       SET assigned_mentor_ids = ?, 
           accepted_capacity = ?, 
           allocated_students = ?,
           remaining_students = MAX(0, student_count - ?),
           status = ?, 
           gmeet_link = COALESCE(?, gmeet_link), 
           preferred_start_time = ?, 
           updated_at = ?
       WHERE id = ?`,
      [
        assignedIdsStr, 
        totalAccepted, 
        totalAllocated, 
        totalAccepted, 
        finalStatus, 
        gmeet_link || interview.gmeet_link || null, 
        assignedTimeSlot, 
        now, 
        interview_id
      ]
    );

    // Populate student-level slot records for individual student tracking
    const mentorSchedule = Array.isArray(body.mentor_schedule) ? body.mentor_schedule : [];
    if (mentorSchedule.length > 0) {
      const cleanCG = (interview.class_group || "").replace(/^[\["'\s]+|[\]"'\s]+$/g, "").trim();
      const colId = interview.college_id || null;
      let enrolledStudents = [];
      if (colId) {
        enrolledStudents = await db.all(
          `SELECT id, name, email, register_number FROM students 
           WHERE college_id = ? AND (LOWER(classGroup) = LOWER(?) OR LOWER(department) = LOWER(?) OR classGroup LIKE ? OR department LIKE ?)
           ORDER BY register_number ASC, id ASC`,
          [colId, cleanCG, cleanCG, `%${cleanCG}%`, `%${cleanCG}%`]
        );
      }
      if (enrolledStudents.length === 0) {
        enrolledStudents = await db.all(
          `SELECT id, name, email, register_number FROM students 
           WHERE (LOWER(classGroup) = LOWER(?) OR LOWER(department) = LOWER(?) OR classGroup LIKE ? OR department LIKE ?)
           ORDER BY register_number ASC, id ASC`,
          [cleanCG, cleanCG, `%${cleanCG}%`, `%${cleanCG}%`]
        );
      }

      let sIndex = 0;
      for (const ms of mentorSchedule) {
        const mObj = await db.get("SELECT name, college_id FROM mentors WHERE id = ?", [ms.mentor_id]);
        const mName = mObj?.name || "Mentor";
        const mCol = mObj?.college_id || interview.college_id || "campus";
        const count = Number(ms.student_count) || 3;
        const timeSlot = ms.time_slot || assignedTimeSlot;

        for (let k = 0; k < count; k++) {
          const slotId = `slot_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
          const st = enrolledStudents[sIndex] || { id: `std_${sIndex + 1}`, name: `Student #${sIndex + 1}` };
          sIndex++;

          await db.run(
            `INSERT INTO student_interview_slots (
              id, interview_id, allocation_id, student_id, student_name,
              mentor_id, mentor_name, college_id, slot_start_time, slot_end_time,
              gmeet_link, subject, target_date, status, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              slotId,
              interview_id,
              "alloc_direct",
              st.id,
              st.name,
              ms.mentor_id,
              mName,
              mCol,
              timeSlot,
              timeSlot,
              gmeet_link || interview.gmeet_link || null,
              interview.subject,
              interview.target_date,
              "scheduled",
              now
            ]
          );
        }
      }
    }

    // Fetch mapped mentor details for email
    let mentorEmails: string[] = [];
    let mentorNames: string[] = [];
    try {
      if (mapped_mentor_ids.length > 0) {
        const mentors = await db.all(
          `SELECT email, name FROM mentors WHERE id IN (${mapped_mentor_ids.map(() => "?").join(",")})`,
          mapped_mentor_ids
        );
        mentorEmails = mentors.map((m: any) => m.email).filter(Boolean);
        mentorNames = mentors.map((m: any) => m.name).filter(Boolean);
      }
    } catch (_) {}

    // Send branded email to mapped mentors
    if (mentorEmails.length > 0) {
      try {
        await sendMail({
          to: mentorEmails.join(", "),
          subject: `[Interview Assignment] You have been assigned — ${interview.subject} on ${interview.target_date}`,
          htmlBody: renderEmailShell({
            title: "You Have Been Assigned to Conduct an Interview",
            badgeText: interview.type === "external" ? "External Interview" : "Internal Interview",
            badgeColor: interview.type === "external" ? "purple" : "emerald",
            description: `Dear Mentor, Campus Manager <strong>${cm_name}</strong> has assigned you to conduct a student interview session for <strong>${interview.subject}</strong>. Please prepare accordingly.`,
            details: [
              { label: "Subject", value: interview.subject, highlight: true },
              { label: "Class Group", value: interview.class_group || "All Classes" },
              { label: "Target Date", value: interview.target_date || "" },
              { label: "Interview Type", value: (interview.type || "internal").toUpperCase() },
              { label: "Student Count", value: String(updatedCount) },
              { label: "Topics", value: interview.topics || "General Review" },
              ...(gmeet_link ? [{ label: "Google Meet Link", value: gmeet_link, highlight: true }] : []),
              { label: "Assigned By", value: cm_name },
            ],
            ctaText: "Open Mentor Dashboard to Evaluate →",
          }),
        });
      } catch (mailErr) {
        console.warn("Mentor assignment email failed:", mailErr);
      }
    }

    // Notify KAM & Regional Colleges
    try {
      if (interview.type === "external") {
        await dispatchExternalInterviewNotifications({
          interviewId: interview.id,
          subject: interview.subject,
          classGroup: interview.class_group,
          targetDate: interview.target_date,
          type: "external",
          topics: interview.topics,
          studentCount: updatedCount,
          mentorName: mentorNames.join(", ") || interview.mentor_name,
          originCollegeId: interview.origin_college_id || interview.college_id,
          targetCollegeId: interview.target_college_id,
          actionType: "assigned",
          gmeetLink: gmeet_link || interview.gmeet_link,
          actorName: cm_name
        });
      } else {
        const kamRows = await db.all(`
          SELECT k.email, k.name FROM kam_users k
          INNER JOIN colleges c ON c.kam_id = k.id
          WHERE c.id = ?
        `, [interview.college_id || interview.origin_college_id]);

        if (kamRows && kamRows.length > 0) {
          const kamEmail = kamRows[0].email;
          const kamName = kamRows[0].name;
          if (kamEmail) {
            await sendMail({
              to: kamEmail,
              subject: `[Interview Assigned] ${interview.subject} — ${interview.college_id || interview.origin_college_id}`,
              htmlBody: renderEmailShell({
                title: "Interview Session Assigned & Scheduled",
                badgeText: "KAM Notification",
                badgeColor: "indigo",
                description: `Dear <strong>${kamName}</strong>, Campus Manager <strong>${cm_name}</strong> has allocated mentors for an interview session.`,
                details: [
                  { label: "Subject", value: interview.subject, highlight: true },
                  { label: "Target Date", value: interview.target_date || "" },
                  { label: "Student Count", value: String(updatedCount) },
                  { label: "Mentors Assigned", value: mentorNames.join(", ") || "N/A" },
                  { label: "Campus Manager", value: cm_name },
                ],
                ctaText: "View Interview Dashboard →",
              }),
            });
          }
        }
      }
    } catch (kamMailErr) {
      console.warn("KAM notification email failed:", kamMailErr);
    }

    return NextResponse.json({
      success: true,
      message: `Successfully assigned ${updatedCount} students & mapped ${mapped_mentor_ids.length} mentor(s). Notification emails dispatched.`
    });
  } catch (error: any) {
    console.error("POST /api/interviews/assign error:", error);
    return NextResponse.json({ success: false, message: error.message || "Failed to assign interview" }, { status: 500 });
  }
}
