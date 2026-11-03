import { describe, it, expect } from "vitest";
import {
  isActiveSession,
  buildSessionsBySmeDate,
  buildSessionsByMentorDate,
  buildWeeklySessionCounts,
  buildSlotsByMentor,
  buildLeaveIdsByDate,
  buildRuleTargetsBySubject
} from "@/lib/lndGridIndexes";

const sessions = [
  { id: "s1", smeId: "sme-a", mentorId: "m1", dateStr: "2026-10-19", status: "confirmed", week: 42 },
  { id: "s2", sme_id: "sme-a", mentor_id: "m2", date_str: "2026-10-19", status: "cancelled", week_number: 42 },
  { id: "s3", smeId: "sme-b", mentorId: "m1", dateStr: "2026-10-21", status: "scheduled", week: 41 },
  { id: "s4", smeId: "sme-a", mentorId: "m1", dateStr: "2026-10-23", status: "confirmed", week: 41 },
  { id: "s5", smeId: "sme-a", mentorId: "m3", dateStr: "2026-10-19", status: "not_conducted", week: 42 }
];

const weekDates = ["2026-10-19", "2026-10-20", "2026-10-21", "2026-10-22", "2026-10-23"];

describe("lnd grid indexes", () => {
  it("ignores cancelled and not-conducted sessions", () => {
    expect(isActiveSession(sessions[0])).toBe(true);
    expect(isActiveSession(sessions[1])).toBe(false);
    expect(isActiveSession(sessions[4])).toBe(false);
  });

  it("groups sessions by sme+date, reading camel and snake keys alike", () => {
    const map = buildSessionsBySmeDate(sessions);
    expect([...map.keys()].sort()).toEqual(["sme-a|2026-10-19", "sme-a|2026-10-23", "sme-b|2026-10-21"]);
    // Buckets keep every session for that SME+date; the caller still filters status itself.
    expect(map.get("sme-a|2026-10-19")!.map(s => s.id)).toEqual(["s1", "s2", "s5"]);
  });

  it("matches the naive sme+date scan for every session", () => {
    const map = buildSessionsBySmeDate(sessions);
    sessions.forEach(s => {
      const smeId = s.smeId ?? s.sme_id;
      const dateStr = s.dateStr ?? s.date_str;
      const naive = sessions.filter(o => (o.smeId ?? o.sme_id) === smeId && (o.dateStr ?? o.date_str) === dateStr);
      expect(map.get(`${smeId}|${dateStr}`)).toEqual(naive);
    });
  });

  it("matches the naive mentor+date scan for every session", () => {
    const map = buildSessionsByMentorDate(sessions);
    sessions.forEach(s => {
      const mentorId = s.mentorId ?? s.mentor_id;
      const dateStr = s.dateStr ?? s.date_str;
      const naive = sessions.filter(o => (o.mentorId ?? o.mentor_id) === mentorId && (o.dateStr ?? o.date_str) === dateStr);
      expect(map.get(`${mentorId}|${dateStr}`)).toEqual(naive);
    });
  });

  it("counts a session for the week when the week number matches OR the date is in the visible week", () => {
    const counts = buildWeeklySessionCounts(sessions, 42, weekDates);
    // m1: s1 (week 42), s3 (week 41 but 10-21 is in week), s4 (week 41 but 10-23 is in week)
    expect(counts.get("m1")).toBe(3);
    // m2 only has a cancelled session, m3 only a not-conducted one.
    expect(counts.has("m2")).toBe(false);
    expect(counts.has("m3")).toBe(false);
  });

  it("agrees with a naive per-mentor weekly count over every mentor", () => {
    const counts = buildWeeklySessionCounts(sessions, 41, weekDates);
    const mentorIds = [...new Set(sessions.map(s => s.mentorId ?? s.mentor_id))];
    mentorIds.forEach(mentorId => {
      const naive = sessions.filter(s => {
        const isMentor = (s.mentorId ?? s.mentor_id) === mentorId;
        const d = s.dateStr ?? s.date_str;
        const weekHit = (s.week ?? s.week_number) === 41;
        return isMentor && (weekHit || (d && weekDates.includes(d))) && isActiveSession(s);
      }).length;
      expect(counts.get(mentorId) || 0).toBe(naive);
    });
  });

  it("groups timetable slots by mentor and drops unassigned slots", () => {
    const slots = [
      { mentorId: "m1", time: "09:00 AM" },
      { mentorId: "m1", time: "10:00 AM" },
      { mentorId: "", time: "11:00 AM" }
    ];
    const map = buildSlotsByMentor(slots);
    expect(map.get("m1")).toEqual([slots[0], slots[1]]);
    expect(map.has("")).toBe(false);
    expect([...map.keys()]).toHaveLength(1);
  });

  it("expands leave ranges into per-date id sets", () => {
    const leaves = [
      { mentor_id: "m1", status: "approved", start_date: "2026-10-20", end_date: "2026-10-22" },
      { mentorId: "m2", status: "approved", start_date: "2026-10-19", end_date: "2026-10-19" },
      { mentor_id: "m3", status: "pending", start_date: "2026-10-19", end_date: "2026-10-23" }
    ];
    const map = buildLeaveIdsByDate(leaves, weekDates);
    expect(map.get("2026-10-19")).toEqual(new Set(["m2"]));
    expect(map.get("2026-10-21")).toEqual(new Set(["m1"]));
    expect(map.get("2026-10-23")).toEqual(new Set());
    expect(map.has("2026-11-01")).toBe(false);
  });

  it("agrees with the naive isFacultyOnLeave scan for every indexed date", () => {
    const leaves = [
      { mentor_id: "m1", status: "approved", start_date: "2026-10-20", end_date: "2026-10-22" },
      { mentor_id: "m2", status: "approved", start_date: "2026-10-19", end_date: "2026-10-23" },
      { mentor_id: "m3", status: "rejected", start_date: "2026-10-19", end_date: "2026-10-23" }
    ];
    const map = buildLeaveIdsByDate(leaves, weekDates);
    const ids = ["m1", "m2", "m3", "m4"];
    weekDates.forEach(dateStr => {
      ids.forEach(id => {
        const naive = Boolean(leaves.some(fl =>
          (fl.mentor_id === id || (fl as any).mentorId === id) &&
          fl.status === "approved" &&
          dateStr >= fl.start_date &&
          dateStr <= fl.end_date
        ));
        expect(map.get(dateStr)!.has(id)).toBe(naive);
      });
    });
  });

  it("keys rule targets by trimmed lower-cased subject", () => {
    const rules = [
      { subject: "  Machine Learning ", target: 3 },
      { subject: "aptitude", target: 1 },
      { subject: "", target: 9 }
    ];
    const map = buildRuleTargetsBySubject(rules);
    expect(map.get("machine learning")).toBe(3);
    expect(map.get("aptitude")).toBe(1);
    expect([...map.keys()]).toHaveLength(2);
  });

  it("replaces the per-cell scans at production scale without changing results", () => {
    const days = 5;
    const bigSlots = Array.from({ length: 40000 }, (_, i) => ({
      mentorId: `m${i % 5000}`,
      day: i % 2 ? "Monday" : "Tuesday",
      time: `Period ${(i % 8) + 1}`,
      college_id: `cc${i % 20}`
    }));
    const bigSessions = Array.from({ length: 8000 }, (_, i) => ({
      mentorId: `m${i % 5000}`,
      smeId: `sme${i % 40}`,
      dateStr: `2026-10-${19 + (i % days)}`,
      status: i % 7 === 0 ? "cancelled" : "confirmed",
      week: 42
    }));
    const bigLeaves = Array.from({ length: 3000 }, (_, i) => ({
      mentor_id: `m${i % 5000}`,
      status: "approved",
      start_date: `2026-10-${19 + (i % 3)}`,
      end_date: `2026-10-${20 + (i % 3)}`
    }));

    const started = Date.now();
    const slotsByMentor = buildSlotsByMentor(bigSlots);
    const sessionsBySmeDate = buildSessionsBySmeDate(bigSessions);
    const weekly = buildWeeklySessionCounts(bigSessions, 42, weekDates);
    const leavesByDate = buildLeaveIdsByDate(bigLeaves, weekDates);

    // One representative cell: the lookups a dropdown would make.
    const candidateIds = Array.from({ length: 5000 }, (_, i) => `m${i}`);
    let slotCount = 0;
    let sessionCount = 0;
    candidateIds.forEach(id => {
      slotCount += (slotsByMentor.get(id) || []).length;
      sessionCount += weekly.get(id) || 0;
    });
    expect(slotCount).toBe(bigSlots.length);
    expect(sessionCount).toBe(bigSessions.filter(s => s.status !== "cancelled").length);
    expect(sessionsBySmeDate.get("sme0|2026-10-19")!.length).toBeGreaterThan(0);
    expect(leavesByDate.get("2026-10-19")!.size).toBeGreaterThan(0);
    expect(Date.now() - started).toBeLessThan(2000);
  });
});
