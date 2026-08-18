// Pin to Mumbai (bom1) — co-located with Turso DB (aws-ap-south-1)
export const preferredRegion = "bom1";
export const maxDuration = 60;

import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { generatePrioritySplitAllocations } from "@/lib/interview-priority-engine";
import { dispatchExternalInterviewNotifications } from "@/lib/interview-notifications";

export async function POST(request: Request) {
  try {
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
    const now = new Date().toISOString();
    const totalDurationMinutes = resolvedStudentCount * 15;

    // Delete previous allocations for this interview_id if any
    await db.run("DELETE FROM interview_allocations WHERE interview_id = ?", [interview_id]);

    // Insert new split allocation rows
    for (const alloc of splitResult.allocations) {
      const allocId = `alloc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      await db.run(
        `INSERT INTO interview_allocations (
          id, interview_id, origin_college_id, target_college_id, mentor_id, mentor_name,
          allocated_student_count, start_time, end_time, duration_minutes, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          allocId,
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
        ]
      );
    }

    // Update main interview record to pending_final_confirmation
    await db.run(
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

    // Notify regional KAM and CMs
    try {
      await dispatchExternalInterviewNotifications({
        interviewId: interview.id,
        subject: interview.subject,
        classGroup: interview.class_group,
        targetDate: resolvedTargetDate,
        type: "external",
        topics: interview.topics,
        studentCount: resolvedStudentCount,
        mentorName: interview.mentor_name,
        originCollegeId: resolvedOriginCollegeId,
        actionType: "created"
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
