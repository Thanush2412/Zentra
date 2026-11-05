import { describe, it, expect } from "vitest";
import {
  bandOfPeriodRows,
  isSundayDate,
  isWorkingSunday,
  readCompiledShiftPeriods,
  resolveSundayState,
  sundayOverridePayload,
  sundaysInMonth,
  type SundayState
} from "@/lib/sundaySchedule";
import { compileShiftConfigs, type ShiftParamsTriple } from "@/lib/shiftConfigCompiler";
import { DEFAULT_SHIFT_CONFIGS } from "@/lib/shiftDefaults";

const triple = (): ShiftParamsTriple => ({
  shift_1: { ...DEFAULT_SHIFT_CONFIGS.shift_1, breaks: [] },
  shift_2: { ...DEFAULT_SHIFT_CONFIGS.shift_2, breaks: [] },
  general: { ...DEFAULT_SHIFT_CONFIGS.general, breaks: [] }
});

describe("sunday date helpers", () => {
  it("lists every Sunday of a month, oldest first", () => {
    expect(sundaysInMonth("2026-11")).toEqual([
      "2026-11-01",
      "2026-11-08",
      "2026-11-15",
      "2026-11-22",
      "2026-11-29"
    ]);
    expect(sundaysInMonth("2026-12")).toEqual(["2026-12-06", "2026-12-13", "2026-12-20", "2026-12-27"]);
  });

  it("returns nothing for a malformed month", () => {
    expect(sundaysInMonth("2026-13")).toEqual([]);
    expect(sundaysInMonth("Nov-2026")).toEqual([]);
    expect(sundaysInMonth("")).toEqual([]);
  });

  it("only accepts real Sunday dates", () => {
    expect(isSundayDate("2026-11-01")).toBe(true);
    expect(isSundayDate("2026-11-02")).toBe(false);
    expect(isSundayDate("01-11-2026")).toBe(false);
  });
});

describe("the working-Sunday rule the portals read", () => {
  it("needs day_type working AND a day order that is not None", () => {
    expect(isWorkingSunday({ day_type: "working", day_order: "Day 3" })).toBe(true);
    expect(isWorkingSunday({ day_type: "working", day_order: "None" })).toBe(false);
    expect(isWorkingSunday({ day_type: "working" })).toBe(false);
    expect(isWorkingSunday({ day_type: "holiday", day_order: "Day 1" })).toBe(false);
    expect(isWorkingSunday(null)).toBe(false);
    expect(isWorkingSunday(undefined)).toBe(false);
  });

  it("reports a holiday-table row as blocking the override", () => {
    expect(resolveSundayState("2026-11-08", { day_type: "working", day_order: "Day 2" }, "Deepavali")).toMatchObject({
      status: "blocked",
      dayOrder: "Day 2",
      holidayTitle: "Deepavali"
    });
    expect(resolveSundayState("2026-11-08", { day_type: "holiday", day_order: "None" }, "Deepavali").status).toBe("closed");
    expect(resolveSundayState("2026-11-15", null, undefined)).toMatchObject({ status: "closed", hasConfig: false });
  });
});

describe("sunday override write payload", () => {
  const working: SundayState = {
    dateStr: "2026-11-08",
    status: "working",
    dayOrder: "Day 4",
    hasConfig: true,
    holidayTitle: ""
  };

  it("keeps the chosen day order instead of letting the server advance it", () => {
    expect(sundayOverridePayload("CLG1", { ...working, dateStr: "2026-11-08", working: true, dayOrder: "Day 4" })).toEqual({
      college_id: "CLG1",
      dateStr: "2026-11-08",
      day_type: "working",
      day_order: "Day 4",
      session_mode: "Offline",
      auto_advance: "false",
      notes: ""
    });
  });

  it("never sends skip_sundays, which would force the date back to a holiday", () => {
    const body = sundayOverridePayload("CLG1", { dateStr: "2026-11-08", working: true, dayOrder: "Day 1" });
    expect(body).not.toHaveProperty("skip_sundays");
  });

  it("collapses a closed Sunday to None and falls back when the order is unknown", () => {
    expect(sundayOverridePayload("CLG1", { dateStr: "2026-11-22", working: false, dayOrder: "Day 5" })).toMatchObject({
      day_type: "holiday",
      day_order: "None"
    });
    expect(sundayOverridePayload("CLG1", { dateStr: "2026-11-22", working: true, dayOrder: "Weekend" }).day_order).toBe("Day 1");
  });
});

describe("what a working Sunday actually runs", () => {
  it("reads the period arrays the compiler writes", () => {
    const compiled = compileShiftConfigs(triple(), {}, true);
    expect(compiled.ok).toBe(true);
    if (!compiled.ok) return;
    const periods = readCompiledShiftPeriods(JSON.stringify(compiled.configs));
    expect(periods.configured).toBe(true);
    expect(periods.general.length).toBeGreaterThan(0);
    expect(periods.shift_1.length).toBeGreaterThan(0);
  });

  it("flags an uncompiled campus so the panel says the default timetable applies", () => {
    expect(readCompiledShiftPeriods(undefined)).toEqual({ configured: false, general: [], shift_1: [], shift_2: [] });
    expect(readCompiledShiftPeriods("{not json").configured).toBe(false);
    expect(readCompiledShiftPeriods(JSON.stringify({ custom_shift_params: {} })).configured).toBe(false);
    // The three-part contract has no fourth key: a Sunday-only shift is not readable.
    expect(readCompiledShiftPeriods(JSON.stringify({ sunday: ["09:00 AM - 10:00 AM"] })).general).toEqual([]);
  });

  it("collapses period rows into the band the day opens and closes at", () => {
    // Campus period rows are stored in the "8.20 AM - 9.10 AM" shape the compiler emits.
    expect(bandOfPeriodRows(["8.20 AM - 9.10 AM", "1.00 PM - 1.50 PM"])).toEqual({
      start: "8.20 AM",
      end: "1.50 PM",
      periods: 2
    });
    expect(bandOfPeriodRows([])).toBeNull();
    expect(bandOfPeriodRows(["garbage"])).toBeNull();
  });
});
