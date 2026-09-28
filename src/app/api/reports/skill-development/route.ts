// Pin to Mumbai (bom1) — co-located with DB
export const preferredRegion = "bom1";
export const maxDuration = 120;

import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import JSZip from "jszip";
import {
  computeBatchReport,
  groupStudentsByBatch,
  buildBatchTitle,
  type StudentRow,
  type AttendanceRow,
  type BatchMetrics
} from "@/lib/report/skillReportData";
import {
  renderAttendanceChartPNG,
  renderDistributionChartPNG,
  renderClassAveragePNG
} from "@/lib/report/chartRenderer";
import fs from "fs";
import path from "path";

/**
 * Monthly Skill Development Report (PPTX) — CM dashboard feature.
 *
 * GET  ?collegeId=…            → computed metrics preview (JSON) for the UI
 * POST { collegeId, month, year, problemsAssigned? } → generated .pptx download
 *
 * Strategy: clone the template in public/templates/, patch text at the SHAPE
 * level (narratives are split across multiple <a:t> runs — replacing runs
 * individually leaves stale fragments), and discover chart images from each
 * slide's .rels at runtime instead of hardcoding media filenames (the template
 * uses different image files per batch section). College logo: if
 * public/templates/logos/<collegeId>.png exists it replaces the template logo
 * strip (image6.png) on every slide.
 */

const TEMPLATE_PATH = path.join(process.cwd(), "public", "templates", "Skill Development Report Template.pptx");
const LOGOS_DIR = path.join(process.cwd(), "public", "templates", "logos");

// Template slide map (decoded from the original deck):
//   1 title | 5,11,17,23 batch titles | 6,12,18,24 attendance | 7,13,19,25 tech
//   8,14,20,26 tech evidence | 9,15,21,27 communication | 10,16,22,28 academic
const BATCH_SLOTS = [
  { titleSlide: 5, attendance: 6, tech: 7, techEvidence: 8, comm: 9, acad: 10 },
  { titleSlide: 11, attendance: 12, tech: 13, techEvidence: 14, comm: 15, acad: 16 },
  { titleSlide: 17, attendance: 18, tech: 19, techEvidence: 20, comm: 21, acad: 22 },
  { titleSlide: 23, attendance: 24, tech: 25, techEvidence: 26, comm: 27, acad: 28 }
];

const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];

function xmlEsc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/* ────────────────────────────────────────────────────────────────────────
   Shape-level text replacement.
   A narrative paragraph lives in ONE <p:sp> (shape) but is split across
   several <a:t> runs. We find the shape whose combined run text is longest
   (i.e. the body paragraph), set its FIRST run to the new text and empty
   the remaining runs — the visual style of the first run is preserved and
   no stale fragments survive.
   ──────────────────────────────────────────────────────────────────────── */
function replaceLongestShapeText(xml: string, newText: string): string {
  const spRegex = /<p:sp>[\s\S]*?<\/p:sp>/g;
  let bestStart = -1, bestEnd = -1, bestLen = 0;

  let m: RegExpExecArray | null;
  while ((m = spRegex.exec(xml)) !== null) {
    const shape = m[0];
    const runs = shape.match(/<a:t>([^<]*)<\/a:t>/g) || [];
    const combined = runs.map(r => r.replace(/<\/?a:t>/g, "")).join("");
    if (combined.length > bestLen) {
      bestLen = combined.length;
      bestStart = m.index;
      bestEnd = m.index + shape.length;
    }
  }
  if (bestStart === -1) return xml;

  const shapeXml = xml.slice(bestStart, bestEnd);
  let runIdx = -1;
  const newShape = shapeXml.replace(/<a:t>([^<]*)<\/a:t>/g, (mm) => {
    runIdx++;
    return runIdx === 0 ? `<a:t>${xmlEsc(newText)}</a:t>` : "<a:t></a:t>";
  });
  return xml.slice(0, bestStart) + newShape + xml.slice(bestEnd);
}

