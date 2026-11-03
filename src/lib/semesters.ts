/**
 * Semester option lists (MD-M20).
 *
 * These dropdowns used to be re-typed as literal arrays in ten places across
 * MentorDashboard, CAMDashboard and AdminDashboard, with some sites listing six
 * semesters and others eight. A change to the academic structure therefore had
 * to be made in every copy, and a three-year programme could offer semesters it
 * does not have.
 */

export const MAX_PROGRAM_YEARS = 4;

export function getSemestersForCourse(years?: number | string | null): string[] {
  const parsed = typeof years === "string" ? parseInt(years, 10) : years;
  const safeYears = Number.isFinite(parsed as number)
    ? Math.min(Math.max(Math.trunc(parsed as number), 1), MAX_PROGRAM_YEARS)
    : 3;
  return Array.from({ length: safeYears * 2 }, (_, i) => `Semester ${i + 1}`);
}

/** Longest programme the portal supports — used when no course/department is in scope. */
export const ALL_SEMESTERS = getSemestersForCourse(MAX_PROGRAM_YEARS);

/** Fallback for three-year programmes. */
export const DEFAULT_SEMESTERS = getSemestersForCourse(3);
