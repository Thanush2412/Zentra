export interface LndGroupOption {
  value: string;
  label: string;
  subtext?: string;
}

/** Canonical mentor group, matching the dashboard's mentor_group > subject_group > department fallback. */
export function mentorGroupOf(mentor: any): string {
  if (!mentor) return "General";
  return String(mentor.mentor_group || mentor.subject_group || mentor.department || "General").trim();
}

/** Groups present on the selected campus, counted. "all" keeps every campus. */
export function buildGroupCounts(
  mentors: readonly any[],
  collegeId: string,
  groupOf: (mentor: any) => string = mentorGroupOf
): Map<string, number> {
  const counts = new Map<string, number>();
  const scoped = !collegeId || collegeId === "all";
  for (const m of mentors) {
    if (!m) continue;
    if (!scoped && String(m.college_id ?? "") !== String(collegeId)) continue;
    const group = (groupOf(m) || "").trim();
    if (!group) continue;
    counts.set(group, (counts.get(group) || 0) + 1);
  }
  return counts;
}

export function groupCountLabel(count: number): string {
  return `${count} mentor${count === 1 ? "" : "s"}`;
}

/**
 * Alphabetical, count-labelled group options. A carried value stays representable even
 * when the current campus has none of its mentors, so a filter can never silently drop it.
 */
export function toGroupFilterOptions(
  counts: Map<string, number>,
  opts: { carriedValue?: string; carriedSubtext?: string } = {}
): LndGroupOption[] {
  const scoped = Array.from(counts.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([group, count]) => ({ value: group, label: group, subtext: groupCountLabel(count) }));
  const carried = opts.carriedValue && !counts.has(opts.carriedValue)
    ? [{ value: opts.carriedValue, label: opts.carriedValue, subtext: opts.carriedSubtext }]
    : [];
  return [...carried, ...scoped];
}

/** Group match is case- and whitespace-insensitive, same as the dashboard predicates. */
export function filterMentorsByGroup(
  mentors: readonly any[],
  group: string,
  groupOf: (mentor: any) => string = mentorGroupOf
): any[] {
  if (!group || group === "All") return mentors.slice();
  const target = group.toLowerCase().trim();
  return mentors.filter(m => m && (groupOf(m) || "").toLowerCase().trim() === target);
}

export function filterMentorsByCampus(mentors: readonly any[], collegeId: string): any[] {
  if (!collegeId || collegeId === "all") return mentors.slice();
  return mentors.filter(m => m && String(m.college_id ?? "") === String(collegeId));
}
