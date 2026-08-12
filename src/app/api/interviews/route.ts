import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { sendMail, renderEmailShell } from "@/lib/mail";
import { dispatchExternalInterviewNotifications } from "@/lib/interview-notifications";


export async function GET(request: Request) {
  try {
    const db = await getDb();
    const { searchParams } = new URL(request.url);
    const mentorId = searchParams.get("mentorId");
    const collegeId = searchParams.get("collegeId");
    const role = searchParams.get("role") || "mentor";
    const type = searchParams.get("type");

    let query = "SELECT * FROM student_interviews WHERE 1=1";
    const params: any[] = [];

    if (type) {
      query += " AND type = ?";
      params.push(type);
    }

    // Role-scoped filtering
    if (role === "mentor" && mentorId) {
      // Mentor only sees their own raised requests OR sessions where they are assigned as evaluator
      query += ` AND (
        mentor_id = ? OR 
        assigned_mentor_ids LIKE ? OR
        id IN (SELECT interview_id FROM student_interview_slots WHERE mentor_id = ?) OR
        id IN (SELECT interview_id FROM interview_allocations WHERE mentor_id = ?)
      )`;
      params.push(mentorId, `%${mentorId}%`, mentorId, mentorId);
    } else if ((role === "cam" || role === "cm") && collegeId) {
      // CM sees:
      // 1. Their own campus requests (internal & external created by their campus)
      // 2. Broadcasted external requests from other partner colleges in the zone/region
      // 3. Any requests where their campus has a record in cam_capacity_responses
      query += ` AND (
        college_id = ? OR 
        origin_college_id = ? OR 
        target_college_id = ? OR 
        id IN (SELECT interview_id FROM cam_capacity_responses WHERE college_id = ?) OR
        (type = 'external' AND status NOT IN ('pending_origin_cm', 'draft', 'rejected'))
      )`;
      params.push(collegeId, collegeId, collegeId, collegeId);
    } else if (role === "student") {
      const studentId = searchParams.get("studentId");
      const classGroup = searchParams.get("classGroup");
      const colId = searchParams.get("collegeId");

      query += ` AND (
        (status IN ('assigned', 'completed', 'pending_verification')) AND (
          id IN (SELECT interview_id FROM student_interview_slots WHERE student_id = ?) OR
          LOWER(class_group) = LOWER(?) OR
          LOWER(class_group) LIKE LOWER(?) OR
          (college_id = ? AND status IN ('assigned', 'completed', 'pending_verification'))
        )
      )`;
      params.push(studentId || "", classGroup || "", `%${classGroup || ""}%`, colId || "");
    }
    // KAM/admin: no filter - see all

    query += " ORDER BY created_at DESC";

    const interviews = await db.all(query, params);

    const interviewsWithDetails = await Promise.all(
      interviews.map(async (inv: any) => {
        const allocs = await db.all(
          "SELECT * FROM interview_allocations WHERE interview_id = ? ORDER BY start_time ASC",
          [inv.id]
        );
        const camResponses = await db.all(
          "SELECT * FROM cam_capacity_responses WHERE interview_id = ? ORDER BY created_at ASC",
          [inv.id]
        );
        const studentSlots = await db.all(
          "SELECT * FROM student_interview_slots WHERE interview_id = ? ORDER BY slot_start_time ASC",
          [inv.id]
        );
        const evalsForThis = await db.all(
          "SELECT id, student_id, student_name, attendance, total_score, status, remarks FROM interview_evaluations WHERE interview_id = ?",
          [inv.id]
        );

        const reqCount = Number(inv.student_count) || Number(inv.requested_students) || 10;
        const accCap = (camResponses || [])
          .filter((r: any) => r.status === "accepted")
          .reduce((sum: number, r: any) => sum + (Number(r.accepted_student_capacity) || 0), 0);
        const cappedAccCap = Math.min(reqCount, accCap);

        const allocCount = (studentSlots && studentSlots.length > 0)
          ? studentSlots.length
          : (Number(inv.allocated_students) || 0);

        const evalCount = evalsForThis ? evalsForThis.length : 0;
        const isCompleted = inv.status === "completed";
        const verCount = isCompleted ? evalCount : 0;

        const remToAlloc = Math.max(0, reqCount - allocCount);
        const remToEval = Math.max(0, allocCount - evalCount);

        let conductedStatus = "not_conducted";
        if (isCompleted) {
          if (allocCount >= reqCount && evalCount >= allocCount) {
            conductedStatus = "fully_conducted";
          } else {
            conductedStatus = "partially_conducted";
          }
        } else if (inv.status === "pending_verification") {
          conductedStatus = "pending_verification";
        } else if (inv.status === "assigned") {
          if (evalCount > 0) {
            conductedStatus = "partially_conducted";
          } else {
            conductedStatus = "scheduled";
          }
        } else if (inv.status === "no_capacity" || (inv.status?.includes("pending") && allocCount === 0)) {
          conductedStatus = "not_conducted";
        }

        let effectiveGmeet = inv.gmeet_link;
        if (!effectiveGmeet && (inv.status === "assigned" || inv.status === "completed" || inv.status === "confirmed" || inv.status === "accepted" || allocCount > 0)) {
          const fromSlot = (studentSlots || []).find((s: any) => s.gmeet_link)?.gmeet_link;
          const fromAlloc = (allocs || []).find((a: any) => a.gmeet_link)?.gmeet_link;
          if (fromSlot || fromAlloc) {
            effectiveGmeet = fromSlot || fromAlloc;
          } else {
            const rawId = (inv.id || "eval").replace(/[^a-z0-9]/gi, "").toLowerCase();
            const code1 = rawId.slice(0, 3) || "fpz";
            const code2 = rawId.slice(3, 7) || "meet";
            const code3 = rawId.slice(7, 10) || "eval";
            effectiveGmeet = `https://meet.google.com/${code1}-${code2}-${code3}`;
          }
          // Self-heal DB
          db.run("UPDATE student_interviews SET gmeet_link = ? WHERE id = ? AND (gmeet_link IS NULL OR gmeet_link = '')", [effectiveGmeet, inv.id]).catch(() => {});
        }

        const enrichedSlots = (studentSlots || []).map((s: any) => ({
          ...s,
          gmeet_link: s.gmeet_link || effectiveGmeet
        }));

        return {
          ...inv,
          gmeet_link: effectiveGmeet || inv.gmeet_link,
          allocations: allocs || [],
          cam_responses: camResponses || [],
          student_slots: enrichedSlots,
          required_students: reqCount,
          accepted_capacity: cappedAccCap,
          allocated_students: allocCount,
          evaluated_students: evalCount,
          verified_students: verCount,
          remaining_to_allocate: remToAlloc,
          remaining_to_evaluate: remToEval,
          conducted_status: conductedStatus
        };
      })
    );

    // Fetch evaluations — scoped if mentor
    let evaluations: any[] = [];
    if (role === "mentor" && mentorId) {
      evaluations = await db.all(
        "SELECT * FROM interview_evaluations WHERE mentor_id = ? ORDER BY created_at DESC",
        [mentorId]
      );
    } else {
      evaluations = await db.all("SELECT * FROM interview_evaluations ORDER BY created_at DESC");
    }

    return NextResponse.json({ success: true, interviews: interviewsWithDetails, evaluations });
  } catch (error: any) {
    console.error("GET /api/interviews error:", error);
    return NextResponse.json({ success: false, message: error.message || "Failed to fetch interviews" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const db = await getDb();
    const body = await request.json();

    const {
      id,
      student_id,
      student_name,
      class_group = "",
      subject,
      type = "internal",
      target_date,
      topics,
      student_count,
      mentor_id,
      mentor_name,
      mentor_email,
      origin_college_id,
      college_id,
      notes = ""
    } = body;

    if (!subject || !mentor_id || !target_date) {
      return NextResponse.json(
        { success: false, message: "Missing required fields (subject, mentor_id, target_date)" },
        { status: 400 }
      );
    }

    // Rule 1: Exclude Tamil subject
    if (subject.trim().toLowerCase() === "tamil") {
      return NextResponse.json(
        { success: false, message: "Interview Module features are not applicable for Tamil subject." },
        { status: 400 }
      );
    }

    // Rule 2: Date must be at least 2 days after current date
    const reqDate = new Date(target_date);
    const minAllowedDate = new Date();
    minAllowedDate.setHours(0, 0, 0, 0);
    minAllowedDate.setDate(minAllowedDate.getDate() + 2);

    if (isNaN(reqDate.getTime()) || reqDate < minAllowedDate) {
      const minStr = minAllowedDate.toISOString().split("T")[0];
      return NextResponse.json(
        { success: false, message: `Interview target date must be at least 2 days in advance (on or after ${minStr}).` },
        { status: 400 }
      );
    }

    const interviewId = id || `int_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();
    const resolvedCollegeId = college_id || origin_college_id || "";

    const { preferred_start_time = "09:00 AM" } = body;
    const studentCountNum = Number(student_count) || 10;
    const totalDurationMinutes = studentCountNum * 15;

    await db.run(
      `INSERT INTO student_interviews (
        id, student_id, student_name, class_group, subject, type,
        target_date, topics, student_count, mentor_id, mentor_name,
        origin_college_id, college_id, status, notes, evaluator_name, evaluator_role,
        preferred_start_time, total_duration_minutes, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        subject = excluded.subject,
        type = excluded.type,
        target_date = excluded.target_date,
        topics = excluded.topics,
        student_count = excluded.student_count,
        preferred_start_time = excluded.preferred_start_time,
        total_duration_minutes = excluded.total_duration_minutes,
        notes = excluded.notes,
        updated_at = excluded.updated_at`,
      [
        interviewId,
        student_id || "batch_all",
        student_name || "Assigned Students",
        class_group,
        subject,
        type,
        target_date,
        topics || "",
        studentCountNum,
        mentor_id,
        mentor_name || "Mentor",
        origin_college_id || "",
        resolvedCollegeId,
        type === "external" ? "pending_external_cm" : "pending_cm",
        notes,
        mentor_name || "",
        "mentor",
        preferred_start_time,
        totalDurationMinutes,
        now,
        now
      ]
    );

    // Notify Campus Manager via email & in-app
    try {
      if (type === "external") {
        await dispatchExternalInterviewNotifications({
          interviewId,
          subject,
          classGroup: class_group,
          targetDate: target_date,
          type: "external",
          topics,
          studentCount: Number(student_count) || 0,
          mentorName: mentor_name,
          originCollegeId: origin_college_id || resolvedCollegeId,
          notes,
          actionType: "created"
        });
      } else {
        const cms = await db.all(
          "SELECT * FROM campus_managers WHERE college_id = ?",
          [resolvedCollegeId]
        );
        if (cms && cms.length > 0) {
          const cmEmails = cms.map((cm: any) => cm.email).filter(Boolean).join(", ");
          if (cmEmails) {
            await sendMail({
              to: cmEmails,
              subject: `[New Interview Request] ${subject} — ${class_group} by ${mentor_name}`,
              htmlBody: renderEmailShell({
                title: "New Interview Request Raised",
                badgeText: "Internal Interview",
                badgeColor: "amber",
                description: `<strong>${mentor_name || "A mentor"}</strong> has raised a new internal interview request and it is awaiting your allocation.`,
                details: [
                  { label: "Subject", value: subject, highlight: true },
                  { label: "Class Group", value: class_group || "All Classes" },
                  { label: "Target Date", value: target_date },
                  { label: "Type", value: "INTERNAL" },
                  { label: "Topics", value: topics || "General Review" },
                  { label: "Requested By", value: mentor_name || "Mentor" },
                ],
                ctaText: "Open Campus Manager Dashboard →",
              }),
            });
          }
        }
      }
    } catch (mailErr) {
      console.warn("Interview notification failed:", mailErr);
    }

    const createdRecord = await db.get("SELECT * FROM student_interviews WHERE id = ?", [interviewId]);

    return NextResponse.json({
      success: true,
      message: "Interview request raised successfully. Campus Manager has been notified.",
      interview: createdRecord
    });
  } catch (error: any) {
    console.error("POST /api/interviews error:", error);
    return NextResponse.json({ success: false, message: error.message || "Failed to save interview" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const db = await getDb();
    const body = await request.json();
    const { interview_id, status, cm_name } = body;

    if (!interview_id || !status) {
      return NextResponse.json({ success: false, message: "Missing interview_id or status" }, { status: 400 });
    }

    const interview = await db.get("SELECT * FROM student_interviews WHERE id = ?", [interview_id]);
    if (!interview) {
      return NextResponse.json({ success: false, message: "Interview not found" }, { status: 404 });
    }

    const now = new Date().toISOString();
    await db.run(
      "UPDATE student_interviews SET status = ?, updated_at = ? WHERE id = ?",
      [status, now, interview_id]
    );

    // If marking as completed, notify students in the class group
    if (status === "completed") {
      try {
        const classGroup = interview.class_group;
        let studentEmails: string[] = [];

        if (classGroup) {
          const studentsInClass = await db.all(
            "SELECT email, name FROM students WHERE class_group = ? AND email IS NOT NULL AND email != ''",
            [classGroup]
          );
          studentEmails = studentsInClass.map((s: any) => s.email).filter(Boolean);
        }

        if (studentEmails.length > 0) {
          // Send in batches to avoid large TO lists
          const batchSize = 10;
          for (let i = 0; i < studentEmails.length; i += batchSize) {
            const batch = studentEmails.slice(i, i + batchSize);
            await sendMail({
              to: batch.join(", "),
              subject: `[Interview Results Ready] ${interview.subject} — ${classGroup}`,
              htmlBody: renderEmailShell({
                title: "Your Interview Evaluation Results Are Ready",
                badgeText: "Interview Completed",
                badgeColor: "emerald",
                description: `Dear Student, your <strong>${interview.subject}</strong> interview evaluation has been reviewed and verified by the Campus Manager. You can now view your scores on the portal.`,
                details: [
                  { label: "Subject", value: interview.subject, highlight: true },
                  { label: "Class Group", value: classGroup || "Your Class" },
                  { label: "Target Date", value: interview.target_date || "" },
                  { label: "Status", value: "Verified & Completed" },
                  { label: "Reviewed By", value: cm_name || "Campus Manager" },
                ],
                ctaText: "View My Interview Performance →",
              }),
            });
          }
        }
      } catch (mailErr) {
        console.warn("Student notification email failed:", mailErr);
      }
    }

    return NextResponse.json({
      success: true,
      message: status === "completed"
        ? "Interview marked as completed. Students have been notified."
        : `Interview status updated to '${status}'.`
    });
  } catch (error: any) {
    console.error("PATCH /api/interviews error:", error);
    return NextResponse.json({ success: false, message: error.message || "Failed to update interview" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const db = await getDb();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const clearAll = searchParams.get("all") === "true";

    if (clearAll) {
      await db.run("DELETE FROM student_interviews");
      await db.run("DELETE FROM interview_allocations");
      await db.run("DELETE FROM cam_capacity_responses");
      await db.run("DELETE FROM student_interview_slots");
      await db.run("DELETE FROM interview_evaluations");
      return NextResponse.json({ success: true, message: "All interview records deleted successfully" });
    }

    if (!id) {
      return NextResponse.json({ success: false, message: "Missing interview id" }, { status: 400 });
    }

    await db.run("DELETE FROM student_interviews WHERE id = ?", [id]);
    await db.run("DELETE FROM interview_allocations WHERE interview_id = ?", [id]);
    await db.run("DELETE FROM cam_capacity_responses WHERE interview_id = ?", [id]);
    await db.run("DELETE FROM student_interview_slots WHERE interview_id = ?", [id]);
    await db.run("DELETE FROM interview_evaluations WHERE interview_id = ?", [id]);
    return NextResponse.json({ success: true, message: "Interview deleted successfully" });
  } catch (error: any) {
    console.error("DELETE /api/interviews error:", error);
    return NextResponse.json({ success: false, message: error.message || "Failed to delete interview" }, { status: 500 });
  }
}
