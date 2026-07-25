# KAM Dashboard — Comprehensive Audit, Bug Report & Redesign Guide

## Overview

The KAM (Key Account Manager) Dashboard is the **regional management layer** sitting above one or more CAM (Campus Manager) dashboards. Each CAM manages a single college; the KAM oversees a portfolio of colleges and the CAMs assigned to them. This document audits the current implementation, identifies every bug and logic problem, and then describes what a correct, complete KAM dashboard should look like given the CAM→KAM reporting structure.

---

## 1. Role Hierarchy & Reporting Chain

```
KAM (Key Account Manager)
 └── CAM (Campus Manager)  ← one per college, reports UP to KAM
      └── Mentors (Faculty)
           └── Students
```

**Key data flows that a KAM must receive from each CAM:**
- Faculty roster, slot counts, swap/handover requests
- Student roster and counts
- Campus issues (escalations) raised by the CAM
- KAM tasks assigned to the CAM (completion status reported back)
- Approved/pending handovers (swap ledger)
- Fee summaries, attendance health, curriculum health (currently missing from KAM)

---

## 2. Current Tab Inventory

| Tab ID | Label | Status |
|---|---|---|
| `overview` | Overview | ⚠️ Partial — missing data |
| `cam_reports` | CM Reports | 🔴 Critical bugs |
| `colleges` | Campus Directory | ⚠️ Cosmetic only |
| `tasks` | Assign Task | ⚠️ Logic bugs |
| `escalations` | Escalated Issues | ⚠️ Filtering bugs |
| `swap_tracker` | Swap Ledger | ⚠️ Logic gaps |
| `profile` | My Profile | ✅ Working |

---

## 3. Bug Report — Specific Issues Found

### 🔴 BUG 1 — CAM data fetch uses wrong ID (Critical)

**File:** `KAMDashboard.tsx` — `useEffect` around line 476  
**Code:**
```typescript
fetch(`/api/kam?id=${encodeURIComponent(currentKAM.id)}`)
  .then(r => r.json())
  .then(data => {
    if (data.success && data.campusManagers) {
      const map: Record<string, any> = {};
      data.campusManagers.forEach((cam: any) => { map[cam.college_id] = cam; });
      setCamDataMap(map);
    }
  })
```

**Problem:** The component calls `/api/kam?id=…` to get CAM data, but the KAM API endpoint does NOT return anything labeled `campusManagers` with full data. Looking at `/api/kam/route.ts`, it returns `campusManagers` with only `id, name, email, college_id, kam_id, college_name` — **no timetable, slots, curriculum, or issues data at all**. So `camDataMap` only ever holds the bare profile record, not any meaningful reporting data.

**Impact:** Every `CAMCollegeCard` receives a nearly-empty `cam` prop. The "View Details" drill-down shows correct mentor/student counts (because those come from the global context), but the CAM identity itself may be null (`cam || { name: "CM — ${college.name}", email: "—", id: null }`), which means the KAM sees placeholder data instead of the real CM name and email.

**Fix required:** Either enrich the `/api/kam` response to join `campus_managers` data fully, or make a separate call per college to `/api/cam?id=<cam_id>` to get real per-CAM data.

---

### 🔴 BUG 2 — `portfolioMentorIds` computed AFTER it is used in `getNotificationCount`

**File:** `KAMDashboard.tsx` — line ~550 (notification count function) vs line ~560 (portfolio ids)

**Code order:**
```typescript
// getNotificationCount defined here — uses portfolioMentorIds
const getNotificationCount = (tabId: string) => {
  if (tabId === "cam_reports") return requests.filter(r => r.status === "pending_cam" && portfolioMentorIds.has(r.requestorId)).length;
  ...
};

// sidebarGroups defined here — calls getNotificationCount

// portfolioMentorIds computed HERE, after both of the above
const portfolioMentorIds = new Set(mentors.filter(...).map(m => m.id));
```

**Problem:** In JavaScript/TypeScript, `const` declarations using `new Set(...)` are not hoisted. `getNotificationCount` closes over `portfolioMentorIds` at the time of call, but the function is called inside `sidebarGroups` map, which happens during the same render pass — before `portfolioMentorIds` is declared in the code flow. This causes a **ReferenceError at runtime** or returns 0 incorrectly depending on JS engine strictness.

**Fix required:** Move the `portfolioMentorIds` (and all portfolio-wide computed stats) to the **top of the function body**, before `getNotificationCount` and `sidebarGroups`.

---

### 🔴 BUG 3 — Escalations tab shows ALL escalations, not just KAM's portfolio

