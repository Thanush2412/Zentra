import { describe, expect, it } from "vitest";
import {
  autoAssignSmes,
  consecutiveHardClash,
  facultyOnLeaveOn,
  hasSingleConsecutive,
  mentorSlotAvailabilityAt,
  smeFreeAt,
  smeSlotStatusAt,
  smesForSubjectGroup,
  type LndSlotSnapshot
} from "../src/lib/lndAllocationEngine";
import { buildLeaveIdsByDate, buildSessionsBySmeDate } from "../src/lib/lndGridIndexes";

// Slot labels are read as "the first two times in the string", so a period ordinal in the label
// ("Period 1 (09:00 AM ...)") would be parsed as 1:00. Real college periods are bare ranges.
const SLOTS = [
  "09:00 AM - 09:50 AM",
  "10:00 AM - 10:50 AM",
  "11:00 AM - 11:50 AM",
  "02:00 PM - 02:50 PM"
];

const WEEK = [
  { dateStr: "2026-10-26", day: "Monday" },
  { dateStr: "2026-10-27", day: "Tuesday" }
];

function snap(overrides: Partial<LndSlotSnapshot> = {}): LndSlotSnapshot {
  const rows: LndSlotSnapshot = {
    facultyLeaves: [],
    smeAvailability: [],
    demoSessions: [],
    // the same index builders the dashboard uses, so the engine is exercised on real lookups
    leaveIdsByDate: new Map(),
    sessionsBySmeDate: new Map(),
    weekDates: WEEK,
    mentors: [],
    smes: [],
    colleges: [],
    slots: [],
    holidays: [],
    subjectGroups: [],
    collegeTimeSlots: SLOTS,
    selectedWeek: 44,
    dayOrderFor: (dateStr, weekdayName, dayIndex) => ({
      dayOrder: `Day ${dayIndex + 1}`,
      effectiveTimetableDay: weekdayName,
      periods: SLOTS.length,
      isHoliday: false
    }),
    ...overrides
  };

  return {
    ...rows,
    leaveIdsByDate: overrides.leaveIdsByDate ?? buildLeaveIdsByDate(rows.facultyLeaves, WEEK.map(w => w.dateStr)),
    sessionsBySmeDate: overrides.sessionsBySmeDate ?? buildSessionsBySmeDate(rows.demoSessions)
  };
}

describe("smesForSubjectGroup", () => {
  const smes = [
    { id: "s1", name: "Asha", subject: "Computer Science", mentor_group: "", head_subject_group: "" },
    { id: "s2", name: "Bala", subject: "ECE", mentor_group: "CSE", head_subject_group: "" },
    { id: "s3", name: "Chitra", subject: "Mechanical", mentor_group: "Mech", head_subject_group: "CSE" },
    { id: "s4", name: "Deep", subject: "Physics", mentor_group: "", head_subject_group: "" }
  ];
  const subjectGroups = [{ name: "CSE", lead_sme_id: "s4" }];
  const s = snap({ smes, subjectGroups });

  it("matches subject, mentor group, head group and group-lead rows", () => {
    expect(smesForSubjectGroup(s, "CSE").map(m => m.id)).toEqual(["s2", "s3", "s4"]);
    expect(smesForSubjectGroup(s, "Computer Science").map(m => m.id)).toContain("s1");
    expect(smesForSubjectGroup(s, "mech").map(m => m.id)).toEqual(["s3"]);
  });

  it("returns nothing for an unknown group or a blank name", () => {
    expect(smesForSubjectGroup(s, "Civil")).toEqual([]);
    expect(smesForSubjectGroup(s, "")).toEqual([]);
  });
});

