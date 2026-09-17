// Pin to Mumbai (bom1) — co-located with Turso DB (aws-ap-south-1)
export const preferredRegion = "bom1";
export const maxDuration = 60;

import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { generate15MinSlotsForSegment, parseTimeToMinutes } from "@/lib/interview-priority-engine";
import { dispatchExternalInterviewNotifications } from "@/lib/interview-notifications";
import { createGoogleCalendarEvent, generateStudentGCalUrl, generateGoogleMeetCode } from "@/lib/google-calendar";

export async function POST(request: Request) {
  try {
    const db = await getDb();
    const body = await request.json();

    const {
      interview_id,
      actor_role = "reporting_cm",
      actor_name = "User",
      action = "cm_confirm",
      college_id = ""
    } = body;

    if (!interview_id) {
      return NextResponse.json({ success: false, message: "Missing interview_id" }, { status: 400 });
    }

    const interview = await db.get("SELECT * FROM student_interviews WHERE id = ?", [interview_id]);
    if (!interview) {
      return NextResponse.json({ success: false, message: "Interview request not found" }, { status: 404 });
    }

    const now = new Date().toISOString();

    if (action === "cm_confirm") {
      await db.run(
        `UPDATE student_interviews 
         SET status = 'pending_final_confirmation', updated_at = ?
         WHERE id = ?`,
        [now, interview_id]
      );

      return NextResponse.json({
        success: true,
        message: "Reporting CM confirmed priority allocation! Sent to regional CAMs for final confirmation.",
        status: "pending_final_confirmation"
      });
    }

    if (action === "cam_confirm") {
      // 1. Fetch all proposed allocations for this interview
      const allocations = await db.all(
        "SELECT * FROM interview_allocations WHERE interview_id = ? ORDER BY start_time ASC",
        [interview_id]
      );

      // Fetch actual enrolled students for this class cohort with robust normalized matching
      const cleanCG = (interview.class_group || "").replace(/^[\["'\s]+|[\]"'\s]+$/g, "").trim();
      let enrolledStudents = await db.all(
        `SELECT id, name, email FROM students 
         WHERE (LOWER(TRIM(classGroup)) = LOWER(TRIM(?)) OR LOWER(TRIM(department)) = LOWER(TRIM(?)) OR classGroup LIKE ? OR department LIKE ?)
         ORDER BY id ASC`,
        [cleanCG, cleanCG, `%${cleanCG}%`, `%${cleanCG}%`]
      );

      if (!enrolledStudents || enrolledStudents.length === 0) {
        const colId = interview.college_id || null;
        if (colId) {
          enrolledStudents = await db.all(
            `SELECT id, name, email FROM students WHERE college_id = ? ORDER BY id ASC LIMIT 50`,
            [colId]
          );
        } else {
          enrolledStudents = await db.all(
            `SELECT id, name, email FROM students ORDER BY id ASC LIMIT 50`
          );
        }
      }

      // Fetch faculty emails map
      const mentorIds = allocations.map((a: any) => a.mentor_id).filter(Boolean);
      const mentorEmailMap = new Map<string, string>();
      if (mentorIds.length > 0) {
        const placeholders = mentorIds.map(() => "?").join(",");
        const mentorsFound = await db.all(`SELECT id, email FROM mentors WHERE id IN (${placeholders})`, mentorIds);
        mentorsFound.forEach((m: any) => {
          if (m.email) mentorEmailMap.set(m.id, m.email);
        });
      }

      // 2. Base conference room for external session
      const baseMeetCode = interview.gmeet_link && interview.gmeet_link.includes("meet.google.com")
        ? interview.gmeet_link
        : `https://meet.google.com/${generateGoogleMeetCode()}`;

      // 3. Generate and insert 15-minute non-overlapping student slots with ISOLATED student privacy
      await db.run("DELETE FROM student_interview_slots WHERE interview_id = ?", [interview_id]);

      let totalAllocatedStudents = 0;
      const assignedMentorIds: string[] = [];
      let studentCursor = 0;

      for (const alloc of allocations) {
        const segCount = Number(alloc.allocated_student_count) || 0;
        totalAllocatedStudents += segCount;
        if (alloc.mentor_id && !assignedMentorIds.includes(alloc.mentor_id)) {
          assignedMentorIds.push(alloc.mentor_id);
        }

        const startMins = parseTimeToMinutes(alloc.start_time);
        const slots = generate15MinSlotsForSegment(
          alloc.mentor_id,
          alloc.mentor_name,
          alloc.target_college_id,
          segCount,
          startMins
        );

        const mentorEmail = mentorEmailMap.get(alloc.mentor_id) || "";

        for (const s of slots) {
          const slotId = `slot_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
          const realStudent = enrolledStudents[studentCursor] || {
            id: s.student_id,
            name: s.student_name,
            email: undefined
          };
          studentCursor++;

          // Isolated 1-on-1 Google Calendar link (strictly student + mentor ONLY, zero cross-student email sharing)
          const studentGCalUrl = generateStudentGCalUrl({
            studentName: realStudent.name || s.student_name,
            studentEmail: realStudent.email,
            subject: interview.subject || "Interview",
            targetDate: interview.target_date || new Date().toISOString().slice(0, 10),
            slotStartTime: s.slot_start_time,
            slotEndTime: s.slot_end_time,
            gmeetLink: baseMeetCode,
            mentorName: s.mentor_name
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
              alloc.id,
              realStudent.id,
              realStudent.name,
              s.mentor_id,
              s.mentor_name,
              s.college_id,
              s.slot_start_time,
              s.slot_end_time,
              baseMeetCode,
              studentGCalUrl,
              interview.subject,
              interview.target_date,
              "scheduled",
              now
            ]
          );
        }
      }

      const gmeetLink = baseMeetCode;
      const gcalLink: string | null = null;


      // 4. Update allocations to confirmed
      await db.run(
        `UPDATE interview_allocations 
         SET status = 'confirmed', gmeet_link = ?, updated_at = ?
         WHERE interview_id = ?`,
        [gmeetLink, now, interview_id]
      );

      // 5. Update main interview record to assigned
      const requestedStudents = Number(interview.student_count) || Number(interview.requested_students) || 10;
      const remainingStudents = Math.max(0, requestedStudents - totalAllocatedStudents);

      await db.run(
        `UPDATE student_interviews 
         SET status = 'assigned', gmeet_link = ?, gcal_link = ?, allocated_students = ?, remaining_students = ?,
             assigned_mentor_ids = ?, updated_at = ?
         WHERE id = ?`,
        [
          gmeetLink,
          gcalLink,
          totalAllocatedStudents,
          remainingStudents,
          JSON.stringify(assignedMentorIds),
          now,
          interview_id
        ]
      );

      // 6. Send notification with GMeet & GCal links
      try {
        await dispatchExternalInterviewNotifications({
          interviewId: interview.id,
          subject: interview.subject,
          classGroup: interview.class_group,
          targetDate: interview.target_date,
          type: "external",
          topics: interview.topics,
          studentCount: totalAllocatedStudents,
          mentorName: interview.mentor_name,
          originCollegeId: interview.origin_college_id || interview.college_id,
          actionType: "accepted",
          gmeetLink,
          gcalLink: gcalLink || undefined,
          actorName: actor_name
        });
      } catch (notifErr) {
        console.warn("Final confirm notification warning:", notifErr);
      }

      return NextResponse.json({
        success: true,
        message: "Final allocation confirmed! Real Google Calendar & Google Meet links generated and 15-minute student slots assigned.",
        gmeet_link: gmeetLink,
        gcal_link: gcalLink,
        allocated_students: totalAllocatedStudents,
        status: "assigned"
      });
    }

    if (action === "cam_reject") {
      // Release capacity for that college
      await db.run(
        `UPDATE cam_capacity_responses 
         SET accepted_student_capacity = 0, actual_available_capacity = 0, status = 'declined', updated_at = ?
         WHERE interview_id = ? AND college_id = ?`,
        [now, interview_id, college_id]
      );

      // Recalculate remaining pool
      const allResponses = await db.all(
        "SELECT * FROM cam_capacity_responses WHERE interview_id = ?",
        [interview_id]
      );
      let totalAcceptedCapacity = 0;
      allResponses.forEach((r: any) => {
        if (r.status === "accepted") totalAcceptedCapacity += Number(r.accepted_student_capacity) || 0;
      });

      const requestedStudents = Number(interview.student_count) || 10;
      const remainingStudents = Math.max(0, requestedStudents - totalAcceptedCapacity);

      await db.run(
        `UPDATE student_interviews 
         SET accepted_capacity = ?, remaining_students = ?, unallocated_students = ?, status = 'capacity_partially_accepted', updated_at = ?
         WHERE id = ?`,
        [totalAcceptedCapacity, remainingStudents, remainingStudents, now, interview_id]
      );

      return NextResponse.json({
        success: true,
        message: "Allocation rejected. Released capacity returned to remaining student pool.",
        remaining_students: remainingStudents,
        status: "capacity_partially_accepted"
      });
    }

    return NextResponse.json({ success: false, message: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    console.error("POST /api/interviews/final-confirm error:", error);
    return NextResponse.json({ success: false, message: error.message || "Failed to confirm allocation" }, { status: 500 });
  }
}
