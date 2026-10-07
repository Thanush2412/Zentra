export const preferredRegion = "bom1";
export const maxDuration = 60;
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { ensureMigration } from "@/lib/migrations";

const noCacheHeaders = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
  "Pragma": "no-cache",
  "Expires": "0",
};

export async function GET(request: Request) {
  try {
    await ensureMigration("campus_audits_tables");
    const db = await getDb();

    const { searchParams } = new URL(request.url);
    const collegeId = (searchParams.get("collegeId") || "").trim();
    const collegeName = (searchParams.get("collegeName") || "").trim();

    // 1. Fetch all colleges with their assigned KAM from the database
    const collegesWithKAM = await db.all(`
      SELECT 
        c.id, c.name, c.address, c.kam_id,
        k.name as kam_name, k.email as kam_email, k.title as kam_title,
        (SELECT cm.name FROM campus_managers cm WHERE cm.college_id = c.id LIMIT 1) as cm_name
      FROM colleges c
      LEFT JOIN kam_users k ON c.kam_id = k.id
      ORDER BY c.name ASC
    `);

    // Build dynamic clusters by KAM
    const clusters: Record<string, { kamId: string; kamName: string; campuses: { id: string; name: string }[] }> = {};
    for (const c of collegesWithKAM) {
      const kName = c.kam_name || "General Cluster";
      if (!clusters[kName]) {
        clusters[kName] = {
          kamId: c.kam_id || "general",
          kamName: kName,
          campuses: []
        };
      }
      clusters[kName].campuses.push({ id: c.id, name: c.name });
    }

    // Resolve active campus KAM info
    let activeKAMInfo = {
      kam: "General",
      kamId: "",
      campuses: collegesWithKAM.map((c: any) => c.name)
    };

    if (collegeName || collegeId) {
      const matched = collegesWithKAM.find(
        (c: any) =>
          (collegeId && c.id === collegeId) ||
          (collegeName && c.name.toLowerCase().trim() === collegeName.toLowerCase().trim()) ||
          (collegeName && (c.name.toLowerCase().includes(collegeName.toLowerCase()) || collegeName.toLowerCase().includes(c.name.toLowerCase())))
      );
      if (matched) {
        activeKAMInfo = {
          kam: matched.kam_name || "General",
          kamId: matched.kam_id || "",
          campuses: collegesWithKAM
            .filter((c: any) => c.kam_id === matched.kam_id)
            .map((c: any) => c.name)
        };
      }
    }

    // 2. Fetch incoming peer reviews assigned to this campus
    let assignedAudits: any[] = [];
    if (collegeName || collegeId) {
      assignedAudits = await db.all(
        `SELECT * FROM campus_audits 
         WHERE (reviewer_campus = ? OR reviewer_college_id = ?)
         ORDER BY created_at DESC`,
        [collegeName, collegeId]
      );
    } else {
      assignedAudits = await db.all(
        `SELECT * FROM campus_audits ORDER BY created_at DESC LIMIT 100`
      );
    }

    // 3. Fetch audits submitted by this campus
    let submittedAudits: any[] = [];
    if (collegeName || collegeId) {
      submittedAudits = await db.all(
        `SELECT * FROM campus_audits 
         WHERE (campus = ? OR college_id = ?)
         ORDER BY created_at DESC`,
        [collegeName, collegeId]
      );
    }

    return NextResponse.json({
      success: true,
      assignedAudits,
      submittedAudits,
      activeKAMInfo,
      clusters,
      allColleges: collegesWithKAM
    }, { headers: noCacheHeaders });
  } catch (error: any) {
    console.error("GET /api/audit/campus-audits error:", error);
    return NextResponse.json(
      { success: false, message: error?.message || "Failed to load campus audits" },
      { status: 500, headers: noCacheHeaders }
    );
  }
}

