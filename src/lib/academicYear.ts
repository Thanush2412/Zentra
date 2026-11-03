/**
 * Dynamic Academic Year Utility
 * Automatically derives academic year based on current month (June/July start)
 * and generates forward/backward option ranges for dropdown selectors.
 */

export function getCurrentAcademicYear(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1; // 1-12
  // Indian academic year cycle typically starts in June/July
  const startYear = month >= 6 ? year : year - 1;
  return `${startYear}-${startYear + 1}`;
}

export function getAcademicYearOptions(rangeYears = 3): string[] {
  const current = new Date().getFullYear();
  const start = current - 1;
  return Array.from({ length: rangeYears + 2 }, (_, i) => {
    const y = start + i;
    return `${y}-${y + 1}`;
  });
}
