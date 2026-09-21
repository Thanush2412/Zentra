// Server-only configuration for Campus E-Audit external data sources.
// All credentials live here / in .env — never shipped to the client.

// ── Mentor Feedback (NPS) — Google Sheets (public gviz CSV, same source as mentor-feedback.html) ──

export interface MentorFeedbackMonth {
  key: string;      // e.g. "2026-05"
  label: string;    // e.g. "May 2026"
  sheetId: string;  // monthly spreadsheet containing one tab per college
}

export const MENTOR_FEEDBACK_MONTHS: MentorFeedbackMonth[] = [
  { key: "2026-05", label: "May 2026", sheetId: "19HsWARl8RFNZ6nc-bUCBKKEN39JkQVxCBfbNCUSe2_4" },
  { key: "2026-06", label: "June 2026", sheetId: "1Xlw8LrtUPqWYkAu3X7IGgQLm27weN0OZcDkEjlDXdUA" },
  { key: "2026-07", label: "July 2026", sheetId: "1OKfKmVeG-GQGnq7oeLr-dv2DR7_8XCbDUqKeJMkzZIs" },
];

// Dedicated per-college trend workbooks (historical month-by-month summary rows)
export const MENTOR_TREND_SHEETS: Record<string, { sheetId: string; gids: string[] }> = {
  "Rathinam Global Deemed to be University": { sheetId: "1nDMDazG090HPikkrSohUYXmYfZiO-MaREitGlJHwoKc", gids: ["0", "1707229573"] },
  "Kamaraj College": { sheetId: "1Km7BgYceWvJB-npvqHQNDZsANDHA3vMx-IQcxwzSHvQ", gids: ["0"] },
  "Kamaraj Women's College": { sheetId: "1tm3GP00cWkrttscRBem51yzGvsgwTmAKAUc_hQiOoh4", gids: ["0"] },
  "SDNB Vaishnav College for Women": { sheetId: "12wS05DKTaiYpNsVDHGAJ3Um-7UOXtIb-fyTBwzg9hyM", gids: ["0"] },
  "Patrician College of Arts & Science": { sheetId: "1zc4BbANC3hz21YkpJAqa6ZM8vayo9s7KA8mHwNJeVZA", gids: ["0"] },
  "TERF's College of Arts and Science": { sheetId: "1eRqSECQ5GiVIvmnU8LQlWUS086rybYoVkRXfuzSchpU", gids: ["0"] },
  "Sree Saraswathi Thyagaraja College": { sheetId: "1fn_nVNHw8WHqjHTiuAp671ckTRwJ6WXXfdI_VsckP9o", gids: ["0"] },
  "TJS College of Arts and Science": { sheetId: "1j7JKepMCgyY11wd9w8b86dX8ogeRjkpW51oY1tYItGQ", gids: ["0"] },
  "Bharathidasan College of Arts & Science": { sheetId: "1AUBiDoUvE0bNm1sPFHlrZBAm1shMhEiL4D6QPOAbToo", gids: ["0"] },
  "Nagarathinam Angalammal Arts & Science College": { sheetId: "13c57XwLAYe8hBIfoGXqsmoQm7ACO1CwxRIcr9SNJA_o", gids: ["0"] },
  "Vinayaga Mission's Research Foundation School of Arts & Science": { sheetId: "1v9nkuZjzVLBk_avrOKBGrU-dWjfHA47hrXZAfIyy4aw", gids: ["0"] },
  "Sri Amaraavathi College of Arts & Science": { sheetId: "1TrSEMdtRXBMmjdTb0lb6E4eRCnKTiBAp3ub_CCFrNxc", gids: ["0"] },
  "Takshashila University": { sheetId: "1J8eE1EBGG2Hy3fNjGZd5SBFDaeTYPhc_Ck_GBbmSUwk", gids: ["0"] },
  "Study World Group of Institution": { sheetId: "1cEe2tx81xgABLQyspVB2dWAYep7hi_vSUsLJRH0PNFA", gids: ["0"] },
  "Noorul Islam Centre for Higher Education (NICHE)": { sheetId: "1USRMJpLmFl_Z7H06e7jpqWi_yWb5Fgk6As0HQcYz11w", gids: ["0"] },
  "AMET University": { sheetId: "1SDx1EyxmhhkQ8CK8w0H5W6Y2j2ihFBIGOkDYMWjkSAA", gids: ["0"] },
  "Joy University": { sheetId: "1L9D6-AH-kxTqFInHVaHYx4PeXjOZrTXrCCk-tVgtjrM", gids: ["0"] },
  "Sasurie College of Arts and Science": { sheetId: "1o6-tnTgHLTYF6xmbsVGaEYKKUubkFnBdfT3dzZZR8C4", gids: ["0"] },
  "VLB Janakiammal College Of Arts & Science": { sheetId: "1IeVQaezozzxhXrYyMLZBsNYRI497L6flmoHMbpdCF_A", gids: ["0"] },
  "Sri Ramakrishna College of Arts and Science for Women": { sheetId: "1oU9VMNBjElbz3SBx6op9XTKeBpfeI7ptS6ftYg1wG54", gids: ["0"] },
  "Kongunadu College of Arts and Science": { sheetId: "1VbTXxH4JfUN9Dr9qhryjoon7BhP6nZ4bV2N3Bd2UZ4s", gids: ["0"] },
  "Hindusthan College of Arts & Science": { sheetId: "1_09kSZ53vt7Vw7eVHPBNQJe94LurGqUF-rnXDX4OTVU", gids: ["0"] },
  "St. Agnes College (Autonomous)": { sheetId: "1K1gHOdfJXrD25RA-icYPFjTHhISU25e7qoIWeJl2rCE", gids: ["0"] },
  "Alliance University": { sheetId: "1UXmS5pgi7Qi6fgcD73vuBo-IUURegG5lxU8iIhSuI88", gids: ["0"] },
  "Kristu Jayanti College": { sheetId: "1eMIS_Tw36VNveDHgeVetxqtOLkxpFnf4MwkvsjImyWU", gids: ["0"] },
  "S-VYASA University": { sheetId: "16qL6QKGG48-Bt9r4cHYP9mtpQFQDTH2WfKbdmBk_UiI", gids: ["0"] },
  "Asian School of Business": { sheetId: "1vw_fZ_5RkWNLbe0Y5pTdkplwVZYl2TVZ0LvI4ogezK8", gids: ["0"] },
};

