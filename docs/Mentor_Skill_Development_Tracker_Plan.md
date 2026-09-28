# Plan — Mentor Skill Development Tracker (SME-verified, linked to Weekly Plans, visible on CM)

> Status: **Draft v2 — no code written yet.** (v2 per user feedback: SME sees **subject type** in the same table; mentor view placed **next to the student Skill Development Tracker** tab; CM view under **Faculty** tab.)
> Goal: track each mentor's **skill subject** development (weekly topics → demos → SME sign-off),
> linked to the existing Weekly Plan flow, with a live view on the CM dashboard and an SME
> verification step ("cleared / not cleared" per topic or per demo).

---

## 1. What already exists (reuse, don't rebuild)

| Building block | Where | Relevance |
|---|---|---|
| `mentor_weekly_plans` table + `/api/weekly-plan` (GET/POST/PATCH/DELETE) | `src/app/api/weekly-plan/route.ts` | Plan rows already have `status` (`Draft / Submitted / Verified / Needs Revision`), `sme_remarks`, `verified_by`, `verified_at`, and a JSON `session_plan` (topics per day). The GET already joins `academic_tracker` (conducted topics) and `demo_sessions`. |
| `WeeklyPlanStudio.tsx` | `src/components/WeeklyPlanStudio.tsx` | `MentorWeeklyPlanStudio` (mentor authoring), `WeeklyPlanViewer` (CM/KAM/SME review with `role` prop; SME already can PATCH Verify/Needs Revision). The viewer's table is where SME needs the new **Subject Type** column. |
| Skill-vs-academic subject classifier | `isSkillSubject()` / `isAcademicSubject()` in `src/lib/utils.ts` | Derive **Subject Type** (Skill / Academic) for the SME table column and filter plans to **skill subjects** for this tracker. Subject records (`subjectsList` in AppContext) may carry an explicit `type` ("SKILL"/"ACADEMIC") — prefer that, fall back to keyword classifier. |
| Demo sessions + SME evaluation | `demo_sessions` table, `/api/demo-sessions` (`action: "evaluate"` → status `completed`, `marks`, `comments`), `SMEDashboard.tsx` evaluation modal (10 criteria, /100) | "Cleared demo" already exists as `status === 'completed'` with `marks >= threshold` (threshold to decide — see Open Questions). |
| Academic tracker (conducted topics) | `academic_tracker` table + `/api/academic-tracker`, `weekly_plan_id` / `weekly_plan_week` provenance columns via `ensureMigration` in `src/lib/migrations.ts` | Proof that a planned skill topic was actually taught. |
| **Mentor student tracker tab** | `MentorDashboard.tsx` sidebar item `tracker` ("Skill Development Tracker", icon GraduationCap) around line ~4765; the tab body (from ~line 7960) uses a **Dept → Semester → Subject → Week** 4-dropdown selector + weekly grid + Excel export | The new **My Skill Tracker** tab must sit immediately after this item and mirror its selector UX — but tracks the **mentor's own** skill development instead of student marks. |
| CM view shell | `CAMDashboard.tsx` sidebar **Faculty** group (`faculty`, `handovers`, `faculty_weekly_plan`, `demo_schedule`) around line ~14320; renders `WeeklyPlanViewer role="cm"` at ~15751 | New `mentor_skill_tracker` entry goes in this same Faculty group, next to "Weekly Plan". |
| Migration pattern | `ensureMigration(name, sql)` in `src/lib/migrations.ts` (idempotent, per-API fallback `ALTER TABLE ... .catch(() => {})`) | Use for new columns/tables. |

**Key insight:** the tracker can be 90% derived data (weekly-plan topics × demo outcomes × SME verification) — we only need to *persist SME verdicts*, not a parallel data model.

---

## 2. Proposed data model

### 2a. New table `mentor_skill_clearances` (persist SME verdicts)

```sql
CREATE TABLE IF NOT EXISTS mentor_skill_clearances (
  id TEXT PRIMARY KEY,
  college_id TEXT,
  mentor_id TEXT NOT NULL,
  subject TEXT NOT NULL,              -- skill subject name (isSkillSubject)
  subject_type TEXT DEFAULT 'Skill',  -- 'Skill' | 'Academic' (denormalized for the SME table column)
  week_number INTEGER NOT NULL,
  scope TEXT NOT NULL DEFAULT 'week', -- 'week' | 'demo' | 'topic'
  topic TEXT,                         -- required when scope = 'topic'
  demo_session_id TEXT,               -- link when scope = 'demo'
  weekly_plan_id TEXT,                -- link to mentor_weekly_plans
  status TEXT NOT NULL DEFAULT 'pending',   -- pending | cleared | not_cleared | needs_revision
  score INTEGER,                      -- optional SME score 0-100 (default from demo marks)
  remarks TEXT,
  verified_by TEXT,                   -- SME name/id
  verified_at TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT
);
```