**File:** `KAMDashboard.tsx` — Escalations tab render (~line 1040)
```typescript
{escalations.map(esc => ( ... ))}
```

**Problem:** `escalations` is the raw `campusIssues` array from context, which contains issues from **all colleges in the system**, not just the colleges belonging to this KAM. There is no filter by `collegeId` against `activeColleges`.

The notification counter does filter correctly:
```typescript
if (tabId === "escalations") return escalations.filter(e => (e.status === "pending" || e.status === "open") && activeColleges.some(c => c.id === e.collegeId)).length;
```
…but the actual rendered list does not apply this same filter.

**Fix required:**
```typescript
const portfolioEscalations = escalations.filter(e => activeColleges.some(c => c.id === e.collegeId));
// use portfolioEscalations in the tab render
```

---

### 🔴 BUG 4 — Tasks tab shows tasks for all colleges, filter is inconsistent

**File:** `KAMDashboard.tsx` — Tasks tab, Task Logs panel (~line 1002)
```typescript
tasks.filter(t => activeColleges.some(c => c.id === t.collegeId)).map(t => { ... })
```

The filter **is present** in the Task Logs panel, but **missing** in the notification count for the `tasks` tab:
```typescript
if (tabId === "tasks") return tasks.filter(t => t.status === "pending" && activeColleges.some(c => c.id === t.collegeId)).length;
```

The notification count filters by `activeColleges`, but `totalPendingTasks` (shown in Overview KPI) does not:
```typescript
const totalPendingTasks = tasks.filter(t => t.status === "pending").length;
// ❌ Missing: && activeColleges.some(c => c.id === t.collegeId)
```

**Fix required:** Apply `activeColleges` filter to `totalPendingTasks` and every tasks summary throughout.

---

### 🔴 BUG 5 — `totalOpenIssues` also not scoped to portfolio

**File:** `KAMDashboard.tsx` — line ~560
```typescript
const totalOpenIssues = escalations.filter(e => e.status === "pending" || e.status === "open").length;
```

Same as Bug 3 — no filter for `activeColleges`. The KPI card and Overview show a cross-system issue count.

---

### 🟡 BUG 6 — Swap ledger balance logic is inverted

**File:** `KAMDashboard.tsx` — Faculty Workload Balance Overview table (~line 1150)

```typescript
const ledgerList = Array.from(ledgerMap.values())
  .map(row => ({ ...row, balance: row.given - row.received }))
  .filter(row => row.balance !== 0 || row.swapsPending > 0 || row.swapsSettled > 0)
  .sort((a, b) => b.balance - a.balance);
```

And the row highlight:
```typescript
className={`... ${row.balance > 0 && row.swapsPending === 0 ? "bg-rose-50/30 ..." : ""}`}
```

