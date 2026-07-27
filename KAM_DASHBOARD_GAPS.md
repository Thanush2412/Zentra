# KAM Dashboard — Gap Analysis & Feature Specification
> Full audit of what exists, what is missing, and exactly what should be built  
> Context: KAM (Key Account Manager) oversees multiple CAMs (Campus Managers), each managing one college  
> Last updated: July 2026

---

## 🗺️ CURRENT STATE — What Actually Exists

The KAM dashboard has **7 tabs** in the sidebar:

| Tab | What it does |
|-----|-------------|
| **Overview** | KPI row (6 numbers), bar chart (faculty/students per campus), donut chart (request pipeline), portfolio health bars (attendance % + fee %), per-campus summary cards, recent handover activity list |
| **CM Reports** | Expandable `CAMCollegeCard` per college — shows Faculty, Students, Attendance, Curriculum, Fees, Handovers, Requests, Issues sub-tabs inside each card |
| **Campus Directory** | Static list of colleges with address — no interaction |
| **Swap Ledger** | Shows approved handovers as a ledger table per mentor — balance calculation |
| **Assign Task** | Simple form: title + college + priority + due date → creates a `kam_tasks` record |
| **Escalated Issues** | List of `campus_issues` for this KAM's colleges — resolve button only |
| **My Profile** | Name, email, title display — no edit |

---

## 🔴 CRITICAL MISSING — Core KAM Workflow

### G1. KAM cannot set today's Day Order for any campus
**What this means:** Every CAM has a `campus_daily_configs` feature where a specific date can be mapped to a different day's timetable (e.g., "Today is Monday but run Friday's timetable because of a rescheduled holiday"). This is called Day Order.

**Current state:**
- `campus_daily_configs` table exists with columns: `college_id`, `dateStr`, `day_type`, `day_order`, `session_mode`, `notes`
- `GET/POST /api/daily-configs` route exists and works
- CAM dashboard does NOT have a UI to set these either — it reads them but cannot create them
- KAM dashboard has NO awareness of daily configs at all

**What KAM needs:**
- A "Today's Operations" panel on the Overview tab showing today's day order status per campus
- A "Set Day Order" button per campus that opens a modal: select date, select Day Order (Day 1–5), Day Type (Regular/Holiday/Compensatory/Exam Day), Session Mode (Online/Offline), notes
- This should be KAM-controlled because day order changes affect multiple colleges and need senior approval
- Show a visual timeline of this week's day orders per college — a small 5-column grid per college

**API needed:** `POST /api/daily-configs` already exists. Just needs a UI panel.

---

### G2. KAM cannot approve or act on handover requests
**Current state:**
- Handovers with status `"pending_cam"` (emergency escalations) appear in the CM Reports card with a "⚡ Emergency" badge
- KAM has **no approve/reject buttons** anywhere
- The `handleRequest` function in AppContext accepts `actorRole` param so KAM approval is technically supported by the API
- But there's zero UI for it

**What KAM needs:**
- In the CM Reports → Requests section: add Approve / Reject buttons for `pending_cam` requests
- In the Overview tab: an "Urgent Actions" panel showing all `pending_cam` requests across ALL campuses at the top (above KPIs)
- Badge count on the "CM Reports" sidebar tab should count `pending_cam` requests (it currently does but the action panel is missing)

---

### G3. KAM has no announcement broadcast capability
**Current state:**
- Admin can create announcements (`POST /api/announcements`) targeting specific roles or colleges
- KAM has no announcement panel anywhere

**What KAM needs:**
- A compose announcement section in the Overview or a dedicated sub-section
- Target options: All Colleges (in portfolio) / Specific College / All Faculty / All Students
- The announcement API already handles `college_id` and `target_role` — just needs KAM-side UI

---

## 🟠 HIGH PRIORITY MISSING — Analytics & Visibility

### G4. Overview tab has NO real-time "Today" panel
**Current state:**
- The Overview tab shows aggregate totals (total faculty, total students, total slots) which never change day-to-day
- There is no "What is happening TODAY across my campuses" view at all

**What KAM needs — "Today at a Glance" panel at the very top of Overview:**
```
┌─────────────────────────────────────────────────────────────────────┐
│  TODAY  —  Monday, July 26                                         │
│                                                                     │
│  Campus A           Day 1 (Regular)    Online    8 classes scheduled│
│  Campus B           Day 3 (Regular)    Offline   12 classes scheduled│
│  Campus C           HOLIDAY            —          —                 │
│                                                                     │
│  Unmarked attendance today: 3 slots across 2 campuses  ⚠️          │
│  Pending urgent requests: 2  ⚡                                      │
└─────────────────────────────────────────────────────────────────────┘
```
- Pull from `campus_daily_configs` for day order and session mode
- Pull from `slots` for scheduled class count per college today
- Compare `student_attendance` records with expected slots to find unmarked sessions
- Show urgent `pending_cam` requests count

