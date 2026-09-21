// Pin to Mumbai (bom1) — co-located with Supabase DB
export const preferredRegion = "bom1";

import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

/**
 * Per-domain split of /api/data (plan item 16): reference tables
 * (subjects/courses/departments/colleges) barely change, so responses are
 * cached in-memory for 60s AND tagged with an ETag so clients with a fresh
 * copy get a cheap 304 instead of the full payload.
 */

const REF_TTL_MS = 60_000;

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
      const [colleges, subjects, courses, departments] = await Promise.all([
        db.all("SELECT * FROM colleges"),
        db.all(`SELECT * FROM subjects WHERE ${scope} ORDER BY department, name LIMIT 5000`, ...scopedArgs),
        db.all(`SELECT * FROM courses WHERE ${scope} ORDER BY name LIMIT 2000`, ...scopedArgs),
        db.all(`SELECT * FROM departments WHERE ${scope} ORDER BY name LIMIT 2000`, ...scopedArgs),
      ]);
      payload = { colleges, subjects, courses, departments };
      refCache = { at: Date.now(), payload };
    }

    const body = JSON.stringify(payload);
    const etag = `"${hashStr(body)}"`;
    if (request.headers.get("if-none-match") === etag) {
      return new NextResponse(null, { status: 304, headers: { ETag: etag } });
    }

    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ETag: etag,
        "Cache-Control": "private, max-age=30",
      },
    });
  } catch (error: any) {
    console.error("API GET data/reference error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

function hashStr(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(36) + "_" + s.length.toString(36);
}
