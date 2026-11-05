import { describe, expect, it } from "vitest";
import {
  labelForModuleType,
  matchesModuleFilter,
  moduleTypeOptions,
  normalizeModuleType,
  resolveModuleFilter
} from "@/lib/approvalModules";

const row = (module_type: string | null, current_status = "pending") => ({
  id: `appr_${module_type}_${current_status}`,
  module_type,
  current_status
});

describe("normalizeModuleType", () => {
  it("collapses the spellings the free-text column can hold", () => {
    expect(normalizeModuleType("Student_Leave")).toBe("student_leave");
    expect(normalizeModuleType(" Class-Swap ")).toBe("class_swap");
    expect(normalizeModuleType("class swap")).toBe("class_swap");
  });

  it("treats empty and null-ish values as absent", () => {
    for (const value of ["", "   ", null, undefined, "null", "NULL"]) {
      expect(normalizeModuleType(value)).toBe("");
    }
  });
});

describe("labelForModuleType", () => {
  it("labels the codes the approval route actually drives", () => {
    expect(labelForModuleType("student_leave")).toBe("Student Leave");
    expect(labelForModuleType("faculty_leave")).toBe("Faculty Leave");
    expect(labelForModuleType("interview")).toBe("Interview");
  });

  it("keeps class swap under its product name", () => {
    expect(labelForModuleType("swap_compensate")).toBe("Class Swap");
    expect(labelForModuleType("class_swap")).toBe("Class Swap");
  });

  it("title-cases an unknown code instead of hiding the row", () => {
    expect(labelForModuleType("exam_proctor_signoff")).toBe("Exam Proctor Signoff");
  });

  it("falls back to a generic label when the column is empty", () => {
    expect(labelForModuleType(null)).toBe("Request");
  });
});

describe("moduleTypeOptions", () => {
  it("offers only module types that have a row", () => {
    const options = moduleTypeOptions([row("student_leave"), row("student_leave"), row("interview")]);
    expect(options).toEqual([
      { value: "student_leave", label: "Student Leave", count: 2 },
      { value: "interview", label: "Interview", count: 1 }
    ]);
  });

  it("never offers the hardcoded types the queue used to list with no rows behind them", () => {
    const options = moduleTypeOptions([row("faculty_leave")]);
    const values = options.map((o) => o.value);
    expect(values).not.toContain("handover");
    expect(values).not.toContain("attendance");
    expect(values).not.toContain("timetable");
    expect(values).toEqual(["faculty_leave"]);
  });

  it("breaks count ties alphabetically so the picker order is stable", () => {
    const options = moduleTypeOptions([row("interview"), row("faculty_leave"), row("student_leave")]);
    expect(options.map((o) => o.label)).toEqual(["Faculty Leave", "Interview", "Student Leave"]);
  });

  it("skips rows with no module type and tolerates junk input", () => {
    expect(moduleTypeOptions([row(null), row("  "), row("interview")])).toEqual([
      { value: "interview", label: "Interview", count: 1 }
    ]);
    expect(moduleTypeOptions([])).toEqual([]);
    expect(moduleTypeOptions(null as any)).toEqual([]);
  });

  it("merges differently spelled values of the same type into one option", () => {
    const options = moduleTypeOptions([row("student_leave"), row("Student Leave")]);
    expect(options).toEqual([{ value: "student_leave", label: "Student Leave", count: 2 }]);
  });
});

describe("resolveModuleFilter", () => {
  const options = moduleTypeOptions([row("student_leave")]);

  it("keeps a selection that still has rows", () => {
    expect(resolveModuleFilter("student_leave", options)).toBe("student_leave");
  });

  it("drops a selection whose last row left the queue instead of showing a false empty state", () => {
    expect(resolveModuleFilter("interview", options)).toBe("all");
    expect(resolveModuleFilter("handover", options)).toBe("all");
  });

  it("passes the default through", () => {
    expect(resolveModuleFilter("all", options)).toBe("all");
    expect(resolveModuleFilter("", options)).toBe("all");
  });
});

describe("matchesModuleFilter", () => {
  it("matches everything under all, an empty filter, or a stale selection", () => {
    for (const filter of ["all", ""]) {
      expect(matchesModuleFilter(row("student_leave"), filter)).toBe(true);
      expect(matchesModuleFilter(row("interview"), filter)).toBe(true);
    }
  });

  it("matches the selected type in any of its stored spellings", () => {
    expect(matchesModuleFilter(row("student_leave"), "student_leave")).toBe(true);
    expect(matchesModuleFilter(row("Student Leave"), "student_leave")).toBe(true);
  });

  it("rejects other types instead of matching on a substring", () => {
    expect(matchesModuleFilter(row("faculty_leave"), "student_leave")).toBe(false);
    expect(matchesModuleFilter(row("leave"), "student_leave")).toBe(false);
    expect(matchesModuleFilter(row(null), "student_leave")).toBe(false);
  });
});