---

### G5. No attendance trend graphs
**Current state:**
- Overview → Portfolio Health shows a single percentage bar per campus (current overall rate)
- No historical trend, no week-over-week comparison, no drill-down

**What KAM needs — Attendance Trend Chart:**
- An SVG line chart per campus showing attendance rate per week for the last 6 weeks
- X-axis: weeks (Week 1 through Week 6)
- Y-axis: 0–100%
- Multiple lines (one per campus) with different colors
- A 75% threshold line in amber dashed
- Data source: group `student_attendance` by `dateStr`, compute weekly averages
- On hover/click: show which classes pulled the rate down

---

### G6. No fee collection trend graph
**Current state:**
- Fee stats (totalFees, totalPaid, collectionRate) are fetched per CAM via `/api/fees?role=cam&camId=`
- Overview shows a horizontal bar per campus with current collection rate %
- No month-over-month trend, no target vs achieved split

**What KAM needs — Fee Collection Report panel:**
- A grouped bar chart: per college, show "College Fee Target vs Achieved" and "FPC Fee Target vs Achieved" side by side
- The data already exists: `fpc_amount` (FPC target), `paid_amount` (FPC achieved), `amount` (college fee target)
- A summary row: total FPC target across all colleges, total FPC achieved, total outstanding
- Month filter to see collection progress for a specific month
- The `feeStatsMap` is already fetched in the KAM context — just needs visualization

**Chart layout:**
```
         College Fee          FPC Fee
Campus A  [████████  80%]    [██████   60%]
Campus B  [█████     50%]    [████████ 85%]
```

---

### G7. No mentor workload / timetable coverage view
**Current state:**
- Faculty count is shown per campus (just a number)
- No view of whether all slots are covered, whether any mentor has too many or too few slots
- `faculty_configs` table has `max_hours` per mentor but KAM has no visibility

**What KAM needs:**
- In CM Reports → Faculty section: add a "Workload" column showing `slots assigned / max_hours` per mentor
- Color code: green (≤ limit), amber (80–100% of limit), red (over limit)
- Portfolio-level summary: "X mentors are over their weekly hour limit across your campuses"
- Highlight unassigned subjects (subjects in the curriculum with no mentor slot scheduled)

---

### G8. Swap Ledger tab is read-only with no filtering
**Current state:**
- The Swap Ledger tab shows approved handovers grouped by mentor
- Calculates a balance (how many classes owed to each mentor)
- No filters, no search, no date range, no college filter
- Shows ALL approved handovers across ALL campuses — on a large install this is thousands of rows

**What KAM needs:**
- College filter dropdown at the top
- Date range filter (by ledger_month)
- Search by mentor name
- A "Balanced/Unbalanced" toggle to show only mentors with outstanding debts
- Export to Excel button (using ExcelJS already installed)
- Summary row: "X mentors have uncompensated handovers this month"

---

## 🟠 HIGH PRIORITY MISSING — Task & Issue Management

### G9. Tasks cannot be assigned to a specific CAM — only to a college
**Current state:**
- `kam_tasks` table has `collegeId` column only (which college the task is for)
- The `assigned_cam_id` column does not exist — task is just for "a college" generically
- CAM dashboard shows ALL tasks for their college — they can't tell if a task is specifically for them
- No due date notifications, no overdue highlighting (due date field exists but nothing flags overdue tasks)

**What KAM needs:**
- Add `assigned_cam_id TEXT` to `kam_tasks` table (migration)
- Task form: "Assign To" dropdown showing CAMs of the selected college
- Overdue tasks highlighted in red (compare `dueDate` to today)
- Task status flow: Pending → In Progress → Completed (CAM side updates status; KAM sees it)
- KAM gets notified when CAM marks a task complete (email or in-app alert badge)
- Task completion rate per CAM shown in the CM Reports card header

---

### G10. Campus Issues — KAM can only resolve, not escalate or create
**Current state:**
- KAM can click "Resolve" on an issue, setting `status = "resolved"`
- KAM cannot create a new issue on behalf of a campus
- KAM cannot escalate an issue to Admin
- KAM cannot add comments/notes to an issue
- No priority-based sorting (high priority issues not highlighted at top)

