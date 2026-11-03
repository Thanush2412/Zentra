import { readdirSync, readFileSync, statSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";
import {
  getInstitutionDateStr,
  getInstitutionDateStrOffset,
  parseLocalDate,
} from "@/lib/localDate";

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) sourceFiles(full, out);
    else if (/\.ts$/.test(full)) out.push(full);
  }
  return out;
}

// Matches "today's date as YYYY-MM-DD" taken from the UTC clock: the ISO string
// is still yesterday for 5h30m after IST midnight.
const UTC_DAY_DERIVATION = /toISOString\(\)\s*\.\s*(?:split\(\s*["']T["']\s*\)\s*\[0\]|slice\(\s*0\s*,\s*10\s*\))/;

const utcMidnightMs = (dateStr: string) => Date.parse(`${dateStr}T00:00:00Z`);
const DAY_MS = 86_400_000;

describe("BE-H01: calendar days come from the institution timezone", () => {
  it("never builds a YYYY-MM-DD from the UTC clock inside API route handlers", () => {
    const offenders = sourceFiles(join(process.cwd(), "src", "app", "api"))
      .filter((file) => UTC_DAY_DERIVATION.test(readFileSync(file, "utf8")))
      .map((file) => file.replace(process.cwd(), ""));
    expect(offenders).toEqual([]);
  });

  it("rolls to the next institution day at 18:30 UTC, where the UTC string is still yesterday", () => {
    expect(new Date("2026-10-22T18:29:00Z").toISOString().split("T")[0]).toBe("2026-10-22");
    expect(getInstitutionDateStr(new Date("2026-10-22T18:29:00Z"))).toBe("2026-10-22");
    expect(getInstitutionDateStr(new Date("2026-10-22T18:30:00Z"))).toBe("2026-10-23");
    expect(getInstitutionDateStr(new Date("2026-03-31T18:30:00Z"))).toBe("2026-04-01");
    expect(getInstitutionDateStr(new Date("2025-12-31T18:30:00Z"))).toBe("2026-01-01");
  });

  it("offsets by whole institution calendar days, not by 24-hour clock jumps", () => {
    const today = getInstitutionDateStr();
    expect(getInstitutionDateStrOffset(0)).toBe(today);
    expect((utcMidnightMs(getInstitutionDateStrOffset(14)) - utcMidnightMs(today)) / DAY_MS).toBe(14);
    expect((utcMidnightMs(today) - utcMidnightMs(getInstitutionDateStrOffset(-1))) / DAY_MS).toBe(1);
  });

  it("parses a bare date as local midnight instead of UTC midnight", () => {
    const parsed = parseLocalDate("2026-10-22");
    expect(parsed.getFullYear()).toBe(2026);
    expect(parsed.getMonth()).toBe(9);
    expect(parsed.getDate()).toBe(22);
    expect(parsed.getHours()).toBe(0);
    // new Date("2026-10-22") would be 05:30 IST, and 00:00 UTC in a UTC runtime.
    expect(Date.parse("2026-10-22")).toBe(utcMidnightMs("2026-10-22"));
  });
});
