// Lookup indexes for the L&D Master Grid.
//
// The grid renders one cell per (evaluator × day × period) and each cell used to re-scan
// the whole mentor/slot/session/leave set. These builders turn those scans into Map lookups
// while preserving the exact matching rules of the predicates they replace.

export type GridRow = Record<string, any>;

const smeKeyOf = (session: GridRow) => `${session.smeId ?? session.sme_id}|${session.dateStr ?? session.date_str}`;
const mentorKeyOf = (session: GridRow) => `${session.mentorId ?? session.mentor_id}|${session.dateStr ?? session.date_str}`;
const weekOf = (session: GridRow) => session.week ?? session.week_number;
const dateOf = (session: GridRow) => session.dateStr ?? session.date_str;
const mentorOf = (session: GridRow) => session.mentorId ?? session.mentor_id;

/** Sessions that still occupy a mentor's time. Cancelled / not-conducted sessions are ignored. */
export function isActiveSession(session: GridRow): boolean {
  return session.status !== "cancelled" && session.status !== "not_conducted";
}

/** sessions grouped by `${mentorId}|${dateStr}` — replaces a full demoSessions scan per mentor. */
export function buildSessionsBySmeDate(sessions: GridRow[]): Map<string, GridRow[]> {
  const map = new Map<string, GridRow[]>();
  sessions.forEach(s => {
    const key = smeKeyOf(s);
    const bucket = map.get(key);
    if (bucket) bucket.push(s);
    else map.set(key, [s]);
  });
  return map;
}

export function buildSessionsByMentorDate(sessions: GridRow[]): Map<string, GridRow[]> {
  const map = new Map<string, GridRow[]>();
  sessions.forEach(s => {
    const key = mentorKeyOf(s);
    const bucket = map.get(key);
    if (bucket) bucket.push(s);
    else map.set(key, [s]);
  });
  return map;
}

/**
 * How many sessions each mentor already has this week. A session counts when its week number
 * matches, or when it falls on one of the dates of the visible week.
 */
export function buildWeeklySessionCounts(
  sessions: GridRow[],
  selectedWeek: number,
  weekDateStrs: string[]
): Map<string, number> {
  const dates = new Set(weekDateStrs);
  const counts = new Map<string, number>();
  sessions.forEach(s => {
    if (!isActiveSession(s)) return;
    const d = dateOf(s);
    if (!(weekOf(s) === selectedWeek || (d && dates.has(d)))) return;
    const mentorId = mentorOf(s);
    if (!mentorId) return;
    counts.set(mentorId, (counts.get(mentorId) || 0) + 1);
  });
  return counts;
}

/** Timetable slots grouped by mentor — replaces `slots.some(...)` per candidate mentor. */
export function buildSlotsByMentor(slots: GridRow[]): Map<string, GridRow[]> {
  const map = new Map<string, GridRow[]>();
  slots.forEach(s => {
    if (!s.mentorId) return;
    const bucket = map.get(s.mentorId);
    if (bucket) bucket.push(s);
    else map.set(s.mentorId, [s]);
  });
  return map;
}

/**
 * Approved leave ids per date, limited to the dates given (leave rows are ranges).
 * Dates that are absent from the map were not indexed, so callers must fall back to a scan.
 */
export function buildLeaveIdsByDate(
  leaves: GridRow[],
  dateStrs: string[]
): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  dateStrs.forEach(dateStr => {
    const set = new Set<string>();
    (leaves || []).forEach((fl: GridRow) => {
      if (fl.status !== "approved") return;
      const mentorId = fl.mentor_id || fl.mentorId;
      if (!mentorId) return;
      if (dateStr >= fl.start_date && dateStr <= fl.end_date) set.add(mentorId);
    });
    map.set(dateStr, set);
  });
  return map;
}

/** Rule targets keyed by lower-cased, trimmed subject group. */
export function buildRuleTargetsBySubject(rules: GridRow[]): Map<string, number> {
  const map = new Map<string, number>();
  (rules || []).forEach(r => {
    const subject = typeof r.subject === "string" ? r.subject.toLowerCase().trim() : "";
    if (subject) map.set(subject, r.target);
  });
  return map;
}
