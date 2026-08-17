# Dashboard Performance Audit

**Date:** August 13, 2026  
**Scope:** All dashboard components and API routes  
**Files Audited:** 20 (components, API routes, context, db layer)

---

## Summary

The app feels slow because of a combination of a single oversized API endpoint that runs 31 database queries on every page load, an N+1 query loop in the interviews API, missing database indexes on hot query paths, and no meaningful caching or granular state invalidation anywhere. Every mutation triggers a full data re-fetch. These issues compound each other.

---

## 🔴 Critical Issues

### 1. God Endpoint — `src/app/api/data/route.ts`

**The #1 root cause of slowness.**

Every page load and every mutation fires this single endpoint, which runs 31 `db.all()` queries in one `Promise.all()`.

**Problems:**

- Pulls **5,000 student attendance rows** unconditionally, regardless of role
- Admin and KAM roles receive **all rows from every table** — no scoping
- `slots`, `mentors`, `students` are only scoped by `college_id` for cam/mentor/student
- Arbitrary LIMIT caps (300 handovers, 200 demo sessions, 300 interview evals) are hard cutoffs, not pagination
- Cache header is `Cache-Control: private, max-age=3` — effectively no caching; every navigation re-runs all 31 queries
- `kamTasks`, `campusIssues`, `approvals`, `leaveBalances`, `signupRequests` have no role-based scoping at all

**Fix:** Split into role-scoped endpoints. Each role should only fetch what it needs. Increase cache TTL to at least 30–60 seconds with `stale-while-revalidate`.

---

### 2. N+1 Query Loop — `src/app/api/interviews/route.ts`

For every interview returned, 4 additional queries are fired inside a `.map()`:

```ts
interviews.map(async (inv) => {
  await db.all("SELECT * FROM interview_allocations WHERE interview_id = ?", [inv.id]);
  await db.all("SELECT * FROM cam_capacity_responses WHERE interview_id = ?", [inv.id]);
  await db.all("SELECT * FROM student_interview_slots WHERE interview_id = ?", [inv.id]);
  await db.all("SELECT ... FROM interview_evaluations WHERE interview_id = ?", [inv.id]);
})
```

**50 interviews = 200 database round-trips per single request.**

**Fix:** Collect all interview IDs first, bulk-fetch with `WHERE interview_id IN (...)` for each related table, then group results in JavaScript using a `Map`.

---

### 3. Full Re-fetch After Every Mutation — `src/context/AppContext.tsx`

`refreshData()` calls `GET /api/data` (all 31 queries) after every single mutation — approving a leave, adding a slot, punching attendance, anything.

Additional problems:
- No SWR, no React Query, no granular cache invalidation
- All roles share the same global context — a student login fetches and holds KAM tasks, admin audit logs, all handover requests, all demo sessions, etc.
- No memoization of any derived state

**Fix:** Introduce SWR or React Query for data fetching. Use granular mutation-triggered invalidation (e.g. only refresh `slots` after a slot change, not everything).

---

## 🟠 High Issues

### 4. Room Collision Loads All Slots Into Memory — `src/app/api/slots/route.ts`

```ts
const allSlots = await db.all("SELECT * FROM slots WHERE day = ? AND time = ? AND shift = ?");
const roomCollision = allSlots.find(s => s.location.toLowerCase() === cleanLocation.toLowerCase());
```

The room filter is done in JavaScript after fetching all matching slots into memory. There is also no index on `slots(location)`.

**Fix:**
```sql
SELECT s.*, m.name as mentorName
FROM slots s
JOIN mentors m ON s.mentorId = m.id
WHERE LOWER(s.location) = LOWER(?)
  AND s.day = ? AND s.time = ? AND s.shift = ?
LIMIT 1
```
Add index: `CREATE INDEX IF NOT EXISTS idx_slots_location ON slots(location);`

---

### 5. Missing Database Indexes — `src/lib/db.ts`

Hot query paths that perform full table scans due to missing indexes:

| Table | Missing Index | Used By |
|---|---|---|
| `mentor_attendance` | `(college_id, date_str)` | Every CAM/KAM attendance load |
| `slots` | `(location)` | Room collision check on every slot write |
| `faculty_leave_requests` | `(college_id)`, `(mentor_id)` | CAM leave approval panel |
| `student_interviews` | `(college_id, status)` | Complex OR filter in interviews API |
| `handover_requests` | `(status)` | Approval/rejection status scans |
| `approved_handovers` | `(slotId, dateStr)` | Heavy use in timetable rendering |

**Fix — add these to `lib/db.ts` schema initialization:**

