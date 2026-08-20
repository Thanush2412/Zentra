// Pin to Mumbai (bom1) — co-located with Turso DB (aws-ap-south-1)
export const preferredRegion = "bom1";
export const maxDuration = 60;

import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { seedDatabase } from "@/lib/seed";

let isDatabaseInitialized = false;

export async function GET(request: Request) {
  try {
    const db = await getDb();

    // Check if table structure exists only once on first boot
    if (!isDatabaseInitialized) {
      try {
        await db.get("SELECT COUNT(*) as count FROM admin_users");
        isDatabaseInitialized = true;
      } catch (_) {
        await seedDatabase();
        isDatabaseInitialized = true;
      }
    }

    const { searchParams } = new URL(request.url);
    const role = searchParams.get("role");
    const userId = searchParams.get("userId");
    const fields = searchParams.get("fields"); // e.g. "attendance" for surgical re-fetch

    let collegeId: string | null = null;
    if (role && userId && role !== "admin" && role !== "kam") {
      if (role === "cam") {
        const cam = await db.get("SELECT college_id FROM campus_managers WHERE id = ?", userId);
        collegeId = cam ? cam.college_id : null;
      } else if (role === "mentor") {
        const mentor = await db.get("SELECT college_id FROM mentors WHERE id = ?", userId);
        collegeId = mentor ? mentor.college_id : null;
      } else if (role === "student") {
        const student = await db.get("SELECT college_id FROM students WHERE id = ?", userId);
        collegeId = student ? student.college_id : null;
      }
    }

    // ── FAST PATH: attendance-only re-fetch (used after bulk import / mentor mark) ──
    if (fields === "attendance") {
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      const thresh = sixMonthsAgo.toISOString().slice(0, 10);

      let attSql: string;
      let attParams: any[];
      if (role === "student" && userId) {
        attSql = "SELECT id, studentId, slotId, dateStr, status, type, mode FROM student_attendance WHERE studentId = ? ORDER BY dateStr DESC LIMIT 1000";
        attParams = [userId];
      } else if (collegeId) {
        attSql = "SELECT id, studentId, slotId, dateStr, status, type, mode FROM student_attendance WHERE studentId IN (SELECT id FROM students WHERE college_id = ?) AND dateStr >= ? ORDER BY dateStr ASC";
        attParams = [collegeId, thresh];
      } else {
        attSql = "SELECT id, studentId, slotId, dateStr, status, type, mode FROM student_attendance WHERE dateStr >= ? ORDER BY dateStr ASC LIMIT 20000";
        attParams = [thresh];
      }
      const att = await db.all(attSql, ...attParams);
      return NextResponse.json({ success: true, studentAttendance: att });
    }

    // Build SQL queries with filtering at the DB level when collegeId is known
    const mentorSql = collegeId ? "SELECT * FROM mentors WHERE college_id = ?" : "SELECT * FROM mentors";
    const mentorParams = collegeId ? [collegeId] : [];

    const slotSql = collegeId ? "SELECT * FROM slots WHERE college_id = ?" : "SELECT * FROM slots";
    const slotParams = collegeId ? [collegeId] : [];

    const studentSql = collegeId ? "SELECT * FROM students WHERE college_id = ?" : "SELECT * FROM students";
    const studentParams = collegeId ? [collegeId] : [];

    const subjectSql = collegeId ? "SELECT * FROM subjects WHERE college_id = ? OR college_id IS NULL" : "SELECT * FROM subjects";
    const subjectParams = collegeId ? [collegeId] : [];

    const courseSql = collegeId ? "SELECT * FROM courses WHERE college_id = ? OR college_id IS NULL ORDER BY name" : "SELECT * FROM courses ORDER BY name";
    const courseParams = collegeId ? [collegeId] : [];

    const departmentSql = collegeId ? "SELECT * FROM departments WHERE college_id = ? OR college_id IS NULL ORDER BY name" : "SELECT * FROM departments ORDER BY name";
    const departmentParams = collegeId ? [collegeId] : [];

    const holidaySql = collegeId ? "SELECT * FROM holidays WHERE college_id = ? OR college_id IS NULL ORDER BY date" : "SELECT * FROM holidays ORDER BY date";
    const holidayParams = collegeId ? [collegeId] : [];

    const announcementSql = collegeId ? "SELECT * FROM announcements WHERE college_id = ? OR college_id IS NULL ORDER BY created_at DESC" : "SELECT * FROM announcements ORDER BY created_at DESC";
    const announcementParams = collegeId ? [collegeId] : [];

    // Fetch attendance with optimized range for CAM monitoring
    // For CAM: Load last 2 months instead of 6 to reduce payload (can always expand date range in UI)
    // For Students/Mentors: Load as before
    const twoMonthsAgo = new Date();
    twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);
    const camDateThreshold = twoMonthsAgo.toISOString().slice(0, 10);

    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const dateThreshold = sixMonthsAgo.toISOString().slice(0, 10);

    const attendanceSql = (role === "student" && userId)
      ? "SELECT id, studentId, slotId, dateStr, status, type, mode FROM student_attendance WHERE studentId = ? ORDER BY dateStr DESC LIMIT 1000"
      : collegeId
        ? "SELECT sa.id, sa.studentId, sa.slotId, sa.dateStr, sa.status, sa.type, sa.mode FROM student_attendance sa JOIN students st ON sa.studentId = st.id WHERE st.college_id = ? AND sa.dateStr >= ? ORDER BY sa.dateStr ASC"
        : "SELECT id, studentId, slotId, dateStr, status, type, mode FROM student_attendance WHERE dateStr >= ? ORDER BY dateStr ASC LIMIT 20000";
    const attendanceParams = (role === "student" && userId) 
      ? [userId] 
      : collegeId && (role === "cam")
        ? [collegeId, camDateThreshold]
        : collegeId 
          ? [collegeId, dateThreshold] 
          : [camDateThreshold];

    const isMentor = role === "mentor";
    const isStudent = role === "student";
    const isCAM = role === "cam";
    const isStudentOrMentor = isStudent || isMentor;
    const isAdminOrKAM = role === "admin" || role === "kam";

    const [
      mentors, slots, requests, approvedHandovers, auditLogs, subjects,
      courses, students, studentAttendance, leaveRequests, colleges,
      notifications, announcements, holidays, loginHistory, users,
      weeklyTasks, studentTracker, smes, demoSessions, subjectGroups, demoRules,
      signupRequests, demoSwapRequests, kamTasks, campusIssues, academicYears, academicEvents,
      studentInterviews,
      interviewEvaluations,
      approvals,
      leaveBalances,
      departmentsData
    ] = await Promise.all([
      db.all(mentorSql, ...mentorParams),
      db.all(slotSql, ...slotParams),
      (!isStudent && collegeId)
        ? db.all("SELECT * FROM handover_requests WHERE requestorId IN (SELECT id FROM mentors WHERE college_id = ?) OR targetStaffId IN (SELECT id FROM mentors WHERE college_id = ?) ORDER BY timestamp DESC LIMIT 100", collegeId, collegeId).catch(() => [])
        : (!isStudent ? db.all("SELECT * FROM handover_requests ORDER BY timestamp DESC LIMIT 100").catch(() => []) : Promise.resolve([])),
      !isStudent ? db.all("SELECT * FROM approved_handovers LIMIT 100").catch(() => []) : Promise.resolve([]),
      isAdminOrKAM || isCAM
        ? db.all("SELECT id, type, description, actorName, actorRole, timestamp, old_status, new_status, reason, changed_by FROM audit_logs ORDER BY timestamp DESC LIMIT 50").catch(() => [])
        : Promise.resolve([]),
      db.all(subjectSql, ...subjectParams),
      db.all(courseSql, ...courseParams),
      !isStudent
        ? db.all(studentSql, ...studentParams)
        : userId ? db.all("SELECT * FROM students WHERE id = ?", userId) : Promise.resolve([]),
      db.all(attendanceSql, ...attendanceParams),
      collegeId
        ? db.all("SELECT * FROM leave_requests WHERE studentId IN (SELECT id FROM students WHERE college_id = ?) ORDER BY timestamp DESC LIMIT 60", collegeId).catch(() => [])
        : db.all("SELECT * FROM leave_requests ORDER BY timestamp DESC LIMIT 60").catch(() => []),
      db.all("SELECT * FROM colleges"),
      userId && (isAdminOrKAM || isCAM)
        ? db.all("SELECT id, user_id, title, message, is_read, link, type, created_at FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 20", userId).catch(() => [])
        : Promise.resolve([]),
      db.all(announcementSql, ...announcementParams).catch(() => []),
      db.all(holidaySql, ...holidayParams).catch(() => []),
      role === "admin" ? db.all("SELECT id, user_id, login_time, logout_time, ip, device FROM login_history ORDER BY login_time DESC LIMIT 40").catch(() => []) : Promise.resolve([]),
      role === "admin" ? db.all("SELECT id, email, role, reference_id, status, plain_password, must_change_password, last_login, created_at, updated_at FROM users").catch(() => []) : Promise.resolve([]),
      collegeId
        ? db.all("SELECT * FROM weekly_tasks WHERE mentor_id IN (SELECT id FROM mentors WHERE college_id = ?) LIMIT 150", collegeId).catch(() => [])
        : db.all("SELECT * FROM weekly_tasks LIMIT 150").catch(() => []),
      collegeId
        ? db.all("SELECT * FROM student_tracker WHERE student_id IN (SELECT id FROM students WHERE college_id = ?) ORDER BY updated_at DESC LIMIT 150", collegeId).catch(() => [])
        : db.all("SELECT * FROM student_tracker ORDER BY updated_at DESC LIMIT 150").catch(() => []),
      isAdminOrKAM ? db.all("SELECT * FROM sme_users").catch(() => []) : Promise.resolve([]),
      isAdminOrKAM ? db.all("SELECT * FROM demo_sessions ORDER BY created_at DESC LIMIT 60").catch(() => []) : Promise.resolve([]),
      !isStudent ? db.all("SELECT * FROM subject_groups ORDER BY name ASC").catch(() => []) : Promise.resolve([]),
      isAdminOrKAM ? db.all("SELECT * FROM demo_rules ORDER BY created_at DESC").catch(() => []) : Promise.resolve([]),
      role === "admin" ? db.all("SELECT * FROM signup_requests ORDER BY created_at DESC LIMIT 50").catch(() => []) : Promise.resolve([]),
      isAdminOrKAM ? db.all("SELECT * FROM demo_swap_requests ORDER BY created_at DESC LIMIT 50").catch(() => []) : Promise.resolve([]),
      isAdminOrKAM ? db.all("SELECT * FROM kam_tasks ORDER BY created_at DESC LIMIT 60").catch(() => []) : Promise.resolve([]),
      isAdminOrKAM ? db.all("SELECT * FROM campus_issues ORDER BY created_at DESC LIMIT 60").catch(() => []) : Promise.resolve([]),
      !isStudent ? db.all("SELECT * FROM academic_years").catch(() => []) : Promise.resolve([]),
      isAdminOrKAM || isCAM ? db.all("SELECT * FROM academic_events ORDER BY date ASC").catch(() => []) : Promise.resolve([]),
      (!isStudent && collegeId)
        ? db.all("SELECT * FROM student_interviews WHERE origin_college_id = ? OR target_college_id = ? OR college_id = ? ORDER BY created_at DESC LIMIT 50", collegeId, collegeId, collegeId).catch(() => [])
        : (!isStudent ? db.all("SELECT * FROM student_interviews ORDER BY created_at DESC LIMIT 50").catch(() => []) : Promise.resolve([])),
      !isStudent ? db.all("SELECT * FROM interview_evaluations ORDER BY created_at DESC LIMIT 50").catch(() => []) : Promise.resolve([]),
      isAdminOrKAM ? db.all("SELECT * FROM approvals ORDER BY created_at DESC LIMIT 50").catch(() => []) : Promise.resolve([]),
      !isStudent ? db.all("SELECT * FROM leave_balances LIMIT 50").catch(() => []) : Promise.resolve([]),
      db.all(departmentSql, ...departmentParams).catch(() => [])
    ]);

    let filteredColleges = colleges;
    let filteredCourses = courses;
    let filteredMentors = mentors;
    let filteredSlots = slots;
    let filteredSubjects = subjects;
    let filteredStudents = students;
    let filteredStudentAttendance = studentAttendance;
    let filteredLeaveRequests = leaveRequests;
    let filteredRequests = requests;
    let filteredApprovedHandovers = approvedHandovers;
    let filteredHolidays = holidays;
    let filteredAnnouncements = announcements;
    let filteredWeeklyTasks = weeklyTasks;
    let filteredStudentTracker = studentTracker;

    if (collegeId) {
      const mentorIds = new Set(filteredMentors.map((m: any) => m.id));
      const studentIds = new Set(filteredStudents.map((s: any) => s.id));

      filteredStudentAttendance = studentAttendance.filter((sa: any) => studentIds.has(sa.studentId));
      filteredLeaveRequests = leaveRequests.filter((lr: any) => studentIds.has(lr.studentId));
      filteredWeeklyTasks = weeklyTasks.filter((t: any) => mentorIds.has(t.mentor_id));
      filteredStudentTracker = studentTracker.filter((e: any) => studentIds.has(e.student_id));
      filteredRequests = requests.filter((r: any) => mentorIds.has(r.requestorId) || mentorIds.has(r.targetStaffId));
      filteredApprovedHandovers = approvedHandovers.filter((h: any) => mentorIds.has(h.originalMentorId) || mentorIds.has(h.coverStaffId));
    }

    return NextResponse.json({
      success: true,
      mentors: filteredMentors.map((m) => ({
        id: m.id,
        name: m.name,
        email: m.email,
        role: "mentor",
        avatar: m.avatar,
        subjects: m.subjects,
        classes: m.classes,
        college_id: m.college_id,
        employee_id: m.employee_id,
        phone: m.phone,
        qualification: m.qualification,
        experience: m.experience,
        specialization: m.specialization,
        designation: m.designation,
        joining_date: m.joining_date,
        status: m.status,
        last_login: m.last_login,
        created_at: m.created_at,
        updated_at: m.updated_at,
        mentor_group: m.mentor_group || null
      })),
      slots: filteredSlots,
      requests: filteredRequests,
      approvedHandovers: filteredApprovedHandovers,
      auditLogs,
      subjects: filteredSubjects,
      departments: filteredCourses,
      courses: filteredCourses,
      students: filteredStudents,
      studentAttendance: filteredStudentAttendance,
      leaveRequests: filteredLeaveRequests,
      colleges: filteredColleges,
      notifications,
      announcements: filteredAnnouncements,
      holidays: filteredHolidays,
      loginHistory,
      users,
      weeklyTasks: filteredWeeklyTasks,
      studentTracker: filteredStudentTracker,
      smes,
      demoSessions,
      subjectGroups,
      demoRules,
      signupRequests,
      demoSwapRequests,
      kamTasks,
      campusIssues,
      academicYears: academicYears.map((ay: any) => typeof ay === "string" ? ay : ay.year || ay.year_name || ay.name || String(ay)),
      academicEvents,
      interviews: studentInterviews || [],
      interviewEvaluations: interviewEvaluations || [],
      approvals: approvals || [],
      leaveBalances: leaveBalances || []
    }, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate"
      }
    });
  } catch (error: any) {
    console.error("API GET Data error:", error);
    // On network timeout or connection reset, return safe structured fallback to prevent frontend crashes
    return NextResponse.json({
      success: true,
      isFallback: true,
      error: error.message,
      mentors: [],
      slots: [],
      requests: [],
      approvedHandovers: [],
      auditLogs: [],
      subjects: [],
      departments: [],
      courses: [],
      students: [],
      studentAttendance: [],
      leaveRequests: [],
      colleges: [],
      notifications: [],
      announcements: [],
      holidays: [],
      loginHistory: [],
      users: [],
      weeklyTasks: [],
      studentTracker: [],
      smes: [],
      demoSessions: [],
      subjectGroups: [],
      demoRules: [],
      demoSwapRequests: [],
      signupRequests: [],
      kamTasks: [],
      campusIssues: [],
      academicYears: [],
      academicEvents: []
    });
  }
}

