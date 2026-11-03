import { parseLocalDate } from "./localDate";

/**
 * Leave-cover handover rows created before the institution-timezone fix carry a
 * `datestr` one day behind the parent leave. Read paths correct it in memory;
 * only write paths persist the fix, so a plain GET never mutates rows.
 */

export interface HandoverDateCorrection {
  datestr: string;
  dateformatted: string;
}

/** Weekday label matching the `dateformatted` column style already in the DB. */
export function formatHandoverDate(dateStr: string): string {
  const noon = parseLocalDate(dateStr);
  noon.setHours(12, 0, 0, 0);
  return noon.toLocaleDateString("en-IN", {
    weekday: "long",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/** Returns the corrected pair when the stored handover date precedes the leave it covers. */
export function correctStaleHandoverDate(
  storedDate: string | null | undefined,
  leaveStartDate: string | null | undefined
): HandoverDateCorrection | null {
  if (!storedDate || !leaveStartDate) return null;
  if (storedDate >= leaveStartDate) return null;
  return { datestr: leaveStartDate, dateformatted: formatHandoverDate(leaveStartDate) };
}

/** Applies a correction in memory. Rows arrive with both camel and snake key aliases. */
export function applyHandoverDateCorrection<T extends Record<string, any>>(
  row: T,
  correction: HandoverDateCorrection
): T {
  const target = row as Record<string, any>;
  target.datestr = correction.datestr;
  target.dateStr = correction.datestr;
  target.dateformatted = correction.dateformatted;
  target.dateFormatted = correction.dateformatted;
  return row;
}
