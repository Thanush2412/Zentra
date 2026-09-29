// Pin to Mumbai (bom1) — co-located with DB
export const preferredRegion = "bom1";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

const REF_TTL_MS = 30_000;
let refCache: { at: number; payload: any } | null = null;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const collegeId = searchParams.get("college_id") || searchParams.get("collegeId");

    let payload = refCache?.payload;
    if (!refCache || Date.now() - refCache.at >= REF_TTL_MS) {
      const db = await getDb();
      const scope = collegeId ? "college_id = ? OR college_id IS NULL" : "1=1";
      const scopedArgs = collegeId ? [collegeId] : [];
      const [colleges, subjects, courses, departments, academicYears, settingsRows] = await Promise.all([
        db.all("SELECT * FROM colleges ORDER BY name ASC"),
        db.all(`SELECT * FROM subjects WHERE ${scope} ORDER BY department, name LIMIT 5000`, ...scopedArgs),
        db.all(`SELECT * FROM courses WHERE ${scope} ORDER BY name LIMIT 2000`, ...scopedArgs),
        db.all(`SELECT * FROM departments WHERE ${scope} ORDER BY name LIMIT 2000`, ...scopedArgs),
        db.all("SELECT * FROM academic_years").catch(() => []),
        db.all("SELECT key, value FROM system_settings").catch(() => [])
      ]);

      const systemSettings: Record<string, any> = {
        mailing_enabled: true,
        attendance_lock_enabled: true
      };
      (settingsRows || []).forEach((row: any) => {
        try {
          systemSettings[row.key] = JSON.parse(row.value);
        } catch {
          systemSettings[row.key] = row.value === "true" ? true : row.value === "false" ? false : row.value;
        }
      });

      payload = {
        success: true,
        colleges: colleges || [],
        subjects: subjects || [],
        courses: courses || [],
        departments: (departments && departments.length > 0) ? departments : (courses || []),
        academicYears: (academicYears || []).map((ay: any) => typeof ay === "string" ? ay : ay.year || ay.year_name || ay.name || String(ay)),
        systemSettings
      };
      refCache = { at: Date.now(), payload };
    }

    return NextResponse.json(payload, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        "Pragma": "no-cache",
        "Expires": "0"
      },
    });
  } catch (error: any) {
    console.error("API GET data/reference error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
