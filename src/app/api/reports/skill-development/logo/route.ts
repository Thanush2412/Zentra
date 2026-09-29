// Pin to Mumbai (bom1) — co-located with DB
export const preferredRegion = "bom1";
export const maxDuration = 60;

import { NextResponse } from "next/server";
import { requireRole, apiAuthErrorResponse } from "@/lib/api-auth";
import fs from "fs";
import path from "path";

/**
 * College logo management for the monthly skill report.
 * POST (multipart): save/replace public/templates/logos/<collegeId>.png —
 * this replaces the template's logo strip on every slide at generation time.
 * DELETE ?collegeId=…: revert to the template's default logo.
 * GET  ?collegeId=…: whether a college logo is configured.
 */

const LOGOS_DIR = path.join(process.cwd(), "public", "templates", "logos");

function safeCollegeId(id: string): string | null {
  const clean = (id || "").trim();
  if (!clean || !/^[A-Za-z0-9_-]+$/.test(clean)) return null; // path traversal guard
  return clean;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const collegeId = safeCollegeId(searchParams.get("collegeId") || "");
    if (!collegeId) {
      return NextResponse.json({ success: false, message: "Missing or invalid collegeId" }, { status: 400 });
    }
    const exists = fs.existsSync(path.join(LOGOS_DIR, `${collegeId}.png`));
    return NextResponse.json({ success: true, hasCollegeLogo: exists });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err?.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await requireRole(request, "admin", "cam");
    const formData = await request.formData();
    const rawCollegeId = String(formData.get("collegeId") || "");
    const collegeId = safeCollegeId(rawCollegeId);
    const logo = formData.get("logo");

    if (!collegeId) {
      return NextResponse.json({ success: false, message: "Missing or invalid collegeId" }, { status: 400 });
    }
    if (!logo || typeof logo === "string") {
      return NextResponse.json({ success: false, message: "Missing logo file" }, { status: 400 });
    }
    // PNG magic-number check — the pipeline overwrites a .png media file
    const buf = Buffer.from(await logo.arrayBuffer());
    if (buf.length < 8 || buf.toString("ascii", 1, 4) !== "PNG") {
      return NextResponse.json({ success: false, message: "Only PNG files are accepted." }, { status: 400 });
    }
    if (buf.length > 2 * 1024 * 1024) {
      return NextResponse.json({ success: false, message: "Logo must be under 2 MB." }, { status: 400 });
    }

    fs.mkdirSync(LOGOS_DIR, { recursive: true });
    fs.writeFileSync(path.join(LOGOS_DIR, `${collegeId}.png`), buf);
    return NextResponse.json({ success: true, message: "College logo saved." });
  } catch (err: any) {
    const authRes = apiAuthErrorResponse(err);
    if (authRes) return authRes;
    console.error("POST /api/reports/skill-development/logo error:", err);
    return NextResponse.json({ success: false, message: err?.message || "Logo upload failed" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    await requireRole(request, "admin", "cam");
    const { searchParams } = new URL(request.url);
    const collegeId = safeCollegeId(searchParams.get("collegeId") || "");
    if (!collegeId) {
      return NextResponse.json({ success: false, message: "Missing or invalid collegeId" }, { status: 400 });
    }
    const p = path.join(LOGOS_DIR, `${collegeId}.png`);
    if (fs.existsSync(p)) fs.unlinkSync(p);
    return NextResponse.json({ success: true, message: "College logo removed — template default will be used." });
  } catch (err: any) {
    const authRes = apiAuthErrorResponse(err);
    if (authRes) return authRes;
    return NextResponse.json({ success: false, message: err?.message }, { status: 500 });
  }
}
