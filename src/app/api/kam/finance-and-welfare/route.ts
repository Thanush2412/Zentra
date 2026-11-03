export const maxDuration = 30;

import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { requireKamScope, resolveScopeParams } from "@/lib/kamScope";
import { getInstitutionDateStr, getInstitutionDateStrOffset } from "@/lib/localDate";

export async function GET(request: Request) {
  try {
    const db = await getDb();
    const { scope, errorResponse } = await requireKamScope(request, db);
    if (errorResponse) return errorResponse;

    const { searchParams } = new URL(request.url);
    const scoped = resolveScopeParams(scope!, searchParams.get("kamId"), searchParams.get("collegeId"));
    if (scoped.errorResponse) return scoped.errorResponse;
    const collegeId = scoped.collegeId;
    const kamId = scoped.kamId;
    const todayStr = getInstitutionDateStr();

    // Resolve colleges in scope
    let collegesList: any[];
    if (collegeId && collegeId !== "all") {
      collegesList = await db.all("SELECT * FROM colleges WHERE id = ?", collegeId);
    } else if (kamId) {
      collegesList = await db.all("SELECT * FROM colleges WHERE kam_id = ? ORDER BY name ASC", kamId);
    } else {
      collegesList = await db.all("SELECT * FROM colleges ORDER BY name ASC");
    }
    const kamCollegeIds = collegesList.map((c: any) => c.id);
    const inClause = kamCollegeIds.length > 0 ? `(${kamCollegeIds.map(() => "?").join(",")})` : "(NULL)";

    // Fetch parallel financial, welfare, issue, and event data — scoped to colleges.
    // No .catch() here: a failed slice previously rendered as an empty campus, which
    // is indistinguishable from a campus that genuinely has no fees or issues.
    const [feesRows, paymentsRows, studentLeaveRows, feedbackRows, issuesRows, eventsRows] = await Promise.all([
      kamCollegeIds.length > 0
        ? db.all(`SELECT sf.* FROM student_fees sf JOIN students s ON sf.student_id = s.id WHERE s.college_id IN ${inClause}`, ...kamCollegeIds)
        : Promise.resolve([]),
      kamCollegeIds.length > 0
        ? db.all(`SELECT fp.* FROM fee_payments fp JOIN student_fees sf ON fp.fee_id = sf.id JOIN students s ON sf.student_id = s.id WHERE s.college_id IN ${inClause}`, ...kamCollegeIds)
        : Promise.resolve([]),
      kamCollegeIds.length > 0
        ? db.all(`
        SELECT lr.*, s.name as student_name, s.department, s.college_id, c.name as college_name
        FROM leave_requests lr
        JOIN students s ON lr.studentId = s.id
        LEFT JOIN colleges c ON s.college_id = c.id
        WHERE s.college_id IN ${inClause}
        ORDER BY lr.timestamp DESC
        LIMIT 100
      `, ...kamCollegeIds)
        : Promise.resolve([]),
      db.all("SELECT * FROM feedback_reports ORDER BY created_at DESC"),
      kamCollegeIds.length > 0
        ? db.all(`SELECT * FROM campus_issues WHERE college_id IN ${inClause} ORDER BY created_at DESC`, ...kamCollegeIds)
        : db.all("SELECT * FROM campus_issues ORDER BY created_at DESC"),
      db.all("SELECT * FROM academic_events ORDER BY date ASC")
    ]);

    // 1. Fee Analytics
    let totalFees = 0;
    let totalPaid = 0;
    let paidCount = 0;
    let partialCount = 0;
    let unpaidCount = 0;
    let agingOverdue30d = 0;
    const overdueCutoff = getInstitutionDateStrOffset(-30);

    const campusFeeMap = new Map<string, any>();
    (collegesList || []).forEach((c: any) => {
      campusFeeMap.set(c.id, {
        collegeId: c.id,
        collegeName: c.name,
        totalFees: 0,
        totalPaid: 0,
        totalOutstanding: 0,
        collectionRate: 0
      });
    });

    (feesRows || []).forEach((f: any) => {
      const amt = Number(f.amount || 0);
      const paid = Number(f.paid_amount || 0);
      totalFees += amt;
      totalPaid += paid;

      // Aging is measured against each fee's own due date, not a flat percentage.
      const outstanding = Math.max(0, amt - paid);
      if (outstanding > 0 && f.due_date && String(f.due_date).slice(0, 10) < overdueCutoff) {
        agingOverdue30d += outstanding;
      }

      if (paid >= amt && amt > 0) paidCount++;
      else if (paid > 0) partialCount++;
      else unpaidCount++;

      const c = campusFeeMap.get(f.college_id);
      if (c) {
        c.totalFees += amt;
        c.totalPaid += paid;
      }
    });

    const totalOutstanding = Math.max(0, totalFees - totalPaid);
    const collectionRate = totalFees > 0 ? Math.round((totalPaid / totalFees) * 1000) / 10 : 0;

    const campusFeeBreakdown = Array.from(campusFeeMap.values()).map(c => {
      const out = Math.max(0, c.totalFees - c.totalPaid);
      const rate = c.totalFees > 0 ? Math.round((c.totalPaid / c.totalFees) * 100) : 0;
      return {
        ...c,
        totalOutstanding: out,
        collectionRate: rate
      };
    });

    // 2. Student Leave & OD Breakdown
    let totalStudentLeavesToday = 0;
    let totalStudentOdToday = 0;
    let pendingApprovals = 0;

    (studentLeaveRows || []).forEach((lr: any) => {
      if (lr.status?.toLowerCase() === "pending") pendingApprovals++;
      if (String(lr.dateStr || "").slice(0, 10) !== todayStr) return;
      const isOd = lr.type?.toLowerCase().includes("od") || lr.reason?.toLowerCase().includes("on-duty") || lr.reason?.toLowerCase().includes("symposium");
      if (isOd) totalStudentOdToday++;
      else totalStudentLeavesToday++;
    });

    // 3. Feedback & Issue Resolution SLAs
    const totalIssues = issuesRows.length + feedbackRows.length;
    const resolvedIssues = issuesRows.filter((i: any) => i.status === "resolved").length + feedbackRows.filter((f: any) => f.status === "resolved").length;
    const escalatedIssues = issuesRows.filter((i: any) => i.escalated === 1).length;

    // Group actual categories from real issues, and measure turnaround only from
    // rows that carry both timestamps — the old 1.5-day figure was invented.
    const categoryStats = new Map<string, { count: number; resolutionDays: number[] }>();
    const recordCategory = (cat: string, row: any) => {
      const stat = categoryStats.get(cat) || { count: 0, resolutionDays: [] };
      stat.count += 1;
      const created = row.created_at ? new Date(row.created_at).getTime() : NaN;
      const resolved = (row.resolvedAt || row.resolved_at)
        ? new Date(row.resolvedAt || row.resolved_at).getTime()
        : NaN;
      if (isFinite(created) && isFinite(resolved) && resolved >= created) {
        stat.resolutionDays.push((resolved - created) / 86400000);
      }
      categoryStats.set(cat, stat);
    };
    issuesRows.forEach((i: any) => recordCategory(i.category || i.type || "General", i));
    feedbackRows.forEach((f: any) => recordCategory(f.category || f.type || "Student Feedback", f));

    const issueCategories = Array.from(categoryStats.entries()).map(([category, stat]) => {
      const avg = stat.resolutionDays.length > 0
        ? Math.round((stat.resolutionDays.reduce((a, b) => a + b, 0) / stat.resolutionDays.length) * 10) / 10
        : null;
      return {
        category,
        count: stat.count,
        avgResolutionDays: avg,
        status: stat.count > 5 ? "High" : stat.count > 2 ? "Medium" : "Low"
      };
    });

    // 4. Regional Academic Events Calendar
    const upcomingEvents = (eventsRows || []).slice(0, 8).map((e: any) => ({
      id: e.id,
      name: e.name,
      date: e.date,
      endDate: e.end_date || e.date,
      category: e.category || "Academic Event",
      department: e.department || "All Departments",
      venue: e.venue || "Campus",
      status: e.status || "Upcoming",
      coordinator: e.coordinator || null
    }));

    return NextResponse.json({
      success: true,
      fees: {
        totalFees,
        totalPaid,
        totalOutstanding,
        collectionRate,
        paidCount,
        partialCount,
        unpaidCount,
        agingOverdue30d,
        campusFeeBreakdown
      },
      welfare: {
        totalStudentLeavesToday,
        totalStudentOdToday,
        pendingApprovals,
        recentRequests: (studentLeaveRows || []).slice(0, 10)
      },
      issues: {
        totalIssues,
        resolvedIssues,
        escalatedIssues,
        resolutionRate: totalIssues > 0 ? Math.round((resolvedIssues / totalIssues) * 100) : 0,
        categories: issueCategories
      },
      events: upcomingEvents
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
