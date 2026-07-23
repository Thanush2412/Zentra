import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { seedDatabase } from "@/lib/seed";

export async function GET(request: Request) {
  try {
    const db = await getDb();

    // Check if table structure exists by querying admin_users; if not, initialize database.
    try {
      await db.get("SELECT COUNT(*) as count FROM admin_users");
    } catch (_) {
      // Table doesn't exist, run seed database to initialize structure
      await seedDatabase();
    }

    const { searchParams } = new URL(request.url);
    const role = searchParams.get("role");
    const userId = searchParams.get("userId");

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

    const [
      mentors, slots, requests, approvedHandovers, auditLogs, subjects,
      courses, students, studentAttendance, leaveRequests, colleges,
      notifications, announcements, holidays, loginHistory, users,
      weeklyTasks, studentTracker, smes, demoSessions, subjectGroups, demoRules,
      signupRequests, demoSwapRequests, kamTasks, campusIssues, academicYears, academicEvents
    ] = await Promise.all([
      db.all("SELECT * FROM mentors"),
      db.all("SELECT * FROM slots"),
      db.all("SELECT * FROM handover_requests ORDER BY timestamp DESC"),
      db.all("SELECT * FROM approved_handovers"),
      db.all("SELECT * FROM audit_logs ORDER BY timestamp DESC"),
      db.all("SELECT * FROM subjects"),
      db.all("SELECT * FROM courses ORDER BY name"),
      db.all("SELECT * FROM students"),
      db.all("SELECT * FROM student_attendance"),
      db.all("SELECT * FROM leave_requests ORDER BY timestamp DESC"),
      db.all("SELECT * FROM colleges"),
      db.all("SELECT * FROM notifications ORDER BY created_at DESC"),
      db.all("SELECT * FROM announcements ORDER BY created_at DESC"),
      db.all("SELECT * FROM holidays ORDER BY date"),
      db.all("SELECT * FROM login_history ORDER BY login_time DESC"),
      db.all("SELECT * FROM users"),
      db.all("SELECT * FROM weekly_tasks"),
      db.all("SELECT * FROM student_tracker"),
      db.all("SELECT * FROM sme_users"),
      db.all("SELECT * FROM demo_sessions ORDER BY created_at DESC"),
      db.all("SELECT * FROM subject_groups ORDER BY name ASC"),
      db.all("SELECT * FROM demo_rules ORDER BY created_at DESC"),
      db.all("SELECT * FROM signup_requests ORDER BY created_at DESC"),
      db.all("SELECT * FROM demo_swap_requests ORDER BY created_at DESC").catch(() => []),
      db.all("SELECT * FROM kam_tasks ORDER BY created_at DESC").catch(() => []),
      db.all("SELECT * FROM campus_issues ORDER BY created_at DESC").catch(() => []),
      db.all("SELECT * FROM academic_years").catch(() => []),
      db.all("SELECT * FROM academic_events ORDER BY start_date ASC").catch(() => [])
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
      filteredColleges = colleges;
      filteredCourses = courses.filter((c: any) => c.college_id === collegeId || !c.college_id);
      filteredMentors = mentors.filter((m: any) => m.college_id === collegeId);
      filteredSlots = slots.filter((s: any) => s.college_id === collegeId);
      filteredSubjects = subjects.filter((s: any) => s.college_id === collegeId || !s.college_id);
      filteredStudents = students.filter((s: any) => s.college_id === collegeId);
      
      const studentIds = new Set(filteredStudents.map((s: any) => s.id));
      filteredStudentAttendance = studentAttendance.filter((sa: any) => studentIds.has(sa.studentId || sa.student_id));
      filteredLeaveRequests = leaveRequests.filter((lr: any) => studentIds.has(lr.studentId || lr.student_id));
      
      // Ensure all weekly tasks and tracker entries are preserved across class groups
      filteredWeeklyTasks = weeklyTasks;
      filteredStudentTracker = studentTracker;

      const mentorIds = new Set(filteredMentors.map((m: any) => m.id));
      filteredRequests = requests.filter((r: any) => mentorIds.has(r.requestorId) || mentorIds.has(r.targetStaffId));
      filteredApprovedHandovers = approvedHandovers.filter((h: any) => mentorIds.has(h.originalMentorId) || mentorIds.has(h.coverStaffId));

      filteredHolidays = holidays.filter((h: any) => h.college_id === collegeId || !h.college_id);
      filteredAnnouncements = announcements.filter((a: any) => a.college_id === collegeId || !a.college_id);
    }

    return NextResponse.json({
      success: true,
      mentors: filteredMentors.map((m) => ({
        id: m.id,
        name: m.name,
        email: m.email,
        role: "mentor",
        department: m.department,
        avatar: m.avatar,
        subjects: m.subjects,
        classes: m.classes,
        shift: m.shift,
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
        subject_group: m.subject_group
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
      academicEvents
    }, {
      headers: {
        "Cache-Control": "private, max-age=3, stale-while-revalidate=15"
      }
    });
  } catch (error: any) {
    console.error("API GET Data error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
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
