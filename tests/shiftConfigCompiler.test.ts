import { describe, it, expect } from "vitest";
import {
  ALL_SEMESTERS_KEY,
  cloneShiftParams,
  compileShiftConfigs,
  semesterParamsMapFromShiftConfigs,
  type SemesterParamsMap,
  type ShiftParamsTriple
} from "@/lib/shiftConfigCompiler";
import { DEFAULT_SHIFT_CONFIGS } from "@/lib/shiftDefaults";
import { computeCollegeTimeSlots } from "@/lib/lndGridModel";

const baseTriple = (): ShiftParamsTriple => ({
  shift_1: { ...DEFAULT_SHIFT_CONFIGS.shift_1, breaks: [] },
  shift_2: { ...DEFAULT_SHIFT_CONFIGS.shift_2, breaks: [] },
  general: { ...DEFAULT_SHIFT_CONFIGS.general, breaks: [] }
});

const withGeneral = (patch: Partial<ShiftParamsTriple["general"]>): ShiftParamsTriple => ({
  ...baseTriple(),
  general: { ...DEFAULT_SHIFT_CONFIGS.general, ...patch, breaks: patch.breaks ?? [] }
});

describe("shift config compiler", () => {
  it("compiles the All-Semesters triple into period arrays", () => {
    const result = compileShiftConfigs(withGeneral({ startTime: "08:30 AM", periodDuration: 50, periodsCount: 3 }), {}, true);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.configs.general).toEqual([
      "8.30 AM - 9.20 AM",
      "9.20 AM - 10.10 AM",
      "10.10 AM - 11.00 AM"
    ]);
    expect(result.configs.semester_configs).toEqual({});
  });

  it("keeps breaks out of the period array but inside the period maths", () => {
    const triple = withGeneral({
      startTime: "08:30 AM",
      periodDuration: 50,
      periodsCount: 3,
      breaks: [{ id: "b1", name: "Lunch Break", duration: 30, afterPeriod: 2 }]
    });

    const result = compileShiftConfigs(triple, {}, true);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.configs.general).toEqual([
      "8.30 AM - 9.20 AM",
      "9.20 AM - 10.10 AM",
      "10.40 AM - 11.30 AM"
    ]);
  });

  it("writes both the fallback arrays and a per-semester override", () => {
    const map: SemesterParamsMap = {
      "Semester 4": withGeneral({ startTime: "09:00 AM", periodDuration: 45, periodsCount: 2 })
    };

    const result = compileShiftConfigs(
      withGeneral({ startTime: "08:30 AM", periodDuration: 50, periodsCount: 2 }),
      map,
      true
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.configs.general).toEqual(["8.30 AM - 9.20 AM", "9.20 AM - 10.10 AM"]);
    expect(result.configs.semester_configs["Semester 4"].general).toEqual([
      "9.00 AM - 9.45 AM",
      "9.45 AM - 10.30 AM"
    ]);
    expect(result.configs.semester_configs["Semester 4"].custom_shift_params.general.periodDuration).toBe(45);
    expect(result.configs.custom_shift_params.general.periodDuration).toBe(50);
  });

  it("never stores the All Semesters key as a semester override", () => {
    const map: SemesterParamsMap = { [ALL_SEMESTERS_KEY]: withGeneral({ periodsCount: 1 }) };
    const result = compileShiftConfigs(withGeneral({ periodsCount: 2 }), map, true);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(Object.keys(result.configs.semester_configs)).toEqual([]);
    expect(result.configs.general).toHaveLength(2);
  });

  it("labels schedule errors with the semester and shift that produced them", () => {
    const broken = withGeneral({
      periodsCount: 4,
      breaks: [
        { id: "b1", name: "Lunch", duration: 30, afterPeriod: 2 },
        { id: "b2", name: "Tea", duration: 15, afterPeriod: 2 }
      ]
    });

    const result = compileShiftConfigs(baseTriple(), { "Semester 2": broken }, true);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toEqual([
      "Semester 2 - General Shift: Validation Warning: Multiple breaks are configured after the same period."
    ]);
  });

  it("ignores shift 1 and 2 problems for campuses without shifts", () => {
    const triple = baseTriple();
    triple.shift_1 = {
      ...triple.shift_1,
      periodsCount: 4,
      breaks: [
        { id: "b1", name: "Lunch", duration: 30, afterPeriod: 2 },
        { id: "b2", name: "Tea", duration: 15, afterPeriod: 2 }
      ]
    };

    expect(compileShiftConfigs(triple, {}, false).ok).toBe(true);

    const withShifts = compileShiftConfigs(triple, {}, true);
    expect(withShifts.ok).toBe(false);
    if (withShifts.ok) return;
    expect(withShifts.errors[0]).toContain("All Semesters - Shift 1:");
  });

  it("round-trips a stored blob back into an editable semester map", () => {
    const map: SemesterParamsMap = {
      "Semester 1": withGeneral({ startTime: "10:00 AM", periodDuration: 60, periodsCount: 4 })
    };
    const compiled = compileShiftConfigs(withGeneral({ periodsCount: 5 }), map, true);
    expect(compiled.ok).toBe(true);
    if (!compiled.ok) return;

    const restored = semesterParamsMapFromShiftConfigs(JSON.stringify(compiled.configs));
    expect(Object.keys(restored)).toEqual(["Semester 1"]);
    expect(restored["Semester 1"].general.startTime).toBe("10:00 AM");
    expect(restored["Semester 1"].general.periodsCount).toBe(4);
  });

  it("returns an empty map for legacy, missing or malformed blobs", () => {
    expect(semesterParamsMapFromShiftConfigs(undefined)).toEqual({});
    expect(semesterParamsMapFromShiftConfigs("{not json")).toEqual({});
    expect(
      semesterParamsMapFromShiftConfigs(JSON.stringify({ custom_shift_params: baseTriple() }))
    ).toEqual({});
    expect(
      semesterParamsMapFromShiftConfigs(
        JSON.stringify({ semester_configs: { "Semester 1": { shift_1: [] } } })
      )
    ).toEqual({});
  });

  it("deep-clones breaks so one semester cannot mutate another", () => {
    const source = withGeneral({
      breaks: [{ id: "b1", name: "Lunch Break", duration: 30, afterPeriod: 2 }]
    });
    const clone = cloneShiftParams(source);
    clone.general.breaks[0].duration = 60;

    expect(source.general.breaks[0].duration).toBe(30);
  });

  it("feeds the L&D grid the saved periods instead of its hardcoded fallback", () => {
    const compiled = compileShiftConfigs(baseTriple(), {}, true);
    expect(compiled.ok).toBe(true);
    if (!compiled.ok) return;

    const restored = { id: "Clg_TEST", shift_configs: JSON.stringify(compiled.configs) };
    expect(computeCollegeTimeSlots("Clg_TEST", [restored], [], [])).toEqual(compiled.configs.shift_1);

    // The payload shape the wizard saved before this restore carried no period
    // arrays, so every consumer fell through to the generic campus grid.
    const regressed = { id: "Clg_TEST", shift_configs: JSON.stringify({ custom_shift_params: baseTriple() }) };
    const fallback = computeCollegeTimeSlots("Clg_TEST", [regressed], [], []);
    expect(fallback[0]).toBe("Period 1 (08:30 AM - 09:25 AM)");
    expect(fallback).toHaveLength(6);
  });
});
