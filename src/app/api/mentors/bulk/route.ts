// Pin to Mumbai (bom1) — co-located with Turso DB (aws-ap-south-1)
export const preferredRegion = "bom1";
export const maxDuration = 60;

import { NextResponse } from "next/server";
import { getDb, syncMentorSubjectGroups } from "@/lib/db";
import { hashPassword } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const db = await getDb();
    const body = await request.json();
    const { mentors, defaultCollegeId } = body;

    if (!Array.isArray(mentors) || mentors.length === 0) {
      return NextResponse.json(
        { success: false, message: "No faculty records provided for import." },
        { status: 400 }
      );
    }

    // Get default college if not specified
    let fallbackCollegeId = defaultCollegeId;
    if (!fallbackCollegeId) {
      const firstCol = await db.get("SELECT id FROM colleges LIMIT 1");
      fallbackCollegeId = firstCol?.id || "college_1";
    }

    const now = new Date().toISOString();
    let importedCount = 0;
    const errors: string[] = [];

    for (let i = 0; i < mentors.length; i++) {
      const item = mentors[i];
      const rawName = item.name || item.FacultyName || item.faculty_name || item["Faculty Name"] || item["Name"] || "";
      const rawEmail = item.email || item.EmailAddress || item.email_address || item["Email Address"] || item["Email"] || "";
      const rawDept = item.department || item.Department || item["Department"] || "Computer Science";
      const rawShift = item.shift || item.Shift || item["Shift"] || "shift_1";
      const rawCollegeId = item.college_id || item.collegeId || item.CollegeId || fallbackCollegeId;
      const rawSubjects = item.subjects || item.Subjects || item["Subjects"] || "";
      const rawClasses = item.classes || item.Classes || item["Classes"] || "";
      const rawSubjectGroup = item.mentor_group || item.subject_group || item.subjectGroup || item["Subject Group"] || item["Mentor Group"] || rawDept;
      // Unified group: mentor_group, subject_group, and department all mirror the same value
      const cleanDept = (rawSubjectGroup || String(rawDept)).trim();

      if (!rawName || !rawEmail) {
        errors.push(`Row ${i + 1}: Skipped due to missing Name or Email.`);
        continue;
      }

      const cleanEmail = String(rawEmail).toLowerCase().trim();
      const cleanName = String(rawName).trim();

      // Standardize shift string
      let cleanShift = String(rawShift).toLowerCase().trim();
      if (cleanShift.includes("1") || cleanShift.includes("shift 1")) cleanShift = "shift_1";
      else if (cleanShift.includes("2") || cleanShift.includes("shift 2")) cleanShift = "shift_2";
      else cleanShift = "general";

      const mentorId = item.id || `mentor_${Date.now()}_${i}_${Math.random().toString(36).substring(2, 6)}`;
      const avatar = item.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(cleanEmail)}`;

      // Check if mentor with email already exists to update or insert
      const existing = await db.get("SELECT id FROM mentors WHERE LOWER(email) = ?", cleanEmail);
      const targetId = existing ? existing.id : mentorId;

      if (existing) {
        await db.run(
          `UPDATE mentors SET name = ?, department = ?, avatar = ?, subjects = ?, classes = ?, shift = ?, college_id = ?, subject_group = ?, mentor_group = ? WHERE id = ?`,
          cleanName, cleanDept, avatar, rawSubjects, rawClasses, cleanShift, rawCollegeId, cleanDept, cleanDept, targetId
        );
      } else {
        await db.run(
          `INSERT INTO mentors (id, name, email, department, avatar, subjects, classes, shift, college_id, subject_group, mentor_group)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          targetId, cleanName, cleanEmail, cleanDept, avatar, rawSubjects, rawClasses, cleanShift, rawCollegeId, cleanDept, cleanDept
        );
      }

      // Check if user already exists to preserve password_hash
      const existingUser = await db.get("SELECT password_hash FROM users WHERE role = 'mentor' AND reference_id = ?", targetId);
      const passHashToKeep = existingUser?.password_hash || hashPassword("password123");

      // Sync central user credentials
      await db.run("DELETE FROM users WHERE LOWER(email) = ? AND reference_id != ?", [cleanEmail, targetId]);
      await db.run(
        `INSERT OR REPLACE INTO users (id, email, password_hash, role, reference_id, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [targetId, cleanEmail, passHashToKeep, "mentor", targetId, "Active", now, now]
      );

      importedCount++;
    }

    await syncMentorSubjectGroups(db);

    return NextResponse.json({
      success: true,
      count: importedCount,
      errors,
      message: `Successfully processed ${importedCount} faculty member(s).`
    });
  } catch (error: any) {
    console.error("API POST /api/mentors/bulk error:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Bulk import failed." },
      { status: 500 }
    );
  }
}
