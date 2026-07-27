# KAM Dashboard — Full UI Audit, Missing Elements & Improvement Spec
> Every tab read line-by-line. Documents what can be added, what is broken, what needs rearranging, and new panels.
> July 2026

---

## CURRENT TAB INVENTORY (what actually renders)

| Tab ID | Label | What renders |
|--------|-------|-------------|
| `overview` | Overview | Global header, 6 KPI cards, bar chart (faculty/students per campus), donut chart (request pipeline), portfolio health bars, per-campus summary mini-cards, recent handover activity list |
| `cam_reports` | CM Reports | 4 mini-stat strip, loading skeleton, then one `CAMCollegeCard` per college (expandable with 8 sub-tabs) |
| `colleges` | Campus Directory | 4 mini-stat strip, grid of campus cards with CAM contact strip, stats, health badges |
| `tasks` | Assign Task | 4 stat strip (Total/Pending/Done/Overdue), split panel: left = create form, right = task log list |
| `escalations` | Escalated Issues | Single panel, list of campus issues with one "Mark Resolved" button per issue |
| `swap_tracker` | Swap Ledger | 4 stat cards, per-campus pending/settled breakdown, full swap requests table, faculty balance ledger table |
| `profile` | My Profile | Identity card (avatar + name + email + ID), jurisdiction card (static text), 8-metric portfolio grid |

---

## 🔴 BROKEN UI — Fix Immediately

### B1. Campus Directory tab (colleges) has dynamic Tailwind classes — broken in prod
**Location:** `colleges` tab KPI strip  
**Code:** `` bg-${kpi.color}-50 ``, `` text-${kpi.color}-600 `` etc.  
**Problem:** All color classes are purged in production builds. KPI boxes are unstyled (grey/transparent).  
**Also affects:** Profile tab metrics grid — same pattern used for 8 metric cards  
**Fix:** Replace with a static color lookup map:
```typescript
const colorMap: Record<string, string> = {
  indigo: "bg-indigo-50 border-indigo-100 text-indigo-700 dark:bg-indigo-500/10 dark:border-indigo-500/20 dark:text-indigo-300",
  emerald: "bg-emerald-50 border-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:border-emerald-500/20 dark:text-emerald-300",
  rose: "bg-rose-50 border-rose-100 text-rose-700 dark:bg-rose-500/10 dark:border-rose-500/20 dark:text-rose-300",
  amber: "bg-amber-50 border-amber-100 text-amber-700 dark:bg-amber-500/10 dark:border-amber-500/20 dark:text-amber-300",
  purple: "bg-purple-50 border-purple-100 text-purple-700 dark:bg-purple-500/10 dark:border-purple-500/20 dark:text-purple-300",
  teal: "bg-teal-50 border-teal-100 text-teal-700 dark:bg-teal-500/10 dark:border-teal-500/20 dark:text-teal-300",
  slate: "bg-slate-100 border-slate-200 text-slate-600 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400",
};
```

