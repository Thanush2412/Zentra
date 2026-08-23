export const preferredRegion = "bom1";
export const maxDuration = 30;

import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET(request: Request) {
  try {
    const db = await getDb();
    const { searchParams } = new URL(request.url);
    const collegeId = searchParams.get("collegeId");
    const kamId = searchParams.get("kamId");
    const department = searchParams.get("department");
    const classGroup = searchParams.get("classGroup");
    const riskLevel = searchParams.get("riskLevel"); // 'all' | 'high' | 'medium' | 'low'
    const limit = parseInt(searchParams.get("limit") || "100", 10);

    // 1. Fetch filtered students
    let sql = "SELECT st.*, c.name as college_name FROM students st LEFT JOIN colleges c ON st.college_id = c.id WHERE 1=1";
    const params: any[] = [];

    if (collegeId && collegeId !== "all") {
      sql += " AND st.college_id = ?";
      params.push(collegeId);
    } else if (kamId) {
      const kamColleges = await db.all("SELECT id FROM colleges WHERE kam_id = ?", kamId);
      const kamCollegeIds = kamColleges.map((c: any) => c.id);
      if (kamCollegeIds.length === 0) {
        return NextResponse.json({
          success: true,
          summary: { totalStudents: 0, highRiskCount: 0, mediumRiskCount: 0, lowRiskCount: 0, avgAcademicScore: 0 },
          students: []
        });
      }
      const inClause = `(${kamCollegeIds.map(() => "?").join(",")})`;
      sql += ` AND st.college_id IN ${inClause}`;
      params.push(...kamCollegeIds);
    }
    if (department && department !== "all") {
      sql += " AND st.department = ?";
      params.push(department);
    }
    if (classGroup && classGroup !== "all") {
      sql += " AND st.classGroup = ?";
      params.push(classGroup);
    }
    sql += " LIMIT 500";

    const students = await db.all(sql, ...params);
    if (students.length === 0) {
      return NextResponse.json({
        success: true,
        summary: { totalStudents: 0, highRiskCount: 0, mediumRiskCount: 0, lowRiskCount: 0, avgAcademicScore: 0 },
        students: []
      });
    }

    const studentIds = students.map((s: any) => s.id);
    const idPlaceholders = studentIds.map(() => "?").join(",");

    // 2. Fetch parallel academic records
    const [attRows, examRows, taskRows, interviewRows] = await Promise.all([
      // Attendance stats
      db.all(`
        SELECT studentId,
               COUNT(id) as total_marks,
               SUM(CASE WHEN LOWER(status) = 'present' OR LOWER(status) = 'od' THEN 1 ELSE 0 END) as present_marks
        FROM student_attendance
        WHERE studentId IN (${idPlaceholders})
        GROUP BY studentId
      `, ...studentIds).catch(() => []),

      // CIA & Model Exam marks
      db.all(`
        SELECT student_id,
               AVG(CASE WHEN max_marks > 0 THEN (marks_obtained / max_marks) * 100 ELSE marks_obtained END) as avg_exam_pct,
               COUNT(id) as exams_taken
        FROM student_exam_marks
        WHERE student_id IN (${idPlaceholders}) AND is_absent = 0
        GROUP BY student_id
      `, ...studentIds).catch(() => []),

      // Practical Lab Tasks
      db.all(`
        SELECT student_id,
               COUNT(id) as total_submitted_tasks,
               SUM(CASE WHEN marks IS NOT NULL AND marks >= 50 THEN 1 ELSE 0 END) as verified_tasks,
               AVG(marks) as avg_task_score
        FROM student_tracker
        WHERE student_id IN (${idPlaceholders})
        GROUP BY student_id
      `, ...studentIds).catch(() => []),

      // Mock Interview Scores
      db.all(`
        SELECT student_id,
               AVG(CASE WHEN total_score > 0 THEN total_score ELSE technical_score + communication_score + content_score END) as avg_interview_score
        FROM interview_evaluations
        WHERE student_id IN (${idPlaceholders})
        GROUP BY student_id
      `, ...studentIds).catch(() => [])
    ]);

    // Build lookup maps
    const attMap = new Map<string, number>();
    (attRows || []).forEach((r: any) => {
      const pct = r.total_marks > 0 ? Math.round((r.present_marks / r.total_marks) * 100) : 0;
      attMap.set(r.studentId, pct);
    });

    const examMap = new Map<string, number>();
    (examRows || []).forEach((r: any) => {
      examMap.set(r.student_id, Math.round(r.avg_exam_pct || 0));
    });

    const taskMap = new Map<string, { submitted: number; verified: number; avgScore: number }>();
    (taskRows || []).forEach((r: any) => {
      taskMap.set(r.student_id, {
        submitted: r.total_submitted_tasks || 0,
        verified: r.verified_tasks || 0,
        avgScore: Math.round(r.avg_task_score || 0)
      });
    });

    const interviewMap = new Map<string, number>();
    (interviewRows || []).forEach((r: any) => {
      interviewMap.set(r.student_id, Math.round(r.avg_interview_score || 0));
    });

    // 3. Compute Composite Academic Health Index
    let highRiskCount = 0;
    let mediumRiskCount = 0;
    let lowRiskCount = 0;
    let totalScoreSum = 0;

    const evaluatedStudents = students.map((s: any) => {
      const attPct = attMap.get(s.id) ?? (s.attendancePct ? Number(s.attendancePct) : 82);
      const examPct = examMap.get(s.id) ?? 68;
      const taskData = taskMap.get(s.id) || { submitted: 4, verified: 3, avgScore: 70 };
      const interviewScore = interviewMap.get(s.id) ?? 65;

      const rawHireScore = s.hire_score ? parseFloat(s.hire_score) : 60;
      const hireScore = isNaN(rawHireScore) ? 60 : Math.min(100, Math.max(0, rawHireScore <= 10 ? rawHireScore * 10 : rawHireScore));

      // Weighted Composite Score Formula
      // Attendance (25%) + Exams (30%) + Lab Tasks (20%) + Interview (15%) + HireScore (10%)
      const compositeScore = Math.round(
        (attPct * 0.25) +
        (examPct * 0.30) +
        ((taskData.avgScore || 70) * 0.20) +
        (interviewScore * 0.15) +
        (hireScore * 0.10)
      );

      totalScoreSum += compositeScore;

      let riskTier: "HIGH" | "MEDIUM" | "LOW" = "LOW";
      if (compositeScore < 55 || attPct < 60 || examPct < 40) {
        riskTier = "HIGH";
        highRiskCount++;
      } else if (compositeScore < 72 || attPct < 75 || examPct < 60) {
        riskTier = "MEDIUM";
        mediumRiskCount++;
      } else {
        riskTier = "LOW";
        lowRiskCount++;
      }

      return {
        id: s.id,
        name: s.name,
        rollNumber: s.roll_number || s.id,
        registerNumber: s.register_number || "—",
        department: s.department || "General",
        classGroup: s.classGroup || "General Batch",
        collegeId: s.college_id,
        collegeName: s.college_name || "Institution",
        attendancePct: attPct,
        examAvgPct: examPct,
        labTasksSubmitted: taskData.submitted,
        labTaskAvgScore: taskData.avgScore,
        interviewScore,
        hireScore,
        efsetScore: s.efset_score || "B2 Proficient",
        compositeScore,
        riskTier
      };
    });

    // Filter by riskLevel if specified
    const filteredResult = riskLevel && riskLevel !== "all"
      ? evaluatedStudents.filter(s => s.riskTier.toLowerCase() === riskLevel.toLowerCase())
      : evaluatedStudents;

    return NextResponse.json({
      success: true,
      summary: {
        totalStudents: evaluatedStudents.length,
        highRiskCount,
        mediumRiskCount,
        lowRiskCount,
        avgAcademicScore: evaluatedStudents.length > 0 ? Math.round(totalScoreSum / evaluatedStudents.length) : 0
      },
      students: filteredResult.slice(0, limit)
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
