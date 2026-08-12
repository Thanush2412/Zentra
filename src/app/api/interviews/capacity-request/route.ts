import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { dispatchExternalInterviewNotifications } from "@/lib/interview-notifications";

export async function POST(request: Request) {
  try {
    const db = await getDb();
    const body = await request.json();

    const { interview_id, cm_id, cm_name } = body;

    if (!interview_id) {
      return NextResponse.json({ success: false, message: "Missing interview_id" }, { status: 400 });
    }

    const interview = await db.get("SELECT * FROM student_interviews WHERE id = ?", [interview_id]);
    if (!interview) {
      return NextResponse.json({ success: false, message: "Interview request not found" }, { status: 404 });
    }

    const now = new Date().toISOString();

    // Update status to pending_cam_acceptance
    await db.run(
      `UPDATE student_interviews 
       SET status = 'pending_cam_acceptance', updated_at = ?
       WHERE id = ?`,
      [now, interview_id]
    );

    // Find origin college & KAM
    const originCollege = await db.get(
      "SELECT * FROM colleges WHERE id = ?",
      [interview.origin_college_id || interview.college_id]
    );
    const kamId = originCollege?.kam_id;

    // Fetch all colleges under KAM (or all colleges across DB)
    let regionalColleges: any[] = [];
    if (kamId) {
      regionalColleges = await db.all("SELECT * FROM colleges WHERE kam_id = ?", [kamId]);
    }
    if (!regionalColleges || regionalColleges.length <= 1) {
      regionalColleges = await db.all("SELECT * FROM colleges");
    }

    // Insert pending CAM capacity request rows for each regional college
    for (const col of regionalColleges) {
      const cams = await db.all("SELECT * FROM campus_managers WHERE college_id = ?", [col.id]);
      const primaryCam = cams[0] || { id: `cam_${col.id}`, name: `${col.name} CM` };

      const existing = await db.get(
        "SELECT * FROM cam_capacity_responses WHERE interview_id = ? AND college_id = ?",
        [interview_id, col.id]
      );

      if (!existing) {
        const respId = `cap_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        await db.run(
          `INSERT INTO cam_capacity_responses (
            id, interview_id, college_id, college_name, cam_id, cam_name,
            accepted_student_capacity, actual_available_capacity, unfulfilled_capacity, status, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            respId,
            interview_id,
            col.id,
            col.name,
            primaryCam.id,
            primaryCam.name,
            0,
            0,
            0,
            "pending",
            now,
            now
          ]
        );
      }
    }

    // Dispatch notifications to regional CAMs
    try {
      await dispatchExternalInterviewNotifications({
        interviewId: interview.id,
        subject: interview.subject,
        classGroup: interview.class_group,
        targetDate: interview.target_date,
        type: "external",
        topics: interview.topics,
        studentCount: interview.student_count,
        mentorName: interview.mentor_name,
        originCollegeId: interview.origin_college_id || interview.college_id,
        actionType: "created"
      });
    } catch (notifErr) {
      console.warn("Capacity request notification dispatch warning:", notifErr);
    }

    return NextResponse.json({
      success: true,
      message: `Capacity request dispatched to ${regionalColleges.length} regional college CAMs. Status set to pending_cam_acceptance.`
    });
  } catch (error: any) {
    console.error("POST /api/interviews/capacity-request error:", error);
    return NextResponse.json({ success: false, message: error.message || "Failed to send capacity request" }, { status: 500 });
  }
}
