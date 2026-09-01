// Pin to Mumbai (bom1) — co-located with Turso DB (aws-ap-south-1)
export const preferredRegion = "bom1";
export const maxDuration = 60;

import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { hashPassword } from "@/lib/auth";

export async function PUT(request: Request) {
  try {
    const db = await getDb();
    const body = await request.json();
    const {
      id,
      name,
      email,
      department,
      classGroup,
      section,
      college_id,
      register_number,
      roll_number,
      hire_score,
      efset_score,
      mother_name,
      father_name,
      pan_number,
      tenth_mark,
      eleventh_mark,
      twelfth_mark,
      academic_group,
      medium,
      blood_group,
      dob,
      phone,
      parent_phone,
      aadhar_number,
      linkedin_link,
      github_id,
      project_drive_link,
      hackerrank_link,
      leetcode_link,
      figma_link
    } = body;

    if (!id || !name || !name.trim()) {
      return NextResponse.json({ success: false, message: "Student ID and Name are required." }, { status: 400 });
    }

    // Check if student exists
    const currentStudent = await db.get("SELECT * FROM students WHERE id = ?", id);
    if (!currentStudent) {
      return NextResponse.json({ success: false, message: "Student not found." }, { status: 404 });
    }

    const currentShift = body.shift || currentStudent.shift || (classGroup?.includes("Shift 2") ? "Shift 2" : classGroup?.includes("Shift 1") ? "Shift 1" : "General");
    const currentSem = body.semester || currentStudent.semester || "Semester 1";

    // Update students table
    await db.run(
      `UPDATE students SET 
        name = ?, 
        email = ?, 
        department = ?, 
        classGroup = ?, 
        section = ?,
        college_id = ?, 
        register_number = ?, 
        roll_number = ?, 
        semester = ?,
        shift = ?,
        hire_score = ?,
        efset_score = ?,
        mother_name = ?,
        father_name = ?,
        pan_number = ?,
        tenth_mark = ?, 
        eleventh_mark = ?, 
        twelfth_mark = ?, 
        academic_group = ?, 
        medium = ?, 
        blood_group = ?, 
        dob = ?, 
        phone = ?, 
        parent_phone = ?, 
        aadhar_number = ?, 
        linkedin_link = ?, 
        github_id = ?, 
        project_drive_link = ?, 
        hackerrank_link = ?, 
        leetcode_link = ?, 
        figma_link = ?,
        updated_at = ?
      WHERE id = ?`,
      name.trim(),
      email ? email.trim() : "",
      department ? department.trim() : "",
      classGroup ? classGroup.trim() : "",
      section ? section.trim() : null,
      college_id || currentStudent.college_id || null,
      register_number || null,
      roll_number || null,
      currentSem,
      currentShift,
      hire_score || null,
      efset_score || null,
      mother_name || null,
      father_name || null,
      pan_number || null,
      tenth_mark || null,
      eleventh_mark || null,
      twelfth_mark || null,
      academic_group || null,
      medium || null,
      blood_group || null,
      dob || null,
      phone || null,
      parent_phone || null,
      aadhar_number || null,
      linkedin_link || null,
      github_id || null,
      project_drive_link || null,
      hackerrank_link || null,
      leetcode_link || null,
      figma_link || null,
      new Date().toISOString(),
      id
    );

    return NextResponse.json({ success: true, message: "Student updated successfully." });
  } catch (error: any) {
    console.error("API PUT Students error:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const db = await getDb();
    const body = await request.json();

    const students = Array.isArray(body) ? body : [body];
    const nowStr = new Date().toISOString();

    // Normalize all student records first
    const normalizedStudents: any[] = [];
    for (const student of students) {
      const {
        id: rawId, name, email, classGroup, section, department, college_id,
        register_number, roll_number, hire_score, efset_score,
        mother_name, father_name, pan_number, tenth_mark, eleventh_mark, twelfth_mark,
        academic_group, medium, blood_group, dob, phone, parent_phone, aadhar_number,
        linkedin_link, github_id, project_drive_link, hackerrank_link, leetcode_link,
        figma_link, semester, shift
      } = student;

      const stName = (name || "").toString().trim();
      if (!stName) continue;

      let stId = (rawId || roll_number || register_number || (email ? email.split("@")[0] : "")).toString().trim();
      if (!stId) stId = "STU_" + Date.now() + "_" + Math.floor(Math.random() * 10000);

      const stEmail = (email || `${stId.toLowerCase()}@university.edu`).toString().trim();
      const emailPrefix = stEmail.split("@")[0].toLowerCase();
      let stRoll = roll_number ? String(roll_number).trim() : "";
      if (stRoll.toLowerCase() === emailPrefix) stRoll = "";
      let stReg = register_number ? String(register_number).trim() : "";
      if (stReg.toLowerCase() === emailPrefix) stReg = "";
      if (!stReg && stRoll) stReg = stRoll;
      if (!stRoll && stReg) stRoll = stReg;

      normalizedStudents.push({
        stId, stName, stEmail, stReg, stRoll,
        classGroup: classGroup || "General Class",
        section: section || null,
        department: department || "General",
        college_id: college_id || null,
        semester: semester || "Semester 1",
        shift: shift || "General",
        hire_score: hire_score ? hire_score.toString() : null,
        efset_score: efset_score ? efset_score.toString() : null,
        mother_name: mother_name ? mother_name.toString() : null,
        father_name: father_name ? father_name.toString() : null,
        pan_number: pan_number ? pan_number.toString() : null,
        tenth_mark: tenth_mark ? tenth_mark.toString() : null,
        eleventh_mark: eleventh_mark ? eleventh_mark.toString() : null,
        twelfth_mark: twelfth_mark ? twelfth_mark.toString() : null,
        academic_group: academic_group ? academic_group.toString() : null,
        medium: medium ? medium.toString() : null,
        blood_group: blood_group ? blood_group.toString() : null,
        dob: dob ? dob.toString() : null,
        phone: phone ? phone.toString() : null,
        parent_phone: parent_phone ? parent_phone.toString() : null,
        aadhar_number: aadhar_number ? aadhar_number.toString() : null,
        linkedin_link: linkedin_link ? linkedin_link.toString() : null,
        github_id: github_id ? github_id.toString() : null,
        project_drive_link: project_drive_link ? project_drive_link.toString() : null,
        hackerrank_link: hackerrank_link ? hackerrank_link.toString() : null,
        leetcode_link: leetcode_link ? leetcode_link.toString() : null,
        figma_link: figma_link ? figma_link.toString() : null,
      });
    }

    if (normalizedStudents.length === 0) {
      return NextResponse.json({ success: true, message: "No valid students to create." });
    }

    // ── Batched write: chunk at 30 students to stay under SQLite param limits ──
    // 30 students × 36 params = 1080 per chunk (safe under 32766 limit)
    const CHUNK = 30;
    const batchStatements: { sql: string; args: any[] }[] = [];
    // Hash the default password once per batch (not per student, for performance)
    const defaultPasswordHash = hashPassword("password123");

    for (let i = 0; i < normalizedStudents.length; i += CHUNK) {
      const chunk = normalizedStudents.slice(i, i + CHUNK);

      // Students INSERT — 36 params per row (hashed password)
      const stPlaceholders = chunk.map(() =>
        "(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Active', ?, ?, ?)"
      ).join(", ");
      const stArgs: any[] = [];
      chunk.forEach(s => {
        stArgs.push(
          s.stId, s.stName, s.stEmail, s.classGroup, s.section, s.department, s.college_id,
          s.stReg, s.stRoll, s.semester, s.shift,
          s.hire_score, s.efset_score, s.mother_name, s.father_name, s.pan_number,
          s.tenth_mark, s.eleventh_mark, s.twelfth_mark, s.academic_group,
          s.medium, s.blood_group, s.dob, s.phone, s.parent_phone, s.aadhar_number,
          s.linkedin_link, s.github_id, s.project_drive_link, s.hackerrank_link,
          s.leetcode_link, s.figma_link,
          defaultPasswordHash, nowStr, nowStr
        );
      });
      batchStatements.push({
        sql: `INSERT OR REPLACE INTO students (
          id, name, email, classGroup, section, department, college_id,
          register_number, roll_number, semester, shift,
          hire_score, efset_score, mother_name, father_name, pan_number,
          tenth_mark, eleventh_mark, twelfth_mark, academic_group,
          medium, blood_group, dob, phone, parent_phone, aadhar_number,
          linkedin_link, github_id, project_drive_link, hackerrank_link,
          leetcode_link, figma_link,
          status, password_hash, created_at, updated_at
        ) VALUES ${stPlaceholders}`,
        args: stArgs
      });

      // Users INSERT — 5 params per row (hashed password)
      const uPlaceholders = chunk.map(() => "(?, ?, ?, 'student', ?, ?, ?)").join(", ");
      const uArgs: any[] = [];
      chunk.forEach(s => { uArgs.push(s.stId, s.stEmail, defaultPasswordHash, s.stId, nowStr, nowStr); });
      batchStatements.push({
        sql: `INSERT OR REPLACE INTO users (id, email, password_hash, role, reference_id, created_at, updated_at)
              VALUES ${uPlaceholders}`,
        args: uArgs
      });
    }

    // Execute all inserts as a single atomic batch
    await db.client.batch(batchStatements, "write");

    return NextResponse.json({ success: true, message: `${normalizedStudents.length} students created successfully.` });
  } catch (error: any) {
    console.error("API POST Students error:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const db = await getDb();
    const { searchParams } = new URL(request.url);
    let ids: string[] = [];

    const singleId = searchParams.get("id");
    if (singleId) {
      ids = [singleId];
    } else {
      try {
        const body = await request.json();
        if (body.ids && Array.isArray(body.ids)) {
          ids = body.ids;
        } else if (body.id) {
          ids = [body.id];
        }
      } catch (e) {
        // No json body
      }
    }

    if (!ids || ids.length === 0) {
      return NextResponse.json({ success: false, message: "No student ID(s) provided for deletion." }, { status: 400 });
    }

    const cleanIds = ids.map(id => String(id).trim()).filter(Boolean);
    if (cleanIds.length === 0) {
      return NextResponse.json({ success: false, message: "Invalid student ID(s)." }, { status: 400 });
    }

    const placeholders = cleanIds.map(() => "?").join(",");

    // Atomic batch delete — all 5 deletes succeed together or all rollback (no orphaned rows)
    await db.client.batch([
      {
        sql: `DELETE FROM students WHERE id IN (${placeholders})`,
        args: cleanIds
      },
      {
        sql: `DELETE FROM users WHERE role = 'student' AND (id IN (${placeholders}) OR reference_id IN (${placeholders}))`,
        args: [...cleanIds, ...cleanIds]
      },
      {
        sql: `DELETE FROM student_attendance WHERE studentId IN (${placeholders})`,
        args: cleanIds
      },
      {
        sql: `DELETE FROM leave_requests WHERE studentId IN (${placeholders})`,
        args: cleanIds
      },
      {
        sql: `DELETE FROM student_tracker WHERE student_id IN (${placeholders})`,
        args: cleanIds
      }
    ], "write");

    return NextResponse.json({
      success: true,
      message: `${cleanIds.length} student record(s) deleted successfully.`,
      count: cleanIds.length
    });
  } catch (error: any) {
    console.error("API DELETE Students error:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

