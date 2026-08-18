import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

const HIRE_SCORE_API_BASE = "https://hire-score-fawn.vercel.app/api";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const regNo = searchParams.get("regNo") || searchParams.get("registrationNumber");
    const college = searchParams.get("college");

    let url = `${HIRE_SCORE_API_BASE}/students`;
    if (regNo) {
      url = `${HIRE_SCORE_API_BASE}/scores/${encodeURIComponent(regNo)}`;
    } else if (college) {
      url = `${HIRE_SCORE_API_BASE}/students?college=${encodeURIComponent(college)}`;
    }

    const res = await fetch(url, {
      headers: { "Accept": "application/json" },
      next: { revalidate: 60 } // cache for 1 minute
    });

    if (!res.ok) {
      // Fallback to fetch all students if single score endpoint 404s
      if (regNo) {
        const allRes = await fetch(`${HIRE_SCORE_API_BASE}/students`);
        if (allRes.ok) {
          const allStudents = await allRes.json();
          const target = allStudents.find((s: any) =>
            (s.registrationNumber && s.registrationNumber.toLowerCase() === regNo.toLowerCase()) ||
            (s.id && s.id.toLowerCase() === regNo.toLowerCase()) ||
            (s.email && s.email.toLowerCase() === regNo.toLowerCase())
          );
          if (target) {
            return NextResponse.json({ success: true, student: target });
          }
        }
      }
      return NextResponse.json({ success: false, message: `Failed to fetch from HireScore API: ${res.statusText}` }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error("Error fetching HireScore API:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const db = await getDb();
    const { searchParams } = new URL(request.url);
    const college_id = searchParams.get("college_id");

    // Fetch live master data from HireScore API
    const res = await fetch(`${HIRE_SCORE_API_BASE}/students`, {
      headers: { "Accept": "application/json" },
      cache: "no-store"
    });

    if (!res.ok) {
      return NextResponse.json({ success: false, message: "Could not reach HireScore API." }, { status: 502 });
    }

    const hireStudents: any[] = await res.json();
    if (!Array.isArray(hireStudents) || hireStudents.length === 0) {
      return NextResponse.json({ success: false, message: "HireScore API returned empty student list." }, { status: 404 });
    }

    // Fetch local students
    const localStudents = college_id
      ? await db.all("SELECT id, name, roll_number, email, phone, college_id FROM students WHERE college_id = ?", college_id)
      : await db.all("SELECT id, name, roll_number, email, phone, college_id FROM students");

    let syncedCount = 0;
    const nowStr = new Date().toISOString();

    for (const local of localStudents) {
      const sId = (local.id || "").toLowerCase().trim();
      const sRoll = (local.roll_number || "").toLowerCase().trim();
      const sEmail = (local.email || "").toLowerCase().trim();
      const sPhone = (local.phone || "").replace(/\D/g, "");

      const match = hireStudents.find(h => {
        const hReg = (h.registrationNumber || "").toLowerCase().trim();
        const hEmail = (h.email || "").toLowerCase().trim();
        const hPhone = (h.phone || "").replace(/\D/g, "");

        return (
          (hReg && (hReg === sId || hReg === sRoll)) ||
          (hEmail && sEmail && hEmail === sEmail) ||
          (hPhone && sPhone && hPhone.length >= 10 && (sPhone === hPhone || sPhone.endsWith(hPhone) || hPhone.endsWith(sPhone)))
        );
      });

      if (match) {
        // Derive hireScore cleanly (e.g. 673.79 or Math.round)
        const hireScore = match.hireScore !== undefined && match.hireScore !== null ? Math.round(Number(match.hireScore) * 10) / 10 : null;
        
        // Derive EFSET Grade (e.g. "B2", "C1", "B1", "A2", "C2")
        const efsetGrade = match.cefrGrammar || match.efSetReading || match.efSetListening || match.efSetSpeaking || match.efSetWriting || (match.communicationTotal ? `Score ${match.communicationTotal}` : null);

        const githubUrl = match.githubUrl || match.github_id || null;
        const leetcodeUrl = match.leetcodeUrl || match.leetcode_link || null;
        const tenthMark = match.xMarks !== undefined && match.xMarks !== null ? match.xMarks.toString() : null;
        const twelfthMark = match.xiiMarks !== undefined && match.xiiMarks !== null ? match.xiiMarks.toString() : null;

        await db.run(
          `UPDATE students SET 
            hire_score = COALESCE(?, hire_score),
            efset_score = COALESCE(?, efset_score),
            github_id = COALESCE(?, github_id),
            leetcode_link = COALESCE(?, leetcode_link),
            tenth_mark = COALESCE(?, tenth_mark),
            twelfth_mark = COALESCE(?, twelfth_mark),
            updated_at = ?
          WHERE id = ?`,
          [
            hireScore !== null ? hireScore.toString() : null,
            efsetGrade !== null ? efsetGrade.toString() : null,
            githubUrl,
            leetcodeUrl,
            tenthMark,
            twelfthMark,
            nowStr,
            local.id
          ]
        );
        syncedCount++;
      }
    }

    return NextResponse.json({
      success: true,
      message: `Successfully synchronized ${syncedCount} of ${localStudents.length} students with live HireScore and EFSET data.`,
      syncedCount,
      totalLocal: localStudents.length,
      totalHireScoreStudents: hireStudents.length
    });
  } catch (error: any) {
    console.error("Sync HireScore error:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
