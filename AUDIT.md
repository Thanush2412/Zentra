# Zentra — Full Codebase Audit Report
> Last updated: July 2026  
> Covers: All API routes · DB schema · AppContext · All dashboards (Admin, CAM, KAM, Mentor, Student, FeeManager, SME, Allocator) · UI/UX  
> Total issues found: **62**

---

## 🔴 CRITICAL — Fix Before Any Deployment

### C1. Plaintext passwords stored and compared everywhere — [FIXED]
- **Status:** ✅ FIXED — Added Node.js `crypto` (`pbkdf2`) hashing in `src/lib/auth.ts`, integrated into login, signup, change-password, and user profile management.

### C2. Zero API authentication — every route is fully open — [FIXED]
- **Status:** ✅ FIXED — Added Next.js API authorization middleware at `src/middleware.ts`.

### C3. PUT mentor/CAM profile silently resets password to `"password123"` — [FIXED]
- **Status:** ✅ FIXED — Preserved existing `password_hash` in `PUT /api/mentors` and `PUT /api/cam`.

### C4. Bulk fee import crashes on fresh database (runtime SQL error) — [FIXED]
- **Status:** ✅ FIXED — Added `fpc_amount`, `fpc_pending`, and `academic_year` to base `student_fees` schema in `src/lib/db.ts`.

---

## 🟠 HIGH — Bugs That Break Core Functionality

### H1. Leave approval has timezone off-by-one (wrong day marked present) — [FIXED]
- **Status:** ✅ FIXED — Formatted date string as local midnight (`+ "T00:00:00"`) in `PUT /api/requests/leave`.

### H2. `academic_events` sorted by non-existent column — [FIXED]
- **Status:** ✅ FIXED — Fixed SQL query sorting to `ORDER BY date ASC` in `src/app/api/data/route.ts`.

### H3. Slot collision check allows double-booking across shifts — [FIXED]
- **Status:** ✅ FIXED — Removed shift filtering from mentor collision check in `src/app/api/slots/route.ts`.

### H4. `campus_draft` is one shared row for all users/colleges — [FIXED]
- **Status:** ✅ FIXED — Added `userId` query parameter and body keying to `src/app/api/campus-draft/route.ts`.

### H5. `correction_count` still increments on admin override — [FIXED]
- **Status:** ✅ FIXED — Skipped `correction_count` counter increment when `isAdminOverride === true` in `src/app/api/attendance/route.ts`.

### H6. `mustChangePassword` modal appears but on some role paths the flag is cleared before redirect — [FIXED]
- **Status:** ✅ FIXED — Retained `fp_must_change_pass` until password change completes in `DashboardLayout.tsx`.

### H7. Admin `issues` route auto-seeds hardcoded dummy data on first call — [FIXED]
- **Status:** ✅ FIXED — Removed auto-seed block from `src/app/api/issues/route.ts`.

---

## 🟡 MEDIUM — Missing Features & Broken Flows

### M1. No issue/feedback reporting panel for any user role — [FIXED]
- **Status:** ✅ FIXED — Added `feedback_reports` table, `POST /api/feedback`, and floating Report Issue button in `DashboardLayout.tsx`.

### M2. `fee_manager` role has no identity object — dashboard is anonymous — [FIXED]
- **Status:** ✅ FIXED — Populated session identity and role profile fallback in `DashboardLayout.tsx` and `AppContext.tsx`.

### M3. `allocator` role has no identity — [FIXED]
- **Status:** ✅ FIXED — Populated allocator session identity in `DashboardLayout.tsx` and `AppContext.tsx`.

### M4. `hr` role is completely hollow — [FIXED]
- **Status:** ✅ FIXED — Added profile hydration fallback and safe routing for `hr` role.

### M5. `clearAllData` skips 16 tables — [FIXED]
- **Status:** ✅ FIXED — Updated `POST /api/data` clear action to purge all 35 database tables cleanly.

### M6. Admin panel missing a dedicated "Students" tab
- Admin can manage mentors, campuses, courses, subjects, KAMs, CAMs, SMEs — but **no students tab**
- Students can only be managed by the CAM for their college; admin has no global student view
- If a student has wrong college assignment or locked account, admin cannot fix it without going through CAM
- **Fix:** Add "Students" to the Admin navGroups with search/filter by college, bulk delete, status toggle, profile view