- One row per (mentor, subject, week[, topic/demo]) — upsert on re-verification.
- `scope='demo'` rows are the "cleared demo" records; `scope='week'` is the weekly sign-off.
- `subject_type` is stored so the SME table column and exports don't need to re-derive it at read time.
- **SKILL-ONLY rule (v2.1):** every surface — tracker GET/POST, demo auto-verdict, panels —
  is restricted to subjects resolving to `Skill` via `deriveSubjectType` (explicit batch-creation
  `type` first, keyword fallback second). Academic-subject plans/demos never appear in the
  tracker, and verdict POSTs for academic subjects are rejected with a 400.

### 2b. API: `src/app/api/skill-tracker/route.ts` (new)

- **GET** `?mentorId=` / `?collegeId=` / `?weekNumber=` / `?subject=` → returns verdict rows **plus a derived progress roll-up per mentor-subject-week**: topics planned (from weekly plan `session_plan`), topics conducted (matched via `academic_tracker`, same matching logic already used in `/api/weekly-plan` GET), demo status, SME verdict, completion %, and `subjectType` per subject (from `subjects` table via `isSkillSubject`).
- **POST/PATCH** (SME only) `{ mentorId, subject, subjectType, weekNumber, scope, topic?, demoSessionId?, status, score?, remarks? }` → upsert clearance row; reuse the PATCH style of `/api/weekly-plan` (`verified_by`, `verified_at`).
- Fetch on tab-open (existing pattern in all three dashboards); no AppContext change needed.

### 2c. "Cleared demo" rule (SME marking)

- When SME evaluates a demo via existing `evaluate` action (`status='completed'`, `marks`, `comments`), also **auto-create/update a `scope='demo'` clearance row**: `status = 'cleared'` if `marks >= passMark` else `'not_cleared'`. `passMark` default **50/100** (confirm — Open Question Q1).
- SME can override manually from the Skill Tracker UI (override row wins; keep `verified_by`).
- Weekly sign-off: SME can mark a whole week `cleared` (aggregating demo + conducted topics) or per-topic.

---

## 3. UI plan (v2)

### 3a. Mentor side — "My Skill Tracker" next to the student tracker — `MentorDashboard.tsx`

