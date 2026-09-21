// Pin to Mumbai (bom1) — co-located with Turso DB (aws-ap-south-1)
export const preferredRegion = "bom1";
export const maxDuration = 60;

import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { sendMail, renderEmailShell } from "@/lib/mail";
import { dispatchExternalInterviewNotifications } from "@/lib/interview-notifications";
import { checkMentorAvailability } from "@/lib/availability";
import { generateStudentGCalUrl } from "@/lib/google-calendar";
import { ensureMigration } from "@/lib/migrations";

export async function POST(request: Request) {
  try {
    const db = await getDb();
    // Schema ensured by the centralized migration runner (runs once per process)
    await ensureMigration("student_interview_slots_table");
    await ensureMigration("student_interviews_columns");
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
      try {
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
      } catch (availErr) {
        console.warn("Mentor availability check warning:", availErr);
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
    const remainingCount = Math.max(0, (Number(interview.student_count) || 0) - totalAccepted);

    await db.run(
      `UPDATE student_interviews 
       SET assigned_mentor_ids = ?, 
           accepted_capacity = ?, 
           allocated_students = ?,
           remaining_students = ?,
           status = ?, 
           gmeet_link = COALESCE(?, gmeet_link), 
           preferred_start_time = ?, 
           updated_at = ?
       WHERE id = ?`,
      [
        assignedIdsStr, 
        totalAccepted, 
        totalAllocated, 
        remainingCount, 
        finalStatus, 
        interview.type === "internal" ? null : (gmeet_link || interview.gmeet_link || null), 
        assignedTimeSlot, 
        now, 
        interview_id
      ]
    );

    // Populate student-level slot records for individual student tracking
    const mentorSchedule = Array.isArray(body.mentor_schedule) ? body.mentor_schedule : [];
    if (mentorSchedule.length > 0) {
      const isInternal = interview.type === "internal";
      const selectedStudentIds = Array.isArray(body.selected_student_ids) ? body.selected_student_ids.filter(Boolean) : [];
      let enrolledStudents: any[] = [];

      // 1. Fetch CAM-selected students by ID first (maintains exact selection)
      if (selectedStudentIds.length > 0) {
        try {
          const placeholders = selectedStudentIds.map(() => "?").join(",");
          const fetched = await db.all(
            `SELECT id, name, email, register_number, classgroup as "classGroup", department FROM students WHERE id IN (${placeholders})`,
            selectedStudentIds
          );
          // Preserve original ordering AND keep a stub entry even if student row not found (avoids null student_id)
          enrolledStudents = selectedStudentIds.map((id: any) => {
            const found = fetched.find((s: any) => s.id === id);
            return found || { id, name: null, email: null, register_number: id };
          });
        } catch (_) {}
      }

      // 2. Supplement with cohort query if needed
      if (enrolledStudents.length < assigningStudentCount) {
        const cleanCG = (interview.class_group || "").replace(/^[\["'\s]+|[\]"'\s]+$/g, "").trim();
        const hostColId = interview.origin_college_id || interview.college_id || null;
        let cohortStudents: any[] = [];
        try {
          let allCampusStudents: any[] = [];
          if (hostColId) {
            allCampusStudents = await db.all(
              `SELECT id, name, email, register_number, classgroup as "classGroup", department 
               FROM students 
               WHERE college_id = ? 
               ORDER BY register_number ASC, id ASC`,
              [hostColId]
            );
          }
          if (allCampusStudents.length === 0) {
            allCampusStudents = await db.all(
              `SELECT id, name, email, register_number, classgroup as "classGroup", department 
               FROM students 
               ORDER BY register_number ASC, id ASC LIMIT 300`
            );
          }

          // Fuzzy and token matching against class_group, department, and base course
          const deptPrefix = cleanCG.split(/[-–—(]/)[0].trim().toLowerCase();
          const cleanTokens = cleanCG.toLowerCase().replace(/[^a-z0-9]/g, " ").split(/\s+/).filter((t: string) => t.length > 2);

          cohortStudents = allCampusStudents.filter((st: any) => {
            const sCG = (st.classGroup || "").toLowerCase().trim();
            const sDept = (st.department || "").toLowerCase().trim();
            if (sCG === cleanCG.toLowerCase() || sDept === cleanCG.toLowerCase()) return true;
            if (deptPrefix && (sDept.includes(deptPrefix) || deptPrefix.includes(sDept))) return true;
            if (deptPrefix && (sCG.includes(deptPrefix) || deptPrefix.includes(sCG))) return true;
            const matchCount = cleanTokens.filter((tok: string) => sCG.includes(tok) || sDept.includes(tok)).length;
            return matchCount >= Math.min(2, cleanTokens.length);
          });

          // If no department string match, fallback to students from the host campus
          if (cohortStudents.length === 0) {
            cohortStudents = allCampusStudents;
          }
        } catch (_) {}

        const existingIds = new Set(enrolledStudents.map(s => s.id));
        for (const cs of cohortStudents) {
          if (!existingIds.has(cs.id)) {
            enrolledStudents.push(cs);
            existingIds.add(cs.id);
          }
        }
      }

      // Helper to increment minutes and format e.g. "09:15 AM"
      const formatTimeSlotWindow = (baseTimeStr: string, slotIndex: number) => {
        const startMins = 540 + (slotIndex * 15); // default 9:00 AM (540m) + 15m intervals
        const endMins = startMins + 15;
        const toTimeStr = (m: number) => {
          let hrs = Math.floor(m / 60);
          const mins = m % 60;
          const ampm = hrs >= 12 ? "PM" : "AM";
          if (hrs > 12) hrs -= 12;
          if (hrs === 0) hrs = 12;
          return `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")} ${ampm}`;
        };
        return { start: toTimeStr(startMins), end: toTimeStr(endMins) };
      };

      // Clean up previous slots for this interview before re-dispatching
      try {
        await db.run("DELETE FROM student_interview_slots WHERE interview_id = ?", [interview_id]);
      } catch (_) {}

      let sIndex = 0;
      let slotRunningIndex = 0;
      // Batch-fetch all scheduled mentors in one query (was one db.get per schedule entry)
      const scheduleMentorIds = Array.from(new Set(mentorSchedule.map((ms: any) => ms.mentor_id).filter(Boolean)));
      const mentorById = new Map<string, any>();
      if (scheduleMentorIds.length > 0) {
        const mentorRows = await db.all(
          `SELECT id, name, college_id FROM mentors WHERE id IN (${scheduleMentorIds.map(() => "?").join(",")})`,
          scheduleMentorIds
        );
        for (const m of mentorRows) mentorById.set(m.id, m);
      }
      for (const ms of mentorSchedule) {
        const mObj = mentorById.get(ms.mentor_id);
        const mName = mObj?.name || "Mentor";
        const mCol = mObj?.college_id || interview.college_id || "campus";
        const count = Number(ms.student_count) || 3;
        const baseTime = ms.time_slot || assignedTimeSlot || "09:00 AM";

        for (let k = 0; k < count; k++) {
          const slotId = `slot_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
          const st = enrolledStudents[sIndex] || null;
          sIndex++;

          // Always store the real student ID; fall back to a generated slot ID only if truly unknown
          const stId = st?.id || null;
          // Use real name if available; for stubs without a name, use a readable fallback (not anonymous)
          const stName = (st?.name && st.name.trim()) ? st.name.trim() : (st?.id ? `Student ${st.id.slice(0, 8)}` : `Candidate #${slotRunningIndex + 1}`);
          const stEmail = st?.email || undefined;

          const slotTiming = formatTimeSlotWindow(baseTime, slotRunningIndex);
          slotRunningIndex++;

          // Internal interviews do NOT use Google Meet (in-person physical on campus)
          const effectiveMeetLink = isInternal ? null : (gmeet_link || interview.gmeet_link || null);
          const studentGCalUrl = isInternal || !effectiveMeetLink ? null : generateStudentGCalUrl({
            studentName: stName,
            studentEmail: stEmail,
            subject: interview.subject || "Interview",
            targetDate: interview.target_date || new Date().toISOString().slice(0, 10),
            slotStartTime: slotTiming.start,
            slotEndTime: slotTiming.end,
            gmeetLink: effectiveMeetLink,
            mentorName: mName
          });

          await db.run(
            `INSERT INTO student_interview_slots (
              id, interview_id, allocation_id, student_id, student_name,
              mentor_id, mentor_name, college_id, slot_start_time, slot_end_time,
              gmeet_link, gcal_link, subject, target_date, status, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              slotId,
              interview_id,
              "alloc_direct",
              stId,
              stName,
              ms.mentor_id,
              mName,
              mCol,
              slotTiming.start,
              slotTiming.end,
              effectiveMeetLink,
              studentGCalUrl,
              interview.subject || "Interview",
              interview.target_date || now.slice(0, 10),
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
              ...(interview.type !== "internal" && gmeet_link ? [{ label: "Google Meet Link", value: gmeet_link, highlight: true }] : (interview.type === "internal" ? [{ label: "Interview Mode", value: "In-Person On-Campus Evaluation", highlight: true }] : [])),
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
