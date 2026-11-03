import { describe, expect, it } from "vitest";
import {
  buildSlotLookups,
  collectSlotOptions,
  daySortKey,
  filterSlots,
  shiftLabel,
  slotCollegeId,
  slotCollegeName,
  slotTimeToMinutes,
  type SlotFilterRow,
} from "../src/lib/slotFilters";

const COLLEGES = [
  { id: "c1", name: "Kamaraj College" },
  { id: "c2", name: "Solamalai College" },
];

const MENTORS = [
  { id: "m1", name: "Dr. Meera Mentor", department: "CSE", college_id: "c1" },
  { id: "m2", name: "Prof. Arun Kumar", department: "ECE", college_id: "c2" },
];

const LOOKUPS = buildSlotLookups(MENTORS, COLLEGES);

const slot = (over: Partial<SlotFilterRow> & { id: string }): SlotFilterRow => ({
  mentorId: "m1",
  day: "Monday",
  time: "09:00 AM - 10:00 AM",
  course: "CS301",
  location: "HR-101",
  shift: "shift_1",
  classGroup: "CSE A",
  ...over,
});

describe("slot campus resolution", () => {
  it("prefers the slot's own college over the mentor's", () => {
    const tagged = slot({ id: "s1", mentorId: "m1", college_id: "c2" });
    expect(slotCollegeId(tagged, LOOKUPS)).toBe("c2");
    expect(slotCollegeName(tagged, LOOKUPS)).toBe("Solamalai College");
  });

  it("falls back to the mentor's college, then to nothing", () => {
    expect(slotCollegeName(slot({ id: "s2", mentorId: "m1" }), LOOKUPS)).toBe("Kamaraj College");
    expect(slotCollegeId(slot({ id: "s3", mentorId: "ghost" }), LOOKUPS)).toBe("");
    expect(slotCollegeName(slot({ id: "s3", mentorId: "ghost" }), LOOKUPS)).toBe("");
  });
});

describe("day and time ordering", () => {
  it("ranks calendar weekdays and Day 1..N rotation labels the same way", () => {
    expect(daySortKey("Monday")).toBe(1);
    expect(daySortKey("Sunday")).toBe(7);
    expect(daySortKey("Day 3")).toBe(3);
    expect(daySortKey("day 2 - Wednesday")).toBe(2);
    expect(daySortKey("Holiday")).toBe(90);
    expect(daySortKey(undefined)).toBe(90);
  });

  it("parses 12-hour ranges including the midnight and noon edges", () => {
    expect(slotTimeToMinutes("12:00 AM - 01:00 AM")).toBe(0);
    expect(slotTimeToMinutes("12:30 PM - 01:30 PM")).toBe(750);
    expect(slotTimeToMinutes("09:15 AM - 10:05 AM")).toBe(555);
    expect(slotTimeToMinutes("not a slot")).toBe(Number.MAX_SAFE_INTEGER);
  });
});

describe("filterSlots", () => {
  const rows: SlotFilterRow[] = [
    slot({ id: "a", mentorId: "m1", day: "Tuesday", time: "11:00 AM - 12:00 PM", course: "CS500" }),
    slot({ id: "b", mentorId: "m1", day: "Tuesday", time: "09:00 AM - 10:00 AM", course: "CS301" }),
    slot({ id: "c", mentorId: "m2", day: "Monday", time: "09:00 AM - 10:00 AM", course: "EC210", shift: "shift_2", classGroup: "ECE B", location: "LAB-3" }),
  ];

  it("returns everything unfiltered, sorted campus then day then period", () => {
    // Kamaraj (m1) before Solamalai (m2), then Tuesday 09:00 before Tuesday 11:00.
    expect(filterSlots(rows, {}, LOOKUPS).map(r => r.id)).toEqual(["b", "a", "c"]);
  });

  it("filters by campus, day and shift", () => {
    expect(filterSlots(rows, { collegeId: "c1" }, LOOKUPS).map(r => r.id)).toEqual(["b", "a"]);
    expect(filterSlots(rows, { day: "Monday" }, LOOKUPS).map(r => r.id)).toEqual(["c"]);
    expect(filterSlots(rows, { shift: "shift_2" }, LOOKUPS).map(r => r.id)).toEqual(["c"]);
    expect(filterSlots(rows, { collegeId: "all", day: "all", shift: "all" }, LOOKUPS)).toHaveLength(3);
  });

  it("searches course, room, class group, mentor and college without case", () => {
    expect(filterSlots(rows, { search: "cs5" }, LOOKUPS).map(r => r.id)).toEqual(["a"]);
    expect(filterSlots(rows, { search: "lab-3" }, LOOKUPS).map(r => r.id)).toEqual(["c"]);
    expect(filterSlots(rows, { search: "arun" }, LOOKUPS).map(r => r.id)).toEqual(["c"]);
    expect(filterSlots(rows, { search: "KAMARAJ" }, LOOKUPS).map(r => r.id)).toEqual(["b", "a"]);
    expect(filterSlots(rows, { search: "ece b" }, LOOKUPS).map(r => r.id)).toEqual(["c"]);
    expect(filterSlots(rows, { search: "   " }, LOOKUPS)).toHaveLength(3);
  });

  it("survives rows with missing mentor, shift and class group", () => {
    const messy = [slot({ id: "x", mentorId: "ghost", shift: undefined, classGroup: undefined, college_id: undefined })];
    expect(filterSlots(messy, {}, LOOKUPS)).toHaveLength(1);
    expect(filterSlots(messy, { search: "ghosty" }, LOOKUPS)).toHaveLength(0);
    expect(shiftLabel(undefined)).toBe("No shift set");
    expect(shiftLabel("night_3")).toBe("night 3");
  });

  it("offers only the day and shift values the data actually uses", () => {
    const options = collectSlotOptions([
      slot({ id: "1", day: "Wednesday" }),
      slot({ id: "2", day: "Monday", shift: "general" }),
      slot({ id: "3", day: "Day 2", shift: "shift_1" }),
      slot({ id: "4", day: "", shift: undefined }),
    ]);
    // Days follow daySortKey, so Monday (1) precedes the "Day 2" rotation label (2).
    expect(options.days).toEqual(["Monday", "Day 2", "Wednesday"]);
    expect(options.shifts).toEqual(["general", "shift_1"]);
  });
});