### B2. CAMCollegeCard attendance & curriculum sections also use dynamic Tailwind
**Location:** Inside `CAMCollegeCard` component — attendance summary grid, curriculum grid, fees grid  
**Code:** `` bg-${s.color}-50 border border-${s.colo... `` (note: even has a typo — `s.colo` not `s.color`)  
**Problem:** Colors stripped in prod. Also a JS runtime error from the typo in the border class.  
**Fix:** Same colorMap approach as B1. Also fix the typo: `s.colo` → `s.color`

### B3. Task tab has `bg-slate-105` and `border-slate-105` invalid class names
**Location:** Tasks tab, task log list  
**Code:** `className="... border-slate-105 dark:border-slate-800 bg-slate-50/50 ..."`  
**Problem:** `slate-105` is not a valid Tailwind token — silently ignored  
**Fix:** Change to `border-slate-100`

### B4. Swap Ledger tab has `border-slate-855`, `border-slate-205`, `border-slate-505` invalid classes
**Location:** Swap requests table, campus breakdown cards, pending text  
**Fix:** Replace with nearest valid tokens: `border-slate-800`, `border-slate-200`, `text-slate-500`

### B5. Escalations tab has `border-indigo-650`, `text-emerald-450`, `text-emerald-650` invalid classes
**Location:** Escalated issues panel  
**Fix:** Replace with `border-indigo-600`, `text-emerald-400`, `text-emerald-600`

### B6. Mobile bottom nav items have `h-4.5` and `w-4.5` — invalid Tailwind size classes
**Location:** Mobile nav `<Icon className="h-4.5 w-4.5" />` (appears in multiple tabs)  
**Problem:** `h-4.5`/`w-4.5` doesn't exist in Tailwind — no sizing applied to icons  
**Fix:** Change to `h-5 w-5` or `h-4 w-4`

### B7. Sidebar flyout disappears on diagonal mouse movement
**Location:** `sidebarGroups.map(...)` flyout popovers  
**Problem:** Flyout uses CSS hover on `group/nav-group`. Moving cursor diagonally from button to flyout temporarily leaves both — menu closes  
**Fix:** Use state-based hover with 100ms delay:
```typescript
const [hoveredGroupId, setHoveredGroupId] = useState<string | null>(null);
let hoverTimeout: ReturnType<typeof setTimeout>;
// onMouseLeave: setTimeout(() => setHoveredGroupId(null), 100)
// onMouseEnter: clearTimeout(hoverTimeout); setHoveredGroupId(group.id)
```

---

## 🟠 OVERVIEW TAB — What's Missing & What Can Be Better

### O1. Missing: "Today at a Glance" panel (should be the FIRST thing KAM sees)
**Current:** Overview starts with the global header, then immediately the 6 KPI number cards  
**Problem:** KAM opens the dashboard and sees aggregate totals that don't change — no operational context for today  
**Add at the very top (before KPI cards):**
```
┌──────────────────────────────────────────────────────────────────┐
│  TODAY — Monday, July 28              [Set Day Orders button]    │
├──────────────────┬────────────────┬──────────────┬──────────────┤
│ Campus A         │  Day 2 Regular │  Online      │ 8 classes    │
│ Campus B         │  Day 1 Regular │  Offline     │ 12 classes   │
│ Campus C         │  🎉 Holiday    │  —           │  —           │
├──────────────────┴────────────────┴──────────────┴──────────────┤
│  ⚠  3 slots not yet marked today across 2 campuses              │
│  ⚡  2 emergency handover requests need your action              │
└──────────────────────────────────────────────────────────────────┘
```
- Day order from `campus_daily_configs` per college  
- Unmarked slot count: compare `slots` for today's day vs `student_attendance` records for today  
- Emergency requests count: `pending_cam` requests in portfolio  
- "Set Day Orders" button → inline modal with college selector + day order form  

### O2. Missing: Urgent Actions panel (when `pending_cam` requests exist)
**Current:** Emergency requests are only visible deep inside CM Reports → expand card → Requests sub-tab  
**Problem:** KAM has no way to know an emergency exists without drilling into every card  
**Add:** Conditionally rendered banner between header and KPIs when `totalPendingCamRequests > 0`:
```
┌─────────────────────────────────────────────────────────────────┐
│  ⚡ URGENT — 2 emergency handover requests need your approval    │
│  [Campus A — Dr. Ramesh → Cover: Dr. Priya | View & Approve ›]  │
│  [Campus B — Prof. Kumar → Cover: Prof. Anita | View & Approve ›]│
└─────────────────────────────────────────────────────────────────┘
```
- Each row shows: Campus name, requestor → target, course, date  
- "Approve" and "Reject" buttons inline (calls `handleRequest()` in AppContext — already works)  

### O3. KPI cards have no trend or context — just bare numbers
**Current:** 6 boxes showing raw counts (Campuses: 3, Faculty: 45, etc.)  
**Problems:**  
- "Campuses: 3" never changes — why is it a KPI?  
- "Pending Requests: 0" looks identical to "Pending Requests: 5"  
- No trend, no delta, no visual weight difference between "all good" and "critical"  

**Improvements:**
- Remove "Campuses" KPI (it's in the sidebar header already) — replace with "Attendance Health" (% of campuses above 75%)
- Add micro color-coding: green bg when 0, red/amber when > 0 for alert metrics
- Add tiny trend text: "↑2 from last week" or "↓3 from yesterday"
- Reorder by urgency: Open Issues → Pending Requests → Pending Tasks → Faculty → Students → Total Slots

### O4. Bar chart and Donut chart are good but underutilized
**Current:** Bar chart shows Faculty + Students per campus (correct and useful)  
**Improvements:**
- Add a third bar to the chart: Slots per campus (amber) — this shows timetable coverage  
- Add a horizontal 75% threshold line to the chart area
- Make bars clickable — click a campus bar → jump to CM Reports filtered to that campus
- Donut chart: add a center click action → jumps to CM Reports tab

### O5. Portfolio Health bars are a great pattern — expand it
**Current:** Per-campus rows with Attendance % bar + Fee % bar (horizontal gradient bars)  
**This is the best widget on the page — extend it:**
- Add a third bar: "Timetable Coverage %" = `slots.length / (mentors.length * expected_weekly_hours) * 100`
- Add tooltip on hover showing the raw numbers (e.g., "Present: 320 / Total: 430")
- Add a "Drill Down ↗" link on each row → goes to that college's CM Report card

### O6. Recent Handover Activity list needs action buttons
**Current:** Shows 8 recent requests as read-only cards — no action possible  
**Problem:** KAM sees `pending_cam` requests here but can't approve them  
**Fix:**
- For `pending_cam` status rows: show Approve (green) + Reject (red) buttons inline  
- For `pending` rows: show "View Details" that expands to show reason  
- Add a "View All" link at the bottom → navigates to CM Reports

### O7. Missing: Announcements compose button
**Current:** No way for KAM to send announcements anywhere in the dashboard  
**Add:** A small "Compose Announcement" card below the health bars:
```
[ + New Announcement ]  (collapsed button, expands inline)
  Title: _______________  Target: [All Colleges ▾]  Role: [All ▾]
  Body:  _________________________________
  [ Post Announcement ]
```
- Calls `POST /api/announcements` — already works

---

## 🟠 CM REPORTS TAB — What's Missing & What Can Be Better

### C1. The 4-stat mini-strip at the top of CM Reports is duplicate info from Overview
**Current:** "Total Faculty / Total Students / Pending Handovers / Open Issues" strip — exact same numbers as Overview KPIs  
**Fix:** Replace with CM-reports-specific stats:  
- "CMs Active Today" (based on last_login within 24hrs)  
- "Colleges with Pending Requests" (count, not total requests)  
- "Colleges with Attendance < 75%"  
- "Timetable Coverage Gaps" (campuses with unmapped subjects)

### C2. CAMCollegeCard has no "Quick Actions" for KAM
**Current:** Each card is purely informational — KAM can read data but take no action  
**Add a Quick Actions row at the bottom of the card header (always visible, not in expandable):**
```
[ ⚡ Approve Emergency (2) ]  [ 📋 Assign Task ]  [ 📢 Announce ]  [ 🔗 Open in Full View ]
```
- Approve Emergency: inline mini-list of `pending_cam` requests for this college  
- Assign Task: opens inline task form pre-filled with this college  
- Announce: opens announcement compose pre-filled with this college's `college_id`  

### C3. CAMCollegeCard load state is a full skeleton — no partial data shown
**Current:** While `loadingCams` is true, entire card area shows a shimmer skeleton  
**Problem:** The college name, mentors, students, slots are all available from AppContext immediately — only fee data requires an API call  
**Fix:** Show the card header (name, KPI numbers) immediately. Only show loading state in the Fees sub-tab  

### C4. CAMCollegeCard attendance section only shows a list of mentors — no per-class-group breakdown
**Current:** Attendance section shows: summary (present/absent/OD totals) + progress bar + mentor-by-mentor slot count  
**Missing:** Which class groups are below the attendance threshold?  
**Add:**
- A class group breakdown table: Class Group | Expected Sessions | Marked | Attendance % | Status badge  
- Highlight rows where attendance < 75% in rose background  
- This is computable from existing data: group `student_attendance` by `slots.classGroup`

### C5. CAMCollegeCard Requests section has no approve/reject action
**Current:** Requests sub-tab shows all handover requests as read-only colored cards  
**Critical:** `pending_cam` requests need KAM approval but there are ZERO action buttons  
**Fix:** For requests with `status === "pending_cam"`:
```
[ ✓ Approve ]  [ ✗ Reject (with reason) ]
```
- Calls `handleRequest(requestId, "approved"/"rejected", reason, "Key Account Manager")`  
- This function already exists and correctly creates `approved_handovers` records

### C6. CAMCollegeCard Fees section divides by 100 incorrectly
**Location:** `CAMCollegeCard` fees section  
**Code:** `₹${(feeStats.totalFees / 100).toLocaleString()}`  
**Problem:** Fee amounts are stored in rupees, not paise. Dividing by 100 shows ₹450 instead of ₹45,000  
**Fix:** Remove the `/ 100` division

### C7. Missing: "Compare All Campuses" toggle in CM Reports
**Current:** Campuses are shown as individual expandable cards — no way to compare side-by-side  
**Add a view toggle:** [📋 Cards] [📊 Table]  
**Table view columns:**
| Campus | CAM | Last Active | Faculty | Students | Slots | Attendance | Fees | Issues | Tasks |  
- Sortable columns  
- Red cells for attendance < 75%, fees < 50%  
- Gives instant "worst performing campus" ranking  

### C8. CM Reports loads CAM data via a cascading API call chain on every mount
**Current:** `useEffect` → `fetch(/api/kam?id=...)` → for each CM → `fetch(/api/cam?id=...)` + `fetch(/api/fees?role=cam&camId=...)`  
**Problem:** If KAM has 5 campuses = 11 API calls on every tab switch  
**Fix:** Add `GET /api/kam?id=&include=campusManagers,fees` to return all data in one call  
Or: cache the result in component state and only refetch on manual "Refresh" click

---

## 🟠 CAMPUS DIRECTORY TAB — Rearrange & Improve

### D1. Campus Directory is redundant with CM Reports
**Current:** Both tabs show: Campus name, address, CAM contact, faculty/student counts, health badges  
**CM Reports** already has all of this and more (expandable detail)  
**Recommendation:** Merge or differentiate clearly:
- Option A (Recommended): Rename "Campus Directory" to **"Campus Setup"** and make it the config/admin view — edit campus working days, shift configs, rooms list, academic year
- Option B: Remove the tab entirely and add a search/filter bar to CM Reports

### D2. Campus Directory cards are missing actionable KAM data
**Current cards show:** Name, Address, CAM contact strip, Faculty/Students/Slots counts, Departments/Subjects badge, Fee %, Task completion  
**Missing on campus cards:**
- Today's Day Order status (from `campus_daily_configs`)
- Working days config (5 or 6 day week) — from `colleges.working_days`
- Shift config summary (Shift-based or General) — from `colleges.has_shifts`
- Timetable generation status (is there a timetable? when was it last updated?)
- "Set Day Order" button on each card

### D3. Campus Directory has dynamic Tailwind in stat grid (same B1 issue)
**Code:** `` text-${s.color}-600 `` in the stats grid  
**Fix:** Same colorMap as B1

---

## 🟠 ASSIGN TASK TAB — Rearrange & Improve

### T1. Task form should show the assigned CAM's name, not just the college
**Current:** "Target College" dropdown shows college names  
**Problem:** KAM is assigning to a campus, not directly to the CAM — but the CAM is responsible for executing it  
**Improvement:**
- When a college is selected, show below the dropdown: "Assigned CM: [CAM name] — [CAM email]"
- Add an "Assign to specific CM" option when a college has multiple managers (future-proof)

### T2. Task log has no filter — shows all tasks from all colleges unsorted (besides overdue-first)
**Current:** All tasks from all colleges in one scrollable list with overdue-first sort  
**Add:**
- College filter dropdown (showing only this KAM's colleges)  
- Status filter: All / Pending / Completed / Overdue  
- Priority filter: All / High / Medium / Low

### T3. Task log has no "Mark Complete" button — only delete
**Current:** Task rows show a delete (trash) button only  
**Problem:** There is no `PUT /api/tasks?id=&status=completed` route either  
**This is a critical workflow gap:** KAM assigns tasks, but neither KAM nor CAM can mark them done  
**Fix needed:**
- Add `PUT /api/tasks` route to update status  
- Add "Mark Complete" button (green checkmark) on task rows where status is "pending"  
- CAM dashboard should also show tasks assigned to their college with a "Mark Complete" button

### T4. Task completion rate per campus is missing from the task tab
**Current:** 4 KPI cards at top show portfolio totals (Total / Pending / Completed / Overdue)  
**Add:** Per-campus completion rate bar below the KPI strip:
```
Campus A: ████████░░ 5/8 tasks complete (63%)
Campus B: ██████████ 3/3 tasks complete (100%) ✓
Campus C: ██░░░░░░░░ 1/5 tasks complete (20%) ⚠
```

### T5. No task description / notes field
**Current:** Task form has: College, Title, Priority, Due Date  
**Missing:** A textarea for additional instructions or context  
**Fix:** Add `description TEXT` column to `kam_tasks` (migration) and a textarea in the form

---

## 🟠 ESCALATED ISSUES TAB — Rearrange & Improve

### E1. Issues are sorted by escalation date — should be by priority first
**Current:** Issues sorted by `escalatedAt DESC`  
**Better order:** High priority first → then by escalation date within each priority

### E2. "Mark Resolved" is the only action — too simplistic
**Current:** One "Mark Resolved" button per issue  
**Missing actions:**
- "Escalate to Admin" button for high-priority issues (sets `escalated = 1`)
- "Add Note" button to log KAM's response or investigation notes
- "Assign to CAM" — notify the CAM that this issue needs their action

### E3. No way to create a new issue from KAM side
**Current:** KAM can only see issues reported by CAMs  
**Sometimes KAM discovers an issue during a campus visit**  
**Add:** "+ Report Issue" button at top of the panel — opens a modal with: Title, Type, Priority, College, Description

### E4. Issues panel is a single narrow `max-w-3xl` column — wastes screen space
**Current:** `<div className="max-w-3xl mx-auto w-full">` — centered narrow panel even on wide screens  
**Fix:** Remove the max-width constraint; use the full content area. Add a 2-column grid for large screens:
```
Left column: Open/Pending issues (sorted by priority)
Right column: Resolved issues log
```

### E5. Resolved issues are shown in the same list mixed with open ones
**Current:** All issues in one list — resolved and pending mixed together  
**Fix:** Add a `[Open (3)] [Resolved (7)]` tab toggle at the top of the panel

---

## 🟠 SWAP LEDGER TAB — Rearrange & Improve

### S1. Swap Ledger shows ALL time data with no date filter
**Current:** Shows every approved handover since the beginning of time  
**This renders useless on a campus that's been running for 6 months with hundreds of handovers**  
**Add at the top:**
- Month filter (dropdown: "July 2026 / June 2026 / May 2026 / All Time")  
- College filter (multi-select)  
- "Unbalanced Only" toggle to show only mentors with non-zero balance

### S2. Faculty balance ledger table missing key context
**Current:** Ledger table shows: Faculty | Campus | Given | Received | Balance | Pending | Settled  
**Add columns:**
- "Last Swap Date" — when was the most recent swap for this mentor?
- "Notes" — for KAM to add context (e.g., "Approved exception — campus event")
- Make balance cell a colored badge: green (0 = balanced), amber (+ve = owed to them), red (-ve = owes someone)

### S3. No export button on the Swap Ledger
**Current:** No way to download the ledger table  
**Add:** "Download Excel" button at top right — uses ExcelJS (already installed) to generate a formatted workbook with:
- Sheet 1: All swap requests (chronological)
- Sheet 2: Faculty balance ledger
- Sheet 3: Per-campus summary

### S4. Per-campus swap breakdown cards use inline styles that could use proper Tailwind
**Current:** Campus breakdown cards show Pending/Settled as two mini-boxes  
**Missing:** What's the "Settlement Rate %" for each campus? (settled / total * 100)  
**Add:** A small progress bar inside each campus card: `settled/total` with color coding

### S5. KAM cannot approve swap compensation requests from the Swap Ledger
**Current:** Swap requests show status labels (Awaiting / Settled / Declined) — no approve button  
**For `pending`/`pending_cam` rows — add action buttons inline:**
- "✓ Approve" and "✗ Decline" buttons that call `handleRequest()` in AppContext  
- This is the same function used by CAMs — just needs KAM's role passed as `actorRole`

---

## 🟠 PROFILE TAB — Rearrange & Improve

### P1. Profile is entirely read-only — no edit functionality
**Current:** Shows name, email, ID, title as static text  
**Fix:** Add an "Edit Profile" button → toggle to a form with Save/Cancel:
- Name input
- Email input (with uniqueness check)
- Title input
- Calls `PUT /api/kam` — already exists

### P2. "Operations & Jurisdiction" card has hardcoded static text
**Current:** "Scope of Authority: Multi-Campus Portfolios", "Security Level: Level 3 Regional Head" etc.  
**This is fake descriptive text that looks real — confuses new users**  
**Fix:** Replace with actual dynamic data:
- "Assigned Since: [date from users.created_at]"
- "Last Login: [relative time from users.last_login]"
- "Campuses Managed: [list of college names]"
- "Total Students Supervised: [real count]"

### P3. Profile portfolio metrics grid has SAME dynamic Tailwind color bug (B1)
**Location:** 8-metric grid in profile tab  
**Code:** `` bg-${m.color}-50 border border-${m.color}-100 `` etc.  
**Fix:** Same colorMap approach — this is the third location of the same bug

### P4. Profile tab should show a "My Activity" section
**Add below the metrics grid:**
- Last 5 tasks created by this KAM with their status
- Last 5 issues resolved by this KAM  
- "Change Password" link (already exists in header dropdown — duplicate here for convenience)

---

## 🟢 NEW PANELS TO ADD — Fully Specced

### N1. ⭐ Today's Operations Panel (Top of Overview tab)
**Position:** First thing after the global header, before KPI cards  
**Component:** `<TodayOperationsPanel colleges={activeColleges} />`  

**Contents:**
```
Header: "Today — Monday July 28, 2026"   [+ Set Day Orders]

Per-campus row (one per college):
  [College Name]  |  [Day Order badge]  |  [Session Mode]  |  [X classes]  |  [Action]

Day Order badge examples:
  "Day 2 — Regular"   (green)
  "Exam Day"          (amber)  
  "Holiday"           (slate, no class count)
  "Not Set"           (rose — needs attention)

Alert strip below rows (conditional):
  ⚠ 3 classes have no attendance marked today
  ⚡ 2 emergency requests pending your approval → [Review Now]
```

**Data sources:**
- Day order: `campus_daily_configs` filtered to `dateStr = today`
- Class count: `slots` where `day === today.dayName` for each college
- Unmarked: `slots` for today minus `student_attendance` records for today
- Emergency: `requests` where `status === "pending_cam"` in portfolio

**Set Day Order modal (triggered per campus):**
```
College: [pre-filled, disabled]
Date: [pre-filled today, editable]
Day Order: [Day 1 / Day 2 / Day 3 / Day 4 / Day 5]
Day Type: [Regular / Compensatory / Exam Day / Event / Holiday]
Session Mode: [Online / Offline / Hybrid]
Notes: [optional textarea]
[Save Day Config]
```
Calls: `POST /api/daily-configs`

---

### N2. ⭐ Multi-Campus Attendance Trend Chart (New Analytics tab or inside Overview)
**Position:** New section in Overview after Portfolio Health, OR new "Analytics" tab  
**Component:** `<AttendanceTrendChart colleges={activeColleges} attendance={studentAttendance} />`  

**Chart spec (SVG line chart — matches existing chart style):**
- X-axis: Last 6 weeks labeled "Wk 1" through "Wk 6"
- Y-axis: 0–100%
- One colored line per campus
- Dashed amber line at 75% threshold
- Each data point = that week's present/(present+absent) for that campus's students
- Dots on each data point — hover shows: "Campus A — Week 3: 71% (312/440)"
- Legend below chart: color swatch + campus name + current week %

**Data derivation:**
```typescript
// Group studentAttendance by week number
const getWeekNumber = (dateStr: string) => {
  const d = new Date(dateStr + "T00:00:00");
  const startOfYear = new Date(d.getFullYear(), 0, 1);
  return Math.ceil(((d.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7);
};
```

---

### N3. ⭐ Fee Collection Dashboard (New section in Overview or Analytics tab)
**Component:** `<FeeCollectionDashboard colleges={activeColleges} feeStats={feeStatsMap} />`  

**Section header with month selector:**  
`[< June 2026] [July 2026] [August 2026 >]`

**Top summary strip:**
```
FPC Target: ₹12,40,000  |  FPC Achieved: ₹9,30,000  |  Outstanding: ₹3,10,000  |  Rate: 75% ▲
College Fee Target: ₹85,00,000  |  College Achieved: ₹62,00,000
```

**Per-campus horizontal bars (two per campus):**
```
Campus A:
  College Fee:  [████████████░░░░░░] 72%  ₹62L / ₹86L
  FPC Fee:      [█████████████████░] 88%  ₹44L / ₹50L

Campus B:
  College Fee:  [████████░░░░░░░░░░] 48%  ₹28L / ₹58L  ⚠
  FPC Fee:      [████████████░░░░░░] 63%  ₹31L / ₹49L
```

**Export button:** "Download Report (Excel)" → ExcelJS workbook

---

### N4. Emergency Approvals Banner (Conditional — appears when `pending_cam > 0`)
**Position:** Between header and KPI cards in Overview  
**Renders only when:** `requests.filter(r => r.status === "pending_cam" && portfolioMentorIds.has(r.requestorId)).length > 0`

```
┌────────────────────────────────────────────────────────────────────┐
│  ⚡  2 Emergency Handover Requests Need Your Approval               │
│                                                                     │
│  Dr. Ramesh → Dr. Priya Kumar                                       │
│  Python Programming · Campus A · July 28                           │
│  Reason: "Medical emergency — hospital admission"                  │
│  [✓ Approve]  [✗ Reject]                                           │
│                                                                     │
│  Prof. Mehta → Prof. Sivakumar                                      │  
│  Data Structures · Campus B · July 28                              │
│  [✓ Approve]  [✗ Reject]                                           │
└────────────────────────────────────────────────────────────────────┘
```

---

### N5. Notification Bell & Panel
**Position:** In the global header (`DashboardLayout`) next to the profile dropdown — but since DashboardLayout is shared, implement as a KAM-specific panel in the header area of the dashboard  
**Alternative:** Add a notification panel as a sidebar item or floating icon in the KAM main content area

**Notification triggers:**
| Event | Message |
|-------|---------|
| New `campus_issue` created by CAM in portfolio | "⚠ Campus A reported a new infrastructure issue" |
| Attendance rate drops below 75% for a campus | "📉 Campus B attendance dropped to 68% this week" |
| `kam_task` due date is tomorrow + still pending | "⏰ Task 'Verify attendance records' is due tomorrow" |
| New `pending_cam` request in portfolio | "⚡ Emergency handover request from Campus C" |

**Reads from:** `notifications` table (already exists in DB; no GET route yet — needs `GET /api/notifications?userId=`)

---

### N6. Campus Comparison Table (Toggle inside CM Reports tab)
**Toggle buttons:** `[📋 Card View]  [📊 Table View]`

**Table columns:**
| # | Campus | CAM | Last Active | Faculty | Students | Slots | Attend% | Fees% | Open Issues | Pending Tasks |
|---|--------|-----|-------------|---------|----------|-------|---------|-------|-------------|---------------|

**Visual rules:**
- Attendance % cell: green if ≥ 75%, red if < 75%
- Fees % cell: green if ≥ 80%, amber if 50–79%, red if < 50%  
- Open Issues cell: red if > 0, green if 0
- Row click → expands to show the CAMCollegeCard for that campus

**Sort:** Clickable column headers. Default sort: Attendance % ascending (worst first)

---

## 📐 FINAL RECOMMENDED TAB LAYOUT & REARRANGEMENT

### Sidebar Structure (Revised)

```
Portfolio Group
├── Overview          ← Keep. Add: Today panel, Urgent approvals banner, Announcement compose
├── CM Reports        ← Keep. Add: Comparison table toggle, approve buttons, fix card actions  
└── Campus Directory  ← RENAME to "Campus Setup". Differentiate: show config data not just stats

Analytics Group  ← NEW GROUP
├── Attendance Trends ← NEW (N2)
└── Fee Collections   ← NEW (N3)

Directives Group
├── Day Order Config  ← NEW (G1 / N1 extracted as standalone tab)
├── Tasks             ← Keep. Add: CAM name preview, filter, mark-complete, description field
├── Issues            ← Keep. Add: create, escalate, notes, filter, 2-col layout
└── Announcements     ← NEW (N7)

Swap Ledger           ← Keep as standalone. Add: month filter, export, approve buttons

Settings
└── My Profile        ← Keep. Add: edit mode, real dynamic data, activity log
```

### Mobile Bottom Nav (Revised — 5 tabs + More)
```
Current 7 tabs on mobile: Overview | CMs | Campuses | Swaps | Tasks | Issues | Profile
Problem: 7 tabs = cramped; icons get cut off on narrow screens

Revised (5 + More):
Overview | CM Reports | Tasks | Issues | More ▾
                                         └─ Campus Directory
                                         └─ Swap Ledger  
                                         └─ Analytics
                                         └─ My Profile
```

---

## 📋 COMPLETE UI ISSUES & ADDITIONS SUMMARY

| ID | Tab | Type | Description | Effort |
|----|-----|------|-------------|--------|
| B1 | Colleges | 🔴 Bug | Dynamic Tailwind classes broken in prod (KPI strip) | 15 min |
| B2 | CM Reports | 🔴 Bug | Dynamic Tailwind + typo `s.colo` in CAMCollegeCard | 15 min |
| B3 | Tasks | 🔴 Bug | `border-slate-105` invalid class | 5 min |
| B4 | Swap Ledger | 🔴 Bug | `border-slate-855`, `border-slate-205` invalid classes | 5 min |
| B5 | Escalations | 🔴 Bug | `border-indigo-650`, `text-emerald-450` invalid | 5 min |
| B6 | Mobile Nav | 🔴 Bug | `h-4.5 w-4.5` invalid Tailwind size | 5 min |
| B7 | Sidebar | 🟠 Bug | Flyout closes on diagonal mouse movement | 30 min |
| O1 | Overview | ⭐ New | Today's Operations panel | 4 hrs |
| O2 | Overview | ⭐ New | Urgent Actions banner for pending_cam | 2 hrs |
| O3 | Overview | 🟠 Improve | KPI cards — add trend, color logic, reorder | 1 hr |
| O4 | Overview | 🟢 Improve | Bar chart — add slots bar, make clickable | 1 hr |
| O5 | Overview | 🟠 Improve | Portfolio health — add coverage bar, tooltips, drill link | 1 hr |
| O6 | Overview | 🟠 Improve | Recent handovers — add approve buttons for pending_cam | 1 hr |
| O7 | Overview | ⭐ New | Announcement compose panel | 2 hrs |
| C1 | CM Reports | 🟠 Improve | Replace mini-strip with CM-specific stats | 30 min |
| C2 | CM Reports | ⭐ New | Quick Actions row on each CAMCollegeCard | 2 hrs |
| C3 | CM Reports | 🟠 Improve | Show college data immediately, delay only fees | 1 hr |
| C4 | CM Reports | 🟠 Improve | Add class-group breakdown to attendance sub-tab | 2 hrs |
| C5 | CM Reports | 🔴 Missing | Add approve/reject buttons for pending_cam requests | 2 hrs |
| C6 | CM Reports | 🔴 Bug | Fee amounts divided by 100 incorrectly | 5 min |
| C7 | CM Reports | ⭐ New | Comparison table view toggle | 3 hrs |
| C8 | CM Reports | 🟠 Perf | Reduce API call chain on mount | 2 hrs |
| D1 | Directory | 🟠 Improve | Rename to "Campus Setup" and differentiate from CM Reports | 1 hr |
| D2 | Directory | 🟠 Improve | Add Day Order, working days, shift config to cards | 2 hrs |
| D3 | Directory | 🔴 Bug | Dynamic Tailwind in stats grid (same as B1) | 10 min |
| T1 | Tasks | 🟠 Improve | Show assigned CAM name when college selected | 30 min |
| T2 | Tasks | 🟠 Improve | Add filters (college, status, priority) to task log | 1 hr |
| T3 | Tasks | 🔴 Missing | Add "Mark Complete" button + PUT /api/tasks route | 3 hrs |
| T4 | Tasks | 🟠 Improve | Per-campus completion rate bars | 1 hr |
| T5 | Tasks | 🟠 Improve | Add description/notes field to task form | 1 hr |
| E1 | Issues | 🟠 Improve | Sort by priority first, then date | 15 min |
| E2 | Issues | 🟠 Improve | Add Escalate to Admin + Add Note actions | 2 hrs |
| E3 | Issues | 🟠 Improve | Add "Create Issue" from KAM side | 1 hr |
| E4 | Issues | 🟠 Improve | Remove max-width, 2-column layout on wide screens | 30 min |
| E5 | Issues | 🟠 Improve | Open / Resolved toggle tabs | 30 min |
| S1 | Swap | 🟠 Improve | Month + college filters + Unbalanced toggle | 1 hr |
| S2 | Swap | 🟠 Improve | Add last swap date + colored balance badges | 30 min |
| S3 | Swap | 🟠 Improve | Add Excel export button | 2 hrs |
| S4 | Swap | 🟠 Improve | Per-campus settlement rate progress bar | 30 min |
| S5 | Swap | 🔴 Missing | Approve/reject pending swap requests inline | 2 hrs |
| P1 | Profile | 🔴 Missing | Edit profile form | 1 hr |
| P2 | Profile | 🟠 Improve | Replace hardcoded static text with real data | 30 min |
| P3 | Profile | 🔴 Bug | Dynamic Tailwind in metrics grid (same as B1) | 10 min |
| P4 | Profile | 🟠 Improve | Add "My Activity" section (recent tasks, resolved issues) | 1 hr |
| N1 | New | ⭐ Feature | Today's Operations panel (Day Order setter + class status) | 4 hrs |
| N2 | New | ⭐ Feature | Attendance Trend line chart (6-week per campus) | 4 hrs |
| N3 | New | ⭐ Feature | Fee Collection dashboard (College vs FPC split) | 4 hrs |
| N4 | New | ⭐ Feature | Emergency Approvals banner (conditional) | 2 hrs |
| N5 | New | ⭐ Feature | Notification bell + panel | 4 hrs |
| N6 | New | ⭐ Feature | Campus comparison table view | 3 hrs |

**Total: 45 items — 7 critical bugs (< 1 day combined), 38 improvements/features**

---

## 🚀 QUICK WIN ORDER (Highest impact / lowest effort first)

1. **B1–B6 + B2 + D3 + P3** — Fix all dynamic Tailwind bugs (30 min total, massive visual fix in prod)
2. **C6** — Fix fee amounts divided by 100 (5 min, shows wrong rupee amounts right now)  
3. **C5 + S5** — Add approve/reject buttons for requests (KAM's most needed action, already works in backend)
4. **O2 + N4** — Emergency approvals banner (2 hrs, changes KAM from passive to active)
5. **T3** — Mark Complete button for tasks (3 hrs, currently tasks can never be finished)
6. **O1 + N1** — Today's Operations panel (4 hrs, biggest daily value for KAM)
7. **E4 + E5** — Issues layout + open/resolved tabs (1 hr, simple layout improvement)
8. **T1 + T2 + T5** — Task form improvements (2 hrs combined)
9. **C7 + N6** — Campus comparison table (3 hrs, gives KAM instant ranking view)
10. **N2** — Attendance trend chart (4 hrs, changes flat % to actionable trend)
