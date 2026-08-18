// Pin to Mumbai (bom1) — co-located with Turso DB (aws-ap-south-1)
export const preferredRegion = "bom1";
export const maxDuration = 60;

import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { generate15MinSlotsForSegment, parseTimeToMinutes } from "@/lib/interview-priority-engine";
import { dispatchExternalInterviewNotifications } from "@/lib/interview-notifications";
import { createGoogleCalendarEvent } from "@/lib/google-calendar";

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

      // Fetch actual enrolled students for this class cohort
      const enrolledStudents = await db.all(
        `SELECT id, name, email FROM students 
         WHERE (LOWER(classGroup) = LOWER(?) OR LOWER(department) = LOWER(?))
         ORDER BY id ASC`,
        [interview.class_group || "", interview.class_group || ""]
      );

      // Fetch faculty emails
      const mentorIds = allocations.map((a: any) => a.mentor_id).filter(Boolean);
      let mentorEmails: string[] = [];
      if (mentorIds.length > 0) {
        const placeholders = mentorIds.map(() => "?").join(",");
        const mentorsFound = await db.all(`SELECT email FROM mentors WHERE id IN (${placeholders})`, mentorIds);
        mentorEmails = mentorsFound.map((m: any) => m.email).filter(Boolean);
      }

      const candidateEmails = enrolledStudents.map((s: any) => s.email).filter(Boolean);
      const allAttendees = Array.from(new Set([...mentorEmails, ...candidateEmails]));

      // 2. Generate Real Google Calendar Event & Google Meet Link
      const gcalResult = await createGoogleCalendarEvent({
        title: `Structured Interview: ${interview.subject} (${interview.class_group || 'Cohort'})`,
        description: `Faculty evaluation assessment session for ${interview.subject}.\nCohort: ${interview.class_group || 'All'}\nAssigned Candidates: ${allocations.reduce((sum: number, a: any) => sum + (Number(a.allocated_student_count) || 0), 0)}\nAssigned Mentors: ${allocations.map((a: any) => a.mentor_name).join(', ')}`,
        targetDate: interview.target_date || new Date().toISOString().slice(0, 10),
        startTime: interview.preferred_start_time || "08:20 AM",
        endTime: "09:10 AM",
        attendees: allAttendees,
        existingMeetLink: interview.gmeet_link,
        interviewId: interview_id
      });

      const gmeetLink = gcalResult.gmeet_link;
      const gcalLink = gcalResult.gcal_link;

      // 3. Generate and insert 15-minute non-overlapping student slots
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

        for (const s of slots) {
          const slotId = `slot_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
          const realStudent = enrolledStudents[studentCursor] || {
            id: s.student_id,
            name: s.student_name
          };
          studentCursor++;

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
              gmeetLink,
              gcalLink,
              interview.subject,
              interview.target_date,
              "scheduled",
              now
            ]
          );
        }
      }

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
          gcalLink,
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
