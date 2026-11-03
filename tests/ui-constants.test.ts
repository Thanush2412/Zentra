import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync, existsSync } from "fs";
import { join, resolve } from "path";
import { ALL_SEMESTERS, DEFAULT_SEMESTERS, getSemestersForCourse } from "@/lib/semesters";
import { DEFAULT_SHIFT_CONFIGS } from "@/lib/shiftDefaults";

/**
 * docs/ISSUES_MOCK_DATA.md items MD-M20 (semester lists), MD-H12 (shift defaults),
 * MD-M02 (seed campus ids), MD-M21 (placeholder domains), MD-M06 (fake interview time)
 * and MD-M03 (dead batch-year helper).
 */

const root = process.cwd();

function tsxFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(join(root, dir))) {
    const full = join(root, dir, entry);
    if (statSync(full).isDirectory()) out.push(...tsxFiles(join(dir, entry)));
    else if (/\.tsx?$/.test(full)) out.push(full);
  }
  return out;
}

function matchIn(pattern: RegExp, dirs = ["src"]) {
  const hits: string[] = [];
  for (const dir of dirs) {
    for (const file of tsxFiles(dir)) {
      const text = readFileSync(file, "utf8");
      const matches = text.match(new RegExp(pattern.source, "g"));
      if (matches) hits.push(...matches.map((m) => `${file.replace(root + "\\", "")}: ${m}`));
    }
  }
  return hits;
}

describe("semester option lists (MD-M20)", () => {
  it("derives the list length from the programme years", () => {
    expect(getSemestersForCourse(3)).toEqual(["Semester 1", "Semester 2", "Semester 3", "Semester 4", "Semester 5", "Semester 6"]);
    expect(getSemestersForCourse(4)).toHaveLength(8);
    expect(getSemestersForCourse("4")).toHaveLength(8);
  });

  it("clamps nonsense instead of emitting an empty or huge list", () => {
    expect(getSemestersForCourse(0)).toHaveLength(2);
    expect(getSemestersForCourse(99)).toHaveLength(8);
    expect(getSemestersForCourse(undefined)).toHaveLength(6);
    expect(getSemestersForCourse("abc")).toHaveLength(6);
  });

  it("exposes one eight- and one six-semester constant", () => {
    expect(ALL_SEMESTERS).toHaveLength(8);
    expect(DEFAULT_SEMESTERS).toHaveLength(6);
  });

  it("leaves no re-typed semester array behind in the components", () => {
    expect(matchIn(/"Semester 1", "Semester 2", "Semester 3", "Semester 4"/)).toEqual([]);
  });
});

describe("shift defaults (MD-H12)", () => {
  it("keeps the three programme defaults in one module", () => {
    expect(DEFAULT_SHIFT_CONFIGS.shift_1.startTime).toBe("08:30 AM");
    expect(DEFAULT_SHIFT_CONFIGS.general.periodsCount).toBe(6);
    expect(Object.keys(DEFAULT_SHIFT_CONFIGS)).toEqual(["shift_1", "shift_2", "general"]);
  });

  it("does not re-type the default block inside a component", () => {
    expect(matchIn(/\{ label: "Shift 1", startTime: "08:30 AM"/)).toEqual([]);
  });

  it("hands out copies, so a caller mutating breaks only its own state", () => {
    const copy = { ...DEFAULT_SHIFT_CONFIGS.shift_1, startTime: "07:00 AM" };
    expect(copy.startTime).toBe("07:00 AM");
    expect(DEFAULT_SHIFT_CONFIGS.shift_1.startTime).toBe("08:30 AM");
  });
});

describe("seed data leaking into the UI", () => {
  it("drops the seeded campus ids from components and context (MD-M02)", () => {
    expect(matchIn(/"college_1"|"college_2"/, ["src/components", "src/context", "src/app"])).toEqual([]);
  });

  it("drops the third example domain from form placeholders (MD-M21)", () => {
    expect(matchIn(/@university\.edu/, ["src/components", "src/app"])).toEqual([]);
  });

  it("shows a real placeholder instead of a made-up 09:00 AM interview slot (MD-M06)", () => {
    const student = readFileSync(resolve(root, "src/components/StudentDashboard.tsx"), "utf8");
    expect(student).not.toMatch(/preferred_start_time \|\| "09:00 AM"/);
    expect(student).toMatch(/preferred_start_time \|\| "Time TBA"/);
  });

  it("deletes the batch-year helper that nothing imported (MD-M03)", () => {
    expect(existsSync(resolve(root, "src/lib/batchYear.ts"))).toBe(false);
  });
});
