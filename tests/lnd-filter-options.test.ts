import { describe, it, expect } from "vitest";
import {
  mentorGroupOf,
  buildGroupCounts,
  groupCountLabel,
  toGroupFilterOptions,
  filterMentorsByGroup,
  filterMentorsByCampus
} from "@/lib/lndFilterOptions";

const mentors = [
  { id: "m1", name: "Aana", college_id: "c1", mentor_group: "CSE" },
  { id: "m2", name: "Bala", college_id: "c1", subject_group: "ECE" },
  { id: "m3", name: "Chella", college_id: "c2", department: "Mechanical" },
  { id: "m4", name: "Devi", college_id: "c2", mentor_group: "CSE" },
  { id: "m5", name: "Eswi", college_id: "c3" },
  { id: "m6", name: "Fai", college_id: "c1", mentor_group: "   " }
];

describe("l&d filter options", () => {
  it("resolves the group with mentor_group > subject_group > department fallback", () => {
    expect(mentorGroupOf(mentors[0])).toBe("CSE");
    expect(mentorGroupOf(mentors[1])).toBe("ECE");
    expect(mentorGroupOf(mentors[2])).toBe("Mechanical");
    expect(mentorGroupOf(mentors[4])).toBe("General");
    expect(mentorGroupOf(null)).toBe("General");
  });

  it("counts every campus together when scope is all, skipping blank groups", () => {
    const counts = buildGroupCounts(mentors, "all");
    expect(counts.get("CSE")).toBe(2);
    expect(counts.get("ECE")).toBe(1);
    expect(counts.get("General")).toBe(1);
    expect(counts.has("")).toBe(false);
    expect(counts.size).toBe(4);
  });

  it("drops groups that have no mentors on the selected campus", () => {
    const counts = buildGroupCounts(mentors, "c2");
    expect(Array.from(counts.keys()).sort()).toEqual(["CSE", "Mechanical"]);
    expect(counts.get("CSE")).toBe(1);
  });

  it("orders options alphabetically with mentor counts as the subtext", () => {
    const options = toGroupFilterOptions(buildGroupCounts(mentors, "c1"));
    expect(options.map(o => o.value)).toEqual(["CSE", "ECE"]);
    expect(options[0].subtext).toBe("1 mentor");
    expect(toGroupFilterOptions(buildGroupCounts(mentors, "all"))[0]).toEqual({
      value: "CSE",
      label: "CSE",
      subtext: "2 mentors"
    });
    expect(groupCountLabel(1)).toBe("1 mentor");
    expect(groupCountLabel(3)).toBe("3 mentors");
  });

  it("keeps a carried group visible even when the campus has none of its mentors", () => {
    const options = toGroupFilterOptions(buildGroupCounts(mentors, "c1"), {
      carriedValue: "Mechanical",
      carriedSubtext: "no mentors on this campus"
    });
    expect(options[0]).toEqual({
      value: "Mechanical",
      label: "Mechanical",
      subtext: "no mentors on this campus"
    });
    expect(options).toHaveLength(3);
  });

  it("does not duplicate a carried group that is already in scope", () => {
    const options = toGroupFilterOptions(buildGroupCounts(mentors, "all"), { carriedValue: "CSE" });
    expect(options.filter(o => o.value === "CSE")).toHaveLength(1);
  });

  it("matches groups case- and whitespace-insensitively", () => {
    expect(filterMentorsByGroup(mentors, "  cse ").map(m => m.id)).toEqual(["m1", "m4"]);
    expect(filterMentorsByGroup(mentors, "MECHANICAL").map(m => m.id)).toEqual(["m3"]);
    expect(filterMentorsByGroup(mentors, "All")).toHaveLength(mentors.length);
    expect(filterMentorsByGroup(mentors, "")).toHaveLength(mentors.length);
  });

  it("scopes mentors by campus", () => {
    expect(filterMentorsByCampus(mentors, "c1").map(m => m.id)).toEqual(["m1", "m2", "m6"]);
    expect(filterMentorsByCampus(mentors, "all")).toHaveLength(mentors.length);
  });

  it("skips null rows instead of crashing the scope passes", () => {
    const withHoles = [null, mentors[0], undefined, mentors[3]] as any[];
    expect(buildGroupCounts(withHoles, "all").get("CSE")).toBe(2);
    expect(filterMentorsByCampus(withHoles, "c2")).toHaveLength(1);
    expect(filterMentorsByGroup(withHoles, "CSE")).toHaveLength(2);
  });

  it("does not mutate the caller's mentor array", () => {
    const original = mentors.slice();
    filterMentorsByCampus(mentors, "all");
    filterMentorsByGroup(mentors, "All");
    expect(mentors).toEqual(original);
  });
});