**What KAM needs:**
- "Create Issue" button: title, type, priority, college, description
- "Escalate to Admin" button on high-priority issues (sets `escalated = 1, escalatedAt = now`)
- Notes/comments field (needs a `notes TEXT` column on `campus_issues`)
- Sort by: Priority (high → medium → low) then by Created date
- Filter by: College / Status / Priority / Type
- Escalated issues badge in the sidebar tab count

---

### G11. Profile tab has no edit functionality
**Current state:**
- Profile tab shows name, email, title
- All fields are read-only — there is no edit button or form
- KAM cannot update their own name, email, or title

**What KAM needs:**
- Edit mode toggle with a form for name, email, title
- Save button calls `PUT /api/kam` with updated data
- Password change link (already exists in `DashboardLayout` header dropdown, so just link to it)

---

## 🟡 MEDIUM PRIORITY MISSING — Multi-CAM Reporting Context

### G12. CM Reports tab does not show which CAM is responsible per college
**Current state:**
- `CAMCollegeCard` shows the CAM's name in the header
- But if a college has NO assigned CAM, the card shows `"Campus Manager"` as a placeholder
- There is no visual distinction between "college has CAM assigned" and "college needs a CAM"
- KAM cannot see CAM's last login date, activity status, or when they last updated data

**What KAM needs:**
- Badge: "CAM Active" (green) / "CAM Inactive" (amber) / "No CAM Assigned" (red) on each card
- Show CAM's `last_login` date under their name
- If no CAM is assigned, show an "Assign CAM" action button that navigates to Admin panel or shows a contact form
- Show CAM's email with a "Send Email" click-to-compose mailto link

---

### G13. No "Compare Campuses" view
**Current state:**
- Campus data is shown as individual cards — no side-by-side comparison
- The Overview bar chart shows faculty/students but nothing else (no attendance, fees, or handovers)

**What KAM needs — a Comparison Table view option:**
- Toggle: "Card View" / "Table View" in CM Reports tab
- Table View: one row per campus, columns:
  - Campus Name | CAM Name | Faculty | Students | Slots | Attendance % | Fees % | Open Issues | Pending Requests | Tasks Due
- Sortable columns
- Color-coded cells (red/amber/green thresholds)
- This gives KAM an instant "worst performing campus" view

---

### G14. No academic calendar visibility for KAM
**Current state:**
- Academic years and events are stored in `academic_years` and `academic_events`
- Admin can create these; CAM can view them
- KAM has ZERO visibility into the academic calendar across their campuses
- KAM sets day orders (G1) but has no idea what dates are exam weeks, semester starts, or holidays

**What KAM needs:**
- A mini calendar view (weekly or monthly) in the Overview tab showing:
  - Academic events from `academic_events` (exams, semester start/end)
  - Holidays from `holidays` table (filtered to their colleges)
  - Day order overrides from `campus_daily_configs`
- Ability to add college-specific holidays for their portfolio (calls `POST /api/holidays`)

---

## 🟡 MEDIUM PRIORITY MISSING — UI & UX Gaps

### G15. Overview KPI cards are static numbers with no trend indicators
**Current state:**
- 6 KPI cards show numbers: Campuses, Faculty, Students, Total Slots, Pending Requests, Open Issues
- No trend arrow (↑↓), no comparison to last week, no change indicator
- Numbers that are 0 look the same as numbers that are 10

**What KAM needs:**
- Trend arrows: compare this week's pending requests to last week
- Color coding for alert-worthy values (e.g., if Pending Requests > 5 → amber; if Open Issues > 0 → red background)
- Mini sparkline under each KPI showing the last 4 weeks of that metric
- "Last 7 days" vs "This month" toggle

---

### G16. No notifications / alerts system for KAM
**Current state:**
- KAM finds out about issues only by manually checking the dashboard
- No in-app notification when a CAM reports a new issue
- No alert when attendance drops below 75% at a campus
- No reminder when a task deadline is approaching

**What KAM needs:**
- A notification bell icon in the header (already have the `notifications` table)
- Auto-generate notifications when:
  - A new `campus_issue` is created by a CAM in KAM's portfolio
  - Attendance rate drops below 75% for any campus
  - A `kam_task` due date is within 2 days and still "pending"
  - A new `pending_cam` (emergency) handover request comes in
- Notification panel: list with mark-as-read, badge count on bell

---