/** Replace a single run by index (for short, well-known runs like titles). */
function setRun(xml: string, runIndex: number, text: string): string {
  let idx = -1;
  return xml.replace(/<a:t>([^<]*)<\/a:t>/g, (m) => {
    idx++;
    if (idx === runIndex) return `<a:t>${xmlEsc(text)}</a:t>`;
    return m;
  });
}

/**
 * Replace the body of the one shape whose combined run text contains `needle`
 * (case-insensitive). Used for evidence slides that have several narrative
 * shapes ("Evaluation:", "Class Average:", "Profile Building Report") —
 * first run gets the full new text, the rest are emptied so no stale
 * fragments (e.g. May's "50.89%") survive.
 */
function replaceShapeTextContaining(xml: string, needle: string, newText: string): string {
  const spRegex = /<p:sp>[\s\S]*?<\/p:sp>/g;
  const lower = needle.toLowerCase();
  let m: RegExpExecArray | null;
  while ((m = spRegex.exec(xml)) !== null) {
    const shape = m[0];
    const runs = shape.match(/<a:t>([^<]*)<\/a:t>/g) || [];
    const combined = runs.map(r => r.replace(/<\/?a:t>/g, "")).join("").toLowerCase();
    if (combined.includes(lower) && combined.length > needle.length + 10) {
      let runIdx = -1;
      const newShape = shape.replace(/<a:t>([^<]*)<\/a:t>/g, () => {
        runIdx++;
        return runIdx === 0 ? `<a:t>${xmlEsc(newText)}</a:t>` : "<a:t></a:t>";
      });
      return xml.slice(0, m.index) + newShape + xml.slice(m.index + shape.length);
    }
  }
  return xml;
}

/* ────────────────────────────────────────────────────────────────────────
   Runtime chart-media discovery.
   For a slide, read its .rels, look at each referenced PNG's pixel size
   (PNG IHDR: width/height at bytes 16..24 big-endian) and classify:
     - logo strip:   width < 600
     - screenshots:  width >= 1200 (evidence photos)
     - chart images: everything else → these get overwritten with fresh data
   ──────────────────────────────────────────────────────────────────────── */