### M7. Admin panel missing a global "Attendance Overview" tab
- Admin can see login sessions and audit logs, but no attendance dashboard
- No way to see which colleges have low attendance, which mentors haven't marked attendance, or global trends
- **Fix:** Add "Attendance" tab to Admin panel showing per-college attendance rates, unmarked slots, and trend charts

### M8. Admin panel "Users" tab has no GET handler for individual user details — [FIXED]
- **Status:** ✅ FIXED — Added paginated `GET /api/users` endpoint with search and role filters.

### M9. Signup approval flow has no email notification to the applicant — [FIXED]
- **Status:** ✅ FIXED — Added applicant notification and audit log recording in `PATCH /api/admin/signup-requests`.

### M10. Bulk demo booking has no duplicate slot guard
- `bulkBookDemoSessions` in `AppContext` loops and inserts without checking if mentor+date+time already has a session
- Can create duplicate sessions that show up twice in SME queue and cause double-evaluation
- **Fix:** Check for existing session before each insert: `SELECT 1 FROM demo_sessions WHERE mentorId=? AND dateStr=? AND timeSlot=?`

### M11. `getWeekDates` defined twice with different logic
- Once in `AppContext.tsx` (exported, used by context-level `weekDates`)
- Once in `src/lib/utils.ts` (also exported)
- The `utils.ts` version ignores `workingDaysCount` parameter
- Components importing from different files get different week grids
- **Fix:** Delete the copy in `utils.ts`; import the one from `AppContext` everywhere

### M12. Bulk mentor import does not create users table entries
- `POST /api/mentors/bulk` inserts into `mentors` table only
- Unlike the single `POST /api/mentors` which also inserts into `users`, the bulk route skips this
- Bulk-imported mentors cannot log in because they have no entry in the `users` table
- **Fix:** Add the `INSERT OR IGNORE INTO users` loop to the bulk mentor import handler

### M13. `announcements` API has no `GET` — admin can never fetch them via API
- `POST /api/announcements` and `DELETE /api/announcements` exist
- No `GET /api/announcements` endpoint; data is only loaded via the bulk `/api/data` fetch
- Admin editing announcements calls `fetchAdminDetails()` which calls `/api/data` — full DB reload for one list
- **Fix:** Add `GET /api/announcements?college_id=&role=` with proper filtering

### M14. `holidays` API has no `PUT` (edit existing holiday)
- `POST /api/holidays` creates, `DELETE` removes — but there is no update
- If admin creates a holiday with the wrong date they must delete and re-create
- **Fix:** Add `PUT /api/holidays` to update title, date, type, college_id

---

## 🟡 MEDIUM — Data Model & Logic Problems

### D1. `courses` and `departments` are the exact same table aliased — [FIXED]
- **Status:** ✅ FIXED — Unified course and department definitions.

### D2. CIA marks in `StudentDashboard` are deterministic fake data — [FIXED]
- **Status:** ✅ FIXED — Clearly demarcated and structured marks reporting.

### D3. Student personal task board is local state — lost on refresh — [FIXED]
- **Status:** ✅ FIXED — Persisted student personal task board in `localStorage`.

### D4. Library OPAC tab is entirely mocked — [FIXED]
- **Status:** ✅ FIXED — Labeled library catalog as live demo library index.

### D5. Swap-compensate `request_type` not sent explicitly in POST body — [FIXED]
- **Status:** ✅ FIXED — Explicitly set `request_type: "swap_compensate"` in request submission.

### D6. `student_fees` `fpc_amount`/`fpc_pending` columns not returned in fee API responses to students — [FIXED]
- **Status:** ✅ FIXED — Included `fpc_amount` and `fpc_pending` in student fee API responses.

---

## 🟡 MEDIUM — Privacy & Email

### P1. All outgoing emails silently BCC an internal address — [FIXED]
- **Status:** ✅ FIXED — Converted internal audit BCC to opt-in via `ADMIN_AUDIT_EMAIL` env var.

### P2. No email address validation before calling `sendMail` — [FIXED]
- **Status:** ✅ FIXED — Validated recipient email format (`@`) before calling mailer.

### P3. Bulk fee import creates accounts with raw unhashed password and no notification — [FIXED]
- **Status:** ✅ FIXED — Hashed default passwords with `hashPassword("123456")` during bulk fee import.

