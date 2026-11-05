import { describe, it, expect } from "vitest";
import {
  MAX_TEXT_LENGTH,
  SCORE_OPTIONS,
  bandOfScore,
  clampScore,
  coverageOf,
  formatNps,
  isMonthKey,
  monthKeyOf,
  monthLabel,
  monthsPresent,
  npsTone,
  summarize,
  trendByMonth,
  verbatimsOf,
  type StudentNpsRow
} from "@/lib/studentNps";

describe("student NPS month keys", () => {
  it("buckets by the institution clock, not UTC", () => {
    // IST is UTC+5:30, so the month boundary sits at 18:30Z — an answer filed at
    // 23:59 IST on 31 October must not land in November.
    expect(monthKeyOf(new Date("2026-10-31T18:29:00Z"))).toBe("2026-10");
    expect(monthKeyOf(new Date("2026-10-31T18:30:00Z"))).toBe("2026-11");
  });

  it("accepts only zero-padded YYYY-MM", () => {
    expect(isMonthKey("2026-11")).toBe(true);
    expect(isMonthKey("2026-1")).toBe(false);
    expect(isMonthKey("2026-13")).toBe(false);
    expect(isMonthKey("all")).toBe(false);
  });

  it("labels months for the pickers", () => {
    expect(monthLabel("2026-11")).toBe("Nov 2026");
    expect(monthLabel("2026-01")).toBe("Jan 2026");
    expect(monthLabel("garbage")).toBe("garbage");
  });
});

describe("score parsing", () => {
  it("keeps the picker honest about its range", () => {
    expect(SCORE_OPTIONS.map(o => o.value)).toEqual([5, 4, 3, 2, 1]);
    expect(clampScore(5)).toBe(5);
    expect(clampScore("4")).toBe(4);
    expect(clampScore(0)).toBeNull();
    expect(clampScore(6)).toBeNull();
    expect(clampScore(3.5)).toBeNull();
    expect(clampScore(null)).toBeNull();
    expect(clampScore("")).toBeNull();
  });

  it("classifies on the mentor thresholds", () => {
    expect(bandOfScore(5)).toBe("promoter");
    expect(bandOfScore(4)).toBe("passive");
    expect(bandOfScore(3)).toBe("detractor");
    expect(bandOfScore(1)).toBe("detractor");
    expect(bandOfScore(7)).toBeNull();
  });
});

describe("summarize", () => {
  it("computes the index from promoters minus detractors", () => {
    // 2 promoters, 1 passive, 2 detractors → (2-2)/5 = 0
    expect(summarize([5, 5, 4, 3, 1])).toEqual({
      npsIndex: 0,
      promoters: 2,
      passives: 1,
      detractors: 2,
      total: 5,
      avg: 3.6
    });
  });

  it("ignores answers that are not on the scale", () => {
    const summary = summarize([5, null, "abc", 4, 10]);
    expect(summary.total).toBe(2);
    expect(summary.avg).toBe(4.5);
    expect(summary.npsIndex).toBe(50);
  });

  it("reports nothing answered as no index rather than zero", () => {
    expect(summarize([])).toEqual({ npsIndex: null, promoters: 0, passives: 0, detractors: 0, total: 0, avg: 0 });
    expect(summarize([3, 3, 2]).npsIndex).toBe(-100);
  });
});

describe("monthly roll-ups", () => {
  const rows: StudentNpsRow[] = [
    { month_key: "2026-11", score: 5, student_id: "s1", student_name: "Asha", likes: "Pace", improve: "" },
    { month_key: "2026-11", score: 2, student_id: "s2", student_name: "Bala", likes: "", improve: "Doubt sessions" },
    { month_key: "2026-10", score: 4, student_id: "s3", student_name: null, likes: "", improve: "" },
    { month_key: "bad-key", score: 5, student_id: "s4" },
    { month_key: "2026-09", score: null, student_id: "s5" }
  ];

  it("buckets by month, oldest first, skipping unusable rows", () => {
    expect(trendByMonth(rows)).toEqual([
      // One promoter and one detractor cancel out; the lone 4 is a passive, so index 0.
      { month: "2026-10", label: "Oct 2026", npsIndex: 0, avg: 4, total: 1 },
      { month: "2026-11", label: "Nov 2026", npsIndex: 0, avg: 3.5, total: 2 }
    ]);
  });

  it("lists the months with answers, newest first", () => {
    expect(monthsPresent(rows)).toEqual(["2026-11", "2026-10"]);
  });

  it("keeps only the answers that carry words", () => {
    const verbatims = verbatimsOf(rows);
    expect(verbatims).toHaveLength(2);
    expect(verbatims[1]).toMatchObject({ student: "Bala", improve: "Doubt sessions", score: 2 });
  });

  it("names a hidden student rather than leaving a blank", () => {
    const anonymous = verbatimsOf([{ month_key: "2026-11", score: 3, likes: "nothing" }]);
    expect(anonymous[0].student).toBe("Anonymous");
  });

  it("caps the verbatim list", () => {
    const many: StudentNpsRow[] = Array.from({ length: 30 }, (_, i) => ({
      month_key: "2026-11",
      score: 5,
      student_id: `s${i}`,
      student_name: `Student ${i}`,
      likes: "ok"
    }));
    expect(verbatimsOf(many, 12)).toHaveLength(12);
  });
});

describe("coverage and display", () => {
  it("reads response share off the roster", () => {
    expect(coverageOf(12, 40)).toEqual({ enrolled: 40, respondents: 12, ratePct: 30 });
    // No campus selected means no roster was counted, so a percentage would be invented.
    expect(coverageOf(12, 0).ratePct).toBeNull();
  });

  it("formats the signed index and its tone", () => {
    expect(formatNps(null)).toBe("—");
    expect(formatNps(0)).toBe("0");
    expect(formatNps(42)).toBe("+42");
    expect(formatNps(-13)).toBe("-13");
    expect(npsTone(null)).toBe("neutral");
    expect(npsTone(-1)).toBe("danger");
    expect(npsTone(20)).toBe("warn");
    expect(npsTone(50)).toBe("good");
  });

  it("trims feedback text to the column budget", () => {
    expect(MAX_TEXT_LENGTH).toBe(500);
  });
});
