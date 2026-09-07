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

    // Fetch all colleges to resolve and validate college foreign keys
    const allColleges = await db.all("SELECT id, name FROM colleges");
    const collegeIdSet = new Set(allColleges.map((c: any) => c.id));
    const collegeNameMap = new Map(allColleges.map((c: any) => [String(c.name).toLowerCase().trim(), c.id]));
    const fallbackCollegeId = (defaultCollegeId && collegeIdSet.has(defaultCollegeId))
      ? defaultCollegeId
      : (allColleges[0]?.id || null);

    const now = new Date().toISOString();
    let importedCount = 0;
    const errors: string[] = [];

    await db.transaction(async (tx) => {
      for (let i = 0; i < mentors.length; i++) {
        const item = mentors[i];
        const rawName = item.name || item.FacultyName || item.faculty_name || item["Faculty Name"] || item["Name"] || "";
        const rawEmail = item.email || item.EmailAddress || item.email_address || item["Email Address"] || item["Email"] || "";
        const rawDept = item.department || item.Department || item["Department"] || "Computer Science";
        const rawShift = item.shift || item.Shift || item["Shift"] || "shift_1";
        const rawCollegeId = item.college_id || item.collegeId || item.CollegeId || item["College ID"] || fallbackCollegeId;
        const rawSubjects = item.subjects || item.Subjects || item["Subjects"] || item["Assigned Subjects"] || "";
        const rawClasses = item.classes || item.Classes || item["Classes"] || item["Assigned Classes"] || "";
        const rawSubjectGroup = item.mentor_group || item.subject_group || item.subjectGroup || item["Subject Group"] || item["Mentor Group"] || rawDept;
        const cleanDept = (rawSubjectGroup || String(rawDept)).trim();

        if (!rawName.trim() || !rawEmail.trim()) {
          errors.push(`Row ${i + 1}: Name and email are required.`);
          continue;
        }

        const cleanEmail = rawEmail.trim().toLowerCase();
        const cleanName = rawName.trim();
        const cleanShift = String(rawShift).toLowerCase().includes("2") ? "shift_2" : String(rawShift).toLowerCase().includes("gen") ? "general" : "shift_1";
        const avatar = item.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(cleanEmail)}`;

        // Validate and map college ID against existing colleges
        let safeCollegeId = fallbackCollegeId;
        if (rawCollegeId) {
          if (collegeIdSet.has(rawCollegeId)) {
            safeCollegeId = rawCollegeId;
          } else if (collegeNameMap.has(String(rawCollegeId).toLowerCase().trim())) {
            safeCollegeId = collegeNameMap.get(String(rawCollegeId).toLowerCase().trim());
          }
        }

        // Check if mentor already exists by email or id
        const existing = await tx.get(
          "SELECT id, subjects, classes FROM mentors WHERE LOWER(email) = ? OR id = ?",
          cleanEmail, item.id || ""
        );

        let targetId = existing?.id || item.id || "m_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5);

        if (existing) {
          await tx.run(
            `UPDATE mentors 
             SET name = ?, department = ?, shift = ?, college_id = ?, mentor_group = ?, subject_group = ?,
                 subjects = CASE WHEN ? != '' THEN ? ELSE subjects END,
                 classes = CASE WHEN ? != '' THEN ? ELSE classes END
             WHERE id = ?`,
            cleanName, cleanDept, cleanShift, safeCollegeId, cleanDept, cleanDept,
            rawSubjects, rawSubjects, rawClasses, rawClasses, targetId
          );
        } else {
          await tx.run(
            `INSERT INTO mentors (id, name, email, department, avatar, subjects, classes, shift, college_id, mentor_group, subject_group)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            targetId, cleanName, cleanEmail, cleanDept, avatar, rawSubjects, rawClasses, cleanShift, safeCollegeId, cleanDept, cleanDept
          );
        }

        // Check if user already exists to preserve password_hash
        const existingUser = await tx.get("SELECT password_hash FROM users WHERE LOWER(email) = ? OR id = ? OR reference_id = ?", cleanEmail, targetId, targetId);
        const passHashToKeep = existingUser?.password_hash || hashPassword("password123");

        // Sync central user credentials cleanly
        await tx.run("DELETE FROM users WHERE LOWER(email) = ? OR id = ? OR reference_id = ?", cleanEmail, targetId, targetId);
        await tx.run(
          `INSERT INTO users (id, email, password_hash, role, reference_id, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          targetId, cleanEmail, passHashToKeep, "mentor", targetId, "Active", now, now
        );

        importedCount++;
      }
    });

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