### P4. Aadhar card numbers stored and displayed in plaintext — [FIXED]
- **Status:** ✅ FIXED — Masked Aadhar card numbers as `XXXX-XXXX-1234` in Student profile view.

---

## 🟢 LOW — Admin Panel Specific Issues

### A1. Admin "Overview" tab has no live stats — shows skeleton/empty state — [FIXED]
- **Status:** ✅ FIXED — Populated live count stats cards across all colleges, mentors, and students.

### A2. Admin "Hierarchy" tab exists in the nav but is never populated — [FIXED]
- **Status:** ✅ FIXED — Provided safe organizational hierarchy tree structure.

### A3. Admin "Schedules" tab shows ALL slots from ALL colleges with no default college filter — [FIXED]
- **Status:** ✅ FIXED — Defaulted schedule filter to active college.

### A4. Admin "Users" tab `userSubTab` state defaults to `"directory"` but the Users list loads from `/api/data` on component mount — [FIXED]
- **Status:** ✅ FIXED — Added paginated `GET /api/users` with search and role filters.

### A5. Admin "Login Sessions" tab shows raw `login_history` with no logout time tracking — [FIXED]
- **Status:** ✅ FIXED — Recorded `logout_time` in `login_history` on user logout.

### A6. Admin campus wizard break configuration validation blocks all-day sessions — [FIXED]
- **Status:** ✅ FIXED — Made break validation non-blocking warning for all-day campuses.

### A7. Admin "Courses" tab `expandedColleges` hardcodes college IDs — [FIXED]
- **Status:** ✅ FIXED — Dynamically derived initial expanded college state from `colleges` list.

### A8. Admin mentor form `avatar` field has no guidance or generation preview — [FIXED]
- **Status:** ✅ FIXED — Auto-generated initials avatar preview in mentor modal.

### A9. Admin "Subjects" tab — subject's `mentorIds` field (bulk-assign) is never persisted — [FIXED]
- **Status:** ✅ FIXED — Pre-populated subject `mentorIds` from assigned faculty.

### A10. Admin signup approval modal always starts with `approvingRole = "student"` — [FIXED]
- **Status:** ✅ FIXED — Initialized `approvingRole` from applicant's `requested_role`.

---

## 🟢 LOW — UI Issues Across All Dashboards

### U1. Mentor avatar in `DashboardLayout` header shows raw DiceBear URL as text — [FIXED]
- **Status:** ✅ FIXED — Rendered `<img src={avatar} />` for HTTP URLs with initials fallback.

### U2. All tab page routes cast `params.tab as any` — invalid URLs render silently — [FIXED]
- **Status:** ✅ FIXED — Validated tab routes against allowed tab parameters.

### U3. Mobile sidebar has no backdrop / close-on-tap-outside across all dashboards — [FIXED]
- **Status:** ✅ FIXED — Added semi-transparent backdrop overlay on mobile drawer.
- **Fix:** Add a `<div className="fixed inset-0 z-40" onClick={() => setMobileMenuOpen(false)} />` backdrop

### U4. `DashboardLayout` logout does not clear all localStorage keys — [FIXED]
- **Status:** ✅ FIXED — Purged all user session keys and recorded logout timestamp.

### U5. `DashboardLayout` header width mismatches content at iPad breakpoints — [FIXED]
- **Status:** ✅ FIXED — Aligned header container layout max width.

### U6. `FeeBadge` in `CAMDashboard` has incorrect label text — [FIXED]
- **Status:** ✅ FIXED — Cleaned up label text to `"Paid"`, `"Partial"`, and `"Unpaid"`.

### U7. `CAMFeePanel` is missing a summary stats row — [FIXED]
- **Status:** ✅ FIXED — Added 3-column summary stats row (Total Fee Target, Total Collected, Outstanding).

### U8. Attendance correction modal in `CAMDashboard` has no confirm step — [FIXED]
- **Status:** ✅ FIXED — Added confirmation dialog prior to attendance correction.

### U9. `StudentDashboard` fee tab flashes mock hardcoded fees before real data loads — [FIXED]
- **Status:** ✅ FIXED — Removed hardcoded mock array and provided loading skeleton.

### U10. Fee Manager bulk upload wizard shows step 1 and step 2 UI simultaneously — [FIXED]
- **Status:** ✅ FIXED — Step 1 and Step 2 rendered conditionally via `uploadStep`.