function pngSize(buf: Buffer): { w: number; h: number } | null {
  if (buf.length < 24) return null;
  if (buf.toString("ascii", 12, 16) !== "IHDR") return null;
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

async function getChartMediaForSlide(zip: JSZip, slideNum: number): Promise<string[]> {
  const relsFile = zip.file(`ppt/slides/_rels/slide${slideNum}.xml.rels`);
  if (!relsFile) return [];
  const relsXml = await relsFile.async("string");
  const targets = Array.from(relsXml.matchAll(/Target="\.\.\/media\/([^"]+)"/g)).map(m => m[1]);
  const charts: string[] = [];
  for (const t of targets) {
    if (!t.toLowerCase().endsWith(".png")) continue; // jpeg = evidence screenshot, keep
    const media = zip.file(`ppt/media/${t}`);
    if (!media) continue;
    const buf = await media.async("nodebuffer");
    const size = pngSize(buf);
    if (!size) continue;
    if (size.w < 600) continue;   // logo strip
    if (size.w >= 1200) continue; // evidence screenshot
    charts.push(t);
  }
  return charts;
}

/* ────────────────────────────────────────────────────────────────────────
   Data fetching + metric computation
   ──────────────────────────────────────────────────────────────────────── */
async function computeAllBatches(collegeId: string, month: number, year: number, problemsAssigned: number): Promise<{
  batches: { name: string; metrics: BatchMetrics }[];
}> {
  const db = await getDb();
  const monthPrefix = `${year}-${String(month + 1).padStart(2, "0")}`;

  const students: StudentRow[] = await db.all(
    "SELECT id, name, classGroup, classgroup, department, efset_score, hire_score, leetcode_link FROM students WHERE college_id = ?",
    [collegeId]
  ).catch(() => []);

  const attendance: AttendanceRow[] = await db.all(
    `SELECT sa.studentId, sa.status, sa.dateStr
     FROM student_attendance sa
     WHERE sa.dateStr LIKE ? AND sa.studentId IN (SELECT id FROM students WHERE college_id = ?)`,
    [`${monthPrefix}%`, collegeId]
  ).catch(() => []);

  // LeetCode solved totals keyed by email / cleaned register number
  const lcRows: any[] = await db.all(
    "SELECT email, register_number, solved_total FROM lc_students"
  ).catch(() => []);
  const cleanReg = (r: any) => String(r || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const lcByEmail = new Map<string, number>();
  const lcByReg = new Map<string, number>();
  lcRows.forEach((r: any) => {
    const solved = Number(r.solved_total || 0);
    if (r.email) lcByEmail.set(String(r.email).toLowerCase().trim(), solved);
    if (r.register_number) lcByReg.set(cleanReg(r.register_number), solved);
  });

  const studentIds: any[] = await db.all(
    "SELECT id, email, register_number, roll_number FROM students WHERE college_id = ?",
    [collegeId]
  ).catch(() => []);
  const leetcodeByStudentId = new Map<string, number>();
  studentIds.forEach((s: any) => {
    let solved = s.email ? lcByEmail.get(String(s.email).toLowerCase().trim()) : undefined;
    if (solved === undefined) {
      const reg = cleanReg(s.register_number || s.roll_number);
      if (reg) solved = lcByReg.get(reg);
    }
    if (solved !== undefined) leetcodeByStudentId.set(s.id, solved);
  });

  const batches = groupStudentsByBatch(students);
  const out: { name: string; metrics: BatchMetrics }[] = [];
  batches.forEach((rows, name) => {
    if (rows.length === 0) return;
    out.push({
      name,
      metrics: computeBatchReport({
        batchName: name,
        students: rows,
        attendance,
        leetcodeByStudentId,
        problemsAssigned,
        monthPrefix,
        periodLabel: `${MONTH_NAMES[month] || ""} ${year}`.trim()
      })
    });
  });
  out.sort((a, b) => b.metrics.totalStudents - a.metrics.totalStudents);
  return { batches: out };
}

/* ────────────────────────────────────────────────────────────────────────
   Supabase Cloud workflow integration (report_approvals, snaps, tickets)
   ──────────────────────────────────────────────────────────────────────── */
const SUPABASE_REST_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://scuvqabxqqtvibjutoyj.supabase.co";
const SUPABASE_REST_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_wptvdh6rVvEy2uSppa4Ckw_ozPuC6L4";

const COLLEGE_NAME_MAP: Record<string, string> = {
  "clg_c": "Kamaraj College",
  "kamaraj": "Kamaraj College",
  "college_sdnb": "SDNB Vaishnav College for Women",
  "sdnb": "SDNB Vaishnav College for Women",
  "amet": "AMET University",
  "joy": "JOY University",
  "sasurie": "Sasurie College of Arts and Science",
  "sacas": "Sri Amaraavathi College of Arts & Science",
  "amaraavathi": "Sri Amaraavathi College of Arts & Science",
  "study_world": "Study World Group of Institutions"
};

async function fetchSupabaseMonthlyWorkflow(collegeId: string, month: number, year: number) {
  const ym = `${year}-${String(month + 1).padStart(2, "0")}`;
  const cname = COLLEGE_NAME_MAP[collegeId.toLowerCase()] || collegeId;
  const encCname = encodeURIComponent(cname);
  const headers = {
    apikey: SUPABASE_REST_KEY,
    Authorization: `Bearer ${SUPABASE_REST_KEY}`
  };

  try {
    const [raRes, csRes, tkRes, dlRes] = await Promise.all([
      fetch(`${SUPABASE_REST_URL}/rest/v1/report_approvals?college=ilike.*${encCname}*&report_month=eq.${ym}&limit=1`, { headers }).catch(() => null),
      fetch(`${SUPABASE_REST_URL}/rest/v1/classroom_snaps?college=ilike.*${encCname}*&observation_date=gte.${ym}-01&observation_date=lte.${ym}-31&select=id,overall_rating,satisfaction_status`, { headers }).catch(() => null),
      fetch(`${SUPABASE_REST_URL}/rest/v1/tickets?college=ilike.*${encCname}*&created_at=gte.${ym}-01T00:00:00Z&created_at=lte.${ym}-31T23:59:59Z&select=id,status`, { headers }).catch(() => null),
      fetch(`${SUPABASE_REST_URL}/rest/v1/daily_logs?college=ilike.*${encCname}*&log_date=gte.${ym}-01&log_date=lte.${ym}-31&order=log_date.desc,created_at.desc&select=id,log_date,manager_name,category,call_type,activity,progress_notes,reviewed,reviewed_by,reviewed_at`, { headers }).catch(() => null)
    ]);

    const raData = raRes ? await raRes.json().catch(() => []) : [];
    const csData = csRes ? await csRes.json().catch(() => []) : [];
    const tkData = tkRes ? await tkRes.json().catch(() => []) : [];
    const dlData = dlRes ? await dlRes.json().catch(() => []) : [];

    const approval = Array.isArray(raData) && raData.length > 0 ? raData[0] : null;
    const snapsList = Array.isArray(csData) ? csData : [];
    const ticketsList = Array.isArray(tkData) ? tkData : [];
    const logsList = Array.isArray(dlData) ? dlData : [];

    const totalSnaps = snapsList.length;
    let sumRating = 0;
    let satisfiedCount = 0;
    snapsList.forEach((s: any) => {
      const r = parseFloat(String(s.overall_rating || 0));
      if (!isNaN(r)) sumRating += r;
      if (String(s.satisfaction_status).toLowerCase() === "satisfied") satisfiedCount++;
    });

    const totalTickets = ticketsList.length;
    const resolvedTickets = ticketsList.filter((t: any) => String(t.status).toLowerCase() === "resolved").length;
    const inProgressTickets = ticketsList.filter((t: any) => String(t.status).toLowerCase() === "progress").length;
    const unresolvedTickets = totalTickets - resolvedTickets - inProgressTickets;

    const totalLogs = logsList.length;
    const reviewedLogs = logsList.filter((l: any) => l.reviewed).length;
    const pendingLogs = totalLogs - reviewedLogs;
    const hardCalls = logsList.filter((l: any) => l.call_type === "hard").length;
    const softCalls = totalLogs - hardCalls;

    return {
      approval,
      classroomSnaps: {
        total: totalSnaps,
        satisfiedCount,
        notSatisfiedCount: totalSnaps - satisfiedCount,
        satisfactionPct: totalSnaps > 0 ? Math.round((satisfiedCount / totalSnaps) * 100) : 0,
        averageRating: totalSnaps > 0 ? Math.round((sumRating / totalSnaps) * 10) / 10 : 0
      },
      tickets: {
        total: totalTickets,
        resolved: resolvedTickets,
        inProgress: inProgressTickets,
        unresolved: Math.max(0, unresolvedTickets),
        resolutionRatePct: totalTickets > 0 ? Math.round((resolvedTickets / totalTickets) * 100) : 100
      },
      dailyLogs: {
        total: totalLogs,
        reviewedCount: reviewedLogs,
        pendingCount: Math.max(0, pendingLogs),
        hardCallsCount: hardCalls,
        softCallsCount: softCalls,
        reviewRatePct: totalLogs > 0 ? Math.round((reviewedLogs / totalLogs) * 100) : 100,
        logs: logsList.slice(0, 50)
      }
    };
  } catch (e) {
    console.error("fetchSupabaseMonthlyWorkflow error:", e);
    return {
      approval: null,
      classroomSnaps: { total: 0, satisfiedCount: 0, notSatisfiedCount: 0, satisfactionPct: 0, averageRating: 0 },
      tickets: { total: 0, resolved: 0, inProgress: 0, unresolved: 0, resolutionRatePct: 100 },
      dailyLogs: { total: 0, reviewedCount: 0, pendingCount: 0, hardCallsCount: 0, softCallsCount: 0, reviewRatePct: 100, logs: [] }
    };
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const collegeId = searchParams.get("collegeId") || "";
    const month = parseInt(searchParams.get("month") || String(new Date().getMonth()), 10);
    const year = parseInt(searchParams.get("year") || String(new Date().getFullYear()), 10);
    const problemsAssigned = parseInt(searchParams.get("problemsAssigned") || "20", 10);

    if (!collegeId) {
      return NextResponse.json({ success: false, message: "Missing collegeId" }, { status: 400 });
    }
    if (!fs.existsSync(TEMPLATE_PATH)) {
      return NextResponse.json({ success: false, message: "Report template not found on server." }, { status: 500 });
    }

    const [batchResult, workflow] = await Promise.all([
      computeAllBatches(collegeId, month, year, problemsAssigned),
      fetchSupabaseMonthlyWorkflow(collegeId, month, year)
    ]);

    return NextResponse.json({
      success: true,
      month: MONTH_NAMES[month],
      year,
      hasCollegeLogo: fs.existsSync(path.join(LOGOS_DIR, `${collegeId}.png`)),
      workflow,
      batches: batchResult.batches.map(b => ({ batchName: b.name, ...b.metrics }))
    });
  } catch (err: any) {
    console.error("GET /api/reports/skill-development error:", err);
    return NextResponse.json({ success: false, message: err?.message || "Failed to compute report data" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const collegeId = body.collegeId || "";
    const month = typeof body.month === "number" ? body.month : parseInt(body.month || String(new Date().getMonth()), 10);
    const year = typeof body.year === "number" ? body.year : parseInt(body.year || String(new Date().getFullYear()), 10);
    const problemsAssigned = parseInt(body.problemsAssigned || "20", 10);
    const campusName = body.campusName || "CAMPUS";

    if (!collegeId) {
      return NextResponse.json({ success: false, message: "Missing collegeId" }, { status: 400 });
    }
    if (!fs.existsSync(TEMPLATE_PATH)) {
      return NextResponse.json({ success: false, message: "Report template not found on server." }, { status: 500 });
    }

    const { batches } = await computeAllBatches(collegeId, month, year, problemsAssigned);
    if (batches.length === 0) {
      return NextResponse.json({ success: false, message: "No student batches found for this campus." }, { status: 400 });
    }

    const zip = await JSZip.loadAsync(fs.readFileSync(TEMPLATE_PATH));
    const monthName = MONTH_NAMES[month] || String(month);
    const used = batches.slice(0, BATCH_SLOTS.length);

    // ── College-based logo: replace the logo strip if a per-college PNG exists ──
    // The template's logo (image6.png, 446×113) appears on every slide via shared media.
    const logoPath = path.join(LOGOS_DIR, `${collegeId}.png`);
    if (fs.existsSync(logoPath)) {
      // Overwrite the original logo file in place — every slide referencing it updates.
      zip.file("ppt/media/image6.png", fs.readFileSync(logoPath));
    }

    // ── Title slide ─────────────────────────────────────────────────────
    const slide1 = zip.file("ppt/slides/slide1.xml");
    if (slide1) {
      let xml = await slide1.async("string");
      xml = setRun(xml, 0, campusName.toUpperCase());
      xml = setRun(xml, 2, monthName);
      xml = setRun(xml, 3, ` ${year}`);
      zip.file("ppt/slides/slide1.xml", xml);
    }

    // ── F3: Table of Contents (slides 2–4) — batch names/years/month ────
    // Run layout (verified against template): slide 2 run 3 = batch-1 title,
    // run 13 = batch-2 title; slide 3 runs 3/13 = batch-3/4 titles;
    // slide 4 run 3 = "Month". Page-number runs stay as-is.
    const toc2 = zip.file("ppt/slides/slide2.xml");
    if (toc2) {
      let xml = await toc2.async("string");
      if (used[0]) xml = setRun(xml, 3, buildBatchTitle(used[0].name).title);
      if (used[1]) xml = setRun(xml, 13, buildBatchTitle(used[1].name).title);
      zip.file("ppt/slides/slide2.xml", xml);
    }
    const toc3 = zip.file("ppt/slides/slide3.xml");
    if (toc3) {
      let xml = await toc3.async("string");
      if (used[2]) xml = setRun(xml, 3, buildBatchTitle(used[2].name).title);
      if (used[3]) xml = setRun(xml, 13, buildBatchTitle(used[3].name).title);
      zip.file("ppt/slides/slide3.xml", xml);
    }
    const toc4 = zip.file("ppt/slides/slide4.xml");
    if (toc4) {
      let xml = await toc4.async("string");
      xml = setRun(xml, 3, monthName);
      zip.file("ppt/slides/slide4.xml", xml);
    }

    // ── Per-batch slides ────────────────────────────────────────────────
    for (let i = 0; i < BATCH_SLOTS.length; i++) {
      const slot = BATCH_SLOTS[i];
      const batch = used[i];
      const title = batch ? buildBatchTitle(batch.name) : null;

      // Batch title card
      const titleFile = zip.file(`ppt/slides/slide${slot.titleSlide}.xml`);
      if (titleFile) {
        let xml = await titleFile.async("string");
        if (title) {
          xml = setRun(xml, 1, `${title.title} `);
          xml = setRun(xml, 2, title.years);
        }
        zip.file(`ppt/slides/slide${slot.titleSlide}.xml`, xml);
      }

      if (batch) {
        const m = batch.metrics;

        // Attendance narrative (shape-level replacement kills stale split runs)
        const attFile = zip.file(`ppt/slides/slide${slot.attendance}.xml`);
        if (attFile) {
          let xml = await attFile.async("string");
          xml = replaceLongestShapeText(xml, m.attendance.narrative);
          zip.file(`ppt/slides/slide${slot.attendance}.xml`, xml);
        }

        // Technical slide: patch the assigned/solved runs if present, else shape-replace
        const techFile = zip.file(`ppt/slides/slide${slot.tech}.xml`);
        if (techFile) {
          let xml = await techFile.async("string");
          xml = replaceLongestShapeText(
            xml,
            `Students underwent rigorous training in coding skills, focusing on solving practical programming problems on the Leet Code platform. A total of ${m.technical.problemsAssigned} homework problems were assigned to enhance their technical proficiency and problem-solving abilities. On average, students successfully solved ${m.technical.problemsSolvedAvg} out of ${m.technical.problemsAssigned} problems, indicating ${m.technical.classAveragePct >= 60 ? "a good" : m.technical.classAveragePct >= 40 ? "a moderate" : "a developing"} level of performance. While several students demonstrated strong coding skills by achieving high scores, a few students showed potential and can perform well with additional guidance and support.`
          );
          zip.file(`ppt/slides/slide${slot.tech}.xml`, xml);
        }

        // F1: Technical evidence slide — the "Evaluation / Class Average /
        // Profile Building Report" sections share ONE shape, so the
        // replacement must carry all three with computed numbers. Without
        // this, the template's original numbers (e.g. May's "50.89%") ship
        // unchanged every month.
        const evFile = zip.file(`ppt/slides/slide${slot.techEvidence}.xml`);
        if (evFile) {
          let xml = await evFile.async("string");
          const t = m.technical;
          xml = replaceShapeTextContaining(
            xml,
            "class average",
            `Evaluation: Each student's performance was assessed based on the number of problems solved and the depth of understanding demonstrated. Scores were then converted into percentages to ensure accurate and detailed progress tracking. Class Average: The class achieved an average score of ${t.classAveragePct}%, reflecting ${t.classAveragePct >= 60 ? "a good" : t.classAveragePct >= 40 ? "a moderate" : "a developing"} level of coding capability with opportunities for further growth. Profile Building Report: Students focused on enhancing their coding profiles by actively engaging in problem-solving on the Leet Code platform, building a verifiable record of their technical progress.`
          );
          zip.file(`ppt/slides/slide${slot.techEvidence}.xml`, xml);
        }

        // Communication narrative
        const commFile = zip.file(`ppt/slides/slide${slot.comm}.xml`);
        if (commFile) {
          let xml = await commFile.async("string");
          xml = replaceLongestShapeText(xml, m.communication.narrative);
          zip.file(`ppt/slides/slide${slot.comm}.xml`, xml);
        }

        // Academic narrative
        const acadFile = zip.file(`ppt/slides/slide${slot.acad}.xml`);
        if (acadFile) {
          let xml = await acadFile.async("string");
          xml = replaceLongestShapeText(xml, m.academic.narrative);
          zip.file(`ppt/slides/slide${slot.acad}.xml`, xml);
        }
      }

      // ── Charts: discover this slide's chart-sized images and overwrite ──
      if (batch) {
        const m = batch.metrics;

        // Attendance slide → donut chart on every chart-sized image
        for (const media of await getChartMediaForSlide(zip, slot.attendance)) {
          zip.file(`ppt/media/${media}`, await renderAttendanceChartPNG({
            excellent: m.attendance.excellent,
            good: m.attendance.good,
            average: m.attendance.average,
            poor: m.attendance.poor
          }));
        }

        // Technical slide → tall chart images get the distribution bars,
        // short ones get the class-average card (matches template layout:
        // bars ≈ 885×486, average card ≈ 879×375).
        for (const media of await getChartMediaForSlide(zip, slot.tech)) {
          const mediaFile = zip.file(`ppt/media/${media}`);
          if (!mediaFile) continue;
          const size = pngSize(await mediaFile.async("nodebuffer"));
          if (size && size.h <= 400) {
            zip.file(`ppt/media/${media}`, await renderClassAveragePNG(
              m.technical.classAveragePct, m.technical.problemsAssigned, m.technical.problemsSolvedAvg
            ));
          } else {            zip.file(`ppt/media/${media}`, await renderDistributionChartPNG({
            bars: [
              { label: "Problems Assigned", value: m.technical.problemsAssigned, color: "#94a3b8" },
                { label: "Avg Problems Solved", value: m.technical.problemsSolvedAvg, color: "#6366f1" }
              ]
            }));
          }
        }

        // F2: Evidence slide may carry a chart-sized image (e.g. slide 20's
        // class-average card, image24 883×375). Screenshots (≥1200px wide) are
        // excluded by the discovery size rule, so only real charts get patched.
        for (const media of await getChartMediaForSlide(zip, slot.techEvidence)) {
          zip.file(`ppt/media/${media}`, await renderClassAveragePNG(
            m.technical.classAveragePct, m.technical.problemsAssigned, m.technical.problemsSolvedAvg
          ));
        }

        // Communication slide → CEFR distribution
        for (const media of await getChartMediaForSlide(zip, slot.comm)) {
          zip.file(`ppt/media/${media}`, await renderDistributionChartPNG({
            bars: [
              { label: "A1 (Beginner)", value: m.communication.a1, color: "#f87171" },
              { label: "A2 (Elementary)", value: m.communication.a2, color: "#fbbf24" },
              { label: "B1 (Intermediate)", value: m.communication.b1, color: "#60a5fa" },
              { label: "B2 (Upper-Int.)", value: m.communication.b2, color: "#34d399" },
              { label: "C1+", value: m.communication.c1, color: "#10b981" },
              { label: "Absent / Unassessed", value: m.communication.absent, color: "#cbd5e1" }
            ]
          }));
        }

        // Academic slide → aptitude brackets
        for (const media of await getChartMediaForSlide(zip, slot.acad)) {
          zip.file(`ppt/media/${media}`, await renderDistributionChartPNG({
            bars: [
              { label: "Below 40%", value: m.academic.below40, color: "#ef4444" },
              { label: "40–60%", value: m.academic.between40and60, color: "#f59e0b" },
              { label: "Above 60%", value: m.academic.above60, color: "#22c55e" }
            ]
          }));
        }
      }
    }

    // ── Rezip and stream ────────────────────────────────────────────────
    const outBuf = await zip.generateAsync({
      type: "nodebuffer",
      compression: "DEFLATE",
      compressionOptions: { level: 6 }
    });

    const fileName = `Skill Development Report - ${monthName} ${year} ${campusName.replace(/[^a-zA-Z0-9 ]/g, "")}.pptx`;
    return new NextResponse(new Uint8Array(outBuf), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Content-Length": String(outBuf.length)
      }
    });
  } catch (err: any) {
    console.error("POST /api/reports/skill-development error:", err);
    return NextResponse.json({ success: false, message: err?.message || "Failed to generate report" }, { status: 500 });
  }
}
