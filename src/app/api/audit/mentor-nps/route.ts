// Pin to Mumbai (bom1) — co-located with Supabase DB
export const preferredRegion = "bom1";
export const maxDuration = 60;

import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import {
  MENTOR_FEEDBACK_MONTHS,
  findTrendSheetForCollege,
  gvizUrl,
  sheetCsvExportUrl,
  normCollegeName
} from "@/lib/audit-sources";

// ── Types ────────────────────────────────────────────────────────────────────

interface MentorNpsRow {
  mentor: string;
  depts: string[];
  rating: number;
  responses: number;
  percentile: number;
  rank: number;
  qs: { y: number; n: number }[];
}

interface NpsSummary {
  npsIndex: number | null;
  promoters: number;
  passives: number;
  detractors: number;
  total: number;
  avg: number;
}

interface TrendPoint {
  month: string;
  nps: number | null;
  rating: number | null;
  responses: number | null;
  promoters?: number | null;
  passives?: number | null;
  detractors?: number | null;
}

const QUESTION_DEFS = [
  "Session delivery & clarity",
  "Professionalism & classroom conduct",
  "Concept explanation & problem solving",
  "Doubt resolution & support",
  "Learning outcomes & skill development"
];

// ── CSV parsing (handles quoted cells with commas/newlines) ─────────────────

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let cur: string[] = [];
  let cell = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; }
        else inQuotes = false;
      } else cell += ch;
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      cur.push(cell); cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      cur.push(cell); rows.push(cur); cur = []; cell = "";
    } else {
      cell += ch;
    }
  }
  if (cell.length > 0 || cur.length > 0) { cur.push(cell); rows.push(cur); }
  return rows.filter(r => r.some(c => (c || "").trim() !== ""));
}

function rowsToObjects(rows: string[][]): Record<string, string>[] {
  if (!rows.length) return [];
  const headers = rows[0].map(h => (h || "").trim());
  return rows.slice(1).map(r => {
    const o: Record<string, string> = {};
    headers.forEach((h, i) => { o[h] = (r[i] || "").trim(); });
    return o;
  });
}

// In-memory TTL cache for Google Sheets CSVs (plan item 17): one dead/slow
// sheet used to stall every request; repeated requests re-fetched live.
const SHEETS_CACHE_TTL_MS = 5 * 60 * 1000;
const sheetsCache = new Map<string, { at: number; rows: Record<string, string>[] }>();
const SHEETS_FETCH_TIMEOUT_MS = 8000;

async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SHEETS_FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { cache: "no-store", signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchCollegeRows(monthSheetId: string, collegeName: string): Promise<Record<string, string>[]> {
  const cacheKey = `${monthSheetId}::${collegeName}`;
  const hit = sheetsCache.get(cacheKey);
  if (hit && Date.now() - hit.at < SHEETS_CACHE_TTL_MS) return hit.rows;

  const url = gvizUrl(monthSheetId, collegeName);
  try {
    const res = await fetchWithTimeout(url);
    if (!res.ok) return [];
    const text = await res.text();
    if (text.trim().startsWith("<")) return []; // sheet tab missing → HTML error page
    const rows = rowsToObjects(parseCsv(text));
    sheetsCache.set(cacheKey, { at: Date.now(), rows });
    return rows;
  } catch (err: any) {
    if (err?.name === "AbortError") {
      console.warn(`[mentor-nps] Sheet fetch timed out after ${SHEETS_FETCH_TIMEOUT_MS}ms: ${cacheKey}`);
    }
    return [];
  }
}

// ── Helper parsing and month normalization ──────────────────────────────────

function parseNps(v: any): number | null {
  if (v == null || v === "" || v === "NA" || v === "N/A" || v === "-") return null;
  const n = parseFloat(String(v).trim());
  return isNaN(n) ? null : Math.round(n);
}

export function normMonthKey(m: string): string {
  const s = String(m || "").trim().toLowerCase();
  const ymMatch = s.match(/^(\d{4})-(\d{1,2})$/);
  if (ymMatch) {
    const yr = ymMatch[1];
    const mo = parseInt(ymMatch[2], 10);
    return `${yr}-${String(mo).padStart(2, "0")}`;
  }
  const parts = s.split(/[\s,._-]+/).filter(Boolean);
  let yr = "", mo = "";
  for (const p of parts) {
    if (/^\d{4}$/.test(p)) yr = p;
    else if (/^(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)/.test(p)) {
      const idx = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"].findIndex(
        n => p.startsWith(n) || (n === "sep" && p.startsWith("sept"))
      );
      if (idx !== -1) mo = String(idx + 1).padStart(2, "0");
    }
  }
  if (yr && mo) return `${yr}-${mo}`;
  return s;
}

