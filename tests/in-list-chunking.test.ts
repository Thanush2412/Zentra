import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it, vi } from "vitest";
import { chunkList, inPlaceholders, readInChunks, writeInChunks, IN_CHUNK } from "@/lib/db";

const source = (rel: string) => readFileSync(join(process.cwd(), rel), "utf8");

describe("IN-list chunking helpers", () => {
  it("binds exactly as many parameters as each statement has placeholders", async () => {
    const seen: { sql: string; params: any[] }[] = [];
    const db = {
      all: async (sql: string, ...args: any[]) => {
        const params = args.length === 1 && Array.isArray(args[0]) ? args[0] : args;
        seen.push({ sql, params });
        return params.map((id: string) => ({ id }));
      },
      run: async (sql: string, ...args: any[]) => {
        const params = args.length === 1 && Array.isArray(args[0]) ? args[0] : args;
        seen.push({ sql, params });
        return { changes: params.length };
      }
    } as any;

    const ids = Array.from({ length: 1201 }, (_, i) => `id-${i}`);
    const rows = await readInChunks(db, ids, (chunk, ph) => ({
      sql: `SELECT id FROM students WHERE id IN (${ph}) OR email IN (${ph})`,
      params: [...chunk, ...chunk]
    }));

    expect(chunkList(ids, IN_CHUNK)).toHaveLength(3);
    expect(seen).toHaveLength(3);
    expect(rows).toHaveLength(1201 * 2);
    for (const stmt of seen) {
      expect((stmt.sql.match(/\?/g) || []).length).toBe(stmt.params.length);
      expect(stmt.params.length).toBeLessThanOrEqual(IN_CHUNK * 2);
    }
  });

  it("sums affected rows across chunks instead of reporting one statement", async () => {
    const db = { run: async () => ({ changes: 500 }) } as any;
    const total = await writeInChunks(db, Array.from({ length: 1201 }, (_, i) => i), (chunk, ph) => ({
      sql: `DELETE FROM students WHERE id IN (${ph})`,
      params: [...chunk]
    }));
    expect(total).toBe(1500);
  });

  it("issues nothing for an empty id list", async () => {
    let calls = 0;
    const db = { all: async () => { calls++; return []; } } as any;
    expect(await readInChunks(db, [], () => ({ sql: "SELECT 1", params: [] }))).toEqual([]);
    expect(calls).toBe(0);
    expect(inPlaceholders(0)).toBe("");
  });
});

describe("routes that used to bind an unbounded id list", () => {
  it("scopes campus fees by membership instead of every student id", () => {
    const src = source("src/app/api/fees/route.ts");
    expect(src).toContain("student_id IN (SELECT id FROM students WHERE college_id = ?)");
    expect(src).not.toContain("WHERE student_id IN (${ph})");
  });

  it("chunks the interview child-table lookups", () => {
    const src = source("src/app/api/interviews/route.ts");
    expect(src).toContain("readInChunks(db, interviewIds");
    expect(src).not.toContain("WHERE interview_id IN (${placeholders})");
  });

  it("caps the student cascade delete instead of binding the list twelve times", () => {
    const src = source("src/app/api/students/route.ts");
    expect(src).toContain("Delete at most 500 students per request");
    expect(src).toContain("Array.from(new Set(ids.map(id => String(id).trim()).filter(Boolean)))");
  });

  it("chunks the subject-group rename writes", () => {
    const src = source("src/app/api/subject-groups/route.ts");
    // POST and PUT each map mentors and subjects.
    expect(src.match(/await writeInChunks\(db, (mentorIds|subjectIds)/g)).toHaveLength(4);
    expect(src).not.toContain("WHERE id IN (${placeholders})");
  });

  it("binds the relay lookup once per UNION arm", () => {
    const src = source("src/app/api/send-mail/route.ts");
    expect(src).toContain("KNOWN_USER_TABLES.flatMap(() => clean)");
    expect(src).not.toContain("clean.flatMap(() => clean)");
  });
});