**Problem:** A positive balance (`given > received`) means the faculty **gave more classes than they received back** — they are owed classes, not in debt. The red highlight (`bg-rose-50`) for `balance > 0` is semantically backwards. Faculty who gave more should be highlighted in **amber** (they are owed), and faculty who received more than they gave should be in **rose** (they owe). The column header `Given (−)` confirms the sign convention: giving is a negative event (you covered for someone and haven't been paid back), but the sort and highlight treat positive balance as the "bad" state.

**Fix required:** Flip the highlight logic and update column labels to match the business meaning correctly.

---

### 🟡 BUG 7 — Sidebar collapse notification badge uses `absolute` positioning without `relative` parent

**File:** `KAMDashboard.tsx` — collapsed sidebar button with badge (~line 660)
```typescript
{isCollapsed && count > 0 && (
  <span className="absolute -top-1 -right-1 bg-rose-500 ...">
    {count}
  </span>
)}
```

The `<button>` element does not have `relative` in its className, so the `absolute` badge will be positioned relative to the nearest positioned ancestor (potentially the sidebar `<aside>`), rendering the badge in the wrong location when collapsed.

**Fix required:** Add `relative` to the button's className.

---

### 🟡 BUG 8 — `taskCollegeId` useEffect dependency array is stale

**File:** `KAMDashboard.tsx` — line ~460
```typescript
useEffect(() => {
  if (activeColleges.length > 0 && !taskCollegeId) {
    setTaskCollegeId(activeColleges[0].id);
  }
}, [activeColleges]);
```

`activeColleges` is a derived value (not stable reference) — it is recomputed on every render as:
```typescript
const activeColleges = colleges.filter(c => !currentKAM || c.kam_id === currentKAM.id);
```

Since `activeColleges` is a new array every render, the `useEffect` dependency will trigger on every render, potentially causing state thrashing. 

**Fix required:** Either memoize `activeColleges` with `useMemo`, or use `colleges.length` and `currentKAM?.id` as the dependency instead.

---

### 🟡 BUG 9 — GSAP animation selector is too broad and catches unintended elements

**File:** `KAMDashboard.tsx` — line ~468
```typescript
const cards = Array.from(containerRef.current.querySelectorAll(".rounded-3xl, .rounded-2xl, .bg-white"))
  .filter(el => {
    if (el.closest(".floating-sidebar") || el.closest("header") || el.tagName === "ASIDE") return false;
    return !el.parentElement?.closest(".rounded-3xl, .rounded-2xl, .bg-white");
  });
```

**Problem:** `.bg-white` is an extremely broad selector — it will match virtually every card, row, and cell in the entire DOM. The filter tries to exclude nested ones, but this is fragile and will include/exclude incorrect elements depending on DOM nesting. Dark-mode elements (`dark:bg-slate-900`) that don't also have `bg-white` will be missed entirely. This causes inconsistent animation on tab switches.

---

### 🟡 BUG 10 — CAM Reports: no loading skeleton when `camDataMap` is empty

**File:** `KAMDashboard.tsx` — CAM Reports tab

When `loadingCams` is `true`, only a single line `"Loading CAM data…"` is shown, but the `CAMCollegeCard` components are already rendered below (using `camDataMap[college.id]` which is empty). The cards render with placeholder CM data during loading without any visual indication that the CM name/email is not yet loaded.

**Fix required:** Conditionally render the cards only after `!loadingCams`.

---

### 🟡 BUG 11 — No empty state when `currentKAM` is null in Profile tab

**File:** `KAMDashboard.tsx` — Profile tab
```typescript
{activeTab === "profile" && currentKAM && ( ... )}
```

If `currentKAM` is null, the entire profile tab renders nothing — no message, no error state, just blank. This is confusing.

---

### 🟡 BUG 12 — `approvedHandovers` not filtered to portfolio

In `CAMCollegeCard`, `approvedHandovers` is passed per-college:
```typescript
const collegeHandovers = approvedHandovers.filter(h => collegeMentorIds.has(h.originalMentorId) || collegeMentorIds.has(h.coverStaffId));
```

This is correct locally, but the swap ledger `ledgerMap` computation at the portfolio level uses:
```typescript
approvedHandovers.forEach(h => {
  [{ id: h.originalMentorId, ... }, { id: h.coverStaffId, ... }].forEach(({ id, field }) => {
    const m = mentors.find(m => m.id === id);
    if (!m || !portfolioMentorIds.has(m.id)) return; // ← this guard exists
    ...
  });
});
```

The guard `!portfolioMentorIds.has(m.id)` does scope it, but relies on `portfolioMentorIds` being computed first (see Bug 2). **Combined with Bug 2, this ledger could silently include cross-portfolio data.**

---

## 4. Missing Features (Gap Analysis vs. CAM Reporting Chain)

The KAM's primary job is to receive summarized reports **up from CAMs**. Currently the following CAM data surfaces are completely absent from the KAM dashboard:

| CAM Feature | Reported to KAM? | Gap |
|---|---|---|
| Attendance summary per campus | ❌ No | KAM cannot see attendance health |
| Fee collection status per campus | ❌ No | KAM cannot see fee compliance |
| Curriculum health (subjects mapped, unmapped) | ❌ No | KAM cannot audit curriculum completeness |
| Active timetable slot count per shift | ✅ Partial (slot count only) | No shift breakdown |
| Pending swap requests | ✅ Shown | Working |
| Approved handovers / swap ledger | ✅ Shown | Working |
| Escalated issues | ✅ Shown (with Bug 3) | Fix filter |
| Task completion rate | ❌ No | KAM assigns tasks but sees no % completion |
| Demo session activity | ❌ No | Not visible at KAM level |
| Faculty workload compliance | ✅ Partial | Balance logic inverted (Bug 6) |
| CM profile & last login | ❌ No | KAM sees CM name only, no activity data |
| Student fee defaulters count | ❌ No | Not surfaced |
| Emergency/`pending_cam` requests | ✅ Shown with "⚡ Emergency" badge | Working |

---

## 5. How KAM Dashboard Should Be Structured

Given that **CAM reports to KAM**, the KAM dashboard should present a clear **top-down aggregated view** of everything CAMs manage. Here is the recommended correct structure:

### 5.1 Tab: Overview
**Purpose:** Instant health check across all campuses.

**Should show:**
- Portfolio KPIs: total campuses, total faculty, total students, total active timetable slots
- Per-campus mini-scorecard: attendance %, pending requests count, open issues count, fee collection %
- Alert rail: only surfaces campuses with `pending_cam` (emergency) requests or unresolved high-priority issues
- Recent activity feed: last 8 requests/events across all campuses, sorted by timestamp

**Bug fixes needed:** scope `totalOpenIssues` and `totalPendingTasks` to `activeColleges`

---

### 5.2 Tab: CM Reports (was `cam_reports`)
**Purpose:** Deep drill-down into each CAM's college.

**Should show:**
- One `CAMCollegeCard` per college with the real CAM name/email loaded correctly
- Each card expands to: Faculty, Students, Handovers, Requests, Issues (current behavior is correct)
- **Add:** Attendance summary section inside each card
- **Add:** Curriculum health indicator (# subjects mapped vs departments)
- **Add:** Fee collection badge (% collected this month)
- **Add:** CM last active timestamp

**Bug fixes needed:** Fix Bug 1 (enrich CAM data), fix loading skeleton (Bug 10)

---

### 5.3 Tab: Campus Directory (was `colleges`)
**Purpose:** Static reference — address, stats, assigned CAM contact.

**Should show:**
- College name, address, assigned CAM name + email + phone
- Quick stats: faculty count, student count, slot count
- Link to drill into the CM Reports card for that campus

**Current state is cosmetic only — CAM contact info is missing entirely.**

---

### 5.4 Tab: Assign Task (was `tasks`)
**Purpose:** KAM dispatches action items to specific CAMs.

**Should show:**
- Task creation form (current form is fine)
- Task log with: campus name, task title, priority, due date, **completion %**
- **Add:** Overdue indicator (tasks past `dueDate` still pending)
- **Add:** Ability to mark tasks complete from KAM side (currently only delete exists)

**Bug fixes needed:** scope `totalPendingTasks` correctly (Bug 4), add overdue logic

---

### 5.5 Tab: Escalated Issues (was `escalations`)
**Purpose:** CAMs escalate blockers to KAM for resolution.

**Should show:**
- Issues filtered to this KAM's portfolio (fix Bug 3)
- Priority sorting (high → medium → low)
- Issue type badge (facilities, academic, admin)
- Resolve button (current behavior is fine)
- **Add:** Escalation timestamp + SLA indicator (days open)

**Bug fixes needed:** Apply `activeColleges` filter (Bug 3)

---

### 5.6 Tab: Swap Ledger (was `swap_tracker`)
**Purpose:** Cross-campus view of faculty hour debt.

**Should show:**
- Summary cards: total swaps, pending, settled, declined (current is fine)
- Per-campus breakdown (current is fine)
- All swap requests table (current is fine)
- Faculty balance table with **corrected color logic** (fix Bug 6):
  - 🟡 Amber = faculty is owed classes (gave more than received, balance positive) → creditor
  - 🔴 Rose = faculty owes classes (received more than gave, balance negative) → debtor

**Bug fixes needed:** Invert balance highlight logic (Bug 6)

---

### 5.7 Tab: Profile
**Purpose:** KAM's own identity and jurisdiction summary.

**Current state:** Working correctly.  
**Add:** Empty state when `currentKAM` is null (Bug 11).

---

## 6. Recommended New Tab: Analytics / Reporting

This tab is entirely absent but is the most natural thing a KAM needs.

**Should include:**
- Attendance trend chart per campus (week over week)
- Handover request volume trend (spikes indicate schedule stress)
- Fee collection rate per campus
- Task completion rate per campus (tasks dispatched by KAM vs. completed by CAM)
- Faculty workload distribution heatmap across campuses

---

## 7. Summary of All Issues

| # | Severity | Type | Description | Status |
|---|---|---|---|---|
| 1 | 🔴 Critical | Logic Bug | CAM data fetch returns bare profile only — no real CM data in drill-down | ✅ Fixed — now calls `/api/cam?id=` per college + `/api/fees?role=cam` in parallel |
| 2 | 🔴 Critical | Runtime Bug | `portfolioMentorIds` used before declaration — notification counts unreliable | ✅ Fixed — moved above `getNotificationCount` |
| 3 | 🔴 Critical | Data Filter Bug | Escalations tab shows all-system issues, not just this KAM's portfolio | ✅ Fixed — filtered to `activeColleges` |
| 4 | 🟡 Medium | Data Filter Bug | `totalPendingTasks` KPI counts tasks from all KAMs, not scoped | ✅ Fixed — `activeColleges` filter applied |
| 5 | 🟡 Medium | Data Filter Bug | `totalOpenIssues` KPI not scoped to portfolio | ✅ Fixed — `activeColleges` filter applied |
| 6 | 🟡 Medium | Logic Bug | Swap balance highlight: positive balance marked red (inverted semantics) | ✅ Fixed — amber = owed (creditor), rose = owes (debtor) |
| 7 | 🟡 Medium | UI Bug | Collapsed sidebar notification badge `absolute` without `relative` parent | ✅ Fixed — redesigned to hover flyout, badge inside popover |
| 8 | 🟡 Medium | Performance | `activeColleges` filter in useEffect dependency causes render thrashing | ✅ Fixed — `useMemo` applied |
| 9 | 🟡 Medium | UI Bug | GSAP selector `.bg-white` too broad — inconsistent tab animations | ✅ Fixed — `data-kam-card` / `data-kam-panel` attribute selectors |
| 10 | 🟡 Medium | UX Bug | CAM cards render during load with placeholder data, no skeleton | ✅ Fixed — skeleton shown while `loadingCams`, cards only after |
| 11 | 🟢 Low | UX Bug | Profile tab renders blank when `currentKAM` is null | ✅ Fixed — proper empty state with message |
| 12 | 🟢 Low | Logic Risk | Swap ledger correctness depends on Bug 2 being fixed first | ✅ Unblocked + Bug 6 fixed |

## 8. Monitoring Features Added (CAM → KAM Reporting)

| Feature | Source | How surfaced |
|---|---|---|
| **Attendance rate %** per campus | `studentAttendance[]` from context | CAMCollegeCard "Attendance" section + health badge in header grid |
| **Fee collection rate %** per campus | `GET /api/fees?role=cam&camId=` (new fetch) | CAMCollegeCard "Fees" section + health badge + Campus Directory card |
| **Curriculum health** (depts vs mapped depts, subject count) | `subjectsList[]` + `departmentsList[]` from context | CAMCollegeCard "Curriculum" section |
| **Faculty leave requests pending** | `leaveRequests[]` from context | Alert banner inside Attendance section |
| **Task overdue indicator** | `tasks[].dueDate` vs today | Tasks tab: overdue badge, rose background, sorted to top |
| **Task completion stats** | `tasks[].status` | Tasks tab: 4-KPI summary strip (total / pending / completed / overdue) |
| **CAM contact info in Campus Directory** | `camDataMap[collegeId]` from new `/api/cam` fetch | Each college card shows CM name + email strip |
| **Per-campus health badges** | Aggregated per college | Campus Directory: fee%, tasks done/total, issues count |
| **Profile metrics fully scoped** | All stats use `activeColleges` filter | Profile page: 8-metric grid (scoped correctly) |

## 8. Sidebar Redesign — What Changed

### Old Sidebar (problems)
- Flat always-visible list — items permanently rendered and clickable directly
- Group headers were static labels — no interactivity
- Collapsed mode had notification badge using `absolute` without a `relative` parent (Bug 7) — badge rendered in wrong position
- Width was `w-72` (288px) — wider than CAM, wasting horizontal space
- Mobile bottom nav was missing `colleges` and `swap_tracker` — 2 of 7 tabs inaccessible on mobile

### New Sidebar (fixed)
- **Hover flyout popover pattern** — matches the CAM dashboard exactly
- **Width reduced** to `w-64` expanded / `w-20` collapsed — matches CAM
- **Collapsed mode** — badge lives inside the flyout popover (no `absolute` positioning issue)
- **Sidebar header** — role label + campus count subtitle
- **Mobile bottom nav** — all 7 tabs with `overflow-x-auto` scroll

---

## 8. Priority Order for Fixes

**Immediate (Bugs that corrupt data or cause runtime errors):**
1. Fix Bug 2 — move `portfolioMentorIds` above `getNotificationCount`
2. Fix Bug 3 — filter escalations to portfolio
3. Fix Bug 5 — filter `totalOpenIssues` to portfolio
4. Fix Bug 4 — filter `totalPendingTasks` to portfolio
5. Fix Bug 1 — enrich CAM data so CM Reports shows real CAM profiles

**Short term (UX and logic correctness):**
6. Fix Bug 6 — swap balance coloring
7. Fix Bug 7 — sidebar badge positioning
8. Fix Bug 8 — memoize `activeColleges`
9. Fix Bug 10 — loading skeleton for CM Reports

**Medium term (Feature gaps):**
10. Add attendance + fee summary into `CAMCollegeCard`
11. Add task completion tracking
12. Add Analytics tab
13. Enrich Campus Directory with CAM contact info

---

*Analysis written: July 2026*  
*Based on: `src/components/KAMDashboard.tsx`, `/api/kam/route.ts`, `/api/cam/route.ts`, `AppContext.tsx`, `CAM_Dashboard_Analysis.md`*
