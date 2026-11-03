import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  reads: [] as string[],
  writes: [] as { sql: string; params: any }[],
  data: {
    groups: [] as any[],
    subjects: [] as any[],
    mentors: [] as any[]
  }
}));

function fakeDb() {
  return {
    all: async (sql: string) => {
      h.reads.push(sql);
      if (sql.includes("FROM subject_groups")) return h.data.groups.map(g => ({ ...g }));
      if (sql.includes("FROM subjects")) return h.data.subjects.map(s => ({ ...s }));
      if (sql.includes("FROM mentors")) return h.data.mentors.map(m => ({ ...m }));
      return [];
    },
    run: async (sql: string, params: any) => {
      h.writes.push({ sql, params });
      return { changes: 1 };
    }
  };
}

const { syncMentorSubjectGroups } = await import("@/lib/db");

beforeEach(() => {
  h.reads.length = 0;
  h.writes.length = 0;
  h.data.groups = [{ id: "g1", name: "Mathematics" }, { id: "g2", name: "English" }];
  h.data.subjects = [
    { id: "s1", name: "Engineering Mathematics", subject_group: null, mentor_group: null },
    { id: "s2", name: "Pure Math", subject_group: "General", mentor_group: "General" },
    { id: "s3", name: "Communicative English", subject_group: "", mentor_group: null }
  ];
  h.data.mentors = [
    { id: "m1", subjects: "Communicative English", department: "HU", mentor_group: null, subject_group: null },
    { id: "m2", subjects: "Thermodynamics", department: "ME", mentor_group: "Physics", subject_group: "Physics" }
  ];
});

describe("syncMentorSubjectGroups", () => {
  it("reads the three reference tables once and writes with two statements", async () => {
    await syncMentorSubjectGroups(fakeDb());

    expect(h.reads).toHaveLength(3);
    expect(h.writes).toHaveLength(2);
    expect(h.reads.some(sql => sql.includes("COALESCE(subject_group, mentor_group)"))).toBe(false);
  });

  it("matches the same rows the per-row UPDATEs used to touch", async () => {
    await syncMentorSubjectGroups(fakeDb());

    const subjectWrite = h.writes[0];
    expect(subjectWrite.sql).toMatch(/UPDATE subjects AS s/);
    expect(subjectWrite.sql).toMatch(/FROM \(VALUES/);
    // s1 -> Mathematics, s3 -> English; s2 ("Pure Math") stays untouched.
    expect(subjectWrite.params).toEqual(["s1", "Mathematics", "s3", "English"]);

    const mentorWrite = h.writes[1];
    expect(mentorWrite.sql).toMatch(/UPDATE mentors AS m/);
    expect(mentorWrite.params).toEqual(["m1", "English"]);
    // The "only fill empty groups" guard has to survive the rewrite.
    expect(mentorWrite.sql).toContain("(m.mentor_group IS NULL OR m.mentor_group = '' OR m.mentor_group = 'General')");
  });

  it("chunks a large backfill instead of issuing one UPDATE per row", async () => {
    h.data.subjects = Array.from({ length: 1201 }, (_, i) => ({
      id: `s${i}`,
      name: `Engineering Mathematics ${i}`,
      subject_group: null,
      mentor_group: null
    }));
    h.data.mentors = [];

    await syncMentorSubjectGroups(fakeDb());

    expect(h.writes).toHaveLength(3); // 1201 subject rows -> 500 + 500 + 201
    expect(h.writes[2].params).toHaveLength(201 * 2);
    expect(h.reads).toHaveLength(3);
  });

  it("does nothing when no groups are configured", async () => {
    h.data.groups = [];
    await syncMentorSubjectGroups(fakeDb());
    expect(h.reads).toHaveLength(1);
    expect(h.writes).toHaveLength(0);
  });
});
