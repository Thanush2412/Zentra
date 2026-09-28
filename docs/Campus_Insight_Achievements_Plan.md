# Plan — Add Student Achievements to Campus Insight (CM Dashboard)

> Status: **Draft for review — no code written yet.**
> Problem: the Campus Insight report center (`CAMCampusInsightPanel` in `src/components/CAMDashboard.tsx`)
> has 10 report tabs (Attendance, Placement, Observations, Mentor NPS, Client NPS, Tickets,
> Workload, Demo Evaluations, Syllabus Pace, All Reports) but **no Student Achievements view**,
> even though verified achievements data already exists and is shown elsewhere.

---

## 1. What already exists (reuse — nothing new to build server-side)

| Building block | Where | Notes |
|---|---|---|
| Achievements API | `src/app/api/achievements/route.ts` (GET/POST/DELETE) | GET `?collegeId=` returns campus-scoped records ordered by `date_str DESC`; GET `?studentId=` for per-student. |
| Table + migration | `student_achievements` via `ensureMigration("student_achievements_table")` in `src/lib/migrations.ts` | Columns: `title, topic, category, description, date_str, badge, reward_prize, event_name, proof_link, photos, student_ids (JSON), student_names (JSON), participation_type, team_name, achievement_level, organizer, added_by`. Indexed on `college_id`, `date_str`. |
| Management console (already live) | `CAMDashboard.tsx` — Events tab → `eventSubTab === "achievements"` (states at ~lines 9141–9166, `fetchAchievements` at ~12004, form + delete + student picker) | CM already records achievements here; they appear in Student Dashboard "Honors", KAM Student360, and Campus E-Audit ("Student Accolades & Achievements" ledger in `CampusAuditManager.tsx`). |
| Campus Insight patterns | `CAMCampusInsightPanel` (line ~611): `selectedSubTab` union, lazy-fetch-on-open effects (~lines 741–752), filter selects in the header (~lines 3849–4076), dedicated views (~lines 4100–6178), overview grid cards 1–5 (~lines 6239–6700) | Every sub-tab follows the same shape: banner count badge → filters → KPI cards → table → CSV/Excel/PDF export row. The demos card (`CARD 5`, ~line 6606) + `exportDemoEvaluations` is the closest template to copy. |
| Master dossier export | `exportCompleteCampusDossier` (~line 3217) + AHI scorecard (~line 3135) | "All Reports" overview sheet; achievements sheet can be appended here. |

**Gap:** achievements are recorded and visible in E-Audit/student views, but Campus Insight — the CM's report center — never surfaces them.

---

## 2. UI plan (all inside `CAMCampusInsightPanel`)

### 2a. Data
- Pass `achievementsList` + `loadingAchievements` + `fetchAchievements` **as props** from the CAMDashboard parent (it already fetches `/api/achievements?collegeId=` on mount for the Events console — one fetch shared by both consoles, no duplicate API load).
- No API changes needed (GET is already college-scoped). `photos`/`student_names` are JSON strings — parse once with a small `parseJsonList` helper in the panel.

### 2b. New sub-tab `achievements`
1. Extend `selectedSubTab` union (line ~615) with `"achievements"`.
2. Add tab chip to the Quick Report Filter Tabs array (~line 3990): `{ id: "achievements", label: "🏆 Student Achievements", count: achievements.length, icon: Award }` — Award is already imported.
3. Dedicated view block `{selectedSubTab === "achievements" && (...)}` beside the other dedicated views (~line 4100 region):
   - **KPI cards:** Total Achievements · Winners/Gold-tier badges · Reward Prizes · This-month count (mirrors the E-Audit KPI layout for visual consistency).
   - **Filters (in header row):** Category select (`achCategoryFilter`-like: Hackathon & Competitions, Paper Presentation, Sports, etc. — derive distinct from data), Badge/Level select, month filter (derive from `date_str`), plus the shared `searchQuery` box (matches title/topic/student names/event).
   - **Ledger table:** Date · Title/Topic · Category · Badge chip · Level · Students (names) · Team · Prize · Event · Organizer · Proof link · Photo thumbnails (click → reuse existing image lightbox if cheap, else plain link). Row click → optional detail modal following `selectedDemoRecord` pattern.
   - **Export row:** CSV / Excel (.xlsx) / Print-PDF mirroring `exportDemoEvaluations` (headers: Date, Title, Topic, Category, Badge, Level, Students, Team, Prize, Event, Organizer, Proof).
4. Update the "All Reports Overview" (id `all`) grid with **Card 6: Student Achievements & Accolades** (same card anatomy: icon header, 3 KPIs, top-3 preview rows, export buttons) and bump the tab's label count from `10` to `11`.

### 2c. Dossier + health index (optional, flagged for decision)
- Add an achievements sheet to `exportCompleteCampusDossier` + two "Key Institutional Totals" rows (Total Achievements, Winners).
- **Leave AHI untouched by default** — adding a "Student Excellence" component changes the composite scoring formula (30/25/25/20 weights); recommend keeping AHI stable unless the user wants it.

---

## 3. Implementation steps

1. **Props pass-through** — pass `achievementsList`, `loadingAchievements`, `fetchAchievements` into `CAMCampusInsightPanel` from the render site (~line 18650) and add to the component's props interface.
2. **Tab + union** — add `"achievements"` to `selectedSubTab` type and the tab chip (count = `achievements.length`).
3. **Filters** — category + badge/level + month selects shown only for the achievements sub-tab; reuse `searchQuery`.
4. **Dedicated view** — KPIs, ledger table (photo thumbs, student names parsed from JSON), empty-state that points CMs to the Events console, export buttons (reuse `exportToExcel`/`exportToCSV`/`exportToPrintablePDF` helpers already in scope).
5. **Overview card** — Card 6 in the `all` grid + dossier sheet row.
6. **Verify** — `tsc --noEmit`; manual: record an achievement via Events console → appears in Campus Insight tab with filters + exports.

**Files touched:** `src/components/CAMDashboard.tsx` only (single file, ~250–350 lines of additive UI following the existing card patterns).

**Open questions:** (a) Should the achievements count feed the Campus Academic Health Index? (default: no); (b) should the CM be able to *add* achievements directly from Campus Insight, or view/export only (recommended view-only — adding already exists in the Events console)?