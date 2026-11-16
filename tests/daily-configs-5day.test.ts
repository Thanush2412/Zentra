import { describe, expect, it } from "vitest";
import {
  predictNextDayOrder,
  getWeekBoundaries,
  parseDayOrder,
  dayOrderCeiling,
  dayOrderOptions
} from "@/lib/dailyConfigForm";

describe("predictNextDayOrder", () => {
  it("cycles Day 1 through Day 5 and loops back to Day 1 for a 5-day campus", () => {
    expect(predictNextDayOrder("Day 1", 5)).toBe("Day 2");
    expect(predictNextDayOrder("Day 2", 5)).toBe("Day 3");
    expect(predictNextDayOrder("Day 3", 5)).toBe("Day 4");
    expect(predictNextDayOrder("Day 4", 5)).toBe("Day 5");
    expect(predictNextDayOrder("Day 5", 5)).toBe("Day 1");
  });

  it("cycles Day 1 through Day 6 and loops back to Day 1 for a 6-day campus", () => {
    expect(predictNextDayOrder("Day 1", 6)).toBe("Day 2");
    expect(predictNextDayOrder("Day 5", 6)).toBe("Day 6");
    expect(predictNextDayOrder("Day 6", 6)).toBe("Day 1");
  });

  it("defaults to Day 1 when lastDayOrder is empty or null", () => {
    expect(predictNextDayOrder(null, 5)).toBe("Day 1");
    expect(predictNextDayOrder("", 5)).toBe("Day 1");
    expect(predictNextDayOrder("None", 5)).toBe("Day 1");
  });
});

describe("getWeekBoundaries", () => {
  it("computes the correct Monday to Sunday week for a midweek date", () => {
    // 2026-11-18 is Wednesday
    const bounds = getWeekBoundaries("2026-11-18");
    expect(bounds.startDate).toBe("2026-11-16"); // Monday
    expect(bounds.endDate).toBe("2026-11-22");   // Sunday
    expect(bounds.weekDates).toHaveLength(7);
    expect(bounds.weekDates[0]).toBe("2026-11-16");
    expect(bounds.weekDates[6]).toBe("2026-11-22");
  });

  it("computes the correct Monday to Sunday week when reference is Sunday", () => {
    // 2026-11-22 is Sunday
    const bounds = getWeekBoundaries("2026-11-22");
    expect(bounds.startDate).toBe("2026-11-16");
    expect(bounds.endDate).toBe("2026-11-22");
  });

  it("computes the correct Monday to Sunday week when reference is Monday", () => {
    // 2026-11-16 is Monday
    const bounds = getWeekBoundaries("2026-11-16");
    expect(bounds.startDate).toBe("2026-11-16");
    expect(bounds.endDate).toBe("2026-11-22");
  });
});