describe("smeFreeAt and smeSlotStatusAt", () => {
  it("keeps an unconfigured SME available only inside the default working day", () => {
    expect(smeFreeAt(snap(), "s1", "2026-10-26", SLOTS[0])).toBe(true);
    expect(smeFreeAt(snap(), "s1", "2026-10-26", "08:00 AM - 08:40 AM")).toBe(false);
    expect(smeSlotStatusAt(snap(), "s1", "Sunday", "2026-10-26", SLOTS[0]).status).toBe("off_duty");
  });

  it("honours configured windows and refuses training-only windows", () => {
    const demo = snap({ smeAvailability: [{ sme_id: "s1", day_of_week: "Monday", start_time: "10:00 AM", end_time: "11:00 AM", slot_type: "demo" }] });
    expect(smeFreeAt(demo, "s1", "2026-10-26", SLOTS[1])).toBe(true);
    expect(smeFreeAt(demo, "s1", "2026-10-26", SLOTS[0])).toBe(false);
    expect(smeSlotStatusAt(demo, "s1", "Monday", "2026-10-26", SLOTS[1]).label).toBe("Free Demo Slot");

    const training = snap({ smeAvailability: [{ sme_id: "s1", day_of_week: "Monday", start_time: "09:00 AM", end_time: "11:00 AM", slot_type: "training" }] });
    expect(smeFreeAt(training, "s1", "2026-10-26", SLOTS[0])).toBe(false);
    expect(smeSlotStatusAt(training, "s1", "Monday", "2026-10-26", SLOTS[0]).label).toBe("Training Time");
  });

  it("reports leave and booked sessions ahead of windows", () => {
    const withLeave = snap({ facultyLeaves: [{ mentorId: "s1", start_date: "2026-10-26", end_date: "2026-10-27", status: "approved" }] });
    expect(facultyOnLeaveOn(withLeave.facultyLeaves, "s1", "2026-10-27")).toBe(true);
    expect(smeSlotStatusAt(withLeave, "s1", "Tuesday", "2026-10-27", SLOTS[0]).label).toBe("SME on Leave");

    const booked = snap({ demoSessions: [{ smeId: "s1", dateStr: "2026-10-26", timeSlot: SLOTS[0], status: "confirmed", subject: "CSE" }] });
    expect(smeSlotStatusAt(booked, "s1", "Monday", "2026-10-26", SLOTS[0]).label).toBe("Confirmed L&D (Booked)");
    expect(smeFreeAt(booked, "s1", "2026-10-26", SLOTS[0])).toBe(false);
    // a cancelled session must not hold the slot
    const cancelled = snap({ demoSessions: [{ smeId: "s1", dateStr: "2026-10-26", timeSlot: SLOTS[0], status: "cancelled" }] });
    expect(smeFreeAt(cancelled, "s1", "2026-10-26", SLOTS[0])).toBe(true);
  });

  it("clashes against unsaved previews", () => {
    const preview = [{ smeId: "s1", dateStr: "2026-10-26", timeSlot: SLOTS[1] }];
    expect(smeFreeAt(snap(), "s1", "2026-10-26", SLOTS[1], preview)).toBe(false);
  });
});

describe("consecutive load rules", () => {
  const s = snap({
    demoSessions: [
      { smeId: "s1", dateStr: "2026-10-26", timeSlot: SLOTS[0], status: "confirmed" },
      { smeId: "s1", dateStr: "2026-10-26", timeSlot: SLOTS[1], status: "confirmed" }
    ]
  });

  it("soft-flags a single neighbour and hard-blocks three in a row", () => {
    expect(hasSingleConsecutive(s, "s1", true, "2026-10-26", SLOTS[2])).toBe(true);
    expect(consecutiveHardClash(s, "s1", true, "2026-10-26", SLOTS[2])).toBe(true);
    expect(consecutiveHardClash(s, "s1", true, "2026-10-26", SLOTS[3])).toBe(false);
  });

  it("counts generated previews as busy time", () => {
    const gen = [{ smeId: "s2", dateStr: "2026-10-26", timeSlot: SLOTS[1] }];
    expect(hasSingleConsecutive(s, "s2", true, "2026-10-26", SLOTS[0], gen)).toBe(true);
    expect(hasSingleConsecutive(s, "s2", true, "2026-10-26", SLOTS[3], gen)).toBe(false);
  });

  it("ignores periods outside the college period list", () => {
    expect(consecutiveHardClash(s, "s1", true, "2026-10-26", "Unknown slot")).toBe(false);
  });
});

