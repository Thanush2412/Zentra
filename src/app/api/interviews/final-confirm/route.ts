export const maxDuration = 60;

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/authGuard";
import { getDb, chunkList, type QueryFailure } from "@/lib/db";
import { generate15MinSlotsForSegment, parseTimeToMinutes } from "@/lib/interview-priority-engine";
import { notifyExternalInterviewsAfterResponse } from "@/lib/interview-notifications";
import { createGoogleCalendarEvent, generateStudentGCalUrl } from "@/lib/google-calendar";
import { generateId } from "@/lib/id";
import { getInstitutionDateStr } from "@/lib/localDate";

export async function POST(request: Request) {
  try {
    const { errorResponse } = await requireAuth(request, { allowedRoles: ["cm", "kam", "L and D", "admin"] });
    if (errorResponse) return errorResponse;
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
      // Only a split that is waiting for confirmation can be confirmed. Re-running it
      // after assignment wiped and re-generated the slots a mentor was already using.
      if (interview.status !== "pending_final_confirmation") {
        return NextResponse.json(
          { success: false, message: `This interview is ${String(interview.status || "not awaiting confirmation").replace(/_/g, " ")} and cannot be confirmed again.` },
          { status: 409 }
        );
      }

      // Fetch actual enrolled students for this class cohort with robust normalized matching
      const cleanCG = (interview.class_group || "").replace(/^[\["'\s]+|[\]"'\s]+$/g, "").trim();

      // 1. Allocations and the cohort roster are independent, so they share one round
      // trip. A failed roster slice must not fall through to the fallback below — that
      // would build the session from the wrong students.
      const confirmFailures: QueryFailure[] = [];
      const [allocations, enrolledRows] = await db.multiQuery(
        [
          { sql: "SELECT * FROM interview_allocations WHERE interview_id = ? ORDER BY start_time ASC", params: [interview_id] },
          {
            sql: `SELECT id, name, email FROM students 
                  WHERE (LOWER(TRIM(classGroup)) = LOWER(TRIM(?)) OR LOWER(TRIM(department)) = LOWER(TRIM(?)) OR classGroup LIKE ? OR department LIKE ?)
                  ORDER BY id ASC`,
            params: [cleanCG, cleanCG, `%${cleanCG}%`, `%${cleanCG}%`],
          },
        ],
        confirmFailures
      );
      if (confirmFailures.length > 0) {
        return NextResponse.json({ success: false, message: "Could not load the proposed allocations. Please try again." }, { status: 500 });
      }

      let enrolledStudents = enrolledRows;
      if (enrolledStudents.length === 0) {
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

      // 2. Conference room — use existing link if valid, otherwise try to create one via GAS
      let realMeetLink: string | null =
        interview.gmeet_link && interview.gmeet_link.includes("meet.google.com")
          ? interview.gmeet_link
          : null;

      // Auto-create Google Meet + GCal event via GAS if no link exists yet
      let gcalLink: string | null = interview.gcal_link || null;
      if (!realMeetLink) {
        try {
          const gcalResult = await createGoogleCalendarEvent({
            title: `Structured Interview: ${interview.subject} (${interview.class_group || "Cohort"})`,
            description: `Faculty evaluation session for ${interview.subject}. Cohort: ${interview.class_group || "All"}`,
            targetDate: interview.target_date || getInstitutionDateStr(),
            startTime: interview.preferred_start_time || "08:20 AM",
            endTime: "09:10 AM",
            existingMeetLink: null,
            interviewId: interview_id,
          });
          if (gcalResult.gmeet_link) realMeetLink = gcalResult.gmeet_link;
          if (gcalResult.gcal_link) gcalLink = gcalResult.gcal_link;
        } catch (gasErr) {
          console.warn("[final-confirm] GAS calendar event creation failed:", gasErr);
        }
      }

      // 3. Generate and insert 15-minute non-overlapping student slots with ISOLATED student privacy
      let totalAllocatedStudents = 0;
      const assignedMentorIds: string[] = [];
      let studentCursor = 0;
      const slotRows: any[][] = [];

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
          const slotId = generateId("slot");
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
            targetDate: interview.target_date || getInstitutionDateStr(),
            slotStartTime: s.slot_start_time,
            slotEndTime: s.slot_end_time,
            gmeetLink: realMeetLink,
            mentorName: s.mentor_name
          });

          slotRows.push([
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
            realMeetLink,
            studentGCalUrl,
            interview.subject,
            interview.target_date,
            "scheduled",
            now
          ]);
        }
      }

      // Clearing the previous schedule and writing the new one is one unit; a failure
      // halfway used to leave the panel with a partial slot list.
      const SLOT_COLUMNS = [
        "id", "interview_id", "allocation_id", "student_id", "student_name",
        "mentor_id", "mentor_name", "college_id", "slot_start_time", "slot_end_time",
        "gmeet_link", "gcal_link", "subject", "target_date", "status", "created_at"
      ];
      await db.transaction(async (tx) => {
        await tx.run("DELETE FROM student_interview_slots WHERE interview_id = ?", [interview_id]);
        for (const part of chunkList(slotRows, 200)) {
          await tx.run(
            `INSERT INTO student_interview_slots (${SLOT_COLUMNS.join(", ")})
             VALUES ${part.map(() => `(${SLOT_COLUMNS.map(() => "?").join(", ")})`).join(", ")}`,
            part.flat()
          );
        }
      });

      const gmeetLink = realMeetLink;


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
        notifyExternalInterviewsAfterResponse({
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
          gmeetLink: gmeetLink || undefined,
          gcalLink: gcalLink || undefined,
          actorName: actor_name
        });
      } catch (notifErr) {
        console.warn("Final confirm notification warning:", notifErr);
      }

      return NextResponse.json({
        success: true,
        message: gmeetLink
          ? "Final allocation confirmed! 15-minute student slots assigned with the saved Google Meet room."
          : "Final allocation confirmed! 15-minute student slots assigned. Add the Google Meet room link before the session so students get a working join link.",
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

      const requestedStudents = Number(interview.student_count) || Number(interview.requested_students) || 10;
      const remainingStudents = Math.max(0, requestedStudents - totalAcceptedCapacity);

      // Re-derive the state the same way a capacity response does: a rejection can
      // leave the pool full again (priority allocation) or empty (no capacity left).
      const newStatus = remainingStudents <= 0
        ? "priority_allocation"
        : totalAcceptedCapacity > 0
          ? "capacity_partially_accepted"
          : "no_capacity";

      await db.run(
        `UPDATE student_interviews 
         SET accepted_capacity = ?, remaining_students = ?, unallocated_students = ?, status = ?, updated_at = ?
         WHERE id = ?`,
        [totalAcceptedCapacity, remainingStudents, remainingStudents, newStatus, now, interview_id]
      );

      return NextResponse.json({
        success: true,
        message: "Allocation rejected. Released capacity returned to remaining student pool.",
        remaining_students: remainingStudents,
        status: newStatus
      });
    }

    return NextResponse.json({ success: false, message: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    console.error("POST /api/interviews/final-confirm error:", error);
    return NextResponse.json({ success: false, message: error.message || "Failed to confirm allocation" }, { status: 500 });
  }
}