export async function POST(request: Request) {
  try {
    await ensureMigration("campus_audits_tables");
    const db = await getDb();

    const body = await request.json();
    const {
      college_id,
      campus,
      mentor_id,
      mentor_name,
      department,
      dept_name,
      subject,
      audit_date,
      auditor_name,
      auditor_role,

      skill_criteria,
      skill_score = 0,
      tasks_assigned = 0,
      tasks_completed = 0,
      skill_proof_link = "",
      skill_remarks = "",

      coursework_criteria,
      coursework_score = 0,
      coursework_remarks = "",

      attendance_criteria,
      attendance_score = 0,
      below_75_count = 0,
      attendance_remarks = ""
    } = body;

    if (!campus || !mentor_name || !subject) {
      return NextResponse.json(
        { success: false, message: "Missing required fields: campus, mentor_name, subject" },
        { status: 400 }
      );
    }

    // 1. Resolve current campus college_id and KAM from DB
    const collegeRow = await db.get(
      `SELECT c.id, c.name, c.kam_id, k.name as kam_name 
       FROM colleges c 
       LEFT JOIN kam_users k ON c.kam_id = k.id 
       WHERE c.id = ? OR LOWER(c.name) = LOWER(?)
       LIMIT 1`,
      [college_id || "", campus]
    );

    const actualCollegeId = collegeRow?.id || college_id || "col_unknown";
    const kamId = collegeRow?.kam_id || null;
    const kamName = collegeRow?.kam_name || "General Cluster";

    // 2. Query peer candidates from DB: other colleges with the same kam_id
    let peerCandidates: any[] = [];
    if (kamId) {
      peerCandidates = await db.all(
        `SELECT c.id, c.name,
                (SELECT cm.name FROM campus_managers cm WHERE cm.college_id = c.id LIMIT 1) as cm_name
         FROM colleges c
         WHERE c.kam_id = ? AND c.id != ?
         ORDER BY c.name ASC`,
        [kamId, actualCollegeId]
      );
    }

    // Fallback if no peers in cluster: other colleges overall
    if (peerCandidates.length === 0) {
      peerCandidates = await db.all(
        `SELECT c.id, c.name,
                (SELECT cm.name FROM campus_managers cm WHERE cm.college_id = c.id LIMIT 1) as cm_name
         FROM colleges c
         WHERE c.id != ?
         ORDER BY c.name ASC
         LIMIT 5`,
        [actualCollegeId]
      );
    }

    let reviewerCollegeId = actualCollegeId;
    let reviewerCampus = campus;
    let reviewerCM = "Campus Manager";

    if (peerCandidates.length > 0) {
      // Inspect recent peer audit assignments from DB to enforce cooldown & load-balancing
      const recentAudits = await db.all(
        `SELECT reviewer_college_id, reviewer_campus, COUNT(*) as cnt
         FROM campus_audits
         WHERE college_id = ?
         GROUP BY reviewer_college_id, reviewer_campus
         ORDER BY cnt ASC`,
        [actualCollegeId]
      );

      const assignedCounts = new Map<string, number>();
      for (const p of peerCandidates) {
        assignedCounts.set(p.id, 0);
      }
      for (const ra of recentAudits) {
        if (assignedCounts.has(ra.reviewer_college_id)) {
          assignedCounts.set(ra.reviewer_college_id, ra.cnt);
        }
      }

      // Sort candidate peers by least assigned reviews
      peerCandidates.sort((a, b) => (assignedCounts.get(a.id) || 0) - (assignedCounts.get(b.id) || 0));

      const selected = peerCandidates[0];
      reviewerCollegeId = selected.id;
      reviewerCampus = selected.name;
      reviewerCM = selected.cm_name || `Campus Manager (${selected.name})`;
    }

    // 3. Generate IDs
    const now = new Date();
    const yearStr = now.getFullYear();
    const randSuffix = Math.floor(100 + Math.random() * 900);
    const id = `AUD-${yearStr}-${randSuffix}`;
    const uid = `aud_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    // 4. Insert into campus_audits
    await db.run(
      `INSERT INTO campus_audits (
        id, uid, college_id, campus, mentor_id, mentor_name, department, dept_name, subject,
        audit_date, auditor_name, auditor_role,
        skill_criteria, skill_score, tasks_assigned, tasks_completed, skill_proof_link, skill_remarks,
        coursework_criteria, coursework_score, coursework_remarks,
        attendance_criteria, attendance_score, below_75_count, attendance_remarks,
        kam_id, kam_name, reviewer_college_id, reviewer_campus, reviewer_cm_name,
        peer_status, overall_status, created_at, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        'Pending', 'In Progress', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      )`,
      [
        id,
        uid,
        actualCollegeId,
        campus,
        mentor_id || null,
        mentor_name,
        department || null,
        dept_name || department || null,
        subject,
        audit_date || now.toISOString().slice(0, 10),
        auditor_name || "Campus Manager",
        auditor_role || "cm",

        typeof skill_criteria === "object" ? JSON.stringify(skill_criteria) : skill_criteria || null,
        skill_score,
        tasks_assigned,
        tasks_completed,
        skill_proof_link || null,
        skill_remarks || null,

        typeof coursework_criteria === "object" ? JSON.stringify(coursework_criteria) : coursework_criteria || null,
        coursework_score,
        coursework_remarks || null,

        typeof attendance_criteria === "object" ? JSON.stringify(attendance_criteria) : attendance_criteria || null,
        attendance_score,
        below_75_count,
        attendance_remarks || null,

        kamId,
        kamName,
        reviewerCollegeId,
        reviewerCampus,
        reviewerCM
      ]
    );

    // 5. Create audit log
    await db.run(
      `INSERT INTO audit_logs (id, type, description, actorName, actorRole, timestamp)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        `log_${Date.now()}`,
        "E-AUDIT_RECORDED",
        `Campus audit recorded for mentor ${mentor_name} (${subject}) at ${campus}. Routed to ${reviewerCampus} for peer review.`,
        auditor_name || "Campus Manager",
        auditor_role || "cm",
        now.toISOString()
      ]
    ).catch(() => {});

    return NextResponse.json({
      success: true,
      message: `Audit recorded successfully and routed to ${reviewerCampus}.`,
      auditId: id,
      assignedReviewer: {
        reviewerCampus,
        reviewerCollegeId,
        reviewerCM
      }
    });
  } catch (error: any) {
    console.error("POST /api/audit/campus-audits error:", error);
    return NextResponse.json(
      { success: false, message: error?.message || "Failed to record audit" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    await ensureMigration("campus_audits_tables");
    const db = await getDb();

    const body = await request.json();
    const { id, signoff_notes, signed_by, user_role = "cm" } = body;

    if (!id || !signoff_notes) {
      return NextResponse.json(
        { success: false, message: "Missing audit ID or reviewer inspection notes." },
        { status: 400 }
      );
    }

    if (user_role === "kam") {
      return NextResponse.json(
        {
          success: false,
          message: "Policy Notice: Key Account Managers (KAMs) cannot sign off on peer reviews. Peer reviews must be verified by peer Campus Managers."
        },
        { status: 403 }
      );
    }

    const now = new Date().toISOString();
    await db.run(
      `UPDATE campus_audits
       SET peer_status = 'Completed',
           overall_status = 'Completed',
           peer_signoff_notes = ?,
           peer_signed_by = ?,
           peer_signed_at = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ? OR uid = ?`,
      [signoff_notes, signed_by || "Campus Manager", now, id, id]
    );

    // Create audit log
    await db.run(
      `INSERT INTO audit_logs (id, type, description, actorName, actorRole, timestamp)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        `log_${Date.now()}`,
        "PEER_AUDIT_SIGNED_OFF",
        `Peer audit ${id} signed off by ${signed_by || "Campus Manager"}: "${signoff_notes.slice(0, 80)}..."`,
        signed_by || "Campus Manager",
        user_role,
        now
      ]
    ).catch(() => {});

    return NextResponse.json({
      success: true,
      message: "Peer review signed off and published as Completed.",
      signedAt: now
    });
  } catch (error: any) {
    console.error("PATCH /api/audit/campus-audits error:", error);
    return NextResponse.json(
      { success: false, message: error?.message || "Failed to sign off peer review" },
      { status: 500 }
    );
  }
}
