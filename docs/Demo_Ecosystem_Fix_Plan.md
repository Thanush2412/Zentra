# Demo Ecosystem Fix Plan — Mentor ↔ Allocator ↔ SME

> Audit of `MentorDashboard.tsx`, `DemoAllocationDashboard.tsx`, `SMEDashboard.tsx` and their APIs
> (`/api/demo-sessions`, `/api/requests/demo-swap`, `/api/demo-reallocations`, `/api/data`).
> Goal: make the demo lifecycle work end-to-end without state mismatches or dead-ends.

## 1. Current Lifecycle (as implemented)

```
Allocator (DemoAllocationDashboard)          SME (SMEDashboard)                 Mentor (MentorDashboard)
─────────────────────────────────           ──────────────────────             ─────────────────────────
Book demo (status 'scheduled')  ──────────▶ My Demos (smeId/subject match) ──▶ Upcoming Reviews / My Demo tab
                                             │ Evaluate → status 'completed'    │ Reschedule (own demo)
                                             │ Reallocate (swap request)        │ Peer Swap (pending_peer)
Reallocation queue (pending/                 ▼                                  ▼
pending_sme swap requests)      ◀────────── demo_swap_requests ◀───────────── proposals
Approve → session 'confirmed' + slot moved
Leave-driven flow: mentor leave → impacted demos → /api/demo-reallocations → Allocator approves
```

Statuses in `demo_sessions`: `scheduled` (booked) → `confirmed` → `completed` (evaluated, marks ≥ 0) |
`reallocation_required` (leave-affected) | `not_conducted`.
Statuses in `demo_swap_requests`: `pending` (SME/allocator reallocation) → `approved`/`rejected`;
peer swaps: `pending_peer` → `pending_sme` → `approved`/`rejected`.

## 2. Confirmed Bugs (fix first)

| # | Where | Bug | Impact |
|---|-------|-----|--------|
| B1 | `SMEDashboard.tsx` (~L325) | `todayStr` uses `toLocaleDateString("en-GB")` → `"23 Sep 2026"`, but `demo_sessions.dateStr` is `YYYY-MM-DD` (allocator books with `toISOString().slice(0,10)`; `getWeekDates` returns `YYYY-MM-DD`). | **"Today's Demos" is always 0** and the Today's Schedule panel is always empty. |
| B2 | `AppContext.tsx` `evaluateDemoSession` (~L1587) | Optimistic local update sets `status: "evaluated"`, but DB sets `'completed'`. | After evaluating, SME sees a gray unknown badge, demo re-enters "pending" counts, re-evaluate guard misfires — until a full refresh. Same for Mentor's "Evaluations Done" KPI. |
| B3 | `SMEDashboard.tsx` (~L349) | `pendingInboundRequests` matches `r.smeId === currentSME.id` **or** `proposedSmeId === ...`. SME's own outbound reallocation sets `proposedSmeId = own id`. | SME sees **their own request as an inbound proposal** and can self-approve it, bypassing the Allocator. |
| B4 | `MentorDashboard.tsx` (~L5682) | Home "upcoming demos" filter uses `status === "scheduled"` only; API also uses `confirmed`. | Confirmed demos disappear from Mentor home after approval. |
| B5 | `SMEDashboard.tsx` availability matrix (~L1180) | `slots.find(s => s.smeId === currentSME.id)` — timetable `slots` have no `smeId` column. | "Class / Duty" cells never render; SME day looks fully free. |
| B6 | `SMEDashboard.tsx` demo list | `not_conducted` filter + badge exist, but no UI/API action lets an SME mark a no-show. | Dead state: a missed demo can never be closed out. |
| B7 | `DemoAllocationDashboard.tsx` (~L110) | Per-mentor demo targets stored only in `localStorage` (`fp_mentor_demo_targets`). | Targets silently lost across devices/users; allocator planning diverges per machine. |

## 3. Plan

### Phase 1 — Correctness (make existing flows true)
1. **B1**: Add a `toDateStr(d: Date)` helper in `lib/utils.ts` (or reuse existing), use it in SME `todayStr`; sweep both SME and Mentor dashboards for other locale-formatted comparisons against `dateStr`.
2. **B2**: Change `evaluateDemoSession` optimistic status to `"completed"` (and carry `marks`/`comments`) so local state matches the DB.
3. **B3**: Inbound SME queue filter becomes `proposedSmeId === currentSME.id && r.smeId !== currentSME.id`; show outbound requests in a separate read-only "Sent Proposals" list with status.
4. **B4**: Mentor home upcoming filter → `["scheduled", "confirmed"].includes(status)`.
5. **B5**: Drop the `slots.smeId` lookup (or map SME teaching slots from `slots` by course/subject only if such data exists); matrix shows Off-Duty correctly instead of a never-matching branch.
6. Verify: book → evaluate → badge/KPI correct with **no page refresh**.

### Phase 2 — Close lifecycle dead-ends
7. **B6**: Add `action: "not_conducted"` to `/api/demo-sessions` (SME-only; audit log; no skill-clearance side effects) + button on SME demo card for past/confirmed demos.
8. Allocator auto-fill suggestion: when a demo goes `reallocation_required`, the Allocator queue offers the top free (mentor-free × SME-available) periods — reuse `checkMentorAvailability`/`checkSmeAvailability` from `lib/availability.ts` via `/api/demo-reallocations?demoSessionId=`.
9. **B7**: Persist mentor demo targets to DB (extend `demo_rules` or a settings row) instead of localStorage.
10. Notifications: on swap request create/resolve, insert a row into `notifications` for the affected mentor/SME (table already exists and is fetched).

### Phase 3 — Consistency & polish
11. Centralize demo status → badge/label/color mapping in one shared module (`lib/demoStatus.tsx`) used by all three dashboards (currently 3 divergent copies).
12. Unify "who approves what" rules: SME approves `pending_sme` (peer swaps) and their own proposed time changes go to Allocator as `pending`; enforce server-side (reject resolve calls from the requester themselves).
13. History tab: show marks distribution + CSV export for completed demos (SME) — parity with Mentor scorecards.

## 4. Verification checklist
- [ ] SME books nothing; Allocator books demo → appears in Mentor "My Demo" and SME "My Demos" instantly (no refresh).
- [ ] SME evaluates → status badge "Completed", Mentor KPI +1, skill tracker auto-clearance for Skill subjects.
- [ ] SME reallocates → request appears in Allocator queue (not SME's own inbound list) → approve → slot moves, mentor sees new slot.
- [ ] Mentor peer swap → peer accepts → SME approves → session reassigned.
- [ ] Mentor leave with overlapping demos → reallocation panel → Allocator approves → original slot freed.
- [ ] "Today's Demos" shows sessions booked for today's date.
