import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

// Helper to generate slugs for IDs
function getSlug(text: string, collegeId?: string): string {
  const clean = text.toLowerCase().replace(/[^a-z0-9]/g, "_").replace(/_+/g, "_").replace(/(^_+|_+$)/g, "");
  return collegeId ? `dept_${collegeId.replace(/[^a-z0-9]/gi, "_")}_${clean}` : `dept_${clean}`;
}

export async function POST(request: Request) {
  try {
    const db = await getDb();
    const body = await request.json();
    const { name, college_id, code, description, established_year, status, years, start_date, end_date, start_year, end_year, default_room, default_shift, shift_based } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ success: false, message: "Course name is required" }, { status: 400 });
    }

    const cleanName = name.trim();
    const targetCollegeId = college_id || null;

    // Check uniqueness scoped to college
    let existing;
    if (targetCollegeId) {
      existing = await db.get("SELECT * FROM courses WHERE LOWER(TRIM(name)) = LOWER(TRIM(?)) AND (college_id = ? OR college_id IS NULL)", cleanName, targetCollegeId);
    } else {
      existing = await db.get("SELECT * FROM courses WHERE LOWER(TRIM(name)) = LOWER(TRIM(?)) AND college_id IS NULL", cleanName);
    }

    if (existing) {
      // Gracefully ensure it is assigned to this college and active
      await db.run(
        "UPDATE courses SET college_id = ?, code = COALESCE(NULLIF(?, ''), code), description = COALESCE(NULLIF(?, ''), description), default_shift = COALESCE(NULLIF(?, ''), default_shift), shift_based = ? WHERE id = ?",
        targetCollegeId || existing.college_id || "college_1",
        code || "",
        description || "",
        default_shift || null,
        shift_based === undefined ? (existing.shift_based || 0) : Number(shift_based),
        existing.id
      );

      try {
        await db.run(
          "INSERT OR REPLACE INTO departments (id, name, college_id, code, description) VALUES (?, ?, ?, ?, ?)",
          existing.id, cleanName, targetCollegeId || "college_1", code || existing.code || "", description || existing.description || ""
        );
      } catch (_) {}

      return NextResponse.json({
        success: true,
        message: "Department registered successfully.",
        course: {
          ...existing,
          name: cleanName,
          college_id: targetCollegeId || existing.college_id || "college_1",
          code: code || existing.code || "",
          description: description || existing.description || "",
          default_shift: default_shift || existing.default_shift || null,
          shift_based: shift_based === undefined ? (existing.shift_based || 0) : Number(shift_based)
        }
      });
    }

    let id = getSlug(cleanName, targetCollegeId || undefined);

    // Ensure ID uniqueness just in case
    const existingId = await db.get("SELECT * FROM courses WHERE id = ?", id);
    if (existingId) {
      id = `${id}_${Date.now().toString(36)}`;
    }

    await db.run(
      "INSERT INTO courses (id, name, college_id, code, description, hod_name, established_year, status, years, start_date, end_date, start_year, end_year, default_room, default_shift, shift_based) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      id,
      cleanName,
      targetCollegeId || "college_1",
      code || "",
      description || "",
      "",
      established_year || "",
      status || "Active",
      years !== undefined ? Number(years) : 4,
      start_date || "",
      end_date || "",
      start_year || "",
      end_year || "",
      default_room || null,
      default_shift || null,
      shift_based === undefined ? 0 : Number(shift_based)
    );

    try {
      await db.run(
        "INSERT OR REPLACE INTO departments (id, name, college_id, code, description) VALUES (?, ?, ?, ?, ?)",
        id, cleanName, targetCollegeId || "college_1", code || "", description || ""
      );
    } catch (_) {}

    return NextResponse.json({
      success: true,
      message: "Course created successfully.",
      course: {
        id,
        name: cleanName,
        college_id: targetCollegeId || "college_1",
        code: code || "",
        description: description || "",
        established_year: established_year || "",
        status: status || "Active",
        years: years !== undefined ? Number(years) : 4,
        start_date: start_date || "",
        end_date: end_date || "",
        start_year: start_year || "",
        end_year: end_year || "",
        default_room: default_room || null,
        default_shift: default_shift || null,
        shift_based: shift_based === undefined ? 0 : Number(shift_based)
      }
    });
  } catch (error: any) {
    console.error("API POST Courses error:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const db = await getDb();
    const body = await request.json();
    const { id, name, college_id, code, description, established_year, status, years, start_date, end_date, start_year, end_year, default_room, default_shift, shift_based } = body;

    if (!id || !name || !name.trim()) {
      return NextResponse.json({ success: false, message: "ID and name are required." }, { status: 400 });
    }

    const cleanName = name.trim();

    // Find the current course details
    const currentCourse = await db.get("SELECT * FROM courses WHERE id = ?", id);
    if (!currentCourse) {
      return NextResponse.json({ success: false, message: "Course not found." }, { status: 404 });
    }

    const targetCollegeId = college_id || currentCourse.college_id;

    // Check name uniqueness among other courses in the same college
    let duplicate;
    if (targetCollegeId) {
      duplicate = await db.get("SELECT * FROM courses WHERE LOWER(name) = LOWER(?) AND id != ? AND college_id = ?", cleanName, id, targetCollegeId);
    } else {
      duplicate = await db.get("SELECT * FROM courses WHERE LOWER(name) = LOWER(?) AND id != ? AND college_id IS NULL", cleanName, id);
    }
    if (duplicate) {
      return NextResponse.json({ success: false, message: `Another course named "${cleanName}" already exists for this campus.` }, { status: 400 });
    }

    const oldName = currentCourse.name;

    // Run cascade updates for course rename
    // 1. Rename course in master list
    await db.run(
      "UPDATE courses SET name = ?, college_id = ?, code = ?, description = ?, hod_name = ?, established_year = ?, status = ?, years = ?, start_date = ?, end_date = ?, start_year = ?, end_year = ?, default_room = ?, default_shift = ?, shift_based = ? WHERE id = ?",
      cleanName,
      college_id || currentCourse.college_id,
      code || "",
      description || "",
      "",
      established_year || "",
      status || "Active",
      years !== undefined ? Number(years) : 4,
      start_date || "",
      end_date || "",
      start_year || "",
      end_year || "",
      default_room || null,
      default_shift || null,
      shift_based === undefined ? (currentCourse.shift_based || 0) : Number(shift_based),
      id
    );

    // 2. Cascade rename to mentors table
    await db.run("UPDATE mentors SET department = ? WHERE department = ?", cleanName, oldName);

    // 3. Cascade rename to subjects table
    await db.run("UPDATE subjects SET department = ? WHERE department = ?", cleanName, oldName);

    // 4. Cascade rename to slots table (Bug #24 fix)
    await db.run("UPDATE slots SET department = ? WHERE department = ?", cleanName, oldName);

    // 5. Cascade rename to handover_requests.classGroup where it contains the old department (Bug #26 fix)
    // classGroup format: "<CourseName> - SEM X" — update if starts with old name
    await db.run(
      "UPDATE handover_requests SET classGroup = REPLACE(classGroup, ?, ?) WHERE classGroup LIKE ?",
      oldName, cleanName, `${oldName}%`
    );

    // 6. Cascade rename in students table department field
    await db.run("UPDATE students SET department = ? WHERE department = ?", cleanName, oldName);

    return NextResponse.json({ success: true, message: "Course updated and cascaded successfully." });
  } catch (error: any) {
    console.error("API PUT Courses error:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

function getBaseDeptName(name: string): string {
  if (!name) return "";
  let cleaned = name.replace(/\s*-\s*(Semester|Sem|Year|Yr|Shift|Batch)\s*\d+/gi, "");
  cleaned = cleaned.replace(/\s*(Semester|Sem|Year|Yr|Shift|Batch)\s*\d+/gi, "");
  return cleaned.trim();
}

function isDeptMatch(name: string, targetName: string, targetId: string): boolean {
  if (!name || !targetName) return false;
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  
  const baseDept = normalize(getBaseDeptName(name));
  const nTargetName = normalize(targetName);
  const nTargetId = normalize(targetId.replace(/^dept_/, ""));

  return baseDept === nTargetName || baseDept === nTargetId;
}

export async function DELETE(request: Request) {
  try {
    const db = await getDb();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ success: false, message: "Missing course id." }, { status: 400 });
    }

    let course = await db.get("SELECT * FROM courses WHERE id = ? OR name = ?", id, id);
    if (!course) {
      course = await db.get("SELECT * FROM departments WHERE id = ? OR name = ?", id, id);
    }
    const courseName = course ? course.name : id;
    const courseId = course ? course.id : id;
    const isMatch = (deptOrGroup: string) => {
      return isDeptMatch(deptOrGroup || "", courseName, id);
    };

    // 1. Delete slots for this department/classGroup and cascade to student_attendance, handover records
      const allSlots = await db.all("SELECT id, department, classGroup FROM slots");
      const slotsToDelete = allSlots.filter(s => isMatch(s.department) || isMatch(s.classGroup));
      const slotIds = slotsToDelete.map(s => s.id);
      
      if (slotIds.length > 0) {
        const placeholders = slotIds.map(() => "?").join(",");
        await db.run(`DELETE FROM student_attendance WHERE slotId IN (${placeholders})`, ...slotIds);
        await db.run(`DELETE FROM handover_requests WHERE slotId IN (${placeholders})`, ...slotIds);
        await db.run(`DELETE FROM approved_handovers WHERE slotId IN (${placeholders})`, ...slotIds);
        await db.run(`DELETE FROM slots WHERE id IN (${placeholders})`, ...slotIds);
      }

      // Also delete handover_requests where classGroup matches this course (Bug #26 fix)
      // classGroup format: "<CourseName> - SEM X"
      const allHandovers = await db.all("SELECT id, classGroup FROM handover_requests");
      const handoverIdsToDelete = allHandovers
        .filter(h => h.classGroup && isMatch(h.classGroup))
        .map(h => h.id);
      if (handoverIdsToDelete.length > 0) {
        const placeholders = handoverIdsToDelete.map(() => "?").join(",");
        await db.run(`DELETE FROM handover_requests WHERE id IN (${placeholders})`, ...handoverIdsToDelete);
      }
      
      // 2. Find student IDs in this department to clean up their records
      const allStudents = await db.all("SELECT id, department, classGroup FROM students");
      const studentsToDelete = allStudents.filter(s =>
        isMatch(s.department) ||
        isMatch(s.classGroup) ||
        // Additional check: classGroup starts with course name (e.g. "B.Sc. CS AI - SEM I" matches "B.Sc. CS AI")
        (s.classGroup && s.classGroup.toLowerCase().startsWith(courseName.toLowerCase()))
      );
      const studentIds = studentsToDelete.map(s => s.id);
      
      if (studentIds.length > 0) {
        const placeholders = studentIds.map(() => "?").join(",");
        await db.run(`DELETE FROM student_attendance WHERE studentId IN (${placeholders})`, ...studentIds);
        // Bug #27 fix: clean up leave_requests for deleted students
        await db.run(`DELETE FROM leave_requests WHERE studentId IN (${placeholders})`, ...studentIds);
        await db.run(`DELETE FROM students WHERE id IN (${placeholders})`, ...studentIds);
        await db.run(`DELETE FROM users WHERE role = 'student' AND reference_id IN (${placeholders})`, ...studentIds);
      }

      // 3. Delete mentors in this department and their user accounts
      const allMentors = await db.all("SELECT id, department FROM mentors");
      const mentorsToDelete = allMentors.filter(m => m.department && isMatch(m.department));
      const mentorIds = mentorsToDelete.map(m => m.id);
      if (mentorIds.length > 0) {
        const placeholders = mentorIds.map(() => "?").join(",");
        await db.run(`DELETE FROM mentors WHERE id IN (${placeholders})`, ...mentorIds);
        await db.run(`DELETE FROM users WHERE role = 'mentor' AND reference_id IN (${placeholders})`, ...mentorIds);
      }

      // 4. Delete subjects associated with this department
      const allSubjects = await db.all("SELECT id, department FROM subjects");
      const subjectsToDelete = allSubjects.filter(s => s.department && isMatch(s.department));
      const subjectIds = subjectsToDelete.map(s => s.id);
      if (subjectIds.length > 0) {
        const placeholders = subjectIds.map(() => "?").join(",");
        await db.run(`DELETE FROM subjects WHERE id IN (${placeholders})`, ...subjectIds);
      }

      // 5. Finally delete the course and matching departments table rows
      await db.run("DELETE FROM courses WHERE id = ?", id);
      await db.run("DELETE FROM departments WHERE id = ? OR name = ?", id, courseName);

      const deletedSummary = `Deleted: ${slotsToDelete.length} slots, ${studentsToDelete.length} students, ${mentorsToDelete.length} mentors, ${subjectsToDelete.length} subjects.`;
      return NextResponse.json({ success: true, message: `Course and all associated data deleted successfully. ${deletedSummary}`, deletedCounts: { slots: slotsToDelete.length, students: studentsToDelete.length, mentors: mentorsToDelete.length, subjects: subjectsToDelete.length } });
  } catch (error: any) {
    console.error("API DELETE Courses error:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
