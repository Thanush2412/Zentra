/**
 * Module types for the admin approvals queue.
 *
 * The queue filters on `approvals.module_type`, a free-text column, and the
 * resolution route only drives side effects for a handful of codes
 * (`student_leave`, `faculty_leave`, `interview`). A hardcoded picker list is
 * therefore always wrong in one direction or the other: types that no row can
 * ever carry turn the filter into a dead control that shows the empty state.
 * So the picker is derived from the rows actually loaded and every value is
 * labelled through the map below, including legacy spellings still in old rows.
 */

/** DB `module_type` value -> label shown in the queue. */
export const MODULE_TYPE_LABELS: Record<string, string> = {
  student_leave: "Student Leave",
  faculty_leave: "Faculty Leave",
  interview: "Interview",
  class_swap: "Class Swap",
  swap_compensate: "Class Swap",
  leave_cover: "Leave Cover",
  handover: "Proxy Handover",
  attendance: "Attendance Waiver",
  late_attendance: "Late Attendance",
  late_punch: "Late Punch",
  exam_marks_edit: "Exam Marks Edit",
  timetable: "Timetable Change"
};

/** Normalise the raw column value: trims, lowercases, treats blanks as absent. */
export function normalizeModuleType(value: unknown): string {
  const raw = String(value ?? "").trim();
  if (!raw || raw.toLowerCase() === "null") return "";
  return raw.toLowerCase().replace(/[\s-]+/g, "_");
}

/** Human label for a raw module_type; unknown codes are title-cased, never dropped. */
export function labelForModuleType(value: unknown): string {
  const key = normalizeModuleType(value);
  if (!key) return "Request";
  if (MODULE_TYPE_LABELS[key]) return MODULE_TYPE_LABELS[key];
  return key.split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

export interface ModuleTypeOption {
  value: string;
  label: string;
  count: number;
}

/**
 * Filter choices for the loaded queue: one entry per module_type that actually
 * has a row, busiest first. Keeps a type filterable as soon as a row carrying
 * it exists, and drops it when the last such row leaves the queue.
 */
export function moduleTypeOptions(rows: readonly unknown[]): ModuleTypeOption[] {
  const counts = new Map<string, { label: string; count: number }>();
  for (const row of rows || []) {
    const value = normalizeModuleType((row as any)?.module_type);
    if (!value) continue;
    const existing = counts.get(value);
    if (existing) existing.count += 1;
    else counts.set(value, { label: labelForModuleType(value), count: 1 });
  }
  return [...counts.entries()]
    .map(([value, { label, count }]) => ({ value, label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

/**
 * Keep the current selection only while a matching row is still in the queue.
 * Approving the last row of a type would otherwise leave a filter selected
 * that yields nothing, which reads as lost data rather than an emptied filter.
 */
export function resolveModuleFilter(
  current: string,
  options: readonly Pick<ModuleTypeOption, "value">[]
): string {
  if (!current || current === "all") return "all";
  return options.some((o) => o.value === current) ? current : "all";
}

/** Row matches the active filter ("all" and an unset filter match everything). */
export function matchesModuleFilter(row: unknown, filter: string): boolean {
  if (!filter || filter === "all") return true;
  return normalizeModuleType((row as any)?.module_type) === filter;
}
