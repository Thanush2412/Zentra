import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function POST(request: Request) {
  try {
    const db = await getDb();
    const body = await request.json();

    const {
      interview_id,
      college_id,
      cam_id = "cam_user",
      cam_name = "Campus Manager",
      action = "accept_capacity",
      accepted_student_capacity = 0
    } = body;

    if (!interview_id || !college_id) {
      return NextResponse.json(
        { success: false, message: "Missing required fields (interview_id, college_id)" },
        { status: 400 }
      );
    }

    const interview = await db.get("SELECT * FROM student_interviews WHERE id = ?", [interview_id]);
    if (!interview) {
      return NextResponse.json({ success: false, message: "Interview request not found" }, { status: 404 });
    }

    const college = await db.get("SELECT * FROM colleges WHERE id = ?", [college_id]);
    const collegeName = college?.name || "Campus";
    const now = new Date().toISOString();
    const acceptedCount = action === "decline" ? 0 : Math.max(0, Number(accepted_student_capacity) || 0);

    // Save or update CAM capacity response
    const existing = await db.get(
      "SELECT * FROM cam_capacity_responses WHERE interview_id = ? AND college_id = ?",
      [interview_id, college_id]
    );

    if (existing) {
      await db.run(
        `UPDATE cam_capacity_responses 
         SET accepted_student_capacity = ?, actual_available_capacity = ?, status = ?, updated_at = ?
         WHERE interview_id = ? AND college_id = ?`,
        [
          acceptedCount,
          acceptedCount,
          action === "decline" ? "declined" : "accepted",
          now,
          interview_id,
          college_id
        ]
      );
    } else {
      const respId = `cap_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      await db.run(
        `INSERT INTO cam_capacity_responses (
          id, interview_id, college_id, college_name, cam_id, cam_name,
          accepted_student_capacity, actual_available_capacity, unfulfilled_capacity, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          respId,
          interview_id,
          college_id,
          collegeName,
          cam_id,
          cam_name,
          acceptedCount,
          acceptedCount,
          0,
          action === "decline" ? "declined" : "accepted",
          now,
          now
        ]
      );
    }

    // Recalculate total accepted capacity across all CAM responses
    const allResponses = await db.all(
      "SELECT * FROM cam_capacity_responses WHERE interview_id = ?",
      [interview_id]
    );

    let totalAcceptedCapacity = 0;
    let acceptedCamCount = 0;
    let declinedCamCount = 0;

    allResponses.forEach((r: any) => {
      if (r.status === "accepted") {
        totalAcceptedCapacity += Number(r.accepted_student_capacity) || 0;
        acceptedCamCount++;
      } else if (r.status === "declined") {
        declinedCamCount++;
      }
    });

    const requestedStudents = Number(interview.student_count) || Number(interview.requested_students) || 10;
    const remainingStudents = Math.max(0, requestedStudents - totalAcceptedCapacity);
    const unallocatedStudents = remainingStudents;

    // Determine state machine status
    let newStatus = interview.status;
    if (declinedCamCount === allResponses.length && allResponses.length > 0) {
      newStatus = "no_capacity";
    } else if (remainingStudents <= 0) {
      newStatus = "priority_allocation";
    } else if (totalAcceptedCapacity > 0) {
      newStatus = "capacity_partially_accepted";
    }

    await db.run(
      `UPDATE student_interviews 
       SET accepted_capacity = ?, remaining_students = ?, unallocated_students = ?, status = ?, updated_at = ?
       WHERE id = ?`,
      [totalAcceptedCapacity, remainingStudents, unallocatedStudents, newStatus, now, interview_id]
    );

    return NextResponse.json({
      success: true,
      message: action === "decline"
        ? `Capacity request declined for ${collegeName}.`
        : `Capacity of ${acceptedCount} students accepted for ${collegeName}! Total accepted capacity: ${totalAcceptedCapacity}/${requestedStudents}.`,
      total_requested: requestedStudents,
      accepted_capacity: totalAcceptedCapacity,
      remaining_students: remainingStudents,
      status: newStatus
    });
  } catch (error: any) {
    console.error("POST /api/interviews/cam-capacity-response error:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to process CAM capacity response" },
      { status: 500 }
    );
  }
}