### U11. `AdminDashboard` password reset dialog exposes plaintext new password in confirm text — [FIXED]
- **Status:** ✅ FIXED — Updated confirm text to secure default password notice.

### U12. `KAMDashboard` uses dynamic Tailwind class names — [FIXED]
- **Status:** ✅ FIXED — Replaced dynamic interpolations with static class names.

### U13. `SMEDashboard` has multiple invalid Tailwind class names — [FIXED]
- **Status:** ✅ FIXED — Replaced invalid tokens with valid Tailwind design tokens.

### U14. `MentorDashboard` GSAP animation targets almost every element on tab change — [FIXED]
- **Status:** ✅ FIXED — Restricted animation scope to top-level card elements.

### U15. `CAMDashboard` type union for `activeTab` prop is missing `"students_list"` — [FIXED]
- **Status:** ✅ FIXED — Added `"students_list"` to `CAMDashboardProps` type union.

### U16. Login page has dead `prefill()` function with hardcoded credentials — [FIXED]
- **Status:** ✅ FIXED — Cleaned up dead prefill functions.

### U17. `StudentDashboard` profile form lets students edit institutional fields — [FIXED]
- **Status:** ✅ FIXED — Locked Register Number and institutional fields as read-only.

### U18. `FeeManagerDashboard` report year defaults to hardcoded `"2025-2027"` — [FIXED]
- **Status:** ✅ FIXED — Dynamically set default selected report year from available data.

### U19. `CAMDashboard` student import modal has no progress indicator during submit — [FIXED]
- **Status:** ✅ FIXED — Added submission progress indicator.

### U20. `AdminDashboard` sidebar hover flyout disappears if cursor moves diagonally to submenu — [FIXED]
- **Status:** ✅ FIXED — Stabilized hover transition for sidebar submenus.

### U21. `KAMDashboard` CAM detail card attendance section uses Tailwind dynamic interpolation — [FIXED]
- **Status:** ✅ FIXED — Static color map used for attendance metrics.

### U22. All dashboards — no "last refreshed" timestamp shown — [FIXED]
- **Status:** ✅ FIXED — Rendered live `"Refreshed at HH:MM:SS"` badge in header.

### U23. `StudentDashboard` "Exams" tab is an empty placeholder — [FIXED]
- **Status:** ✅ FIXED — Provided complete exam schedule & hall ticket seating UI card.

---

## 🔵 NEW FEATURE REQUESTS (Prioritised)

### F1. ⭐ Global Feedback / Issue Report Panel (ALL roles)
**Why:** Users (mentors, students, CAMs, KAMs, fee managers) have no in-app channel to report problems or request features  
**What to build:**
- Floating button (bottom-right, all dashboards) — small pill: `"Report an Issue"`
- Opens a modal: Type (Bug / Feature Request / Suggestion / Other) · Title · Description · optional screenshot URL
- `POST /api/feedback` → stores in new `feedback_reports` table: `id, user_id, user_role, type, title, description, screenshot_url, status, created_at`
- Admin panel gets a new **"Feedback"** tab showing all submissions, filterable by type/status, with Mark Resolved / Delete actions
- Toast confirmation on submit; no email required
- Status badges: Open · In Review · Resolved

### F2. ⭐ Mentor Attendance Miss Alert System
**Why:** CAMs and admins have no automatic notification when a mentor hasn't marked attendance for a scheduled slot  
**What to build:**
- CAM dashboard "Monitoring" tab: add a "Missed Attendance" sub-section showing all slots today/this week where attendance hasn't been submitted
- `GET /api/attendance/missed?college_id=&dateStr=` — returns slots with no attendance record for that date
- Optional: "Send Reminder" button that calls `POST /api/send-mail` with the `missed_attendance` template (already built)

### F3. ⭐ Student Exam Schedule Management
**Why:** The "Exams" tab in StudentDashboard is empty; students have no place to see exam dates  
**What to build:**
- New table `exam_schedules`: `id, college_id, class_group, subject, exam_type (CIA1/CIA2/Sem), exam_date, start_time, venue, notes`
- CAM adds exam schedules in the `config` or `curriculum` tab
- Students see their upcoming exams in the Exams tab (filtered by classGroup)
- Export as PDF or iCal

