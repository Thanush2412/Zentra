import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

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
      college_id,
      register_number,
      roll_number,
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

    // Update students table
    await db.run(
      `UPDATE students SET 
        name = ?, 
        email = ?, 
        department = ?, 
        classGroup = ?, 
        college_id = ?, 
        register_number = ?, 
        roll_number = ?, 
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
      college_id || "college_1",
      register_number || null,
      roll_number || null,
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
    
    for (const student of students) {
      const {
        id: rawId,
        name,
        email,
        classGroup,
        department,
        college_id,
        register_number,
        roll_number,
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
        figma_link,
        semester,
        shift
      } = student;
      
      const stId = (rawId || roll_number || register_number || "").toString().trim();
      const stName = (name || "").toString().trim();
      
      if (!stId || !stName) {
        continue;
      }

      const stEmail = (email || `${stId.toLowerCase()}@university.edu`).toString().trim();
      const stRoll = (roll_number || stId).toString().trim();
      const stReg = (register_number || stId).toString().trim();
      
      await db.run(
        `INSERT OR REPLACE INTO students (
          id, name, email, classGroup, department, college_id, 
          register_number, roll_number, semester, shift,
          tenth_mark, eleventh_mark, twelfth_mark, academic_group,
          medium, blood_group, dob, phone, parent_phone, aadhar_number,
          linkedin_link, github_id, project_drive_link, hackerrank_link,
          leetcode_link, figma_link,
          status, password_hash, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Active', 'password123', ?, ?)`,
        [
          stId,
          stName,
          stEmail,
          classGroup || "General Class",
          department || "General",
          college_id || "college_1",
          stReg,
          stRoll,
          semester || "Semester 1",
          shift || "General",
          tenth_mark ? tenth_mark.toString() : null,
          eleventh_mark ? eleventh_mark.toString() : null,
          twelfth_mark ? twelfth_mark.toString() : null,
          academic_group ? academic_group.toString() : null,
          medium ? medium.toString() : null,
          blood_group ? blood_group.toString() : null,
          dob ? dob.toString() : null,
          phone ? phone.toString() : null,
          parent_phone ? parent_phone.toString() : null,
          aadhar_number ? aadhar_number.toString() : null,
          linkedin_link ? linkedin_link.toString() : null,
          github_id ? github_id.toString() : null,
          project_drive_link ? project_drive_link.toString() : null,
          hackerrank_link ? hackerrank_link.toString() : null,
          leetcode_link ? leetcode_link.toString() : null,
          figma_link ? figma_link.toString() : null,
          nowStr,
          nowStr
        ]
      );
      
      // Also register credential in users table
      await db.run(
        `INSERT OR REPLACE INTO users (
          id, email, password_hash, role, reference_id, created_at, updated_at
        ) VALUES (?, ?, 'password123', 'student', ?, ?, ?)`,
        [
          stId,
          stEmail,
          stId,
          nowStr,
          nowStr
        ]
      );
    }
    
    return NextResponse.json({ success: true, message: "Students created successfully." });
  } catch (error: any) {
    console.error("API POST Students error:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