/** Fuzzy college-name matcher tolerant of "&"/"and", "University/College" wording differences. */
export function normCollegeName(s: string): string {
  return (s || "")
    .toLowerCase()
    .replace(/\b(deemed to be university|deemed university|university|college|institute|institution|school|arts and science|arts & science|of|and|&|the)\b/g, "")
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

export function findTrendSheetForCollege(collegeName: string): { sheetId: string; gids: string[] } | null {
  const norm = normCollegeName(collegeName);
  if (!norm) return null;
  for (const [name, cfg] of Object.entries(MENTOR_TREND_SHEETS)) {
    const n = normCollegeName(name);
    if (n === norm || n.includes(norm) || norm.includes(n)) return cfg;
  }
  return null;
}

export function gvizUrl(sheetId: string, sheetName: string): string {
  return `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;
}

export function sheetCsvExportUrl(sheetId: string, gid: string): string {
  return `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;
}

// ── Supabase sources (proxied server-side only) ──
// Both datasets live in the CURRENT E-Campus Supabase project (the legacy rysaj
// project has been migrated away from). Env overrides exist for other deployments.
// Credentials are env-only — no hardcoded fallbacks in source control.

const CURRENT_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const CURRENT_SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

export const PARTNER_FEEDBACK = {
  url: process.env.PARTNER_FEEDBACK_SUPABASE_URL || CURRENT_SUPABASE_URL,
  key: process.env.PARTNER_FEEDBACK_SUPABASE_KEY || CURRENT_SUPABASE_KEY,
  table: "faceprep_feedback",
};

export const CLASSROOM_SNAPS = {
  url: process.env.CLASSROOM_SNAPS_SUPABASE_URL || CURRENT_SUPABASE_URL,
  key: process.env.CLASSROOM_SNAPS_SUPABASE_KEY || CURRENT_SUPABASE_KEY,
  table: "classroom_snaps",
  bucket: "classroom-snaps",
};

export interface SbRow { [key: string]: any }

export async function sbRest(url: string, key: string, path: string, init?: RequestInit): Promise<any> {
  if (!url || !key) throw new Error("Supabase source not configured (missing env key)");
  const res = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(init?.headers || {})
    },
    cache: "no-store"
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Supabase REST ${res.status}: ${text.slice(0, 300)}`);
  }
  const ct = res.headers.get("content-type") || "";
  return ct.includes("json") ? res.json() : res.text();
}

export function sbHeaders(key: string, extra?: Record<string, string>): Record<string, string> {
  return { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...(extra || {}) };
}