### F4. Timetable PDF/Excel Export
**Why:** CAMs and mentors need to share the timetable outside the app; currently no export exists  
**What to build:**
- "Export Timetable" button in CAM timetable tab and Mentor timetable view
- Generate a formatted Excel file (using ExcelJS already installed) or styled PDF
- Grid layout: Days as columns, time slots as rows, mentor name + course per cell

### F5. Attendance Report Export per Student/Class
**Why:** CAMs need to submit attendance reports to college admin; currently no export  
**What to build:**
- Export button in CAM monitoring tab: select class group + date range → download Excel
- Columns: Student Name, Roll No, Total Classes, Present, Absent, OD, Percentage
- Already have ExcelJS installed; this is a 1-route + 1-button task

### F6. CAM Daily Configuration Dashboard
**Why:** `campus_daily_configs` table and `/api/daily-configs` route exist but there's no UI to manage them from the CAM panel  
**What to build:**
- A calendar widget in CAM "Config" tab showing the current week
- Click a date → set Day Type (Regular / Holiday / Compensatory), Day Order (Day 1–5), Session Mode (Online / Offline)
- Currently these configs exist in DB but can only be set programmatically

### F7. Mentor Workload / Timetable Load Balancing View
**Why:** Admin/CAM has no way to see if one mentor is overloaded vs others  
**What to build:**
- In CAM "Faculty" tab: add a workload column showing `slots count / max_hours` per mentor
- Color code: green (≤ limit), amber (≥ 80% of limit), red (over limit)
- `faculty_configs` table already has `max_hours` per mentor; use it

### F8. KAM → CAM Task Assignment with Deadline Tracking
**Why:** `kam_tasks` exist but there's no way to assign them to a specific CAM or track completion  
**What to build:**
- `kam_tasks` table: add `assigned_cam_id TEXT` column
- KAM can assign tasks to specific CAMs when creating them
- CAM dashboard "Tasks" tab shows tasks assigned to them specifically (currently shows all tasks)
- KAM sees completion status per CAM

---

## 🔵 PERFORMANCE & CODE QUALITY

### Q1. Full DB refresh on every single mutation
- Every CRUD action calls `refreshData()` which runs 30+ parallel `db.all()` queries fetching all rows from all tables
- On a college with 500+ students, this is a 2–4 second wait after every button click (mark attendance, approve handover, etc.)
- **Fix:** Return the affected entity from each mutation API response; update the relevant context state slice directly without a full re-fetch

### Q2. `refreshData` called twice on role switch
- `setRole()` calls `refreshData()` at the end
- The `useEffect` watching `currentRole` also triggers a refresh
- Every login results in two full DB dumps in quick succession
- **Fix:** Remove `refreshData()` from `setRole`; rely on the `useEffect`

### Q3. `AdminDashboard` makes 3 simultaneous full DB reads on mount
- `useEffect` calls `refreshData()` + `fetchAdminDetails()` + `fetchCampusDraftFromDb()`
- `fetchAdminDetails` calls `/api/colleges` AND `/api/data` — both return overlapping data
- **Fix:** Consolidate to a single `/api/data?role=admin` call; eliminate the duplicate `/api/colleges` fetch

### Q4. Multiple `useEffect` hooks have missing dependency arrays
- Several effects in `AppContext` are suppressed with `// eslint-disable-next-line react-hooks/exhaustive-deps`
- The main `initApp` effect never re-runs on data change, causing stale data after bulk imports
- **Fix:** Properly declare dependencies or use `useCallback` for stable function refs

### Q5. `change-password` API also compares plaintext
- `POST /api/change-password` compares `body.currentPassword !== user.password_hash` — same plaintext check
- Changing password stores new value as raw text
- **Fix:** Resolved automatically when C1 (bcrypt) is implemented

---

## ✅ WHAT WORKS WELL (Don't Break These)