function iv(v: any): number | null {
  if (v == null || v === "" || v === "NA" || v === "N/A" || v === "-") return null;
  const n = parseInt(String(v).replace(/[^0-9-]/g, ""), 10);
  return isNaN(n) ? null : n;
}

function fv(v: any): number | null {
  if (v == null || v === "" || v === "NA" || v === "N/A" || v === "-") return null;
  const n = parseFloat(String(v).replace(/[^0-9.-]/g, ""));
  return isNaN(n) ? null : Math.round(n * 100) / 100;
}

const MONTH_ORDER: Record<string, number> = { Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6, Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12 };

function parseCycle(c: string): number {
  const parts = (c || "").split(" ");
  return (parseInt(parts[1], 10) || 0) * 100 + (MONTH_ORDER[parts[0]] || 0);
}

function findCol(headers: string[], candidates: string[]): string | null {
  const norm = (s: string) => (s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  for (const c of candidates) {
    const hit = headers.find(h => norm(h) === norm(c));
    if (hit) return hit;
  }
  for (const c of candidates) {
    const hit = headers.find(h => norm(h).includes(norm(c)));
    if (hit) return hit;
  }
  return null;
}

async function fetchTrend(collegeName: string): Promise<TrendPoint[]> {
  const cfg = findTrendSheetForCollege(collegeName);
  if (!cfg) return [];
  for (const gid of cfg.gids) {
    try {
      const res = await fetchWithTimeout(sheetCsvExportUrl(cfg.sheetId, gid));
      if (!res.ok) continue;
      const text = await res.text();
      if (text.trim().startsWith("<")) continue;
      const rows = rowsToObjects(parseCsv(text));
      if (!rows.length) continue;
      const headers = Object.keys(rows[0]);
      const cMonth = findCol(headers, ["month", "cycle", "period", "term", "batch"]);
      const cResponses = findCol(headers, ["no. of responses", "responses", "total_responses", "count"]);
      const cRating = findCol(headers, ["average rating", "avg rating", "rating"]);
      const cNps = findCol(headers, ["nps score", "nps index", "nps"]);
      const cPromoters = findCol(headers, ["no. of promoters", "promoters"]);
      const cNeutral = findCol(headers, ["no. of neutral", "neutral", "no. of passives", "passives"]);
      const cDetractors = findCol(headers, ["no. of detractors", "detractors"]);
      if (!cMonth) continue;

      const points = rows.map(r => ({
        month: (r[cMonth] || "").trim(),
        nps: cNps ? parseNps(r[cNps]) : null,
        rating: cRating ? fv(r[cRating]) : null,
        responses: cResponses ? iv(r[cResponses]) : null,
        promoters: cPromoters ? iv(r[cPromoters]) : null,
        passives: cNeutral ? iv(r[cNeutral]) : null,
        detractors: cDetractors ? iv(r[cDetractors]) : null
      })).filter(p => p.month);

      if (points.length) {
        points.sort((a, b) => parseCycle(a.month) - parseCycle(b.month));
        return points;
      }
    } catch (_) { /* try next gid */ }
  }
  return [];
}

// ── Metrics (identical math to mentor-feedback.html) ─────────────────────────

function computeNps(rows: Record<string, string>[]): NpsSummary {
  const scores: number[] = [];
  for (const r of rows) {
    const raw = r["nps_score"] || r["NPS Score"] || r["nps score"] || r["NPSScore"] || "";
    const v = parseInt(raw, 10);
    if (!isNaN(v) && v >= 1 && v <= 10) scores.push(v);
  }

  // If explicit 1-10 nps_score column is missing in evaluation form, derive student sentiment from mentor ratings
  if (scores.length === 0) {
    for (const r of rows) {
      const studentRatings: number[] = [];
      for (let i = 1; i <= 15; i++) {
        const rt = parseFloat(r[`subject${i}_Rating`]);
        if (!isNaN(rt) && rt > 0) studentRatings.push(rt);
      }
      if (studentRatings.length > 0) {
        const studentAvg = studentRatings.reduce((a, b) => a + b, 0) / studentRatings.length;
        // Standard 5-point scale NPS classification:
        // Avg >= 4.5 -> Promoter (mapped to 10)
        // Avg >= 3.5 -> Passive (mapped to 8)
        // Avg < 3.5  -> Detractor (mapped to 5)
        const mappedScore = studentAvg >= 4.5 ? 10 : studentAvg >= 3.5 ? 8 : 5;
        scores.push(mappedScore);
      }
    }
  }

  const total = scores.length;
  const promoters = scores.filter(s => s >= 9).length;
  const passives = scores.filter(s => s >= 7 && s <= 8).length;
  const detractors = scores.filter(s => s <= 6).length;
  const npsIndex = total > 0 ? Math.round((promoters / total - detractors / total) * 100) : null;
  const avg = total > 0 ? Math.round((scores.reduce((a, b) => a + b, 0) / total) * 10) / 10 : 0;
  return { npsIndex, promoters, passives, detractors, total, avg };
}

function computeMentors(rows: Record<string, string>[]): MentorNpsRow[] {
  interface Acc { name: string; depts: Set<string>; ratings: number[]; qs: { y: number; n: number }[] }
  const acc: Record<string, Acc> = {};
  let globalSum = 0, globalCount = 0;

  for (const r of rows) {
    const dept = (r["department"] || r["Department"] || r["dept"] || "General").trim() || "General";
    for (let i = 1; i <= 15; i++) {
      const mn = (r[`subject${i}_Mentor`] || "").trim();
      const rt = parseFloat(r[`subject${i}_Rating`]);
      if (!mn || isNaN(rt) || rt <= 0) continue;
      globalSum += rt; globalCount++;
      if (!acc[mn]) acc[mn] = { name: mn, depts: new Set(), ratings: [], qs: Array.from({ length: 5 }, () => ({ y: 0, n: 0 })) };
      acc[mn].depts.add(dept);
      acc[mn].ratings.push(rt);
      for (let q = 1; q <= 5; q++) {
        const ans = (r[`subject${i}_Q${q}`] || "").trim();
        if (ans === "Yes") acc[mn].qs[q - 1].y++;
        else if (ans === "No") acc[mn].qs[q - 1].n++;
      }
    }
  }

  const globalMean = globalCount > 0 ? globalSum / globalCount : 0;
  const list = Object.values(acc);
  const mentorCount = list.length || 1;
  const C = globalCount / mentorCount; // bayesian prior weight

  const scored = list.map(m => {
    const mAvg = m.ratings.reduce((a, b) => a + b, 0) / m.ratings.length;
    const bayesian = (globalMean * C + mAvg * m.ratings.length) / (C + m.ratings.length);
    return {
      mentor: m.name,
      depts: Array.from(m.depts),
      rating: Math.round(mAvg * 100) / 100,
      responses: m.ratings.length,
      qs: m.qs,
      bayesian
    };
  }).sort((a, b) => b.bayesian - a.bayesian);

  return scored.map((m, idx) => ({
    mentor: m.mentor,
    depts: m.depts,
    rating: m.rating,
    responses: m.responses,
    qs: m.qs,
    rank: idx + 1,
    percentile: scored.length > 1 ? Math.round((1 - idx / (scored.length - 1)) * 100) : 100
  }));
}

function computeFollowups(rows: Record<string, string>[]) {
  const defs = [
    { id: "campus", col: "nps_fu1_campusSatisfied", label: "Campus experience" },
    { id: "classroom", col: "nps_fu2_classroomSatisfied", label: "Classroom engagement" },
    { id: "skill", col: "nps_fu3_skillDev", label: "Skill development" },
    { id: "placement", col: "nps_fu4_placement", label: "Placement opportunities" }
  ];
  return defs.map(d => {
    let yes = 0, no = 0;
    for (const r of rows) {
      const a = (r[d.col] || "").trim();
      if (a === "Yes") yes++;
      else if (a === "No") no++;
    }
    const total = yes + no;
    return { id: d.id, label: d.label, yes, no, total, pct: total > 0 ? Math.round((yes / total) * 100) : null };
  });
}



// ── Postgres cache (survives when Sheets are slow/unavailable) ───────────────

// Cache table DDL lives in lib/migrations.ts — ensured once per process.
async function ensureCacheTable(db: any) {
  const { ensureMigration } = await import("@/lib/migrations");
  await ensureMigration("mentor_nps_monthly_cache");
}

async function readCache(db: any, collegeName: string): Promise<any[]> {
  try {
    // Ensure the table exists before reading — previously this was a silent
    // no-op on fresh deploys, so the cache fallback never populated.
    await ensureCacheTable(db);
    return await db.all(
      "SELECT month_key, nps_index, promoters, passives, detractors, total_responses, avg_rating, mentor_count, payload, synced_at FROM mentor_nps_monthly WHERE college_name = ? ORDER BY month_key ASC",
      collegeName
    );
  } catch (err) {
    console.warn("Mentor NPS cache read failed:", err);
    return [];
  }
}

// ── Handler ──────────────────────────────────────────────────────────────────

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const collegeName = (searchParams.get("college") || "").trim();
    const monthKey = searchParams.get("month") || "all";
    const mode = searchParams.get("mode") || "summary"; // summary | trend
    if (!collegeName) {
      return NextResponse.json({ success: false, message: "Missing ?college=" }, { status: 400 });
    }

    // ── Trend points from dedicated workbook ──────────────────────────────────
    const trendPoints = await fetchTrend(collegeName);

    // Dynamic list of available months aggregated from trend workbook + live response sheets
    const availableMonthsMap = new Map<string, { key: string; label: string }>();
    for (const tp of trendPoints) {
      const k = normMonthKey(tp.month);
      if (k && !availableMonthsMap.has(k)) {
        availableMonthsMap.set(k, { key: k, label: tp.month });
      }
    }
    for (const m of MENTOR_FEEDBACK_MONTHS) {
      if (!availableMonthsMap.has(m.key)) {
        availableMonthsMap.set(m.key, { key: m.key, label: m.label });
      }
    }
    const availableMonths = Array.from(availableMonthsMap.values()).sort((a, b) => b.key.localeCompare(a.key));

    // ── Trend mode: return monthly history
    if (mode === "trend") {
      let points = trendPoints;
      if (!points.length) {
        const cached = await readCache(await getDb(), collegeName);
        points = cached.map(c => ({
          month: c.month_key,
          nps: c.nps_index != null ? Number(c.nps_index) : null,
          rating: c.avg_rating != null ? Number(c.avg_rating) : null,
          responses: c.total_responses != null ? Number(c.total_responses) : null
        }));
      }
      return NextResponse.json({ success: true, college: collegeName, trend: points });
    }

    // ── Summary mode
    const matchingSheetMonths = monthKey === "all"
      ? MENTOR_FEEDBACK_MONTHS
      : MENTOR_FEEDBACK_MONTHS.filter(m => normMonthKey(m.key) === normMonthKey(monthKey));

    // If specific historical month is requested not in MENTOR_FEEDBACK_MONTHS, still query all sheets
    // so we have the mentor roster, department ratings, and pedagogical survey responses for this college
    const querySheets = matchingSheetMonths.length > 0 ? matchingSheetMonths : MENTOR_FEEDBACK_MONTHS;

    let allRows: Record<string, string>[] = [];
    const perMonth: { key: string; label: string; total: number; npsIndex: number | null }[] = [];

    if (querySheets.length) {
      const results = await Promise.allSettled(
        querySheets.map(m => fetchCollegeRows(m.sheetId, collegeName))
      );
      results.forEach((r, idx) => {
        const rows = r.status === "fulfilled" ? r.value : [];
        if (rows.length) {
          allRows = allRows.concat(rows);
          const nps = computeNps(rows);
          perMonth.push({ key: querySheets[idx].key, label: querySheets[idx].label, total: nps.total, npsIndex: nps.npsIndex });
        }
      });
    }

    // Merge trend workbook months into perMonth overview
    for (const tp of trendPoints) {
      const k = normMonthKey(tp.month);
      const existing = perMonth.find(pm => normMonthKey(pm.key) === k);
      if (!existing) {
        perMonth.push({
          key: k,
          label: tp.month,
          total: tp.responses || 0,
          npsIndex: tp.nps
        });
      } else if (existing.total === 0 && tp.responses && tp.responses > 0) {
        existing.total = tp.responses;
        existing.npsIndex = tp.nps;
      }
    }

    // Base computation from sheets or cache
    let summary = computeNps(allRows);
    let mentors = computeMentors(allRows);
    let followups = computeFollowups(allRows);

    if (allRows.length === 0 && trendPoints.length === 0) {
      // Sheets and trend unavailable → fall back to cached snapshot
      const db = await getDb();
      const cached = await readCache(db, collegeName);
      if (cached.length) {
        const latest = cached[cached.length - 1];
        let payload: any = null;
        try { payload = latest.payload ? JSON.parse(latest.payload) : null; } catch (_) {}
        return NextResponse.json({
          success: true,
          college: collegeName,
          source: "cache",
          syncedAt: latest.synced_at,
          availableMonths,
          selectedMonth: monthKey,
          perMonth: cached.map(c => ({ key: c.month_key, label: c.month_key, total: c.total_responses, npsIndex: c.nps_index })),
          summary: {
            npsIndex: latest.nps_index != null ? Number(latest.nps_index) : null,
            promoters: Number(latest.promoters) || 0,
            passives: Number(latest.passives) || 0,
            detractors: Number(latest.detractors) || 0,
            total: Number(latest.total_responses) || 0,
            avg: latest.avg_rating != null ? Number(latest.avg_rating) : 0
          },
          mentors: payload?.mentors || [],
          followups: payload?.followups || [],
          questionDefs: QUESTION_DEFS
        });
      }
    }

    // Match requested month against verified institutional trend workbook
    if (monthKey !== "all") {
      const matchingTrend = trendPoints.find(tp => normMonthKey(tp.month) === normMonthKey(monthKey));
      if (matchingTrend) {
        summary = {
          npsIndex: matchingTrend.nps,
          promoters: matchingTrend.promoters ?? summary.promoters,
          passives: matchingTrend.passives ?? summary.passives,
          detractors: matchingTrend.detractors ?? summary.detractors,
          total: matchingTrend.responses ?? summary.total,
          avg: matchingTrend.rating ?? summary.avg
        };
      }
    } else {
      // All months view: if summary has 0 total or null NPS, use the latest verified trend month
      if (summary.total === 0 || summary.npsIndex === null) {
        const validTrend = [...trendPoints].reverse().find(tp => tp.nps !== null && tp.responses && tp.responses > 0);
        if (validTrend) {
          summary = {
            npsIndex: validTrend.nps,
            promoters: validTrend.promoters ?? summary.promoters,
            passives: validTrend.passives ?? summary.passives,
            detractors: validTrend.detractors ?? summary.detractors,
            total: validTrend.responses ?? summary.total,
            avg: validTrend.rating ?? summary.avg
          };
        }
      }
    }

    // Cache per-month snapshots into Postgres (best effort)
    try {
      const db = await getDb();
      await ensureCacheTable(db);
      for (const tp of trendPoints) {
        if (!tp.responses) continue;
        await db.run(
          `INSERT INTO mentor_nps_monthly (college_name, month_key, nps_index, promoters, passives, detractors, total_responses, avg_rating, mentor_count, payload)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT (college_name, month_key) DO UPDATE SET
             nps_index = excluded.nps_index, promoters = excluded.promoters, passives = excluded.passives,
             detractors = excluded.detractors, total_responses = excluded.total_responses,
             avg_rating = excluded.avg_rating, mentor_count = excluded.mentor_count,
             synced_at = CURRENT_TIMESTAMP`,
          [
            collegeName, normMonthKey(tp.month), tp.nps, tp.promoters || 0, tp.passives || 0,
            tp.detractors || 0, tp.responses, tp.rating, mentors.length, null
          ]
        );
      }
    } catch (cacheErr) {
      console.warn("Mentor NPS cache write failed:", cacheErr);
    }

    return NextResponse.json({
      success: true,
      college: collegeName,
      source: allRows.length > 0 ? "sheets" : trendPoints.length > 0 ? "trend_sheet" : "none",
      availableMonths,
      selectedMonth: monthKey,
      perMonth,
      summary,
      mentors,
      followups,
      questionDefs: QUESTION_DEFS
    });
  } catch (err: any) {
    console.error("Mentor NPS API error:", err);
    return NextResponse.json({ success: false, message: err?.message || "Mentor NPS fetch failed" }, { status: 500 });
  }
}
