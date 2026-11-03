import { describe, it, expect, vi, afterEach } from "vitest";
import {
  getInstitutionDateStr,
  getInstitutionDateStrOffset,
  parseLocalDate,
  INSTITUTION_TIME_ZONE
} from "../src/lib/localDate";

afterEach(() => vi.useRealTimers());

/**
 * The Vercel clock is UTC; the campuses are IST (UTC+5:30, no DST). Between
 * 00:00:00 and 05:29:59 IST the UTC calendar day is still yesterday, and any
 * day-window guard built on toISOString() rejects a legitimate current-day
 * submission. These tests pin the divergence and the helper that fixes it.
 */
describe("getInstitutionDateStr", () => {
  it("is a full day ahead of the UTC string in the 00:00-05:29 IST window", () => {
    const instant = new Date("2026-10-22T20:00:00Z"); // 01:30 IST on the 23rd
    expect(instant.toISOString().slice(0, 10)).toBe("2026-10-22");
    expect(getInstitutionDateStr(instant)).toBe("2026-10-23");
  });

  it("agrees with the UTC string for the rest of the day", () => {
    const instant = new Date("2026-10-22T08:00:00Z"); // 13:30 IST same day
    expect(getInstitutionDateStr(instant)).toBe(instant.toISOString().slice(0, 10));
  });

  it("reads the injected clock, not the wall clock", () => {
    vi.useFakeTimers().setSystemTime(new Date("2026-10-22T20:00:00Z"));
    expect(getInstitutionDateStr()).toBe("2026-10-23");
    expect(getInstitutionDateStr(new Date(), "UTC")).toBe("2026-10-22");
  });

  it("defaults to the institution's timezone", () => {
    expect(INSTITUTION_TIME_ZONE).toBe("Asia/Kolkata");
  });
});

describe("getInstitutionDateStrOffset", () => {
  it("offsets from the institution day, so the window never shifts a day early", () => {
    vi.useFakeTimers().setSystemTime(new Date("2026-10-22T20:00:00Z")); // institution today = 2026-10-23
    expect(getInstitutionDateStrOffset(-90)).toBe("2026-07-25");
    expect(getInstitutionDateStrOffset(-180)).toBe("2026-04-26");
    expect(getInstitutionDateStrOffset(0)).toBe("2026-10-23");
  });

  it("walks whole calendar days across a month boundary", () => {
    vi.useFakeTimers().setSystemTime(new Date("2026-11-01T02:00:00Z"));
    expect(getInstitutionDateStrOffset(-1)).toBe("2026-10-31");
  });
});

describe("parseLocalDate", () => {
  it("lands on the calendar day the string names, not the UTC one", () => {
    const d = parseLocalDate("2026-10-23");
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(9);
    expect(d.getDate()).toBe(23);
    expect(d.getHours()).toBe(0);
    expect(d.getDay()).toBe(5); // Friday
  });

  it("keeps the weekday correct at the start of the ISO string's UTC day", () => {
    // new Date("2026-10-23T00:00:00Z") is 05:30 IST — same weekday there, but
    // any negative-offset browser reads it as the 22nd.
    const utcMidnight = new Date("2026-10-23T00:00:00Z");
    const local = parseLocalDate("2026-10-23");
    expect(local.getDay()).toBe(5);
    expect(new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", weekday: "long" }).format(utcMidnight))
      .toBe("Thursday");
  });
});