### G17. CM Reports CAMCollegeCard uses dynamic Tailwind classes (broken in production)
**Current state:**
- Inside `CAMCollegeCard`, attendance and curriculum sections use:
  `bg-${s.color}-50`, `border-${s.color}-100`, `text-${s.color}-600`
- Tailwind JIT cannot see these at build time — production builds strip these classes
- Colors disappear in production; all stat boxes look unstyled (grey)

**Fix needed:**
```typescript
const colorStyles = {
  emerald: "bg-emerald-50 border-emerald-100 text-emerald-600 dark:bg-emerald-500/10 dark:border-emerald-500/20 dark:text-emerald-400",
  rose: "bg-rose-50 border-rose-100 text-rose-600 dark:bg-rose-500/10 dark:border-rose-500/20 dark:text-rose-400",
  amber: "bg-amber-50 border-amber-100 text-amber-600 dark:bg-amber-500/10 dark:border-amber-500/20 dark:text-amber-400",
  indigo: "bg-indigo-50 border-indigo-100 text-indigo-600 dark:bg-indigo-500/10 dark:border-indigo-500/20 dark:text-indigo-400",
  purple: "bg-purple-50 border-purple-100 text-purple-600 dark:bg-purple-500/10 dark:border-purple-500/20 dark:text-purple-400",
  slate: "bg-slate-50 border-slate-100 text-slate-600 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400",
};
```

---

### G18. Swap Ledger has no visual balance indicator per mentor
**Current state:**
- Swap Ledger shows raw rows from `approved_handovers`
- Calculates a balance number (classes owed) but displays it as text only
- No visual indicator of who owes the most, no threshold highlighting

**What KAM needs:**
- Color-coded balance badges: green (balanced/zero), amber (1–2 owed), red (3+ owed)
- Sort by balance descending so biggest debts appear first
- A "This Month" filter defaulted to current month
- "Settled" toggle to show only unbalanced entries

---

### G19. Mobile bottom nav is clipped — last tab not visible on small screens
**Current state:**
- Mobile nav shows 7 tabs: Overview, CMs, Campuses, Swaps, Tasks, Issues, Profile
- On screens narrower than 360px the last tab or two are cut off
- No horizontal scroll on the nav bar

**Fix needed:**
- Add `overflow-x-auto` and `-webkit-overflow-scrolling: touch` to the mobile nav container
- Or reduce to 5 primary tabs + "More" overflow menu (matching AdminDashboard pattern)

---

### G20. Campus Directory tab is a static dead-end
**Current state:**
- "Campus Directory" tab (id: `colleges`) in the sidebar
- Looking at the code — this tab has **no rendered content at all** in the main switch block
- It simply falls through to show nothing

**What KAM needs:**
- At minimum: a cards/list view of all colleges with address, KAM assignment confirmation, working days, shift config summary
- Click to navigate to the CM Reports card for that college
- Or merge this tab into CM Reports with a search/filter (making this tab redundant)

---

## 🔵 NEW FEATURES TO BUILD FOR KAM

### F-KAM1. ⭐ Today's Operations Panel (Top of Overview)
**Purpose:** KAM starts their day here — one glance tells them what's happening across all campuses  
**Contents:**
- Date header with day name
- Per campus row: campus name | today's day order | session mode | classes count | alert badges
- Day order shown as "Day 1 (Regular)" or "Exam Day" or "Holiday - Diwali"
- "Set Day Order" button inline per campus → small modal
- Unmarked attendance warning (pull from slots vs attendance records for today)
- Urgent requests count with jump link to CM Reports

**Backend needed:** `GET /api/daily-configs?college_id=&dateStr=` already exists. No new route needed.

---

### F-KAM2. ⭐ Multi-Campus Attendance Trend Line Chart
**Purpose:** See which campuses are improving or declining over the last 6 weeks  
**Chart spec:**
- SVG line chart (matches existing chart style in the codebase)
- X-axis: last 6 ISO weeks (W1, W2, W3, W4, W5, W6)
- Y-axis: 0–100%
- One line per campus, color-coded
- Dashed 75% threshold line in amber
- Each point is clickable — shows which slots pulled the rate down that week
- Data derivation: group `student_attendance` by week number from `dateStr`, compute weekly present/(present+absent) per college

---

### F-KAM3. ⭐ Fee Collection Progress Dashboard
**Purpose:** KAM tracks both "College Fee" and "FPC Fee" collection progress for each campus  
**Layout:**
- Top row: Total FPC Target | Total FPC Achieved | Total Outstanding | Overall Collection Rate
- Per-campus section: two horizontal bars (College Fee progress, FPC progress)
- Month selector: filter by academic month
- Comparison: "This Month vs Last Month" toggle
- Export button: download as Excel (one sheet per campus)

