export interface SlotFilterRow {
  id: string;
  mentorId: string;
  day: string;
  time: string;
  course: string;
  location: string;
  shift?: string;
  classGroup?: string;
  college_id?: string;
}

export interface SlotFilterMentor {
  id: string;
  name?: string;
  department?: string;
  avatar?: string;
  college_id?: string;
}

export interface SlotFilterCollege {
  id: string;
  name?: string;
}

export interface SlotLookups {
  mentorsById: Map<string, SlotFilterMentor>;
  collegesById: Map<string, SlotFilterCollege>;
}

export interface SlotFilterQuery {
  collegeId?: string;
  day?: string;
  shift?: string;
  search?: string;
}

const WEEKDAY_ORDER = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

const SHIFT_NAMES: Record<string, string> = {
  shift_1: "Shift 1",
  shift_2: "Shift 2",
  general: "General Shift",
};

const UNRANKED_DAY = 90;

/**
 * The admin payload can carry tens of thousands of slots against thousands of mentors,
 * so campus/mentor resolution has to be a map lookup rather than a search per row.
 */
export function buildSlotLookups(
  mentors: readonly SlotFilterMentor[],
  colleges: readonly SlotFilterCollege[]
): SlotLookups {
  const mentorsById = new Map<string, SlotFilterMentor>();
  for (const mentor of mentors) {
    if (mentor && mentor.id) mentorsById.set(mentor.id, mentor);
  }

  const collegesById = new Map<string, SlotFilterCollege>();
  for (const college of colleges) {
    if (college && college.id) collegesById.set(college.id, college);
  }

  return { mentorsById, collegesById };
}

export function slotCollegeId(slot: SlotFilterRow, lookups: SlotLookups): string {
  return slot.college_id || lookups.mentorsById.get(slot.mentorId)?.college_id || "";
}

export function slotCollegeName(slot: SlotFilterRow, lookups: SlotLookups): string {
  const collegeId = slotCollegeId(slot, lookups);
  if (!collegeId) return "";
  return lookups.collegesById.get(collegeId)?.name || "";
}

/** Handles both calendar weekdays and the Day 1..N rotation labels slots are stored with. */
export function daySortKey(day?: string): number {
  const raw = String(day || "").trim().toLowerCase();
  if (!raw) return UNRANKED_DAY;

  if (raw.startsWith("day")) {
    const n = parseInt(raw.replace(/[^0-9]/g, ""), 10);
    return Number.isFinite(n) ? n : UNRANKED_DAY;
  }

  const idx = WEEKDAY_ORDER.findIndex((weekday) => weekday.startsWith(raw.slice(0, 3)));
  return idx >= 0 ? idx + 1 : UNRANKED_DAY;
}

export function slotTimeToMinutes(time?: string): number {
  const match = /(\d{1,2}):(\d{2})\s*(AM|PM)?/i.exec(String(time || ""));
  if (!match) return Number.MAX_SAFE_INTEGER;

  let hours = Number(match[1]) % 24;
  const minutes = Number(match[2]);
  const meridiem = String(match[3] || "").toUpperCase();
  if (meridiem === "PM" && hours < 12) hours += 12;
  if (meridiem === "AM" && hours === 12) hours = 0;

  return hours * 60 + minutes;
}

export function shiftLabel(shift?: string): string {
  const raw = String(shift || "").trim();
  if (!raw) return "No shift set";
  return SHIFT_NAMES[raw.toLowerCase()] || raw.replace(/_/g, " ");
}

export function filterSlots<T extends SlotFilterRow>(
  slots: readonly T[],
  query: SlotFilterQuery,
  lookups: SlotLookups
): T[] {
  const collegeId = query.collegeId && query.collegeId !== "all" ? query.collegeId : "";
  const day = query.day && query.day !== "all" ? query.day : "";
  const shift = query.shift && query.shift !== "all" ? query.shift : "";
  const search = String(query.search || "").trim().toLowerCase();

  const matched = slots.filter((slot) => {
    if (day && slot.day !== day) return false;
    if (shift && slot.shift !== shift) return false;
    if (collegeId && slotCollegeId(slot, lookups) !== collegeId) return false;

    if (search) {
      const mentor = lookups.mentorsById.get(slot.mentorId);
      const haystack = [
        slot.course,
        slot.location,
        slot.classGroup,
        mentor?.name,
        slotCollegeName(slot, lookups),
      ].join(" ").toLowerCase();
      if (!haystack.includes(search)) return false;
    }

    return true;
  });

  const decorated = matched.map((slot) => ({
    slot,
    college: slotCollegeName(slot, lookups),
    day: daySortKey(slot.day),
    time: slotTimeToMinutes(slot.time),
  }));

  decorated.sort((a, b) => {
    const byCollege = a.college.localeCompare(b.college);
    if (byCollege) return byCollege;
    const byDay = a.day - b.day;
    if (byDay) return byDay;
    const byTime = a.time - b.time;
    if (byTime) return byTime;
    return String(a.slot.course || "").localeCompare(String(b.slot.course || ""));
  });

  return decorated.map((entry) => entry.slot);
}

/** Filter vocabularies are read off the data so the pickers never offer a choice with no rows. */
export function collectSlotOptions(slots: readonly SlotFilterRow[]): { days: string[]; shifts: string[] } {
  const days = new Set<string>();
  const shifts = new Set<string>();

  for (const slot of slots) {
    if (slot.day) days.add(slot.day);
    if (slot.shift) shifts.add(slot.shift);
  }

  return {
    days: Array.from(days).sort((a, b) => daySortKey(a) - daySortKey(b) || a.localeCompare(b)),
    shifts: Array.from(shifts).sort(),
  };
}
