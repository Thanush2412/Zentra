// Pin to Mumbai (bom1) — co-located with Turso DB (aws-ap-south-1)
export const preferredRegion = "bom1";
export const maxDuration = 60;

import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { sendMail, renderEmailShell } from "@/lib/mail";
import { dispatchExternalInterviewNotifications } from "@/lib/interview-notifications";
import { createGoogleCalendarEvent } from "@/lib/google-calendar";


export async function POST(request: Request) {
  try {
    const db = await getDb();
    const body = await request.json();

    const { interview_id, target_college_id, action = "accept", cm_name = "External CM" } = body;

    if (!interview_id) {
      return NextResponse.json({ success: false, message: "Missing interview_id" }, { status: 400 });
    }

    const interview = await db.get("SELECT * FROM student_interviews WHERE id = ?", [interview_id]);
    if (!interview) {
      return NextResponse.json({ success: false, message: "Interview request not found" }, { status: 404 });
    }

    const now = new Date().toISOString();

    if (action === "accept") {
      // Generate real-time GMeet & GCal link
      const gcalResult = await createGoogleCalendarEvent({
        title: `Structured Interview: ${interview.subject} (${interview.class_group || 'Cohort'})`,
        description: `Faculty evaluation assessment session for ${interview.subject}.\nCohort: ${interview.class_group || 'All'}`,
        targetDate: interview.target_date || new Date().toISOString().slice(0, 10),
        startTime: interview.preferred_start_time || "08:20 AM",
        endTime: "09:10 AM",
        existingMeetLink: interview.gmeet_link,
        interviewId: interview_id
      });

      const gmeetLink = gcalResult.gmeet_link;
      const gcalLink = gcalResult.gcal_link;

      await db.run(
        `UPDATE student_interviews 
         SET target_college_id = ?, gmeet_link = ?, gcal_link = ?, status = 'assigned', updated_at = ?
         WHERE id = ?`,
        [target_college_id || "", gmeetLink, gcalLink, now, interview_id]
      );

      // Update any pending allocations for this interview to accepted
      await db.run(
        `UPDATE interview_allocations
         SET status = 'accepted', gmeet_link = ?, updated_at = ?
         WHERE interview_id = ?`,
        [gmeetLink, now, interview_id]
      );

      // Dispatch notifications to KAM and regional colleges & target CM
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
          targetCollegeId: target_college_id || interview.target_college_id,
          actionType: "accepted",
          gmeetLink: gmeetLink,
          actorName: cm_name
        });
      } catch (notifErr) {
        console.warn("External accept notification failed:", notifErr);
      }

      return NextResponse.json({
        success: true,
        message: "External interview request accepted successfully! Real-time GMeet link generated.",
        gmeet_link: gmeetLink
      });
    } else if (action === "decline") {
      // Set status to declined
      await db.run(
        `UPDATE student_interviews 
         SET status = 'declined', updated_at = ?
         WHERE id = ?`,
        [now, interview_id]
      );

      // Dispatch notifications to KAM and regional colleges & target CM
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
          targetCollegeId: target_college_id || interview.target_college_id,
          actionType: "declined",
          actorName: cm_name
        });
      } catch (notifErr) {
        console.warn("External decline notification failed:", notifErr);
      }

      return NextResponse.json({
        success: true,
        message: "External interview request declined. Regional KAM & colleges notified."
      });
    }

    return NextResponse.json({ success: false, message: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    console.error("POST /api/interviews/external-accept error:", error);
    return NextResponse.json({ success: false, message: error.message || "Failed to process request" }, { status: 500 });
  }
}