describe("mentorSlotAvailabilityAt", () => {
  const mentor = { id: "m1", name: "Ravi", college_id: "c1", mentor_group: "CSE", subject: "CSE" };
  const sme = { id: "s1", name: "Asha", subject: "CSE", mentor_group: "", head_subject_group: "" };

  it("blocks on a missing mentor, a holiday or a timetable-free day", () => {
    expect(mentorSlotAvailabilityAt(snap(), "nope", "2026-10-26", SLOTS[0]).label).toBe("Mentor Not Found");

    const holiday = snap({
      mentors: [mentor], smes: [sme],
      dayOrderFor: () => ({ isHoliday: true, periods: 0, effectiveTimetableDay: "Holiday", dayOrder: "Holiday" })
    });
    expect(mentorSlotAvailabilityAt(holiday, "m1", "2026-10-26", SLOTS[0]).label).toBe("Campus Holiday");

    const closed = snap({
      mentors: [mentor], smes: [sme],
      dayOrderFor: () => ({ isHoliday: false, periods: 0, effectiveTimetableDay: "Sunday", dayOrder: "Day 1" })
    });
    expect(mentorSlotAvailabilityAt(closed, "m1", "2026-10-26", SLOTS[0]).label).toBe("No Timetable");
  });

  it("reports leave, booked demos, previews and teaching classes", () => {
    const leave = snap({ mentors: [mentor], smes: [sme], facultyLeaves: [{ mentorId: "m1", start_date: "2026-10-26", end_date: "2026-10-26", status: "approved" }] });
    expect(mentorSlotAvailabilityAt(leave, "m1", "2026-10-26", SLOTS[0]).label).toBe("On Leave");

    const demo = snap({ mentors: [mentor], smes: [sme], demoSessions: [{ mentorId: "m1", dateStr: "2026-10-26", timeSlot: SLOTS[0], status: "confirmed", subject: "CSE", smeName: "Asha" }] });
    expect(mentorSlotAvailabilityAt(demo, "m1", "2026-10-26", SLOTS[0]).label).toBe("L&D: CSE");

    const preview = snap({ mentors: [mentor], smes: [sme] });
    const previewed = mentorSlotAvailabilityAt(preview, "m1", "2026-10-26", SLOTS[0], undefined, [{ mentorId: "m1", dateStr: "2026-10-26", timeSlot: SLOTS[0], subject: "CSE", smeName: "Asha" }]);
    expect(previewed.label).toBe("Preview: CSE");

    const classSnap = snap({
      mentors: [mentor], smes: [sme],
      slots: [{ mentorId: "m1", day: "Monday", time: SLOTS[0], course: "Compiler Design", classGroup: "CSE-A", location: "Lab 2" }]
    });
    const occupied = mentorSlotAvailabilityAt(classSnap, "m1", "2026-10-26", SLOTS[0]);
    expect(occupied.label).toBe("Compiler Design");
    expect(occupied.details).toBe("Class in Lab 2");
  });

  it("is only free when a qualified SME is also free", () => {
    const ok = snap({ mentors: [mentor], smes: [sme] });
    const free = mentorSlotAvailabilityAt(ok, "m1", "2026-10-26", SLOTS[0]);
    expect(free.isAllocatable).toBe(true);
    expect(free.details).toBe("1 SME(s) free");

    const busySme = snap({
      mentors: [mentor], smes: [sme],
      demoSessions: [{ smeId: "s1", dateStr: "2026-10-26", timeSlot: SLOTS[0], status: "confirmed" }]
    });
    expect(mentorSlotAvailabilityAt(busySme, "m1", "2026-10-26", SLOTS[0]).label).toBe("No SME Available");

    const noSme = snap({ mentors: [mentor] });
    expect(mentorSlotAvailabilityAt(noSme, "m1", "2026-10-26", SLOTS[0]).details).toBe("No SME registered for CSE");
  });
});