```sql
CREATE INDEX IF NOT EXISTS idx_mentor_attendance_college_date ON mentor_attendance(college_id, date_str);
CREATE INDEX IF NOT EXISTS idx_slots_location ON slots(location);
CREATE INDEX IF NOT EXISTS idx_faculty_leave_college ON faculty_leave_requests(college_id);
CREATE INDEX IF NOT EXISTS idx_faculty_leave_mentor ON faculty_leave_requests(mentor_id);
CREATE INDEX IF NOT EXISTS idx_student_interviews_college_status ON student_interviews(college_id, status);
CREATE INDEX IF NOT EXISTS idx_handover_requests_status ON handover_requests(status);
CREATE INDEX IF NOT EXISTS idx_approved_handovers_slot_date ON approved_handovers(slotId, dateStr);
```

---

### 6. Fee Manager Loads Entire Dataset — `src/app/api/fees/route.ts`

No pagination. The fee manager role fetches the complete student roster, all fee records, and all payments on every load:

```ts
const students = await db.all("SELECT ... FROM students ORDER BY name");
const fees     = await db.all("SELECT * FROM student_fees ...");
const payments = await db.all("SELECT * FROM fee_payments ...");
```

For 2,000 students this sends thousands of rows to the client on every Fee Manager dashboard load.

**Fix:** Add `LIMIT` / `OFFSET` pagination or at minimum filter by academic year server-side before sending.

---

### 7. Date Input Fires Fetch on Every Keystroke — `src/components/KAMDashboard.tsx`

`KAMMentorAttendanceTab` binds `onChange` directly to a date `<input>` with no debounce:

```tsx
<input
  type="date"
  value={dateStr}
  onChange={(e) => setDateStr(e.target.value)}
/>
```

`useEffect` depends on `dateStr`, so every character typed while entering a date fires a full network request.

**Fix:**
```tsx
import { useDebounce } from "@/lib/hooks";
const debouncedDateStr = useDebounce(dateStr, 400);
useEffect(() => { fetchAttendance(); }, [kamId, debouncedDateStr]);
```

Additionally, `CAMCollegeCard` computes attendance rate by scanning the full attendance array (up to 5,000 rows) on every render for every card instance with no `useMemo` — 10 colleges × 5,000 rows = 50,000 filter iterations per render cycle.

---

## 🟡 Medium Issues

### 8. Duplicate Fetch — `src/components/MentorDashboard.tsx`

`MentorPunchWidget` and `MentorFacultyLeavePanel` are both mounted on the same page. Each independently calls `GET /api/mentor-attendance?mentorId=...` in its own `useEffect` on mount — two identical network requests for the same data.

**Fix:** Lift the fetch one level up to the parent `MentorDashboard` component and pass data down as props, or share via a small local context.

---

### 9. Double Fetch After Every Approval — `src/components/CAMDashboard.tsx`

After every faculty leave approve or reject:

```ts
await fetchFacultyLeaveRequests();
await fetchAttendance(); // full college roster re-fetch
```

Both fetches are sequential and both hit the network, even though only the leave request changed.

Additionally, the `departments` array is derived inline on every render:

```ts
const departments = Array.from(new Set(records.map(r => r.department).filter(Boolean)));
```

**Fix:** Wrap in `useMemo`. After approval, only re-fetch the leave requests — not the full attendance roster.

---

### 10. Double `/api/data` on Mount + Page Reload for Scope Switch — `src/components/AdminDashboard.tsx`

On mount, `fetchAdminDetails` fires two sequential fetches:

```ts
const res     = await fetch("/api/colleges");  // fetch 1
const dataRes = await fetch("/api/data");       // fetch 2 — already in context
```

The second `/api/data` duplicates what `AppContext` already loaded.

Campus scope switching uses:
```ts
window.location.reload();
```

This destroys the entire React tree, clears all state, and forces a full re-initialization of the god endpoint from scratch.

**Fix:** Remove the redundant `/api/data` fetch (use context data directly). Replace `window.location.reload()` with a state setter.

---

### 11. O(mentors × slots) Computation in Render — `src/components/SMEDashboard.tsx`

`getSwapRecommendations()` iterates every mentor × every slot × every demo session × every leave request on every call. It is not memoized and runs inline during render.

`getMentorCollege()` and `getMentorDept()` do O(n) `.find()` calls inside `.map()` loops — each row in the render list triggers a full array scan.

**Fix:**
```ts
// Build lookup maps once
const mentorCollegeMap = useMemo(() =>
  new Map(mentors.map(m => [m.id, m.college_id])), [mentors]);

const swapRecommendations = useMemo(() =>
  getSwapRecommendations(mentors, slots, demoSessions, leaveRequests),
  [mentors, slots, demoSessions, leaveRequests]);
```

---

### 12. Date Filter Triggers Full Server Re-fetch — `src/components/FeeManagerDashboard.tsx`

```ts
useEffect(() => {
  fetchData(); // entire /api/fees?role=fee_manager
}, [filterFromDate, filterToDate]);
```

Changing either date filter re-fetches the entire dataset from the server. The `filteredStudents` computation also does an O(n²) student-fee scan with no prebuilt map.

