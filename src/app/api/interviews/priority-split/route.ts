export const maxDuration = 60;

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/authGuard";
import { getDb, chunkList } from "@/lib/db";
import { generatePrioritySplitAllocations } from "@/lib/interview-priority-engine";
import { notifyExternalInterviewsAfterResponse } from "@/lib/interview-notifications";
import { generateId } from "@/lib/id";

export async function POST(request: Request) {
  try {
    const { errorResponse } = await requireAuth(request, { allowedRoles: ["cm", "kam", "L and D", "admin"] });
    if (errorResponse) return errorResponse;
    const db = await getDb();
    const body = await request.json();

    const {
      interview_id,
      origin_college_id,
      target_date,
      preferred_start_time = "09:00 AM",
      student_count = 10,
      subject = "",
      action = "preview"
    } = body;

    if (!interview_id) {
      return NextResponse.json({ success: false, message: "Missing interview_id" }, { status: 400 });
    }

    const interview = await db.get("SELECT * FROM student_interviews WHERE id = ?", [interview_id]);
    if (!interview) {
      return NextResponse.json({ success: false, message: "Interview request not found" }, { status: 404 });
    }

    const resolvedOriginCollegeId = origin_college_id || interview.origin_college_id || interview.college_id;
    const resolvedTargetDate = target_date || interview.target_date;
    const resolvedStudentCount = Number(student_count) || Number(interview.student_count) || 10;
    const resolvedSubject = subject || interview.subject || "";

    // Generate priority split calculation
    const splitResult = await generatePrioritySplitAllocations({
      interviewId: interview_id,
      originCollegeId: resolvedOriginCollegeId,
      targetDate: resolvedTargetDate,
      preferredStartTime: preferred_start_time,
      requestedStudentCount: resolvedStudentCount,
      subject: resolvedSubject
    });

    if (action === "preview") {
      return NextResponse.json({
        success: true,
        message: "Priority-based split calculation preview generated.",
        preview: splitResult
      });
    }

    // Action === "save": Persist allocations in interview_allocations table
    // Re-saving after confirmations have started would delete allocations a partner
    // campus already confirmed, so the split is only editable before final confirmation.
    const FINALISED_STATUSES = new Set(["assigned", "pending_verification", "completed", "declined"]);
    if (FINALISED_STATUSES.has(String(interview.status || ""))) {
      return NextResponse.json(
        { success: false, message: `This interview is already ${String(interview.status).replace(/_/g, " ")}. The priority split can no longer be changed.` },
        { status: 409 }
      );
    }

    const now = new Date().toISOString();
    const totalDurationMinutes = resolvedStudentCount * 15;

    const allocationRows = splitResult.allocations.map((alloc) => [
      generateId("alloc"),
      interview_id,
      resolvedOriginCollegeId,
      alloc.target_college_id,
      alloc.mentor_id,
      alloc.mentor_name,
      alloc.allocated_student_count,
      alloc.start_time,
      alloc.end_time,
      alloc.duration_minutes,
      "pending_acceptance",
      now,
      now
    ]);

    await db.transaction(async (tx) => {
      await tx.run("DELETE FROM interview_allocations WHERE interview_id = ?", [interview_id]);

      for (const part of chunkList(allocationRows, 200)) {
        await tx.run(
          `INSERT INTO interview_allocations (
            id, interview_id, origin_college_id, target_college_id, mentor_id, mentor_name,
            allocated_student_count, start_time, end_time, duration_minutes, status, created_at, updated_at
          ) VALUES ${part.map(() => "(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").join(", ")}`,
          part.flat()
        );
      }

      // Update main interview record to pending_final_confirmation
      await tx.run(
        `UPDATE student_interviews 
         SET preferred_start_time = ?, total_duration_minutes = ?, allocated_students = ?, remaining_students = ?, unallocated_students = ?, status = 'pending_final_confirmation', updated_at = ?
         WHERE id = ?`,
        [
          preferred_start_time,
          totalDurationMinutes,
          splitResult.allocatedStudents,
          splitResult.remainingStudents,
          splitResult.unallocatedStudents,
          now,
          interview_id
        ]
      );
    });

    // Notify regional KAM and CMs that their allocation needs final confirmation
    try {
      notifyExternalInterviewsAfterResponse({
        interviewId: interview.id,
        subject: interview.subject,
        classGroup: interview.class_group,
        targetDate: resolvedTargetDate,
        type: "external",
        topics: interview.topics,
        studentCount: resolvedStudentCount,
        mentorName: interview.mentor_name,
        originCollegeId: resolvedOriginCollegeId,
        actionType: "pending_confirmation"
      });
    } catch (notifErr) {
      console.warn("Priority split notification dispatch warning:", notifErr);
    }

    // Retrieve saved allocations
    const savedAllocations = await db.all(
      "SELECT * FROM interview_allocations WHERE interview_id = ?",
      [interview_id]
    );

    return NextResponse.json({
      success: true,
      message: `Priority split saved! Split into ${savedAllocations.length} session segment(s) totaling ${splitResult.formattedTotalDuration}.`,
      allocations: savedAllocations,
      summary: splitResult
    });
  } catch (error: any) {
    console.error("POST /api/interviews/priority-split error:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to process priority split" },
      { status: 500 }
    );
  }
}