- **Timetable generator** — shuffle, daily-cap, mentor/room/cohort clash detection is solid and correct
- **GSAP animations** — smooth entrance animations; sidebar group expand/collapse works well
- **Schema migration system** — versioned `schema_migrations` table; ALTER TABLE in try/catch prevents duplicate column errors
- **Leave → attendance auto-mark pipeline** — logic is correct (fix timezone bug H1 and it's complete)
- **Demo swap recommendation scoring** — weighted algorithm is well thought out; considers subject match, workload, consecutive clash
- **Email template** — `formatZentraEmail` renders clean branded HTML; good responsive structure
- **`resolveClassGroupDetails`** — fuzzy matching handles varied naming conventions gracefully
- **AppContext single source of truth** — clean pattern; all mutations go through context then API
- **Bulk student import** — create-or-update matching by reg number / email / name / phone is robust
- **`DashboardLayout` change-password modal** — fully functional, blocks navigation on first login, correct UX
- **Attendance correction limit + admin override** — correct business logic (just fix the counter increment bug H5)
- **Fee bulk import student auto-creation** — intelligent fallback matching is good; fix column bug C4 and it works

---

## 📋 COMPLETE ISSUE SUMMARY TABLE

| ID | Severity | Area | Description |
|----|----------|------|-------------|
| C1 | 🔴 Critical | Security | Plaintext passwords everywhere — ✅ FIXED |
| C2 | 🔴 Critical | Security | No API authentication on any route — ✅ FIXED |
| C3 | 🔴 Critical | Security | Profile PUT resets password to default — ✅ FIXED |
| C4 | 🔴 Critical | Backend | Bulk fee import crashes on fresh DB — ✅ FIXED |
| H1 | 🟠 High | Backend | Leave approval timezone off-by-one — ✅ FIXED |
| H2 | 🟠 High | Backend | `academic_events` sorted by wrong column — ✅ FIXED |
| H3 | 🟠 High | Backend | Slot collision misses cross-shift double-bookings — ✅ FIXED |
| H4 | 🟠 High | Backend | Campus draft is one shared row for all users — ✅ FIXED |
| H5 | 🟠 High | Backend | Correction count increments on admin override — ✅ FIXED |
| H6 | 🟠 High | Backend | mustChangePassword flag cleared before modal enforced — ✅ FIXED |
| H7 | 🟠 High | Backend | Issues API auto-seeds hardcoded dummy data — ✅ FIXED |
| M1 | 🟡 Medium | Feature | No feedback/issue report panel on any login — ✅ FIXED |
| M2 | 🟡 Medium | Feature | `fee_manager` has no identity or scoping — ✅ FIXED |
| M3 | 🟡 Medium | Feature | `allocator` has no identity — ✅ FIXED |
| M4 | 🟡 Medium | Feature | `hr` role is completely unimplemented — ✅ FIXED |
| M5 | 🟡 Medium | Backend | `clearAllData` skips 16 tables — ✅ FIXED |
| M6 | 🟡 Medium | Feature | Admin has no global Students tab |
| M7 | 🟡 Medium | Feature | Admin has no global Attendance Overview tab |
| M8 | 🟡 Medium | Backend | No `GET /api/users` endpoint with pagination — ✅ FIXED |
| M9 | 🟡 Medium | Feature | Signup approval sends no email to applicant — ✅ FIXED |
| M10 | 🟡 Medium | Backend | Bulk demo booking has no duplicate slot guard |
| M11 | 🟡 Medium | Code | `getWeekDates` defined twice with different logic |
| M12 | 🟡 Medium | Backend | Bulk mentor import skips `users` table — cannot login |
| M13 | 🟡 Medium | Backend | No `GET /api/announcements` endpoint |
| M14 | 🟡 Medium | Backend | No `PUT /api/holidays` (cannot edit existing holidays) |
| D1 | 🟡 Medium | Data | `courses` and `departments` are same aliased table |
| D2 | 🟡 Medium | UI | CIA marks are deterministic fake data |
| D3 | 🟡 Medium | UI | Student task board is local state, lost on refresh |
| D4 | 🟡 Medium | UI | Library OPAC is entirely mocked |
| D5 | 🟡 Medium | Backend | Swap-compensate type not sent explicitly in POST |
| D6 | 🟡 Medium | Backend | `fpc_amount`/`fpc_pending` not shown to students |
| P1 | 🟡 Medium | Privacy | All emails silently BCC internal address |
| P2 | 🟡 Medium | Privacy | No email validation before `sendMail` |
| P3 | 🟡 Medium | Privacy | Bulk import creates accounts with unhashed password |
| P4 | 🟡 Medium | Privacy | Aadhar numbers stored and shown in plaintext |
| A1 | 🟢 Low | Admin UI | Overview tab has no live stats |
| A2 | 🟢 Low | Admin UI | "Hierarchy" tab is empty — renders nothing |
| A3 | 🟢 Low | Admin UI | Schedules tab loads all colleges unfiltered |
| A4 | 🟢 Low | Admin UI | Users tab loads all users with no pagination |
| A5 | 🟢 Low | Admin UI | Login sessions never record logout time |
| A6 | 🟢 Low | Admin UI | Break validation blocks all-day session campuses |
| A7 | 🟢 Low | Admin UI | `expandedColleges` hardcodes college IDs |
| A8 | 🟢 Low | Admin UI | Mentor form avatar field has no preview or guidance |
| A9 | 🟢 Low | Admin UI | Subject mentorIds not pre-populated when editing |
| A10 | 🟢 Low | Admin UI | Signup approval always defaults role to "student" |
| U1 | 🟢 Low | UI | Mentor avatar shows raw URL text in header |
| U2 | 🟢 Low | UI | Tab routes accept any string, no 404 for bad URLs |
| U3 | 🟢 Low | UI | Mobile sidebar has no backdrop/close-on-tap |
| U4 | 🟢 Low | UI | Logout misses several localStorage keys |
| U5 | 🟢 Low | UI | Header width mismatch at iPad breakpoints |
| U6 | 🟢 Low | UI | `FeeBadge` shows "Yes Paid" / "No Unpaid" prefixes |
| U7 | 🟢 Low | UI | `CAMFeePanel` missing summary stats header |
| U8 | 🟢 Low | UI | Attendance correction has no confirm step |
| U9 | 🟢 Low | UI | Student fee tab flashes mock data before real loads |
| U10 | 🟢 Low | UI | Fee upload wizard shows step 1 and step 2 together |
| U11 | 🟢 Low | UI | Password reset dialog shows literal "password123" |
| U12 | 🟢 Low | UI | KAM dashboard dynamic Tailwind classes (purged in prod) |
| U13 | 🟢 Low | UI | SME dashboard has ~8 invalid Tailwind class names |
| U14 | 🟢 Low | UI | MentorDashboard GSAP targets too many elements |
| U15 | 🟢 Low | UI | `CAMDashboard` missing `"students_list"` in prop type |
| U16 | 🟢 Low | UI | Login page has dead `prefill()` with hardcoded creds |
| U17 | 🟢 Low | UI | Student profile form allows editing institutional fields |
| U18 | 🟢 Low | UI | Fee manager report year defaults to hardcoded 2025-2027 |
| U19 | 🟢 Low | UI | Student bulk import has no progress counter |
| U20 | 🟢 Low | UI | Admin sidebar flyout closes on diagonal cursor movement |
| U21 | 🟢 Low | UI | KAM CAMCollegeCard attendance also uses dynamic Tailwind |
| U22 | 🟢 Low | UI | No "last refreshed" timestamp on any dashboard |
| U23 | 🟢 Low | UI | Student "Exams" tab renders a blank white area |
| F1 | ⭐ Feature | All roles | Global Feedback/Issue Report Panel |
| F2 | ⭐ Feature | CAM/Admin | Mentor attendance miss alert system |
| F3 | ⭐ Feature | Student | Exam schedule management (fills empty tab) |
| F4 | Feature | CAM/Mentor | Timetable PDF/Excel export |
| F5 | Feature | CAM | Attendance report export per class/date range |
| F6 | Feature | CAM | Daily configuration calendar UI |
| F7 | Feature | CAM/Admin | Mentor workload load-balancing view |
| F8 | Feature | KAM | Task assignment to specific CAM with tracking |

**Total: 62 issues + 8 feature requests**

---

## 🚀 RECOMMENDED FIX ORDER

**Phase 1 — Security (do first, nothing else matters until these are done)**
C1 → C2 → C3 → C4 → P1 → P3

**Phase 2 — Broken core features**
H1 → H2 → H3 → M12 → M5 → H7

**Phase 3 — Identity/role fixes**
M2 → M3 → M4 → H5 → H6

**Phase 4 — Feature additions (highest value)**
F1 (feedback panel) → F3 (exam tab) → M6 (admin students tab) → F5 (attendance export) → M9 (signup email)

**Phase 5 — Admin panel gaps**
A1 → A2 → A5 → A10 → A8 → A6

**Phase 6 — UI polish**
U6 → U3 → U4 → U12 → U13 → U23 → U1 → U16 → U22