**Fix:** Fetch once on mount. Filter entirely on the client using a prebuilt `Map<student_id, fee[]>`.

---

### 13. Interview Re-fetched on Every Tab Switch — `src/components/StudentDashboard.tsx`

```ts
useEffect(() => {
  fetchInterviews();
}, [activeTab]); // re-fetches on every tab change
```

`/api/interviews` is re-fetched every time `activeTab` changes, even for completely unrelated tabs.

Additionally there are 3 independent `useEffect` fetches on mount beyond what the global context already loads:
1. `/api/daily-configs` — on `currentStudent` change
2. `/api/interviews` — on every tab change
3. `/api/fees` — manually on fees tab

Tasks in localStorage are serialized and written on every single state change with no debounce.

**Fix:** Fetch interviews once on mount or when the interviews tab is first activated (use a `hasFetched` ref). Debounce localStorage writes.

---

### 14. Bulk Attendance: Sequential INSERTs, No Transaction — `src/app/api/mentor-attendance/route.ts`

The `bulk_present` action loops through all mentors and `await`s each INSERT one by one:

```ts
for (const m of mentors) {
  await db.run(`INSERT INTO mentor_attendance ...`); // serial, no transaction
}
```

100 mentors = 100 serial database round-trips. On a remote Turso database this means 100 × network latency.

**Fix:** Wrap in a transaction and batch the inserts:

```ts
await db.run("BEGIN");
for (const m of mentors) {
  await db.run(`INSERT INTO mentor_attendance ...`);
}
await db.run("COMMIT");
```

Or build a single bulk INSERT with parameterized values.

---

## Fix Priority Roadmap

| Priority | File | Fix | Impact |
|---|---|---|---|
| 1 | `api/data/route.ts` | Split into role-scoped endpoints; increase cache TTL | 🔴 Largest win |
| 2 | `api/interviews/route.ts` | Replace N+1 with bulk `IN (...)` fetch + JS grouping | 🔴 Large win |
| 3 | `lib/db.ts` | Add 7 missing indexes | 🟠 High win, 5 min fix |
| 4 | `context/AppContext.tsx` | Granular invalidation; only refresh affected data after mutation | 🟠 High win |
| 5 | `api/mentor-attendance/route.ts` | Wrap bulk_present in a transaction | 🟡 Quick fix |
| 6 | `KAMDashboard.tsx` | Debounce date input; memoize attendance scan | 🟠 Noticeable UX fix |
| 7 | `MentorDashboard.tsx` | Deduplicate attendance fetch | 🟡 Easy fix |
| 8 | `CAMDashboard.tsx` | `useMemo` for departments; single fetch after approval | 🟡 Medium win |
| 9 | `AdminDashboard.tsx` | Remove redundant `/api/data`; replace `window.location.reload()` | 🟡 Easy fix |
| 10 | `SMEDashboard.tsx` | Prebuilt lookup Maps; memoize swap recommendations | 🟡 Medium win |
| 11 | `FeeManagerDashboard.tsx` | Client-side filtering; remove date-triggered re-fetch | 🟡 Medium win |
| 12 | `StudentDashboard.tsx` | Fetch interviews once; debounce localStorage writes | 🟡 Easy fix |
| 13 | `api/slots/route.ts` | Move room collision check to SQL | 🟠 Correctness + speed |
| 14 | `api/fees/route.ts` | Add server-side pagination | 🟠 Required at scale |

---

## Files Audited

| File | Role |
|---|---|
| `src/lib/db.ts` | Database adapter and schema |
| `src/context/AppContext.tsx` | Global state and data fetching |
| `src/components/DashboardLayout.tsx` | Shared layout wrapper |
| `src/components/MentorDashboard.tsx` | Mentor dashboard |
| `src/components/KAMDashboard.tsx` | KAM dashboard |
| `src/components/CAMDashboard.tsx` | CAM dashboard |
| `src/components/AdminDashboard.tsx` | Admin dashboard |
| `src/components/SMEDashboard.tsx` | SME dashboard |
| `src/components/FeeManagerDashboard.tsx` | Fee manager dashboard |
| `src/components/StudentDashboard.tsx` | Student dashboard |
| `src/app/api/data/route.ts` | Mega data endpoint |
| `src/app/api/mentor-attendance/route.ts` | Attendance API |
| `src/app/api/cam/route.ts` | CAM profile API |
| `src/app/api/kam/route.ts` | KAM profile API |
| `src/app/api/fees/route.ts` | Fees API |
| `src/app/api/students/route.ts` | Students CRUD API |
| `src/app/api/interviews/route.ts` | Interviews API |
| `src/app/api/attendance/route.ts` | Attendance marking API |
| `src/app/api/slots/route.ts` | Slot CRUD API |
| `package.json` | Dependencies |