export async function POST(request: Request) {
  try {
    const db = await getDb();
    const body = await request.json();

    if (body.action === "reset") {
      await seedDatabase();
      return NextResponse.json({ success: true, message: "Database successfully reset." });
    }

    if (body.action === "clear") {
      if (body.confirm !== "DELETE") {
        return NextResponse.json({ success: false, message: "Missing or invalid database clear confirmation." }, { status: 400 });
      }
      await db.run("DELETE FROM student_attendance");
      await db.run("DELETE FROM students");
      await db.run("DELETE FROM leave_requests");
      await db.run("DELETE FROM audit_logs");
      await db.run("DELETE FROM approved_handovers");
      await db.run("DELETE FROM handover_requests");
      await db.run("DELETE FROM slots");
      await db.run("DELETE FROM mentors");
      await db.run("DELETE FROM subjects");
      await db.run("DELETE FROM campus_managers");
      await db.run("DELETE FROM colleges");
      await db.run("DELETE FROM kam_users");
      await db.run("DELETE FROM courses");
      await db.run("DELETE FROM login_history");
      await db.run("DELETE FROM holidays");
      await db.run("DELETE FROM announcements");
      await db.run("DELETE FROM notifications");
      await db.run("DELETE FROM users");
      await db.run("DELETE FROM weekly_tasks");
      await db.run("DELETE FROM student_tracker");
      await db.run("DELETE FROM fee_payments");
      await db.run("DELETE FROM student_fees");
      await db.run("DELETE FROM sme_users");
      await db.run("DELETE FROM demo_sessions");
      await db.run("DELETE FROM demo_swap_requests");
      await db.run("DELETE FROM demo_rules");
      await db.run("DELETE FROM subject_groups");
      await db.run("DELETE FROM campus_daily_configs");
      await db.run("DELETE FROM signup_requests");
      await db.run("DELETE FROM faculty_configs");
      await db.run("DELETE FROM kam_tasks");
      await db.run("DELETE FROM campus_issues");
      await db.run("DELETE FROM academic_years");
      await db.run("DELETE FROM academic_events");
      await db.run("DELETE FROM feedback_reports");
      await db.run("DELETE FROM campus_drafts");
      
      // Ensure admin exists
      await db.run("DELETE FROM admin_users");
      await db.run("INSERT INTO admin_users (id, name, email) VALUES ('admin_1', 'System Admin', 'admin@university.edu')");
      await db.run(
        "INSERT INTO users (id, email, password_hash, role, reference_id, created_at, updated_at) VALUES ('admin_1', 'admin@university.edu', 'password123', 'admin', 'admin_1', ?, ?)",
        [new Date().toISOString(), new Date().toISOString()]
      );

      return NextResponse.json({ success: true, message: "Database successfully cleared. Super Admin remains." });
    }

    return NextResponse.json({ success: false, message: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    console.error("API POST Data error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