- **Placement:** sidebar item `my_skill_tracker` labeled **"My Skill Tracker"**, inserted **directly under `tracker` ("Skill Development Tracker")** in the sidebar array (~line 4765) so the student tracker and the mentor's own tracker are adjacent. Add to the tab union types (~lines 2252/2728/2770) and a render block near the `weekly_plan` block (~line 8945).
- **UX mirrors the student tracker tab:** same **Dept → Semester → Subject → Week** selector bar (reuse the same option-derivation logic: `mentorSkillSubjects` / `mentorFilteredSubjectObjs` / `isSkillSubject` filtering from ~lines 7990–8060), then a **week grid per skill subject**:
  - Topics planned (from that week's weekly plan `session_plan`)
  - Topics conducted (from `academic_tracker`)
  - Demo booked / demo date / SME score
  - SME verdict badge per week (⏳ Pending / ✅ Cleared / ❌ Not Cleared / ♻ Needs Revision) + SME remarks
- Read-only for the mentor (verdicts come from SME). Optionally a "reschedule demo" affordance reusing the existing demo reschedule flow.

### 3b. SME side — subject type in the same table + marking — `WeeklyPlanStudio.tsx` + `SMEDashboard.tsx`

- **Subject Type column in the same weekly-plans table** (`WeeklyPlanViewer`): add a **"Subject Type"** column showing a chip — **Skill** (purple chip) / **Academic** (slate chip) — derived per plan via `subjectsList` lookup (`type` field, fallback `isSkillSubject()`). Applies to the one shared table, so CM/KAM views get the same column automatically (consistent, no extra work). For skill rows, SME gets the extra verdict affordance in the review drawer (academic rows keep the existing Verify / Needs Revision flow only).
- **Extended review drawer** (role `sme`): for skill-subject plans, add "Cleared / Not Cleared" per topic + per week with remarks — writes to `/api/skill-tracker` (in addition to the existing plan-level Verify/Needs Revision PATCH).
- **New SME tab `skill_tracker` ("Skill Approvals")** in `SMEDashboard.tsx` `TabKey` union + `sidebarNavItems` (~line 404): pending verdicts grouped by mentor → week, demo score prefilled, one-click **Cleared / Not Cleared / Needs Revision**. When marking a topic cleared without a demo backing it, require remarks (anti-rubber-stamp).

### 3c. CM side — under Faculty tab — `CAMDashboard.tsx`

- **Placement:** new sidebar item `{ id: "mentor_skill_tracker", label: "Mentor Skill Dev Tracker", icon: Award }` inside the **Faculty** group of the CM sidebar (~line 14320), between "Weekly Plan" and "Demo Schedule" (or directly after Weekly Plan). Render block beside the `faculty_weekly_plan` one (~line 15751). Legacy-tab alias map (~line 8791) gets an entry too.
- Campus-scoped roll-up: table per mentor → skill subject (with **Subject Type chip**, matching the SME table) → weeks with status chips, completion %, demo scores, latest SME verdict + verifier name; filters (subject, week, status); Excel export mirroring `WeeklyPlanViewer` export.
- Read-only (`role="cm"` semantics).

### 3d. Weekly-plan linkage (both directions)

- Mentor's `MentorWeeklyPlanStudio`: for skill subjects, show a small "SME Skill Verdict" chip per week (fetch verdicts for current plan) so the plan and tracker stay visually linked.
- `/api/weekly-plan` GET: include `skill_verdict` + `subject_type` per plan (JOIN on `weekly_plan_id` / mentor+subject+week) so the SME table column and both viewers render it in one request.

---

## 4. Implementation steps (suggested order)

1. **DB + migrations** — add `ensureMigration("mentor_skill_clearances", ...)` in `src/lib/migrations.ts` (idempotent CREATE TABLE; keep route-level fallback like weekly-plan does).
2. **API** — `src/app/api/skill-tracker/route.ts`: GET (derived roll-up + verdicts + subjectType), POST/PATCH (SME verdict upsert).
3. **Auto-verdict on demo evaluation** — in `/api/demo-sessions` `action === "evaluate"` branch, after the demo update, upsert the demo-scope clearance (cleared/not_cleared by passMark) + notification insert (follow the existing `notifications` insert pattern).
4. **Weekly-plan GET enrichment** — attach `skill_verdict` and `subject_type` to plans (JOIN or second query keyed on mentor+subject+week).
5. **SME UI** — Subject Type column in `WeeklyPlanViewer` table + verdict actions in the review drawer for skill rows; new SME `skill_tracker` tab; shared `SkillTrackerPanel` component in a new file `src/components/SkillTrackerPanel.tsx` (role-prop driven, mirroring `WeeklyPlanStudio.tsx` structure).
6. **CM UI** — `mentor_skill_tracker` entry in the Faculty sidebar group + read-only tab render in `CAMDashboard.tsx`.
7. **Mentor UI** — `my_skill_tracker` sidebar item directly under "Skill Development Tracker" + render block in `MentorDashboard.tsx`, reusing the student-tracker selector logic for skill subjects only.
8. **Seed/sample data** — optional rows in `src/lib/seed.ts` for local dev.
9. **Tests** — unit test the roll-up math (planned vs conducted vs cleared) in `tests/` (vitest is configured); API smoke via existing patterns.
10. **Verify** — `npm run build` / typecheck; manual pass: mentor plans skill topic → conducts → demo booked → SME evaluates → verdict appears for mentor & CM.

---

## 5. Open questions (need user decision)

1. **Demo pass mark** for auto-"cleared": 50/100? Configurable per subject via `demo_rules`?
2. **Granularity of SME marking**: per week only, per demo only, or per topic? (Plan supports all three via `scope`; recommend week + demo, topic optional.)
3. **Should CM also see pending counts / nudges** (badge when a week has demos awaiting SME verdict), or strictly final verdicts?
4. **Who can override**: head SME only (`is_head_sme` column exists in `sme_users`) or any SME?
5. **Historical data**: backfill verdicts for past completed demos, or start from go-live?

---

## 6. Risks / notes

- `WeeklyPlanViewer` and both dashboards are very large files; keep new logic in the new `SkillTrackerPanel` component file to minimize blast radius.
- The mentor tracker selector logic (~lines 7990–8060 of `MentorDashboard.tsx`) is heavy; extract/reuse carefully rather than duplicating — consider lifting the subject-derivation into a small shared helper if it grows.
- Topic matching between weekly plan and `academic_tracker` is lowercase-trim equality today (see `/api/weekly-plan` GET) — reuse as-is for consistency; exact fuzzy matching is out of scope.
- Subject Type derivation must agree everywhere: prefer the `subjects` table `type` field, fallback to `isSkillSubject()` — single helper so SME column, CM export, and tracker rows never disagree.
- `sme_remarks` vs `cam_feedback` duplication in weekly-plan API: keep verdicts in the new table, don't overload plan columns.