---

### F-KAM4. Set Day Order & Session Mode for Portfolio Campuses
**Purpose:** KAM sets the operational context for each campus each day  
**Workflow:**
1. KAM opens the "Today's Operations" panel
2. Clicks "Set Day Order" next to a campus
3. Modal opens: Date (pre-filled today) | Day Order (Day 1 / Day 2 / Day 3 / Day 4 / Day 5) | Day Type (Regular / Compensatory / Exam / Event / Holiday) | Session Mode (Online / Offline / Hybrid) | Notes (optional)
4. Save calls `POST /api/daily-configs`
5. CAM and mentors see the updated day order in their dashboards immediately

**Backend:** Route exists. Just needs KAM-side form.

---

### F-KAM5. Campus Comparison Table
**Purpose:** Instant ranking of campuses by key metrics  
**Toggle:** Switch between existing Card View and new Table View  
**Table columns:**
- Campus | CAM | Last Active | Faculty | Students | Attendance % | Fees % | Open Issues | Pending Tasks
- Sortable by any column
- Conditional formatting: red cells for attendance < 75%, red for fees < 50%, etc.
- Quick action icons in each row: View Details (→ CM Reports), Message CAM (mailto:)

---

### F-KAM6. KAM Announcements Broadcast
**Purpose:** KAM sends operational announcements to faculty/students across their colleges  
**Workflow:**
1. "New Announcement" button in Overview tab
2. Modal: Title | Body | Target (All Faculty / All Students / Specific College / All) | College filter
3. Creates `announcements` record with `college_id` scoped to KAM's portfolio

---

### F-KAM7. Notification Center
**Purpose:** KAM should not have to manually poll the dashboard for alerts  
**Trigger events that generate notifications:**
- New campus issue created by any CAM in portfolio → notify KAM
- Attendance rate drops below 75% for any campus (computed on each data refresh) → notify KAM
- A `kam_task` due date is tomorrow and status is still "pending" → notify KAM
- A `pending_cam` emergency request comes in → notify KAM immediately
**UI:** Bell icon in header, badge count, dropdown list, mark-as-read action

---

### F-KAM8. Export Reports
**Purpose:** KAM needs to present portfolio performance to their management  
**What to export:**
- Portfolio Summary PDF: all campuses, all KPIs, attendance and fee charts
- Swap Ledger Excel: per mentor balance sheet, per college tab
- Task Report Excel: all tasks by college, status, due date, completion %
**Backend:** Use ExcelJS (already installed). PDF via browser `window.print()` on a formatted print stylesheet.

---

## 📋 COMPLETE GAP SUMMARY TABLE

| ID | Priority | Category | Gap Description | Backend Work Needed |
|----|----------|----------|-----------------|---------------------|
| G1 | 🔴 Critical | Operations | Cannot set Day Order / daily config for any campus | None — API exists |
| G2 | 🔴 Critical | Workflow | Cannot approve/reject emergency handover requests | None — AppContext supports it |
| G3 | 🔴 Critical | Communication | No announcement broadcast capability | None — API exists |
| G4 | 🟠 High | Dashboard | No "Today at a Glance" panel on Overview | `GET /api/daily-configs` already exists |
| G5 | 🟠 High | Analytics | No attendance trend line chart (only current %) | Compute from existing `student_attendance` |
| G6 | 🟠 High | Analytics | No fee collection trend / College vs FPC split chart | Data already in `feeStatsMap` |
| G7 | 🟠 High | Analytics | No mentor workload / coverage gap view | `faculty_configs` table already has data |
| G8 | 🟠 High | UX | Swap Ledger has no filters, search, or export | None needed |
| G9 | 🟡 Medium | Tasks | Tasks cannot be assigned to a specific CAM | Add `assigned_cam_id` column migration |
| G10 | 🟡 Medium | Issues | Cannot create issues, escalate, or comment | Add `notes` column; API update |
| G11 | 🟡 Medium | Profile | Profile tab is read-only — no edit | None — `PUT /api/kam` exists |
| G12 | 🟡 Medium | CAM Mgmt | No CAM activity status or last login visibility | `last_login` already in `users` table |
| G13 | 🟡 Medium | Analytics | No side-by-side campus comparison table view | None needed |
| G14 | 🟡 Medium | Calendar | No academic calendar visibility | Data in `academic_events` + `holidays` |
| G15 | 🟢 Low | UI | KPI cards have no trend arrows or week comparison | Compute deltas from historical data |
| G16 | 🟢 Low | UX | No notification/alerts system for KAM | New notification generation logic |
| G17 | 🔴 Bug | UI | Dynamic Tailwind classes broken in production | No backend work — CSS fix only |
| G18 | 🟢 Low | UI | Swap Ledger balance has no visual color coding | None |
| G19 | 🟢 Low | Mobile | Mobile bottom nav clips on narrow screens | None |
| G20 | 🔴 Bug | UI | Campus Directory tab renders completely empty | None — just needs JSX content |