describe("autoAssignSmes", () => {
  const mentors = [{ id: "m1", name: "Ravi", college_id: "c1", mentor_group: "CSE" }];
  const plain = { id: "s1", name: "Asha", subject: "CSE", is_head_sme: 0 };
  const head = { id: "s2", name: "Bala", subject: "CSE", is_head_sme: 1 };

  const base = (overrides: Partial<LndSlotSnapshot> = {}) => snap({ mentors, smes: [plain, head], ...overrides });

  const target = { mentorId: "m1", mentorName: "Ravi", dateStr: "2026-10-26", timeSlot: SLOTS[0], subject: "CSE", stream: "CSE-A" };

  it("returns empty results for no slots", () => {
    expect(autoAssignSmes(base(), [])).toEqual({ generated: [], exceptions: [] });
  });

  it("prefers the head SME for a subject match", () => {
    const { generated, exceptions } = autoAssignSmes(base(), [target]);
    expect(exceptions).toEqual([]);
    expect(generated[0].smeId).toBe("s2");
    expect(generated[0].week).toBe(44);
    expect(generated[0].collegeName).toBe("College");
  });

  it("keeps a valid pre-assigned SME from the workbook", () => {
    const { generated } = autoAssignSmes(base(), [{ ...target, smeId: "s1", smeName: "Asha" }]);
    expect(generated[0].smeId).toBe("s1");
  });

  it("raises one exception per rule that blocks the slot", () => {
    const holiday = autoAssignSmes(base({ holidays: [{ date: "2026-10-26" }] }), [target]);
    expect(holiday.exceptions[0].reason).toBe("Holiday Conflict");
    expect(holiday.exceptions[0].id).toMatch(/^exc_hol_0_\d+$/);

    const onLeave = autoAssignSmes(base({ facultyLeaves: [{ mentorId: "m1", start_date: "2026-10-26", end_date: "2026-10-26", status: "approved" }] }), [target]);
    expect(onLeave.exceptions[0].id).toMatch(/^exc_mleave_0_\d+$/);

    // the slot asks for a group nobody covers, while the mentor's own group still has SMEs
    const none = autoAssignSmes(base(), [{ ...target, subject: "ECE" }]);
    expect(none.exceptions[0].reason).toBe("No Qualified SME");
    expect(none.exceptions[0].id).toMatch(/^exc_nosme_0_\d+$/);

    const saturated = autoAssignSmes(base({
      demoSessions: [
        { smeId: "s1", dateStr: "2026-10-26", timeSlot: SLOTS[1], status: "confirmed" },
        { smeId: "s1", dateStr: "2026-10-26", timeSlot: SLOTS[2], status: "confirmed" },
        { smeId: "s2", dateStr: "2026-10-26", timeSlot: SLOTS[1], status: "confirmed" },
        { smeId: "s2", dateStr: "2026-10-26", timeSlot: SLOTS[2], status: "confirmed" }
      ]
    }), [target]);
    expect(saturated.exceptions[0].reason).toBe("SME Availability / Capacity Conflict");
    expect(saturated.exceptions[0].id).toMatch(/^exc_clash_0_\d+$/);
  });

  it("caps an SME at two demos a day and hands the slot to the next candidate", () => {
    const alreadyFull = autoAssignSmes(base({
      demoSessions: [
        { smeId: "s2", dateStr: "2026-10-26", timeSlot: SLOTS[2], status: "confirmed" },
        { smeId: "s2", dateStr: "2026-10-26", timeSlot: SLOTS[3], status: "confirmed" }
      ]
    }), [target]);
    expect(alreadyFull.generated).toHaveLength(1);
    expect(alreadyFull.generated[0].smeId).toBe("s1");

    // the head SME is scored first for both slots
    const spread = autoAssignSmes(base(), [
      { ...target, timeSlot: SLOTS[0] },
      { ...target, timeSlot: SLOTS[1] }
    ]);
    expect(spread.generated).toHaveLength(2);
    expect(spread.exceptions).toEqual([]);
    expect(spread.generated[0].smeId).toBe("s2");
  });

  it("is deterministic for the same input", () => {
    const a = autoAssignSmes(base(), [target]).generated;
    const b = autoAssignSmes(base(), [target]).generated;
    expect(a.map(g => g.smeId)).toEqual(b.map(g => g.smeId));
  });
});
