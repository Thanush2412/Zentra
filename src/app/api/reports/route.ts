// Pin to Mumbai (bom1) — co-located with Turso DB (aws-ap-south-1)
export const preferredRegion = "bom1";
export const maxDuration = 60;

import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET(request: Request) {
  try {
    const db = await getDb();
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") || "attendance";
    const format = searchParams.get("format") || "json";
    const collegeId = searchParams.get("collegeId");

    let reportData: any[] = [];
    let filename = `zentra_report_${type}_${Date.now()}`;

    if (type === "attendance") {
      let query = `
        SELECT sa.id, sa.dateStr, sa.status, sa.markedBy, s.name as student_name, s.classGroup, s.department
        FROM student_attendance sa
        JOIN students s ON sa.studentId = s.id
        WHERE 1=1
      `;
      const params: any[] = [];
      if (collegeId) {
        query += " AND s.college_id = ?";
        params.push(collegeId);
      }
      query += " ORDER BY sa.dateStr DESC LIMIT 500";
      reportData = await db.all(query, params);
      filename = `student_attendance_report`;
    } else if (type === "leave") {
      let query = `
        SELECT lr.id, lr.studentName, lr.classGroup, lr.type, lr.dateStr, lr.reason, lr.status, lr.approvedBy, lr.timestamp
        FROM leave_requests lr
        WHERE 1=1
      `;
      query += " ORDER BY lr.timestamp DESC LIMIT 500";
      reportData = await db.all(query);
      filename = `leave_requests_report`;
    } else if (type === "interviews") {
      let query = `
        SELECT si.id, si.subject, si.class_group, si.type, si.target_date, si.mentor_name, si.status, si.created_at
        FROM student_interviews si
        WHERE 1=1
      `;
      if (collegeId) {
        query += " AND (si.college_id = ? OR si.origin_college_id = ?)";
      }
      query += " ORDER BY si.created_at DESC LIMIT 500";
      reportData = await db.all(query, collegeId ? [collegeId, collegeId] : []);
      filename = `interviews_report`;
    } else if (type === "workload") {
      let query = `
        SELECT m.id, m.name, m.email, m.department, m.subjects, m.classes, m.mentor_group, COUNT(s.id) as slot_count
        FROM mentors m
        LEFT JOIN slots s ON s.mentorId = m.id
        WHERE 1=1
      `;
      const params: any[] = [];
      if (collegeId) {
        query += " AND m.college_id = ?";
        params.push(collegeId);
      }
      query += " GROUP BY m.id ORDER BY m.name ASC";
      reportData = await db.all(query, params);
      filename = `faculty_workload_report`;
    }

    if (format === "csv") {
      if (reportData.length === 0) {
        return new Response("No data available for export", {
          headers: { "Content-Type": "text/csv" }
        });
      }

      const headers = Object.keys(reportData[0]).join(",");
      const rows = reportData.map(row =>
        Object.values(row)
          .map(val => `"${String(val ?? "").replace(/"/g, '""')}"`)
          .join(",")
      );
      const csvContent = [headers, ...rows].join("\n");

      return new Response(csvContent, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="${filename}.csv"`
        }
      });
    }

    return NextResponse.json({
      success: true,
      reportType: type,
      totalCount: reportData.length,
      data: reportData
    });
  } catch (error: any) {
    console.error("GET /api/reports error:", error);
    return NextResponse.json({ success: false, message: error.message || "Failed to generate report" }, { status: 500 });
  }
}