describe("filterSlots at admin payload size", () => {
  const MENTOR_COUNT = 5000;
  const SLOT_COUNT = 20000;

  const mentors = Array.from({ length: MENTOR_COUNT }, (_, i) => ({
    id: `mm${i}`,
    name: `Faculty Number ${i}`,
    department: "CSE",
    college_id: `cc${i % 20}`,
  }));
  const colleges = Array.from({ length: 20 }, (_, i) => ({ id: `cc${i}`, name: `Campus ${String(i).padStart(2, "0")}` }));
  const lookups = buildSlotLookups(mentors, colleges);

  const days = ["Monday", "Day 2", "Wednesday", "Day 4", "Friday"];
  const slots: SlotFilterRow[] = Array.from({ length: SLOT_COUNT }, (_, i) => ({
    id: `sl${i}`,
    mentorId: `mm${i % MENTOR_COUNT}`,
    // Spread on a slower cadence than the mentor rotation, otherwise one campus
    // would collapse onto a single weekday and a campus+day filter could never match.
    day: days[Math.floor(i / 5) % days.length],
    time: `${String(9 + (i % 6)).padStart(2, "0")}:00 AM - ${String(10 + (i % 6)).padStart(2, "0")}:00 AM`,
    course: `SUBJ${i % 400}`,
    location: `HR-${i % 90}`,
    shift: i % 3 === 0 ? "shift_1" : "general",
    classGroup: `Batch ${i % 12}`,
  }));

  it("filters and sorts the whole payload without scanning every mentor per row", () => {
    const startedAt = Date.now();
    const filtered = filterSlots(slots, { collegeId: "cc3", day: "Day 2", search: "subj1" }, lookups);
    const broad = filterSlots(slots, { search: "SUBJ1" }, lookups);
    const elapsed = Date.now() - startedAt;

    expect(filtered.length).toBeGreaterThan(0);
    expect(filtered.every(s => lookups.mentorsById.get(s.mentorId)?.college_id === "cc3")).toBe(true);
    expect(filtered.every(s => s.day === "Day 2")).toBe(true);
    expect(new Set(filtered.map(s => s.id)).size).toBe(filtered.length);

    // The broad pass is what proves the ordering: it spans every campus, day and period.
    expect(broad.length).toBeGreaterThan(1000);
    const bruteForce = slots.filter(s => {
      const mentor = lookups.mentorsById.get(s.mentorId);
      const haystack = [s.course, s.location, s.classGroup, mentor?.name, slotCollegeName(s, lookups)].join(" ").toLowerCase();
      return haystack.includes("subj1");
    });
    expect(broad).toHaveLength(bruteForce.length);
    for (let i = 1; i < broad.length; i++) {
      const prev = broad[i - 1];
      const curr = broad[i];
      // Campus names, not ids: the padded "Campus 02" sorts before "Campus 10" while
      // "cc10" would sort before "cc2", so this also proves the row order is what users read.
      const ordered =
        slotCollegeName(prev, lookups).localeCompare(slotCollegeName(curr, lookups)) ||
        daySortKey(prev.day) - daySortKey(curr.day) ||
        slotTimeToMinutes(prev.time) - slotTimeToMinutes(curr.time);
      expect(ordered <= 0).toBe(true);
    }

    // The previous implementation ran mentors.find() per row: ~100M comparisons for this
    // payload. Anything under a second and a half here means lookups are no longer scans.
    expect(elapsed).toBeLessThan(1500);
  });
});