---

## 🏗️ RECOMMENDED IMPLEMENTATION ORDER

### Sprint 1 — Fix Broken Things (1–2 days)
1. **G17** — Fix dynamic Tailwind classes (all colors disappear in prod builds)
2. **G20** — Campus Directory tab renders blank — add content or remove tab
3. **G2** — Add Approve/Reject buttons for `pending_cam` requests in CM Reports

### Sprint 2 — Today's Operations (2–3 days)
4. **G1 + F-KAM4** — Today's Operations panel + Set Day Order modal
5. **G4** — Wire daily configs data into the Overview header

### Sprint 3 — Charts & Analytics (3–4 days)
6. **G5 + F-KAM2** — Attendance trend line chart (6-week, per campus)
7. **G6 + F-KAM3** — Fee collection College vs FPC progress bars + month filter
8. **G13 + F-KAM5** — Campus comparison table view toggle

### Sprint 4 — Task & Issue Management (2–3 days)
9. **G9** — Add `assigned_cam_id` to tasks + CAM-specific task view
10. **G10** — Issue creation, escalation, and notes
11. **G11** — Profile edit form

### Sprint 5 — Communication & Notifications (2–3 days)
12. **G3 + F-KAM6** — Announcement broadcast panel
13. **G14** — Academic calendar view in Overview
14. **G16 + F-KAM7** — Notification center (bell icon + alerts)

### Sprint 6 — Export & Polish
15. **G8** — Swap Ledger filters + export
16. **F-KAM8** — Excel/PDF export for portfolio reports
17. **G15** — KPI trend arrows
18. **G12** — CAM activity status badges
19. **G19** — Mobile nav overflow fix

---

## 📐 REVISED KAM DASHBOARD TAB STRUCTURE (Recommended)

Current sidebar groups → Recommended:

```
Campuses Group
├── Overview             ← Keep; add Today's Operations panel at top
├── CM Reports           ← Keep; add approve buttons + comparison table toggle
├── Campus Directory     ← REMOVE or merge into CM Reports
└── Academic Calendar    ← NEW (G14)

Analytics Group          ← NEW GROUP
├── Attendance Trends    ← NEW (G5)
├── Fee Collections      ← NEW (G6)
└── Workload View        ← NEW (G7)

Directives Group
├── Day Order            ← NEW (G1) — or put in Overview as panel
├── Assign Task          ← Keep; add CAM assignment
├── Escalated Issues     ← Keep; add create/escalate/notes
└── Announcements        ← NEW (G3)

Swap Ledger              ← Keep as standalone; add filters + export

Settings Group
└── My Profile           ← Keep; add edit mode
```

---

## 🔌 BACKEND GAPS THAT NEED NEW/UPDATED ROUTES

| Route | Method | Purpose | Status |
|-------|--------|---------|--------|
| `/api/daily-configs` | GET | Get configs for a college + date range | ✅ Exists |
| `/api/daily-configs` | POST | Create/update a daily config | ✅ Exists |
| `/api/kam` | GET `?id=` | Get KAM details + their campus managers | ✅ Exists (returns `campusManagers`) |
| `/api/announcements` | POST | Create announcement | ✅ Exists |
| `/api/requests/review` | POST | Approve/reject handover request | ✅ Exists (works for KAM role) |
| `/api/kam-tasks` | PUT | Update task status (CAM marks complete) | ❌ Missing — `saveKamTask` only creates |
| `/api/issues` | POST | Create new issue on behalf of campus | ✅ Exists |
| `/api/issues` | PATCH | Add notes to issue | ❌ Missing — only updates status/escalated |
| `/api/notifications` | GET | Get unread notifications for KAM | ❌ Missing — table exists, no GET route |
| `/api/notifications` | PATCH | Mark notification as read | ❌ Missing |
| `/api/login-sessions` | PATCH | Record logout time | ❌ Missing (needed for CAM last-active) |
